'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Job {
  id: string;
  type: 'NODE_INSTALL' | 'CLIENT_CREATE' | 'CLIENT_REVOKE' | 'NODE_SYNC' | 'HEALTH_CHECK';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  nodeName: string;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

const statusColors: Record<Job['status'], string> = {
  PENDING: 'text-gray-400',
  RUNNING: 'text-primary',
  COMPLETED: 'text-success',
  FAILED: 'text-error',
  CANCELLED: 'text-gray-400',
};

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch jobs');
      }

      const data = await res.json();
      setJobs(data.jobs || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCancel = async (jobId: string) => {
    if (!confirm('Cancel this job?')) return;

    const token = localStorage.getItem('auth_token');
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      fetchJobs();
    } else {
      const data = await res.json();
      alert(data.message || 'Failed to cancel job');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Jobs</h2>
          <p className="text-gray-400 mt-1">Background job history</p>
        </div>
        <button
          onClick={fetchJobs}
          className="px-4 py-2 bg-bg-tertiary hover:bg-bg-tertiary/80 border border-border rounded-lg"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="bg-bg-secondary border border-border rounded-lg p-12 text-center">
          <p className="text-gray-400">No jobs yet</p>
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Node
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => {
                const duration = job.completedAt
                  ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()) / 1000)}s`
                  : job.status === 'RUNNING'
                    ? `${Math.round((Date.now() - new Date(job.createdAt).getTime()) / 1000)}s`
                    : '-';

                return (
                  <tr key={job.id} className="hover:bg-bg-tertiary/50">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{job.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{job.nodeName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={statusColors[job.status]}>{job.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {duration}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {job.status === 'PENDING' || job.status === 'RUNNING' ? (
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="text-error hover:text-error-600"
                        >
                          Cancel
                        </button>
                      ) : job.error ? (
                        <span className="text-error text-xs" title={job.error}>
                          Error
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
