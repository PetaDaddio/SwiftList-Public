/**
 * WF-06: General Goods Engine
 *
 * Standard background replacement for majority of products
 *
 * Priority: HIGH PRIORITY
 * Cost: $0.015 | Credits: 10 | Revenue: $0.50 | Margin: 97%
 * AI: Stability AI SDXL 1024
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface GeneralGoodsInput {
  product_image: string;
  background_style?: string;
}

interface GeneralGoodsOutput {
  output_image_url: string;
  background_style: string;
  width: number;
  height: number;
}

export class GeneralGoodsEngineWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as GeneralGoodsInput;

      // Validate inputs
      if (!input.product_image) {
        throw new Error('Missing required field: product_image');
      }

      const backgroundStyle = input.background_style || 'clean white studio background';

      await this.updateProgress(25, 'Downloading product image');
      const imageBuffer = await this.downloadImage(input.product_image);
      const base64Image = imageBuffer.toString('base64');

      await this.updateProgress(50, 'Generating new background with SDXL');

      // Call Stability AI SDXL for background generation
      const outputBuffer = await this.generateBackground(base64Image, backgroundStyle);

      await this.updateProgress(75, 'Uploading final image');

      // Upload to Supabase Storage
      const outputPath = `${this.jobData.user_id}/${this.jobData.job_id}/output.jpg`;
      const publicUrl = await this.uploadToStorage(
        outputBuffer,
        outputPath,
        'image/jpeg'
      );

      const output: GeneralGoodsOutput = {
        output_image_url: publicUrl,
        background_style: backgroundStyle,
        width: 1024,
        height: 1024
      };

      await this.updateProgress(100, 'Background replacement complete');

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
   * Generate background using Stability AI SDXL
   */
  private async generateBackground(base64Image: string, style: string): Promise<Buffer> {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
      throw new Error('STABILITY_API_KEY not configured');
    }

    const prompt = `Professional product photography with ${style}, high quality, commercial photography, centered product, perfect lighting, studio quality`;

    const formData = new FormData();
    formData.append('init_image', base64Image);
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', '0.35');
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1');
    formData.append('cfg_scale', '7');
    formData.append('samples', '1');
    formData.append('steps', '30');

    const response = await this.callAPI(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: formData as any
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stability AI error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const imageBase64 = result.artifacts?.[0]?.base64;

    if (!imageBase64) {
      throw new Error('No image generated from Stability AI');
    }

    return Buffer.from(imageBase64, 'base64');
  }
}
