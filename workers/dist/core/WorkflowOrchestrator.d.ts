import { Queue } from 'bullmq';
import { WorkflowDefinition } from '../config/workflows.config';
export interface JobSubmission {
    workflowId: string;
    userId: string;
    imageUrl: string;
    parameters?: Record<string, any>;
    priority?: number;
}
export interface FlowSubmission {
    workflowIds: string[];
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
export declare class WorkflowOrchestrator {
    private queues;
    private flowProducer;
    private redis;
    constructor();
    private registerQueues;
    submitJob(submission: JobSubmission): Promise<{
        jobId: string;
        queueName: string;
        estimatedCostUsd: number;
    }>;
    submitFlow(submission: FlowSubmission): Promise<FlowResult>;
    private buildFlowTree;
    private calculatePriority;
    getQueue(workflowId: string): Queue | undefined;
    getWorkflow(workflowId: string): WorkflowDefinition | undefined;
    listWorkflows(): string[];
    getFlowStatus(flowId: string): Promise<{
        completed: number;
        failed: number;
        active: number;
        waiting: number;
    }>;
    cancelFlow(flowId: string): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=WorkflowOrchestrator.d.ts.map