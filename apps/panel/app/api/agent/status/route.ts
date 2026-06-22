import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/agent/status - Agent reports OpenVPN status
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

    // Get node info
    const node = await prisma.node.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return NextResponse.json(
        { error: 'NODE_NOT_FOUND', message: 'Node not found' },
        { status: 404 },
      );
    }

    // Get latest health check
    const healthCheck = await prisma.healthCheck.findFirst({
      where: { nodeId },
      orderBy: { checkedAt: 'desc' },
    });

    const details = healthCheck?.details as Record<string, unknown> || {};

    return NextResponse.json({
      status: {
        openvpn: node.status === 'HEALTHY' ? 'RUNNING' : node.status === 'UNHEALTHY' ? 'STOPPED' : 'ERROR',
        version: node.openvpnVersion || undefined,
        xorMask: node.xorMask || undefined,
        connectedClients: (details.connectedClients as number) || 0,
        uptime: (details.uptime as number) || 0,
        port: 443,
        protocol: 'udp' as const,
      },
    });
  } catch (error) {
    console.error('Agent status error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to get status' },
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
