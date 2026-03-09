/**
 * WF-08: Simplify BG (White/Grey)
 *
 * Post-processor for WF-07. Creates 4 distinct image assets with clean studio shot white background plus metadata.
 * Smart fill: subject is trimmed and scaled to 65% of canvas before background compositing.
 *
 * Priority: HIGH MARGIN
 * Cost: $0.00 | Credits: 10 | Revenue: $0.50 | Margin: 89.6%
 * Tools: Sharp (smart fill), GraphicsMagick (bg composite), Gemini (Alt-text)
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';

/** Subject fills this fraction of the output canvas (0.65 = 65%) */
const SUBJECT_FILL_RATIO = 0.65;
/** Output canvas size in pixels (square) */
const CANVAS_SIZE = 1600;

const execAsync = promisify(exec);

interface SimplifyBgInput {
  transparent_image_url: string;
}

interface SimplifyBgOutput {
  white_bg_url: string;
  grey_bg_url: string;
  shadow_variant_url: string;
  transparent_url: string;
  alt_text: string;
}

export class SimplifyBgWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as SimplifyBgInput;

      // Validate inputs
      if (!input.transparent_image_url) {
        throw new Error('Missing required field: transparent_image_url');
      }

      await this.updateProgress(20, 'Downloading transparent PNG');
      const rawBuffer = await this.downloadImage(input.transparent_image_url);

      await this.updateProgress(30, 'Smart fill: centering subject at 65% of canvas');
      const imageBuffer = await this.smartFill(rawBuffer);

      // Create temp file for processing (GraphicsMagick variants use file path)
      const tempInputPath = join(tmpdir(), `input-${Date.now()}.png`);
      await writeFile(tempInputPath, imageBuffer);

      await this.updateProgress(40, 'Generating white background variant');
      const whiteBgBuffer = await this.addBackground(tempInputPath, '#FFFFFF');

      await this.updateProgress(50, 'Generating grey background variant');
      const greyBgBuffer = await this.addBackground(tempInputPath, '#F5F5F5');

      await this.updateProgress(60, 'Generating shadow variant');
      const shadowBuffer = await this.addShadow(tempInputPath);

      await this.updateProgress(70, 'Generating alt-text with Gemini');
      const altText = await this.generateAltText(imageBuffer);

      await this.updateProgress(80, 'Uploading all variants');

      // Upload all variants
      const basePath = `${this.jobData.user_id}/${this.jobData.job_id}`;

      const [whiteBgUrl, greyBgUrl, shadowUrl] = await Promise.all([
        this.uploadToStorage(whiteBgBuffer, `${basePath}/white-bg.jpg`, 'image/jpeg'),
        this.uploadToStorage(greyBgBuffer, `${basePath}/grey-bg.jpg`, 'image/jpeg'),
        this.uploadToStorage(shadowBuffer, `${basePath}/shadow.png`, 'image/png')
      ]);

      // Clean up temp file
      await unlink(tempInputPath).catch(() => {});

      const output: SimplifyBgOutput = {
        white_bg_url: whiteBgUrl,
        grey_bg_url: greyBgUrl,
        shadow_variant_url: shadowUrl,
        transparent_url: input.transparent_image_url,
        alt_text: altText
      };

      await this.updateProgress(100, 'All variants generated');

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
   * Smart fill: trim transparent padding, scale subject to SUBJECT_FILL_RATIO
   * of CANVAS_SIZE, re-center on a square transparent canvas.
   *
   * Input:  transparent PNG (any size, subject may be small in frame)
   * Output: transparent PNG, CANVAS_SIZExCANVAS_SIZE, subject at 65% fill
   */
  private async smartFill(inputBuffer: Buffer): Promise<Buffer> {
    // 1. Trim transparent border to get tight bounding box around subject
    const trimmed = await sharp(inputBuffer)
      .trim({ threshold: 10 })  // tolerance for near-transparent edge pixels
      .toBuffer();

    const { width: subjectW = 1, height: subjectH = 1 } = await sharp(trimmed).metadata();

    // 2. Calculate target subject size so longest edge = 65% of canvas
    const longestEdge = Math.max(subjectW, subjectH);
    const targetSubjectSize = Math.round(CANVAS_SIZE * SUBJECT_FILL_RATIO);
    const scale = targetSubjectSize / longestEdge;

    const scaledW = Math.round(subjectW * scale);
    const scaledH = Math.round(subjectH * scale);

    // 3. Resize subject to target size (maintain aspect ratio)
    const scaledSubject = await sharp(trimmed)
      .resize(scaledW, scaledH, { fit: 'fill' })
      .toBuffer();

    // 4. Composite centered onto a CANVAS_SIZE transparent square
    const offsetLeft = Math.round((CANVAS_SIZE - scaledW) / 2);
    const offsetTop  = Math.round((CANVAS_SIZE - scaledH) / 2);

    return sharp({
      create: {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: scaledSubject, top: offsetTop, left: offsetLeft }])
      .png()
      .toBuffer();
  }

  /**
   * Add solid background using GraphicsMagick
   */
  private async addBackground(inputPath: string, color: string): Promise<Buffer> {
    const outputPath = join(tmpdir(), `output-${Date.now()}.jpg`);

    try {
      // GraphicsMagick command to add background
      await execAsync(
        `gm convert "${inputPath}" -background "${color}" -flatten "${outputPath}"`
      );

      // Read output file
      const fs = require('fs');
      const buffer = fs.readFileSync(outputPath);

      // Clean up
      await unlink(outputPath).catch(() => {});

      return buffer;
    } catch (error: any) {
      throw new Error(`GraphicsMagick error: ${error.message}`);
    }
  }

  /**
   * Add drop shadow using GraphicsMagick
   */
  private async addShadow(inputPath: string): Promise<Buffer> {
    const outputPath = join(tmpdir(), `shadow-${Date.now()}.png`);

    try {
      // GraphicsMagick command to add shadow
      await execAsync(
        `gm convert "${inputPath}" \\( +clone -background black -shadow 60x5+0+5 \\) +swap -background none -layers merge +repage "${outputPath}"`
      );

      // Read output file
      const fs = require('fs');
      const buffer = fs.readFileSync(outputPath);

      // Clean up
      await unlink(outputPath).catch(() => {});

      return buffer;
    } catch (error: any) {
      throw new Error(`GraphicsMagick shadow error: ${error.message}`);
    }
  }

  /**
   * Generate alt-text using Gemini Vision
   */
  private async generateAltText(imageBuffer: Buffer): Promise<string> {
    const apiKey = process.env.GOOGLE_VERTEX_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_VERTEX_KEY not configured');
    }

    const base64Image = imageBuffer.toString('base64');
    const prompt = 'Generate a concise, SEO-friendly alt-text description for this product image (max 125 characters). Focus on what the product is, not the background.';

    const response = await this.callAPI(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 100,
          }
        })
      }
    );

    if (!response.ok) {
      return 'Product image'; // Fallback
    }

    const data = await response.json();
    const altText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Product image';

    return altText.trim().substring(0, 125);
  }
}
