/**
 * Lifeguard Monitoring System
 *
 * Monitors SwiftList workers for:
 * - Stuck jobs (processing > 30 minutes)
 * - High error rate (> 10% failures in last hour)
 * - Worker crashes (no active jobs with pending queue)
 * - Database connectivity issues
 * - Redis connectivity issues
 *
 * Sends Slack alerts for any issues detected
 * NO AUTO-REFUNDS - Alerts only, manual intervention required
 */

import { WebClient } from '@slack/web-api';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { getQueueMetrics, jobQueue } from './queue';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const ALERT_CHANNEL = process.env.SLACK_ALERT_CHANNEL || '#swiftlist-alerts';

const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HealthIssue {
	severity: 'critical' | 'warning' | 'info';
	category: string;
	title: string;
	description: string;
	job_ids?: string[];
	metrics?: any;
}

class LifeguardMonitor {
	private lastAlertTimes: Map<string, number> = new Map();
	private readonly ALERT_COOLDOWN = 15 * 60 * 1000; // 15 minutes between duplicate alerts

	/**
	 * Run all health checks
	 */
	async runHealthChecks(): Promise<HealthIssue[]> {
		const issues: HealthIssue[] = [];

		try {
			// 1. Check for stuck jobs
			const stuckJobs = await this.checkStuckJobs();
			if (stuckJobs) issues.push(stuckJobs);

			// 2. Check for high error rate
			const errorRate = await this.checkErrorRate();
			if (errorRate) issues.push(errorRate);

			// 3. Check for worker crashes
			const workerCrash = await this.checkWorkerCrashes();
			if (workerCrash) issues.push(workerCrash);

			// 4. Check database connectivity
			const dbIssue = await this.checkDatabaseConnectivity();
			if (dbIssue) issues.push(dbIssue);

			// 5. Check Redis connectivity
			const redisIssue = await this.checkRedisConnectivity();
			if (redisIssue) issues.push(redisIssue);

			// 6. Check queue backlog
			const backlog = await this.checkQueueBacklog();
			if (backlog) issues.push(backlog);
		} catch (error) {
			console.error('[Lifeguard] Health check error:', error);
			issues.push({
				severity: 'critical',
				category: 'SYSTEM',
				title: 'Health Check Failed',
				description: `Failed to run health checks: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}

		return issues;
	}

	/**
	 * Check for jobs stuck in processing state
	 */
	private async checkStuckJobs(): Promise<HealthIssue | null> {
		try {
			const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

			const { data: stuckJobs, error } = await supabase
				.from('jobs')
				.select('job_id, workflow_id, user_id, started_at')
				.eq('status', 'processing')
				.lt('started_at', thirtyMinutesAgo);

			if (error) throw error;

			if (stuckJobs && stuckJobs.length > 0) {
				return {
					severity: 'critical',
					category: 'STUCK_JOBS',
					title: `${stuckJobs.length} Stuck Job(s) Detected`,
					description: `Found ${stuckJobs.length} job(s) stuck in processing state for over 30 minutes. Manual intervention required.`,
					job_ids: stuckJobs.map(j => j.job_id),
					metrics: {
						count: stuckJobs.length,
						workflows: [...new Set(stuckJobs.map(j => j.workflow_id))]
					}
				};
			}

			return null;
		} catch (error) {
			console.error('[Lifeguard] Stuck jobs check error:', error);
			return null;
		}
	}

	/**
	 * Check for high error rate
	 */
	private async checkErrorRate(): Promise<HealthIssue | null> {
		try {
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

			// Get total jobs in last hour
			const { count: totalJobs, error: totalError } = await supabase
				.from('jobs')
				.select('*', { count: 'exact', head: true })
				.gte('created_at', oneHourAgo);

			if (totalError) throw totalError;

			// Get failed jobs in last hour
			const { count: failedJobs, error: failedError } = await supabase
				.from('jobs')
				.select('*', { count: 'exact', head: true })
				.eq('status', 'failed')
				.gte('created_at', oneHourAgo);

			if (failedError) throw failedError;

			if (totalJobs && totalJobs > 10) {
				// Only check if we have significant volume
				const errorRate = (failedJobs || 0) / totalJobs;

				if (errorRate > 0.1) {
					// > 10% error rate
					return {
						severity: 'warning',
						category: 'HIGH_ERROR_RATE',
						title: 'High Error Rate Detected',
						description: `Error rate is ${(errorRate * 100).toFixed(1)}% (${failedJobs}/${totalJobs} jobs failed in last hour)`,
						metrics: {
							total_jobs: totalJobs,
							failed_jobs: failedJobs,
							error_rate: errorRate
						}
					};
				}
			}

			return null;
		} catch (error) {
			console.error('[Lifeguard] Error rate check error:', error);
			return null;
		}
	}

	/**
	 * Check for worker crashes
	 */
	private async checkWorkerCrashes(): Promise<HealthIssue | null> {
		try {
			const metrics = await getQueueMetrics();

			// If we have pending jobs but no active jobs for > 10 minutes, workers may be crashed
			if (metrics.waiting > 0 && metrics.active === 0) {
				// Check if there have been any completed jobs in the last 10 minutes
				const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

				const { count: recentCompletions, error } = await supabase
					.from('jobs')
					.select('*', { count: 'exact', head: true })
					.eq('status', 'completed')
					.gte('completed_at', tenMinutesAgo);

				if (error) throw error;

				if (!recentCompletions || recentCompletions === 0) {
					return {
						severity: 'critical',
						category: 'WORKER_CRASH',
						title: 'Workers May Be Crashed',
						description: `${metrics.waiting} jobs waiting in queue but no active workers detected for 10+ minutes`,
						metrics: metrics
					};
				}
			}

			return null;
		} catch (error) {
			console.error('[Lifeguard] Worker crash check error:', error);
			return null;
		}
	}

	/**
	 * Check database connectivity
	 */
	private async checkDatabaseConnectivity(): Promise<HealthIssue | null> {
		try {
			const { error } = await supabase.from('jobs').select('job_id').limit(1);

			if (error) {
				return {
					severity: 'critical',
					category: 'DATABASE',
					title: 'Database Connectivity Issue',
					description: `Failed to connect to Supabase: ${error.message}`
				};
			}

			return null;
		} catch (error) {
			return {
				severity: 'critical',
				category: 'DATABASE',
				title: 'Database Connectivity Issue',
				description: `Failed to connect to Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * Check Redis connectivity
	 */
	private async checkRedisConnectivity(): Promise<HealthIssue | null> {
		try {
			await getQueueMetrics();
			return null;
		} catch (error) {
			return {
				severity: 'critical',
				category: 'REDIS',
				title: 'Redis Connectivity Issue',
				description: `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * Check queue backlog
	 */
	private async checkQueueBacklog(): Promise<HealthIssue | null> {
		try {
			const metrics = await getQueueMetrics();

			// Warn if waiting queue exceeds 50 jobs
			if (metrics.waiting > 50) {
				return {
					severity: 'warning',
					category: 'QUEUE_BACKLOG',
					title: 'Queue Backlog Building Up',
					description: `${metrics.waiting} jobs waiting in queue. Consider scaling workers.`,
					metrics: metrics
				};
			}

			return null;
		} catch (error) {
			console.error('[Lifeguard] Queue backlog check error:', error);
			return null;
		}
	}

	/**
	 * Send Slack alert for issue
	 */
	private async sendSlackAlert(issue: HealthIssue): Promise<void> {
		// Check cooldown to prevent alert spam
		const alertKey = `${issue.category}-${issue.title}`;
		const lastAlert = this.lastAlertTimes.get(alertKey) || 0;
		const now = Date.now();

		if (now - lastAlert < this.ALERT_COOLDOWN) {
			console.log(`[Lifeguard] Skipping duplicate alert for ${alertKey} (cooldown)`);
			return;
		}

		try {
			const emoji = issue.severity === 'critical' ? '🚨' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
			const color = issue.severity === 'critical' ? '#FF0000' : issue.severity === 'warning' ? '#FFA500' : '#0000FF';

			await slack.chat.postMessage({
				channel: ALERT_CHANNEL,
				text: `${emoji} [${issue.severity.toUpperCase()}] ${issue.title}`,
				blocks: [
					{
						type: 'header',
						text: {
							type: 'plain_text',
							text: `${emoji} ${issue.title}`,
							emoji: true
						}
					},
					{
						type: 'section',
						fields: [
							{
								type: 'mrkdwn',
								text: `*Severity:*\n${issue.severity.toUpperCase()}`
							},
							{
								type: 'mrkdwn',
								text: `*Category:*\n${issue.category}`
							}
						]
					},
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: `*Description:*\n${issue.description}`
						}
					},
					...(issue.job_ids
						? [
								{
									type: 'section',
									text: {
										type: 'mrkdwn',
										text: `*Affected Jobs:*\n${issue.job_ids.slice(0, 5).join(', ')}${issue.job_ids.length > 5 ? ` (+${issue.job_ids.length - 5} more)` : ''}`
									}
								}
						  ]
						: []),
					...(issue.metrics
						? [
								{
									type: 'section',
									text: {
										type: 'mrkdwn',
										text: `*Metrics:*\n\`\`\`${JSON.stringify(issue.metrics, null, 2)}\`\`\``
									}
								}
						  ]
						: []),
					{
						type: 'context',
						elements: [
							{
								type: 'mrkdwn',
								text: `Environment: ${process.env.NODE_ENV || 'development'} | Time: ${new Date().toISOString()}`
							}
						]
					}
				]
			});

