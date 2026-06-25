import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listJobsSchema } from '@ovpn/api';
import { withAuth } from '@/lib/middleware';
import { accessibleNodeIds } from '@/lib/access';
import { isZodError, zodErrorResponse } from '@/lib/api-helpers';

// GET /api/jobs - List jobs (scoped to a manager's nodes)
export const GET = withAuth(async (request: NextRequest, payload) => {
  try {
    const { searchParams } = new URL(request.url);
    const input = listJobsSchema.parse(Object.fromEntries(searchParams));

    const where: any = {};
    if (input.nodeId) where.nodeId = input.nodeId;
    if (input.type) where.type = input.type;
    if (input.status) where.status = input.status;

    // Managers only see jobs for their assigned nodes.
    const ids = await accessibleNodeIds(payload);
    if (ids !== null) {
      where.nodeId = input.nodeId
        ? (ids.includes(input.nodeId) ? input.nodeId : { in: [] })
        : { in: ids };
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          node: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    return NextResponse.json({
      jobs: jobs.map((j: any) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        nodeId: j.nodeId,
        nodeName: j.node.name,
        payload: j.payload,
        result: j.result,
        error: j.error,
        createdAt: j.createdAt.toISOString(),
        startedAt: j.startedAt?.toISOString() ?? null,
        completedAt: j.completedAt?.toISOString() ?? null,
      })),
      total,
    });
  } catch (error) {
    if (isZodError(error)) return zodErrorResponse(error);
    console.error('List jobs error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to list jobs' },
      { status: 500 },
    );
  }
});
