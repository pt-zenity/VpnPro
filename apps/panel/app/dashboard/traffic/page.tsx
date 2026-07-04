'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wifi,
  WifiOff,
  Server,
  RefreshCw,
  Clock,
} from 'lucide-react';

import { apiFetch, UnauthorizedError } from '@/components/use-api';
import { LoadingState } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SparkPoint { t: number; connected: number; cpu: number }

interface TrafficNode {
  id: string;
  name: string;
  host: string;
  status: string;
  lastHeartbeatAt: string | null;
  totalBytesUp: string;
  totalBytesDown: string;
  totalClients: number;
  onlineClients: number;
  sparkline: SparkPoint[];
}

interface Session {
  id: string;
  name: string;
  nodeId: string;
  bytesUp: string;
  bytesDown: string;
  connectedSince: string | null;
  realAddress: string | null;
  vpnAddress: string | null;
  lastSeenAt: string | null;
}

interface TrafficData {
  timestamp: number;
  totals: {
    onlineClients: number;
    totalBytesUp: string;
    totalBytesDown: string;
    totalClients: number;
    healthyNodes: number;
    totalNodes: number;
  };
  nodes: TrafficNode[];
  sessions: Session[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(raw: string | number): string {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  if (Number.isNaN(n) || n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDuration(isoOrNull: string | null): string {
  if (!isoOrNull) return '—';
  const secs = Math.floor((Date.now() - new Date(isoOrNull).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${secs % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function timeAgo(isoOrNull: string | null): string {
  if (!isoOrNull) return '—';
  const secs = Math.floor((Date.now() - new Date(isoOrNull).getTime()) / 1000);
  if (secs < 5)  return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Mini SVG sparkline (pure SVG, no dependency) ──────────────────────────────

function Sparkline({
  data,
  field,
  color,
  height = 40,
  width = 120,
}: {
  data: SparkPoint[];
  field: 'connected' | 'cpu';
  color: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth={1} strokeDasharray="3 3" />
      </svg>
    );
  }

  const values = data.map((p) => p[field]);
  const max = Math.max(...values, 1);
  const pad = 3;
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (width - pad * 2));
  const ys = values.map((v) => pad + (1 - v / max) * (height - pad * 2));

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(1)},${height} L${xs[0].toFixed(1)},${height} Z`;

  const gradId = `sg-${field}-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Current value dot */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={2.5} fill={color} />
    </svg>
  );
}

// ── Traffic speed delta (bytes/sec between two snapshots) ─────────────────────

function useSpeedCalc(data: TrafficData | null) {
  const prev = useRef<{ ts: number; up: bigint; down: bigint } | null>(null);
  const [speed, setSpeed] = useState({ up: 0, down: 0 });

  useEffect(() => {
    if (!data) return;
    const up   = BigInt(data.totals.totalBytesUp);
    const down = BigInt(data.totals.totalBytesDown);
    const ts   = data.timestamp;

    if (prev.current) {
      const dt = (ts - prev.current.ts) / 1000;
      if (dt > 0) {
        const upDelta   = Number(up   - prev.current.up)   / dt;
        const downDelta = Number(down - prev.current.down) / dt;
        setSpeed({ up: Math.max(0, upDelta), down: Math.max(0, downDelta) });
      }
    }
    prev.current = { ts, up, down };
  }, [data]);

  return speed;
}

// ── Per-session speed delta ───────────────────────────────────────────────────

function useSessionSpeeds(sessions: Session[], timestamp: number) {
  const prev = useRef<Map<string, { ts: number; up: bigint; down: bigint }>>(new Map());
  const [speeds, setSpeeds] = useState<Map<string, { up: number; down: number }>>(new Map());

  useEffect(() => {
    const next = new Map<string, { up: number; down: number }>();
    for (const s of sessions) {
      const up   = BigInt(s.bytesUp);
      const down = BigInt(s.bytesDown);
      const old  = prev.current.get(s.id);
      if (old) {
        const dt = (timestamp - old.ts) / 1000;
        if (dt > 0) {
          next.set(s.id, {
            up:   Math.max(0, Number(up   - old.up)   / dt),
            down: Math.max(0, Number(down - old.down) / dt),
          });
        } else {
          next.set(s.id, { up: 0, down: 0 });
        }
      } else {
        next.set(s.id, { up: 0, down: 0 });
      }
      prev.current.set(s.id, { ts: timestamp, up, down });
    }
    setSpeeds(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timestamp]);

  return speeds;
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

function NodeCard({ node, nodeNames }: { node: TrafficNode; nodeNames: Map<string, string> }) {
  const isHealthy = node.status === 'HEALTHY';
  const isRecent  = node.lastHeartbeatAt
    ? Date.now() - new Date(node.lastHeartbeatAt).getTime() < 5 * 60 * 1000
    : false;

  return (
    <div className={`rounded-xl border bg-card p-5 space-y-4 transition-all duration-300 ${
      isHealthy ? 'border-emerald-500/20' : 'border-border'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-2 w-2 rounded-full shrink-0 ${
            isHealthy && isRecent ? 'bg-emerald-400 animate-pulse' :
            node.status === 'UNHEALTHY' ? 'bg-amber-400' :
            node.status === 'ERROR' ? 'bg-red-400' :
            'bg-zinc-500'
          }`} />
          <span className="font-semibold truncate">{node.name}</span>
        </div>
        <Badge
          variant={isHealthy ? 'success' : 'secondary'}
          className="shrink-0 text-xs"
        >
          {node.status}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">{node.host}</p>

      {/* Connected clients */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Connected</span>
        <span className="text-2xl font-bold">
          {node.onlineClients}
          <span className="text-sm font-normal text-muted-foreground ml-1">/ {node.totalClients}</span>
        </span>
      </div>

      {/* Sparkline — connected clients over time */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Clients (history)</span>
          <span className="text-emerald-400">{node.sparkline.length > 0 ? `${node.sparkline[node.sparkline.length - 1].connected}` : '—'}</span>
        </div>
        <Sparkline data={node.sparkline} field="connected" color="#34d399" width={200} height={36} />
      </div>

      {/* CPU sparkline */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>CPU %</span>
          <span className="text-cyan-400">
            {node.sparkline.length > 0 ? `${node.sparkline[node.sparkline.length - 1].cpu.toFixed(1)}%` : '—'}
          </span>
        </div>
        <Sparkline data={node.sparkline} field="cpu" color="#22d3ee" width={200} height={36} />
      </div>

      {/* Traffic totals */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            <ArrowUpFromLine className="h-3 w-3 text-emerald-400" />
            Upload
          </div>
          <div className="font-mono text-sm text-emerald-400">{fmtBytes(node.totalBytesUp)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            <ArrowDownToLine className="h-3 w-3 text-blue-400" />
            Download
          </div>
          <div className="font-mono text-sm text-blue-400">{fmtBytes(node.totalBytesDown)}</div>
        </div>
      </div>

      {/* Last heartbeat */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        Heartbeat: {timeAgo(node.lastHeartbeatAt)}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const REFRESH_MS = 5000; // 5-second polling

export default function TrafficPage() {
  const router  = useRouter();
  const [data,    setData]    = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const nodeNames = new Map<string, string>(
    (data?.nodes ?? []).map((n) => [n.id, n.name])
  );

  const speed       = useSpeedCalc(data);
  const sessionSpeeds = useSessionSpeeds(data?.sessions ?? [], data?.timestamp ?? 0);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    else         { setRefreshing(true); }
    try {
      const res = await apiFetch<TrafficData>('/api/traffic');
      if (!mountedRef.current) return;
      setData(res);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof UnauthorizedError) { router.push('/login'); return; }
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load traffic data');
    } finally {
      if (!mountedRef.current) return;
      if (!silent) setLoading(false);
      else         setRefreshing(false);
    }
  }, [router]);

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Initial load
  useEffect(() => { fetch(); }, [fetch]);

  // Auto-refresh every 5 s
  useEffect(() => {
    const t = setInterval(() => fetch(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [fetch]);

  if (loading && !data) return <LoadingState label="Loading traffic data" />;
  if (error && !data)   return (
    <ErrorState title="Traffic Error" message={error} onRetry={() => fetch()} retrying={loading} />
  );
  if (!data) return null;

  const { totals, nodes, sessions } = data;
  const onlineCount = sessions.length;

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Traffic Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Real-time connection traffic across all VPN nodes
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-muted-foreground">
              Updated {timeAgo(lastRefreshed.toISOString())}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fetch(false)}
            disabled={loading || refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {/* Live indicator */}
          <Badge variant="success" className="gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
            Live · 5s
          </Badge>
        </div>
      </div>

      {/* ── Fleet Summary ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Online clients */}
        <SummaryCard
          icon={<Wifi className="h-5 w-5 text-emerald-400" />}
          label="Online Now"
          value={onlineCount.toString()}
          sub={`of ${totals.totalClients} total`}
          accent="emerald"
        />

        {/* Upload speed */}
        <SummaryCard
          icon={<ArrowUpFromLine className="h-5 w-5 text-emerald-400" />}
          label="Upload Speed"
          value={`${fmtBytes(speed.up)}/s`}
          sub={`Total: ${fmtBytes(totals.totalBytesUp)}`}
          accent="emerald"
        />

        {/* Download speed */}
        <SummaryCard
          icon={<ArrowDownToLine className="h-5 w-5 text-blue-400" />}
          label="Download Speed"
          value={`${fmtBytes(speed.down)}/s`}
          sub={`Total: ${fmtBytes(totals.totalBytesDown)}`}
          accent="blue"
        />

        {/* Healthy nodes */}
        <SummaryCard
          icon={<Server className="h-5 w-5 text-cyan-400" />}
          label="Healthy Nodes"
          value={`${totals.healthyNodes} / ${totals.totalNodes}`}
          sub={totals.healthyNodes === totals.totalNodes ? 'All operational' : 'Some degraded'}
          accent="cyan"
        />
      </div>

      {/* ── Live Sessions Table ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Live Sessions</h2>
          <Badge variant={onlineCount > 0 ? 'success' : 'secondary'} className="ml-1">
            {onlineCount} online
          </Badge>
        </div>

        {onlineCount === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No clients are currently connected.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              This page auto-refreshes every 5 seconds.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full table-auto">
                <caption className="sr-only">Live VPN sessions</caption>
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Client</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Node</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Real IP</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">VPN IP</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Connected</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">↑ Upload</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">↓ Download</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Speed ↑/↓</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sessions.map((s) => {
                    const spd = sessionSpeeds.get(s.id) ?? { up: 0, down: 0 };
                    return (
                      <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span className="font-medium">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {nodeNames.get(s.nodeId) ?? s.nodeId}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {s.realAddress ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-cyan-400">
                          {s.vpnAddress ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {fmtDuration(s.connectedSince)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-emerald-400">
                          {fmtBytes(s.bytesUp)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-blue-400">
                          {fmtBytes(s.bytesDown)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <span className="text-emerald-400">{fmtBytes(spd.up)}/s</span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-blue-400">{fmtBytes(spd.down)}/s</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 lg:hidden">
              {sessions.map((s) => {
                const spd = sessionSpeeds.get(s.id) ?? { up: 0, down: 0 };
                return (
                  <div key={s.id} className="rounded-xl border border-emerald-500/20 bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="font-semibold">{s.name}</span>
                      <Badge variant="success" className="ml-auto text-xs">Online</Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Node</dt>
                      <dd className="text-right truncate">{nodeNames.get(s.nodeId) ?? '—'}</dd>

                      <dt className="text-muted-foreground">Real IP</dt>
                      <dd className="text-right font-mono text-xs">{s.realAddress ?? '—'}</dd>

                      <dt className="text-muted-foreground">VPN IP</dt>
                      <dd className="text-right font-mono text-xs text-cyan-400">{s.vpnAddress ?? '—'}</dd>

                      <dt className="text-muted-foreground">Duration</dt>
                      <dd className="text-right">{fmtDuration(s.connectedSince)}</dd>

                      <dt className="text-muted-foreground">Upload</dt>
                      <dd className="text-right font-mono text-emerald-400">
                        {fmtBytes(s.bytesUp)}
                        <span className="text-muted-foreground text-xs ml-1">({fmtBytes(spd.up)}/s)</span>
                      </dd>

                      <dt className="text-muted-foreground">Download</dt>
                      <dd className="text-right font-mono text-blue-400">
                        {fmtBytes(s.bytesDown)}
                        <span className="text-muted-foreground text-xs ml-1">({fmtBytes(spd.down)}/s)</span>
                      </dd>
                    </dl>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Per-Node Cards ───────────────────────────────────────────────────── */}
      {nodes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Node Overview</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {nodes.map((n) => (
              <NodeCard key={n.id} node={n} nodeNames={nodeNames} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: 'emerald' | 'blue' | 'cyan';
}) {
  const ring = accent === 'emerald' ? 'ring-emerald-500/20' :
               accent === 'blue'    ? 'ring-blue-500/20'    :
                                      'ring-cyan-500/20';
  const bg   = accent === 'emerald' ? 'bg-emerald-500/10' :
               accent === 'blue'    ? 'bg-blue-500/10'    :
                                      'bg-cyan-500/10';
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ring-1 ${ring}`}>
      <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-sm font-medium text-foreground/80 mt-0.5">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
