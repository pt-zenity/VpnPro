'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Power, PowerOff, Trash2, Download } from 'lucide-react';

import { apiFetch, apiFetchRaw, UnauthorizedError } from '@/components/use-api';
import { toast } from '@/components/ui/use-toast';
import { confirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';

export interface ActionClient {
  id: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED' | 'REVOKED' | 'EXPIRED';
  artifactCount: number;
}

/**
 * Shared client row-actions (download / disable-enable / delete) used by both the
 * per-node clients table and the global Clients view. `onChange` is called after
 * a successful mutation so the caller can refresh its list.
 */
export function useClientActions(onChange: () => void) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleToggle = async (c: ActionClient) => {
    const enabling = c.status === 'DISABLED';
    setBusyId(c.id);
    try {
      await apiFetch(`/api/clients/${c.id}/${enabling ? 'enable' : 'disable'}`, { method: 'POST' });
      toast({ variant: 'success', title: enabling ? 'Client enabled' : 'Client disabled', description: c.name });
      onChange();
    } catch (err) {
      if (err instanceof UnauthorizedError) return router.push('/login');
      toast({ variant: 'destructive', title: 'Action failed', description: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (c: ActionClient) => {
    const ok = await confirm({
      title: `Delete "${c.name}" permanently?`,
      description: 'The certificate is revoked on the node (its .ovpn can never reconnect) and the client is removed.',
      confirmLabel: 'Delete permanently',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await apiFetch(`/api/clients/${c.id}`, { method: 'DELETE' });
      toast({ variant: 'success', title: 'Client deleted', description: c.name });
      onChange();
    } catch (err) {
      if (err instanceof UnauthorizedError) return router.push('/login');
      toast({ variant: 'destructive', title: 'Delete failed', description: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (c: ActionClient) => {
    setDownloadingId(c.id);
    try {
      const res = await apiFetchRaw(`/api/clients/${c.id}/download`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${c.name}.ovpn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ variant: 'success', title: 'Config downloaded', description: `${c.name}.ovpn` });
    } catch (err) {
      if (err instanceof UnauthorizedError) return router.push('/login');
      toast({ variant: 'destructive', title: 'Download failed', description: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setDownloadingId(null);
    }
  };

  /** Render the action buttons for a client. iconOnly = compact (desktop table). */
  const renderActions = (c: ActionClient, iconOnly: boolean) => {
    const canDownload = (c.status === 'ACTIVE' || c.status === 'DISABLED') && c.artifactCount > 0;
    const canToggle = c.status === 'ACTIVE' || c.status === 'DISABLED';
    const canDelete = c.status !== 'REVOKED';
    const enabling = c.status === 'DISABLED';
    return (
      <>
        {canDownload && (
          <Button
            variant="outline"
            size={iconOnly ? 'icon' : 'sm'}
            className={iconOnly ? '' : 'gap-1.5'}
            onClick={() => handleDownload(c)}
            disabled={downloadingId === c.id}
            aria-label={`Download ${c.name}.ovpn`}
            title="Download .ovpn config"
          >
            <Download className="h-4 w-4" />
            {!iconOnly && (downloadingId === c.id ? 'Downloading…' : 'Download')}
          </Button>
        )}
        {canToggle && (
          <Button
            variant="ghost"
            size={iconOnly ? 'icon' : 'sm'}
            className={iconOnly ? '' : 'gap-1.5'}
            onClick={() => handleToggle(c)}
            disabled={busyId === c.id}
            aria-label={enabling ? `Enable ${c.name}` : `Disable ${c.name}`}
            title={enabling ? 'Enable this client' : 'Temporarily block this client'}
          >
            {enabling ? <Power className="h-4 w-4 text-emerald-400" /> : <PowerOff className="h-4 w-4 text-yellow-400" />}
            {!iconOnly && (enabling ? 'Enable' : 'Disable')}
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size={iconOnly ? 'icon' : 'sm'}
            className={`text-destructive hover:text-destructive hover:bg-destructive/10 ${iconOnly ? '' : 'gap-1.5'}`}
            onClick={() => handleDelete(c)}
            disabled={busyId === c.id}
            aria-label={`Delete ${c.name}`}
            title="Delete permanently"
          >
            <Trash2 className="h-4 w-4" />
            {!iconOnly && 'Delete'}
          </Button>
        )}
      </>
    );
  };

  return { renderActions };
}
