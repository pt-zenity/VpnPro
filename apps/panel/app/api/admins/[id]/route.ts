import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateManagerSchema } from '@ovpn/api';
import { withFullAdmin } from '@/lib/middleware';
import { getClientIp } from '@/lib/auth';
import { hashPassword } from '@/lib/crypto';
import { isZodError, zodErrorResponse } from '@/lib/api-helpers';

type Params = Promise<{ id: string }>;

// PATCH /api/admins/:id - update a manager's node assignments and/or password.
export const PATCH = withFullAdmin(async (request: NextRequest, payload, { params }: { params: Params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = updateManagerSchema.parse(body);

    const target = await prisma.admin.findUnique({ where: { id }, select: { id: true, role: true } });
    // This endpoint only manages MANAGER accounts (full admins implicitly have
    // every node and aren't edited here).
    if (!target || target.role !== 'MANAGER') {
      return NextResponse.json({ error: 'MANAGER_NOT_FOUND', message: 'Manager not found' }, { status: 404 });
    }

    if (input.nodeIds) {
      const validNodeIds = input.nodeIds.length
        ? (await prisma.node.findMany({ where: { id: { in: input.nodeIds } }, select: { id: true } })).map((n) => n.id)
        : [];
      // Replace the assignment set.
      await prisma.$transaction([
        prisma.managerNode.deleteMany({ where: { adminId: id } }),
        prisma.managerNode.createMany({
          data: validNodeIds.map((nodeId) => ({ adminId: id, nodeId })),
          skipDuplicates: true,
        }),
      ]);
    }

    if (input.password) {
      await prisma.admin.update({ where: { id }, data: { passwordHash: await hashPassword(input.password) } });
    }

    await prisma.auditLog.create({
      data: {
        action: 'manager.updated',
        adminId: payload.sub,
        details: { managerId: id, nodeIds: input.nodeIds, passwordChanged: !!input.password },
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isZodError(error)) return zodErrorResponse(error);
    console.error('Update manager error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to update manager' }, { status: 500 });
  }
});

// DELETE /api/admins/:id - delete a manager (cascades node assignments).
export const DELETE = withFullAdmin(async (request: NextRequest, payload, { params }: { params: Params }) => {
  try {
    const { id } = await params;

    if (id === payload.sub) {
      return NextResponse.json({ error: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account' }, { status: 400 });
    }

    const target = await prisma.admin.findUnique({ where: { id }, select: { id: true, role: true, email: true } });
    if (!target || target.role !== 'MANAGER') {
      return NextResponse.json({ error: 'MANAGER_NOT_FOUND', message: 'Manager not found' }, { status: 404 });
    }

    await prisma.auditLog.create({
      data: {
        action: 'manager.deleted',
        adminId: payload.sub,
        details: { managerId: id, email: target.email },
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? undefined,
      },
    });

    await prisma.admin.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete manager error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to delete manager' }, { status: 500 });
  }
});
