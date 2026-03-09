<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Logo from '$lib/components/Logo.svelte';
	import ABTest from '$lib/components/ABTest.svelte';
	import { trackConversion } from '$lib/ab/tracker';

	let billingPeriod = $state<'monthly' | 'annual'>('monthly');
	let checkoutLoading = $state<string | null>(null);

	// Auto-trigger checkout if redirected from login/signup with ?checkout= param
	onMount(() => {
		const checkoutPlan = $page.url.searchParams.get('checkout');
		if (checkoutPlan && $page.data.session?.access_token) {
			handleSelectPlan(checkoutPlan, false);
		}
	});

	const plans = [
		{
			name: 'Explorer',
			tier: 'explorer',
			price: 0,
			priceAnnual: 0,
			credits: 100,
			description: 'Perfect for getting started',
			features: [
				'Background Removal (CleanEdge Intelligence™)',
				'Customize Background',
				'Image Upscale',
				'High-Res Marketplace Exports',
				'GemPerfect™ Jewelry Engine'
			],
			comingSoon: false,
			popular: false,
			buttonText: 'Start Free'
		},
		{
			name: 'Maker',
			tier: 'maker',
			price: 29,
			priceAnnual: 23,
			credits: 400,
			description: 'Best for growing creators',
			features: [
				{ text: 'All Explorer Tools', bold: true },
				'Lifestyle Setting Creation',
				'Product in Hands',
				'Create Preset Vibes',
				'Earn Sparks',
				'Watermark Removed',
				'Invisible Mannequin',
				'Priority Customer Support',
				'Priority Processing'
			],
			comingSoon: false,
			popular: false,
			buttonText: 'Get Started'
		},
		{
			name: 'Merchant',
			tier: 'merchant',
			price: 49,
			priceAnnual: 39,
			credits: 1100,
			description: 'For serious sellers',
			features: [
				{ text: 'All Explorer + Maker Tools', bold: true },
				'Generate Collages',
				'Priority Support'
			],
			comingSoon: false,
			popular: true,
			buttonText: 'Get Started'
		},
		{
			name: 'Agency',
			tier: 'agency',
			price: 99,
			priceAnnual: 79,
			credits: 2500,
			description: 'For teams and agencies',
			features: [
				{ text: 'All Explorer/Maker/Merchant Tools', bold: true },
				'Priority Job Queue',
				'Convert YouTube to TikTok',
				'Create TikTok from Blog Post',
				'Spinning Product Animation',
				'Exploded View Videos',
				'AI Interior Room Population',
				'Cinematic Fly Through'
			],
			comingSoon: false,
			popular: false,
			buttonText: 'Get Started'
		}
	];

	// Complete list of all SwiftList tools for Feature Comparison
	const allFeatures = [
		{ name: 'Background Removal (CleanEdge™)', explorer: true, maker: true, merchant: true, agency: true },
		{ name: 'Customize Background', explorer: true, maker: true, merchant: true, agency: true },
		{ name: 'Image Upscale', explorer: true, maker: true, merchant: true, agency: true },
		{ name: 'High-Res Marketplace Exports', explorer: true, maker: true, merchant: true, agency: true },
		{ name: 'GemPerfect™ Jewelry Engine', explorer: true, maker: true, merchant: true, agency: true },
		{ name: 'Lifestyle Setting Creation', explorer: false, maker: true, merchant: true, agency: true },
		{ name: 'Product in Hands', explorer: false, maker: true, merchant: true, agency: true },
		{ name: 'Create Preset Vibes', explorer: false, maker: true, merchant: true, agency: true },
		{ name: 'Earn Sparks', explorer: false, maker: true, merchant: true, agency: true },
		{ name: 'Watermark Removed', explorer: false, maker: true, merchant: true, agency: true },
		{ name: 'Invisible Mannequin', explorer: false, maker: true, merchant: true, agency: true },
		{ name: 'Priority Customer Support', explorer: false, maker: true, merchant: true, agency: true },
		{ name: 'Priority Processing', explorer: false, maker: true, merchant: true, agency: true },
		{ name: 'Generate Collages', explorer: false, maker: false, merchant: true, agency: true },
		{ name: 'Spend Sparks', explorer: false, maker: false, merchant: true, agency: true },
		{ name: 'Priority Support', explorer: false, maker: false, merchant: true, agency: true },
		{ name: 'Priority Job Queue', explorer: false, maker: false, merchant: false, agency: true },
		{ name: 'Convert YouTube to TikTok', explorer: false, maker: false, merchant: false, agency: true },
		{ name: 'Create TikTok from Blog Post', explorer: false, maker: false, merchant: false, agency: true },
		{ name: 'Spinning Product Animation', explorer: false, maker: false, merchant: false, agency: true },
		{ name: 'Exploded View Videos', explorer: false, maker: false, merchant: false, agency: true },
		{ name: 'AI Interior Room Population', explorer: false, maker: false, merchant: false, agency: true },
		{ name: 'Cinematic Fly Through', explorer: false, maker: false, merchant: false, agency: true }
	];

	const creditPacks = [
		{ credits: 100, price: 19, savings: 0, packId: 'credits_100' },
		{ credits: 500, price: 49, savings: 10, packId: 'credits_500' },
		{ credits: 1500, price: 149, savings: 20, packId: 'credits_1500' }
	];

	async function handleSelectPlan(tier: string, comingSoon: boolean) {
		if (comingSoon) return;
		if (tier === 'explorer') {
			goto('/auth/signup');
			return;
		}

		const session = $page.data.session;
		if (!session?.access_token) {
			goto(`/auth/signup?plan=${tier}`);
			return;
		}

		checkoutLoading = tier;
		try {
			const res = await fetch('/api/checkout/create-session', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session.access_token}`
				},
				body: JSON.stringify({ pack_id: `${tier}_monthly` })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || 'Failed to create checkout session');
			}

			const { checkout_url } = await res.json();
			if (checkout_url) {
				window.location.href = checkout_url;
			}
		} catch (err) {
			console.error('Checkout error:', err);
			checkoutLoading = null;
		}
	}

	async function handleBuyCreditPack(packId: string) {
		const session = $page.data.session;
		if (!session?.access_token) {
			goto('/auth/login?next=/pricing');
			return;
		}

		checkoutLoading = packId;
		try {
			const res = await fetch('/api/checkout/create-session', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session.access_token}`
				},
				body: JSON.stringify({ pack_id: packId })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || 'Failed to create checkout session');
			}

			const { checkout_url } = await res.json();
			if (checkout_url) {
				window.location.href = checkout_url;
			}
		} catch (err) {
			console.error('Checkout error:', err);
			checkoutLoading = null;
		}
	}

	function getPrice(plan: typeof plans[0]) {
		return billingPeriod === 'annual' ? plan.priceAnnual : plan.price;
	}

	function getFeatureText(feature: string | { text: string; bold: boolean }): string {
		return typeof feature === 'string' ? feature : feature.text;
	}

	function isFeatureBold(feature: string | { text: string; bold: boolean }): boolean {
		return typeof feature === 'object' && feature.bold;
	}

	function getTagline(jsonValue: string, tier: string, fallback: string): string {
		try {
			const tags = JSON.parse(jsonValue);
			return tags[tier] || fallback;
		} catch {
			return fallback;
		}
	}
