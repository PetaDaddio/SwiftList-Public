/**
 * Login API Endpoint
 * POST /api/auth/login
 *
 * Authenticates user with email and password
 * SECURITY: Includes account lockout after 5 failed attempts in 15 minutes
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { authLogger } from '$lib/utils/logger';

const log = authLogger.child({ route: 'api/auth/login' });

// ============================================================================
// ACCOUNT LOCKOUT: Track failed login attempts per email (in-memory)
// ============================================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const failedAttempts = new Map<string, number[]>();

// Cleanup stale entries every 10 minutes
const lockoutCleanupTimer = setInterval(() => {
	const now = Date.now();
	for (const [key, timestamps] of failedAttempts) {
		const recent = timestamps.filter((t) => now - t < LOCKOUT_WINDOW_MS);
		if (recent.length === 0) {
			failedAttempts.delete(key);
		} else {
			failedAttempts.set(key, recent);
		}
	}
}, 10 * 60 * 1000);
if (lockoutCleanupTimer && typeof lockoutCleanupTimer === 'object' && 'unref' in lockoutCleanupTimer) {
	(lockoutCleanupTimer as NodeJS.Timeout).unref();
}

function isLockedOut(email: string): { locked: boolean; retryAfterSeconds?: number } {
	const normalizedEmail = email.toLowerCase();
	const timestamps = failedAttempts.get(normalizedEmail);
	if (!timestamps) return { locked: false };

	const now = Date.now();
	const recent = timestamps.filter((t) => now - t < LOCKOUT_WINDOW_MS);
	failedAttempts.set(normalizedEmail, recent);

	if (recent.length >= MAX_FAILED_ATTEMPTS) {
		const oldestInWindow = recent[0];
		const retryAfterMs = oldestInWindow + LOCKOUT_WINDOW_MS - now;
		return { locked: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
	}
	return { locked: false };
}

function recordFailedAttempt(email: string): void {
	const normalizedEmail = email.toLowerCase();
	const timestamps = failedAttempts.get(normalizedEmail) || [];
	timestamps.push(Date.now());
	failedAttempts.set(normalizedEmail, timestamps);
}

function clearFailedAttempts(email: string): void {
	failedAttempts.delete(email.toLowerCase());
}

// ============================================================================

const loginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(8, 'Password must be at least 8 characters')
});

export const POST: RequestHandler = async ({ request, locals }) => {
	// 1. Parse and validate request body
	const body = await request.json();
	const parseResult = loginSchema.safeParse(body);

	if (!parseResult.success) {
		throw error(400, 'Invalid request data: ' + parseResult.error.issues[0].message);
	}

	const { email, password } = parseResult.data;

	// 2. Check account lockout BEFORE attempting auth (saves Supabase calls)
	const lockout = isLockedOut(email);
	if (lockout.locked) {
		log.warn({ email: email.slice(0, 3) + '***' }, 'Login blocked: account temporarily locked');
		return json(
			{
				success: false,
				error: 'Too many failed attempts. Please try again later.',
				retryAfter: lockout.retryAfterSeconds
			},
			{
				status: 429,
				headers: { 'Retry-After': String(lockout.retryAfterSeconds || 900) }
			}
		);
	}

	// 4. Attempt login with Supabase Auth
	const { data, error: authError } = await locals.supabase.auth.signInWithPassword({
		email,
		password
	});

	if (authError) {
		recordFailedAttempt(email);
		const attempts = (failedAttempts.get(email.toLowerCase()) || []).length;
		log.warn({ attempts, max: MAX_FAILED_ATTEMPTS }, 'Login failed');
		// Generic error message to prevent user enumeration
		throw error(401, 'Invalid email or password');
	}

	// 5. Success — clear any failed attempts
	clearFailedAttempts(email);

	return json({
		success: true,
		user: {
			id: data.user.id,
			email: data.user.email
		}
	});
};
