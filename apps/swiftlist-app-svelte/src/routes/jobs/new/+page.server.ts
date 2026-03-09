/**
 * Server-side auth guard for /jobs/new
 * Redirects unauthenticated users to signup page
 */

import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/signup?next=/jobs/new');
	}
};
