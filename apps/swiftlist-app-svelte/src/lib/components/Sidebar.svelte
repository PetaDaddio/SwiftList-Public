<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import Logo from '$lib/components/Logo.svelte';
	import EditProfileModal from '$lib/components/EditProfileModal.svelte';

	// Real user data from layout server load
	let profile = $derived($page.data.profile);
	let user = $derived($page.data.user);

	// Display values with fallbacks
	let displayName = $derived(profile?.display_name || user?.email?.split('@')[0] || 'User');
	let displayEmail = $derived(user?.email || '');
	let avatarUrl = $derived(profile?.avatar_url || null);
	let userId = $derived(user?.id || '');

	// Credit balance from profile (fallback to 0)
	let creditBalance = $derived(profile?.credits_balance ?? 0);

	// Edit Profile Modal state
	let showEditProfile = $state(false);

	// Mobile drawer state
	let mobileOpen = $state(false);

	// Navigation items
	const navItems = [
		{ label: 'Discover', icon: 'explore', path: '/presets', tourId: 'sidebar-discover' },
		{ label: 'Favorites', icon: 'favorite', path: '/presets/favorites', tourId: 'sidebar-favorites' },
		{ label: 'My Studio', icon: 'dashboard', path: '/dashboard', tourId: 'sidebar-my-studio' },
		{ label: 'Analytics', icon: 'bar_chart', path: '/analytics', tourId: 'sidebar-analytics' }
	];

	function isActive(path: string): boolean {
		return $page.url.pathname === path;
	}

	async function handleProfileUpdated(updatedProfile: { name: string; avatar: string | null }) {
		// Invalidate all server load functions to refresh profile data across all pages
		await invalidateAll();
		showEditProfile = false;
	}

	function handleMobileNavClick(path: string) {
		mobileOpen = false;
		goto(path);
	}
</script>

<!-- ============================================================ -->
<!-- Mobile Top Bar (visible on mobile only, hidden on md+)     -->
<!-- ============================================================ -->
<div class="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200/50 flex items-center justify-between px-4">
	<a href="/" class="flex items-center">
		<Logo size={20} />
	</a>

	<div class="flex items-center gap-2">
		<!-- Start New Job shortcut -->
		<button
			onclick={() => goto('/jobs/new')}
			class="flex items-center gap-1 bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-3 rounded-lg transition-all duration-200 text-sm"
		>
			<span class="material-symbols-outlined text-[18px]">add_circle</span>
			New Job
		</button>

		<!-- Hamburger button -->
		<button
			onclick={() => (mobileOpen = true)}
			class="w-11 h-11 flex items-center justify-center rounded-lg text-[#2C3E50] hover:bg-gray-100 transition-colors"
			aria-label="Open navigation"
		>
			<span class="material-symbols-outlined text-[24px]">menu</span>
		</button>
	</div>
</div>

