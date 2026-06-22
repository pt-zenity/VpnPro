import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ clientName: string }>;

// GET /api/agent/config/:clientName - Agent gets client config content
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { clientName } = await params;

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

    // Find client
    const client = await prisma.vpnClient.findFirst({
      where: {
        nodeId,
        name: clientName,
      },
      include: {
        artifacts: {
          where: {
            artifactType: 'OVPN',
            expiresAt: { gte: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'CLIENT_NOT_FOUND', message: 'Client not found' },
        { status: 404 },
      );
    }

    if (client.status === 'REVOKED') {
      return NextResponse.json(
        { error: 'CLIENT_REVOKED', message: 'Client has been revoked' },
        { status: 403 },
      );
    }

    const artifact = client.artifacts[0];
    if (!artifact) {
      return NextResponse.json(
        { error: 'ARTIFACT_NOT_FOUND', message: 'Config not generated yet' },
        { status: 404 },
      );
    }

    // Return base64 encoded content
    const content = artifact.storagePath || '';
    const base64Content = Buffer.from(content).toString('base64');

    return NextResponse.json({
      success: true,
      ovpnContent: base64Content,
    });
  } catch (error) {
    console.error('Agent get config error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to get config' },
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
