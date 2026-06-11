import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProperty, getPropertySummary, getIncome, formatRM, formatDate } from '@/lib/api';
import { PageHeader } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, TrendingUp, TrendingDown, Users, Receipt, ChevronRight } from 'lucide-react';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);
  const currentYear = new Date().getFullYear();

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => getProperty(propertyId),
  });

  const { data: summary } = useQuery({
    queryKey: ['property-summary', propertyId, currentYear],
    queryFn: () => getPropertySummary(propertyId, currentYear),
    enabled: !!propertyId,
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ['income', propertyId, currentYear],
    queryFn: () => getIncome({ property_id: propertyId, year: currentYear }),
    enabled: !!propertyId,
  });

  if (isLoading) return <div className="p-8"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  if (!property) return <div className="p-8 text-muted-foreground">Property not found.</div>;

  const activeTenancy = property.tenancies.find(t => t.status === 'active');

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to="/properties">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Properties
          </Button>
        </Link>
        <PageHeader
          title={property.property_name}
          description={property.address}
          action={
            <div className="flex gap-2">
              <Link to={`/tenancies?property_id=${propertyId}`}>
                <Button variant="outline" size="sm"><Users className="w-4 h-4 mr-2" />Tenancies</Button>
              </Link>
              <Link to={`/expenses?property_id=${propertyId}`}>
                <Button variant="outline" size="sm"><Receipt className="w-4 h-4 mr-2" />Expenses</Button>
              </Link>
              <Link to={`/reports?property_id=${propertyId}`}>
                <Button size="sm">Generate Report</Button>
              </Link>
            </div>
          }
        />
      </div>

      {/* Property info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Type', value: <Badge variant="secondary" className="capitalize">{property.property_type}</Badge> },
          { label: 'Title', value: property.title_type },
          { label: 'Purchase Price', value: property.purchase_price ? formatRM(property.purchase_price) : '—' },
          { label: 'Company', value: property.company?.name ?? '—' },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-sm font-medium">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* YTD summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-muted-foreground">Income YA {currentYear}</p>
            </div>
            <p className="text-xl font-bold text-emerald-600">{formatRM(summary?.totalIncome ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p className="text-sm text-muted-foreground">Expenses YA {currentYear}</p>
            </div>
            <p className="text-xl font-bold text-red-500">{formatRM(summary?.totalExpenses ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">Net Income YA {currentYear}</p>
            </div>
            <p className={`text-xl font-bold ${(summary?.netIncome ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatRM(summary?.netIncome ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active tenancy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Active Tenancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTenancy ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tenant</span><span className="font-medium">{activeTenancy.tenant_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly Rent</span><span className="font-medium text-emerald-600">{formatRM(activeTenancy.rental_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{formatDate(activeTenancy.tenancy_start_date)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{activeTenancy.tenancy_end_date ? formatDate(activeTenancy.tenancy_end_date) : 'Open-ended'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{activeTenancy.contact_number}</span></div>
                <div className="pt-2">
                  <Link to={`/tenancies/${activeTenancy.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Tenancy <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <p>No active tenancy</p>
                <Link to={`/tenancies/new?property_id=${propertyId}`}>
                  <Button size="sm" className="mt-3">Add Tenancy</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly income grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Income YA {currentYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const month = String(i + 1).padStart(2, '0');
                const key = `${currentYear}-${month}`;
                const income = incomes.find(inc => inc.income_month === key);
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return (
                  <div key={month} className={`p-2 rounded text-center text-xs ${income ? 'bg-emerald-50 border border-emerald-200' : 'bg-muted/50'}`}>
                    <p className="text-muted-foreground">{months[i]}</p>
                    <p className={`font-semibold mt-0.5 ${income ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                      {income ? `RM ${income.amount_received.toLocaleString('en-MY')}` : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent expenses */}
      {property.expenses.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Expenses</CardTitle>
              <Link to={`/expenses?property_id=${propertyId}`}>
                <Button variant="ghost" size="sm">View all <ChevronRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {property.expenses.slice(0, 5).map(exp => (
                <div key={exp.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium">{exp.description}</span>
                    <span className="text-muted-foreground ml-2">· {exp.category}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-500">{formatRM(exp.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(exp.expense_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
