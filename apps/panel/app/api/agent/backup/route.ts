import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ovpn/db';
import { authenticateAgent, agentUnauthorized } from '@/lib/api-helpers';
import { encrypt, decrypt } from '@/lib/crypto';

// Maximum PKI backup size accepted from an agent.
// A typical OpenVPN PKI tarball is 20–150 KB. 10 MB is an extremely generous
// cap that still prevents an agent (or an attacker who has stolen an API token)
// from pushing a 1 GB blob and exhausting DB storage / process memory.
const MAX_BACKUP_BYTES = 10 * 1024 * 1024; // 10 MB

// POST /api/agent/backup — upload PKI backup (agent → panel)
//
// Security hardening:
//  1. Use the shared authenticateAgent helper (no copy-paste drift).
//  2. Enforce a hard size cap on the request body before reading it into memory.
//  3. Reject empty uploads explicitly.
export async function POST(request: NextRequest) {
  try {
    const nodeId = await authenticateAgent(request);
    if (!nodeId) return agentUnauthorized();

    // Enforce Content-Length cap first (cheap, no body read needed).
    const contentLength = request.headers.get('content-length');
    if (contentLength !== null) {
      const declared = parseInt(contentLength, 10);
      if (!Number.isFinite(declared) || declared > MAX_BACKUP_BYTES) {
        return NextResponse.json(
          { error: 'PAYLOAD_TOO_LARGE', message: `Backup must not exceed ${MAX_BACKUP_BYTES} bytes` },
          { status: 413 },
        );
      }
    }

    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Empty backup' },
        { status: 400 },
      );
    }

    // Enforce actual body size even when Content-Length was absent/wrong.
    if (buffer.length > MAX_BACKUP_BYTES) {
      return NextResponse.json(
        { error: 'PAYLOAD_TOO_LARGE', message: `Backup must not exceed ${MAX_BACKUP_BYTES} bytes` },
        { status: 413 },
      );
    }

    // Encrypt at rest (AES-256-GCM).  The PKI contains the CA private key.
    const enc = await encrypt(buffer.toString('base64'));
    await prisma.node.update({
      where: { id: nodeId },
      data: { pkiBackup: Buffer.from(enc, 'utf-8') },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Backup upload error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// GET /api/agent/backup — download PKI backup (panel → agent)
//
// Security hardening: use the shared authenticateAgent helper.
export async function GET(request: NextRequest) {
  try {
    const nodeId = await authenticateAgent(request);
    if (!nodeId) return agentUnauthorized();

    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, pkiBackup: true },
    });

    if (!node) return agentUnauthorized();

    if (!node.pkiBackup) {
      return new NextResponse('No backup found', { status: 404 });
    }

    // Decrypt at-rest backup; fall back to raw bytes for legacy plaintext rows.
    const raw = Buffer.from(node.pkiBackup);
    const s = raw.toString('utf-8');
    const dec = await decrypt(s);
    const out = dec !== null ? Buffer.from(dec, 'base64') : raw;

    return new NextResponse(out, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="backup.tar.gz"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Backup download error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
