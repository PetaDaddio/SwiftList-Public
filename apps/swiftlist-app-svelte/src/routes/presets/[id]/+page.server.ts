/**
 * Preset Detail Server Load
 * Fetches preset data server-side for OG meta tags (social sharing)
 * and page rendering.
 */

export const load = async ({ params, locals }) => {
	const { id } = params;

	// Only attempt DB lookup for UUID-style IDs (community presets)
	// Seed presets use numeric IDs and aren't in DB until JIT-created
	const isUuid = id.length > 10 && id.includes('-');

	if (!isUuid) {
		return { preset: null };
	}

	try {
		const supabase = locals.supabase;

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
				profiles(display_name, avatar_url)
			`
			)
			.eq('preset_id', id)
			.single();

		if (queryError || !preset) {
			return { preset: null };
		}

		// Only return public presets for unauthenticated OG crawlers
		if (!preset.is_public) {
			const user = locals.user;
			if (!user || preset.user_id !== user.id) {
				return { preset: null };
			}
		}

		return { preset };
	} catch {
		return { preset: null };
	}
};
