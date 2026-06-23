'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface NodeDetails {
  id: string;
  name: string;
  host: string;
  status: string;
  version: string | null;
  openvpnVersion: string | null;
  xorMask: string | null;
  lastHeartbeatAt: string | null;
  installedAt: string | null;
  createdAt: string;
  healthStatus: {
    status: string;
    details: {
      connectedClients?: number;
      cpu?: number;
      memory?: number;
      uptime?: number;
    };
    checkedAt: string;
  } | null;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-muted-foreground',
  PROVISIONING: 'bg-blue-500',
  HEALTHY: 'bg-emerald-500',
  UNHEALTHY: 'bg-yellow-500',
  ERROR: 'bg-destructive',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending Agent',
  PROVISIONING: 'Installing',
  HEALTHY: 'Healthy',
  UNHEALTHY: 'Unhealthy',
  ERROR: 'Error',
};

export default function NodeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  const [node, setNode] = useState<NodeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);

  const fetchNode = async () => {
    const admin = localStorage.getItem('admin');
    if (!admin) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`/api/nodes/${nodeId}`);

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('admin');
          router.push('/login');
          return;
        }
        if (res.status === 404) {
          router.push('/dashboard/nodes');
          return;
        }
        throw new Error('Failed to load node');
      }

      const data = await res.json();
      setNode(data.node);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNode();
    // Refresh every 10 seconds
    const interval = setInterval(fetchNode, 10000);
    return () => clearInterval(interval);
  }, [nodeId]);

  const handleInstall = async () => {
    if (!confirm('Install OpenVPN on this node?')) return;
    setInstalling(true);

    const res = await fetch(`/api/nodes/${nodeId}/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverHost: node?.host,
        port: 443,
        protocol: 'udp',
      }),
    });

    if (res.ok) {
      // Refresh immediately
      fetchNode();
    } else {
      const data = await res.json();
      alert(data.message || 'Failed to start install');
    }

    setInstalling(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete node "${node?.name}"?`)) return;

    const res = await fetch(`/api/nodes/${nodeId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      router.push('/dashboard/nodes');
    } else {
      const data = await res.json();
      alert(data.message || 'Failed to delete node');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!node) {
    return <div className="text-center py-12 text-destructive">Node not found</div>;
  }

  const canInstall = node.status === 'PENDING' || node.status === 'PROVISIONING';
  const canAddClient = node.status === 'HEALTHY';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{node.name}</h2>
            <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              statusColors[node.status]?.replace('bg-', 'bg-') + ' bg-opacity-20'
            }`}>
              <span className={`w-2 h-2 rounded-full ${statusColors[node.status]}`} />
              {statusLabels[node.status] || node.status}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">{node.host}</p>
        </div>
        <div className="flex gap-2">
          {canInstall && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md font-medium"
            >
              {installing ? 'Installing...' : 'Install OpenVPN'}
            </button>
          )}
          {canAddClient && (
            <Link
              href={`/dashboard/nodes/${nodeId}/clients/new`}
              className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-md font-medium"
            >
              + Add Client
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DetailCard label="Agent Version" value={node.version || '-'} />
        <DetailCard label="OpenVPN" value={node.openvpnVersion || '-'} />
        <DetailCard
          label="Last Heartbeat"
          value={node.lastHeartbeatAt ? new Date(node.lastHeartbeatAt).toLocaleString() : 'Never'}
        />
        <DetailCard
          label="Created"
          value={new Date(node.createdAt).toLocaleString()}
        />
      </div>

      {node.healthStatus && node.status === 'HEALTHY' && (
        <div className="bg-card text-card-foreground border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Health Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Connected Clients"
              value={node.healthStatus.details.connectedClients ?? 0}
            />
            <MetricCard
              label="CPU"
              value={node.healthStatus.details.cpu ? `${node.healthStatus.details.cpu.toFixed(1)}%` : '-'}
            />
            <MetricCard
              label="Memory"
              value={node.healthStatus.details.memory ? `${node.healthStatus.details.memory.toFixed(1)}%` : '-'}
            />
            <MetricCard
              label="Uptime"
              value={node.healthStatus.details.uptime ? `${Math.floor(node.healthStatus.details.uptime / 3600)}h` : '-'}
            />
          </div>
          {node.xorMask && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">XOR Mask:</span>
              <code className="ml-2 text-xs">{node.xorMask}</code>
            </div>
          )}
        </div>
      )}

      <div className="bg-card text-card-foreground border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Actions</h3>
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/dashboard/nodes/${nodeId}/clients`}
            className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border rounded-md"
          >
            View Clients
          </Link>
          <Link
            href={`/dashboard/jobs?nodeId=${nodeId}`}
            className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border rounded-md"
          >
            View Jobs
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md font-medium"
          >
            Delete Node
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted text-muted-foreground border border-border rounded-lg p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}
