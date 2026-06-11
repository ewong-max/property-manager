import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';

const router = Router();

// Resolve the uploads directory — next to the exe when packaged, or in server/ during dev
function getUploadsDir() {
  return (process as any).pkg
    ? path.join(path.dirname(process.execPath), 'uploads')
    : path.join(__dirname, '../../uploads');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = getUploadsDir();
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const { property_id, category, year } = req.query;

  const where: Record<string, unknown> = {};
  if (property_id) where.property_id = Number(property_id);
  if (category) where.category = String(category);
  if (year) {
    where.expense_date = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { property: { select: { property_name: true } } },
    orderBy: { expense_date: 'desc' },
  });
  res.json(expenses);
});

router.get('/:id', async (req, res) => {
  const expense = await prisma.expense.findUnique({
    where: { id: Number(req.params.id) },
    include: { property: { select: { property_name: true } } },
  });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  res.json(expense);
});

router.post('/', upload.single('invoice'), async (req, res) => {
  const {
    property_id, expense_date, category, description,
    amount, invoice_number, vendor_name,
  } = req.body;

  const expense = await prisma.expense.create({
    data: {
      property_id: Number(property_id),
      expense_date: new Date(expense_date),
      category,
      description,
      amount: Number(amount),
      invoice_number: invoice_number || null,
      vendor_name,
      invoice_file_path: req.file ? req.file.filename : null,
    },
  });
  res.status(201).json(expense);
});

router.put('/:id', upload.single('invoice'), async (req, res) => {
  const {
    property_id, expense_date, category, description,
    amount, invoice_number, vendor_name,
  } = req.body;

  const existing = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  const expense = await prisma.expense.update({
    where: { id: Number(req.params.id) },
    data: {
      property_id: Number(property_id),
      expense_date: new Date(expense_date),
      category,
      description,
      amount: Number(amount),
      invoice_number: invoice_number || null,
      vendor_name,
      invoice_file_path: req.file ? req.file.filename : existing.invoice_file_path,
    },
  });
  res.json(expense);
});

router.delete('/:id', async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } });
  if (expense?.invoice_file_path) {
    const filePath = path.join(getUploadsDir(), expense.invoice_file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await prisma.expense.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

export default router;
