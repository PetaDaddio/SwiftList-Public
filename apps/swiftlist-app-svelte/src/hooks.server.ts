/**
 * SvelteKit Server Hooks
 * Handles: authentication, security headers, CORS, rate limiting, error handling
 */

import * as Sentry from '@sentry/sveltekit';
import { createServerSupabaseClient } from '$lib/supabase/client';
import { dev } from '$app/environment';
import { apiLogger, reportErrorToLifeguard } from '$lib/utils/logger';
import { checkHttpRateLimit, getRouteRateLimit } from '$lib/utils/http-rate-limiter';
import { recordRequest } from '$lib/utils/metrics-collector';
import { getActiveExperiments, computeAssignments } from '$lib/ab/config';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// ============================================================================
// SENTRY INITIALIZATION
// ============================================================================

Sentry.init({
	dsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN || '',
	tracesSampleRate: dev ? 1.0 : 0.2,
	environment: dev ? 'development' : 'production'
});

// ============================================================================
// ALLOWED ORIGINS (CORS)
// ============================================================================

const ALLOWED_ORIGINS = dev
	? ['http://localhost:5173', 'http://localhost:4173']
	: [
			'https://swiftlist.app',
			'https://www.swiftlist.app',
			'https://swiftlist-app-svelte-production.up.railway.app'
		];

// ============================================================================
// SECURITY HEADERS
// ============================================================================

const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	...(dev
		? {}
		: {
				'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
				// CSP Notes:
				// - script-src 'unsafe-inline': Required by GA4 gtag() init in app.html,
				//   Turnstile data-callback globals, and SvelteKit hydration.
				//   TODO: Migrate to nonce-based CSP via svelte.config.js for tighter XSS protection.
				// - style-src 'unsafe-inline': Required by Tailwind utility classes. Accepted tradeoff.
				'Content-Security-Policy': [
					"default-src 'self'",
					"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com",
					"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
					"font-src 'self' https://fonts.gstatic.com",
					"img-src 'self' data: blob: https://*.supabase.co https://login.swiftlist.app https://*.replicate.delivery https://replicate.delivery https://www.google-analytics.com https://www.googletagmanager.com",
					"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://login.swiftlist.app wss://login.swiftlist.app https://api.replicate.com https://gateway.ai.cloudflare.com https://challenges.cloudflare.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
					"frame-src https://challenges.cloudflare.com",
					"frame-ancestors 'none'"
				].join('; ')
			})
};

// ============================================================================
// MAIN HANDLE HOOK
// ============================================================================

