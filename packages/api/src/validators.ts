import { z } from 'zod';

// ============================================================================
// Common Validators
// ============================================================================

const nodeNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(64, 'Name too long')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Name may contain only letters, numbers, dots, underscores, hyphens');

const clientNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(64, 'Name too long')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Name may contain only letters, numbers, dots, underscores, hyphens');

const hostSchema = z
  .string()
  .min(1, 'Host is required')
  .max(253, 'Host too long')
  .refine(
    (v) => {
      // IP or domain
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      return ipRegex.test(v) || domainRegex.test(v);
    },
    'Invalid host (IP or domain expected',
  );

const nodeIdSchema = z.string().cuid();

// ============================================================================
// Auth Validators
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// Node Validators
// ============================================================================

export const createNodeSchema = z.object({
  name: nodeNameSchema,
  host: hostSchema,
  port: z.number().int().min(1).max(65535).optional().default(22),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateNodeInput = z.infer<typeof createNodeSchema>;

export const updateNodeSchema = z.object({
  name: nodeNameSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;

export const installNodeSchema = z.object({
  serverHost: hostSchema.optional(),
  port: z.number().int().min(1).max(65535).optional().default(443),
  protocol: z.enum(['udp', 'tcp']).optional().default('udp'),
  firstUser: clientNameSchema.optional(),
  useXor: z.boolean().optional().default(true),
  domain: z.string().optional(),
  dnsMode: z.enum(['standard', 'empty', 'custom']).optional().default('standard'),
  customDns: z.string().optional(),
  mtu: z.number().int().min(500).max(9000).optional().default(1500),
  mssfix: z.number().int().min(500).max(9000).optional().default(1360),
});

export type InstallNodeInput = z.infer<typeof installNodeSchema>;

// ============================================================================
// Client Validators
// ============================================================================

export const createClientSchema = z.object({
  name: clientNameSchema,
  expiresIn: z.number().int().min(1).max(3650).optional(), // days
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

// ============================================================================
// Agent Validators
// ============================================================================

export const agentRegisterSchema = z.object({
  token: z.string().min(32),
  agentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  systemInfo: z.object({
    os: z.string(),
    kernel: z.string(),
    arch: z.string(),
  }),
});

export type AgentRegisterInput = z.infer<typeof agentRegisterSchema>;

export const agentHeartbeatSchema = z.object({
  nodeId: nodeIdSchema,
  status: z.enum(['INSTALLING', 'RUNNING', 'STOPPED', 'ERROR']),
  details: z
    .object({
      connectedClients: z.number().int().min(0).optional(),
      cpu: z.number().min(0).max(100).optional(),
      memory: z.number().min(0).optional(),
      disk: z.number().min(0).max(100).optional(),
      uptime: z.number().int().min(0).optional(),
    })
    .optional(),
});

export type AgentHeartbeatInput = z.infer<typeof agentHeartbeatSchema>;

export const agentCreateClientSchema = z.object({
  nodeId: nodeIdSchema,
  clientName: clientNameSchema,
});

export type AgentCreateClientInput = z.infer<typeof agentCreateClientSchema>;

export const agentRevokeClientSchema = z.object({
  nodeId: nodeIdSchema,
  clientName: clientNameSchema,
});

export type AgentRevokeClientInput = z.infer<typeof agentRevokeClientSchema>;

// ============================================================================
// Job Validators
// ============================================================================

export const listJobsSchema = z.object({
  nodeId: nodeIdSchema.optional(),
  type: z.enum(['NODE_INSTALL', 'CLIENT_CREATE', 'CLIENT_REVOKE', 'NODE_SYNC', 'HEALTH_CHECK']).optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListJobsInput = z.infer<typeof listJobsSchema>;

// ============================================================================
// Audit Log Validators
// ============================================================================

export const listAuditLogsSchema = z.object({
  adminId: z.string().cuid().optional(),
  nodeId: nodeIdSchema.optional(),
  clientId: z.string().cuid().optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
