import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req, res) => {
  const { company_id } = req.query;
  const properties = await prisma.property.findMany({
    where: company_id ? { company_id: Number(company_id) } : undefined,
    include: {
      company: { select: { name: true } },
      _count: { select: { tenancies: true, expenses: true } },
    },
    orderBy: { created_at: 'desc' },
  });
  res.json(properties);
});

router.get('/:id', async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      company: true,
      tenancies: { orderBy: { tenancy_start_date: 'desc' } },
      expenses: { orderBy: { expense_date: 'desc' } },
    },
  });
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(property);
});

router.post('/', async (req, res) => {
  const {
    company_id, property_name, address, title_type, property_type,
    purchase_date, purchase_price, annual_assessment, quit_rent,
  } = req.body;
  const property = await prisma.property.create({
    data: {
      company_id: Number(company_id),
      property_name,
      address,
      title_type,
      property_type,
      purchase_date: purchase_date ? new Date(purchase_date) : null,
      purchase_price: purchase_price ? Number(purchase_price) : null,
      annual_assessment: annual_assessment ? Number(annual_assessment) : null,
      quit_rent: quit_rent ? Number(quit_rent) : null,
    },
  });
  res.status(201).json(property);
});

router.put('/:id', async (req, res) => {
  const {
    company_id, property_name, address, title_type, property_type,
    purchase_date, purchase_price, annual_assessment, quit_rent,
  } = req.body;
  const property = await prisma.property.update({
    where: { id: Number(req.params.id) },
    data: {
      company_id: Number(company_id),
      property_name,
      address,
      title_type,
      property_type,
      purchase_date: purchase_date ? new Date(purchase_date) : null,
      purchase_price: purchase_price ? Number(purchase_price) : null,
      annual_assessment: annual_assessment ? Number(annual_assessment) : null,
      quit_rent: quit_rent ? Number(quit_rent) : null,
    },
  });
  res.json(property);
});

router.delete('/:id', async (req, res) => {
  await prisma.property.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

router.get('/:id/summary', async (req, res) => {
  const { year } = req.query;
  const propertyId = Number(req.params.id);
  const targetYear = year ? Number(year) : new Date().getFullYear();

  const [incomes, expenses, activeTenancy] = await Promise.all([
    prisma.rentalIncome.findMany({
      where: {
        property_id: propertyId,
        income_month: { startsWith: String(targetYear) },
      },
    }),
    prisma.expense.findMany({
      where: {
        property_id: propertyId,
        expense_date: {
          gte: new Date(`${targetYear}-01-01`),
          lte: new Date(`${targetYear}-12-31`),
        },
      },
    }),
    prisma.tenancy.findFirst({
      where: { property_id: propertyId, status: 'active' },
    }),
  ]);

  const totalIncome = incomes.reduce((s, r) => s + r.amount_received, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  res.json({ totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses, activeTenancy });
});

export default router;
