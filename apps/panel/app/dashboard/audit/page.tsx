'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuditLog {
  id: string;
  adminEmail: string | null;
  nodeName: string | null;
  clientName: string | null;
  action: string;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch('/api/audit-logs', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem('auth_token');
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch logs');
        }

        const data = await res.json();
        setLogs(data.logs || []);
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audit Logs</h2>
        <p className="text-gray-400 mt-1">System activity history</p>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="bg-bg-secondary border border-border rounded-lg p-12 text-center">
          <p className="text-gray-400">No activity yet</p>
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Node
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-bg-tertiary/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {log.adminEmail || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {log.nodeName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {log.clientName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
