<script lang="ts">
	import '../app.css';
	import Toast from '$lib/components/Toast.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { page } from '$app/stores';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	/** Routes that render their own footer — hide the root layout footer */
	const noFooterRoutes = ['/home', '/hello'];
	let hideFooter = $derived(noFooterRoutes.some((r) => $page.url.pathname.startsWith(r)));

	/** Routes that have a fixed sidebar — footer needs left offset */
	const sidebarRoutes = ['/dashboard', '/analytics', '/presets', '/jobs', '/users'];
	let hasSidebar = $derived(sidebarRoutes.some((r) => $page.url.pathname.startsWith(r)));

	/**
	 * Supabase Auth State Listener
	 * When the auth state changes (login, logout, token refresh),
	 * invalidate the 'supabase:auth' dependency to re-run +layout.ts load.
	 * This ensures the session stays in sync across full page loads
	 * (e.g. returning from Stripe checkout).
	 */
	onMount(() => {
		const { data: { subscription } } = data.supabase.auth.onAuthStateChange(
			(_event, newSession) => {
				// Only invalidate if the session actually changed
				if (newSession?.expires_at !== data.session?.expires_at) {
					invalidate('supabase:auth');
				}
			}
		);

		return () => {
			subscription.unsubscribe();
		};
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<title>SwiftList - Create Stunning Visual Assets</title>
	<meta
		name="description"
		content="Transform your ideas into professional marketing materials with a single click. The maker's toolkit for the modern economy."
	/>
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "Organization",
		"name": "SwiftList",
		"url": "https://swiftlist.app",
		"logo": "https://swiftlist.app/logos/swiftlist-s-mark.svg",
		"description": "AI-powered product image automation for e-commerce sellers. Background removal, lifestyle scenes, and batch processing.",
		"sameAs": []
	})}</script>`}
</svelte:head>

<div class="flex flex-col min-h-screen">
	<div class="flex-1">
		{@render children()}
	</div>

	<!-- Footer (hidden on routes with their own footer) -->
	{#if !hideFooter}
	<footer class="border-t border-gray-200/50 bg-white/80 backdrop-blur-sm mt-auto {hasSidebar ? 'md:ml-[240px]' : ''}">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="flex flex-col md:flex-row items-center justify-between gap-4">
				<div class="flex items-center gap-2">
					<Logo size={20} />
					<span class="text-[#4B5563] text-sm">© 2026</span>
				</div>
				<div class="flex items-center gap-6 text-sm">
					<a href="/terms" class="text-[#4B5563] hover:text-[#2C3E50] transition-colors">
						Terms of Service
					</a>
					<a href="/privacy" class="text-[#4B5563] hover:text-[#2C3E50] transition-colors">
						Privacy Policy
					</a>
					<a href="/faq" class="text-[#4B5563] hover:text-[#2C3E50] transition-colors">
						FAQ
					</a>
					<a href="mailto:support@heyswiftlist.com" class="text-[#4B5563] hover:text-[#2C3E50] transition-colors">
						Support
					</a>
				</div>
			</div>
		</div>
	</footer>
	{/if}
</div>
<Toast />
