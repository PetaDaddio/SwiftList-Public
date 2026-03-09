/**
 * WF-16: Create SVG from Image
 *
 * Raster to vector trace conversion for scalable graphics
 *
 * Priority: VECTORIZATION
 * Cost: $0.007 | Credits: 13 | Revenue: $0.65 | Margin: 98.9%
 * Service: Vectorizer.ai
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface SVGConversionInput {
  raster_image_url: string;
  detail_level?: string;
}

interface SVGConversionOutput {
  svg_url: string;
  svg_content: string;
  vector_paths: number;
  file_size: number;
}

export class CreateSVGFromImageWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as SVGConversionInput;

      // Validate inputs
      if (!input.raster_image_url) {
        throw new Error('Missing required field: raster_image_url');
      }

      const detailLevel = input.detail_level || 'medium';

      await this.updateProgress(25, 'Downloading raster image');
      const imageBuffer = await this.downloadImage(input.raster_image_url);

      await this.updateProgress(50, 'Converting to vector with Vectorizer.ai');

      // Convert to SVG using Vectorizer.ai
      const svgContent = await this.vectorizeImage(imageBuffer, detailLevel);

      await this.updateProgress(75, 'Uploading SVG file');

      const outputPath = `${this.jobData.user_id}/${this.jobData.job_id}/vector.svg`;
      const svgBuffer = Buffer.from(svgContent, 'utf-8');

      const outputUrl = await this.uploadToStorage(
        svgBuffer,
        outputPath,
        'image/svg+xml'
      );

      // Count vector paths
      const pathCount = (svgContent.match(/<path/g) || []).length;

      const output: SVGConversionOutput = {
        svg_url: outputUrl,
        svg_content: svgContent,
        vector_paths: pathCount,
        file_size: svgBuffer.length
      };

      await this.updateProgress(100, 'SVG conversion complete');

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
   * Vectorize raster image using Vectorizer.ai
   */
  private async vectorizeImage(imageBuffer: Buffer, detailLevel: string): Promise<string> {
    const apiKey = process.env.VECTORIZER_API_KEY;
    if (!apiKey) {
      throw new Error('VECTORIZER_API_KEY not configured');
    }

    // Create form data
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'input.png');
    formData.append('mode', detailLevel);

    const response = await this.callAPI(
      'https://vectorizer.ai/api/v1/vectorize',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`
        },
        body: formData as any
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vectorizer.ai error: ${response.status} - ${errorText}`);
    }

    // Response is SVG content
    return await response.text();
  }
}
