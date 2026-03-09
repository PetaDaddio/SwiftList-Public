/**
 * Scene Analyst - Agent 2 of Style Transfer Engine
 *
 * Analyzes reference images to extract style DNA:
 * - Scene type and environment
 * - Lighting direction, quality, and color temperature
 * - Dominant colors and textures
 * - Mood and atmospheric effects
 * - Product placement suggestions
 *
 * Uses Google Gemini 2.5 Flash for fast, accurate multimodal analysis
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiLogger } from '$lib/utils/logger';

const log = aiLogger.child({ route: 'scene-analyst' });

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SceneAnalysisInput {
	imageUrl: string;
	imageBuffer?: Buffer; // Optional: for direct buffer upload
	userHints?: {
		productCategory?: string; // "jewelry", "clothing", "furniture"
		preferredMood?: string; // "elegant", "dramatic", "minimal"
	};
}

export interface SceneAnalysisOutput {
	sceneType: string;
	lighting: LightingData;
	dominantColors: ColorData[];
	textures: string[];
	mood: string;
	depthOfField: DepthOfFieldData;
	productPlacement: ProductPlacementData;
	atmosphericEffects: string[];
	confidence: number; // 0-1

	// Metadata
	analysisId: string;
	modelVersion: string;
	timestamp: string;
}

export interface LightingData {
	direction: {
		azimuth: number; // 0-360 (0=north, 90=east, 180=south, 270=west)
		elevation: number; // -90 to 90 (0=horizon, 90=overhead)
		description: string;
	};
	quality: string; // "soft diffused", "hard direct", "golden hour warm"
	colorTemp: number; // Kelvin (e.g., 3200=warm, 5500=neutral, 6500=cool)
	shadowIntensity: number; // 0-10 scale
	timeOfDay: string; // "golden hour", "midday", "blue hour", "night"
	hardness: 'soft' | 'medium' | 'hard';
}

export interface ColorData {
	hex: string;
	name: string;
	coverage: number; // percentage of image
}

export interface DepthOfFieldData {
	type: 'shallow' | 'medium' | 'deep';
	focalPlane: 'foreground' | 'mid_ground' | 'background';
	backgroundBlur: number; // 0-10 scale
}

export interface ProductPlacementData {
	surface: string; // "driftwood log", "marble countertop", "forest floor"
	position: string; // "mid_ground_left_third", "center_foreground"
	height: 'resting_on_surface' | 'slightly_elevated' | 'floating';
	orientation: string; // "facing_camera_slight_angle"
	scale: 'small_accent' | 'medium_prominence' | 'large_hero';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROMPT_VERSION = 'v1.0.0';
const MODEL_VERSION = 'gemini-2.5-flash';

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a reference image to extract style metadata for scene generation
 */
export async function analyzeScene(
	input: SceneAnalysisInput,
	apiKey?: string
): Promise<SceneAnalysisOutput> {
	const startTime = Date.now();

	// API key must be passed from server route
	if (!apiKey) {
		throw new Error('Gemini API key not provided - must be passed from server route');
	}

	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({ model: MODEL_VERSION });

	// Build analysis prompt
	const analysisPrompt = buildSceneAnalysisPrompt(input.userHints);

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

		// Generate unique ID for tracking
		const analysisId = generateAnalysisId();

		const output: SceneAnalysisOutput = {
			...analysisData,
			analysisId,
			modelVersion: MODEL_VERSION,
			timestamp: new Date().toISOString()
		};

		const duration = Date.now() - startTime;

		return output;
	} catch (error) {
		throw new Error('Failed to analyze scene: ' + (error as Error).message);
	}
}

// ============================================================================
// HELPER: Build Analysis Prompt
// ============================================================================

