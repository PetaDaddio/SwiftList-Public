/**
 * Preset Prompt Adapter
 *
 * Strips product-specific references from preset style prompts before sending
 * to the image generation API. This prevents the original product (e.g., "gold cuff")
 * from bleeding into scenes generated for a different product (e.g., "3D printed dragon").
 *
 * Uses Gemini 2.5 Flash (text-only, ~$0.001/call) to intelligently extract
 * style/environment attributes while removing the original subject.
 */
import { createLogger } from '$lib/utils/logger';

const log = createLogger('preset-prompt-adapter');

/**
 * Adapt a preset style prompt for a different product type.
 *
 * Takes the original preset prompt (which may reference the original product)
 * and rewrites it to describe only the scene/style, substituting the new product.
 *
 * @param presetPrompt - The original preset style prompt (e.g., "Studio product shot of a gold cuff, soft diffused lighting...")
 * @param productType - The actual product being processed (e.g., "3D printed dragon", "handmade earrings")
 * @param geminiApiKey - Google Gemini API key
 * @returns Adapted prompt with product reference swapped, or original prompt on failure
 */
export async function adaptPresetPromptForProduct(
	presetPrompt: string,
	productType: string,
	geminiApiKey: string
): Promise<string> {
	// Skip if prompt is short or product type is generic/missing
	if (!presetPrompt || presetPrompt.length < 20 || !productType || productType === 'general') {
		return presetPrompt;
	}

	try {
		log.debug(
			{ promptLength: presetPrompt.length, productType },
			'Adapting preset prompt for product'
		);

		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: `You are a product photography prompt rewriter. Your job is to take a style preset prompt that was originally created for one product and adapt it for a different product.

ORIGINAL PRESET PROMPT:
"${presetPrompt}"

NEW PRODUCT TYPE: ${productType}

RULES:
1. Replace any reference to the original product/subject with "${productType}"
2. Keep ALL style attributes: lighting, background, colors, textures, mood, depth of field, camera angle
3. Keep the same overall tone and photography style
4. If no specific product is mentioned in the original, just prepend "Professional product photography of ${productType}," to the style description
5. Output ONLY the rewritten prompt — no explanation, no quotes, no preamble

REWRITTEN PROMPT:`
								}
							]
						}
					],
					generationConfig: {
						maxOutputTokens: 300,
						temperature: 0.1
					}
				})
			}
		);

		if (!response.ok) {
			log.warn({ status: response.status }, 'Gemini Flash prompt adaptation failed, using original');
			return presetPrompt;
		}

		const data = await response.json();
		const adapted = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

		if (!adapted || adapted.length < 15) {
			log.warn('Empty/short adaptation result, using original prompt');
			return presetPrompt;
		}

		log.info(
			{
				originalLength: presetPrompt.length,
				adaptedLength: adapted.length,
				productType,
				preview: adapted.substring(0, 80)
			},
			'Preset prompt adapted for product'
		);

		return adapted;
	} catch (err: any) {
		log.error({ err }, 'Preset prompt adaptation error, falling back to original');
		return presetPrompt;
	}
}
