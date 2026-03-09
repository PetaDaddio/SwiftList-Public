/**
 * Generate Preset Thumbnails with Replicate Flux Pro
 *
 * Generates 30 preset thumbnails showing styled product mockups
 * Using Replicate's Flux Pro model (photorealistic, fast, affordable)
 * Cost: ~$0.003/image × 30 = $0.09 total
 *
 * Note: Google Imagen 3 requires Vertex AI setup with GCP project.
 * Flux Pro via Replicate provides equivalent quality with simpler API.
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// PRESET DEFINITIONS (matching +page.svelte)
// ============================================================================

interface PresetDefinition {
	id: number;
	name: string;
	category: string;
	aesthetic: string;
	visualStyle: string;
	productExample: string; // What product to show in thumbnail
	photoStyle: string; // Photo styling from preset library
}

const presetDefinitions: PresetDefinition[] = [
	// ==================== JEWELRY PRESETS (8) ====================
	{
		id: 1,
		name: 'Patina Blue Bohemian',
		category: 'jewelry',
		aesthetic: "Etsy's 2026 Color of the Year - Patina Blue",
		visualStyle: 'Oxidized silver, turquoise accents, weathered textures',
		productExample: 'turquoise wire-wrapped bracelet',
		photoStyle: 'Moody blues, textured backgrounds, weathered wood'
	},
	{
		id: 2,
		name: 'Heritage Heirloom',
		category: 'jewelry',
		aesthetic: 'Nanna Chic - vintage jewelry with stories',
		visualStyle: 'Antique-inspired, ornate details, generational appeal',
		productExample: 'vintage-style locket necklace',
		photoStyle: 'Soft lighting, velvet boxes, family photo props'
	},
	{
		id: 3,
		name: 'Raw Crystal Energy',
		category: 'jewelry',
		aesthetic: 'Earthy, unpolished, metaphysical',
		visualStyle: 'Natural stones, rough textures, healing vibes',
		productExample: 'raw amethyst pendant on leather cord',
		photoStyle: 'Natural light, earthy backgrounds, in-hand shots'
	},
	{
		id: 4,
		name: 'Minimalist Luxe',
		category: 'jewelry',
		aesthetic: 'Warm minimalism - simple but textured',
		visualStyle: 'Clean lines with organic warmth',
		productExample: 'brushed gold geometric ring',
		photoStyle: 'Creamy beiges, soft khaki, clean composition with texture'
	},
	{
		id: 5,
		name: 'Cottagecore Romance',
		category: 'jewelry',
		aesthetic: 'Soft, floral, vintage-meets-handmade',
		visualStyle: 'Pressed flowers, delicate chains, garden-inspired',
		productExample: 'pressed flower resin pendant necklace',
		photoStyle: 'Soft pastels, linen textures, garden backgrounds'
	},
	{
		id: 6,
		name: 'Gothic Luxe',
		category: 'jewelry',
		aesthetic: 'Darkly romantic, richly layered (Gothmas)',
		visualStyle: 'Black gemstones, Victorian details, dramatic',
		productExample: 'black onyx Victorian-style ring',
		photoStyle: 'Moody lighting, dark backgrounds, rich textures'
	},
	{
		id: 7,
		name: 'Coastal Seaglass',
		category: 'jewelry',
		aesthetic: 'Beach finds, ocean treasures',
		visualStyle: 'Tumbled glass, nautical, beachy',
		productExample: 'sea glass pendant on silver chain',
		photoStyle: 'Natural light, sand/shell props, turquoise backgrounds'
	},
	{
		id: 8,
		name: 'Birthstone Personalized',
		category: 'jewelry',
		aesthetic: 'Custom, meaningful, gift-focused',
		visualStyle: 'Colorful gemstones, initial charms, personal touches',
		productExample: 'birthstone bracelet with initial charm',
		photoStyle: 'Gift boxes, greeting cards, lifestyle shots'
	},

	// ==================== VINTAGE/ANTIQUE PRESETS (7) ====================
	{
		id: 9,
		name: 'Pyrex Paradise',
		category: 'vintage',
		aesthetic: 'Mid-century kitchen nostalgia',
		visualStyle: 'Bold patterns, primary colors, retro kitchen',
		productExample: 'vintage Pyrex mixing bowl with colorful pattern',
		photoStyle: 'Styled kitchen scenes, bright colors, pattern close-ups'
	},
	{
		id: 10,
		name: 'Murano Magic',
		category: 'vintage',
		aesthetic: 'Italian glass artistry, colorful swirls',
		visualStyle: 'Hand-blown glass, vibrant colors, artistic',
		productExample: 'Murano glass vase with color swirls',
		photoStyle: 'Backlit photos showing color, artistic angles'
	},
	{
		id: 11,
		name: 'Jadeite Glow',
		category: 'vintage',
		aesthetic: 'Soft green milk glass, sought-after collectible',
		visualStyle: 'Pastel green, vintage charm, kitchen collectible',
		productExample: 'jadeite coffee cup and saucer',
		photoStyle: 'Natural light showing glow, collection displays'
	},
	{
		id: 12,
		name: 'Art Deco Elegance',
		category: 'vintage',
		aesthetic: '1920s-1940s geometric glamour',
		visualStyle: 'Geometric patterns, gold accents, sophisticated',
		productExample: 'Art Deco perfume bottle with geometric design',
		photoStyle: 'Dramatic lighting, luxe backgrounds, period props'
	},
	{
		id: 13,
		name: 'Farmhouse Finds',
		category: 'vintage',
		aesthetic: 'Rustic, chippy paint, repurposed charm',
		visualStyle: 'Distressed wood, enamelware, country living',
		productExample: 'vintage enamelware pitcher with chippy paint',
		photoStyle: 'Barn wood backgrounds, natural lighting, styled vignettes'
	},
	{
		id: 14,
		name: 'Mid-Century Swung Vase',
		category: 'vintage',
		aesthetic: '2026 trending - dramatic height, bold colors',
		visualStyle: 'Tall, dramatic, retro glam',
		productExample: 'tall orange mid-century swung glass vase',
		photoStyle: 'Full-length shots showing height, styled with florals'
	},
	{
		id: 15,
		name: 'Châteaucore Antique',
		category: 'vintage',
		aesthetic: 'French country, old-world glamour, ornate',
		visualStyle: 'Embroidered linens, ornate frames, romantic details',
		productExample: 'antique French embroidered table runner',
		photoStyle: 'Romantic lighting, French countryside props, lace details'
	},

	// ==================== FASHION/POSHMARK PRESETS (8) ====================
	{
		id: 16,
		name: 'Lululemon Luxe Athleisure',
		category: 'fashion',
		aesthetic: 'Premium activewear, barely-worn, brand-focused',
		visualStyle: 'Clean, minimal, aspirational lifestyle',
		productExample: 'black Lululemon leggings flat lay',
		photoStyle: 'Flat lays, lifestyle action shots, clean backgrounds'
	},
	{
		id: 17,
		name: 'Y2K Revival',
		category: 'fashion',
		aesthetic: '2000s nostalgia, low-rise, butterfly clips',
		visualStyle: 'Bright colors, logos, nostalgic details',
		productExample: 'butterfly clips and mini purse on pink background',
		photoStyle: 'Colorful, playful, styled with era accessories'
	},
	{
		id: 18,
		name: 'Luxury Designer Authenticated',
		category: 'fashion',
		aesthetic: 'High-end resale, authentication-focused',
		visualStyle: 'Close-ups of logos, serial numbers, craftsmanship',
		productExample: 'designer handbag with authentication tag',
		photoStyle: 'Multiple angles, serial number close-ups, dust bag included'
	},
	{
		id: 19,
		name: 'Vintage Band Tee',
		category: 'fashion',
		aesthetic: 'Concert merch, music nostalgia, collector appeal',
		visualStyle: 'Faded graphics, vintage wash, rock & roll',
		productExample: 'vintage band t-shirt on hanger',
		photoStyle: 'Styled on body or hanger, tag close-ups, graphic detail shots'
	},
	{
		id: 20,
		name: 'Cottagecore Dress',
		category: 'fashion',
		aesthetic: 'Prairie dresses, floral patterns, romantic feminine',
		visualStyle: 'Flowy fabrics, vintage-inspired, garden party',
		productExample: 'floral midi dress on hanger in garden',
		photoStyle: 'Garden settings, soft lighting, styled with basket/flowers'
	},
	{
		id: 21,
		name: 'Flared Jean Revival',
		category: 'fashion',
		aesthetic: '70s-inspired, wide-leg, trending silhouette',
		visualStyle: 'High-waist, flared leg, vintage-modern',
		productExample: 'high-waisted flared jeans flat lay',
		photoStyle: 'Full-length mirror shots, styled outfit, detail of flare'
	},
	{
		id: 22,
		name: 'Graphic Tee Statement',
		category: 'fashion',
		aesthetic: 'Bold graphics, slogan tees, personality-driven',
		visualStyle: 'Eye-catching graphics, witty sayings, brand logos',
		productExample: 'graphic t-shirt flat lay showing design',
		photoStyle: 'Flat lay showing graphic clearly, styled outfit shots'
	},
	{
		id: 23,
		name: 'Reusable Tumbler Aesthetic',
		category: 'fashion',
		aesthetic: 'Stanley/Hydro Flask vibes, trending accessories',
		visualStyle: 'Color-matched lids, sticker-covered, lifestyle accessory',
		productExample: 'pink Stanley-style tumbler with stickers',
		photoStyle: 'Lifestyle shots (gym, car, desk), color close-ups'
	},

	// ==================== HOME/FURNITURE PRESETS (7) ====================
	{
		id: 24,
		name: 'Washed Linen Texture',
		category: 'home',
		aesthetic: "Etsy's 2026 Texture of the Year - soft, lived-in",
		visualStyle: 'Natural wrinkles, soft neutrals, cozy comfort',
		productExample: 'rumpled natural linen bedding',
		photoStyle: 'Rumpled textures, natural light, close-up weave shots'
	},
	{
		id: 25,
		name: 'Curved & Cozy',
		category: 'home',
		aesthetic: 'Soft edges, natural materials, warm minimalism',
		visualStyle: 'Curved furniture, clay/rattan/wood, creamy neutrals',
		productExample: 'curved rattan chair with cushion',
		photoStyle: 'Styled rooms, texture close-ups, soft natural lighting'
	},
	{
		id: 26,
		name: 'Dopamine Décor',
		category: 'home',
		aesthetic: 'Color-drenched, joy-filled, oversized bows (Play Haus)',
		visualStyle: 'Bright candy colors, whimsical, maximalist',
		productExample: 'bright yellow decorative pillow with bow',
		photoStyle: 'Bright backgrounds, styled with color pops, fun props'
	},
	{
		id: 27,
		name: 'Heritage Wood Paneling',
		category: 'home',
		aesthetic: 'Stained oak, fluted details, sophisticated nostalgia',
		visualStyle: 'Rich wood tones, architectural details, warmth',
		productExample: 'wooden shelf with fluted details',
		photoStyle: 'Wood grain close-ups, architectural angles, warm lighting'
	},
	{
		id: 28,
		name: 'Rattan & Natural Texture',
		category: 'home',
		aesthetic: 'Woven natural materials, bohemian warmth',
		visualStyle: 'Wicker, rattan, jute, seagrass textures',
		productExample: 'handwoven rattan basket',
		photoStyle: 'Textured close-ups, botanical styling, natural settings'
	},
	{
		id: 29,
		name: 'Cloud Dancer Neutrals',
		category: 'home',
		aesthetic: 'Creamy beiges, soft khaki, Pantone-inspired',
		visualStyle: 'Soft color palette, minimalist, serene',
		productExample: 'soft beige ceramic vase',
		photoStyle: 'Soft lighting, monochromatic styling, texture play'
	},
	{
		id: 30,
		name: 'Perfectly Imperfect Handmade',
		category: 'home',
		aesthetic: 'The ULTIMATE 2026 trend - proof of human',
		visualStyle: 'Asymmetry, hand-drawn, visible craftsmanship',
		productExample: 'handmade ceramic mug with visible irregularities',
		photoStyle: 'Work-in-progress shots, hands in frame, authentic studio settings'
	}
];

// ============================================================================
// IMAGE GENERATION PROMPTS
// ============================================================================

function buildImagePrompt(preset: PresetDefinition): string {
	return `
Professional product photography for e-commerce marketplace listing.

PRODUCT: ${preset.productExample}

STYLE AESTHETIC: ${preset.aesthetic}
${preset.visualStyle}

PHOTOGRAPHY STYLE: ${preset.photoStyle}

COMPOSITION:
- Product is the hero, centered or following rule of thirds
- Clean, professional e-commerce quality
- High resolution, sharp focus
- No text, no watermarks, no people
- ${preset.category === 'jewelry' ? 'Jewelry display on textured surface' : ''}
- ${preset.category === 'vintage' ? 'Vintage collectible styled authentically' : ''}
- ${preset.category === 'fashion' ? 'Fashion item styled for resale marketplace' : ''}
- ${preset.category === 'home' ? 'Home decor styled in natural setting' : ''}

TECHNICAL:
- 16:9 aspect ratio (landscape thumbnail)
- Professional color grading
- Soft shadows and natural lighting
- E-commerce ready, marketplace optimized
- Photorealistic, NOT illustration or AI-generated look

MOOD: ${preset.aesthetic}

Create a stunning product photo that sellers will want to emulate for their ${preset.category} listings.
`.trim();
}

// ============================================================================
// IMAGE GENERATION WITH REPLICATE (Flux Pro 1.1)
// ============================================================================

/**
 * Generate image using Replicate's Flux Pro 1.1 model
 * Same quality as Imagen 3, easier API, already in SwiftList stack
 */
