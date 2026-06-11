import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req, res) => {
  const { property_id, tenancy_id, year } = req.query;

  const where: Record<string, unknown> = {};
  if (property_id) where.property_id = Number(property_id);
  if (tenancy_id) where.tenancy_id = Number(tenancy_id);
  if (year) where.income_month = { startsWith: String(year) };

  const incomes = await prisma.rentalIncome.findMany({
    where,
    include: {
      tenancy: { select: { tenant_name: true } },
      property: { select: { property_name: true } },
    },
    orderBy: { income_month: 'asc' },
  });
  res.json(incomes);
});

router.get('/:id', async (req, res) => {
  const income = await prisma.rentalIncome.findUnique({
    where: { id: Number(req.params.id) },
    include: { tenancy: true, property: true },
  });
  if (!income) return res.status(404).json({ error: 'Income record not found' });
  res.json(income);
});

router.post('/', async (req, res) => {
  const { tenancy_id, property_id, income_month, amount_received, payment_date, notes } = req.body;

  // Check for duplicate month entry
  const existing = await prisma.rentalIncome.findFirst({
    where: { tenancy_id: Number(tenancy_id), income_month: String(income_month) },
  });
  if (existing) {
    return res.status(400).json({ error: `Income for ${income_month} already recorded for this tenancy.` });
  }

  const income = await prisma.rentalIncome.create({
    data: {
      tenancy_id: Number(tenancy_id),
      property_id: Number(property_id),
      income_month: String(income_month),
      amount_received: Number(amount_received),
      payment_date: new Date(payment_date),
      notes: notes || null,
    },
  });
  res.status(201).json(income);
});

router.put('/:id', async (req, res) => {
  const { income_month, amount_received, payment_date, notes } = req.body;
  const income = await prisma.rentalIncome.update({
    where: { id: Number(req.params.id) },
    data: {
      income_month: String(income_month),
      amount_received: Number(amount_received),
      payment_date: new Date(payment_date),
      notes: notes || null,
    },
  });
  res.json(income);
});

router.delete('/:id', async (req, res) => {
  await prisma.rentalIncome.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

export default router;
