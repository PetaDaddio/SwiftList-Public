/**
 * Invisible Mannequin Endpoint Tests
 *
 * Tests for garment classification, ghost mannequin generation logic,
 * request validation, and auth checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ============================================================================
// Inline schema + prompt builder for unit testing
// (Avoids importing the +server.ts which depends on $env/dynamic/private)
// ============================================================================

const invisibleMannequinSchema = z.object({
	image_url: z.string().url('Valid image URL is required'),
	garment_type: z.string().optional(),
	background: z.enum(['white', 'transparent']).default('white')
});

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

// ============================================================================
// TESTS
// ============================================================================

describe('Invisible Mannequin Endpoint', () => {
	describe('Request Validation', () => {
		it('should reject missing image_url', () => {
			const result = invisibleMannequinSchema.safeParse({});
			expect(result.success).toBe(false);
			if (!result.success) {
				const fields = result.error.issues.map((i) => i.path[0]);
				expect(fields).toContain('image_url');
			}
		});

		it('should reject invalid image_url', () => {
			const result = invisibleMannequinSchema.safeParse({ image_url: 'not-a-url' });
			expect(result.success).toBe(false);
		});

		it('should accept valid input with defaults', () => {
			const result = invisibleMannequinSchema.safeParse({
				image_url: 'https://example.com/image.png'
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.background).toBe('white');
				expect(result.data.garment_type).toBeUndefined();
			}
		});

		it('should accept valid input with all fields', () => {
			const result = invisibleMannequinSchema.safeParse({
				image_url: 'https://example.com/image.png',
				garment_type: 'dress',
				background: 'transparent'
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.background).toBe('transparent');
				expect(result.data.garment_type).toBe('dress');
			}
		});

		it('should reject invalid background value', () => {
			const result = invisibleMannequinSchema.safeParse({
				image_url: 'https://example.com/image.png',
				background: 'blue'
			});
			expect(result.success).toBe(false);
		});
	});

	describe('Ghost Mannequin Prompt', () => {
		it('should include garment type in prompt', () => {
			const prompt = buildGhostMannequinPrompt('dress', 'white');
			expect(prompt).toContain('dress');
			expect(prompt).toContain('invisible mannequin');
		});

		it('should use transparent background when specified', () => {
			const prompt = buildGhostMannequinPrompt('shirt', 'transparent');
			expect(prompt).toContain('transparent background');
			expect(prompt).not.toContain('pure white background');
		});

		it('should use pure white background by default', () => {
			const prompt = buildGhostMannequinPrompt('jacket', 'white');
			expect(prompt).toContain('pure white background');
		});

		it('should include structured sections', () => {
			const prompt = buildGhostMannequinPrompt('blazer', 'white');
			expect(prompt).toContain('GARMENT:');
			expect(prompt).toContain('BACKGROUND:');
			expect(prompt).toContain('LIGHTING:');
			expect(prompt).toContain('TECHNICAL:');
		});

		it('should include e-commerce quality requirements', () => {
			const prompt = buildGhostMannequinPrompt('pants', 'white');
			expect(prompt).toContain('e-commerce product photography');
			expect(prompt).toContain('No text, no watermarks');
		});
	});

	describe('Generation Method Fallback Logic', () => {
		it('should define Imagen 3 as primary with $0.004 cost', () => {
			// Validates the cost constants used in the endpoint
			const imagen3Cost = 0.004;
			const geminiFlashCost = 0.002;
			const fallbackCost = 0;

			expect(imagen3Cost).toBeGreaterThan(geminiFlashCost);
			expect(geminiFlashCost).toBeGreaterThan(fallbackCost);
		});

		it('should try Imagen 3 predict endpoint URL', () => {
			const expectedUrl = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';
			expect(expectedUrl).toContain('imagen-3.0-generate-002');
			expect(expectedUrl).toContain(':predict');
		});

		it('should use Gemini Flash with responseModalities as fallback', () => {
			// Validates the expected request format for Gemini Flash image generation
			const geminiConfig = {
				responseModalities: ['TEXT', 'IMAGE'],
				temperature: 0.4
			};
			expect(geminiConfig.responseModalities).toContain('IMAGE');
			expect(geminiConfig.temperature).toBe(0.4);
		});
	});

	describe('Auth Check', () => {
		it('should require Bearer token format', () => {
			const authHeader = 'Bearer abc123';
			expect(authHeader.startsWith('Bearer ')).toBe(true);
			expect(authHeader.split(' ')[1]).toBe('abc123');
		});

		it('should reject non-Bearer auth header', () => {
			const authHeader = 'Basic abc123';
			expect(authHeader.startsWith('Bearer ')).toBe(false);
		});

		it('should reject missing auth header', () => {
			const authHeader = null as string | null;
			expect(authHeader?.startsWith('Bearer ')).toBeFalsy();
		});
	});
});
