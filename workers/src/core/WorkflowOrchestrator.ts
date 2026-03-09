/**
 * WorkflowOrchestrator - Dynamic routing and multi-step workflow chaining
 *
 * Responsibilities:
 * 1. Route user requests to the correct BullMQ queue based on workflow ID
 * 2. Handle complex "Flows" (chaining multiple AI operations)
 * 3. Manage inter-worker dependencies (e.g., upscale AFTER background removal)
 * 4. Implement priority queuing for paid tiers
 *
 * Architecture:
 * - Single-step jobs: Direct queue submission
 * - Multi-step flows: BullMQ FlowProducer with parent-child relationships
 *
 * @example
 * // Single-step job
 * await orchestrator.submitJob({
 *   workflowId: 'WF-04',
 *   userId: 'user-123',
 *   imageUrl: 'https://...',
 * });
 *
 * // Multi-step flow
 * await orchestrator.submitFlow({
 *   workflowIds: ['WF-04', 'WF-14'], // BG removal → Upscale
 *   userId: 'user-123',
 *   imageUrl: 'https://...',
 * });
 */

import { Queue, FlowProducer } from 'bullmq';
import { Redis } from 'ioredis';
import { workflowRegistry, WorkflowDefinition } from '../config/workflows.config';
import { JobData } from './BaseWorker';

export interface JobSubmission {
  workflowId: string;
  userId: string;
  imageUrl: string;
  parameters?: Record<string, any>;
  priority?: number; // 1-10 (10 = highest, for Agency tier)
}

export interface FlowSubmission {
  workflowIds: string[]; // Ordered list of workflows to chain
  userId: string;
  imageUrl: string;
  parameters?: Record<string, any>;
  priority?: number;
}

export interface FlowResult {
  flowId: string;
  jobIds: string[];
  estimatedDurationMs: number;
  estimatedCostUsd: number;
}

