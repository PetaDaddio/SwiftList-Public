/**
 * Health Check Endpoint
 * Returns app status, Supabase connectivity, and Redis connectivity.
 * Excluded from rate limiting (checked in hooks.server.ts).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '$lib/supabase/client';
import { getMetricsSnapshot } from '$lib/utils/metrics-collector';

interface HealthCheck {
	name: string;
	status: 'pass' | 'fail';
	latencyMs?: number;
	message?: string;
}

export const GET: RequestHandler = async () => {
	const checks: HealthCheck[] = [];
	const startTime = Date.now();

	// Check 1: App is alive (always passes if we get here)
	checks.push({ name: 'app', status: 'pass' });

	// Check 2: Supabase connectivity
	try {
		const supabase = createClient();
		const supabaseStart = Date.now();
		const { error } = await supabase.from('profiles').select('user_id').limit(1);
		const supabaseLatency = Date.now() - supabaseStart;

		if (error) {
			checks.push({ name: 'supabase', status: 'fail', latencyMs: supabaseLatency, message: error.message });
		} else {
			checks.push({ name: 'supabase', status: 'pass', latencyMs: supabaseLatency });
		}
	} catch (err) {
		checks.push({
			name: 'supabase',
			status: 'fail',
			message: err instanceof Error ? err.message : 'Connection failed'
		});
	}

	// Check 3: Redis connectivity (via BullMQ)
	try {
		const { env } = await import('$env/dynamic/private');
		const redisUrl = env.REDIS_URL;
		const redisHost = env.REDIS_HOST;

		if (!redisUrl && !redisHost) {
			checks.push({ name: 'redis', status: 'fail', message: 'REDIS_URL or REDIS_HOST not configured' });
		} else {
			// Attempt a lightweight Redis PING
			const { default: Redis } = await import('ioredis');
			const redis = redisUrl
				? new Redis(redisUrl, { connectTimeout: 3000, lazyConnect: true })
				: new Redis({
						host: redisHost,
						port: parseInt(env.REDIS_PORT || '6379'),
						password: env.REDIS_PASSWORD,
						connectTimeout: 3000,
						lazyConnect: true
					});

			const redisStart = Date.now();
			await redis.connect();
			await redis.ping();
			const redisLatency = Date.now() - redisStart;
			await redis.quit();

			checks.push({ name: 'redis', status: 'pass', latencyMs: redisLatency });
		}
	} catch (err) {
		checks.push({
			name: 'redis',
			status: 'fail',
			message: err instanceof Error ? err.message : 'Connection failed'
		});
	}

	// Determine overall status
	const allPass = checks.every((c) => c.status === 'pass');
	const anyFail = checks.some((c) => c.status === 'fail' && c.name !== 'redis');
	const overallStatus = allPass ? 'healthy' : anyFail ? 'unhealthy' : 'degraded';

	const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

	// SECURITY: Return minimal info for public health checks
	// Detailed diagnostics hidden to prevent infrastructure reconnaissance
	return json(
		{
			status: overallStatus,
			timestamp: new Date().toISOString(),
			version: '1.0.0'
		},
		{ status: statusCode }
	);
};
