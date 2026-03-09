"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundRemovalWorker = void 0;
const BaseWorker_1 = require("../core/BaseWorker");
const ResilienceStrategy_1 = require("../core/ResilienceStrategy");
const replicate_1 = __importDefault(require("replicate"));
class BackgroundRemovalWorker extends BaseWorker_1.BaseWorker {
    replicate;
    resilience;
    constructor() {
        super({
            name: 'BackgroundRemovalWorker',
            concurrency: 5,
            maxRetries: 3,
            timeout: 30000,
        });
        this.replicate = new replicate_1.default({
            auth: process.env.REPLICATE_API_TOKEN,
            ...(process.env.CLOUDFLARE_AI_GATEWAY_URL && {
                baseUrl: process.env.CLOUDFLARE_AI_GATEWAY_URL,
            }),
        });
        this.resilience = new ResilienceStrategy_1.ResilienceStrategy();
        console.log('✅ BackgroundRemovalWorker initialized');
    }
    async processJob(job) {
        const { jobId, userId, inputUrl } = job.data;
        if (!userId)
            throw new Error('Missing userId in job data');
        console.log(`[BackgroundRemoval] Processing job ${jobId}`);
        try {
            const replicateAvailable = await this.resilience.checkCircuitBreaker('replicate');
            if (!replicateAvailable) {
                throw new Error('Replicate API is currently unavailable (circuit breaker open)');
            }
            const output = await this.resilience.executeWithRetry(async () => {
                return await this.replicate.run('lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1', {
                    input: {
                        image: inputUrl,
                    },
                });
            });
            await this.resilience.recordCircuitBreakerSuccess('replicate');
            const resultUrl = output;
            const response = await fetch(resultUrl);
            if (!response.ok) {
                throw new Error(`Failed to download result: HTTP ${response.status}`);
            }
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
            const { data: urlData } = this.supabase.storage
                .from('job-outputs')
                .getPublicUrl(fileName);
            const costUsd = 0.0023;
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
        }
        catch (error) {
            await this.resilience.recordCircuitBreakerFailure('replicate');
            if (this.resilience.isIrrecoverable(error)) {
                await this.resilience.sendToDLQ(job, error);
            }
            throw error;
        }
    }
    async cleanup(job) {
    }
}
exports.BackgroundRemovalWorker = BackgroundRemovalWorker;
//# sourceMappingURL=BackgroundRemovalWorker.js.map