function buildSceneAnalysisPrompt(userHints?: SceneAnalysisInput['userHints']): string {
	const categoryHint = userHints?.productCategory
		? `The product to be placed is a ${userHints.productCategory}.`
		: '';

	const moodHint = userHints?.preferredMood
		? `The user prefers a ${userHints.preferredMood} mood.`
		: '';

	return `
You are an expert product photographer analyzing this reference image to extract style elements for scene generation.
${categoryHint} ${moodHint}

Analyze this image and extract the following style elements.
**CRITICAL**: Return ONLY valid JSON, no markdown code blocks, no additional text.

{
  "sceneType": "string describing environment (e.g., 'outdoor beach sunset', 'luxury studio with marble countertop', 'forest clearing with moss')",
  "lighting": {
    "direction": {
      "azimuth": number (0-360, where 0=north, 90=east, 180=south, 270=west),
      "elevation": number (-90 to 90, where 0=horizon, 90=directly overhead, negative=below horizon),
      "description": "string describing light position in natural language (e.g., 'top-right at 45 degrees', 'low left-side near horizon')"
    },
    "quality": "string (e.g., 'soft diffused', 'hard direct sunlight', 'golden hour warm glow', 'cool studio lighting')",
    "colorTemp": number (Kelvin: 2000-3000=very warm/sunset, 3200-4000=warm/tungsten, 5000-6000=neutral/daylight, 6500-8000=cool/overcast, 9000+=very cool/blue hour),
    "shadowIntensity": number (0=no visible shadows, 5=moderate shadows, 10=very dark/dramatic shadows),
    "timeOfDay": "string ('sunrise', 'golden hour', 'midday', 'afternoon', 'blue hour', 'night')",
    "hardness": "string ('soft'=diffused with gradual falloff, 'medium'=moderate edge definition, 'hard'=sharp shadow edges)"
  },
  "dominantColors": [
    {"hex": "#HEX_CODE", "name": "descriptive_name", "coverage": number (percentage, must sum to 100)},
    // List the top 5 most prominent colors by area
  ],
  "textures": [
    "string describing surface materials visible (e.g., 'wet sand with small ripples', 'smooth polished marble', 'rough weathered wood', 'soft fabric folds')",
    // List 2-4 most prominent textures
  ],
  "mood": "string describing emotional tone (e.g., 'serene and romantic', 'dramatic and moody', 'clean and minimal', 'vibrant and energetic', 'warm and cozy')",
  "depthOfField": {
    "type": "string ('shallow'=blurred background, 'medium'=some background blur, 'deep'=everything in focus)",
    "focalPlane": "string ('foreground'=front 1/3 sharp, 'mid_ground'=middle sharp, 'background'=distant sharp)",
    "backgroundBlur": number (0=no blur/all in focus, 5=moderate blur, 10=very blurred/bokeh effect)
  },
  "productPlacement": {
    "surface": "string describing where a product would naturally rest (e.g., 'weathered driftwood log', 'smooth marble countertop', 'mossy rock', 'floating in air', 'hanging from branch')",
    "position": "string using rule of thirds (e.g., 'center_foreground', 'left_third_mid_ground', 'right_third_background')",
    "height": "string ('resting_on_surface'=touching ground, 'slightly_elevated'=on a platform/pedestal, 'floating'=suspended in air)",
    "orientation": "string (e.g., 'facing_camera_directly', 'facing_camera_slight_angle', 'side_profile', 'three_quarter_view')",
    "scale": "string ('small_accent'=15-25% of frame, 'medium_prominence'=30-50% of frame, 'large_hero'=60%+ of frame)"
  },
  "atmosphericEffects": [
    "string describing visible atmospheric effects (e.g., 'lens flare from sun', 'soft mist near horizon', 'dust particles in light beam', 'rain droplets', 'fog', 'smoke')",
    // List 0-3 effects (empty array if none)
  ],
  "confidence": number (0.0-1.0, your confidence in this analysis)
}

**Examples of good scene descriptions**:
- "outdoor beach sunset with wet sand and driftwood"
- "indoor luxury studio with white marble countertop and soft overhead lighting"
- "forest clearing with moss-covered rocks and dappled sunlight"
- "urban rooftop at blue hour with city lights in background"

**Important**:
- Be precise with lighting direction (azimuth/elevation numbers)
- Choose realistic color temperature values
- Consider where a product would naturally rest in this scene
- Return ONLY the JSON object, no extra text

Return your analysis now:
`.trim();
}

// ============================================================================
// HELPER: Parse Gemini Response
// ============================================================================

function parseGeminiResponse(text: string): Omit<SceneAnalysisOutput, 'analysisId' | 'modelVersion' | 'timestamp'> {
	try {
		// Remove markdown code blocks if present
		let jsonText = text.trim();

		// Remove ```json and ``` markers
		jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

		// Parse JSON
		const parsed = JSON.parse(jsonText);

		// Validate required fields
		if (!parsed.sceneType || !parsed.lighting || !parsed.dominantColors) {
			throw new Error('Missing required fields in Gemini response');
		}

		// Ensure confidence is between 0 and 1
		if (parsed.confidence > 1) {
			parsed.confidence = parsed.confidence / 100;
		}

		return parsed;
	} catch (error) {
		log.error({ err: text }, 'Failed to parse Gemini response');
		throw new Error('Invalid JSON response from Gemini: ' + (error as Error).message);
	}
}

