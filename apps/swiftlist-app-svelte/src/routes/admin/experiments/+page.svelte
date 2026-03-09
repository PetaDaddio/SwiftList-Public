<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	interface ABExperiment {
		id: string;
		slug: string;
		name: string;
		description: string | null;
		page: string;
		element: string;
		variants: Array<{ key: string; value: string; weight?: number }>;
		traffic_pct: number;
		status: string;
		winner: string | null;
		created_at: string;
		started_at: string | null;
		ended_at: string | null;
	}

	let { data } = $props();

	// State
	let selectedExperimentId = $state<string | null>(null);
	let showCreateForm = $state(false);
	let saving = $state(false);
	let error = $state('');

	// Create form fields
	let formSlug = $state('');
	let formName = $state('');
	let formDescription = $state('');
	let formPage = $state('');
	let formElement = $state('');
	let formTrafficPct = $state(100);
	let formVariants = $state<Array<{ key: string; value: string }>>([
		{ key: 'control', value: '' },
		{ key: 'variant_a', value: '' },
		{ key: 'variant_b', value: '' }
	]);

	const experiments = $derived((data.experiments || []) as unknown as ABExperiment[]);
	const results = $derived(data.results || {});
	const selectedExperiment = $derived(experiments.find((e: any) => e.id === selectedExperimentId));
	const selectedResults = $derived(selectedExperimentId ? results[selectedExperimentId] : null);

	// Group experiments by page
	const experimentsByPage = $derived(() => {
		const grouped: Record<string, ABExperiment[]> = {};
		for (const exp of experiments) {
			if (!grouped[exp.page]) grouped[exp.page] = [];
			grouped[exp.page].push(exp);
		}
		return grouped;
	});

	function statusDot(status: string): string {
		switch (status) {
			case 'running': return 'bg-green-500';
			case 'paused': return 'bg-amber-400';
			case 'completed': return 'bg-blue-500';
			default: return 'bg-gray-400';
		}
	}

	function statusBadge(status: string): string {
		switch (status) {
			case 'running': return 'ab-badge-green';
			case 'paused': return 'ab-badge-amber';
			case 'completed': return 'ab-badge-blue';
			default: return 'ab-badge-gray';
		}
	}

	function formatPct(val: number | null): string {
		if (val === null || val === undefined) return '—';
		return `${(val * 100).toFixed(1)}%`;
	}

	function formatLift(val: number | null): string {
		if (val === null || val === undefined) return '—';
		const sign = val > 0 ? '+' : '';
		return `${sign}${(val * 100).toFixed(1)}%`;
	}

	function liftColor(val: number | null): string {
		if (val === null || val === undefined) return 'color: #94A3B8';
		return val > 0 ? 'color: #16A34A' : val < 0 ? 'color: #DC2626' : 'color: #94A3B8';
	}

	function addVariant() {
		const nextLetter = String.fromCharCode(97 + formVariants.length - 1);
		formVariants = [...formVariants, { key: `variant_${nextLetter}`, value: '' }];
	}

	function removeVariant(index: number) {
		if (formVariants.length <= 2) return;
		formVariants = formVariants.filter((_, i) => i !== index);
	}

	function onNameInput() {
		if (!formSlug || formSlug === nameToSlug(formName.slice(0, -1))) {
			formSlug = nameToSlug(formName);
		}
	}

	function nameToSlug(name: string): string {
		return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	}

	async function createExperiment() {
		error = '';
		saving = true;

		const nonEmptyVariants = formVariants.filter(v => v.key && v.value);
		if (nonEmptyVariants.length < 2) {
			error = 'At least 2 variants with content are required';
			saving = false;
			return;
		}

		try {
			const res = await fetch('/api/ab/experiments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					slug: formSlug,
					name: formName,
					description: formDescription || undefined,
					page: formPage,
					element: formElement,
					variants: nonEmptyVariants,
					traffic_pct: formTrafficPct
				})
			});

			if (!res.ok) {
				const data = await res.json();
				error = data.error?.fieldErrors ? Object.values(data.error.fieldErrors).flat().join(', ') : (typeof data.error === 'string' ? data.error : 'Failed to create experiment');
				saving = false;
				return;
			}

			showCreateForm = false;
			formSlug = '';
			formName = '';
			formDescription = '';
			formPage = '';
			formElement = '';
			formTrafficPct = 100;
			formVariants = [
				{ key: 'control', value: '' },
				{ key: 'variant_a', value: '' },
				{ key: 'variant_b', value: '' }
			];

			await invalidateAll();
		} catch {
			error = 'Network error';
		}
		saving = false;
	}

	async function updateStatus(id: string, status: string, winner?: string) {
		try {
			const body: Record<string, unknown> = { id, status };
			if (winner) body.winner = winner;

			await fetch('/api/ab/experiments', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			await invalidateAll();
		} catch {
			// Silent fail
		}
	}
</script>

<svelte:head>
	<title>A/B Experiments | SwiftList Admin</title>
</svelte:head>

<div class="ab-page">
	<!-- Header -->
	<header class="ab-header">
		<div>
			<div class="ab-logo">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect width="24" height="24" rx="6" fill="#00796B"/>
					<text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="700" font-family="Inter, sans-serif">AB</text>
				</svg>
				<div>
					<h1>A/B/C Experiments</h1>
					<p class="ab-breadcrumb">SwiftList Admin <span>/</span> Multi-Variant Testing</p>
				</div>
			</div>
		</div>
		<div class="ab-header-actions">
			<span class="ab-experiment-count">{experiments.length} experiments</span>
			<a href="/admin/capacity" class="ab-btn ab-btn-ghost">Mission Control</a>
			<button
				onclick={() => showCreateForm = !showCreateForm}
				class="ab-btn ab-btn-primary"
			>
				{showCreateForm ? 'Cancel' : '+ New Experiment'}
			</button>
		</div>
	</header>

	<!-- Create Form -->
	{#if showCreateForm}
		<div class="ab-card ab-create-form">
			<h2 class="ab-form-title">Create Experiment</h2>

			{#if error}
				<div class="ab-error">{error}</div>
			{/if}

			<div class="ab-form-grid">
				<div>
					<label class="ab-label">Name</label>
					<input
						type="text"
						bind:value={formName}
						oninput={onNameInput}
						placeholder="Pricing Page CTA Text"
						class="ab-input"
					/>
				</div>
				<div>
					<label class="ab-label">Slug</label>
					<input
						type="text"
						bind:value={formSlug}
						placeholder="pricing-cta-text"
						class="ab-input ab-input-mono"
					/>
				</div>
				<div>
					<label class="ab-label">Page</label>
					<input
						type="text"
						bind:value={formPage}
						placeholder="/pricing"
						class="ab-input"
					/>
				</div>
				<div>
					<label class="ab-label">Element</label>
					<input
						type="text"
						bind:value={formElement}
						placeholder="cta-button"
						class="ab-input"
					/>
				</div>
				<div class="ab-form-full">
					<label class="ab-label">Description (optional)</label>
					<input
						type="text"
						bind:value={formDescription}
						placeholder="Testing CTA button copy on pricing page"
						class="ab-input"
					/>
				</div>
				<div>
					<label class="ab-label">Traffic %</label>
					<input
						type="number"
						bind:value={formTrafficPct}
						min="1"
						max="100"
						class="ab-input"
					/>
				</div>
			</div>

			<!-- Variants -->
			<div class="ab-variants-section">
				<div class="ab-variants-header">
					<label class="ab-label">Variants</label>
					<button onclick={addVariant} class="ab-link">+ Add Variant</button>
				</div>
				<div class="ab-variants-list">
					{#each formVariants as variant, i}
						<div class="ab-variant-row">
							<input
								type="text"
								bind:value={variant.key}
								placeholder="variant key"
								class="ab-input ab-input-mono ab-input-key"
								disabled={i === 0}
							/>
							<input
								type="text"
								bind:value={variant.value}
								placeholder="Content text for this variant"
								class="ab-input flex-1"
							/>
							{#if formVariants.length > 2 && i > 0}
								<button onclick={() => removeVariant(i)} class="ab-remove-btn">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<button
				onclick={createExperiment}
				disabled={saving || !formSlug || !formName || !formPage || !formElement}
				class="ab-btn ab-btn-primary ab-btn-lg"
			>
				{saving ? 'Creating...' : 'Create Experiment'}
			</button>
		</div>
	{/if}

	<!-- Experiments List -->
	{#if experiments.length === 0}
		<div class="ab-card ab-empty-state">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
			<p class="ab-empty-title">No experiments yet</p>
			<p class="ab-empty-desc">Create your first A/B/C test to start optimizing</p>
		</div>
	{:else}
		<!-- Grouped by page -->
		{#each Object.entries(experimentsByPage()) as [page, pageExps]}
			<div class="ab-page-group">
				<div class="ab-page-label">
					<span class="ab-page-badge">{page}</span>
					<span class="ab-page-count">{pageExps.length} experiment{pageExps.length > 1 ? 's' : ''}</span>
				</div>

				<div class="ab-experiment-list">
					{#each pageExps as exp}
						<div
							class="ab-card ab-experiment-card {selectedExperimentId === exp.id ? 'ab-card-expanded' : ''}"
							onclick={() => selectedExperimentId = selectedExperimentId === exp.id ? null : exp.id}
							role="button"
							tabindex="0"
							onkeydown={(e) => { if (e.key === 'Enter') selectedExperimentId = selectedExperimentId === exp.id ? null : exp.id; }}
						>
							<!-- Experiment Header -->
							<div class="ab-exp-header">
								<div class="ab-exp-info">
									<div class="ab-exp-title-row">
										<div class="ab-status-dot {statusDot(exp.status)}"></div>
										<h3>{exp.name}</h3>
										<span class="ab-status-badge {statusBadge(exp.status)}">{exp.status}</span>
										{#if exp.winner}
											<span class="ab-status-badge ab-badge-green">Winner: {exp.winner}</span>
										{/if}
									</div>
									<p class="ab-exp-meta">
										<code>{exp.slug}</code>
										<span class="ab-meta-sep">&middot;</span>
										{exp.element}
										<span class="ab-meta-sep">&middot;</span>
										{(exp.variants as any[])?.length || 0} variants
										{#if exp.traffic_pct < 100}
											<span class="ab-meta-sep">&middot;</span>
											{exp.traffic_pct}% traffic
										{/if}
									</p>
								</div>

								<!-- Actions -->
								<div class="ab-exp-actions">
									{#if exp.status === 'draft'}
										<button
											onclick={(e: MouseEvent) => { e.stopPropagation(); updateStatus(exp.id, 'running'); }}
											class="ab-btn ab-btn-sm ab-btn-success"
										>Start</button>
									{:else if exp.status === 'running'}
										<button
											onclick={(e: MouseEvent) => { e.stopPropagation(); updateStatus(exp.id, 'paused'); }}
											class="ab-btn ab-btn-sm ab-btn-warning"
										>Pause</button>
									{:else if exp.status === 'paused'}
										<button
											onclick={(e: MouseEvent) => { e.stopPropagation(); updateStatus(exp.id, 'running'); }}
											class="ab-btn ab-btn-sm ab-btn-success"
										>Resume</button>
									{/if}
									<svg class="ab-chevron {selectedExperimentId === exp.id ? 'ab-chevron-open' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
								</div>
							</div>

							<!-- Expanded Detail View -->
							{#if selectedExperimentId === exp.id && results[exp.id]}
								{@const res = results[exp.id]}
								<div class="ab-detail">
									<table class="ab-results-table">
										<thead>
											<tr>
												<th>Variant</th>
												<th class="text-right">Impressions</th>
												<th class="text-right">Conversions</th>
												<th class="text-right">Rate</th>
												<th class="text-right">Lift vs Control</th>
											</tr>
										</thead>
										<tbody>
											{#each res.variants as v, i}
												<tr>
													<td>
														<code class="ab-variant-key">{v.variant}</code>
														{#if exp.winner === v.variant}
															<span class="ab-winner-tag">Winner</span>
														{/if}
														{#if i === 0}
															<span class="ab-control-tag">control</span>
														{/if}
													</td>
													<td class="text-right">{v.impressions.toLocaleString()}</td>
													<td class="text-right">{v.conversions.toLocaleString()}</td>
													<td class="text-right font-medium">{formatPct(v.rate)}</td>
													<td class="text-right font-semibold" style={liftColor(v.liftVsControl)}>
														{i === 0 ? '—' : formatLift(v.liftVsControl)}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>

									<!-- Significance -->
									<div class="ab-significance">
										{#if !res.hasEnoughData}
											<span class="ab-sig-badge ab-sig-waiting">
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
												Need {res.minSampleSize}+ impressions per variant
											</span>
										{:else if res.isSignificant}
											<span class="ab-sig-badge ab-sig-yes">
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
												Significant (p={res.pValue?.toFixed(4)})
											</span>
										{:else}
											<span class="ab-sig-badge ab-sig-no">Not significant yet (p={res.pValue?.toFixed(4)})</span>
										{/if}

										{#if exp.status === 'running' && res.isSignificant && !exp.winner}
											{@const best = res.variants.slice(1).reduce((a: any, b: any) => (b.rate > a.rate ? b : a), res.variants[1])}
											{#if best && best.rate > res.variants[0].rate}
												<button
													onclick={(e: MouseEvent) => { e.stopPropagation(); updateStatus(exp.id, 'completed', best.variant); }}
													class="ab-btn ab-btn-sm ab-btn-primary"
												>
													Declare "{best.variant}" Winner
												</button>
											{/if}
										{/if}
									</div>

									<!-- Variant Content Preview -->
									<div class="ab-variant-preview">
										<p class="ab-preview-label">Variant Content</p>
										<div class="ab-preview-chips">
											{#each (exp.variants as Array<{key: string; value: string}>) as v}
												<div class="ab-preview-chip">
													<span class="ab-chip-key">{v.key}:</span>
													<span class="ab-chip-value">{v.value}</span>
												</div>
											{/each}
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	/* ================================================================
	   A/B Experiments — SwiftList Brand Design
	   ================================================================ */

	.ab-page {
		min-height: 100vh;
		background: #F8F5F0;
		color: #2C3E50;
		padding: 20px;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}

	@media (min-width: 768px) { .ab-page { padding: 28px 32px; } }
	@media (min-width: 1024px) { .ab-page { padding: 32px 40px; } }

	/* ---- Header ---- */
	.ab-header {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-bottom: 28px;
	}

	@media (min-width: 768px) {
		.ab-header { flex-direction: row; align-items: center; justify-content: space-between; }
	}

	.ab-logo {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.ab-logo h1 {
		font-size: 1.35rem;
		font-weight: 700;
		color: #2C3E50;
		line-height: 1.2;
	}

	.ab-breadcrumb {
		font-size: 0.75rem;
		color: #4B5563;
		margin-top: 2px;
	}

	.ab-breadcrumb span { color: #CBD5E1; margin: 0 4px; }

	.ab-header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.ab-experiment-count {
		font-size: 0.75rem;
		color: #4B5563;
		background: #F1F5F9;
		padding: 4px 12px;
		border-radius: 20px;
		font-weight: 500;
	}

	/* ---- Buttons ---- */
	.ab-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 16px;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		border: none;
		text-decoration: none;
	}

	.ab-btn-primary { background: #00796B; color: white; }
	.ab-btn-primary:hover { background: #00695C; }
	.ab-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

	.ab-btn-ghost { background: white; color: #2C3E50; border: 1px solid #E2E8F0; }
	.ab-btn-ghost:hover { background: #F8FAFC; border-color: #CBD5E1; }

	.ab-btn-success { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
	.ab-btn-success:hover { background: #DCFCE7; }

	.ab-btn-warning { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
	.ab-btn-warning:hover { background: #FEF3C7; }

	.ab-btn-sm { padding: 4px 12px; font-size: 0.75rem; border-radius: 6px; }
	.ab-btn-lg { padding: 10px 24px; font-size: 0.85rem; }

	.ab-link {
		background: none;
		border: none;
		color: #00796B;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0;
	}

	.ab-link:hover { color: #00695C; text-decoration: underline; }

	/* ---- Cards ---- */
	.ab-card {
		background: white;
		border-radius: 14px;
		padding: 20px;
		box-shadow: 0 1px 3px rgba(44, 62, 80, 0.06), 0 1px 2px rgba(44, 62, 80, 0.04);
		transition: box-shadow 0.2s ease, border-color 0.2s ease;
		border: 1px solid transparent;
	}

	.ab-experiment-card {
		cursor: pointer;
	}

	.ab-experiment-card:hover {
		box-shadow: 0 4px 16px rgba(44, 62, 80, 0.08);
		border-color: #E2E8F0;
	}

	.ab-card-expanded {
		border-color: #00796B40;
		box-shadow: 0 4px 20px rgba(0, 121, 107, 0.08);
	}

	/* ---- Page Groups ---- */
	.ab-page-group {
		margin-bottom: 24px;
	}

	.ab-page-label {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
	}

	.ab-page-badge {
		font-size: 0.8rem;
		font-weight: 600;
		color: #00796B;
		background: #E0F2F1;
		padding: 3px 12px;
		border-radius: 6px;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.ab-page-count {
		font-size: 0.7rem;
		color: #94A3B8;
	}

	.ab-experiment-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* ---- Experiment Header ---- */
	.ab-exp-header {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	@media (min-width: 768px) {
		.ab-exp-header { flex-direction: row; align-items: center; justify-content: space-between; }
	}

	.ab-exp-info { flex: 1; min-width: 0; }

	.ab-exp-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.ab-status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.ab-exp-title-row h3 {
		font-size: 0.95rem;
		font-weight: 600;
		color: #2C3E50;
	}

	.ab-status-badge {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.ab-badge-green { background: #F0FDF4; color: #16A34A; }
	.ab-badge-amber { background: #FFFBEB; color: #D97706; }
	.ab-badge-blue { background: #EFF6FF; color: #2563EB; }
	.ab-badge-gray { background: #F1F5F9; color: #64748B; }

	.ab-exp-meta {
		font-size: 0.75rem;
		color: #4B5563;
		margin-top: 4px;
		display: flex;
		align-items: center;
		gap: 0;
		flex-wrap: wrap;
	}

	.ab-exp-meta code {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.7rem;
		color: #00796B;
		background: #F0FDFA;
		padding: 1px 6px;
		border-radius: 4px;
	}

	.ab-meta-sep { color: #CBD5E1; margin: 0 6px; }

	.ab-exp-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.ab-chevron {
		color: #94A3B8;
		transition: transform 0.2s ease;
	}

	.ab-chevron-open { transform: rotate(180deg); }

	/* ---- Detail Panel ---- */
	.ab-detail {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid #F1F5F9;
	}

	.ab-results-table {
		width: 100%;
		font-size: 0.83rem;
		border-collapse: collapse;
	}

	.ab-results-table th {
		padding: 8px 12px;
		text-align: left;
		font-weight: 500;
		font-size: 0.72rem;
		color: #4B5563;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-bottom: 2px solid #F1F5F9;
	}

	.ab-results-table td {
		padding: 10px 12px;
		color: #2C3E50;
		border-bottom: 1px solid #F8FAFC;
	}

	.ab-results-table tbody tr:hover {
		background: #FAFAF8;
	}

	.ab-variant-key {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.78rem;
		color: #2C3E50;
	}

	.ab-winner-tag {
		font-size: 0.65rem;
		font-weight: 600;
		color: #16A34A;
		margin-left: 6px;
	}

	.ab-control-tag {
		font-size: 0.6rem;
		color: #94A3B8;
		margin-left: 6px;
	}

	/* ---- Significance ---- */
	.ab-significance {
		margin-top: 14px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.ab-sig-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		font-weight: 500;
		padding: 5px 14px;
		border-radius: 8px;
	}

	.ab-sig-waiting { background: #FFFBEB; color: #D97706; }
	.ab-sig-yes { background: #F0FDF4; color: #16A34A; }
	.ab-sig-no { background: #F1F5F9; color: #64748B; }

	/* ---- Variant Preview ---- */
	.ab-variant-preview {
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px solid #F1F5F9;
	}

	.ab-preview-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: #4B5563;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: 8px;
	}

	.ab-preview-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.ab-preview-chip {
		font-size: 0.75rem;
		padding: 6px 12px;
		background: #F8FAFC;
		border: 1px solid #F1F5F9;
		border-radius: 8px;
		max-width: 100%;
	}

	.ab-chip-key {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.7rem;
		color: #4B5563;
	}

	.ab-chip-value {
		color: #2C3E50;
		margin-left: 4px;
	}

	/* ---- Create Form ---- */
	.ab-create-form { margin-bottom: 24px; }

	.ab-form-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: #2C3E50;
		margin-bottom: 16px;
	}

	.ab-error {
		background: #FEF2F2;
		border: 1px solid #FECACA;
		color: #DC2626;
		padding: 10px 16px;
		border-radius: 10px;
		font-size: 0.85rem;
		margin-bottom: 16px;
	}

	.ab-form-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
		margin-bottom: 16px;
	}

	@media (min-width: 768px) { .ab-form-grid { grid-template-columns: repeat(2, 1fr); } }

	.ab-form-full { grid-column: 1 / -1; }

	.ab-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: #4B5563;
		margin-bottom: 4px;
	}

	.ab-input {
		width: 100%;
		background: #FAFAF8;
		border: 1px solid #E2E8F0;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 0.85rem;
		color: #2C3E50;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.ab-input:focus {
		outline: none;
		border-color: #00796B;
		box-shadow: 0 0 0 3px rgba(0, 121, 107, 0.1);
	}

	.ab-input-mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; }
	.ab-input-key { width: 140px; flex-shrink: 0; }

	.ab-variants-section { margin-bottom: 20px; }

	.ab-variants-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.ab-variants-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ab-variant-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.ab-remove-btn {
		background: none;
		border: none;
		color: #94A3B8;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ab-remove-btn:hover { color: #EF4444; background: #FEF2F2; }

	/* ---- Empty State ---- */
	.ab-empty-state {
		text-align: center;
		padding: 48px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.ab-empty-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: #2C3E50;
	}

	.ab-empty-desc {
		font-size: 0.85rem;
		color: #94A3B8;
	}
</style>
