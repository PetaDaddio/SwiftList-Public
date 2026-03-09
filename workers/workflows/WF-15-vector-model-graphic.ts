/**
 * WF-15: Vector Model (Graphic)
 *
 * Flat style generation, SVG-ready vector-style raster image
 *
 * Priority: ILLUSTRATION
 * Cost: $0.012 | Credits: 11 | Revenue: $0.55 | Margin: 97.8%
 * AI: Recraft AI V3
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface VectorGraphicInput {
  subject: string;
  style: string;
}

interface VectorGraphicOutput {
  vector_style_image_url: string;
  style_used: string;
  svg_ready: boolean;
}

export class VectorModelGraphicWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as VectorGraphicInput;

      // Validate inputs
      if (!input.subject || !input.style) {
        throw new Error('Missing required fields: subject, style');
      }

      await this.updateProgress(25, 'Preparing vector illustration prompt');

      await this.updateProgress(50, 'Generating vector-style image with Recraft AI');

      // Generate vector-style image with Recraft
      const vectorBuffer = await this.generateVectorImage(input.subject, input.style);

      await this.updateProgress(75, 'Uploading vector-style image');

      const outputPath = `${this.jobData.user_id}/${this.jobData.job_id}/vector-graphic.png`;
      const outputUrl = await this.uploadToStorage(
        vectorBuffer,
        outputPath,
        'image/png'
      );

      const output: VectorGraphicOutput = {
        vector_style_image_url: outputUrl,
        style_used: input.style,
        svg_ready: true
      };

      await this.updateProgress(100, 'Vector graphic complete');

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
   * Generate vector-style illustration using Recraft AI
   */
  private async generateVectorImage(subject: string, style: string): Promise<Buffer> {
    const apiKey = process.env.RECRAFT_API_KEY;
    if (!apiKey) {
      throw new Error('RECRAFT_API_KEY not configured');
    }

    const prompt = `Create a flat vector-style illustration of ${subject} in ${style} style. Use clean lines, solid colors, and minimal detail suitable for SVG conversion. Professional graphic design, flat design, vector art.`;

    const response = await this.callAPI(
      'https://api.recraft.ai/v1/images/generations',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          style: 'vector_illustration',
          size: '1024x1024',
          n: 1
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Recraft AI error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const imageUrl = result.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error('No image generated from Recraft AI');
    }

    return await this.downloadImage(imageUrl);
  }
}
