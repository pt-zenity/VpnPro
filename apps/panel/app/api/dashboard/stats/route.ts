import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';
import { accessibleNodeIds } from '@/lib/access';

// GET /api/dashboard/stats - Dashboard statistics (scoped to a manager's nodes)
export const GET = withAuth(async (request: NextRequest, payload) => {
  try {
    // Managers only see their own nodes' figures. nodeFilter / nf scope every count.
    const ids = await accessibleNodeIds(payload);
    const nodeFilter = ids !== null ? { id: { in: ids } } : {};
    const nf = ids !== null ? { nodeId: { in: ids } } : {};

    const [
      totalNodes,
      healthyNodes,
      unhealthyNodes,
      pendingNodes,
      totalClients,
      activeClients,
      revokedClients,
      runningJobs,
      failedJobs,
      pendingJobs,
    ] = await Promise.all([
      // Nodes
      prisma.node.count({ where: nodeFilter }),
      prisma.node.count({ where: { ...nodeFilter, status: 'HEALTHY' } }),
      prisma.node.count({ where: { ...nodeFilter, status: 'UNHEALTHY' } }),
      // "Pending" covers both not-yet-connected (PENDING) and being-provisioned
      // (PROVISIONING); only true ERROR nodes land in the error bucket below.
      prisma.node.count({ where: { ...nodeFilter, status: { in: ['PENDING', 'PROVISIONING'] } } }),
      // Clients
      prisma.vpnClient.count({ where: nf }),
      prisma.vpnClient.count({ where: { ...nf, status: 'ACTIVE' } }),
      prisma.vpnClient.count({ where: { ...nf, status: 'REVOKED' } }),
      // Jobs
      prisma.job.count({ where: { ...nf, status: 'RUNNING' } }),
      prisma.job.count({ where: { ...nf, status: 'FAILED' } }),
      prisma.job.count({ where: { ...nf, status: 'PENDING' } }),
    ]);

    return NextResponse.json({
      nodes: {
        total: totalNodes,
        healthy: healthyNodes,
        unhealthy: unhealthyNodes,
        pending: pendingNodes,
        error: totalNodes - healthyNodes - unhealthyNodes - pendingNodes,
      },
      clients: {
        total: totalClients,
        active: activeClients,
        revoked: revokedClients,
        expired: totalClients - activeClients - revokedClients,
      },
      jobs: {
        running: runningJobs,
        failed: failedJobs,
        pending: pendingJobs,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to get stats' },
      { status: 500 },
    );
  }
});
