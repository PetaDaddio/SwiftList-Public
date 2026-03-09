/**
 * Single Preset API
 * GET /api/presets/[id] - Get single preset details
 * PATCH /api/presets/[id] - Update preset (owner only)
 * DELETE /api/presets/[id] - Delete preset (owner only)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiLogger } from '$lib/utils/logger';
import { updatePresetSchema } from '$lib/validations/presets';

const log = apiLogger.child({ route: 'api/presets/[id]' });


export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// SECURITY: Use locals.supabase (session-authenticated, not browser client)
		const supabase = locals.supabase;
		const { id } = params;

		// Get current user from hooks (already validated JWT)
		const user = locals.user;

		const { data: preset, error: queryError } = await supabase
			.from('presets')
			.select(
				`
				preset_id,
				name,
				description,
				category,
				tags,
				thumbnail_url,
				usage_count,
				created_at,
				updated_at,
				user_id,
				is_public,
				preset_config,
				profiles(display_name, avatar_url)
			`
			)
			.eq('preset_id', id)
			.single();

		if (queryError) throw queryError;

		// Check if preset is public or if user is the owner
		if (!preset.is_public && (!user || preset.user_id !== user.id)) {
			throw error(403, 'This preset is private');
		}

		return json({
			success: true,
			data: preset
		});
	} catch (err: any) {
		log.error({ err: err }, 'Get preset error');
		if (err.status) throw err;
		throw error(500, 'Failed to load preset');
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
		// 1. Authentication (from hooks.server.ts — already validated JWT)
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		const { id } = params;

		// 2. Verify ownership
		const { data: existingPreset, error: checkError } = await supabase
			.from('presets')
			.select('user_id')
			.eq('preset_id', id)
			.single();

		if (checkError) throw error(404, 'Preset not found');

		if (existingPreset.user_id !== user.id) {
			throw error(403, 'You can only edit your own presets');
		}

		// 3. Parse and validate request body
		const body = await request.json();
		const parsed = updatePresetSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}

		// 4. Update preset
		const updateData: Record<string, unknown> = {
			updated_at: new Date().toISOString()
		};

		if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
		if (parsed.data.description !== undefined) updateData.description = parsed.data.description.trim();
		if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
		if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
		if (parsed.data.is_public !== undefined) updateData.is_public = parsed.data.is_public;
		if (parsed.data.thumbnail_url !== undefined) updateData.thumbnail_url = parsed.data.thumbnail_url;
		if (parsed.data.preset_config !== undefined) updateData.preset_config = parsed.data.preset_config;

		const { data: updatedPreset, error: updateError } = await supabase
			.from('presets')
			.update(updateData)
			.eq('preset_id', id)
			.select()
			.single();

		if (updateError) throw updateError;

		return json({
			success: true,
			data: updatedPreset
		});
	} catch (err: any) {
		log.error({ err: err }, 'Update preset error');
		if (err.status) throw err;
		throw error(500, 'Failed to update preset');
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		// 1. Authentication (from hooks.server.ts — already validated JWT)
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		const { id } = params;

		// 2. Verify ownership
		const { data: existingPreset, error: checkError } = await supabase
			.from('presets')
			.select('user_id, thumbnail_url')
			.eq('preset_id', id)
			.single();

		if (checkError) throw error(404, 'Preset not found');

		if (existingPreset.user_id !== user.id) {
			throw error(403, 'You can only delete your own presets');
		}

		// 3. Delete preset
		const { error: deleteError } = await supabase.from('presets').delete().eq('preset_id', id);

		if (deleteError) throw deleteError;

		// 4. Delete thumbnail from storage if exists
		if (existingPreset.thumbnail_url) {
			try {
				const urlPath = new URL(existingPreset.thumbnail_url).pathname;
				const filePath = urlPath.split('/preset-thumbnails/')[1];
				if (filePath) {
					await supabase.storage.from('preset-thumbnails').remove([filePath]);
				}
			} catch (storageErr) {
				log.error({ err: storageErr }, 'Failed to delete thumbnail');
				// Non-critical error, continue
			}
		}

		return json({
			success: true,
			message: 'Preset deleted successfully'
		});
	} catch (err: any) {
		log.error({ err: err }, 'Delete preset error');
		if (err.status) throw err;
		throw error(500, 'Failed to delete preset');
	}
};
