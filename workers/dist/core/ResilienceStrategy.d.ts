import { Job } from 'bullmq';
export declare enum ErrorType {
    TRANSIENT = "transient",
    PERMANENT = "permanent",
    PROVIDER_OUTAGE = "provider_outage"
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
export declare class ResilienceStrategy {
    private dlq;
    private redis;
    private circuitBreakers;
    private defaultRetryConfig;
    private readonly CIRCUIT_BREAKER_THRESHOLD;
    private readonly CIRCUIT_BREAKER_TIMEOUT_MS;
    private readonly CIRCUIT_BREAKER_SUCCESS_THRESHOLD;
    constructor();
    executeWithRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>;
    classifyError(error: any): ClassifiedError;
    private calculateBackoff;
    sendToDLQ(job: Job, error: Error): Promise<void>;
    isIrrecoverable(error: any): boolean;
    checkCircuitBreaker(provider: string): Promise<boolean>;
    recordCircuitBreakerSuccess(provider: string): Promise<void>;
    recordCircuitBreakerFailure(provider: string): Promise<void>;
    getCircuitBreakerState(provider: string): CircuitBreakerState | undefined;
    resetCircuitBreaker(provider: string): Promise<void>;
    getDLQJobs(limit?: number): Promise<any[]>;
    reprocessDLQJob(dlqJobId: string): Promise<boolean>;
    private sleep;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=ResilienceStrategy.d.ts.map