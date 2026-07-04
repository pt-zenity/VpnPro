import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createManagerSchema } from '@ovpn/api';
import { withFullAdmin } from '@/lib/middleware';
import { getClientIp } from '@/lib/auth';
import { hashPassword } from '@/lib/crypto';
import { isZodError, zodErrorResponse } from '@/lib/api-helpers';

// GET /api/admins - list managers with their assigned nodes (full-admin only)
export const GET = withFullAdmin(async () => {
  try {
    const managers = await prisma.admin.findMany({
      where: { role: 'MANAGER' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        managedNodes: { select: { node: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({
      managers: managers.map((m) => ({
        id: m.id,
        email: m.email,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
        nodes: m.managedNodes.map((mn) => mn.node),
      })),
    });
  } catch (error) {
    console.error('List managers error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to list managers' }, { status: 500 });
  }
});

// POST /api/admins - create a manager (full-admin only)
export const POST = withFullAdmin(async (request: NextRequest, payload) => {
  try {
    const body = await request.json();
    const input = createManagerSchema.parse(body);
    const email = input.email.toLowerCase();

    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    // Keep only node ids that actually exist (ignore stale/invalid ones).
    const validNodeIds = input.nodeIds.length
      ? (await prisma.node.findMany({ where: { id: { in: input.nodeIds } }, select: { id: true } })).map((n) => n.id)
      : [];

    const passwordHash = await hashPassword(input.password);
    const manager = await prisma.admin.create({
      data: {
        email,
        passwordHash,
        role: 'MANAGER',
        managedNodes: { create: validNodeIds.map((nodeId) => ({ nodeId })) },
      },
      select: { id: true, email: true, role: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'manager.created',
        adminId: payload.sub,
        details: { managerId: manager.id, email, nodeIds: validNodeIds },
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? undefined,
      },
    });

    return NextResponse.json({ manager: { ...manager, nodeIds: validNodeIds } }, { status: 201 });
  } catch (error) {
    if (isZodError(error)) return zodErrorResponse(error);
    console.error('Create manager error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to create manager' }, { status: 500 });
  }
});
