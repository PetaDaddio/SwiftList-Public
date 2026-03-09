import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireAdmin } from '$lib/utils/admin-guard';
import { createServiceRoleClient } from '$lib/supabase/client';
import { getMetricsSnapshot, getProviderCallRates } from '$lib/utils/metrics-collector';
import { circuitBreakerManager } from '$lib/utils/circuit-breaker';

// Capacity limits from docs/CAPACITY-PLANNING.md
const CAPACITY_LIMITS = {
	replicate_rpm: 600,
	fal_ai_daily: 500,
	imagen_ipm: 10,
	gemini_rpd: 1500,
	anthropic_rpm: 50,
	redis_ops_daily: 16666
} as const;

// Replicate cost estimation (same as dashboard/collectors/replicate.js)
const MODEL_COSTS: Record<string, number> = {
	'cjwbw/rembg': 0.0023,
	'lucataco/remove-bg': 0.0023,
	'nightmareai/real-esrgan': 0.0046,
	default: 0.005
};

function estimateReplicateCost(model: string, predictTime?: number): number {
	for (const [key, rate] of Object.entries(MODEL_COSTS)) {
		if (key === 'default') continue;
		if (model.includes(key)) return rate;
	}
	if (predictTime) return predictTime * 0.00115;
	return MODEL_COSTS.default;
}

// Date helpers
function todayStart(): string {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.toISOString();
}

function weekStart(): string {
	const d = new Date();
	d.setDate(d.getDate() - d.getDay());
	d.setHours(0, 0, 0, 0);
	return d.toISOString();
}

function daysAgoISO(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	d.setHours(0, 0, 0, 0);
	return d.toISOString();
}

function timeAgo(isoString: string): string {
	if (!isoString) return '—';
	const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
	if (seconds < 60) return 'just now';
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
	return new Date(isoString).toLocaleDateString();
}

// Fetch Replicate predictions (up to 3 pages)
async function fetchReplicateMetrics(): Promise<any> {
	const token = env.REPLICATE_API_TOKEN;
	if (!token) return { error: 'REPLICATE_API_TOKEN not configured' };

	try {
		let allPredictions: any[] = [];
		let nextCursor: string | null = null;

		for (let page = 0; page < 3; page++) {
			const fetchUrl: string = nextCursor || 'https://api.replicate.com/v1/predictions';
			const fetchResponse: Response = await fetch(fetchUrl, {
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(15000)
			});
			if (!fetchResponse.ok) break;
			const result: any = await fetchResponse.json();
			if (result.results) allPredictions = allPredictions.concat(result.results);
			nextCursor = result.next;
			if (!nextCursor) break;
		}

		const byStatus: Record<string, number> = {};
		const byModel: Record<string, { count: number; totalTimeSec: number; estimatedCost: number }> = {};
		let totalCost = 0;
		let last24h = 0;
		let last7d = 0;
		const now = Date.now();

		for (const pred of allPredictions) {
			byStatus[pred.status] = (byStatus[pred.status] || 0) + 1;
			const createdAt = new Date(pred.created_at).getTime();
			if (createdAt > now - 86400000) last24h++;
			if (createdAt > now - 604800000) last7d++;

			const model = pred.model || 'unknown';
			if (!byModel[model]) byModel[model] = { count: 0, totalTimeSec: 0, estimatedCost: 0 };
			byModel[model].count++;
			const predictTime = pred.metrics?.predict_time || 0;
			byModel[model].totalTimeSec += predictTime;
			const cost = estimateReplicateCost(model, predictTime);
			byModel[model].estimatedCost += cost;
			totalCost += cost;
		}

		// Round costs
		for (const m of Object.values(byModel)) {
			m.totalTimeSec = parseFloat(m.totalTimeSec.toFixed(2));
			m.estimatedCost = parseFloat(m.estimatedCost.toFixed(4));
		}

		const dailyRate = last7d > 0 ? totalCost / 7 : 0;

		return {
			totalPredictions: allPredictions.length,
			last24h,
			last7d,
			byStatus,
			byModel,
			totalCostEstimate: parseFloat(totalCost.toFixed(4)),
			monthlyBurnRate: parseFloat((dailyRate * 30).toFixed(2))
		};
	} catch (err: any) {
		return { error: err.message || 'Replicate fetch failed' };
	}
}

