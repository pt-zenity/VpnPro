import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';

type Params = Promise<{ id: string }>;

// GET /api/nodes/:id/install-progress — latest NODE_INSTALL job progress (auth-gated).
export const GET = withAuth(async (_request: NextRequest, _payload, { params }: { params: Params }) => {
  try {
    const { id } = await params;

    const job = await prisma.job.findFirst({
      where: { nodeId: id, type: 'NODE_INSTALL' },
      orderBy: { createdAt: 'desc' },
      select: { status: true, progress: true, progressMessage: true },
    });

    if (!job) {
      return NextResponse.json({ progress: 0, message: 'No installation job found' });
    }

    return NextResponse.json({
      progress: job.progress || 0,
      message: job.progressMessage || 'Installing...',
      status: job.status,
    });
  } catch (error) {
    console.error('Failed to get install progress:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to get install progress' }, { status: 500 });
  }
});
