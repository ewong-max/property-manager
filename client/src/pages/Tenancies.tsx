import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  getTenancies, createTenancy, updateTenancy, terminateTenancy,
  getProperties, createIncome, updateIncome, deleteIncome, getIncome,
  type Tenancy, type Property, type RentalIncome,
  formatRM, formatDate,
} from '@/lib/api';
import { PageHeader } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Users, Pencil, ChevronRight, Loader2, XCircle, DollarSign, Trash2, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const INCOME_TYPES = ['Rental Income', 'Forfeited Deposit Income'] as const;

const EMPTY_TENANCY = {
  property_id: '' as unknown as number,
  tenant_name: '', tenant_ic_or_ssm: '', contact_number: '',
  rental_amount: '', deposit_amount: '',
  tenancy_start_date: '', tenancy_end_date: '',
};

export default function Tenancies() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const filterPropertyId = searchParams.get('property_id') ? Number(searchParams.get('property_id')) : undefined;

  const [tenancyOpen, setTenancyOpen] = useState(false);
  const [editingTenancy, setEditingTenancy] = useState<Tenancy | null>(null);
  const [form, setForm] = useState(EMPTY_TENANCY);

  const [terminateTarget, setTerminateTarget] = useState<Tenancy | null>(null);
  const [terminateForm, setTerminateForm] = useState({ termination_date: '', termination_reason: '' });

  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeForTenancy, setIncomeForTenancy] = useState<Tenancy | null>(null);
  const [incomeForm, setIncomeForm] = useState({
    income_month: '', amount_received: '', payment_date: '', notes: '',
    income_type: 'Rental Income' as typeof INCOME_TYPES[number],
  });

  const [detailTenancy, setDetailTenancy] = useState<Tenancy | null>(null);
  const [deleteIncomeTarget, setDeleteIncomeTarget] = useState<number | null>(null);
  const [editingIncome, setEditingIncome] = useState<RentalIncome | null>(null);
  const [autoIncomeTriggered, setAutoIncomeTriggered] = useState(false);

  const { data: tenancies = [], isLoading } = useQuery({
    queryKey: ['tenancies', filterPropertyId],
    queryFn: () => getTenancies(filterPropertyId ? { property_id: filterPropertyId } : undefined),
  });

  // Auto-open income dialog when navigated here with ?action=income (e.g. from Dashboard "Add Income" button)
  useEffect(() => {
    if (
      searchParams.get('action') === 'income' &&
      filterPropertyId &&
      tenancies.length > 0 &&
      !autoIncomeTriggered
    ) {
      const active = tenancies.find(t => t.property_id === filterPropertyId && t.status === 'active');
      if (active) {
        setIncomeForTenancy(active);
        setIncomeOpen(true);
      }
      setAutoIncomeTriggered(true);
    }
  }, [tenancies, autoIncomeTriggered, filterPropertyId, searchParams]);

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => getProperties(),
  });

  const incomeQuery = useQuery({
    queryKey: ['income-for-tenancy', detailTenancy?.id],
    queryFn: () => getIncome({ tenancy_id: detailTenancy!.id }),
    enabled: !!detailTenancy,
  });

  const createMut = useMutation({
    mutationFn: createTenancy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenancies'] });
      toast.success('Tenancy created');
      setTenancyOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Tenancy> }) => updateTenancy(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenancies'] });
      toast.success('Tenancy updated');
      setTenancyOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const terminateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { termination_date: string; termination_reason: string } }) =>
      terminateTenancy(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenancies'] });
      toast.success('Tenancy terminated');
      setTerminateTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incomeMut = useMutation({
    mutationFn: createIncome,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-for-tenancy'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Income recorded');
      setIncomeForm({ income_month: '', amount_received: '', payment_date: '', notes: '', income_type: 'Rental Income' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateIncomeMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RentalIncome> }) =>
      updateIncome(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-for-tenancy'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Income updated');
      setIncomeOpen(false);
      setEditingIncome(null);
      setIncomeForm({ income_month: '', amount_received: '', payment_date: '', notes: '', income_type: 'Rental Income' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteIncomeMut = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-for-tenancy'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Income record deleted');
      setDeleteIncomeTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() { setEditingTenancy(null); setForm(EMPTY_TENANCY); setTenancyOpen(true); }
  function openEdit(t: Tenancy) {
    setEditingTenancy(t);
    setForm({
      property_id: t.property_id,
      tenant_name: t.tenant_name,
      tenant_ic_or_ssm: t.tenant_ic_or_ssm,
      contact_number: t.contact_number,
      rental_amount: String(t.rental_amount),
      deposit_amount: String(t.deposit_amount),
      tenancy_start_date: t.tenancy_start_date.slice(0, 10),
      tenancy_end_date: t.tenancy_end_date ? t.tenancy_end_date.slice(0, 10) : '',
    });
    setTenancyOpen(true);
  }

  function handleTenancySubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...form,
      property_id: Number(form.property_id),
      rental_amount: Number(form.rental_amount),
      deposit_amount: Number(form.deposit_amount) || 0,
      tenancy_end_date: form.tenancy_end_date || undefined,
    };
    if (editingTenancy) updateMut.mutate({ id: editingTenancy.id, data });
    else createMut.mutate(data);
  }

  function openEditIncome(inc: RentalIncome) {
    const isForfeited = inc.notes?.startsWith('[Forfeited Deposit]');
    const baseNotes = isForfeited
      ? (inc.notes?.slice('[Forfeited Deposit]'.length).trimStart() || '')
      : (inc.notes || '');
    setEditingIncome(inc);
    setIncomeForTenancy(detailTenancy);
    setIncomeForm({
      income_month: inc.income_month,
      amount_received: String(inc.amount_received),
      payment_date: String(inc.payment_date).slice(0, 10),
      notes: baseNotes,
      income_type: isForfeited ? 'Forfeited Deposit Income' : 'Rental Income',
    });
    setIncomeOpen(true);
  }

  function handleIncomeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const notes = incomeForm.income_type === 'Forfeited Deposit Income'
      ? `[Forfeited Deposit]${incomeForm.notes ? ' ' + incomeForm.notes : ''}`
      : incomeForm.notes;
    if (editingIncome) {
      updateIncomeMut.mutate({
        id: editingIncome.id,
        data: {
          income_month: incomeForm.income_month,
          amount_received: Number(incomeForm.amount_received),
          payment_date: incomeForm.payment_date,
          notes: notes || undefined,
        },
      });
    } else {
      incomeMut.mutate({
        tenancy_id: incomeForTenancy!.id,
        property_id: incomeForTenancy!.property_id,
        income_month: incomeForm.income_month,
        amount_received: Number(incomeForm.amount_received),
        payment_date: incomeForm.payment_date,
        notes: notes || undefined,
      });
    }
  }

  const saving = createMut.isPending || updateMut.isPending;
  const currentYear = new Date().getFullYear();
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return { value: `${currentYear}-${month}`, label: `${MONTHS[i]} ${currentYear}` };
  });

  return (
    <TooltipProvider>
      <div className="p-8">
        <PageHeader
          title="Tenancies"
          description="Manage tenancy agreements and record monthly rental received"
          action={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Tenancy</Button>}
        />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : tenancies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium">No tenancies yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a tenancy to start recording rental income.
              </p>
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />Add Tenancy
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tenancies.map(t => (
              <Card key={t.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${t.status === 'active' ? 'bg-emerald-50' : 'bg-muted'}`}>
                    <Users className={`w-5 h-5 ${t.status === 'active' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{t.tenant_name}</p>
                      <Badge variant={t.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                        {t.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{t.property?.property_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatRM(t.rental_amount)}/mo · {formatDate(t.tenancy_start_date)} — {t.tenancy_end_date ? formatDate(t.tenancy_end_date) : 'ongoing'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.status === 'active' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setIncomeForTenancy(t); setIncomeOpen(true); }}>
                          <DollarSign className="w-3 h-3 mr-1" />Record Income
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => { setTerminateTarget(t); setTerminateForm({ termination_date: '', termination_reason: '' }); }}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Terminate tenancy</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setDetailTenancy(t)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Create / Edit tenancy ── */}
        <Dialog open={tenancyOpen} onOpenChange={setTenancyOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTenancy ? 'Edit Tenancy' : 'New Tenancy'}</DialogTitle>
              <DialogDescription>
                Only one active tenancy is allowed per property at a time.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTenancySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Property <span className="text-destructive">*</span></Label>
                <Select value={String(form.property_id)} onValueChange={v => setForm(f => ({ ...f, property_id: Number(v) }))} required>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.property_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Tenant Name <span className="text-destructive">*</span></Label>
                  <Input value={form.tenant_name} onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>IC / SSM No. <span className="text-destructive">*</span></Label>
                  <Input value={form.tenant_ic_or_ssm} onChange={e => setForm(f => ({ ...f, tenant_ic_or_ssm: e.target.value }))} required placeholder="e.g. 900101-14-1234" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact No. <span className="text-destructive">*</span></Label>
                  <Input value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} required placeholder="e.g. 012-345 6789" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label>Monthly Rent (RM) <span className="text-destructive">*</span></Label>
                  </div>
                  <Input type="number" step="0.01" min="0" value={form.rental_amount} onChange={e => setForm(f => ({ ...f, rental_amount: e.target.value }))} required placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label>Security Deposit (RM)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help"><Info className="w-3.5 h-3.5 text-muted-foreground" /></span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Deposit is NOT taxable income until forfeited. Record forfeiture via
                        "Record Income → Forfeited Deposit Income."
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input type="number" step="0.01" min="0" value={form.deposit_amount} onChange={e => setForm(f => ({ ...f, deposit_amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Start Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.tenancy_start_date} onChange={e => setForm(f => ({ ...f, tenancy_start_date: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={form.tenancy_end_date} onChange={e => setForm(f => ({ ...f, tenancy_end_date: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTenancyOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingTenancy ? 'Save Changes' : 'Create Tenancy'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Terminate confirmation ── */}
        <AlertDialog open={!!terminateTarget} onOpenChange={v => !v && setTerminateTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Terminate tenancy?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    You are terminating the tenancy for <strong>{terminateTarget?.tenant_name}</strong> at{' '}
                    <strong>{terminateTarget?.property?.property_name}</strong>.
                    This cannot be undone.
                  </p>
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label>Termination Date <span className="text-destructive">*</span></Label>
                      <Input
                        type="date"
                        value={terminateForm.termination_date}
                        onChange={e => setTerminateForm(f => ({ ...f, termination_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reason</Label>
                      <Input
                        value={terminateForm.termination_reason}
                        onChange={e => setTerminateForm(f => ({ ...f, termination_reason: e.target.value }))}
                        placeholder="e.g. End of lease, mutual agreement"
                      />
                    </div>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => {
                  if (!terminateForm.termination_date) { toast.error('Please enter a termination date'); return; }
                  terminateMut.mutate({ id: terminateTarget!.id, data: terminateForm });
                }}
              >
                {terminateMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Terminate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Record / Edit income ── */}
        <Dialog open={incomeOpen} onOpenChange={v => { setIncomeOpen(v); if (!v) { setEditingIncome(null); setIncomeForm({ income_month: '', amount_received: '', payment_date: '', notes: '', income_type: 'Rental Income' }); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingIncome ? 'Edit Income Record' : 'Record Income'}</DialogTitle>
              <DialogDescription>
                {incomeForTenancy?.tenant_name} · {incomeForTenancy?.property?.property_name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleIncomeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Income Type <span className="text-destructive">*</span></Label>
                <Select value={incomeForm.income_type} onValueChange={v => setIncomeForm(f => ({ ...f, income_type: v as typeof INCOME_TYPES[number] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INCOME_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {incomeForm.income_type === 'Forfeited Deposit Income' && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Forfeited deposit is taxable income in the year it is forfeited and will appear in Part A of the annual statement.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Month <span className="text-destructive">*</span></Label>
                <Select value={incomeForm.income_month} onValueChange={v => setIncomeForm(f => ({ ...f, income_month: v }))} required>
                  <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount Received (RM) <span className="text-destructive">*</span></Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={incomeForm.amount_received}
                  onChange={e => setIncomeForm(f => ({ ...f, amount_received: e.target.value }))}
                  placeholder={incomeForTenancy ? String(incomeForTenancy.rental_amount) : ''}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={incomeForm.payment_date} onChange={e => setIncomeForm(f => ({ ...f, payment_date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={incomeForm.notes} onChange={e => setIncomeForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIncomeOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={incomeMut.isPending || updateIncomeMut.isPending}>
                  {(incomeMut.isPending || updateIncomeMut.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingIncome ? 'Save Changes' : 'Record'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Tenancy detail ── */}
        <Dialog open={!!detailTenancy} onOpenChange={v => !v && setDetailTenancy(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailTenancy?.tenant_name}</DialogTitle>
              <DialogDescription>{detailTenancy?.property?.property_name}</DialogDescription>
            </DialogHeader>
            {detailTenancy && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ['IC / SSM', detailTenancy.tenant_ic_or_ssm],
                    ['Contact', detailTenancy.contact_number],
                    ['Monthly Rent', formatRM(detailTenancy.rental_amount)],
                    ['Security Deposit', formatRM(detailTenancy.deposit_amount)],
                    ['Status', <Badge key="s" variant={detailTenancy.status === 'active' ? 'success' : 'secondary'} className="capitalize">{detailTenancy.status}</Badge>],
                    ['Start Date', formatDate(detailTenancy.tenancy_start_date)],
                    ['End Date', detailTenancy.tenancy_end_date ? formatDate(detailTenancy.tenancy_end_date) : 'Open-ended'],
                    ...(detailTenancy.termination_reason ? [['Termination', detailTenancy.termination_reason]] : []),
                  ].map(([label, val]) => (
                    <div key={String(label)}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{val}</p>
                    </div>
                  ))}
                </div>

                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">Income Records</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {incomeQuery.isLoading ? (
                      <div className="h-20 bg-muted animate-pulse rounded" />
                    ) : !incomeQuery.data?.length ? (
                      <p className="text-sm text-muted-foreground">No income recorded yet.</p>
                    ) : (
                      <div className="space-y-0.5">
                        {incomeQuery.data.map(inc => (
                          <div key={inc.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0 group">
                            <span className="text-muted-foreground font-mono text-xs w-20 shrink-0">{inc.income_month}</span>
                            <span className={`font-semibold tabular-nums flex-1 ${inc.notes?.startsWith('[Forfeited Deposit]') ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {formatRM(inc.amount_received)}
                            </span>
                            {inc.notes?.startsWith('[Forfeited Deposit]') && (
                              <Badge variant="warning" className="text-xs mr-2">Forfeited Deposit</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{formatDate(inc.payment_date)}</span>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 ml-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => openEditIncome(inc)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 ml-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setDeleteIncomeTarget(inc.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Delete income confirmation ── */}
        <AlertDialog open={!!deleteIncomeTarget} onOpenChange={v => !v && setDeleteIncomeTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete income record?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the income entry and affect the annual statement. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => deleteIncomeTarget && deleteIncomeMut.mutate(deleteIncomeTarget)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
