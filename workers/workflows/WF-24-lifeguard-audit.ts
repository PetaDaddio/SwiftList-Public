/**
 * WF-24: Lifeguard Audit
 *
 * Error log analysis + refund checks for system health monitoring
 *
 * Priority: SYSTEM MONITOR
 * Cost: $0.00 | Credits: 0 | Revenue: $0.00 | Margin: N/A
 * Fixed Cost: $20/month
 * AI: Google Vertex AI Gemini 2.5 Pro
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface LifeguardAuditInput {
  hours_to_analyze?: number;
}

interface LifeguardAuditOutput {
  health_report: {
    critical_errors: Array<{
      job_id: string;
      error: string;
      timestamp: string;
    }>;
    refunds_issued: number;
    wash_trades_detected: number;
    system_health: 'healthy' | 'degraded' | 'critical';
    recommendations: string[];
  };
  metrics: {
    total_jobs: number;
    failed_jobs: number;
    success_rate: number;
    avg_processing_time: number;
  };
}

export class LifeguardAuditWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as LifeguardAuditInput;
      const hoursToAnalyze = input.hours_to_analyze || 24;

      await this.updateProgress(25, 'Collecting error logs from past 24 hours');

      // Collect error logs
      const logs = await this.collectErrorLogs(hoursToAnalyze);

      await this.updateProgress(50, 'Analyzing patterns with Gemini');

      // Analyze with Gemini for patterns and anomalies
      const analysis = await this.analyzeLogsWithGemini(logs);

      await this.updateProgress(75, 'Checking for refunds and wash trades');

      // Check for failed jobs requiring refunds
      const refunds = await this.checkAndIssueRefunds(analysis.failed_jobs);

      // Detect wash trade patterns
      const washTrades = await this.detectWashTrades(hoursToAnalyze);

      // Calculate metrics
      const metrics = await this.calculateMetrics(hoursToAnalyze);

      const output: LifeguardAuditOutput = {
        health_report: {
          critical_errors: analysis.critical_errors,
          refunds_issued: refunds,
          wash_trades_detected: washTrades,
          system_health: this.determineSystemHealth(analysis, metrics),
          recommendations: analysis.recommendations
        },
        metrics: metrics
      };

      await this.updateProgress(100, 'Lifeguard audit complete');

      // Alert if critical issues found
      if (output.health_report.system_health === 'critical') {
        await this.sendCriticalAlert(output);
      }

      return {
        success: true,
        output_data: output
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Collect error logs from Supabase
   */
  private async collectErrorLogs(hours: number): Promise<any[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('jobs')
      .select('job_id, workflow_id, user_id, status, error_message, created_at, completed_at')
      .eq('status', 'failed')
      .gte('created_at', startTime)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to collect logs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Analyze logs using Gemini 2.5 Pro
   */
  private async analyzeLogsWithGemini(logs: any[]): Promise<any> {
    const apiKey = process.env.GOOGLE_VERTEX_KEY;
    if (!apiKey || logs.length === 0) {
      return {
        critical_errors: [],
        failed_jobs: [],
        recommendations: []
      };
    }

    const systemPrompt = 'You are a system health analyst monitoring for anomalies and errors.';

    const userPrompt = `Analyze these logs from the past 24 hours. Identify:
1) Critical errors requiring immediate attention
2) Failed jobs that need refunds
3) Suspicious patterns indicating wash trading
4) System performance metrics

LOGS:
${JSON.stringify(logs, null, 2)}

Return JSON format:
{
  "critical_errors": [
    {"job_id": "string", "error": "string", "timestamp": "string"}
  ],
  "failed_jobs": ["job_id1", "job_id2"],
  "wash_trade_patterns": [],
  "recommendations": ["recommendation1", "recommendation2"]
}`;

    const response = await this.callAPI(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          }
        })
      }
    );

    if (!response.ok) {
      return {
        critical_errors: [],
        failed_jobs: [],
        recommendations: []
      };
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonMatch = textContent?.match(/\{[\s\S]*\}/);

    return jsonMatch ? JSON.parse(jsonMatch[0]) : {
      critical_errors: [],
      failed_jobs: [],
      recommendations: []
    };
  }

  /**
   * Check and issue refunds for failed jobs
   */
  private async checkAndIssueRefunds(failedJobIds: string[]): Promise<number> {
    let refundsIssued = 0;

    for (const jobId of failedJobIds) {
      try {
        const { error } = await this.supabase.rpc('refund_credits_by_job_id', {
          p_job_id: jobId
        });

        if (!error) {
          refundsIssued++;
        }
      } catch (error) {
        console.error(`Failed to refund job ${jobId}:`, error);
      }
    }

    return refundsIssued;
  }

  /**
   * Detect wash trade patterns
   */
  private async detectWashTrades(hours: number): Promise<number> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Detect users with suspicious rapid job submissions
    const { data, error } = await this.supabase
      .rpc('detect_wash_trades', {
        p_start_time: startTime,
        p_threshold: 50 // More than 50 jobs in 24 hours
      });

    if (error) {
      return 0;
    }

    return data?.suspicious_users?.length || 0;
  }

  /**
   * Calculate system metrics
   */
  private async calculateMetrics(hours: number): Promise<any> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('jobs')
      .select('status, created_at, completed_at')
      .gte('created_at', startTime);

    if (error || !data) {
      return {
        total_jobs: 0,
        failed_jobs: 0,
        success_rate: 0,
        avg_processing_time: 0
      };
    }

    const totalJobs = data.length;
    const failedJobs = data.filter(j => j.status === 'failed').length;
    const successRate = totalJobs > 0 ? ((totalJobs - failedJobs) / totalJobs) * 100 : 0;

    // Calculate average processing time
    const processingTimes = data
      .filter(j => j.completed_at && j.created_at)
      .map(j => new Date(j.completed_at).getTime() - new Date(j.created_at).getTime());

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length / 1000
      : 0;

    return {
      total_jobs: totalJobs,
      failed_jobs: failedJobs,
      success_rate: Math.round(successRate * 10) / 10,
      avg_processing_time: Math.round(avgProcessingTime)
    };
  }

  /**
   * Determine overall system health
   */
  private determineSystemHealth(analysis: any, metrics: any): 'healthy' | 'degraded' | 'critical' {
    if (metrics.success_rate < 85 || analysis.critical_errors.length > 5) {
      return 'critical';
    } else if (metrics.success_rate < 95 || analysis.critical_errors.length > 2) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Send critical alert (would integrate with Slack/PagerDuty)
   */
  private async sendCriticalAlert(output: LifeguardAuditOutput): Promise<void> {
    console.error('[CRITICAL ALERT] System health is critical:', output);
    // TODO: Integrate with Slack/PagerDuty for real alerts
  }

  /**
   * Override validateInputs to skip default validation
   */
  protected async validateInputs(): Promise<void> {
    // Custom validation handled in execute()
  }
}
