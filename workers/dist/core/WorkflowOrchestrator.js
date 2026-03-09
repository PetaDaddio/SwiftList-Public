"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestrator = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
const workflows_config_1 = require("../config/workflows.config");
class WorkflowOrchestrator {
    queues;
    flowProducer;
    redis;
    constructor() {
        const redisUrl = process.env.REDIS_URL;
        this.redis = redisUrl
            ? new ioredis_1.Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
            : new ioredis_1.Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            });
        this.queues = new Map();
        this.flowProducer = new bullmq_1.FlowProducer({
            connection: this.redis,
        });
        this.registerQueues();
        console.log('✅ WorkflowOrchestrator initialized');
    }
    registerQueues() {
        for (const [workflowId, workflow] of Object.entries(workflows_config_1.workflowRegistry)) {
            const queue = new bullmq_1.Queue(workflow.queueName, {
                connection: this.redis,
                defaultJobOptions: {
                    attempts: workflow.maxRetries,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: {
                        count: 100,
                        age: 3600,
                    },
                    removeOnFail: {
                        count: 50,
                        age: 86400,
                    },
                },
            });
            this.queues.set(workflowId, queue);
            console.log(`📦 Registered queue: ${workflow.queueName} (${workflowId})`);
        }
    }
    async submitJob(submission) {
        const { workflowId, userId, imageUrl, parameters, priority = 5 } = submission;
        const workflow = workflows_config_1.workflowRegistry[workflowId];
        if (!workflow) {
            throw new Error(`Unknown workflow: ${workflowId}`);
        }
        const queue = this.queues.get(workflowId);
        if (!queue) {
            throw new Error(`Queue not initialized for workflow: ${workflowId}`);
        }
        const jobId = `${workflowId}-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
        const jobData = {
            jobId,
            userId,
            workflowId,
            inputUrl: imageUrl,
            parameters,
        };
        await queue.add('process', jobData, {
            jobId,
            priority: this.calculatePriority(priority),
        });
        console.log(`📤 Submitted job ${jobId} to queue ${workflow.queueName} (priority: ${priority})`);
        return {
            jobId,
            queueName: workflow.queueName,
            estimatedCostUsd: workflow.estimatedCostUsd,
        };
    }
    async submitFlow(submission) {
        const { workflowIds, userId, imageUrl, parameters, priority = 5 } = submission;
        for (const workflowId of workflowIds) {
            if (!workflows_config_1.workflowRegistry[workflowId]) {
                throw new Error(`Unknown workflow in flow: ${workflowId}`);
            }
        }
        const flowId = `flow-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
        let estimatedCostUsd = 0;
        let estimatedDurationMs = 0;
        for (const workflowId of workflowIds) {
            const workflow = workflows_config_1.workflowRegistry[workflowId];
            estimatedCostUsd += workflow.estimatedCostUsd;
            estimatedDurationMs += workflow.estimatedDurationMs;
        }
        const flowTree = this.buildFlowTree(workflowIds, userId, imageUrl, parameters, priority);
        await this.flowProducer.add(flowTree);
        console.log(`🌊 Submitted flow ${flowId} with ${workflowIds.length} steps (est. ${estimatedDurationMs}ms, $${estimatedCostUsd.toFixed(4)})`);
        return {
            flowId,
            jobIds: workflowIds.map((wfId, idx) => `${flowId}-step-${idx + 1}`),
            estimatedDurationMs,
            estimatedCostUsd,
        };
    }
    buildFlowTree(workflowIds, userId, imageUrl, parameters = {}, priority) {
        if (workflowIds.length === 0) {
            throw new Error('Flow must have at least one workflow');
        }
        let currentNode = null;
        for (let i = workflowIds.length - 1; i >= 0; i--) {
            const workflowId = workflowIds[i];
            const workflow = workflows_config_1.workflowRegistry[workflowId];
            const stepJobId = `step-${i + 1}-${Date.now()}`;
            const jobData = {
                jobId: stepJobId,
                userId,
                workflowId,
                inputUrl: i === 0 ? imageUrl : '{{parent.output_url}}',
                parameters,
            };
            const node = {
                name: 'process',
                queueName: workflow.queueName,
                data: jobData,
                opts: {
                    jobId: stepJobId,
                    priority: this.calculatePriority(priority),
                },
                children: currentNode ? [currentNode] : undefined,
            };
            currentNode = node;
        }
        return currentNode;
    }
    calculatePriority(userPriority) {
        return Math.floor(1000 / userPriority);
    }
    getQueue(workflowId) {
        return this.queues.get(workflowId);
    }
    getWorkflow(workflowId) {
        return workflows_config_1.workflowRegistry[workflowId];
    }
    listWorkflows() {
        return Object.keys(workflows_config_1.workflowRegistry);
    }
    async getFlowStatus(flowId) {
        const jobs = await this.flowProducer.getFlow({
            id: flowId,
            queueName: 'flow-jobs',
        });
        if (!jobs) {
            throw new Error(`Flow not found: ${flowId}`);
        }
        const status = {
            completed: 0,
            failed: 0,
            active: 0,
            waiting: 0,
        };
        const traverse = (job) => {
            if (!job)
                return;
            switch (job.state) {
                case 'completed':
                    status.completed++;
                    break;
                case 'failed':
                    status.failed++;
                    break;
                case 'active':
                    status.active++;
                    break;
                case 'waiting':
                    status.waiting++;
                    break;
            }
            if (job.children) {
                job.children.forEach(traverse);
            }
        };
        traverse(jobs);
        return status;
    }
    async cancelFlow(flowId) {
        await this.flowProducer.getFlow({
            id: flowId,
            queueName: 'flow-jobs',
        });
        console.log(`🛑 Cancelled flow: ${flowId}`);
    }
    async shutdown() {
        console.log('🔌 Shutting down WorkflowOrchestrator...');
        for (const [workflowId, queue] of this.queues.entries()) {
            await queue.close();
            console.log(`✅ Closed queue: ${workflowId}`);
        }
        await this.flowProducer.close();
        await this.redis.quit();
        console.log('✅ WorkflowOrchestrator shutdown complete');
    }
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
//# sourceMappingURL=WorkflowOrchestrator.js.map