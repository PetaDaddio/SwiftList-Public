<script lang="ts">
	/**
	 * Favorite Presets Page - Svelte 5
	 * Shows user's favorited preset vibes fetched from the API
	 */

	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';

	// Default background colors by category
	function getDefaultBgColor(category: string): string {
		const colors: Record<string, string> = {
			Jewelry: '#C9A0DC',
			Vintage: '#B8A99A',
			Fashion: '#4A5A6A',
			Furniture: '#D4C5B9',
			'Eco-Friendly': '#95D5B2',
			Minimalist: '#E8D7C3',
			Tech: '#2C3E50'
		};
		return colors[category] || '#8B7D6B';
	}

	interface FavoritePreset {
		favoriteId: string;
		presetId: string;
		name: string;
		description: string;
		creator: { name: string; avatar: string | null };
		creatorId: string;
		thumbnail: string | null;
		usageCount: number;
		category: string;
		backgroundColor: string;
		presetConfig: any;
		favoritedAt: string;
	}

	let favoritedPresets = $state<FavoritePreset[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');

	// Fetch user's favorites from API
	async function fetchFavorites() {
		try {
			const response = await fetch('/api/favorites');
			if (response.status === 401) {
				errorMessage = 'Please log in to view your favorites';
				return;
			}
			if (!response.ok) {
				errorMessage = 'Failed to load favorites';
				return;
			}

			const result = await response.json();
			if (result.success && result.data) {
				favoritedPresets = result.data
					.filter((f: any) => f.presets) // Only include favorites where preset still exists
					.map((f: any) => ({
						favoriteId: f.id,
						presetId: f.preset_id,
						name: f.presets.name,
						description: f.presets.description || '',
						creator: {
							name: f.presets.profiles?.display_name || 'Community Creator',
							avatar: f.presets.profiles?.avatar_url || null
						},
						creatorId: f.presets.user_id || '',
						thumbnail: f.presets.thumbnail_url || null,
						usageCount: f.presets.usage_count || 0,
						category: f.presets.category || '',
						backgroundColor: getDefaultBgColor(f.presets.category || ''),
						presetConfig: f.presets.preset_config || {},
						favoritedAt: f.created_at
					}));
			}
		} catch {
			errorMessage = 'Failed to load favorites';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchFavorites();
	});

	// Determine if preset should be trending (used 1000+ times)
	function isTrending(usageCount: number): boolean {
		return usageCount >= 1000;
	}

	// Determine if preset is new (used <200 times)
	function isNew(usageCount: number): boolean {
		return usageCount < 200;
	}

	// Remove from favorites via API
	async function removeFavorite(preset: FavoritePreset) {
		// Optimistic removal
		const previous = [...favoritedPresets];
		favoritedPresets = favoritedPresets.filter((p) => p.presetId !== preset.presetId);

		try {
			const response = await fetch('/api/favorites', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ preset_id: preset.presetId })
			});

			if (!response.ok) {
				// Revert on failure
				favoritedPresets = previous;
			}
		} catch {
			// Revert on network error
			favoritedPresets = previous;
		}
	}

	// Handle "Use this Vibe" button click
	function handleUseVibe(preset: FavoritePreset) {
		const params = new URLSearchParams({
			preset: preset.presetId,
			presetName: preset.name,
			presetCreator: preset.creator.name,
			presetCreatorId: preset.creatorId || '',
			presetThumbnail: preset.thumbnail || '',
			stylePrompt: preset.presetConfig?.ai_prompt || preset.description || ''
		});
		goto(`/jobs/new?${params.toString()}`);
	}
</script>

<svelte:head>
	<title>My Favorites - SwiftList</title>
</svelte:head>

