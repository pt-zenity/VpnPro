import { Job } from 'bullmq';
import { prisma } from '@ovpn/db';
import { callAgentApi } from '@/lib/agent';

export interface NodeInstallJobData {
  jobId: string;
}

export async function processNodeInstallJob(job: Job<NodeInstallJobData>) {
  const { jobId } = job.data;

  // Get job record
  const jobRecord = await prisma.job.findUnique({
    where: { id: jobId },
    include: { node: true },
  });

  if (!jobRecord) {
    throw new Error('Job not found');
  }

  const { serverHost, port, protocol } = jobRecord.payload as {
    serverHost?: string;
    port?: number;
    protocol?: string;
  };
  const node = jobRecord.node;

  if (node.status !== 'PROVISIONING') {
    throw new Error('Node is not in provisioning state');
  }

  // For MVP: Mark as installed (in production, agent would actually install)
  // The install script would be triggered on the agent side
  // For now, we simulate completion
  throw new Error('NODE_INSTALL jobs should be processed by the Agent, not the Worker.');
}
