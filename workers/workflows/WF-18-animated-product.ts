/**
 * WF-18: Animated Product
 *
 * Generates 5-10 second MP4 product video with orbit/pan/zoom motion
 *
 * Priority: VIDEO GEN
 * Cost: $0.302 | Credits: 26 | Revenue: $1.30 | Margin: 76.8%
 * AI: RunwayML Gen-3 Alpha Turbo
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface AnimatedProductInput {
  product_image: string;
  motion_type: 'orbit' | 'pan' | 'zoom' | 'reveal';
  duration?: number;
}

interface AnimatedProductOutput {
  video_url: string;
  duration: number;
  format: string;
  file_size: number;
}

export class AnimatedProductWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as AnimatedProductInput;

      // Validate inputs
      if (!input.product_image || !input.motion_type) {
        throw new Error('Missing required fields: product_image, motion_type');
      }

      const duration = input.duration || 5; // Default 5 seconds

      await this.updateProgress(25, 'Analyzing product for motion generation');
      const imageBuffer = await this.downloadImage(input.product_image);
      const base64Image = imageBuffer.toString('base64');

      await this.updateProgress(50, 'Generating product animation with RunwayML');

      // Generate video with RunwayML Gen-3 Alpha Turbo
      const videoBuffer = await this.generateProductVideo(
        base64Image,
        input.motion_type,
        duration
      );

      await this.updateProgress(75, 'Uploading product video');

      const outputPath = `${this.jobData.user_id}/${this.jobData.job_id}/animated-product.mp4`;
      const outputUrl = await this.uploadToStorage(
        videoBuffer,
        outputPath,
        'video/mp4'
      );

      const output: AnimatedProductOutput = {
        video_url: outputUrl,
        duration: duration,
        format: 'mp4',
        file_size: videoBuffer.length
      };

      await this.updateProgress(100, 'Product animation complete');

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
   * Generate product video using RunwayML Gen-3 Alpha Turbo
   */
  private async generateProductVideo(
    base64Image: string,
    motionType: string,
    duration: number
  ): Promise<Buffer> {
    const apiKey = process.env.RUNWAYML_API_KEY;
    if (!apiKey) {
      throw new Error('RUNWAYML_API_KEY not configured');
    }

    const motionPrompts: Record<string, string> = {
      orbit: 'Smooth 360-degree camera orbit around the product, professional showcase, studio lighting',
      pan: 'Slow camera pan from left to right, showcasing product details, cinematic motion',
      zoom: 'Smooth zoom in to reveal product details, professional product videography',
      reveal: 'Product reveal animation, dynamic entrance, professional presentation'
    };

    const prompt = `Create a ${motionType} motion video of this product. ${motionPrompts[motionType]}. Generate smooth, professional camera movement that showcases the product from multiple angles. Duration: ${duration} seconds.`;

    // Create generation task
    const response = await this.callAPI(
      'https://api.runwayml.com/v1/generations',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gen-3-alpha-turbo',
          prompt: prompt,
          init_image: `data:image/jpeg;base64,${base64Image}`,
          duration: duration,
          ratio: '1:1',
          watermark: false
        })
      }
    );

    if (!response.ok) {
      throw new Error(`RunwayML API error: ${response.status}`);
    }

    const generation = await response.json();

    // Poll for completion
    let result = generation;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes timeout

    while (result.status !== 'SUCCEEDED' && result.status !== 'FAILED' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollResponse = await this.callAPI(
        `https://api.runwayml.com/v1/generations/${generation.id}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      result = await pollResponse.json();
      attempts++;
    }

    if (result.status === 'FAILED' || attempts >= maxAttempts) {
      throw new Error('Video generation failed or timed out');
    }

    // Download video
    const videoUrl = result.output_url;
    if (!videoUrl) {
      throw new Error('No video output from RunwayML');
    }

    return await this.downloadImage(videoUrl);
  }
}
