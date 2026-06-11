import { Router } from 'express';
import prisma from '../lib/prisma';
import ExcelJS from 'exceljs';

const router = Router();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function buildReportData(propertyId: number, year: number) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { company: true },
  });
  if (!property) throw new Error('Property not found');

  const tenancies = await prisma.tenancy.findMany({
    where: { property_id: propertyId },
    orderBy: { tenancy_start_date: 'asc' },
  });

  const incomes = await prisma.rentalIncome.findMany({
    where: { property_id: propertyId, income_month: { startsWith: String(year) } },
    include: { tenancy: { select: { tenant_name: true } } },
    orderBy: { income_month: 'asc' },
  });

  const expenses = await prisma.expense.findMany({
    where: {
      property_id: propertyId,
      expense_date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
    },
    orderBy: { expense_date: 'asc' },
  });

  const monthlyIncome: Record<string, number> = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    monthlyIncome[key] = incomes.filter(i => i.income_month === key).reduce((s, i) => s + i.amount_received, 0);
  }

  const expensesByCategory: Record<string, { items: typeof expenses; total: number }> = {};
  for (const exp of expenses) {
    if (!expensesByCategory[exp.category]) expensesByCategory[exp.category] = { items: [], total: 0 };
    expensesByCategory[exp.category].items.push(exp);
    expensesByCategory[exp.category].total += exp.amount;
  }

  const totalIncome = Object.values(monthlyIncome).reduce((s, v) => s + v, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return { property, tenancies, incomes, expenses, monthlyIncome, expensesByCategory, totalIncome, totalExpenses, year };
}

router.get('/statement/:propertyId', async (req, res) => {
  const { year } = req.query;
  const data = await buildReportData(Number(req.params.propertyId), Number(year) || new Date().getFullYear());
  res.json(data);
});

