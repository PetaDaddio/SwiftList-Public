<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import CapacityGauge from '$lib/components/admin/CapacityGauge.svelte';
	import TrendChart from '$lib/components/admin/TrendChart.svelte';
	import DonutChart from '$lib/components/admin/DonutChart.svelte';
	import LineChart from '$lib/components/admin/LineChart.svelte';
	import BarChart from '$lib/components/admin/BarChart.svelte';

	let { data } = $props();

	// Auto-refresh every 30 seconds with countdown
	let refreshInterval: ReturnType<typeof setInterval>;
	let countdownInterval: ReturnType<typeof setInterval>;
	let secondsLeft = $state(30);

	onMount(() => {
		refreshInterval = setInterval(() => {
			invalidateAll();
			secondsLeft = 30;
		}, 30_000);
		countdownInterval = setInterval(() => {
			secondsLeft = Math.max(0, secondsLeft - 1);
		}, 1000);
		return () => {
			clearInterval(refreshInterval);
			clearInterval(countdownInterval);
		};
	});

	function manualRefresh() {
		invalidateAll();
		secondsLeft = 30;
	}

	// Format helpers
	function formatCost(val: number): string {
		return `$${val.toFixed(2)}`;
	}

	// ---- KPI derivations ----
	const jobsToday = $derived(data.todayJobs?.total || 0);
	const costToday = $derived(data.todayJobs?.total_cost || 0);
	const usersToday = $derived(data.todayJobs?.unique_users || 0);
	const successRate = $derived(data.metricsSnapshot?.last1hour?.jobSuccessRate ?? 100);
	const totalUsers = $derived(data.profileMetrics?.total || 0);
	const totalCredits = $derived(data.profileMetrics?.totalCredits || 0);

	// ---- Provider capacity ----
	const limits = $derived(data.capacityLimits ?? {
		replicate_rpm: 600, fal_ai_daily: 500, imagen_ipm: 10,
		gemini_rpd: 1500, anthropic_rpm: 50, redis_ops_daily: 16666
	});
	const rates = $derived(data.providerRates || {} as Record<string, { lastMinute: number; last5Min: number }>);
	const dailyCounts = $derived(data.providerDailyCounts || {} as Record<string, number>);

	// ---- Donut chart data ----
	const donutLabels = ['Completed', 'Failed', 'Processing', 'Pending'];
	const donutColors = ['#22C55E', '#EF4444', '#F59E0B', '#6366F1'];
	const donutValues = $derived([
		data.jobsByStatus?.completed || 0,
		data.jobsByStatus?.failed || 0,
		data.jobsByStatus?.processing || 0,
		data.jobsByStatus?.pending || 0
	]);
	const donutTotal = $derived(donutValues.reduce((a: number, b: number) => a + b, 0));

	// ---- 30-day line chart data ----
	const trendLabels = $derived((data.dailyTrend || []).map((d: any) => d.date.slice(5)));
	const trendDatasets = $derived([
		{ label: 'Total', data: (data.dailyTrend || []).map((d: any) => d.total), color: '#00796B', fill: true },
		{ label: 'Completed', data: (data.dailyTrend || []).map((d: any) => d.completed), color: '#22C55E' },
		{ label: 'Failed', data: (data.dailyTrend || []).map((d: any) => d.failed), color: '#EF4444' }
	]);

	// ---- 7-day trends (existing) ----
	const jobsTrend = $derived(
		(data.dailyJobs || []).map((d: any) => ({
			label: new Date(d.day).toLocaleDateString('en-US', { weekday: 'short' }),
			value: d.total || 0,
			color: '#00796B'
		}))
	);
	const costTrend = $derived(
		(data.dailyJobs || []).map((d: any) => ({
			label: new Date(d.day).toLocaleDateString('en-US', { weekday: 'short' }),
			value: d.total_cost || 0,
			color: '#8B5CF6'
		}))
	);

	// ---- Provider breakdown table ----
	const providerBreakdown = $derived(
		(data.todayApiCalls || []).reduce((acc: any[], row: any) => {
			const existing = acc.find((a: any) => a.provider === row.provider);
			if (existing) {
				existing.calls += row.call_count || 0;
				existing.cost += row.total_cost || 0;
				existing.errors += row.error_count || 0;
			} else {
				acc.push({
					provider: row.provider,
					calls: row.call_count || 0,
					cost: row.total_cost || 0,
					errors: row.error_count || 0
				});
			}
			return acc;
		}, [] as any[])
	);

	// ---- Replicate cost data ----
	const replicateModels = $derived(() => {
		const rm = data.replicateMetrics;
		if (!rm || rm.error || !rm.byModel) return [];
		return Object.entries(rm.byModel)
			.map(([model, info]: [string, any]) => ({ model, count: info.count, cost: info.estimatedCost }))
			.sort((a, b) => b.cost - a.cost);
	});

	// ---- Health status ----
	const healthApp = $derived(data.healthStatus?.app || 'unknown');
	const healthLatency = $derived(data.healthStatus?.latencyMs || 0);

	function healthDotColor(status: string): string {
		if (status === 'healthy') return 'bg-green-500';
		if (status === 'degraded') return 'bg-amber-500';
		return 'bg-red-500';
	}

	function severityBadge(severity: string): string {
		if (severity === 'critical') return 'bg-red-100 text-red-700 border-red-200';
		if (severity === 'error') return 'bg-red-50 text-red-600 border-red-100';
		if (severity === 'warning') return 'bg-amber-50 text-amber-700 border-amber-100';
		return 'bg-blue-50 text-blue-600 border-blue-100';
	}
