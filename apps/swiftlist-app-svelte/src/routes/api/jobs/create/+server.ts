/**
 * Job Creation API Endpoint
 * POST /api/jobs/create
 *
 * Creates a new job from client-uploaded image URLs.
 * Images are uploaded directly from the browser to Supabase Storage;
 * this endpoint only receives the resulting URLs.
 *
 * SECURITY:
 * - Authentication required
 * - Input validation with Zod
 * - RLS enforces user ownership
 *
 * Flow:
 * 1. Validate user authentication
 * 2. Parse and validate request body (image URLs, not base64)
 * 3. Create job record in database
 * 4. Submit for processing
 * 5. Return job ID and status
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import crypto from 'crypto';
import { jobsLogger } from '$lib/utils/logger';
import { getWorkflowCost } from '$lib/queue/client';

const log = jobsLogger.child({ route: '/api/jobs/create' });

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const jobCreateSchema = z.object({
	// Product image URL (required) — uploaded client-side to Supabase Storage
	productImageUrl: z.string().url('Product image URL is required'),

	// Reference image URL (optional) — uploaded client-side to Supabase Storage
	referenceImageUrl: z.string().url().optional(),

	// Product details from classification
	productName: z.string().optional(),
	productType: z.string().optional(),

	// Enhancement selections
	enhancements: z.array(z.string()).optional().default([]),

	// Target marketplaces
	marketplaces: z.array(z.string()).optional().default([]),

	// Preset selection
	presetName: z.string().optional(),

	// Preset style prompt (detailed scene description from preset)
	presetStylePrompt: z.string().optional(),

	// Preset ID for Sparks tracking (UUID for community presets, numeric string for seed presets)
	presetId: z.string().optional(),

	// AI prompt (optional)
	aiPrompt: z.string().optional()
});

// ============================================================================
// API HANDLER
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication check
		if (!locals.user) {
			throw error(401, 'Unauthorized - Please sign in');
		}

		// 2. Parse and validate request body
		const body = await request.json();

		const parseResult = jobCreateSchema.safeParse(body);

		if (!parseResult.success) {
			throw error(400, 'Invalid request data: ' + JSON.stringify(parseResult.error.flatten()));
		}

		const validated = parseResult.data;

		// SECURITY: Check credit balance before creating job (VULN-10 fix)
		// Include potential Sparks cost (2 Sparks) if using someone else's preset
		const workflowCost = getWorkflowCost('WF-07');
		const sparksCost = validated.presetId ? 2 : 0;
		const creditsRequired = workflowCost + sparksCost;
		if (!locals.profile || locals.profile.credits_balance < creditsRequired) {
			throw error(402, 'Insufficient credits');
		}

		log.info({ userId: locals.user.id, enhancements: validated.enhancements, marketplaces: validated.marketplaces }, 'Job creation started');

		// 3. Generate job ID
		const jobId = crypto.randomUUID();

		// 4. SECURITY: Deduct credits FIRST via atomic RPC (prevents race condition double-spend)
		// Function returns the new balance (integer) for verification
		const { data: newBalance, error: rpcError } = await locals.supabase.rpc('deduct_credits', {
			p_user_id: locals.user.id,
			p_amount: creditsRequired,
			p_job_id: jobId
		} as any).single();

		if (rpcError) {
			log.error({ err: rpcError, userId: locals.user.id, creditsRequired, rpcCode: rpcError.code, rpcDetails: rpcError.details, rpcHint: rpcError.hint }, 'Credit deduction failed');
			throw error(402, 'Insufficient credits or deduction failed');
		}

		log.info({ userId: locals.user.id, creditsRequired, newBalance }, 'Credits deducted successfully');

		// 5. Auto-enable 'stylize-background' when a preset is selected
		const enhancements = validated.enhancements || [];
		if (validated.presetStylePrompt && !enhancements.includes('stylize-background')) {
			enhancements.push('stylize-background');
		}

		// 6. Prepare classification_details (store preset style prompt in existing JSONB column)
		const classificationDetails: Record<string, any> = {};
		if (validated.presetStylePrompt) {
			const sanitizedStylePrompt = validated.presetStylePrompt.trim().substring(0, 2000);
			classificationDetails.presetStylePrompt = sanitizedStylePrompt;
		}

		// 7. Create job record in database
		const { data: job, error: insertError } = await locals.supabase
			.from('jobs')
			.insert({
				job_id: jobId,
				user_id: locals.user.id,
				workflow_id: 'manual-job-creation',
				status: 'pending',
				product_name: validated.productName || 'Unknown Product',
				product_type: validated.productType || 'general',
				product_image_url: validated.productImageUrl,
				reference_image_url: validated.referenceImageUrl || null,
				enhancements: enhancements,
				marketplaces: validated.marketplaces,
				preset_name: validated.presetName,
				ai_prompt: validated.aiPrompt,
				classification_details: Object.keys(classificationDetails).length > 0 ? classificationDetails : {},
				error_message: null
			})
			.select()
			.single();

		if (insertError) {
			log.error({ err: insertError, jobId }, 'Job creation failed — refunding credits');
			// Refund credits since job wasn't created
			await locals.supabase.rpc('refund_credits', {
				p_user_id: locals.user.id,
				p_amount: creditsRequired,
				p_job_id: jobId
			} as any).single();
			throw error(500, 'Failed to create job');
		}

		// 8. Submit job for processing (fire-and-forget)
		try {
			const { submitBackgroundRemovalJob } = await import('$lib/queue/client');

			await submitBackgroundRemovalJob({
				jobId: jobId,
				userId: locals.user.id,
				workflowId: 'WF-07',
				inputUrl: validated.productImageUrl,
				parameters: {
					enhancements: enhancements,
					referenceImageUrl: validated.referenceImageUrl || null,
					presetName: validated.presetName,
					presetStylePrompt: classificationDetails.presetStylePrompt,
					aiPrompt: validated.aiPrompt
				}
			});

		} catch (queueError: any) {
			log.error({ err: queueError, jobId }, 'Job created but queue failed — refunding credits');

			// Mark job as failed
			await locals.supabase
				.from('jobs')
				.update({
					status: 'failed',
					error_message: 'Failed to queue job for processing',
					progress_message: 'Job failed to queue'
				})
				.eq('job_id', jobId);

			// Refund credits
			await locals.supabase.rpc('refund_credits', {
				p_user_id: locals.user.id,
				p_amount: creditsRequired,
				p_job_id: jobId
			} as any).single();

			throw error(500, 'Failed to queue job for processing');
		}

		// 9. Transfer Sparks to preset creator (non-fatal)
		if (validated.presetId) {
			try {
				const { data: sparksResult, error: sparksError } = await locals.supabase
					.rpc('transfer_preset_royalty', {
						p_user_id: locals.user.id,
						p_preset_id: validated.presetId,
						p_job_id: jobId
					} as any);
				if (sparksError) {
					log.warn({ err: sparksError, presetId: validated.presetId }, 'Sparks transfer failed (non-fatal)');
				} else {
					log.info({ sparksResult }, 'Sparks transfer result');
				}
			} catch (sparksErr: any) {
				log.warn({ err: sparksErr, presetId: validated.presetId }, 'Sparks transfer exception (non-fatal)');
			}
		}

		// 10. Return success response
		log.info({ jobId, userId: locals.user.id }, 'Job created successfully');
		return json({
			success: true,
			job_id: jobId,
			message: 'Job created successfully and submitted for processing',
			job: {
				id: jobId,
				status: 'pending',
				product_image_url: validated.productImageUrl,
				reference_image_url: validated.referenceImageUrl || null,
				created_at: job.created_at
			}
		});
	} catch (err: any) {
		log.error({ err }, 'Job creation failed');
		if (err.status) {
			throw err;
		}
		throw error(500, 'Failed to create job');
	}
};
