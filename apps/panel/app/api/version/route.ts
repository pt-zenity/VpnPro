import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/version';

// GET /api/version — public endpoint, no auth required
// Returns the current panel version and build metadata.
export async function GET() {
  return NextResponse.json({
    version:   APP_VERSION,
    label:     `v${APP_VERSION}`,
    name:      'OVPN Admin Panel',
    builtAt:   process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
  });
}
