import { Worker, Job } from 'bullmq';
import { processClientCreateJob, ClientCreateJobData } from './jobs/client-create';
import { processClientRevokeJob, ClientRevokeJobData } from './jobs/client-revoke';
import { processNodeInstallJob, NodeInstallJobData } from './jobs/node-install';

// Create worker with processors (BullMQ v5 syntax)
const worker = new Worker('ovpn-jobs', async (job: Job) => {
  switch (job.name) {
    case 'client-create':
      return await processClientCreateJob(job as Job<ClientCreateJobData>);
    case 'client-revoke':
      return await processClientRevokeJob(job as Job<ClientRevokeJobData>);
    case 'node-install':
      return await processNodeInstallJob(job as Job<NodeInstallJobData>);
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}, {
  connection: {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
  },
  concurrency: 5,
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log('Worker started');

// Graceful shutdown
const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
