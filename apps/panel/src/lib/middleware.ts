import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthPayload } from './auth';

/**
 * Middleware to require authentication for API routes
 * Returns 401 if not authenticated, otherwise calls the handler
 * Supports Next.js 15 App Router with params
 */
export function withAuth<T = NextRequest>(
  handler: (request: NextRequest, payload: AuthPayload, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const payload = await requireAuth(request);
      return await handler(request, payload, context);
    } catch (error) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }
  };
}

/**
 * Middleware to require SUPERADMIN role
 */
export function withSuperAdmin<T = NextRequest>(
  handler: (request: NextRequest, payload: AuthPayload, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const payload = await requireAuth(request);
      if (payload.role !== 'SUPERADMIN') {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Superadmin access required' },
          { status: 403 }
        );
      }
      return await handler(request, payload, context);
    } catch (error) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }
  };
}

/**
 * Optional auth - doesn't fail if no auth, just passes null as payload
 */
export function withOptionalAuth<T = NextRequest>(
  handler: (request: NextRequest, payload: AuthPayload | null, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const { authenticateRequest } = await import('./auth');
      const payload = await authenticateRequest(request);
      return await handler(request, payload, context);
    } catch {
      return await handler(request, null, context);
    }
  };
}
