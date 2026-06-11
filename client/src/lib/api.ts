const BASE = '/api';

function getToken() {
  return localStorage.getItem('pm_token') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': getToken(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'x-auth-token': getToken() },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Auth
export const login = (pin: string) =>
  request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ pin }) });

// Dashboard
export const getDashboard = () => request<DashboardStats>('/dashboard');
export const getDashboardOverview = (year: number) =>
  request<DashboardOverview>(`/dashboard/overview?year=${year}`);
export const getDashboardHistory = () =>
  request<YearStat[]>('/dashboard/history');

// Companies
export const getCompanies = () => request<Company[]>('/companies');
export const getCompany = (id: number) => request<Company & { properties: Property[] }>(`/companies/${id}`);
export const createCompany = (data: Partial<Company>) =>
  request<Company>('/companies', { method: 'POST', body: JSON.stringify(data) });
export const updateCompany = (id: number, data: Partial<Company>) =>
  request<Company>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCompany = (id: number) =>
  request<{ success: boolean }>(`/companies/${id}`, { method: 'DELETE' });

// Properties
export const getProperties = (companyId?: number) =>
  request<Property[]>(`/properties${companyId ? `?company_id=${companyId}` : ''}`);
export const getProperty = (id: number) =>
  request<Property & { company: Company; tenancies: Tenancy[]; expenses: Expense[] }>(`/properties/${id}`);
export const createProperty = (data: Partial<Property>) =>
  request<Property>('/properties', { method: 'POST', body: JSON.stringify(data) });
