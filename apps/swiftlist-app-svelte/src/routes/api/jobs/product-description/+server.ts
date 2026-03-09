/**
 * Product Description Generator API Endpoint
 * POST /api/jobs/product-description
 *
 * Takes a product image URL, classifies the product via Gemini 2.5 Flash,
 * then generates marketplace-optimized descriptions using specialty vocabulary.
 *
 * SECURITY:
 * - Authentication required (Bearer token OR locals.user)
 * - Input validation with Zod
 * - Rate limiting via hooks.server.ts
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceRoleClient } from '$lib/supabase/client';
import { jobsLogger } from '$lib/utils/logger';
import { validateImageUrl } from '$lib/security/url-validator';
import { sanitizeAIPrompt } from '$lib/security/prompt-sanitizer';
import { logApiCall } from '$lib/utils/api-call-logger';
import { recordProviderCall } from '$lib/utils/metrics-collector';

const log = jobsLogger.child({ route: '/api/jobs/product-description' });

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const VALID_MARKETPLACES = ['etsy', 'amazon', 'poshmark', 'ebay'] as const;

const productDescriptionSchema = z.object({
	image_url: z.string().url('Valid image URL is required'),
	marketplaces: z
		.array(z.enum(VALID_MARKETPLACES))
		.min(1)
		.max(4)
		.optional(),
	product_type_override: z.string().optional()
});

// ============================================================================
// PRODUCT TYPE CONSTANTS
// ============================================================================

const VALID_PRODUCT_TYPES = [
	'jewelry', 'clothing', 'electronics', 'furniture',
	'accessories', 'home_decor', 'beauty', 'toys', 'general'
] as const;

type ProductType = (typeof VALID_PRODUCT_TYPES)[number];

/** Marketplace arrays per product type (from classify-image endpoint) */
const MARKETPLACE_MAP: Record<string, string[]> = {
	jewelry: ['etsy', 'amazon', 'poshmark', 'ebay'],
	clothing: ['poshmark', 'amazon', 'ebay', 'etsy'],
	electronics: ['amazon', 'ebay', 'etsy', 'poshmark'],
	furniture: ['amazon', 'ebay', 'etsy', 'poshmark'],
	accessories: ['etsy', 'amazon', 'poshmark', 'ebay'],
	home_decor: ['etsy', 'amazon', 'ebay', 'poshmark'],
	beauty: ['amazon', 'poshmark', 'etsy', 'ebay'],
	toys: ['amazon', 'ebay', 'etsy', 'poshmark'],
	general: ['amazon', 'ebay', 'etsy', 'poshmark']
};

/** Default marketplaces when none specified (4 biggest) */
const DEFAULT_MARKETPLACES = ['etsy', 'amazon', 'poshmark', 'ebay'];

// ============================================================================
// SPECIALTY VOCABULARY BY PRODUCT TYPE
// ============================================================================

interface SpecialtyConfig {
	vocabulary: string[];
	tone: string;
	seoKeywords: string[];
	callToAction: string;
}

