/**
 * Logout Handler
 * POST /auth/logout
 *
 * Signs the user out and redirects to login page
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase.auth.signOut();
	throw redirect(303, '/auth/login');
};
