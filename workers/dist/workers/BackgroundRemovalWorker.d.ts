import { Job } from 'bullmq';
import { BaseWorker, WorkerResult, JobData } from '../core/BaseWorker';
export declare class BackgroundRemovalWorker extends BaseWorker {
    private replicate;
    private resilience;
    constructor();
    protected processJob(job: Job<JobData>): Promise<WorkerResult>;
    protected cleanup(job: Job<JobData>): Promise<void>;
}
//# sourceMappingURL=BackgroundRemovalWorker.d.ts.map