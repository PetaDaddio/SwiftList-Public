/**
 * Watermark Utility for SwiftList
 *
 * Applies a semi-transparent "SwiftList" logotype watermark to images for Free plan users.
 * Uses the pre-rendered SVG logotype (vector paths, no font dependency) so it renders
 * correctly on any server regardless of installed fonts.
 *
 * Features:
 * - Pre-rendered SVG logotype — no font/fontconfig dependency
 * - Automatically scales based on image dimensions
 * - Semi-transparent with slight shadow for visibility on any background
 * - Positioned in bottom-right corner
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Watermark configuration
const WATERMARK_CONFIG = {
	opacity: 0.25, // 25% opacity — visible but not distracting
	paddingPercent: 3, // 3% padding from edges
	widthPercent: 18, // Logotype width = 18% of image width
	shadowBlur: 2,
	shadowOffset: 1
};

// Cache the raw SVG logotype paths (read once at module load)
let logotypeSvgPaths: string | null = null;

/**
 * Load the SVG logotype paths from the pre-rendered file.
 * Extracts just the <path> elements so we can wrap them in a sized SVG.
 */
function getLogotypePaths(): string {
	if (logotypeSvgPaths) return logotypeSvgPaths;

	try {
		// Try loading from the assets directory (works in dev and build)
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const svgPath = resolve(__dirname, '../assets/watermark-logotype.svg');
		const svgContent = readFileSync(svgPath, 'utf-8');

		// Extract path elements from the SVG
		const pathMatches = svgContent.match(/<path[^>]*\/>/g);
		if (pathMatches) {
			logotypeSvgPaths = pathMatches.join('\n');
		} else {
			// Fallback: use the whole SVG content between <svg> tags
			const innerMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
			logotypeSvgPaths = innerMatch ? innerMatch[1] : '';
		}
	} catch {
		// Hardcoded fallback — the "SwiftList" logotype paths from Logotype_BW.svg
		// This ensures watermarking works even if the file can't be read
		logotypeSvgPaths = `
			<path d="M144.78,345.65c-8.16,0-15.25-1.25-21.29-3.76-6.04-2.5-10.74-6.22-14.12-11.14-3.37-4.92-5.15-10.98-5.33-18.18h20.3c.27,3.42,1.3,6.28,3.08,8.58,1.78,2.3,4.15,4.02,7.11,5.16,2.96,1.14,6.31,1.71,10.05,1.71s6.98-.54,9.74-1.61c2.76-1.07,4.91-2.59,6.46-4.55,1.55-1.96,2.32-4.24,2.32-6.84,0-2.32-.7-4.27-2.08-5.84-1.39-1.57-3.38-2.93-5.98-4.07-2.6-1.14-5.77-2.14-9.5-3.01l-11.21-2.8c-8.61-2.1-15.36-5.39-20.23-9.88-4.88-4.49-7.31-10.42-7.31-17.81,0-6.15,1.65-11.53,4.96-16.13,3.3-4.6,7.84-8.18,13.6-10.73,5.76-2.55,12.34-3.83,19.72-3.83s14.08,1.29,19.69,3.86c5.61,2.58,9.98,6.15,13.12,10.73,3.14,4.58,4.76,9.85,4.85,15.82h-20.16c-.37-4.1-2.11-7.27-5.23-9.5-3.12-2.23-7.28-3.35-12.48-3.35-3.51,0-6.52.5-9.02,1.5-2.51,1-4.41,2.39-5.71,4.17-1.3,1.78-1.95,3.81-1.95,6.08,0,2.51.75,4.59,2.26,6.25,1.5,1.66,3.51,3.01,6.02,4.03,2.51,1.03,5.17,1.88,8,2.56l9.23,2.26c4.28.96,8.27,2.26,11.96,3.9,3.69,1.64,6.93,3.66,9.71,6.05,2.78,2.39,4.93,5.23,6.46,8.51,1.53,3.28,2.29,7.06,2.29,11.35,0,6.15-1.55,11.52-4.65,16.1-3.1,4.58-7.59,8.12-13.47,10.63-5.88,2.51-12.94,3.76-21.19,3.76Z"/>
			<path d="M214.57,344.14l-22.56-76.42h21.53l6.63,28.23c1.14,5.06,2.37,10.56,3.69,16.51,1.32,5.95,2.53,12.52,3.62,19.72h-2.32c1.18-7.02,2.48-13.52,3.9-19.51,1.41-5.99,2.73-11.56,3.96-16.71l6.97-28.23h18.87l6.84,28.23c1.14,5.15,2.42,10.7,3.83,16.65,1.41,5.95,2.73,12.47,3.96,19.58h-2.32c1.09-7.06,2.27-13.57,3.52-19.51,1.25-5.95,2.47-11.52,3.66-16.71l6.63-28.23h21.81l-22.69,76.42h-20.85l-8.48-29.46c-.82-2.96-1.64-6.23-2.46-9.81-.82-3.58-1.62-7.22-2.39-10.94-.78-3.71-1.57-7.19-2.39-10.42h3.62c-.78,3.24-1.56,6.71-2.36,10.42-.8,3.71-1.61,7.37-2.43,10.97-.82,3.6-1.64,6.86-2.46,9.77l-8.48,29.46h-20.85Z"/>
			<path d="M327.91,257.74c-3.1,0-5.74-1.02-7.93-3.08-2.19-2.05-3.28-4.53-3.28-7.45s1.09-5.4,3.28-7.45c2.19-2.05,4.83-3.08,7.93-3.08s5.75,1.03,7.96,3.08c2.21,2.05,3.32,4.53,3.32,7.45s-1.11,5.4-3.32,7.45c-2.21,2.05-4.86,3.08-7.96,3.08ZM317.65,344.14v-76.42h20.51v76.42h-20.51Z"/>
			<path d="M395.11,267.72l-4,15.65h-44.9l4-15.65h44.9ZM361.67,344.14v-82.3c0-5.42,1.08-9.93,3.25-13.53,2.16-3.6,5.12-6.3,8.85-8.1,3.74-1.8,7.97-2.7,12.71-2.7,3.24,0,6.19.26,8.85.79,2.67.52,5.53,1.23,6.76,1.59l-3.87,15.37c-.87-.23-2.62-.64-3.78-.87-1.16-.23-2.43-.34-3.79-.34-3.1,0-5.3.74-6.6,2.22-1.3,1.48-1.95,3.57-1.95,6.25v81.62h-20.44Z"/>
			<path d="M446.7,267.72l-4,15.65h-46.32l4-15.65h46.32ZM409.91,242.54h20.51v79.25c0,2.42.54,4.2,1.61,5.37,1.07,1.16,2.86,1.74,5.37,1.74.78,0,1.87-.1,3.28-.31s2.48-.4,3.21-.58l2.94,15.38c-2.28.68-4.54,1.16-6.8,1.44s-4.41.41-6.46.41c-7.65,0-13.51-1.87-17.57-5.6-4.06-3.74-6.08-9.09-6.08-16.06v-81.03Z"/>
			<path d="M457.85,344.14v-101.85h20.85v84.55h43.95v17.29h-64.8Z"/>
			<path d="M541.78,257.74c-3.1,0-5.74-1.02-7.93-3.08s-3.28-4.53-3.28-7.45,1.09-5.4,3.28-7.45,4.83-3.08,7.93-3.08,5.75,1.03,7.96,3.08c2.21,2.05,3.31,4.53,3.31,7.45s-1.11,5.4-3.31,7.45c-2.21,2.05-4.87,3.08-7.96,3.08ZM531.53,344.14v-76.42h20.51v76.42h-20.51Z"/>
			<path d="M594.81,345.65c-6.15,0-11.6-.88-16.34-2.63-4.74-1.75-8.61-4.31-11.62-7.66s-4.95-7.39-5.81-12.13l19.07-3.28c1,3.55,2.76,6.22,5.26,8,2.51,1.78,5.85,2.67,10.05,2.67,3.92,0,7.01-.74,9.26-2.22,2.26-1.48,3.38-3.36,3.38-5.64,0-2-.81-3.65-2.43-4.92-1.62-1.28-4.09-2.26-7.42-2.94l-13.19-2.73c-7.38-1.5-12.9-4.07-16.54-7.69s-5.47-8.28-5.47-13.98c0-4.92,1.34-9.15,4.03-12.68,2.69-3.53,6.43-6.25,11.21-8.17,4.79-1.91,10.41-2.87,16.88-2.87,6.02,0,11.23.83,15.65,2.5,4.42,1.66,8,4.02,10.73,7.07,2.73,3.05,4.56,6.65,5.47,10.8l-18.18,3.21c-.78-2.6-2.27-4.73-4.48-6.39-2.21-1.66-5.19-2.5-8.92-2.5-3.37,0-6.2.71-8.47,2.12-2.28,1.41-3.42,3.3-3.42,5.67,0,1.91.74,3.53,2.22,4.85,1.48,1.32,4.02,2.35,7.62,3.08l13.74,2.73c7.38,1.5,12.87,3.95,16.47,7.35,3.6,3.4,5.4,7.83,5.4,13.29,0,5.01-1.46,9.4-4.38,13.16s-6.94,6.69-12.06,8.78c-5.13,2.1-11.04,3.14-17.74,3.14Z"/>
			<path d="M679.8,267.72v15.65h-45.32v-15.65h45.32ZM645.01,242.54h20.51v79.25c0,2.42.54,4.2,1.61,5.37,1.07,1.16,2.86,1.74,5.37,1.74.78,0,1.87-.1,3.28-.31s2.48-.4,3.21-.58l2.94,15.38c-2.28.68-4.54,1.16-6.8,1.44s-4.41.41-6.46.41c-7.65,0-13.51-1.87-17.57-5.6-4.06-3.74-6.08-9.09-6.08-16.06v-81.03Z"/>
		`;
	}

	return logotypeSvgPaths || '';
}

