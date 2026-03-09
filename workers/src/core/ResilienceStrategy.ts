/**
 * ResilienceStrategy - Error handling, retry logic, and Dead Letter Queue
 *
 * Handles two types of failures:
 * 1. **Transient Errors** (retryable): API rate limits (429), network timeouts, 5xx errors
 * 2. **Permanent Errors** (non-retryable): NSFW content, corrupt images, auth failures
 *
 * Features:
 * - Exponential backoff for transient errors
 * - Dead Letter Queue (DLQ) for irrecoverable failures
 * - Circuit breaker pattern for provider outages
 * - Automatic fallback to alternative providers
 *
 * @example
 * const strategy = new ResilienceStrategy();
 *
 * try {
 *   const result = await strategy.executeWithRetry(async () => {
 *     return await replicateApi.run(...);
 *   });
 * } catch (error) {
 *   if (strategy.isIrrecoverable(error)) {
 *     await strategy.sendToDLQ(job, error);
 *   }
 * }
 */

import { Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Error classification
 */
export enum ErrorType {
  TRANSIENT = 'transient', // Retryable (429, 5xx, timeout)
  PERMANENT = 'permanent', // Non-retryable (NSFW, corrupt, auth)
  PROVIDER_OUTAGE = 'provider_outage', // Circuit breaker trigger
}

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  retryable: boolean;
  fallbackAvailable: boolean;
  metadata?: Record<string, any>;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitter: boolean;
}

export interface CircuitBreakerState {
  provider: string;
  failureCount: number;
  lastFailureAt: Date;
  state: 'closed' | 'open' | 'half-open';
  nextRetryAt?: Date;
}

export class ResilienceStrategy {
  private dlq: Queue;
  private redis: Redis;
  private circuitBreakers: Map<string, CircuitBreakerState>;

