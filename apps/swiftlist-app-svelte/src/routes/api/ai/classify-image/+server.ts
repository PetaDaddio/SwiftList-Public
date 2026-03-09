import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import { aiLogger } from '$lib/utils/logger';

const log = aiLogger.child({ route: '/api/ai/classify-image' });

// Lazy-initialize Gemini client at request time (not module load time)
// $env/dynamic/private values may not be available at module scope on cold starts
let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
	if (_genAI) return _genAI;
	const apiKey = env.GOOGLE_GEMINI_API_KEY;
	if (!apiKey) {
		log.error('GOOGLE_GEMINI_API_KEY is not set — classification will fail');
		return null;
	}
	_genAI = new GoogleGenerativeAI(apiKey);
	return _genAI;
}

// Product type to workflow mapping
const WORKFLOW_MAP: Record<string, string> = {
	jewelry: 'WF-02',
	clothing: 'WF-03',
	electronics: 'WF-04',
	furniture: 'WF-05',
	accessories: 'WF-06',
	home_decor: 'WF-07',
	beauty: 'WF-08',
	toys: 'WF-09',
	general: 'WF-01' // fallback
};

// Enhancement recommendations based on product type
const ENHANCEMENT_MAP: Record<string, string[]> = {
	jewelry: ['background-removal', 'high-res-upscale', 'color-correction'],
	clothing: ['background-removal', 'model-integration', 'lifestyle-scene'],
	electronics: ['background-removal', 'high-res-upscale', 'shadow-add'],
	furniture: ['lifestyle-scene', 'high-res-upscale', 'perspective-correction'],
	accessories: ['background-removal', 'high-res-upscale', 'lifestyle-scene'],
	home_decor: ['lifestyle-scene', 'color-correction', 'high-res-upscale'],
	beauty: ['background-removal', 'high-res-upscale', 'color-correction'],
	toys: ['background-removal', 'lifestyle-scene', 'color-correction'],
	general: ['background-removal', 'high-res-upscale']
};

