import { NextResponse } from 'next/server';
import { prisma } from '@ovpn/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the latest NODE_INSTALL job for this node
    const job = await prisma.job.findFirst({
      where: {
        nodeId: id,
        type: 'NODE_INSTALL',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        status: true,
        progress: true,
        progressMessage: true,
      },
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
