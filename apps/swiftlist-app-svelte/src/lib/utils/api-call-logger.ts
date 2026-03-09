/**
 * API Call Logger — Fire-and-forget logging for external API calls
 *
 * Inserts into api_call_log table for capacity monitoring dashboard.
 * Async + non-blocking: won't slow down job processing.
 */

import { createServiceRoleClient } from '$lib/supabase/client';
import { infraLogger } from '$lib/utils/logger';

const log = infraLogger.child({ component: 'api-call-logger' });

export type ApiProvider = 'replicate' | 'fal_ai' | 'google_imagen' | 'google_gemini' | 'anthropic';

export type ApiOperation =
	| 'bg_removal'
	| 'scene_generation'
	| 'vision_analysis'
	| 'classification'
	| 'upscale'
	| 'text_generation'
	| 'image_generation'
	| 'mannequin_composite'
	| 'product_in_hands'
	| 'product_description';

export interface ApiCallLogEntry {
	job_id?: string;
	provider: ApiProvider;
	operation: ApiOperation;
	cost_usd: number;
	duration_ms: number;
	status: 'success' | 'error';
	error_message?: string;
}

/**
 * Log an external API call. Fire-and-forget — errors are logged but won't propagate.
 */
export function logApiCall(serviceRoleKey: string, entry: ApiCallLogEntry): void {
	// Fire-and-forget: no await, catch errors silently
	_insertApiCallLog(serviceRoleKey, entry).catch((err) => {
		log.warn({ err, provider: entry.provider, operation: entry.operation }, 'Failed to log API call');
	});
}

async function _insertApiCallLog(serviceRoleKey: string, entry: ApiCallLogEntry): Promise<void> {
	const supabase = createServiceRoleClient(serviceRoleKey);

	const { error } = await supabase.from('api_call_log').insert({
		job_id: entry.job_id || null,
		provider: entry.provider,
		operation: entry.operation,
		cost_usd: entry.cost_usd,
		duration_ms: entry.duration_ms,
		status: entry.status,
		error_message: entry.error_message || null
	});

	if (error) {
		log.warn({ error, provider: entry.provider }, 'api_call_log insert failed');
	}
}

/**
 * Helper to time an API call and log it.
 * Usage:
 * ```ts
 * const result = await timeApiCall(serviceRoleKey, {
 *   job_id, provider: 'fal_ai', operation: 'bg_removal', cost_usd: 0.018
 * }, async () => {
 *   return await someApiCall();
 * });
 * ```
 */
export async function timeApiCall<T>(
	serviceRoleKey: string,
	meta: Omit<ApiCallLogEntry, 'duration_ms' | 'status'>,
	fn: () => Promise<T>
): Promise<T> {
	const start = Date.now();
	try {
		const result = await fn();
		logApiCall(serviceRoleKey, {
			...meta,
			duration_ms: Date.now() - start,
			status: 'success'
		});
		return result;
	} catch (err) {
		logApiCall(serviceRoleKey, {
			...meta,
			duration_ms: Date.now() - start,
			status: 'error',
			error_message: err instanceof Error ? err.message : String(err)
		});
		throw err;
	}
}
