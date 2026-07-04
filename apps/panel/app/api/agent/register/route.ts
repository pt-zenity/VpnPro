import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { agentRegisterSchema } from '@ovpn/api';
import { verifyRegistrationToken, hashApiToken } from '@/lib/crypto';
import { isZodError, zodErrorResponse } from '@/lib/api-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

// POST /api/agent/register - Agent registration (one-time)
//
// Security hardening:
//  1. Rate-limit by IP to prevent token-bruteforce / registration-flood attacks.
//     20 attempts per 10 minutes per IP is generous for legitimate automated
//     installers while still blocking scanners.
//  2. Fail BEFORE any DB lookup when the rate limit is exceeded to avoid oracle
//     leakage (an attacker should learn nothing from a 429 except "slow down").
export async function POST(request: NextRequest) {
  try {
    // -- Rate limit (IP-based, pre-auth) ----------------------------------------
    const ip = getClientIp(request);
    const { allowed, retryAfterSec } = await rateLimit(
      `agent:register:${ip}`,
      { limit: 20, windowSec: 600 },
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'TOO_MANY_ATTEMPTS', message: 'Too many registration attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      );
    }

    // -- Body parse & validate --------------------------------------------------
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const parsed = agentRegisterSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const input = parsed.data;

    // -- Token validation -------------------------------------------------------
    const tokenRecord = await verifyRegistrationToken(input.token);
    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'Registration token invalid or expired' },
        { status: 400 },
      );
    }

    if (tokenRecord.usedAt) {
      return NextResponse.json(
        { error: 'TOKEN_ALREADY_USED', message: 'Registration token already used' },
        { status: 409 },
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'TOKEN_EXPIRED', message: 'Registration token expired' },
        { status: 400 },
      );
    }

    // -- Node lookup ------------------------------------------------------------
    if (!tokenRecord.nodeId) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'Invalid token' },
        { status: 400 },
      );
    }

    const node = await prisma.node.findUnique({
      where: { id: tokenRecord.nodeId },
    });

    if (!node) {
      return NextResponse.json(
        { error: 'NODE_NOT_FOUND', message: 'Node not found' },
        { status: 404 },
      );
    }

    // -- Mark token as used & issue API token -----------------------------------
    await prisma.nodeAuthToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });

    const rawApiToken = crypto.randomUUID();
    const hashedApiToken = await hashApiToken(rawApiToken);

    await prisma.node.update({
      where: { id: node.id },
      data: {
        status: 'PROVISIONING',
        version: input.agentVersion,
        lastHeartbeatAt: new Date(),
        apiToken: hashedApiToken,
        metadata: input.systemInfo ? (input.systemInfo as Prisma.InputJsonValue) : undefined,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'node.agent_registered',
        nodeId: node.id,
        details: {
          agentVersion: input.agentVersion,
          systemInfo: input.systemInfo,
          ip,
        },
      },
    });

    return NextResponse.json({
      success: true,
      node: {
        id: node.id,
        name: node.name,
        apiToken: rawApiToken,
      },
    });
  } catch (error) {
    if (isZodError(error)) return zodErrorResponse(error);
    console.error('Register agent error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Registration failed' },
      { status: 500 },
    );
  }
}
