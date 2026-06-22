import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/agent/install - Agent reports install completion
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
    const { success, version, xorMask } = body;

    if (!success) {
      // Update node to error state
      await prisma.node.update({
        where: { id: nodeId },
        data: { status: 'ERROR' },
      });

      return NextResponse.json({ success: true });
    }

    // Update node with install info
    await prisma.node.update({
      where: { id: nodeId },
      data: {
        status: 'HEALTHY',
        openvpnVersion: version,
        xorMask,
        installedAt: new Date(),
      },
    });

    // Update job if exists
    const job = await prisma.job.findFirst({
      where: {
        nodeId,
        type: 'NODE_INSTALL',
        status: 'RUNNING',
      },
    });

    if (job) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: { version, xorMask },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Agent install error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Install update failed' },
      { status: 500 },
    );
  }
}

async function verifyApiToken(token: string): Promise<string | null> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token + (process.env.API_TOKEN_SALT || 'default_api_salt'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const node = await prisma.node.findFirst({ where: { apiToken: hashHex } });
  return node?.id ?? null;
}
