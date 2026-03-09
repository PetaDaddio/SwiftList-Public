/**
 * SwiftList Rate Limiter Utility
 * Tracks and enforces API rate limits to prevent 429 errors
 *
 * Known API Rate Limits:
 * - Replicate: 50 requests/minute
 * - Anthropic: 60 requests/minute
 * - Google Vertex AI: 120 requests/minute
 * - Runway: 30 requests/minute
 * - ElevenLabs: 40 requests/minute
 */

import { infraLogger } from '$lib/utils/logger';

const log = infraLogger.child({ component: 'rate-limiter' });

export interface RateLimitConfig {
  maxRequests: number;      // Max requests per window
  windowMs: number;          // Time window in milliseconds
  queueOnLimit?: boolean;    // Queue requests when at limit
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // Seconds to wait if not allowed
}

/**
 * Token bucket rate limiter implementation
 */
class RateLimiter {
  private service: string;
  private config: Required<RateLimitConfig>;
  private tokens: number;
  private lastRefill: number;
  private requestTimestamps: number[] = [];

  constructor(service: string, config: RateLimitConfig) {
    this.service = service;
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      queueOnLimit: config.queueOnLimit ?? true
    };
    this.tokens = config.maxRequests;
    this.lastRefill = Date.now();
  }

  /**
   * Check if request can proceed
   */
  async checkLimit(): Promise<RateLimitStatus> {
    this.refillTokens();
    this.cleanOldTimestamps();

    const now = Date.now();
    const recentRequests = this.requestTimestamps.length;
    const remaining = this.config.maxRequests - recentRequests;

    if (recentRequests >= this.config.maxRequests) {
      // At rate limit
      const oldestRequest = this.requestTimestamps[0];
      const resetAt = oldestRequest + this.config.windowMs;
      const retryAfter = Math.ceil((resetAt - now) / 1000);

      log.warn({ service: this.service, retryAfterSec: retryAfter }, 'Rate limit hit');

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter
      };
    }

    // Under limit - allow request
    return {
      allowed: true,
      remaining,
      resetAt: now + this.config.windowMs
    };
  }

  /**
   * Record a request
   */
  async recordRequest(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps.push(now);
    this.tokens--;

  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(): void {
    const now = Date.now();
    const timeSinceRefill = now - this.lastRefill;

    if (timeSinceRefill >= this.config.windowMs) {
      // Full refill after window
      this.tokens = this.config.maxRequests;
      this.lastRefill = now;
    }
  }

  /**
   * Remove timestamps outside the current window
   */
  private cleanOldTimestamps(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp > cutoff
    );
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.cleanOldTimestamps();
    const now = Date.now();
    const recentRequests = this.requestTimestamps.length;
    const remaining = this.config.maxRequests - recentRequests;

    const oldestRequest = this.requestTimestamps[0] || now;
    const resetAt = oldestRequest + this.config.windowMs;

    return {
      allowed: remaining > 0,
      remaining,
      resetAt,
      retryAfter: remaining > 0 ? 0 : Math.ceil((resetAt - now) / 1000)
    };
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.tokens = this.config.maxRequests;
    this.requestTimestamps = [];
    this.lastRefill = Date.now();
  }
}

/**
 * Rate Limiter Manager - Singleton for managing multiple service rate limiters
 */
class RateLimiterManager {
  private limiters: Map<string, RateLimiter> = new Map();

  // Known service rate limits (per minute)
  private defaultConfigs: Record<string, RateLimitConfig> = {
    'Replicate': { maxRequests: 50, windowMs: 60000 },
    'Anthropic': { maxRequests: 60, windowMs: 60000 },
    'Google Vertex AI': { maxRequests: 120, windowMs: 60000 },
    'Runway': { maxRequests: 30, windowMs: 60000 },
    'ElevenLabs': { maxRequests: 40, windowMs: 60000 },
    'Shopify': { maxRequests: 80, windowMs: 60000 },
    'Etsy': { maxRequests: 50, windowMs: 60000 },
    'Amazon MWS': { maxRequests: 45, windowMs: 60000 },
    'fal.ai': { maxRequests: 50, windowMs: 60000 },
    'Google Gemini': { maxRequests: 60, windowMs: 60000 },
    'Google Imagen': { maxRequests: 10, windowMs: 60000 }
  };

  /**
   * Get or create rate limiter for a service
   */
  getLimiter(service: string): RateLimiter {
    if (!this.limiters.has(service)) {
      const config = this.defaultConfigs[service];

      if (!config) {
        const fallbackConfig = { maxRequests: 30, windowMs: 60000 };
        const limiter = new RateLimiter(service, fallbackConfig);
        this.limiters.set(service, limiter);
      } else {
        const limiter = new RateLimiter(service, config);
        this.limiters.set(service, limiter);
      }

    }

    return this.limiters.get(service)!;
  }

  /**
   * Check rate limit for a service
   */
  async checkLimit(service: string): Promise<RateLimitStatus> {
    const limiter = this.getLimiter(service);
    return await limiter.checkLimit();
  }

  /**
   * Record a request for a service
   */
  async recordRequest(service: string): Promise<void> {
    const limiter = this.getLimiter(service);
    await limiter.recordRequest();
  }

  /**
   * Get status for all services
   */
  getAllStatus(): Record<string, RateLimitStatus> {
    const statuses: Record<string, RateLimitStatus> = {};
    this.limiters.forEach((limiter, service) => {
      statuses[service] = limiter.getStatus();
    });
    return statuses;
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    this.limiters.forEach(limiter => limiter.reset());
  }
}

// Export singleton instance
export const rateLimiterManager = new RateLimiterManager();

// Pre-configure limiters for known services
export const serviceLimiters = {
  replicate: rateLimiterManager.getLimiter('Replicate'),
  anthropic: rateLimiterManager.getLimiter('Anthropic'),
  vertexAI: rateLimiterManager.getLimiter('Google Vertex AI'),
  runway: rateLimiterManager.getLimiter('Runway'),
  elevenLabs: rateLimiterManager.getLimiter('ElevenLabs'),
  shopify: rateLimiterManager.getLimiter('Shopify'),
  etsy: rateLimiterManager.getLimiter('Etsy'),
  amazon: rateLimiterManager.getLimiter('Amazon MWS')
};
