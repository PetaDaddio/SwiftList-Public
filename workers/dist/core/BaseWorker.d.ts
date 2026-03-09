import { Job } from 'bullmq';
import { TelemetryService } from './TelemetryService';
import { BillingService } from '../services/BillingService';
import { ValidationService } from '../services/ValidationService';
import { createClient } from '@supabase/supabase-js';
export interface WorkerConfig {
    name: string;
    concurrency: number;
    maxRetries: number;
    timeout: number;
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
export declare abstract class BaseWorker {
    protected config: WorkerConfig;
    protected telemetry: TelemetryService;
    protected billing: BillingService;
    protected validation: ValidationService;
    protected supabase: ReturnType<typeof createClient>;
    constructor(config: WorkerConfig);
    execute(job: Job<JobData>): Promise<WorkerResult>;
    protected abstract processJob(job: Job<JobData>): Promise<WorkerResult>;
    protected validateInput(imageUrl: string): Promise<void>;
    protected updateJobStatus(jobId: string, status: 'pending' | 'processing' | 'completed' | 'failed', updates?: Record<string, any>): Promise<void>;
    protected updateBilling(jobId: string, userId: string, workflowId: string, costUsd: number): Promise<void>;
    protected refundCredits(jobId: string, userId: string): Promise<void>;
    protected cleanup(job: Job<JobData>): Promise<void>;
    getConfig(): WorkerConfig;
}
//# sourceMappingURL=BaseWorker.d.ts.map