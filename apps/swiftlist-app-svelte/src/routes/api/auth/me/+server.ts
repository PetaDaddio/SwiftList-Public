import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const {
		data: { user },
		error
	} = await locals.supabase.auth.getUser();

	if (error || !user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	return json({
		id: user.id,
		email: user.email,
		created_at: user.created_at
	});
};
