import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const jobQueue = new Queue('ovpn-jobs', {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000, age: 7 * 24 * 3600 }, // Keep last 1000 jobs for 7 days
    removeOnFail: { count: 5000, age: 30 * 24 * 3600 }, // Keep failed jobs for 30 days
  },
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await jobQueue.close();
  await connection.quit();
});

process.on('SIGINT', async () => {
  await jobQueue.close();
  await connection.quit();
});
