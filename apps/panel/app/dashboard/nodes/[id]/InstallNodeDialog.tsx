'use client';

import { useState } from 'react';

import { apiFetch, UnauthorizedError } from '@/components/use-api';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type Obfuscation = 'none' | 'xormask' | 'xorptrpos' | 'reverse' | 'obfuscate';
type Cipher = 'AES-256-GCM' | 'AES-128-GCM' | 'CHACHA20-POLY1305';
type AuthDigest = 'SHA256' | 'SHA512';
type Proto = 'udp' | 'tcp';
type TunnelMode = 'full' | 'split';
type DnsMode = 'standard' | 'empty' | 'custom';

export interface InstallDefaults {
  protocol: Proto;
  port: number;
  obfuscation: Obfuscation;
  cipher: Cipher;
  auth: AuthDigest;
  tunnelMode: TunnelMode;
  clientToClient: boolean;
  duplicateCn: boolean;
  domain: string;
  dnsMode: DnsMode;
  customDns: string;
  mtu: number;
  mssfix: number;
}

interface InstallNodeDialogProps {
  nodeId: string;
  defaultHost: string;
  defaults?: Partial<InstallDefaults>;
  onClose: () => void;
  onSuccess: () => void;
}

const OBFUSCATION_OPTIONS: { value: Obfuscation; label: string; hint: string }[] = [
  { value: 'none', label: 'None', hint: 'Plain OpenVPN — fastest, but the protocol is detectable by DPI.' },
  { value: 'xormask', label: 'XOR mask (recommended)', hint: 'XOR every byte with a random key. The classic, widely-supported scramble.' },
  { value: 'xorptrpos', label: 'XOR position', hint: 'XOR each byte with its position. Keyless, lightweight.' },
  { value: 'reverse', label: 'Reverse', hint: 'Reverse the bytes of each packet. Keyless.' },
  { value: 'obfuscate', label: 'Obfuscate (compound)', hint: 'Combined XOR-mask + position + reverse. Strongest scramble.' },
];

