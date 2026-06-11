import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCompanies, createCompany, updateCompany, deleteCompany, type Company } from '@/lib/api';
import { PageHeader } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, ChevronRight, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY: Partial<Company> = { name: '', registration_number: '', address: '', contact_person: '' };

export default function Companies() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const { data: companies = [], isLoading } = useQuery({ queryKey: ['companies'], queryFn: getCompanies });

  const createMut = useMutation({
    mutationFn: createCompany,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Company created'); closeDialog(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Company> }) => updateCompany(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Company updated'); closeDialog(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Company deleted'); setDeleteTarget(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(c: Company) { setEditing(c); setForm(c); setOpen(true); }
  function closeDialog() { setOpen(false); setForm(EMPTY); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) { updateMut.mutate({ id: editing.id, data: form }); }
    else { createMut.mutate(form); }
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-8">
      <PageHeader
        title="Companies"
        description="Manage your investment holding companies"
        action={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Company</Button>}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium">No companies yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first holding company to get started.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Company</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {companies.map(company => (
            <Card key={company.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{company.name}</p>
                    <Badge variant="secondary" className="text-xs">{company.registration_number}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {company._count?.properties ?? 0} {company._count?.properties === 1 ? 'property' : 'properties'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{company.address}</p>
                  <p className="text-xs text-muted-foreground">Contact: {company.contact_person}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(company)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(company)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Link to={`/companies/${company.id}`}>
                    <Button variant="ghost" size="sm"><ChevronRight className="w-4 h-4" /></Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Company' : 'New Company'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Company Name" id="name" value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} required />
            <Field label="Registration Number" id="reg" value={form.registration_number || ''} onChange={v => setForm(f => ({ ...f, registration_number: v }))} required placeholder="e.g. 202301012345" />
            <Field label="Address" id="address" value={form.address || ''} onChange={v => setForm(f => ({ ...f, address: v }))} required />
            <Field label="Contact Person" id="contact" value={form.contact_person || ''} onChange={v => setForm(f => ({ ...f, contact_person: v }))} required />
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
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> and all its properties, tenancies, and expense records will be
              permanently deleted. This cannot be undone.
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

function Field({ label, id, value, onChange, required, placeholder }: {
  label: string; id: string; value: string;
  onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder} />
    </div>
  );
}
