import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@ovpn/api';
import { verifyPassword, createToken } from '@/lib/crypto';
import { isZodError, zodErrorResponse } from '@/lib/api-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { SESSION_COOKIE, sessionCookieOptions, getClientIp } from '@/lib/auth';

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    // Validate and parse body *before* touching the DB.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { email, password } = parsed.data;

    // Sanitised client IP (no header-injection possible after getClientIp).
    const ip = getClientIp(request);

    // Primary rate-limit key: per-IP (broad brute-force protection).
    // Secondary key: per email (credential-stuffing protection).
    // Both must pass; the more restrictive one governs.
    const [ipLimit, emailLimit] = await Promise.all([
      rateLimit(`login:ip:${ip}`,                    { limit: 20, windowSec: 900 }),
      rateLimit(`login:email:${email.toLowerCase()}`, { limit: 10, windowSec: 900 }),
    ]);

    const blocked = !ipLimit.allowed || !emailLimit.allowed;
    const retryAfter = Math.max(ipLimit.retryAfterSec, emailLimit.retryAfterSec);

    if (blocked) {
      return NextResponse.json(
        { error: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      await logFailedLogin(request, ip, null);
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const isValid = await verifyPassword(admin.passwordHash, password);
    if (!isValid) {
      await logFailedLogin(request, ip, admin.id);
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        { status: 401 },
      );
    }

    // Update last login
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Create JWT
    const token = await createToken({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(request));

    // Audit log — use sanitised IP only.
    await prisma.auditLog.create({
      data: {
        action: 'admin.login',
        adminId: admin.id,
        details: { success: true },
        ipAddress: ip,
        userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? undefined,
      },
    });

    // Note: the token is intentionally NOT returned in the body — it lives only
    // in the HttpOnly cookie set above, so it is never exposed to client JS.
    return NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    if (isZodError(error)) return zodErrorResponse(error);
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Login failed' },
      { status: 500 },
    );
  }
}

/**
 * Record a failed login attempt. Best-effort only — never let an audit-log
 * failure surface as a 500 to the caller.
 */
async function logFailedLogin(
  request: NextRequest,
  ip: string,
  adminId: string | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: 'admin.login_failed',
        ...(adminId ? { adminId } : {}),
        details: { success: false },
        ipAddress: ip,
        userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? undefined,
      },
    });
  } catch (error) {
    console.error('Failed to write login_failed audit log:', error);
  }
}
