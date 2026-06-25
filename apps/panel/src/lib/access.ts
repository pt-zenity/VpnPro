import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { AuthPayload, FULL_ADMIN_ROLES } from './auth';

/** SUPERADMIN / ADMIN — full access to every node and to admin management. */
export function isFullAdmin(payload: AuthPayload): boolean {
  return FULL_ADMIN_ROLES.includes(payload.role);
}

/**
 * The node ids a user may access. Returns null for a full admin (= all nodes).
 * For a MANAGER it reads the current ManagerNode assignments from the DB (the
 * JWT is never trusted for this — assignments can change within a token's life).
 */
export async function accessibleNodeIds(payload: AuthPayload): Promise<string[] | null> {
  if (isFullAdmin(payload)) return null;
  const rows = await prisma.managerNode.findMany({
    where: { adminId: payload.sub },
    select: { nodeId: true },
  });
  return rows.map((r) => r.nodeId);
}

/** Whether the user may access a specific node. */
export async function canAccessNode(payload: AuthPayload, nodeId: string): Promise<boolean> {
  if (isFullAdmin(payload)) return true;
  const row = await prisma.managerNode.findUnique({
    where: { adminId_nodeId: { adminId: payload.sub, nodeId } },
    select: { id: true },
  });
  return !!row;
}

/**
 * Resolve the node a client belongs to and check access. `exists` distinguishes
 * "client not found" (→ 404) from "found but forbidden" (→ 403).
 */
export async function checkClientAccess(
  payload: AuthPayload,
  clientId: string,
): Promise<{ exists: boolean; allowed: boolean; nodeId?: string }> {
  const client = await prisma.vpnClient.findUnique({
    where: { id: clientId },
    select: { nodeId: true },
  });
  if (!client) return { exists: false, allowed: false };
  const allowed = await canAccessNode(payload, client.nodeId);
  return { exists: true, allowed, nodeId: client.nodeId };
}

/** Standard 403 response for scope violations. */
export function forbidden(message = 'You do not have access to this resource') {
  return NextResponse.json({ error: 'FORBIDDEN', message }, { status: 403 });
}
