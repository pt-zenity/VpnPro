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

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------
// Attack surface: a caller can inject arbitrary bytes into x-forwarded-for
// (e.g.  "evil\nKey: val" header injection, or extremely long values used as
// DoS / cache-poisoning keys).  We sanitise the value to a safe subnet of
// printable ASCII before using it in rate-limit keys or audit logs.
//
// Rules:
//  1. Take only the FIRST token (leftmost = original client IP in a single-
//     proxy setup; if you have multiple proxies, the Nginx config already
//     strips extra hops via `set_real_ip_from`).
//  2. Strip any character that is not a valid IPv4/IPv6 address character:
//     digits, dots, colons, A-F, a-f, and the surrounding brackets for IPv6.
//  3. Truncate to 45 characters (max IPv6 string length).
//  4. Fall back to 'unknown' if nothing survives sanitisation.
// ---------------------------------------------------------------------------

/** Sanitise a raw x-forwarded-for / remote-address value to a plain IP string. */
function sanitiseIp(raw: string): string {
  // Keep only valid IP characters: 0-9, a-f, A-F, ., :, [, ]
  const clean = raw
    .split(',')[0]          // first hop only
    .trim()
    .replace(/[^0-9a-fA-F.:[\]]/g, '')  // strip anything else
    .slice(0, 45);          // max IPv6 length
  return clean || 'unknown';
}

/**
 * Extract and sanitise the client IP from an incoming request.
 * Prefers x-forwarded-for (set by Nginx), falls back to 'unknown'.
 * The result is safe for use as a rate-limit key or in audit logs.
 */
export function getClientIp(request: NextRequest | Request): string {
  const header = (request.headers as Headers).get('x-forwarded-for');
  if (header) return sanitiseIp(header);
  return 'unknown';
}

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
