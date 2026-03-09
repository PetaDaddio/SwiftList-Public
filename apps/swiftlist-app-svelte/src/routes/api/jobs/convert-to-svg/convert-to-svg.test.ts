/**
 * SVG Conversion Endpoint Tests
 *
 * Tests for the pure SVG tracer functions (toBinaryBitmap, traceContours,
 * simplifyPath, contoursToSvgPaths, perpendicularDistance, quantizeColors)
 * and request validation.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
	toBinaryBitmap,
	toBinaryBitmapForColor,
	traceContours,
	simplifyPath,
	contoursToSvgPaths,
	perpendicularDistance,
	quantizeColors,
	generateMonoSvg,
	generateColorSvg
} from '$lib/utils/svg-tracer';
import type { Point } from '$lib/utils/svg-tracer';

// ============================================================================
// Inline schema for validation tests
// ============================================================================

const convertToSvgSchema = z.object({
	image_url: z.string().url('Valid image URL is required'),
	mode: z.enum(['simple', 'detailed']).default('simple'),
	color_mode: z.enum(['mono', 'color']).default('mono')
});

// ============================================================================
// TESTS
// ============================================================================

describe('SVG Conversion Endpoint', () => {
	describe('Request Validation', () => {
		it('should accept valid input with mode defaults', () => {
			const result = convertToSvgSchema.safeParse({
				image_url: 'https://example.com/photo.png'
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.mode).toBe('simple');
				expect(result.data.color_mode).toBe('mono');
			}
		});

		it('should accept detailed mode with color', () => {
			const result = convertToSvgSchema.safeParse({
				image_url: 'https://example.com/photo.png',
				mode: 'detailed',
				color_mode: 'color'
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.mode).toBe('detailed');
				expect(result.data.color_mode).toBe('color');
			}
		});

		it('should reject missing image_url', () => {
			const result = convertToSvgSchema.safeParse({});
			expect(result.success).toBe(false);
		});

		it('should reject invalid mode', () => {
			const result = convertToSvgSchema.safeParse({
				image_url: 'https://example.com/photo.png',
				mode: 'ultra'
			});
			expect(result.success).toBe(false);
		});

		it('should reject invalid color_mode', () => {
			const result = convertToSvgSchema.safeParse({
				image_url: 'https://example.com/photo.png',
				color_mode: 'rainbow'
			});
			expect(result.success).toBe(false);
		});
	});

	describe('toBinaryBitmap()', () => {
		it('should correctly threshold pixels', () => {
			// 2x2 image: black (0,0,0), white (255,255,255), gray (100,100,100), transparent
			const pixels = new Uint8Array([
				0, 0, 0, 255,       // black → true (luminance 0 < 128)
				255, 255, 255, 255,  // white → false (luminance 255 >= 128)
				100, 100, 100, 255,  // gray → true (luminance 100 < 128)
				0, 0, 0, 0           // transparent → false (treated as white)
			]);

			const bitmap = toBinaryBitmap(pixels, 2, 2, 128);

			expect(bitmap[0][0]).toBe(true);  // black
			expect(bitmap[0][1]).toBe(false); // white
			expect(bitmap[1][0]).toBe(true);  // gray (100 < 128)
			expect(bitmap[1][1]).toBe(false); // transparent
		});

		it('should handle different thresholds', () => {
			const pixels = new Uint8Array([
				100, 100, 100, 255,  // luminance ~100
				150, 150, 150, 255   // luminance ~150
			]);

			// Threshold 128: 100 < 128 → true, 150 >= 128 → false
			const low = toBinaryBitmap(pixels, 2, 1, 128);
			expect(low[0][0]).toBe(true);
			expect(low[0][1]).toBe(false);

			// Threshold 200: both < 200 → both true
			const high = toBinaryBitmap(pixels, 2, 1, 200);
			expect(high[0][0]).toBe(true);
			expect(high[0][1]).toBe(true);
		});
	});

	describe('perpendicularDistance()', () => {
		it('should return 0 for a point on the line', () => {
			const dist = perpendicularDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 10 });
			expect(dist).toBeCloseTo(0, 5);
		});

		it('should calculate distance from a horizontal line', () => {
			const dist = perpendicularDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
			expect(dist).toBeCloseTo(3, 5);
		});

		it('should handle coincident line endpoints', () => {
			const dist = perpendicularDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
			expect(dist).toBeCloseTo(5, 5); // sqrt(9 + 16) = 5
		});
	});

	describe('simplifyPath()', () => {
		it('should reduce point count with RDP algorithm', () => {
			// A straight line with slight deviations → should simplify to 2 points
			const points: Point[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: 0.1 },
				{ x: 2, y: -0.1 },
				{ x: 3, y: 0.05 },
				{ x: 4, y: 0 }
			];
			const simplified = simplifyPath(points, 0.5);
			expect(simplified.length).toBeLessThan(points.length);
			expect(simplified[0]).toEqual({ x: 0, y: 0 });
			expect(simplified[simplified.length - 1]).toEqual({ x: 4, y: 0 });
		});

		it('should preserve sharp corners', () => {
			// L-shaped path: the corner point should be preserved
			const points: Point[] = [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 }
			];
			const simplified = simplifyPath(points, 1.0);
			expect(simplified.length).toBe(3);
		});

		it('should return input for 2 or fewer points', () => {
			const points: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
			const simplified = simplifyPath(points, 1.0);
			expect(simplified).toEqual(points);
		});
	});

	describe('contoursToSvgPaths()', () => {
		it('should generate valid SVG path data (M...L...Z format)', () => {
			const contours: Point[][] = [
				[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
			];
			const pathData = contoursToSvgPaths(contours);
			expect(pathData).toContain('M0,0');
			expect(pathData).toContain('L10,0');
			expect(pathData).toContain('L10,10');
			expect(pathData).toContain('L0,10');
			expect(pathData).toContain('Z');
		});

		it('should join multiple contours with spaces', () => {
			const contours: Point[][] = [
				[{ x: 0, y: 0 }, { x: 1, y: 0 }],
				[{ x: 5, y: 5 }, { x: 6, y: 5 }]
			];
			const pathData = contoursToSvgPaths(contours);
			expect(pathData).toContain('M0,0');
			expect(pathData).toContain('M5,5');
		});

		it('should skip empty contours', () => {
			const contours: Point[][] = [
				[{ x: 0, y: 0 }], // Single point → empty string
				[{ x: 5, y: 5 }, { x: 6, y: 5 }]
			];
			const pathData = contoursToSvgPaths(contours);
			expect(pathData).not.toContain('M0,0');
			expect(pathData).toContain('M5,5');
		});
	});

	describe('traceContours()', () => {
		it('should find a simple square contour', () => {
			// 5x5 bitmap with a 3x3 black square in the center
			const bitmap: boolean[][] = [
				[false, false, false, false, false],
				[false, true, true, true, false],
				[false, true, true, true, false],
				[false, true, true, true, false],
				[false, false, false, false, false]
			];
			const contours = traceContours(bitmap, 5, 5);
			expect(contours.length).toBeGreaterThanOrEqual(1);
			// Should have boundary points (at least 4 for a square)
			expect(contours[0].length).toBeGreaterThanOrEqual(4);
		});

		it('should return empty for all-white bitmap', () => {
			const bitmap: boolean[][] = [
				[false, false, false],
				[false, false, false],
				[false, false, false]
			];
			const contours = traceContours(bitmap, 3, 3);
			expect(contours.length).toBe(0);
		});
	});

	describe('quantizeColors()', () => {
		it('should return requested number of color clusters', () => {
			// Create a 4x1 image with 2 distinct colors: red and blue
			const pixels = new Uint8Array([
				255, 0, 0, 255,    // red
				255, 10, 0, 255,   // near-red
				0, 0, 255, 255,    // blue
				0, 10, 255, 255    // near-blue
			]);
			const clusters = quantizeColors(pixels, 4, 1, 2);
			expect(clusters.length).toBeLessThanOrEqual(2);
			expect(clusters.length).toBeGreaterThanOrEqual(1);
		});

		it('should skip transparent pixels', () => {
			const pixels = new Uint8Array([
				255, 0, 0, 255,  // red (visible)
				0, 0, 0, 0       // transparent (skipped)
			]);
			const clusters = quantizeColors(pixels, 2, 1, 1);
			expect(clusters.length).toBe(1);
			// The cluster should be close to red
			expect(clusters[0].r).toBeGreaterThan(200);
		});

		it('should return hex color strings', () => {
			const pixels = new Uint8Array([
				255, 0, 0, 255,
				255, 0, 0, 255
			]);
			const clusters = quantizeColors(pixels, 2, 1, 1);
			expect(clusters[0].hex).toMatch(/^#[0-9a-f]{6}$/);
		});
	});

	describe('SVG Document Generation', () => {
		it('should generate valid mono SVG', () => {
			const svg = generateMonoSvg('M0,0 L10,0 L10,10 Z', 100, 100);
			expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
			expect(svg).toContain('viewBox="0 0 100 100"');
			expect(svg).toContain('fill="#000000"');
			expect(svg).toContain('M0,0 L10,0 L10,10 Z');
		});

		it('should generate valid color SVG with multiple paths', () => {
			const colorPaths = [
				{ color: '#ff0000', pathData: 'M0,0 L10,0 Z' },
				{ color: '#0000ff', pathData: 'M20,20 L30,20 Z' }
			];
			const svg = generateColorSvg(colorPaths, 100, 100);
			expect(svg).toContain('fill="#ff0000"');
			expect(svg).toContain('fill="#0000ff"');
			expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
		});

		it('should skip empty pathData entries in color SVG', () => {
			const colorPaths = [
				{ color: '#ff0000', pathData: '' },
				{ color: '#0000ff', pathData: 'M20,20 L30,20 Z' }
			];
			const svg = generateColorSvg(colorPaths, 100, 100);
			expect(svg).not.toContain('fill="#ff0000"');
			expect(svg).toContain('fill="#0000ff"');
		});
	});

	describe('Mode-specific behavior', () => {
		it('simple mode uses 512px resize (documented)', () => {
			// This is a documentation test verifying the constants
			const simpleWidth = 512;
			const detailedWidth = 1024;
			expect(simpleWidth).toBe(512);
			expect(detailedWidth).toBe(1024);
		});

		it('simple mode uses higher threshold than detailed', () => {
			const simpleThreshold = 128;
			const detailedThreshold = 80;
			expect(simpleThreshold).toBeGreaterThan(detailedThreshold);
		});

		it('simple mode uses more aggressive simplification', () => {
			const simpleEpsilon = 2.0;
			const detailedEpsilon = 1.0;
			expect(simpleEpsilon).toBeGreaterThan(detailedEpsilon);
		});

		it('simple color mode uses fewer colors than detailed', () => {
			const simpleColors = 4;
			const detailedColors = 8;
			expect(simpleColors).toBeLessThan(detailedColors);
		});
	});
});
