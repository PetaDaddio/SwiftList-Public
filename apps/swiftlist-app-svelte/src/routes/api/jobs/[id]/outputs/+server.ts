/**
 * Job Outputs API Endpoint
 * GET /api/jobs/[id]/outputs
 *
 * Fetches all marketplace-specific outputs for a completed job
 *
 * Returns:
 * {
 *   outputs: [
 *     {
 *       output_id: string,
 *       marketplace: string,
 *       output_url: string,
 *       filename: string,
 *       dimensions: string,
 *       file_size_bytes: number,
 *       content_type: string,
 *       created_at: string
 *     }
 *   ]
 * }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { id: job_id } = params;

	// 1. Authentication check
	if (!locals.user) {
		throw error(401, 'Unauthorized - Please sign in');
	}

	try {
		// 2. Verify user owns this job
		const { data: job, error: jobError } = await locals.supabase
			.from('jobs')
			.select('job_id, user_id, status')
			.eq('job_id', job_id)
			.single();

		if (jobError) {
			throw error(404, 'Job not found');
		}

		if (job.user_id !== locals.user.id) {
			throw error(403, 'Forbidden: You do not own this job');
		}

		// 3. Fetch all outputs for this job
		const { data: outputs, error: outputsError } = await locals.supabase
			.from('job_outputs')
			.select('*')
			.eq('job_id', job_id)
			.order('marketplace', { ascending: true });

		if (outputsError) {
			throw error(500, 'Failed to fetch job outputs');
		}

		// 4. Return outputs
		return json({
			job_id,
			status: job.status,
			outputs: outputs || [],
			count: outputs?.length || 0
		});
	} catch (err: any) {

		// Re-throw HTTP errors
		if (err.status) {
			throw err;
		}

		// Generic error
		throw error(500, err.message || 'Internal server error');
	}
};
