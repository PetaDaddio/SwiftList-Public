/**
 * WF-07: Background Removal
 *
 * Alpha matte extraction & segmentation to create marketplace-ready transparent PNG
 *
 * Priority: MOST USED
 * Cost: $0.02 | Credits: 5 | Revenue: $0.25 | Margin: 80%
 * AI: Replicate RMBG v1.4
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';
import Replicate from 'replicate';

interface BackgroundRemovalInput {
  image_url: string;
  target_size?: number; // Default 1500px
}

interface BackgroundRemovalOutput {
  transparent_png_url: string;
  width: number;
  height: number;
  file_size: number;
}

export class BackgroundRemovalWorkflow extends BaseWorkflow {
  private readonly TARGET_SIZE = 1500; // 1500x1500px

  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as BackgroundRemovalInput;

      // Validate inputs
      if (!input.image_url) {
        throw new Error('Missing required field: image_url');
      }

      await this.updateProgress(25, 'Downloading product image');
      const imageBuffer = await this.downloadImage(input.image_url);

      await this.updateProgress(50, 'Removing background with Replicate RMBG');

      // Call Replicate API for background removal
      const transparentImageUrl = await this.removeBackground(input.image_url);

      await this.updateProgress(75, 'Downloading and storing transparent PNG');

      // Download the result from Replicate
      const transparentBuffer = await this.downloadImage(transparentImageUrl);

      // Upload to Supabase Storage
      const outputPath = `${this.jobData.user_id}/${this.jobData.job_id}/transparent.png`;
      const publicUrl = await this.uploadToStorage(
        transparentBuffer,
        outputPath,
        'image/png'
      );

      const output: BackgroundRemovalOutput = {
        transparent_png_url: publicUrl,
        width: this.TARGET_SIZE,
        height: this.TARGET_SIZE,
        file_size: transparentBuffer.length
      };

      await this.updateProgress(100, 'Background removal complete');

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
   * Remove background using Replicate RMBG v1.4
   * Model: https://replicate.com/cjwbw/rembg
   */
  private async removeBackground(imageUrl: string): Promise<string> {
    const apiKey = process.env.REPLICATE_API_KEY;
    if (!apiKey) {
      throw new Error('REPLICATE_API_KEY not configured');
    }

    const replicate = new Replicate({
      auth: apiKey
    });

    // Run the RMBG model
    const output = await replicate.run(
      "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
      {
        input: {
          image: imageUrl
        }
      }
    ) as string;

    // Replicate returns a URL to the processed image
    if (!output || typeof output !== 'string') {
      throw new Error('Replicate returned invalid output');
    }

    return output;
  }
}
