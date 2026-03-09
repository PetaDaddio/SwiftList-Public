/**
 * Timing-Safe Query Wrapper
 *
 * Ensures all database queries take a consistent minimum time,
 * preventing timing attack enumeration.
 *
 * WARNING: This adds artificial latency to ALL queries.
 * Only use for security-critical operations like user enumeration.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const MINIMUM_QUERY_TIME_MS = 300; // Consistent response time

export async function timingSafeQuery<T>(
	queryFn: () => Promise<T>
): Promise<T> {
	const startTime = performance.now();

	try {
		const result = await queryFn();

		// Calculate how long the query actually took
		const elapsedTime = performance.now() - startTime;

		// If query was faster than minimum, add delay
		if (elapsedTime < MINIMUM_QUERY_TIME_MS) {
			const remainingTime = MINIMUM_QUERY_TIME_MS - elapsedTime;
			await new Promise(resolve => setTimeout(resolve, remainingTime));
		}

		return result;
	} catch (error) {
		// Even on error, ensure consistent timing
		const elapsedTime = performance.now() - startTime;

		if (elapsedTime < MINIMUM_QUERY_TIME_MS) {
			const remainingTime = MINIMUM_QUERY_TIME_MS - elapsedTime;
			await new Promise(resolve => setTimeout(resolve, remainingTime));
		}

		throw error;
	}
}

/**
 * Example usage:
 *
 * import { timingSafeQuery } from '$lib/security/timing-safe-query';
 *
 * const result = await timingSafeQuery(() =>
 *   supabase.from('profiles').select().eq('user_id', userId).single()
 * );
 */
