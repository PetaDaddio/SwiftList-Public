/**
 * Profile Server Load
 * Fetches profile data server-side for OG meta tags (social sharing)
 */

export const load = async ({ params, locals }) => {
	const { user_id } = params;

	try {
		const supabase = locals.supabase;

		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('user_id, display_name, avatar_url, twitter_url, instagram_url, tiktok_url, website_url, created_at')
			.eq('user_id', user_id)
			.single();

		if (profileError || !profile) {
			return { profile: null, presetCount: 0, totalUsage: 0 };
		}

		// Get aggregate stats for OG description
		const { count } = await supabase
			.from('presets')
			.select('preset_id', { count: 'exact', head: true })
			.eq('user_id', user_id)
			.eq('is_public', true);

		return {
			profile,
			presetCount: count || 0,
			totalUsage: 0
		};
	} catch {
		return { profile: null, presetCount: 0, totalUsage: 0 };
	}
};
