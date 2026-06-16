import 'express-async-errors';
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const isPkg = !!(process as any).pkg;
const exeDir = isPkg ? path.dirname(process.execPath) : null;

import { authMiddleware } from './middleware/auth';
import companiesRouter from './routes/companies';
import propertiesRouter from './routes/properties';
import tenanciesRouter from './routes/tenancies';
import expensesRouter from './routes/expenses';
import incomeRouter from './routes/income';
import reportsRouter from './routes/reports';
import invoiceAnalysisRouter from './routes/invoiceAnalysis';
import backupRouter from './routes/backup';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists (next to exe when packaged, or in server/ during dev)
const uploadsDir = isPkg
  ? path.join(exeDir!, 'uploads')
  : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const tmpDir = path.join(uploadsDir, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all localhost origins
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Auth endpoint (PIN login)
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { pin } = req.body;
  if (pin === process.env.PIN) {
    res.json({ token: process.env.PIN });
  } else {
    res.status(401).json({ error: 'Invalid PIN' });
  }
});

// Protected routes
app.use('/api/companies', authMiddleware, companiesRouter);
app.use('/api/properties', authMiddleware, propertiesRouter);
app.use('/api/tenancies', authMiddleware, tenanciesRouter);
app.use('/api/expenses', authMiddleware, expensesRouter);
app.use('/api/income', authMiddleware, incomeRouter);
app.use('/api/reports', authMiddleware, reportsRouter);
app.use('/api/analyse-invoice', authMiddleware, invoiceAnalysisRouter);
app.use('/api/backup', authMiddleware, backupRouter);

// Dashboard stats
app.get('/api/dashboard', authMiddleware, async (req: Request, res: Response) => {
  const prisma = (await import('./lib/prisma')).default;
  const currentYear = new Date().getFullYear();

  const [totalProperties, totalActiveTenants, incomeAgg, expensesAgg] = await Promise.all([
    prisma.property.count(),
    prisma.tenancy.count({ where: { status: 'active' } }),
    prisma.rentalIncome.aggregate({
      _sum: { amount_received: true },
      where: { income_month: { startsWith: String(currentYear) } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        expense_date: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`),
        },
      },
    }),
  ]);

  res.json({
    totalProperties,
    totalActiveTenants,
    totalIncomeCurrentYear: incomeAgg._sum.amount_received || 0,
    totalExpensesCurrentYear: expensesAgg._sum.amount || 0,
    currentYear,
  });
});

// ── Dashboard: year-aware overview + per-property breakdown ──────────────────
app.get('/api/dashboard/overview', authMiddleware, async (req: Request, res: Response) => {
  const prisma = (await import('./lib/prisma')).default;
  const year = Number(req.query.year) || new Date().getFullYear();

  const properties = await prisma.property.findMany({
    include: {
      company: { select: { name: true } },
      tenancies: {
        where: { status: 'active' },
        select: { id: true, tenant_name: true, rental_amount: true, status: true },
        take: 1,
      },
    },
    orderBy: { property_name: 'asc' },
  });

  const propertyIds = properties.map(p => p.id);

  const [incomeRows, expenseRows] = await Promise.all([
    prisma.rentalIncome.groupBy({
      by: ['property_id'],
      where: { property_id: { in: propertyIds }, income_month: { startsWith: String(year) } },
      _sum: { amount_received: true },
    }),
    prisma.expense.groupBy({
      by: ['property_id'],
      where: {
        property_id: { in: propertyIds },
        expense_date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
      },
      _sum: { amount: true },
    }),
  ]);

  const incomeMap = Object.fromEntries(incomeRows.map(r => [r.property_id, r._sum.amount_received ?? 0]));
  const expenseMap = Object.fromEntries(expenseRows.map(r => [r.property_id, r._sum.amount ?? 0]));

  const propertyStats = properties.map(p => {
    const income = incomeMap[p.id] ?? 0;
    const expenses = expenseMap[p.id] ?? 0;
    return {
      id: p.id,
      property_name: p.property_name,
      address: p.address,
      property_type: p.property_type,
      title_type: p.title_type,
      company: p.company,
      activeTenancy: p.tenancies[0] ?? null,
      income,
      expenses,
      net: income - expenses,
    };
  });

  const totalIncome = propertyStats.reduce((s, p) => s + p.income, 0);
  const totalExpenses = propertyStats.reduce((s, p) => s + p.expenses, 0);
  const totalActiveTenants = properties.filter(p => p.tenancies.length > 0).length;

  res.json({
    year,
    totalProperties: properties.length,
    totalActiveTenants,
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    properties: propertyStats,
  });
});

// ── Dashboard: 6-year historical totals for trend chart ──────────────────────
app.get('/api/dashboard/history', authMiddleware, async (req: Request, res: Response) => {
  const prisma = (await import('./lib/prisma')).default;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

  const [incomeRows, expenseRows] = await Promise.all([
    prisma.rentalIncome.findMany({
      where: { income_month: { gte: `${years[0]}-01` } },
      select: { income_month: true, amount_received: true },
    }),
    prisma.expense.findMany({
      where: { expense_date: { gte: new Date(`${years[0]}-01-01`) } },
      select: { expense_date: true, amount: true },
    }),
  ]);

  const history = years.map(year => {
    const income = incomeRows
      .filter(r => r.income_month.startsWith(String(year)))
      .reduce((s, r) => s + r.amount_received, 0);
    const expenses = expenseRows
      .filter(r => new Date(r.expense_date).getFullYear() === year)
      .reduce((s, r) => s + r.amount, 0);
    return { year, income, expenses, net: income - expenses };
  });

  res.json(history);
});

// ── Serve React build (production / packaged mode) ───────────────────────────
const publicDir = isPkg
  ? path.join(exeDir!, 'public')
  : path.join(__dirname, '../../client/dist');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback — return index.html for all non-API routes
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function runMigrations() {
  const prisma = (await import('./lib/prisma')).default;
  // v1.2: add utilities_deposit — safe to run on older databases, ignored if column exists
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Tenancy" ADD COLUMN "utilities_deposit" REAL NOT NULL DEFAULT 0`
    );
    console.log('DB migration: added utilities_deposit column');
  } catch {
    // Column already exists — nothing to do
  }
}

runMigrations().then(() => {
  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Property Manager running at ${url}`);
    if (isPkg) {
      try { execSync(`start ${url}`); } catch { /* ignore */ }
    }
  });
}).catch(err => {
  console.error('Startup migration failed:', err);
  process.exit(1);
});
