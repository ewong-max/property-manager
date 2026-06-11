import { useState, useRef } from 'react';
import { HardDrive, Upload, Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function getToken() {
  return localStorage.getItem('pm_token') || '';
}

export default function Backup() {
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    setBacking(true);
    try {
      const res = await fetch('/api/backup/download', {
        headers: { 'x-auth-token': getToken() },
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const suggestedName = `PropertyManager-backup-${date}-${time}.zip`;

      // Use native Save dialog if browser supports it (Chrome/Edge)
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName,
            types: [{ description: 'Backup ZIP', accept: { 'application/zip': ['.zip'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setLastBackup(now.toLocaleString());
          toast.success('Backup saved successfully');
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return; // user cancelled dialog
          // fall through to browser download
        }
      }

      // Fallback: trigger browser download (saves to Downloads folder)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(url);
      setLastBackup(now.toLocaleString());
      toast.success('Backup downloaded — check your Downloads folder');
    } catch (err) {
      toast.error(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBacking(false);
    }
  }

  async function handleRestoreFile(file: File) {
    const confirmed = window.confirm(
      'Restoring a backup will REPLACE all current data.\n\n' +
      'This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    setRestoring(true);
    try {
      const form = new FormData();
      form.append('backup', file);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'x-auth-token': getToken() },
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');

      toast.success(`${data.message} Refresh the page to see your restored data.`, {
        duration: 8000,
        action: { label: 'Refresh now', onClick: () => window.location.reload() },
      });
    } catch (err) {
      toast.error(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  }

  async function handleRestoreClick() {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'Backup ZIP', accept: { 'application/zip': ['.zip'] } }],
          multiple: false,
        });
        const file = await handle.getFile();
        await handleRestoreFile(file);
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        // fall through to hidden input
      }
    }
    restoreInputRef.current?.click();
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Backup & Restore"
        description="Protect your data with regular backups"
      />

      {/* Backup card */}
      <div className="rounded-xl border bg-card p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold mb-1">Create Backup</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Packages your entire database and all invoice attachments into a single ZIP file.
              Save it to a USB drive, network folder, or cloud storage.
            </p>

            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-3 mb-4">
              <p className="font-medium mb-1">What's included in the backup:</p>
              <ul className="list-disc ml-3 space-y-0.5">
                <li>All properties, companies, tenants and leases</li>
                <li>All income and expense records</li>
                <li>All uploaded invoice and receipt files</li>
              </ul>
            </div>

            {lastBackup && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-md px-3 py-1.5 mb-3 w-fit">
                <CheckCircle className="w-3.5 h-3.5" />
                Last backup this session: {lastBackup}
              </div>
            )}

            <Button onClick={handleBackup} disabled={backing} className="gap-2">
              {backing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Creating backup…</>
              ) : (
                <><HardDrive className="w-4 h-4" />Back Up Now</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Restore card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold mb-1">Restore from Backup</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Select a backup ZIP file to restore your data from a previous backup.
            </p>

            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Restoring replaces ALL current data with the backup contents.
                Back up your current data first if you want to keep it.
              </span>
            </div>

            <Button
              variant="outline"
              onClick={handleRestoreClick}
              disabled={restoring}
              className="gap-2"
            >
              {restoring ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Restoring…</>
              ) : (
                <><Upload className="w-4 h-4" />Choose Backup File</>
              )}
            </Button>

            <input
              ref={restoreInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleRestoreFile(file);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