<div class="flex min-h-screen bg-[#F8F5F0]">
	<!-- Left Sidebar -->
	<Sidebar />

	<!-- Main Content -->
	<main class="ml-0 md:ml-[240px] flex-1">
		<div class="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
			<!-- Page Header -->
			<div class="mb-6 md:mb-8">
				<h1 class="text-[#2C3E50] font-bold text-2xl md:text-4xl mb-2">My Favorites</h1>
				<p class="text-[#4B5563] text-base md:text-lg">Your saved preset vibes</p>
			</div>

			{#if loading}
				<!-- Loading State -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
					{#each [1, 2, 3] as _}
						<div class="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
							<div class="aspect-video bg-gray-200"></div>
							<div class="p-5">
								<div class="h-5 bg-gray-200 rounded w-3/4 mb-4"></div>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<div class="w-8 h-8 rounded-full bg-gray-200"></div>
										<div class="h-4 bg-gray-200 rounded w-20"></div>
									</div>
									<div class="h-9 bg-gray-200 rounded w-24"></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else if errorMessage}
				<!-- Error State -->
				<div class="bg-white rounded-xl p-8 md:p-12 text-center shadow-sm">
					<div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
						<span class="material-symbols-outlined text-red-400 text-4xl">error</span>
					</div>
					<h2 class="text-[#2C3E50] font-bold text-xl md:text-2xl mb-2">{errorMessage}</h2>
					<p class="text-[#4B5563] mb-6">
						{errorMessage.includes('log in')
							? 'Sign in to save and view your favorite presets'
							: 'Something went wrong. Please try again.'}
					</p>
					<button
						onclick={() => errorMessage.includes('log in') ? goto('/auth/login') : fetchFavorites()}
						class="bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
					>
						{errorMessage.includes('log in') ? 'Sign In' : 'Try Again'}
					</button>
				</div>
			{:else if favoritedPresets.length === 0}
				<!-- Empty State -->
				<div class="bg-white rounded-xl p-8 md:p-12 text-center shadow-sm">
					<div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
						<span class="material-symbols-outlined text-gray-400 text-4xl">favorite</span>
					</div>
					<h2 class="text-[#2C3E50] font-bold text-xl md:text-2xl mb-2">No favorites yet</h2>
					<p class="text-[#4B5563] mb-6">
						Browse the preset marketplace to find styles you love
					</p>
					<button
						onclick={() => goto('/presets')}
						class="bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
					>
						Discover Presets
					</button>
				</div>
			{:else}
				<!-- Preset Vibes Grid -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
					{#each favoritedPresets as preset}
						<div class="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
							<!-- Thumbnail with Badge -->
							<div
								class="relative aspect-video overflow-hidden"
								style="background-color: {preset.backgroundColor}"
							>
								{#if preset.thumbnail}
									<img
										src={preset.thumbnail}
										alt={preset.name}
										class="w-full h-full object-cover"
										loading="lazy"
									/>
								{:else}
									<!-- Colored background with icon for presets without thumbnail -->
									<div class="w-full h-full flex items-center justify-center">
										<div class="text-center text-white/90">
											<span class="material-symbols-outlined text-[48px]">palette</span>
											<p class="text-sm font-medium mt-1">{preset.name}</p>
										</div>
									</div>
								{/if}

								<!-- Badge (Trending or New) -->
								{#if isTrending(preset.usageCount)}
									<div
										class="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5"
									>
										<span class="material-symbols-outlined text-[#00796B] text-[16px]"
											>trending_up</span
										>
										<span class="text-[#00796B] text-xs font-semibold">Trending</span>
									</div>
								{:else if isNew(preset.usageCount)}
									<div class="absolute top-3 left-3 bg-[#00796B] px-3 py-1.5 rounded-full">
										<span class="text-white text-xs font-semibold">New</span>
									</div>
								{/if}
							</div>

							<!-- Content -->
							<div class="p-5">
								<!-- Preset Name with Favorite Button -->
								<div class="flex items-center justify-between mb-4">
									<h3 class="text-[#2C3E50] font-bold text-lg">{preset.name}</h3>
									<button
										onclick={() => removeFavorite(preset)}
										class="p-1 hover:bg-gray-100 rounded-full transition-colors"
										aria-label="Remove from favorites"
									>
										<span
											class="material-symbols-outlined text-[24px] text-red-500 transition-colors"
											style="font-variation-settings: 'FILL' 1"
										>
											favorite
										</span>
									</button>
								</div>

								<!-- Creator Info and Use Button -->
								<div class="flex items-center justify-between">
									<!-- Creator Avatar + Name -->
									<div class="flex items-center gap-2">
										<div
											class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0"
										>
											{#if preset.creator.avatar}
												<img
													src={preset.creator.avatar}
													alt={preset.creator.name}
													class="w-full h-full object-cover"
												/>
											{:else}
												<span class="material-symbols-outlined text-gray-400 text-[18px]"
													>person</span
												>
											{/if}
										</div>
										<span class="text-[#4B5563] text-sm font-medium"
											>{preset.creator.name}</span
										>
									</div>

									<!-- Use this Vibe Button -->
									<button
										onclick={() => handleUseVibe(preset)}
										class="bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-3 md:px-4 rounded-lg transition-all duration-200 text-xs md:text-sm whitespace-nowrap"
									>
										<span class="hidden sm:inline">Use this Vibe</span>
										<span class="sm:hidden">Use</span>
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Results summary -->
				<div class="text-center py-8">
					<p class="text-[#4B5563] text-sm">
						{favoritedPresets.length} favorite{favoritedPresets.length !== 1 ? 's' : ''}
					</p>
				</div>
			{/if}
		</div>
	</main>
</div>
