/**
 * CRM Bulk Sync Cron Endpoint
 * POST /api/cron/sync-crm
 *
 * Syncs all product activity (sparks, vibes, jobs, credits) from
 * swiftlist-production to swiftlist-crm for all linked users.
 *
 * SECURITY: Protected by a shared CRON_SECRET header.
 * Call this from Railway cron or an external scheduler.
 *
 * Usage:
 *   curl -X POST https://swiftlist.app/api/cron/sync-crm \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/client';
import { bulkSyncProductActivity } from '$lib/crm/sync';
import { apiLogger } from '$lib/utils/logger';

const log = apiLogger.child({ route: '/api/cron/sync-crm' });

export const POST: RequestHandler = async ({ request }) => {
	try {
		// SECURITY: Verify cron secret
		const authHeader = request.headers.get('authorization');
		const cronSecret = env.CRON_SECRET;

		if (!cronSecret) {
			log.error('CRON_SECRET not configured');
			throw error(500, 'Server configuration error');
		}

		if (authHeader !== `Bearer ${cronSecret}`) {
			log.warn('Unauthorized cron sync attempt');
			throw error(401, 'Unauthorized');
		}

		// Create production admin client for reading user data
		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			throw error(500, 'SUPABASE_SERVICE_ROLE_KEY not configured');
		}

		const productionClient = createServiceRoleClient(serviceRoleKey);

		const startTime = Date.now();
		const synced = await bulkSyncProductActivity(productionClient);
		const durationMs = Date.now() - startTime;

		log.info({ synced, durationMs }, 'CRM bulk sync completed');

		return json({
			success: true,
			synced,
			durationMs
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		log.error({ err }, 'CRM cron sync failed');
		throw error(500, 'Sync failed');
	}
};
