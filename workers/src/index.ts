/**
 * SwiftList Core Engine - Main Entry Point
 *
 * Initializes all BullMQ workers and starts processing jobs.
 *
 * Workers initialized:
 * - BackgroundRemovalWorker (WF-04)
 * - More workers added in future phases
 *
 * Usage:
 *   npm run build && npm start
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { BackgroundRemovalWorker } from './workers/BackgroundRemovalWorker';
import { WorkflowOrchestrator } from './core/WorkflowOrchestrator';
import { ResilienceStrategy } from './core/ResilienceStrategy';

// Environment validation
const requiredEnvVars = [
  'REPLICATE_API_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Redis: require either REDIS_URL or REDIS_HOST
if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
  console.error('Missing Redis config: set REDIS_URL or REDIS_HOST');
  process.exit(1);
}

console.log('Starting SwiftList Core Engine...');

// Health check endpoint (start FIRST so Railway can probe during startup)
import { createServer } from 'http';

let redisStatus = 'connecting';
const workers: Worker[] = [];

const port = parseInt(process.env.PORT || '3000');
const healthServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      workers: workers.length,
      redis: redisStatus,
      uptime: process.uptime(),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(port, () => {
  console.log(`Health check server running on port ${port}`);
});

// Initialize Redis connection (support REDIS_URL from Railway or individual vars)
const redisUrl = process.env.REDIS_URL;
const redis = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
  : new Redis({
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

redis.on('connect', () => {
  redisStatus = 'ready';
  console.log('Redis connected');
});

redis.on('error', (err) => {
  redisStatus = 'error';
  console.error('Redis connection error:', err.message);
});

// Initialize orchestrator
const orchestrator = new WorkflowOrchestrator();

// Initialize resilience strategy
const resilience = new ResilienceStrategy();

// ===== WORKER 1: Background Removal (WF-04) =====
const backgroundRemovalWorker = new BackgroundRemovalWorker();
const bgRemovalWorker = new Worker(
  'background-removal',
  async (job) => {
    return await backgroundRemovalWorker.execute(job);
  },
  {
    connection: redis,
    concurrency: backgroundRemovalWorker.getConfig().concurrency,
  }
);

bgRemovalWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

bgRemovalWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

bgRemovalWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

workers.push(bgRemovalWorker);

console.log('BackgroundRemovalWorker registered');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');

  // Close health server
  healthServer.close();

  // Close all workers
  for (const worker of workers) {
    await worker.close();
  }

  // Close orchestrator
  await orchestrator.shutdown();

  // Close resilience
  await resilience.shutdown();

  // Close Redis
  await redis.quit();

  console.log('Shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  process.kill(process.pid, 'SIGTERM');
});

console.log('SwiftList Core Engine started successfully');
console.log(`Workers active: ${workers.length}`);
console.log('Ready to process jobs');
