/**
 * Fabric Intelligence API
 * POST /api/fabric/analyze
 *
 * Public API endpoint for fabric analysis.
 * Can be used by:
 * - SwiftList internal workflows
 * - External developers (with API key)
 * - Partner integrations
 *
 * RATE LIMITING: 100 requests/hour per API key
 * AUTHENTICATION: Bearer token or internal service role
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { aiLogger } from '$lib/utils/logger';

const log = aiLogger.child({ route: '/api/fabric/analyze' });
import {
	analyzeFabric,
	type FabricAnalysisInput,
	type FabricAnalysisOutput
} from '$lib/ai/fabric-intelligence';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const FabricAnalyzeRequestSchema = z.object({
	// Required
	imageUrl: z.string().url('Invalid image URL').optional(),
	imageBase64: z.string().optional(),

	// Optional hints
	userHints: z
		.object({
			category: z.enum(['apparel', 'accessories', 'footwear', 'home-textiles']).optional(),
			knownFabric: z.string().optional(),
			quality: z.enum(['budget', 'standard', 'premium']).optional()
		})
		.optional(),

	// Feedback context
	jobId: z.string().optional() // For internal tracking
});

type FabricAnalyzeRequest = z.infer<typeof FabricAnalyzeRequestSchema>;

// ============================================================================
// API ENDPOINT
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication check
		if (!locals.user && !isValidApiKey(request)) {
			return json(
				{
					success: false,
					error: {
						message: 'Unauthorized - API key or authentication required',
						code: 'FABRIC_AUTH_REQUIRED'
					}
				},
				{ status: 401 }
			);
		}

		// 2. Parse and validate request body
		const body: FabricAnalyzeRequest = await request.json();

		// Validate with Zod
		const validated = FabricAnalyzeRequestSchema.parse(body);

		// Must provide either imageUrl or imageBase64
		if (!validated.imageUrl && !validated.imageBase64) {
			return json(
				{
					success: false,
					error: {
						message: 'Either imageUrl or imageBase64 is required',
						code: 'FABRIC_IMAGE_REQUIRED'
					}
				},
				{ status: 400 }
			);
		}

		// 3. Prepare input for fabric analysis
		const analysisInput: FabricAnalysisInput = {
			imageUrl: validated.imageUrl || '',
			imageBuffer: validated.imageBase64
				? Buffer.from(validated.imageBase64, 'base64')
				: undefined,
			userHints: validated.userHints
		};

		// 4. Get Gemini API key (supports both env var names)
		const geminiApiKey = env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GEMINI_API_KEY;
		if (!geminiApiKey) {
			return json(
				{
					success: false,
					error: {
						message: 'Gemini API not configured. Set GOOGLE_GEMINI_API_KEY in .env',
						code: 'FABRIC_API_NOT_CONFIGURED'
					}
				},
				{ status: 500 }
			);
		}

		// 5. Run fabric analysis
		const startTime = Date.now();
		const analysis: FabricAnalysisOutput = await analyzeFabric(analysisInput, geminiApiKey);
		const duration = Date.now() - startTime;
		log.info({ durationMs: duration, analysisId: analysis.analysisId }, 'Fabric analysis complete');

		// 6. Store analysis in database for learning system
		if (locals.user && validated.jobId) {
			await storeFabricAnalysis({
				jobId: validated.jobId,
				userId: locals.user.id,
				analysis,
				duration
			});
		}

		// 7. Return analysis
		return json(
			{
				success: true,
				data: analysis,
				meta: {
					durationMs: duration,
					apiVersion: '1.0.0',
					creditsUsed: 1 // For internal billing
				}
			},
			{
				status: 200,
				headers: {
					'X-Fabric-Analysis-Id': analysis.analysisId,
					'X-Response-Time': `${duration}ms`
				}
			}
		);
	} catch (err: unknown) {
		log.error({ err }, 'Fabric analysis failed');
		// Handle validation errors
		if (err instanceof z.ZodError) {
			return json(
				{
					success: false,
					error: {
						message: 'Invalid request format',
						code: 'FABRIC_VALIDATION_ERROR',
						details: err.issues // Zod uses .issues not .errors
					}
				},
				{ status: 400 }
			);
		}

		// Handle SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			const httpErr = err as { status: number; body?: { message?: string; code?: string } };
			return json(
				{
					success: false,
					error: {
						message: httpErr.body?.message || 'Fabric analysis failed',
						code: httpErr.body?.code || 'FABRIC_ERROR'
					}
				},
				{ status: httpErr.status }
			);
		}

		// Handle unknown errors - include actual error message in dev mode
		const errorMessage = dev
			? (err instanceof Error ? err.message : 'Internal server error')
			: 'Internal server error';
		return json(
			{
				success: false,
				error: {
					message: errorMessage,
					code: 'FABRIC_INTERNAL_ERROR'
				}
			},
			{ status: 500 }
		);
	}
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate API key for external access
 * SECURITY: Disabled until proper API key system is implemented.
 * Previously accepted ANY string > 20 chars as a valid API key.
 * TODO: Implement proper API key validation against database
 */
function isValidApiKey(_request: Request): boolean {
	// SECURITY: External API key access disabled until proper validation
	// is implemented (database lookup, rate limiting per key, key rotation).
	// All access must go through session-based authentication for now.
	return false;
}

/**
 * Store fabric analysis for learning system
 */
async function storeFabricAnalysis(data: {
	jobId: string;
	userId: string;
	analysis: FabricAnalysisOutput;
	duration: number;
}): Promise<void> {
	// TODO: Store in database
	// Database schema:
	// INSERT INTO fabric_analyses (
	//   analysis_id, job_id, user_id,
	//   fabric_type, confidence, characteristics,
	//   rendering_hints, recommended_model,
	//   prompt_version, model_version,
	//   duration_ms, created_at
	// ) VALUES (...)
}

// ============================================================================
// TYPESCRIPT TYPES FOR API RESPONSE
// ============================================================================

export interface FabricAnalyzeResponse {
	success: boolean;
	data?: FabricAnalysisOutput;
	error?: {
		message: string;
		code: string;
		details?: unknown;
	};
	meta?: {
		durationMs: number;
		apiVersion: string;
		creditsUsed: number;
	};
}
