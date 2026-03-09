/**
 * Favorites API
 * GET /api/favorites - List user's favorited presets (with preset details)
 * POST /api/favorites - Add a preset to favorites
 * DELETE /api/favorites - Remove a preset from favorites
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiLogger } from '$lib/utils/logger';
import { favoriteSchema } from '$lib/validations/presets';

const log = apiLogger.child({ route: '/api/favorites' });

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized - login required to view favorites');
		}

		// Fetch user's favorites with preset details and creator profile
		const { data, error: queryError } = await supabase
			.from('user_favorites')
			.select(
				`
				id,
				preset_id,
				created_at,
				presets (
					preset_id,
					name,
					description,
					category,
					tags,
					thumbnail_url,
					preset_config,
					usage_count,
					created_at,
					user_id,
					profiles(display_name, avatar_url)
				)
			`
			)
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });

		if (queryError) throw queryError;

		return json({
			success: true,
			data: data || []
		});
	} catch (err: any) {
		log.error({ err }, 'List favorites failed');
		if (err.status) throw err;
		throw error(500, 'Failed to load favorites');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		const body = await request.json();
		const parsed = favoriteSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}

		// Verify the preset exists and is public (or owned by user)
		const { data: preset, error: presetError } = await supabase
			.from('presets')
			.select('preset_id, is_public, user_id')
			.eq('preset_id', parsed.data.preset_id)
			.single();

		if (presetError || !preset) {
			throw error(404, 'Preset not found');
		}

		if (!preset.is_public && preset.user_id !== user.id) {
			throw error(403, 'Cannot favorite a private preset you do not own');
		}

		// Insert favorite (UNIQUE constraint handles duplicates)
		const { data, error: insertError } = await supabase
			.from('user_favorites')
			.insert({
				user_id: user.id,
				preset_id: parsed.data.preset_id
			})
			.select()
			.single();

		if (insertError) {
			// Handle duplicate gracefully (already favorited)
			if (insertError.code === '23505') {
				return json({ success: true, alreadyFavorited: true });
			}
			throw insertError;
		}

		return json({
			success: true,
			data
		});
	} catch (err: any) {
		log.error({ err }, 'Add favorite failed');
		if (err.status) throw err;
		throw error(500, 'Failed to add favorite');
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		const body = await request.json();
		const parsed = favoriteSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}

		// Delete favorite (RLS ensures user can only delete their own)
		const { error: deleteError } = await supabase
			.from('user_favorites')
			.delete()
			.eq('user_id', user.id)
			.eq('preset_id', parsed.data.preset_id);

		if (deleteError) throw deleteError;

		return json({
			success: true
		});
	} catch (err: any) {
		log.error({ err }, 'Remove favorite failed');
		if (err.status) throw err;
		throw error(500, 'Failed to remove favorite');
	}
};
