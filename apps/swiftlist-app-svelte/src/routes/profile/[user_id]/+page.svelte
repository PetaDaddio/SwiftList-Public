<script lang="ts">
	/**
	 * Public User Profile Page
	 * Shows user's public presets and profile information
	 * with social sharing (Twitter, Email, Copy Link)
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { createClient } from '$lib/supabase/client';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import FollowButton from '$lib/components/FollowButton.svelte';
	import { toastState } from '$lib/stores/toast.svelte';

	let { data } = $props();

	const userId = $derived($page.params.user_id);

	// Server-loaded profile for OG meta tags
	const serverProfile = $derived(data?.profile);

	let profile = $state<any>(null);
	let presets = $state<any[]>([]);
	let loading = $state(true);
	let currentUserId = $state<string | null>(null);
	let isOwnProfile = $derived(profile && currentUserId && profile.user_id === currentUserId);

	// Follow state
	let isFollowingUser = $state(false);
	let followerCount = $state(0);
	let followingCount = $state(0);

	// Stats
	let totalPresets = $derived(presets.length);
	let totalUsageCount = $derived(presets.reduce((sum, p) => sum + (p.usage_count || 0), 0));

	// Share URL
	const shareUrl = $derived($page.url.href);

	// Absolute URL for OG/Twitter meta tags (social crawlers need full URLs)
	const ogAvatarUrl = $derived.by(() => {
		const url = (profile || serverProfile)?.avatar_url;
		if (!url) return null;
		return url.startsWith('http') ? url : `https://swiftlist.app${url}`;
	});

	// Share helpers
	function shareOnTwitter() {
		const name = profile?.display_name || 'a creator';
		const text = `Check out ${name}'s vibes on SwiftList — stunning product image presets!`;
		const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
		window.open(url, '_blank', 'width=550,height=420');
	}

	function shareViaEmail() {
		const name = profile?.display_name || 'a creator';
		const subject = `Check out ${name} on SwiftList`;
		const body = `I found this great creator on SwiftList!\n\n${name} — ${totalPresets} public vibes\n\nCheck out their profile: ${shareUrl}`;
		window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			toastState.success('Profile link copied!');
		} catch {
			toastState.error('Failed to copy link');
		}
	}

	onMount(async () => {
		await loadCurrentUser();
		await loadProfile();
		await loadFollowData();
	});

	async function loadFollowData() {
		try {
			const supabase = createClient();

			// Check if current user follows this profile
			if (currentUserId && currentUserId !== userId) {
				const { data: followData } = await supabase
					.from('user_follows')
					.select('follower_id')
					.eq('follower_id', currentUserId)
					.eq('following_id', userId!)
					.maybeSingle();
				isFollowingUser = !!followData;
			}

			// Count followers
			const { count: followers } = await supabase
				.from('user_follows')
				.select('*', { count: 'exact', head: true })
				.eq('following_id', userId!);
			followerCount = followers || 0;

			// Count following
			const { count: following } = await supabase
				.from('user_follows')
				.select('*', { count: 'exact', head: true })
				.eq('follower_id', userId!);
			followingCount = following || 0;
		} catch {
			// Silently fail — follow counts are non-critical
		}
	}

	async function loadCurrentUser() {
		try {
			const supabase = createClient();
			const { data } = await supabase.auth.getUser();
			currentUserId = data.user?.id || null;
		} catch (err) {
			console.error('Failed to load user:', err);
		}
	}

	async function loadProfile() {
		loading = true;
		try {
			const supabase = createClient();

			// Load profile
			const { data: profileData, error: profileError } = await supabase
				.from('profiles')
				.select('user_id, display_name, avatar_url, twitter_url, instagram_url, tiktok_url, website_url, created_at')
				.eq('user_id', userId!)
				.single();

			if (profileError) throw profileError;

			profile = profileData;

			// Load public presets
			const { data: presetsData, error: presetsError } = await (supabase as any)
				.from('presets')
				.select(`
					preset_id,
					name,
					description,
					category,
					tags,
					thumbnail_url,
					usage_count,
					created_at
				`)
				.eq('user_id', userId!)
				.eq('is_public', true)
				.order('created_at', { ascending: false });

			if (presetsError) throw presetsError;

			presets = presetsData || [];
		} catch (err: any) {
			console.error('Load profile error:', err);
			toastState.error('Failed to load profile');
			goto('/presets');
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function handleUsePreset(presetId: string) {
		goto(`/jobs/new?preset_id=${presetId}`);
	}
</script>

<svelte:head>
	<title>{(profile || serverProfile)?.display_name || 'Profile'} — SwiftList</title>
	<meta name="description" content="{(profile || serverProfile)?.display_name || 'A creator'} on SwiftList — discover their vibes for stunning product images." />

	<!-- Open Graph -->
	<meta property="og:title" content="{(profile || serverProfile)?.display_name || 'Creator'} — SwiftList" />
	<meta property="og:description" content="Discover vibes by {(profile || serverProfile)?.display_name || 'this creator'} on SwiftList. {data?.presetCount || 0} public presets for stunning product images." />
	<meta property="og:url" content={shareUrl} />
	<meta property="og:type" content="profile" />
	{#if ogAvatarUrl}
		<meta property="og:image" content={ogAvatarUrl} />
	{/if}
	<meta property="og:site_name" content="SwiftList" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={ogAvatarUrl ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content="{(profile || serverProfile)?.display_name || 'Creator'} — SwiftList" />
	<meta name="twitter:description" content="Discover vibes by {(profile || serverProfile)?.display_name || 'this creator'} on SwiftList." />
	{#if ogAvatarUrl}
		<meta name="twitter:image" content={ogAvatarUrl} />
	{/if}
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "Person",
		"name": (profile || serverProfile)?.display_name || "SwiftList User",
		"url": shareUrl,
		"image": ogAvatarUrl || undefined,
		"memberOf": {
			"@type": "Organization",
			"name": "SwiftList",
			"url": "https://swiftlist.app"
		}
	})}</script>`}
</svelte:head>

<div class="min-h-screen bg-[#F8F5F0]">
	<!-- Header -->
	<header class="border-b border-gray-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<a href="/" class="flex items-center group transition-transform duration-300 group-hover:scale-105">
					<Logo size={28} />
				</a>
				<div class="flex items-center gap-4">
					<Button variant="secondary" onclick={() => goto('/presets')}>
						{#snippet children()}
							<span class="material-symbols-outlined">arrow_back</span>
							<span class="hidden sm:inline">Back to Marketplace</span>
						{/snippet}
					</Button>
					<Button variant="secondary" onclick={() => goto('/dashboard')}>
						{#snippet children()}
							<span class="material-symbols-outlined">dashboard</span>
							<span class="hidden sm:inline">Dashboard</span>
						{/snippet}
					</Button>
				</div>
			</div>
		</div>
	</header>

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center min-h-[600px]">
			<div class="text-center">
				<div class="w-12 h-12 border-4 border-[#00796B]/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
				<p class="text-[#4B5563]">Loading profile...</p>
			</div>
		</div>

	<!-- Content -->
	{:else if profile}
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			<!-- Profile Header -->
			<Card variant="elevated" class="mb-12 p-4 sm:p-8">
				<div class="flex flex-col md:flex-row items-center md:items-start gap-4 sm:gap-8">
					<!-- Avatar -->
					<div class="w-32 h-32 rounded-full bg-[#00796B]/10 flex items-center justify-center overflow-hidden flex-shrink-0">
						{#if profile.avatar_url}
							<img src={profile.avatar_url} alt={profile.display_name} class="w-full h-full object-cover" />
						{:else}
							<span class="material-symbols-outlined text-[#00796B] text-6xl">
								person
							</span>
						{/if}
					</div>

					<!-- Profile Info -->
					<div class="flex-1 text-center md:text-left">
						<h1 class="text-2xl sm:text-4xl font-bold text-[#2C3E50] mb-2">{profile.display_name}</h1>
						<p class="text-[#4B5563] mb-6">
							Member since {formatDate(profile.created_at)}
						</p>

						<!-- Stats -->
						<div class="flex flex-wrap items-center justify-center md:justify-start gap-6 mb-6">
							<div class="text-center">
								<div class="text-xl sm:text-3xl font-bold text-[#2C3E50]">{totalPresets}</div>
								<div class="text-sm text-[#4B5563]">Public Presets</div>
							</div>
							<div class="text-center">
								<div class="text-xl sm:text-3xl font-bold text-[#2C3E50]">{totalUsageCount}</div>
								<div class="text-sm text-[#4B5563]">Total Uses</div>
							</div>
							<div class="text-center">
								<div class="text-xl sm:text-3xl font-bold text-[#2C3E50]">{followerCount}</div>
								<div class="text-sm text-[#4B5563]">Followers</div>
							</div>
							<div class="text-center">
								<div class="text-xl sm:text-3xl font-bold text-[#2C3E50]">{followingCount}</div>
								<div class="text-sm text-[#4B5563]">Following</div>
							</div>
						</div>

						<!-- Social Links -->
						{#if profile.twitter_url || profile.instagram_url || profile.tiktok_url || profile.website_url}
							<div class="flex flex-wrap gap-3 justify-center md:justify-start mb-6">
								{#if profile.twitter_url}
									<a
										href={profile.twitter_url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 hover:bg-black/10 text-[#2C3E50] rounded-full transition-colors text-sm"
										title="X / Twitter"
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
											<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
										</svg>
									</a>
								{/if}
								{#if profile.instagram_url}
									<a
										href={profile.instagram_url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 hover:bg-black/10 text-[#2C3E50] rounded-full transition-colors text-sm"
										title="Instagram"
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
											<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
										</svg>
									</a>
								{/if}
								{#if profile.tiktok_url}
									<a
										href={profile.tiktok_url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 hover:bg-black/10 text-[#2C3E50] rounded-full transition-colors text-sm"
										title="TikTok"
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
											<path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.1a8.16 8.16 0 005.58 2.2V11.3a4.85 4.85 0 01-3.77-1.85V6.69z"/>
										</svg>
									</a>
								{/if}
								{#if profile.website_url}
									<a
										href={profile.website_url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 hover:bg-black/10 text-[#2C3E50] rounded-full transition-colors text-sm"
										title="Website"
									>
										<span class="material-symbols-outlined text-[16px]">language</span>
									</a>
								{/if}
							</div>
						{/if}

						<!-- Share Buttons -->
						<div class="flex flex-wrap gap-3 justify-center md:justify-start mb-6">
							<button
								onclick={shareOnTwitter}
								class="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
								</svg>
								<span>Share on X</span>
							</button>

							<button
								onclick={shareViaEmail}
								class="flex items-center gap-2 px-4 py-2 bg-[#4B5563] hover:bg-[#374151] text-white rounded-lg transition-colors text-sm font-medium"
							>
								<span class="material-symbols-outlined text-lg">email</span>
								<span>Email</span>
							</button>

							<button
								onclick={copyLink}
								class="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-[#2C3E50] border border-gray-200 rounded-lg transition-colors text-sm font-medium"
							>
								<span class="material-symbols-outlined text-lg">link</span>
								<span>Copy Link</span>
							</button>
						</div>

						<!-- Actions -->
						{#if isOwnProfile}
							<div class="flex flex-wrap gap-3 justify-center md:justify-start">
								<Button variant="primary" onclick={() => goto('/presets/create')}>
									{#snippet children()}
										<span class="material-symbols-outlined">add</span>
										<span>Create New Preset</span>
									{/snippet}
								</Button>
								<Button variant="secondary" onclick={() => goto('/dashboard')}>
									{#snippet children()}
										<span class="material-symbols-outlined">settings</span>
										<span>Edit Profile</span>
									{/snippet}
								</Button>
							</div>
						{:else if currentUserId}
							<FollowButton
								userId={userId!}
								initialFollowing={isFollowingUser}
								size="md"
							/>
						{/if}
					</div>
				</div>
			</Card>

			<!-- Presets Section -->
			<div>
				<div class="flex items-center justify-between mb-8">
					<h2 class="text-3xl font-bold text-[#2C3E50]">
						{isOwnProfile ? 'My Public Presets' : 'Public Presets'}
					</h2>
					{#if isOwnProfile && totalPresets === 0}
						<Button variant="primary" onclick={() => goto('/presets/create')}>
							{#snippet children()}
								<span class="material-symbols-outlined">add</span>
								<span>Create First Preset</span>
							{/snippet}
						</Button>
					{/if}
				</div>

				<!-- Empty State -->
				{#if presets.length === 0}
					<Card variant="bordered" class="text-center py-16">
						<span class="material-symbols-outlined text-6xl text-[#4B5563] mb-4">
							palette
						</span>
						<h3 class="text-2xl font-bold text-[#2C3E50] mb-2">
							{isOwnProfile ? 'No Public Presets Yet' : 'No Public Presets'}
						</h3>
						<p class="text-[#4B5563] mb-6">
							{isOwnProfile
								? 'Create your first preset to share with the community'
								: 'This user hasn\'t published any public presets yet'}
						</p>
						{#if isOwnProfile}
							<Button variant="primary" onclick={() => goto('/presets/create')}>
								{#snippet children()}
									<span class="material-symbols-outlined">add</span>
									<span>Create First Preset</span>
								{/snippet}
							</Button>
						{/if}
					</Card>

				<!-- Preset Grid -->
				{:else}
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{#each presets as preset}
							<Card variant="elevated" class="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer group">
								<!-- Thumbnail -->
								<div class="relative aspect-square overflow-hidden bg-gray-100">
									{#if preset.thumbnail_url}
										<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
										<img
											src={preset.thumbnail_url}
											alt={preset.name}
											class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
											tabindex="0"
											onclick={() => goto(`/presets/${preset.preset_id}`)}
											onkeydown={(e) => e.key === 'Enter' && goto(`/presets/${preset.preset_id}`)}
										/>
									{:else}
										<div class="w-full h-full flex items-center justify-center">
											<span class="material-symbols-outlined text-6xl text-[#4B5563]">
												image
											</span>
										</div>
									{/if}
								</div>

								<!-- Content -->
								<div class="p-4">
									<!-- Name -->
									<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
									<h3
										class="text-lg font-bold text-[#2C3E50] mb-2 truncate cursor-pointer hover:text-[#00796B]"
										tabindex="0"
										onclick={() => goto(`/presets/${preset.preset_id}`)}
										onkeydown={(e) => e.key === "Enter" && goto(`/presets/${preset.preset_id}`)}
									>
										{preset.name}
									</h3>

									<!-- Description -->
									<p class="text-sm text-[#4B5563] mb-4 line-clamp-2">
										{preset.description || 'No description'}
									</p>

									<!-- Stats -->
									<div class="flex items-center justify-between mb-4">
										<div class="flex items-center gap-1 text-[#4B5563] text-sm">
											<span class="material-symbols-outlined text-sm">
												visibility
											</span>
											<span>Used {preset.usage_count || 0} times</span>
										</div>
										{#if preset.category}
											<span class="px-2 py-1 text-xs font-medium bg-[#00796B]/10 text-[#00796B] rounded-full">
												{preset.category}
											</span>
										{/if}
									</div>

									<!-- Actions -->
									<div class="flex gap-2">
										<Button
											variant="primary"
											fullWidth
											onclick={(e: Event) => {
												e.stopPropagation();
												handleUsePreset(preset.preset_id);
											}}
										>
											{#snippet children()}
												<span class="material-symbols-outlined">auto_awesome</span>
												<span>Use</span>
											{/snippet}
										</Button>
										<Button
											variant="secondary"
											onclick={(e: Event) => {
												e.stopPropagation();
												goto(`/presets/${preset.preset_id}`);
											}}
										>
											{#snippet children()}
												<span class="material-symbols-outlined">visibility</span>
											{/snippet}
										</Button>
									</div>
								</div>
							</Card>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
