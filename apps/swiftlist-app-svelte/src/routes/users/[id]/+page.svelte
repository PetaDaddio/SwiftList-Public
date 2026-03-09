<script lang="ts">
	/**
	 * User Profile Page - Public View
	 * Shows user's public profile, badges, follower stats, and published vibes
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Sidebar from '$lib/components/Sidebar.svelte';

	const userId = $derived($page.params.id);

	// Static color map for badges (dynamic Tailwind classes like bg-{var}-50 are purged at build time)
	const badgeColorMap: Record<string, { bg: string; border: string; icon: string; text: string }> = {
		amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', text: 'text-amber-700' },
		blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', text: 'text-blue-700' },
		purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', text: 'text-purple-700' },
		emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', text: 'text-emerald-700' },
		red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', text: 'text-red-700' },
	};

	// Mock user data
	const mockUsers: Record<string, any> = {
		'current-user': {
			user_id: 'current-user',
			display_name: 'StyleCreator Pro',
			avatar_url: null,
			bio: 'Creating stunning marketplace vibes since 2025. Specializing in vintage and minimalist aesthetics.',
			follower_count: 1250,
			following_count: 340,
			vibe_count: 12,
			total_usage: 4580,
			joined_date: '2025-11-10T00:00:00Z',
			badges: [
				{ id: 'top-creator', label: 'Top Creator', icon: 'emoji_events', color: 'amber' },
				{ id: 'verified', label: 'Verified', icon: 'verified', color: 'blue' },
				{ id: '100-vibes', label: '100+ Vibes', icon: 'celebration', color: 'purple' }
			],
			publicVibes: [
				{
					id: '1',
					name: 'Vintage Denim',
					category: 'Vintage',
					usage_count: 2450,
					gradient: 'from-blue-700 via-indigo-600 to-blue-800'
				},
				{
					id: '3',
					name: 'Neon Cyberpunk',
					category: 'Neon',
					usage_count: 890,
					gradient: 'from-purple-600 via-pink-500 to-cyan-500'
				},
				{
					id: '5',
					name: 'Luxury Watch',
					category: 'Luxury',
					usage_count: 670,
					gradient: 'from-amber-700 via-yellow-600 to-amber-800'
				}
			]
		},
		'other-user': {
			user_id: 'other-user',
			display_name: 'MinimalDesigns',
			avatar_url: null,
			bio: 'Less is more. Creating clean, modern marketplace vibes for furniture and home decor.',
			follower_count: 890,
			following_count: 180,
			vibe_count: 8,
			total_usage: 3200,
			joined_date: '2025-12-01T00:00:00Z',
			badges: [
				{ id: 'verified', label: 'Verified', icon: 'verified', color: 'blue' }
			],
			publicVibes: [
				{
					id: '2',
					name: 'Minimalist Home',
					category: 'Minimalist',
					usage_count: 1850,
					gradient: 'from-gray-200 via-gray-300 to-gray-400'
				},
				{
					id: '4',
					name: 'Eco-Friendly',
					category: 'Nature',
					usage_count: 780,
					gradient: 'from-green-600 via-emerald-500 to-teal-600'
				}
			]
		}
	};

	const user = $derived(userId ? mockUsers[userId] : mockUsers['other-user']);
	const currentUserId = $state('current-user');
	const isOwnProfile = $derived(userId === currentUserId);
	let isFollowing = $state(false);

	function handleFollow() {
		if (isFollowing) {
			alert('Unfollowed!');
		} else {
			alert('Followed!');
		}
		isFollowing = !isFollowing;
	}

	function formatNumber(num: number): string {
		if (num >= 1000) {
			return (num / 1000).toFixed(1) + 'k';
		}
		return num.toString();
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long'
		});
	}
</script>

<svelte:head>
	<title>{user.display_name} - SwiftList</title>
</svelte:head>

<div class="flex min-h-screen bg-[#F8F5F0]">
	<!-- Left Sidebar -->
	<Sidebar />

	<!-- Main Content -->
	<main class="ml-0 md:ml-[240px] flex-1 p-4 md:p-8">
		<div class="max-w-6xl mx-auto">
			<!-- Back Button -->
			<div class="mb-6">
				<button
					onclick={() => goto('/presets')}
					class="flex items-center gap-2 text-[#4B5563] hover:text-[#00796B] transition-colors"
				>
					<span class="material-symbols-outlined">arrow_back</span>
					<span class="font-semibold">Back to Marketplace</span>
				</button>
			</div>

			<!-- Profile Header -->
			<div class="bg-white rounded-xl p-4 sm:p-8 shadow-sm mb-8">
				<div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8">
					<!-- Avatar -->
					<div class="flex-shrink-0">
						<div class="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#00796B] to-[#004D40] flex items-center justify-center overflow-hidden">
							{#if user.avatar_url}
								<img src={user.avatar_url} alt={user.display_name} class="w-full h-full object-cover" />
							{:else}
								<span class="material-symbols-outlined text-white text-6xl">
									person
								</span>
							{/if}
						</div>
					</div>

					<!-- User Info -->
					<div class="flex-1">
						<div class="flex items-start justify-between mb-4">
							<div>
								<h1 class="text-3xl font-bold text-[#2C3E50] mb-2">{user.display_name}</h1>
								<p class="text-[#4B5563] text-lg leading-relaxed">{user.bio}</p>
							</div>
							{#if !isOwnProfile}
								<button
									onclick={handleFollow}
									class="{isFollowing ? 'bg-white border-2 border-[#00796B] text-[#00796B]' : 'bg-[#00796B] text-white'} hover:bg-[#00695C] hover:text-white hover:border-[#00695C] font-semibold py-3 px-8 rounded-lg transition-all duration-200 flex items-center gap-2"
								>
									<span class="material-symbols-outlined text-xl">
										{isFollowing ? 'check' : 'person_add'}
									</span>
									<span>{isFollowing ? 'Following' : 'Follow'}</span>
								</button>
							{/if}
						</div>

						<!-- Stats Row -->
						<div class="flex items-center gap-4 sm:gap-8 mb-6">
							<div class="text-center">
								<p class="text-xl sm:text-2xl font-bold text-[#2C3E50]">{formatNumber(user.follower_count)}</p>
								<p class="text-sm text-[#4B5563]">Followers</p>
							</div>
							<div class="text-center">
								<p class="text-xl sm:text-2xl font-bold text-[#2C3E50]">{formatNumber(user.following_count)}</p>
								<p class="text-sm text-[#4B5563]">Following</p>
							</div>
							<div class="text-center">
								<p class="text-xl sm:text-2xl font-bold text-[#2C3E50]">{user.vibe_count}</p>
								<p class="text-sm text-[#4B5563]">Vibes</p>
							</div>
							<div class="text-center">
								<p class="text-xl sm:text-2xl font-bold text-[#2C3E50]">{formatNumber(user.total_usage)}</p>
								<p class="text-sm text-[#4B5563]">Total Uses</p>
							</div>
						</div>

						<!-- Badges -->
						{#if user.badges && user.badges.length > 0}
							<div>
								<p class="text-xs font-semibold text-[#4B5563] mb-3 uppercase tracking-wide">Badges</p>
								<div class="flex flex-wrap gap-3">
									{#each user.badges as badge}
										<div class="flex items-center gap-2 {badgeColorMap[badge.color]?.bg || "bg-blue-50"} px-4 py-2 rounded-lg border {badgeColorMap[badge.color]?.border || "border-blue-200"}">
											<span class="material-symbols-outlined {badgeColorMap[badge.color]?.icon || "text-blue-600"} text-[20px]">
												{badge.icon}
											</span>
											<span class="text-sm font-semibold {badgeColorMap[badge.color]?.text || "text-blue-700"}">{badge.label}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Joined Date -->
						<p class="text-sm text-[#4B5563] mt-6">
							Joined {formatDate(user.joined_date)}
						</p>
					</div>
				</div>
			</div>

			<!-- Public Vibes Section -->
			<div>
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-2xl font-bold text-[#2C3E50]">Public Vibes</h2>
					<p class="text-[#4B5563]">{user.publicVibes.length} vibes</p>
				</div>

				{#if user.publicVibes.length > 0}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{#each user.publicVibes as vibe}
							<a
								href={`/presets/${vibe.id}`}
								class="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
							>
								<!-- Vibe Thumbnail -->
								<div class="aspect-square bg-gradient-to-br {vibe.gradient} flex items-center justify-center relative overflow-hidden">
									<span class="material-symbols-outlined text-white/80 text-8xl">
										palette
									</span>
									<div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
								</div>

								<!-- Vibe Info -->
								<div class="p-4">
									<div class="flex items-center justify-between mb-2">
										<h3 class="text-lg font-bold text-[#2C3E50] group-hover:text-[#00796B] transition-colors">
											{vibe.name}
										</h3>
										<span class="px-2 py-1 text-xs font-medium bg-[#00796B]/10 text-[#00796B] rounded-full">
											{vibe.category}
										</span>
									</div>
									<div class="flex items-center gap-2 text-sm text-[#4B5563]">
										<span class="material-symbols-outlined text-[16px]">visibility</span>
										<span>{formatNumber(vibe.usage_count)} uses</span>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<!-- Empty State -->
					<div class="bg-white rounded-xl p-12 text-center shadow-sm">
						<div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
							<span class="material-symbols-outlined text-gray-400 text-4xl">palette</span>
						</div>
						<h3 class="text-xl font-bold text-[#2C3E50] mb-2">No public vibes yet</h3>
						<p class="text-[#4B5563]">
							{isOwnProfile ? 'Create your first vibe to get started!' : 'This user hasn\'t published any vibes yet.'}
						</p>
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>
