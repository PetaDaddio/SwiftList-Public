/**
 * WF-25: eBay Compliance Formatter
 *
 * Formats product images to eBay marketplace spec:
 * - 1600×1600px (eBay recommended size for best quality score)
 * - Off-white background (#F5F5F5 — eBay standard "white")
 * - Subtle ground shadow via bria/product-shadow (Replicate) with Sharp fallback
 * - JPEG quality 92 (mozjpeg)
 *
 * Priority: COMPLIANCE
 * Cost: $0.04 | Credits: 8 | Revenue: $0.40 | Margin: 90%
 * Tools: Replicate bria/product-shadow, Sharp (local fallback)
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';

// eBay spec constants
const EBAY_TARGET_SIZE = 1600;
// #F5F5F5 = eBay standard "white" (Whitesmoke, R:245 G:245 B:245).
// eBay listings render on a light-gray canvas — pure #FFFFFF creates
// a harsh blown-out look; #F5F5F5 matches the professional marketplace standard.
const EBAY_WHITE_BG = '#F5F5F5';
const EBAY_WHITE_BG_RGB = { r: 245, g: 245, b: 245 } as const;
const EBAY_JPEG_QUALITY = 92;

// Replicate bria/product-shadow model (routes through Cloudflare AI Gateway when configured)
const REPLICATE_API_URL = process.env.CLOUDFLARE_AI_GATEWAY_URL
  ? `${process.env.CLOUDFLARE_AI_GATEWAY_URL}/predictions`
  : 'https://api.replicate.com/v1/predictions';
const BRIA_SHADOW_MODEL = 'bria-ai/product-shadow:v1';

// Shadow defaults — subtle ground shadow suitable for eBay
const SHADOW_DEFAULTS = {
  shadow_type: 'regular',
  background_color: EBAY_WHITE_BG,
  shadow_color: '#000000',
  shadow_offset_x: 0,
  shadow_offset_y: 20,
  shadow_intensity: 55,   // 0–100; 55 = subtle natural look
  shadow_blur: 18,
  preserve_alpha: false,
  force_rmbg: false,
};

interface EbayComplianceInput {
  /** URL to the product image (transparent PNG preferred, JPEG accepted) */
  image_url: string;
  /**
   * Shadow intensity 0–100. Default 55 = subtle.
   * Set to 0 to skip shadow entirely.
   */
  shadow_intensity?: number;
}

interface EbayComplianceOutput {
  ebay_ready_url: string;
  shadow_url?: string;        // URL of shadow-applied image before resize (debug)
  shadow_method: 'replicate' | 'sharp-fallback' | 'none';
  width: number;
  height: number;
  aspect_ratio: string;
  background_color: string;
}

export class EbayComplianceWorkflow extends BaseWorkflow {

  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as EbayComplianceInput;

      // Validate inputs
      if (!input.image_url) {
        throw new Error('Missing required field: image_url');
      }

      const shadowIntensity = input.shadow_intensity ?? SHADOW_DEFAULTS.shadow_intensity;

      await this.updateProgress(10, 'Downloading product image');
      const imageBuffer = await this.downloadImage(input.image_url);

      let processedBuffer: Buffer;
      let shadowMethod: 'replicate' | 'sharp-fallback' | 'none' = 'none';

      if (shadowIntensity > 0) {
        // --- Attempt Replicate bria/product-shadow ---
        await this.updateProgress(30, 'Adding ground shadow via Replicate');

        const replicateKey = process.env.REPLICATE_API_TOKEN;
        if (!replicateKey) {
          throw new Error('REPLICATE_API_TOKEN not configured');
        }

        try {
          const shadowBuffer = await this.addShadowWithReplicate(
            imageBuffer,
            shadowIntensity,
            replicateKey
          );
          await this.updateProgress(65, 'Shadow applied — formatting to 1600×1600');
          processedBuffer = await this.formatForEbay(shadowBuffer);
          shadowMethod = 'replicate';
        } catch (replicateError: any) {
          // Graceful fallback to Sharp synthetic shadow
          await this.updateProgress(55, `Replicate unavailable (${replicateError.message}) — using Sharp fallback`);
          const shadowBuffer = await this.addShadowWithSharp(imageBuffer, shadowIntensity);
          await this.updateProgress(65, 'Sharp shadow applied — formatting to 1600×1600');
          processedBuffer = await this.formatForEbay(shadowBuffer);
          shadowMethod = 'sharp-fallback';
        }
      } else {
        // Shadow skipped
        await this.updateProgress(50, 'Formatting to 1600×1600 (no shadow)');
        processedBuffer = await this.formatForEbay(imageBuffer);
        shadowMethod = 'none';
      }

      await this.updateProgress(80, 'Uploading eBay-ready image');

      const basePath = `${this.jobData.user_id}/${this.jobData.job_id}`;
      const outputUrl = await this.uploadToStorage(
        processedBuffer,
        `${basePath}/ebay-ready.jpg`,
        'image/jpeg'
      );

      const output: EbayComplianceOutput = {
        ebay_ready_url: outputUrl,
        shadow_method: shadowMethod,
        width: EBAY_TARGET_SIZE,
        height: EBAY_TARGET_SIZE,
        aspect_ratio: '1:1',
        background_color: EBAY_WHITE_BG,
      };

