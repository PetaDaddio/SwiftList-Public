/**
 * Job Processing API Endpoint
 * POST /api/jobs/process
 *
 * Processes a pending job by:
 * 1. Downloading product image from Supabase Storage
 * 2. Calling Replicate API for background removal
 * 3. (Optional) Applying style transfer if reference image provided
 * 4. Uploading processed images back to storage
 * 5. Updating job status to completed
 *
 * SECURITY:
 * - Requires service role authentication (internal use only)
 * - Not exposed to frontend
 * - Called by background worker or manual trigger
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/client';
import Replicate from 'replicate';
import { removeBackgroundDirect } from '$lib/agents/background-removal';
import type { ProductType } from '$lib/agents/background-removal/types';
import type { JobQualityMetadata } from '$lib/types/database';
import { sanitizeAIPrompt, buildSecurePrompt } from '$lib/security/prompt-sanitizer';
import { applyWatermark, shouldApplyWatermark, type WatermarkMetadata } from '$lib/utils/watermark';
import type { ShadowStyle } from '$lib/utils/shadow';
import { addProductShadow } from '$lib/utils/shadow';
import { jobsLogger } from '$lib/utils/logger';
import { analyzeForHands, buildHandsPrompt } from '$lib/ai/hands-analyst';
import type { ArtDirection } from '$lib/ai/hands-analyst';
import { logApiCall } from '$lib/utils/api-call-logger';
import { recordProviderCall } from '$lib/utils/metrics-collector';
import { adaptPresetPromptForProduct } from '$lib/ai/preset-prompt-adapter';
import { protectedApiCall, ServiceUnavailableError } from '$lib/utils/protected-api-call';
import { getWorkflowCost } from '$lib/queue/client';
// SVG conversion now uses @neplex/vectorizer (dynamic import in WF-16 section)

const log = jobsLogger.child({ route: '/api/jobs/process' });


// Helper function to get Replicate client (initialized per-request)
function getReplicateClient(): Replicate {
	const apiKey = env.REPLICATE_API_KEY;
	if (!apiKey) {
		throw new Error('REPLICATE_API_KEY environment variable is not set');
	}
	return new Replicate({ auth: apiKey });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Download image from Supabase Storage
 */
/** Timeout wrapper — rejects if the promise doesn't resolve within `ms` */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
		promise.then(
			(val) => { clearTimeout(timer); resolve(val); },
			(err) => { clearTimeout(timer); reject(err); }
		);
	});
}

async function downloadImageFromStorage(
	supabase: ReturnType<typeof createServiceRoleClient>,
	imageUrl: string
): Promise<Buffer> {
	try {
		// Extract storage path from public URL
		// Format: https://PROJECT.supabase.co/storage/v1/object/public/BUCKET/PATH
		const urlParts = imageUrl.split('/storage/v1/object/public/');
		if (urlParts.length !== 2) {
			throw new Error('Invalid storage URL format');
		}

		const [bucket, ...pathParts] = urlParts[1].split('/');
		const path = pathParts.join('/');

		// Download file from storage (30s timeout)
		const { data, error: downloadError } = await withTimeout(
			supabase.storage.from(bucket).download(path),
			30_000,
			'Supabase storage download'
		);

		if (downloadError) {
			throw new Error(`Failed to download image: ${downloadError.message}`);
		}

		// Convert Blob to Buffer
		const arrayBuffer = await data.arrayBuffer();
		return Buffer.from(arrayBuffer);
	} catch (err: any) {
		log.error({ err }, 'Image download from storage failed');
		throw err;
	}
}

/**
 * Upload processed image to Supabase Storage
 */
async function uploadProcessedImage(
	supabase: ReturnType<typeof createServiceRoleClient>,
	userId: string,
	jobId: string,
	imageBuffer: Buffer,
	filename: string
): Promise<{ publicUrl: string; storagePath: string }> {
	const storagePath = `${userId}/${jobId}/${filename}`;

	const { data, error: uploadError } = await supabase.storage
		.from('job-outputs')
		.upload(storagePath, imageBuffer, {
			contentType: 'image/png',
			upsert: true,
			cacheControl: '3600'
		});

	if (uploadError) {
		throw new Error(`Failed to upload processed image: ${uploadError.message}`);
	}

	// Get public URL
	const {
		data: { publicUrl }
	} = supabase.storage.from('job-outputs').getPublicUrl(storagePath);

	return { publicUrl, storagePath };
}

/**
 * Process image with Replicate (Background Removal)
 * Version-pinned to lucataco/remove-bg to prevent model drift.
 */