router.get('/statement/:propertyId/excel', async (req, res) => {
  const { year } = req.query;
  const data = await buildReportData(Number(req.params.propertyId), Number(year) || new Date().getFullYear());

  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.property.company.name;
  workbook.created = new Date();

  // Sheet 1 – Income
  const incomeSheet = workbook.addWorksheet('Rental Income');
  incomeSheet.columns = [
    { header: 'Month', key: 'month', width: 15 },
    { header: 'Amount (RM)', key: 'amount', width: 18 },
  ];
  incomeSheet.getRow(1).font = { bold: true };
  for (let m = 1; m <= 12; m++) {
    const key = `${data.year}-${String(m).padStart(2, '0')}`;
    incomeSheet.addRow({ month: `${MONTHS[m - 1]} ${data.year}`, amount: data.monthlyIncome[key] });
  }
  const totalIncomeRow = incomeSheet.addRow({ month: 'TOTAL', amount: data.totalIncome });
  totalIncomeRow.font = { bold: true };

  // Sheet 2 – Expenses
  const expSheet = workbook.addWorksheet('Expenses');
  expSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Description', key: 'description', width: 35 },
    { header: 'Vendor', key: 'vendor', width: 25 },
    { header: 'Invoice No.', key: 'invoice', width: 18 },
    { header: 'Amount (RM)', key: 'amount', width: 16 },
  ];
  expSheet.getRow(1).font = { bold: true };
  for (const exp of data.expenses) {
    expSheet.addRow({
      date: new Date(exp.expense_date).toLocaleDateString('en-GB'),
      category: exp.category,
      description: exp.description,
      vendor: exp.vendor_name,
      invoice: exp.invoice_number || '',
      amount: exp.amount,
    });
  }
  const totalExpRow = expSheet.addRow({ description: 'TOTAL', amount: data.totalExpenses });
  totalExpRow.font = { bold: true };

  // Sheet 3 – Summary
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [{ header: 'Item', key: 'item', width: 35 }, { header: 'Amount (RM)', key: 'amount', width: 18 }];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRow({ item: `Year of Assessment ${data.year}`, amount: '' });
  summarySheet.addRow({ item: `Property: ${data.property.property_name}`, amount: '' });
  summarySheet.addRow({ item: '', amount: '' });
  summarySheet.addRow({ item: 'Gross Rental Income', amount: data.totalIncome });
  summarySheet.addRow({ item: 'Less: Total Allowable Expenses', amount: data.totalExpenses });
  const netRow = summarySheet.addRow({ item: 'Net Rental Income', amount: data.totalIncome - data.totalExpenses });
  netRow.font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="statement-${data.property.property_name}-YA${data.year}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

router.get('/multi/excel', async (req, res) => {
  const { year, ids } = req.query;
  const yearNum = Number(year) || new Date().getFullYear();
  const propertyIds = String(ids).split(',').map(Number).filter(Boolean);
  if (!propertyIds.length) return res.status(400).json({ error: 'No property IDs provided' });

  const allData = await Promise.all(propertyIds.map(id => buildReportData(id, yearNum)));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = allData[0]?.property.company.name ?? 'MyHoldings';
  workbook.created = new Date();

  // Summary sheet — one row per property
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Property', key: 'property', width: 32 },
    { header: 'Company', key: 'company', width: 28 },
    { header: 'Gross Income (RM)', key: 'income', width: 20 },
    { header: 'Total Expenses (RM)', key: 'expenses', width: 20 },
    { header: 'Net Income (RM)', key: 'net', width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRow({ property: `Year of Assessment ${yearNum}`, company: '', income: '', expenses: '', net: '' });
  for (const d of allData) {
    summarySheet.addRow({
      property: d.property.property_name,
      company: d.property.company.name,
      income: d.totalIncome,
      expenses: d.totalExpenses,
      net: d.totalIncome - d.totalExpenses,
    });
  }
  const totals = summarySheet.addRow({
    property: 'TOTAL',
    company: '',
    income: allData.reduce((s, d) => s + d.totalIncome, 0),
    expenses: allData.reduce((s, d) => s + d.totalExpenses, 0),
    net: allData.reduce((s, d) => s + d.totalIncome - d.totalExpenses, 0),
  });
  totals.font = { bold: true };

  // One income + one expense sheet per property
  for (const d of allData) {
    const safeName = d.property.property_name.replace(/[/\\*?:\[\]]/g, '').slice(0, 25);

    const incSheet = workbook.addWorksheet(`${safeName} - Income`);
    incSheet.columns = [{ header: 'Month', key: 'month', width: 15 }, { header: 'Amount (RM)', key: 'amount', width: 18 }];
    incSheet.getRow(1).font = { bold: true };
    for (let m = 1; m <= 12; m++) {
      const key = `${d.year}-${String(m).padStart(2, '0')}`;
      incSheet.addRow({ month: `${MONTHS[m - 1]} ${d.year}`, amount: d.monthlyIncome[key] });
    }
    incSheet.addRow({ month: 'TOTAL', amount: d.totalIncome }).font = { bold: true };

    const expSheet = workbook.addWorksheet(`${safeName} - Expenses`);
    expSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Description', key: 'description', width: 35 },
      { header: 'Vendor', key: 'vendor', width: 25 },
      { header: 'Invoice No.', key: 'invoice', width: 18 },
      { header: 'Amount (RM)', key: 'amount', width: 16 },
    ];
    expSheet.getRow(1).font = { bold: true };
    for (const exp of d.expenses) {
      expSheet.addRow({
        date: new Date(exp.expense_date).toLocaleDateString('en-GB'),
        category: exp.category,
        description: exp.description,
        vendor: exp.vendor_name,
        invoice: exp.invoice_number || '',
        amount: exp.amount,
      });
    }
    expSheet.addRow({ description: 'TOTAL', amount: d.totalExpenses }).font = { bold: true };
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="statement-combined-YA${yearNum}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
