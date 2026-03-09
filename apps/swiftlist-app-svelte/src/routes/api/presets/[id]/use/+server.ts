/**
 * Use Preset API
 * POST /api/presets/[id]/use - Track preset usage and increment counter
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiLogger } from '$lib/utils/logger';
import { usePresetSchema } from '$lib/validations/presets';

const log = apiLogger.child({ route: 'api/presets/[id]/use' });


export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		// 1. Authentication (from hooks.server.ts — already validated JWT)
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		const { id } = params;

		// 2. Parse and validate request body
		const body = await request.json();
		const parsed = usePresetSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}
		const { job_id } = parsed.data;

		// 3. Verify preset exists and is accessible
		const { data: preset, error: presetError } = await supabase
			.from('presets')
			.select('preset_id, user_id, is_public, preset_config')
			.eq('preset_id', id)
			.single();

		if (presetError) throw error(404, 'Preset not found');

		// Check if preset is public or if user is the owner
		if (!preset.is_public && preset.user_id !== user.id) {
			throw error(403, 'This preset is private');
		}

		// 4. Increment usage count
		const { error: updateError } = await supabase.rpc('increment_preset_usage', {
			p_preset_id: id
		});

		if (updateError) {
			log.error({ err: updateError }, 'Failed to increment usage count');
			// Non-critical error, continue
		}

		// 5. Track usage in preset_usage table (for Sparks calculations)
		const { error: trackError } = await supabase.from('preset_usage').insert({
			preset_id: id,
			user_id: user.id,
			job_id: job_id,
			used_at: new Date().toISOString()
		});

		if (trackError) {
			log.error({ err: trackError }, 'Failed to track usage');
			// Non-critical error, continue
		}

		// 6. Return preset configuration for the job
		return json({
			success: true,
			data: {
				preset_id: preset.preset_id,
				preset_config: preset.preset_config
			}
		});
	} catch (err: any) {
		log.error({ err: err }, 'Use preset error');
		if (err.status) throw err;
		throw error(500, 'Failed to use preset');
	}
};
