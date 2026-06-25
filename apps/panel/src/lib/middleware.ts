import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthPayload, FULL_ADMIN_ROLES } from './auth';

/**
 * Require authentication for an API route. Returns 401 if not authenticated,
 * otherwise calls the handler. Any valid role (incl. MANAGER) is allowed —
 * routes that need finer scoping do their own node-access checks.
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
 * Require a FULL admin (SUPERADMIN/ADMIN). Managers get 403. Use for node
 * lifecycle (create/install/migrate/delete) and admin/manager management.
 */
export function withFullAdmin<T = NextRequest>(
  handler: (request: NextRequest, payload: AuthPayload, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const payload = await requireAuth(request);
      if (!FULL_ADMIN_ROLES.includes(payload.role)) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Administrator access required' },
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