const SPECIALTY_VOCABULARY: Record<string, SpecialtyConfig> = {
	jewelry: {
		vocabulary: [
			'carat', 'clarity', 'cut', 'color', 'setting', 'prong', 'band', 'gemstone',
			'14K', '18K', 'white gold', 'yellow gold', 'rose gold',
			'diamond', 'sapphire', 'emerald', 'ruby',
			'engagement', 'wedding', 'anniversary',
			'brilliant', 'princess', 'cushion', 'emerald cut'
		],
		tone: 'luxury',
		seoKeywords: ['engagement ring', 'wedding band', 'diamond jewelry', 'fine jewelry', 'luxury jewelry'],
		callToAction: 'Timeless elegance for your special moments.'
	},
	clothing: {
		vocabulary: [
			'fabric', 'fit', 'silhouette', 'drape', 'tailored',
			'casual', 'formal', 'cotton', 'silk', 'polyester',
			'breathable', 'stretch', 'comfortable', 'stylish'
		],
		tone: 'approachable',
		seoKeywords: ['womens fashion', 'mens clothing', 'apparel', 'style'],
		callToAction: 'Elevate your wardrobe today.'
	},
	electronics: {
		vocabulary: [
			'specifications', 'performance', 'battery life', 'connectivity',
			'resolution', 'processor', 'storage', 'compatible',
			'wireless', 'Bluetooth', 'USB-C', 'HD', '4K'
		],
		tone: 'technical',
		seoKeywords: ['tech gadget', 'electronics', 'smart device', 'high performance'],
		callToAction: 'Upgrade your tech today.'
	},
	furniture: {
		vocabulary: [
			'dimensions', 'W×D×H', 'inches', 'cm',
			'solid wood', 'oak', 'walnut', 'pine', 'mahogany',
			'upholstered', 'fabric', 'leather', 'velvet',
			'assembly required', 'weight capacity', 'durable'
		],
		tone: 'informative',
		seoKeywords: ['furniture', 'home decor', 'interior design'],
		callToAction: 'Transform your space today.'
	},
	accessories: {
		vocabulary: [
			'genuine leather', 'hardware', 'clasp', 'adjustable',
			'unisex', 'handcrafted', 'premium', 'versatile'
		],
		tone: 'trendy',
		seoKeywords: ['fashion accessories', 'designer accessories', 'style essentials'],
		callToAction: 'Complete your look.'
	},
	home_decor: {
		vocabulary: [
			'handcrafted', 'artisan', 'statement piece', 'accent',
			'minimalist', 'bohemian', 'contemporary', 'vintage'
		],
		tone: 'aspirational',
		seoKeywords: ['home decor', 'interior design', 'room accent', 'decorative'],
		callToAction: 'Make your space uniquely yours.'
	},
	beauty: {
		vocabulary: [
			'formula', 'ingredients', 'cruelty-free', 'vegan',
			'dermatologist tested', 'long-lasting', 'shade', 'coverage'
		],
		tone: 'engaging',
		seoKeywords: ['beauty', 'skincare', 'cosmetics', 'makeup'],
		callToAction: 'Discover your new favorite.'
	},
	toys: {
		vocabulary: [
			'age-appropriate', 'safe', 'educational', 'interactive',
			'collectible', 'durable', 'non-toxic', 'hours of fun'
		],
		tone: 'enthusiastic',
		seoKeywords: ['toys', 'kids toys', 'educational toys', 'gifts for kids'],
		callToAction: 'The perfect gift for any occasion.'
	},
	general: {
		vocabulary: ['product', 'quality', 'durable', 'practical', 'versatile'],
		tone: 'neutral',
		seoKeywords: ['product', 'quality', 'essential'],
		callToAction: 'Get yours today.'
	}
};

// ============================================================================
// MARKETPLACE PROMPT RULES
// ============================================================================

const MARKETPLACE_RULES: Record<string, string> = {
	etsy: `Etsy marketplace rules:
- Title: SEO-heavy, max 140 characters, include key materials and descriptors
- Description: Conversational, warm tone. Emphasize handmade/unique qualities.
- Include materials, dimensions, and care instructions.
- Tags: 13 tags max, mix broad and specific terms.
- Emphasize craftsmanship, uniqueness, and the story behind the product.`,

	amazon: `Amazon marketplace rules:
- Title: Keyword-rich, Brand + Product + Key Feature + Size/Color, max 200 chars
- Description: Use exactly 5 bullet points in feature-benefit format.
- Each bullet starts with a CAPITALIZED key feature followed by details.
- Include product specs (dimensions, weight, materials).
- Keywords should target Amazon search algorithm (A9).`,

	poshmark: `Poshmark marketplace rules:
- Title: Casual, trendy, brand-first if applicable, max 80 characters
- Description: Casual, friendly tone like talking to a friend.
- Focus on size, fit, condition, and styling tips.
- Include brand name prominently.
- Mention "condition" details (NWT, NWOT, EUC, GUC).
- Tags should include brand, size, style, and trending terms.`,

	ebay: `eBay marketplace rules:
- Title: Keyword-stuffed for search, max 80 characters, include brand/model/specs
- Description: Detailed specifications and condition grading.
- Include shipping-relevant dimensions and weight.
- Specify condition (New, Open Box, Refurbished, Used).
- Use item specifics format where applicable.
- Tags should be highly specific for eBay search filters.`
};

