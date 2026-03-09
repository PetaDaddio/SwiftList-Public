"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class TelemetryService {
    supabase;
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    async startJob(telemetry) {
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
            return '';
        }
        return data.id;
    }
    async endJob(telemetryId, telemetry) {
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
exports.TelemetryService = TelemetryService;
//# sourceMappingURL=TelemetryService.js.map