import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Root route redirect.
 * Authenticated users → /dashboard
 * Unauthenticated users → /home (cream V2 homepage)
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session) {
		throw redirect(303, '/dashboard');
	}
	throw redirect(303, '/home');
};