// ============================================================================
// CLASSIFICATION (Gemini 2.5 Flash)
// ============================================================================

interface ClassificationResult {
	product_name: string;
	product_type: ProductType;
	confidence: number;
	details: {
		material?: string;
		color?: string;
		style?: string;
	};
}

async function classifyProduct(
	imageBuffer: Buffer,
	mimeType: string,
	model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>
): Promise<ClassificationResult> {
	const base64Image = imageBuffer.toString('base64');

	const prompt = `You are an expert product identifier for an e-commerce marketplace. Analyze this product image and identify EXACTLY what the product is.

Classify into one of these categories:
- jewelry: rings, necklaces, bracelets, earrings, watches, chains, pendants
- clothing: shirts, pants, dresses, jackets, shoes, boots, sneakers
- electronics: phones, laptops, headphones, cameras, gadgets, chargers
- furniture: chairs, tables, sofas, beds, cabinets, desks
- accessories: bags, wallets, sunglasses, hats, belts, scarves
- home_decor: vases, paintings, lamps, candles, pillows, frames
- beauty: makeup, skincare, perfume, hair products, cosmetics
- toys: action figures, dolls, games, puzzles, stuffed animals, model cars
- general: ONLY if truly unclear or doesn't fit any category

Return ONLY this JSON (no markdown, no code blocks):
{
  "product_name": "Specific product description (3-6 words)",
  "product_type": "category_name",
  "confidence": 0.95,
  "details": {
    "material": "if visible",
    "color": "primary color(s)",
    "style": "modern/vintage/etc if applicable"
  }
}`;

	const result = await model.generateContent([
		{
			inlineData: {
				data: base64Image,
				mimeType
			}
		},
		prompt
	]);

	const response = await result.response;
	const text = response.text();

	const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
	const parsed = JSON.parse(cleanText);

	const productType = VALID_PRODUCT_TYPES.includes(parsed.product_type)
		? parsed.product_type
		: 'general';

	return {
		product_name: parsed.product_name || 'Unknown Product',
		product_type: productType as ProductType,
		confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
		details: {
			material: parsed.details?.material,
			color: parsed.details?.color,
			style: parsed.details?.style
		}
	};
}

// ============================================================================
// DESCRIPTION GENERATION (Gemini 2.5 Flash)
// ============================================================================

interface MarketplaceDescription {
	title: string;
	description: string;
	tags: string[];
	seo_keywords: string[];
}