<!-- ============================================================ -->
<!-- Mobile Drawer Overlay                                        -->
<!-- ============================================================ -->
{#if mobileOpen}
	<!-- Backdrop -->
	<div
		role="button"
		tabindex="-1"
		class="md:hidden fixed inset-0 z-50 bg-black/40"
		onclick={() => (mobileOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (mobileOpen = false)}
	></div>

	<!-- Drawer panel -->
	<div class="md:hidden fixed top-0 left-0 z-50 h-full w-[280px] bg-white shadow-2xl flex flex-col overflow-y-auto">
		<!-- Drawer header -->
		<div class="p-4 border-b border-gray-200/50 flex items-center justify-between">
			<a href="/" onclick={() => (mobileOpen = false)} class="flex items-center">
				<Logo size={20} />
			</a>
			<button
				onclick={() => (mobileOpen = false)}
				class="w-10 h-10 flex items-center justify-center rounded-lg text-[#4B5563] hover:bg-gray-100 transition-colors"
				aria-label="Close navigation"
			>
				<span class="material-symbols-outlined text-[22px]">close</span>
			</button>
		</div>

		<!-- Profile section -->
		<div class="p-4 border-b border-gray-200/50">
			{#if user}
				<div class="flex items-center gap-3">
					<div class="relative flex-shrink-0">
						<div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
							{#if avatarUrl}
								<img src={avatarUrl} alt={displayName} class="w-full h-full object-cover" />
							{:else}
								<span class="material-symbols-outlined text-gray-400 text-2xl">person</span>
							{/if}
						</div>
						<div class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-[#2C3E50] font-bold text-sm truncate">{displayName}</p>
						<p class="text-[#4B5563] text-xs truncate">{displayEmail}</p>
					</div>
				</div>
				<button
					onclick={() => { mobileOpen = false; showEditProfile = true; }}
					class="mt-3 w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm"
				>
					Edit Profile
				</button>
			{:else}
				<button
					onclick={() => handleMobileNavClick('/auth/login')}
					class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm"
				>
					Sign In
				</button>
			{/if}
		</div>

		<!-- Start New Job -->
		<div class="px-4 py-3 border-b border-gray-200/50">
			<button
				onclick={() => handleMobileNavClick('/jobs/new')}
				class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
			>
				<span class="material-symbols-outlined text-[20px]">add_circle</span>
				Start New Job
			</button>
		</div>

		<!-- Nav items -->
		<nav class="flex-1 px-3 py-3">
			{#each navItems as item}
				<button
					onclick={() => handleMobileNavClick(item.path)}
					class="w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-all duration-200 {isActive(item.path)
						? 'bg-[#E8F5F4] text-[#00796B]'
						: 'text-[#4B5563] hover:bg-gray-50'}"
				>
					<span class="material-symbols-outlined text-[20px]">{item.icon}</span>
					<span class="font-medium text-sm">{item.label}</span>
				</button>
			{/each}
		</nav>

		<!-- Credit balance -->
		{#if user}
			<div class="p-4 border-t border-gray-200/50">
				<div class="bg-[#F8F5F0] rounded-lg p-4">
					<div class="flex items-center gap-2 mb-3">
						<span class="material-symbols-outlined text-[#00796B] text-2xl">account_balance_wallet</span>
						<div>
							<div class="text-[#2C3E50] font-bold text-lg">{creditBalance} Credits</div>
							<div class="text-[#4B5563] text-xs">Available balance</div>
						</div>
					</div>
					<button
						onclick={() => handleMobileNavClick('/pricing')}
						class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-1"
					>
						Top Up
						<span class="material-symbols-outlined text-[16px]">add</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- ============================================================ -->
<!-- Desktop Sidebar (hidden on mobile)                          -->
<!-- ============================================================ -->
<aside class="hidden md:flex w-[240px] h-screen bg-white border-r border-gray-200/50 flex-col fixed left-0 top-0">
	<!-- Logo Section -->
	<div class="p-6 border-b border-gray-200/50">
		<a href="/" class="flex items-center group cursor-pointer transition-transform duration-300 group-hover:scale-105">
			<Logo size={24} />
		</a>
	</div>

	<!-- Profile Card -->
	<div class="p-4 border-b border-gray-200/50">
		{#if user}
			<div class="text-center mb-3">
				<!-- Avatar with online indicator -->
				<div class="relative inline-block mb-3">
					<div class="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
						{#if avatarUrl}
							<img src={avatarUrl} alt={displayName} class="w-full h-full object-cover" />
						{:else}
							<span class="material-symbols-outlined text-gray-400 text-4xl">person</span>
						{/if}
					</div>
					<!-- Online indicator -->
					<div class="absolute bottom-0 right-0 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
				</div>

				<!-- User Info -->
				<h3 class="text-[#2C3E50] font-bold text-lg mb-1">{displayName}</h3>
				<p class="text-[#4B5563] text-sm mb-2">{displayEmail}</p>

				<!-- Edit Profile Button -->
				<button
					data-tour="sidebar-edit-profile"
					onclick={() => showEditProfile = true}
					class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm"
				>
					Edit Profile
				</button>
			</div>
		{:else}
			<div class="text-center py-4">
				<span class="material-symbols-outlined text-gray-400 text-4xl mb-2 block">person</span>
				<p class="text-[#4B5563] text-sm mb-3">Sign in to get started</p>
				<button
					onclick={() => goto('/auth/login')}
					class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm"
				>
					Sign In
				</button>
			</div>
		{/if}
	</div>

	<!-- Start New Job Button -->
	<div class="px-4 py-3">
		<button
			data-tour="sidebar-start-job"
			onclick={() => goto('/jobs/new')}
			class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
		>
			<span class="material-symbols-outlined text-[20px]">add_circle</span>
			Start New Job
		</button>
	</div>

	<!-- Navigation Items -->
	<nav class="flex-1 px-3 py-2">
		{#each navItems as item}
			<a
				data-tour={item.tourId}
				href={item.path}
				class="flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-all duration-200 {isActive(item.path)
					? 'bg-[#E8F5F4] text-[#00796B]'
					: 'text-[#4B5563] hover:bg-gray-50'}"
			>
				<span class="material-symbols-outlined text-[20px]">
					{item.icon}
				</span>
				<span class="font-medium text-sm">{item.label}</span>
			</a>
		{/each}
	</nav>

	<!-- Credit Balance Card -->
	{#if user}
		<div class="p-4 border-t border-gray-200/50">
			<div data-tour="sidebar-credits" class="bg-[#F8F5F0] rounded-lg p-4">
				<div class="flex items-center gap-2 mb-3">
					<span class="material-symbols-outlined text-[#00796B] text-2xl">account_balance_wallet</span>
					<div>
						<div class="text-[#2C3E50] font-bold text-xl">{creditBalance} Credits</div>
						<div class="text-[#4B5563] text-xs">Available balance</div>
					</div>
				</div>
				<button
					onclick={() => goto('/pricing')}
					class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-1"
				>
					Top Up
					<span class="material-symbols-outlined text-[16px]">add</span>
				</button>
			</div>
		</div>
	{/if}

	<!-- Take the Tour -->
	<div class="px-4 pb-4">
		<button
			onclick={() => {
				// Clear all tour completion flags
				Object.keys(localStorage)
					.filter(k => k.startsWith('swiftlist-tour-'))
					.forEach(k => localStorage.removeItem(k));
				window.location.reload();
			}}
			class="w-full flex items-center justify-center gap-1.5 text-[#4B5563] hover:text-[#00796B] text-xs font-medium py-2 transition-colors"
		>
			<span class="material-symbols-outlined text-[16px]">help_outline</span>
			Take the Tour
		</button>
	</div>
</aside>

<!-- Edit Profile Modal (rendered outside aside for proper z-index layering) -->
{#if userId}
	<EditProfileModal
		isOpen={showEditProfile}
		onClose={() => showEditProfile = false}
		user={{ id: userId, name: displayName, email: displayEmail, avatar: avatarUrl, twitter_url: profile?.twitter_url ?? null, instagram_url: profile?.instagram_url ?? null, tiktok_url: profile?.tiktok_url ?? null, website_url: profile?.website_url ?? null }}
		onProfileUpdated={handleProfileUpdated}
	/>
{/if}
