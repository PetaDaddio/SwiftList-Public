export interface WorkflowDefinition {
    workflowId: string;
    name: string;
    queueName: string;
    workerClass: string;
    estimatedCostUsd: number;
    estimatedDurationMs: number;
    maxRetries: number;
    timeout: number;
    priority: number;
    providers: string[];
}
export declare const workflowRegistry: Record<string, WorkflowDefinition>;
//# sourceMappingURL=workflows.config.d.ts.map