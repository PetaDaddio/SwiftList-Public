/**
 * Profile Update API Endpoint
 * POST /api/profile/update
 *
 * Updates user's display_name and/or avatar_url.
 *
 * SECURITY:
 * - Authentication required (locals.user from hooks.server.ts)
 * - Input validation with Zod
 * - RLS enforces user can only update own profile
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { apiLogger } from '$lib/utils/logger';
import { syncContactToCrm } from '$lib/crm/sync';

const log = apiLogger.child({ route: 'profile/update' });

const updateProfileSchema = z.object({
	display_name: z.string().min(1, 'Display name is required').max(50, 'Display name too long').trim(),
	avatar_url: z.string().url('Invalid avatar URL').nullable().optional(),
	twitter_url: z.string().url('Invalid Twitter URL').nullable().optional(),
	instagram_url: z.string().url('Invalid Instagram URL').nullable().optional(),
	tiktok_url: z.string().url('Invalid TikTok URL').nullable().optional(),
	website_url: z.string().url('Invalid website URL').nullable().optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication
		const user = locals.user;
		if (!user) {
			log.warn('Unauthenticated profile update attempt');
			throw error(401, 'Unauthorized');
		}

		// 2. Input validation
		const body = await request.json();
		const validated = updateProfileSchema.parse(body);

		log.info({ userId: user.id }, 'Profile update request');

		// 3. Build update payload
		const updatePayload: Record<string, unknown> = {
			display_name: validated.display_name
		};
		if (validated.avatar_url !== undefined) updatePayload.avatar_url = validated.avatar_url;
		if (validated.twitter_url !== undefined) updatePayload.twitter_url = validated.twitter_url;
		if (validated.instagram_url !== undefined) updatePayload.instagram_url = validated.instagram_url;
		if (validated.tiktok_url !== undefined) updatePayload.tiktok_url = validated.tiktok_url;
		if (validated.website_url !== undefined) updatePayload.website_url = validated.website_url;

		// 4. Update profile (RLS ensures user can only update own profile)
		const { data, error: dbError } = await locals.supabase
			.from('profiles')
			.update(updatePayload)
			.eq('user_id', user.id)
			.select()
			.single();

		if (dbError) {
			log.error({ error: dbError, userId: user.id }, 'Profile update failed');
			throw error(500, 'Failed to update profile');
		}

		log.info({ userId: user.id }, 'Profile updated successfully');

		// 5. Fire-and-forget CRM sync with social links
		syncContactToCrm({
			email: user.email!,
			display_name: validated.display_name,
			avatar_url: validated.avatar_url ?? undefined,
			twitter_url: validated.twitter_url ?? undefined,
			instagram_url: validated.instagram_url ?? undefined,
			tiktok_url: validated.tiktok_url ?? undefined,
			website_url: validated.website_url ?? undefined
		}).catch(() => {}); // CRM is not critical path

		return json({ success: true, profile: data });
	} catch (err: any) {
		if (err.status) throw err;

		// Zod validation errors
		if (err.name === 'ZodError') {
			return json(
				{ error: 'Validation failed', details: err.errors },
				{ status: 400 }
			);
		}

		log.error({ error: err.message }, 'Unexpected profile update error');
		throw error(500, 'Failed to update profile');
	}
};
