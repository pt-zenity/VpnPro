import { NextRequest } from 'next/server';
import { verifyToken } from './crypto';
import { cookies } from 'next/headers';

export type AdminRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER';

/** SUPERADMIN and ADMIN have full access; MANAGER is scoped to assigned nodes. */
export const FULL_ADMIN_ROLES: AdminRole[] = ['SUPERADMIN', 'ADMIN'];

export interface AuthPayload {
  sub: string;
  email: string;
  role: AdminRole;
}

export function isValidRole(role: unknown): role is AdminRole {
  return role === 'SUPERADMIN' || role === 'ADMIN' || role === 'MANAGER';
}

/** Name of the session cookie that carries the JWT. */
export const SESSION_COOKIE = 'auth_token';
/** Cookie lifetime, kept in sync with the JWT expiry (createToken → 7d). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Attributes for the session cookie.
 *
 * `secure` is derived from the *actual* request scheme rather than NODE_ENV:
 * a `Secure` cookie is silently dropped by the browser when the panel is served
 * over plain HTTP (e.g. before a TLS reverse proxy / domain is set up), which
 * makes login appear to "do nothing". We mark the cookie `Secure` only when the
 * request really reached the user over HTTPS — either directly, or via a proxy
 * that reports `x-forwarded-proto: https`.
 */
export function sessionCookieOptions(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const isHttps = forwardedProto === 'https' || request.nextUrl.protocol === 'https:';
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

async function extractToken(request: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export async function authenticateRequest(request: NextRequest): Promise<AuthPayload | null> {
  const token = await extractToken(request);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Validate role is one of the expected values
  if (!isValidRole(payload.role)) {
    return null;
  }

  return payload as AuthPayload;
}

export async function requireAuth(request: NextRequest): Promise<AuthPayload> {
  const token = await extractToken(request);
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const payload = await verifyToken(token);

  if (!payload) {
    throw new Error('UNAUTHORIZED');
  }

  // Validate role
  if (!isValidRole(payload.role)) {
    throw new Error('UNAUTHORIZED');
  }

  return payload as AuthPayload;
}
