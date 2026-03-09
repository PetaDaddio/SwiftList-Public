/**
 * SwiftList Structured Logger
 *
 * Pino-based structured logging for production observability.
 * JSON output in production, pretty-print in dev.
 *
 * Usage:
 * ```ts
 * import { logger, createRequestLogger } from '$lib/utils/logger';
 *
 * // Module-level child logger
 * const log = logger.child({ subsystem: 'jobs' });
 * log.info({ jobId, step: 'start' }, 'Job processing started');
 *
 * // Request-scoped logger
 * const reqLog = createRequestLogger(crypto.randomUUID(), user?.id, url.pathname);
 * reqLog.info({ credits: cost }, 'Credit deduction initiated');
 * reqLog.error({ err, jobId }, 'Job processing failed');
 * ```
 */

import pino from 'pino';
import { dev } from '$app/environment';

// ============================================================================
// CORE LOGGER
// ============================================================================

const transport = dev
	? {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'SYS:HH:MM:ss.l',
				ignore: 'pid,hostname'
			}
		}
	: undefined;

/**
 * Root logger instance.
 * - Production: JSON output, info level minimum
 * - Development: Pretty-printed, debug level
 * - Auto-reports errors to Lifeguard in production (fire-and-forget)
 */
export const logger = pino({
	level: dev ? 'debug' : 'info',
	transport,
	timestamp: pino.stdTimeFunctions.isoTime,
	base: { app: 'swiftlist' },
	serializers: {
		err: pino.stdSerializers.err
	},
	// Redact sensitive fields that could leak into logs
	redact: {
		paths: [
			'password',
			'token',
			'apiKey',
			'api_key',
			'authorization',
			'cookie',
			'secret',
			'serviceRoleKey',
			'SUPABASE_SERVICE_ROLE_KEY'
		],
		censor: '[REDACTED]'
	},
	// Hook: auto-report errors to Lifeguard in production
	hooks: {
		logMethod(inputArgs, method, level) {
			// Only intercept error level (50) and fatal level (60)
			if (level >= 50 && !dev) {
				// Schedule async Lifeguard report (non-blocking)
				try {
					const msgArg = inputArgs.find(arg => typeof arg === 'string');
					const objArg = inputArgs.find(arg => typeof arg === 'object' && arg !== null) as Record<string, unknown> | undefined;
					const errMsg = msgArg || objArg?.msg as string || 'Unknown error';
					const errStack = (objArg?.err as { stack?: string })?.stack;

					// Defer to next tick to avoid blocking the log call
					queueMicrotask(() => {
						reportErrorToLifeguard(errMsg, {
							stack: errStack,
							severity: level >= 60 ? 'critical' : 'error',
							context: objArg ? { subsystem: objArg.subsystem as string } : undefined
						});
					});
				} catch {
					// Never let the hook break logging
				}
			}
			return method.apply(this, inputArgs);
		}
	}
});

// ============================================================================
// CHILD LOGGER FACTORIES
// ============================================================================

/** API routes logger */
export const apiLogger = logger.child({ subsystem: 'api' });

/** Background job processing logger */
export const jobsLogger = logger.child({ subsystem: 'jobs' });

/** Agent pipelines logger (background-removal, fabric-engine) */
export const agentsLogger = logger.child({ subsystem: 'agents' });

/** Authentication logger */
export const authLogger = logger.child({ subsystem: 'auth' });

/** Credits/billing logger */
export const creditsLogger = logger.child({ subsystem: 'credits' });

/** Lifeguard error monitoring logger */
export const lifeguardLogger = logger.child({ subsystem: 'lifeguard' });

/** AI external API calls logger */
export const aiLogger = logger.child({ subsystem: 'ai' });

/** Infrastructure logger (circuit breaker, rate limiter, webhooks) */
export const infraLogger = logger.child({ subsystem: 'infra' });

// ============================================================================
// CHILD LOGGER FACTORY
// ============================================================================

/**
 * Create a named child logger for a specific module or agent.
 * Convenience wrapper around `logger.child()`.
 *
 * @param name - Module or agent name (e.g., 'segment-agent', 'bg-removal-orchestrator')
 * @returns Pino child logger with subsystem tag
 */
export function createLogger(name: string): pino.Logger {
	return logger.child({ subsystem: name });
}

// ============================================================================
// REQUEST-SCOPED LOGGER
// ============================================================================

/**
 * Create a request-scoped logger with request context.
 * Use in API route handlers to correlate all logs from a single request.
 */
export function createRequestLogger(
	requestId: string,
	userId?: string,
	path?: string
): pino.Logger {
	return logger.child({
		requestId,
		...(userId && { userId }),
		...(path && { path })
	});
}

// ============================================================================
// LIFEGUARD INTEGRATION (fire-and-forget error reporting)
// ============================================================================

/** Track recently reported errors to prevent flooding (error message → last report time) */
const recentErrors = new Map<string, number>();

/** Max 1 report per unique error per 5 minutes */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/** Cleanup interval to prevent memory leaks */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

// Periodic cleanup of stale entries
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
	if (cleanupTimer) return;
	cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [key, time] of recentErrors) {
			if (now - time > DEDUP_WINDOW_MS) {
				recentErrors.delete(key);
			}
		}
	}, CLEANUP_INTERVAL_MS);
	// Allow process to exit even if timer is running
	if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
		cleanupTimer.unref();
	}
}

/**
 * Report an error to Lifeguard (server-side, fire-and-forget).
 * Rate-limited: max 1 report per unique error message per 5 minutes.
 *
 * Call this from server-side code only (API routes, workers).
 * Does NOT block the caller — errors in reporting are silently swallowed.
 */
export function reportErrorToLifeguard(
	errorMessage: string,
	options?: {
		stack?: string;
		severity?: 'critical' | 'error' | 'warning';
		category?: string;
		context?: Record<string, unknown>;
	}
): void {
	// Skip in development
	if (dev) return;

	// Dedup check — use first 200 chars of error message as key
	const dedupKey = errorMessage.slice(0, 200);
	const lastReport = recentErrors.get(dedupKey);
	const now = Date.now();

	if (lastReport && now - lastReport < DEDUP_WINDOW_MS) {
		return; // Already reported recently
	}

	recentErrors.set(dedupKey, now);
	ensureCleanupTimer();

	// Fire-and-forget — do NOT await
	_sendLifeguardReport(errorMessage, options).catch(() => {
		// Silently swallow — logging the logging failure would be recursive
	});
}

async function _sendLifeguardReport(
	errorMessage: string,
	options?: {
		stack?: string;
		severity?: 'critical' | 'error' | 'warning';
		category?: string;
		context?: Record<string, unknown>;
	}
): Promise<void> {
	try {
		// Use internal API endpoint (same server, no auth needed for internal calls)
		const baseUrl = (import.meta.env.ORIGIN as string | undefined) || 'http://localhost:5173';
		await fetch(`${baseUrl}/api/lifeguard/report`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				error_message: errorMessage,
				error_stack: options?.stack,
				severity: options?.severity || 'error',
				category: options?.category || 'application_error',
				environment: 'production',
				...options?.context
			})
		});
	} catch {
		// Silently fail — don't let error reporting break the app
	}
}

export default logger;
