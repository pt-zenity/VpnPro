import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/agent/clients - Agent lists all clients
export async function GET(request: NextRequest) {
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

    const clients = await prisma.vpnClient.findMany({
      where: { nodeId },
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        status: true,
        fingerprint: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      clients: clients.map((c: any) => ({
        name: c.name,
        status: c.status === 'ACTIVE' ? 'ACTIVE' : 'REVOKED',
        fingerprint: c.fingerprint,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Agent list clients error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to list clients' },
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
