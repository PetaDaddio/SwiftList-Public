<script lang="ts">
	/**
	 * Preset Detail Page
	 * Shows full details of a single preset with usage stats, creator info,
	 * social sharing (Twitter, Email, Copy Link), and CTA
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { toastState } from '$lib/stores/toast.svelte';
	import ReportButton from '$lib/components/ReportButton.svelte';

	let { data } = $props();

	const presetId = $derived($page.params.id);

	// Server-loaded preset (for DB/community presets)
	const serverPreset = $derived(data?.preset);

	// Seed presets (numeric IDs 1-38) — names and usage counts match the listing page
	const seedPresetData: Record<string, { name: string; description: string; category: string; tags: string[]; usage_count: number }> = {
		'1': { name: 'Patina Blue Bohemian', description: 'Bohemian jewelry display on weathered turquoise painted wood with dried wildflowers and vintage lace.', category: 'Jewelry', tags: ['bohemian', 'jewelry', 'blue', 'patina'], usage_count: 3 },
		'2': { name: 'Heritage Heirloom', description: 'Antique jewelry on aged velvet cushion with rich burgundy tones and ornate vintage jewelry box.', category: 'Jewelry', tags: ['heirloom', 'antique', 'jewelry', 'velvet'], usage_count: 4 },
		'3': { name: 'Raw Crystal Energy', description: 'Crystal jewelry displayed on raw amethyst geode cluster with sage and palo santo.', category: 'Jewelry', tags: ['crystal', 'spiritual', 'amethyst', 'energy'], usage_count: 6 },
		'4': { name: 'Minimalist Luxe', description: 'Luxury jewelry on polished white Carrara marble with clean minimal composition.', category: 'Jewelry', tags: ['minimal', 'luxury', 'marble', 'modern'], usage_count: 3 },
		'5': { name: 'Cottagecore Romance', description: 'Delicate jewelry on vintage lace doily with pink garden roses and baby\'s breath.', category: 'Jewelry', tags: ['cottagecore', 'romantic', 'floral', 'lace'], usage_count: 8 },
		'6': { name: 'Gothic Luxe', description: 'Dark jewelry on black velvet with ornate silver candelabra and dramatic side lighting.', category: 'Jewelry', tags: ['gothic', 'dark', 'velvet', 'dramatic'], usage_count: 6 },
		'7': { name: 'Coastal Seaglass', description: 'Beach-inspired jewelry on smooth driftwood with seaglass and seashells.', category: 'Jewelry', tags: ['coastal', 'beach', 'seaglass', 'nautical'], usage_count: 6 },
		'8': { name: 'Birthstone Personalized', description: 'Gemstone jewelry on iridescent mother-of-pearl dish with birthstone chart.', category: 'Jewelry', tags: ['birthstone', 'personalized', 'gemstone', 'celestial'], usage_count: 4 },
		'9': { name: 'Pyrex Paradise', description: 'Vintage Pyrex dishware on retro 1960s Formica countertop with atomic age vibes.', category: 'Vintage', tags: ['pyrex', 'retro', '1960s', 'kitchen'], usage_count: 11 },
		'10': { name: 'Murano Magic', description: 'Murano glass art on glossy black lacquer surface with Venetian palazzo interior.', category: 'Vintage', tags: ['murano', 'glass', 'italian', 'luxury'], usage_count: 10 },
		'11': { name: 'Jadeite Glow', description: 'Jadeite dishware on vintage white enamelware table with 1940s kitchen setting.', category: 'Vintage', tags: ['jadeite', 'depression-era', 'green', 'vintage'], usage_count: 10 },
		'12': { name: 'Art Deco Elegance', description: 'Art Deco object on black and gold geometric marble with 1920s Gatsby-era interior.', category: 'Vintage', tags: ['art-deco', 'gatsby', 'gold', 'geometric'], usage_count: 3 },
		'13': { name: 'Farmhouse Finds', description: 'Vintage farmhouse item on distressed chippy paint wood with mason jars and cotton stems.', category: 'Vintage', tags: ['farmhouse', 'rustic', 'country', 'americana'], usage_count: 1 },
		'14': { name: 'Mid-Century Swung Vase', description: 'Mid-century modern glass vase on teak credenza with Eames era interior.', category: 'Vintage', tags: ['mid-century', 'MCM', 'retro', 'modern'], usage_count: 5 },
		'15': { name: 'Châteaucore Antique', description: 'French antique on aged limestone pedestal with château interior and faded frescoes.', category: 'Vintage', tags: ['chateaucore', 'french', 'antique', 'european'], usage_count: 10 },
		'16': { name: 'Lululemon Luxe Athleisure', description: 'Premium athleisure apparel on clean white yoga mat in modern fitness studio.', category: 'Fashion', tags: ['athleisure', 'fitness', 'activewear', 'wellness'], usage_count: 7 },
		'17': { name: 'Y2K Revival', description: 'Early 2000s fashion on iridescent holographic surface with butterfly clips and flip phone.', category: 'Fashion', tags: ['y2k', 'nostalgic', '2000s', 'cyber'], usage_count: 1 },
		'18': { name: 'Luxury Designer Authenticated', description: 'Designer fashion on black velvet display cushion in luxury boutique setting.', category: 'Fashion', tags: ['luxury', 'designer', 'haute-couture', 'premium'], usage_count: 11 },
		'19': { name: 'Vintage Band Tee', description: 'Vintage concert t-shirt hanging on a wooden hanger with rock and roll aesthetic.', category: 'Fashion', tags: ['band-tee', 'vintage', 'rock', 'concert'], usage_count: 4 },
		'20': { name: 'Cottagecore Dress', description: 'Floral cottagecore dress hanging in a lush garden with wildflowers and greenery.', category: 'Fashion', tags: ['cottagecore', 'dress', 'floral', 'garden'], usage_count: 6 },
		'21': { name: 'Flared Jean Revival', description: 'Flared denim jeans laid flat on clean white surface, shot from above.', category: 'Fashion', tags: ['flared', 'denim', 'jeans', '1970s'], usage_count: 5 },
		'22': { name: 'Graphic Tee Statement', description: 'Statement graphic t-shirt laid flat on neutral gray surface with streetwear aesthetic.', category: 'Fashion', tags: ['graphic-tee', 'streetwear', 'bold', 'statement'], usage_count: 6 },
		'23': { name: 'Reusable Tumbler Aesthetic', description: 'Insulated tumbler on car cup holder with road trip aesthetic.', category: 'Fashion', tags: ['tumbler', 'reusable', 'road-trip', 'wellness'], usage_count: 5 },
		'24': { name: 'Washed Linen Texture', description: 'Home décor on natural linen fabric with visible weave texture and organic wrinkles.', category: 'Home', tags: ['linen', 'texture', 'scandinavian', 'organic'], usage_count: 9 },
		'25': { name: 'Curved & Cozy', description: 'Home object on curved boucle upholstered furniture with soft rounded edges.', category: 'Home', tags: ['boucle', 'curved', 'cozy', 'hygge'], usage_count: 1 },
		'26': { name: 'Dopamine Décor', description: 'Colorful home décor on bright yellow painted shelf with bold pattern wallpaper.', category: 'Home', tags: ['dopamine', 'colorful', 'maximalist', 'joyful'], usage_count: 5 },
		'27': { name: 'Heritage Wood Paneling', description: 'Home furnishing against rich oak wood paneling with built-in shelving.', category: 'Home', tags: ['wood', 'heritage', 'craftsman', 'traditional'], usage_count: 9 },
		'28': { name: 'Rattan & Natural Texture', description: 'Home accessory on woven rattan tray with coastal tropical-inspired interior.', category: 'Home', tags: ['rattan', 'woven', 'coastal', 'tropical'], usage_count: 4 },
		'29': { name: 'Cloud Dancer Neutrals', description: 'Home décor on soft khaki upholstered surface with tonal layering of creams and taupes.', category: 'Home', tags: ['neutral', 'monochrome', 'minimalist', 'serene'], usage_count: 5 },
		'30': { name: 'Perfectly Imperfect Handmade', description: 'Handmade artisan item on raw clay surface with visible fingerprints and organic irregularities.', category: 'Home', tags: ['handmade', 'artisan', 'wabi-sabi', 'craft'], usage_count: 11 },
		'31': { name: 'Maker Workshop', description: 'Product on wooden workbench in maker workshop with 3D printer and filament spools.', category: '3D Print', tags: ['maker', 'workshop', 'DIY', '3d-print'], usage_count: 1 },
		'32': { name: 'Resin Display', description: 'Translucent resin print on clean matte gradient backdrop with UV accent light.', category: '3D Print', tags: ['resin', 'translucent', 'display', 'premium'], usage_count: 8 },
		'33': { name: 'Tabletop Miniature', description: 'Painted miniature figure on textured stone dungeon base with dice and RPG props.', category: '3D Print', tags: ['miniature', 'tabletop', 'RPG', 'gaming'], usage_count: 4 },
		'34': { name: 'Functional Print Showcase', description: 'Practical 3D printed product on pure white seamless backdrop with commercial styling.', category: '3D Print', tags: ['functional', 'practical', 'commercial', 'clean'], usage_count: 1 },
		'35': { name: 'Neon Cyber Display', description: 'Product on dark matte surface with vivid neon magenta and cyan LED lighting.', category: '3D Print', tags: ['neon', 'cyber', 'synthwave', 'futuristic'], usage_count: 9 },
		'36': { name: 'Nature Integration', description: 'Product nestled among real moss and ferns on natural stone surface.', category: '3D Print', tags: ['nature', 'biophilic', 'moss', 'organic'], usage_count: 6 },
		'37': { name: 'Blueprint Technical', description: 'Product on engineer blueprint paper with technical drawings and precision tools.', category: '3D Print', tags: ['blueprint', 'technical', 'engineering', 'precision'], usage_count: 5 },
		'38': { name: 'Gradient Pedestal', description: 'Product elevated on cylindrical pedestal against smooth gradient backdrop.', category: '3D Print', tags: ['gradient', 'pedestal', 'premium', 'display'], usage_count: 11 }
	};

	// Build full preset object from seed data
	function getSeedPreset(id: string) {
		const seed = seedPresetData[id];
		if (!seed) return null;
		return {
			preset_id: id,
			...seed,
			thumbnail_url: `/preset-thumbnails/${id}.jpg`,
			created_at: '2025-11-15T10:00:00Z',
			updated_at: '2026-01-10T15:30:00Z',
			user_id: 'swiftlist-team',
			is_public: true,
			profiles: {
				display_name: 'SwiftList Team',
				avatar_url: '/logos/swiftlist-s-mark.svg'
			}
		};
	}

	const preset = $derived(serverPreset || (presetId ? getSeedPreset(presetId) : null));
	const isOwner = $derived(false); // TODO: check against current user

	// Seed presets (numeric IDs 1-38) have local thumbnails at /preset-thumbnails/{id}.jpg
	const isSeedPreset = $derived(presetId && /^\d+$/.test(presetId) && Number(presetId) >= 1 && Number(presetId) <= 38);
	const thumbnailSrc = $derived(
		preset?.thumbnail_url
			? preset.thumbnail_url
			: isSeedPreset
				? `/preset-thumbnails/${presetId}.jpg`
				: null
	);

	// Absolute URL for OG/Twitter meta tags (social crawlers need full URLs)
	const ogImageUrl = $derived(
		thumbnailSrc
			? thumbnailSrc.startsWith('http')
				? thumbnailSrc
				: `https://swiftlist.app${thumbnailSrc}`
			: null
	);

	// Share URL
	const shareUrl = $derived($page.url.href);

	// Share helpers
	function shareOnTwitter() {
		if (!preset) return;
		const text = `Check out "${preset.name}" on SwiftList — a vibe for creating stunning product images!`;
		const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
		window.open(url, '_blank', 'width=550,height=420');
	}

	function shareViaEmail() {
		if (!preset) return;
		const subject = `Check out this vibe: ${preset.name} — SwiftList`;
		const body = `I found this great vibe on SwiftList!\n\n${preset.name}\n${preset.description || ''}\n\nCheck it out: ${shareUrl}`;
		window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			toastState.success('Link copied to clipboard!');
		} catch {
			toastState.error('Failed to copy link');
		}
	}

	function handleUsePreset() {
		if (!preset) return;
		// Match the params format that /jobs/new expects (same as listing page's handleUseVibe)
		const params = new URLSearchParams({
			preset: presetId || '',
			presetName: preset.name,
			presetCreator: preset.profiles?.display_name || 'SwiftList Team',
			presetCreatorId: preset.user_id || '',
			presetThumbnail: preset.thumbnail_url || '',
			stylePrompt: preset.description || ''
		});
		goto(`/jobs/new?${params.toString()}`);
	}

	function handleEdit() {
		alert('Edit functionality coming soon!');
	}

	function handleDelete() {
		if (confirm('Are you sure you want to delete this preset?')) {
			alert('Delete functionality coming soon!');
			goto('/presets');
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{preset?.name || 'Preset'} — SwiftList</title>
	<meta name="description" content={preset?.description || 'A SwiftList vibe for creating stunning product images.'} />

	<!-- Open Graph (Facebook, LinkedIn, iMessage, etc.) -->
	<meta property="og:title" content="{preset?.name || 'Preset'} — SwiftList Vibes" />
	<meta property="og:description" content={preset?.description || 'Create stunning product images with this SwiftList vibe.'} />
	<meta property="og:url" content={shareUrl} />
	<meta property="og:type" content="website" />
	{#if ogImageUrl}
		<meta property="og:image" content={ogImageUrl} />
		<meta property="og:image:width" content="1344" />
		<meta property="og:image:height" content="768" />
		<meta property="og:image:type" content={ogImageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg'} />
	{/if}
	<meta property="og:site_name" content="SwiftList" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={ogImageUrl ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:site" content="@SwiftList_Scout" />
	<meta name="twitter:title" content="{preset?.name || 'Preset'} — SwiftList Vibes" />
	<meta name="twitter:description" content={preset?.description || 'Create stunning product images with this SwiftList vibe.'} />
	{#if ogImageUrl}
		<meta name="twitter:image" content={ogImageUrl} />
	{/if}
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "CreativeWork",
		"name": preset?.name || "Preset",
		"description": preset?.description || "A SwiftList vibe for creating stunning product images.",
		"url": shareUrl,
		"image": ogImageUrl || undefined,
		"creator": {
			"@type": "Person",
			"name": preset?.profiles?.display_name || "SwiftList User"
		},
		"dateCreated": preset?.created_at,
		"dateModified": preset?.updated_at || preset?.created_at,
		"interactionStatistic": {
			"@type": "InteractionCounter",
			"interactionType": "https://schema.org/UseAction",
			"userInteractionCount": preset?.usage_count || 0
		},
		"isPartOf": {
			"@type": "WebSite",
			"name": "SwiftList",
			"url": "https://swiftlist.app"
		}
	})}</script>`}
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

			{#if !preset}
				<div class="text-center py-20">
					<span class="material-symbols-outlined text-6xl text-gray-300 mb-4">search_off</span>
					<h2 class="text-2xl font-bold text-[#2C3E50] mb-2">Preset not found</h2>
					<p class="text-[#4B5563] mb-6">This vibe doesn't exist or may have been removed.</p>
					<button onclick={() => goto('/presets')} class="bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 px-6 rounded-lg">
						Browse All Vibes
					</button>
				</div>
			{:else}
			<!-- Content -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
				<!-- Left Column: Preview Image -->
				<div class="space-y-6">
					<div class="bg-white rounded-xl overflow-hidden shadow-sm">
						<div class="aspect-square overflow-hidden">
							{#if thumbnailSrc}
								<img
									src={thumbnailSrc}
									alt={preset.name}
									class="w-full h-full object-cover"
								/>
							{:else}
								<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#00796B] to-[#004D40]">
									<span class="material-symbols-outlined text-8xl text-white/80">
										palette
									</span>
								</div>
							{/if}
						</div>
					</div>

					<!-- Stats Cards -->
					<div class="grid grid-cols-2 gap-4">
						<div class="bg-white rounded-xl p-6 shadow-sm text-center">
							<div class="flex items-center justify-center gap-2 mb-2">
								<span class="material-symbols-outlined text-[#00796B]">
									visibility
								</span>
								<span class="text-2xl font-bold text-[#2C3E50]">{preset.usage_count || 0}</span>
							</div>
							<p class="text-sm text-[#4B5563]">Times Used</p>
						</div>

						<div class="bg-white rounded-xl p-6 shadow-sm text-center">
							<div class="flex items-center justify-center gap-2 mb-2">
								<span class="material-symbols-outlined text-[#00796B]">
									{preset.is_public ? 'public' : 'lock'}
								</span>
								<span class="text-lg font-bold text-[#2C3E50]">
									{preset.is_public ? 'Public' : 'Private'}
								</span>
							</div>
							<p class="text-sm text-[#4B5563]">Visibility</p>
						</div>
					</div>
				</div>

				<!-- Right Column: Details -->
				<div class="space-y-6">
					<!-- Title and Category -->
					<div>
						{#if preset.category}
							<span class="inline-block px-3 py-1 text-sm font-medium bg-[#00796B]/10 text-[#00796B] rounded-full mb-4">
								{preset.category}
							</span>
						{/if}
						<h1 class="text-4xl font-bold text-[#2C3E50] mb-4">{preset.name}</h1>
						<p class="text-lg text-[#4B5563] leading-relaxed">
							{preset.description || 'No description provided.'}
						</p>
					</div>

					<!-- Creator Info -->
					<div class="bg-white rounded-xl p-6 shadow-sm">
						<div class="flex items-center gap-4">
							<div class="w-12 h-12 rounded-full bg-[#00796B]/10 flex items-center justify-center overflow-hidden">
								{#if preset.profiles?.avatar_url}
									<img src={preset.profiles.avatar_url} alt={preset.profiles.display_name} class="w-full h-full object-cover" />
								{:else}
									<span class="material-symbols-outlined text-[#00796B] text-2xl">
										person
									</span>
								{/if}
							</div>
							<div class="flex-1">
								<p class="text-sm text-[#4B5563] mb-1">Created by</p>
								<a
									href={`/profile/${preset.user_id}`}
									class="text-lg font-semibold text-[#2C3E50] hover:text-[#00796B] transition-colors"
								>
									{preset.profiles?.display_name || 'Unknown'}
								</a>
							</div>
						</div>
					</div>

					<!-- Tags -->
					{#if preset.tags && preset.tags.length > 0}
						<div>
							<h3 class="text-sm font-semibold text-[#4B5563] mb-3 uppercase tracking-wide">Tags</h3>
							<div class="flex flex-wrap gap-2">
								{#each preset.tags as tag}
									<span class="px-3 py-1 text-sm bg-[#F8F5F0] text-[#4B5563] rounded-lg font-medium">
										#{tag}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Dates -->
					<div class="text-sm text-[#4B5563] space-y-1">
						<p>Created: {formatDate(preset.created_at)}</p>
						{#if preset.updated_at}
							<p>Last updated: {formatDate(preset.updated_at)}</p>
						{/if}
					</div>

					<!-- Share Buttons -->
					<div>
						<h3 class="text-sm font-semibold text-[#4B5563] mb-3 uppercase tracking-wide">Share this Vibe</h3>
						<div class="flex flex-wrap gap-3">
							<button
								onclick={shareOnTwitter}
								class="flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
								</svg>
								<span>Post on X</span>
							</button>

							<button
								onclick={shareViaEmail}
								class="flex items-center gap-2 px-4 py-2.5 bg-[#4B5563] hover:bg-[#374151] text-white rounded-lg transition-colors text-sm font-medium"
							>
								<span class="material-symbols-outlined text-lg">email</span>
								<span>Email</span>
							</button>

							<button
								onclick={copyLink}
								class="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-[#2C3E50] border border-gray-200 rounded-lg transition-colors text-sm font-medium"
							>
								<span class="material-symbols-outlined text-lg">link</span>
								<span>Copy Link</span>
							</button>
						</div>
					</div>

					<!-- Action Buttons -->
					<div class="space-y-3 pt-6">
						<!-- Use Preset Button (Prominent CTA) -->
						<button
							onclick={handleUsePreset}
							class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
						>
							<span class="material-symbols-outlined text-xl">auto_awesome</span>
							<span class="text-lg">Use This Vibe</span>
						</button>

						<!-- Owner Actions -->
						{#if isOwner}
							<div class="grid grid-cols-2 gap-3">
								<button
									onclick={handleEdit}
									class="bg-white hover:bg-gray-50 text-[#2C3E50] font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 border border-gray-200"
								>
									<span class="material-symbols-outlined">edit</span>
									<span>Edit</span>
								</button>
								<button
									onclick={handleDelete}
									class="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
								>
									<span class="material-symbols-outlined">delete</span>
									<span>Delete</span>
								</button>
							</div>
						{/if}
					</div>

					<!-- Report (subtle, non-owner only) -->
					{#if !isOwner && !isSeedPreset && preset?.preset_id}
						<div class="pt-4 border-t border-gray-100 flex justify-end">
							<ReportButton presetId={preset.preset_id} />
						</div>
					{/if}
				</div>
			</div>
			{/if}
		</div>
	</main>
</div>
