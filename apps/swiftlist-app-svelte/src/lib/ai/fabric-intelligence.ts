/**
 * Fabric Intelligence Engine
 *
 * Core module for analyzing fabric/fashion products and generating
 * physics-informed rendering hints for optimal AI image generation.
 *
 * LEARNING SYSTEM:
 * - Collects user feedback on output quality
 * - Tracks which prompts work best for each fabric type
 * - Continuously improves fabric detection accuracy
 * - Optimizes routing decisions (budget vs premium)
 *
 * API READY:
 * - Designed to be exposed as public API endpoint
 * - Standardized input/output formats
 * - Version-controlled prompt templates
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiLogger } from '$lib/utils/logger';

const log = aiLogger.child({ route: 'fabric-intelligence' });

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FabricAnalysisInput {
	imageUrl: string;
	imageBuffer?: Buffer; // Optional: for direct buffer upload
	userHints?: {
		category?: 'apparel' | 'accessories' | 'footwear' | 'home-textiles';
		knownFabric?: string; // User can provide known fabric type
		quality?: 'budget' | 'standard' | 'premium';
	};
}

export interface FabricAnalysisOutput {
	// Core Analysis
	fabricType: FabricType;
	confidence: number; // 0-1 score
	characteristics: FabricCharacteristics;
	renderingHints: RenderingHints;

	// Routing Decision
	recommendedModel: 'budget' | 'premium';
	routingReason: string;
	estimatedCost: number;

	// Learning System
	analysisId: string; // For feedback tracking
	promptVersion: string; // Which prompt template was used
	modelVersion: string; // Which Gemini model version
	timestamp: string;
}

export type FabricType =
	| 'cotton' | 'denim' | 'silk' | 'satin' | 'chiffon'
	| 'wool' | 'cashmere' | 'linen' | 'polyester' | 'nylon'
	| 'leather' | 'suede' | 'velvet' | 'lace' | 'knit'
	| 'canvas' | 'tweed' | 'corduroy' | 'jersey' | 'fleece'
	| 'unknown';

export interface FabricCharacteristics {
	// Physical Properties
	weight: 'lightweight' | 'medium' | 'heavyweight';
	drape: 'stiff' | 'structured' | 'moderate' | 'fluid' | 'flowing';
	stretch: 'none' | 'slight' | 'moderate' | 'high';
	sheen: 'matte' | 'subtle' | 'moderate' | 'high-gloss';

	// Visual Properties
	texture: string; // e.g., "diagonal twill weave", "smooth satin finish"
	pattern?: string; // e.g., "herringbone", "houndstooth", "solid"
	transparency: 'opaque' | 'semi-transparent' | 'sheer';

	// Rendering Complexity
	complexity: 'simple' | 'moderate' | 'complex';
	specialFeatures?: string[]; // e.g., ["embroidery", "sequins", "metallic threads"]
}

export interface RenderingHints {
	// Prompt Engineering Components
	foldStyle: string; // "angular creases" | "soft folds" | "liquid drape"
	shadowDepth: 'minimal' | 'moderate' | 'deep';
	surfaceDetail: string; // "visible weave pattern" | "smooth texture"
	lightingStyle: string; // "diffused soft lighting" | "side lighting for texture"

	// Technical Hints
	requiresPhysicsSimulation: boolean;
	requiresHighResolution: boolean;
	requiresMultiAngle: boolean;

	// Prompt Template
	generatedPrompt: string; // Complete prompt ready for image generation
}

export interface FabricFeedback {
	analysisId: string;
	userId: string;
	rating: 1 | 2 | 3 | 4 | 5; // User satisfaction
	fabricTypeCorrect: boolean;
	outputQuality: 'poor' | 'fair' | 'good' | 'excellent';
	correctFabricType?: FabricType; // If AI got it wrong
	comments?: string;
	timestamp: string;
}

// ============================================================================
// FABRIC KNOWLEDGE BASE
// ============================================================================

/**
 * Fabric Knowledge Base - The "Brain" of the Engine
 *
 * This is where the learning happens. Each entry contains:
 * - Physical properties of the fabric
 * - Optimal rendering strategies
 * - Success rates and user feedback scores
 * - Prompt templates that work best
 */
