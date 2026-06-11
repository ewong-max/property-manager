import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req, res) => {
  const { property_id, status } = req.query;
  const tenancies = await prisma.tenancy.findMany({
    where: {
      ...(property_id ? { property_id: Number(property_id) } : {}),
      ...(status ? { status: String(status) } : {}),
    },
    include: { property: { select: { property_name: true, address: true } } },
    orderBy: { tenancy_start_date: 'desc' },
  });
  res.json(tenancies);
});

router.get('/:id', async (req, res) => {
  const tenancy = await prisma.tenancy.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      property: true,
      rental_incomes: { orderBy: { income_month: 'asc' } },
    },
  });
  if (!tenancy) return res.status(404).json({ error: 'Tenancy not found' });
  res.json(tenancy);
});

router.post('/', async (req, res) => {
  const {
    property_id, tenant_name, tenant_ic_or_ssm, contact_number,
    rental_amount, deposit_amount, tenancy_start_date, tenancy_end_date,
  } = req.body;

  // Ensure no active tenancy exists for this property
  const existing = await prisma.tenancy.findFirst({
    where: { property_id: Number(property_id), status: 'active' },
  });
  if (existing) {
    return res.status(400).json({ error: 'This property already has an active tenancy. Terminate it first.' });
  }

  const tenancy = await prisma.tenancy.create({
    data: {
      property_id: Number(property_id),
      tenant_name,
      tenant_ic_or_ssm,
      contact_number,
      rental_amount: Number(rental_amount),
      deposit_amount: deposit_amount ? Number(deposit_amount) : 0,
      tenancy_start_date: new Date(tenancy_start_date),
      tenancy_end_date: tenancy_end_date ? new Date(tenancy_end_date) : null,
      status: 'active',
    },
  });
  res.status(201).json(tenancy);
});

router.put('/:id', async (req, res) => {
  const {
    tenant_name, tenant_ic_or_ssm, contact_number,
    rental_amount, deposit_amount, tenancy_start_date, tenancy_end_date,
  } = req.body;
  const tenancy = await prisma.tenancy.update({
    where: { id: Number(req.params.id) },
    data: {
      tenant_name,
      tenant_ic_or_ssm,
      contact_number,
      rental_amount: Number(rental_amount),
      deposit_amount: deposit_amount ? Number(deposit_amount) : 0,
      tenancy_start_date: new Date(tenancy_start_date),
      tenancy_end_date: tenancy_end_date ? new Date(tenancy_end_date) : null,
    },
  });
  res.json(tenancy);
});

router.post('/:id/terminate', async (req, res) => {
  const { termination_date, termination_reason } = req.body;
  const tenancy = await prisma.tenancy.update({
    where: { id: Number(req.params.id) },
    data: {
      status: 'terminated',
      termination_date: new Date(termination_date),
      termination_reason,
    },
  });
  res.json(tenancy);
});

export default router;