const _handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const requestStart = Date.now();

	// -------------------------------------------------------------------
	// CORS: Handle preflight OPTIONS requests for API routes
	// -------------------------------------------------------------------
	if (event.request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
		const origin = event.request.headers.get('origin') || '';
		const isAllowed = ALLOWED_ORIGINS.includes(origin);

		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': isAllowed ? origin : '',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
				'Access-Control-Max-Age': '86400',
				...SECURITY_HEADERS
			}
		});
	}

	// -------------------------------------------------------------------
	// RATE LIMITING: Check before processing API requests
	// -------------------------------------------------------------------
	if (pathname.startsWith('/api/') && pathname !== '/api/health') {
		const { maxRequests, windowMs } = getRouteRateLimit(pathname);

		if (maxRequests > 0) {
			// Use CF-Connecting-IP behind Cloudflare, fall back to getClientAddress()
			const clientIp =
				event.request.headers.get('cf-connecting-ip') ||
				event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
				event.getClientAddress();

			const result = checkHttpRateLimit(clientIp, maxRequests, windowMs);

			if (!result.allowed) {
				return json(
					{ error: 'Too many requests', retryAfter: result.retryAfterSeconds },
					{
						status: 429,
						headers: {
							'Retry-After': String(result.retryAfterSeconds || 60),
							'X-RateLimit-Limit': String(result.limit),
							'X-RateLimit-Remaining': '0',
							...SECURITY_HEADERS
						}
					}
				);
			}
		}
	}

	// -------------------------------------------------------------------
	// AUTHENTICATION: Create Supabase client and validate session
	// -------------------------------------------------------------------
	event.locals.supabase = createServerSupabaseClient(event.cookies, event.fetch);

	// SECURITY: Use getUser() to validate JWT against Supabase auth server.
	// getSession() only reads from cookies (tamperable client-side).
	const {
		data: { user }
	} = await event.locals.supabase.auth.getUser();

	// Also get session for token access (needed by Supabase client operations)
	const {
		data: { session }
	} = await event.locals.supabase.auth.getSession();

	event.locals.session = session;
	event.locals.user = user ?? null;

	// If user is authenticated (server-verified), get their profile
	// Use .maybeSingle() — .single() throws if profile is missing (corrupted state)
	if (user) {
		const { data: profile } = await event.locals.supabase
			.from('profiles')
			.select('*')
			.eq('user_id', user.id)
			.maybeSingle();

		event.locals.profile = profile ?? null;
	}

	// -------------------------------------------------------------------
	// A/B TESTING: Assign variants (server-side, no flicker)
	// -------------------------------------------------------------------
	let visitorId = event.cookies.get('sl_ab') || '';
	if (!visitorId) {
		visitorId = crypto.randomUUID();
		event.cookies.set('sl_ab', visitorId, {
			path: '/',
			httpOnly: false, // Readable by client tracker
			secure: !dev,
			sameSite: 'lax',
			maxAge: 365 * 24 * 60 * 60 // 1 year
		});
	}
	event.locals.abVisitorId = visitorId;

	// Skip A/B assignment for API routes and static assets
	if (!pathname.startsWith('/api/') && !pathname.startsWith('/_app/')) {
		try {
			const experiments = await getActiveExperiments(event.locals.supabase);
			event.locals.abTests = computeAssignments(visitorId, experiments);
		} catch {
			event.locals.abTests = {};
		}
	} else {
		event.locals.abTests = {};
	}

	// -------------------------------------------------------------------
	// RESOLVE: Process the request and apply response headers
	// -------------------------------------------------------------------
	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});

	// Apply security headers to all responses
	for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(header)) {
			response.headers.set(header, value);
		}
	}

	// Apply CORS headers for API responses
	if (pathname.startsWith('/api/')) {
		const origin = event.request.headers.get('origin') || '';
		if (ALLOWED_ORIGINS.includes(origin)) {
			response.headers.set('Access-Control-Allow-Origin', origin);
			response.headers.set('Access-Control-Allow-Credentials', 'true');
		}
	}

	// Record request metrics for threshold alerting
	recordRequest(pathname, response.status, Date.now() - requestStart);

	return response;
};

// Compose Sentry handle with app handle
export const handle = sequence(Sentry.sentryHandle(), _handle);

// ============================================================================
// ERROR HANDLER: Catch unhandled errors, sanitize for production
// ============================================================================

const _handleError: HandleServerError = async ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID().slice(0, 8);

	// Log the full error server-side
	apiLogger.error(
		{
			errorId,
			err: error,
			status,
			path: event.url.pathname,
			method: event.request.method,
			userId: event.locals?.user?.id
		},
		`Unhandled error [${errorId}]: ${message}`
	);

	// Report to Lifeguard in production
	if (!dev) {
		reportErrorToLifeguard(
			`[${errorId}] ${error instanceof Error ? error.message : String(error)}`,
			{
				stack: error instanceof Error ? error.stack : undefined,
				severity: status >= 500 ? 'critical' : 'error',
				category: 'unhandled_error',
				context: {
					path: event.url.pathname,
					method: event.request.method,
					status,
					userId: event.locals?.user?.id
				}
			}
		);
	}

	// Return sanitized error to client (no stack traces)
	return {
		message: dev ? message : 'An unexpected error occurred',
		errorId
	};
};

export const handleError = Sentry.handleErrorWithSentry(_handleError);