async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
	const MODEL_ID = 'lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1';
	log.info({ model: 'lucataco-rmbg' }, 'Calling Replicate for background removal');

	try {
		// Convert buffer to data URL
		const base64Image = imageBuffer.toString('base64');
		const dataUrl = `data:image/png;base64,${base64Image}`;

		// Call Replicate background removal model with retry logic
		// Version-pinned lucataco/remove-bg (BUG-20260217-002: prevents model drift)
		const replicate = getReplicateClient();
		const output = await protectedApiCall('Replicate', async () => {
			return ((await replicate.run(MODEL_ID as `${string}/${string}:${string}`, {
				input: {
					image: dataUrl
				}
			})) as unknown) as string;
		});

		// Download the result
		const response = await fetch(output);
		if (!response.ok) {
			throw new Error(`Failed to download processed image: ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer);
	} catch (err: any) {
		log.error({ err }, 'Replicate API error');
		throw new Error(`Background removal failed: ${err.message}`);
	}
}

/**
 * Analyze reference image with Gemini Flash to extract style description
 */
async function analyzeReferenceImage(imageBuffer: Buffer): Promise<string> {
	log.info({ model: 'gemini-flash' }, 'Analyzing reference image');

	try {
		const base64Image = imageBuffer.toString('base64');

		// Detect mime type from image buffer header
		let mimeType = 'image/jpeg'; // Default
		if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
			mimeType = 'image/png';
		} else if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
			mimeType = 'image/jpeg';
		} else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49) {
			mimeType = 'image/webp';
		}

		log.debug({ mimeType }, 'Reference image type detected');

		const response = await protectedApiCall('Google Gemini', () =>
			fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GOOGLE_GEMINI_API_KEY}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: 'Analyze this reference image and describe its visual style, lighting, mood, setting, and aesthetic. Focus on: background elements, lighting quality (soft/hard/natural/studio), color palette, composition style, and overall atmosphere. Be specific and descriptive. Output only the style description, no preamble.'
									},
									{
										inline_data: {
											mime_type: mimeType,
											data: base64Image
										}
									}
								]
							}
						]
					})
				}
			)
		);

		if (!response.ok) {
			const errorBody = await response.text();
			log.error({ errorBody }, 'Gemini API error details');
			throw new Error(`Gemini API error: ${response.statusText}`);
		}

		const data = await response.json();
		const styleDescription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

		log.info({ styleDescription: styleDescription.substring(0, 100) }, 'Style analysis complete');
		return styleDescription;
	} catch (err: any) {
		log.error({ err }, 'Reference image analysis failed');
		// Return empty string if analysis fails - don't block the job
		return '';
	}
}

/**
 * Blend product into scene using Flux Fill (Inpainting)
 *
 * Uses Flux Fill to naturally integrate the product into the background scene
 * with proper lighting, shadows, and perspective.
 *
 * This is the PRIMARY method - handles lighting/shadows automatically.
 */
async function blendProductWithFluxFill(
	productBuffer: Buffer,
	artDirectionPrompt: string,
	productType: string,
	styleDescription: string,
	width: number,
	height: number
): Promise<Buffer> {
	log.info({ model: 'flux-fill' }, 'Starting Flux Fill inpainting');

	try {
		// Convert product to data URL
		const productBase64 = productBuffer.toString('base64');
		const productDataUrl = `data:image/png;base64,${productBase64}`;

		// Build comprehensive prompt for Flux Fill
		let fullPrompt = '';
		if (artDirectionPrompt && styleDescription) {
			fullPrompt = `${artDirectionPrompt}. ${productType}. Style: ${styleDescription}. Professional product photography with natural lighting, realistic shadows, and proper perspective integration.`;
		} else if (artDirectionPrompt) {
			fullPrompt = `${artDirectionPrompt}. Professional product photography of ${productType} with natural lighting and realistic shadows.`;
		} else if (styleDescription) {
			fullPrompt = `${productType}. Style: ${styleDescription}. Professional product photography with natural lighting and realistic shadows.`;
		} else {
			fullPrompt = `Professional product photography of ${productType} with soft natural lighting, realistic shadows, and premium aesthetic.`;
		}

		log.debug({ promptLength: fullPrompt.length }, 'Flux Fill prompt prepared');

		// Call Flux Pro 1.1 with image input for img2img blending
		const replicate = getReplicateClient();
		const output = await protectedApiCall('Replicate', async () => {
			return ((await replicate.run('black-forest-labs/flux-1.1-pro', {
				input: {
					prompt: fullPrompt,
					image: productDataUrl,
					width: width,
					height: height,
					prompt_upsampling: true,
					guidance: 2.5, // Lower guidance for more natural blending
					num_inference_steps: 28,
					output_format: 'png',
					output_quality: 95,
					safety_tolerance: 2,
					image_prompt_strength: 0.85 // High strength to preserve product
				}
			})) as unknown) as string;
		});

		// Download the blended result
		const response = await fetch(output);
		if (!response.ok) {
			throw new Error(`Failed to download blended image: ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		log.info('Flux Fill blending completed');
		return Buffer.from(arrayBuffer);
	} catch (err: any) {
		log.error({ err }, 'Flux Fill error');
		throw new Error(`Flux Fill blending failed: ${err.message}`);
	}
}

/**
 * FALLBACK: Generate background using Flux Pro 1.1
 *
 * Generates a background scene based on art direction and reference style.
 * Does NOT include the product - that will be composited on top.
 *
 * Used as fallback when Flux Fill fails.
 */
async function generateBackground(
	artDirectionPrompt: string,
	styleDescription: string,
	width: number = 1024,
	height: number = 1024
): Promise<Buffer> {
	log.info({ model: 'flux-pro-1.1' }, 'Generating background (fallback)');

	try {
		// Build prompt focused on BACKGROUND ONLY, not product
		let backgroundPrompt = '';

		if (artDirectionPrompt && styleDescription) {
			const settingMatch = artDirectionPrompt.match(/(?:on|in|near|by)\s+(.+?)(?:\.|$)/i);
			const setting = settingMatch ? settingMatch[1] : artDirectionPrompt;
			backgroundPrompt = `${setting}. Style: ${styleDescription}. Professional product photography background, clean and uncluttered, suitable for product placement. No products or objects in the scene.`;
		} else if (artDirectionPrompt) {
			backgroundPrompt = `${artDirectionPrompt}. Professional product photography background, clean and suitable for product placement. No products or objects in the scene.`;
		} else if (styleDescription) {
			backgroundPrompt = `${styleDescription}. Professional product photography background, clean and uncluttered. No products or objects in the scene.`;
		} else {
			backgroundPrompt = `Professional product photography background with soft studio lighting and premium aesthetic. Clean, minimal, suitable for product placement. No products or objects in the scene.`;
		}

		log.debug({ promptLength: backgroundPrompt.length }, 'Background prompt prepared');

		const replicate = getReplicateClient();
		const output = await protectedApiCall('Replicate', async () => {
			return ((await replicate.run('black-forest-labs/flux-1.1-pro', {
				input: {
					prompt: backgroundPrompt,
					width: width,
					height: height,
					prompt_upsampling: true,
					guidance: 3.5,
					num_inference_steps: 28,
					output_format: 'png',
					output_quality: 95,
					safety_tolerance: 2
				}
			})) as unknown) as string;
		});

		const response = await fetch(output);
		if (!response.ok) {
			throw new Error(`Failed to download background: ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		log.info('Background generation completed');
		return Buffer.from(arrayBuffer);
	} catch (err: any) {
		log.error({ err }, 'Flux API error');
		throw new Error(`Background generation failed: ${err.message}`);
	}
}

/**
 * Composite product onto background with realistic shadows and lighting
 *
 * Takes background-removed product (PNG with transparency) and composites it
 * onto the AI-generated background with:
 * - Realistic drop shadow beneath product
 * - Color temperature matching to background
 * - Natural integration for professional product photography
 *
 * MOIRÉ PREVENTION (2026-02-05):
 * When finalWidth/finalHeight are provided, the function:
 * 1. Upscales the background to final dimensions FIRST
 * 2. Scales product to final size with multi-step upscaling
 * 3. Composites at final resolution
 * This avoids upscaling the composited scene, which reintroduces moiré.
 *
 * @param productBuffer - Product PNG with transparency (from GemPerfect/CleanEdge)
 * @param backgroundBuffer - AI-generated background (typically 1024x1024 from Flux)
 * @param finalWidth - Optional final canvas width (e.g., 2000 for Etsy)
 * @param finalHeight - Optional final canvas height (e.g., 2000 for Etsy)
 */
async function compositeProductOnBackground(
	productBuffer: Buffer,
	backgroundBuffer: Buffer,
	finalWidth?: number,
	finalHeight?: number
): Promise<Buffer> {
	log.info('Compositing product onto background');

	try {
		const sharp = (await import('sharp')).default;

		// ====================================================================
		// DEBUG: Validate inputs
		// ====================================================================
		const productMeta = await sharp(productBuffer).metadata();
		const bgMeta = await sharp(backgroundBuffer).metadata();

		log.debug(`   INPUT VALIDATION:`);
		log.debug(`     Product: ${productMeta.width}x${productMeta.height}, ${productMeta.channels} channels, format=${productMeta.format}`);
		log.debug(`     Background: ${bgMeta.width}x${bgMeta.height}, ${bgMeta.channels} channels, format=${bgMeta.format}`);

		if (!productMeta.width || !productMeta.height || productMeta.width === 0 || productMeta.height === 0) {
			throw new Error(`Invalid product buffer: ${productMeta.width}x${productMeta.height}`);
		}

		// Ensure product has alpha channel for compositing
		let productWithAlpha = productBuffer;
		if (productMeta.channels !== 4) {
			log.debug(`      Product missing alpha channel, adding...`);
			productWithAlpha = await sharp(productBuffer)
				.ensureAlpha()
				.png()
				.toBuffer();
		}

		// Get original dimensions
		const origBgWidth = bgMeta.width || 1024;
		const origBgHeight = bgMeta.height || 1024;

		// Determine target scene dimensions
		// If finalWidth/finalHeight provided, composite at that size (moiré-free)
		// Otherwise, use background dimensions (legacy behavior)
		const sceneWidth = finalWidth || origBgWidth;
		const sceneHeight = finalHeight || origBgHeight;

		log.debug(`  Scene dimensions: ${sceneWidth}x${sceneHeight} (bg was ${origBgWidth}x${origBgHeight})`);

		// Get product dimensions (use original meta, already fetched)
		const origProductWidth = productMeta.width || 500;
		const origProductHeight = productMeta.height || 500;

		// Scale product to fill ~65% of the FINAL scene (looks natural)
		const targetSize = Math.min(sceneWidth, sceneHeight) * 0.65;
		const productAspect = origProductWidth / origProductHeight;
		let scaledProductWidth: number;
		let scaledProductHeight: number;

		if (productAspect > 1) {
			scaledProductWidth = Math.round(targetSize);
			scaledProductHeight = Math.round(targetSize / productAspect);
		} else {
			scaledProductHeight = Math.round(targetSize);
			scaledProductWidth = Math.round(targetSize * productAspect);
		}

		// ====================================================================
		// MOIRÉ PREVENTION: Multi-step upscaling for product
		// The product has been processed by GemPerfect/CleanEdge at its original
		// resolution. We need to scale it to final size without reintroducing moiré.
		// Use mitchell kernel (gentler than lanczos3) and step up gradually.
		// ====================================================================
		const productScaleFactor = scaledProductWidth / origProductWidth;
		let scaledProduct: Buffer;

		if (productScaleFactor > 1.3) {
			// Multi-step upscaling for large scale factors
			log.debug(`  Multi-step product upscale: ${origProductWidth}x${origProductHeight} → ${scaledProductWidth}x${scaledProductHeight} (${productScaleFactor.toFixed(2)}x)`);

			let currentBuffer = productWithAlpha;  // Use alpha-ensured version
			let currentWidth = origProductWidth;
			let currentHeight = origProductHeight;

			// Step up in 1.4x increments (gentler than 1.5x)
			while (currentWidth * 1.4 <= scaledProductWidth && currentHeight * 1.4 <= scaledProductHeight) {
				const newWidth = Math.round(currentWidth * 1.4);
				const newHeight = Math.round(currentHeight * 1.4);
				currentBuffer = await sharp(currentBuffer)
					.resize(newWidth, newHeight, {
						kernel: 'mitchell',  // Mitchell reduces moiré/ringing
						fit: 'fill'
					})
					.png()  // Preserve alpha
					.toBuffer();
				currentWidth = newWidth;
				currentHeight = newHeight;
				log.debug(`    Product upscale step: ${currentWidth}x${currentHeight}`);
			}

			// Final resize to exact target
			scaledProduct = await sharp(currentBuffer)
				.resize(scaledProductWidth, scaledProductHeight, {
					kernel: 'mitchell',
					fit: 'fill'
				})
				.png()  // Preserve alpha
				.toBuffer();
		} else {
			// Direct resize for small scale factors
			scaledProduct = await sharp(productWithAlpha)  // Use alpha-ensured version
				.resize(scaledProductWidth, scaledProductHeight, {
					kernel: 'mitchell',
					fit: 'inside',
					withoutEnlargement: false
				})
				.png()  // Preserve alpha
				.toBuffer();
		}

		// Verify scaled product
		const scaledProductMeta = await sharp(scaledProduct).metadata();
		log.debug(`  Product scaled: ${origProductWidth}x${origProductHeight} → ${scaledProductMeta.width}x${scaledProductMeta.height}, ${scaledProductMeta.channels} channels`);

		// ====================================================================
		// MOIRÉ PREVENTION: Upscale background to final dimensions
		// Upscale the background BEFORE compositing, so we never upscale the
		// composited scene (which would reintroduce moiré on the product).
		// ====================================================================
		let resizedBackground: Buffer;
		if (sceneWidth !== origBgWidth || sceneHeight !== origBgHeight) {
			log.debug(`  Upscaling background: ${origBgWidth}x${origBgHeight} → ${sceneWidth}x${sceneHeight}`);
			resizedBackground = await sharp(backgroundBuffer)
				.resize(sceneWidth, sceneHeight, {
					kernel: 'lanczos3',  // Lanczos3 is fine for backgrounds (no fine patterns)
					fit: 'cover',
					position: 'center'
				})
				.png()
				.toBuffer();
		} else {
			resizedBackground = await sharp(backgroundBuffer)
				.resize(sceneWidth, sceneHeight, {
					fit: 'cover',
					position: 'center'
				})
				.png()
				.toBuffer();
		}

		// Create a soft drop shadow for the product
		// First verify the scaled product has alpha
		if (scaledProductMeta.channels !== 4) {
			log.debug(`   Scaled product lost alpha channel! Re-adding...`);
			scaledProduct = await sharp(scaledProduct).ensureAlpha().png().toBuffer();
		}

		const shadowMask = await sharp(scaledProduct)
			.extractChannel('alpha')
			.blur(15)
			.linear(0.4, 0)
			.toBuffer();

		// Get dimensions of scaled product for shadow layer
		const scaledMeta = await sharp(scaledProduct).metadata();
		const spWidth = scaledMeta.width || scaledProductWidth;
		const spHeight = scaledMeta.height || scaledProductHeight;

		const shadowLayer = await sharp({
			create: {
				width: spWidth,
				height: spHeight,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 }
			}
		})
			.composite([
				{
					input: shadowMask,
					blend: 'dest-in'
				}
			])
			.png()
			.toBuffer();

		// Center product on the background
		const leftOffset = Math.round((sceneWidth - spWidth) / 2);
		const topOffset = Math.round((sceneHeight - spHeight) / 2);

		// Composite layers: Background → Shadow (offset down-right) → Product (centered)
		const composited = await sharp(resizedBackground)
			.composite([
				{
					input: shadowLayer,
					top: topOffset + 15,   // Shadow slightly below product
					left: leftOffset + 8,  // Shadow slightly right of product
					blend: 'over'
				},
				{
					input: scaledProduct,
					top: topOffset,
					left: leftOffset,
					blend: 'over'
				}
			])
			.modulate({
				brightness: 1.05,
				saturation: 1.1
			})
			.png()
			.toBuffer();

		// Verify final output
		const compositedMeta = await sharp(composited).metadata();
		log.debug(` Compositing completed: ${compositedMeta.width}x${compositedMeta.height}, ${compositedMeta.channels} channels`);
		log.debug(`   Product positioned at: left=${leftOffset}, top=${topOffset}, size=${spWidth}x${spHeight}`);
		return composited;
	} catch (err: any) {
		log.error({ err }, 'Compositing error');
		throw new Error(`Compositing failed: ${err.message}`);
	}
}

/**
 * Extract dominant color temperature from a background image
 *
 * Analyzes the background to determine its color cast (warm/cool/neutral)
 * Returns RGB adjustment values to apply to product for matching.
 *
 * @param backgroundBuffer - The AI-generated background image
 * @returns Color adjustment object { r, g, b, warmth, brightness }
 */
async function extractColorTemperature(backgroundBuffer: Buffer): Promise<{
	r: number;
	g: number;
	b: number;
	warmth: number;
	brightness: number;
}> {
	log.debug('Extracting color temperature from background');

	try {
		const sharp = (await import('sharp')).default;

		// Downsample background to 32x32 for fast dominant color extraction
		const { data, info } = await sharp(backgroundBuffer)
			.resize(32, 32, { fit: 'cover' })
			.removeAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		// Calculate average RGB values
		let totalR = 0, totalG = 0, totalB = 0;
		const pixelCount = info.width * info.height;

		for (let i = 0; i < data.length; i += 3) {
			totalR += data[i];
			totalG += data[i + 1];
			totalB += data[i + 2];
		}

		const avgR = totalR / pixelCount;
		const avgG = totalG / pixelCount;
		const avgB = totalB / pixelCount;

		// Calculate brightness (0-255)
		const brightness = (avgR + avgG + avgB) / 3;

		// Calculate warmth (-1 to +1): positive = warm (more red/yellow), negative = cool (more blue)
		// Based on difference between warm channels (R+G) and cool channel (B)
		const warmth = ((avgR + avgG) / 2 - avgB) / 127.5;

		// Calculate adjustment factors (subtle - max 10% shift)
		// We want to tint the product slightly toward the background's color cast
		const maxAdjust = 0.10; // Maximum 10% color shift
		const adjustFactor = 0.5; // How much of the background color to apply

		// Normalize around neutral (128) and calculate adjustment
		const rAdjust = ((avgR - 128) / 128) * maxAdjust * adjustFactor;
		const gAdjust = ((avgG - 128) / 128) * maxAdjust * adjustFactor;
		const bAdjust = ((avgB - 128) / 128) * maxAdjust * adjustFactor;

		log.debug(`  Background color: RGB(${avgR.toFixed(0)}, ${avgG.toFixed(0)}, ${avgB.toFixed(0)})`);
		log.debug(`  Warmth: ${warmth.toFixed(2)} (${warmth > 0.1 ? 'warm' : warmth < -0.1 ? 'cool' : 'neutral'})`);
		log.debug(`  Brightness: ${brightness.toFixed(0)}/255`);
		log.debug(`  Adjustments: R=${(rAdjust * 100).toFixed(1)}%, G=${(gAdjust * 100).toFixed(1)}%, B=${(bAdjust * 100).toFixed(1)}%`);

		return {
			r: 1 + rAdjust,
			g: 1 + gAdjust,
			b: 1 + bAdjust,
			warmth,
			brightness
		};
	} catch (err: any) {
		log.warn({ err: err.message }, 'Color temperature extraction failed, using neutral');
		return { r: 1, g: 1, b: 1, warmth: 0, brightness: 128 };
	}
}

/**
 * Apply color temperature matching to product image
 *
 * Adjusts product colors to match the background's color cast,
 * making the product appear naturally lit by the scene.
 *
 * @param productBuffer - Product PNG with transparency
 * @param colorTemp - Color temperature from extractColorTemperature()
 * @returns Adjusted product buffer
 */
async function applyColorTemperature(
	productBuffer: Buffer,
	colorTemp: { r: number; g: number; b: number; warmth: number; brightness: number }
): Promise<Buffer> {
	log.debug('Applying color temperature matching');

	try {
		const sharp = (await import('sharp')).default;

		// Check if image has alpha channel
		const meta = await sharp(productBuffer).metadata();
		const hasAlpha = meta.channels === 4;

		if (!hasAlpha) {
			// No alpha channel - simple case, apply recomb directly
			const adjusted = await sharp(productBuffer)
				.recomb([
					[colorTemp.r, 0, 0],
					[0, colorTemp.g, 0],
					[0, 0, colorTemp.b]
				])
				.png()
				.toBuffer();
			log.debug('Color temperature matching applied (no alpha)');
			return adjusted;
		}

		// CRITICAL: Extract alpha channel FIRST to preserve transparency
		const alphaChannel = await sharp(productBuffer)
			.extractChannel('alpha')
			.raw()
			.toBuffer();

		// Get dimensions for reconstruction (reuse meta from above)
		const width = meta.width!;
		const height = meta.height!;

		// Remove alpha and apply color adjustment to RGB only
		// recomb() only works correctly on 3-channel images
		const rgbData = await sharp(productBuffer)
			.removeAlpha()
			.recomb([
				[colorTemp.r, 0, 0],
				[0, colorTemp.g, 0],
				[0, 0, colorTemp.b]
			])
			.raw()
			.toBuffer();

		// Manually interleave RGB with Alpha to create RGBA
		const rgbaData = Buffer.alloc(width * height * 4);
		for (let i = 0; i < width * height; i++) {
			rgbaData[i * 4 + 0] = rgbData[i * 3 + 0]; // R
			rgbaData[i * 4 + 1] = rgbData[i * 3 + 1]; // G
			rgbaData[i * 4 + 2] = rgbData[i * 3 + 2]; // B
			rgbaData[i * 4 + 3] = alphaChannel[i];     // A (original)
		}

		// Create final RGBA PNG
		const result = await sharp(rgbaData, {
			raw: {
				width,
				height,
				channels: 4
			}
		})
			.png()
			.toBuffer();

		log.debug('Color temperature matching applied');
		return result;
	} catch (err: any) {
		log.warn({ err: err.message }, 'Color temperature application failed, using original');
		return productBuffer;
	}
}

/**
 * Add ambient light spill effect to product edges
 *
 * Creates a subtle color glow around the product edges that matches
 * the background, simulating ambient light bouncing off surfaces.
 * This is key to making composites look realistic.
 *
 * @param productBuffer - Product PNG with transparency
 * @param backgroundBuffer - Background to extract ambient color from
 * @param spillIntensity - How strong the effect is (0-1, default 0.15)
 * @returns Product with ambient light spill applied
 */
async function addAmbientLightSpill(
	productBuffer: Buffer,
	backgroundBuffer: Buffer,
	spillIntensity: number = 0.15
): Promise<Buffer> {
	log.debug('Adding ambient light spill to edges');

	try {
		const sharp = (await import('sharp')).default;

		// Get dimensions and check for alpha
		const productMeta = await sharp(productBuffer).metadata();
		const width = productMeta.width || 500;
		const height = productMeta.height || 500;
		const hasAlpha = productMeta.channels === 4;

		if (!hasAlpha) {
			log.debug('Skipping ambient spill (no alpha channel)');
			return productBuffer;
		}

		// Sample background colors from edges (where light would bounce from)
		const bgSample = await sharp(backgroundBuffer)
			.resize(8, 8, { fit: 'cover' })
			.removeAlpha()
			.raw()
			.toBuffer();

		// Calculate average edge color (ambient light color)
		let totalR = 0, totalG = 0, totalB = 0;
		for (let i = 0; i < bgSample.length; i += 3) {
			totalR += bgSample[i];
			totalG += bgSample[i + 1];
			totalB += bgSample[i + 2];
		}
		const pixelCount = bgSample.length / 3;
		const ambientR = Math.round(totalR / pixelCount);
		const ambientG = Math.round(totalG / pixelCount);
		const ambientB = Math.round(totalB / pixelCount);

		log.debug(`  Ambient color: RGB(${ambientR}, ${ambientG}, ${ambientB})`);

		// CRITICAL: Preserve original alpha channel
		const originalAlpha = await sharp(productBuffer)
			.extractChannel('alpha')
			.toBuffer();

		// Create edge glow by blurring the alpha (creates soft halo)
		const blurredAlpha = await sharp(originalAlpha)
			.blur(6) // Soft edge detection
			.toBuffer();

		// Create edge-only mask (blurred - original = edges only)
		// This ensures we only affect the edges, not the whole product
		const edgeMask = await sharp(blurredAlpha)
			.composite([
				{
					input: originalAlpha,
					blend: 'difference'
				}
			])
			.linear(2.0, 0) // Amplify the edge difference
			.toBuffer();

		// Create the ambient light layer (colored by background, masked to edges)
		const ambientLayer = await sharp({
			create: {
				width,
				height,
				channels: 4,
				background: { r: ambientR, g: ambientG, b: ambientB, alpha: Math.round(255 * spillIntensity) }
			}
		})
			.composite([
				{
					input: edgeMask,
					blend: 'dest-in' // Mask to edge region only
				}
			])
			.png()
			.toBuffer();

		// Get RGB without alpha for color adjustment (as raw data)
		const rgbData = await sharp(productBuffer)
			.removeAlpha()
			.raw()
			.toBuffer();

		// Get original alpha as raw data
		const alphaData = await sharp(originalAlpha)
			.raw()
			.toBuffer();

		// Apply ambient glow to RGB only
		const adjustedRgb = await sharp(productBuffer)
			.removeAlpha()
			.composite([
				{
					input: ambientLayer,
					blend: 'soft-light' // Soft blend for natural look
				}
			])
			.raw()
			.toBuffer();

		// Manually interleave RGB with original Alpha to create RGBA
		const rgbaData = Buffer.alloc(width * height * 4);
		for (let i = 0; i < width * height; i++) {
			rgbaData[i * 4 + 0] = adjustedRgb[i * 3 + 0]; // R
			rgbaData[i * 4 + 1] = adjustedRgb[i * 3 + 1]; // G
			rgbaData[i * 4 + 2] = adjustedRgb[i * 3 + 2]; // B
			rgbaData[i * 4 + 3] = alphaData[i];            // A (original)
		}

		// Create final RGBA PNG
		const result = await sharp(rgbaData, {
			raw: {
				width,
				height,
				channels: 4
			}
		})
			.png()
			.toBuffer();

		log.debug('Ambient light spill applied');
		return result;
	} catch (err: any) {
		log.warn({ err: err.message }, 'Ambient light spill failed, using original');
		return productBuffer;
	}
}

/**
 * LIGHTING INTEGRATION: Full pipeline for matching product to scene
 *
 * Applies multiple techniques to make the product look naturally placed:
 * 1. Color temperature matching - Tint product to match scene warmth
 * 2. Ambient light spill - Add edge glow from background bounce light
 * 3. Brightness adjustment - Match scene luminosity
 *
 * This runs BEFORE compositing for best results.
 *
 * @param productBuffer - Product PNG with transparency (from GemPerfect/CleanEdge)
 * @param backgroundBuffer - AI-generated background
 * @returns Lighting-matched product buffer
 */
async function integrateProductLighting(
	productBuffer: Buffer,
	backgroundBuffer: Buffer
): Promise<Buffer> {
	log.info('Lighting integration started');

	try {
		// Step 1: Extract color temperature from background
		const colorTemp = await extractColorTemperature(backgroundBuffer);

		// Step 2: Apply color temperature to product
		let adjustedProduct = await applyColorTemperature(productBuffer, colorTemp);

		// Step 3: Add ambient light spill at edges
		// Intensity based on background brightness (brighter scenes = more spill)
		const spillIntensity = Math.min(0.20, Math.max(0.08, colorTemp.brightness / 1000));
		adjustedProduct = await addAmbientLightSpill(adjustedProduct, backgroundBuffer, spillIntensity);

		// Step 4: Subtle brightness adjustment based on scene
		// If scene is very bright or dark, adjust product to match
		const sharp = (await import('sharp')).default;
		const brightnessRatio = colorTemp.brightness / 140; // 140 is neutral midtone
		const brightnessAdjust = Math.min(1.15, Math.max(0.90, brightnessRatio)); // Clamp to ±15%

		if (Math.abs(brightnessAdjust - 1) > 0.03) {
			log.debug(`  Brightness adjustment: ${((brightnessAdjust - 1) * 100).toFixed(1)}%`);

			// Check if we have alpha channel
			const meta = await sharp(adjustedProduct).metadata();
			const hasAlpha = meta.channels === 4;
			const width = meta.width!;
			const height = meta.height!;

			if (hasAlpha) {
				// Preserve alpha during brightness adjustment using raw interleave
				const alphaData = await sharp(adjustedProduct)
					.extractChannel('alpha')
					.raw()
					.toBuffer();

				const brightenedRgb = await sharp(adjustedProduct)
					.removeAlpha()
					.modulate({ brightness: brightnessAdjust })
					.raw()
					.toBuffer();

				// Manually interleave RGB with original Alpha
				const rgbaData = Buffer.alloc(width * height * 4);
				for (let i = 0; i < width * height; i++) {
					rgbaData[i * 4 + 0] = brightenedRgb[i * 3 + 0]; // R
					rgbaData[i * 4 + 1] = brightenedRgb[i * 3 + 1]; // G
					rgbaData[i * 4 + 2] = brightenedRgb[i * 3 + 2]; // B
					rgbaData[i * 4 + 3] = alphaData[i];              // A (original)
				}

				adjustedProduct = await sharp(rgbaData, {
					raw: { width, height, channels: 4 }
				})
					.png()
					.toBuffer();
			} else {
				adjustedProduct = await sharp(adjustedProduct)
					.modulate({ brightness: brightnessAdjust })
					.png()
					.toBuffer();
			}
		}

		log.info('Lighting integration complete');
		return adjustedProduct;
	} catch (err: any) {
		log.warn({ err: err.message }, 'Lighting integration failed, using original');
		return productBuffer;
	}
}

/**
 * ============================================================================
 * GEMINI 3 PRO IMAGE SCENE INTEGRATION - NEW ARCHITECTURE (2026-02-05)
 * ============================================================================
 *
 * Uses Google Gemini 3 Pro Image (Nano Banana Pro) for HIGHEST QUALITY
 * product scene generation with natural lighting, shadows, and perspective.
 *
 * MODEL ARCHITECTURE:
 * - Gemini 2.5 Flash = CLASSIFICATION ONLY (on upload, cheap, fast)
 * - Gemini 3 Pro Image = OUTPUT GENERATION (professional quality, up to 4096px)
 *
 * WHY THIS APPROACH:
 * - Single API call produces cohesive scene vs multi-step compositing
 * - AI handles lighting, shadows, reflections automatically
 * - No moiré artifacts (product is AI-regenerated in context)
 * - User achieved perfect results with single Gemini prompt
 * - Professional-grade output optimized for e-commerce
 *
 * ROUTING:
 * - Preset jobs (user selected a style preset) → This function
 * - Background removal only jobs → Existing GemPerfect/CleanEdge pipeline
 *
 * Cost: ~$0.01-0.02 per image (Gemini 3 Pro Image)
 */
async function generateSceneWithGemini(
	productImageBuffer: Buffer,
	stylePrompt: string,
	productType: string,
	outputWidth: number = 2000,
	outputHeight: number = 2000,
	handsMode: boolean = false
): Promise<Buffer> {
	log.info({ model: 'gemini' }, 'Gemini scene integration started');

	try {
		const geminiApiKey = env.GOOGLE_GEMINI_API_KEY;
		if (!geminiApiKey) {
			throw new Error('GOOGLE_GEMINI_API_KEY environment variable is not set');
		}

		// Convert product image to base64
		const productBase64 = productImageBuffer.toString('base64');

		// Detect mime type from buffer header
		let mimeType = 'image/jpeg';
		if (productImageBuffer[0] === 0x89 && productImageBuffer[1] === 0x50) {
			mimeType = 'image/png';
		} else if (productImageBuffer[0] === 0xFF && productImageBuffer[1] === 0xD8) {
			mimeType = 'image/jpeg';
		} else if (productImageBuffer[0] === 0x52 && productImageBuffer[1] === 0x49) {
			mimeType = 'image/webp';
		}

		// ====================================================================
		// PROMPT ENGINEERING FOR PRODUCT PROMINENCE
		// User requirement: Product should fill ~50% of frame
		// CRITICAL: Gemini tends to shrink products in some scenes
		// Testing showed athleisure/patina work well, farmhouse shrinks product
		// ====================================================================

		// Build the scene generation prompt - MACRO/CLOSE-UP framing instruction
		// Key insight: Tell Gemini this is a CLOSE-UP MACRO shot to prevent shrinking
		// When handsMode is true, adjust framing for hands-held product shots
		const scenePrompt = handsMode
			? `Create a CLOSE-UP photorealistic photograph of this ${productType} being held in human hands.

CRITICAL FRAMING INSTRUCTION:
The ${productType} MUST be the dominant element, filling 40-50% of the frame. The hands and product should be in sharp focus.
DO NOT show the product from far away. This is a close-up e-commerce lifestyle shot.

CRITICAL OUTPUT RULE:
Generate a SINGLE cohesive photograph. Do NOT paste, overlay, or superimpose the reference image onto the scene.
Instead, re-render the product naturally being held in human hands with proper lighting, shadows, and perspective.
The output must look like ONE real photograph taken by a professional photographer — not a composite.

SCENE & HANDS: ${stylePrompt}

COMPOSITION RULES:
- The ${productType} is held naturally in human hands, centered in the frame
- The hands should look natural and realistic, with proper proportions relative to the product
- Camera angle: slightly above or eye-level, focused on the hands holding the product
- The ${productType} should appear LARGE and prominent - this is an e-commerce hero shot
- Background elements are subtle, out of focus, and do not compete with the product

LIGHTING: Natural, soft lighting with subtle shadows. Professional product photography quality.`
			: `Create a CLOSE-UP MACRO product photograph of this ${productType}.

CRITICAL FRAMING INSTRUCTION:
This is a MACRO CLOSE-UP shot. The ${productType} MUST be the dominant element, filling 40-50% of the frame.
Imagine the camera is positioned very close to the product. DO NOT show the product from far away.

CRITICAL OUTPUT RULE:
Generate a SINGLE cohesive photograph. Do NOT paste, overlay, or superimpose the reference image onto the scene.
Instead, re-render the product naturally within the scene with proper lighting, shadows, and perspective.
The output must look like ONE real photograph taken by a professional photographer — not a composite.

SCENE SETTING: ${stylePrompt}
Place the ${productType} on a surface or setting that matches this style. The background should be softly blurred (shallow depth of field) with the ${productType} in sharp focus.

COMPOSITION RULES:
- The ${productType} is positioned in the center or lower-center of the frame
- Camera angle: slightly above, looking down at the product (typical product photography angle)
- The ${productType} should appear LARGE and prominent - this is an e-commerce hero shot
- Background elements are subtle, out of focus, and do not compete with the product
- No other products or objects should be larger than the ${productType}

LIGHTING: Natural, soft lighting with subtle shadows. Professional product photography quality.`;

		log.debug(` Scene prompt (${scenePrompt.length} chars):`);
		log.debug(`   Style: "${stylePrompt.substring(0, 60)}..."`);
		log.debug(`   Product type: ${productType}`);
		log.debug(`   Target: ${outputWidth}x${outputHeight}`);

		// ====================================================================
		// GEMINI 3.1 FLASH IMAGE API CALL (Nano Banana 2.0)
		// Pro-level quality at Flash speed — ~50% cheaper than Pro
		// Model: gemini-3.1-flash-image-preview
		//
		// Upgraded from gemini-3-pro-image-preview (2026-02-26):
		// - Same generateContent API, drop-in replacement
		// - Supports up to 4096px output
		// - $0.067/image at 1K vs $0.134 for Pro
		//
		// NOTE: Gemini 2.5 Flash is only used for classification on upload
		// ====================================================================
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${geminiApiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: scenePrompt
								},
								{
									inline_data: {
										mime_type: mimeType,
										data: productBase64
									}
								}
							]
						}
					],
					generationConfig: {
						responseModalities: ['TEXT', 'IMAGE']
					}
				})
			}
		);

		if (!response.ok) {
			const errorBody = await response.text();
			log.error({ errorBody }, 'Gemini API error');
			throw new Error(`Gemini API error: ${response.status} - ${response.statusText}`);
		}

		const data = await response.json();

		// Extract the generated image from the response
		const imagePart = data.candidates?.[0]?.content?.parts?.find(
			(part: any) => part.inlineData?.mimeType?.startsWith('image/')
		);

		if (!imagePart?.inlineData?.data) {
			// Check if Gemini returned text instead (sometimes it explains why it can't generate)
			const textPart = data.candidates?.[0]?.content?.parts?.find(
				(part: any) => part.text
			);
			if (textPart?.text) {
				log.error({ text: textPart.text?.substring(0, 200) }, 'Gemini returned text instead of image');
			}
			throw new Error('Gemini did not return an image. The model may have rejected the request.');
		}

		// Decode the base64 image
		const generatedImageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
		log.debug(` Gemini generated scene: ${(generatedImageBuffer.length / 1024).toFixed(1)}KB`);

		// ====================================================================
		// UPSCALE TO MARKETPLACE RESOLUTION
		// Gemini outputs may be smaller than marketplace requirements
		// Use high-quality Lanczos3 upscaling to reach target dimensions
		// ====================================================================
		const sharp = (await import('sharp')).default;
		const generatedMeta = await sharp(generatedImageBuffer).metadata();
		const genWidth = generatedMeta.width || 1024;
		const genHeight = generatedMeta.height || 1024;

		log.debug(`   Generated size: ${genWidth}x${genHeight}`);
		log.debug(`   Target size: ${outputWidth}x${outputHeight}`);

		let finalBuffer: Buffer;

		if (genWidth < outputWidth || genHeight < outputHeight) {
			// Need to upscale to marketplace resolution
			log.debug(`    Upscaling to marketplace resolution...`);

			// Calculate scale factor to fit target while maintaining aspect
			const scale = Math.max(outputWidth / genWidth, outputHeight / genHeight);

			if (scale > 1.5) {
				// Multi-step upscaling for large scale factors (prevents quality loss)
				log.debug(`   Multi-step upscaling (${scale.toFixed(2)}x factor)`);

				let currentBuffer: Buffer<ArrayBufferLike> = generatedImageBuffer;
				let currentWidth = genWidth;
				let currentHeight = genHeight;

				// Step up in 1.4x increments
				while (currentWidth * 1.4 <= outputWidth && currentHeight * 1.4 <= outputHeight) {
					const newWidth = Math.round(currentWidth * 1.4);
					const newHeight = Math.round(currentHeight * 1.4);
					currentBuffer = await sharp(currentBuffer)
						.resize(newWidth, newHeight, {
							kernel: 'lanczos3',
							fit: 'fill'
						})
						.toBuffer();
					currentWidth = newWidth;
					currentHeight = newHeight;
					log.debug(`     Step: ${currentWidth}x${currentHeight}`);
				}

				// Final resize to exact target, then crop to square
				finalBuffer = await sharp(currentBuffer)
					.resize(outputWidth, outputHeight, {
						kernel: 'lanczos3',
						fit: 'cover',
						position: 'center'
					})
					.png({ quality: 100, compressionLevel: 6 })
					.toBuffer();
			} else {
				// Direct resize for smaller scale factors
				finalBuffer = await sharp(generatedImageBuffer)
					.resize(outputWidth, outputHeight, {
						kernel: 'lanczos3',
						fit: 'cover',
						position: 'center'
					})
					.png({ quality: 100, compressionLevel: 6 })
					.toBuffer();
			}

			log.debug(`    Upscaled to ${outputWidth}x${outputHeight}`);
		} else {
			// Already at or above target size, just ensure correct dimensions
			finalBuffer = await sharp(generatedImageBuffer)
				.resize(outputWidth, outputHeight, {
					kernel: 'lanczos3',
					fit: 'cover',
					position: 'center'
				})
				.png({ quality: 100, compressionLevel: 6 })
				.toBuffer();
			log.debug(`    Resized to ${outputWidth}x${outputHeight}`);
		}

		log.info('Gemini scene integration complete');
		return finalBuffer;
	} catch (err: any) {
		log.error({ err }, 'Gemini scene integration error');
		throw new Error(`Gemini scene integration failed: ${err.message}`);
	}
}

// ============================================================================
// BACKGROUND INTENT CLASSIFICATION
// ============================================================================

type BackgroundIntent = 'solid-color' | 'texture' | 'scene';

interface BackgroundClassification {
	intent: BackgroundIntent;
	hexColor?: string;
	sanitizedPrompt: string;
}

/**
 * Named color → hex lookup for common solid color requests.
 * Covers CSS named colors and natural-language color descriptions.
 */
const NAMED_COLOR_MAP: Record<string, string> = {
	// Pure/basic
	white: '#FFFFFF', 'pure white': '#FFFFFF', 'bright white': '#FFFFFF', 'clean white': '#FFFFFF',
	black: '#000000', 'pure black': '#000000', 'jet black': '#000000',
	red: '#FF0000', 'bright red': '#FF0000', 'pure red': '#FF0000',
	green: '#008000', 'bright green': '#00FF00', 'pure green': '#00FF00',
	blue: '#0000FF', 'bright blue': '#0000FF', 'pure blue': '#0000FF',
	yellow: '#FFFF00', 'bright yellow': '#FFFF00',
	orange: '#FFA500', 'bright orange': '#FF8C00',
	purple: '#800080', 'bright purple': '#9B30FF',
	pink: '#FFC0CB', 'bright pink': '#FF69B4', 'hot pink': '#FF69B4',
	gray: '#808080', grey: '#808080', 'light gray': '#D3D3D3', 'light grey': '#D3D3D3',
	'dark gray': '#A9A9A9', 'dark grey': '#A9A9A9', 'charcoal': '#36454F',
	// Extended
	'navy': '#000080', 'navy blue': '#000080',
	'sky blue': '#87CEEB', 'baby blue': '#89CFF0', 'royal blue': '#4169E1',
	'forest green': '#228B22', 'olive': '#808000', 'sage': '#BCB88A', 'sage green': '#BCB88A',
	'teal': '#008080', 'turquoise': '#40E0D0', 'aqua': '#00FFFF', 'cyan': '#00FFFF',
	'coral': '#FF7F50', 'salmon': '#FA8072', 'peach': '#FFDAB9',
	'lavender': '#E6E6FA', 'lilac': '#C8A2C8', 'mauve': '#E0B0FF',
	'burgundy': '#800020', 'maroon': '#800000', 'crimson': '#DC143C', 'wine': '#722F37',
	'beige': '#F5F5DC', 'cream': '#FFFDD0', 'ivory': '#FFFFF0', 'eggshell': '#F0EAD6',
	'tan': '#D2B48C', 'khaki': '#F0E68C', 'sand': '#C2B280',
	'gold': '#FFD700', 'silver': '#C0C0C0', 'bronze': '#CD7F32', 'copper': '#B87333',
	'rose': '#FF007F', 'rose gold': '#B76E79', 'blush': '#DE5D83',
	'mint': '#98FF98', 'mint green': '#98FF98',
	'indigo': '#4B0082', 'violet': '#EE82EE', 'magenta': '#FF00FF', 'fuchsia': '#FF00FF',
	'chocolate': '#D2691E', 'brown': '#8B4513', 'espresso': '#3C1414',
};

/**
 * Classify user's background art direction into one of three intents:
 * - solid-color: A flat hex color (e.g., "pure white", "#B22222", "red")
 * - texture: A pattern or material (e.g., "red velvet", "marble", "wood grain")
 * - scene: A full environment/setting (e.g., "coffee shop counter with morning light")
 *
 * Logic:
 * 1. Try local regex for hex codes and named colors (free, instant)
 * 2. If ambiguous, call Gemini 2.5 Flash for classification (~$0.001)
 *
 * Cost: $0 for solid colors detected locally, ~$0.001 for Gemini classification
 */
async function classifyBackgroundIntent(prompt: string): Promise<BackgroundClassification> {
	const trimmed = prompt.trim();
	const lower = trimmed.toLowerCase();

	log.info({ prompt: trimmed }, 'Classifying background intent');

	// --- Step 1: Local regex detection for solid colors ---

	// Check for hex color code (with or without #)
	const hexMatch = trimmed.match(/^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/);
	if (hexMatch) {
		let hex = hexMatch[1];
		// Expand 3-digit hex to 6-digit
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}
		const hexColor = `#${hex.toUpperCase()}`;
		log.info({ intent: 'solid-color', hexColor }, 'Classified via hex regex');
		return { intent: 'solid-color', hexColor, sanitizedPrompt: trimmed };
	}

	// Check for hex code embedded in a phrase (e.g., "#B22222 deep red", "background #FF0000")
	const embeddedHexMatch = lower.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/);
	if (embeddedHexMatch) {
		let hex = embeddedHexMatch[1];
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}
		const hexColor = `#${hex.toUpperCase()}`;
		log.info({ intent: 'solid-color', hexColor }, 'Classified via embedded hex');
		return { intent: 'solid-color', hexColor, sanitizedPrompt: trimmed };
	}

	// Check named color map (exact match on full prompt after stripping filler words)
	const stripped = lower
		.replace(/\b(solid|flat|plain|simple|just|background|bg|color|colour|make it|make the background)\b/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (NAMED_COLOR_MAP[stripped]) {
		const hexColor = NAMED_COLOR_MAP[stripped];
		log.info({ intent: 'solid-color', hexColor, matchedName: stripped }, 'Classified via named color');
		return { intent: 'solid-color', hexColor, sanitizedPrompt: trimmed };
	}

	// Also check the original lowercased prompt directly
	if (NAMED_COLOR_MAP[lower]) {
		const hexColor = NAMED_COLOR_MAP[lower];
		log.info({ intent: 'solid-color', hexColor, matchedName: lower }, 'Classified via direct name match');
		return { intent: 'solid-color', hexColor, sanitizedPrompt: trimmed };
	}

	// --- Step 2: Gemini Flash classification for texture vs scene ---
	log.info('Prompt not a clear solid color, calling Gemini Flash for classification');

	try {
		const apiKey = env.GOOGLE_GEMINI_API_KEY;
		if (!apiKey) {
			log.warn('GOOGLE_GEMINI_API_KEY not set, defaulting to scene intent');
			return { intent: 'scene', sanitizedPrompt: trimmed };
		}

		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: `You are a background intent classifier for product photography. Given a user's description of a desired product photo background, classify it into exactly ONE of these categories:

1. "solid-color" — The user wants a flat, single-color background. Examples: "red", "dark blue", "ivory", "make it white". If this is the intent, also provide the closest hex color code.
2. "texture" — The user wants a material, pattern, or surface as the background, but NOT a full scene with depth/environment. Examples: "red velvet", "marble texture", "wood grain", "brushed metal", "concrete wall", "linen fabric".
3. "scene" — The user wants a complete environment or setting with depth, lighting, and context. Examples: "coffee shop counter with morning light", "outdoor garden table", "luxury bathroom shelf", "Christmas tree with presents".

User prompt: "${trimmed}"

Respond with ONLY valid JSON in this exact format, no other text:
{"intent": "solid-color" | "texture" | "scene", "hex": "#RRGGBB or null", "reasoning": "brief explanation"}`
								}
							]
						}
					],
					generationConfig: {
						temperature: 0.1,
						maxOutputTokens: 150
					}
				})
			}
		);

		if (!response.ok) {
			log.warn({ status: response.status }, 'Gemini classification API error, defaulting to scene');
			return { intent: 'scene', sanitizedPrompt: trimmed };
		}

		const data = await response.json();
		const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

		// Parse the JSON response — handle markdown code fences if present
		const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
		const parsed = JSON.parse(jsonStr);

		const intent = parsed.intent as BackgroundIntent;
		if (!['solid-color', 'texture', 'scene'].includes(intent)) {
			log.warn({ parsed }, 'Unexpected intent from Gemini, defaulting to scene');
			return { intent: 'scene', sanitizedPrompt: trimmed };
		}

		const result: BackgroundClassification = {
			intent,
			sanitizedPrompt: trimmed
		};

		if (intent === 'solid-color' && parsed.hex) {
			result.hexColor = parsed.hex;
		}

		log.info({ intent, hexColor: result.hexColor, reasoning: parsed.reasoning }, 'Classified via Gemini Flash');
		return result;

	} catch (classifyErr: any) {
		log.warn({ err: classifyErr.message }, 'Gemini classification failed, defaulting to scene');
		return { intent: 'scene', sanitizedPrompt: trimmed };
	}
}

