/**
 * Hands Analyst - Product in Human Hands Generator
 *
 * Analyzes product images to determine optimal hand grip, contact points,
 * and scale for generating lifestyle photos of products held in human hands.
 *
 * Uses Google Gemini 2.5 Flash for fast, accurate multimodal analysis
 * and builds structured prompts for Imagen 3 generation.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiLogger } from '$lib/utils/logger';

const log = aiLogger.child({ route: 'hands-analyst' });

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type GripType = 'pinch' | 'palm' | 'fingertip' | 'two-handed' | 'display' | 'cradled';

export type SkinTone = 'light' | 'medium' | 'olive' | 'tan' | 'brown' | 'dark';

export type HandPlacement = 'palm' | 'fingertip' | 'pinch' | 'two-handed' | 'display' | 'cradled';

export type HandStyle = 'elegant' | 'casual' | 'rustic' | 'modern' | 'luxury';

export type HandGender = 'feminine' | 'masculine' | 'neutral';

export interface ArtDirection {
	skinTone?: SkinTone;
	handPlacement?: HandPlacement;
	style?: HandStyle;
	gender?: HandGender;
	accessories?: string;
}

export interface HandsAnalysisInput {
	imageUrl: string;
	imageBuffer?: Buffer;
	productCategory: string;
	artDirection?: ArtDirection;
}

export interface ContactPoint {
	location: string;
	fingerName: string;
	pressure: 'light' | 'medium' | 'firm';
}

export interface HandsAnalysisOutput {
	gripType: GripType;
	contactPoints: ContactPoint[];
	productScale: string;
	handOrientation: string;
	lightingMatch: string;
	confidence: number;
	analysisId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODEL_VERSION = 'gemini-2.5-flash';

const SKIN_TONE_MAP: Record<SkinTone, string> = {
	light: 'fair porcelain skin',
	medium: 'warm medium skin tone',
	olive: 'olive complexion',
	tan: 'warm tan skin',
	brown: 'rich brown skin',
	dark: 'deep dark skin'
};

const STYLE_MAP: Record<HandStyle, string> = {
	elegant: 'studio lighting with soft gradient background, refined and polished',
	casual: 'natural daylight, relaxed and approachable feel',
	rustic: 'warm wooden surface backdrop, artisanal and organic',
	modern: 'minimal clean background with geometric shadows',
	luxury: 'rich velvet or satin backdrop, opulent and aspirational'
};

const GENDER_MAP: Record<HandGender, string> = {
	feminine: 'slender fingers with manicured nails, delicate wrist',
	masculine: 'strong hands with broader fingers, wider wrist',
	neutral: 'well-proportioned hands with clean short nails'
};

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a product image to determine optimal hand grip and placement
 */
