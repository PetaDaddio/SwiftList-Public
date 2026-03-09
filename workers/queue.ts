/**
 * BullMQ Queue Configuration
 *
 * Manages job queues for all SwiftList workflows
 * - Uses Redis (provided by Railway.app)
 * - Automatic retries (3 attempts with exponential backoff)
 * - Dead letter queue for failed jobs
 * - Priority queuing for premium users
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { WorkflowJobData } from './base-workflow';
import { WorkflowFactory } from './workflow-factory';
import * as Sentry from '@sentry/node';

// Redis connection configuration (Railway.app provides this)
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false
};

// Main job queue for all workflows
export const jobQueue = new Queue<WorkflowJobData>('swiftlist-jobs', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000 // Start with 5 second delay, doubles each retry
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000 // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600 // Keep failed jobs for 7 days for debugging
    }
  }
});

// Queue events for monitoring
export const queueEvents = new QueueEvents('swiftlist-jobs', {
  connection: redisConnection
});

/**
 * Add a job to the queue
 */
export async function addJob(
  jobData: WorkflowJobData,
  options?: {
    priority?: number; // Lower number = higher priority
    delay?: number; // Delay in milliseconds
  }
): Promise<Job<WorkflowJobData>> {
  return await jobQueue.add(
    `workflow-${jobData.workflow_id}`,
    jobData,
    {
      jobId: jobData.job_id, // Use our UUID as BullMQ job ID
      priority: options?.priority,
      delay: options?.delay
    }
  );
}

/**
 * Main worker that processes all jobs
 */
export function startWorker(): Worker<WorkflowJobData> {
  const worker = new Worker<WorkflowJobData>(
    'swiftlist-jobs',
    async (job: Job<WorkflowJobData>) => {
      console.log(`[Worker] Processing job ${job.data.job_id} (${job.data.workflow_id})`);

      try {
        // Get workflow instance from factory
        const workflow = WorkflowFactory.createWorkflow(job);

        // Execute workflow
        const result = await workflow.run();

        if (result.success) {
          console.log(`[Worker] Job ${job.data.job_id} completed successfully`);
          return result;
        } else {
          console.error(`[Worker] Job ${job.data.job_id} failed:`, result.error);
          throw new Error(result.error);
        }
      } catch (error: any) {
        console.error(`[Worker] Job ${job.data.job_id} error:`, error);

        // Report to Sentry
        Sentry.captureException(error, {
          tags: {
            job_id: job.data.job_id,
            workflow_id: job.data.workflow_id,
            user_id: job.data.user_id
          }
        });

        throw error; // Let BullMQ handle retry logic
      }
    },
    {
      connection: redisConnection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'), // Process 5 jobs concurrently
      limiter: {
        max: 10, // Max 10 jobs per...
        duration: 1000 // ...1 second (rate limiting)
      }
    }
  );

  // Worker event handlers
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error);
  });

  worker.on('error', (error) => {
    console.error('[Worker] Worker error:', error);
    Sentry.captureException(error);
  });

  return worker;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress?: number;
  result?: any;
  error?: string;
}> {
  try {
    const job = await jobQueue.getJob(jobId);

    if (!job) {
      return { status: 'unknown' };
    }

    const state = await job.getState();
    const progress = await job.progress;

    return {
      status: state as any,
      progress: typeof progress === 'number' ? progress : undefined,
      result: job.returnvalue,
      error: job.failedReason
    };
  } catch (error) {
    console.error('Failed to get job status:', error);
    return { status: 'unknown' };
  }
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  try {
    const job = await jobQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to cancel job:', error);
    return false;
  }
}

/**
 * Get queue metrics for monitoring
 */
export async function getQueueMetrics() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    jobQueue.getWaitingCount(),
    jobQueue.getActiveCount(),
    jobQueue.getCompletedCount(),
    jobQueue.getFailedCount(),
    jobQueue.getDelayedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed
  };
}

/**
 * Clean up old jobs (run periodically)
 */
export async function cleanupJobs() {
  // Remove completed jobs older than 24 hours
  await jobQueue.clean(24 * 3600 * 1000, 0, 'completed');

  // Remove failed jobs older than 7 days
  await jobQueue.clean(7 * 24 * 3600 * 1000, 0, 'failed');

  console.log('[Queue] Cleanup completed');
}

// Set up periodic cleanup (run every hour)
if (process.env.NODE_ENV === 'production') {
  setInterval(cleanupJobs, 60 * 60 * 1000);
}
