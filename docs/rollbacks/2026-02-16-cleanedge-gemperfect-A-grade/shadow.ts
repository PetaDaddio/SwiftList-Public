/**
 * Product Shadow Utility for SwiftList
 *
 * Adds natural-looking shadows to product images.
 * - Sharp-based shadows for solid color backgrounds (fast, no API cost)
 * - Bria Product Shadow via Replicate for lifestyle/preset backgrounds (AI-powered)
 *
 * Shadow types:
 * - soft: Diffused shadow, like overcast/studio lighting
 * - hard: Sharp defined shadow, like direct sunlight
 * - floating: Elevated shadow, product appears to hover
 * - natural: Automatic soft shadow that mimics studio photography
 */

import type Replicate from 'replicate';
import { jobsLogger } from '$lib/utils/logger';

const log = jobsLogger.child({ component: 'shadow' });

// Shadow configuration
export const SHADOW_CONFIG = {
	// Soft shadow (default for white backgrounds)
	soft: {
		blur: 25,
		opacity: 0.35,
		offsetX: 0,
		offsetY: 15,
		spread: 1.05 // Slight spread for natural look
	},
	// Hard shadow (direct light simulation)
	hard: {
		blur: 8,
		opacity: 0.5,
		offsetX: 8,
		offsetY: 12,
		spread: 1.0
	},
	// Floating shadow (product appears elevated)
	floating: {
		blur: 40,
		opacity: 0.25,
		offsetX: 0,
		offsetY: 30,
		spread: 0.85 // Smaller shadow for floating effect
	},
	// Natural studio shadow
	natural: {
		blur: 15,
		opacity: 0.45,
		offsetX: 2,
		offsetY: 8,
		spread: 1.03
	}
};

export type ShadowStyle = keyof typeof SHADOW_CONFIG | 'none';

export interface ShadowOptions {
	style: ShadowStyle;
	backgroundColor?: string; // Hex color, default white
	intensity?: number; // 0-1, multiplier for opacity
}

/**
 * Detect if an image has a transparent background
 */
async function hasTransparentBackground(imageBuffer: Buffer): Promise<boolean> {
	const sharpModule = await import('sharp');
	const sharp = (sharpModule as any).default || sharpModule;

	const metadata = await sharp(imageBuffer).metadata();
	return metadata.hasAlpha === true;
}

/**
 * Create a shadow layer from the product silhouette using Sharp
 * This creates a natural-looking shadow by:
 * 1. Extracting the alpha channel (product shape)
 * 2. Blurring it to create soft edges
 * 3. Adjusting opacity and offset
 */
async function createSharpShadow(
	imageBuffer: Buffer,
	style: keyof typeof SHADOW_CONFIG,
	backgroundColor: string = '#FFFFFF'
): Promise<Buffer> {
	const sharpModule = await import('sharp');
	const sharp = (sharpModule as any).default || sharpModule;

	const config = SHADOW_CONFIG[style];
	const metadata = await sharp(imageBuffer).metadata();
	const width = metadata.width || 1000;
	const height = metadata.height || 1000;

	// Calculate shadow dimensions with offset
	const shadowWidth = Math.round(width * config.spread);
	const shadowHeight = Math.round(height * config.spread);

	// Create canvas with background color and extra space for shadow
	const canvasWidth = width + Math.abs(config.offsetX) * 2 + config.blur * 2;
	const canvasHeight = height + Math.abs(config.offsetY) * 2 + config.blur * 2;

	// Parse background color
	const bgColor = parseHexColor(backgroundColor);

	// Step 1: Extract alpha channel and create shadow silhouette
	// Convert product to grayscale silhouette for shadow
	const silhouette = await sharp(imageBuffer)
		.resize(shadowWidth, shadowHeight, { fit: 'inside' })
		.ensureAlpha()
		.extractChannel('alpha')
		.toBuffer();

	// Step 2: Create shadow layer (dark silhouette with blur)
	const shadowOpacity = Math.round(config.opacity * 255);
	const shadowLayer = await sharp(silhouette)
		.blur(config.blur)
		.modulate({ brightness: 0 }) // Make it black
		.ensureAlpha()
		// Tint to shadow color (dark gray/black)
		.tint({ r: 0, g: 0, b: 0 })
		.toBuffer();

	// Step 3: Create the final shadow with proper opacity
	// We need to composite: background -> shadow -> product
	const shadowWithAlpha = await sharp({
		create: {
			width: shadowWidth,
			height: shadowHeight,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: shadowOpacity / 255 }
		}
	})
		.composite([
			{
				input: await sharp(silhouette)
					.blur(Math.max(1, config.blur))
					.negate() // Invert so product area is transparent
					.toBuffer(),
				blend: 'dest-in'
			}
		])
		.png()
		.toBuffer();

	// Step 4: Create final composite image
	// Calculate positions
	const shadowX = Math.round((canvasWidth - shadowWidth) / 2 + config.offsetX);
	const shadowY = Math.round((canvasHeight - shadowHeight) / 2 + config.offsetY);
	const productX = Math.round((canvasWidth - width) / 2);
	const productY = Math.round((canvasHeight - height) / 2);

	// Create canvas with background
	const result = await sharp({
		create: {
			width: canvasWidth,
			height: canvasHeight,
			channels: 4,
			background: { r: bgColor.r, g: bgColor.g, b: bgColor.b, alpha: 1 }
		}
	})
		.composite([
			// Shadow layer (underneath)
			{
				input: shadowWithAlpha,
				left: shadowX,
				top: shadowY,
				blend: 'over'
			},
			// Product on top
			{
				input: imageBuffer,
				left: productX,
				top: productY,
				blend: 'over'
			}
		])
		.png({ quality: 100, compressionLevel: 6 })
		.toBuffer();

	return result;
}

