/**
 * Signup API Endpoint
 * POST /api/auth/signup
 *
 * Creates a new user account with email and password
 * SECURITY: Includes password strength validation, grants 100 free credits
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createServiceRoleClient } from '$lib/supabase/client';
import { env } from '$env/dynamic/private';
import { authLogger } from '$lib/utils/logger';
import { isDisposableEmail } from '$lib/utils/disposable-emails';

const log = authLogger.child({ route: '/api/auth/signup' });

const signupSchema = z.object({
	email: z.string().email('Invalid email address'),
	displayName: z.string().min(1, 'Display name is required').max(50, 'Display name too long'),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
		.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
		.regex(/[0-9]/, 'Password must contain at least one number')
		.regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character'),
	plan: z.string().nullable().optional()
});

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	try {
		// 1. Parse and validate request body
		const body = await request.json();
		// SECURITY: Never log request body — it contains plaintext passwords

		const parseResult = signupSchema.safeParse(body);

		if (!parseResult.success) {
			const firstError = parseResult.error.issues?.[0];
			const errorMessage = firstError?.message || 'Invalid request data';
			return json(
				{
					success: false,
					error: errorMessage,
					validationErrors: parseResult.error.issues.map((issue) => ({
						field: issue.path.join('.'),
						message: issue.message
					}))
				},
				{ status: 400 }
			);
		}

	const { email, displayName, password, plan } = parseResult.data;
	// SECURITY: Only log email at debug level (PII)
	log.info('Signup attempt started');

	// Get client IP for abuse tracking
	const clientIp =
		request.headers.get('cf-connecting-ip') ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		getClientAddress();

	// 3. Block disposable/temporary email domains
	if (isDisposableEmail(email)) {
		const domain = email.split('@')[1];
		log.warn({ domain }, 'Signup blocked: disposable email');
		return json(
			{ success: false, error: 'Please use a permanent email address to sign up.' },
			{ status: 400 }
		);
	}

	// Capture IP and User-Agent for abuse tracking (reuse clientIp from Turnstile check)
	const signupIp = clientIp;
	const signupUserAgent = request.headers.get('user-agent') || null;

	// 3. Create user with Supabase Auth (requires email confirmation)
	const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://swiftlist.app';
	const { data, error: authError } = await locals.supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				display_name: displayName,
				signup_ip: signupIp,
				signup_user_agent: signupUserAgent
			},
			emailRedirectTo: plan
				? `${siteUrl}/auth/callback?next=${encodeURIComponent(`/pricing?checkout=${plan}`)}`
				: `${siteUrl}/auth/callback?next=/dashboard`
		}
	});

	if (authError) {
		// SECURITY: Don't reveal whether email exists (prevents user enumeration)
		if (authError.message.includes('already registered')) {
			log.warn('Signup attempt with existing email');
			// Return generic success to prevent email enumeration
			return json({
				success: true,
				message: 'If this email is not already registered, a confirmation email has been sent.'
			});
		}

		// Surface weak password errors so the user can fix them
		if (authError.message.includes('weak') || authError.message.includes('pwned') || (authError as any).code === 'weak_password') {
			log.warn('Signup blocked: weak/pwned password');
			return json(
				{ success: false, error: 'That password has appeared in a data breach. Please choose a different one.' },
				{ status: 400 }
			);
		}

		log.error({ err: authError, authErrorName: authError.name, authErrorCode: (authError as any).code, authErrorMessage: authError.message }, 'Signup auth error');

		// Surface rate-limit errors so the user knows to wait
		if ((authError as any).code === 'over_email_send_rate_limit' || authError.message.includes('rate limit')) {
			return json(
				{ success: false, error: 'Too many signup attempts. Please wait a few minutes and try again.' },
				{ status: 429 }
			);
		}

		return json(
			{ success: false, error: authError.message || 'Failed to create account. Please try again later.' },
			{ status: (authError as any).status || 500 }
		);
	}

	if (!data.user) {
		return json(
			{ success: false, error: 'Failed to create account.' },
			{ status: 500 }
		);
	}

	// 3. Check if email confirmation is required
	// When "Confirm email" is enabled in Supabase, user.identities will be empty
	// until the email is verified. Profile creation happens in auth/callback.
	const needsEmailVerification = !data.user.email_confirmed_at;

	if (needsEmailVerification) {
		log.info({ userId: data.user.id }, 'Signup initiated — confirmation email sent');
		return json({
			success: true,
			needsVerification: true,
			message: 'Please check your email to verify your account.'
		});
	}

	// Fallback: if auto-confirm is on (dev mode), create profile immediately
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (serviceRoleKey) {
		const adminClient = createServiceRoleClient(serviceRoleKey);
		const { error: profileError } = await adminClient.from('profiles').insert({
			user_id: data.user.id,
			email: email,
			display_name: displayName,
			credits_balance: 100,
			signup_ip: signupIp,
			signup_user_agent: signupUserAgent
		});
		if (profileError) {
			log.error({ err: profileError, userId: data.user.id }, 'Profile creation failed — user exists in auth but not in app');
			return json(
				{ success: false, error: 'Account setup failed. Please try again.' },
				{ status: 500 }
			);
		}
	}

		log.info({ userId: data.user.id }, 'Signup completed (auto-confirmed)');
		return json({
			success: true,
			needsVerification: false,
			user: {
				id: data.user.id,
				email: data.user.email,
				displayName
			}
		});
	} catch (err: any) {
		// Supabase throws AuthWeakPasswordError as an exception (not in { error })
		if (err?.name === 'AuthWeakPasswordError' || err?.code === 'weak_password' || err?.message?.includes('weak') || err?.message?.includes('pwned')) {
			log.warn('Signup blocked: weak/pwned password (thrown)');
			return json(
				{ success: false, error: 'That password has appeared in a data breach. Please choose a different one.' },
				{ status: 400 }
			);
		}
		log.error({ err, errName: err?.name, errCode: err?.code, errMessage: err?.message }, 'Signup unexpected error');
		return json(
			{ success: false, error: err?.message || 'Failed to create account. Please try again.' },
			{ status: 500 }
		);
	}
};
