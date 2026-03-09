/**
 * Zombie Job Cleanup Endpoint
 * GET /api/jobs/cleanup
 *
 * Finds jobs stuck in 'processing' status for > 5 minutes and marks them as failed.
 * This is an EXTERNAL safety net — it survives process crashes that kill in-process
 * timeouts (setTimeout, Promise.race).
 *
 * Can be called by:
 * - Railway cron trigger
 * - External monitoring (UptimeRobot, etc.)
 * - Manual curl
 *
 * Protected by a shared secret to prevent abuse.
 *
 * BUG-20260227-001: The 9-agent BG removal pipeline caused OOM crashes on Railway.
 * When a Node.js process crashes, all in-process timeouts die. This endpoint
 * provides crash-proof job recovery.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/client';
import { createLogger } from '$lib/utils/logger';

const logger = createLogger('job-cleanup');

/** Jobs stuck longer than this are considered zombies */
const ZOMBIE_THRESHOLD_MINUTES = 5;

export const GET: RequestHandler = async ({ url }) => {
	// Authenticate via shared secret (simple but effective for internal endpoints)
	const token = url.searchParams.get('token');
	const expectedToken = env.JOB_CLEANUP_TOKEN || env.SUPABASE_SERVICE_ROLE_KEY;

	if (!token || token !== expectedToken) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceRoleKey) {
		return json({ error: 'Service role key not configured' }, { status: 500 });
	}

	const adminClient = createServiceRoleClient(serviceRoleKey);

	// Find zombie jobs: stuck in 'processing' for > ZOMBIE_THRESHOLD_MINUTES
	const cutoff = new Date(Date.now() - ZOMBIE_THRESHOLD_MINUTES * 60 * 1000).toISOString();

	// Use type assertion — progress_message exists in DB but not in generated Supabase types
	const { data: zombieJobs, error: fetchError } = await adminClient
		.from('jobs')
		.select('job_id, status, created_at, updated_at')
		.eq('status', 'processing')
		.lt('updated_at', cutoff) as { data: Array<{ job_id: string; status: string; created_at: string; updated_at: string }> | null; error: any };

	if (fetchError) {
		logger.error({ error: fetchError }, 'Failed to query zombie jobs');
		return json({ error: 'Database query failed' }, { status: 500 });
	}

	if (!zombieJobs || zombieJobs.length === 0) {
		return json({ cleaned: 0, message: 'No zombie jobs found' });
	}

	logger.info({ count: zombieJobs.length }, 'Found zombie jobs to clean up');

	// Mark each zombie job as failed
	let cleaned = 0;
	const errors: string[] = [];

	for (const job of zombieJobs) {
		const ageMinutes = Math.round((Date.now() - new Date(job.updated_at).getTime()) / 60000);

		const { error: updateError } = await adminClient
			.from('jobs')
			.update({
				status: 'failed',
				error_message: `Processing timed out after ${ageMinutes} minutes. Please try again.`,
				completed_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			})
			.eq('job_id', job.job_id)
			.eq('status', 'processing'); // Double-check it's still processing

		if (updateError) {
			logger.error({ jobId: job.job_id, error: updateError }, 'Failed to clean up zombie job');
			errors.push(job.job_id);
		} else {
			logger.info({
				jobId: job.job_id,
				ageMinutes
			}, 'Cleaned up zombie job');
			cleaned++;
		}
	}

	return json({
		cleaned,
		total: zombieJobs.length,
		errors: errors.length > 0 ? errors : undefined,
		message: `Cleaned ${cleaned} zombie job(s)`
	});
};