/**
 * Simplified shadow approach using Sharp's built-in capabilities
 * Creates a contact shadow effect that looks natural on white/light backgrounds
 */
export async function addProductShadow(
	imageBuffer: Buffer,
	options: ShadowOptions = { style: 'natural' }
): Promise<Buffer> {
	const { style, backgroundColor = '#FFFFFF', intensity = 1.0 } = options;

	if (style === 'none') {
		return imageBuffer;
	}

	const sharpModule = await import('sharp');
	const sharp = (sharpModule as any).default || sharpModule;

	const config = SHADOW_CONFIG[style];
	const metadata = await sharp(imageBuffer).metadata();
	const width = metadata.width || 1000;
	const height = metadata.height || 1000;
	const hasAlpha = metadata.hasAlpha;
	const channels = metadata.channels || 3;

	log.debug({ width, height, hasAlpha, channels, style, intensity }, 'addProductShadow: input metadata');

	// If no alpha channel, we can't create a proper shadow — ensure alpha and retry
	if (!hasAlpha || channels < 4) {
		log.warn({ hasAlpha, channels }, 'addProductShadow: input lacks alpha channel, adding alpha');
		// Try to add alpha channel rather than silently returning
		const withAlpha = await sharp(imageBuffer).ensureAlpha().png().toBuffer();
		const retryMeta = await sharp(withAlpha).metadata();
		if (!retryMeta.hasAlpha) {
			log.error('addProductShadow: still no alpha after ensureAlpha — returning unchanged');
			return imageBuffer;
		}
		// Recurse with alpha-enabled buffer
		return addProductShadow(withAlpha, options);
	}

	// Calculate canvas size (add padding for shadow)
	const padding = Math.max(config.blur * 2, Math.abs(config.offsetY) * 2, 50);
	const canvasWidth = width + padding * 2;
	const canvasHeight = height + padding * 2;

	// Parse background color
	const bgColor = parseHexColor(backgroundColor);

	try {
		// Create shadow by making a blurred, darkened silhouette of the product
		// Step 1: Create a black silhouette from the product (preserve alpha, make RGB black)
		const silhouette = await sharp(imageBuffer)
			.ensureAlpha()
			.modulate({ brightness: 0 }) // Make it black
			.toBuffer();

		// Step 2: Blur the silhouette to create soft shadow edges
		const blurredSilhouette = await sharp(silhouette)
			.blur(Math.max(0.3, config.blur))
			.toBuffer();

		// Step 3: Reduce opacity of the shadow by scaling the alpha channel
		// The blurred silhouette has full opacity from the product's alpha.
		// We need to scale it down to the target shadow opacity (e.g., 0.3 * 0.85 = 0.255).
		const opacityScale = config.opacity * intensity;

		// Extract raw pixels, scale alpha channel, reconstruct
		const blurMeta = await sharp(blurredSilhouette).metadata();
		const blurW = blurMeta.width || width;
		const blurH = blurMeta.height || height;

		const { data: shadowPixels, info: shadowInfo } = await sharp(blurredSilhouette)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		// Scale alpha channel by opacity factor
		for (let i = 3; i < shadowPixels.length; i += 4) {
			shadowPixels[i] = Math.round(shadowPixels[i] * opacityScale);
		}

		// Ensure RGB stays black (shadow color)
		for (let i = 0; i < shadowPixels.length; i += 4) {
			shadowPixels[i] = 0;     // R
			shadowPixels[i + 1] = 0; // G
			shadowPixels[i + 2] = 0; // B
		}

		const shadowWithOpacity = await sharp(shadowPixels, {
			raw: { width: shadowInfo.width, height: shadowInfo.height, channels: 4 }
		})
			.png()
			.toBuffer();

		// Step 4: Calculate positions
		const productX = padding;
		const productY = padding;
		const shadowX = padding + config.offsetX;
		const shadowY = padding + config.offsetY;

		// Step 5: Composite everything onto white background
		const result = await sharp({
			create: {
				width: canvasWidth,
				height: canvasHeight,
				channels: 4,
				background: { r: bgColor.r, g: bgColor.g, b: bgColor.b, alpha: 1 }
			}
		})
			.composite([
				// Shadow first (underneath) - semi-transparent black over white = gray shadow
				{
					input: shadowWithOpacity,
					left: shadowX,
					top: shadowY,
					blend: 'over'
				},
				// Product on top
				{
					input: imageBuffer,
					left: productX,
					top: productY,
					blend: 'over'
				}
			])
			.png({ quality: 100, compressionLevel: 6 })
			.toBuffer();

		const resultMeta = await sharp(result).metadata();
		log.debug({
			resultWidth: resultMeta.width,
			resultHeight: resultMeta.height,
			canvasWidth,
			canvasHeight,
			shadowX,
			shadowY,
			productX,
			productY,
			opacityScale,
			padding
		}, 'addProductShadow: SUCCESS — shadow rendered');

		return result;
	} catch (shadowErr: any) {
		log.error({ err: shadowErr }, 'Shadow generation error');
		// On error, return original image on white background without shadow
		const fallback = await sharp({
			create: {
				width: canvasWidth,
				height: canvasHeight,
				channels: 4,
				background: { r: bgColor.r, g: bgColor.g, b: bgColor.b, alpha: 1 }
			}
		})
			.composite([{
				input: imageBuffer,
				left: padding,
				top: padding,
				blend: 'over'
			}])
			.png({ quality: 100, compressionLevel: 6 })
			.toBuffer();

		return fallback;
	}
}

