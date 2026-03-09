/**
 * HTTP Request Rate Limiter
 * In-memory sliding window rate limiter for incoming HTTP requests.
 * Keyed by IP address (or user ID for authenticated routes).
 *
 * Separate from the external API rate limiter (rate-limiter.ts)
 * which tracks outbound calls to Replicate, Anthropic, etc.
 */

import { infraLogger } from '$lib/utils/logger';

const log = infraLogger.child({ component: 'http-rate-limiter' });

interface WindowEntry {
	timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

/** Cleanup stale entries every 5 minutes */
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of windows) {
			entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
			if (entry.timestamps.length === 0) {
				windows.delete(key);
			}
		}
	}, CLEANUP_INTERVAL);
	if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
		(cleanupTimer as NodeJS.Timeout).unref();
	}
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	limit: number;
	retryAfterSeconds?: number;
}

/**
 * Check and record a request against the rate limit.
 *
 * @param key - Unique key (IP address, user ID, etc.)
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkHttpRateLimit(
	key: string,
	maxRequests: number,
	windowMs: number
): RateLimitResult {
	ensureCleanup();

	const now = Date.now();
	const cutoff = now - windowMs;

	let entry = windows.get(key);
	if (!entry) {
		entry = { timestamps: [] };
		windows.set(key, entry);
	}

	// Remove timestamps outside the window
	entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

	if (entry.timestamps.length >= maxRequests) {
		const oldestInWindow = entry.timestamps[0];
		const retryAfterMs = oldestInWindow + windowMs - now;

		log.warn({ key: key.slice(0, 20), count: entry.timestamps.length, limit: maxRequests }, 'HTTP rate limit hit');

		return {
			allowed: false,
			remaining: 0,
			limit: maxRequests,
			retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
		};
	}

	// Record this request
	entry.timestamps.push(now);

	return {
		allowed: true,
		remaining: maxRequests - entry.timestamps.length,
		limit: maxRequests
	};
}

/**
 * Route-specific rate limit configurations.
 * Returns { maxRequests, windowMs } for a given pathname.
 */
export function getRouteRateLimit(pathname: string): { maxRequests: number; windowMs: number } {
	// Signup: strict but allow retries (prevent mass account creation)
	if (pathname === '/api/auth/signup') {
		return { maxRequests: 10, windowMs: 60_000 };
	}

	// Password reset: very strict (prevent abuse/enumeration)
	if (pathname === '/api/auth/reset-password') {
		return { maxRequests: 3, windowMs: 3_600_000 }; // 3 per hour
	}

	// Auth endpoints: strict (brute-force protection)
	if (pathname.startsWith('/api/auth/')) {
		return { maxRequests: 10, windowMs: 60_000 };
	}

	// Checkout: strict (prevent checkout session abuse)
	if (pathname.startsWith('/api/checkout/')) {
		return { maxRequests: 5, windowMs: 60_000 };
	}

	// Job submission: moderate
	if (pathname === '/api/jobs/submit' || pathname === '/api/jobs/submit-v2') {
		return { maxRequests: 30, windowMs: 60_000 };
	}

	// Email signup (public, unauthenticated): strict (prevent waitlist spam)
	if (pathname === '/api/email-signup') {
		return { maxRequests: 5, windowMs: 60_000 };
	}

	// Stripe webhook: moderate (legitimate bursts possible, but cap abuse)
	if (pathname.startsWith('/api/webhooks/')) {
		return { maxRequests: 30, windowMs: 60_000 };
	}

	// Lifeguard reporting: moderate (prevent log flooding)
	if (pathname.startsWith('/api/lifeguard/')) {
		return { maxRequests: 20, windowMs: 60_000 };
	}

	// Default API rate limit
	if (pathname.startsWith('/api/')) {
		return { maxRequests: 100, windowMs: 60_000 };
	}

	// Non-API routes: no limit
	return { maxRequests: 0, windowMs: 0 };
}
