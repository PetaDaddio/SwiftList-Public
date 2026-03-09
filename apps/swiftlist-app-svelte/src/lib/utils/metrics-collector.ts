/**
 * Lightweight In-Memory Metrics Collector
 *
 * Tracks API request metrics in sliding time windows and triggers
 * Lifeguard alerts when thresholds are breached.
 *
 * Usage (from hooks.server.ts):
 * ```ts
 * import { recordRequest, recordJobOutcome } from '$lib/utils/metrics-collector';
 *
 * // After each request
 * recordRequest(pathname, status, latencyMs);
 *
 * // After job completes
 * recordJobOutcome(success);
 * ```
 */

import { dev } from '$app/environment';
import { infraLogger } from '$lib/utils/logger';

const log = infraLogger.child({ component: 'metrics' });

// ============================================================================
// TYPES
// ============================================================================

interface MetricsBucket {
	timestamp: number;
	totalRequests: number;
	errorRequests: number; // 5xx
	authRequests: number;
	authFailures: number; // 401/403 on auth routes
	latencies: number[];
	jobSuccesses: number;
	jobFailures: number;
}

interface AlertThreshold {
	name: string;
	check: (buckets: MetricsBucket[]) => { breached: boolean; value: string; threshold: string };
	windowMinutes: number;
	cooldownMinutes: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BUCKET_DURATION_MS = 60_000; // 1-minute buckets
const MAX_BUCKETS = 60; // Keep 1 hour of data
const CHECK_INTERVAL_MS = 60_000; // Check thresholds every minute
const MAX_LATENCY_SAMPLES = 200; // Per bucket, to cap memory

// ============================================================================
// PROVIDER CALL TRACKING (for capacity dashboard)
// ============================================================================

type ProviderName = 'replicate' | 'fal_ai' | 'google_imagen' | 'google_gemini' | 'anthropic';

/** Rolling window of call timestamps per provider (last 5 minutes) */
const providerCallTimestamps = new Map<ProviderName, number[]>();
const PROVIDER_WINDOW_MS = 5 * 60_000; // 5 minutes

/**
 * Record an external provider API call for real-time rate tracking.
 * Call this alongside logApiCall() for in-memory rate gauges.
 */
export function recordProviderCall(provider: ProviderName): void {
	const now = Date.now();
	if (!providerCallTimestamps.has(provider)) {
		providerCallTimestamps.set(provider, []);
	}
	const timestamps = providerCallTimestamps.get(provider)!;
	timestamps.push(now);

	// Prune entries older than 5 minutes
	const cutoff = now - PROVIDER_WINDOW_MS;
	while (timestamps.length > 0 && timestamps[0] < cutoff) {
		timestamps.shift();
	}
}

/**
 * Get calls/minute rates for each provider (last 1 min and last 5 min).
 */
export function getProviderCallRates(): Record<
	string,
	{ lastMinute: number; last5Min: number }
> {
	const now = Date.now();
	const oneMinAgo = now - 60_000;
	const fiveMinAgo = now - PROVIDER_WINDOW_MS;

	const rates: Record<string, { lastMinute: number; last5Min: number }> = {};

	for (const [provider, timestamps] of providerCallTimestamps.entries()) {
		// Prune old entries
		while (timestamps.length > 0 && timestamps[0] < fiveMinAgo) {
			timestamps.shift();
		}

		const last5Min = timestamps.length;
		const lastMinute = timestamps.filter((t) => t >= oneMinAgo).length;

		rates[provider] = { lastMinute, last5Min };
	}

	return rates;
}

// ============================================================================
// STATE
// ============================================================================

const buckets: MetricsBucket[] = [];
const lastAlertTime = new Map<string, number>();
let checkTimer: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// ALERT THRESHOLDS
// ============================================================================

const THRESHOLDS: AlertThreshold[] = [
	{
		name: 'API Error Rate',
		windowMinutes: 5,
		cooldownMinutes: 15,
		check(windowBuckets) {
			const total = windowBuckets.reduce((s, b) => s + b.totalRequests, 0);
			const errors = windowBuckets.reduce((s, b) => s + b.errorRequests, 0);
			if (total < 10) return { breached: false, value: '0%', threshold: '3%' };
			const rate = (errors / total) * 100;
			return {
				breached: rate > 3,
				value: `${rate.toFixed(1)}%`,
				threshold: '3%'
			};
		}
	},
	{
		name: 'API Latency (p95)',
		windowMinutes: 5,
		cooldownMinutes: 15,
		check(windowBuckets) {
			const allLatencies = windowBuckets.flatMap((b) => b.latencies);
			if (allLatencies.length < 10) return { breached: false, value: '0ms', threshold: '5000ms' };
			allLatencies.sort((a, b) => a - b);
			const p95Index = Math.floor(allLatencies.length * 0.95);
			const p95 = allLatencies[p95Index];
			return {
				breached: p95 > 5000,
				value: `${p95.toFixed(0)}ms`,
				threshold: '5000ms'
			};
		}
	},
	{
		name: 'Auth Success Rate',
		windowMinutes: 5,
		cooldownMinutes: 15,
		check(windowBuckets) {
			const total = windowBuckets.reduce((s, b) => s + b.authRequests, 0);
			const failures = windowBuckets.reduce((s, b) => s + b.authFailures, 0);
			if (total < 5) return { breached: false, value: '100%', threshold: '95%' };
			const successRate = ((total - failures) / total) * 100;
			return {
				breached: successRate < 95,
				value: `${successRate.toFixed(1)}%`,
				threshold: '95%'
			};
		}
	},
	{
		name: 'Job Success Rate',
		windowMinutes: 60,
		cooldownMinutes: 30,
		check(windowBuckets) {
			const successes = windowBuckets.reduce((s, b) => s + b.jobSuccesses, 0);
			const failures = windowBuckets.reduce((s, b) => s + b.jobFailures, 0);
			const total = successes + failures;
			if (total < 3) return { breached: false, value: '100%', threshold: '90%' };
			const rate = (successes / total) * 100;
			return {
				breached: rate < 90,
				value: `${rate.toFixed(1)}%`,
				threshold: '90%'
			};
		}
	}
];

// ============================================================================
// BUCKET MANAGEMENT
// ============================================================================

function getCurrentBucket(): MetricsBucket {
	const now = Date.now();
	const bucketTs = now - (now % BUCKET_DURATION_MS);

	if (buckets.length === 0 || buckets[buckets.length - 1].timestamp !== bucketTs) {
		const bucket: MetricsBucket = {
			timestamp: bucketTs,
			totalRequests: 0,
			errorRequests: 0,
			authRequests: 0,
			authFailures: 0,
			latencies: [],
			jobSuccesses: 0,
			jobFailures: 0
		};
		buckets.push(bucket);

		// Prune old buckets
		while (buckets.length > MAX_BUCKETS) {
			buckets.shift();
		}
	}

	return buckets[buckets.length - 1];
}

function getBucketsInWindow(windowMinutes: number): MetricsBucket[] {
	const cutoff = Date.now() - windowMinutes * 60_000;
	return buckets.filter((b) => b.timestamp >= cutoff);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Record an HTTP request metric. Call after each request resolves.
 */
export function recordRequest(pathname: string, status: number, latencyMs: number): void {
	const bucket = getCurrentBucket();
	bucket.totalRequests++;

	if (status >= 500) {
		bucket.errorRequests++;
	}

	if (pathname.startsWith('/api/auth/')) {
		bucket.authRequests++;
		if (status === 401 || status === 403) {
			bucket.authFailures++;
		}
	}

	if (bucket.latencies.length < MAX_LATENCY_SAMPLES) {
		bucket.latencies.push(latencyMs);
	}

	ensureCheckTimer();
}

/**
 * Record a job outcome. Call from job processing routes.
 */
export function recordJobOutcome(success: boolean): void {
	const bucket = getCurrentBucket();
	if (success) {
		bucket.jobSuccesses++;
	} else {
		bucket.jobFailures++;
	}
}

/**
 * Get current metrics snapshot (for health/debug endpoints).
 */
export function getMetricsSnapshot(): {
	last5min: { requests: number; errors: number; p95LatencyMs: number };
	last1hour: { requests: number; errors: number; jobSuccessRate: number };
} {
	const fiveMin = getBucketsInWindow(5);
	const oneHour = getBucketsInWindow(60);

	const fiveMinReqs = fiveMin.reduce((s, b) => s + b.totalRequests, 0);
	const fiveMinErrs = fiveMin.reduce((s, b) => s + b.errorRequests, 0);
	const fiveMinLat = fiveMin.flatMap((b) => b.latencies).sort((a, b) => a - b);
	const p95 = fiveMinLat.length > 0 ? fiveMinLat[Math.floor(fiveMinLat.length * 0.95)] : 0;

	const hourReqs = oneHour.reduce((s, b) => s + b.totalRequests, 0);
	const hourErrs = oneHour.reduce((s, b) => s + b.errorRequests, 0);
	const jobS = oneHour.reduce((s, b) => s + b.jobSuccesses, 0);
	const jobF = oneHour.reduce((s, b) => s + b.jobFailures, 0);
	const jobTotal = jobS + jobF;

	return {
		last5min: { requests: fiveMinReqs, errors: fiveMinErrs, p95LatencyMs: Math.round(p95) },
		last1hour: {
			requests: hourReqs,
			errors: hourErrs,
			jobSuccessRate: jobTotal > 0 ? Math.round((jobS / jobTotal) * 100) : 100
		}
	};
}

// ============================================================================
// THRESHOLD CHECKING
// ============================================================================

function checkThresholds(): void {
	if (dev) return;

	const now = Date.now();

	for (const threshold of THRESHOLDS) {
		const windowBuckets = getBucketsInWindow(threshold.windowMinutes);
		const result = threshold.check(windowBuckets);

		if (!result.breached) continue;

		// Cooldown check
		const lastAlert = lastAlertTime.get(threshold.name) || 0;
		if (now - lastAlert < threshold.cooldownMinutes * 60_000) continue;

		lastAlertTime.set(threshold.name, now);

		log.warn(
			{ alert: threshold.name, value: result.value, threshold: result.threshold },
			`Threshold breached: ${threshold.name}`
		);

		// Fire-and-forget Lifeguard alert
		sendThresholdAlert(threshold.name, result.value, result.threshold).catch(() => {});
	}
}

async function sendThresholdAlert(name: string, value: string, threshold: string): Promise<void> {
	try {
		const baseUrl = (import.meta.env.ORIGIN as string | undefined) || 'http://localhost:5173';
		await fetch(`${baseUrl}/api/lifeguard/report`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				error_message: `[ALERT] ${name}: ${value} (threshold: ${threshold})`,
				severity: 'warning',
				category: 'threshold_alert',
				environment: 'production'
			})
		});
	} catch {
		// Silently fail
	}
}

// ============================================================================
// TIMER MANAGEMENT
// ============================================================================

function ensureCheckTimer(): void {
	if (checkTimer) return;
	checkTimer = setInterval(checkThresholds, CHECK_INTERVAL_MS);
	if (checkTimer && typeof checkTimer === 'object' && 'unref' in checkTimer) {
		checkTimer.unref();
	}
}
