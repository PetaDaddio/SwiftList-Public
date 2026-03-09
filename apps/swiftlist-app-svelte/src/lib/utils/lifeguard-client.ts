/**
 * Lifeguard Client
 *
 * Client-side error reporting utility for the Lifeguard monitoring system.
 * Captures errors and sends them to the Lifeguard Edge Function for analysis.
 *
 * Usage:
 * ```ts
 * import { reportToLifeguard } from '$lib/utils/lifeguard-client';
 *
 * try {
 *   // risky operation
 * } catch (error) {
 *   await reportToLifeguard({
 *     error: error.message,
 *     stack: error.stack,
 *     context: { user_id, job_id }
 *   });
 *   throw error; // Still throw to user
 * }
 * ```
 */

export interface LifeguardReportOptions {
	// Error details (required)
	error: string;
	stack?: string;
	code?: string;

	// Severity (auto-detected if not provided)
	severity?: 'critical' | 'error' | 'warning' | 'info';

	// Category (auto-detected if not provided)
	category?:
		| 'application_error'
		| 'api_failure'
		| 'database_error'
		| 'security_threat'
		| 'performance_degradation'
		| 'rate_limit_exceeded'
		| 'authentication_failure'
		| 'payment_failure'
		| 'workflow_failure'
		| 'llm_api_failure';

	// Context (optional but recommended)
	context?: {
		user_id?: string;
		job_id?: string;
		workflow_id?: string;
		request_path?: string;
		request_method?: string;
		request_body?: Record<string, unknown>;
		[key: string]: unknown;
	};

	// Performance metrics (optional)
	metrics?: {
		response_time_ms?: number;
		memory_usage_mb?: number;
		cpu_usage_percent?: number;
	};
}

interface LifeguardResponse {
	success: boolean;
	incident_id?: string;
	error?: string;
}

/**
 * Report an error to Lifeguard monitoring system
 *
 * @param options - Error details and context
 * @returns Promise<void> - Resolves when report is sent (or fails silently)
 */
export async function reportToLifeguard(options: LifeguardReportOptions): Promise<void> {
	try {
		// Auto-detect severity if not provided
		const severity = options.severity || detectSeverity(options.error);

		// Auto-detect category if not provided
		const category = options.category || detectCategory(options.error);

		// Prepare incident data
		const incidentData = {
			severity,
			category,
			error_message: options.error,
			error_stack: options.stack,
			error_code: options.code,
			user_id: options.context?.user_id,
			job_id: options.context?.job_id,
			request_path: options.context?.request_path || window.location.pathname,
			request_method: options.context?.request_method,
			request_body: options.context?.request_body,
			environment: getEnvironment(),
			user_agent: navigator.userAgent,
			response_time_ms: options.metrics?.response_time_ms,
			memory_usage_mb: options.metrics?.memory_usage_mb,
			cpu_usage_percent: options.metrics?.cpu_usage_percent
		};

		// Send to Lifeguard Edge Function
		const response = await fetch('/api/lifeguard/report', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(incidentData)
		});

		if (!response.ok) {
			// Client-side: keep console.error since Pino is server-only
			console.error('[Lifeguard] Failed to report:', response.status);
		}

		const result: LifeguardResponse = await response.json();
		if (result.success) {
		}
	} catch (err) {
		// Fail silently - don't let error reporting break the app
		// Note: This is client-side code (uses window/navigator), Pino is server-only
		console.error('[Lifeguard] Failed to report error:', err);
	}
}

/**
 * Auto-detect error severity based on error message
 */
function detectSeverity(errorMessage: string): 'critical' | 'error' | 'warning' | 'info' {
	const msg = errorMessage.toLowerCase();

	// Critical: Data loss, payment failures, security breaches
	if (
		msg.includes('payment') ||
		msg.includes('charge') ||
		msg.includes('data loss') ||
		msg.includes('unauthorized') ||
		msg.includes('breach') ||
		msg.includes('sql injection') ||
		msg.includes('xss')
	) {
		return 'critical';
	}

	// Error: Functional failures, API errors
	if (
		msg.includes('failed') ||
		msg.includes('error') ||
		msg.includes('exception') ||
		msg.includes('timeout') ||
		msg.includes('cannot')
	) {
		return 'error';
	}

	// Warning: Non-critical issues
	if (msg.includes('warn') || msg.includes('deprecated') || msg.includes('slow')) {
		return 'warning';
	}

	// Default to error
	return 'error';
}

/**
 * Auto-detect error category based on error message
 */
function detectCategory(
	errorMessage: string
):
	| 'application_error'
	| 'api_failure'
	| 'database_error'
	| 'security_threat'
	| 'performance_degradation'
	| 'rate_limit_exceeded'
	| 'authentication_failure'
	| 'payment_failure'
	| 'workflow_failure'
	| 'llm_api_failure' {
	const msg = errorMessage.toLowerCase();

	if (msg.includes('payment') || msg.includes('stripe') || msg.includes('charge')) {
		return 'payment_failure';
	}

	if (msg.includes('auth') || msg.includes('login') || msg.includes('token')) {
		return 'authentication_failure';
	}

	if (msg.includes('database') || msg.includes('postgres') || msg.includes('sql')) {
		return 'database_error';
	}

	if (msg.includes('rate limit') || msg.includes('too many requests')) {
		return 'rate_limit_exceeded';
	}

	if (
		msg.includes('openai') ||
		msg.includes('anthropic') ||
		msg.includes('claude') ||
		msg.includes('gemini') ||
		msg.includes('llm')
	) {
		return 'llm_api_failure';
	}

	if (msg.includes('workflow') || msg.includes('job') || msg.includes('processing')) {
		return 'workflow_failure';
	}

	if (
		msg.includes('unauthorized') ||
		msg.includes('injection') ||
		msg.includes('xss') ||
		msg.includes('csrf')
	) {
		return 'security_threat';
	}

	if (msg.includes('slow') || msg.includes('timeout') || msg.includes('performance')) {
		return 'performance_degradation';
	}

	if (msg.includes('fetch') || msg.includes('api') || msg.includes('request')) {
		return 'api_failure';
	}

	return 'application_error';
}

/**
 * Get current environment
 */
function getEnvironment(): 'development' | 'staging' | 'production' {
	const hostname = window.location.hostname;

	if (hostname === 'localhost' || hostname === '127.0.0.1') {
		return 'development';
	}

	if (hostname.includes('staging') || hostname.includes('preview')) {
		return 'staging';
	}

	return 'production';
}

/**
 * Global error handler (optional)
 *
 * Call this in your root layout to automatically report uncaught errors
 */
export function initializeLifeguard() {
	// Catch unhandled promise rejections
	window.addEventListener('unhandledrejection', (event) => {
		reportToLifeguard({
			error: event.reason?.message || String(event.reason),
			stack: event.reason?.stack,
			context: {
				request_path: window.location.pathname
			}
		});
	});

	// Catch global errors
	window.addEventListener('error', (event) => {
		reportToLifeguard({
			error: event.message,
			stack: event.error?.stack,
			context: {
				request_path: window.location.pathname,
				line: event.lineno,
				column: event.colno,
				filename: event.filename
			} as Record<string, unknown>
		});
	});

}