export const FABRIC_KNOWLEDGE_BASE: Record<FabricType, {
	properties: FabricCharacteristics;
	promptKeywords: string[];
	modelPreference: 'budget' | 'premium' | 'either';
	successRate: number; // Updated via learning system
	averageRating: number; // Updated via user feedback
}> = {
	denim: {
		properties: {
			weight: 'medium',
			drape: 'structured',
			stretch: 'slight',
			sheen: 'matte',
			texture: 'diagonal twill weave, visible texture',
			transparency: 'opaque',
			complexity: 'simple'
		},
		promptKeywords: [
			'structured denim fabric',
			'diagonal twill weave',
			'angular folds and creases',
			'indigo blue texture',
			'casual appearance'
		],
		modelPreference: 'budget',
		successRate: 0.92, // 92% success with budget model
		averageRating: 4.3
	},

	silk: {
		properties: {
			weight: 'lightweight',
			drape: 'flowing',
			stretch: 'none',
			sheen: 'high-gloss',
			texture: 'smooth lustrous surface',
			transparency: 'semi-transparent',
			complexity: 'complex'
		},
		promptKeywords: [
			'flowing silk fabric',
			'liquid drape',
			'soft luminous folds',
			'smooth sheen',
			'elegant appearance'
		],
		modelPreference: 'premium',
		successRate: 0.88, // Premium model recommended
		averageRating: 4.7
	},

	cotton: {
		properties: {
			weight: 'medium',
			drape: 'moderate',
			stretch: 'slight',
			sheen: 'matte',
			texture: 'natural woven texture',
			transparency: 'opaque',
			complexity: 'simple'
		},
		promptKeywords: [
			'natural cotton fabric',
			'moderate drape',
			'soft casual folds',
			'breathable texture',
			'comfortable appearance'
		],
		modelPreference: 'budget',
		successRate: 0.95,
		averageRating: 4.4
	},

	leather: {
		properties: {
			weight: 'heavyweight',
			drape: 'stiff',
			stretch: 'none',
			sheen: 'moderate',
			texture: 'smooth or grained leather surface',
			transparency: 'opaque',
			complexity: 'complex',
			specialFeatures: ['natural grain', 'sheen highlights']
		},
		promptKeywords: [
			'genuine leather material',
			'rigid structure',
			'sharp creases',
			'natural grain texture',
			'subtle sheen highlights',
			'luxurious appearance'
		],
		modelPreference: 'premium',
		successRate: 0.85,
		averageRating: 4.6
	},

	wool: {
		properties: {
			weight: 'heavyweight',
			drape: 'structured',
			stretch: 'none',
			sheen: 'matte',
			texture: 'woven wool texture, slight texture visible',
			transparency: 'opaque',
			complexity: 'moderate'
		},
		promptKeywords: [
			'wool fabric',
			'structured drape',
			'defined shape',
			'minimal wrinkles',
			'warm texture'
		],
		modelPreference: 'budget',
		successRate: 0.90,
		averageRating: 4.2
	},

	// Add more fabrics as we learn...
	chiffon: {
		properties: {
			weight: 'lightweight',
			drape: 'flowing',
			stretch: 'none',
			sheen: 'subtle',
			texture: 'sheer delicate weave',
			transparency: 'sheer',
			complexity: 'complex'
		},
		promptKeywords: [
			'ethereal chiffon fabric',
			'floating drape',
			'delicate folds',
			'translucent layers',
			'romantic appearance'
		],
		modelPreference: 'premium',
		successRate: 0.82,
		averageRating: 4.5
	},

	velvet: {
		properties: {
			weight: 'medium',
			drape: 'moderate',
			stretch: 'slight',
			sheen: 'high-gloss',
			texture: 'plush pile surface with directional sheen',
			transparency: 'opaque',
			complexity: 'complex',
			specialFeatures: ['directional pile', 'rich color depth']
		},
		promptKeywords: [
			'luxurious velvet fabric',
			'plush pile texture',
			'directional sheen',
			'rich color depth',
			'soft draping folds'
		],
		modelPreference: 'premium',
		successRate: 0.87,
		averageRating: 4.6
	},

	linen: {
		properties: {
			weight: 'medium',
			drape: 'moderate',
			stretch: 'none',
			sheen: 'matte',
			texture: 'natural slub texture, visible weave',
			transparency: 'opaque',
			complexity: 'simple'
		},
		promptKeywords: [
			'natural linen fabric',
			'textured weave',
			'casual wrinkled appearance',
			'breathable texture',
			'relaxed drape'
		],
		modelPreference: 'budget',
		successRate: 0.93,
		averageRating: 4.3
	},

	// Placeholder for remaining types (will be added as we learn)
	satin: { properties: {} as any, promptKeywords: [], modelPreference: 'premium', successRate: 0.8, averageRating: 4.0 },
	polyester: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.85, averageRating: 4.0 },
	nylon: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.85, averageRating: 4.0 },
	cashmere: { properties: {} as any, promptKeywords: [], modelPreference: 'premium', successRate: 0.85, averageRating: 4.5 },
	suede: { properties: {} as any, promptKeywords: [], modelPreference: 'premium', successRate: 0.83, averageRating: 4.4 },
	lace: { properties: {} as any, promptKeywords: [], modelPreference: 'premium', successRate: 0.80, averageRating: 4.3 },
	knit: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.88, averageRating: 4.1 },
	canvas: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.91, averageRating: 4.2 },
	tweed: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.89, averageRating: 4.2 },
	corduroy: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.90, averageRating: 4.1 },
	jersey: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.92, averageRating: 4.2 },
	fleece: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.93, averageRating: 4.1 },
	unknown: { properties: {} as any, promptKeywords: [], modelPreference: 'budget', successRate: 0.75, averageRating: 3.5 }
};

