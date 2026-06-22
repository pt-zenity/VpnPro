import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';

// POST /api/auth/logout
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'No token provided' },
        { status: 401 },
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'Invalid token' },
        { status: 401 },
      );
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'admin.logout',
        adminId: payload.sub,
        details: {},
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      },
    });

    // Client-side should discard token
    // No server-side token blacklist (stateless)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Logout failed' },
      { status: 500 },
    );
  }
}