/**
 * Check if a job should use the Gemini scene integration pipeline.
 *
 * Routes to Gemini scene generation when:
 * - User selected a style preset (presetStylePrompt exists) — presets always use Gemini
 * - OR background intent is classified as 'scene' (full environment)
 * - OR a reference image is provided (analyzed style → scene generation)
 *
 * Solid-color and texture intents are handled by separate, cheaper pipelines.
 */
function shouldUseGeminiSceneIntegration(job: any, backgroundIntent?: BackgroundIntent): boolean {
	const enhancements = job.enhancements || [];
	const hasStyleTransfer = enhancements.includes('stylize-background');
	const hasPresetPrompt = !!(job.classification_details as any)?.presetStylePrompt;
	const hasReferenceImage = !!job.reference_image_url;

	// Presets always use Gemini scene integration (curated prompts)
	if (hasStyleTransfer && hasPresetPrompt) {
		log.debug(' Pipeline routing: PRESET → GEMINI SCENE INTEGRATION');
		return true;
	}

	// Reference images: analyze style → generate scene with Gemini (best quality)
	if (hasReferenceImage) {
		log.debug(' Pipeline routing: REFERENCE IMAGE → GEMINI SCENE INTEGRATION');
		return true;
	}

	// User prompts: only use Gemini for 'scene' intent
	if (hasStyleTransfer && backgroundIntent === 'scene') {
		log.debug(' Pipeline routing: SCENE intent → GEMINI SCENE INTEGRATION');
		return true;
	}

	log.debug({ backgroundIntent, hasStyleTransfer, hasPresetPrompt, hasReferenceImage }, ' Pipeline routing → STANDARD PIPELINE');
	return false;
}

/**
 * WF-08: Simplify Background (White/Grey)
 *
 * Composites product onto solid color background for marketplace compliance.
 * Includes smart fill: trims transparent padding, scales subject to 65% of
 * a 1600×1600 canvas, then composites the background color beneath it.
 *
 * Cost: $0 (pure compositing, no AI)
 */

/** Subject fills this fraction of the output canvas (0.65 = 65%) */
const SIMPLIFY_BG_FILL_RATIO = 0.65;
/** Output canvas size in pixels (square) */
const SIMPLIFY_BG_CANVAS_SIZE = 1600;

async function compositeOnSolidBackground(
	productBuffer: Buffer,
	backgroundColor: string = '#FFFFFF'
): Promise<Buffer> {
	log.debug(` Compositing on solid ${backgroundColor} background (smart fill 65%, 1600px)...`);

	try {
		const sharp = (await import('sharp')).default;

		// --- Smart Fill ---
		// 1. Trim transparent border to get tight bounding box around subject
		const trimmed = await sharp(productBuffer)
			.trim({ threshold: 10 })
			.toBuffer();

		const { width: subjectW = 1, height: subjectH = 1 } = await sharp(trimmed).metadata();

		// 2. Scale subject so its longest edge = 65% of canvas
		const longestEdge = Math.max(subjectW, subjectH);
		const targetSubjectSize = Math.round(SIMPLIFY_BG_CANVAS_SIZE * SIMPLIFY_BG_FILL_RATIO);
		const scale = targetSubjectSize / longestEdge;
		const scaledW = Math.round(subjectW * scale);
		const scaledH = Math.round(subjectH * scale);

		// 3. Resize subject (maintain aspect ratio via explicit w/h)
		const scaledSubject = await sharp(trimmed)
			.resize(scaledW, scaledH, { fit: 'fill' })
			.toBuffer();

		// 4. Calculate center offset on canvas
		const offsetLeft = Math.round((SIMPLIFY_BG_CANVAS_SIZE - scaledW) / 2);
		const offsetTop  = Math.round((SIMPLIFY_BG_CANVAS_SIZE - scaledH) / 2);

		// --- Parse background color ---
		const hex = backgroundColor.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);

		// --- Composite: solid 1600×1600 background + centered scaled subject ---
		const composited = await sharp({
			create: {
				width: SIMPLIFY_BG_CANVAS_SIZE,
				height: SIMPLIFY_BG_CANVAS_SIZE,
				channels: 3,
				background: { r, g, b }
			}
		})
			.composite([
				{
					input: scaledSubject,
					top: offsetTop,
					left: offsetLeft,
					blend: 'over'
				}
			])
			.jpeg({ quality: 92, mozjpeg: true })
			.toBuffer();

		log.debug(` Smart fill complete: subject ${subjectW}×${subjectH} → ${scaledW}×${scaledH} centered on ${SIMPLIFY_BG_CANVAS_SIZE}px canvas`);
		return composited;
	} catch (err: any) {
		log.error({ err }, 'Solid background compositing error');
		throw new Error(`Solid background compositing failed: ${err.message}`);
	}
}