</script>

<svelte:head>
	<title>Pricing - SwiftList</title>
	<meta name="description" content="SwiftList pricing plans for AI product photography. Free Explorer tier, Maker at $29/mo, Merchant at $49/mo, and Agency at $99/mo. Background removal, lifestyle scenes, and multi-marketplace export." />
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
					<a href="/auth/login" class="text-sm font-medium text-[#4B5563] hover:text-[#2C3E50] transition-colors">
						Sign In
					</a>
					<button onclick={() => goto('/auth/signup')} class="px-4 py-2 bg-[#00796B] hover:bg-[#00695C] text-white text-sm font-medium rounded-lg transition-colors">
						Get Started
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Hero Section -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
		<h1 class="text-5xl font-bold text-[#2C3E50] mb-4"><ABTest experiment="pricing-h1" let:value>{value || 'Choose Your Plan'}</ABTest></h1>
		<p class="text-xl text-[#4B5563] max-w-2xl mx-auto mb-8">
			<ABTest experiment="pricing-subhead" let:value>{value || 'Unlock your potential with a plan that fits your needs. Start free, upgrade anytime.'}</ABTest>
		</p>

		<!-- Billing Period Toggle -->
		<div class="flex items-center justify-center gap-3 mb-12">
			<button
				onclick={() => billingPeriod = 'monthly'}
				class={`text-sm font-medium transition-colors ${billingPeriod === 'monthly' ? 'text-[#2C3E50]' : 'text-[#4B5563] hover:text-[#2C3E50]'}`}
			>
				Monthly
			</button>
			<button
				onclick={() => billingPeriod = billingPeriod === 'monthly' ? 'annual' : 'monthly'}
				aria-label="Toggle billing period"
				class={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:ring-offset-2 ${billingPeriod === 'annual' ? 'bg-[#00796B]' : 'bg-gray-200'}`}
			>
				<span class={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${billingPeriod === 'annual' ? 'translate-x-8' : 'translate-x-1'}`}></span>
			</button>
			<button
				onclick={() => billingPeriod = 'annual'}
				class={`text-sm font-medium transition-colors ${billingPeriod === 'annual' ? 'text-[#2C3E50]' : 'text-[#4B5563] hover:text-[#2C3E50]'}`}
			>
				Annual
				<span class="ml-1 text-xs text-green-600 font-semibold"><ABTest experiment="pricing-annual-toggle" let:value>{value || 'Save 20%'}</ABTest></span>
			</button>
		</div>
	</div>

	<!-- Subscription Plans -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
			{#each plans as plan (plan.tier)}
				<div class={`relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col overflow-hidden ${plan.popular ? 'ring-2 ring-[#00796B]' : ''} ${plan.comingSoon ? 'opacity-60' : ''}`}>
					{#if plan.comingSoon}
						<div class="absolute top-4 right-4 z-10">
							<span class="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold tracking-wide">
								Coming Soon
							</span>
						</div>
					{/if}

					{#if plan.popular && !plan.comingSoon}
						<div class="absolute -top-0 left-1/2 -translate-x-1/2">
							<span class="inline-flex items-center px-4 py-1.5 rounded-b-lg bg-[#00796B] text-white text-xs font-semibold tracking-wide">
								Most Popular
							</span>
						</div>
					{/if}

					<!-- Gradient Price Section (Card A inspired) -->
					<div class={`px-6 pt-8 pb-6 ${plan.popular ? 'bg-gradient-to-b from-[#00796B]/12 via-[#00796B]/5 to-transparent' : 'bg-gradient-to-b from-[#00796B]/8 via-[#00796B]/3 to-transparent'}`}>
						<!-- Plan Header -->
						<div class="mb-4">
							<h3 class="text-lg font-semibold text-[#00796B] tracking-wide">{plan.name}</h3>
						</div>

						<!-- Pricing -->
						<div class="mb-1">
							<div class="flex items-baseline gap-1.5">
								{#if plan.price === 0}
									<span class="text-4xl md:text-5xl font-bold text-[#2C3E50]">Free</span>
								{:else}
									<span class="text-4xl md:text-5xl font-bold text-[#2C3E50]">${getPrice(plan)}</span>
									<span class="text-[#4B5563] text-sm">/month</span>
								{/if}
							</div>
						</div>
						<p class="text-sm text-[#4B5563]">
							<ABTest experiment="pricing-plan-taglines" let:value>
								{value ? getTagline(value, plan.tier, plan.description) : plan.description}
							</ABTest>
						</p>
						<p class="text-sm text-[#00796B] font-semibold mt-2">{plan.credits} credits included</p>
					</div>

					<div class="px-6 pb-6 flex flex-col flex-1">
						<!-- CTA Button (Card A inspired - dark/bold) -->
						<button
							onclick={() => {
								trackConversion(`pricing-${plan.tier}-cta`, 'click');
								handleSelectPlan(plan.tier, plan.comingSoon);
							}}
							disabled={plan.comingSoon || checkoutLoading === plan.tier}
							class={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 mb-6 disabled:opacity-50 disabled:cursor-not-allowed ${
								plan.popular
									? 'bg-[#2C3E50] hover:bg-[#1a2a38] text-white shadow-lg hover:shadow-xl'
									: 'bg-[#2C3E50] hover:bg-[#1a2a38] text-white shadow-md hover:shadow-lg'
							}`}
						>
							{#if checkoutLoading === plan.tier}
								Redirecting...
							{:else if plan.tier === 'explorer'}
								<ABTest experiment="pricing-explorer-cta" let:value>
									{value || plan.buttonText}
								</ABTest>
							{:else if plan.tier === 'maker'}
								<ABTest experiment="pricing-maker-cta" let:value>
									{value || plan.buttonText}
								</ABTest>
							{:else if plan.tier === 'merchant'}
								<ABTest experiment="pricing-merchant-cta" let:value>
									{value || plan.buttonText}
								</ABTest>
							{:else}
								{plan.buttonText}
							{/if}
						</button>

						<!-- Features List (Card B inspired - clean checkmarks) -->
						<ul class="space-y-3.5 flex-1">
							{#each plan.features as feature (getFeatureText(feature))}
								<li class="flex items-start gap-3">
									<svg class="w-5 h-5 text-[#00796B] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
									</svg>
									<span class={`text-sm text-[#4B5563] ${isFeatureBold(feature) ? 'font-semibold text-[#2C3E50]' : ''}`}>
										{getFeatureText(feature)}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Feature Comparison Table -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
		<h2 class="text-3xl font-bold text-[#2C3E50] text-center mb-12">Feature Comparison</h2>

		<div class="bg-white rounded-lg shadow-md overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50 border-b border-gray-200">
						<tr>
							<th class="text-left py-4 px-6 text-sm font-semibold text-[#2C3E50]">Feature</th>
							<th class="text-center py-4 px-4 text-sm font-semibold text-[#2C3E50]">Explorer</th>
							<th class="text-center py-4 px-4 text-sm font-semibold text-[#2C3E50]">Maker</th>
							<th class="text-center py-4 px-4 text-sm font-semibold text-[#2C3E50]">Merchant</th>
							<th class="text-center py-4 px-4 text-sm font-semibold text-[#2C3E50]">Agency</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each allFeatures as feature (feature.name)}
							<tr class="hover:bg-gray-50">
								<td class="py-4 px-6 text-sm text-[#4B5563]">{feature.name}</td>
								<td class="text-center py-4 px-4">
									{#if feature.explorer}
										<span class="material-symbols-outlined text-[#00796B] text-[20px]">check</span>
									{:else}
										<span class="material-symbols-outlined text-gray-200 text-[20px]">close</span>
									{/if}
								</td>
								<td class="text-center py-4 px-4">
									{#if feature.maker}
										<span class="material-symbols-outlined text-[#00796B] text-[20px]">check</span>
									{:else}
										<span class="material-symbols-outlined text-gray-200 text-[20px]">close</span>
									{/if}
								</td>
								<td class="text-center py-4 px-4">
									{#if feature.merchant}
										<span class="material-symbols-outlined text-gray-300 text-[20px]">check</span>
									{:else}
										<span class="material-symbols-outlined text-gray-200 text-[20px]">close</span>
									{/if}
								</td>
								<td class="text-center py-4 px-4">
									{#if feature.agency}
										<span class="material-symbols-outlined text-gray-300 text-[20px]">check</span>
									{:else}
										<span class="material-symbols-outlined text-gray-200 text-[20px]">close</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- Credit Packs -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
		<div class="text-center mb-12">
			<h2 class="text-3xl font-bold text-[#2C3E50] mb-4"><ABTest experiment="pricing-payg-headline" let:value>{value || 'Pay As You Go'}</ABTest></h2>
			<p class="text-lg text-[#4B5563]">
				<ABTest experiment="pricing-payg-subhead" let:value>{value || 'Need more credits? Purchase one-time credit packs without a subscription.'}</ABTest>
			</p>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
			{#each creditPacks as pack (pack.credits)}
				<div class="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
					<div class="bg-gradient-to-b from-[#00796B]/8 via-[#00796B]/3 to-transparent px-6 pt-6 pb-4">
						{#if pack.savings > 0}
							<div class="mb-3">
								<span class="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
									Save {pack.savings}%
								</span>
							</div>
						{/if}
						<div class="text-center">
							<div class="text-4xl font-bold text-[#00796B] mb-1">{pack.credits}</div>
							<div class="text-sm text-[#4B5563]">Credits</div>
						</div>
					</div>
					<div class="px-6 pb-6 pt-2 text-center">
						<div class="flex items-baseline justify-center gap-1 mb-5">
							<span class="text-3xl font-bold text-[#2C3E50]">${pack.price}</span>
							<span class="text-[#4B5563] text-sm">one-time</span>
						</div>
						<button
							onclick={() => {
								trackConversion(`pricing-payg-cta-${pack.credits}`, 'click');
								handleBuyCreditPack(pack.packId);
							}}
							disabled={checkoutLoading === pack.packId}
							class="w-full py-3 px-4 bg-[#2C3E50] hover:bg-[#1a2a38] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#if checkoutLoading === pack.packId}
								Redirecting...
							{:else}
								<ABTest experiment={`pricing-payg-cta-${pack.credits}`} let:value>
									{value || 'Buy Now'}
								</ABTest>
							{/if}
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- CTA Section -->
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
		<div class="bg-white rounded-lg shadow-md p-8 text-center">
			<span class="material-symbols-outlined text-[#00796B] text-6xl mb-4 inline-block">
				rocket_launch
			</span>
			<h2 class="text-3xl font-bold text-[#2C3E50] mb-4"><ABTest experiment="pricing-bottom-cta-headline" let:value>{value || 'Ready to Get Started?'}</ABTest></h2>
			<p class="text-lg text-[#4B5563] mb-8 max-w-2xl mx-auto">
				Join sellers transforming their product images with AI-powered treatments.
				Start free today with 100 credits.
			</p>
			<ABTest experiment="pricing-bottom-cta-button" let:value>
				<button onclick={() => { trackConversion('pricing-bottom-cta-button', 'click'); goto('/auth/signup'); }} class="inline-flex items-center gap-2 px-6 py-3 bg-[#00796B] hover:bg-[#00695C] text-white font-semibold text-lg rounded-lg transition-colors">
					<span>{value || 'Start Free Trial'}</span>
					<span class="material-symbols-outlined text-[20px]">arrow_forward</span>
				</button>
			</ABTest>
		</div>
	</div>
</div>
