"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResilienceStrategy = exports.ErrorType = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
var ErrorType;
(function (ErrorType) {
    ErrorType["TRANSIENT"] = "transient";
    ErrorType["PERMANENT"] = "permanent";
    ErrorType["PROVIDER_OUTAGE"] = "provider_outage";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
class ResilienceStrategy {
    dlq;
    redis;
    circuitBreakers;
    defaultRetryConfig = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        exponentialBase: 2,
        jitter: true,
    };
    CIRCUIT_BREAKER_THRESHOLD = 5;
    CIRCUIT_BREAKER_TIMEOUT_MS = 60000;
    CIRCUIT_BREAKER_SUCCESS_THRESHOLD = 2;
    constructor() {
        const redisUrl = process.env.REDIS_URL;
        this.redis = redisUrl
            ? new ioredis_1.Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
            : new ioredis_1.Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                maxRetriesPerRequest: null,
            });
        this.dlq = new bullmq_1.Queue('dead-letter-queue', {
            connection: this.redis,
            defaultJobOptions: {
                removeOnComplete: false,
                removeOnFail: false,
            },
        });
        this.circuitBreakers = new Map();
        console.log('✅ ResilienceStrategy initialized');
    }
    async executeWithRetry(fn, config = {}) {
        const retryConfig = { ...this.defaultRetryConfig, ...config };
        let lastError = null;
        for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
            try {
                const result = await fn();
                return result;
            }
            catch (error) {
                lastError = error;
                const classified = this.classifyError(error);
                if (!classified.retryable) {
                    console.error(`❌ Permanent error (attempt ${attempt}):`, classified.message);
                    throw error;
                }
                if (attempt === retryConfig.maxAttempts) {
                    console.error(`❌ Max retries exceeded (${retryConfig.maxAttempts}):`, classified.message);
                    throw error;
                }
                const delay = this.calculateBackoff(attempt, retryConfig);
                console.warn(`⚠️  Transient error (attempt ${attempt}/${retryConfig.maxAttempts}): ${classified.message}. Retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }
        throw lastError || new Error('Unknown retry error');
    }
    classifyError(error) {
        const message = error.message || String(error);
        if (error.status || error.statusCode) {
            const status = error.status || error.statusCode;
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
                    fallbackAvailable: true,
                };
            }
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
        if (message.includes('ETIMEDOUT') ||
            message.includes('ECONNRESET') ||
            message.includes('ECONNREFUSED') ||
            message.includes('timeout')) {
            return {
                type: ErrorType.TRANSIENT,
                message: 'Network timeout',
                retryable: true,
                fallbackAvailable: false,
            };
        }
        if (message.toLowerCase().includes('nsfw') ||
            message.toLowerCase().includes('inappropriate') ||
            message.toLowerCase().includes('content policy')) {
            return {
                type: ErrorType.PERMANENT,
                message: 'NSFW or inappropriate content detected',
                retryable: false,
                fallbackAvailable: false,
                metadata: { reason: 'content_moderation' },
            };
        }
        if (message.toLowerCase().includes('corrupt') ||
            message.toLowerCase().includes('invalid image') ||
            message.toLowerCase().includes('unsupported format')) {
            return {
                type: ErrorType.PERMANENT,
                message: 'Invalid or corrupt image',
                retryable: false,
                fallbackAvailable: false,
                metadata: { reason: 'invalid_input' },
            };
        }
        return {
            type: ErrorType.TRANSIENT,
            message: message || 'Unknown error',
            retryable: true,
            fallbackAvailable: false,
        };
    }
    calculateBackoff(attempt, config) {
        const exponentialDelay = config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1);
        let delay = Math.min(exponentialDelay, config.maxDelayMs);
        if (config.jitter) {
            const jitterFactor = 0.2;
            const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
            delay += jitter;
        }
        return Math.floor(delay);
    }
    async sendToDLQ(job, error) {
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
        console.error(`💀 Sent job ${job.id} to DLQ: ${classified.message} (type: ${classified.type})`);
    }
    isIrrecoverable(error) {
        const classified = this.classifyError(error);
        return !classified.retryable;
    }
    async checkCircuitBreaker(provider) {
        const state = this.circuitBreakers.get(provider) || {
            provider,
            failureCount: 0,
            lastFailureAt: new Date(),
            state: 'closed',
        };
        const now = new Date();
        if (state.state === 'open') {
            const timeoutExpired = state.nextRetryAt && now >= state.nextRetryAt;
            if (timeoutExpired) {
                console.log(`🔓 Circuit breaker HALF-OPEN for provider: ${provider}`);
                state.state = 'half-open';
                state.failureCount = 0;
                this.circuitBreakers.set(provider, state);
                return true;
            }
            else {
                console.warn(`🚫 Circuit breaker OPEN for provider: ${provider}`);
                return false;
            }
        }
        return true;
    }
    async recordCircuitBreakerSuccess(provider) {
        const state = this.circuitBreakers.get(provider);
        if (!state)
            return;
        if (state.state === 'half-open') {
            state.failureCount = 0;
            state.state = 'closed';
            console.log(`✅ Circuit breaker CLOSED for provider: ${provider}`);
        }
        this.circuitBreakers.set(provider, state);
    }
    async recordCircuitBreakerFailure(provider) {
        const state = this.circuitBreakers.get(provider) || {
            provider,
            failureCount: 0,
            lastFailureAt: new Date(),
            state: 'closed',
        };
        state.failureCount++;
        state.lastFailureAt = new Date();
        if (state.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
            state.state = 'open';
            state.nextRetryAt = new Date(Date.now() + this.CIRCUIT_BREAKER_TIMEOUT_MS);
            console.error(`🔴 Circuit breaker OPENED for provider: ${provider} (${state.failureCount} failures)`);
        }
        this.circuitBreakers.set(provider, state);
    }
    getCircuitBreakerState(provider) {
        return this.circuitBreakers.get(provider);
    }
    async resetCircuitBreaker(provider) {
        this.circuitBreakers.delete(provider);
        console.log(`🔄 Circuit breaker reset for provider: ${provider}`);
    }
    async getDLQJobs(limit = 50) {
        const jobs = await this.dlq.getJobs(['failed', 'completed'], 0, limit - 1);
        return jobs.map((job) => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
        }));
    }
    async reprocessDLQJob(dlqJobId) {
        const job = await this.dlq.getJob(dlqJobId);
        if (!job) {
            throw new Error(`DLQ job not found: ${dlqJobId}`);
        }
        const originalData = job.data.originalData;
        const originalQueueName = job.data.originalQueueName;
        console.log(`♻️  Reprocessing DLQ job ${dlqJobId} to queue ${originalQueueName}`);
        return true;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async shutdown() {
        console.log('🔌 Shutting down ResilienceStrategy...');
        await this.dlq.close();
        await this.redis.quit();
        console.log('✅ ResilienceStrategy shutdown complete');
    }
}
exports.ResilienceStrategy = ResilienceStrategy;
//# sourceMappingURL=ResilienceStrategy.js.map