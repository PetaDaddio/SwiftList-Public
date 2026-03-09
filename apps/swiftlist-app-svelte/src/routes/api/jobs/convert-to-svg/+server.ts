/**
 * Convert to SVG API Endpoint
 * POST /api/jobs/convert-to-svg
 *
 * Converts a raster image (PNG/JPG/WebP) to SVG vector format
 * using bitmap-to-path tracing (dependency-free approach).
 *
 * Supports mono (single black path) and color (multi-color paths via K-means) modes.
 * Uploads resulting SVG to Supabase Storage and returns compression metrics.
 *
 * SECURITY:
 * - Authentication required
 * - Input validation with Zod
 * - Rate limiting via hooks.server.ts
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/client';
import { jobsLogger } from '$lib/utils/logger';
import { validateImageUrl } from '$lib/security/url-validator';
import {
	toBinaryBitmap,
	toBinaryBitmapForColor,
	traceContours,
	simplifyPath,
	contoursToSvgPaths,
	quantizeColors,
	generateMonoSvg,
	generateColorSvg
} from '$lib/utils/svg-tracer';

const log = jobsLogger.child({ route: '/api/jobs/convert-to-svg' });

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const convertToSvgSchema = z.object({
	image_url: z.string().url('Valid image URL is required'),
	mode: z.enum(['simple', 'detailed']).default('simple'),
	color_mode: z.enum(['mono', 'color']).default('mono')
});

// ============================================================================
// ENDPOINT HANDLER
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication
		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			log.error('SUPABASE_SERVICE_ROLE_KEY not configured');
			throw error(500, 'Server configuration error');
		}

		const supabase = createServiceRoleClient(serviceRoleKey);
		const authHeader = request.headers.get('authorization');
		let userId: string;
		if (!authHeader?.startsWith('Bearer ')) {
			if (!(locals as any).user) {
				throw error(401, 'Authentication required');
			}
			userId = (locals as any).user.id;
		} else {
			const token = authHeader.split(' ')[1];
			const { data: { user }, error: authError } = await supabase.auth.getUser(token);
			if (authError || !user) {
				throw error(401, 'Invalid or expired token');
			}
			userId = user.id;
		}

		// 2. Input validation
		const body = await request.json();
		const validated = convertToSvgSchema.parse(body);
		const { image_url, mode, color_mode } = validated;

		// SECURITY: SSRF protection — only allow Supabase Storage URLs
		const urlCheck = validateImageUrl(image_url);
		if (!urlCheck.valid) {
			throw error(400, urlCheck.error || 'Invalid image URL');
		}

		log.info({ mode, color_mode }, 'Starting SVG conversion');

		// 3. Fetch the source image
		const imageResponse = await fetch(image_url);
		if (!imageResponse.ok) {
			throw error(400, 'Failed to fetch source image');
		}
		const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
		const originalSizeBytes = imageBuffer.length;

		// 4. Use sharp to get raw pixel data
		const sharp = (await import('sharp')).default;
		const { data: pixels, info } = await sharp(imageBuffer)
			.resize({ width: mode === 'simple' ? 512 : 1024, fit: 'inside' })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const { width, height } = info;
		const pixelData = new Uint8Array(pixels);

		let svg: string;
		let totalPaths: number;

		if (color_mode === 'color') {
			// Multi-color mode: K-means quantization → per-color tracing
			const numColors = mode === 'simple' ? 4 : 8;
			const colors = quantizeColors(pixelData, width, height, numColors);
			const tolerance = mode === 'simple' ? 60 : 40;
			const epsilon = mode === 'simple' ? 2.0 : 1.0;
			const minContourSize = mode === 'simple' ? 10 : 5;

			const colorPaths: { color: string; pathData: string }[] = [];
			totalPaths = 0;

			for (const cluster of colors) {
				const bitmap = toBinaryBitmapForColor(pixelData, width, height, cluster, tolerance);
				let contours = traceContours(bitmap, width, height);
				contours = contours.map((c) => simplifyPath(c, epsilon));
				contours = contours.filter((c) => c.length >= minContourSize);
				totalPaths += contours.length;
				const pathData = contoursToSvgPaths(contours);
				if (pathData) {
					colorPaths.push({ color: cluster.hex, pathData });
				}
			}

			svg = generateColorSvg(colorPaths, width, height);
		} else {
			// Mono mode: single black path (original behavior)
			const threshold = mode === 'simple' ? 128 : 80;
			const bitmap = toBinaryBitmap(pixelData, width, height, threshold);
			let contours = traceContours(bitmap, width, height);

			const epsilon = mode === 'simple' ? 2.0 : 1.0;
			contours = contours.map((c) => simplifyPath(c, epsilon));

			const minContourSize = mode === 'simple' ? 10 : 5;
			contours = contours.filter((c) => c.length >= minContourSize);

			totalPaths = contours.length;
			const pathData = contoursToSvgPaths(contours);
			svg = generateMonoSvg(pathData, width, height);
		}

		// 5. Upload SVG to Supabase Storage
		const svgBuffer = Buffer.from(svg, 'utf-8');
		const svgSizeBytes = svgBuffer.length;
		const fileName = `svg-${Date.now()}.svg`;
		const storagePath = `${userId}/processed/${fileName}`;

		const { error: uploadError } = await supabase.storage
			.from('job-outputs')
			.upload(storagePath, svgBuffer, {
				contentType: 'image/svg+xml',
				upsert: false
			});

		let outputUrl: string | null = null;
		if (uploadError) {
			log.warn({ err: uploadError }, 'Failed to upload SVG to storage, returning inline only');
		} else {
			const { data: urlData } = supabase.storage
				.from('job-outputs')
				.getPublicUrl(storagePath);
			outputUrl = urlData.publicUrl;
		}

		// 6. Calculate compression metrics
		const compressionRatio = originalSizeBytes > 0
			? `${Math.round((1 - svgSizeBytes / originalSizeBytes) * 100)}%`
			: '0%';

		log.info(
			{ paths: totalPaths, mode, color_mode, width, height, originalSizeBytes, svgSizeBytes, compressionRatio },
			'SVG conversion complete'
		);

		return json({
			success: true,
			svg,
			output_url: outputUrl,
			paths: totalPaths,
			color_mode,
			original_size_bytes: originalSizeBytes,
			svg_size_bytes: svgSizeBytes,
			compression_ratio: compressionRatio
		});
	} catch (err: any) {
		if (err.status) throw err;

		log.error({ err }, 'SVG conversion failed');
		throw error(500, 'SVG conversion failed');
	}
};
