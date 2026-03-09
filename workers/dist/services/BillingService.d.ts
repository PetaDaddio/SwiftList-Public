export interface CostRecord {
    jobId: string;
    userId: string;
    workflowId: string;
    workerName: string;
    costUsd: number;
    timestamp: string;
}
export declare class BillingService {
    private supabase;
    constructor();
    recordCost(record: CostRecord): Promise<void>;
}
//# sourceMappingURL=BillingService.d.ts.map