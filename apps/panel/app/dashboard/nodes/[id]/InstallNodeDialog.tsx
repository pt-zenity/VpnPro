'use client';

import { useState } from 'react';

interface InstallNodeDialogProps {
  nodeId: string;
  defaultHost: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function InstallNodeDialog({ nodeId, defaultHost, onClose, onSuccess }: InstallNodeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [useXor, setUseXor] = useState(true);
  const [domain, setDomain] = useState('');
  const [dnsMode, setDnsMode] = useState<'standard' | 'empty' | 'custom'>('standard');
  const [customDns, setCustomDns] = useState('');
  const [mtu, setMtu] = useState(1500);
  const [mssfix, setMssfix] = useState(1360);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/nodes/${nodeId}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverHost: defaultHost,
          useXor,
          domain: domain.trim() || undefined,
          dnsMode,
          customDns: dnsMode === 'custom' ? customDns : undefined,
          mtu,
          mssfix,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to start installation');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold">Install OpenVPN</h2>
          <p className="text-muted-foreground mt-1">Configure your server setup</p>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}

          <form id="install-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Connection Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Connection Type</label>
              <div className="flex gap-4">
                <label className="flex-1 flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:bg-secondary/50">
                  <input 
                    type="radio" 
                    checked={useXor} 
                    onChange={() => setUseXor(true)} 
                    className="w-4 h-4 text-primary"
                  />
                  <div>
                    <div className="font-medium">OpenVPN + XOR</div>
                    <div className="text-xs text-muted-foreground">Obfuscated connection</div>
                  </div>
                </label>
                <label className="flex-1 flex items-center gap-3 p-4 border border-border rounded-lg cursor-pointer hover:bg-secondary/50">
                  <input 
                    type="radio" 
                    checked={!useXor} 
                    onChange={() => setUseXor(false)} 
                    className="w-4 h-4 text-primary"
                  />
                  <div>
                    <div className="font-medium">Standard</div>
                    <div className="text-xs text-muted-foreground">No obfuscation</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Domain */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Domain / Hostname (Optional)</label>
              <input
                type="text"
                placeholder="e.g. vpn.example.com"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use server IP ({defaultHost}).
              </p>
            </div>

            {/* DNS Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">DNS Settings</label>
              <select
                value={dnsMode}
                onChange={e => setDnsMode(e.target.value as any)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="standard">Standard (8.8.8.8, 1.1.1.1)</option>
                <option value="empty">Empty (Do not push DNS)</option>
                <option value="custom">Custom DNS</option>
              </select>
              {dnsMode === 'custom' && (
                <input
                  type="text"
                  placeholder="8.8.8.8, 1.1.1.1"
                  value={customDns}
                  onChange={e => setCustomDns(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                />
              )}
            </div>

            {/* MTU / MSSFIX */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">MTU</label>
                <input
                  type="number"
                  value={mtu}
                  onChange={e => setMtu(Number(e.target.value))}
                  required min={500} max={9000}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">MSSFIX</label>
                <input
                  type="number"
                  value={mssfix}
                  onChange={e => setMssfix(Number(e.target.value))}
                  required min={500} max={9000}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-border bg-muted/20 flex justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            form="install-form"
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start Installation'}
          </button>
        </div>
      </div>
    </div>
  );
}
