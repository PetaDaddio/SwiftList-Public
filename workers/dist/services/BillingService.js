"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class BillingService {
    supabase;
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    async recordCost(record) {
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
exports.BillingService = BillingService;
//# sourceMappingURL=BillingService.js.map