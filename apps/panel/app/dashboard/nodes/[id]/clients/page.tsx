'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  fingerprint: string;
  createdAt: string;
  revokedAt: string | null;
  artifactCount: number;
}

const statusColors: Record<Client['status'], string> = {
  ACTIVE: 'text-success',
  REVOKED: 'text-error',
  EXPIRED: 'text-gray-400',
};

export default function NodeClientsPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodeName, setNodeName] = useState('');

  const fetchClients = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`/api/nodes/${nodeId}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch clients');
      }

      const data = await res.json();
      setClients(data.clients || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [nodeId]);

  const handleRevoke = async (clientId: string, clientName: string) => {
    if (!confirm(`Revoke client "${clientName}"? This action cannot be undone.`)) return;

    const token = localStorage.getItem('auth_token');
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      fetchClients();
    } else {
      const data = await res.json();
      alert(data.message || 'Failed to revoke client');
    }
  };

  const handleDownload = async (clientId: string, clientName: string) => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`/api/clients/${clientId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.message || 'Failed to download config');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clientName}.ovpn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Clients</h2>
          <p className="text-gray-400 mt-1">Manage VPN client configurations</p>
        </div>
        <Link
          href={`/dashboard/nodes/${nodeId}/clients/new`}
          className="px-4 py-2 bg-primary hover:bg-primary-600 rounded-lg"
        >
          + Add Client
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : clients.length === 0 ? (
        <div className="bg-bg-secondary border border-border rounded-lg p-12 text-center">
          <p className="text-gray-400 mb-4">No clients configured yet</p>
          <Link
            href={`/dashboard/nodes/${nodeId}/clients/new`}
            className="px-4 py-2 bg-primary hover:bg-primary-600 rounded-lg"
          >
            Add Your First Client
          </Link>
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-bg-tertiary/50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        {client.fingerprint.slice(0, 16)}...
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={statusColors[client.status]}>{client.status}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {new Date(client.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {client.status === 'ACTIVE' && client.artifactCount > 0 && (
                      <button
                        onClick={() => handleDownload(client.id, client.name)}
                        className="text-primary hover:text-primary-600 mr-4"
                      >
                        Download
                      </button>
                    )}
                    {client.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleRevoke(client.id, client.name)}
                        className="text-error hover:text-error-600"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
