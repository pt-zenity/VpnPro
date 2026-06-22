import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { installNodeSchema } from '@ovpn/api';
import { jobQueue } from '@/lib/queue';
import { withAuth } from '@/lib/middleware';

type Params = Promise<{ id: string }>;

// POST /api/nodes/:id/install - Trigger OpenVPN installation
export const POST = withAuth(async (request: NextRequest, payload, { params }: { params: Params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = installNodeSchema.parse(body);

    const node = await prisma.node.findUnique({ where: { id } });
    if (!node) {
      return NextResponse.json(
        { error: 'NODE_NOT_FOUND', message: 'Node not found' },
        { status: 404 },
      );
    }

    if (node.status === 'HEALTHY' || node.installedAt) {
      return NextResponse.json(
        { error: 'NODE_ALREADY_INSTALLED', message: 'Node already has OpenVPN installed' },
        { status: 400 },
      );
    }

    if (node.status === 'UNHEALTHY' || node.status === 'ERROR') {
      // Allow retry install
    }

    // Check if agent is connected (recent heartbeat)
    if (!node.lastHeartbeatAt || Date.now() - node.lastHeartbeatAt.getTime() > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: 'AGENT_OFFLINE', message: 'Agent is not connected. Install agent first.' },
        { status: 503 },
      );
    }

    // Create install job
    const job = await prisma.job.create({
      data: {
        type: 'NODE_INSTALL',
        status: 'PENDING',
        priority: 10,
        nodeId: node.id,
        payload: {
          serverHost: input.serverHost,
          port: input.port,
          protocol: input.protocol,
          firstUser: input.firstUser,
        },
        maxAttempts: 3,
      },
    });

    // Enqueue job
    await jobQueue.add('node-install', { jobId: job.id }, {
      jobId: job.id,
      priority: 10,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
    });

    // Update node status
    await prisma.node.update({
      where: { id },
      data: { status: 'PROVISIONING' },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'node.install_triggered',
        nodeId: node.id,
        details: { jobId: job.id },
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      },
    });

    return NextResponse.json({
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
      },
    });
  } catch (error) {
    if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: error },
        { status: 400 },
      );
    }
    console.error('Install node error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to trigger install' },
      { status: 500 },
    );
  }
});
