import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// POST /api/auth/logout
export async function POST(request: NextRequest) {
  try {
    const payload = await authenticateRequest(request);

    if (!payload) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'No valid token provided' },
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

    const cookieStore = await cookies();
    cookieStore.delete('auth_token');

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
