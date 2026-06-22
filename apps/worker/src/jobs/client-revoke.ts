import { Job } from 'bullmq';
import { prisma } from '@ovpn/db';

export interface ClientRevokeJobData {
  jobId: string;
}

export async function processClientRevokeJob(job: Job<ClientRevokeJobData>) {
  const { jobId } = job.data;

  // Get job record
  const jobRecord = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!jobRecord) {
    throw new Error('Job not found');
  }

  const { clientId } = jobRecord.payload as { clientId: string };

  // Update client status
  await prisma.vpnClient.update({
    where: { id: clientId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  });

  // Expire artifacts
  await prisma.clientArtifact.updateMany({
    where: { clientId },
    data: { expiresAt: new Date() },
  });

  // Update job
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: { revokedAt: new Date().toISOString() },
    },
  });

  return { success: true };
}