</script>

<svelte:head>
	<title>Mission Control | SwiftList Admin</title>
</svelte:head>

<div class="mc-page">
	<!-- ============================================================ -->
	<!-- HEADER -->
	<!-- ============================================================ -->
	<header class="mc-header">
		<div class="mc-header-left">
			<div class="mc-logo">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#00796B"/>
				</svg>
				<div>
					<h1>Mission Control</h1>
					<p class="mc-breadcrumb">SwiftList Admin <span>/</span> Capacity & Operations</p>
				</div>
			</div>
		</div>
		<div class="mc-header-right">
			<div class="mc-health-dots">
				<div class="mc-health-dot">
					<div class="w-2 h-2 rounded-full {healthDotColor(healthApp)}"></div>
					<span>App</span>
				</div>
				<div class="mc-health-dot">
					<div class="w-2 h-2 rounded-full {data.profileMetrics?.total >= 0 ? 'bg-green-500' : 'bg-red-500'}"></div>
					<span>Supabase</span>
				</div>
				<div class="mc-health-dot">
					<div class="w-2 h-2 rounded-full {data.replicateMetrics?.error ? 'bg-red-500' : 'bg-green-500'}"></div>
					<span>Replicate</span>
				</div>
				{#if healthLatency > 0}
					<span class="mc-latency">{healthLatency}ms</span>
				{/if}
			</div>
			<a href="/admin/experiments" class="mc-btn mc-btn-primary">A/B Tests</a>
			<div class="mc-refresh">
				<span class="mc-countdown">{secondsLeft}s</span>
				<button onclick={manualRefresh} class="mc-btn mc-btn-ghost">Refresh</button>
			</div>
		</div>
	</header>

	<!-- ============================================================ -->
	<!-- SECTION 1: KPI CARDS -->
	<!-- ============================================================ -->
	<div class="mc-kpi-grid">
		<div class="mc-kpi-card">
			<div class="mc-kpi-icon" style="background: #EEF2FF; color: #6366F1;">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
			</div>
			<div class="mc-kpi-body">
				<span class="mc-kpi-label">Jobs Today</span>
				<span class="mc-kpi-value">{jobsToday.toLocaleString()}</span>
			</div>
		</div>
		<div class="mc-kpi-card">
			<div class="mc-kpi-icon" style="background: #F0FDF4; color: #22C55E;">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
			</div>
			<div class="mc-kpi-body">
				<span class="mc-kpi-label">Cost Today</span>
				<span class="mc-kpi-value">{formatCost(costToday)}</span>
			</div>
		</div>
		<div class="mc-kpi-card">
			<div class="mc-kpi-icon" style="background: #FFF7ED; color: #F59E0B;">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
			</div>
			<div class="mc-kpi-body">
				<span class="mc-kpi-label">Active Users</span>
				<span class="mc-kpi-value">{usersToday}</span>
			</div>
		</div>
		<div class="mc-kpi-card">
			<div class="mc-kpi-icon" style="background: #F0F9FF; color: #3B82F6;">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>
			</div>
			<div class="mc-kpi-body">
				<span class="mc-kpi-label">Total Users</span>
				<span class="mc-kpi-value">{totalUsers}
					{#if data.profileMetrics?.newToday > 0}
						<span class="mc-kpi-badge mc-kpi-badge-green">+{data.profileMetrics.newToday}</span>
					{/if}
				</span>
			</div>
		</div>
		<div class="mc-kpi-card">
			<div class="mc-kpi-icon" style="background: #F5F3FF; color: #8B5CF6;">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
			</div>
			<div class="mc-kpi-body">
				<span class="mc-kpi-label">Credits Pool</span>
				<span class="mc-kpi-value">{totalCredits.toLocaleString()}</span>
			</div>
		</div>
		<div class="mc-kpi-card">
			<div class="mc-kpi-icon" style="background: {successRate >= 95 ? '#F0FDF4' : successRate >= 80 ? '#FFF7ED' : '#FEF2F2'}; color: {successRate >= 95 ? '#22C55E' : successRate >= 80 ? '#F59E0B' : '#EF4444'};">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
			</div>
			<div class="mc-kpi-body">
				<span class="mc-kpi-label">Success Rate</span>
				<span class="mc-kpi-value" style="color: {successRate >= 95 ? '#22C55E' : successRate >= 80 ? '#F59E0B' : '#EF4444'}">
					{successRate}%
				</span>
			</div>
		</div>
	</div>

	<!-- ============================================================ -->
	<!-- SECTION 2: CHARTS ROW (Donut + Line) -->
	<!-- ============================================================ -->
	<div class="mc-grid-2 mc-mb">
		<div class="mc-card">
			<div class="mc-card-header">
				<h2>Jobs by Status</h2>
				<span class="mc-badge">{donutTotal} total</span>
			</div>
			<div class="h-[250px]">
				<DonutChart labels={donutLabels} values={donutValues} colors={donutColors} centerText={String(donutTotal)} />
			</div>
		</div>

		<div class="mc-card">
			<div class="mc-card-header">
				<h2>30-Day Job Trend</h2>
			</div>
			<div class="h-[250px]">
				{#if trendLabels.length > 0}
					<LineChart labels={trendLabels} datasets={trendDatasets} />
				{:else}
					<div class="mc-empty">No trend data yet</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- ============================================================ -->
	<!-- SECTION 3: PROVIDER CAPACITY GAUGES -->
	<!-- ============================================================ -->
	<div class="mc-mb">
		<div class="mc-section-title">
			<h2>Provider Capacity</h2>
		</div>
		<div class="mc-gauge-grid">
			<div class="mc-card mc-card-compact">
				<CapacityGauge label="Replicate RPM" current={rates.replicate?.lastMinute || 0} limit={limits.replicate_rpm} unit="rpm" circuitState={data.circuitBreakers?.Replicate?.state} />
			</div>
			<div class="mc-card mc-card-compact">
				<CapacityGauge label="fal.ai Daily" current={dailyCounts.fal_ai || 0} limit={limits.fal_ai_daily} unit="jobs" circuitState={data.circuitBreakers?.['fal.ai']?.state} />
			</div>
			<div class="mc-card mc-card-compact">
				<CapacityGauge label="Imagen IPM" current={rates.google_imagen?.lastMinute || 0} limit={limits.imagen_ipm} unit="ipm" circuitState={data.circuitBreakers?.['Google Imagen']?.state} />
			</div>
			<div class="mc-card mc-card-compact">
				<CapacityGauge label="Gemini RPD" current={dailyCounts.google_gemini || 0} limit={limits.gemini_rpd} unit="calls" circuitState={data.circuitBreakers?.['Google Gemini']?.state} />
			</div>
			<div class="mc-card mc-card-compact">
				<CapacityGauge label="Anthropic RPM" current={rates.anthropic?.lastMinute || 0} limit={limits.anthropic_rpm} unit="rpm" circuitState={data.circuitBreakers?.Anthropic?.state} />
			</div>
			<div class="mc-card mc-card-compact">
				<CapacityGauge label="Redis Ops/Day" current={jobsToday * 20} limit={limits.redis_ops_daily} unit="ops" />
			</div>
		</div>
	</div>

	<!-- ============================================================ -->
	<!-- SECTION 4: API COSTS + STORAGE -->
	<!-- ============================================================ -->
	<div class="mc-grid-2 mc-mb">
		<div class="mc-card">
			<div class="mc-card-header">
				<h2>API Costs (Replicate)</h2>
			</div>
			{#if data.replicateMetrics?.error}
				<p class="mc-muted">{data.replicateMetrics.error}</p>
			{:else}
				<div class="flex items-baseline gap-6 mb-4">
					<div>
						<p class="mc-big-number">${(data.replicateMetrics?.totalCostEstimate || 0).toFixed(2)}</p>
						<p class="mc-muted text-xs">Total estimated</p>
					</div>
					<div>
						<p class="text-lg font-semibold text-amber-600">${(data.replicateMetrics?.monthlyBurnRate || 0).toFixed(2)}/mo</p>
						<p class="mc-muted text-xs">Burn rate</p>
					</div>
				</div>
				<div class="flex gap-4 text-xs mc-muted mb-4">
					<span>24h: {data.replicateMetrics?.last24h || 0}</span>
					<span>7d: {data.replicateMetrics?.last7d || 0}</span>
					<span>Total: {data.replicateMetrics?.totalPredictions || 0}</span>
				</div>
				<div class="space-y-1.5 max-h-[160px] overflow-y-auto">
					{#each replicateModels() as row}
						<div class="mc-list-row">
							<span class="text-[#2C3E50] truncate max-w-[50%]">{row.model}</span>
							<span class="mc-muted">{row.count} runs</span>
							<span class="font-mono text-[#2C3E50]">${row.cost.toFixed(4)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="mc-card">
			<div class="mc-card-header">
				<h2>Storage</h2>
			</div>
			<div class="grid grid-cols-2 gap-4 mb-4">
				<div>
					<p class="mc-big-number" style="color: #6366F1;">{data.storageMetrics?.uploads || 0}</p>
					<p class="mc-muted text-xs">Uploads</p>
				</div>
				<div>
					<p class="mc-big-number" style="color: #22C55E;">{data.storageMetrics?.outputs || 0}</p>
					<p class="mc-muted text-xs">Outputs</p>
				</div>
			</div>
			<div class="h-[180px]">
				<BarChart
					labels={['Uploads', 'Outputs']}
					values={[data.storageMetrics?.uploads || 0, data.storageMetrics?.outputs || 0]}
					colors={['#6366F1', '#22C55E']}
					tooltipSuffix="objects"
				/>
			</div>
		</div>
	</div>

	<!-- ============================================================ -->
	<!-- SECTION 5: FAILED JOBS + INCIDENTS -->
	<!-- ============================================================ -->
	<div class="mc-grid-2 mc-mb">
		<div class="mc-card">
			<div class="mc-card-header">
				<h2>Recent Failed Jobs</h2>
				<span class="mc-count-badge {data.recentFailed?.length > 0 ? 'mc-count-badge-red' : 'mc-count-badge-green'}">
					{data.recentFailed?.length || 0}
				</span>
			</div>
			{#if data.recentFailed?.length > 0}
				<div class="space-y-3 max-h-[240px] overflow-y-auto">
					{#each data.recentFailed as job}
						<div class="mc-list-item">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-[#2C3E50]">{job.product_name || job.product_type || '—'}</span>
								<span class="text-xs mc-muted">{job.timeAgo}</span>
							</div>
							<p class="text-xs text-red-500 mt-0.5 truncate">{job.error_message || 'No error message'}</p>
						</div>
					{/each}
				</div>
			{:else}
				<div class="mc-empty">No failed jobs</div>
			{/if}
		</div>

		<div class="mc-card">
			<div class="mc-card-header">
				<h2>Lifeguard Incidents</h2>
				<span class="mc-count-badge {data.incidentMetrics?.unresolved > 0 ? 'mc-count-badge-red' : 'mc-count-badge-green'}">
					{data.incidentMetrics?.unresolved || 0} unresolved
				</span>
			</div>
			{#if data.incidentMetrics?.total > 0}
				<div class="flex gap-2 mb-4">
					{#each Object.entries(data.incidentMetrics.bySeverity || {}) as [severity, count]}
						<span class="text-xs px-2.5 py-1 rounded-full border font-medium {severityBadge(severity)}">
							{severity}: {count}
						</span>
					{/each}
				</div>
				<div class="space-y-2.5 max-h-[200px] overflow-y-auto">
					{#each data.incidentMetrics.recent || [] as inc}
						<div class="mc-list-row items-center">
							<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border {severityBadge(inc.severity)}">{inc.severity}</span>
							<span class="text-sm text-[#2C3E50] truncate flex-1">{inc.error_message || inc.category || '—'}</span>
							<span class="mc-muted shrink-0">{inc.resolved ? '✓' : '•'}</span>
							<span class="mc-muted shrink-0">{inc.timeAgo}</span>
						</div>
					{/each}
				</div>
			{:else}
				<div class="mc-empty">No incidents recorded</div>
			{/if}
		</div>
	</div>

	<!-- ============================================================ -->
	<!-- SECTION 6: INFRASTRUCTURE + 7-DAY TRENDS -->
	<!-- ============================================================ -->
	<div class="mc-grid-3 mc-mb">
		<div class="mc-card">
			<span class="mc-kpi-label">Supabase Connections</span>
			<p class="text-lg font-semibold text-[#2C3E50] mt-1">Check Dashboard</p>
			<a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" class="text-xs text-[#00796B] hover:text-[#00695C] mt-1 inline-block">
				Open Supabase Dashboard &rarr;
			</a>
		</div>
		<div class="mc-card">
			<span class="mc-kpi-label">P95 Latency (5min)</span>
			<p class="mc-big-number mt-1">{data.metricsSnapshot?.last5min?.p95LatencyMs || 0}ms</p>
		</div>
		<div class="mc-card">
			<span class="mc-kpi-label">API Errors (5min)</span>
			<p class="mc-big-number mt-1" style="color: {(data.metricsSnapshot?.last5min?.errors ?? 0) === 0 ? '#22C55E' : '#EF4444'}">
				{data.metricsSnapshot?.last5min?.errors ?? 0}
			</p>
		</div>
	</div>

	{#if jobsTrend.length > 0}
		<div class="mc-grid-2 mc-mb">
			<div class="mc-card">
				<TrendChart title="Jobs / Day (7d)" data={jobsTrend} />
			</div>
			<div class="mc-card">
				<TrendChart title="Cost / Day (7d)" data={costTrend} unit="$" />
			</div>
		</div>
	{/if}

	<!-- ============================================================ -->
	<!-- SECTION 7: PROVIDER BREAKDOWN TABLE -->
	<!-- ============================================================ -->
	{#if providerBreakdown.length > 0}
		<div class="mc-card mc-mb">
			<div class="mc-card-header">
				<h2>Today's Provider Breakdown</h2>
			</div>
			<div class="overflow-x-auto">
				<table class="mc-table">
					<thead>
						<tr>
							<th>Provider</th>
							<th class="text-right">Calls</th>
							<th class="text-right">Cost</th>
							<th class="text-right">Errors</th>
						</tr>
					</thead>
					<tbody>
						{#each providerBreakdown as row}
							<tr>
								<td class="font-medium">{row.provider}</td>
								<td class="text-right">{row.calls.toLocaleString()}</td>
								<td class="text-right">{formatCost(row.cost)}</td>
								<td class="text-right" style="color: {row.errors === 0 ? '#22C55E' : '#EF4444'}">
									{row.errors}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- ============================================================ -->
	<!-- SECTION 8: USERS PANEL -->
	<!-- ============================================================ -->
	{#if data.profileMetrics?.users?.length > 0}
		<div class="mc-card mc-mb">
			<div class="mc-card-header">
				<h2>Users</h2>
				<span class="mc-badge">{data.profileMetrics.total} total</span>
			</div>
			<div class="overflow-x-auto">
				<table class="mc-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Tier</th>
							<th class="text-right">Credits</th>
							<th class="text-right">Joined</th>
						</tr>
					</thead>
					<tbody>
						{#each data.profileMetrics.users as user}
							<tr>
								<td class="font-medium">{user.displayName}</td>
								<td class="capitalize mc-muted">{user.tier}</td>
								<td class="text-right">{user.credits}</td>
								<td class="text-right mc-muted">{user.joinedAgo}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- ============================================================ -->
	<!-- FOOTER -->
	<!-- ============================================================ -->
	<footer class="mc-footer">
		SwiftList Mission Control &middot; Auto-refresh every 30s &middot; Capacity limits from CAPACITY-PLANNING.md
	</footer>
</div>

<style>
	/* ================================================================
	   SwiftList Mission Control — Brand Design System
	   Palette: teal #00796B, charcoal #2C3E50, warm canvas #F8F5F0
	   Font: Inter (inherited from app)
	   ================================================================ */

	.mc-page {
		min-height: 100vh;
		background: #F8F5F0;
		color: #2C3E50;
		padding: 20px;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}

	@media (min-width: 768px) { .mc-page { padding: 28px 32px; } }
	@media (min-width: 1024px) { .mc-page { padding: 32px 40px; } }

	/* ---- Header ---- */
	.mc-header {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 28px;
	}

	@media (min-width: 768px) {
		.mc-header { flex-direction: row; align-items: center; justify-content: space-between; }
	}

	.mc-logo {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.mc-logo h1 {
		font-size: 1.35rem;
		font-weight: 700;
		color: #2C3E50;
		line-height: 1.2;
	}

	.mc-breadcrumb {
		font-size: 0.75rem;
		color: #4B5563;
		margin-top: 2px;
	}

	.mc-breadcrumb span { color: #CBD5E1; margin: 0 4px; }

	.mc-header-right {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.mc-health-dots {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.mc-health-dot {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.7rem;
		color: #4B5563;
	}

	.mc-latency {
		font-size: 0.7rem;
		color: #94A3B8;
		padding-left: 6px;
		border-left: 1px solid #E2E8F0;
	}

	.mc-refresh {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.mc-countdown {
		font-size: 0.7rem;
		color: #94A3B8;
		font-variant-numeric: tabular-nums;
	}

	/* ---- Buttons ---- */
	.mc-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		border: none;
		text-decoration: none;
	}

	.mc-btn-primary {
		background: #00796B;
		color: white;
	}

	.mc-btn-primary:hover { background: #00695C; }

	.mc-btn-ghost {
		background: white;
		color: #2C3E50;
		border: 1px solid #E2E8F0;
	}

	.mc-btn-ghost:hover { background: #F1F5F9; border-color: #CBD5E1; }

	/* ---- KPI Cards ---- */
	.mc-kpi-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
		margin-bottom: 24px;
	}

	@media (min-width: 768px) { .mc-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
	@media (min-width: 1024px) { .mc-kpi-grid { grid-template-columns: repeat(6, 1fr); } }

	.mc-kpi-card {
		background: white;
		border-radius: 12px;
		padding: 16px;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		box-shadow: 0 1px 3px rgba(44, 62, 80, 0.06), 0 1px 2px rgba(44, 62, 80, 0.04);
		transition: box-shadow 0.2s ease;
	}

	.mc-kpi-card:hover {
		box-shadow: 0 4px 12px rgba(44, 62, 80, 0.08);
	}

	.mc-kpi-icon {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.mc-kpi-body {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.mc-kpi-label {
		font-size: 0.7rem;
		color: #4B5563;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-weight: 500;
	}

	.mc-kpi-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #2C3E50;
		line-height: 1.2;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.mc-kpi-badge {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 10px;
	}

	.mc-kpi-badge-green { background: #DCFCE7; color: #16A34A; }

	/* ---- Cards ---- */
	.mc-card {
		background: white;
		border-radius: 14px;
		padding: 20px;
		box-shadow: 0 1px 3px rgba(44, 62, 80, 0.06), 0 1px 2px rgba(44, 62, 80, 0.04);
		transition: box-shadow 0.2s ease;
	}

	.mc-card:hover {
		box-shadow: 0 4px 16px rgba(44, 62, 80, 0.08);
	}

	.mc-card-compact { padding: 14px; }

	.mc-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.mc-card-header h2 {
		font-size: 0.9rem;
		font-weight: 600;
		color: #2C3E50;
	}

	/* ---- Badges ---- */
	.mc-badge {
		font-size: 0.7rem;
		font-weight: 500;
		padding: 3px 10px;
		border-radius: 20px;
		background: #F1F5F9;
		color: #4B5563;
	}

	.mc-count-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 3px 10px;
		border-radius: 20px;
	}

	.mc-count-badge-red { background: #FEF2F2; color: #DC2626; }
	.mc-count-badge-green { background: #F0FDF4; color: #16A34A; }

	/* ---- Grid layouts ---- */
	.mc-grid-2 {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
	}

	@media (min-width: 768px) { .mc-grid-2 { grid-template-columns: repeat(2, 1fr); } }

	.mc-grid-3 {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
	}

	@media (min-width: 768px) { .mc-grid-3 { grid-template-columns: repeat(3, 1fr); } }

	.mc-gauge-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	@media (min-width: 768px) { .mc-gauge-grid { grid-template-columns: repeat(3, 1fr); } }
	@media (min-width: 1024px) { .mc-gauge-grid { grid-template-columns: repeat(6, 1fr); } }

	.mc-mb { margin-bottom: 20px; }

	/* ---- Section titles ---- */
	.mc-section-title {
		margin-bottom: 12px;
	}

	.mc-section-title h2 {
		font-size: 0.9rem;
		font-weight: 600;
		color: #2C3E50;
	}

	/* ---- Tables ---- */
	.mc-table {
		width: 100%;
		font-size: 0.85rem;
		border-collapse: collapse;
	}

	.mc-table thead tr {
		border-bottom: 2px solid #F1F5F9;
	}

	.mc-table th {
		padding: 8px 12px;
		text-align: left;
		font-weight: 500;
		font-size: 0.75rem;
		color: #4B5563;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.mc-table tbody tr {
		border-bottom: 1px solid #F8FAFC;
		transition: background 0.1s ease;
	}

	.mc-table tbody tr:hover {
		background: #FAFAF8;
	}

	.mc-table td {
		padding: 10px 12px;
		color: #2C3E50;
	}

	/* ---- Utility ---- */
	.mc-big-number {
		font-size: 1.75rem;
		font-weight: 700;
		color: #2C3E50;
		line-height: 1.2;
	}

	.mc-muted { color: #4B5563; font-size: 0.8rem; }

	.mc-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100px;
		color: #94A3B8;
		font-size: 0.85rem;
	}

	.mc-list-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.8rem;
		padding: 6px 0;
		border-bottom: 1px solid #F1F5F9;
	}

	.mc-list-item {
		padding-bottom: 10px;
		border-bottom: 1px solid #F1F5F9;
	}

	/* ---- Footer ---- */
	.mc-footer {
		margin-top: 32px;
		text-align: center;
		font-size: 0.7rem;
		color: #94A3B8;
		padding: 16px 0;
	}
</style>
