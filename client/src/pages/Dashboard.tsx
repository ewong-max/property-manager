import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getDashboardOverview, getDashboardHistory, getExcelUrl, formatRM,
  type DashboardOverview, type YearStat, type PropertyStat,
} from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/Layout';
import {
  Home, Building2, TrendingUp, TrendingDown, ArrowRight,
  FileSpreadsheet, FileBarChart2, Users, DollarSign, Receipt,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - i));

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-bold mb-2">YA {label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-medium">{formatRM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Property card ─────────────────────────────────────────────────────────────
function PropertyCard({ prop, year }: { prop: PropertyStat; year: number }) {
  const navigate = useNavigate();
  const net = prop.net;
  const isOccupied = !!prop.activeTenancy;

  function handleExcel() {
    const token = localStorage.getItem('pm_token') || '';
    fetch(getExcelUrl(prop.id, year), { headers: { 'x-auth-token': token } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Statement-${prop.property_name}-YA${year}.xlsx`;
        a.click();
      })
      .catch(() => toast.error('Excel export failed.'));
  }

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
      <CardContent className="p-5 flex flex-col gap-4 h-full">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Home className="w-4 h-4 text-blue-600" />
              </div>
              <p className="font-bold text-sm leading-tight">{prop.property_name}</p>
            </div>
            <p className="text-xs text-muted-foreground truncate pl-10">{prop.address}</p>
            <p className="text-xs text-muted-foreground pl-10">{prop.company.name}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className="text-xs capitalize">{prop.property_type}</Badge>
            <Badge variant="secondary" className="text-xs">{prop.title_type}</Badge>
          </div>
        </div>

        {/* Tenant status */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
          isOccupied ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-700'
        )}>
          <Users className="w-3.5 h-3.5 shrink-0" />
          {isOccupied ? (
            <span className="truncate">
              <span className="font-semibold">{prop.activeTenancy!.tenant_name}</span>
              <span className="text-xs ml-1 opacity-70">· {formatRM(prop.activeTenancy!.rental_amount)}/mo</span>
            </span>
          ) : (
            <span className="font-medium">Vacant</span>
          )}
        </div>

        <Separator />

        {/* YA stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Income</p>
            <p className="font-semibold text-sm text-emerald-700 tabular-nums">
              {prop.income > 0 ? formatRM(prop.income) : <span className="text-muted-foreground/50">—</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
            <p className="font-semibold text-sm text-red-600 tabular-nums">
              {prop.expenses > 0 ? formatRM(prop.expenses) : <span className="text-muted-foreground/50">—</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Net</p>
            <p className={cn('font-bold text-sm tabular-nums', net >= 0 ? 'text-emerald-700' : 'text-red-600')}>
              {prop.income === 0 && prop.expenses === 0
                ? <span className="text-muted-foreground/50">—</span>
                : formatRM(net)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto pt-1">
          <div className="flex gap-2">
            <Button
              size="sm" className="flex-1 text-xs h-8"
              onClick={() => navigate(`/reports?ids=${prop.id}&year=${year}`)}
            >
              <FileBarChart2 className="w-3.5 h-3.5 mr-1" />
              View Report
            </Button>
            <Button
              size="sm" variant="outline" className="flex-1 text-xs h-8"
              onClick={handleExcel}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              Excel
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              className="flex-1 text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
              onClick={() => navigate(`/tenancies?property_id=${prop.id}&action=income`)}
              disabled={!isOccupied}
              title={!isOccupied ? 'No active tenancy' : 'Record rental income'}
            >
              <DollarSign className="w-3.5 h-3.5 mr-1" />
              Add Income
            </Button>
            <Button
              size="sm" variant="outline"
              className="flex-1 text-xs h-8 border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300"
              onClick={() => navigate(`/expenses?property_id=${prop.id}&open=1`)}
            >
              <Receipt className="w-3.5 h-3.5 mr-1" />
              Add Expense
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const year = Number(selectedYear);

  const { data: overview, isLoading: overviewLoading } = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview', year],
    queryFn: () => getDashboardOverview(year),
  });

  const { data: history = [] } = useQuery<YearStat[]>({
    queryKey: ['dashboard-history'],
    queryFn: getDashboardHistory,
    staleTime: 60_000,
  });

  const statCards = [
    {
      label: 'Total Properties',
      value: overview?.totalProperties ?? 0,
      icon: Home,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Active Tenants',
      value: overview?.totalActiveTenants ?? 0,
      icon: Building2,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: `Gross Income YA ${year}`,
      value: formatRM(overview?.totalIncome ?? 0),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: `Total Expenses YA ${year}`,
      value: formatRM(overview?.totalExpenses ?? 0),
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-50',
    },
  ];

  const hasHistory = history.some(h => h.income > 0 || h.expenses > 0);

  return (
    <div className="p-8 space-y-8">

      {/* Header with year selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Dashboard"
          description={`Portfolio overview — Year of Assessment ${year}`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">Year of Assessment</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Card key={card.label}>
            <CardContent className="p-5">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', card.bg)}>
                <card.icon className={cn('w-4.5 h-4.5', card.color)} />
              </div>
              {overviewLoading ? (
                <div className="space-y-1.5">
                  <div className="h-7 w-28 bg-muted animate-pulse rounded" />
                  <div className="h-3.5 w-24 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Net income highlight */}
      {overview && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Net Rental Income — YA {year}
              </p>
              <p className={cn('text-3xl font-bold', overview.netIncome >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {formatRM(overview.netIncome)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatRM(overview.totalIncome)} income — {formatRM(overview.totalExpenses)} expenses
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                window.location.href = '/reports';
              }}>
                <FileBarChart2 className="w-4 h-4 mr-1.5" />
                Full Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical performance chart */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Historical Performance (Last 6 Years)
        </h2>
        {!hasHistory ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16 text-center text-muted-foreground">
              <div>
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No historical data yet</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-5 pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={history} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                    formatter={(value) => value === 'income' ? 'Gross Income' : value === 'expenses' ? 'Total Expenses' : 'Net Income'}
                  />
                  <Bar dataKey="income" name="income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="expenses" name="expenses" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={48} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="net"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#6366f1' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Property cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Properties — YA {year}
          </h2>
          {overview && (
            <span className="text-xs text-muted-foreground">
              {overview.totalActiveTenants} of {overview.totalProperties} occupied
            </span>
          )}
        </div>

        {overviewLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : !overview?.properties.length ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center text-muted-foreground">
              <Home className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium text-sm">No properties yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {overview.properties.map(prop => (
              <PropertyCard key={prop.id} prop={prop} year={year} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
