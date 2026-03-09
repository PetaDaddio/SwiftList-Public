export interface JobTelemetry {
    jobId: string;
    workflowId: string;
    workerName: string;
    startedAt: string;
}
export interface JobEndTelemetry {
    status: 'completed' | 'failed';
    durationMs: number;
    costUsd?: number;
    error?: string;
}
export declare class TelemetryService {
    private supabase;
    constructor();
    startJob(telemetry: JobTelemetry): Promise<string>;
    endJob(telemetryId: string, telemetry: JobEndTelemetry): Promise<void>;
}
//# sourceMappingURL=TelemetryService.d.ts.map