import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req, res) => {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { properties: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(companies);
});

router.get('/:id', async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: Number(req.params.id) },
    include: { properties: { orderBy: { created_at: 'desc' } } },
  });
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(company);
});

router.post('/', async (req, res) => {
  const { name, registration_number, address, contact_person } = req.body;
  const company = await prisma.company.create({
    data: { name, registration_number, address, contact_person },
  });
  res.status(201).json(company);
});

router.put('/:id', async (req, res) => {
  const { name, registration_number, address, contact_person } = req.body;
  const company = await prisma.company.update({
    where: { id: Number(req.params.id) },
    data: { name, registration_number, address, contact_person },
  });
  res.json(company);
});

router.delete('/:id', async (req, res) => {
  await prisma.company.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

export default router;
