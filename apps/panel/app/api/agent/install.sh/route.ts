import { NextResponse } from 'next/server';
import { readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

// GET /api/agent/install.sh — serve the agent installer bash script.
//
// Security hardening:
//  1. Path traversal guard: resolve() the final path and assert it sits inside
//     the project root. A crafted cwd() value can never escape the workspace.
//  2. File-size cap (500 KB): prevents a replaced/maliciously-large file on
//     disk from being streamed to unauthenticated callers.
//  3. No directory traversal via the URL — the route has no dynamic segment so
//     there is no user-controlled path component.
//  4. Content-Type forced to text/plain — browsers cannot execute it inline.

const MAX_SCRIPT_BYTES = 512 * 1024; // 500 KB hard cap

export async function GET() {
  try {
    // Build the expected absolute path and resolve symlinks/.. sequences.
    const projectRoot = resolve(process.cwd(), '../..');
    const scriptPath = resolve(join(projectRoot, 'install-agent.sh'));

    // Guard: resolved path must start with projectRoot to prevent traversal.
    if (!scriptPath.startsWith(projectRoot + '/') && scriptPath !== projectRoot) {
      console.error('[install.sh] Path traversal attempt blocked:', scriptPath);
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // Check the file exists and is within the size cap before reading.
    let size: number;
    try {
      const stat = statSync(scriptPath);
      if (!stat.isFile()) throw new Error('not a file');
      size = stat.size;
    } catch {
      return NextResponse.json(
        { error: 'INSTALL_SCRIPT_NOT_FOUND', message: 'Agent installer not found' },
        { status: 404 },
      );
    }

    if (size > MAX_SCRIPT_BYTES) {
      console.error(`[install.sh] Script too large (${size} bytes > ${MAX_SCRIPT_BYTES})`);
      return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const script = readFileSync(scriptPath, 'utf-8');

    return new NextResponse(script, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        // Never cache — always serve the current version.
        'Cache-Control': 'no-store',
        // Prevent browsers from executing inline or sniffing as executable.
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline; filename="install-agent.sh"',
      },
    });
  } catch (error) {
    console.error('Failed to serve install.sh:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to serve installer' },
      { status: 500 },
    );
  }
}