/**
 * WF-14: Image Upscaling
 *
 * Upscales image 2x or 4x using Real-ESRGAN for high-quality results.
 * Perfect for marketplace listings that need higher resolution.
 *
 * Cost: ~$0.01 per upscale via Replicate
 */
async function upscaleImage(imageBuffer: Buffer, scale: number = 2): Promise<Buffer> {
	log.debug(` Upscaling image ${scale}x with Sharp (Lanczos3)...`);

	try {
		// Use Sharp's built-in high-quality upscaling with Lanczos3 interpolation
		// This preserves transparency and provides excellent quality without external API calls
		const sharp = (await import('sharp')).default;

		// Get current dimensions
		const metadata = await sharp(imageBuffer).metadata();
		const currentWidth = metadata.width || 1024;
		const currentHeight = metadata.height || 1024;

		// Calculate target dimensions
		const targetWidth = Math.round(currentWidth * scale);
		const targetHeight = Math.round(currentHeight * scale);

		log.debug(`📊 Upscaling from ${currentWidth}x${currentHeight} to ${targetWidth}x${targetHeight}`);

		// Upscale using Lanczos3 (best quality interpolation)
		const upscaledBuffer = await sharp(imageBuffer)
			.resize(targetWidth, targetHeight, {
				kernel: 'lanczos3', // Highest quality resampling
				fit: 'fill' // Exact dimensions
			})
			.png({ quality: 100, compressionLevel: 6 }) // High quality PNG
			.toBuffer();

		log.debug(` Upscaling completed: ${(upscaledBuffer.length / 1024).toFixed(1)}KB`);
		return upscaledBuffer;
	} catch (err: any) {
		log.error({ err }, 'Upscaling error');
		throw new Error(`Upscaling failed: ${err.message}`);
	}
}

/**
 * WF-09: Lifestyle Setting Generator
 *
 * Places product in curated lifestyle scenes for social media content.
 * Uses predefined scene templates with professional prompts.
 */
async function generateLifestyleScene(
	productBuffer: Buffer,
	sceneType: string,
	width: number,
	height: number
): Promise<Buffer> {
	log.info({ sceneType }, 'Generating lifestyle scene');

	try {
		// Curated lifestyle scene prompts
		const LIFESTYLE_SCENES: Record<string, string> = {
			'coffee-shop': 'Cozy coffee shop table with warm natural light streaming through windows, wooden table surface, blurred cafe background with bokeh, professional lifestyle photography',
			'outdoor-picnic': 'Outdoor picnic setting with checkered blanket on grass, dappled sunlight through trees, natural outdoor lighting, fresh and inviting atmosphere',
			'bedroom-nightstand': 'Modern bedroom nightstand with soft morning light, minimalist decor, white linens in background, warm and peaceful ambiance',
			'kitchen-counter': 'Clean modern kitchen counter with marble or granite surface, bright natural lighting, organized and premium aesthetic',
			'workspace-desk': 'Minimalist desk workspace with laptop and notepad, soft diffused lighting, professional home office setting',
			'vanity-table': 'Elegant vanity table with mirror, soft studio lighting, luxury bathroom or bedroom setting, sophisticated aesthetic',
			'garden-outdoor': 'Lush garden setting with greenery and flowers, natural sunlight, organic and fresh outdoor atmosphere',
			'living-room': 'Modern living room with cozy couch, soft ambient lighting, warm and inviting home interior',
			'beach-sand': 'Beach setting with soft sand and ocean in background, golden hour lighting, vacation and relaxation mood',
			'studio-minimal': 'Clean studio background with soft gradients, professional product photography lighting, minimalist and elegant'
		};

		const scenePrompt = LIFESTYLE_SCENES[sceneType] || LIFESTYLE_SCENES['studio-minimal'];

		// Generate lifestyle background
		const backgroundBuffer = await generateBackground('', scenePrompt, width, height);

		// Composite product onto lifestyle scene
		const compositedBuffer = await compositeProductOnBackground(productBuffer, backgroundBuffer);

		log.info('Lifestyle scene generation completed');
		return compositedBuffer;
	} catch (err: any) {
		log.error({ err }, 'Lifestyle scene error');
		throw new Error(`Lifestyle scene generation failed: ${err.message}`);
	}
}

/**
 * WF-06: General Goods Engine
 *
 * Smart background generator that analyzes product type and applies
 * appropriate styling automatically. Uses Gemini to classify product
 * and select optimal background treatment.
 */
async function applyGeneralGoodsEngine(
	productBuffer: Buffer,
	productType: string,
	width: number,
	height: number
): Promise<Buffer> {
	log.info({ productType }, 'Applying General Goods Engine');

	try {
		// Product-specific background strategies
		const PRODUCT_STRATEGIES: Record<string, string> = {
			jewelry:
				'Luxury jewelry display with soft gradient background, professional studio lighting with subtle highlights, premium and elegant aesthetic',
			clothing:
				'Fashion photography background with soft neutral tones, professional studio lighting, editorial style with depth',
			electronics:
				'Modern tech product background with clean gradients, sharp studio lighting, sleek and professional aesthetic',
			furniture:
				'Interior design setting with complementary decor, natural window lighting, aspirational home environment',
			accessories:
				'Lifestyle product photography background, soft natural lighting, modern and stylish aesthetic',
			beauty:
				'Clean beauty product background with soft pastel tones, diffused studio lighting, fresh and premium feel',
			home:
				'Home goods display with warm ambient lighting, cozy interior setting, inviting and comfortable atmosphere',
			toys: 'Playful colorful background with soft lighting, fun and energetic atmosphere, family-friendly aesthetic',
			sports:
				'Active lifestyle background with dynamic lighting, energetic and motivating atmosphere',
			default:
				'Professional product photography background with soft studio lighting, clean and versatile aesthetic'
		};

		// Get background strategy based on product type
		const strategy = PRODUCT_STRATEGIES[productType] || PRODUCT_STRATEGIES.default;

		// Generate smart background
		const backgroundBuffer = await generateBackground('', strategy, width, height);

		// Composite product with realistic shadows
		const compositedBuffer = await compositeProductOnBackground(productBuffer, backgroundBuffer);

		log.info('General Goods Engine processing completed');
		return compositedBuffer;
	} catch (err: any) {
		log.error({ err }, 'General Goods Engine error');
		throw new Error(`General Goods Engine failed: ${err.message}`);
	}
}

// ============================================================================
// API HANDLER
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. SECURITY: Authenticate user
		const user = locals.user;
		if (!user) {
			throw error(401, 'Authentication required');
		}

		// 2. Parse request
		const { job_id } = await request.json();

		if (!job_id) {
			throw error(400, 'Missing job_id');
		}

		log.info({ jobId: job_id, userId: user.id }, 'Job processing started');

		// 3. Initialize service role client
		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			throw error(500, 'Service role key not configured');
		}

		const adminClient = createServiceRoleClient(serviceRoleKey);


		// 4. Fetch job from database (defense-in-depth: filter by user_id too)
		const { data: job, error: fetchError } = await adminClient
			.from('jobs')
			.select('*')
			.eq('job_id', job_id)
			.eq('user_id', user.id)
			.single();

		if (fetchError || !job) {
			throw error(404, 'Job not found');
		}

		// Allow processing of pending OR already-processing jobs (idempotent)
		if (job.status !== 'pending' && job.status !== 'processing') {
			throw error(400, `Job cannot be processed (status: ${job.status})`);
		}

		// 3.5. Fetch user's subscription tier to determine if watermark should be applied
		const { data: userProfile, error: profileError } = await adminClient
			.from('profiles')
			.select('subscription_tier')
			.eq('user_id', job.user_id)
			.single();

		// Default to 'free' if profile not found (watermark will be applied)
		const subscriptionTier = userProfile?.subscription_tier || 'free';
		const applyWatermarkToOutputs = shouldApplyWatermark(subscriptionTier);

		if (profileError) {
			log.warn({ userId: job.user_id }, 'Profile fetch failed, defaulting to free tier');
		}

		log.info({ subscriptionTier, watermark: applyWatermarkToOutputs }, 'User subscription resolved');

		// 4. Update job status to processing (include updated_at so polling stale-detection works)
		await adminClient.from('jobs').update({
			status: 'processing',
			progress_message: 'Starting image processing...',
			updated_at: new Date().toISOString()
		}).eq('job_id', job_id);

		log.info({ jobId: job_id, from: 'pending', to: 'processing' }, 'Job status updated');

		// =====================================================================
		// FIRE-AND-FORGET: Return HTTP 200 immediately, process in background.
		// The processing page polls /api/jobs/:id every 3s for status updates.
		// Without this, the full processing (BG removal + AI generation) takes
		// 20-60s+ and exceeds the browser/gateway HTTP timeout (~30s).
		// =====================================================================
		processJobInBackground(adminClient, job, job_id, user.id, subscriptionTier, applyWatermarkToOutputs)
			.catch((err) => {
				log.error({ err, jobId: job_id }, 'Background job processing failed (unhandled)');
			});

		return json({
			success: true,
			job_id: job_id,
			status: 'processing',
			message: 'Job processing started'
		});

	} catch (err: any) {
		log.error({ err }, 'Job processing trigger failed');

		// Re-throw HTTP errors
		if (err.status) {
			throw err;
		}

		throw error(500, `Failed to start job processing: ${err.message || 'Unknown error'}`);
	}
};

