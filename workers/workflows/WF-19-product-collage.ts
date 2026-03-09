/**
 * WF-19: Product Collage
 *
 * Smart grid layout of 3-5 images for multi-product showcase
 *
 * Priority: MULTI-ASSET
 * Cost: $0.005 | Credits: 20 | Revenue: $1.00 | Margin: 94.8%
 * Tools: Sharp.js (Local Node.js)
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';
import sharp from 'sharp';

interface CollageInput {
  image_urls: string[];
  layout?: string;
}

interface CollageOutput {
  collage_url: string;
  layout_used: string;
  image_count: number;
  dimensions: { width: number; height: number };
}

export class ProductCollageWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as CollageInput;

      // Validate inputs
      if (!input.image_urls || input.image_urls.length < 3 || input.image_urls.length > 5) {
        throw new Error('image_urls must contain 3-5 images');
      }

      await this.updateProgress(25, 'Downloading all images');

      // Download all images
      const imageBuffers = await Promise.all(
        input.image_urls.map(url => this.downloadImage(url))
      );

      await this.updateProgress(50, 'Calculating optimal grid layout');

      // Calculate layout
      const layout = this.calculateLayout(imageBuffers.length);

      await this.updateProgress(75, 'Compositing collage');

      // Create collage using Sharp.js
      const collageBuffer = await this.createCollage(imageBuffers, layout);

      const outputPath = `${this.jobData.user_id}/${this.jobData.job_id}/collage.jpg`;
      const outputUrl = await this.uploadToStorage(
        collageBuffer,
        outputPath,
        'image/jpeg'
      );

      const output: CollageOutput = {
        collage_url: outputUrl,
        layout_used: layout.type,
        image_count: imageBuffers.length,
        dimensions: { width: layout.width, height: layout.height }
      };

      await this.updateProgress(100, 'Collage complete');

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
   * Calculate optimal layout based on image count
   */
  private calculateLayout(count: number): any {
    const layouts: Record<number, any> = {
      3: { type: '1x3', width: 1500, height: 500, rows: 1, cols: 3 },
      4: { type: '2x2', width: 1000, height: 1000, rows: 2, cols: 2 },
      5: { type: '2x3', width: 1500, height: 1000, rows: 2, cols: 3 }
    };

    return layouts[count] || layouts[4];
  }

  /**
   * Create collage using Sharp.js
   */
  private async createCollage(images: Buffer[], layout: any): Promise<Buffer> {
    const cellWidth = Math.floor(layout.width / layout.cols);
    const cellHeight = Math.floor(layout.height / layout.rows);

    // Resize all images to cell size
    const resizedImages = await Promise.all(
      images.map(img =>
        sharp(img)
          .resize(cellWidth, cellHeight, { fit: 'cover' })
          .toBuffer()
      )
    );

    // Create base canvas
    const canvas = sharp({
      create: {
        width: layout.width,
        height: layout.height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    });

    // Composite images onto canvas
    const composites = resizedImages.map((img, idx) => {
      const row = Math.floor(idx / layout.cols);
      const col = idx % layout.cols;

      return {
        input: img,
        left: col * cellWidth,
        top: row * cellHeight
      };
    });

    return await canvas
      .composite(composites)
      .jpeg({ quality: 90 })
      .toBuffer();
  }
}
