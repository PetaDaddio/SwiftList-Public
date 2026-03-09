/**
 * Product in Human Hands Generator API Endpoint
 * POST /api/jobs/product-in-hands
 *
 * Takes a product image and generates a lifestyle photo of the product
 * being held in human hands. Users can art-direct skin color, hand
 * placement, and style preferences.
 *
 * Pipeline:
 * 1. Classify product category (if not provided) via Gemini Flash
 * 2. Analyze product for optimal hand grip/placement
 * 3. Build structured Imagen prompt
 * 4. Generate image via Imagen 3 (fallback: Gemini Flash image gen)
 * 5. Upload to Supabase storage, return public URL
 *
 * SECURITY:
 * - Authentication required (Bearer token or session)
 * - Input validation with Zod
 * - Rate limiting via hooks.server.ts
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/client';
import { analyzeForHands, buildHandsPrompt } from '$lib/ai/hands-analyst';
import type { ArtDirection } from '$lib/ai/hands-analyst';
import { jobsLogger } from '$lib/utils/logger';
import { validateImageUrl } from '$lib/security/url-validator';
import { logApiCall } from '$lib/utils/api-call-logger';
import { recordProviderCall } from '$lib/utils/metrics-collector';
import { sanitizeAIPrompt } from '$lib/security/prompt-sanitizer';

const log = jobsLogger.child({ route: '/api/jobs/product-in-hands' });

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const productInHandsSchema = z.object({
	image_url: z.string().url('Valid image URL is required'),
	product_category: z.string().optional(),
	art_direction: z.object({
		skin_tone: z.enum(['light', 'medium', 'olive', 'tan', 'brown', 'dark']).optional(),
		hand_placement: z.enum(['palm', 'fingertip', 'pinch', 'two-handed', 'display', 'cradled']).optional(),
		style: z.enum(['elegant', 'casual', 'rustic', 'modern', 'luxury']).optional(),
		gender: z.enum(['feminine', 'masculine', 'neutral']).optional(),
		accessories: z.string().optional()
	}).optional(),
	background: z.enum(['white', 'lifestyle', 'transparent']).default('white')
});

// ============================================================================
// PRODUCT CLASSIFICATION (Gemini Flash 2.5)
// ============================================================================

async function classifyProduct(imageBuffer: Buffer, apiKey: string): Promise<string> {
	try {
		const base64Image = imageBuffer.toString('base64');

		const response = await fetch(
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-goog-api-key': apiKey
				},
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: `Identify this product image for e-commerce photography. Return a specific, descriptive product name that includes key visual details.

Include: material, color, style, and product type.
Examples of GOOD responses:
- "sterling silver filigree ring with turquoise stone"
- "hand-thrown ceramic mug with blue glaze"
- "vintage brass candlestick holder"
- "rose gold hoop earrings with diamond accents"
- "hand-knit wool beanie in charcoal grey"

Examples of BAD responses (too generic):
- "jewelry"
- "ring"
- "mug"
- "product"

Respond with ONLY the descriptive product name, nothing else. Keep it under 10 words.`
								},
								{
									inline_data: {
										mime_type: 'image/png',
										data: base64Image
									}
								}
							]
						}
					],
					generationConfig: {
						temperature: 0.3,
						maxOutputTokens: 50
					}
				})
			}
		);

		if (!response.ok) {
			log.warn({ status: response.status }, 'Gemini product classification failed, using default');
			return 'general product';
		}

		const result = await response.json();
		const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || 'general product';
		return text;
	} catch (err) {
		log.warn({ err }, 'Product classification error, using default');
		return 'general product';
	}
}

// ============================================================================
// IMAGE GENERATION - IMAGEN 4 (PRIMARY)
// Note: Imagen 3 (imagen-3.0-generate-002) returned 404 — superseded by Imagen 4
// ============================================================================

async function generateWithImagen3(prompt: string, apiKey: string): Promise<Buffer> {
	const response = await fetch(
		'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': apiKey
			},
			body: JSON.stringify({
				instances: [{ prompt }],
				parameters: {
					sampleCount: 1,
					aspectRatio: '1:1',
					outputOptions: {
						mimeType: 'image/png'
					}
				}
			})
		}
	);

	if (!response.ok) {
		const errText = await response.text();
		log.warn({ status: response.status, body: errText.substring(0, 500) }, 'Imagen 4 generation failed');
		throw new Error(`Imagen 4 generation failed: ${response.status}`);
	}

	const result = await response.json();
	const base64Data = result.predictions?.[0]?.bytesBase64Encoded;

	if (!base64Data) {
		throw new Error('Imagen 3 returned no image data');
	}

	return Buffer.from(base64Data, 'base64');
}

// ============================================================================
// IMAGE GENERATION - GEMINI FLASH FALLBACK
// ============================================================================

async function generateWithGeminiFallback(prompt: string, apiKey: string): Promise<Buffer> {
	const response = await fetch(
		'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': apiKey
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [{ text: prompt }]
					}
				],
				generationConfig: {
					responseModalities: ['TEXT', 'IMAGE'],
					responseMimeType: 'image/png'
				}
			})
		}
	);

	if (!response.ok) {
		const errText = await response.text();
		log.error({ status: response.status, body: errText.substring(0, 500) }, 'Gemini Flash fallback generation failed');
		throw new Error(`Gemini Flash fallback generation failed: ${response.status}`);
	}

	const result = await response.json();
	const parts = result.candidates?.[0]?.content?.parts || [];

	for (const part of parts) {
		if (part.inline_data?.data) {
			return Buffer.from(part.inline_data.data, 'base64');
		}
	}

	throw new Error('Gemini Flash fallback returned no image data');
}

// ============================================================================
// ENDPOINT HANDLER
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication
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
		const CREDIT_COST = 5;
		const { error: deductError } = await supabase.rpc('deduct_credits', {
			p_user_id: userId,
			p_amount: CREDIT_COST,
			p_job_id: null
		});
		if (deductError) {
			log.warn({ userId, err: deductError }, 'Credit deduction failed (insufficient credits or RPC error)');
			return json({ error: 'Insufficient credits', required: CREDIT_COST }, { status: 402 });
		}

		// 2. Input validation
		const body = await request.json();
		const validated = productInHandsSchema.parse(body);
		const { image_url, background } = validated;

		// SECURITY: SSRF protection — only allow Supabase Storage URLs
		const urlCheck = validateImageUrl(image_url);
		if (!urlCheck.valid) {
			throw error(400, urlCheck.error || 'Invalid image URL');
		}

		const geminiApiKey = env.GOOGLE_GEMINI_API_KEY;
		if (!geminiApiKey) {
			log.error('GOOGLE_GEMINI_API_KEY not configured');
			throw error(500, 'Server configuration error');
		}

		log.info({ product_category: validated.product_category, background, has_art_direction: !!validated.art_direction }, 'Starting product-in-hands pipeline');

		// 3. Fetch the source image
		const imageResponse = await fetch(image_url);
		if (!imageResponse.ok) {
			throw error(400, 'Failed to fetch source image');
		}
		const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

		let totalCost = 0;

		// 4. Step 1 - Classify product category (if not provided)
		let productCategory = validated.product_category || '';
		if (!productCategory) {
			log.info('Step 1: Auto-detecting product category with Gemini Flash');
			productCategory = await classifyProduct(imageBuffer, geminiApiKey);
			totalCost += 0.001; // Gemini Flash classification cost
			recordProviderCall('google_gemini');
			logApiCall(serviceRoleKey, {
				provider: 'google_gemini', operation: 'classification', cost_usd: 0.001,
				duration_ms: 0, status: 'success'
			});
			log.info({ productCategory }, 'Product category detected');
		} else {
			// SECURITY: Sanitize user-provided product category before LLM prompt embedding
			const catSanitized = sanitizeAIPrompt(productCategory);
			if (!catSanitized.valid) {
				log.warn({ violations: catSanitized.violations }, 'Product category failed prompt sanitization');
				throw error(400, 'Invalid product category content');
			}
			productCategory = catSanitized.sanitized;
			log.info({ productCategory }, 'Using provided product category (sanitized)');
		}

		// 5. Step 2 - Analyze product for hands placement
		log.info('Step 2: Analyzing product for optimal hand placement');

		// SECURITY: Sanitize accessories field before LLM prompt embedding
		let sanitizedAccessories = validated.art_direction?.accessories;
		if (sanitizedAccessories) {
			const accSanitized = sanitizeAIPrompt(sanitizedAccessories);
			if (!accSanitized.valid) {
				log.warn({ violations: accSanitized.violations }, 'Accessories field failed prompt sanitization');
				throw error(400, 'Invalid accessories description');
			}
			sanitizedAccessories = accSanitized.sanitized;
		}

		const artDirection: ArtDirection = validated.art_direction
			? {
				skinTone: validated.art_direction.skin_tone,
				handPlacement: validated.art_direction.hand_placement,
				style: validated.art_direction.style,
				gender: validated.art_direction.gender,
				accessories: sanitizedAccessories
			}
			: {};

		const analysis = await analyzeForHands(
			{
				imageUrl: image_url,
				imageBuffer,
				productCategory,
				artDirection
			},
			geminiApiKey
		);
		totalCost += 0.001; // Gemini Flash analysis cost
		recordProviderCall('google_gemini');
		logApiCall(serviceRoleKey, {
			provider: 'google_gemini', operation: 'vision_analysis', cost_usd: 0.001,
			duration_ms: 0, status: 'success'
		});
		log.info({ gripType: analysis.gripType, confidence: analysis.confidence }, 'Hands analysis complete');

		// 6. Step 3 - Build structured prompt
		log.info('Step 3: Building structured Imagen prompt');
		const generatedPrompt = buildHandsPrompt(analysis, productCategory, artDirection);

		// 7. Step 4 - Generate image (Imagen 4 primary, Gemini Flash fallback)
		log.info('Step 4: Generating image with Imagen 4');
		let resultBuffer: Buffer;
		let generationModel = 'imagen-4.0-generate-001';

		try {
			resultBuffer = await generateWithImagen3(generatedPrompt, geminiApiKey);
			totalCost += 0.004; // Imagen 3 generation cost
			recordProviderCall('google_imagen');
			logApiCall(serviceRoleKey, {
				provider: 'google_imagen', operation: 'product_in_hands', cost_usd: 0.004,
				duration_ms: 0, status: 'success'
			});
		} catch (imagenError) {
			log.warn({ err: imagenError }, 'Imagen 3 failed, falling back to Gemini Flash image generation');
			generationModel = 'gemini-2.5-flash';
			resultBuffer = await generateWithGeminiFallback(generatedPrompt, geminiApiKey);
			totalCost += 0.004; // Gemini Flash image generation cost
			recordProviderCall('google_gemini');
			logApiCall(serviceRoleKey, {
				provider: 'google_gemini', operation: 'product_in_hands', cost_usd: 0.004,
				duration_ms: 0, status: 'success'
			});
		}

		// 8. Step 5 - Upload to Supabase Storage
		const sharp = (await import('sharp')).default;
		const outputBuffer = await sharp(resultBuffer).png().toBuffer();
		const fileName = `product-in-hands-${Date.now()}.png`;
		const storagePath = `${userId}/processed/${fileName}`;

		const { error: uploadError } = await supabase.storage
			.from('job-outputs')
			.upload(storagePath, outputBuffer, {
				contentType: 'image/png',
				upsert: false
			});

		if (uploadError) {
			log.error({ err: uploadError }, 'Failed to upload result');
			throw error(500, 'Failed to upload processed image');
		}

		const { data: urlData } = supabase.storage
			.from('job-outputs')
			.getPublicUrl(storagePath);

		log.info(
			{
				productCategory,
				gripType: analysis.gripType,
				generationModel,
				totalCost: `$${totalCost.toFixed(3)}`,
				outputUrl: urlData.publicUrl
			},
			'Product-in-hands pipeline complete'
		);

		// Credits already deducted before work began (VULN-03 fix)

		return json({
			success: true,
			output_url: urlData.publicUrl,
			product_category: productCategory,
			grip_type: analysis.gripType,
			cost_usd: totalCost
		});
	} catch (err: any) {
		if (err.status) throw err;

		// Refund credits on failure (they were deducted before work began)
		try {
			const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
			if (serviceRoleKey) {
				const refundClient = createServiceRoleClient(serviceRoleKey);
				await refundClient.rpc('refund_credits', {
					p_user_id: (locals as any)?.user?.id,
					p_amount: 5, // CREDIT_COST for product-in-hands
					p_job_id: null
				});
				log.info('Credits refunded after pipeline failure');
			}
		} catch (refundErr) {
			log.error({ err: refundErr }, 'Failed to refund credits after pipeline failure');
		}

		log.error({ err }, 'Product-in-hands processing failed');
		throw error(500, 'Product-in-hands processing failed');
	}
};