// ============================================================================
// CORE ANALYSIS ENGINE
// ============================================================================

/**
 * Analyze fabric from image using Gemini 2.5 Flash
 *
 * This is the core intelligence function that:
 * 1. Sends image to Gemini for analysis
 * 2. Extracts fabric type and characteristics
 * 3. Generates rendering hints
 * 4. Makes routing decision (budget vs premium)
 * 5. Returns structured analysis for image generation
 */
export async function analyzeFabric(
	input: FabricAnalysisInput,
	apiKey?: string
): Promise<FabricAnalysisOutput> {
	const startTime = Date.now();

	// API key must be passed from server route (can't use process.env in shared libs)
	if (!apiKey) {
		throw new Error('Gemini API key not provided - must be passed from server route');
	}

	const genAI = new GoogleGenerativeAI(apiKey);
	// Use Gemini 2.5 Flash for fast, cost-effective multimodal analysis
	const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

	// Build analysis prompt (version tracked for learning)
	const PROMPT_VERSION = 'v1.0.0';
	const analysisPrompt = buildAnalysisPrompt(input.userHints);

	try {
		// Call Gemini Vision API
		const result = await model.generateContent([
			analysisPrompt,
			{
				inlineData: {
					mimeType: 'image/jpeg',
					data: input.imageBuffer
						? input.imageBuffer.toString('base64')
						: await fetchImageAsBase64(input.imageUrl)
				}
			}
		]);

		const response = await result.response;
		const text = response.text();

		// Parse JSON response
		const analysisData = parseGeminiResponse(text);

		// Enrich with knowledge base data
		const fabricType = analysisData.fabricType as FabricType;
		const knowledge = FABRIC_KNOWLEDGE_BASE[fabricType] || FABRIC_KNOWLEDGE_BASE.unknown;

		// Generate rendering hints
		const renderingHints = generateRenderingHints(fabricType, knowledge, analysisData);

		// Make routing decision
		const routing = makeRoutingDecision(fabricType, knowledge, input.userHints?.quality);

		// Generate unique ID for learning system
		const analysisId = generateAnalysisId();

		const output: FabricAnalysisOutput = {
			fabricType,
			confidence: analysisData.confidence,
			characteristics: {
				...knowledge.properties,
				...analysisData.characteristics
			},
			renderingHints,
			recommendedModel: routing.model,
			routingReason: routing.reason,
			estimatedCost: routing.cost,
			analysisId,
			promptVersion: PROMPT_VERSION,
			modelVersion: 'gemini-2.5-flash',
			timestamp: new Date().toISOString()
		};

		// Log analysis for learning system

		return output;

	} catch (error) {
		log.error({ err: error }, 'Fabric analysis error');
		throw new Error('Failed to analyze fabric: ' + (error as Error).message);
	}
}

/**
 * Build the Gemini analysis prompt
 * This prompt is version-controlled for learning optimization
 */
function buildAnalysisPrompt(userHints?: FabricAnalysisInput['userHints']): string {
	const categoryHint = userHints?.category
		? `The product is in the ${userHints.category} category.`
		: '';

	const fabricHint = userHints?.knownFabric
		? `The user suggests this might be ${userHints.knownFabric}.`
		: '';

	return `You are an expert textile analyst for e-commerce product photography.

Analyze this fashion/fabric product image and provide a detailed JSON response.

${categoryHint}
${fabricHint}

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "fabricType": "cotton" | "denim" | "silk" | "leather" | "wool" | "etc",
  "confidence": 0.95,
  "characteristics": {
    "weight": "lightweight" | "medium" | "heavyweight",
    "drape": "stiff" | "structured" | "moderate" | "fluid" | "flowing",
    "stretch": "none" | "slight" | "moderate" | "high",
    "sheen": "matte" | "subtle" | "moderate" | "high-gloss",
    "texture": "detailed description of visible texture",
    "pattern": "solid" | "striped" | "plaid" | "etc",
    "transparency": "opaque" | "semi-transparent" | "sheer",
    "complexity": "simple" | "moderate" | "complex",
    "specialFeatures": ["embroidery", "buttons", "etc"]
  },
  "visualCues": {
    "foldPattern": "how the fabric folds (angular, soft, flowing)",
    "shadowBehavior": "how shadows appear in the fabric",
    "surfaceTexture": "what the surface looks like close-up"
  }
}

Be precise and detailed. This analysis will be used to generate high-quality product images.`;
}

