/**
 * Password Reset Request API Endpoint
 * POST /api/auth/reset-password
 *
 * Sends a password reset email via Supabase Auth.
 * SECURITY: Always returns success to prevent email enumeration.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { authLogger } from '$lib/utils/logger';

const log = authLogger.child({ route: '/api/auth/reset-password' });

const resetSchema = z.object({
	email: z.string().email('Invalid email address')
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const parseResult = resetSchema.safeParse(body);

		if (!parseResult.success) {
			return json(
				{ success: false, error: parseResult.error.issues[0].message },
				{ status: 400 }
			);
		}

		const { email } = parseResult.data;
		log.info('Password reset requested');

		// Send password reset email via Supabase
		const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://swiftlist.app';
		const { error: resetError } = await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${siteUrl}/auth/callback?next=/auth/update-password`
		});

		if (resetError) {
			// Log the error but still return success to prevent email enumeration
			log.error({ err: resetError }, 'Supabase resetPasswordForEmail error');
		}

		// SECURITY: Always return success to prevent email enumeration
		return json({
			success: true,
			message: 'If an account exists with this email, a password reset link has been sent.'
		});
	} catch (err) {
		log.error({ err }, 'Unexpected error in password reset');
		throw error(500, 'Something went wrong. Please try again later.');
	}
};