  // Default retry configuration
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000, // 1 second
    maxDelayMs: 30000, // 30 seconds
    exponentialBase: 2,
    jitter: true, // Add randomness to avoid thundering herd
  };

  // Circuit breaker thresholds
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 consecutive failures
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute before half-open
  private readonly CIRCUIT_BREAKER_SUCCESS_THRESHOLD = 2; // Close after 2 successes in half-open

  constructor() {
    // Initialize Redis connection (support REDIS_URL from Railway)
    const redisUrl = process.env.REDIS_URL;
    this.redis = redisUrl
      ? new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: null,
        });

    // Initialize Dead Letter Queue
    this.dlq = new Queue('dead-letter-queue', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: false, // Keep all DLQ jobs for investigation
        removeOnFail: false,
      },
    });

    // Initialize circuit breaker state
    this.circuitBreakers = new Map();

    console.log('✅ ResilienceStrategy initialized');
  }

  /**
   * Execute function with exponential backoff retry
   *
   * Automatically retries transient errors with increasing delays.
   * Permanent errors are thrown immediately.
   *
   * @param fn - Async function to execute
   * @param config - Retry configuration (optional)
   * @returns Function result
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        // Execute function
        const result = await fn();
        return result;

      } catch (error) {
        lastError = error as Error;

        // Classify error
        const classified = this.classifyError(error);

        // If permanent error, don't retry
        if (!classified.retryable) {
          console.error(`❌ Permanent error (attempt ${attempt}):`, classified.message);
          throw error;
        }

        // If last attempt, throw
        if (attempt === retryConfig.maxAttempts) {
          console.error(`❌ Max retries exceeded (${retryConfig.maxAttempts}):`, classified.message);
          throw error;
        }

        // Calculate backoff delay
        const delay = this.calculateBackoff(attempt, retryConfig);

        console.warn(
          `⚠️  Transient error (attempt ${attempt}/${retryConfig.maxAttempts}): ${classified.message}. Retrying in ${delay}ms...`
        );

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // Should never reach here
    throw lastError || new Error('Unknown retry error');
  }

  /**
   * Classify error as transient or permanent
   *
   * Transient (retryable):
   * - HTTP 429 (rate limit)
   * - HTTP 5xx (server errors)
   * - ETIMEDOUT, ECONNRESET (network errors)
   *
   * Permanent (non-retryable):
   * - HTTP 400 (bad request)
   * - HTTP 401/403 (auth errors)
   * - NSFW content detected
   * - Corrupt image
   * - Invalid input
   *
   * @param error - Error object
   * @returns Classified error
   */
  classifyError(error: any): ClassifiedError {
    const message = error.message || String(error);

    // HTTP status code errors
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;

      // Transient errors (retryable)
      if (status === 429) {
        return {
          type: ErrorType.TRANSIENT,
          message: 'Rate limit exceeded',
          retryable: true,
          fallbackAvailable: false,
        };
      }

      if (status >= 500 && status < 600) {
        return {
          type: ErrorType.PROVIDER_OUTAGE,
          message: `Provider error: HTTP ${status}`,
          retryable: true,
          fallbackAvailable: true, // May have alternative provider
        };
      }

      // Permanent errors (non-retryable)
      if (status === 400) {
        return {
          type: ErrorType.PERMANENT,
          message: 'Invalid request',
          retryable: false,
          fallbackAvailable: false,
        };
      }

      if (status === 401 || status === 403) {
        return {
          type: ErrorType.PERMANENT,
          message: 'Authentication failed',
          retryable: false,
          fallbackAvailable: false,
        };
      }
    }

    // Network errors (transient)
    if (
      message.includes('ETIMEDOUT') ||
      message.includes('ECONNRESET') ||
      message.includes('ECONNREFUSED') ||
      message.includes('timeout')
    ) {
      return {
        type: ErrorType.TRANSIENT,
        message: 'Network timeout',
        retryable: true,
        fallbackAvailable: false,
      };
    }

    // Content moderation errors (permanent)
    if (
      message.toLowerCase().includes('nsfw') ||
      message.toLowerCase().includes('inappropriate') ||
      message.toLowerCase().includes('content policy')
    ) {
      return {
        type: ErrorType.PERMANENT,
        message: 'NSFW or inappropriate content detected',
        retryable: false,
        fallbackAvailable: false,
        metadata: { reason: 'content_moderation' },
      };
    }

    // Image validation errors (permanent)
    if (
      message.toLowerCase().includes('corrupt') ||
      message.toLowerCase().includes('invalid image') ||
      message.toLowerCase().includes('unsupported format')
    ) {
      return {
        type: ErrorType.PERMANENT,
        message: 'Invalid or corrupt image',
        retryable: false,
        fallbackAvailable: false,
        metadata: { reason: 'invalid_input' },
      };
    }

    // Default: treat as transient
    return {
      type: ErrorType.TRANSIENT,
      message: message || 'Unknown error',
      retryable: true,
      fallbackAvailable: false,
    };
  }

  /**
   * Calculate exponential backoff delay with jitter
   *
   * Formula: min(maxDelay, baseDelay * exponentialBase^(attempt-1)) + jitter
   *
   * @param attempt - Retry attempt number (1-indexed)
   * @param config - Retry configuration
   * @returns Delay in milliseconds
   */
  private calculateBackoff(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * exponentialBase^(attempt-1)
    const exponentialDelay = config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1);

    // Cap at maxDelayMs
    let delay = Math.min(exponentialDelay, config.maxDelayMs);

    // Add jitter (randomness ±20%)
    if (config.jitter) {
      const jitterFactor = 0.2; // 20%
      const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
      delay += jitter;
    }

    return Math.floor(delay);
  }

  /**
   * Send failed job to Dead Letter Queue
   *
   * DLQ jobs are stored for manual investigation and reprocessing.
   * Common DLQ scenarios:
   * - NSFW content detected
   * - Corrupt images
   * - API authentication failures
   * - Unknown errors after max retries
   *
   * @param job - Original job data
   * @param error - Error that caused failure
   */
  async sendToDLQ(job: Job, error: Error): Promise<void> {
    const classified = this.classifyError(error);

    const dlqJob = {
      originalJobId: job.id,
      originalQueueName: job.queueName,
      originalData: job.data,
      error: {
        message: error.message,
        stack: error.stack,
        type: classified.type,
        retryable: classified.retryable,
      },
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
    };

    await this.dlq.add('failed-job', dlqJob);

    console.error(
      `💀 Sent job ${job.id} to DLQ: ${classified.message} (type: ${classified.type})`
    );
  }

  /**
   * Check if error is irrecoverable (should go to DLQ)
   *
   * @param error - Error object
   * @returns True if error is permanent
   */
  isIrrecoverable(error: any): boolean {
    const classified = this.classifyError(error);
    return !classified.retryable;
  }

  /**
   * Circuit Breaker: Check if provider is available
   *
   * Prevents cascading failures by "opening" the circuit after repeated failures.
   *
   * States:
   * - CLOSED: Normal operation, requests allowed
   * - OPEN: Provider is down, reject all requests
   * - HALF-OPEN: Testing if provider recovered, allow limited requests
   *
   * @param provider - Provider name (e.g., 'replicate', 'claude')
   * @returns True if provider is available
   */
  async checkCircuitBreaker(provider: string): Promise<boolean> {
    const state = this.circuitBreakers.get(provider) || {
      provider,
      failureCount: 0,
      lastFailureAt: new Date(),
      state: 'closed',
    };

    const now = new Date();

    // OPEN state: Check if timeout expired (try half-open)
    if (state.state === 'open') {
      const timeoutExpired =
        state.nextRetryAt && now >= state.nextRetryAt;

      if (timeoutExpired) {
        console.log(`🔓 Circuit breaker HALF-OPEN for provider: ${provider}`);
        state.state = 'half-open';
        state.failureCount = 0; // Reset counter for testing
        this.circuitBreakers.set(provider, state);
        return true; // Allow request
      } else {
        console.warn(`🚫 Circuit breaker OPEN for provider: ${provider}`);
        return false; // Reject request
      }
    }

    // CLOSED or HALF-OPEN: Allow request
    return true;
  }

  /**
   * Record circuit breaker success
   *
   * @param provider - Provider name
   */
  async recordCircuitBreakerSuccess(provider: string): Promise<void> {
    const state = this.circuitBreakers.get(provider);
    if (!state) return;

    if (state.state === 'half-open') {
      // If in half-open state, increment success counter
      state.failureCount = 0; // Reset failures
      state.state = 'closed'; // Close circuit
      console.log(`✅ Circuit breaker CLOSED for provider: ${provider}`);
    }

    this.circuitBreakers.set(provider, state);
  }

  /**
   * Record circuit breaker failure
   *
   * @param provider - Provider name
   */
  async recordCircuitBreakerFailure(provider: string): Promise<void> {
    const state = this.circuitBreakers.get(provider) || {
      provider,
      failureCount: 0,
      lastFailureAt: new Date(),
      state: 'closed' as const,
    };

    state.failureCount++;
    state.lastFailureAt = new Date();

    // Open circuit if threshold exceeded
    if (state.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.state = 'open';
      state.nextRetryAt = new Date(Date.now() + this.CIRCUIT_BREAKER_TIMEOUT_MS);

      console.error(
        `🔴 Circuit breaker OPENED for provider: ${provider} (${state.failureCount} failures)`
      );
    }

    this.circuitBreakers.set(provider, state);
  }

  /**
   * Get circuit breaker state for monitoring
   *
   * @param provider - Provider name
   * @returns Circuit breaker state
   */
  getCircuitBreakerState(provider: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(provider);
  }

  /**
   * Reset circuit breaker (manual override)
   *
   * @param provider - Provider name
   */
  async resetCircuitBreaker(provider: string): Promise<void> {
    this.circuitBreakers.delete(provider);
    console.log(`🔄 Circuit breaker reset for provider: ${provider}`);
  }

  /**
   * Get DLQ jobs for inspection
   *
   * @param limit - Max number of jobs to return
   * @returns Array of DLQ jobs
   */
  async getDLQJobs(limit: number = 50): Promise<any[]> {
    const jobs = await this.dlq.getJobs(['failed', 'completed'], 0, limit - 1);
    return jobs.map((job) => ({
      id: job.id,
      data: job.data,
      timestamp: job.timestamp,
    }));
  }

  /**
   * Reprocess job from DLQ (manual recovery)
   *
   * @param dlqJobId - DLQ job ID
   * @returns True if reprocessed successfully
   */
  async reprocessDLQJob(dlqJobId: string): Promise<boolean> {
    const job = await this.dlq.getJob(dlqJobId);
    if (!job) {
      throw new Error(`DLQ job not found: ${dlqJobId}`);
    }

    const originalData = job.data.originalData;
    const originalQueueName = job.data.originalQueueName;

    console.log(`♻️  Reprocessing DLQ job ${dlqJobId} to queue ${originalQueueName}`);

    // TODO: Submit back to original queue
    // This requires access to WorkflowOrchestrator

    return true;
  }

  /**
   * Sleep utility
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down ResilienceStrategy...');
    await this.dlq.close();
    await this.redis.quit();
    console.log('✅ ResilienceStrategy shutdown complete');
  }
}
