/**
 * Report Preset API
 * POST /api/presets/[id]/report - Report a preset for content violation
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiLogger } from '$lib/utils/logger';
import { reportSchema } from '$lib/validations/presets';

const log = apiLogger.child({ route: '/api/presets/[id]/report' });

export const POST: RequestHandler = async ({ request, params, locals }) => {
	try {
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		const body = await request.json();
		const parsed = reportSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}

		const presetId = params.id;

		// Verify preset exists and is public
		const { data: preset, error: presetError } = await supabase
			.from('presets')
			.select('preset_id, is_public, user_id')
			.eq('preset_id', presetId)
			.single();

		if (presetError || !preset) {
			throw error(404, 'Preset not found');
		}

		if (!preset.is_public) {
			throw error(400, 'Cannot report a private preset');
		}

		// Prevent self-reporting
		if (preset.user_id === user.id) {
			throw error(400, 'Cannot report your own preset');
		}

		// Insert report (UNIQUE constraint handles duplicates)
		const { error: insertError } = await supabase
			.from('preset_reports')
			.insert({
				reporter_id: user.id,
				preset_id: presetId,
				reason: parsed.data.reason
			});

		if (insertError) {
			if (insertError.code === '23505') {
				return json({ success: true, message: 'You have already reported this preset' });
			}
			throw insertError;
		}

		// DB trigger auto_hide_reported_preset handles hiding at 3+ reports

		return json({ success: true });
	} catch (err: any) {
		log.error({ err }, 'Report preset failed');
		if (err.status) throw err;
		throw error(500, 'Failed to report preset');
	}
};