			this.lastAlertTimes.set(alertKey, now);
			console.log(`[Lifeguard] Slack alert sent for ${issue.category}: ${issue.title}`);
		} catch (error) {
			console.error('[Lifeguard] Failed to send Slack alert:', error);
		}
	}

	/**
	 * Run monitoring cycle
	 */
	async runMonitoringCycle(): Promise<void> {
		console.log('[Lifeguard] Running health checks...');

		const issues = await this.runHealthChecks();

		if (issues.length === 0) {
			console.log('[Lifeguard] ✅ All systems healthy');
		} else {
			console.log(`[Lifeguard] ⚠️  Found ${issues.length} issue(s)`);

			for (const issue of issues) {
				console.log(`[Lifeguard] - ${issue.severity.toUpperCase()}: ${issue.title}`);
				await this.sendSlackAlert(issue);
			}
		}
	}

	/**
	 * Start monitoring with cron schedule
	 */
	startMonitoring(): void {
		console.log('[Lifeguard] Starting monitoring system...');
		console.log('[Lifeguard] Schedule: Every 5 minutes');
		console.log(`[Lifeguard] Slack alerts: ${ALERT_CHANNEL}`);

		// Run every 5 minutes
		cron.schedule('*/5 * * * *', async () => {
			await this.runMonitoringCycle();
		});

		// Run initial check
		this.runMonitoringCycle();

		console.log('[Lifeguard] ✅ Monitoring active');
	}
}

// Export singleton instance
export const lifeguard = new LifeguardMonitor();

// Auto-start if running as main module
if (require.main === module) {
	lifeguard.startMonitoring();
}
