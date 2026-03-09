/**
 * SwiftList Workers Entry Point
 *
 * Starts BullMQ workers to process all 27 workflows
 * - Initializes Sentry for error tracking
 * - Starts worker processes
 * - Sets up health check endpoint
 * - Handles graceful shutdown
 */

import express from 'express';
import * as Sentry from '@sentry/node';
import { startWorker, queueEvents, getQueueMetrics } from './queue';
import { lifeguard } from './lifeguard';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  integrations: [
    // Add BullMQ integration
    new Sentry.Integrations.OnUncaughtException(),
    new Sentry.Integrations.OnUnhandledRejection()
  ]
});

console.log('🚀 Starting SwiftList Workers...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log(`Concurrency: ${process.env.WORKER_CONCURRENCY || 5}`);

// Start BullMQ worker
const worker = startWorker();

// Start Lifeguard monitoring
if (process.env.NODE_ENV === 'production') {
	lifeguard.startMonitoring();
	console.log('🛟 Lifeguard monitoring started');
}

// Health check server for Railway
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', async (req, res) => {
  try {
    const metrics = await getQueueMetrics();
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queue: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    const metrics = await getQueueMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Health check server listening on port ${PORT}`);
  console.log(`   GET /health - Health check`);
  console.log(`   GET /metrics - Queue metrics`);
});

// Queue event listeners
queueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`📊 Job ${jobId} progress: ${data}%`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Close worker (waits for active jobs to complete)
  console.log('Closing worker...');
  await worker.close();

  // Close queue events
  console.log('Closing queue events...');
  await queueEvents.close();

  console.log('✅ Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  Sentry.captureException(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  Sentry.captureException(reason);
  process.exit(1);
});

console.log('✅ Workers started successfully');
console.log('   Waiting for jobs...');
