/**
 * Protected API Call Wrapper
 * Wraps external API calls with circuit breaker + rate limiter.
 *
 * Usage:
 * ```ts
 * import { protectedApiCall } from '$lib/utils/protected-api-call';
 *
 * const result = await protectedApiCall('Replicate', async () => {
 *   return await replicate.run('model', { input });
 * });
 * ```
 */

import { circuitBreakerManager } from '$lib/utils/circuit-breaker';
import { rateLimiterManager } from '$lib/utils/rate-limiter';
import { infraLogger } from '$lib/utils/logger';

const log = infraLogger.child({ component: 'protected-api-call' });

export class ServiceUnavailableError extends Error {
	public retryAfterSeconds?: number;

	constructor(service: string, reason: string, retryAfterSeconds?: number) {
		super(`${service} is temporarily unavailable: ${reason}`);
		this.name = 'ServiceUnavailableError';
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

/**
 * Execute an external API call with circuit breaker and rate limiter protection.
 *
 * @param service - Service name (must match keys in circuit-breaker.ts and rate-limiter.ts)
 * @param fn - The async function to execute
 * @returns The result of the function
 * @throws ServiceUnavailableError if circuit is open or rate limited
 */
export async function protectedApiCall<T>(
	service: string,
	fn: () => Promise<T>
): Promise<T> {
	const breaker = circuitBreakerManager.getBreaker(service);
	const limiter = rateLimiterManager.getLimiter(service);

	// Check rate limit before firing through the breaker
	const rateStatus = await limiter.checkLimit();
	if (!rateStatus.allowed) {
		log.warn({ service, retryAfter: rateStatus.retryAfter }, 'Rate limited');
		throw new ServiceUnavailableError(
			service,
			'Rate limit exceeded',
			rateStatus.retryAfter
		);
	}

	// Record the request against rate limiter
	await limiter.recordRequest();

	// Fire through opossum breaker — it handles timeout, state transitions,
	// and will throw a circuit-open error if the breaker is tripped.
	try {
		return await breaker.fire(fn) as T;
	} catch (err: any) {
		// Opossum throws a generic error when circuit is open — wrap it
		if (err.message?.includes('Breaker is open') || err.code === 'EOPENBREAKER') {
			log.warn({ service }, 'Circuit breaker is open');
			throw new ServiceUnavailableError(service, 'Circuit breaker is open');
		}
		if (err.code === 'ETIMEDOUT') {
			log.warn({ service }, 'Request timed out through circuit breaker');
			throw new ServiceUnavailableError(service, 'Request timed out');
		}
		throw err;
	}
}