// =============================================================================
// BACKGROUND PROCESSING FUNCTION
// Runs asynchronously after the HTTP response has been sent.
// Updates job status to 'completed' or 'failed' in the database.
// =============================================================================
async function processJobInBackground(
	adminClient: ReturnType<typeof createServiceRoleClient>,
	job: any,
	job_id: string,
	userId: string,
	subscriptionTier: string,
	applyWatermarkToOutputs: boolean
): Promise<void> {
	// Helper to update progress_message + updated_at so the polling UI stays informed
	async function updateProgress(message: string) {
		await adminClient.from('jobs').update({
			progress_message: message,
			updated_at: new Date().toISOString()
		}).eq('job_id', job_id);
	}

	// Capacity monitoring helper — fire-and-forget per-call logging
	const srk = env.SUPABASE_SERVICE_ROLE_KEY || '';
	const trackApi = (provider: 'replicate' | 'fal_ai' | 'google_imagen' | 'google_gemini' | 'anthropic', operation: string, cost: number) => {
		recordProviderCall(provider);
		logApiCall(srk, { job_id, provider, operation: operation as any, cost_usd: cost, duration_ms: 0, status: 'success' });
	};

	// ── WATCHDOG: Hard 8-minute timeout for the ENTIRE background job ──
	// If the process hangs for any reason (API stall, OOM recovery, deadlock),
	// this timeout marks the job as failed so it doesn't stay stuck at "processing" forever.
	const WATCHDOG_TIMEOUT_MS = 8 * 60 * 1000;
	const watchdog = setTimeout(async () => {
		log.error({ jobId: job_id }, 'WATCHDOG: Job exceeded 8-minute hard limit, marking as failed');
		try {
			await adminClient.from('jobs').update({
				status: 'failed',
				error_message: 'Processing timed out. Your credits have been refunded. Please try again with a smaller image.',
				completed_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			}).eq('job_id', job_id).eq('status', 'processing');
		} catch (e) {
			log.error({ err: e, jobId: job_id }, 'WATCHDOG: Failed to update job status');
		}
		// Auto-refund credits on watchdog timeout
		const refundAmount = getWorkflowCost(job.workflow_id || '');
		if (refundAmount > 0) {
			try {
				await adminClient.rpc('refund_credits', {
					p_user_id: userId,
					p_amount: refundAmount,
					p_job_id: job_id
				});
				log.info({ jobId: job_id, amount: refundAmount }, 'WATCHDOG: Credits auto-refunded');
			} catch (refundErr) {
				log.error({ err: refundErr, jobId: job_id }, 'WATCHDOG: Failed to auto-refund credits');
			}
		}
	}, WATCHDOG_TIMEOUT_MS);

	try {
		// 5. Download product image
		await updateProgress('Downloading your image...');
		log.info('Downloading product image from storage');
		const rawProductImageBuffer = await downloadImageFromStorage(adminClient, job.product_image_url);

		// 5.5. EXIF Auto-Orient (CRITICAL for HEIC/phone photos)
		// Phone cameras store orientation in EXIF metadata rather than rotating pixels.
		// HEIC files especially carry this. If we don't correct it here, background
		// removal models strip EXIF and the image comes out rotated.
		// Sharp's .rotate() with no arguments reads EXIF and corrects orientation.
		const sharpInit = (await import('sharp')).default;
		const productImageBuffer = await sharpInit(rawProductImageBuffer)
			.rotate() // Auto-orient from EXIF metadata (no-op if already correct)
			.toBuffer();

		const orientMeta = await sharpInit(productImageBuffer).metadata();
		log.debug(` After EXIF orient: ${orientMeta.width}x${orientMeta.height} (${orientMeta.format})`);

		// 6. Process enhancements
		let processedImageBuffer = productImageBuffer;
		const enhancements = (job.enhancements || []) as string[];
		let totalCost = 0;

		// Quality metadata for storage
		let qualityMetadata: JobQualityMetadata = {};

		// Get product type (category) for workflow routing and BG removal engine selection
		// Define at function scope so it's accessible throughout processing
		const productType = (job.product_type || 'general') as ProductType;

		// Get detailed product description for scene generation prompts
		// e.g. "sterling silver filigree ring with turquoise stone" instead of just "jewelry"
		const productDescription = job.product_name && job.product_name !== 'Unknown Product'
			? job.product_name
			: productType;

		await updateProgress('Analyzing your product...');

		// Background removal (always first if requested, stylize-background selected, or reference image provided)
		// Reference images need a clean cutout to feed into Gemini scene generation
		if (enhancements.includes('remove-background') || enhancements.includes('stylize-background') || job.reference_image_url) {
			await updateProgress('Removing background...');

			// Use DIRECT fal.ai BRIA call — fast (~5s), memory-safe (1 buffer copy).
			// The full 9-agent pipeline was causing OOM crashes on Railway, killing the
			// process before any in-process timeout could fire (BUG-20260227-001).
			const falApiKey = env.FAL_KEY || '';
			if (!falApiKey) {
				throw new Error('FAL_KEY environment variable is not set');
			}

			log.info({ productType, method: 'direct-bria' }, 'Starting direct BRIA background removal');

			const result = await protectedApiCall('fal.ai', () => removeBackgroundDirect(processedImageBuffer, falApiKey));

			processedImageBuffer = result.buffer;
			totalCost += 0.018; // BRIA cost
			trackApi('fal_ai', 'bg_removal', 0.018);

			log.info({ processingTime: result.processingTime, quality: result.qualityScore }, 'BG removal complete');

			// Normalize buffer to PNG with alpha for downstream compatibility
			const sharp = (await import('sharp')).default;
			try {
				processedImageBuffer = await sharp(processedImageBuffer)
					.ensureAlpha()
					.png({ compressionLevel: 6, adaptiveFiltering: false })
					.toBuffer();
				log.debug({ size: `${(processedImageBuffer.length / 1024).toFixed(1)}KB` }, 'Buffer normalized to PNG');
			} catch (normErr: any) {
				log.warn({ err: normErr.message }, 'Buffer normalization failed, continuing with raw output');
			}

			// Store quality metrics
			qualityMetadata = {
				quality_score: result.qualityScore,
				quality_metrics: {
					edgeQuality: result.metrics.edgeQuality,
					segmentationQuality: result.metrics.segmentationQuality,
					artifactFreeScore: result.metrics.artifactFreeScore
				},
				model_used: result.metadata.modelUsed,
				retry_count: result.metadata.retryCount,
				product_type: productType,
				processing_time: result.processingTime
			};
		}

		// Preserve the BG-removed product cutout BEFORE stylize-background overwrites processedImageBuffer.
		// The hands-generation step needs the isolated product (not a full styled scene).
		const productCutoutBuffer = enhancements.includes('product-held-in-hands')
			? Buffer.from(processedImageBuffer)
			: null;

		// ============================================================================
		// STYLE TRANSFER ROUTING DECISION (2026-02-05)
		// ============================================================================
		//
		// NEW ARCHITECTURE: Two paths for styled outputs
		//
		// PATH A: GEMINI SCENE INTEGRATION (NEW - Preferred for presets)
		// - User selected a style preset with prompt
		// - Gemini takes BACKGROUND-REMOVED cutout → generates complete scene
		// - BG removal runs first (line 1820), then clean cutout sent to Gemini
		// - FIX (BUG-20260217-001): Sending original image caused overlay artifacts
		// - Perfect lighting, shadows, perspective in single API call
		// - Product fills ~50% of frame (prompt engineered)
		//
		// PATH B: LEGACY COMPOSITING (for reference images, edge cases)
		// - Generate background at 1024x1024, composite at final resolution
		// - Used when reference_image_url provided (need to match existing style)
		// - Or as fallback if Gemini integration fails
		//
		// The processedImageBuffer remains the product cutout (with transparency).
		// For Path A, we generate directly to final marketplace resolution.
		// For Path B, styleBackgroundBuffer is stored for per-marketplace compositing.
		// ============================================================================

		let styleBackgroundBuffer: Buffer | null = null;
		let useGeminiSceneIntegration = false;
		let geminiSceneOutputs: Map<string, Buffer> | null = null;
		let handsHandledByScene = false; // Set true when product-in-hands is merged into scene generation
		let backgroundClassification: BackgroundClassification | null = null;
		let isSolidColorBackground = false; // Flag for shadow condition (solid-color still gets shadows)
		let solidColorHex: string | null = null; // Hex color for solid-color path (used in output loop)
		let mannequinOutputReady = false; // When true, processedImageBuffer is a complete mannequin image (opaque, white or styled bg) — skip trim/composite in output loop
		let referenceStyleDescription = ''; // Style extracted from reference image (Gemini Flash vision)

		if (enhancements.includes('stylize-background') || job.reference_image_url || job.ai_prompt) {
			// Step 0: Analyze reference image FIRST (before routing decision)
			// The style description feeds into PATH A (Gemini scene) as the scene prompt
			if (job.reference_image_url) {
				log.info('Reference image detected — analyzing style with Gemini Flash vision');
				const referenceImageBuffer = await downloadImageFromStorage(
					adminClient,
					job.reference_image_url
				);
				referenceStyleDescription = await analyzeReferenceImage(referenceImageBuffer);
				totalCost += 0.001; // Gemini Flash vision cost
				trackApi('google_gemini', 'vision_analysis', 0.001);
				log.info({ styleDescription: referenceStyleDescription.substring(0, 120) }, 'Reference image style extracted');
			}

			await updateProgress('Styling your background...');
			// Step 1: Classify user's background intent (solid-color, texture, or scene)
			// Skip classification for preset jobs (presets are always scenes) and reference image jobs
			const hasPresetPrompt = !!(job.classification_details as any)?.presetStylePrompt;
			if (!hasPresetPrompt && !job.reference_image_url && job.ai_prompt && enhancements.includes('stylize-background')) {
				backgroundClassification = await classifyBackgroundIntent(job.ai_prompt);
				log.info({ intent: backgroundClassification.intent, hexColor: backgroundClassification.hexColor }, 'Background intent classified');
			}

			// Step 2: Route based on classification
			useGeminiSceneIntegration = shouldUseGeminiSceneIntegration(job, backgroundClassification?.intent);

			// ================================================================
			// PATH: SOLID-COLOR BACKGROUND
			// Product cutout on a flat hex color — no AI generation needed
			// ================================================================
			if (backgroundClassification?.intent === 'solid-color' && backgroundClassification.hexColor) {
				log.info({ hexColor: backgroundClassification.hexColor }, 'SOLID-COLOR PATH: Will composite product on solid color in output loop');
				isSolidColorBackground = true;
				solidColorHex = backgroundClassification.hexColor;

				// Validate and sanitize the user prompt
				const rawPrompt = job.ai_prompt || '';
				const validation = sanitizeAIPrompt(rawPrompt);
				if (!validation.valid) {
					log.error({ violations: validation.violations }, 'Prompt injection detected in solid-color request');
					await adminClient
						.from('jobs')
						.update({
							status: 'failed',
							error_message: 'Prompt contains prohibited content. Please rephrase.',
							classification_details: {
								...(job.classification_details as object),
								security_violations: validation.violations,
								original_prompt: rawPrompt
							},
							completed_at: new Date().toISOString()
						})
						.eq('job_id', job_id);
					throw error(400, 'Invalid prompt: contains prohibited patterns');
				}

				// Remove background to get clean transparent cutout
				// (compositing happens in the output loop PATH C with shadow support)
				const bgRemovalResult = await removeBackgroundDirect(processedImageBuffer, env.FAL_KEY || '');
				processedImageBuffer = bgRemovalResult.buffer;
				totalCost += 0.018;
				trackApi('fal_ai', 'bg_removal', 0.018);

				log.info({ hexColor: solidColorHex }, 'Background removed, solid-color compositing deferred to output loop');
			}

			// ================================================================
			// PATH: TEXTURE BACKGROUND
			// Product cutout composited on AI-generated texture/pattern
			// ================================================================
			else if (backgroundClassification?.intent === 'texture') {
				log.info('TEXTURE PATH: Generating texture background + compositing product');

				// Validate and sanitize user prompt
				const rawPrompt = job.ai_prompt || '';
				const validation = sanitizeAIPrompt(rawPrompt);
				if (!validation.valid) {
					log.error({ violations: validation.violations }, 'Prompt injection detected in texture request');
					await adminClient
						.from('jobs')
						.update({
							status: 'failed',
							error_message: 'Prompt contains prohibited content. Please rephrase.',
							classification_details: {
								...(job.classification_details as object),
								security_violations: validation.violations,
								original_prompt: rawPrompt
							},
							completed_at: new Date().toISOString()
						})
						.eq('job_id', job_id);
					throw error(400, 'Invalid prompt: contains prohibited patterns');
				}

				// Remove background to get clean cutout
				const bgRemovalResult = await removeBackgroundDirect(processedImageBuffer, env.FAL_KEY || '');
				processedImageBuffer = bgRemovalResult.buffer;
				totalCost += 0.018;
				trackApi('fal_ai', 'bg_removal', 0.018);

				// Generate texture-only background via Flux Pro 1.1
				// generateBackground() already includes "No products or objects in the scene"
				const fluxWidth = 1024;
				const fluxHeight = 1024;
				const securedPrompt = buildSecurePrompt(validation.sanitized);

				styleBackgroundBuffer = await generateBackground(
					securedPrompt,
					'', // No reference image style description
					fluxWidth,
					fluxHeight
				);
				totalCost += 0.055; // Flux Pro 1.1 cost
				trackApi('replicate', 'scene_generation', 0.055);

				// Force PATH B compositing in the output loop (not Gemini scene)
				useGeminiSceneIntegration = false;

				log.info('Texture background generated, compositing deferred to marketplace output loop (PATH B)');
			}

			// ================================================================
			// PATH A: GEMINI SCENE INTEGRATION (scene intent, preset, or reference image)
			// Skip when invisible-mannequin is also selected — the mannequin prompt
			// already includes the styled background, so generating a separate scene
			// would be wasted cost and would conflict in the output loop.
			// ================================================================
			else if (useGeminiSceneIntegration && !enhancements.includes('invisible-mannequin')) {
				// ================================================================
				// PATH A: GEMINI SCENE INTEGRATION
				// Generate complete scenes directly with Gemini
				// Handles: presets, scene-intent user prompts, and reference images
				// ================================================================
				log.debug(' GEMINI SCENE INTEGRATION: Generating scenes with AI-native product placement...');

				// Get style prompt from one of three sources (priority order):
				// 1. Preset style prompt (curated, pre-validated)
				// 2. Reference image style description (Gemini Flash vision analysis)
				// 3. User-typed art direction prompt (requires security validation)
				const presetStylePrompt = (job.classification_details as any)?.presetStylePrompt;
				const userPrompt = job.ai_prompt || '';

				// SECURITY: Validate user prompts (preset prompts are pre-validated)
				let stylePrompt = '';
				if (presetStylePrompt) {
					// Source 1: Preset (curated, trusted)
					// Adapt prompt to replace original product reference with the actual product being processed
					// This prevents the preset's original subject (e.g., "gold cuff") from bleeding into scenes
					const geminiKey = env.GOOGLE_GEMINI_API_KEY || '';
					stylePrompt = geminiKey
						? await adaptPresetPromptForProduct(presetStylePrompt, productType, geminiKey)
						: presetStylePrompt;
					log.debug(`   Using preset style (adapted): "${stylePrompt.substring(0, 60)}..."`);
				} else if (referenceStyleDescription) {
					// Source 2: Reference image analysis
					// The Gemini Flash vision output is trusted (we generated it from the user's image)
					// If user also provided a text prompt, combine: reference sets baseline, text adds specifics
					if (userPrompt.trim()) {
						const validation = sanitizeAIPrompt(userPrompt);
						if (!validation.valid) {
							log.error({ violations: validation.violations }, 'Prompt injection detected in reference image + text combo');
							await adminClient
								.from('jobs')
								.update({
									status: 'failed',
									error_message: 'Prompt contains prohibited content. Please rephrase.',
									classification_details: {
										...(job.classification_details as object),
										security_violations: validation.violations,
										original_prompt: userPrompt
									},
									completed_at: new Date().toISOString()
								})
								.eq('job_id', job_id);
							throw error(400, 'Invalid prompt: contains prohibited patterns');
						}
						// Combine: reference style as baseline + user text as override/addition
						stylePrompt = `${referenceStyleDescription}. Additionally: ${validation.sanitized}`;
						log.debug(`   Using REFERENCE IMAGE + USER TEXT combo: "${stylePrompt.substring(0, 80)}..."`);
					} else {
						// Reference image only (no user text)
						stylePrompt = referenceStyleDescription;
						log.debug(`   Using REFERENCE IMAGE style: "${stylePrompt.substring(0, 80)}..."`);
					}
				} else {
					// Source 3: User-typed prompt only
					const validation = sanitizeAIPrompt(userPrompt);
					if (!validation.valid) {
						log.error({ violations: validation.violations }, 'Prompt injection detected');
						await adminClient
							.from('jobs')
							.update({
								status: 'failed',
								error_message: 'Prompt contains prohibited content. Please rephrase using only background style descriptions.',
								classification_details: {
									...(job.classification_details as object),
									security_violations: validation.violations,
									original_prompt: userPrompt
								},
								completed_at: new Date().toISOString()
							})
							.eq('job_id', job_id);
						throw error(400, 'Invalid prompt: contains prohibited patterns');
					}
					stylePrompt = buildSecurePrompt(validation.sanitized);
					log.debug(`   Using user prompt: "${stylePrompt.substring(0, 60)}..."`);
				}

				// productType already defined at function scope

				// When product-in-hands is ALSO selected, merge hands instructions into the scene prompt.
				// This produces one cohesive image (product in hands + styled background) instead of
				// two conflicting sequential steps. See: 3D dragon backyard example (2026-03-02).
				if (enhancements.includes('product-held-in-hands')) {
					const geminiApiKey = env.GOOGLE_GEMINI_API_KEY;
					if (geminiApiKey) {
						try {
							const handsProductCategory = (job.classification_details as any)?.product_type || productType || 'general product';
							const handsAnalysis = await analyzeForHands(
								{
									imageUrl: job.product_image_url,
									imageBuffer: processedImageBuffer,
									productCategory: handsProductCategory,
									artDirection: {}
								},
								geminiApiKey
							);
							totalCost += 0.001;
							trackApi('google_gemini', 'vision_analysis', 0.001);
							const handsPrompt = buildHandsPrompt(handsAnalysis, handsProductCategory, {});
							// Prepend hands instruction to the scene style so Gemini generates both together
							stylePrompt = `Show this product being held naturally in human hands. ${handsPrompt}\n\nBACKGROUND/SETTING: ${stylePrompt}`;
							handsHandledByScene = true;
							log.info({ gripType: handsAnalysis.gripType }, 'Hands instructions merged into scene prompt');
						} catch (handsErr: any) {
							log.warn({ err: handsErr.message }, 'Hands analysis failed, will fall back to standalone WF-18');
						}
					}
				}

				// Pre-generate scenes for all marketplaces
				// This is more efficient than generating per-marketplace in the output loop
				const marketplaces = (job.marketplaces as string[]) || ['amazon'];
				geminiSceneOutputs = new Map();

				// Marketplace dimension specifications
				const MARKETPLACE_SPECS: Record<string, { width: number; height: number }> = {
					amazon: { width: 2048, height: 2048 },
					ebay: { width: 1600, height: 1600 },
					etsy: { width: 2000, height: 2000 },
					shopify: { width: 2048, height: 2048 },
					instagram: { width: 1080, height: 1080 },
					facebook: { width: 1080, height: 1080 },
					pinterest: { width: 1000, height: 1500 },
					poshmark: { width: 1600, height: 1600 }
				};

				// Group marketplaces by dimensions to minimize API calls
				// E.g., Amazon & Shopify both need 2048x2048, so generate once
				const dimensionGroups = new Map<string, string[]>();
				for (const marketplace of marketplaces) {
					const spec = MARKETPLACE_SPECS[marketplace] || MARKETPLACE_SPECS.amazon;
					const dimKey = `${spec.width}x${spec.height}`;
					if (!dimensionGroups.has(dimKey)) {
						dimensionGroups.set(dimKey, []);
					}
					dimensionGroups.get(dimKey)!.push(marketplace);
				}

				log.debug(`   Generating ${dimensionGroups.size} unique resolution(s) for ${marketplaces.length} marketplace(s)`);

				// Generate one scene per unique dimension
				for (const [dimKey, marketplacesForDim] of dimensionGroups) {
					const [width, height] = dimKey.split('x').map(Number);
					log.debug(`    Generating ${dimKey} scene for: ${marketplacesForDim.join(', ')}`);

					try {
						// Use BACKGROUND-REMOVED cutout for Gemini (clean transparent PNG)
						// Sending original image caused Gemini to overlay the raw photo on top
						// of the generated scene (BUG-20260217-001). The cutout gives Gemini
						// a clean product reference without background artifacts.
						const sceneBuffer = await generateSceneWithGemini(
							processedImageBuffer, // Background-removed cutout (transparent PNG)
							stylePrompt,
							productDescription,
							width,
							height,
							handsHandledByScene
						);

						// Map this scene to all marketplaces with this dimension
						for (const mp of marketplacesForDim) {
							geminiSceneOutputs.set(mp, sceneBuffer);
						}

						totalCost += 0.004; // Gemini Imagen 3 cost
						trackApi('google_imagen', 'scene_generation', 0.004);
					} catch (geminiError: any) {
						log.error(`    Gemini generation failed for ${dimKey}:`, geminiError.message);
						// Fall back to legacy compositing for this job
						useGeminiSceneIntegration = false;
						geminiSceneOutputs = null;
						log.debug('    Falling back to legacy compositing pipeline...');
						break;
					}
				}

				if (useGeminiSceneIntegration) {
					log.debug(` GEMINI SCENE INTEGRATION complete: ${geminiSceneOutputs?.size || 0} scenes generated`);
				}
			}

			// ================================================================
			// PATH B: LEGACY COMPOSITING (fallback only)
			// Reference images now go through PATH A (Gemini scene integration).
			// PATH B only runs as a fallback if Gemini scene generation fails,
			// or for texture-classified prompts.
			// IMPORTANT: Skip if another path already handled background generation.
			// - Solid-color path: uses hex composite, no Flux needed
			// - Texture path: already generated styleBackgroundBuffer above
			// Without this guard, PATH B double-generates backgrounds, wasting $0.055
			// and overriding the correct output.
			// (BUG-20260217-002: Flux hallucinated kawaii stickers from solid-color hex prompt)
			// ================================================================
			if (!useGeminiSceneIntegration && !isSolidColorBackground && !styleBackgroundBuffer) {
				log.debug(' LEGACY MODE: Generating styled background (compositing deferred to final resolution)...');

				// Use reference style description if already extracted (Step 0 above)
				// This handles the fallback case where PATH A failed for a reference image job
				const styleDescription = referenceStyleDescription || '';

				// Generate background at optimal size for Flux Pro 1.1
				// Use 1024x1024 square — the sweet spot for quality/cost/speed.
				const fluxWidth = 1024;
				const fluxHeight = 1024;
				log.debug(` Background generation size: ${fluxWidth}x${fluxHeight} (square, optimal for Flux Pro 1.1)`);

				// PRIORITY: Use preset style prompt if available (curated by SwiftList Team)
				// FALLBACK: Use user-provided AI prompt (requires security validation)
				let finalPrompt = '';
				const presetStylePrompt = (job.classification_details as any)?.presetStylePrompt;

				if (presetStylePrompt) {
					// Preset style prompts are curated - adapt for the actual product being processed
					const geminiKey = env.GOOGLE_GEMINI_API_KEY || '';
					finalPrompt = geminiKey
						? await adaptPresetPromptForProduct(presetStylePrompt, productType, geminiKey)
						: presetStylePrompt;
					log.debug(` Using preset style prompt (adapted, ${finalPrompt.length} chars): "${finalPrompt.substring(0, 80)}..."`);
				} else {
					// User-provided prompt - SECURITY: Validate and sanitize
					const rawPrompt = job.ai_prompt || '';
					const validation = sanitizeAIPrompt(rawPrompt);

					if (!validation.valid) {
						log.error({ violations: validation.violations }, 'Prompt injection detected');

						// Update job to failed with security warning
						await adminClient
							.from('jobs')
							.update({
								status: 'failed',
								error_message:
									'Prompt contains prohibited content. Please rephrase using only background style descriptions.',
								classification_details: {
									...(job.classification_details as object),
									security_violations: validation.violations,
									original_prompt: rawPrompt
								},
								completed_at: new Date().toISOString()
							})
							.eq('job_id', job_id);

						throw error(400, 'Invalid prompt: contains prohibited patterns');
					}

					// Use secured prompt with XML delimiters
					finalPrompt = buildSecurePrompt(validation.sanitized);
					log.debug(` Secured user prompt (${validation.sanitized.length} chars)`);
				}

				// Generate background at 1024x1024 (Flux Pro 1.1 sweet spot)
				// Compositing will happen in marketplace output loop at final resolution
				styleBackgroundBuffer = await generateBackground(
					finalPrompt,
					styleDescription,
					fluxWidth,
					fluxHeight
				);

				log.debug(` Background generated at ${fluxWidth}x${fluxHeight}, compositing deferred to marketplace output`);

				totalCost += 0.055; // Flux Pro 1.1 cost
				trackApi('replicate', 'scene_generation', 0.055);
			}
		}

		// WF-08: Simplify Background (White/Grey/Custom Color)
		if (enhancements.includes('simplify-background')) {
			log.debug(' Applying simplified background...');

			// Ensure background is removed first
			if (!enhancements.includes('remove-background')) {
				const bgResult = await protectedApiCall('fal.ai', () => removeBackgroundDirect(processedImageBuffer, env.FAL_KEY || ''));
				processedImageBuffer = bgResult.buffer;
				totalCost += 0.018;
				trackApi('fal_ai', 'bg_removal', 0.018);
			}

			// Get background color from job metadata (default: pure white)
			const bgColor = (job.classification_details as any)?.background_color || '#FFFFFF';

			processedImageBuffer = await compositeOnSolidBackground(processedImageBuffer, bgColor);
			// No additional cost - pure compositing
		}

		// WF-09: Lifestyle Setting
		if (enhancements.includes('lifestyle-setting')) {
			log.debug(' Applying lifestyle setting...');

			// Ensure background is removed first
			if (!enhancements.includes('remove-background')) {
				const bgResult = await protectedApiCall('fal.ai', () => removeBackgroundDirect(processedImageBuffer, env.FAL_KEY || ''));
				processedImageBuffer = bgResult.buffer;
				totalCost += 0.018;
				trackApi('fal_ai', 'bg_removal', 0.018);
			}

			// Get scene type from job metadata (default: studio-minimal)
			const sceneType = (job.classification_details as any)?.lifestyle_scene || 'studio-minimal';

			// Get dimensions
			const sharp = (await import('sharp')).default;
			const productMeta = await sharp(processedImageBuffer).metadata();
			let width = productMeta.width || 1024;
			let height = productMeta.height || 1024;

			// Cap dimensions
			const maxDimension = 1440;
			if (width > maxDimension || height > maxDimension) {
				const scale = Math.min(maxDimension / width, maxDimension / height);
				width = Math.round(width * scale);
				height = Math.round(height * scale);
			}

			processedImageBuffer = await generateLifestyleScene(
				processedImageBuffer,
				sceneType,
				width,
				height
			);

			totalCost += 0.055; // Flux Pro 1.1 cost
			trackApi('replicate', 'scene_generation', 0.055);
		}

		// WF-06: General Goods Engine
		if (enhancements.includes('general-goods-engine')) {
			log.debug('  Applying General Goods Engine...');

			// Ensure background is removed first
			if (!enhancements.includes('remove-background')) {
				log.info('WF-06: Running direct BRIA background removal');
				const bgResult = await protectedApiCall('fal.ai', () => removeBackgroundDirect(processedImageBuffer, env.FAL_KEY || ''));
				processedImageBuffer = bgResult.buffer;
				totalCost += 0.018;
				trackApi('fal_ai', 'bg_removal', 0.018);

				log.debug({ quality: bgResult.qualityScore }, 'WF-06 BG removal complete');

				// Normalize buffer format to ensure valid PNG with alpha for downstream processing
				const sharpNorm = (await import('sharp')).default;
				try {
					processedImageBuffer = await sharpNorm(processedImageBuffer)
						.ensureAlpha()
						.png({ compressionLevel: 6, adaptiveFiltering: false })
						.toBuffer();
				} catch (normErr: any) {
					log.warn({ err: normErr.message }, 'WF-06 buffer normalization failed');
				}
			}

			// productType already defined at function scope
			log.debug(` Product type for lifestyle scene: "${productType}"`);

			// Get dimensions
			const sharp = (await import('sharp')).default;
			const productMeta = await sharp(processedImageBuffer).metadata();
			let width = productMeta.width || 1024;
			let height = productMeta.height || 1024;

			// Cap dimensions
			const maxDimension = 1440;
			if (width > maxDimension || height > maxDimension) {
				const scale = Math.min(maxDimension / width, maxDimension / height);
				width = Math.round(width * scale);
				height = Math.round(height * scale);
			}

			processedImageBuffer = await applyGeneralGoodsEngine(
				processedImageBuffer,
				productType,
				width,
				height
			);

			totalCost += 0.055; // Flux Pro 1.1 cost
			trackApi('replicate', 'scene_generation', 0.055);
		}

		// WF-14: Image Upscaling (always last before shadow)
		if (enhancements.includes('upscale')) {
			log.debug(' Upscaling image...');

			// Get upscale factor from job metadata (default: 2x)
			const upscaleFactor = (job.classification_details as any)?.upscale_factor || 2;

			processedImageBuffer = await upscaleImage(processedImageBuffer, upscaleFactor);

			totalCost += 0.01; // Real-ESRGAN cost
			trackApi('replicate', 'upscale', 0.01);
		}

		// WF-17: Invisible Mannequin (ghost mannequin effect for clothing)
		// Uses Gemini 3.1 Flash Image (Nano Banana 2.0) for edit-style ghost mannequin
		// Fallback: Imagen 3 text-only generation
		if (enhancements.includes('invisible-mannequin')) {
			await updateProgress('Applying invisible mannequin effect...');
			log.debug(' Applying invisible mannequin effect...');

			// Ensure background is removed first
			if (!enhancements.includes('remove-background')) {
				log.debug('Running prerequisite background removal...');
				const bgResult = await protectedApiCall('fal.ai', () => removeBackgroundDirect(processedImageBuffer, env.FAL_KEY || ''));
				processedImageBuffer = bgResult.buffer;
				totalCost += 0.018;
				trackApi('fal_ai', 'bg_removal', 0.018);
			}

			const geminiApiKey = env.GOOGLE_GEMINI_API_KEY;
			if (!geminiApiKey) {
				log.warn('GOOGLE_GEMINI_API_KEY not configured, skipping invisible mannequin');
			} else {
				// Optimize image size for Nano Banana 2 — keep under 4MB practical limit
				// Large phone photos as PNG can be 15MB+, which causes empty responses
				let garmentBuffer = processedImageBuffer;
				const rawSizeMB = garmentBuffer.length / (1024 * 1024);
				if (rawSizeMB > 3) {
					log.info({ rawSizeMB: rawSizeMB.toFixed(1) }, 'Image too large for Nano Banana, resizing with sharp');
					const sharp = (await import('sharp')).default;
					garmentBuffer = await sharp(garmentBuffer)
						.resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
						.jpeg({ quality: 85 })
						.toBuffer();
					log.info({ optimizedSizeMB: (garmentBuffer.length / (1024 * 1024)).toFixed(1) }, 'Image optimized');
				}
				const base64Garment = garmentBuffer.toString('base64');
				const garmentMimeType = rawSizeMB > 3 ? 'image/jpeg' : 'image/png';

				// Step 1: Determine garment type from classification or product description
				// Use the detailed product description from upstream classification when available
				let garmentType = 'garment';
				const garmentCategories = ['shirt', 't-shirt', 'dress', 'pants', 'jeans', 'jacket', 'coat', 'hoodie', 'sweater', 'skirt', 'shorts', 'blazer', 'vest', 'suit', 'blouse', 'tank-top', 'polo', 'cardigan'];

				// Try to extract garment type from existing classification
				const classDetails = job.classification_details as any;
				if (classDetails?.product_name) {
					const nameLower = classDetails.product_name.toLowerCase();
					garmentType = garmentCategories.find(cat => nameLower.includes(cat)) || 'garment';
				}

				// If still generic, run a quick Gemini classification
				if (garmentType === 'garment') {
					try {
						const classifyCtrl = new AbortController();
						const classifyTimeout = setTimeout(() => classifyCtrl.abort(), 15000);
						const classifyRes = await fetch(
							'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
								signal: classifyCtrl.signal,
								body: JSON.stringify({
									contents: [{ parts: [
										{ text: 'Identify this clothing item. Respond with ONLY the garment type (e.g. "dress", "blazer", "hoodie"), nothing else.' },
										{ inline_data: { mime_type: 'image/png', data: base64Garment } }
									]}],
									generationConfig: { temperature: 0.1, maxOutputTokens: 20 }
								})
							}
						);
						clearTimeout(classifyTimeout);
						if (classifyRes.ok) {
							const classResult = await classifyRes.json();
							garmentType = classResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || 'garment';
						}
					} catch (classErr) {
						log.warn({ err: classErr }, 'Garment classification failed, using default');
					}
					totalCost += 0.001;
					trackApi('google_gemini', 'classification', 0.001);
				}
				log.info({ garmentType }, 'Garment classified for mannequin');

				// Step 2: Build garment-specific volume instructions
				const volumeInstructions: Record<string, string> = {
					'dress': 'Bodice filled out, waist cinched naturally, skirt draping with volume',
					'skirt': 'Waistband sits naturally, fabric has fullness and drape',
					'shirt': 'Chest filled out, shoulders have width, sleeves have arm-shaped volume',
					'blouse': 'Chest filled out, shoulders have width, sleeves have arm-shaped volume',
					'polo': 'Chest filled out, shoulders have width, sleeves have arm-shaped volume',
					't-shirt': 'Chest filled out, shoulders have width, sleeves have arm-shaped volume',
					'tank-top': 'Chest filled out, shoulders have width, natural body shape visible',
					'jacket': 'Shoulders structured, lapels stand naturally, torso has body shape',
					'coat': 'Shoulders structured, lapels stand naturally, torso has body shape',
					'blazer': 'Shoulders structured, lapels stand naturally, torso has body shape',
					'cardigan': 'Shoulders have width, front panels drape naturally, sleeves filled',
					'vest': 'Shoulders structured, front panels sit flat, torso has body shape',
					'pants': 'Waist sits naturally, legs have volume, fabric drapes realistically',
					'jeans': 'Waist sits naturally, legs have volume, fabric drapes realistically',
					'shorts': 'Waist sits naturally, legs have volume, fabric drapes realistically',
					'hoodie': 'Body has soft volume, hood/collar sits naturally, sleeves filled',
					'sweater': 'Body has soft volume, collar sits naturally, sleeves filled',
					'suit': 'Shoulders structured, lapels stand naturally, torso has tailored body shape'
				};
				const volumeDetail = volumeInstructions[garmentType] || 'Garment filled out with natural body shape and volume';

				// Use detailed product description in prompt when available
				const garmentDesc = productDescription !== productType ? productDescription : garmentType;

				// Step 3: Build edit-style prompt for Nano Banana 2.0
				// When stylize-background is also selected, use the user's background description
				// instead of hardcoded white — so the mannequin appears in the styled scene
				const hasStylizedBg = enhancements.includes('stylize-background');
				let mannequinBgInstruction = 'Pure white, clean and uniform.';
				let mannequinLightingInstruction = 'Soft, even professional studio lighting. Gentle shadow beneath suggesting the garment floats.';

				if (hasStylizedBg) {
					let presetPrompt = (job.classification_details as any)?.presetStylePrompt || '';
					// Adapt preset prompt to strip original product reference for mannequin scenes
					if (presetPrompt) {
						const geminiKey = env.GOOGLE_GEMINI_API_KEY || '';
						if (geminiKey) {
							presetPrompt = await adaptPresetPromptForProduct(presetPrompt, garmentType, geminiKey);
						}
					}
					const styleDesc = presetPrompt || referenceStyleDescription || job.ai_prompt || '';
					if (styleDesc) {
						mannequinBgInstruction = styleDesc;
						mannequinLightingInstruction = 'Lighting that matches the background environment naturally.';
						log.info({ styleDesc: styleDesc.substring(0, 100) }, 'Mannequin prompt: using styled background instead of white');
					}
				}

				const mannequinPrompt = `Edit this garment image to create a professional ghost mannequin effect.
Transform this ${garmentDesc} so it appears worn by an invisible body with natural 3D volume and shape.

PRESERVE EXACTLY: All original fabric texture, color, pattern, buttons, stitching, labels, and every detail of this specific garment. Do not alter, replace, or reimagine any part of the garment itself.

ADD: ${volumeDetail}. Natural fabric drape and folds. The garment should appear to float in 3D space as if on an invisible form.

BACKGROUND: ${mannequinBgInstruction}
LIGHTING: ${mannequinLightingInstruction}

The result should look like professional e-commerce ghost mannequin photography.`;

				let mannequinGenerated = false;

				// Try 1: Gemini 3.1 Flash Image (Nano Banana 2.0) — edit-style, preserves source garment
				// Supports image-in → image-out, so it can see and preserve the actual garment
				try {
					log.info({ base64Length: base64Garment.length, mimeType: garmentMimeType }, 'Sending image to Nano Banana 2');
					const flashCtrl = new AbortController();
					const flashTimeout = setTimeout(() => flashCtrl.abort(), 60000);
					const flashRes = await protectedApiCall('Google Gemini', () => fetch(
						`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${geminiApiKey}`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							signal: flashCtrl.signal,
							body: JSON.stringify({
								contents: [{ role: 'user', parts: [
									{ text: mannequinPrompt },
									{ inline_data: { mime_type: garmentMimeType, data: base64Garment } }
								]}],
								generationConfig: {
									responseModalities: ['TEXT', 'IMAGE']
								}
							})
						}
					));
					clearTimeout(flashTimeout);

					if (flashRes.ok) {
						const flashResult = await flashRes.json();
						const candidate = flashResult.candidates?.[0];
						const parts = candidate?.content?.parts || [];
						const finishReason = candidate?.finishReason;

						// Log full response structure for debugging
						log.info({
							finishReason,
							partsCount: parts.length,
							partKeys: parts.map((p: any) => Object.keys(p))
						}, 'Nano Banana 2 raw response structure');

						// Check for safety blocks or content policy rejections
						if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
							log.warn({ finishReason, partsCount: parts.length }, 'Nano Banana 2 returned non-standard finish reason');
						}

						// Extract any text response for debugging
						const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
						if (textParts.length > 0) {
							log.info({ textResponse: textParts.join(' ').substring(0, 200) }, 'Nano Banana 2 text response');
						}

						// Check for image data in BOTH formats:
						// - snake_case: inline_data (what we send in request)
						// - camelCase: inlineData (what Google sometimes returns)
						for (const part of parts) {
							const imageData = part.inline_data?.data || part.inlineData?.data;
							const mimeType = part.inline_data?.mime_type || part.inlineData?.mimeType;
							if (imageData) {
								processedImageBuffer = Buffer.from(imageData, 'base64');
								mannequinGenerated = true;
								log.info({ outputSize: processedImageBuffer.length, mimeType }, 'Ghost mannequin generated via Nano Banana 2');
								break;
							}
						}

						if (!mannequinGenerated) {
							log.warn({
								finishReason,
								partsCount: parts.length,
								hasText: textParts.length > 0,
								partTypes: parts.map((p: any) => Object.keys(p).join(','))
							}, 'Nano Banana 2 returned OK but no image data — check partTypes for camelCase mismatch');
						}
					} else {
						const errBody = await flashRes.text().catch(() => '');
						log.warn({ status: flashRes.status, body: errBody.substring(0, 300) }, 'Nano Banana 2 HTTP error');
					}
				} catch (flashErr) {
					log.warn({ err: flashErr }, 'Gemini 3.1 Flash Image generation failed');
				}

				// Try 2: Imagen 4 text-only fallback (cannot reference source image, but generates clean garment)
				// Note: Imagen 3 (imagen-3.0-generate-002) returned 404 — superseded by Imagen 4
				if (!mannequinGenerated) {
					log.info('Falling back to Imagen 4 text-only for ghost mannequin');
					try {
						const imagen4Ctrl = new AbortController();
						const imagen4Timeout = setTimeout(() => imagen4Ctrl.abort(), 30000);
						const imagen4Res = await protectedApiCall('Google Imagen', () => fetch(
							'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
								signal: imagen4Ctrl.signal,
								body: JSON.stringify({
									instances: [{ prompt: `Professional e-commerce ghost mannequin photography of a ${garmentDesc}. ${volumeDetail}. The garment floats in 3D space on an invisible form. ${hasStylizedBg && mannequinBgInstruction !== 'Pure white, clean and uniform.' ? `Background: ${mannequinBgInstruction}` : 'Pure white background'}, soft studio lighting, gentle shadow beneath. High resolution, sharp focus on fabric texture and stitching. No mannequin visible, no human body.` }],
									parameters: {
										sampleCount: 1,
										aspectRatio: '1:1',
										safetyFilterLevel: 'block_only_high'
									}
								})
							}
						));
						clearTimeout(imagen4Timeout);

						if (imagen4Res.ok) {
							const imagen4Result = await imagen4Res.json();
							const prediction = imagen4Result.predictions?.[0];
							if (prediction?.bytesBase64Encoded) {
								processedImageBuffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
								mannequinGenerated = true;
								log.info('Ghost mannequin generated via Imagen 4 fallback');
							} else {
								log.warn({ keys: Object.keys(prediction || {}) }, 'Imagen 4 returned OK but no image bytes');
							}
						} else {
							const errBody = await imagen4Res.text().catch(() => '');
							log.warn({ status: imagen4Res.status, body: errBody.substring(0, 300) }, 'Imagen 4 fallback failed');
						}
					} catch (imgErr) {
						log.warn({ err: imgErr }, 'Imagen 4 fallback request error');
					}
				}

				if (!mannequinGenerated) {
					log.warn('All mannequin generation methods failed, returning bg-removed garment cutout');
				}

				// Cost: ~$0.067 for Nano Banana 2.0, $0.004 for Imagen 4 fallback
				totalCost += mannequinGenerated ? 0.067 : 0;
				if (mannequinGenerated) trackApi('google_gemini', 'mannequin_composite', 0.067);

				// Flag for the output loop: mannequin images are complete opaque images
				// with white background baked in. Skip trim/composite — just resize per marketplace.
				if (mannequinGenerated) {
					mannequinOutputReady = true;
				}
			}
		}

		// WF-18: Product in Human Hands (STANDALONE)
		// Only runs when hands was NOT already merged into Gemini scene integration.
		// When both stylize-background + product-in-hands are selected, the scene step handles both
		// in a single Gemini call for cohesive results (e.g. dragon-in-backyard-hands example).
		// This standalone path handles hands-only (no stylize) or fallback cases.
		if (enhancements.includes('product-held-in-hands') && !handsHandledByScene) {
			await updateProgress('Generating lifestyle image...');
			log.debug(' Generating product-in-hands lifestyle image (standalone — not merged with scene)...');

			const geminiApiKey = env.GOOGLE_GEMINI_API_KEY;
			if (!geminiApiKey) {
				log.warn('GOOGLE_GEMINI_API_KEY not configured, skipping product-in-hands');
			} else {
				// Step 1: Analyze product for optimal hand placement
				const artDirection: ArtDirection = {};
				const productCategory = (job.classification_details as any)?.product_type || productType || 'general product';

				// Use the saved product cutout (before stylize) so Gemini sees the isolated product,
				// not a full styled scene which confuses hands generation.
				const handsInputBuffer = productCutoutBuffer ?? processedImageBuffer;

				log.info({ productCategory, usingCutout: !!productCutoutBuffer }, 'Analyzing product for hand placement');
				const analysis = await analyzeForHands(
					{
						imageUrl: job.product_image_url,
						imageBuffer: handsInputBuffer,
						productCategory,
						artDirection
					},
					geminiApiKey
				);
				totalCost += 0.001; // Gemini Flash analysis cost
				trackApi('google_gemini', 'vision_analysis', 0.001);
				log.info({ gripType: analysis.gripType, confidence: analysis.confidence }, 'Hands analysis complete');

				// Step 2: Build structured prompt
				const handsPrompt = buildHandsPrompt(analysis, productCategory, artDirection);

				let handsGenerated = false;

				// Try 1: Gemini 3.1 Flash Image (PRIMARY — Nano Banana 2.0)
				// This model supports image input + image output, so it can see the actual product
				try {
					const productBase64 = handsInputBuffer.toString('base64');
					const geminiRes = await protectedApiCall('Google Gemini', () => fetch(
						`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${geminiApiKey}`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								contents: [{
									parts: [
										{ text: `Here is the product image. Generate a new photorealistic image of this EXACT product being held in human hands. Keep the product's colors, details, shape, and proportions exactly as shown. Do NOT change the product.

${handsPrompt}` },
										{ inline_data: { mime_type: 'image/png', data: productBase64 } }
									]
								}],
								generationConfig: {
									responseModalities: ['TEXT', 'IMAGE']
								}
							})
						}
					));

					if (geminiRes.ok) {
						const geminiResult = await geminiRes.json();
						const parts = geminiResult.candidates?.[0]?.content?.parts || [];
						for (const part of parts) {
							if (part.inline_data?.data) {
								processedImageBuffer = Buffer.from(part.inline_data.data, 'base64');
								handsGenerated = true;
								log.info('Product-in-hands generated via Gemini 3 Pro Image');
								break;
							}
						}
					} else {
						const errText = await geminiRes.text();
						log.warn({ status: geminiRes.status, body: errText.substring(0, 500) }, 'Gemini 3 Pro product-in-hands failed, trying Imagen 3');
					}
				} catch (geminiErr) {
					log.warn({ err: geminiErr }, 'Gemini 3 Pro product-in-hands request error, trying Imagen 4');
				}

				// Try 2: Imagen 4 text-only fallback (cannot use source image, generates from description)
				// Note: Imagen 3 (imagen-3.0-generate-002) returned 404 — superseded by Imagen 4
				if (!handsGenerated) {
					try {
						const imagen4Ctrl = new AbortController();
						const imagen4Timeout = setTimeout(() => imagen4Ctrl.abort(), 30000);
						const imagen4Res = await protectedApiCall('Google Imagen', () => fetch(
							'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
								signal: imagen4Ctrl.signal,
								body: JSON.stringify({
									instances: [{ prompt: handsPrompt }],
									parameters: {
										sampleCount: 1,
										aspectRatio: '1:1',
										outputOptions: { mimeType: 'image/png' }
									}
								})
							}
						));
						clearTimeout(imagen4Timeout);

						if (imagen4Res.ok) {
							const imagen4Result = await imagen4Res.json();
							const base64Data = imagen4Result.predictions?.[0]?.bytesBase64Encoded;
							if (base64Data) {
								processedImageBuffer = Buffer.from(base64Data, 'base64');
								handsGenerated = true;
								log.info('Product-in-hands generated via Imagen 4 (text-only fallback)');
							}
						} else {
							const errBody = await imagen4Res.text().catch(() => '');
							log.warn({ status: imagen4Res.status, body: errBody.substring(0, 300) }, 'Imagen 4 also failed for product-in-hands');
						}
					} catch (imagen4Err) {
						log.warn({ err: imagen4Err }, 'Imagen 4 product-in-hands request error');
					}
				}

				if (!handsGenerated) {
					log.warn('All product-in-hands generation methods failed, keeping original image');
				}

				totalCost += 0.004; // Generation cost
				if (handsGenerated) trackApi('google_gemini', 'product_in_hands', 0.004);
			}
		}

		// WF-10: Generate Product Descriptions (text, not image — runs alongside any image tool)
		// Generates marketplace-optimized titles, descriptions, tags, and SEO keywords
		// Uses upstream classification + specialty vocabulary per product type
		let productDescriptions: Record<string, { title: string; description: string; tags: string[]; seo_keywords: string[] }> | null = null;

		if (enhancements.includes('generate-product-description')) {
			await updateProgress('Writing product descriptions...');
			log.debug(' Generating marketplace product descriptions...');

			const geminiApiKey = env.GOOGLE_GEMINI_API_KEY;
			if (!geminiApiKey) {
				log.warn('GOOGLE_GEMINI_API_KEY not configured, skipping product descriptions');
			} else {
				try {
					// Reuse upstream classification data
					const classDetails = job.classification_details as any;
					const descProductName = productDescription !== productType ? productDescription : (classDetails?.product_name || productType);
					const descProductType = productType || 'general';
					const descMaterial = classDetails?.material || classDetails?.details?.material || '';
					const descColor = classDetails?.color || classDetails?.details?.color || '';
					const descStyle = classDetails?.style || classDetails?.details?.style || '';

					// Specialty vocabulary by product type
					const SPECIALTY_VOCAB: Record<string, { vocabulary: string[]; tone: string; seoKeywords: string[]; callToAction: string }> = {
						jewelry: {
							vocabulary: ['carat', 'clarity', 'cut', 'setting', 'gemstone', '14K', '18K', 'white gold', 'rose gold', 'brilliant', 'princess cut'],
							tone: 'luxury',
							seoKeywords: ['fine jewelry', 'handcrafted jewelry', 'luxury jewelry'],
							callToAction: 'Timeless elegance for your special moments.'
						},
						clothing: {
							vocabulary: ['fabric', 'fit', 'silhouette', 'drape', 'tailored', 'breathable', 'stretch', 'comfortable'],
							tone: 'approachable',
							seoKeywords: ['fashion', 'apparel', 'style'],
							callToAction: 'Elevate your wardrobe today.'
						},
						electronics: {
							vocabulary: ['specifications', 'performance', 'battery life', 'connectivity', 'resolution', 'wireless', 'USB-C'],
							tone: 'technical',
							seoKeywords: ['tech gadget', 'electronics', 'high performance'],
							callToAction: 'Upgrade your tech today.'
						},
						accessories: {
							vocabulary: ['genuine leather', 'hardware', 'clasp', 'adjustable', 'handcrafted', 'premium', 'versatile'],
							tone: 'trendy',
							seoKeywords: ['fashion accessories', 'style essentials'],
							callToAction: 'Complete your look.'
						},
						home_decor: {
							vocabulary: ['handcrafted', 'artisan', 'statement piece', 'minimalist', 'bohemian', 'contemporary'],
							tone: 'aspirational',
							seoKeywords: ['home decor', 'interior design', 'decorative'],
							callToAction: 'Make your space uniquely yours.'
						},
						general: {
							vocabulary: ['quality', 'durable', 'practical', 'versatile'],
							tone: 'neutral',
							seoKeywords: ['quality product', 'essential'],
							callToAction: 'Get yours today.'
						}
					};

					// Marketplace-specific prompt rules
					const MARKETPLACE_RULES: Record<string, string> = {
						etsy: `Etsy rules: Title max 140 chars, SEO-heavy with materials/descriptors. Conversational warm tone. Emphasize handmade/unique. 13 tags max.`,
						amazon: `Amazon rules: Title max 200 chars (Brand + Product + Feature + Size/Color). 5 bullet points in CAPITALIZED feature-benefit format. Include specs.`,
						poshmark: `Poshmark rules: Title max 80 chars, brand-first. Casual friendly tone. Focus on size, fit, condition, styling tips. Include condition (NWT/EUC/GUC).`,
						ebay: `eBay rules: Title max 80 chars, keyword-stuffed. Detailed specs and condition grading. Include shipping dimensions. Item specifics format.`
					};

					const specialty = SPECIALTY_VOCAB[descProductType] || SPECIALTY_VOCAB.general;

					// Use the job's selected marketplaces (already validated upstream)
					const descMarketplaces = (job.marketplaces as string[]) || ['etsy', 'amazon'];
					const targetMarketplaces = [...new Set(descMarketplaces)].slice(0, 4);

					// Generate descriptions for all marketplaces in parallel
					const descriptionPromises = targetMarketplaces.map(async (marketplace) => {
						const rules = MARKETPLACE_RULES[marketplace] || MARKETPLACE_RULES.ebay;
						const prompt = `You are an expert e-commerce copywriter. Generate a product listing for "${marketplace}".

Product: ${descProductName}
Category: ${descProductType}
Material: ${descMaterial || 'not specified'}
Color: ${descColor || 'not specified'}
Style: ${descStyle || 'not specified'}

Writing tone: ${specialty.tone}
Use specialty vocabulary where relevant: ${specialty.vocabulary.join(', ')}
SEO keywords to incorporate: ${specialty.seoKeywords.join(', ')}

${rules}

Return ONLY this JSON (no markdown, no code blocks):
{
  "title": "Marketplace-optimized product title",
  "description": "Full product description following marketplace rules above",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
  "seo_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

						const res = await protectedApiCall('Google Gemini', () => fetch(
							`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									contents: [{ parts: [{ text: prompt }] }],
									generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
								})
							}
						));

						if (!res.ok) {
							log.warn({ status: res.status, marketplace }, 'Description generation failed for marketplace');
							return { marketplace, result: { title: descProductName, description: '', tags: [], seo_keywords: [] } };
						}

						const data = await res.json();
						const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
						const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

						try {
							const parsed = JSON.parse(cleanText);
							return {
								marketplace,
								result: {
									title: parsed.title || descProductName,
									description: parsed.description || '',
									tags: Array.isArray(parsed.tags) ? parsed.tags : [],
									seo_keywords: Array.isArray(parsed.seo_keywords) ? parsed.seo_keywords : []
								}
							};
						} catch {
							log.warn({ marketplace, text: cleanText.substring(0, 200) }, 'Failed to parse description JSON');
							return { marketplace, result: { title: descProductName, description: '', tags: [], seo_keywords: [] } };
						}
					});

					const results = await Promise.all(descriptionPromises);

					productDescriptions = {};
					for (const { marketplace, result } of results) {
						productDescriptions[marketplace] = result;
					}

					// Cost: classification already done upstream, ~$0.001 per marketplace description
					const descCost = targetMarketplaces.length * 0.001;
					totalCost += descCost;
					for (const _m of targetMarketplaces) {
						trackApi('google_gemini', 'product_description', 0.001);
					}

					log.info(
						{ marketplaces: targetMarketplaces, cost: `$${descCost.toFixed(3)}` },
						'Product descriptions generated'
					);
				} catch (descErr) {
					log.warn({ err: descErr }, 'Product description generation failed, continuing without descriptions');
				}
			}
		}

		// WF-15: Add Natural Shadow (for white/solid backgrounds)
		// Only add shadow if:
		// 1. Background was removed (we have a cutout)
		// 2. No stylize-background (AI backgrounds include their own shadows)
		// 3. Shadow style is specified or defaults to 'natural' for cutouts
		const hasBackgroundRemoval = enhancements.includes('remove-background');
		const hasStyleTransfer = enhancements.includes('stylize-background');
		const shadowStyle = ((job.classification_details as any)?.shadow_style || 'natural') as ShadowStyle;
		const backgroundColor = ((job.classification_details as any)?.background_color || '#FFFFFF') as string;

		// Shadow will be applied during marketplace output generation (below)
		// This ensures proper white background and correct dimensions for each marketplace
		log.debug(` Shadow config: style=${shadowStyle}, bgColor=${backgroundColor}, willApply=${hasBackgroundRemoval && !hasStyleTransfer && shadowStyle !== 'none'}`);

		// 7. Generate marketplace-specific outputs
		await updateProgress('Creating marketplace-ready images...');
		log.debug(' Generating marketplace-specific outputs...');

		// Get selected marketplaces from job
		const marketplaces = (job.marketplaces as string[]) || ['amazon']; // Default to Amazon if not specified
		log.debug(` Generating outputs for ${marketplaces.length} marketplace(s): ${marketplaces.join(', ')}`);

		// Marketplace dimension specifications
		const MARKETPLACE_SPECS: Record<string, { width: number; height: number }> = {
			amazon: { width: 2048, height: 2048 },
			ebay: { width: 1600, height: 1600 },
			etsy: { width: 2000, height: 2000 },
			shopify: { width: 2048, height: 2048 },
			instagram: { width: 1080, height: 1080 },
			facebook: { width: 1080, height: 1080 },
			pinterest: { width: 1000, height: 1500 },
			poshmark: { width: 1600, height: 1600 }
		};

		const sharp = (await import('sharp')).default;
		const outputs: Array<{
			marketplace: string;
			output_url: string;
			storage_path: string;
			filename: string;
			dimensions: string;
			file_size_bytes: number;
		}> = [];

		// Generate one output per marketplace
		// IMPORTANT: Product fills 85% of canvas, centered with white background
		// This ensures the product is prominent and properly sized for marketplace requirements
		for (const marketplace of marketplaces) {
			const spec = MARKETPLACE_SPECS[marketplace] || MARKETPLACE_SPECS.amazon;
			const { width: canvasWidth, height: canvasHeight } = spec;
			const dimensions = `${canvasWidth}x${canvasHeight}`;

			log.debug(`   ${marketplace}: Generating ${dimensions} output...`);

			// Get current product dimensions
			const productMeta = await sharp(processedImageBuffer).metadata();
			const productWidth = productMeta.width || 500;
			const productHeight = productMeta.height || 500;

			log.debug(`     Source: ${productWidth}x${productHeight}`);

			let resizedBuffer: Buffer;

			// ============================================================
			// PATH A: GEMINI SCENE INTEGRATION OUTPUT
			// Scene was pre-generated with product naturally placed
			// Just apply watermark if needed
			// NOTE: mannequinOutputReady takes priority — when invisible-mannequin
			// + stylize-background are both active, the mannequin path handles it
			// (mannequin prompt already includes the styled background)
			// ============================================================
			if (useGeminiSceneIntegration && geminiSceneOutputs?.has(marketplace) && !mannequinOutputReady) {
				log.debug(`      Using Gemini-generated scene for ${marketplace}`);
				resizedBuffer = geminiSceneOutputs.get(marketplace)!;

				// Ensure correct dimensions (should already be correct, but verify)
				const geminiMeta = await sharp(resizedBuffer).metadata();
				if (geminiMeta.width !== canvasWidth || geminiMeta.height !== canvasHeight) {
					log.debug(`      Resizing Gemini output: ${geminiMeta.width}x${geminiMeta.height} → ${dimensions}`);
					resizedBuffer = await sharp(resizedBuffer)
						.resize(canvasWidth, canvasHeight, {
							kernel: 'lanczos3',
							fit: 'cover',
							position: 'center'
						})
						.png({ quality: 100, compressionLevel: 6 })
						.toBuffer();
				}
			}
			// ============================================================
			// PATH B: LEGACY COMPOSITING (Flux background + product composite)
			// ============================================================
			else if (hasStyleTransfer && styleBackgroundBuffer) {
				// ============================================================
				// STYLE-TRANSFERRED OUTPUT: Composite at FINAL resolution
				//
				// LIGHTING INTEGRATION MODES:
				// - 'standard' (default): Color temp + ambient spill + compositing
				// - 'premium': Flux Fill inpainting for seamless AI blending
				//
				// MOIRÉ PREVENTION (2026-02-05):
				// Previously we composited at 1024x1024 then upscaled the scene,
				// which reintroduced moiré on gemstone facets and fabric textures.
				//
				// LIGHTING INTEGRATION (2026-02-05):
				// Before compositing, we match the product's lighting to the scene:
				// - Color temperature matching (warm/cool tint)
				// - Ambient light spill on edges (bounce light simulation)
				// - Brightness adjustment to match scene luminosity
				//
				// NEW APPROACH:
				// 1. Background is at 1024x1024 (from Flux Pro 1.1)
				// 2. Apply lighting integration to product (color temp + ambient spill)
				// 3. Call compositeProductOnBackground with FINAL marketplace dims
				// 4. Function upscales background to final size, scales product
				//    with multi-step mitchell kernel, then composites
				// 5. NO upscaling of the composited scene — moiré-free!
				//
				// The product (processedImageBuffer) has been processed by
				// GemPerfect/CleanEdge and preserves that quality.
				// ============================================================

				// Check if premium Flux Fill integration is enabled
				const lightingMode = (job.classification_details as any)?.lightingIntegrationMode || 'standard';
				let artDirectionPrompt = (job.classification_details as any)?.presetStylePrompt || job.ai_prompt || '';
				// Adapt preset prompt to strip original product reference for compositing
				if ((job.classification_details as any)?.presetStylePrompt && artDirectionPrompt) {
					const geminiKey = env.GOOGLE_GEMINI_API_KEY || '';
					if (geminiKey) {
						artDirectionPrompt = await adaptPresetPromptForProduct(artDirectionPrompt, productType, geminiKey);
					}
				}

				let compositedScene: Buffer;

				if (lightingMode === 'premium') {
					// ============================================================
					// PREMIUM MODE: Flux Fill Inpainting
					// Uses AI to seamlessly blend product into scene with perfect
					// lighting, shadows, and perspective. Costs ~$0.03 extra per image.
					// ============================================================
					log.debug(`      PREMIUM: Using Flux Fill inpainting for seamless scene integration`);

					try {
						compositedScene = await blendProductWithFluxFill(
							processedImageBuffer,
							artDirectionPrompt,
							productDescription,
							'', // styleDescription already baked into background
							canvasWidth,
							canvasHeight
						);
						log.debug(`      Flux Fill blending complete at ${dimensions}`);
					} catch (fluxFillError: any) {
						// Fallback to standard compositing if Flux Fill fails
						log.warn(`      Flux Fill failed, falling back to standard: ${fluxFillError.message}`);

						const lightingMatchedProduct = await integrateProductLighting(
							processedImageBuffer,
							styleBackgroundBuffer
						);
						compositedScene = await compositeProductOnBackground(
							lightingMatchedProduct,
							styleBackgroundBuffer,
							canvasWidth,
							canvasHeight
						);
					}
				} else {
					// ============================================================
					// STANDARD MODE: Color Temperature + Ambient Spill + Compositing
					// High quality integration at no extra cost. Default for all jobs.
					// ============================================================
					log.debug(`      Style transfer: compositing at final ${dimensions} resolution (moiré-free)`);

					// Step 1: LIGHTING INTEGRATION - Simplified version using Sharp's native methods
					// The raw pixel interleaving approach was corrupting the alpha channel
					// Now using modulate() which preserves alpha natively
					log.debug(`      Applying simplified lighting integration...`);
					let lightingMatchedProduct: Buffer;
					try {
						const sharp = (await import('sharp')).default;

						// Extract background color temperature (simplified)
						const bgSample = await sharp(styleBackgroundBuffer)
							.resize(16, 16, { fit: 'cover' })
							.removeAlpha()
							.raw()
							.toBuffer();

						let totalR = 0, totalG = 0, totalB = 0;
						for (let i = 0; i < bgSample.length; i += 3) {
							totalR += bgSample[i];
							totalG += bgSample[i + 1];
							totalB += bgSample[i + 2];
						}
						const pixels = bgSample.length / 3;
						const avgR = totalR / pixels;
						const avgG = totalG / pixels;
						const avgB = totalB / pixels;
						const brightness = (avgR + avgG + avgB) / 3;

						log.debug(`     Background: RGB(${avgR.toFixed(0)}, ${avgG.toFixed(0)}, ${avgB.toFixed(0)}), brightness=${brightness.toFixed(0)}`);

						// Apply subtle brightness adjustment using modulate (preserves alpha natively)
						const brightnessAdjust = Math.min(1.08, Math.max(0.95, brightness / 140));
						lightingMatchedProduct = await sharp(processedImageBuffer)
							.modulate({
								brightness: brightnessAdjust,
								saturation: 1.03  // Very subtle saturation boost
							})
							.png()
							.toBuffer();

						log.debug(`      Lighting applied: brightness=${brightnessAdjust.toFixed(2)}`);
					} catch (lightingError: any) {
						log.warn(`      Lighting failed, using original: ${lightingError.message}`);
						lightingMatchedProduct = processedImageBuffer;
					}

					// Step 2: Composite product onto styled background at FINAL marketplace resolution
					// The compositeProductOnBackground function will:
					// - Upscale background from 1024x1024 to canvasWidth x canvasHeight
					// - Scale product to 65% of canvas with multi-step mitchell upscaling
					// - Composite with realistic drop shadows
					compositedScene = await compositeProductOnBackground(
						lightingMatchedProduct,    // Product with lighting matched to scene
						styleBackgroundBuffer,     // AI-generated background at 1024x1024
						canvasWidth,               // Final width (e.g., 2000 for Etsy)
						canvasHeight               // Final height (e.g., 2000 for Etsy)
					);

					log.debug(`      Composited at ${dimensions} final resolution (no scene upscaling, moiré-free)`);
				}

				// Flatten any remaining transparency and output as PNG
				resizedBuffer = await sharp(compositedScene)
					.flatten({ background: { r: 255, g: 255, b: 255 } })
					.png({ quality: 100, compressionLevel: 6 })
					.toBuffer();
			} else if (mannequinOutputReady) {
				// ============================================================
				// MANNEQUIN OUTPUT: Complete image from Nano Banana / Imagen 4
				// The AI already generated a finished ghost mannequin image with
				// background baked in. Just resize to marketplace dimensions.
				// For white-bg mannequins: eBay gets #F5F5F5 tint.
				// For styled-bg mannequins: no tint, just resize.
				// No trim, no composite, no shadow — saves cost and complexity.
				// ============================================================
				log.debug(`      Mannequin output (styled=${hasStyleTransfer}): resizing to ${dimensions}`);

				resizedBuffer = await sharp(processedImageBuffer)
					.resize(canvasWidth, canvasHeight, {
						kernel: 'lanczos3',
						fit: 'contain',
						background: { r: 255, g: 255, b: 255 }
					})
					.png({ quality: 100, compressionLevel: 6 })
					.toBuffer();

				// eBay requires #F5F5F5 background — but only for plain white-bg mannequins
				// When stylize-background is active, the AI generated a styled scene — don't tint it
				if (marketplace === 'ebay' && !hasStyleTransfer) {
					resizedBuffer = await sharp(resizedBuffer)
						.linear(245 / 255, 0)
						.png({ quality: 100, compressionLevel: 6 })
						.toBuffer();
					log.debug(`      eBay: applied #F5F5F5 background tint`);
				}
			} else {
				// ============================================================
				// PRODUCT-ON-BACKGROUND OUTPUT: Smart fill on solid canvas
				// Default: white (#FFFFFF). Solid-color stylize: user's chosen hex.
				// Product is a cutout with transparent background.
				// TRIM transparent padding first, then scale subject to 65%
				// of canvas so the actual product fills the frame properly.
				// Apply product-type-specific post-upscale polish.
				// ============================================================

				// Determine canvas background color (white default, or user's solid color)
				// eBay requires #f5f5f5 background for BG-removal listings
				const ebayBg = (marketplace === 'ebay' && hasBackgroundRemoval && !hasStyleTransfer) ? '#F5F5F5' : null;
				const canvasHex = solidColorHex || ebayBg || '#FFFFFF';
				const canvasR = parseInt(canvasHex.slice(1, 3), 16);
				const canvasG = parseInt(canvasHex.slice(3, 5), 16);
				const canvasB = parseInt(canvasHex.slice(5, 7), 16);
				const canvasBg = { r: canvasR, g: canvasG, b: canvasB };

				if (solidColorHex) {
					log.debug(`     Using solid-color background: ${canvasHex} (RGB: ${canvasR},${canvasG},${canvasB})`);
				}

				// Trim transparent padding to get tight bounding box around actual subject
				const trimmedProduct = await sharp(processedImageBuffer)
					.trim({ threshold: 10 })
					.toBuffer();
				const trimmedMeta = await sharp(trimmedProduct).metadata();
				const trimmedWidth = trimmedMeta.width || productWidth;
				const trimmedHeight = trimmedMeta.height || productHeight;

				log.debug(`     Trimmed subject: ${trimmedWidth}x${trimmedHeight} (was ${productWidth}x${productHeight})`);

				// Scale subject so longest edge fills 65% of canvas
				const FILL_RATIO = 0.65;
				const targetProductSize = Math.round(Math.min(canvasWidth, canvasHeight) * FILL_RATIO);
				const productAspect = trimmedWidth / trimmedHeight;

				let finalProductWidth: number;
				let finalProductHeight: number;

				if (productAspect > 1) {
					// Wider than tall
					finalProductWidth = targetProductSize;
					finalProductHeight = Math.round(targetProductSize / productAspect);
				} else {
					// Taller than wide (or square)
					finalProductHeight = targetProductSize;
					finalProductWidth = Math.round(targetProductSize * productAspect);
				}

				log.debug(`     Product scaled to: ${finalProductWidth}x${finalProductHeight} (${Math.round(FILL_RATIO * 100)}% fill of ${canvasWidth}x${canvasHeight})`);

				// Product type detection (used for both scaling strategy and post-scale polish)
				const jewelryTypes = [
					'jewelry', 'jewellery', 'ring', 'necklace', 'bracelet', 'earring', 'earrings',
					'pendant', 'brooch', 'watch', 'gemstone', 'diamond', 'pearl', 'gold', 'silver',
					'platinum', 'engagement ring', 'wedding ring', 'chain', 'bangle', 'anklet',
					'cufflink', 'cufflinks', 'tiara', 'crown'
				];
				const clothingTypes = [
					'clothing', 'clothes', 'apparel', 'fashion', 'garment', 'outfit',
					'shirt', 'blouse', 'top', 't-shirt', 'tshirt', 'sweater', 'hoodie', 'jacket',
					'coat', 'blazer', 'cardigan', 'vest', 'tank top',
					'pants', 'jeans', 'trousers', 'shorts', 'leggings', 'skirt',
					'dress', 'gown', 'romper', 'jumpsuit',
					'suit', 'tuxedo', 'uniform',
					'underwear', 'lingerie', 'swimwear', 'bikini', 'swimsuit',
					'activewear', 'sportswear', 'athleisure',
					'denim', 'leather jacket', 'knitwear', 'cashmere',
					'fabric', 'textile', 'cotton', 'silk', 'wool', 'polyester',
					'bag', 'handbag', 'purse', 'backpack', 'tote',
					'shoe', 'shoes', 'sneaker', 'boot', 'heel', 'sandal', 'loafer'
				];
				const productTypeLower = (job.product_type || '').toLowerCase();
				const isJewelryProduct = jewelryTypes.some((type) => productTypeLower.includes(type));
				const isClothingProduct = clothingTypes.some((type) => productTypeLower.includes(type));

				// Step 1: Scale trimmed subject to target size with quality-appropriate strategy
				// Use multi-step upscaling to prevent moiré on fine patterns (jewelry, textiles)
				const scaleFactorX = finalProductWidth / trimmedWidth;
				const scaleFactorY = finalProductHeight / trimmedHeight;
				const maxScaleFactor = Math.max(scaleFactorX, scaleFactorY);

				let scaledProduct: Buffer;

				if (maxScaleFactor < 0.7) {
					// ============================================================
					// DOWNSCALING PATH (2026-02-05)
					// Large source images (e.g., 4000px HEIC phone photos) need
					// careful downscaling to avoid moiré on fine repetitive textures
					// like brushed metal, fabric weave, chain links, etc.
					//
					// Lanczos3 is sharp but can introduce ringing/moiré when
					// downscaling significantly. Mitchell is gentler.
					//
					// For jewelry/clothing: apply light Gaussian blur BEFORE
					// downscaling to break up repetitive patterns, then use
					// mitchell kernel for the resize.
					// ============================================================
					const needsPreBlur = isJewelryProduct || isClothingProduct;
					log.debug(`     Downscaling (${maxScaleFactor.toFixed(2)}x factor, pre-blur=${needsPreBlur})`);

					let sourceBuffer: Buffer = trimmedProduct;

					if (needsPreBlur) {
						// Light Gaussian blur to break up fine repetitive patterns
						// sigma 0.4 is barely visible but prevents aliasing during downscale
						sourceBuffer = await sharp(sourceBuffer)
							.blur(0.4)
							.toBuffer();
						log.debug(`       Pre-blur applied (sigma=0.4) for fine texture protection`);
					}

					scaledProduct = await sharp(sourceBuffer)
						.resize(finalProductWidth, finalProductHeight, {
							kernel: 'mitchell',  // Gentler than lanczos3, reduces downscale moiré
							fit: 'fill'
						})
						.toBuffer();
				} else if (maxScaleFactor > 1.3) {
					// Multi-step upscaling: scale in smaller increments to prevent moiré
					log.debug(`     Using multi-step upscaling (${maxScaleFactor.toFixed(2)}x factor)`);

					let currentBuffer: Buffer = trimmedProduct;
					let currentWidth = trimmedWidth;
					let currentHeight = trimmedHeight;

					// Step up in 1.5x increments for gradual scaling (prevents moiré on fine details)
					while (currentWidth * 1.5 <= finalProductWidth && currentHeight * 1.5 <= finalProductHeight) {
						currentBuffer = await sharp(currentBuffer)
							.resize(Math.round(currentWidth * 1.5), Math.round(currentHeight * 1.5), {
								kernel: 'lanczos3',
								fit: 'fill'
							})
							.toBuffer();
						currentWidth = Math.round(currentWidth * 1.5);
						currentHeight = Math.round(currentHeight * 1.5);
						log.debug(`       Upscale step: ${currentWidth}x${currentHeight}`);
					}

					// Final resize to exact target dimensions
					scaledProduct = await sharp(currentBuffer)
						.resize(finalProductWidth, finalProductHeight, {
							kernel: 'lanczos3',
							fit: 'fill'
						})
						.toBuffer();
				} else {
					// Near-1:1 resize (0.7x to 1.3x) — minimal moiré risk
					log.debug(`     Direct resize (${maxScaleFactor.toFixed(2)}x factor, low moiré risk)`);
					scaledProduct = await sharp(trimmedProduct)
						.resize(finalProductWidth, finalProductHeight, {
							kernel: 'mitchell',  // Mitchell for all resize, consistent quality
							fit: 'fill'
						})
						.toBuffer();
				}

				// Step 2: Optional post-scale polish (clothing/general only)
				// ═══════════════════════════════════════════════════════════════
				// BUG-20260217-002: Jewelry MUST skip ALL post-upscale sharpening.
				// ANY sharpen amplifies BRIA's segmentation artifacts into moiré.
				// ═══════════════════════════════════════════════════════════════
				if (isJewelryProduct) {
					log.debug(`     Jewelry: skipping post-upscale sharpen (moiré prevention)`);
				} else if (isClothingProduct && finalProductWidth >= 800) {
					// Clothing: Edge smoothing is handled by ThreadLogic pipeline
					scaledProduct = await sharp(scaledProduct)
						.sharpen({
							sigma: 0.5,
							m1: 0.8,
							m2: 0.3
						})
						.toBuffer();

					log.debug(`      Clothing texture sharpening applied`);
				} else if (finalProductWidth >= 600) {
					// UNIVERSAL CleanEdge polish for ALL other products
					log.debug(`     Applying CleanEdge universal polish (general product)`);

					scaledProduct = await sharp(scaledProduct)
						.sharpen({
							sigma: 0.5,
							m1: 0.8,
							m2: 0.3
						})
						.toBuffer();

					log.debug(`      CleanEdge universal polish applied (sharpen only, no median)`);
				}

				// Step 3: Create white canvas and composite product centered
				// FIX: When shadow is enabled, use addProductShadow() which creates a
				// silhouette-based shadow from the product's alpha channel (not a dumb rectangle).
				// addProductShadow() handles its own canvas creation, so we skip the manual
				// canvas composite when shadow is active.
				// Allow shadows for: bg-removal jobs AND solid-color stylize jobs
				// Solid-color stylize sets isSolidColorBackground=true, which overrides !hasStyleTransfer
				const wantsShadow = shadowStyle !== 'none' && (
					(hasBackgroundRemoval && !hasStyleTransfer) || isSolidColorBackground
				);

				if (wantsShadow) {
					// addProductShadow creates: canvas + silhouette shadow + product composite
					// It needs the transparent product image (with alpha) to extract the silhouette
					try {
						// First, create a transparent canvas with the product centered
						// (addProductShadow needs the product on a transparent background)
						// Ensure scaledProduct has alpha channel preserved (critical for shadow silhouette)
						const productWithAlpha = await sharp(scaledProduct).ensureAlpha().png().toBuffer();

						const transparentCanvas = await sharp({
							create: {
								width: canvasWidth,
								height: canvasHeight,
								channels: 4,
								background: { r: 0, g: 0, b: 0, alpha: 0 }
							}
						})
							.composite([
								{
									input: productWithAlpha,
									left: Math.round((canvasWidth - finalProductWidth) / 2),
									top: Math.round((canvasHeight - finalProductHeight) / 2)
								}
							])
							.ensureAlpha()
							.png()
							.toBuffer();

						// Apply silhouette-based shadow on white background
						resizedBuffer = await addProductShadow(transparentCanvas, {
							style: 'natural',
							backgroundColor: canvasHex,
							intensity: 1.0
						});

						// addProductShadow adds padding for shadow offset — trim back to canvas size
						const shadowMeta = await sharp(resizedBuffer).metadata();
						const shadowW = shadowMeta.width || canvasWidth;
						const shadowH = shadowMeta.height || canvasHeight;

						if (shadowW !== canvasWidth || shadowH !== canvasHeight) {
							// Extract the center region matching our target canvas size
							const extractLeft = Math.round((shadowW - canvasWidth) / 2);
							const extractTop = Math.round((shadowH - canvasHeight) / 2);
							resizedBuffer = await sharp(resizedBuffer)
								.extract({
									left: Math.max(0, extractLeft),
									top: Math.max(0, extractTop),
									width: Math.min(canvasWidth, shadowW),
									height: Math.min(canvasHeight, shadowH)
								})
								.resize(canvasWidth, canvasHeight, { fit: 'cover' })
								.png({ quality: 100, compressionLevel: 6 })
								.toBuffer();
						}

						log.debug(`   ${marketplace}: Silhouette ground shadow applied (natural style)`);
					} catch (shadowErr: any) {
						log.warn({ err: shadowErr }, `   ${marketplace}: Shadow failed, falling back to plain canvas`);
						// Fallback: solid canvas without shadow
						const leftOffset = Math.round((canvasWidth - finalProductWidth) / 2);
						const topOffset = Math.round((canvasHeight - finalProductHeight) / 2);
						resizedBuffer = await sharp({
							create: {
								width: canvasWidth,
								height: canvasHeight,
								channels: 3,
								background: canvasBg
							}
						})
							.composite([{ input: scaledProduct, left: leftOffset, top: topOffset }])
							.flatten({ background: canvasBg })
							.png({ quality: 100, compressionLevel: 6 })
							.toBuffer();
					}
				} else {
					// No shadow: direct composite on solid canvas
					const leftOffset = Math.round((canvasWidth - finalProductWidth) / 2);
					const topOffset = Math.round((canvasHeight - finalProductHeight) / 2);
					resizedBuffer = await sharp({
						create: {
							width: canvasWidth,
							height: canvasHeight,
							channels: 3,
							background: canvasBg
						}
					})
						.composite([{ input: scaledProduct, left: leftOffset, top: topOffset }])
						.flatten({ background: canvasBg })
						.png({ quality: 100, compressionLevel: 6 })
						.toBuffer();
				}
			}

			let finalBuffer = resizedBuffer;

			// Step 4b: Apply watermark for Free plan users
			if (applyWatermarkToOutputs) {
				finalBuffer = await applyWatermark(finalBuffer, marketplace, 'corner');
			}

			const fileSize = finalBuffer.length;

			// Upload to storage
			const filename = `product_${marketplace}_${dimensions}.png`;
			const { publicUrl: outputUrl, storagePath } = await uploadProcessedImage(
				adminClient,
				job.user_id,
				job_id,
				finalBuffer,
				filename
			);

			log.debug(`   ${marketplace}: ${(fileSize / 1024 / 1024).toFixed(2)}MB uploaded`);

			outputs.push({
				marketplace,
				output_url: outputUrl,
				storage_path: storagePath,
				filename,
				dimensions,
				file_size_bytes: fileSize
			});
		}

		// 8. Insert outputs into job_outputs table
		await updateProgress('Saving your images...');
		log.debug(' Saving outputs to database...');
		// Use upsert to handle duplicate entries (job may have been reprocessed)
		const { error: outputsError } = await adminClient
			.from('job_outputs')
			.upsert(
				outputs.map((output) => ({
					job_id: job_id,
					marketplace: output.marketplace,
					output_url: output.output_url,
					filename: output.filename,
					dimensions: output.dimensions,
					file_size_bytes: output.file_size_bytes,
					content_type: output.filename?.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
				})) as any,
				{ onConflict: 'job_id,marketplace' }
			);

		if (outputsError) {
			log.error({ err: outputsError }, 'Failed to save outputs');
			throw error(500, 'Failed to save job outputs');
		}

		log.debug(` Saved ${outputs.length} output(s) to job_outputs table`);

		// 9. Calculate final cost
		const costUsd = totalCost;

		// 10. Merge quality metadata with existing job metadata (including watermark and shadow info)
		const watermarkMetadata: WatermarkMetadata = {
			watermarked: applyWatermarkToOutputs,
			watermark_style: applyWatermarkToOutputs ? 'corner' : undefined,
			watermark_applied_at: applyWatermarkToOutputs ? new Date().toISOString() : undefined,
			subscription_tier_at_processing: subscriptionTier
		};

		// Track shadow metadata
		const shadowApplied = shadowStyle !== 'none' && (
			(hasBackgroundRemoval && !hasStyleTransfer) || isSolidColorBackground
		);
		const shadowMetadata = {
			shadow_applied: shadowApplied,
			shadow_style: shadowApplied ? shadowStyle : undefined,
			shadow_background_color: shadowApplied ? (solidColorHex || backgroundColor) : undefined
		};

		// Track background intent classification for preset reuse
		const intentMetadata = backgroundClassification ? {
			background_intent: backgroundClassification.intent,
			background_hex_color: backgroundClassification.hexColor || undefined,
			background_prompt: backgroundClassification.sanitizedPrompt
		} : {};

		const updatedDetails = {
			...(job.classification_details as object),
			...qualityMetadata,
			...watermarkMetadata,
			...shadowMetadata,
			...intentMetadata,
			output_count: outputs.length,
			marketplaces_processed: marketplaces,
			...(productDescriptions ? { product_descriptions: productDescriptions } : {})
		};

		// 11. Update job as completed (keep legacy output_image_url for backward compatibility)
		const legacyOutputUrl = outputs.find((o) => o.marketplace === 'amazon')?.output_url || outputs[0].output_url;

		let { error: updateError } = await adminClient
			.from('jobs')
			.update({
				status: 'completed',
				output_image_url: legacyOutputUrl,
				cost_usd: costUsd,
				classification_details: updatedDetails,
				completed_at: new Date().toISOString()
			})
			.eq('job_id', job_id);

		if (updateError) {
			log.error({ err: updateError }, 'Failed to update job record');
			// Mark job as failed so polling picks it up
			await adminClient.from('jobs').update({
				status: 'failed',
				error_message: 'Failed to save results. Please try again.',
				completed_at: new Date().toISOString()
			}).eq('job_id', job_id);
			return;
		}

		log.info({ jobId: job_id, outputCount: outputs.length }, 'Job completed successfully');

	} catch (err: any) {
		log.error({ err, jobId: job_id }, 'Background job processing failed');

		const isCircuitOpen = err instanceof ServiceUnavailableError;
		const errorMsg = isCircuitOpen
			? 'Service temporarily unavailable. Your credits have been refunded.'
			: err.body?.message || err.message || 'Processing failed. Please try again.';

		// Auto-refund credits on failure
		const refundAmount = getWorkflowCost(job.workflow_id || '');
		if (refundAmount > 0) {
			try {
				await adminClient.rpc('refund_credits', {
					p_user_id: userId,
					p_amount: refundAmount,
					p_job_id: job_id
				});
				log.info({ jobId: job_id, amount: refundAmount, circuitOpen: isCircuitOpen }, 'Credits auto-refunded');
			} catch (refundErr) {
				log.error({ err: refundErr, jobId: job_id }, 'Failed to auto-refund credits');
			}
		}

		// Update job status to failed so the polling UI shows the error
		try {
			await adminClient.from('jobs').update({
				status: 'failed',
				error_message: errorMsg,
				completed_at: new Date().toISOString()
			}).eq('job_id', job_id);
		} catch (updateErr) {
			log.error({ err: updateErr, jobId: job_id }, 'Failed to update job status to failed');
		}
	} finally {
		// Clear watchdog — job finished (success or failure), no need to force-fail it
		clearTimeout(watchdog);
	}
}
