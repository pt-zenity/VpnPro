import { NextRequest } from 'next/server';
import { verifyToken } from './crypto';

export interface AuthPayload {
  sub: string;
  email: string;
  role: 'SUPERADMIN' | 'ADMIN';
}

export async function authenticateRequest(request: NextRequest): Promise<AuthPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Validate role is one of the expected values
  if (payload.role !== 'SUPERADMIN' && payload.role !== 'ADMIN') {
    return null;
  }

  return payload as AuthPayload;
}

export async function requireAuth(request: NextRequest): Promise<AuthPayload> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    throw new Error('UNAUTHORIZED');
  }

  // Validate role
  if (payload.role !== 'SUPERADMIN' && payload.role !== 'ADMIN') {
    throw new Error('UNAUTHORIZED');
  }

  return payload as AuthPayload;
}

// For use in API routes
export function withAuth(handler: (request: NextRequest, payload: AuthPayload) => Promise<Response>) {
  return async (request: NextRequest) => {
    const payload = await authenticateRequest(request);

    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return handler(request, payload);
  };
}