export class WorkflowOrchestrator {
  private queues: Map<string, Queue>;
  private flowProducer: FlowProducer;
  private redis: Redis;

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
          enableReadyCheck: false,
        });

    // Initialize queue registry
    this.queues = new Map();

    // Initialize FlowProducer for multi-step workflows
    this.flowProducer = new FlowProducer({
      connection: this.redis,
    });

    // Register all queues from workflow registry
    this.registerQueues();

    console.log('✅ WorkflowOrchestrator initialized');
  }

  /**
   * Register all workflow queues from configuration
   *
   * Creates a BullMQ queue for each workflow in the registry.
   * Each queue has its own concurrency, retry, and timeout settings.
   */
  private registerQueues(): void {
    for (const [workflowId, workflow] of Object.entries(workflowRegistry)) {
      const queue = new Queue(workflow.queueName, {
        connection: this.redis,
        defaultJobOptions: {
          attempts: workflow.maxRetries,
          backoff: {
            type: 'exponential',
            delay: 2000, // Start at 2 seconds
          },
          removeOnComplete: {
            count: 100, // Keep last 100 completed jobs
            age: 3600, // Remove after 1 hour
          },
          removeOnFail: {
            count: 50, // Keep last 50 failed jobs
            age: 86400, // Remove after 24 hours
          },
        },
      });

      this.queues.set(workflowId, queue);
      console.log(`📦 Registered queue: ${workflow.queueName} (${workflowId})`);
    }
  }

  /**
   * Submit a single-step job to the appropriate queue
   *
   * Flow:
   * 1. Validate workflow exists
   * 2. Generate unique job ID
   * 3. Calculate estimated cost
   * 4. Submit to correct queue with priority
   *
   * @param submission - Job submission data
   * @returns Job ID and metadata
   */
  async submitJob(submission: JobSubmission): Promise<{
    jobId: string;
    queueName: string;
    estimatedCostUsd: number;
  }> {
    const { workflowId, userId, imageUrl, parameters, priority = 5 } = submission;

    // Validate workflow exists
    const workflow = workflowRegistry[workflowId];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowId}`);
    }

    // Get queue for this workflow
    const queue = this.queues.get(workflowId);
    if (!queue) {
      throw new Error(`Queue not initialized for workflow: ${workflowId}`);
    }

    // Generate unique job ID
    const jobId = `${workflowId}-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;

    // Prepare job data
    const jobData: JobData = {
      jobId,
      userId,
      workflowId,
      inputUrl: imageUrl,
      parameters,
    };

    // Submit to queue with priority
    await queue.add('process', jobData, {
      jobId,
      priority: this.calculatePriority(priority),
    });

    console.log(
      `📤 Submitted job ${jobId} to queue ${workflow.queueName} (priority: ${priority})`
    );

    return {
      jobId,
      queueName: workflow.queueName,
      estimatedCostUsd: workflow.estimatedCostUsd,
    };
  }

  /**
   * Submit a multi-step flow (chained workflows)
   *
   * Uses BullMQ FlowProducer to create parent-child job relationships.
   * Child jobs only start after parent completes successfully.
   *
   * Example flow: Background Removal → Upscale → Lifestyle Setting
   *
   * @param submission - Flow submission data
   * @returns Flow ID and metadata
   */
  async submitFlow(submission: FlowSubmission): Promise<FlowResult> {
    const { workflowIds, userId, imageUrl, parameters, priority = 5 } = submission;

    // Validate all workflows exist
    for (const workflowId of workflowIds) {
      if (!workflowRegistry[workflowId]) {
        throw new Error(`Unknown workflow in flow: ${workflowId}`);
      }
    }

    // Generate flow ID
    const flowId = `flow-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;

    // Calculate total estimated cost and duration
    let estimatedCostUsd = 0;
    let estimatedDurationMs = 0;

    for (const workflowId of workflowIds) {
      const workflow = workflowRegistry[workflowId];
      estimatedCostUsd += workflow.estimatedCostUsd;
      estimatedDurationMs += workflow.estimatedDurationMs;
    }

    // Build flow structure (parent-child chain)
    const flowTree = this.buildFlowTree(workflowIds, userId, imageUrl, parameters, priority);

    // Submit flow to FlowProducer
    await this.flowProducer.add(flowTree);

    console.log(
      `🌊 Submitted flow ${flowId} with ${workflowIds.length} steps (est. ${estimatedDurationMs}ms, $${estimatedCostUsd.toFixed(4)})`
    );

    return {
      flowId,
      jobIds: workflowIds.map((wfId, idx) => `${flowId}-step-${idx + 1}`),
      estimatedDurationMs,
      estimatedCostUsd,
    };
  }

  /**
   * Build BullMQ flow tree (parent-child relationships)
   *
   * Structure:
   * Parent Job (Step 1)
   *   └─> Child Job (Step 2)
   *       └─> Grandchild Job (Step 3)
   *
   * Each child receives output from parent via job.data
   */
  private buildFlowTree(
    workflowIds: string[],
    userId: string,
    imageUrl: string,
    parameters: Record<string, any> = {},
    priority: number
  ): any {
    if (workflowIds.length === 0) {
      throw new Error('Flow must have at least one workflow');
    }

    // Build from last to first (reverse order for nesting)
    let currentNode: any = null;

    for (let i = workflowIds.length - 1; i >= 0; i--) {
      const workflowId = workflowIds[i];
      const workflow = workflowRegistry[workflowId];
      const stepJobId = `step-${i + 1}-${Date.now()}`;

      const jobData: JobData = {
        jobId: stepJobId,
        userId,
        workflowId,
        inputUrl: i === 0 ? imageUrl : '{{parent.output_url}}', // First step uses original, rest use parent output
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

  /**
   * Calculate BullMQ priority (1-2^21)
   *
   * Mapping:
   * - Priority 10 (Agency tier): 1 (highest)
   * - Priority 5 (Free tier): 100
   * - Priority 1 (lowest): 1000
   */
  private calculatePriority(userPriority: number): number {
    // Invert: lower number = higher priority in BullMQ
    return Math.floor(1000 / userPriority);
  }

  /**
   * Route job to correct queue based on workflow ID
   *
   * Used internally for dynamic routing.
   *
   * @param workflowId - Workflow identifier
   * @returns Queue instance
   */
  public getQueue(workflowId: string): Queue | undefined {
    return this.queues.get(workflowId);
  }

  /**
   * Get workflow definition
   *
   * @param workflowId - Workflow identifier
   * @returns Workflow configuration
   */
  public getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return workflowRegistry[workflowId];
  }

  /**
   * List all available workflows
   *
   * @returns Array of workflow IDs
   */
  public listWorkflows(): string[] {
    return Object.keys(workflowRegistry);
  }

  /**
   * Get flow status
   *
   * @param flowId - Flow identifier
   * @returns Flow execution status
   */
  async getFlowStatus(flowId: string): Promise<{
    completed: number;
    failed: number;
    active: number;
    waiting: number;
  }> {
    // Query all jobs in flow
    const jobs = await this.flowProducer.getFlow({
      id: flowId,
      queueName: 'flow-jobs', // Default flow queue name
    });

    if (!jobs) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    // Count job states
    const status = {
      completed: 0,
      failed: 0,
      active: 0,
      waiting: 0,
    };

    // Traverse job tree
    const traverse = (job: any) => {
      if (!job) return;

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

  /**
   * Cancel a flow (stop all pending jobs)
   *
   * @param flowId - Flow identifier
   */
  async cancelFlow(flowId: string): Promise<void> {
    // Remove flow and all child jobs
    await this.flowProducer.getFlow({
      id: flowId,
      queueName: 'flow-jobs',
    });

    // TODO: Implement cancellation logic
    console.log(`🛑 Cancelled flow: ${flowId}`);
  }

  /**
   * Graceful shutdown
   *
   * Closes all queues and connections.
   */
  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down WorkflowOrchestrator...');

    // Close all queues
    for (const [workflowId, queue] of this.queues.entries()) {
      await queue.close();
      console.log(`✅ Closed queue: ${workflowId}`);
    }

    // Close flow producer
    await this.flowProducer.close();

    // Close Redis connection
    await this.redis.quit();

    console.log('✅ WorkflowOrchestrator shutdown complete');
  }
}
