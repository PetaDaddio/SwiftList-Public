/**
 * Ensure Preset Exists API
 * POST /api/presets/ensure
 *
 * "Just-in-time" seeding: when a user tries to favorite a hardcoded seed preset
 * that doesn't exist in the database yet, this endpoint creates it first.
 *
 * - If a preset with the same name already exists → returns existing preset_id
 * - If it doesn't exist → inserts it under the SwiftList admin account
 *
 * SECURITY: Requires authentication. Uses a service role client to insert
 * seed presets under the admin account (bypasses RLS user_id constraint).
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { apiLogger } from '$lib/utils/logger';
import { ensurePresetSchema } from '$lib/validations/presets';
import { createServiceRoleClient } from '$lib/supabase/client';

const log = apiLogger.child({ route: '/api/presets/ensure' });

// SwiftList admin account — seed presets are attributed to this account
const ADMIN_USER_ID = 'ADMIN_UUID_PLACEHOLDER';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized - login required');
		}

		const body = await request.json();
		const parsed = ensurePresetSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}

		const { name, category, stylePrompt, description, backgroundColor, tags, thumbnailUrl } =
			parsed.data;

		// Use the user's client to check existence (respects RLS for reads)
		const supabase = locals.supabase;

		// Check if this seed preset already exists in DB (by name)
		const { data: existing } = await supabase
			.from('presets')
			.select('preset_id')
			.eq('name', name)
			.eq('is_public', true)
			.maybeSingle();

		if (existing) {
			// Already exists — return its preset_id
			return json({
				success: true,
				preset_id: existing.preset_id,
				created: false
			});
		}

		// Use service role client to insert under the admin account (bypasses RLS)
		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			log.error('SUPABASE_SERVICE_ROLE_KEY not configured');
			throw error(500, 'Server configuration error');
		}

		const adminClient = createServiceRoleClient(serviceRoleKey);

		const { data: preset, error: insertError } = await adminClient
			.from('presets')
			.insert({
				user_id: ADMIN_USER_ID,
				name: name.trim(),
				description: description || stylePrompt.substring(0, 200),
				category,
				tags: tags || [],
				thumbnail_url: thumbnailUrl || null,
				preset_config: {
					ai_prompt: stylePrompt,
					background_color: backgroundColor || null
				},
				is_public: true,
				usage_count: 0
			})
			.select('preset_id')
			.single();

		if (insertError) {
			// Handle race condition: if another request just inserted it
			if (insertError.code === '23505') {
				const { data: raceExisting } = await supabase
					.from('presets')
					.select('preset_id')
					.eq('name', name)
					.eq('is_public', true)
					.maybeSingle();

				if (raceExisting) {
					return json({
						success: true,
						preset_id: raceExisting.preset_id,
						created: false
					});
				}
			}
			throw insertError;
		}

		log.info({ presetName: name, presetId: preset.preset_id }, 'Seed preset auto-created');

		return json({
			success: true,
			preset_id: preset.preset_id,
			created: true
		});
	} catch (err: any) {
		log.error({ err }, 'Ensure preset failed');
		if (err.status) throw err;
		throw error(500, 'Failed to ensure preset exists');
	}
};
