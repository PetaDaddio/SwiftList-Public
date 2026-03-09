/**
 * Invisible Mannequin (Ghost Mannequin) API Endpoint
 * POST /api/jobs/invisible-mannequin
 *
 * Takes a product photo of clothing and makes it appear on an invisible mannequin
 * using background removal + Gemini Imagen generation.
 *
 * Pipeline:
 * 1. Segment garment from background/mannequin (CleanEdge bg removal)
 * 2. Auto-detect garment type via Gemini Flash vision
 * 3. Generate ghost mannequin effect via Gemini Imagen
 *
 * SECURITY:
 * - Authentication required
 * - Input validation with Zod
 * - Rate limiting via hooks.server.ts
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/client';
import { removeBackgroundAdvanced } from '$lib/agents/background-removal';
import type { ProductType } from '$lib/agents/background-removal/types';
import { jobsLogger } from '$lib/utils/logger';
import { validateImageUrl } from '$lib/security/url-validator';
import { sanitizeAIPrompt } from '$lib/security/prompt-sanitizer';
import { logApiCall } from '$lib/utils/api-call-logger';
import { recordProviderCall } from '$lib/utils/metrics-collector';

const log = jobsLogger.child({ route: '/api/jobs/invisible-mannequin' });

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const invisibleMannequinSchema = z.object({
	image_url: z.string().url('Valid image URL is required'),
	garment_type: z.string().optional(),
	background: z.enum(['white', 'transparent']).default('white')
});

// ============================================================================
// GARMENT CLASSIFICATION (Gemini Flash 2.5)
// ============================================================================

async function classifyGarment(imageBuffer: Buffer, apiKey: string): Promise<string> {
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
									text: 'Classify this clothing item into exactly ONE of these categories. Respond with ONLY the category name, nothing else: shirt, t-shirt, dress, pants, jeans, jacket, coat, hoodie, sweater, skirt, shorts, blazer, vest, suit, blouse, tank-top, polo, cardigan'
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
						temperature: 0.1,
						maxOutputTokens: 20
					}
				})
			}
		);

		if (!response.ok) {
			log.warn({ status: response.status }, 'Gemini garment classification failed, using default');
			return 'garment';
		}

		const result = await response.json();
		const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || 'garment';
		return text;
	} catch (err) {
		log.warn({ err }, 'Garment classification error, using default');
		return 'garment';
	}
}

// ============================================================================
// GHOST MANNEQUIN GENERATION (Gemini Imagen)
// ============================================================================

/**
 * Build a detailed ghost mannequin prompt following the structured pattern
 * from buildStyleComposerPrompt() in scene-analyst.ts
 */
function buildGhostMannequinPrompt(garmentType: string, background: string): string {
	const bgDescription = background === 'transparent' ? 'transparent' : 'pure white';

	return `Product photography of a ${garmentType} displayed on an invisible mannequin (ghost mannequin effect).

GARMENT:
The ${garmentType} maintains its natural 3D shape as if worn by an invisible person.
All folds, drape, and fabric structure are preserved.
Collar, sleeves, and hem maintain their natural form.

BACKGROUND:
${bgDescription} background, clean and uniform.

LIGHTING:
Professional studio lighting, soft and even.
Gentle shadow beneath the garment suggesting it is floating.
No harsh shadows or hotspots on the fabric.

TECHNICAL:
High resolution, e-commerce product photography.
Sharp focus on fabric details and stitching.
No mannequin visible, no human body, just the floating garment.
No text, no watermarks, no other objects.`;
}

/**
 * Try Imagen 4 predict endpoint (primary method).
 * Note: Imagen 3 (imagen-3.0-generate-002) returned 404 — superseded by Imagen 4.
 * Returns image buffer or null if unavailable.
 */
async function tryImagen3(
	prompt: string,
	apiKey: string
): Promise<{ buffer: Buffer; cost: number } | null> {
	try {
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
						safetyFilterLevel: 'block_only_high'
					}
				})
			}
		);

		if (!response.ok) {
			const errText = await response.text();
			log.warn({ status: response.status, body: errText }, 'Imagen 4 predict endpoint failed');
			return null;
		}

		const result = await response.json();
		const prediction = result.predictions?.[0];
		if (prediction?.bytesBase64Encoded) {
			log.info('Imagen 3 generation succeeded');
			return {
				buffer: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
				cost: 0.004
			};
		}

		log.warn('Imagen 3 returned no image data');
		return null;
	} catch (err) {
		log.warn({ err }, 'Imagen 3 request error');
		return null;
	}
}

/**
 * Try Gemini 2.5 Flash with explicit image response mode (fallback method).
 * Sends the garment cutout image + prompt and requests IMAGE output.
 */
async function tryGeminiFlashImage(
	garmentBuffer: Buffer,
	prompt: string,
	apiKey: string
): Promise<{ buffer: Buffer; cost: number } | null> {
	try {
		const base64Image = garmentBuffer.toString('base64');

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
								{ text: prompt },
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
						responseModalities: ['TEXT', 'IMAGE'],
						temperature: 0.4
					}
				})
			}
		);

		if (!response.ok) {
			const errText = await response.text();
			log.warn({ status: response.status, body: errText }, 'Gemini Flash image generation failed');
			return null;
		}

		const result = await response.json();
		const parts = result.candidates?.[0]?.content?.parts || [];

		for (const part of parts) {
			if (part.inline_data?.data) {
				log.info('Gemini Flash image generation succeeded');
				return {
					buffer: Buffer.from(part.inline_data.data, 'base64'),
					cost: 0.002
				};
			}
		}

		const textResponse = parts.find((p: any) => p.text)?.text || '';
		log.warn({ textResponse }, 'Gemini Flash did not return image data');
		return null;
	} catch (err) {
		log.warn({ err }, 'Gemini Flash image request error');
		return null;
	}
}

