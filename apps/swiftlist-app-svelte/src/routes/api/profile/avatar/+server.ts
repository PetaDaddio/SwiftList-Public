/**
 * Avatar Upload API Endpoint
 * POST /api/profile/avatar
 *
 * Handles avatar image upload to Supabase Storage and
 * updates the user's profile with the new avatar URL.
 *
 * SECURITY:
 * - Authentication required (locals.user from hooks.server.ts)
 * - File type validation (JPEG, PNG, WebP, GIF only)
 * - File size validation (max 2MB)
 * - Uploads to user-scoped path in Supabase Storage
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiLogger } from '$lib/utils/logger';

const log = apiLogger.child({ route: 'profile/avatar' });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication
		const user = locals.user;
		if (!user) {
			log.warn('Unauthenticated avatar upload attempt');
			throw error(401, 'Unauthorized');
		}

		// 2. Parse multipart form data
		const formData = await request.formData();
		const avatarFile = formData.get('avatar');

		if (!avatarFile || !(avatarFile instanceof File)) {
			throw error(400, 'No avatar file provided');
		}

		// 3. Validate file type
		if (!ALLOWED_TYPES.includes(avatarFile.type)) {
			throw error(400, 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
		}

		// 4. Validate file size
		if (avatarFile.size > MAX_SIZE) {
			throw error(400, 'File too large. Maximum size is 2MB');
		}

		log.info({ userId: user.id, fileType: avatarFile.type, fileSize: avatarFile.size }, 'Avatar upload request');

		// 5. Generate unique filename (path: {user_id}/{timestamp}.{ext})
		// RLS policy requires first folder segment = auth.uid()
		const fileExt = avatarFile.name.split('.').pop() || 'jpg';
		const fileName = `${Date.now()}.${fileExt}`;
		const filePath = `${user.id}/${fileName}`;

		// 6. Convert File to ArrayBuffer for Supabase upload
		const arrayBuffer = await avatarFile.arrayBuffer();
		const buffer = new Uint8Array(arrayBuffer);

		// 7. Upload to Supabase Storage
		const { error: uploadError } = await locals.supabase.storage
			.from('avatars')
			.upload(filePath, buffer, {
				contentType: avatarFile.type,
				cacheControl: '3600',
				upsert: true
			});

		if (uploadError) {
			log.error({ error: uploadError, userId: user.id }, 'Avatar upload to storage failed');
			throw error(500, 'Failed to upload avatar');
		}

		// 8. Get public URL
		const { data: { publicUrl } } = locals.supabase.storage
			.from('avatars')
			.getPublicUrl(filePath);

		// 9. Update profile with new avatar URL
		const { error: updateError } = await locals.supabase
			.from('profiles')
			.update({ avatar_url: publicUrl })
			.eq('user_id', user.id);

		if (updateError) {
			log.error({ error: updateError, userId: user.id }, 'Profile avatar_url update failed');
			throw error(500, 'Failed to update profile avatar');
		}

		log.info({ userId: user.id, avatarUrl: publicUrl }, 'Avatar uploaded successfully');

		return json({ success: true, avatar_url: publicUrl });
	} catch (err: any) {
		if (err.status) throw err;
		log.error({ error: err.message }, 'Unexpected avatar upload error');
		throw error(500, 'Failed to upload avatar');
	}
};
