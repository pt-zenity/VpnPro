import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { agentCreateClientSchema } from '@ovpn/api';

// POST /api/agent/create-client - Agent creates client certificate
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
    const input = agentCreateClientSchema.parse({ ...body, nodeId });

    // Validate client name doesn't exist
    const existing = await prisma.vpnClient.findFirst({
      where: {
        nodeId: input.nodeId,
        name: input.clientName,
        status: { not: 'REVOKED' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'CLIENT_ALREADY_EXISTS', message: 'Client already exists' },
        { status: 409 },
      );
    }

    // Check node is healthy
    const node = await prisma.node.findUnique({ where: { id: input.nodeId } });
    if (!node || node.status !== 'HEALTHY') {
      return NextResponse.json(
        { error: 'NODE_NOT_HEALTHY', message: 'Node is not in healthy state' },
        { status: 503 },
      );
    }

    // For MVP: generate dummy response
    // In production, agent would actually run EasyRSA
    const fingerprint = Array.from({ length: 32 }, () =>
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');

    // Create client record
    const client = await prisma.vpnClient.create({
      data: {
        nodeId: input.nodeId,
        name: input.clientName,
        status: 'ACTIVE',
        fingerprint,
      },
    });

    // Return success
    // Agent will call back with actual ovpnContent
    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: input.clientName,
        fingerprint,
      },
    });
  } catch (error) {
    if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: error },
        { status: 400 },
      );
    }
    console.error('Agent create client error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create client' },
      { status: 500 },
    );
  }
}

// Helper - duplicate from crypto, import in production
async function verifyApiToken(token: string): Promise<string | null> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token + (process.env.API_TOKEN_SALT || 'default_api_salt'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const node = await prisma.node.findFirst({ where: { apiToken: hashHex } });
  return node?.id ?? null;
}
