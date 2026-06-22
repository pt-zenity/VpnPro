import { Job } from 'bullmq';
import { prisma } from '@ovpn/db';
import { callAgentApi } from '@/lib/agent';

export interface ClientCreateJobData {
  jobId: string;
}

export async function processClientCreateJob(job: Job<ClientCreateJobData>) {
  const { jobId } = job.data;

  // Get job record
  const jobRecord = await prisma.job.findUnique({
    where: { id: jobId },
    include: { node: true },
  });

  if (!jobRecord) {
    throw new Error('Job not found');
  }

  const { clientId, clientName } = jobRecord.payload as { clientId: string; clientName: string };
  const node = jobRecord.node;

  if (node.status !== 'HEALTHY') {
    throw new Error('Node is not healthy');
  }

  // For MVP: Generate a mock .ovpn file
  const ovpnTemplate = `client
dev tun
proto udp

remote ${node.host} 443

resolv-retry infinite
nobind

persist-key
persist-tun

remote-cert-tls server

data-ciphers AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305
data-ciphers-fallback AES-256-GCM
auth SHA256

scramble xormask ${node.xorMask || 'defaultmask'}

verb 3

<ca>
-----BEGIN CERTIFICATE-----
MOCK_CA_CERTIFICATE_REPLACE_WITH_ACTUAL
-----END CERTIFICATE-----
</ca>

<cert>
-----BEGIN CERTIFICATE-----
MOCK_CLIENT_CERTIFICATE_REPLACE_WITH_ACTUAL
-----END CERTIFICATE-----
</cert>

<key>
-----BEGIN PRIVATE KEY-----
MOOCK_CLIENT_PRIVATE_KEY_REPLACE_WITH_ACTUAL
-----END PRIVATE KEY-----
</key>

<tls-crypt>
MOCK_TLS_CRYPT_KEY_REPLACE_WITH_ACTUAL
</tls-crypt>
`;

  // Store artifact
  await prisma.clientArtifact.create({
    data: {
      clientId,
      nodeId: node.id,
      artifactType: 'OVPN',
      storagePath: ovpnTemplate,
      contentHash: Array.from({ length: 32 }, () =>
        '0123456789abcdef'[Math.floor(Math.random() * 16)]
      ).join(''),
      sizeBytes: ovpnTemplate.length,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Update job result
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: { success: true, clientName },
    },
  });

  return { success: true, clientName };
}
