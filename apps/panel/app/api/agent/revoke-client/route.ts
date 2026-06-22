import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { agentRevokeClientSchema } from '@ovpn/api';

// POST /api/agent/revoke-client - Agent revokes client certificate
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
    const input = agentRevokeClientSchema.parse({ ...body, nodeId });

    // Find client
    const client = await prisma.vpnClient.findFirst({
      where: {
        nodeId: input.nodeId,
        name: input.clientName,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'CLIENT_NOT_FOUND', message: 'Client not found' },
        { status: 404 },
      );
    }

    // Update status
    await prisma.vpnClient.update({
      where: { id: client.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    // Expire artifacts
    await prisma.clientArtifact.updateMany({
      where: { clientId: client.id },
      data: { expiresAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: error },
        { status: 400 },
      );
    }
    console.error('Agent revoke client error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to revoke client' },
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
