/**
 * Job Validation Schemas
 * Using Zod for runtime type validation
 *
 * SECURITY: All user inputs must be validated before processing
 */

import { z } from 'zod';

// Allowed file types for image upload
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Minimum pixel dimension (shortest side).
// eBay output is 1600×1600 — below 500px even AI upscaling produces visible artefacts.
// Most real product photos from phones are 3000px+; this only blocks thumbnails / web-scraped images.
export const MIN_IMAGE_DIMENSION = 500;

export const createJobSchema = z.object({
	workflow_id: z.literal('WF-04', {
		message: 'Invalid workflow. Only background removal (WF-04) is available in MVP.'
	}),
	image_url: z.string().url('Invalid image URL'),
	marketplace: z.enum(['ebay', 'etsy', 'amazon', 'shopify', 'none']).optional(),
	preset_id: z.string().uuid().optional()
});

export const jobSubmissionSchema = z.object({
	workflow_id: z.string().min(1, 'Workflow ID is required'),
	input_data: z.record(z.string(), z.unknown()),
	image_url: z.string().url('Invalid image URL').optional()
});

export const jobStatusSchema = z.object({
	job_id: z.string().uuid('Invalid job ID format')
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type JobSubmission = z.infer<typeof jobSubmissionSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;

// File validation helper
export function validateImageFile(file: File): { valid: boolean; error?: string } {
	if (!ALLOWED_FILE_TYPES.includes(file.type)) {
		return {
			valid: false,
			error: 'Invalid file type. Please upload JPG, PNG, or WebP images only.'
		};
	}

	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: 'File is too large. Maximum size is 10MB.'
		};
	}

	return { valid: true };
}

/**
 * Checks that an image file meets the minimum pixel dimension requirement.
 * Must be called client-side (uses the Web API createImageBitmap).
 *
 * Kept separate from validateImageFile() so the sync type/size check can
 * still fail fast without needing to decode the image.
 */
export async function validateImageDimensions(
	file: File
): Promise<{ valid: boolean; error?: string; width?: number; height?: number }> {
	try {
		const bitmap = await createImageBitmap(file);
		const { width, height } = bitmap;
		bitmap.close(); // free GPU memory immediately

		const shortest = Math.min(width, height);
		if (shortest < MIN_IMAGE_DIMENSION) {
			return {
				valid: false,
				width,
				height,
				error: `Image is too small (${width}×${height}px). Please upload a photo that is at least ${MIN_IMAGE_DIMENSION}px on the shortest side.`
			};
		}

		return { valid: true, width, height };
	} catch {
		// createImageBitmap failed to decode — pass through and let the server handle it
		return { valid: true };
	}
}
