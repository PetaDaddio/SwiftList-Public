/**
 * Agent 6: Postprocessing
 * Final image optimization and optional enhancements
 *
 * JEWELRY NOTE (BUG-20260215-001): Jewelry images are no longer
 * downsampled in preprocess, so the upscale path should not trigger.
 * As a safety measure, we also check product type to prevent any
 * accidental lanczos3 upscaling on metallic/gemstone textures.
 */

import sharp from 'sharp';
import type { AgentState } from '../types';
import { isJewelryProduct } from '../utils/model-router';

/**
 * Postprocessing Agent
 *
 * Responsibilities:
 * 1. Upscale back to original resolution if image was downsampled in preprocess
 * 2. Optimize PNG compression (quality 95, level 6)
 * 3. Ensure image format is PNG with alpha
 * 4. Optional: Add subtle shadow for product presentation
 * 5. Update state with final buffer
 *
 * @param state - Current pipeline state
 * @returns Updated state with optimized final image
 */
export async function postProcessingAgent(state: AgentState): Promise<AgentState> {

  const startTime = Date.now();

  try {
    let imageBuffer = state.processedImage;

    // 1. Upscale back to original resolution if downsampled during preprocessing
    // The preprocess agent caps images at 2048px to prevent double-resample moiré.
    // After segmentation + specialist processing, we upscale the result back to
    // original dimensions so the final output matches the input resolution.
    //
    // JEWELRY GUARD (BUG-20260215-001): Jewelry is no longer downsampled in
    // preprocess, so this block should not trigger for jewelry. But as a safety
    // measure, we explicitly skip upscaling for jewelry products — lanczos3
    // interpolation creates crosshatch moiré on metallic/gemstone surfaces.
    const { downsampled, originalWidth, originalHeight } = state.metadata;
    const isJewelry = isJewelryProduct(state.productType || '');

    if (downsampled && originalWidth && originalHeight && !isJewelry) {
      imageBuffer = await sharp(imageBuffer)
        .resize(originalWidth, originalHeight, {
          fit: 'inside',
          kernel: 'lanczos3',
          withoutEnlargement: false // Allow upscaling back to original
        })
        .toBuffer();
    }

    const image = sharp(imageBuffer);

    // 2. Optimize PNG compression
    // Quality 95 = near-lossless, Level 6 = balanced speed/compression
    const optimized = await image
      .png({
        quality: 95,
        compressionLevel: 6,
        adaptiveFiltering: true // Better compression for photos
      })
      .toBuffer();

    // Calculate compression savings
    const originalSize = imageBuffer.length;
    const optimizedSize = optimized.length;
    const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

    // 3. Update state with final optimized buffer
    const updatedState: AgentState = {
      ...state,
      processedImage: optimized,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          postprocess: Date.now()
        }
      }
    };

    const duration = Date.now() - startTime;

    return updatedState;
  } catch (error: any) {

    // On error, return state without optimization

    return {
      ...state,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          postprocess: Date.now()
        }
      }
    };
  }
}

/**
 * Optional: Add subtle shadow for product presentation
 * (Can be enabled for specific use cases like marketplace listings)
 *
 * @param buffer - Image buffer with transparent background
 * @returns Buffer with shadow added
 */
export async function addShadow(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const { width, height } = await image.metadata();

    if (!width || !height) {
      throw new Error('Invalid image dimensions');
    }

    // Create shadow layer (blurred black oval at bottom)
    const shadowHeight = Math.round(height * 0.1); // 10% of image height
    const shadowWidth = Math.round(width * 0.6); // 60% of image width

    const shadow = await sharp({
      create: {
        width: shadowWidth,
        height: shadowHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.3 }
      }
    })
      .blur(15) // Soft shadow
      .toBuffer();

    // Position shadow at bottom center
    const shadowX = Math.round((width - shadowWidth) / 2);
    const shadowY = height - shadowHeight - 10; // 10px from bottom

    // Composite shadow under product
    const withShadow = await sharp(buffer)
      .composite([
        {
          input: shadow,
          top: shadowY,
          left: shadowX,
          blend: 'dest-over' // Place shadow under image
        }
      ])
      .toBuffer();

    return withShadow;
  } catch (error: any) {
    return buffer; // Return original on error
  }
}
