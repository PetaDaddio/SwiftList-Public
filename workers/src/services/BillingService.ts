/**
 * BillingService - Cost tracking and billing
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CostRecord {
  jobId: string;
  userId: string;
  workflowId: string;
  workerName: string;
  costUsd: number;
  timestamp: string;
}

export class BillingService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async recordCost(record: CostRecord): Promise<void> {
    await this.supabase.from('api_costs').insert({
      job_id: record.jobId,
      user_id: record.userId,
      workflow_id: record.workflowId,
      worker_name: record.workerName,
      cost_usd: record.costUsd,
      created_at: record.timestamp,
    });
  }
}
