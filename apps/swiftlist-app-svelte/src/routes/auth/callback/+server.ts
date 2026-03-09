/**
 * Auth Callback Handler
 * GET /auth/callback
 *
 * Handles both OAuth redirects (Google) and email confirmation links.
 * When a user clicks the confirmation link in their email, Supabase
 * redirects here with a code that gets exchanged for a session.
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/client';
import { authLogger } from '$lib/utils/logger';
import { onUserSignup } from '$lib/crm/sync';

const log = authLogger.child({ route: '/auth/callback' });

export const GET: RequestHandler = async ({ url, locals, request, getClientAddress }) => {
	const code = url.searchParams.get('code');
	let next = url.searchParams.get('next') ?? '/dashboard';
	// Prevent open redirect — only allow internal paths
	if (!next.startsWith('/') || next.startsWith('//')) {
		next = '/dashboard';
	}

	// No code provided - redirect to login
	if (!code) {
		throw redirect(303, '/auth/login?error=no_code');
	}

	// Exchange code for session
	const { error: authError } = await locals.supabase.auth.exchangeCodeForSession(code);

	if (authError) {
		throw redirect(303, '/auth/login?error=oauth_failed');
	}

	// Get user data
	const { data: { user }, error: userError } = await locals.supabase.auth.getUser();

	if (userError || !user) {
		throw redirect(303, '/auth/login?error=oauth_failed');
	}

	// Check if profile exists, if not create it
	// Use .maybeSingle() — .single() throws if no row found
	const { data: existingProfile } = await locals.supabase
		.from('profiles')
		.select('user_id')
		.eq('user_id', user.id)
		.maybeSingle();

	if (!existingProfile) {
		// Create profile for new user with 100 free credits
		// Handles both OAuth users and email-confirmed signups
		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			throw redirect(303, '/auth/login?error=server_config');
		}
		const adminClient = createServiceRoleClient(serviceRoleKey);

		const displayName =
			user.user_metadata?.display_name ||
			user.user_metadata?.full_name ||
			user.user_metadata?.name ||
			user.email?.split('@')[0] ||
			'User';

		log.info({ userId: user.id, provider: user.app_metadata?.provider }, 'Creating profile for new user');

		// Get signup IP+UA from user_metadata (stored during signup), fallback to current request
		const signupIp =
			user.user_metadata?.signup_ip ||
			request.headers.get('cf-connecting-ip') ||
			request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			getClientAddress();
		const signupUserAgent =
			user.user_metadata?.signup_user_agent ||
			request.headers.get('user-agent') ||
			null;

		const { error: profileError } = await adminClient.from('profiles').insert({
			user_id: user.id,
			email: user.email!,
			display_name: displayName,
			avatar_url: user.user_metadata?.avatar_url || null,
			credits_balance: 100,
			signup_ip: signupIp,
			signup_user_agent: signupUserAgent
		});

		if (profileError) {
			log.error({ err: profileError }, 'Failed to create profile for OAuth user');
		}

		// Fire-and-forget: sync new user to CRM
		const provider = user.app_metadata?.provider;
		onUserSignup({
			email: user.email!,
			userId: user.id,
			displayName,
			avatarUrl: user.user_metadata?.avatar_url || undefined,
			source: provider === 'google' ? 'google' : 'signup'
		}).catch(() => {}); // swallow — CRM is not critical path
	}

	// Successful authentication - redirect to dashboard
	throw redirect(303, next);
};
