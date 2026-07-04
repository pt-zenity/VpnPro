import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';
import { accessibleNodeIds } from '@/lib/access';

// ============================================================================
// GET /api/traffic — Real-time connection & traffic data
//
// Returns:
//  • sessions   — every online client (across all accessible nodes)
//  • nodes      — per-node aggregate (connectedClients, totalBytesUp/Down)
//  • totals     — fleet-wide aggregate
//  • sparklines — last 20 HealthCheck entries per node (for mini-charts)
//  • timestamp  — server time for the client to compute delta
// ============================================================================
export const GET = withAuth(async (request: NextRequest, payload) => {
  try {
    const ids = await accessibleNodeIds(payload);
    const nodeFilter = ids !== null ? { id: { in: ids } } : {};
    const nf         = ids !== null ? { nodeId: { in: ids } } : {};

    // ── 1. All accessible nodes (basic info + last heartbeat) ──────────────────
    const nodes = await prisma.node.findMany({
      where: nodeFilter,
      select: {
        id: true,
        name: true,
        host: true,
        status: true,
        lastHeartbeatAt: true,
      },
      orderBy: { name: 'asc' },
    });

    const nodeIds = nodes.map((n) => n.id);

    // ── 2. Online client sessions ──────────────────────────────────────────────
    const onlineClients = await prisma.vpnClient.findMany({
      where: {
        ...nf,
        online: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        nodeId: true,
        bytesUp: true,
        bytesDown: true,
        connectedSince: true,
        realAddress: true,
        vpnAddress: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    // ── 3. Per-node aggregates (all clients, not just online) ──────────────────
    const perNodeAgg = await prisma.vpnClient.groupBy({
      by: ['nodeId'],
      where: { nodeId: { in: nodeIds } },
      _sum:   { bytesUp: true, bytesDown: true },
      _count: { id: true },
    });

    // Online count per node
    const onlinePerNode = await prisma.vpnClient.groupBy({
      by: ['nodeId'],
      where: { nodeId: { in: nodeIds }, online: true },
      _count: { id: true },
    });

    const onlineMap: Record<string, number> = {};
    for (const row of onlinePerNode) {
      onlineMap[row.nodeId] = row._count.id;
    }

    // ── 4. Sparkline history — last 20 health checks per node ─────────────────
    //  We fetch them in one query then group in JS to avoid N+1.
    const recentChecks = nodeIds.length > 0
      ? await prisma.healthCheck.findMany({
          where: {
            nodeId: { in: nodeIds },
          },
          select: {
            nodeId: true,
            details: true,
            checkedAt: true,
          },
          orderBy: { checkedAt: 'desc' },
          take: nodeIds.length * 20, // rough upper-bound
        })
      : [];

    // Group by nodeId, keep last 20 per node (already desc-ordered)
    const sparklineMap: Record<string, Array<{ t: number; connected: number; cpu: number }>> = {};
    for (const chk of recentChecks) {
      if (!sparklineMap[chk.nodeId]) sparklineMap[chk.nodeId] = [];
      if (sparklineMap[chk.nodeId].length >= 20) continue;
      const d = chk.details as Record<string, unknown>;
      sparklineMap[chk.nodeId].push({
        t:         chk.checkedAt.getTime(),
        connected: (d.connectedClients as number) ?? 0,
        cpu:       (d.cpu           as number) ?? 0,
      });
    }
    // Reverse so array is oldest → newest (chart-friendly)
    for (const nid of Object.keys(sparklineMap)) {
      sparklineMap[nid].reverse();
    }

    // ── 5. Fleet totals ────────────────────────────────────────────────────────
    let totalBytesUp   = BigInt(0);
    let totalBytesDown = BigInt(0);
    let totalClients   = 0;

    const nodeAggMap: Record<string, {
      totalBytesUp: string;
      totalBytesDown: string;
      totalClients: number;
      onlineClients: number;
    }> = {};

    for (const agg of perNodeAgg) {
      const up   = agg._sum.bytesUp   ?? BigInt(0);
      const down = agg._sum.bytesDown ?? BigInt(0);
      totalBytesUp   += up;
      totalBytesDown += down;
      totalClients   += agg._count.id;

      nodeAggMap[agg.nodeId] = {
        totalBytesUp:   up.toString(),
        totalBytesDown: down.toString(),
        totalClients:   agg._count.id,
        onlineClients:  onlineMap[agg.nodeId] ?? 0,
      };
    }

    // ── 6. Compose response ────────────────────────────────────────────────────
    return NextResponse.json({
      timestamp: Date.now(),
      totals: {
        onlineClients:  onlineClients.length,
        totalBytesUp:   totalBytesUp.toString(),
        totalBytesDown: totalBytesDown.toString(),
        totalClients,
        healthyNodes: nodes.filter((n) => n.status === 'HEALTHY').length,
        totalNodes:   nodes.length,
      },
      nodes: nodes.map((n) => ({
        id:             n.id,
        name:           n.name,
        host:           n.host,
        status:         n.status,
        lastHeartbeatAt: n.lastHeartbeatAt?.toISOString() ?? null,
        ...( nodeAggMap[n.id] ?? {
          totalBytesUp:   '0',
          totalBytesDown: '0',
          totalClients:   0,
          onlineClients:  0,
        }),
        sparkline: sparklineMap[n.id] ?? [],
      })),
      sessions: onlineClients.map((c) => ({
        id:            c.id,
        name:          c.name,
        nodeId:        c.nodeId,
        bytesUp:       c.bytesUp.toString(),
        bytesDown:     c.bytesDown.toString(),
        connectedSince: c.connectedSince?.toISOString() ?? null,
        realAddress:   c.realAddress  ?? null,
        vpnAddress:    c.vpnAddress   ?? null,
        lastSeenAt:    c.lastSeenAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error('Traffic API error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to load traffic data' },
      { status: 500 },
    );
  }
});