const SELECT_CLASS =
  'w-full bg-background border border-input rounded-md px-3 py-2 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function InstallNodeDialog({ nodeId, defaultHost, defaults, onClose, onSuccess }: InstallNodeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [obfuscation, setObfuscation] = useState<Obfuscation>(defaults?.obfuscation ?? 'xormask');
  const [protocol, setProtocol] = useState<Proto>(defaults?.protocol ?? 'udp');
  const [port, setPort] = useState<number>(defaults?.port ?? 443);
  const [cipher, setCipher] = useState<Cipher>(defaults?.cipher ?? 'AES-256-GCM');
  const [auth, setAuth] = useState<AuthDigest>(defaults?.auth ?? 'SHA256');
  const [tunnelMode, setTunnelMode] = useState<TunnelMode>(defaults?.tunnelMode ?? 'full');
  const [clientToClient, setClientToClient] = useState<boolean>(defaults?.clientToClient ?? false);
  const [duplicateCn, setDuplicateCn] = useState<boolean>(defaults?.duplicateCn ?? false);
  const [domain, setDomain] = useState(defaults?.domain ?? '');
  const [dnsMode, setDnsMode] = useState<DnsMode>(defaults?.dnsMode ?? 'standard');
  const [customDns, setCustomDns] = useState(defaults?.customDns ?? '');
  const [mtu, setMtu] = useState(defaults?.mtu ?? 1500);
  const [mssfix, setMssfix] = useState(defaults?.mssfix ?? 1360);

  const obfHint = OBFUSCATION_OPTIONS.find((o) => o.value === obfuscation)?.hint;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/api/nodes/${nodeId}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverHost: defaultHost,
          obfuscation,
          protocol,
          port,
          cipher,
          auth,
          tunnelMode,
          clientToClient,
          duplicateCn,
          domain: domain.trim() || undefined,
          dnsMode,
          customDns: dnsMode === 'custom' ? customDns : undefined,
          mtu,
          mssfix,
        }),
      });
      toast({ variant: 'success', title: 'Installation started', description: 'Track progress on the node page.' });
      onSuccess();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setError('Your session expired. Please sign in again.');
        setLoading(false);
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to start installation';
      setError(message);
      toast({ variant: 'destructive', title: 'Installation failed to start', description: message });
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Install / Configure OpenVPN</DialogTitle>
          <DialogDescription>
            Tune the server config. Safe defaults are pre-selected — change only what you need.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/40 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        <form id="install-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Obfuscation */}
          <div className="space-y-2">
            <Label htmlFor="install-obf">Obfuscation</Label>
            <select id="install-obf" value={obfuscation} onChange={(e) => setObfuscation(e.target.value as Obfuscation)} className={SELECT_CLASS}>
              {OBFUSCATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {obfHint && <p className="text-xs text-muted-foreground">{obfHint}</p>}
          </div>

          {/* Transport: protocol + port */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="install-proto">Protocol</Label>
              <select id="install-proto" value={protocol} onChange={(e) => setProtocol(e.target.value as Proto)} className={SELECT_CLASS}>
                <option value="udp">UDP (fastest)</option>
                <option value="tcp">TCP (works through strict firewalls)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="install-port">Port</Label>
              <Input id="install-port" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} required min={1} max={65535} />
              <p className="text-xs text-muted-foreground">443 blends in with HTTPS.</p>
            </div>
          </div>

          {/* Crypto: cipher + auth */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="install-cipher">Data cipher</Label>
              <select id="install-cipher" value={cipher} onChange={(e) => setCipher(e.target.value as Cipher)} className={SELECT_CLASS}>
                <option value="AES-256-GCM">AES-256-GCM</option>
                <option value="AES-128-GCM">AES-128-GCM</option>
                <option value="CHACHA20-POLY1305">ChaCha20-Poly1305</option>
              </select>
              <p className="text-xs text-muted-foreground">ChaCha20 is faster on phones without AES-NI.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="install-auth">Auth digest</Label>
              <select id="install-auth" value={auth} onChange={(e) => setAuth(e.target.value as AuthDigest)} className={SELECT_CLASS}>
                <option value="SHA256">SHA256</option>
                <option value="SHA512">SHA512</option>
              </select>
            </div>
          </div>

          {/* Routing */}
          <div className="space-y-2">
            <Label htmlFor="install-tunnel">Routing</Label>
            <select id="install-tunnel" value={tunnelMode} onChange={(e) => setTunnelMode(e.target.value as TunnelMode)} className={SELECT_CLASS}>
              <option value="full">Full tunnel (route all traffic through VPN)</option>
              <option value="split">Split tunnel (only VPN subnet)</option>
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={clientToClient} onChange={(e) => setClientToClient(e.target.checked)} className="w-4 h-4 accent-primary" />
              <span>Client-to-client <span className="text-muted-foreground">— let connected clients reach each other</span></span>
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={duplicateCn} onChange={(e) => setDuplicateCn(e.target.checked)} className="w-4 h-4 accent-primary" />
              <span>Allow multiple devices per certificate <span className="text-muted-foreground">(duplicate-cn)</span></span>
            </label>
          </div>

          {/* Domain */}
          <div className="space-y-2">
            <Label htmlFor="install-domain">Domain / Hostname (optional)</Label>
            <Input id="install-domain" type="text" placeholder="e.g. vpn.example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <p className="text-xs text-muted-foreground">Used as the client&apos;s remote. Leave empty to use the server IP ({defaultHost}).</p>
          </div>

          {/* DNS */}
          <div className="space-y-2">
            <Label htmlFor="install-dns">DNS</Label>
            <select id="install-dns" value={dnsMode} onChange={(e) => setDnsMode(e.target.value as DnsMode)} className={SELECT_CLASS}>
              <option value="standard">Standard (1.1.1.1, 8.8.8.8)</option>
              <option value="empty">Empty (do not push DNS)</option>
              <option value="custom">Custom DNS</option>
            </select>
            {dnsMode === 'custom' && (
              <Input type="text" placeholder="1.1.1.1, 8.8.8.8" value={customDns} onChange={(e) => setCustomDns(e.target.value)} required className="mt-2" aria-label="Custom DNS servers" />
            )}
          </div>

          {/* MTU / MSSFIX */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="install-mtu">MTU</Label>
              <Input id="install-mtu" type="number" value={mtu} onChange={(e) => setMtu(Number(e.target.value))} required min={500} max={9000} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="install-mssfix">MSSFIX</Label>
              <Input id="install-mssfix" type="number" value={mssfix} onChange={(e) => setMssfix(Number(e.target.value))} required min={500} max={9000} />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button form="install-form" type="submit" disabled={loading} className="gap-2">
            {loading ? (<><Spinner className="h-4 w-4" />Starting…</>) : 'Start Installation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
