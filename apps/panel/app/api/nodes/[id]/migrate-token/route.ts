import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';
import crypto from 'crypto';

type Params = Promise<{ id: string }>;

// POST /api/nodes/:id/migrate-token
export const POST = withAuth(async (request: NextRequest, payload, { params }: { params: Params }) => {
  try {
    const { id } = await params;

    const node = await prisma.node.findUnique({
      where: { id },
    });

    if (!node) {
      return NextResponse.json(
        { error: 'NODE_NOT_FOUND', message: 'Node not found' },
        { status: 404 },
      );
    }

    // Set node to PENDING so it can be re-installed
    await prisma.node.update({
      where: { id },
      data: {
        status: 'PENDING',
        installedAt: null, // Allow installation again
      },
    });

    // Invalidate existing registration tokens for this node
    await prisma.nodeAuthToken.updateMany({
      where: { nodeId: id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate a fresh registration token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.nodeAuthToken.create({
      data: {
        token,
        nodeId: id,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      token,
    });
  } catch (error) {
    console.error('Migrate token error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate token' },
      { status: 500 },
    );
  }
});