// Original SVG viewBox dimensions (from Logotype_BW.svg)
const LOGO_VIEWBOX = { x: 104, y: 236, width: 596, height: 112 };

/**
 * Creates an SVG watermark overlay sized for the given image dimensions.
 * Uses pre-rendered vector paths — no font dependency.
 */
function createWatermarkSvg(width: number, height: number): Buffer {
	const paths = getLogotypePaths();
	const padding = Math.round(width * (WATERMARK_CONFIG.paddingPercent / 100));
	const logoWidth = Math.round(width * (WATERMARK_CONFIG.widthPercent / 100));
	const logoHeight = Math.round(logoWidth * (LOGO_VIEWBOX.height / LOGO_VIEWBOX.width));

	// Position: bottom-right corner
	const logoX = width - padding - logoWidth;
	const logoY = height - padding - logoHeight;

	const svg = `
		<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
					<feDropShadow dx="${WATERMARK_CONFIG.shadowOffset}" dy="${WATERMARK_CONFIG.shadowOffset}"
						stdDeviation="${WATERMARK_CONFIG.shadowBlur}" flood-color="rgba(0,0,0,0.15)"/>
				</filter>
			</defs>
			<g transform="translate(${logoX}, ${logoY}) scale(${logoWidth / LOGO_VIEWBOX.width})"
			   opacity="${WATERMARK_CONFIG.opacity}"
			   filter="url(#shadow)">
				<g transform="translate(${-LOGO_VIEWBOX.x}, ${-LOGO_VIEWBOX.y})" fill="#000000">
					${paths}
				</g>
			</g>
		</svg>
	`;

	return Buffer.from(svg);
}

