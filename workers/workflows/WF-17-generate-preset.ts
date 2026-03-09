/**
 * WF-17: Preset Generator
 * Analyzes reference images and creates reusable style presets
 *
 * Cost: 15 credits
 *
 * Flow:
 * 1. Download reference image
 * 2. Analyze style with Claude Vision API
 * 3. Generate thumbnail with Sharp
 * 4. Create OpenAI embeddings for similarity search
 * 5. Save preset to database
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import sharp from 'sharp';
import { BaseWorkflow } from './base-workflow.js';

interface PresetGeneratorInput {
	reference_image_url: string;
	preset_name: string;
	preset_description?: string;  // Auto-generated if not provided
	category?: string;              // Auto-detected from style analysis
	tags?: string[];                // Auto-generated from style analysis
	is_public?: boolean;            // Defaults to false (private)
}

interface StyleAnalysis {
	lighting: {
		type: string; // 'natural', 'studio', 'dramatic', 'soft'
		direction: string; // 'top', 'side', 'front', 'back'
		quality: string; // 'hard', 'soft', 'diffused'
		color_temperature: string; // 'warm', 'cool', 'neutral'
	};
	composition: {
		angle: string; // 'overhead', 'eye-level', '45-degree', 'low-angle'
		framing: string; // 'tight', 'medium', 'wide'
		background: string; // 'white', 'textured', 'gradient', 'natural'
		depth_of_field: string; // 'shallow', 'deep'
	};
	color_palette: {
		dominant_colors: string[];
		mood: string; // 'vibrant', 'muted', 'monochromatic', 'complementary'
		saturation: string; // 'high', 'medium', 'low'
		contrast: string; // 'high', 'medium', 'low'
	};
	style: {
		aesthetic: string; // 'minimalist', 'vintage', 'luxury', 'casual', 'editorial'
		mood: string; // 'elegant', 'playful', 'professional', 'cozy'
		target_audience: string; // 'luxury', 'mass-market', 'artisan', 'eco-conscious'
	};
	technical: {
		sharpness: string; // 'crisp', 'soft', 'artistic-blur'
		grain: string; // 'none', 'subtle', 'prominent'
		vignette: string; // 'none', 'subtle', 'strong'
	};
	prompt_template: string; // Generated prompt for replicating this style
}

export class GeneratePresetWorkflow extends BaseWorkflow {
	private anthropic: Anthropic;
	private openai: OpenAI;

	constructor() {
		super('WF-17', 'Preset Generator');
		this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
		this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}

	async execute(jobId: string, inputData: PresetGeneratorInput): Promise<any> {
		try {
			await this.updateProgress(jobId, 10, 'Downloading reference image');

			// 1. Download reference image
			const imageBuffer = await this.downloadImage(inputData.reference_image_url);

			await this.updateProgress(jobId, 20, 'Analyzing style with AI');

			// 2. Analyze style with Claude Vision
			const styleAnalysis = await this.analyzeStyle(imageBuffer);

			await this.updateProgress(jobId, 50, 'Generating thumbnail');

			// 3. Generate thumbnail (400x400)
			const thumbnailBuffer = await sharp(imageBuffer)
				.resize(400, 400, {
					fit: 'cover',
					position: 'center'
				})
				.jpeg({ quality: 90 })
				.toBuffer();

			await this.updateProgress(jobId, 60, 'Uploading thumbnail');

			// 4. Upload thumbnail to AWS S3
			const job = await this.getJob(jobId);
			const thumbnailFileName = `preset-thumbnails/${job.user_id}/${jobId}-thumbnail.jpg`;

			const thumbnailUrl = await this.uploadToS3(
				thumbnailBuffer,
				thumbnailFileName,
				'image/jpeg'
			);

			await this.updateProgress(jobId, 70, 'Creating embeddings');

			// 5. Create OpenAI embeddings for similarity search
			const embeddingText = this.createEmbeddingText(inputData, styleAnalysis);
			const embedding = await this.createEmbedding(embeddingText);

			await this.updateProgress(jobId, 80, 'Saving preset');

			// 6. Auto-generate metadata from style analysis if not provided
			const presetDescription =
				inputData.preset_description ||
				`${styleAnalysis.style.aesthetic} style with ${styleAnalysis.lighting.type} lighting`;

			const presetCategory = inputData.category || 'general';

			const presetTags = inputData.tags || [
				styleAnalysis.style.aesthetic,
				styleAnalysis.style.mood,
				styleAnalysis.lighting.type,
				styleAnalysis.color_palette.mood
			].filter(Boolean);

			const isPublic = inputData.is_public ?? false; // Default to private

			// 7. Create preset in database
			const { data: preset, error: presetError } = await this.supabase
				.from('presets')
				.insert({
					user_id: job.user_id,
					name: inputData.preset_name,
					description: presetDescription,
					category: presetCategory,
					tags: presetTags,
					thumbnail_url: thumbnailUrl,
					preset_config: {
						style_analysis: styleAnalysis,
						reference_image_url: inputData.reference_image_url,
						version: '1.0'
					},
					embedding: embedding,
					is_public: isPublic,
					usage_count: 0
				})
				.select()
				.single();

			if (presetError) throw presetError;

			await this.updateProgress(jobId, 100, 'Preset generated successfully');

			return {
				preset_id: preset.preset_id,
				preset_name: preset.name,
				thumbnail_url: preset.thumbnail_url,
				style_analysis: styleAnalysis
			};
		} catch (error: any) {
			throw new Error(`Preset generation failed: ${error.message}`);
		}
	}

	/**
	 * Analyze style using Claude Vision API
	 */
	private async analyzeStyle(imageBuffer: Buffer): Promise<StyleAnalysis> {
		const base64Image = imageBuffer.toString('base64');

		const prompt = `Analyze this product image and extract its photographic and stylistic characteristics. Provide a detailed analysis of:

1. **Lighting**: Type (natural/studio/dramatic/soft), direction, quality (hard/soft/diffused), color temperature
2. **Composition**: Camera angle, framing, background style, depth of field
3. **Color Palette**: Dominant colors, mood, saturation level, contrast level
4. **Style**: Overall aesthetic, mood, target audience
5. **Technical**: Sharpness, grain, vignette

Also, generate a detailed prompt template that could be used to replicate this style for other product images.

Return your analysis in this exact JSON structure:
{
  "lighting": {
    "type": "...",
    "direction": "...",
    "quality": "...",
    "color_temperature": "..."
  },
  "composition": {
    "angle": "...",
    "framing": "...",
    "background": "...",
    "depth_of_field": "..."
  },
  "color_palette": {
    "dominant_colors": ["...", "..."],
    "mood": "...",
    "saturation": "...",
    "contrast": "..."
  },
  "style": {
    "aesthetic": "...",
    "mood": "...",
    "target_audience": "..."
  },
  "technical": {
    "sharpness": "...",
    "grain": "...",
    "vignette": "..."
  },
  "prompt_template": "..."
}`;

		const message = await this.anthropic.messages.create({
			model: 'claude-3-5-sonnet-20241022',
			max_tokens: 2000,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							source: {
								type: 'base64',
								media_type: 'image/jpeg',
								data: base64Image
							}
						},
						{
							type: 'text',
							text: prompt
						}
					]
				}
			]
		});

		// Extract JSON from response
		const content = message.content[0];
		if (content.type !== 'text') {
			throw new Error('Unexpected response format from Claude');
		}

		// Parse JSON from response (handle potential markdown code blocks)
		let jsonText = content.text;
		const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
		if (jsonMatch) {
			jsonText = jsonMatch[1];
		}

		const styleAnalysis = JSON.parse(jsonText);

		return styleAnalysis;
	}

	/**
	 * Create embedding text for similarity search
	 */
	private createEmbeddingText(input: PresetGeneratorInput, style: StyleAnalysis): string {
		const parts = [
			input.preset_name,
			input.preset_description,
			input.category,
			...(input.tags || []),
			style.lighting.type,
			style.lighting.color_temperature,
			style.composition.angle,
			style.composition.background,
			style.color_palette.mood,
			style.style.aesthetic,
			style.style.mood,
			style.target_audience
		];

		return parts.filter(Boolean).join(' ');
	}

	/**
	 * Create OpenAI embedding for similarity search
	 */
	private async createEmbedding(text: string): Promise<number[]> {
		const response = await this.openai.embeddings.create({
			model: 'text-embedding-ada-002',
			input: text
		});

		return response.data[0].embedding;
	}
}
