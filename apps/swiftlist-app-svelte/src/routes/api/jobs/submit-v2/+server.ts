/**
 * Job Submission API Endpoint (BullMQ Version)
 * POST /api/jobs/submit-v2
 *
 * Creates a new job, deducts credits, and adds to BullMQ queue
 * REPLACES n8n webhook with BullMQ worker system
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jobSubmissionSchema } from '$lib/validations/jobs';
import { submitJob, getWorkflowCost, getWorkflowMetadata } from '$lib/queue/client';
import crypto from 'crypto';
import { jobsLogger } from '$lib/utils/logger';

const log = jobsLogger.child({ route: 'api/jobs/submit-v2' });


export const POST: RequestHandler = async ({ request, locals }) => {
	// 1. Authentication check
	if (!locals.user) {
		throw error(401, 'Unauthorized - Please sign in');
	}

	if (!locals.profile) {
		throw error(403, 'Profile not found');
	}

	// 2. Parse and validate request body
	const body = await request.json();
	const parseResult = jobSubmissionSchema.safeParse(body);

	if (!parseResult.success) {
		throw error(400, 'Invalid request data: ' + JSON.stringify(parseResult.error.flatten()));
	}

	const validated = parseResult.data;

	// 3. SERVER-SIDE credit cost calculation (NEVER trust client)
	const creditsRequired = getWorkflowCost(validated.workflow_id);

	// Validate workflow ID
	const workflowMetadata = getWorkflowMetadata(validated.workflow_id);
	if (!workflowMetadata) {
		throw error(400, `Invalid workflow ID: ${validated.workflow_id}`);
	}

	// 4. Advisory balance check (real enforcement is in the atomic RPC below)
	if (locals.profile.credits_balance < creditsRequired) {
		throw error(402, 'Insufficient credits');
	}

	// 5. Create job ID
	const jobId = crypto.randomUUID();

	// 6. SECURITY: Deduct credits FIRST via atomic RPC (prevents race condition double-spend)
	const { error: rpcError } = await locals.supabase.rpc('deduct_credits', {
		p_user_id: locals.user.id,
		p_amount: creditsRequired,
		p_job_id: jobId
	} as any);

	if (rpcError) {
		log.error({ err: rpcError }, 'Credit deduction error');
		throw error(402, 'Insufficient credits or deduction failed');
	}

	// 7. Create job in database (credits already deducted)
	const { data: job, error: insertError } = await locals.supabase
		.from('jobs')
		.insert({
			job_id: jobId,
			user_id: locals.user.id,
			workflow_id: validated.workflow_id,
			status: 'pending' as const,
			product_name: 'Processing',
			product_type: 'general',
			product_image_url: String(validated.input_data?.image_url || '')
		} as any)
		.select()
		.single();

	if (insertError) {
		log.error({ err: insertError }, 'Job creation error');

		// Refund credits since job wasn't created
		await locals.supabase.rpc('refund_credits', {
			p_user_id: locals.user.id,
			p_amount: creditsRequired,
			p_job_id: jobId
		});

		throw error(500, 'Failed to create job');
	}

	// 8. Add job to BullMQ queue (REPLACES n8n webhook)
	try {
		await submitJob(
			'swiftlist-jobs',
			{
				jobId: jobId,
				userId: locals.user.id,
				workflowId: validated.workflow_id,
				inputUrl: String(validated.input_data?.image_url || '')
			},
			{
				// Premium users get higher priority
				priority: locals.profile.subscription_tier === 'agency' ? 1 :
				          locals.profile.subscription_tier === 'merchant' ? 2 :
				          locals.profile.subscription_tier === 'maker' ? 3 : 4
			}
		);

	} catch (queueError) {
		log.error({ err: queueError }, 'Queue error');

		// Mark job as failed
		await locals.supabase
			.from('jobs')
			.update({
				status: 'failed',
				error_message: 'Failed to queue job',
				progress_message: 'Job failed to queue'
			})
			.eq('job_id', jobId);

		// Refund credits
		await locals.supabase.rpc('refund_credits', {
			p_user_id: locals.user.id,
			p_amount: creditsRequired,
			p_job_id: jobId
		});

		throw error(500, 'Failed to queue job');
	}

	return json({
		success: true,
		job_id: jobId,
		workflow_name: workflowMetadata.name,
		status: 'pending',
		credits_deducted: creditsRequired,
		remaining_credits: locals.profile.credits_balance - creditsRequired,
		estimated_completion_time: '2-5 minutes'
	});
};
