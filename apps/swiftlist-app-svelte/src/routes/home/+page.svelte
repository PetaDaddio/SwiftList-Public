<script lang="ts">
	/**
	 * SwiftList Homepage - Landing Page
	 * Pixel-perfect port of standalone HTML design
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Logo from '$lib/components/Logo.svelte';
	import OnboardingTour from '$lib/components/OnboardingTour.svelte';
	import { homeTour } from '$lib/config/onboarding-tours';

	// Auth state from root layout server load
	let user = $derived($page.data.user);

	function handleStartNewJob() {
		if (user) {
			goto('/jobs/new');
		} else {
			goto('/auth/signup?next=/jobs/new');
		}
	}

</script>

<svelte:head>
	<title>SwiftList - Create Stunning Visual Assets</title>
	<meta name="description" content="AI-powered product image automation for e-commerce sellers. Background removal, lifestyle scenes, and batch processing for Etsy, Shopify, Amazon, and more." />
	<link rel="canonical" href="https://swiftlist.app/home" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "WebSite",
		"name": "SwiftList",
		"url": "https://swiftlist.app",
		"description": "AI-powered product image automation for e-commerce sellers. Background removal, lifestyle scenes, and batch processing.",
		"potentialAction": {
			"@type": "SearchAction",
			"target": "https://swiftlist.app/presets?q={search_term_string}",
			"query-input": "required name=search_term_string"
		}
	})}</script>`}
</svelte:head>

<div class="bg-[#F8F5F0] transition-colors duration-300 min-h-screen flex flex-col selection:bg-[#00796B] selection:text-white">
	<!-- Header -->
	<header class="w-full px-6 py-6 md:px-12 flex items-center justify-between z-10 relative">
		<a href="/" class="flex items-center group cursor-pointer transition-transform duration-300 group-hover:scale-105">
			<Logo size={32} />
		</a>
		<nav class="flex items-center gap-6">
			<a href="/pricing" class="text-[#4B5563] hover:text-[#2C3E50] font-sans text-sm font-medium transition-colors">Pricing</a>
			<a href="/auth/login" class="text-[#4B5563] hover:text-[#2C3E50] font-sans text-sm font-medium transition-colors">Login</a>
		</nav>
	</header>

	<!-- Main Hero Section -->
	<main class="flex-grow flex flex-col items-center justify-center px-4 md:px-8 relative w-full max-w-7xl mx-auto">
		<!-- Background Blur Circles -->
		<div class="absolute inset-0 pointer-events-none overflow-hidden -z-10 opacity-30">
			<div class="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-[#00796B]/10 rounded-full blur-[120px]"></div>
			<div class="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#2C3E50]/5 rounded-full blur-[100px]"></div>
		</div>

		<!-- Hero Content -->
		<div class="w-full max-w-4xl text-center space-y-10 animate-fade-in-up">
			<!-- Headline -->
			<h1 class="text-[#2C3E50] font-sans text-4xl md:text-5xl lg:text-[4rem] leading-[1.15] font-bold tracking-tight px-4 delay-100 animate-fade-in-up">
				Create Stunning Visual Assets, <span class="text-[#00796B] block sm:inline">Instantly.</span>
			</h1>

			<!-- Subheading -->
			<p class="text-[#4B5563] text-lg md:text-xl font-sans max-w-xl mx-auto leading-relaxed delay-200 animate-fade-in-up opacity-0 font-normal">
				Transform your ideas into professional marketing materials with a single click. The maker's toolkit for the modern economy.
			</p>

			<!-- CTA Buttons -->
			<div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 delay-300 animate-fade-in-up opacity-0">
				<button
					data-tour="home-start-job"
					onclick={handleStartNewJob}
					class="w-full sm:w-auto sm:min-w-[200px] h-14 px-6 sm:px-8 bg-[#00796B] hover:bg-[#00695C] active:scale-[0.98] text-white text-sm sm:text-base font-semibold rounded-lg shadow-lg shadow-[#00796B]/20 transition-all duration-200 flex items-center justify-center gap-2 group ring-offset-2 focus:ring-2 focus:ring-[#00796B]/50 outline-none"
				>
					<span class="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform duration-500">add_circle</span>
					Start New Job
				</button>
				<button
					data-tour="home-explore-presets"
					onclick={() => goto('/presets')}
					class="w-full sm:w-auto sm:min-w-[200px] h-14 px-6 sm:px-8 bg-[#EAEAE8] hover:bg-[#DCDCDA] active:scale-[0.98] text-[#2C3E50] hover:text-[#00796B] text-sm sm:text-base font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
				>
					<span class="material-symbols-outlined text-[20px] text-[#4B5563] group-hover:text-[#00796B] transition-colors">explore</span>
					Explore Presets
				</button>
			</div>

		</div>
	</main>

	<!-- Footer -->
	<footer class="w-full py-8 px-6 text-center animate-fade-in-up delay-300">
		<div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-[#4B5563]/70 font-sans">
			<a href="/terms" class="hover:text-[#00796B] transition-colors">Terms of Service</a>
			<a href="/privacy" class="hover:text-[#00796B] transition-colors">Privacy Policy</a>
			<a href="/faq" class="hover:text-[#00796B] transition-colors">FAQ</a>
			<a href="/help" class="hover:text-[#00796B] transition-colors">Help Center</a>
			<span class="hidden sm:inline opacity-30">|</span>
			<span class="opacity-70">© 2026 SwiftList</span>
		</div>
	</footer>
</div>

<OnboardingTour tourId="home" steps={homeTour} autoStart />