/**
 * Creates a diagonal repeating watermark pattern for more prominent branding
 * (Alternative style - can be used for preview/thumbnail images)
 */
function createDiagonalWatermarkSvg(width: number, height: number): Buffer {
	const paths = getLogotypePaths();
	const unitWidth = Math.max(80, Math.round(width * 0.12));
	const unitHeight = Math.round(unitWidth * (LOGO_VIEWBOX.height / LOGO_VIEWBOX.width));
	const spacing = unitWidth * 3;

	let logoElements = '';
	for (let y = -height; y < height * 2; y += spacing) {
		for (let x = -width; x < width * 2; x += spacing) {
			logoElements += `
				<g transform="translate(${x}, ${y}) rotate(-30) scale(${unitWidth / LOGO_VIEWBOX.width})"
				   opacity="0.12" fill="#808080">
					<g transform="translate(${-LOGO_VIEWBOX.x}, ${-LOGO_VIEWBOX.y})">
						${paths}
					</g>
				</g>
			`;
		}
	}

	const svg = `
		<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
			${logoElements}
		</svg>
	`;

	return Buffer.from(svg);
}

/**
 * Apply watermark to an image buffer
 *
 * @param imageBuffer - The source image buffer (PNG/JPEG)
 * @param marketplace - The target marketplace (for logging/customization)
 * @param style - 'corner' for single bottom-right watermark, 'diagonal' for repeating pattern
 * @returns Watermarked image buffer
 */
export async function applyWatermark(
	imageBuffer: Buffer,
	marketplace: string,
	style: 'corner' | 'diagonal' = 'corner'
): Promise<Buffer> {
	const sharpModule = await import('sharp');
	const sharp = sharpModule.default || sharpModule;

	// Get image dimensions
	const metadata = await sharp(imageBuffer).metadata();
	const width = metadata.width || 1000;
	const height = metadata.height || 1000;

	// Create appropriate watermark SVG
	const watermarkSvg =
		style === 'diagonal'
			? createDiagonalWatermarkSvg(width, height)
			: createWatermarkSvg(width, height);

	// Composite watermark onto image
	const watermarkedBuffer = await sharp(imageBuffer)
		.composite([
			{
				input: watermarkSvg,
				top: 0,
				left: 0,
				blend: 'over'
			}
		])
		.png({ quality: 100, compressionLevel: 6 })
		.toBuffer();

	return watermarkedBuffer;
}

/**
 * Check if a user should have watermarks applied to their outputs
 *
 * @param subscriptionTier - The user's subscription tier
 * @returns true if watermark should be applied
 */
export function shouldApplyWatermark(
	subscriptionTier: 'free' | 'maker' | 'merchant' | 'agency' | string | null
): boolean {
	// Only free tier users get watermarks
	// All paid tiers (maker, merchant, agency) get watermark-free outputs
	return subscriptionTier === 'free' || subscriptionTier === null;
}

/**
 * Type definitions for watermark-related metadata
 */
export interface WatermarkMetadata {
	watermarked: boolean;
	watermark_style?: 'corner' | 'diagonal';
	watermark_applied_at?: string;
	subscription_tier_at_processing?: string;
}

export default {
	applyWatermark,
	shouldApplyWatermark
};