async function generateMarketplaceDescription(
	marketplace: string,
	classification: ClassificationResult,
	specialty: SpecialtyConfig,
	model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>
): Promise<MarketplaceDescription> {
	const { product_name, product_type, details } = classification;
	const marketplaceRules = MARKETPLACE_RULES[marketplace] || MARKETPLACE_RULES.ebay;

	// SECURITY: Sanitize Gemini classification output before re-embedding in prompt
	// (prevents indirect prompt injection via crafted product images with embedded text)
	const safeName = sanitizeAIPrompt(product_name).sanitized;
	const safeType = sanitizeAIPrompt(product_type).sanitized;
	const safeMaterial = sanitizeAIPrompt(details.material || 'not specified').sanitized;
	const safeColor = sanitizeAIPrompt(details.color || 'not specified').sanitized;
	const safeStyle = sanitizeAIPrompt(details.style || 'not specified').sanitized;

	const prompt = `You are an expert e-commerce copywriter. Generate a product listing for the "${marketplace}" marketplace.

Product: ${safeName}
Category: ${safeType}
Material: ${safeMaterial}
Color: ${safeColor}
Style: ${safeStyle}

Writing tone: ${specialty.tone}
Use this specialty vocabulary where relevant: ${specialty.vocabulary.join(', ')}
SEO keywords to incorporate: ${specialty.seoKeywords.join(', ')}

${marketplaceRules}

Return ONLY this JSON (no markdown, no code blocks):
{
  "title": "Marketplace-optimized product title",
  "description": "Full product description following marketplace rules above",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
  "seo_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

	const result = await model.generateContent(prompt);
	const response = await result.response;
	const text = response.text();

	const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
	const parsed = JSON.parse(cleanText);

	return {
		title: parsed.title || product_name,
		description: parsed.description || '',
		tags: Array.isArray(parsed.tags) ? parsed.tags : [],
		seo_keywords: Array.isArray(parsed.seo_keywords) ? parsed.seo_keywords : []
	};
}

// ============================================================================
// ENDPOINT HANDLER
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication (same pattern as invisible-mannequin)
		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			log.error('SUPABASE_SERVICE_ROLE_KEY not configured');
			throw error(500, 'Server configuration error');
		}

		const supabase = createServiceRoleClient(serviceRoleKey);
		const authHeader = request.headers.get('authorization');
		let userId: string;
		if (!authHeader?.startsWith('Bearer ')) {
			if (!(locals as any).user) {
				throw error(401, 'Authentication required');
			}
			userId = (locals as any).user.id;
		} else {
			const token = authHeader.split(' ')[1];
			const { data: { user }, error: authError } = await supabase.auth.getUser(token);
			if (authError || !user) {
				throw error(401, 'Invalid or expired token');
			}
			userId = user.id;
		}

		// 1b. SECURITY: Deduct credits BEFORE expensive AI work (prevents free usage on deduction failure)
		const CREDIT_COST = 3;
		const { error: deductError } = await supabase.rpc('deduct_credits', {
			p_user_id: userId,
			p_amount: CREDIT_COST,
			p_job_id: null
		});
		if (deductError) {
			log.warn({ userId, err: deductError }, 'Credit deduction failed (insufficient credits or RPC error)');
			return json({ error: 'Insufficient credits', required: CREDIT_COST }, { status: 402 });
		}
		let creditsDeducted = true;

		// 2. Input validation
		const body = await request.json();
		const validated = productDescriptionSchema.parse(body);
		const { image_url, product_type_override } = validated;

		// SECURITY: SSRF protection — only allow Supabase Storage URLs
		const urlCheck = validateImageUrl(image_url);
		if (!urlCheck.valid) {
			throw error(400, urlCheck.error || 'Invalid image URL');
		}

		// 3. Verify Gemini API key
		const geminiApiKey = env.GOOGLE_GEMINI_API_KEY;
		if (!geminiApiKey) {
			log.error('GOOGLE_GEMINI_API_KEY not configured');
			throw error(500, 'Server configuration error');
		}

		const genAI = new GoogleGenerativeAI(geminiApiKey);

		log.info({ marketplaces: validated.marketplaces, product_type_override }, 'Starting product description pipeline');

		// 4. Fetch the source image
		const imageResponse = await fetch(image_url);
		if (!imageResponse.ok) {
			throw error(400, 'Failed to fetch source image');
		}

		const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
		const mimeType = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/jpeg';
		const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

		// 5. Classify product (Gemini 2.5 Flash, temperature 0.4)
		const classificationModel = genAI.getGenerativeModel({
			model: 'gemini-2.5-flash',
			generationConfig: {
				temperature: 0.4,
				maxOutputTokens: 500
			}
		});

		let classification: ClassificationResult;

		if (product_type_override && VALID_PRODUCT_TYPES.includes(product_type_override as any)) {
			// Skip classification if override provided — still need product name
			const overrideModel = genAI.getGenerativeModel({
				model: 'gemini-2.5-flash',
				generationConfig: { temperature: 0.4, maxOutputTokens: 500 }
			});
			classification = await classifyProduct(imageBuffer, mimeType, overrideModel);
			classification.product_type = product_type_override as ProductType;
			classification.confidence = 1.0;
		} else {
			classification = await classifyProduct(imageBuffer, mimeType, classificationModel);
		}

		log.info(
			{ product_name: classification.product_name, product_type: classification.product_type, confidence: classification.confidence },
			'Product classified'
		);

		// 6. Determine marketplaces
		const marketplaces = validated.marketplaces
			|| (MARKETPLACE_MAP[classification.product_type] || DEFAULT_MARKETPLACES)
				.filter((m): m is typeof VALID_MARKETPLACES[number] =>
					(VALID_MARKETPLACES as readonly string[]).includes(m)
				);

		// Deduplicate and cap at 4
		const uniqueMarketplaces = [...new Set(marketplaces)].slice(0, 4);

		if (uniqueMarketplaces.length === 0) {
			throw error(400, 'No valid marketplaces to generate descriptions for');
		}

		// 7. Get specialty vocabulary for this product type
		const specialty = SPECIALTY_VOCABULARY[classification.product_type] || SPECIALTY_VOCABULARY.general;

		// 8. Generate descriptions for all marketplaces in parallel (temperature 0.7 for creativity)
		const descriptionModel = genAI.getGenerativeModel({
			model: 'gemini-2.5-flash',
			generationConfig: {
				temperature: 0.7,
				maxOutputTokens: 2000
			}
		});

		const descriptionPromises = uniqueMarketplaces.map((marketplace) =>
			generateMarketplaceDescription(marketplace, classification, specialty, descriptionModel)
				.catch((err) => {
					log.warn({ err, marketplace }, 'Failed to generate description for marketplace');
					return {
						title: classification.product_name,
						description: 'Description generation failed for this marketplace.',
						tags: [] as string[],
						seo_keywords: [] as string[]
					} satisfies MarketplaceDescription;
				})
		);

		const descriptionResults = await Promise.all(descriptionPromises);

		// 9. Build descriptions map
		const descriptions: Record<string, MarketplaceDescription> = {};
		uniqueMarketplaces.forEach((marketplace, index) => {
			descriptions[marketplace] = descriptionResults[index];
		});

		// 10. Calculate cost
		const classificationCost = 0.001;
		const descriptionCost = uniqueMarketplaces.length * 0.001;
		const totalCost = classificationCost + descriptionCost;

		// Capacity monitoring: log API calls
		recordProviderCall('google_gemini');
		logApiCall(serviceRoleKey, {
			provider: 'google_gemini', operation: 'classification', cost_usd: classificationCost,
			duration_ms: 0, status: 'success'
		});
		for (let i = 0; i < uniqueMarketplaces.length; i++) {
			recordProviderCall('google_gemini');
			logApiCall(serviceRoleKey, {
				provider: 'google_gemini', operation: 'product_description', cost_usd: 0.001,
				duration_ms: 0, status: 'success'
			});
		}

		log.info(
			{
				product_type: classification.product_type,
				marketplaces: uniqueMarketplaces,
				totalCost: `$${totalCost.toFixed(3)}`
			},
			'Product description pipeline complete'
		);

		// Credits already deducted before work began (VULN-03 fix)

		return json({
			success: true,
			product_name: classification.product_name,
			product_type: classification.product_type,
			confidence: classification.confidence,
			descriptions,
			cost_usd: totalCost
		});
	} catch (err: any) {
		// Re-throw SvelteKit errors (already have status codes)
		if (err.status) throw err;

		// Zod validation errors
		if (err.name === 'ZodError') {
			log.warn({ errors: err.errors }, 'Validation failed');
			throw error(400, 'Invalid request: ' + err.errors.map((e: any) => e.message).join(', '));
		}

		// Refund credits on failure (they were deducted before work began)
		try {
			const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
			if (serviceRoleKey) {
				const refundClient = createServiceRoleClient(serviceRoleKey);
				await refundClient.rpc('refund_credits', {
					p_user_id: (locals as any)?.user?.id,
					p_amount: 3, // CREDIT_COST for product-description
					p_job_id: null
				});
				log.info('Credits refunded after pipeline failure');
			}
		} catch (refundErr) {
			log.error({ err: refundErr }, 'Failed to refund credits after pipeline failure');
		}

		log.error({ err }, 'Product description generation failed');
		throw error(500, 'Product description generation failed');
	}
};
