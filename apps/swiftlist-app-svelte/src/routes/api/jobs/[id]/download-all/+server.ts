/**
 * Download All Outputs API Endpoint
 * GET /api/jobs/[id]/download-all
 *
 * Downloads all job outputs as a single ZIP file
 * SECURITY: Users can only download their own job outputs (enforced by RLS)
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import archiver from 'archiver';

export const GET: RequestHandler = async ({ params, locals }) => {
	// 1. Authentication check
	if (!locals.user) {
		throw error(401, 'Unauthorized - Please sign in');
	}

	const jobId = params.id;

	// 2. Validate job ID format
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(jobId)) {
		throw error(400, 'Invalid job ID format');
	}

	// 3. Fetch job to verify ownership (RLS enforces user can only access their own jobs)
	const { data: job, error: jobError } = await locals.supabase
		.from('jobs')
		.select('job_id, user_id, status')
		.eq('job_id', jobId)
		.single();

	if (jobError || !job) {
		throw error(404, 'Job not found');
	}

	// SECURITY: Explicit ownership check (defense-in-depth, supplements RLS)
	if (job.user_id !== locals.user.id) {
		throw error(403, 'Forbidden: You do not own this job');
	}

	if (job.status !== 'completed') {
		throw error(400, 'Job not completed yet');
	}

	// 4. Fetch all job outputs (RLS enforces ownership)
	const { data: outputs, error: outputsError } = await locals.supabase
		.from('job_outputs')
		.select('*')
		.eq('job_id', jobId)
		.order('marketplace', { ascending: true });

	if (outputsError) {
		throw error(500, 'Failed to fetch job outputs');
	}

	if (!outputs || outputs.length === 0) {
		throw error(404, 'No outputs found for this job');
	}

	// 5. Create ZIP archive in memory
	const archive = archiver('zip', {
		zlib: { level: 6 } // Compression level (0-9)
	});

	// 6. Download each output and add to ZIP
	let filesAdded = 0;
	for (const output of outputs) {
		try {
			let buffer: Buffer | null = null;
			const storagePath = (output as any).storage_path as string | undefined;

			// Method 1: Download from Supabase storage using storage_path
			if (storagePath) {
				const { data: fileData, error: downloadError } = await locals.supabase.storage
					.from('job-outputs')
					.download(storagePath);

				if (!downloadError && fileData) {
					buffer = Buffer.from(await fileData.arrayBuffer());
				}
			}

			// Method 2: Fallback — fetch from public output_url
			// Handles jobs where storage_path column doesn't exist yet
			if (!buffer && output.output_url) {
				const response = await fetch(output.output_url);
				if (response.ok) {
					buffer = Buffer.from(await response.arrayBuffer());
				}
			}

			if (buffer && buffer.length > 0) {
				const filename = output.filename || `product_${output.marketplace}_${output.dimensions || 'output'}.png`;
				archive.append(buffer, { name: filename });
				filesAdded++;
			}
		} catch {
			// Continue with other files
		}
	}

	if (filesAdded === 0) {
		throw error(500, 'Failed to download any output files');
	}

	// 7. Collect archive data — attach listeners BEFORE finalize to avoid race condition
	const chunks: Buffer[] = [];
	archive.on('data', (chunk: Buffer) => chunks.push(chunk));

	const archiveComplete = new Promise<void>((resolve, reject) => {
		archive.on('end', resolve);
		archive.on('error', reject);
	});

	// 8. Finalize the archive (must come AFTER listeners are attached)
	await archive.finalize();
	await archiveComplete;

	const zipBuffer = Buffer.concat(chunks);

	// 9. Return ZIP file as download
	return new Response(zipBuffer, {
		status: 200,
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="swiftlist-job-${jobId.slice(0, 8)}.zip"`,
			'Content-Length': zipBuffer.length.toString()
		}
	});
};