      await this.updateProgress(100, 'eBay compliance complete');

      return {
        success: true,
        output_data: output,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Add a subtle ground shadow using Replicate bria/product-shadow.
   * Polls until the prediction completes (up to ~90s).
   */
  private async addShadowWithReplicate(
    imageBuffer: Buffer,
    shadowIntensity: number,
    apiKey: string
  ): Promise<Buffer> {
    // Write temp PNG for upload
    const tempPath = join(tmpdir(), `shadow-input-${Date.now()}.png`);
    await writeFile(tempPath, imageBuffer);

    try {
      // Upload image as base64 data URI (Replicate accepts inline images)
      const base64 = imageBuffer.toString('base64');
      const dataUri = `data:image/png;base64,${base64}`;

      // Submit prediction
      const createResponse = await this.callAPI(REPLICATE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: BRIA_SHADOW_MODEL,
          input: {
            ...SHADOW_DEFAULTS,
            image: dataUri,
            shadow_intensity: shadowIntensity,
          },
        }),
      });

      if (!createResponse.ok) {
        const errText = await createResponse.text();
        throw new Error(`Replicate submit failed: ${createResponse.status} ${errText}`);
      }

      const prediction = await createResponse.json();
      const predictionId: string = prediction.id;

      if (!predictionId) {
        throw new Error('Replicate did not return a prediction ID');
      }

      // Poll until succeeded / failed (max 30 attempts × 3s = 90s)
      const pollUrl = `${REPLICATE_API_URL}/${predictionId}`;
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const pollResponse = await this.callAPI(pollUrl, {
          method: 'GET',
          headers: { 'Authorization': `Token ${apiKey}` },
        });

        if (!pollResponse.ok) {
          throw new Error(`Replicate poll failed: ${pollResponse.status}`);
        }

        const result = await pollResponse.json();

        if (result.status === 'succeeded') {
          // Download the shadow output image
          const outputUrl: string = Array.isArray(result.output)
            ? result.output[0]
            : result.output;

          if (!outputUrl) {
            throw new Error('Replicate returned no output URL');
          }

          const outputResponse = await this.callAPI(outputUrl, { method: 'GET' });
          if (!outputResponse.ok) {
            throw new Error(`Failed to download Replicate output: ${outputResponse.status}`);
          }

          const arrayBuffer = await outputResponse.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }

        if (result.status === 'failed' || result.status === 'canceled') {
          throw new Error(`Replicate prediction ${result.status}: ${result.error ?? 'unknown'}`);
        }

        // status is 'starting' or 'processing' — keep polling
      }

      throw new Error('Replicate prediction timed out after 90 seconds');
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  }

  /**
   * Synthetic ground shadow using Sharp.
   * Extracts alpha channel, blurs it, composites a dark soft shadow
   * beneath the product on a white canvas.
   */
  private async addShadowWithSharp(
    imageBuffer: Buffer,
    shadowIntensity: number
  ): Promise<Buffer> {
    // Scale intensity 0–100 → opacity 0.0–0.6
    const shadowOpacity = (shadowIntensity / 100) * 0.6;

    const inputImage = sharp(imageBuffer);
    const { width = 800, height = 800 } = await inputImage.metadata();

    // Extract the alpha channel as a greyscale mask
    const alphaMask = await sharp(imageBuffer)
      .extractChannel('alpha')
      .blur(12)   // soft blur = shadow spread
      .toBuffer();

    // Tint the mask dark (black shadow at given opacity)
    const shadowLayer = await sharp(alphaMask)
      .grayscale()
      .modulate({ brightness: 0 })  // make it black
      .toBuffer();

    // Composite: eBay-standard canvas → shadow (offset down) → product on top
    const shadowOffsetY = Math.round(height * 0.03); // ~3% of image height
    const shadowOffsetX = 0;

    const result = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { ...EBAY_WHITE_BG_RGB, alpha: 1 },
      },
    })
      .composite([
        {
          input: shadowLayer,
          top: shadowOffsetY,
          left: shadowOffsetX,
          blend: 'multiply',
        },
        {
          input: imageBuffer,
          top: 0,
          left: 0,
          blend: 'over',
        },
      ])
      .png()
      .toBuffer();

    return result;
  }

  /**
   * Final eBay formatting:
   * - Resize to 1600×1600 (contain, no crop)
   * - Flatten onto white background
   * - Export JPEG quality 92 (mozjpeg)
   */
  private async formatForEbay(imageBuffer: Buffer): Promise<Buffer> {
    return sharp(imageBuffer)
      .resize(EBAY_TARGET_SIZE, EBAY_TARGET_SIZE, {
        fit: 'contain',
        background: { ...EBAY_WHITE_BG_RGB, alpha: 1 },
      })
      .flatten({ background: EBAY_WHITE_BG_RGB })
      .jpeg({
        quality: EBAY_JPEG_QUALITY,
        mozjpeg: true,
      })
      .toBuffer();
  }

  /**
   * Override validateInputs — custom validation handled in execute()
   */
  protected async validateInputs(): Promise<void> {
    // no-op
  }
}