/**
 * Generate ghost mannequin image using a tiered approach:
 * 1. Imagen 3 predict endpoint (best quality, $0.004/image)
 * 2. Gemini 2.5 Flash with responseModalities: IMAGE (fallback, $0.002/image)
 * 3. Return garment cutout as-is (final fallback, $0)
 */
async function generateGhostMannequin(
	garmentBuffer: Buffer,
	garmentType: string,
	background: string,
	apiKey: string
): Promise<{ buffer: Buffer; cost: number; method: string }> {
	const prompt = buildGhostMannequinPrompt(garmentType, background);

	// Try 1: Imagen 3 predict endpoint
	const imagen3Result = await tryImagen3(prompt, apiKey);
	if (imagen3Result) {
		return { ...imagen3Result, method: 'imagen3' };
	}

	// Try 2: Gemini 2.5 Flash with image output
	const geminiResult = await tryGeminiFlashImage(garmentBuffer, prompt, apiKey);
	if (geminiResult) {
		return { ...geminiResult, method: 'gemini-flash' };
	}

	// Fallback: return garment cutout as-is
	log.warn('All generation methods failed, returning bg-removed garment cutout');
	return { buffer: garmentBuffer, cost: 0, method: 'fallback' };
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

		// 2. Input validation
		const body = await request.json();
		const validated = invisibleMannequinSchema.parse(body);
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

		log.info({ garment_type: validated.garment_type, background }, 'Starting invisible mannequin pipeline');

		// 3. Fetch the source image
		const imageResponse = await fetch(image_url);
		if (!imageResponse.ok) {
			throw error(400, 'Failed to fetch source image');
		}
		const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

		// 4. Step 1 - Background removal (segment garment)
		log.info('Step 1: Removing background to isolate garment');
		const bgResult = await removeBackgroundAdvanced(imageBuffer, 'default' as ProductType);
		const garmentBuffer = bgResult.buffer;
		const bgCost = 0.018;

		log.info({ quality: (bgResult.qualityScore * 100).toFixed(1) + '%' }, 'Background removal complete');

		// 5. Step 2 - Classify garment type (if not provided)
		let garmentType = validated.garment_type || '';
		if (!garmentType) {
			log.info('Step 2: Auto-detecting garment type with Gemini Flash');
			garmentType = await classifyGarment(garmentBuffer, geminiApiKey);
			log.info({ garmentType }, 'Garment type detected');
		} else {
			// SECURITY: Sanitize user-provided garment type before LLM prompt embedding
			const garmentSanitized = sanitizeAIPrompt(garmentType);
			if (!garmentSanitized.valid) {
				log.warn({ violations: garmentSanitized.violations }, 'Garment type failed prompt sanitization');
				throw error(400, 'Invalid garment type description');
			}
			garmentType = garmentSanitized.sanitized;
			log.info({ garmentType }, 'Using provided garment type (sanitized)');
		}

		// 6. Step 3 - Generate ghost mannequin effect
		log.info('Step 3: Generating ghost mannequin effect (Imagen 3 → Gemini Flash → fallback)');
		const generationResult = await generateGhostMannequin(
			garmentBuffer,
			garmentType,
			background,
			geminiApiKey
		);
		const resultBuffer = generationResult.buffer;
		const imagenCost = generationResult.cost;
		log.info({ method: generationResult.method, cost: `$${imagenCost.toFixed(3)}` }, 'Ghost mannequin generation complete');

		// 7. Upload result to Supabase Storage
		const sharp = (await import('sharp')).default;
		const outputBuffer = await sharp(resultBuffer).png().toBuffer();
		const fileName = `invisible-mannequin-${Date.now()}.png`;
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

		const totalCost = bgCost + imagenCost;

		// Capacity monitoring: log API calls
		recordProviderCall('fal_ai');
		logApiCall(serviceRoleKey, {
			provider: 'fal_ai', operation: 'bg_removal', cost_usd: bgCost,
			duration_ms: 0, status: 'success'
		});
		const genProvider = generationResult.method.includes('imagen') ? 'google_imagen' : 'google_gemini';
		recordProviderCall(genProvider === 'google_imagen' ? 'google_imagen' : 'google_gemini');
		logApiCall(serviceRoleKey, {
			provider: genProvider, operation: 'mannequin_composite', cost_usd: imagenCost,
			duration_ms: 0, status: 'success'
		});

		log.info(
			{ garmentType, totalCost: `$${totalCost.toFixed(3)}`, outputUrl: urlData.publicUrl },
			'Invisible mannequin pipeline complete'
		);

		return json({
			success: true,
			output_url: urlData.publicUrl,
			garment_type: garmentType,
			generation_method: generationResult.method,
			cost_usd: totalCost
		});
	} catch (err: any) {
		if (err.status) throw err;

		log.error({ err }, 'Invisible mannequin processing failed');
		throw error(500, 'Invisible mannequin processing failed');
	}
};