// ============================================================================
// HELPER: Fetch Image as Base64
// ============================================================================

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
	try {
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.status}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		return buffer.toString('base64');
	} catch (error) {
		log.error({ err: error }, 'Error fetching image');
		throw new Error('Failed to fetch image: ' + (error as Error).message);
	}
}

// ============================================================================
// HELPER: Generate Analysis ID
// ============================================================================

function generateAnalysisId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 15);
	return `scene_${timestamp}_${random}`;
}

// ============================================================================
// UTILITY: Calculate Shadow Parameters
// ============================================================================

/**
 * Calculate shadow position and properties based on lighting direction
 */
export function calculateShadowParameters(
	lightDirection: LightingData['direction'],
	productBounds: { width: number; height: number },
	surfaceType: string
): {
	length: number;
	angle: number;
	hardness: 'soft' | 'medium' | 'hard';
	opacity: number;
} {
	// Shadow length increases as light approaches horizon
	const elevationRad = (lightDirection.elevation * Math.PI) / 180;
	const shadowLength = lightDirection.elevation > 0
		? productBounds.height * (1 / Math.tan(elevationRad))
		: productBounds.height * 2; // Very long shadow if sun below horizon

	// Shadow angle is opposite to light azimuth
	const shadowAngle = (lightDirection.azimuth + 180) % 360;

	// Higher sun = darker, harder shadows
	const shadowHardness: 'soft' | 'medium' | 'hard' =
		lightDirection.elevation > 60
			? 'hard'
			: lightDirection.elevation > 30
				? 'medium'
				: 'soft';

	// Opacity based on elevation (higher = more opaque)
	const opacity = Math.max(0.3, Math.min(0.8, 0.4 + (lightDirection.elevation / 90) * 0.4));

	return {
		length: Math.min(shadowLength, productBounds.height * 3), // Cap at 3x product height
		angle: shadowAngle,
		hardness: shadowHardness,
		opacity
	};
}

// ============================================================================
// UTILITY: Generate Prompt for StyleComposer
// ============================================================================

/**
 * Convert scene analysis into a detailed prompt for Agent 3 (StyleComposer)
 */
export function buildStyleComposerPrompt(
	sceneAnalysis: SceneAnalysisOutput,
	productCategory: string
): string {
	const colors = sceneAnalysis.dominantColors.map((c) => c.hex).join(', ');
	const effects = sceneAnalysis.atmosphericEffects.length > 0
		? `\nInclude atmospheric effects: ${sceneAnalysis.atmosphericEffects.join(', ')}.`
		: '';

	return `
Photorealistic ${sceneAnalysis.sceneType}, professional product photography.

LIGHTING:
${sceneAnalysis.lighting.quality}, ${sceneAnalysis.lighting.direction.description}.
Color temperature: ${sceneAnalysis.lighting.colorTemp}K ${sceneAnalysis.lighting.timeOfDay}.
Shadow intensity: ${sceneAnalysis.lighting.shadowIntensity}/10, ${sceneAnalysis.lighting.hardness} shadows.

COLOR PALETTE:
Dominant colors: ${colors}

TEXTURES:
${sceneAnalysis.textures.join(', ')}

MOOD:
${sceneAnalysis.mood}

DEPTH OF FIELD:
${sceneAnalysis.depthOfField.type} depth of field, ${sceneAnalysis.depthOfField.focalPlane} in sharp focus.
${sceneAnalysis.depthOfField.backgroundBlur > 5 ? 'Background softly blurred with bokeh effect.' : ''}${effects}

PRODUCT PLACEMENT:
Create a natural resting place for a ${productCategory} on ${sceneAnalysis.productPlacement.surface}.
Position: ${sceneAnalysis.productPlacement.position}.
Height: ${sceneAnalysis.productPlacement.height}.
Scale: ${sceneAnalysis.productPlacement.scale}.
Leave the exact product area empty but with correct shadows, reflections, and ambient occlusion indicating where the product will sit.

TECHNICAL REQUIREMENTS:
8K resolution, sharp focus on product placement area, Canon EOS R5 quality, professional color grading.
No watermarks, no text, no existing products - just the prepared scene.
Photorealistic, e-commerce quality, hero product photography.
`.trim();
}