export const updateProperty = (id: number, data: Partial<Property>) =>
  request<Property>(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProperty = (id: number) =>
  request<{ success: boolean }>(`/properties/${id}`, { method: 'DELETE' });
export const getPropertySummary = (id: number, year?: number) =>
  request<PropertySummary>(`/properties/${id}/summary${year ? `?year=${year}` : ''}`);

// Tenancies
export const getTenancies = (params?: { property_id?: number; status?: string }) => {
  const q = new URLSearchParams();
  if (params?.property_id) q.set('property_id', String(params.property_id));
  if (params?.status) q.set('status', params.status);
  return request<Tenancy[]>(`/tenancies?${q}`);
};
export const getTenancy = (id: number) => request<Tenancy>(`/tenancies/${id}`);
export const createTenancy = (data: Partial<Tenancy>) =>
  request<Tenancy>('/tenancies', { method: 'POST', body: JSON.stringify(data) });
export const updateTenancy = (id: number, data: Partial<Tenancy>) =>
  request<Tenancy>(`/tenancies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const terminateTenancy = (id: number, data: { termination_date: string; termination_reason: string }) =>
  request<Tenancy>(`/tenancies/${id}/terminate`, { method: 'POST', body: JSON.stringify(data) });

// Expenses
export const getExpenses = (params?: { property_id?: number; category?: string; year?: number }) => {
  const q = new URLSearchParams();
  if (params?.property_id) q.set('property_id', String(params.property_id));
  if (params?.category) q.set('category', params.category);
  if (params?.year) q.set('year', String(params.year));
  return request<Expense[]>(`/expenses?${q}`);
};
export const createExpense = (formData: FormData) => requestForm<Expense>('/expenses', formData);
export const updateExpense = (id: number, formData: FormData) => {
  return fetch(`${BASE}/expenses/${id}`, {
    method: 'PUT',
    headers: { 'x-auth-token': getToken() },
    body: formData,
  }).then(r => r.json());
};
export const deleteExpense = (id: number) =>
  request<{ success: boolean }>(`/expenses/${id}`, { method: 'DELETE' });

// Income
export const getIncome = (params?: { property_id?: number; tenancy_id?: number; year?: number }) => {
  const q = new URLSearchParams();
  if (params?.property_id) q.set('property_id', String(params.property_id));
  if (params?.tenancy_id) q.set('tenancy_id', String(params.tenancy_id));
  if (params?.year) q.set('year', String(params.year));
  return request<RentalIncome[]>(`/income?${q}`);
};
export const createIncome = (data: Partial<RentalIncome>) =>
  request<RentalIncome>('/income', { method: 'POST', body: JSON.stringify(data) });
export const updateIncome = (id: number, data: Partial<RentalIncome>) =>
  request<RentalIncome>(`/income/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteIncome = (id: number) =>
  request<{ success: boolean }>(`/income/${id}`, { method: 'DELETE' });

// Reports
export const getStatement = (propertyId: number, year: number) =>
  request<StatementData>(`/reports/statement/${propertyId}?year=${year}`);
export const getExcelUrl = (propertyId: number, year: number) =>
  `/api/reports/statement/${propertyId}/excel?year=${year}`;
export const getMultiExcelUrl = (ids: number[], year: number) =>
  `/api/reports/multi/excel?year=${year}&ids=${ids.join(',')}`;

// AI Invoice Analysis
export const analyseInvoice = (file: File) => {
  const fd = new FormData();
  fd.append('invoice', file);
  return requestForm<InvoiceAnalysis>('/analyse-invoice', fd);
};

// Types
export interface DashboardStats {
  totalProperties: number;
  totalActiveTenants: number;
  totalIncomeCurrentYear: number;
  totalExpensesCurrentYear: number;
  currentYear: number;
}

export interface PropertyStat {
  id: number;
  property_name: string;
  address: string;
  property_type: string;
  title_type: string;
  company: { name: string };
  activeTenancy: { id: number; tenant_name: string; rental_amount: number; status: string } | null;
  income: number;
  expenses: number;
  net: number;
}

export interface DashboardOverview {
  year: number;
  totalProperties: number;
  totalActiveTenants: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  properties: PropertyStat[];
}

export interface YearStat {
  year: number;
  income: number;
  expenses: number;
  net: number;
}

export interface Company {
  id: number;
  name: string;
  registration_number: string;
  address: string;
  contact_person: string;
  created_at: string;
  _count?: { properties: number };
}

export interface Property {
  id: number;
  company_id: number;
  property_name: string;
  address: string;
  title_type: string;
  property_type: string;
  purchase_date?: string;
  purchase_price?: number;
  annual_assessment?: number;
  quit_rent?: number;
  created_at: string;
  company?: Company;
}

export interface Tenancy {
  id: number;
  property_id: number;
  tenant_name: string;
  tenant_ic_or_ssm: string;
  contact_number: string;
  rental_amount: number;
  deposit_amount: number;
  tenancy_start_date: string;
  tenancy_end_date?: string;
  status: 'active' | 'terminated';
  termination_date?: string;
  termination_reason?: string;
  created_at: string;
  property?: { property_name: string; address: string };
  rental_incomes?: RentalIncome[];
}

export interface Expense {
  id: number;
  property_id: number;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  invoice_number?: string;
  vendor_name: string;
  invoice_file_path?: string;
  created_at: string;
  property?: { property_name: string };
}

export interface RentalIncome {
  id: number;
  tenancy_id: number;
  property_id: number;
  income_month: string;
  amount_received: number;
  payment_date: string;
  notes?: string;
  created_at: string;
  tenancy?: { tenant_name: string };
  property?: { property_name: string };
}

export interface PropertySummary {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  activeTenancy: Tenancy | null;
}

export interface StatementData {
  property: Property & { company: Company };
  tenancies: Tenancy[];
  incomes: RentalIncome[];
  expenses: Expense[];
  monthlyIncome: Record<string, number>;
  expensesByCategory: Record<string, { items: Expense[]; total: number }>;
  totalIncome: number;
  totalExpenses: number;
  year: number;
}

export interface InvoiceAnalysis {
  vendor_name: string;
  invoice_number: string;
  expense_date: string;
  amount: number;
  category: string;
  description: string;
}

export const EXPENSE_CATEGORIES = [
  'Repair & Maintenance',
  'Assessment',
  'Quit Rent',
  'Insurance',
  'Management Fee',
  'Utilities',
  'Professional Fee',
  'Other',
] as const;

export function formatRM(amount: number) {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB');
}
