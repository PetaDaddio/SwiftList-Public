/**
 * Scene Analysis API Endpoint - Agent 2 of Style Transfer Engine
 * POST /api/style-transfer/analyze-scene
 *
 * Analyzes a reference image to extract style metadata for scene generation
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { analyzeScene } from '$lib/ai/scene-analyst';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const AnalyzeSceneSchema = z.object({
	imageUrl: z.string().url('Invalid image URL'),
	userHints: z
		.object({
			productCategory: z.string().optional(),
			preferredMood: z.string().optional()
		})
		.optional()
});

// ============================================================================
// POST HANDLER
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication check
		if (!locals.user) {
			throw error(401, 'Unauthorized - Please sign in');
		}

		// 2. Parse and validate request body
		const body = await request.json();
		const validated = AnalyzeSceneSchema.parse(body);

		// 3. Get Gemini API key from environment
		const geminiApiKey = env.GOOGLE_GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!geminiApiKey) {
			throw error(500, 'Scene analysis service not configured');
		}

		// 4. Run scene analysis
		const result = await analyzeScene(
			{
				imageUrl: validated.imageUrl,
				userHints: validated.userHints
			},
			geminiApiKey
		);

		// 5. Return analysis
		return json({
			success: true,
			analysis: result
		});
	} catch (err: unknown) {
		// Handle validation errors
		if (err instanceof z.ZodError) {
			throw error(400, 'Invalid request: ' + err.issues[0].message);
		}

		// Re-throw HTTP errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		// Generic error
		throw error(500, 'Failed to analyze scene');
	}
};
