/**
 * SvelteKit Client Hooks
 * Handles client-side error reporting via Sentry + Lifeguard
 */

import * as Sentry from '@sentry/sveltekit';
import type { HandleClientError } from '@sveltejs/kit';

Sentry.init({
	dsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN || '',
	tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,
	environment: import.meta.env.DEV ? 'development' : 'production'
});

const _handleError: HandleClientError = async ({ error, status, message }) => {
	const errorId = crypto.randomUUID().slice(0, 8);

	// Log to console in development
	if (import.meta.env.DEV) {
		console.error(`[${errorId}] Client error (${status}):`, error);
	}

	// In production, report to server-side error endpoint
	if (!import.meta.env.DEV && error instanceof Error) {
		try {
			await fetch('/api/lifeguard/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					error_message: `[CLIENT] ${error.message}`,
					error_stack: error.stack,
					severity: 'error',
					category: 'client_error',
					environment: 'production'
				})
			});
		} catch {
			// Silently fail — don't break the app
		}
	}

	return {
		message: import.meta.env.DEV ? message : 'An unexpected error occurred',
		errorId
	};
};

export const handleError = Sentry.handleErrorWithSentry(_handleError);
