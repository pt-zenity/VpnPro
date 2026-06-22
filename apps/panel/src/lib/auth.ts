import { NextRequest } from 'next/server';
import { verifyToken } from './crypto';
import { cookies } from 'next/headers';

export interface AuthPayload {
  sub: string;
  email: string;
  role: 'SUPERADMIN' | 'ADMIN';
}

async function extractToken(request: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('auth_token')?.value;
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
  if (payload.role !== 'SUPERADMIN' && payload.role !== 'ADMIN') {
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
