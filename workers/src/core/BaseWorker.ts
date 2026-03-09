/**
 * BaseWorker - Abstract class for all SwiftList image processing workers
 *
 * Provides standardized execution, telemetry, cost tracking, and error handling
 * for high-throughput image processing operations.
 *
 * @abstract
 * @example
 * class BackgroundRemovalWorker extends BaseWorker {
 *   async processJob(job: Job): Promise<WorkerResult> {
 *     // Implementation
 *   }
 * }
 */

import { Job } from 'bullmq';
import { TelemetryService } from './TelemetryService';
import { BillingService } from '../services/BillingService';
import { ValidationService } from '../services/ValidationService';
import { createClient } from '@supabase/supabase-js';

export interface WorkerConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  timeout: number; // milliseconds
}

export interface WorkerResult {
  success: boolean;
  outputUrl?: string;
  metadata?: Record<string, any>;
  costUsd?: number;
  durationMs?: number;
  error?: string;
}

export interface JobData {
  jobId: string;
  userId: string;
  workflowId: string;
  inputUrl: string;
  parameters?: Record<string, any>;
}

export abstract class BaseWorker {
  protected config: WorkerConfig;
  protected telemetry: TelemetryService;
  protected billing: BillingService;
  protected validation: ValidationService;
  protected supabase: ReturnType<typeof createClient>;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.telemetry = new TelemetryService();
    this.billing = new BillingService();
    this.validation = new ValidationService();

