import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { agentHeartbeatSchema } from '@ovpn/api';
import { verifyApiToken } from '@/lib/crypto';
import { jobQueue } from '@/lib/queue';

// POST /api/agent/heartbeat - Agent heartbeat
export async function POST(request: NextRequest) {
  try {
    // Verify token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'Missing or invalid token' },
        { status: 401 },
      );
    }

    const token = authHeader.slice(7);
    const nodeId = await verifyApiToken(token);
    if (!nodeId) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'Token verification failed' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const input = agentHeartbeatSchema.parse({ ...body, nodeId });

    // Get node
    const node = await prisma.node.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return NextResponse.json(
        { error: 'NODE_NOT_FOUND', message: 'Node not found' },
        { status: 404 },
      );
    }

    // Update heartbeat
    const now = new Date();
    await prisma.node.update({
      where: { id: nodeId },
      data: {
        lastHeartbeatAt: now,
        status: node.status === 'PENDING' ? 'PROVISIONING' : node.status,
      },
    });

    // Store health check
    await prisma.healthCheck.create({
      data: {
        nodeId,
        status: input.details?.connectedClients !== undefined ? 'HEALTHY' : 'HEALTHY',
        details: input.details ?? {},
        checkedAt: now,
      },
    });

    // Get pending jobs for this node
    const pendingJobs = await prisma.job.findMany({
      where: {
        nodeId,
        status: 'PENDING',
      },
      orderBy: { priority: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        payload: true,
      },
    });

    // Mark jobs as running
    if (pendingJobs.length > 0) {
      await prisma.job.updateMany({
        where: {
          id: { in: pendingJobs.map((j: any) => j.id) },
        },
        data: {
          status: 'RUNNING',
          startedAt: now,
        },
      });
    }

    return NextResponse.json({
      success: true,
      serverTime: now.toISOString(),
      pendingJobs,
    });
  } catch (error) {
    if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: error },
        { status: 400 },
      );
    }
    console.error('Heartbeat error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Heartbeat failed' },
      { status: 500 },
    );
  }
}
