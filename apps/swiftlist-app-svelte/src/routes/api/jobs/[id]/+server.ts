/**
 * Job Status API Endpoint
 * GET /api/jobs/[id]
 *
 * Retrieves job status by ID with authorization checks
 * SECURITY: Users can only access their own jobs (enforced by RLS)
 *
 * NOTE: product_image_url stored in DB is a Supabase Storage public URL,
 * but the job-uploads bucket is PRIVATE. We generate a signed URL here
 * so the browser can actually render the thumbnail.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobsLogger } from '$lib/utils/logger';

const log = jobsLogger.child({ route: '/api/jobs/[id]' });

/**
 * Extract the storage path from a Supabase Storage URL
 * URL format: https://{project}.supabase.co/storage/v1/object/public/job-uploads/{path}
 * Returns the path portion after the bucket name, or null if not a storage URL
 */
function extractStoragePath(url: string | null | undefined): string | null {
	if (!url) return null;
	const marker = '/storage/v1/object/public/job-uploads/';
	const idx = url.indexOf(marker);
	if (idx === -1) return null;
	return url.substring(idx + marker.length);
}

export const GET: RequestHandler = async ({ params, locals }) => {
	// 1. Authentication check
	if (!locals.user) {
		throw error(401, 'Unauthorized - Please sign in');
	}

	const jobId = params.id;

	// 2. Validate job ID format (basic UUID validation)
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(jobId)) {
		throw error(400, 'Invalid job ID format');
	}

	// 3. Fetch job from database (RLS ensures user can only access their own jobs)
	const { data: job, error: fetchError } = await locals.supabase
		.from('jobs')
		.select('*')
		.eq('job_id', jobId)
		.single();

	if (fetchError) {
		// Job not found or access denied
		if (fetchError.code === 'PGRST116') {
			throw error(404, 'Job not found');
		}
		log.error({ err: fetchError, jobId }, 'Job fetch failed');
		throw error(500, 'Failed to fetch job');
	}

	// 4. Generate signed URL for product image (bucket is private)
	const storagePath = extractStoragePath(job.product_image_url);
	if (storagePath) {
		const { data: signedUrlData, error: signedUrlError } = await locals.supabase
			.storage
			.from('job-uploads')
			.createSignedUrl(storagePath, 3600); // 1 hour expiry

		if (!signedUrlError && signedUrlData?.signedUrl) {
			job.product_image_url = signedUrlData.signedUrl;
		} else {
			log.warn({ jobId, err: signedUrlError }, 'Failed to generate signed URL for product image');
		}
	}

	// 5. Return job data with signed image URL
	return json({
		success: true,
		job
	});
};
