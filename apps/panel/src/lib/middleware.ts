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
