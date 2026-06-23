import { NextResponse } from 'next/server';
import { prisma } from '@ovpn/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fast token validation without joining
    const node = await prisma.node.findFirst({
      where: { apiToken: token },
      select: { id: true },
    });

    if (!node) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job || job.nodeId !== node.id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const { progress, message } = await request.json();

    await prisma.job.update({
      where: { id },
      data: {
        progress: typeof progress === 'number' ? progress : undefined,
        progressMessage: typeof message === 'string' ? message : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Job progress error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
