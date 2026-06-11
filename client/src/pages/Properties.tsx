import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getProperties, createProperty, updateProperty, deleteProperty,
  getCompanies, type Property, type Company,
} from '@/lib/api';
import { PageHeader } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Home, ChevronRight, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = {
  company_id: '' as unknown as number, property_name: '', address: '',
  title_type: 'Freehold', property_type: 'residential',
  purchase_date: '', purchase_price: '', annual_assessment: '', quit_rent: '',
};

export default function Properties() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);

  const { data: properties = [], isLoading } = useQuery({ queryKey: ['properties'], queryFn: () => getProperties() });
  const { data: companies = [] } = useQuery<Company[]>({ queryKey: ['companies'], queryFn: getCompanies });

  const createMut = useMutation({
    mutationFn: createProperty,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); toast.success('Property created'); closeDialog(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Property> }) => updateProperty(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); toast.success('Property updated'); closeDialog(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); toast.success('Property deleted'); setDeleteTarget(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(p: Property) {
    setEditing(p);
    setForm({
      company_id: p.company_id,
      property_name: p.property_name,
      address: p.address,
      title_type: p.title_type,
      property_type: p.property_type,
      purchase_date: p.purchase_date ? p.purchase_date.slice(0, 10) : '',
      purchase_price: p.purchase_price ? String(p.purchase_price) : '',
      annual_assessment: p.annual_assessment ? String(p.annual_assessment) : '',
      quit_rent: p.quit_rent ? String(p.quit_rent) : '',
    });
    setOpen(true);
  }
  function closeDialog() { setOpen(false); setEditing(null); setForm(EMPTY); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...form,
      company_id: Number(form.company_id),
      purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined,
      annual_assessment: form.annual_assessment ? Number(form.annual_assessment) : undefined,
      quit_rent: form.quit_rent ? Number(form.quit_rent) : undefined,
      purchase_date: form.purchase_date || undefined,
    };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const f = (k: keyof typeof EMPTY) => (v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="p-8">
      <PageHeader
        title="Properties"
        description="Manage all rental properties"
        action={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Property</Button>}
      />

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : properties.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-center">
          <Home className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="font-medium">No properties yet</p>
          <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Property</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {properties.map(p => (
            <Card key={p.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Home className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{p.property_name}</p>
                    <Badge variant={p.property_type === 'residential' ? 'secondary' : 'outline'} className="text-xs capitalize">
                      {p.property_type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{p.title_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{p.address}</p>
                  {p.company && <p className="text-xs text-muted-foreground">{p.company.name}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Link to={`/properties/${p.id}`}>
                    <Button variant="ghost" size="sm"><ChevronRight className="w-4 h-4" /></Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Property' : 'New Property'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company */}
            <div className="space-y-1.5">
              <Label>Company *</Label>
              <Select value={String(form.company_id)} onValueChange={f('company_id')} required>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Property Name *</Label>
                <Input value={form.property_name} onChange={e => f('property_name')(e.target.value)} required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address *</Label>
                <Input value={form.address} onChange={e => f('address')(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Title Type</Label>
                <Select value={form.title_type} onValueChange={f('title_type')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Freehold">Freehold</SelectItem>
                    <SelectItem value="Leasehold">Leasehold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Property Type</Label>
                <Select value={form.property_type} onValueChange={f('property_type')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchase_date} onChange={e => f('purchase_date')(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Price (RM)</Label>
                <Input type="number" step="0.01" value={form.purchase_price} onChange={e => f('purchase_price')(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Annual Assessment (RM)</Label>
                <Input type="number" step="0.01" value={form.annual_assessment} onChange={e => f('annual_assessment')(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Quit Rent (RM)</Label>
                <Input type="number" step="0.01" value={form.quit_rent} onChange={e => f('quit_rent')(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete property?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.property_name}</strong> and all associated tenancies,
              income records, and expenses will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
