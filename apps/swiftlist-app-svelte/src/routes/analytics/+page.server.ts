import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	try {
		const supabase = locals.supabase;
		const userId = locals.user.id;

		// Fetch user's public presets with usage counts
		const { data: userPresets, error: presetsError } = await supabase
			.from('presets')
			.select('preset_id, name, usage_count, created_at, is_public')
			.eq('user_id', userId)
			.eq('is_public', true)
			.order('usage_count', { ascending: false });

		if (presetsError) {
			console.error('Failed to fetch user presets:', presetsError);
		}

		// Fetch royalty stats via RPC
		let royaltyStats = null;
		try {
			const { data: royaltyData, error: royaltyError } = await supabase.rpc(
				'get_creator_royalty_stats',
				{ p_user_id: userId } as any
			);
			if (!royaltyError && royaltyData) {
				royaltyStats = royaltyData?.[0] ?? royaltyData;
			}
		} catch {
			// Royalty stats are non-critical
		}

		// Fetch detailed usage from preset_usage table for user's presets
		const presetIds = (userPresets || []).map((p) => p.preset_id);
		let usageDetails: any[] = [];
		if (presetIds.length > 0) {
			const { data: usageData } = await supabase
				.from('preset_usage')
				.select('preset_id, used_at')
				.in('preset_id', presetIds)
				.order('used_at', { ascending: false })
				.limit(500);
			usageDetails = usageData || [];
		}

		// Fetch favorites count for user's presets
		let favoritesCount = 0;
		if (presetIds.length > 0) {
			const { count } = await supabase
				.from('user_favorites')
				.select('*', { count: 'exact', head: true })
				.in('preset_id', presetIds);
			favoritesCount = count || 0;
		}

		// Compute aggregate stats
		const presets = userPresets || [];
		const totalUsage = presets.reduce((sum, p) => sum + (p.usage_count || 0), 0);
		const topPreset = presets.length > 0 ? presets[0].name : 'None yet';
		const creditsEarned = royaltyStats?.total_earned ?? 0;

		// Compute per-preset performance with usage details
		const presetPerformance = presets.map((p) => {
			const presetUsages = usageDetails.filter((u) => u.preset_id === p.preset_id);
			return {
				id: p.preset_id,
				name: p.name,
				usage: p.usage_count || 0,
				recentUsage: presetUsages.length,
				createdAt: p.created_at
			};
		});

		return {
			stats: {
				totalPresets: presets.length,
				totalUsage,
				creditsEarned,
				topPreset,
				favoritesCount
			},
			presetPerformance,
			royaltyStats
		};
	} catch (err) {
		console.error('Analytics load failed:', err);
		return {
			stats: {
				totalPresets: 0,
				totalUsage: 0,
				creditsEarned: 0,
				topPreset: 'None yet',
				favoritesCount: 0
			},
			presetPerformance: [],
			royaltyStats: null
		};
	}
};
