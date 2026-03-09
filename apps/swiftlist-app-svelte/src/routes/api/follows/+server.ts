/**
 * Follows API
 * GET /api/follows - List users the current user follows
 * POST /api/follows - Follow a user
 * DELETE /api/follows - Unfollow a user
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiLogger } from '$lib/utils/logger';
import { followSchema } from '$lib/validations/presets';

const log = apiLogger.child({ route: '/api/follows' });

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const supabase = locals.supabase;
		const user = locals.user;

		if (!user) {
			throw error(401, 'Unauthorized - login required');
		}

		const { data, error: queryError } = await supabase
			.from('user_follows')
			.select(`
				following_id,
				created_at,
				profiles!user_follows_following_fkey(display_name, avatar_url)
			`)
			.eq('follower_id', user.id)
			.order('created_at', { ascending: false });

		if (queryError) throw queryError;

		return json({
			success: true,
			data: data || []
		});
	} catch (err: any) {
		log.error({ err }, 'List follows failed');
		if (err.status) throw err;
		throw error(500, 'Failed to load follows');
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
		const parsed = followSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}

		const { following_id } = parsed.data;

		// Prevent self-follow
		if (following_id === user.id) {
			throw error(400, 'Cannot follow yourself');
		}

		// Verify target user exists
		const { data: targetProfile, error: profileError } = await supabase
			.from('profiles')
			.select('user_id')
			.eq('user_id', following_id)
			.single();

		if (profileError || !targetProfile) {
			throw error(404, 'User not found');
		}

		// Insert follow (UNIQUE constraint handles duplicates)
		const { error: insertError } = await supabase
			.from('user_follows')
			.insert({
				follower_id: user.id,
				following_id
			});

		if (insertError) {
			if (insertError.code === '23505') {
				return json({ success: true, alreadyFollowing: true });
			}
			throw insertError;
		}

		return json({ success: true });
	} catch (err: any) {
		log.error({ err }, 'Follow user failed');
		if (err.status) throw err;
		throw error(500, 'Failed to follow user');
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
		const parsed = followSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, parsed.error.issues[0]?.message || 'Invalid input');
		}

		const { error: deleteError } = await supabase
			.from('user_follows')
			.delete()
			.eq('follower_id', user.id)
			.eq('following_id', parsed.data.following_id);

		if (deleteError) throw deleteError;

		return json({ success: true });
	} catch (err: any) {
		log.error({ err }, 'Unfollow user failed');
		if (err.status) throw err;
		throw error(500, 'Failed to unfollow user');
	}
};
