/**
 * WF-19: Apply Preset
 * Applies a saved preset style to a product image using img2img
 *
 * Cost: 10 credits
 *
 * Flow:
 * 1. Fetch preset from database (style analysis + prompt template)
 * 2. Download product image
 * 3. Apply style using Google Gemini 3 (Imagen 3) img2img mode
 * 4. Upload result to AWS S3
 * 5. Increment preset usage count
 */

import { BaseWorkflow } from './base-workflow.js';
import { VertexAI } from '@google-cloud/vertexai';
import sharp from 'sharp';

interface ApplyPresetInput {
	product_image_url: string;
	preset_id: string;
	additional_prompt?: string; // Optional user customization from AI chat box
}

interface PresetData {
	preset_id: string;
	name: string;
	user_id: string;
	usage_count: number;
	preset_config: {
		style_analysis: {
			lighting: {
				type: string;
				direction: string;
				quality: string;
				color_temperature: string;
			};
			composition: {
				angle: string;
				framing: string;
				background: string;
				depth_of_field: string;
			};
			color_palette: {
				dominant_colors: string[];
				mood: string;
				saturation: string;
				contrast: string;
			};
			style: {
				aesthetic: string;
				mood: string;
				target_audience: string;
			};
			technical: {
				sharpness: string;
				grain: string;
				vignette: string;
			};
			prompt_template: string;
		};
		reference_image_url: string;
		version: string;
	};
}

export class ApplyPresetWorkflow extends BaseWorkflow {
	private vertexAI: VertexAI;

	constructor() {
		super('WF-19', 'Apply Preset');
		this.vertexAI = new VertexAI({
			project: process.env.GOOGLE_CLOUD_PROJECT!,
			location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
		});
	}

	async execute(jobId: string, inputData: ApplyPresetInput): Promise<any> {
		try {
			await this.updateProgress(jobId, 10, 'Fetching preset');

			// 1. Fetch preset from database
			const { data: preset, error: presetError } = await this.supabase
				.from('presets')
				.select('*')
				.eq('preset_id', inputData.preset_id)
				.single();

			if (presetError || !preset) {
				throw new Error(`Preset not found: ${inputData.preset_id}`);
			}

			const presetData = preset as unknown as PresetData;

			await this.updateProgress(jobId, 20, 'Downloading product image');

			// 2. Download product image
			const productImageBuffer = await this.downloadImage(inputData.product_image_url);

			await this.updateProgress(jobId, 30, 'Preparing style transfer');

			// 3. Build img2img prompt from preset style analysis
			const stylePrompt = this.buildStylePrompt(presetData, inputData.additional_prompt);

			await this.updateProgress(jobId, 40, 'Applying style with AI');

			// 4. Apply style using Gemini 3 (Imagen 3) img2img
			const styledImageBuffer = await this.applyStyleWithGemini(
				productImageBuffer,
				stylePrompt,
				presetData
			);

			await this.updateProgress(jobId, 70, 'Uploading result');

			// 5. Upload result to AWS S3
			const job = await this.getJob(jobId);
			const outputFileName = `processed/${job.user_id}/${jobId}-preset-applied.jpg`;

			const outputUrl = await this.uploadToS3(styledImageBuffer, outputFileName, 'image/jpeg');

			await this.updateProgress(jobId, 90, 'Updating preset usage');

			// 6. Increment preset usage count
			await this.supabase
				.from('presets')
				.update({ usage_count: presetData.usage_count + 1 })
				.eq('preset_id', inputData.preset_id);

			await this.updateProgress(jobId, 100, 'Preset applied successfully');

			return {
				output_url: outputUrl,
				preset_name: presetData.name,
				preset_id: presetData.preset_id,
				style_applied: presetData.preset_config.style_analysis.style.aesthetic
			};
		} catch (error: any) {
			throw new Error(`Preset application failed: ${error.message}`);
		}
	}

	/**
	 * Build img2img prompt from preset style analysis
	 */
	private buildStylePrompt(preset: PresetData, additionalPrompt?: string): string {
		const style = preset.preset_config.style_analysis;

		// Use the preset's prompt template as base
		let prompt = style.prompt_template;

		// Enhance with specific style attributes
		const enhancements = [
			`${style.lighting.type} lighting from ${style.lighting.direction}`,
			`${style.lighting.quality} light quality with ${style.lighting.color_temperature} color temperature`,
			`${style.composition.angle} camera angle`,
			`${style.composition.framing} framing`,
			`${style.composition.background} background`,
			`${style.composition.depth_of_field} depth of field`,
			`${style.color_palette.mood} color mood with ${style.color_palette.saturation} saturation`,
			`${style.color_palette.contrast} contrast`,
			`${style.style.aesthetic} aesthetic`,
			`${style.style.mood} mood`,
			`${style.technical.sharpness} sharpness`,
			`${style.technical.grain} grain`,
			`${style.technical.vignette} vignette`
		];

		prompt += `\n\nStyle attributes: ${enhancements.join(', ')}.`;

		// Add user's additional prompt if provided
		if (additionalPrompt) {
			prompt += `\n\nAdditional instructions: ${additionalPrompt}`;
		}

		// Add quality modifiers
		prompt += '\n\nProfessional product photography, high quality, commercial grade.';

		return prompt;
	}

	/**
	 * Apply style using Google Gemini 3 (Imagen 3) img2img mode
	 */
	private async applyStyleWithGemini(
		productImageBuffer: Buffer,
		stylePrompt: string,
		preset: PresetData
	): Promise<Buffer> {
		const model = this.vertexAI.getGenerativeModel({
			model: 'imagen-3',
			generationConfig: {
				temperature: 0.4, // Lower temperature for more faithful style transfer
				topP: 0.8,
				topK: 40
			}
		});

		// Convert product image to base64
		const base64Image = productImageBuffer.toString('base64');

		// Create img2img request with reference image from preset
		const referenceImageBuffer = await this.downloadImage(
			preset.preset_config.reference_image_url
		);
		const base64Reference = referenceImageBuffer.toString('base64');

		// Gemini 3 img2img request
		const request = {
			contents: [
				{
					role: 'user',
					parts: [
						{
							text: stylePrompt
						},
						{
							inlineData: {
								mimeType: 'image/jpeg',
								data: base64Image
							}
						},
						{
							text: 'Apply the style from this reference image:'
						},
						{
							inlineData: {
								mimeType: 'image/jpeg',
								data: base64Reference
							}
						}
					]
				}
			]
		};

		const response = await model.generateContent(request);

		// Extract image from response
		const imageData = response.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

		if (!imageData) {
			throw new Error('No image data returned from Gemini 3');
		}

		// Convert base64 back to buffer
		const outputBuffer = Buffer.from(imageData, 'base64');

		// Optimize with Sharp (resize to 2048x2048 max, compress to 95% quality)
		const optimizedBuffer = await sharp(outputBuffer)
			.resize(2048, 2048, {
				fit: 'inside',
				withoutEnlargement: true
			})
			.jpeg({ quality: 95 })
			.toBuffer();

		return optimizedBuffer;
	}
}