// Fetch storage object counts
async function fetchStorageCounts(supabaseUrl: string, serviceRoleKey: string): Promise<{ uploads: number; outputs: number }> {
	const counts = { uploads: 0, outputs: 0 };
	for (const bucket of ['job-uploads', 'job-outputs'] as const) {
		try {
			const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
				method: 'POST',
				headers: {
					apikey: serviceRoleKey,
					Authorization: `Bearer ${serviceRoleKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ prefix: '', limit: 1000, offset: 0 }),
				signal: AbortSignal.timeout(10000)
			});
			const data = await response.json();
			if (bucket === 'job-uploads') counts.uploads = Array.isArray(data) ? data.length : 0;
			else counts.outputs = Array.isArray(data) ? data.length : 0;
		} catch {
			// leave as 0
		}
	}
	return counts;
}

// Health check
async function checkHealth(): Promise<{ app: string; latencyMs: number }> {
	const appUrl = env.PUBLIC_APP_URL || env.APP_URL || 'https://swiftlist.app';
	try {
		const start = Date.now();
		const response = await fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(10000) });
		const latencyMs = Date.now() - start;
		if (response.ok) return { app: 'healthy', latencyMs };
		return { app: 'degraded', latencyMs };
	} catch {
		return { app: 'down', latencyMs: 0 };
	}
}

export const load = async ({ locals }: { locals: any }) => {
	// 1. Auth check
	if (!locals.session) {
		throw redirect(303, '/auth/login?next=/admin/capacity');
	}

	const userId = (locals as any).user?.id as string | undefined;

	// 2. Admin check
	requireAdmin(userId, env.ADMIN_USER_IDS);

	// 3. Get service role key
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	const emptyResult = {
		todayJobs: { total: 0, total_cost: 0, unique_users: 0, completed: 0, failed: 0, pending: 0 },
		todayApiCalls: [] as any[],
		dailyJobs: [] as any[],
		dailyApiCalls: [] as any[],
		metricsSnapshot: getMetricsSnapshot(),
		providerRates: getProviderCallRates(),
		providerDailyCounts: {} as Record<string, number>,
		capacityLimits: CAPACITY_LIMITS,
		// Mission Control data
		jobsByStatus: { completed: 0, failed: 0, processing: 0, pending: 0 },
		dailyTrend: [] as any[],
		recentFailed: [] as any[],
		profileMetrics: { total: 0, totalCredits: 0, newToday: 0, newThisWeek: 0, users: [] as any[] },
		incidentMetrics: { total: 0, unresolved: 0, bySeverity: {} as Record<string, number>, recent: [] as any[] },
		storageMetrics: { uploads: 0, outputs: 0 },
		replicateMetrics: { error: 'No service role key' } as any,
		healthStatus: { app: 'unknown', latencyMs: 0 },
		creditsByType: {} as Record<string, number>
	};

	if (!serviceRoleKey) return emptyResult;

	const supabase = createServiceRoleClient(serviceRoleKey);
	const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || '';

	// 4. Run ALL queries in parallel
	const [
		capacityRpc,
		allJobsResult,
		failedJobsResult,
		profilesResult,
		creditsResult,
		incidentsResult,
		replicateData,
		storageData,
		healthData
	] = await Promise.allSettled([
		// Existing capacity RPC
		supabase.rpc('get_capacity_metrics', { p_lookback_days: 7 }),
		// All jobs for aggregation
		supabase.from('jobs').select('job_id,status,product_type,cost_usd,processing_time_seconds,error_message,created_at,completed_at').order('created_at', { ascending: false }).limit(1000),
		// Recent failed jobs
		supabase.from('jobs').select('job_id,status,product_type,product_name,error_message,created_at').eq('status', 'failed').order('created_at', { ascending: false }).limit(10),
		// Profiles
		supabase.from('profiles').select('user_id,email,display_name,credits_balance,subscription_tier,created_at'),
		// Credit transactions
		supabase.from('credit_transactions').select('amount,transaction_type,created_at').order('created_at', { ascending: false }).limit(200),
		// Lifeguard incidents
		supabase.from('lifeguard_incidents').select('id,severity,category,error_message,resolved,created_at').order('created_at', { ascending: false }).limit(50),
		// Replicate API
		fetchReplicateMetrics(),
		// Storage counts
		fetchStorageCounts(supabaseUrl, serviceRoleKey),
		// Health check
		checkHealth()
	]);

	// --- Extract capacity metrics (existing) ---
	let capacityMetrics: any = null;
	if (capacityRpc.status === 'fulfilled' && !capacityRpc.value.error) {
		capacityMetrics = capacityRpc.value.data;
	}

	const metricsSnapshot = getMetricsSnapshot();
	const providerRates = getProviderCallRates();

	const todayJobs = capacityMetrics?.today_jobs || { total: 0, total_cost: 0, unique_users: 0 };
	const todayApiCalls = capacityMetrics?.today_api_calls || [];
	const dailyJobs = capacityMetrics?.daily_jobs || [];
	const dailyApiCalls = capacityMetrics?.daily_api_calls || [];

	const providerDailyCounts: Record<string, number> = {};
	for (const row of todayApiCalls) {
		const provider = row.provider || 'unknown';
		providerDailyCounts[provider] = (providerDailyCounts[provider] || 0) + (row.call_count || 0);
	}

	// --- Compute job metrics (from Mission Control) ---
	const allJobs = (allJobsResult.status === 'fulfilled' && allJobsResult.value.data) ? allJobsResult.value.data : [];
	const jobsByStatus = { completed: 0, failed: 0, processing: 0, pending: 0 };
	const today = todayStart();
	const thirtyDaysAgo = daysAgoISO(30);

	// Build 30-day daily map
	const dailyMap: Record<string, { date: string; total: number; completed: number; failed: number }> = {};
	for (let i = 0; i < 30; i++) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const key = d.toISOString().slice(0, 10);
		dailyMap[key] = { date: key, total: 0, completed: 0, failed: 0 };
	}

	let totalProcessingTime = 0;
	let completedWithTime = 0;

	for (const job of allJobs) {
		const status = job.status as keyof typeof jobsByStatus;
		if (status in jobsByStatus) jobsByStatus[status]++;

		if (job.processing_time_seconds && job.status === 'completed') {
			totalProcessingTime += job.processing_time_seconds;
			completedWithTime++;
		}

		if (job.created_at >= thirtyDaysAgo) {
			const key = job.created_at.slice(0, 10);
			if (dailyMap[key]) {
				dailyMap[key].total++;
				if (job.status === 'completed') dailyMap[key].completed++;
				if (job.status === 'failed') dailyMap[key].failed++;
			}
		}
	}

	const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

	// --- Failed jobs ---
	const recentFailed = (failedJobsResult.status === 'fulfilled' && failedJobsResult.value.data)
		? failedJobsResult.value.data.map((job: any) => ({
			...job,
			timeAgo: timeAgo(job.created_at)
		}))
		: [];

	// --- Profile metrics ---
	const profiles = (profilesResult.status === 'fulfilled' && profilesResult.value.data) ? profilesResult.value.data : [];
	const wkStart = weekStart();
	const profileMetrics = {
		total: profiles.length,
		totalCredits: profiles.reduce((sum: number, p: any) => sum + (p.credits_balance || 0), 0),
		newToday: profiles.filter((p: any) => p.created_at >= today).length,
		newThisWeek: profiles.filter((p: any) => p.created_at >= wkStart).length,
		users: profiles.map((p: any) => ({
			displayName: p.display_name || p.email?.split('@')[0] || 'Anonymous',
			email: p.email,
			credits: p.credits_balance || 0,
			tier: p.subscription_tier || 'free',
			joined: p.created_at,
			joinedAgo: timeAgo(p.created_at)
		})).sort((a: any, b: any) => new Date(b.joined).getTime() - new Date(a.joined).getTime())
	};

	// --- Credits by type ---
	const creditTxns = (creditsResult.status === 'fulfilled' && creditsResult.value.data) ? creditsResult.value.data : [];
	const creditsByType: Record<string, number> = {};
	for (const txn of creditTxns) {
		const t = txn.transaction_type || 'unknown';
		creditsByType[t] = (creditsByType[t] || 0) + Math.abs(txn.amount || 0);
	}

	// --- Incident metrics ---
	const incidents = (incidentsResult.status === 'fulfilled' && incidentsResult.value.data) ? incidentsResult.value.data : [];
	const bySeverity: Record<string, number> = {};
	let unresolvedCount = 0;
	for (const inc of incidents) {
		bySeverity[inc.severity || 'info'] = (bySeverity[inc.severity || 'info'] || 0) + 1;
		if (!inc.resolved) unresolvedCount++;
	}
	const incidentMetrics = {
		total: incidents.length,
		unresolved: unresolvedCount,
		bySeverity,
		recent: incidents.slice(0, 10).map((inc: any) => ({
			...inc,
			timeAgo: timeAgo(inc.created_at)
		}))
	};

	// --- Replicate + Storage + Health ---
	const replicateMetrics = replicateData.status === 'fulfilled' ? replicateData.value : { error: 'Fetch failed' };
	const storageMetrics = storageData.status === 'fulfilled' ? storageData.value : { uploads: 0, outputs: 0 };
	const healthStatus = healthData.status === 'fulfilled' ? healthData.value : { app: 'unknown', latencyMs: 0 };

	return {
		todayJobs,
		todayApiCalls,
		dailyJobs,
		dailyApiCalls,
		metricsSnapshot,
		providerRates,
		providerDailyCounts,
		capacityLimits: CAPACITY_LIMITS,
		circuitBreakers: circuitBreakerManager.getAllMetrics(),
		// Mission Control data
		jobsByStatus,
		dailyTrend,
		recentFailed,
		profileMetrics,
		incidentMetrics,
		storageMetrics,
		replicateMetrics,
		healthStatus,
		creditsByType
	};
};