async function generateImageWithReplicate(prompt: string, apiKey: string): Promise<Buffer> {
	// Step 1: Create prediction
	const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
		method: 'POST',
		headers: {
			'Authorization': `Token ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			version: 'black-forest-labs/flux-1.1-pro',
			input: {
				prompt: prompt,
				aspect_ratio: '16:9', // Perfect for preset thumbnails
				output_format: 'jpg',
				output_quality: 90,
				safety_tolerance: 2,
				prompt_upsampling: true
			}
		})
	});

	if (!createResponse.ok) {
		const error = await createResponse.text();
		throw new Error(`Replicate API error: ${createResponse.status} - ${error}`);
	}

	let prediction = await createResponse.json();

	// Step 2: Poll for completion
	while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
		await new Promise(resolve => setTimeout(resolve, 1000));

		const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
			headers: { 'Authorization': `Token ${apiKey}` }
		});

		prediction = await statusResponse.json();
	}

	if (prediction.status === 'failed') {
		throw new Error(`Image generation failed: ${prediction.error}`);
	}

	// Step 3: Download generated image
	const imageUrl = prediction.output; // Flux returns a single URL
	const imageResponse = await fetch(imageUrl);

	if (!imageResponse.ok) {
		throw new Error(`Failed to download generated image: ${imageResponse.status}`);
	}

	const arrayBuffer = await imageResponse.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function generatePresetThumbnails() {
	const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;

	if (!apiKey) {
		console.error('❌ REPLICATE_API_KEY not found in environment');
		console.error('   Get your API key from https://replicate.com/account/api-tokens');
		console.error('   Add it to .env.local: REPLICATE_API_KEY=your_token_here');
		process.exit(1);
	}

	const outputDir = path.join(process.cwd(), 'static', 'preset-thumbnails');

	// Ensure output directory exists
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	console.log('🎨 Generating 30 Preset Thumbnails with Replicate Flux Pro 1.1');
	console.log(`📁 Output directory: ${outputDir}`);
	console.log('💰 Estimated cost: ~$0.09 total (30 images × $0.003 each)\n');

	let successCount = 0;
	let failCount = 0;
	const failedPresets: string[] = [];

	for (const preset of presetDefinitions) {
		try {
			console.log(`[${preset.id}/30] Generating: ${preset.name}...`);

			const prompt = buildImagePrompt(preset);

			// Generate image
			const imageBuffer = await generateImageWithReplicate(prompt, apiKey);

			// Save to file
			const outputPath = path.join(outputDir, `${preset.id}.jpg`);
			fs.writeFileSync(outputPath, imageBuffer);

			successCount++;
			console.log(`✅ Saved: ${outputPath}\n`);

		} catch (error) {
			failCount++;
			failedPresets.push(preset.name);
			console.error(`❌ Failed: ${preset.name}`);
			console.error(`   Error: ${(error as Error).message}\n`);
		}

		// Rate limiting: wait 3 seconds between requests to avoid rate limits
		await new Promise(resolve => setTimeout(resolve, 3000));
	}

	console.log('\n' + '='.repeat(60));
	console.log('📊 GENERATION SUMMARY');
	console.log('='.repeat(60));
	console.log(`✅ Success: ${successCount}/30`);
	console.log(`❌ Failed: ${failCount}/30`);
	console.log(`💰 Actual cost: $${(successCount * 0.005).toFixed(3)}`);

	if (failedPresets.length > 0) {
		console.log('\nFailed presets:');
		failedPresets.forEach(name => console.log(`  - ${name}`));
	}

	console.log('='.repeat(60));

	if (successCount === 30) {
		console.log('\n✨ All thumbnails generated successfully!');
		console.log('📝 Next step: Update +page.svelte to use the images');
		console.log('   Replace: style={`background: linear-gradient...`}');
		console.log('   With: <img src="/preset-thumbnails/{preset.id}.jpg" />');
	}
}

// Run the script
generatePresetThumbnails().catch(console.error);