/**
 * Add shadow using Bria Product Shadow via Replicate
 * Best for lifestyle/preset backgrounds where AI context-awareness matters
 */
export async function addBriaShadow(
	imageUrl: string,
	replicate: Replicate,
	options: {
		shadowType?: 'soft' | 'hard' | 'floating';
		intensity?: number;
	} = {}
): Promise<string> {
	const { shadowType = 'soft', intensity = 0.6 } = options;

	try {
		// Map our shadow types to Bria parameters
		const shadowParams: Record<string, any> = {
			soft: { shadow_softness: 0.8, shadow_intensity: intensity },
			hard: { shadow_softness: 0.2, shadow_intensity: intensity },
			floating: { shadow_softness: 0.9, shadow_intensity: intensity * 0.7, shadow_distance: 30 }
		};

		const params = shadowParams[shadowType] || shadowParams.soft;

		const output = await replicate.run('bria-ai/product-shadow', {
			input: {
				image_url: imageUrl,
				...params
			}
		});

		// Bria returns the image URL directly
		const resultUrl = Array.isArray(output) ? output[0] : output;

		return resultUrl as string;
	} catch (err) {
		log.error({ err }, 'Bria shadow failed');
		throw err;
	}
}

/**
 * Determine if we should use Sharp (local) or Bria (AI) for shadow
 */
export function shouldUseAIShadow(backgroundType: string): boolean {
	// Use AI shadow for complex/lifestyle backgrounds
	const aiBackgrounds = [
		'lifestyle',
		'preset',
		'scene',
		'environment',
		'studio-complex',
		'gradient-complex'
	];

	// Use Sharp for simple solid backgrounds
	const localBackgrounds = ['white', 'solid', 'color', 'transparent', 'studio-simple'];

	if (aiBackgrounds.some((bg) => backgroundType.toLowerCase().includes(bg))) {
		return true;
	}

	if (localBackgrounds.some((bg) => backgroundType.toLowerCase().includes(bg))) {
		return false;
	}

	// Default to local Sharp for unknown/simple cases
	return false;
}

/**
 * Parse hex color to RGB
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } {
	const cleanHex = hex.replace('#', '');
	const bigint = parseInt(cleanHex, 16);

	return {
		r: (bigint >> 16) & 255,
		g: (bigint >> 8) & 255,
		b: bigint & 255
	};
}

/**
 * Check if a color is considered "light" (for shadow visibility)
 */
export function isLightBackground(hexColor: string): boolean {
	const { r, g, b } = parseHexColor(hexColor);
	// Calculate relative luminance
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5;
}

export default {
	addProductShadow,
	addBriaShadow,
	shouldUseAIShadow,
	isLightBackground,
	SHADOW_CONFIG
};
