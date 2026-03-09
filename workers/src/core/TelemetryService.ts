/**
 * TelemetryService - Observability and metrics tracking
 *
 * Tracks:
 * - Job execution times
 * - API costs
 * - Success/failure rates
 * - Queue depths
 * - Worker health
 *
 * Integrations:
 * - Supabase (job_events table)
 * - Railway metrics
 * - Console logging
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

export class TelemetryService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Record job start
   */
  async startJob(telemetry: JobTelemetry): Promise<string> {
    const { data, error } = await this.supabase
      .from('job_events')
      .insert({
        job_id: telemetry.jobId,
        event_type: 'workflow_start',
        workflow_id: telemetry.workflowId,
        metadata: {
          worker: telemetry.workerName,
          started_at: telemetry.startedAt,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to record job start:', error);
      return ''; // Non-blocking
    }

    return data.id;
  }

  /**
   * Record job end
   */
  async endJob(telemetryId: string, telemetry: JobEndTelemetry): Promise<void> {
    await this.supabase.from('job_events').insert({
      event_type: `workflow_${telemetry.status}`,
      duration_ms: telemetry.durationMs,
      metadata: {
        cost_usd: telemetry.costUsd,
        error: telemetry.error,
      },
    });
  }
}
