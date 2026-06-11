import { useState, useEffect } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  getProperties, getStatement, getExcelUrl, getMultiExcelUrl,
  formatRM, formatDate,
  type StatementData, type Property,
} from '@/lib/api';
import { PageHeader } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileBarChart2, Download, FileSpreadsheet, Loader2, Info,
  ChevronsUpDown, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const YEARS = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));

function hadTenancyInMonth(statement: StatementData, year: number, monthIdx: number): boolean {
  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd = new Date(year, monthIdx + 1, 0);
  return statement.tenancies.some(t => {
    const start = new Date(t.tenancy_start_date);
    const end = t.termination_date
      ? new Date(t.termination_date)
      : t.tenancy_end_date
        ? new Date(t.tenancy_end_date)
        : new Date('2999-12-31');
    return start <= monthEnd && end >= monthStart;
  });
}

// ── Multi-select property picker ──────────────────────────────────────────────
function PropertyMultiSelect({
  properties, selectedIds, onChange,
}: {
  properties: Property[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selectedIds.length === properties.length && properties.length > 0;
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleAll() {
    onChange(allSelected ? [] : properties.map(p => p.id));
  }
  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  }

  let label = 'Select properties…';
  if (allSelected) label = `All properties (${properties.length})`;
  else if (selectedIds.length === 1) label = properties.find(p => p.id === selectedIds[0])?.property_name ?? '1 property';
  else if (selectedIds.length > 1) label = `${selectedIds.length} properties selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className={cn('truncate', !selectedIds.length && 'text-muted-foreground')}>{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
        {/* Select All row */}
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-2.5 w-full px-2 py-2 rounded-sm text-sm hover:bg-muted transition-colors"
        >
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={toggleAll}
            onClick={e => e.stopPropagation()}
          />
          <span className="font-medium">All properties</span>
          {allSelected && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
        </button>
        <Separator className="my-1" />
        {properties.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className="flex items-center gap-2.5 w-full px-2 py-2 rounded-sm text-sm hover:bg-muted transition-colors"
          >
            <Checkbox
              checked={selectedIds.includes(p.id)}
              onCheckedChange={() => toggle(p.id)}
              onClick={e => e.stopPropagation()}
            />
            <span className="truncate">{p.property_name}</span>
            {selectedIds.includes(p.id) && <Check className="w-3.5 h-3.5 ml-auto text-primary shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── Single property statement block ──────────────────────────────────────────
function StatementBlock({ statement, year }: { statement: StatementData; year: number }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm p-8 max-w-3xl">
      {/* Header */}
      <div className="text-center mb-6 pb-6 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Income & Expenses Statement
        </p>
        <h1 className="text-xl font-bold">{statement.property.company.name}</h1>
        <p className="text-sm text-muted-foreground">{statement.property.company.registration_number}</p>
        <p className="text-sm text-muted-foreground">{statement.property.company.address}</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-primary/8 text-primary px-4 py-1.5 rounded-full">
          <span className="font-semibold text-sm">Year of Assessment {statement.year}</span>
        </div>
      </div>

      {/* Property details */}
      <div className="flex items-start justify-between mb-5 text-sm">
        <div>
          <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Property</p>
          <p className="font-semibold">{statement.property.property_name}</p>
          <p className="text-muted-foreground">{statement.property.address}</p>
        </div>
        <div className="text-right">
          <Badge variant="secondary" className="capitalize text-xs">
            {statement.property.property_type}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">{statement.property.title_type}</p>
        </div>
      </div>

      <Separator className="my-5" />

      {/* Part A: Rental Income */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
            Part A — Rental Income
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help"><Info className="w-3.5 h-3.5 text-muted-foreground" /></span>
            </TooltipTrigger>
            <TooltipContent>
              Recognised on a received basis. "Vacant" indicates no rental receipt
              was recorded for that month despite a tenancy being active.
            </TooltipContent>
          </Tooltip>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-foreground/10">
              <th className="text-left py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Month</th>
              <th className="text-right py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Amount (RM)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => {
              const monthPad = String(i + 1).padStart(2, '0');
              const key = `${year}-${monthPad}`;
              const amt = statement.monthlyIncome[key] ?? 0;
              const hasTenancy = hadTenancyInMonth(statement, year, i);
              const isVacant = hasTenancy && amt === 0;
              const isFuture = new Date(year, i, 1) > new Date() && amt === 0;
              return (
                <tr key={monthPad} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-2 text-muted-foreground">{MONTHS[i]} {year}</td>
                  <td className="py-2 text-right">
                    {isFuture ? (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    ) : isVacant ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Vacant
                      </span>
                    ) : amt > 0 ? (
                      <span className="font-mono tabular-nums font-medium">
                        {amt.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20">
              <td className="py-3 font-bold">Total Gross Rental Income</td>
              <td className="py-3 text-right font-bold font-mono tabular-nums text-emerald-700">
                {statement.totalIncome.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <Separator className="my-5" />

      {/* Part B: Expenses */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
            Part B — Allowable Expenses
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help"><Info className="w-3.5 h-3.5 text-muted-foreground" /></span>
            </TooltipTrigger>
            <TooltipContent>
              Expenses wholly and exclusively incurred in producing rental income
              (ITA 1967, s.33). Capital expenditure excluded — refer to Schedule 3.
            </TooltipContent>
          </Tooltip>
        </div>
        {Object.keys(statement.expensesByCategory).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No expenses recorded for this year.</p>
        ) : (
          Object.entries(statement.expensesByCategory).map(([cat, { items, total }]) => (
            <div key={cat} className="mb-5">
              <p className="font-semibold text-sm mb-1.5 flex items-center gap-2">
                {cat}
                <span className="text-xs font-normal text-muted-foreground">
                  ({items.length} item{items.length !== 1 ? 's' : ''})
                </span>
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {items.map(exp => (
                    <tr key={exp.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-1.5 text-muted-foreground pl-3 font-mono text-xs w-24">
                        {formatDate(exp.expense_date)}
                      </td>
                      <td className="py-1.5 text-muted-foreground">{exp.vendor_name}</td>
                      <td className="py-1.5 text-muted-foreground">{exp.description}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">
                        {exp.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="py-1.5 pl-3 text-xs text-muted-foreground font-medium">
                      Subtotal — {cat}
                    </td>
                    <td className="py-1.5 text-right font-semibold font-mono tabular-nums">
                      {total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))
        )}
        <div className="border-t-2 border-foreground/20 pt-3 flex justify-between font-bold">
          <span>Total Allowable Expenses</span>
          <span className="font-mono tabular-nums text-red-600">
            {statement.totalExpenses.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </section>

      <Separator className="my-5" />

      {/* Part C: Net Income */}
      <section className="mb-6">
        <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Part C — Net Rental Income
        </h3>
        <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross Rental Income</span>
            <span className="font-mono tabular-nums">{formatRM(statement.totalIncome)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Less: Total Allowable Expenses (s.33)</span>
            <span className="font-mono tabular-nums text-red-600">
              ({formatRM(statement.totalExpenses)})
            </span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Net Rental Income</span>
            <span className={cn('font-mono tabular-nums', (statement.totalIncome - statement.totalExpenses) >= 0 ? 'text-emerald-700' : 'text-red-600')}>
              {formatRM(statement.totalIncome - statement.totalExpenses)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Assessable under ITA 1967 s.4(d) — investment income from property rental
          </p>
        </div>
      </section>

      <Separator className="my-5" />

      {/* Part D: Tenancy Notes */}
      <section className="mb-6">
        <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Part D — Tenancy Notes
        </h3>
        {statement.tenancies.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No tenancy records for this year.</p>
        ) : (
          <div className="space-y-3">
            {statement.tenancies.map(t => (
              <div key={t.id} className="text-sm p-4 border rounded-lg bg-white">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold">{t.tenant_name}</p>
                  <Badge variant={t.status === 'active' ? 'success' : 'secondary'} className="capitalize text-xs shrink-0">
                    {t.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>IC/SSM: {t.tenant_ic_or_ssm}</span>
                  <span>Contact: {t.contact_number}</span>
                  <span>Monthly Rental: {formatRM(t.rental_amount)}</span>
                  <span>Deposit: {formatRM(t.deposit_amount)}</span>
                  <span>Start: {formatDate(t.tenancy_start_date)}</span>
                  <span>End: {t.tenancy_end_date ? formatDate(t.tenancy_end_date) : 'Ongoing'}</span>
                  {t.termination_reason && (
                    <span className="col-span-2">Termination reason: {t.termination_reason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="border-t pt-4 text-center text-xs text-muted-foreground space-y-1">
        <p>
          Prepared by <strong>{statement.property.company.name}</strong> ·{' '}
          {statement.property.company.registration_number}
        </p>
        <p>Confidential — For tax computation purposes only</p>
        <p>Generated {new Date().toLocaleDateString('en-GB')} · ITA 1967 s.4(d), s.33</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    const ids = searchParams.get('ids');
    return ids ? ids.split(',').map(Number).filter(Boolean) : [];
  });
  const [selectedYear, setSelectedYear] = useState(
    searchParams.get('year') ?? String(new Date().getFullYear())
  );
  const [generating, setGenerating] = useState(false);

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => getProperties(),
  });

  const year = Number(selectedYear);

  const statementResults = useQueries({
    queries: selectedIds.map(id => ({
      queryKey: ['statement', id, selectedYear],
      queryFn: () => getStatement(id, year),
    })),
  });

  const statements = statementResults.map(r => r.data).filter((d): d is StatementData => !!d);
  const isLoading = statementResults.some(r => r.isLoading || r.isFetching);
  const isSingle = selectedIds.length === 1;

  async function handleDownloadPDF() {
    if (!statements.length) return;
    setGenerating(true);
    try {
      const [{ pdf }, { PDFStatement }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/PDFStatement'),
      ]);
      const blob = await pdf(<PDFStatement statements={statements} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isSingle
        ? `Statement-${statements[0].property.property_name}-YA${year}.pdf`
        : `Statement-Combined-YA${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF error:', err);
      toast.error(`PDF failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerating(false);
    }
  }

  function handleDownloadExcel() {
    if (!selectedIds.length) return;
    const token = localStorage.getItem('pm_token') || '';
    const url = isSingle
      ? getExcelUrl(selectedIds[0], year)
      : getMultiExcelUrl(selectedIds, year);
    const filename = isSingle
      ? `Statement-${statements[0]?.property.property_name ?? 'Property'}-YA${year}.xlsx`
      : `Statement-Combined-YA${year}.xlsx`;
    fetch(url, { headers: { 'x-auth-token': token } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      })
      .catch(() => toast.error('Excel export failed.'));
  }

  return (
    <TooltipProvider>
      <div className="p-8">
        <PageHeader
          title="Reports"
          description="Annual Income & Expenses Statement — Income Tax Act 1967"
        />

        {/* Selectors */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex gap-4 flex-wrap items-end">
              <div className="space-y-1.5 flex-1 min-w-64">
                <Label>Properties</Label>
                <PropertyMultiSelect
                  properties={properties}
                  selectedIds={selectedIds}
                  onChange={setSelectedIds}
                />
              </div>
              <div className="space-y-1.5 w-40">
                <Label>Year of Assessment</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-0.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Rental income per s.4(d) ITA 1967 · Deductions per s.33</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Empty state */}
        {!selectedIds.length && (
          <div className="text-center py-24 text-muted-foreground">
            <FileBarChart2 className="w-12 h-12 mx-auto mb-3 opacity-25" />
            <p className="font-medium">Select one or more properties to generate a statement</p>
            <p className="text-sm mt-1">The statement covers one calendar year per property.</p>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && selectedIds.length > 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
          </div>
        )}

        {/* Statements */}
        {!isLoading && statements.length > 0 && (
          <>
            {/* Export buttons */}
            <div className="flex gap-3 mb-6">
              <Button onClick={handleDownloadPDF} disabled={generating}>
                {generating
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Download className="w-4 h-4 mr-2" />}
                Export PDF{!isSingle ? ` (${statements.length})` : ''}
              </Button>
              <Button variant="outline" onClick={handleDownloadExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel{!isSingle ? ` (${statements.length})` : ''}
              </Button>
            </div>

            {/* One block per property, with divider between them */}
            <div className="space-y-10">
              {statements.map((stmt, i) => (
                <div key={stmt.property.id}>
                  {!isSingle && (
                    <div className="flex items-center gap-3 mb-4 max-w-3xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Property {i + 1} of {statements.length}
                        </span>
                        <Badge variant="outline" className="text-xs">{stmt.property.property_name}</Badge>
                      </div>
                      <div className="flex-1 border-t" />
                    </div>
                  )}
                  <StatementBlock statement={stmt} year={year} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
