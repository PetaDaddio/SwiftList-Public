"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseWorker = void 0;
const TelemetryService_1 = require("./TelemetryService");
const BillingService_1 = require("../services/BillingService");
const ValidationService_1 = require("../services/ValidationService");
const supabase_js_1 = require("@supabase/supabase-js");
class BaseWorker {
    config;
    telemetry;
    billing;
    validation;
    supabase;
    constructor(config) {
        this.config = config;
        this.telemetry = new TelemetryService_1.TelemetryService();
        this.billing = new BillingService_1.BillingService();
        this.validation = new ValidationService_1.ValidationService();
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                persistSession: false,
            },
        });
    }
    async execute(job) {
        const startTime = Date.now();
        const { jobId, userId, workflowId, inputUrl, parameters } = job.data;
        const telemetryId = await this.telemetry.startJob({
            jobId,
            workflowId,
            workerName: this.config.name,
            startedAt: new Date().toISOString(),
        });
        try {
            console.log(`[${this.config.name}] Starting job ${jobId}`);
            await this.validateInput(inputUrl);
            await this.updateJobStatus(jobId, 'processing');
            const result = await this.processJob(job);
            const durationMs = Date.now() - startTime;
            result.durationMs = durationMs;
            if (result.costUsd) {
                await this.updateBilling(jobId, userId, workflowId, result.costUsd);
            }
            await this.updateJobStatus(jobId, 'completed', {
                completed_at: new Date().toISOString(),
                output_image_url: result.outputUrl,
                processing_time_seconds: Math.round(durationMs / 1000),
                cost_usd: result.costUsd,
            });
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
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[${this.config.name}] Failed job ${jobId}:`, error);
            await this.updateJobStatus(jobId, 'failed', {
                completed_at: new Date().toISOString(),
                error_message: errorMessage,
                processing_time_seconds: Math.round(durationMs / 1000),
            });
            await this.refundCredits(jobId, userId);
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
        }
        finally {
            await this.cleanup(job);
        }
    }
    async validateInput(imageUrl) {
        try {
            const response = await fetch(imageUrl, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Image not accessible: HTTP ${response.status}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error(`Invalid content type: ${contentType}. Expected image/*`);
            }
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
                const sizeMB = parseInt(contentLength) / (1024 * 1024);
                if (sizeMB > 10) {
                    throw new Error(`Image too large: ${sizeMB.toFixed(2)}MB. Max 10MB`);
                }
            }
            await this.validation.validateImageHeaders(imageUrl);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Validation failed';
            throw new Error(`Input validation failed: ${message}`);
        }
    }
    async updateJobStatus(jobId, status, updates = {}) {
        const { error } = await this.supabase
            .from('jobs')
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
    async updateBilling(jobId, userId, workflowId, costUsd) {
        await this.billing.recordCost({
            jobId,
            userId,
            workflowId,
            workerName: this.config.name,
            costUsd,
            timestamp: new Date().toISOString(),
        });
        try {
            await this.supabase.from('job_events').insert({
                job_id: jobId,
                event_type: 'api_cost',
                workflow_id: workflowId,
                metadata: {
                    worker: this.config.name,
                    cost_usd: costUsd,
                },
            });
        }
        catch {
        }
    }
    async refundCredits(jobId, userId) {
        try {
            const { error } = await this.supabase.rpc('refund_credits', {
                p_user_id: userId,
                p_job_id: jobId,
            });
            if (error) {
                console.error(`Failed to refund credits for job ${jobId}:`, error);
            }
            else {
                console.log(`[${this.config.name}] Refunded credits for job ${jobId}`);
            }
        }
        catch (error) {
            console.error(`Exception during credit refund for job ${jobId}:`, error);
        }
    }
    async cleanup(job) {
    }
    getConfig() {
        return this.config;
    }
}
exports.BaseWorker = BaseWorker;
//# sourceMappingURL=BaseWorker.js.map