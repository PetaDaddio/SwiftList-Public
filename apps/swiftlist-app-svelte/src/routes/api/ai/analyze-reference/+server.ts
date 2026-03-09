/**
 * Reference Image Analysis API Endpoint
 * POST /api/ai/analyze-reference
 *
 * Analyzes a reference image to extract style characteristics for style transfer.
 * Uses Google Gemini Flash 2.5 for vision analysis.
 *
 * Input:
 * - image_base64: Base64-encoded image data
 * - file_name: Original filename (optional)
 *
 * Output:
 * - style_description: Natural language description of the style
 * - characteristics: Object with detailed style attributes
 * - mood: Overall mood/vibe of the image
 * - suggested_prompt: AI-generated prompt for style transfer
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler, RequestEvent } from './$types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { aiLogger } from '$lib/utils/logger';

// Allow larger payloads for base64-encoded images (up to 20MB)
export const config = {
	body: {
		maxSize: '20mb'
	}
};

const log = aiLogger.child({ route: '/api/ai/analyze-reference' });

// Input validation schema
const analyzeReferenceSchema = z.object({
	image_base64: z.string()
		.min(1, 'Image data is required')
		.max(20_000_000, 'Image too large (max ~15MB base64)'), // ~15MB file = ~20MB base64
	file_name: z.string().max(255).optional()
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
	model: 'gemini-2.5-flash',
	generationConfig: {
		// Disable "thinking" mode — we need fast style extraction, not deep reasoning.
		// Gemini 2.5 Flash's thinking budget causes 60s+ delays on large images.
		// @ts-expect-error — thinkingConfig not yet in @google/generative-ai types
		thinkingConfig: { thinkingBudget: 0 }
	}
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// SECURITY: Require authentication (calls paid Gemini API)
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const body = await request.json();
		const parsed = analyzeReferenceSchema.safeParse(body);

		if (!parsed.success) {
			return json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
		}

		const { image_base64, file_name } = parsed.data;

		// Remove data URL prefix if present
		const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');

		// Determine MIME type
		let mimeType = 'image/jpeg';
		if (image_base64.includes('data:image/')) {
			mimeType = image_base64.split(';')[0].replace('data:', '');
		} else if (file_name) {
			if (file_name.endsWith('.png')) mimeType = 'image/png';
			else if (file_name.endsWith('.webp')) mimeType = 'image/webp';
		}

		// Create prompt for style analysis
		const prompt = `You are an expert visual stylist and art director. Analyze this reference image and extract detailed style characteristics that can be used for style transfer.

Your task:
1. IDENTIFY the overall visual style and aesthetic
2. DESCRIBE the mood, atmosphere, and emotional tone
3. EXTRACT technical characteristics (lighting, color palette, composition, texture)
4. SUGGEST a detailed prompt for recreating this style

Focus on these aspects:
- **Lighting:** Natural/artificial, soft/hard, direction, time of day, quality
- **Color Palette:** Dominant colors, saturation, temperature (warm/cool), contrast
- **Composition:** Framing, perspective, rule of thirds, focal points, depth of field
- **Texture & Detail:** Surface qualities, sharpness, grain, smoothness
- **Mood & Atmosphere:** Emotional tone, vibe, energy level
- **Setting & Context:** Environment type, background elements
- **Photography Style:** Professional/casual, studio/lifestyle, vintage/modern

Return ONLY this JSON (no markdown, no code blocks):
{
  "style_description": "Concise 2-3 sentence description of the overall style",
  "mood": "emotional tone and atmosphere (e.g., 'warm and inviting', 'dramatic and moody', 'bright and cheerful')",
  "characteristics": {
    "lighting": {
      "type": "natural/artificial/mixed",
      "quality": "soft/hard/diffused",
      "direction": "front/side/back/top",
      "time_of_day": "morning/afternoon/evening/night if applicable"
    },
    "colors": {
      "palette": ["color1", "color2", "color3"],
      "saturation": "vibrant/muted/desaturated",
      "temperature": "warm/cool/neutral",
      "contrast": "high/medium/low"
    },
    "composition": {
      "framing": "close-up/medium/wide",
      "perspective": "straight-on/overhead/low-angle/eye-level",
      "depth_of_field": "shallow/deep",
      "background": "clean/busy/blurred/textured"
    },
    "texture": {
      "surface_quality": "smooth/rough/glossy/matte",
      "detail_level": "sharp/soft/grainy",
      "finish": "professional/natural/artistic"
    },
    "setting": {
      "environment": "studio/indoor/outdoor/natural",
      "props": "minimal/styled/abundant",
      "context": "lifestyle/editorial/commercial/artistic"
    }
  },
  "photography_style": "professional/lifestyle/editorial/vintage/modern/minimalist etc.",
  "suggested_prompt": "Detailed 1-2 sentence prompt that captures this exact style for use in image generation (be specific about lighting, colors, mood, composition)"
}

Example for a lifestyle jewelry photo on marble:
{
  "style_description": "Professional lifestyle photography with natural lighting on elegant marble surface. Clean, minimalist aesthetic with warm golden hour tones.",
  "mood": "elegant and sophisticated, yet approachable",
  "characteristics": {
    "lighting": {
      "type": "natural",
      "quality": "soft",
      "direction": "side",
      "time_of_day": "golden hour"
    },
    "colors": {
      "palette": ["warm white", "cream", "soft gold", "light gray"],
      "saturation": "muted",
      "temperature": "warm",
      "contrast": "medium"
    },
    "composition": {
      "framing": "close-up",
      "perspective": "overhead",
      "depth_of_field": "shallow",
      "background": "clean"
    },
    "texture": {
      "surface_quality": "smooth with marble veining",
      "detail_level": "sharp",
      "finish": "professional"
    },
    "setting": {
      "environment": "indoor",
      "props": "minimal",
      "context": "lifestyle"
    }
  },
  "photography_style": "professional lifestyle",
  "suggested_prompt": "Professional lifestyle photography, product on white marble countertop, soft natural golden hour lighting from the side, warm muted tones, clean minimalist background, shallow depth of field, elegant and sophisticated mood"
}`;

		// Call Gemini API with timeout (30s max — prevents hanging on large images)
		let text: string;
		try {
			const geminiPromise = model.generateContent([
				{
					inlineData: {
						data: base64Data,
						mimeType
					}
				},
				{ text: prompt }
			]);

			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Gemini API timeout after 30s')), 30_000)
			);

			const result = await Promise.race([geminiPromise, timeoutPromise]);
			const response = result.response;
			text = response.text();
		} catch (error: any) {
			log.error({ err: error, message: error?.message }, 'Gemini reference analysis failed');
			return json(
				{
					error: 'Failed to analyze reference image'
				},
				{ status: 500 }
			);
		}

		// Parse JSON response
		let styleAnalysis: any;
		try {
			// Clean response (remove markdown code blocks if present)
			const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
			styleAnalysis = JSON.parse(cleanText);
		} catch (error) {
			return json(
				{
					error: 'Invalid response format from AI',
					raw_response: text
				},
				{ status: 500 }
			);
		}

		// Build response
		const responseData = {
			style_description: styleAnalysis.style_description || 'Unknown style',
			mood: styleAnalysis.mood || 'neutral',
			characteristics: styleAnalysis.characteristics || {},
			photography_style: styleAnalysis.photography_style || 'general',
			suggested_prompt: styleAnalysis.suggested_prompt || ''
		};

		log.info({ style: styleAnalysis.photography_style }, 'Reference analysis complete');
		return json(responseData);
	} catch (error) {
		log.error({ err: error }, 'Reference analysis failed');
		return json(
			{
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
