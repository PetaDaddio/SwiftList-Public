/**
 * SwiftList Circuit Breaker Utility (opossum-backed)
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Service is failing, reject immediately to fail fast
 * - HALF_OPEN: Testing if service has recovered
 *
 * Each provider gets its own opossum CircuitBreaker instance.
 * The breaker wraps a passthrough function — the real API call
 * is passed at fire() time via a thunk.
 */

import OpossumBreaker from 'opossum';
import { infraLogger } from '$lib/utils/logger';

const log = infraLogger.child({ component: 'circuit-breaker' });

// ── Shared types (kept for backward compat) ──

export enum CircuitState {
	CLOSED = 'CLOSED',
	OPEN = 'OPEN',
	HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitMetrics {
	state: CircuitState;
	failureCount: number;
	successCount: number;
	lastFailureTime: number | null;
	lastStateChange: number;
	totalRequests: number;
	totalFailures: number;
}

// ── Opossum defaults ──

const DEFAULT_OPTIONS: OpossumBreaker.Options = {
	timeout: 30_000,               // 30 s per call
	errorThresholdPercentage: 50,  // 50 % failure rate → open
	resetTimeout: 30_000,          // 30 s before half-open test
	volumeThreshold: 5,            // Min 5 requests before tripping
	rollingCountTimeout: 60_000,   // 60 s rolling window
};

// ── Passthrough function the breakers wrap ──
// The actual API call is supplied at fire() time as a thunk.
async function passthrough<T>(fn: () => Promise<T>): Promise<T> {
	return fn();
}

// ── Map opossum state → our enum ──
function mapState(breaker: OpossumBreaker): CircuitState {
	if (breaker.opened) return CircuitState.OPEN;
	if (breaker.halfOpen) return CircuitState.HALF_OPEN;
	return CircuitState.CLOSED;
}

// ── Manager ──

class CircuitBreakerManager {
	private breakers: Map<string, OpossumBreaker> = new Map();
	private lastFailureTimes: Map<string, number> = new Map();
	private stateChangeTimes: Map<string, number> = new Map();

	/**
	 * Get or create an opossum breaker for a service.
	 */
	getBreaker(service: string, overrides?: Partial<OpossumBreaker.Options>): OpossumBreaker {
		if (!this.breakers.has(service)) {
			const opts = { ...DEFAULT_OPTIONS, ...overrides };
			const breaker = new OpossumBreaker(passthrough, opts);

			// Logging hooks
			breaker.on('open', () => {
				this.stateChangeTimes.set(service, Date.now());
				log.error({ service }, 'Circuit OPENED');
			});
			breaker.on('halfOpen', () => {
				this.stateChangeTimes.set(service, Date.now());
				log.info({ service }, 'Circuit HALF_OPEN — testing recovery');
			});
			breaker.on('close', () => {
				this.stateChangeTimes.set(service, Date.now());
				log.info({ service }, 'Circuit CLOSED — service recovered');
			});
			breaker.on('failure', () => {
				this.lastFailureTimes.set(service, Date.now());
			});

			this.stateChangeTimes.set(service, Date.now());
			this.breakers.set(service, breaker);
		}
		return this.breakers.get(service)!;
	}

	/**
	 * Get metrics for all services (backward-compatible shape).
	 */
	getAllMetrics(): Record<string, CircuitMetrics> {
		const metrics: Record<string, CircuitMetrics> = {};
		this.breakers.forEach((breaker, service) => {
			const info = breaker.toJSON();
			const status = info.status;
			metrics[service] = {
				state: mapState(breaker),
				failureCount: status?.failures ?? 0,
				successCount: status?.successes ?? 0,
				lastFailureTime: this.lastFailureTimes.get(service) ?? null,
				lastStateChange: this.stateChangeTimes.get(service) ?? Date.now(),
				totalRequests: status?.fires ?? 0,
				totalFailures: status?.failures ?? 0,
			};
		});
		return metrics;
	}

	/**
	 * Reset all circuit breakers to CLOSED.
	 */
	resetAll(): void {
		this.breakers.forEach((breaker) => breaker.close());
	}
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Pre-configure breakers for known services
export const serviceBreakers = {
	replicate: circuitBreakerManager.getBreaker('Replicate'),
	falAi: circuitBreakerManager.getBreaker('fal.ai'),
	googleGemini: circuitBreakerManager.getBreaker('Google Gemini'),
	googleImagen: circuitBreakerManager.getBreaker('Google Imagen'),
	anthropic: circuitBreakerManager.getBreaker('Anthropic'),
	runway: circuitBreakerManager.getBreaker('Runway'),
	elevenLabs: circuitBreakerManager.getBreaker('ElevenLabs'),
	shopify: circuitBreakerManager.getBreaker('Shopify'),
	etsy: circuitBreakerManager.getBreaker('Etsy'),
	amazon: circuitBreakerManager.getBreaker('Amazon MWS'),
};