// Marketplace recommendations based on product type
const MARKETPLACE_MAP: Record<string, string[]> = {
	jewelry: ['etsy', 'amazon', 'shopify'],
	clothing: ['poshmark', 'amazon', 'shopify'],
	electronics: ['amazon', 'ebay', 'shopify'],
	furniture: ['instagram', 'craigslist', 'shopify'],
	accessories: ['etsy', 'amazon', 'shopify'],
	home_decor: ['etsy', 'wayfair', 'amazon'],
	beauty: ['amazon', 'shopify', 'instagram'],
	toys: ['amazon', 'ebay', 'instagram'],
	general: ['amazon', 'shopify']
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// SECURITY: Require authentication (calls paid Gemini API)
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Parse request body
		const body = await request.json();
		const { image_base64, file_name } = body;

		if (!image_base64) {
			return json(
				{
					error: 'Missing required field: image_base64'
				},
				{ status: 400 }
			);
		}

		// SECURITY: Limit base64 payload size (~10MB after encoding)
		if (typeof image_base64 !== 'string' || image_base64.length > 15_000_000) {
			return json({ error: 'Image too large (max 10MB)' }, { status: 400 });
		}

		// Initialize Gemini at request time (lazy, guarantees env is available)
		const genAI = getGenAI();
		if (!genAI) {
			log.error('Gemini API key missing — cannot classify image');
			return json(
				{ error: 'Image classification service unavailable. Please try again later.' },
				{ status: 503 }
			);
		}

		// Initialize Gemini 2.5 Flash with strict JSON schema enforcement
		const model = genAI.getGenerativeModel({
			model: 'gemini-2.5-flash',
			generationConfig: {
				temperature: 0.1, // Near-deterministic for consistent classification
				maxOutputTokens: 800,
				responseMimeType: 'application/json',
				// responseSchema forces Gemini to conform to this exact structure
				responseSchema: {
					type: SchemaType.OBJECT,
					properties: {
						product_name: { type: SchemaType.STRING, description: 'Specific product name, 3-6 words' },
						product_type: {
							type: SchemaType.STRING,
							format: 'enum',
							enum: ['jewelry', 'clothing', 'electronics', 'furniture', 'accessories', 'home_decor', 'beauty', 'toys', 'general']
						},
						confidence: { type: SchemaType.NUMBER, description: 'Classification confidence 0.0 to 1.0' },
						reasoning: { type: SchemaType.STRING, description: 'Brief explanation of identification' },
						details: {
							type: SchemaType.OBJECT,
							properties: {
								material: { type: SchemaType.STRING },
								color: { type: SchemaType.STRING },
								style: { type: SchemaType.STRING }
							}
						}
					},
					required: ['product_name', 'product_type', 'confidence', 'reasoning']
				}
			}
		});

		// Extract base64 data (remove data:image/... prefix if present)
		const base64Data = image_base64.includes(',')
			? image_base64.split(',')[1]
			: image_base64;

		// Detect mime type from base64 or filename
		let mimeType = 'image/jpeg';
		if (image_base64.includes('data:image/')) {
			mimeType = image_base64.split(';')[0].replace('data:', '');
		} else if (file_name) {
			if (file_name.endsWith('.png')) mimeType = 'image/png';
			else if (file_name.endsWith('.webp')) mimeType = 'image/webp';
		}

		// Detect image dimensions using Sharp
		let imageDimensions = { width: 0, height: 0, needs_upscaling: false };
		try {
			const sharp = (await import('sharp')).default;
			const imageBuffer = Buffer.from(base64Data, 'base64');
			const metadata = await sharp(imageBuffer).metadata();

			const width = metadata.width || 0;
			const height = metadata.height || 0;
			const minDimension = Math.min(width, height);

			// Marketplace minimum recommendation is 1600px
			const needsUpscaling = minDimension < 1600;

			imageDimensions = {
				width,
				height,
				needs_upscaling: needsUpscaling
			};

		} catch (dimError) {
			log.warn({ err: dimError }, 'Dimension detection failed');
			// Continue without dimension info
		}

		// Create prompt for product classification
		const prompt = `You are an expert product identifier for an e-commerce marketplace. Analyze this product image and identify EXACTLY what the product is.

Your task:
1. IDENTIFY the specific product (e.g., "Diamond Stud Earrings", "Inflatable Pool Float", "Die-Cast Toy Car", "Ceramic Bread Box")
2. CLASSIFY it into the best-fit category for marketplace optimization

Categories for classification:
- jewelry: rings, necklaces, bracelets, earrings, watches, chains, pendants
- clothing: shirts, pants, dresses, jackets, shoes, boots, sneakers
- electronics: phones, laptops, headphones, cameras, gadgets, chargers
- furniture: chairs, tables, sofas, beds, cabinets, desks
- accessories: bags, wallets, sunglasses, hats, belts, scarves
- home_decor: vases, paintings, lamps, candles, pillows, frames
- beauty: makeup, skincare, perfume, hair products, cosmetics
- toys: action figures, dolls, games, puzzles, stuffed animals, model cars
- general: ONLY if truly unclear or doesn't fit any category

IMPORTANT:
- Be SPECIFIC in product_name (what IS this item?)
- Be ACCURATE in category (which marketplace category fits best?)
- Be confident - aim for 0.8+ confidence when product is clear
- Include key details: material, color, style, brand (if visible)

Return ONLY this JSON (no markdown, no code blocks):
{
  "product_name": "Specific product description (3-6 words)",
  "product_type": "category_name",
  "confidence": 0.95,
  "reasoning": "Brief explanation of identification",
  "details": {
    "material": "if visible",
    "color": "primary color(s)",
    "style": "modern/vintage/etc if applicable"
  }
}

Example for diamond earrings:
{
  "product_name": "Diamond Stud Earrings",
  "product_type": "jewelry",
  "confidence": 0.95,
  "reasoning": "Round diamond earrings in white gold or silver setting",
  "details": {
    "material": "diamonds, precious metal",
    "color": "white/silver",
    "style": "classic stud"
  }
}`;

		// Call Gemini API with one retry on transient failures
		let text = '';
		const geminiPayload = [
			{
				inlineData: {
					data: base64Data,
					mimeType: mimeType
				}
			},
			prompt
		];

		let lastGeminiError: any = null;
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const result = await model.generateContent(geminiPayload);
				const response = await result.response;
				text = response.text();
				log.info({ responseLength: text?.length, responsePreview: text?.substring(0, 200), attempt }, 'Gemini raw response');
				lastGeminiError = null;
				break;
			} catch (geminiError: any) {
				lastGeminiError = geminiError;
				log.warn({ err: geminiError, statusCode: geminiError.statusCode, attempt }, 'Gemini classification attempt failed');
				if (attempt === 0) {
					// Wait 1s before retry
					await new Promise(r => setTimeout(r, 1000));
				}
			}
		}

		if (lastGeminiError) {
			log.error({ err: lastGeminiError, statusCode: lastGeminiError.statusCode }, 'Gemini classification failed after 2 attempts');
			return json(
				{ error: 'Image classification failed. Please try uploading again.' },
				{ status: 502 }
			);
		}

		// Parse Gemini response
		let classification;
		try {
			// With responseMimeType: 'application/json', response should be clean JSON
			// But add fallbacks for edge cases
			let cleanText = text.trim();
			// Remove markdown code blocks if present
			cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
			// Extract JSON object if surrounded by non-JSON text
			const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				cleanText = jsonMatch[0];
			}
			classification = JSON.parse(cleanText);
		} catch (parseError) {
			log.error({ responseText: text?.substring(0, 500) }, 'Gemini response parse failed — full response logged');
			return json(
				{ error: 'Classification response could not be parsed. Please try again.' },
				{ status: 502 }
			);
		}

		// Validate product type
		const productType = classification.product_type || 'general';
		const validProductType = WORKFLOW_MAP[productType] ? productType : 'general';

		// Build response
		const responseData = {
			product_name: classification.product_name || 'Unknown Product',
			product_type: validProductType,
			confidence: classification.confidence || 0.5,
			reasoning: classification.reasoning,
			details: classification.details || {},
			recommended_workflow: WORKFLOW_MAP[validProductType],
			suggested_enhancements: ENHANCEMENT_MAP[validProductType] || ENHANCEMENT_MAP.general,
			suggested_marketplaces: MARKETPLACE_MAP[validProductType] || MARKETPLACE_MAP.general,
			resolution: imageDimensions
		};

		log.info({ productType: validProductType, confidence: classification.confidence }, 'Image classified');
		return json(responseData);
	} catch (error) {
		log.error({ err: error }, 'Image classification failed');

		return json(
			{ error: 'Image classification failed unexpectedly. Please try again.' },
			{ status: 500 }
		);
	}
};
