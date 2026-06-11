import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  getExpenses, createExpense, deleteExpense, getProperties, analyseInvoice,
  EXPENSE_CATEGORIES, type Expense, type Property,
  formatRM, formatDate,
} from '@/lib/api';
import { PageHeader } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Receipt, Trash2, Loader2, Sparkles, ExternalLink, FileText, Info, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EMPTY = {
  property_id: '', expense_date: '', category: '', description: '',
  amount: '', invoice_number: '', vendor_name: '',
};

export default function Expenses() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const filterPropertyId = searchParams.get('property_id') ? Number(searchParams.get('property_id')) : undefined;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterCategory, setFilterCategory] = useState('__all__');

  // Auto-open dialog when navigated here with ?open=1 (e.g. from Dashboard "Add Expense" button)
  useEffect(() => {
    if (searchParams.get('open') === '1' && filterPropertyId) {
      setForm(f => ({ ...f, property_id: String(filterPropertyId) }));
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', filterPropertyId, filterCategory, filterYear],
    queryFn: () => getExpenses({
      property_id: filterPropertyId,
      category: filterCategory !== '__all__' ? filterCategory : undefined,
      year: filterYear ? Number(filterYear) : undefined,
    }),
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => getProperties(),
  });

  const createMut = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Expense recorded');
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Expense deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function closeDialog() {
    setOpen(false);
    setForm(EMPTY);
    clearFile();
  }

  function clearFile() {
    setInvoiceFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // When category changes to Assessment or Quit Rent, pre-fill amount from property
  function handleCategoryChange(cat: string) {
    setForm(f => {
      const prop = properties.find(p => String(p.id) === f.property_id);
      let amount = f.amount;
      let vendor = f.vendor_name;
      let description = f.description;
      if (prop && cat === 'Assessment' && prop.annual_assessment) {
        amount = String(prop.annual_assessment);
        vendor = vendor || 'Majlis Perbandaran / Dewan Bandaraya';
        description = description || `Annual assessment — ${prop.property_name}`;
      }
      if (prop && cat === 'Quit Rent' && prop.quit_rent) {
        amount = String(prop.quit_rent);
        vendor = vendor || 'Pejabat Tanah';
        description = description || `Quit rent (cukai tanah) — ${prop.property_name}`;
      }
      return { ...f, category: cat, amount, vendor_name: vendor, description };
    });
  }

  // When property changes, re-run pre-fill if category is already set
  function handlePropertyChange(propId: string) {
    setForm(f => {
      const prop = properties.find(p => String(p.id) === propId);
      let amount = f.amount;
      let vendor = f.vendor_name;
      let description = f.description;
      if (prop && f.category === 'Assessment' && prop.annual_assessment) {
        amount = String(prop.annual_assessment);
        vendor = vendor || 'Majlis Perbandaran / Dewan Bandaraya';
        description = description || `Annual assessment — ${prop.property_name}`;
      }
      if (prop && f.category === 'Quit Rent' && prop.quit_rent) {
        amount = String(prop.quit_rent);
        vendor = vendor || 'Pejabat Tanah';
        description = description || `Quit rent (cukai tanah) — ${prop.property_name}`;
      }
      return { ...f, property_id: propId, amount, vendor_name: vendor, description };
    });
  }

  async function processFile(file: File) {
    setInvoiceFile(file);
    // Generate preview URL for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
    // Trigger AI analysis
    setAnalysing(true);
    try {
      const result = await analyseInvoice(file);
      setForm(f => ({
        ...f,
        vendor_name: result.vendor_name || f.vendor_name,
        invoice_number: result.invoice_number || f.invoice_number,
        expense_date: result.expense_date || f.expense_date,
        amount: result.amount ? String(result.amount) : f.amount,
        category: result.category || f.category,
        description: result.description || f.description,
      }));
      toast.success('Invoice analysed — fields auto-filled', { icon: '✨' });
    } catch {
      toast.warning('Could not read invoice automatically. Please fill in the details manually.');
    } finally {
      setAnalysing(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      processFile(file);
    } else if (file) {
      toast.error('Please upload a PDF, JPG, or PNG file.');
    }
  }, [properties, form.category]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (invoiceFile) fd.append('invoice', invoiceFile);
    createMut.mutate(fd);
  }

  const totalShown = expenses.reduce((s, e) => s + e.amount, 0);
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  const isImage = invoiceFile?.type.startsWith('image/');
  const isPdf = invoiceFile?.type === 'application/pdf';

  return (
    <TooltipProvider>
      <div className="p-8">
        <PageHeader
          title="Expenses"
          description="Allowable deductions under Income Tax Act 1967, s.33"
          action={<Button onClick={() => { setForm(EMPTY); clearFile(); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add Expense</Button>}
        />

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap items-center">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {filterCategory !== '__all__' && (
            <Button variant="ghost" size="sm" onClick={() => setFilterCategory('__all__')}>
              <X className="w-3 h-3 mr-1" />Clear
            </Button>
          )}
          {expenses.length > 0 && (
            <div className="ml-auto text-sm text-muted-foreground">
              {expenses.length} record{expenses.length !== 1 ? 's' : ''} ·{' '}
              <span className="font-semibold text-red-600">{formatRM(totalShown)}</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : expenses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium">No expenses found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add deductible expenses under ITA 1967 s.33 for this property.
              </p>
              <Button className="mt-4" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />Add Expense
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  {['Date', 'Property', 'Category', 'Description', 'Vendor', 'Invoice No.', 'Amount (RM)', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-xs">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate">
                      {exp.property?.property_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs whitespace-nowrap font-normal">
                        {exp.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate">{exp.description}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate">{exp.vendor_name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {exp.invoice_number || '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-red-600 whitespace-nowrap tabular-nums">
                      {exp.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {exp.invoice_file_path && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a href={`/uploads/${exp.invoice_file_path}`} target="_blank" rel="noreferrer">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>View invoice</TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(exp)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 border-t-2 border-border">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm font-semibold">Total Allowable Expenses</td>
                  <td className="px-4 py-3 font-bold text-red-600 tabular-nums">
                    {totalShown.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── Add Expense Dialog ── */}
        <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
          <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                New Expense
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Only expenses wholly and exclusively incurred in producing rental income are deductible
                    (ITA 1967, s.33). Capital expenditure is not deductible here — refer to Schedule 3
                    capital allowances.
                  </TooltipContent>
                </Tooltip>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── Drag-and-drop upload zone ── */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !invoiceFile && fileInputRef.current?.click()}
                className={cn(
                  'relative border-2 border-dashed rounded-xl transition-all',
                  dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border',
                  !invoiceFile && 'cursor-pointer hover:border-primary/50 hover:bg-muted/30',
                  invoiceFile ? 'p-3' : 'p-6'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {analysing && (
                  <div className="absolute inset-0 bg-background/80 rounded-xl flex flex-col items-center justify-center z-10 gap-2">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <p className="text-sm font-medium">Analysing with AI…</p>
                    <p className="text-xs text-muted-foreground">Fields will auto-fill in a moment</p>
                  </div>
                )}

                {!invoiceFile ? (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Drop invoice here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PDF, JPG or PNG · max 10 MB</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-primary">
                      <Sparkles className="w-3 h-3" />
                      AI will auto-fill the form
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* Preview */}
                    {isImage && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Invoice preview"
                        className="w-16 h-16 object-cover rounded-lg border shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg border bg-red-50 flex flex-col items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-red-500" />
                        <span className="text-[9px] font-bold text-red-500 mt-0.5">PDF</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{invoiceFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(invoiceFile.size / 1024).toFixed(0)} KB
                      </p>
                      {!analysing && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                          <Sparkles className="w-3 h-3" />
                          Fields auto-filled from invoice
                        </div>
                      )}
                    </div>
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={e => { e.stopPropagation(); clearFile(); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Form fields ── */}
              <div className={cn('space-y-4', analysing && 'opacity-40 pointer-events-none select-none')}>
                {/* Property */}
                <div className="space-y-1.5">
                  <Label>Property <span className="text-destructive">*</span></Label>
                  <Select value={form.property_id} onValueChange={handlePropertyChange} required>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.property_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Expense Date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (RM) <span className="text-destructive">*</span></Label>
                    <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0.00" />
                  </div>
                </div>

                {/* Category with pre-fill indicator */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label>Category <span className="text-destructive">*</span></Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        All categories are allowable under ITA 1967 s.33. Assessment and Quit Rent
                        amounts are pre-filled from the property record.
                      </TooltipContent>
                    </Tooltip>
                    {(form.category === 'Assessment' || form.category === 'Quit Rent') && form.amount && (
                      <span className="text-xs text-emerald-600 ml-auto flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />Pre-filled from property record
                      </span>
                    )}
                  </div>
                  <Select value={form.category} onValueChange={handleCategoryChange} required>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Description <span className="text-destructive">*</span></Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="Brief description of expense" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Vendor / Supplier <span className="text-destructive">*</span></Label>
                    <Input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} required placeholder="Vendor name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Invoice No.</Label>
                    <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="Optional" />
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || analysing}>
                  {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Expense
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Delete confirmation ── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete expense?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{deleteTarget?.description}</strong>
                {' '}—{' '}
                {deleteTarget ? formatRM(deleteTarget.amount) : ''} on{' '}
                {deleteTarget ? formatDate(deleteTarget.expense_date) : ''}
                <br />
                This cannot be undone and will affect your income & expenses statement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              >
                {deleteMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