    // Initialize Supabase client with service role
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );
  }

  /**
   * Standardized execution wrapper with telemetry and error handling
   *
   * Execution flow:
   * 1. Validate input (image headers, size, type)
   * 2. Update job status to "processing"
   * 3. Execute worker-specific logic (processJob)
   * 4. Track API costs and duration
   * 5. Update job status to "completed" or "failed"
   * 6. Handle errors with auto-refund on failure
   */
  async execute(job: Job<JobData>): Promise<WorkerResult> {
    const startTime = Date.now();
    const { jobId, userId, workflowId, inputUrl, parameters } = job.data;

    // Initialize telemetry
    const telemetryId = await this.telemetry.startJob({
      jobId,
      workflowId,
      workerName: this.config.name,
      startedAt: new Date().toISOString(),
    });

    try {
      console.log(`[${this.config.name}] Starting job ${jobId}`);

      // STEP 1: Input validation (guardrails)
      await this.validateInput(inputUrl);

      // STEP 2: Update job status to "processing"
      await this.updateJobStatus(jobId, 'processing');

      // STEP 3: Execute worker-specific logic (abstract method)
      const result = await this.processJob(job);

      // STEP 4: Calculate duration and cost
      const durationMs = Date.now() - startTime;
      result.durationMs = durationMs;

      // STEP 5: Update billing if cost was incurred
      if (result.costUsd) {
        await this.updateBilling(jobId, userId, workflowId, result.costUsd);
      }

      // STEP 6: Update job status to "completed"
      await this.updateJobStatus(jobId, 'completed', {
        completed_at: new Date().toISOString(),
        output_image_url: result.outputUrl,
        processing_time_seconds: Math.round(durationMs / 1000),
        cost_usd: result.costUsd,
      });

      // STEP 7: Record telemetry success
      await this.telemetry.endJob(telemetryId, {
        status: 'completed',
        durationMs,
        costUsd: result.costUsd,
      });

      console.log(`[${this.config.name}] Completed job ${jobId} in ${durationMs}ms`);

      return {
        ...result,
        success: true,
        durationMs,
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[${this.config.name}] Failed job ${jobId}:`, error);

      // Update job status to "failed"
      await this.updateJobStatus(jobId, 'failed', {
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        processing_time_seconds: Math.round(durationMs / 1000),
      });

      // Auto-refund credits on failure
      await this.refundCredits(jobId, userId);

      // Record telemetry failure
      await this.telemetry.endJob(telemetryId, {
        status: 'failed',
        durationMs,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        durationMs,
      };
    } finally {
      // Cleanup: Free memory, close streams, etc.
      await this.cleanup(job);
    }
  }

  /**
   * Worker-specific processing logic (must be implemented by subclasses)
   *
   * @abstract
   * @param job - BullMQ job with typed data
   * @returns WorkerResult with output URL and cost
   */
  protected abstract processJob(job: Job<JobData>): Promise<WorkerResult>;

  /**
   * Validate input image before processing (guardrail)
   *
   * Checks:
   * - Image is accessible (HTTP 200)
   * - Content-Type is image/* (JPEG, PNG, WebP)
   * - File size is within limits (max 10MB)
   * - Image is not corrupt (valid headers)
   *
   * @throws Error if validation fails
   */
  protected async validateInput(imageUrl: string): Promise<void> {
    try {
      // Fetch image headers (HEAD request to avoid downloading full file)
      const response = await fetch(imageUrl, { method: 'HEAD' });

      if (!response.ok) {
        throw new Error(`Image not accessible: HTTP ${response.status}`);
      }

      // Validate content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}. Expected image/*`);
      }

      // Validate file size (max 10MB)
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        if (sizeMB > 10) {
          throw new Error(`Image too large: ${sizeMB.toFixed(2)}MB. Max 10MB`);
        }
      }

      // Additional validation using ValidationService
      await this.validation.validateImageHeaders(imageUrl);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      throw new Error(`Input validation failed: ${message}`);
    }
  }

  /**
   * Update job status in Supabase database
   *
   * @param jobId - Unique job identifier
   * @param status - Job status (pending, processing, completed, failed)
   * @param updates - Additional fields to update
   */
  protected async updateJobStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    updates: Record<string, any> = {}
  ): Promise<void> {
    const { error } = await (this.supabase
      .from('jobs') as any)
      .update({
        status,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId);

    if (error) {
      console.error(`Failed to update job ${jobId} status:`, error);
      throw new Error(`Database update failed: ${error.message}`);
    }
  }

  /**
   * Update billing records with exact API cost
   *
   * Tracks:
   * - Total cost in USD
   * - Provider used (Replicate, Claude, etc.)
   * - Workflow ID
   * - Timestamp
   *
   * @param jobId - Job identifier
   * @param userId - User identifier
   * @param workflowId - Workflow identifier
   * @param costUsd - Exact cost in USD
   */
  protected async updateBilling(
    jobId: string,
    userId: string,
    workflowId: string,
    costUsd: number
  ): Promise<void> {
    await this.billing.recordCost({
      jobId,
      userId,
      workflowId,
      workerName: this.config.name,
      costUsd,
      timestamp: new Date().toISOString(),
    });

    // Also store in job_events table for analytics (non-fatal if table doesn't exist yet)
    try {
      await this.supabase.from('job_events').insert({
        job_id: jobId,
        event_type: 'api_cost',
        workflow_id: workflowId,
        metadata: {
          worker: this.config.name,
          cost_usd: costUsd,
        },
      } as any);
    } catch {
      // Non-fatal: job_events table may not exist yet
    }
  }

  /**
   * Auto-refund credits on job failure
   *
   * Calls the refund_credits() Postgres function which:
   * - Returns credits to user's balance
   * - Creates credit_transactions record
   * - Updates job record
   *
   * @param jobId - Job identifier
   * @param userId - User identifier
   */
  protected async refundCredits(jobId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('refund_credits', {
        p_user_id: userId,
        p_job_id: jobId,
      } as any);

      if (error) {
        console.error(`Failed to refund credits for job ${jobId}:`, error);
      } else {
        console.log(`[${this.config.name}] Refunded credits for job ${jobId}`);
      }
    } catch (error) {
      console.error(`Exception during credit refund for job ${jobId}:`, error);
    }
  }

  /**
   * Cleanup resources after job execution
   *
   * Override this method to:
   * - Close file streams
   * - Delete temporary files
   * - Free memory buffers
   * - Clean up Railway volumes
   *
   * @param job - BullMQ job
   */
  protected async cleanup(job: Job<JobData>): Promise<void> {
    // Default: no-op
    // Subclasses can override to implement specific cleanup
  }

  /**
   * Get worker configuration
   *
   * @returns Worker configuration object
   */
  public getConfig(): WorkerConfig {
    return this.config;
  }
}
