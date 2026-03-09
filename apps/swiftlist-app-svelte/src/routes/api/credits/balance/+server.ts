/**
 * Credits Balance API Endpoint
 * GET /api/credits/balance
 *
 * Retrieves user's current credit balance
 * SECURITY: Only returns balance for authenticated user (enforced by RLS)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { creditsLogger } from '$lib/utils/logger';

const log = creditsLogger.child({ route: '/api/credits/balance' });

export const GET: RequestHandler = async ({ locals }) => {
	// 1. Authentication check
	if (!locals.user) {
		throw error(401, 'Unauthorized - Please sign in');
	}

	// 2. Fetch user's profile with credit balance (RLS ensures user can only access their own profile)
	const { data: profile, error: fetchError } = await locals.supabase
		.from('profiles')
		.select('credits_balance')
		.eq('user_id', locals.user.id)
		.single();

	if (fetchError) {
		log.error({ err: fetchError, userId: locals.user.id }, 'Credit balance fetch failed');
		throw error(500, 'Failed to fetch credit balance');
	}

	// 3. Return credit balance
	return json({
		success: true,
		balance: profile.credits_balance
	});
};
