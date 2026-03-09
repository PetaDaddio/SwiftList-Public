/**
 * Sparks Stats API Endpoint
 * GET /api/credits/sparks
 *
 * Returns the current user's Sparks earnings stats (total, this month, cap).
 * SECURITY: Only returns stats for authenticated user via RPC with their user ID.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { creditsLogger } from '$lib/utils/logger';

const log = creditsLogger.child({ route: '/api/credits/sparks' });

export const GET: RequestHandler = async ({ locals }) => {
	// 1. Authentication check
	if (!locals.user) {
		throw error(401, 'Unauthorized - Please sign in');
	}

	try {
		// 2. Call RPC to get Sparks stats
		const { data, error: rpcError } = await locals.supabase
			.rpc('get_creator_royalty_stats', {
				p_user_id: locals.user.id
			} as any);

		if (rpcError) {
			log.error({ err: rpcError, userId: locals.user.id }, 'Sparks stats fetch failed');
			throw error(500, 'Failed to fetch Sparks stats');
		}

		// 3. Return stats (RPC returns array, take first row)
		const stats = data?.[0];
		return json({
			success: true,
			total_earned: stats?.total_earned ?? 0,
			this_month: stats?.this_month ?? 0,
			monthly_cap: stats?.monthly_cap ?? 500
		});
	} catch (err: any) {
		if (err.status) throw err;
		log.error({ err, userId: locals.user.id }, 'Sparks stats error');
		throw error(500, 'Failed to fetch Sparks stats');
	}
};
