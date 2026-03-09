/**
 * Base Workflow Worker Class
 *
 * All workflow workers extend this class to inherit:
 * - Progress tracking (0%, 25%, 50%, 75%, 100%)
 * - Error handling with automatic retries
 * - Credit refunds on failure
 * - Supabase integration
 * - Sentry error tracking
 */

import { Job } from 'bullmq';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';

export interface WorkflowJobData {
  job_id: string;
  user_id: string;
  workflow_id: string;
  input_data: Record<string, any>;
  credits_charged: number;
}

export interface WorkflowResult {
  success: boolean;
  output_data?: Record<string, any>;
  error?: string;
}

export abstract class BaseWorkflow {
  protected supabase: SupabaseClient;
  protected jobData: WorkflowJobData;
  protected bullmqJob: Job;

  constructor(job: Job<WorkflowJobData>) {
    this.bullmqJob = job;
    this.jobData = job.data;

    // Initialize Supabase client with service role key
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role bypasses RLS
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  /**
   * Main execution method - must be implemented by each workflow
   */
  abstract execute(): Promise<WorkflowResult>;

  /**
   * Run the workflow with automatic progress tracking and error handling
   */
  async run(): Promise<WorkflowResult> {
    try {
      // Start: 0% progress
      await this.updateProgress(0, 'Initializing workflow');

      // Pre-execution validation
      await this.updateProgress(25, 'Validating inputs');
      await this.validateInputs();

      // Execute the workflow logic
      await this.updateProgress(50, 'Processing workflow');
      const result = await this.execute();

      if (result.success) {
        // Success: 100% progress
        await this.updateProgress(100, 'Workflow completed');
        await this.markJobCompleted(result.output_data || {});
        return result;
      } else {
        // Failure: Handle error
        await this.handleFailure(result.error || 'Unknown error');
        return result;
      }
    } catch (error: any) {
      // Unexpected error
      console.error(`Workflow ${this.jobData.workflow_id} error:`, error);
      await this.handleFailure(error.message || 'Unexpected error');

      // Report to Sentry
      Sentry.captureException(error, {
        tags: {
          workflow_id: this.jobData.workflow_id,
          job_id: this.jobData.job_id,
          user_id: this.jobData.user_id
        }
      });

      return {
        success: false,
        error: error.message || 'Unexpected error'
      };
    }
  }

  /**
   * Update job progress in database (triggers Supabase Realtime update)
   */
  protected async updateProgress(percent: number, message: string): Promise<void> {
    try {
      await this.supabase
        .from('jobs')
        .update({
          progress_percent: percent,
          progress_message: message,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', this.jobData.job_id);

      // Also update BullMQ job progress for dashboard monitoring
      await this.bullmqJob.updateProgress(percent);
    } catch (error) {
      console.error('Failed to update progress:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Validate input data - can be overridden by specific workflows
   */
  protected async validateInputs(): Promise<void> {
    if (!this.jobData.input_data) {
      throw new Error('Missing input data');
    }
  }

  /**
   * Mark job as completed in database
   */
  protected async markJobCompleted(outputData: Record<string, any>): Promise<void> {
    await this.supabase
      .from('jobs')
      .update({
        status: 'completed',
        output_data: outputData,
        progress_percent: 100,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('job_id', this.jobData.job_id);
  }

  /**
   * Handle workflow failure with automatic credit refund
   */
  protected async handleFailure(errorMessage: string): Promise<void> {
    // Update job status to failed
    await this.supabase
      .from('jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('job_id', this.jobData.job_id);

    // Refund credits (Credit Lifeguard)
    const { error: refundError } = await this.supabase.rpc('refund_credits', {
      p_user_id: this.jobData.user_id,
      p_job_id: this.jobData.job_id
    });

    if (refundError) {
      console.error('Credit refund failed:', refundError);
      // Alert monitoring system
      Sentry.captureException(new Error('Credit refund failed'), {
        tags: {
          job_id: this.jobData.job_id,
          user_id: this.jobData.user_id
        },
        extra: {
          error: refundError
        }
      });
    }
  }

  /**
   * Helper: Download image from URL
   */
  protected async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Helper: Upload file to Supabase Storage
   */
  protected async uploadToStorage(
    buffer: Buffer,
    path: string,
    contentType: string
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('job-outputs')
      .upload(path, buffer, {
        contentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload to storage: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from('job-outputs')
      .getPublicUrl(path);

    return urlData.publicUrl;
  }

  /**
   * Helper: Call external API with retry logic
   */
  protected async callAPI(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        // If rate limited, wait and retry
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '5');
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        return response;
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('API call failed');
  }
}
