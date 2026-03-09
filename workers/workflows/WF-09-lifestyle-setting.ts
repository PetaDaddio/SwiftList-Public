/**
 * WF-09: Lifestyle Setting
 *
 * Creates product in lifestyle context with in-painting
 *
 * Priority: ENHANCEMENT
 * Cost: $0.052 | Credits: 10 | Revenue: $0.50 | Margin: 89.6%
 * AI: Fal.ai Flux.1 Pro
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface LifestyleInput {
  product_image: string;
  setting_type: string;
}

interface LifestyleOutput {
  lifestyle_image_url: string;
  preset_id: string;
  setting_type: string;
}

export class LifestyleSettingWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as LifestyleInput;

      // Validate inputs
      if (!input.product_image || !input.setting_type) {
        throw new Error('Missing required fields: product_image, setting_type');
      }

      await this.updateProgress(25, 'Analyzing product for lifestyle placement');
      const imageBuffer = await this.downloadImage(input.product_image);
      const base64Image = imageBuffer.toString('base64');

      await this.updateProgress(50, 'Generating lifestyle setting with Flux');

      // Generate lifestyle image with Fal.ai Flux
      const lifestyleBuffer = await this.generateLifestyleSetting(base64Image, input.setting_type);

      await this.updateProgress(75, 'Storing preset in vector database');

      const outputPath = `${this.jobData.user_id}/${this.jobData.job_id}/lifestyle.jpg`;
      const outputUrl = await this.uploadToStorage(
        lifestyleBuffer,
        outputPath,
        'image/jpeg'
      );

      // Store preset ID in pgvector (for marketplace)
      const presetId = await this.storePreset(input.setting_type, outputUrl);

      const output: LifestyleOutput = {
        lifestyle_image_url: outputUrl,
        preset_id: presetId,
        setting_type: input.setting_type
      };

      await this.updateProgress(100, 'Lifestyle setting complete');

      return {
        success: true,
        output_data: output
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate lifestyle setting using Fal.ai Flux
   */
  private async generateLifestyleSetting(base64Image: string, settingType: string): Promise<Buffer> {
    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) {
      throw new Error('FAL_API_KEY not configured');
    }

    const prompt = `Place this product in a ${settingType} setting. Ensure realistic lighting, shadows, and proportions. The product should look naturally placed in the environment. Professional lifestyle photography, high quality, natural placement.`;

    const response = await this.callAPI(
      'https://fal.run/fal-ai/flux-pro',
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          image_url: `data:image/jpeg;base64,${base64Image}`,
          strength: 0.7,
          num_images: 1,
          guidance_scale: 7.5,
          num_inference_steps: 50
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fal.ai API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const imageUrl = result.images?.[0]?.url;

    if (!imageUrl) {
      throw new Error('No image generated from Fal.ai');
    }

    return await this.downloadImage(imageUrl);
  }

  /**
   * Store preset in pgvector database
   */
  private async storePreset(settingType: string, imageUrl: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('presets')
      .insert({
        user_id: this.jobData.user_id,
        name: `Lifestyle: ${settingType}`,
        description: `Product placed in ${settingType} setting`,
        preview_url: imageUrl,
        style_type: 'lifestyle',
        is_public: false,
        created_at: new Date().toISOString()
      })
      .select('preset_id')
      .single();

    if (error) {
      console.error('Failed to store preset:', error);
      return '';
    }

    return data?.preset_id || '';
  }
}