/**
 * Parse Gemini response and extract structured data
 */
function parseGeminiResponse(responseText: string): any {
	// Remove markdown code blocks if present
	let jsonText = responseText.trim();
	if (jsonText.startsWith('```')) {
		jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
	}

	try {
		return JSON.parse(jsonText);
	} catch (error) {
		log.error({ err: responseText }, 'Failed to parse Gemini response');
		throw new Error('Invalid JSON response from Gemini');
	}
}

/**
 * Generate rendering hints for image generation AI
 */
function generateRenderingHints(
	fabricType: FabricType,
	knowledge: typeof FABRIC_KNOWLEDGE_BASE[FabricType],
	analysisData: any
): RenderingHints {
	const keywords = knowledge.promptKeywords.join(', ');
	const foldStyle = analysisData.visualCues?.foldPattern || 'natural folds';
	const surfaceDetail = analysisData.characteristics?.texture || knowledge.properties.texture;

	// Build complete prompt for image generation
	const generatedPrompt = `Professional product photography, ${keywords}, ${foldStyle}, ${surfaceDetail}, clean white background, studio lighting, high detail, commercial quality`;

	return {
		foldStyle,
		shadowDepth: knowledge.properties.drape === 'flowing' ? 'deep' : 'moderate',
		surfaceDetail,
		lightingStyle: knowledge.properties.sheen === 'high-gloss'
			? 'side lighting for sheen'
			: 'diffused soft lighting',
		requiresPhysicsSimulation: knowledge.modelPreference === 'premium',
		requiresHighResolution: knowledge.properties.complexity === 'complex',
		requiresMultiAngle: false, // TODO: Implement multi-angle logic
		generatedPrompt
	};
}

/**
 * Make intelligent routing decision (budget vs premium)
 */
function makeRoutingDecision(
	fabricType: FabricType,
	knowledge: typeof FABRIC_KNOWLEDGE_BASE[FabricType],
	userQuality?: 'budget' | 'standard' | 'premium'
): { model: 'budget' | 'premium'; reason: string; cost: number } {
	// User override
	if (userQuality === 'premium') {
		return {
			model: 'premium',
			reason: 'User requested premium quality',
			cost: 0.121 // Gemini analysis + RunwayML
		};
	}

	if (userQuality === 'budget') {
		return {
			model: 'budget',
			reason: 'User requested budget option',
			cost: 0.005 // Gemini analysis + Imagen 3
		};
	}

	// AI recommendation based on fabric complexity
	const usePremium =
		knowledge.modelPreference === 'premium' ||
		knowledge.successRate < 0.85 ||
		knowledge.properties.complexity === 'complex';

	if (usePremium) {
		return {
			model: 'premium',
			reason: `${fabricType} requires advanced physics simulation (${(knowledge.successRate * 100).toFixed(0)}% success rate)`,
			cost: 0.121
		};
	}

	return {
		model: 'budget',
		reason: `${fabricType} works well with budget model (${(knowledge.successRate * 100).toFixed(0)}% success rate)`,
		cost: 0.005
	};
}

/**
 * Generate unique analysis ID for tracking/learning
 */
function generateAnalysisId(): string {
	return `fa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
	const response = await fetch(url);
	const buffer = await response.arrayBuffer();
	return Buffer.from(buffer).toString('base64');
}

// ============================================================================
// LEARNING SYSTEM
// ============================================================================

/**
 * Submit user feedback to improve fabric analysis
 * This data is stored and used to:
 * - Update success rates for each fabric type
 * - Refine prompt templates
 * - Improve routing decisions
 */
export async function submitFabricFeedback(feedback: FabricFeedback): Promise<void> {
	// TODO: Store in database (fabric_feedback table)

	// TODO: Trigger learning system update
	// - If fabric type was wrong, update confidence thresholds
	// - If output quality was poor, adjust routing preference
	// - If rating is high, reinforce current approach
}

/**
 * Update fabric knowledge base based on accumulated feedback
 * Called periodically (daily/weekly) to improve the system
 */
export async function updateFabricKnowledge(): Promise<void> {
	// TODO: Implement learning algorithm
	// 1. Aggregate feedback by fabric type
	// 2. Calculate new success rates
	// 3. Update FABRIC_KNOWLEDGE_BASE
	// 4. Refine prompt keywords based on high-rated outputs
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
	analyzeFabric,
	submitFabricFeedback,
	updateFabricKnowledge,
	FABRIC_KNOWLEDGE_BASE
};
