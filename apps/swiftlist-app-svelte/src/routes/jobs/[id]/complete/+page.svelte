<script lang="ts">
	/**
	 * Job Completion Page - SwiftList
	 * Shows completed job with download options organized by marketplace
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import OnboardingTour from '$lib/components/OnboardingTour.svelte';
	import { jobCompleteTour } from '$lib/config/onboarding-tours';

	const jobId = $derived($page.params.id);

	// Real job data from API
	let job = $state<any>(null);
	let outputs = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');
	let activeDescTab = $state('');

	// Initialize description tab when job data loads
	$effect(() => {
		if (job?.classification_details?.product_descriptions && !activeDescTab) {
			const keys = Object.keys(job.classification_details.product_descriptions);
			if (keys.length > 0) activeDescTab = keys[0];
		}
	});

	// Marketplace display names
	const MARKETPLACE_NAMES: Record<string, string> = {
		amazon: 'Amazon',
		ebay: 'eBay',
		etsy: 'Etsy',
		shopify: 'Shopify',
		instagram: 'Instagram',
		facebook: 'Facebook',
		pinterest: 'Pinterest',
		poshmark: 'Poshmark',
		mercari: 'Mercari',
		tiktok: 'TikTok Shop'
	};

	// Filter outputs to only show marketplaces the user selected + special outputs (SVG, etc.)
	const filteredOutputs = $derived(() => {
		if (!job || !outputs.length) return outputs;
		const selectedMarketplaces: string[] = job.marketplaces || [];
		// If no marketplace filter on the job, show all outputs
		if (selectedMarketplaces.length === 0) return outputs;
		// Always include special outputs like SVG alongside marketplace-filtered ones
		return outputs.filter((output: any) =>
			selectedMarketplaces.includes(output.marketplace)
		);
	});

	// Get product image URL from job (check both product_image_url field and input_data)
	function getProductImageUrl(job: any): string | null {
		// Try product_image_url field first
		if (job.product_image_url) {
			return job.product_image_url;
		}
		// Fallback to input_data.product_image if available
		if (job.input_data && typeof job.input_data === 'object') {
			return (job.input_data as any).product_image || (job.input_data as any).image_url || null;
		}
		return null;
	}

	// Fetch job data on mount
	onMount(async () => {
		try {
			loading = true;

			// Fetch job details
			const jobResponse = await fetch(`/api/jobs/${jobId}`);

			if (!jobResponse.ok) {
				const errorText = await jobResponse.text();
				throw new Error(`Failed to fetch job: ${jobResponse.status} - ${errorText}`);
			}

			const jobData = await jobResponse.json();
			job = jobData.job || jobData; // Handle both {job} and direct job object

			// Fetch outputs
			const outputsResponse = await fetch(`/api/jobs/${jobId}/outputs`);

			if (!outputsResponse.ok) {
				const errorText = await outputsResponse.text();

				// If outputs fetch fails but job exists, it might still be processing
				if (job.status === 'processing' || job.status === 'pending') {
					// Redirect back to processing page
					goto(`/jobs/${jobId}/processing`);
					return;
				}
				outputs = []; // Empty array, will show "No outputs" message
			} else {
				const outputsData = await outputsResponse.json();
				outputs = outputsData.outputs || [];
			}

			loading = false;
		} catch (err: any) {
			error = `${err.message || 'Failed to load job'}\n\nCheck browser console (F12) for details.`;
			loading = false;
		}
	});

	function formatFileSize(bytes: number): string {
		const mb = bytes / 1024 / 1024;
		return `${mb.toFixed(2)} MB`;
	}

	function handleDownload(outputUrl: string, filename: string) {
		// Open in new tab to download
		window.open(outputUrl, '_blank');
	}

	async function handleDownloadAll() {
		// Download all outputs as a single ZIP file
		try {
			const response = await fetch(`/api/jobs/${jobId}/download-all`);

			if (!response.ok) {
				throw new Error('Failed to download outputs');
			}

			// Get the ZIP file blob
			const blob = await response.blob();

			// Create a download link and trigger download
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `swiftlist-job-${jobId?.slice(0, 8) ?? 'unknown'}.zip`;
			document.body.appendChild(a);
			a.click();

			// Cleanup
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

		} catch (err) {
			console.error('Download error:', err);
			alert('Failed to download outputs. Please try downloading individually.');
		}
	}

	function handleShare() {
		// Copy job URL to clipboard
		const url = window.location.href;
		navigator.clipboard.writeText(url);
		alert('Job URL copied to clipboard!');
	}

	function handleNewJobWithSameSettings() {
		goto('/jobs/new');
	}

	// ── Save as Preset ──────────────────────────────────────────────
	let showPresetModal = $state(false);
	let presetName = $state('');
	let presetDescription = $state('');
	let presetCategory = $state('');
	let presetIsPublic = $state(false);
	let savingPreset = $state(false);
	let presetSaved = $state(false);

	const presetCategories = [
		'Accessories', 'Art & Prints', 'Automotive', 'Bath & Body', 'Books & Media',
		'Candles & Fragrance', 'Collectibles', 'Craft Supplies', 'Eco-Friendly',
		'Fashion', 'Food & Beverage', 'Furniture', 'Garden & Outdoor', 'Home Goods',
		'Jewelry', 'Kids & Baby', 'Kitchen & Dining', 'Minimalist', 'Pet Supplies',
		'Seasonal & Holiday', 'Sporting Goods', 'Stationery & Paper', 'Tech',
		'Toys & Games', 'Vintage', 'Weddings & Events'
	];

	// Determine if this job has style settings worth saving as a preset
	const canSaveAsPreset = $derived.by(() => {
		if (!job) return false;
		const enhancements: string[] = job.enhancements || [];
		const hasStylize = enhancements.includes('stylize-background');
		const hasPrompt = !!(job.ai_prompt || job.classification_details?.presetStylePrompt || job.classification_details?.background_prompt);
		const hasReferenceImage = !!job.reference_image_url;
		return hasStylize && (hasPrompt || hasReferenceImage);
	});

	function openPresetModal() {
		// Pre-fill with job data
		const intent = job?.classification_details?.background_intent || '';
		const prompt = job?.ai_prompt || job?.classification_details?.background_prompt || '';
		presetName = '';
		presetDescription = `Style: ${prompt.slice(0, 200)}`;
		presetCategory = '';
		presetIsPublic = false;
		presetSaved = false;
		showPresetModal = true;
	}

	async function handleSavePreset() {
		if (!presetName.trim()) {
			alert('Please enter a name for your preset');
			return;
		}
		if (!presetCategory) {
			alert('Please select a category');
			return;
		}

		savingPreset = true;

		try {
			// Build preset_config from job's classification_details
			const cd = job.classification_details || {};
			const presetConfig = {
				ai_prompt: job.ai_prompt || cd.background_prompt || '',
				background_intent: cd.background_intent || 'scene',
				background_hex_color: cd.background_hex_color || undefined,
				enhancements: job.enhancements || [],
				shadow_style: cd.shadow_style || 'natural',
				source_job_id: jobId
			};

			// Use first output image as thumbnail if available
			const thumbnailUrl = outputs.length > 0 ? outputs[0].output_url : null;

			const response = await fetch('/api/presets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: presetName.trim(),
					description: presetDescription.trim() || `Created from job #${jobId?.slice(0, 8)}`,
					category: presetCategory,
					tags: [],
					thumbnail_url: thumbnailUrl,
					preset_config: presetConfig,
					is_public: presetIsPublic
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to save preset');
			}

			presetSaved = true;
		} catch (err: any) {
			alert(err.message || 'Failed to save preset');
		} finally {
			savingPreset = false;
		}
	}

	// Group outputs by marketplace
	$effect(() => {
		if (outputs.length > 0) {
		}
	});
</script>

<svelte:head>
	<title>Job Complete - SwiftList</title>
</svelte:head>

<div class="flex min-h-screen bg-[#F8F5F0]">
	<!-- Left Sidebar -->
	<Sidebar />

	<!-- Main Content -->
	<main class="ml-0 md:ml-[240px] flex-1 p-4 md:p-8">
		<div class="max-w-6xl mx-auto">
			{#if loading}
				<!-- Loading State -->
				<div class="flex items-center justify-center min-h-[400px]">
					<div class="text-center">
						<div
							class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00796B] mx-auto mb-4"
						></div>
						<p class="text-[#4B5563] font-medium">Loading job results...</p>
					</div>
				</div>
			{:else if error}
				<!-- Error State -->
				<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
					<span class="material-symbols-outlined text-red-600 text-4xl mb-2">error</span>
					<h2 class="text-red-800 font-bold text-xl mb-2">Failed to Load Job</h2>
					<p class="text-red-600 mb-4">{error}</p>
					<button
						onclick={() => goto('/dashboard')}
						class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg"
					>
						Back to Dashboard
					</button>
				</div>
			{:else if job}
				<!-- Success Header -->
				<div class="mb-8">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
						<div class="flex flex-wrap items-center gap-2 sm:gap-3">
							<h1 class="text-[#2C3E50] font-bold text-xl sm:text-3xl">Job #{jobId?.slice(0, 8) ?? '...'} Complete!</h1>
							<div class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
								{job.status === 'completed' ? 'SUCCESS' : job.status.toUpperCase()}
							</div>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<button
								onclick={handleShare}
								class="p-2 hover:bg-gray-200 rounded-lg transition-colors"
								aria-label="Share"
							>
								<span class="material-symbols-outlined text-[#4B5563]">share</span>
							</button>
							<button
							data-tour="complete-download-all"
							onclick={handleDownloadAll}
							class="flex items-center gap-2 bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-4 rounded-lg transition-colors"
							aria-label="Download All"
							>
								<span class="material-symbols-outlined text-[20px]">download</span>
								Download All
							</button>
						</div>
					</div>
					<p class="text-[#4B5563]">
						Your {filteredOutputs().length} asset{filteredOutputs().length !== 1 ? 's are' : ' is'} ready for download.
					</p>
				</div>

				<!-- Project Info Card -->
				<div class="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-8">
					<div class="flex flex-col md:flex-row gap-4 md:gap-6">
						<!-- Thumbnail -->
						<div class="flex-shrink-0">
							<div
								class="w-32 h-32 md:w-48 md:h-48 rounded-lg bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center overflow-hidden"
							>
								{#if true}
									{@const productImageUrl = getProductImageUrl(job)}
									{#if productImageUrl}
									<img
										src={productImageUrl}
										alt="Product"
										class="w-full h-full object-cover"
									/>
								{:else}
									<div class="w-full h-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center">
										<span class="material-symbols-outlined text-gray-500 text-4xl">image</span>
									</div>
								{/if}
							{/if}
							</div>
						</div>

						<!-- Project Details -->
						<div class="flex-1">
							<h2 class="text-[#2C3E50] font-bold text-2xl mb-2">
								{job.metadata?.product_name || 'Product Image'}
							</h2>
							<p class="text-[#4B5563] text-sm mb-4">
								Job ID: <span class="font-mono">{jobId}</span>
							</p>

							<!-- AI Tools Applied -->
							<div class="mb-4">
								<p class="text-[#4B5563] text-xs font-semibold mb-2 uppercase tracking-wide">
									ENHANCEMENTS APPLIED
								</p>
								<div class="flex flex-wrap gap-3">
									{#if job.enhancements && job.enhancements.length > 0}
										{#each job.enhancements as enhancement}
											<div class="flex items-center gap-2 bg-[#F8F5F0] px-3 py-1.5 rounded-lg">
												<span class="material-symbols-outlined text-[#00796B] text-[18px]">
													check_circle
												</span>
												<span class="text-[#2C3E50] text-sm font-medium capitalize">
													{enhancement.replace(/-/g, ' ')}
												</span>
											</div>
										{/each}
									{:else}
										<p class="text-[#4B5563] text-sm italic">No enhancements applied</p>
									{/if}
								</div>
							</div>

							<!-- Quality Metrics (if available) -->
							{#if job.metadata?.quality_score}
								<div class="mt-4">
									<p class="text-[#4B5563] text-xs font-semibold mb-2 uppercase tracking-wide">
										QUALITY SCORE
									</p>
									<div class="flex items-center gap-2">
										<div class="flex-1 bg-gray-200 rounded-full h-2">
											<div
												class="bg-green-500 h-2 rounded-full"
												style="width: {job.metadata.quality_score * 100}%"
											></div>
										</div>
										<span class="text-[#2C3E50] font-bold">
											{(job.metadata.quality_score * 100).toFixed(0)}%
										</span>
									</div>
								</div>
							{/if}

						</div>
					</div>
				</div>

				<!-- Product Descriptions (if generated) -->
				{#if job.classification_details?.product_descriptions}
					{@const descriptions = job.classification_details.product_descriptions as Record<string, { title?: string; description?: string; tags?: string[]; seo_keywords?: string[] }>}
					{@const marketplaceKeys = Object.keys(descriptions)}
					{#if marketplaceKeys.length > 0}
						<div class="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-8">
							<div class="flex items-center gap-2 mb-4">
								<span class="material-symbols-outlined text-[#00796B]">description</span>
								<h3 class="text-[#2C3E50] font-bold text-lg">Product Descriptions</h3>
							</div>

							<!-- Marketplace tabs -->
							<div class="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
								{#each marketplaceKeys as mkt}
									<button
										onclick={() => activeDescTab = mkt}
										class={`px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
											activeDescTab === mkt
												? 'text-[#00796B] border-b-2 border-[#00796B]'
												: 'text-[#4B5563] hover:text-[#2C3E50]'
										}`}
									>
										{MARKETPLACE_NAMES[mkt] || mkt}
									</button>
								{/each}
							</div>

							<!-- Active tab content -->
							{#if descriptions[activeDescTab]}
								{@const activeDesc = descriptions[activeDescTab]}
								<div class="space-y-4">
									<!-- Title -->
									{#if activeDesc.title}
										<div>
											<div class="flex items-center justify-between mb-1">
												<p class="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Title</p>
												<button
													onclick={() => navigator.clipboard.writeText(activeDesc.title ?? '')}
													class="text-xs text-[#00796B] hover:underline flex items-center gap-1"
												>
													<span class="material-symbols-outlined text-[14px]">content_copy</span>
													Copy
												</button>
											</div>
											<p class="text-[#2C3E50] font-medium bg-[#F8F5F0] p-3 rounded-lg text-sm">{activeDesc.title}</p>
										</div>
									{/if}

									<!-- Description -->
									{#if activeDesc.description}
										<div>
											<div class="flex items-center justify-between mb-1">
												<p class="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Description</p>
												<button
													onclick={() => navigator.clipboard.writeText(activeDesc.description ?? '')}
													class="text-xs text-[#00796B] hover:underline flex items-center gap-1"
												>
													<span class="material-symbols-outlined text-[14px]">content_copy</span>
													Copy
												</button>
											</div>
											<p class="text-[#2C3E50] bg-[#F8F5F0] p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">{activeDesc.description}</p>
										</div>
									{/if}

									<!-- Tags -->
									{#if activeDesc.tags && activeDesc.tags.length > 0}
										<div>
											<div class="flex items-center justify-between mb-1">
												<p class="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">Tags</p>
												<button
													onclick={() => navigator.clipboard.writeText((activeDesc.tags ?? []).join(', '))}
													class="text-xs text-[#00796B] hover:underline flex items-center gap-1"
												>
													<span class="material-symbols-outlined text-[14px]">content_copy</span>
													Copy All
												</button>
											</div>
											<div class="flex flex-wrap gap-2">
												{#each activeDesc.tags as tag}
													<span class="bg-[#00796B]/10 text-[#00796B] px-2.5 py-1 rounded-full text-xs font-medium">{tag}</span>
												{/each}
											</div>
										</div>
									{/if}

									<!-- SEO Keywords -->
									{#if activeDesc.seo_keywords && activeDesc.seo_keywords.length > 0}
										<div>
											<div class="flex items-center justify-between mb-1">
												<p class="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">SEO Keywords</p>
												<button
													onclick={() => navigator.clipboard.writeText((activeDesc.seo_keywords ?? []).join(', '))}
													class="text-xs text-[#00796B] hover:underline flex items-center gap-1"
												>
													<span class="material-symbols-outlined text-[14px]">content_copy</span>
													Copy All
												</button>
											</div>
											<p class="text-[#2C3E50] bg-[#F8F5F0] p-3 rounded-lg text-sm">{(activeDesc.seo_keywords ?? []).join(', ')}</p>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				{/if}

				<!-- Save as Preset CTA (only for stylize-background jobs) -->
				{#if canSaveAsPreset}
					<div data-tour="complete-save-preset" class="bg-gradient-to-r from-[#E8F5F4] to-[#F0FAF8] border border-[#00796B]/20 rounded-xl p-4 md:p-6 mb-8">
						<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 bg-[#00796B]/10 rounded-full flex items-center justify-center flex-shrink-0">
									<span class="material-symbols-outlined text-[#00796B] text-xl">auto_awesome</span>
								</div>
								<div>
									<h3 class="text-[#2C3E50] font-bold text-base md:text-lg">Love this style?</h3>
									<p class="text-[#4B5563] text-sm">Save it as a preset to reuse on future products</p>
								</div>
							</div>
							{#if presetSaved}
								<div class="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg font-semibold text-sm">
									<span class="material-symbols-outlined text-[18px]">check_circle</span>
									Saved to My Studio!
								</div>
							{:else}
								<button
									onclick={openPresetModal}
									class="flex items-center gap-2 bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm whitespace-nowrap"
								>
									<span class="material-symbols-outlined text-[18px]">bookmark_add</span>
									Save as Preset
								</button>
							{/if}
						</div>
					</div>
				{/if}

			<!-- Watermark Notice for Free Plan Users -->
				{#if job.metadata?.watermarked}
					<div class="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
						<div class="flex items-start gap-4">
							<div class="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
								<span class="material-symbols-outlined text-amber-600 text-xl">water_drop</span>
							</div>
							<div class="flex-1">
								<h3 class="text-amber-800 font-bold text-lg mb-1">Free Plan Watermark Applied</h3>
								<p class="text-amber-700 text-sm mb-3">
									Your images include a small "SwiftList" watermark in the corner. Upgrade to a paid plan to remove watermarks and unlock more features.
								</p>
								<button
									onclick={() => goto('/pricing')}
									class="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
								>
									<span class="material-symbols-outlined text-[18px]">upgrade</span>
									Upgrade to Remove Watermarks
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- Marketplace Assets (filtered to user's selected marketplaces) -->
				{#if filteredOutputs().length > 0}
					{#each filteredOutputs() as output}
						<div class="bg-white rounded-xl p-6 shadow-sm mb-6">
							<div class="flex items-center justify-between mb-4">
								<h3 class="text-[#2C3E50] font-bold text-xl">
									{MARKETPLACE_NAMES[output.marketplace] || output.marketplace} Asset
								</h3>
								<button
								data-tour="complete-view-download"
								onclick={() => handleDownload(output.output_url, output.filename)}
								 class="flex items-center gap-2 text-[#00796B] font-semibold hover:underline"
								>
								View &amp; Download
									<span class="material-symbols-outlined text-[20px]">download</span>
								</button>
							</div>

							<!-- Asset Info -->
							<div class="flex items-center justify-between p-4 bg-[#F8F5F0] rounded-lg">
								<div class="flex items-center gap-4">
									<div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
										<span class="material-symbols-outlined text-gray-400 text-2xl">
											image
										</span>
									</div>
									<div>
										<p class="text-[#2C3E50] font-semibold">{output.filename}</p>
										<p class="text-[#4B5563] text-sm">
											{output.dimensions} • {formatFileSize(output.file_size_bytes)}
										</p>
									</div>
								</div>
								<button
									onclick={() => handleDownload(output.output_url, output.filename)}
									class="p-2 hover:bg-gray-200 rounded-lg transition-colors"
									aria-label="Download"
								>
									<span class="material-symbols-outlined text-[#4B5563]">download</span>
								</button>
							</div>
						</div>
					{/each}
				{:else}
					<!-- No Outputs -->
					<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
						<span class="material-symbols-outlined text-yellow-600 text-4xl mb-2">warning</span>
						<p class="text-yellow-800 font-semibold">No outputs available</p>
						<p class="text-yellow-600 text-sm mt-2">
							This job completed but no outputs were generated.
						</p>
					</div>
				{/if}

				<!-- Start New Job Button -->
				<div class="flex justify-center mt-8">
					<button
						onclick={handleNewJobWithSameSettings}
						class="bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-4 px-8 rounded-lg transition-all duration-200 flex items-center gap-2"
					>
						Start New Job
						<span class="material-symbols-outlined">arrow_forward</span>
					</button>
				</div>

				<!-- Deletion Notice -->
				<div class="flex items-center justify-center gap-2 mt-6 text-[#4B5563] text-sm">
					<span class="material-symbols-outlined text-[16px]">info</span>
					<p>Files will be automatically deleted after 30 days.</p>
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- Save as Preset Modal -->
{#if showPresetModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<button
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			onclick={() => (showPresetModal = false)}
			aria-label="Close modal"
		></button>

		<!-- Modal -->
		<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md md:max-w-lg p-4 sm:p-6 md:p-8 z-10">
			{#if presetSaved}
				<!-- Success State -->
				<div class="text-center py-6">
					<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<span class="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
					</div>
					<h2 class="text-[#2C3E50] font-bold text-2xl mb-2">Preset Saved!</h2>
					<p class="text-[#4B5563] mb-6">Your preset is now available in My Studio.</p>
					<div class="flex gap-3 justify-center">
						<button
							onclick={() => (showPresetModal = false)}
							class="px-5 py-2.5 border border-gray-300 text-[#2C3E50] font-semibold rounded-lg hover:bg-gray-50 transition-colors"
						>
							Close
						</button>
						<button
							onclick={() => goto('/dashboard')}
							class="px-5 py-2.5 bg-[#00796B] text-white font-semibold rounded-lg hover:bg-[#00695C] transition-colors flex items-center gap-2"
						>
							<span class="material-symbols-outlined text-[18px]">dashboard</span>
							Go to My Studio
						</button>
					</div>
				</div>
			{:else}
				<!-- Form -->
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-[#2C3E50] font-bold text-xl md:text-2xl">Save as Preset</h2>
					<button
						onclick={() => (showPresetModal = false)}
						class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
						aria-label="Close"
					>
						<span class="material-symbols-outlined text-[#4B5563]">close</span>
					</button>
				</div>

				<form onsubmit={(e) => { e.preventDefault(); handleSavePreset(); }} class="space-y-5">
					<!-- Preset Name -->
					<div>
						<label for="preset-name" class="block text-sm font-semibold text-[#2C3E50] mb-2">
							Preset Name <span class="text-red-500">*</span>
						</label>
						<input
							id="preset-name"
							type="text"
							bind:value={presetName}
							placeholder="e.g., Warm Velvet Backdrop"
							maxlength="100"
							class="w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg border border-gray-300 bg-white text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#00796B] text-sm md:text-base"
							required
						/>
						<p class="text-xs text-[#4B5563] mt-1">{presetName.length}/100</p>
					</div>

					<!-- Description -->
					<div>
						<label for="preset-desc" class="block text-sm font-semibold text-[#2C3E50] mb-2">
							Description
						</label>
						<textarea
							id="preset-desc"
							bind:value={presetDescription}
							placeholder="Describe the style and mood..."
							rows="3"
							maxlength="500"
							class="w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg border border-gray-300 bg-white text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#00796B] resize-none text-sm md:text-base"
						></textarea>
					</div>

					<!-- Category -->
					<div>
						<label for="preset-category" class="block text-sm font-semibold text-[#2C3E50] mb-2">
							Category <span class="text-red-500">*</span>
						</label>
						<select
							id="preset-category"
							bind:value={presetCategory}
							class="w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg border border-gray-300 bg-white text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#00796B] text-sm md:text-base"
							required
						>
							<option value="" disabled>Select a category</option>
							{#each presetCategories as cat}
								<option value={cat}>{cat}</option>
							{/each}
						</select>
					</div>

					<!-- Public toggle -->
					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={presetIsPublic}
							class="w-5 h-5 text-[#00796B] border-gray-300 rounded focus:ring-2 focus:ring-[#00796B]"
						/>
						<div>
							<span class="text-sm font-semibold text-[#2C3E50]">Share on marketplace</span>
							<p class="text-xs text-[#4B5563]">Others can discover and use your preset</p>
						</div>
					</label>

					<!-- Style Preview -->
					<div class="bg-[#F8F5F0] rounded-lg p-4">
						<p class="text-xs font-semibold text-[#4B5563] uppercase tracking-wide mb-2">Style captured</p>
						<p class="text-sm text-[#2C3E50] font-medium">
							{job?.ai_prompt || job?.classification_details?.background_prompt || 'Custom style'}
						</p>
						{#if job?.classification_details?.background_intent}
							<div class="flex items-center gap-2 mt-2">
								<span class="text-xs bg-[#00796B]/10 text-[#00796B] px-2 py-0.5 rounded-full font-medium capitalize">
									{job.classification_details.background_intent}
								</span>
								{#if job.classification_details.background_hex_color}
									<div class="flex items-center gap-1">
										<div
											class="w-4 h-4 rounded-full border border-gray-300"
											style="background-color: {job.classification_details.background_hex_color}"
										></div>
										<span class="text-xs font-mono text-[#4B5563]">{job.classification_details.background_hex_color}</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Submit -->
					<button
						type="submit"
						disabled={savingPreset}
						class="w-full bg-[#00796B] hover:bg-[#00695C] disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
					>
						{#if savingPreset}
							<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Saving...
						{:else}
							<span class="material-symbols-outlined text-[18px]">bookmark_add</span>
							Save Preset
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}

<OnboardingTour tourId="job-complete" steps={jobCompleteTour} autoStart />
