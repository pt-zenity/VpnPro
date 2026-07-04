import { NextResponse } from 'next/server';
import { prisma } from '@ovpn/db';
import { verifyApiToken } from '@/lib/crypto';
import { z } from 'zod';

// Schema for the progress update body.
// - progress: integer 0–100 (percentage); missing/null → skip update
// - message: optional short human-readable stage description (max 256 chars)
const progressBodySchema = z.object({
  progress: z.number().int().min(0).max(100).optional(),
  message: z.string().max(256).optional(),
});

// POST /api/agent/jobs/:id/progress
//
// Security hardening:
//  1. Validate body with Zod — reject unknown/out-of-range progress values so
//     an agent cannot store arbitrary data in the progress fields.
//  2. Re-use authenticateAgent helper for consistent token verification.
//  3. Verify the job belongs to the authenticated node before any write.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // -- Auth -------------------------------------------------------------------
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Missing token' }, { status: 401 });
    }

    const nodeId = await verifyApiToken(token);
    if (!nodeId) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid token' }, { status: 401 });
    }

    // -- Job ownership check ----------------------------------------------------
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, nodeId: true, status: true },
    });

    if (!job || job.nodeId !== nodeId) {
      return NextResponse.json({ error: 'JOB_NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }

    // Do not accept progress updates for already-finished jobs.
    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'JOB_ALREADY_FINISHED', message: 'Cannot update a finished job' },
        { status: 400 },
      );
    }

    // -- Body validation --------------------------------------------------------
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const parsed = progressBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { progress, message } = parsed.data;

    // Only write if at least one field is present.
    if (progress === undefined && message === undefined) {
      return NextResponse.json({ success: true }); // no-op
    }

    await prisma.job.update({
      where: { id },
      data: {
        ...(progress !== undefined ? { progress } : {}),
        ...(message !== undefined ? { progressMessage: message } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Job progress error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}
