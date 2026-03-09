/**
 * Jobs List API Endpoint
 * GET /api/jobs?status=completed&limit=6
 *
 * Retrieves jobs for the authenticated user with optional filtering
 * SECURITY: RLS ensures users only see their own jobs
 *
 * NOTE: product_image_url and output_image_url are stored as Supabase Storage
 * public URLs, but both buckets (job-uploads, job-outputs) are PRIVATE.
 * We generate signed URLs so the browser can render thumbnails.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobsLogger } from '$lib/utils/logger';

const log = jobsLogger.child({ route: 'api/jobs' });

/**
 * Extract the storage path from a Supabase Storage URL
 * Returns { bucket, path } or null if not a recognized storage URL
 */
function extractStorageInfo(url: string | null | undefined): { bucket: string; path: string } | null {
	if (!url) return null;

	// Match both job-uploads and job-outputs buckets
	const buckets = ['job-uploads', 'job-outputs'];
	for (const bucket of buckets) {
		const marker = `/storage/v1/object/public/${bucket}/`;
		const idx = url.indexOf(marker);
		if (idx !== -1) {
			return { bucket, path: url.substring(idx + marker.length) };
		}
	}
	return null;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	// 1. Authentication check
	if (!locals.user) {
		throw error(401, 'Unauthorized - Please sign in');
	}

	// 2. Extract query parameters
	const status = url.searchParams.get('status');
	const limitParam = url.searchParams.get('limit');
	const limit = limitParam ? parseInt(limitParam, 10) : undefined;

	// 3. Build query with optional filters
	let query = locals.supabase
		.from('jobs')
		.select('*')
		.order('created_at', { ascending: false });

	// Apply status filter if provided
	if (status) {
		query = query.eq('status', status as 'pending' | 'processing' | 'completed' | 'failed');
	}

	// Apply limit if provided
	if (limit && limit > 0) {
		query = query.limit(limit);
	}

	// 4. Execute query
	const { data: jobs, error: fetchError } = await query;

	if (fetchError) {
		log.error({ err: fetchError }, 'Jobs fetch error');
		throw error(500, 'Failed to fetch jobs');
	}

	// 5. Generate signed URLs for image fields (buckets are private)
	if (jobs && jobs.length > 0) {
		for (const job of jobs) {
			// Sign product_image_url (original upload)
			const productInfo = extractStorageInfo(job.product_image_url);
			if (productInfo) {
				const { data: signedData } = await locals.supabase
					.storage
					.from(productInfo.bucket)
					.createSignedUrl(productInfo.path, 3600);
				if (signedData?.signedUrl) {
					job.product_image_url = signedData.signedUrl;
				}
			}

			// Sign output_image_url (finished result for completed jobs)
			const outputInfo = extractStorageInfo(job.output_image_url);
			if (outputInfo) {
				const { data: signedData } = await locals.supabase
					.storage
					.from(outputInfo.bucket)
					.createSignedUrl(outputInfo.path, 3600);
				if (signedData?.signedUrl) {
					job.output_image_url = signedData.signedUrl;
				}
			}
		}
	}

	// 6. Return jobs array wrapped in object for consistency
	return json({ jobs: jobs || [] });
};
