<script lang="ts">
	/**
	 * Analytics Page - Svelte 5
	 * Preset marketplace performance analytics — real data from Supabase
	 */

	import { goto } from '$app/navigation';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { data } = $props();

	const stats = $derived(data.stats);
	const presetPerformance = $derived(data.presetPerformance || []);
	const royaltyStats = $derived(data.royaltyStats);
	const hasData = $derived(presetPerformance.length > 0);

	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Analytics - SwiftList</title>
</svelte:head>

<div class="flex min-h-screen bg-[#F8F5F0]">
	<!-- Left Sidebar -->
	<Sidebar />

	<!-- Main Content -->
	<main class="ml-0 md:ml-[240px] flex-1">
		<div class="max-w-7xl mx-auto px-4 md:px-8 py-8">
			<!-- Page Header -->
			<div class="mb-8">
				<h1 class="text-[#2C3E50] font-bold text-3xl md:text-4xl mb-2">Analytics</h1>
				<p class="text-[#4B5563] text-base md:text-lg">Track your preset marketplace performance</p>
			</div>

			<!-- Stats Cards -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
				<!-- Published Presets -->
				<div class="bg-white rounded-xl p-4 md:p-6 shadow-sm">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
							<span class="material-symbols-outlined text-blue-600 text-[20px]">palette</span>
						</div>
						<div>
							<p class="text-[#4B5563] text-xs font-medium">PUBLISHED</p>
						</div>
					</div>
					<p class="text-[#2C3E50] font-bold text-2xl md:text-3xl">{formatNumber(stats.totalPresets)}</p>
				</div>

				<!-- Total Usage -->
				<div class="bg-white rounded-xl p-4 md:p-6 shadow-sm">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
							<span class="material-symbols-outlined text-green-600 text-[20px]">trending_up</span>
						</div>
						<div>
							<p class="text-[#4B5563] text-xs font-medium">TOTAL USAGE</p>
						</div>
					</div>
					<p class="text-[#2C3E50] font-bold text-2xl md:text-3xl">{formatNumber(stats.totalUsage)}</p>
				</div>

				<!-- Sparks Earned -->
				<div class="bg-white rounded-xl p-4 md:p-6 shadow-sm">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
							<span class="material-symbols-outlined text-amber-600 text-[20px]">auto_awesome</span>
						</div>
						<div>
							<p class="text-[#4B5563] text-xs font-medium">SPARKS EARNED</p>
						</div>
					</div>
					<p class="text-[#2C3E50] font-bold text-2xl md:text-3xl">{formatNumber(stats.creditsEarned)}</p>
					{#if royaltyStats}
						<p class="text-[#4B5563] text-xs mt-1">{royaltyStats.this_month ?? 0} this month</p>
					{/if}
				</div>

				<!-- Top Preset -->
				<div class="bg-white rounded-xl p-4 md:p-6 shadow-sm">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
							<span class="material-symbols-outlined text-purple-600 text-[20px]">emoji_events</span>
						</div>
						<div>
							<p class="text-[#4B5563] text-xs font-medium">TOP PRESET</p>
						</div>
					</div>
					<p class="text-[#2C3E50] font-bold text-base md:text-lg truncate">{stats.topPreset}</p>
					{#if stats.favoritesCount > 0}
						<p class="text-[#4B5563] text-xs mt-1">{stats.favoritesCount} favorites</p>
					{/if}
				</div>
			</div>

			{#if hasData}
				<!-- Preset Performance Table -->
				<div class="bg-white rounded-xl shadow-sm overflow-hidden">
					<div class="p-4 md:p-6 border-b border-gray-200">
						<h2 class="text-[#2C3E50] font-bold text-xl">Preset Performance</h2>
						<p class="text-[#4B5563] text-sm">Your published presets ranked by usage</p>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="bg-gray-50 border-b border-gray-200">
								<tr>
									<th class="px-3 sm:px-4 md:px-6 py-4 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wider">
										Preset Name
									</th>
									<th class="px-3 sm:px-4 md:px-6 py-4 text-right text-xs font-semibold text-[#4B5563] uppercase tracking-wider">
										Total Usage
									</th>
									<th class="px-3 sm:px-4 md:px-6 py-4 text-right text-xs font-semibold text-[#4B5563] uppercase tracking-wider hidden sm:table-cell">
										Recent Activity
									</th>
									<th class="px-3 sm:px-4 md:px-6 py-4 text-right text-xs font-semibold text-[#4B5563] uppercase tracking-wider hidden md:table-cell">
										Created
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200">
								{#each presetPerformance as preset}
									<tr class="hover:bg-gray-50 transition-colors">
										<td class="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap">
											<a href="/presets/{preset.id}" class="text-[#2C3E50] font-semibold hover:text-[#00796B] transition-colors">
												{preset.name}
											</a>
										</td>
										<td class="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-right">
											<p class="text-[#4B5563] font-medium">{formatNumber(preset.usage)}</p>
										</td>
										<td class="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-right hidden sm:table-cell">
											<p class="text-[#4B5563]">{formatNumber(preset.recentUsage)} recent</p>
										</td>
										<td class="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-right hidden md:table-cell">
											<p class="text-[#4B5563] text-sm">{formatDate(preset.createdAt)}</p>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{:else}
				<!-- Empty State -->
				<div class="bg-white rounded-xl p-12 text-center shadow-sm">
					<div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
						<span class="material-symbols-outlined text-gray-400 text-4xl">bar_chart</span>
					</div>
					<h2 class="text-[#2C3E50] font-bold text-2xl mb-2">No analytics data yet</h2>
					<p class="text-[#4B5563] mb-6">
						Create and publish presets to start tracking performance
					</p>
					<button
						onclick={() => goto('/presets/create')}
						class="bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
					>
						Create Your First Preset
					</button>
				</div>
			{/if}
		</div>
	</main>
</div>
