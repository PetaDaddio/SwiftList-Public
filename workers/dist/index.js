"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const BackgroundRemovalWorker_1 = require("./workers/BackgroundRemovalWorker");
const WorkflowOrchestrator_1 = require("./core/WorkflowOrchestrator");
const ResilienceStrategy_1 = require("./core/ResilienceStrategy");
const requiredEnvVars = [
    'REPLICATE_API_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}
if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.error('Missing Redis config: set REDIS_URL or REDIS_HOST');
    process.exit(1);
}
console.log('Starting SwiftList Core Engine...');
const http_1 = require("http");
let redisStatus = 'connecting';
const workers = [];
const port = parseInt(process.env.PORT || '3000');
const healthServer = (0, http_1.createServer)((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            workers: workers.length,
            redis: redisStatus,
            uptime: process.uptime(),
        }));
    }
    else {
        res.writeHead(404);
        res.end();
    }
});
healthServer.listen(port, () => {
    console.log(`Health check server running on port ${port}`);
});
const redisUrl = process.env.REDIS_URL;
const redis = redisUrl
    ? new ioredis_1.Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
    : new ioredis_1.Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
redis.on('connect', () => {
    redisStatus = 'ready';
    console.log('Redis connected');
});
redis.on('error', (err) => {
    redisStatus = 'error';
    console.error('Redis connection error:', err.message);
});
const orchestrator = new WorkflowOrchestrator_1.WorkflowOrchestrator();
const resilience = new ResilienceStrategy_1.ResilienceStrategy();
const backgroundRemovalWorker = new BackgroundRemovalWorker_1.BackgroundRemovalWorker();
const bgRemovalWorker = new bullmq_1.Worker('background-removal', async (job) => {
    return await backgroundRemovalWorker.execute(job);
}, {
    connection: redis,
    concurrency: backgroundRemovalWorker.getConfig().concurrency,
});
bgRemovalWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
});
bgRemovalWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
});
bgRemovalWorker.on('error', (err) => {
    console.error('Worker error:', err);
});
workers.push(bgRemovalWorker);
console.log('BackgroundRemovalWorker registered');
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    healthServer.close();
    for (const worker of workers) {
        await worker.close();
    }
    await orchestrator.shutdown();
    await resilience.shutdown();
    await redis.quit();
    console.log('Shutdown complete');
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    process.kill(process.pid, 'SIGTERM');
});
console.log('SwiftList Core Engine started successfully');
console.log(`Workers active: ${workers.length}`);
console.log('Ready to process jobs');
//# sourceMappingURL=index.js.map