export async function analyzeForHands(
	input: HandsAnalysisInput,
	apiKey?: string
): Promise<HandsAnalysisOutput> {
	if (!apiKey) {
		throw new Error('Gemini API key not provided - must be passed from server route');
	}

	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({ model: MODEL_VERSION });

	const analysisPrompt = buildHandsAnalysisPrompt(input.productCategory, input.artDirection);

	try {
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

		const analysisData = parseGeminiResponse(text);
		const analysisId = generateAnalysisId();

		// Override grip type if art direction specifies hand placement
		if (input.artDirection?.handPlacement) {
			analysisData.gripType = input.artDirection.handPlacement;
		}

		const output: HandsAnalysisOutput = {
			gripType: analysisData.gripType,
			contactPoints: analysisData.contactPoints,
			productScale: analysisData.productScale,
			handOrientation: analysisData.handOrientation,
			lightingMatch: analysisData.lightingMatch,
			confidence: analysisData.confidence > 1 ? analysisData.confidence / 100 : analysisData.confidence,
			analysisId
		};

		log.info({ gripType: output.gripType, confidence: output.confidence, analysisId }, 'Hands analysis complete');

		return output;
	} catch (err) {
		log.error({ err }, 'Hands analysis failed');
		throw new Error('Failed to analyze product for hands placement: ' + (err as Error).message);
	}
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function buildHandsAnalysisPrompt(productCategory: string, artDirection?: ArtDirection): string {
	const placementHint = artDirection?.handPlacement
		? `The user prefers a ${artDirection.handPlacement} grip style.`
		: '';

	return `
You are an expert product photographer specializing in "product in hands" lifestyle photography.

Analyze this ${productCategory} product image and determine the optimal way for human hands to hold and display it.
${placementHint}

**CRITICAL**: Return ONLY valid JSON, no markdown code blocks, no additional text.

{
  "gripType": "pinch" | "palm" | "fingertip" | "two-handed" | "display" | "cradled",
  "contactPoints": [
    {
      "location": "where on the product this finger touches (e.g., 'left edge midpoint', 'bottom center')",
      "fingerName": "thumb" | "index" | "middle" | "ring" | "pinky" | "palm",
      "pressure": "light" | "medium" | "firm"
    }
  ],
  "productScale": "description of product size relative to hand (e.g., 'fits in palm', 'requires two hands', 'held between thumb and index finger')",
  "handOrientation": "how the hand is positioned (e.g., 'palm up presenting', 'fingers wrapped around from right side', 'cupped underneath')",
  "lightingMatch": "lighting direction and quality that matches the product image (e.g., 'soft top-left lighting at 45 degrees', 'even studio lighting from above')",
  "confidence": number (0.0-1.0)
}

**Grip Type Guide**:
- "pinch": Small items held between thumb and one finger (jewelry, small electronics)
- "palm": Items resting in open palm (flat items, small boxes)
- "fingertip": Delicate items held by fingertips (cosmetics, small bottles)
- "two-handed": Larger items requiring both hands (tablets, large boxes, clothing held up)
- "display": Product resting on flat open hand for presentation (watches, phones)
- "cradled": Items cupped in both hands (bowls, round items, candles)

**Important**:
- Consider the product's weight, fragility, and shape
- Contact points should be realistic for the grip type
- Lighting should match the existing product image
- Return ONLY the JSON object

Return your analysis now:
`.trim();
}

/**
 * Build a structured Imagen 3 prompt from analysis results and art direction
 */
export function buildHandsPrompt(
	analysis: HandsAnalysisOutput,
	productCategory: string,
	artDirection: ArtDirection = {}
): string {
	const skinTone = artDirection.skinTone
		? SKIN_TONE_MAP[artDirection.skinTone]
		: 'natural warm skin tone';

	const style = artDirection.style
		? STYLE_MAP[artDirection.style]
		: 'clean studio lighting, professional product photography';

	const genderDesc = artDirection.gender
		? GENDER_MAP[artDirection.gender]
		: GENDER_MAP.neutral;

	const accessoriesDesc = artDirection.accessories
		? `Wearing ${artDirection.accessories}.`
		: '';

	const contactDesc = analysis.contactPoints
		.map((cp) => `${cp.fingerName} at ${cp.location} with ${cp.pressure} pressure`)
		.join(', ');

	return `
Photorealistic product photography, ${productCategory} held in human hands, commercial e-commerce quality.

HANDS DESCRIPTION:
Beautiful ${skinTone} hands, ${genderDesc}. ${accessoriesDesc}
Realistic skin texture with natural pores, subtle veins, and lifelike detail.

GRIP & CONTACT:
${analysis.gripType} grip. ${analysis.handOrientation}.
Contact points: ${contactDesc}.
Product scale: ${analysis.productScale}.

PRODUCT PLACEMENT:
The ${productCategory} is the hero subject, prominently displayed and in sharp focus.
Hands frame and present the product naturally, drawing attention to its features.
Product maintains its original colors, details, and proportions exactly.

LIGHTING:
${analysis.lightingMatch}.
${style}.
Soft shadows on hands that match the product's existing lighting direction.
Skin has natural subsurface scattering and realistic highlight rolloff.

SKIN DETAIL:
Hyper-realistic skin rendering with natural texture, no plastic or airbrushed look.
Visible skin pores, subtle color variation, natural nail beds.
Hands look lived-in and real, not CGI or mannequin-like.

COMPOSITION:
Centered composition with product as focal point.
Hands enter frame naturally, not cropped awkwardly.
Shallow depth of field with product and hand contact area in sharp focus.
Background softly blurred.

TECHNICAL REQUIREMENTS:
8K resolution, sharp focus on product, Canon EOS R5 quality.
Professional color grading, true-to-life colors.
No watermarks, no text, no logos.
Photorealistic, e-commerce quality, hero product photography.
`.trim();
}

// ============================================================================
// HELPERS
// ============================================================================

function parseGeminiResponse(text: string): Omit<HandsAnalysisOutput, 'analysisId'> {
	try {
		let jsonText = text.trim();
		jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

		const parsed = JSON.parse(jsonText);

		if (!parsed.gripType || !parsed.contactPoints) {
			throw new Error('Missing required fields in Gemini response');
		}

		return parsed;
	} catch (err) {
		log.error({ err: text }, 'Failed to parse Gemini hands analysis response');
		throw new Error('Invalid JSON response from Gemini: ' + (err as Error).message);
	}
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
	try {
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.status}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		return buffer.toString('base64');
	} catch (err) {
		log.error({ err }, 'Error fetching image');
		throw new Error('Failed to fetch image: ' + (err as Error).message);
	}
}

function generateAnalysisId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 15);
	return `hands_${timestamp}_${random}`;
}
