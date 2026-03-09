/**
 * Preset List API
 * GET /api/presets - List presets with filters, search, sorting, pagination
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiLogger } from '$lib/utils/logger';
import { createPresetSchema } from '$lib/validations/presets';
import { validatePresetContent } from '$lib/security/preset-validator';
import { moderatePresetContent } from '$lib/security/content-moderator';
import { env } from '$env/dynamic/private';

const log = apiLogger.child({ route: '/api/presets' });

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// Use server-authenticated Supabase client from hooks
		const supabase = locals.supabase;

		// Parse query parameters
		const mine = url.searchParams.get('mine') === 'true';
		const category = url.searchParams.get('category');
		const search = url.searchParams.get('search');
		const sortBy = url.searchParams.get('sort') || 'popular';
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = (page - 1) * limit;

		// If requesting user's own presets, authenticate first
		let userId: string | null = null;
		if (mine) {
			if (!locals.user) {
				throw error(401, 'Unauthorized - login required to view your presets');
			}
			userId = locals.user.id;
		}

		// Build query - include preset_config for user's own presets (needed for "Use this Vibe")
		const selectFields = mine
			? `
				preset_id,
				name,
				description,
				category,
				tags,
				thumbnail_url,
				preset_config,
				usage_count,
				created_at,
				updated_at,
				is_public,
				user_id
			`
			: `
				preset_id,
				name,
				description,
				category,
				tags,
				thumbnail_url,
				usage_count,
				created_at,
				user_id,
				profiles(display_name, avatar_url, trust_score, created_at)
			`;

		let query = supabase
			.from('presets')
			.select(selectFields, { count: 'exact' });

		// Filter: user's own presets (all, public + private) or public marketplace
		if (mine && userId) {
			query = query.eq('user_id', userId);
		} else {
			query = query.eq('is_public', true);
		}

		// Apply category filter
		if (category && category !== 'All') {
			query = query.eq('category', category);
		}

		// Apply search filter
		// SECURITY: Sanitize search input to prevent PostgREST operator injection
		// and escape LIKE metacharacters (%, _) to prevent pattern manipulation
		if (search && search.trim()) {
			const sanitizedSearch = search.trim()
				.replace(/[,()]/g, '')     // Remove commas, parens (PostgREST operators)
				.replace(/\.\w+\./g, '')   // Remove .operator. patterns (e.g., .eq., .gt.)
				.replace(/%/g, '\\%')      // Escape LIKE wildcard %
				.replace(/_/g, '\\_')      // Escape LIKE wildcard _
				.replace(/\\/g, '\\\\')    // Escape backslashes
				.substring(0, 100);        // Limit length to prevent abuse

			if (sanitizedSearch.length > 0) {
				query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
			}
		}

		// Apply sorting
		if (mine) {
			// User's own presets: default to most recently updated
			if (sortBy === 'name') {
				query = query.order('name', { ascending: true });
			} else if (sortBy === 'oldest') {
				query = query.order('created_at', { ascending: true });
			} else {
				// 'recent' or default
				query = query.order('updated_at', { ascending: false, nullsFirst: false });
			}
		} else if (sortBy === 'popular') {
			query = query.order('usage_count', { ascending: false });
		} else if (sortBy === 'recent') {
			query = query.order('created_at', { ascending: false });
		} else if (sortBy === 'top_rated') {
			// TODO: Implement rating system in Phase 2
			query = query.order('usage_count', { ascending: false });
		}

		// Apply pagination
		query = query.range(offset, offset + limit - 1);

		const { data, error: queryError, count } = await query;

		if (queryError) throw queryError;

		const totalPages = count ? Math.ceil(count / limit) : 1;

		// For public marketplace presets, enrich with favorites_count
		let enrichedData = data || [];
		if (!mine && enrichedData.length > 0) {
			const presetIds = enrichedData.map((p: any) => p.preset_id);
			const { data: favCounts, error: favError } = await supabase
				.from('user_favorites')
				.select('preset_id')
				.in('preset_id', presetIds);

			if (!favError && favCounts) {
				// Count favorites per preset
				const countMap = new Map<string, number>();
				for (const row of favCounts) {
					countMap.set(row.preset_id, (countMap.get(row.preset_id) ?? 0) + 1);
				}
				enrichedData = enrichedData.map((p: any) => ({
					...p,
					favorites_count: countMap.get(p.preset_id) ?? 0
				}));
			}
		}

		return json({
			success: true,
			data: enrichedData,
			pagination: {
				page,
				limit,
				total: count || 0,
				totalPages
			}
		});
	} catch (err: any) {
		log.error({ err }, 'List presets failed');
		throw error(500, 'Failed to load presets');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication (from hooks.server.ts - already validated JWT)
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized');
		}

		// 2. Parse and validate request body
		const body = await request.json();
		const parsed = createPresetSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}

		// 3. Content moderation — blocklist (sync) + AI (async)
		const presetConfig = parsed.data.preset_config as Record<string, unknown> | undefined;
		const contentFields = {
			name: parsed.data.name,
			description: parsed.data.description,
			tags: parsed.data.tags,
			ai_prompt: presetConfig?.ai_prompt as string | undefined,
		};

		const blocklistResult = validatePresetContent(contentFields);
		if (!blocklistResult.valid) {
			throw error(400, blocklistResult.reason || 'Content violates community guidelines');
		}

		const moderationResult = await moderatePresetContent(contentFields, env.ANTHROPIC_API_KEY || '');
		if (!moderationResult.approved) {
			throw error(400, moderationResult.reason || 'Content flagged by moderation');
		}

		// 4. Create preset
		const { data: preset, error: insertError } = await supabase
			.from('presets')
			.insert({
				user_id: user.id,
				name: parsed.data.name.trim(),
				description: parsed.data.description.trim(),
				category: parsed.data.category,
				tags: parsed.data.tags || [],
				thumbnail_url: parsed.data.thumbnail_url || null,
				preset_config: (parsed.data.preset_config ?? {}) as import('$lib/types/database').Json,
				is_public: parsed.data.is_public || false,
				usage_count: 0
			})
			.select()
			.single();

		if (insertError) throw insertError;

		return json({
			success: true,
			data: preset
		});
	} catch (err: any) {
		log.error({ err }, 'Create preset failed');
		if (err.status) throw err;
		throw error(500, 'Failed to create preset');
	}
};
