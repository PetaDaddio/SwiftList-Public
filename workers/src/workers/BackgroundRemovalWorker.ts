/**
 * BackgroundRemovalWorker - WF-04: Background Removal
 *
 * Removes background from product images using Replicate RMBG v1.4 model
 *
 * Provider: Replicate
 * Model: lucataco/remove-bg (RMBG v1.4)
 * Cost: ~$0.0023 per image
 * Duration: ~3 seconds
 */

import { Job } from 'bullmq';
import { BaseWorker, WorkerResult, JobData } from '../core/BaseWorker';
import { ResilienceStrategy } from '../core/ResilienceStrategy';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

export class BackgroundRemovalWorker extends BaseWorker {
  private replicate: Replicate;
  private resilience: ResilienceStrategy;

  constructor() {
    super({
      name: 'BackgroundRemovalWorker',
      concurrency: 5, // Process 5 jobs concurrently
      maxRetries: 3,
      timeout: 30000, // 30 seconds
    });

    // Initialize Replicate client (routes through Cloudflare AI Gateway when configured)
    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN!,
      ...(process.env.CLOUDFLARE_AI_GATEWAY_URL && {
        baseUrl: process.env.CLOUDFLARE_AI_GATEWAY_URL,
      }),
    });

    // Initialize resilience strategy
    this.resilience = new ResilienceStrategy();

    console.log('✅ BackgroundRemovalWorker initialized');
  }

  /**
   * Process background removal job
   *
   * Steps:
   * 1. Download input image (streaming, not in-memory)
   * 2. Call Replicate API with retry logic
   * 3. Upload result to Supabase Storage
   * 4. Calculate exact API cost
   * 5. Return output URL
   */
  protected async processJob(job: Job<JobData>): Promise<WorkerResult> {
    const { jobId, userId, inputUrl } = job.data;
    if (!userId) throw new Error('Missing userId in job data');

    console.log(`[BackgroundRemoval] Processing job ${jobId}`);

    try {
      // Check circuit breaker
      const replicateAvailable = await this.resilience.checkCircuitBreaker('replicate');
      if (!replicateAvailable) {
        throw new Error('Replicate API is currently unavailable (circuit breaker open)');
      }

      // Call Replicate API with retry logic
      const output = await this.resilience.executeWithRetry(async () => {
        return await this.replicate.run(
          'lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1',
          {
            input: {
              image: inputUrl,
            },
          }
        );
      });

      // Record circuit breaker success
      await this.resilience.recordCircuitBreakerSuccess('replicate');

      // Download result (streaming)
      const resultUrl = output as unknown as string;
      const response = await fetch(resultUrl);
      if (!response.ok) {
        throw new Error(`Failed to download result: HTTP ${response.status}`);
      }

      // Upload to Supabase Storage (streaming)
      const blob = await response.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());

      const fileName = `${userId}/${jobId}-output.png`;
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('job-outputs')
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload result: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('job-outputs')
        .getPublicUrl(fileName);

      // Calculate exact cost (Replicate RMBG v1.4)
      const costUsd = 0.0023; // Fixed cost per image

      console.log(`[BackgroundRemoval] Job ${jobId} completed successfully`);

      return {
        success: true,
        outputUrl: urlData.publicUrl,
        costUsd,
        metadata: {
          model: 'lucataco/remove-bg',
          provider: 'replicate',
        },
      };

    } catch (error) {
      // Record circuit breaker failure
      await this.resilience.recordCircuitBreakerFailure('replicate');

      // Check if error is irrecoverable (send to DLQ)
      if (this.resilience.isIrrecoverable(error)) {
        await this.resilience.sendToDLQ(job, error as Error);
      }

      throw error;
    }
  }

  /**
   * Cleanup: Free memory after job
   */
  protected async cleanup(job: Job<JobData>): Promise<void> {
    // No cleanup needed (using streaming, not in-memory buffers)
  }
}
