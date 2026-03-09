<script lang="ts">
	/**
	 * Discover Preset Vibes - Svelte 5
	 * Marketplace for curated style presets + user-created public presets from DB
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';

	import OnboardingTour from '$lib/components/OnboardingTour.svelte';
	import { presetsTour } from '$lib/config/onboarding-tours';
	import { rankPresets, type ScoringContext } from '$lib/utils/preset-scoring';

	// Auth state from root layout server load
	let user = $derived($page.data.user);

	// Categories for filtering (aligned with 2026 marketplace trends)
	const categories = [
		{ id: 'trending', label: 'Trending', icon: 'trending_up' },
		{ id: 'jewelry', label: 'Jewelry', icon: null },
		{ id: 'vintage', label: 'Vintage', icon: null },
		{ id: 'fashion', label: 'Fashion', icon: null },
		{ id: 'home', label: 'Home', icon: null },
		{ id: '3d-print', label: '3D Print', icon: null }
	];

	let selectedCategory = $state('trending');
	let searchQuery = $state('');

	// Track favorited presets (by preset_id UUID from database)
	let favoritedPresets = $state<Set<string>>(new Set());

	// Map seed preset names → DB preset_id (populated after ensure calls or community fetch)
	let seedToDbId = $state<Map<string, string>>(new Map());

	// Community presets fetched from the database
	let communityPresets = $state<NormalizedPreset[]>([]);
	let loadingCommunity = $state(true);

	// Followed creators
	let followedUserIds = $state<Set<string>>(new Set());

	// Load followed creators
	async function loadFollowedCreators() {
		try {
			const response = await fetch('/api/follows');
			if (!response.ok) return;
			const result = await response.json();
			if (result.success && result.data) {
				followedUserIds = new Set(result.data.map((f: any) => f.following_id as string));
			}
		} catch {
			// Not logged in or network error
		}
	}

	// Derived: presets from followed creators
	let followedPresets = $derived(
		communityPresets.filter((p) => p.creatorId && followedUserIds.has(p.creatorId))
	);

	// Load user's favorites from API
	async function loadUserFavorites() {
		try {
			const response = await fetch('/api/favorites');
			if (!response.ok) return; // Not logged in or error — skip silently
			const result = await response.json();
			if (result.success && result.data) {
				const ids = result.data.map((f: any) => f.preset_id as string);
				favoritedPresets = new Set(ids);
			}
		} catch {
			// Not logged in or network error — favorites won't be loaded
		}
	}

	// Normalized preset shape used by the UI
	interface NormalizedPreset {
		id: string | number;
		name: string;
		creator: { name: string; avatar: string | null };
		creatorId?: string; // user_id of the preset creator (for Sparks tracking)
		thumbnail: string;
		usageCount: number;
		category: string;
		badge: string | null;
		backgroundColor: string;
		stylePrompt: string;
		source: 'seed' | 'community';
		presetId?: string; // DB preset_id for community presets
		createdAt?: string; // ISO date string for recency scoring
		trustScore?: number; // Creator trust score (0-100)
		favoritesCount?: number; // Count of user_favorites for this preset
		creatorAccountAge?: number; // Days since creator account creation
	}

	// Map DB category names to our filter category IDs
	function mapCategoryToFilter(dbCategory: string): string {
		const map: Record<string, string> = {
			Jewelry: 'jewelry',
			Vintage: 'vintage',
			Fashion: 'fashion',
			Furniture: 'home',
			'Eco-Friendly': 'home',
			Minimalist: 'home',
			Tech: 'trending',
			'3D Print': '3d-print'
		};
		return map[dbCategory] || 'trending';
	}

	// Default background colors by category
	function getDefaultBgColor(category: string): string {
		const colors: Record<string, string> = {
			Jewelry: '#C9A0DC',
			Vintage: '#B8A99A',
			Fashion: '#4A5A6A',
			Furniture: '#D4C5B9',
			'Eco-Friendly': '#95D5B2',
			Minimalist: '#E8D7C3',
			Tech: '#2C3E50',
			'3D Print': '#6C63FF'
		};
		return colors[category] || '#8B7D6B';
	}

	// Fetch community presets from the API
	async function fetchCommunityPresets() {
		try {
			const response = await fetch('/api/presets?limit=50');
			if (!response.ok) return;

			const result = await response.json();
			if (result.success && result.data) {
				communityPresets = result.data.map(
					(p: any): NormalizedPreset => {
						// Calculate creator account age in days
						const creatorCreatedAt = p.profiles?.created_at;
						const creatorAccountAge = creatorCreatedAt
							? (Date.now() - new Date(creatorCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
							: undefined;

						return {
							id: p.preset_id,
							name: p.name,
							creator: {
								name: p.profiles?.display_name || 'Community Creator',
								avatar: p.profiles?.avatar_url || null
							},
							creatorId: p.user_id || '',
							thumbnail: p.thumbnail_url || '',
							usageCount: p.usage_count || 0,
							category: mapCategoryToFilter(p.category),
							badge: null,
							backgroundColor: getDefaultBgColor(p.category),
							stylePrompt: p.preset_config?.ai_prompt || p.description || '',
							source: 'community',
							presetId: p.preset_id,
							createdAt: p.created_at,
							trustScore: p.profiles?.trust_score ?? 0,
							favoritesCount: p.favorites_count ?? 0,
							creatorAccountAge
						};
					}
				);

				// Populate seed-to-DB-id mapping for any community presets that match seed names
				const seedNameSet = new Set(presetVibes.map((p) => p.name.toLowerCase()));
				for (const cp of communityPresets) {
					if (seedNameSet.has(cp.name.toLowerCase()) && cp.presetId) {
						seedToDbId.set(cp.name.toLowerCase(), cp.presetId);
					}
				}
				seedToDbId = new Map(seedToDbId); // trigger reactivity
			}
		} catch {
			// Silently fail - seed presets still display
		} finally {
			loadingCommunity = false;
		}
	}

	onMount(() => {
		fetchCommunityPresets();
		loadUserFavorites();
		loadFollowedCreators();
	});

	// SwiftList Preset Vibes Library - 30 Curated Presets (2026 Trends)
	// All presets created by SwiftList Team and FREE to use
	const presetVibes = [
		// ==================== JEWELRY PRESETS (8) ====================
		{
			id: 1,
			name: 'Patina Blue Bohemian',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'patina-blue-bohemian',
			usageCount: 9,
			category: 'jewelry',
			badge: null,
			backgroundColor: '#5B9AA0', // Patina blue
			stylePrompt: 'Bohemian jewelry display on weathered turquoise painted wood surface with natural patina texture, dried wildflowers and vintage lace fabric draped around, soft diffused natural window light from upper left at 45 degrees, warm golden afternoon tones with 3500K color temperature, shallow depth of field with gentle bokeh, boho lifestyle aesthetic with organic materials, artisan handmade feel, professional product photography'
		},
		{
			id: 2,
			name: 'Heritage Heirloom',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'heritage-heirloom',
			usageCount: 2,
			category: 'jewelry',
			badge: null,
			backgroundColor: '#8B7355', // Antique gold/bronze
			stylePrompt: 'Antique jewelry on aged velvet cushion with rich burgundy tones, ornate vintage jewelry box with brass hardware in background, soft overhead museum lighting at 80 degree elevation, warm 3200K color temperature with subtle shadows, medium depth of field capturing intricate details, heritage and heirloom aesthetic with Old World elegance, Victorian-inspired styling, premium editorial photography'
		},
		{
			id: 3,
			name: 'Raw Crystal Energy',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'raw-crystal-energy',
			usageCount: 7,
			category: 'jewelry',
			badge: null,
			backgroundColor: '#A47FB3', // Amethyst purple
			stylePrompt: 'Crystal jewelry displayed on raw amethyst geode cluster with natural druzy texture, white sage bundle and palo santo wood nearby, diffused natural sunlight from right side at 60 degrees creating soft prismatic reflections, cool 6000K daylight color temperature, shallow depth of field with dreamy bokeh, spiritual and metaphysical aesthetic, healing energy vibe, mystical lifestyle photography with ethereal quality'
		},
		{
			id: 4,
			name: 'Minimalist Luxe',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'minimalist-luxe',
			usageCount: 11,
			category: 'jewelry',
			badge: null,
			backgroundColor: '#E8D7C3', // Warm beige
			stylePrompt: 'Luxury jewelry on polished white Carrara marble surface with subtle gold veining, clean minimal composition with negative space, soft overhead studio lighting at 75 degrees with gentle shadows, neutral 5500K color temperature, deep depth of field keeping everything crisp, premium editorial aesthetic with Scandinavian minimalism, high-end fashion photography, sophisticated and refined'
		},
		{
			id: 5,
			name: 'Cottagecore Romance',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'cottagecore-romance',
			usageCount: 8,
			category: 'jewelry',
			badge: null,
			backgroundColor: '#F5C9D3', // Soft pink
			stylePrompt: 'Delicate jewelry on vintage lace doily over distressed white-painted wood, pink garden roses and baby\'s breath flowers scattered around, soft diffused morning light from left at 35 degrees through sheer curtains, warm 4000K color temperature with peachy glow, shallow depth of field with romantic bokeh, cottagecore and countryside aesthetic, whimsical and feminine, nostalgic lifestyle photography'
		},
		{
			id: 6,
			name: 'Gothic Luxe',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'gothic-luxe',
			usageCount: 4,
			category: 'jewelry',
			badge: null,
			backgroundColor: '#1A1A2E', // Dark gothic
			stylePrompt: 'Dark jewelry on black velvet with deep folds, ornate silver candelabra with dripping wax in background, dramatic side lighting from left at 25 degrees creating strong shadows, cool 6500K color temperature with moody atmosphere, medium depth of field isolating subject, gothic and Victorian dark romantic aesthetic, mysterious and luxurious, dramatic fashion photography with high contrast'
		},
		{
			id: 7,
			name: 'Coastal Seaglass',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'coastal-seaglass',
			usageCount: 6,
			category: 'jewelry',
			badge: null,
			backgroundColor: '#85C1D8', // Sea glass blue
			stylePrompt: 'Beach-inspired jewelry on smooth driftwood piece with weathered gray patina, real seaglass and small seashells arranged nearby, soft natural beach light from right at 50 degrees with coastal breeze feel, cool 6500K overcast daylight color temperature, shallow depth of field with soft background blur, coastal and nautical aesthetic, ocean-inspired lifestyle, fresh and airy photography with aqua tones'
		},
		{
			id: 8,
			name: 'Birthstone Personalized',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'birthstone-personalized',
			usageCount: 8,
			category: 'jewelry',
			badge: null,
			backgroundColor: '#C9A0DC', // Multi-gem purple
			stylePrompt: 'Gemstone jewelry on iridescent mother-of-pearl dish reflecting rainbow colors, birthstone chart and astrology symbols subtly visible in background, soft overhead diffused lighting at 70 degrees highlighting gem facets, neutral 5500K color temperature with prismatic highlights, medium depth of field keeping gems sharp, personalized and meaningful aesthetic, celestial and astrological vibe, premium lifestyle photography with gem focus'
		},

		// ==================== VINTAGE/ANTIQUE PRESETS (7) ====================
		{
			id: 9,
			name: 'Pyrex Paradise',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'pyrex-paradise',
			usageCount: 10,
			category: 'vintage',
			badge: null,
			backgroundColor: '#F4A460', // Retro orange
			stylePrompt: 'Vintage Pyrex dishware on retro 1960s Formica countertop with burnt orange and avocado green pattern, vintage kitchen towel with geometric print draped nearby, bright overhead kitchen lighting at 85 degrees mimicking mid-century fixtures, warm 4200K color temperature with nostalgic glow, medium depth of field, retro Americana aesthetic with atomic age vibes, cheerful and nostalgic, vintage lifestyle photography'
		},
		{
			id: 10,
			name: 'Murano Magic',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'murano-magic',
			usageCount: 6,
			category: 'vintage',
			badge: null,
			backgroundColor: '#D4145A', // Vibrant Italian glass
			stylePrompt: 'Murano glass art piece on glossy black lacquer surface reflecting vibrant colors, Venetian palazzo interior with ornate details softly blurred in background, dramatic side lighting from right at 40 degrees highlighting translucent glass, neutral 5500K studio color temperature with rich color saturation, shallow depth of field with bokeh, Italian luxury and artisan craftsmanship aesthetic, vibrant and sophisticated, high-end gallery photography'
		},
		{
			id: 11,
			name: 'Jadeite Glow',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'jadeite-glow',
			usageCount: 7,
			category: 'vintage',
			badge: null,
			backgroundColor: '#95D5B2', // Jadeite green
			stylePrompt: 'Jadeite dishware on vintage white enamelware table with mint green trim, 1940s kitchen setting with checkered tablecloth, soft natural window light from left at 45 degrees creating gentle highlights on glossy glaze, warm 4500K morning light color temperature, medium depth of field, Depression-era nostalgia aesthetic with farmhouse charm, collectible and treasured feel, warm vintage lifestyle photography with jade glow'
		},
		{
			id: 12,
			name: 'Art Deco Elegance',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'art-deco-elegance',
			usageCount: 10,
			category: 'vintage',
			badge: null,
			backgroundColor: '#C9A227', // Gold Art Deco
			stylePrompt: 'Art Deco object on black and gold geometric marble surface with zigzag pattern, 1920s Gatsby-era interior with brass accents and mirror in background, dramatic overhead lighting at 80 degrees creating symmetrical shadows, warm 3800K tungsten color temperature with golden glow, medium depth of field, Jazz Age luxury and geometric design aesthetic, glamorous and opulent, high-contrast vintage photography with Art Deco sophistication'
		},
		{
			id: 13,
			name: 'Farmhouse Finds',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'farmhouse-finds',
			usageCount: 9,
			category: 'vintage',
			badge: null,
			backgroundColor: '#8B7D6B', // Chippy paint beige
			stylePrompt: 'Vintage farmhouse item on distressed chippy paint wood table in cream and sage green, mason jars and cotton stems in galvanized bucket nearby, soft diffused natural light from window at 55 degrees, warm 4200K color temperature with cozy glow, shallow depth of field, rustic farmhouse and fixer-upper aesthetic, Americana and country living vibe, warm lifestyle photography with lived-in charm'
		},
		{
			id: 14,
			name: 'Mid-Century Swung Vase',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'mid-century-swung-vase',
			usageCount: 4,
			category: 'vintage',
			badge: null,
			backgroundColor: '#E07A5F', // MCM coral
			stylePrompt: 'Mid-century modern glass vase on teak credenza with tapered legs, Eames era interior with starburst clock and abstract art in background, angled natural light from upper right at 60 degrees creating long shadows, warm 4800K afternoon color temperature, medium depth of field, atomic age and MCM aesthetic with clean lines, sophisticated and retro-modern, architectural photography with 1950s Palm Springs vibe'
		},
		{
			id: 15,
			name: 'Châteaucore Antique',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'chateaucore-antique',
			usageCount: 5,
			category: 'vintage',
			badge: null,
			backgroundColor: '#B8A99A', // French linen
			stylePrompt: 'French antique on aged limestone pedestal with weathered patina, château interior with faded frescoes and aged gilt frames in background, soft diffused natural light from tall arched window at left 50 degrees, neutral 5200K overcast daylight color temperature, shallow depth of field with romantic blur, European grandeur and old-world elegance aesthetic, aristocratic and timeless, fine art photography with château romance'
		},

		// ==================== FASHION/POSHMARK PRESETS (8) ====================
		{
			id: 16,
			name: 'Lululemon Luxe Athleisure',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'lululemon-luxe-athleisure',
			usageCount: 11,
			category: 'fashion',
			badge: null,
			backgroundColor: '#2C3E50', // Premium activewear navy
			stylePrompt: 'Premium athleisure apparel on clean white yoga mat with minimalist gym equipment softly visible in background, modern fitness studio with floor-to-ceiling windows, bright natural daylight from right at 65 degrees creating crisp shadows, cool 6000K morning light color temperature, medium depth of field, active lifestyle and wellness aesthetic, motivational and aspirational, high-end fitness photography with studio polish'
		},
		{
			id: 17,
			name: 'Y2K Revival',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'y2k-revival',
			usageCount: 4,
			category: 'fashion',
			badge: null,
			backgroundColor: '#FF6B9D', // Y2K hot pink
			stylePrompt: 'Early 2000s fashion item on iridescent holographic surface with butterfly clips and flip phone accessories nearby, nostalgic bedroom setting with Lisa Frank stickers and lava lamp in background, bright overhead lighting at 75 degrees with vibrant saturation, cool 5800K color temperature with neon pop, shallow depth of field, Y2K and cyber-grunge aesthetic, playful and nostalgic, bold fashion photography with maximum color'
		},
		{
			id: 18,
			name: 'Luxury Designer Authenticated',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'luxury-designer-authenticated',
			usageCount: 1,
			category: 'fashion',
			badge: null,
			backgroundColor: '#1C1C1C', // Luxury black
			stylePrompt: 'Designer fashion piece on black velvet display cushion in luxury boutique setting, high-end retail interior with marble floors and gold accents in background, dramatic focused spotlight from above at 85 degrees, neutral 5500K studio color temperature with rich blacks, medium depth of field isolating product, haute couture and luxury fashion aesthetic, sophisticated and premium, editorial fashion photography with museum-quality lighting'
		},
		{
			id: 19,
			name: 'Vintage Band Tee',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'vintage-band-tee',
			usageCount: 7,
			category: 'fashion',
			badge: null,
			backgroundColor: '#3D3D3D', // Faded black
			stylePrompt: 'Vintage concert t-shirt hanging on a wooden hanger against a simple neutral wall, the shirt faces directly toward the camera with the full front graphic clearly visible, sleeves hanging naturally at the sides showing the garment silhouette, shot straight-on at chest height, clean uncluttered background with soft shallow depth of field, moody side lighting from left at 35 degrees creating subtle texture shadows on the fabric weave, warm 4000K tungsten color temperature, rock and roll aesthetic, authentic and nostalgic, commercial product photography with vintage character'
		},
		{
			id: 20,
			name: 'Cottagecore Dress',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'cottagecore-dress',
			usageCount: 10,
			category: 'fashion',
			badge: null,
			backgroundColor: '#E8B4B8', // Prairie floral
			stylePrompt: 'Floral cottagecore dress hanging on a wooden hanger in a lush garden setting, the dress faces directly toward the camera with the full front pattern and details clearly visible, garment hangs naturally showing its flowing silhouette and delicate fabric drape, vibrant wildflowers and greenery fill the background with a woven basket of fresh flowers nearby, soft diffused natural light from left at 45 degrees creating a dreamy golden glow, warm 4500K golden hour color temperature, shallow depth of field with romantic bokeh on garden background, countryside pastoral aesthetic, whimsical and romantic, lifestyle fashion photography with fairytale storybook quality'
		},
		{
			id: 21,
			name: 'Flared Jean Revival',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'flared-jean-revival',
			usageCount: 6,
			category: 'fashion',
			badge: null,
			backgroundColor: '#4A5A6A', // Denim blue
			stylePrompt: 'Flared denim jeans laid flat on a clean white surface, shot from directly above looking straight down, the jeans are neatly spread out showing their full shape and flared leg silhouette, only the single garment in the frame with no other items or accessories, bright even overhead lighting eliminating shadows, neutral 5200K daylight color temperature, deep depth of field keeping the garment crisp, 1970s revival aesthetic, effortlessly cool and minimal, overhead flat-lay fashion photography with clean editorial styling'
		},
		{
			id: 22,
			name: 'Graphic Tee Statement',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'graphic-tee-statement',
			usageCount: 10,
			category: 'fashion',
			badge: null,
			backgroundColor: '#F4F4F4', // Clean white
			stylePrompt: 'Statement graphic t-shirt laid flat on a neutral gray surface, the shirt is spread out neatly with full front graphic prominently visible, only the single garment in the frame with no other items or accessories, shot from directly above looking straight down, bright even overhead lighting at 80 degrees eliminating harsh shadows, neutral 5500K daylight color temperature, deep depth of field keeping the graphic crisp, streetwear aesthetic, bold and contemporary, overhead flat-lay fashion photography with clean commercial styling'
		},
		{
			id: 23,
			name: 'Reusable Tumbler Aesthetic',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'reusable-tumbler-aesthetic',
			usageCount: 6,
			category: 'fashion',
			badge: null,
			backgroundColor: '#D4A5A5', // Dusty rose
			stylePrompt: 'Insulated tumbler on car cup holder console with cozy car accessories like fuzzy steering wheel cover visible, road trip aesthetic with scenic highway visible through windshield, natural daylight from windshield at 60 degrees, warm 5000K midday color temperature, shallow depth of field blurring background scenery, everyday carry and wellness lifestyle aesthetic, relatable and aspirational, lifestyle photography with on-the-go energy'
		},

		// ==================== HOME/FURNITURE PRESETS (7) ====================
		{
			id: 24,
			name: 'Washed Linen Texture',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'washed-linen-texture',
			usageCount: 6,
			category: 'home',
			badge: null,
			backgroundColor: '#D4C5B9', // Natural linen
			stylePrompt: 'Home décor item on natural linen fabric with visible weave texture and organic wrinkles, soft neutral bedding or upholstered furniture in background, diffused natural morning light from window at left 40 degrees, warm 4800K color temperature with gentle glow, shallow depth of field emphasizing textile texture, Scandinavian minimalism and organic modern aesthetic, serene and tactile, lifestyle photography with natural fabric focus and wabi-sabi imperfection'
		},
		{
			id: 25,
			name: 'Curved & Cozy',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'curved-cozy',
			usageCount: 4,
			category: 'home',
			badge: null,
			backgroundColor: '#B8A99A', // Warm minimalism
			stylePrompt: 'Home object on curved boucle upholstered furniture with soft rounded edges, cozy modern living room with arched doorway and organic shapes in background, warm ambient lighting from floor lamp at 55 degrees creating soft pools of light, warm 3800K evening color temperature, shallow depth of field with inviting blur, hygge and warm minimalism aesthetic, comforting and sophisticated, interior design photography with soft curves and cozy textures'
		},
		{
			id: 26,
			name: 'Dopamine Décor',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'dopamine-decor',
			usageCount: 11,
			category: 'home',
			badge: null,
			backgroundColor: '#FFD700', // Bright joy yellow
			stylePrompt: 'Colorful home décor on bright yellow painted shelf with bold pattern wallpaper background, maximalist interior with mix of vibrant colors and eclectic accessories, bright overhead lighting at 75 degrees enhancing color saturation, cool 5800K daylight color temperature with energetic feel, medium depth of field, joyful maximalism and dopamine décor aesthetic, playful and uplifting, interior photography with bold color blocks and cheerful energy'
		},
		{
			id: 27,
			name: 'Heritage Wood Paneling',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'heritage-wood-paneling',
			usageCount: 10,
			category: 'home',
			badge: null,
			backgroundColor: '#8B6F47', // Rich oak
			stylePrompt: 'Home furnishing against rich oak wood paneling with vertical grooves and natural grain, traditional craftsman interior with built-in shelving and leather-bound books in background, warm side lighting from brass sconce at 45 degrees highlighting wood grain, warm 3500K tungsten color temperature, medium depth of field, heritage craftsman and modern traditional aesthetic, timeless and refined, architectural photography with wood warmth and classic detailing'
		},
		{
			id: 28,
			name: 'Rattan & Natural Texture',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'rattan-natural-texture',
			usageCount: 11,
			category: 'home',
			badge: null,
			backgroundColor: '#C9A66B', // Woven rattan
			stylePrompt: 'Home accessory on woven rattan tray with visible texture and natural fibers, coastal or tropical-inspired interior with houseplants and bamboo blinds in background, filtered natural sunlight from right at 55 degrees creating dappled patterns, neutral 5200K midday color temperature, shallow depth of field, natural and organic coastal aesthetic, breezy and relaxed, lifestyle photography with tropical resort vibes and textural warmth'
		},
		{
			id: 29,
			name: 'Cloud Dancer Neutrals',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'cloud-dancer-neutrals',
			usageCount: 9,
			category: 'home',
			badge: null,
			backgroundColor: '#E5DCC3', // Soft khaki
			stylePrompt: 'Home décor piece on soft khaki upholstered surface with tonal layering of creams and taupes, serene neutral bedroom or living room with flowing sheer curtains in background, gentle diffused natural light from above at 70 degrees, warm 5000K color temperature with soft glow, shallow depth of field creating dreamy atmosphere, tranquil minimalism and monochromatic aesthetic, peaceful and elegant, fine art photography with cloud-like softness and tonal harmony'
		},
		{
			id: 30,
			name: 'Perfectly Imperfect Handmade',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'perfectly-imperfect-handmade',
			usageCount: 10,
			category: 'home',
			badge: null,
			backgroundColor: '#D9C6B0', // Artisan clay
			stylePrompt: 'Handmade artisan item on raw clay surface with visible fingerprints and organic irregularities, pottery studio or maker space with artisan tools and work in progress in background, warm natural light from window at left 45 degrees highlighting texture and imperfections, warm 4200K afternoon color temperature, shallow depth of field emphasizing handcrafted details, wabi-sabi and artisan maker aesthetic, authentic and human-centered, documentary-style photography celebrating imperfection and craft'
		},
		// ── 3D Print (4 presets) ──────────────────────────────
		{
			id: 31,
			name: 'Maker Workshop',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'maker-workshop',
			usageCount: 9,
			category: '3d-print',
			badge: null,
			backgroundColor: '#6C63FF', // Tech purple
			stylePrompt: 'Product on wooden workbench in maker workshop with colorful filament spools and 3D printer visible in soft-focus background, warm overhead LED panel lighting at 5500K with subtle side fill from monitor glow, shallow depth of field keeping product sharp against blurred workshop tools, maker movement and DIY aesthetic with organized creative chaos, authentic and inventive, editorial product photography with warm industrial atmosphere'
		},
		{
			id: 32,
			name: 'Resin Display',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'resin-display',
			usageCount: 3,
			category: '3d-print',
			badge: null,
			backgroundColor: '#7C4DFF', // Deep violet
			stylePrompt: 'Translucent resin print on clean matte gradient backdrop transitioning from white to soft lavender, single UV-spectrum accent light from above creating subtle internal glow effect, smooth reflective surface beneath product with gentle mirror reflection, ultra-clean minimal composition with generous negative space, premium tech-art aesthetic, sophisticated and futuristic, high-end product photography with crystalline clarity and studio precision'
		},
		{
			id: 33,
			name: 'Tabletop Miniature',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'tabletop-miniature',
			usageCount: 8,
			category: '3d-print',
			badge: null,
			backgroundColor: '#455A64', // Slate gray
			stylePrompt: 'Painted miniature figure on textured stone dungeon base with dice and character sheet softly blurred in background, dramatic directional warm spotlight from upper left at 35 degrees with cool blue rim light from behind, macro lens perspective with extremely shallow depth of field, tabletop gaming and fantasy RPG aesthetic, epic and detailed, miniature photography with cinematic dramatic lighting and rich atmosphere'
		},
		{
			id: 34,
			name: 'Functional Print Showcase',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'functional-print-showcase',
			usageCount: 7,
			category: '3d-print',
			badge: null,
			backgroundColor: '#26A69A', // Teal green
			stylePrompt: 'Practical 3D printed product centered on pure white seamless backdrop with soft even studio lighting from three-point setup, clean hard shadow beneath for grounding, product rotated slightly at 15 degrees showing functional details and layer lines as design feature, bright 6000K daylight color temperature, deep depth of field keeping entire product sharp, clean commercial e-commerce aesthetic, professional and trustworthy, Amazon-style product photography with pristine white background and precise exposure'
		},
		{
			id: 35,
			name: 'Neon Cyber Display',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'neon-cyber-display',
			usageCount: 1,
			category: '3d-print',
			badge: 'new',
			backgroundColor: '#E040FB', // Neon magenta
			stylePrompt: 'Product on dark matte black surface with vivid neon magenta and cyan LED strip lighting from edges creating dramatic color spill and reflections, dark moody background with subtle geometric grid pattern suggesting cyberpunk cityscape, strong rim lighting outlining product silhouette against darkness, futuristic sci-fi aesthetic with synthwave color palette, bold and electric, editorial tech photography with high-contrast neon accent lighting and deep shadows'
		},
		{
			id: 36,
			name: 'Nature Integration',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'nature-integration',
			usageCount: 11,
			category: '3d-print',
			badge: 'new',
			backgroundColor: '#4CAF50', // Forest green
			stylePrompt: 'Product nestled among real moss and small ferns on a natural stone surface, soft diffused daylight filtering through leaves creating dappled light patterns, shallow depth of field with bokeh of green foliage in background, organic textures contrasting with geometric printed form, biophilic design aesthetic celebrating technology meeting nature, serene and harmonious, lifestyle product photography with natural woodland atmosphere and warm golden hour tones'
		},
		{
			id: 37,
			name: 'Blueprint Technical',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'blueprint-technical',
			usageCount: 3,
			category: '3d-print',
			badge: null,
			backgroundColor: '#1565C0', // Blueprint blue
			stylePrompt: 'Product photographed from 45-degree angle on engineer blueprint paper with technical drawings and CAD sketches visible beneath, cool overhead fluorescent studio lighting with slight blue cast, calipers and precision tools arranged intentionally in composition, sharp focus throughout with f/11 aperture, engineering and maker aesthetic with emphasis on precision and craftsmanship, technical and authoritative, product documentation photography with clean informational layout'
		},
		{
			id: 38,
			name: 'Gradient Pedestal',
			creator: { name: 'SwiftList Team', avatar: '/logos/swiftlist-s-mark.svg' },
			thumbnail: 'gradient-pedestal',
			usageCount: 6,
			category: '3d-print',
			badge: 'trending',
			backgroundColor: '#FF6D00', // Vibrant orange
			stylePrompt: 'Product elevated on a clean cylindrical pedestal against a smooth gradient backdrop transitioning from warm coral to soft peach, even diffused studio lighting with no harsh shadows creating a premium floating effect, centered symmetrical composition with generous negative space above and below, smooth reflective surface on pedestal showing subtle product reflection, contemporary product display aesthetic inspired by Apple and industrial design showcases, sleek and aspirational, hero product photography with gradient studio backdrop and gallery-quality presentation'
		}
	];

	// Normalize seed presets to match NormalizedPreset shape
	const normalizedSeedPresets: NormalizedPreset[] = presetVibes.map((p) => ({
		...p,
		id: p.id,
		source: 'seed' as const
	}));

	// Combine seed + community presets, deduplicating by name
	// Prefer DB version (has presetId for favoriting) over hardcoded seed version
	function getAllPresets(): NormalizedPreset[] {
		const communityNames = new Set(communityPresets.map((p) => p.name.toLowerCase()));
		// Only include seed presets that DON'T have a DB counterpart
		const uniqueSeeds = normalizedSeedPresets.filter(
			(p) => !communityNames.has(p.name.toLowerCase())
		);
		// Community presets first (they have presetId), then remaining seeds
		return [...communityPresets, ...uniqueSeeds];
	}

	// Trending score: weighted algorithm balancing popularity, recency, and community engagement
	function getTrendingScore(preset: NormalizedPreset): number {
		// Usage score: log scale so 5000 uses isn't 50x better than 100
		const usageScore = Math.log10(Math.max(preset.usageCount, 1)) * 25;

		// Recency bonus: community presets get a boost if recently created
		let recencyScore = 0;
		if (preset.source === 'community' && preset.createdAt) {
			const ageInDays = (Date.now() - new Date(preset.createdAt).getTime()) / (1000 * 60 * 60 * 24);
			recencyScore = Math.max(0, 30 - ageInDays); // Up to 30pt boost for new presets, decays over 30 days
		}

		// Creator trust boost: replaces flat community boost with trust-weighted score
		const creatorTrustBoost = preset.source === 'community'
			? ((preset.trustScore || 0) / 100) * 30
			: 0;

		// Badge boost: editorially marked trending presets
		const badgeBoost = preset.badge === 'trending' ? 10 : 0;

		return usageScore + recencyScore + creatorTrustBoost + badgeBoost;
	}

	// Filter presets by category and search query
	function getFilteredPresets(): NormalizedPreset[] {
		const all = getAllPresets();
		let results: NormalizedPreset[];

		if (searchQuery.trim()) {
			// Search across ALL presets regardless of category
			const query = searchQuery.trim().toLowerCase();
			results = all.filter((p) =>
				p.name.toLowerCase().includes(query) ||
				p.stylePrompt.toLowerCase().includes(query) ||
				p.category.toLowerCase().includes(query)
			);
		} else if (selectedCategory === 'following') {
			results = all.filter((p) => p.creatorId && followedUserIds.has(p.creatorId));
		} else if (selectedCategory === 'trending') {
			// Use feed scoring algorithm: rank community presets by weighted score,
			// then append seed presets after all scored community presets
			const scoringContext: ScoringContext = {
				followedUserIds,
				currentUserId: user?.id ?? null
			};
			results = rankPresets(all, scoringContext);
		} else {
			results = all.filter((p) => p.category === selectedCategory);
		}

		return results;
	}

	// Sort trending presets with category diversity: avoid showing 8 jewelry presets in a row
	function sortWithCategoryDiversity(presets: NormalizedPreset[]): NormalizedPreset[] {
		// First, sort by raw trending score
		const scored = presets
			.map((p) => ({ preset: p, score: getTrendingScore(p) }))
			.sort((a, b) => b.score - a.score);

		// Then interleave categories: pick top-scored from each category in rounds
		const result: NormalizedPreset[] = [];
		const byCategory = new Map<string, typeof scored>();
		for (const item of scored) {
			const cat = item.preset.category;
			if (!byCategory.has(cat)) byCategory.set(cat, []);
			byCategory.get(cat)!.push(item);
		}

		// Round-robin: take the top item from each category, repeat
		let added = true;
		while (added) {
			added = false;
			for (const [, items] of byCategory) {
				if (items.length > 0) {
					result.push(items.shift()!.preset);
					added = true;
				}
			}
		}

		return result;
	}

	// Trending: only the top 5 presets by usage count earn the "Trending" badge.
	// This prevents every preset from showing "Trending" when most have high counts.
	let trendingIds = $derived.by(() => {
		const all = getAllPresets();
		const sorted = [...all].sort((a, b) => b.usageCount - a.usageCount);
		return new Set(sorted.slice(0, 5).map((p) => p.id));
	});

	function isTrending(preset: NormalizedPreset): boolean {
		return trendingIds.has(preset.id);
	}

	// New: community presets created within last 12 hours, or seed presets explicitly tagged 'new'
	function isNew(preset: NormalizedPreset): boolean {
		if (preset.badge === 'new') return true;
		if (preset.source === 'community' && preset.createdAt) {
			const ageMs = Date.now() - new Date(preset.createdAt).getTime();
			return ageMs < 12 * 60 * 60 * 1000; // 12 hours
		}
		return false;
	}

	// Map frontend category IDs back to DB category names (for seed preset ensure)
	function mapFilterToDbCategory(filterCategory: string): string {
		const map: Record<string, string> = {
			jewelry: 'Jewelry',
			vintage: 'Vintage',
			fashion: 'Fashion',
			home: 'Furniture',
			'3d-print': '3D Print'
		};
		return map[filterCategory] || 'Furniture';
	}

	// Resolve a preset's DB ID — community presets have it directly, seed presets may need lookup
	function resolveDbId(preset: NormalizedPreset): string | null {
		if (preset.presetId) return preset.presetId;
		if (preset.source === 'community') return String(preset.id);
		// Check if this seed preset has been ensured in the DB already
		return seedToDbId.get(preset.name.toLowerCase()) || null;
	}

	// Ensure a seed preset exists in the DB, returning its preset_id
	async function ensureSeedPreset(preset: NormalizedPreset): Promise<string | null> {
		// Already have a DB ID?
		const existingId = resolveDbId(preset);
		if (existingId) return existingId;

		try {
			// For seed presets, pass the static thumbnail path so the DB record has an image
			const thumbnailUrl =
				preset.source === 'seed' && typeof preset.id === 'number'
					? `/preset-thumbnails/${preset.id}.jpg`
					: undefined;

			const response = await fetch('/api/presets/ensure', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: preset.name,
					description: preset.stylePrompt?.substring(0, 200) || preset.name,
					category: mapFilterToDbCategory(preset.category),
					tags: [],
					stylePrompt: preset.stylePrompt || '',
					backgroundColor: preset.backgroundColor,
					thumbnailUrl
				})
			});

			if (!response.ok) return null;

			const result = await response.json();
			if (result.success && result.preset_id) {
				// Cache the mapping so future calls don't need another API call
				seedToDbId.set(preset.name.toLowerCase(), result.preset_id);
				seedToDbId = new Map(seedToDbId); // trigger reactivity
				return result.preset_id;
			}
		} catch {
			// Network error
		}
		return null;
	}

	// Toggle favorite — works for both community and seed presets
	async function toggleFavorite(preset: NormalizedPreset) {
		let dbId = resolveDbId(preset);

		// For seed presets without a DB ID, ensure it exists first
		if (!dbId && preset.source === 'seed') {
			dbId = await ensureSeedPreset(preset);
			if (!dbId) return; // Failed to create — silently abort
		}
		if (!dbId) return;

		const wasFavorited = favoritedPresets.has(dbId);

		// Optimistic UI update
		if (wasFavorited) {
			favoritedPresets.delete(dbId);
		} else {
			favoritedPresets.add(dbId);
		}
		favoritedPresets = new Set(favoritedPresets); // Trigger reactivity

		try {
			const response = await fetch('/api/favorites', {
				method: wasFavorited ? 'DELETE' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ preset_id: dbId })
			});

			if (!response.ok) {
				// Revert optimistic update on failure
				if (wasFavorited) {
					favoritedPresets.add(dbId);
				} else {
					favoritedPresets.delete(dbId);
				}
				favoritedPresets = new Set(favoritedPresets);
			}
		} catch {
			// Revert optimistic update on network error
			if (wasFavorited) {
				favoritedPresets.add(dbId);
			} else {
				favoritedPresets.delete(dbId);
			}
			favoritedPresets = new Set(favoritedPresets);
		}
	}

	// Check if preset is favorited (by DB preset_id)
	function isFavorited(preset: NormalizedPreset): boolean {
		const dbId = resolveDbId(preset);
		if (!dbId) return false;
		return favoritedPresets.has(dbId);
	}

	// Handle "Use this Vibe" button click
	function handleUseVibe(preset: NormalizedPreset) {
		// Auth guard: redirect unauthenticated users to signup
		if (!user) {
			goto('/auth/signup?next=/presets');
			return;
		}
		// Navigate to job creation with preset vibe params
		const params = new URLSearchParams({
			preset: preset.id.toString(),
			presetName: preset.name,
			presetCreator: preset.creator.name,
			presetCreatorId: preset.creatorId || '',
			presetThumbnail: preset.thumbnail,
			stylePrompt: preset.stylePrompt || '' // Pass style prompt for scene generation
		});
		goto(`/jobs/new?${params.toString()}`);
	}

	let filteredPresets = $derived(getFilteredPresets());
</script>

<svelte:head>
	<title>Discover Preset Vibes - SwiftList</title>
	<meta name="description" content="Browse curated AI image vibes for product photography. Find the perfect style for your Etsy, Shopify, or Amazon listings." />
	<link rel="canonical" href="https://swiftlist.app/presets" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"name": "Discover Preset Vibes",
		"description": "Browse curated AI image vibes for product photography. Find the perfect style for your e-commerce listings.",
		"url": "https://swiftlist.app/presets",
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
	<main class="ml-0 md:ml-[240px] flex-1">
		<div class="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
			<!-- Page Header -->
			<div class="mb-6 md:mb-8">
				<h1 class="text-[#2C3E50] font-bold text-2xl md:text-4xl mb-2">Discover Preset Vibes</h1>
				<p class="text-[#4B5563] text-base md:text-lg">Curated presets + community vibes for 2026 marketplace trends</p>
			</div>

			<!-- Category Filters + Search -->
			<div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 md:mb-8">
				<div class="flex flex-wrap items-center gap-2 md:gap-3">
					{#each categories as category}
						<button
							onclick={() => { selectedCategory = category.id; searchQuery = ''; }}
							class={`px-4 md:px-5 py-2 md:py-2.5 rounded-full font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
								selectedCategory === category.id && !searchQuery.trim()
									? 'bg-[#00796B] text-white'
									: 'bg-white text-[#4B5563] hover:bg-gray-50'
							}`}
						>
							{#if category.icon}
								<span class="material-symbols-outlined text-[18px]">{category.icon}</span>
							{/if}
							{category.label}
						</button>
					{/each}
				</div>
				<div class="sm:ml-auto relative">
					<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#9CA3AF] pointer-events-none">search</span>
					<input
						type="text"
						placeholder="Search vibes..."
						bind:value={searchQuery}
						class="w-full sm:w-56 md:w-64 pl-9 pr-8 py-2 md:py-2.5 rounded-full bg-white text-sm text-[#2C3E50] placeholder-[#9CA3AF] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00796B]/30 focus:border-[#00796B] transition-all duration-200"
					/>
					{#if searchQuery}
						<button
							onclick={() => (searchQuery = '')}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] transition-colors"
						>
							<span class="material-symbols-outlined text-[16px]">close</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- From Creators You Follow (horizontal scroll) -->
			{#if user && followedPresets.length > 0 && !searchQuery.trim()}
				<div class="mb-8">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-[#2C3E50] font-bold text-lg md:text-xl">From Creators You Follow</h2>
						<button
							onclick={() => { selectedCategory = 'following'; }}
							class="text-[#00796B] text-sm font-medium hover:underline"
						>
							See All
						</button>
					</div>
					<div class="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide">
						{#each followedPresets.slice(0, 10) as preset}
							<a
								href="/presets/{preset.presetId || preset.id}"
								class="flex-shrink-0 w-[280px] bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
							>
								<div class="relative aspect-video overflow-hidden bg-gray-100">
									{#if preset.thumbnail}
										<img src={preset.thumbnail} alt={preset.name} class="w-full h-full object-cover" loading="lazy" />
									{:else}
										<div class="w-full h-full flex items-center justify-center" style="background-color: {preset.backgroundColor}">
											<span class="material-symbols-outlined text-white/90 text-[36px]">palette</span>
										</div>
									{/if}
								</div>
								<div class="p-3">
									<h3 class="text-[#2C3E50] font-semibold text-sm truncate">{preset.name}</h3>
									<p class="text-[#4B5563] text-xs mt-1">{preset.creator.name}</p>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Preset Vibes Grid (Mobile-First Responsive) -->
			{#if loadingCommunity}
				<!-- Brief loading state while community presets load -->
			{/if}
			{#if searchQuery.trim() && filteredPresets.length === 0}
				<div class="text-center py-16">
					<span class="material-symbols-outlined text-[48px] text-[#9CA3AF] mb-3 block">search_off</span>
					<p class="text-[#4B5563] text-lg font-medium">No vibes found for "{searchQuery}"</p>
					<p class="text-[#9CA3AF] text-sm mt-1">Try a different search term or browse by category</p>
				</div>
			{/if}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
				{#each filteredPresets as preset}
					<a href="/presets/{preset.presetId || preset.id}" class="block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer">
						<!-- Thumbnail with Badge -->
						<div class="relative aspect-video overflow-hidden bg-gray-100">
							<!-- Preset thumbnail: seed presets use local files, community presets use URL or color fallback -->
							{#if preset.source === 'community' && preset.thumbnail}
								<img
									src={preset.thumbnail}
									alt={preset.name}
									class="w-full h-full object-cover"
									loading="lazy"
								/>
							{:else if preset.source === 'seed' && typeof preset.id === 'number' && preset.id <= 38}
								<img
									src="/preset-thumbnails/{preset.id}.jpg"
									alt={preset.name}
									class="w-full h-full object-cover"
									loading="lazy"
								/>
							{:else}
								<!-- Colored fallback for presets without thumbnail images -->
								<div
									class="w-full h-full flex items-center justify-center"
									style="background-color: {preset.backgroundColor}"
								>
									<div class="text-center text-white/90">
										<span class="material-symbols-outlined text-[48px]">palette</span>
										<p class="text-sm font-medium mt-1">{preset.name}</p>
									</div>
								</div>
							{/if}

							<!-- Badge (Trending, New, or Community) -->
							{#if preset.source === 'community'}
								<div class="absolute top-3 left-3 bg-[#00796B] px-3 py-1.5 rounded-full">
									<span class="text-white text-xs font-semibold">Community</span>
								</div>
							{:else if isTrending(preset)}
								<div
									class="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5"
								>
									<span class="material-symbols-outlined text-[#00796B] text-[16px]">trending_up</span>
									<span class="text-[#00796B] text-xs font-semibold">Trending</span>
								</div>
							{:else if isNew(preset)}
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
								<div class="flex items-center gap-1">
									<button
										onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(preset); }}
										class="p-1 hover:bg-gray-100 rounded-full transition-colors"
										aria-label={isFavorited(preset) ? 'Remove from favorites' : 'Add to favorites'}
									>
										<span
											class={`material-symbols-outlined text-[24px] transition-colors ${
												isFavorited(preset) ? 'text-red-500' : 'text-gray-400'
											}`}
											style={isFavorited(preset) ? 'font-variation-settings: "FILL" 1' : ''}
										>
											favorite
										</span>
									</button>
								</div>
							</div>

							<!-- Creator Info and Use Button -->
							<div class="flex items-center justify-between">
								<!-- Creator Avatar + Name (clickable to profile) -->
								{#if preset.source === 'community' && preset.creatorId}
									<a href="/profile/{preset.creatorId}" onclick={(e: MouseEvent) => e.stopPropagation()} class="flex items-center gap-2 hover:opacity-80 transition-opacity">
										<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
											{#if preset.creator.avatar}
												<img src={preset.creator.avatar} alt={preset.creator.name} class="w-full h-full object-cover" />
											{:else}
												<span class="material-symbols-outlined text-gray-400 text-[18px]">person</span>
											{/if}
										</div>
										<span class="text-[#4B5563] text-sm font-medium">{preset.creator.name}</span>
									</a>
								{:else}
									<div class="flex items-center gap-2">
										<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
											{#if preset.creator.avatar}
												<img src={preset.creator.avatar} alt={preset.creator.name} class="w-full h-full object-cover" />
											{:else}
												<span class="material-symbols-outlined text-gray-400 text-[18px]">person</span>
											{/if}
										</div>
										<span class="text-[#4B5563] text-sm font-medium">{preset.creator.name}</span>
									</div>
								{/if}

								<!-- Use this Vibe Button -->
								<button
											data-tour="preset-use-vibe"
									onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); handleUseVibe(preset); }}
									class="bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2 px-3 md:px-4 rounded-lg transition-all duration-200 text-xs md:text-sm whitespace-nowrap"
								>
									<span class="hidden sm:inline">Use this Vibe</span>
									<span class="sm:hidden">Use</span>
								</button>
							</div>
						</div>
					</a>
				{/each}
			</div>

			<!-- Results summary -->
			<div class="text-center py-12">
				<p class="text-[#4B5563] text-sm">
					{filteredPresets.length} preset vibes
					{#if communityPresets.length > 0}
						({communityPresets.length} from the community)
					{/if}
				</p>
			</div>
		</div>
	</main>
</div>

<OnboardingTour tourId="presets" steps={presetsTour} autoStart />
