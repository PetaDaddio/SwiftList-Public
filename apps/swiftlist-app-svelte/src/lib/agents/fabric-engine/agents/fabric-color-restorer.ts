/**
 * Fabric Color Restorer Agent
 *
 * Mirrors the GemPerfect jewelry-specialist.ts approach:
 * After upscaling introduces moiré/interference patterns in fabric texture,
 * this agent blends back the original image colors to eliminate those artifacts.
 *
 * How it works:
 * 1. Resize original image to match upscaled dimensions
 * 2. For every non-transparent (garment) pixel, blend:
 *    - 80% original color (eliminates moiré from Lanczos3 upscaling)
 *    - 20% processed color (preserves any beneficial processing)
 * 3. Result: clean fabric texture without interference patterns
 *
 * This is the same technique that fixed jade cabochon moiré in GemPerfect.
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

import sharp from 'sharp';
import type { FabricAgentState } from '../types';
import { agentsLogger } from '$lib/utils/logger';

const log = agentsLogger.child({ pipeline: 'fabric-engine', agent: 'fabric-color-restorer' });


/**
 * Fabric Color Restorer Agent
 *
 * Runs AFTER upscaler to eliminate moiré artifacts introduced by
 * multi-step Lanczos3 upscaling. Blends original color data back
 * into the upscaled image for every garment pixel.
 *
 * @param state - Current pipeline state (after upscaling)
 * @returns Updated state with restored fabric colors
 */
export async function fabricColorRestorerAgent(
  state: FabricAgentState
): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    // Get dimensions of the upscaled processed image
    const processedImage = sharp(state.processedImage);
    const processedMeta = await processedImage.metadata();
    const width = processedMeta.width!;
    const height = processedMeta.height!;

    // Get pixel data from the upscaled processed image
    const { data: processedData } = await processedImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Resize original image to match upscaled dimensions
    // This gives us the "true" color data at the target resolution
    const { data: originalData } = await sharp(state.originalImage)
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Pixel-level color restoration
    // For every non-transparent pixel (the garment), blend back original colors
    let restoredCount = 0;
    let skippedTransparent = 0;
    let skippedEdge = 0;

    // Blend factor: how much of the original color to use
    // 0.8 = 80% original, 20% processed (same as GemPerfect)
    const blendFactor = 0.8;

    for (let i = 0; i < processedData.length; i += 4) {
      const alpha = processedData[i + 3];

      // Skip fully transparent pixels (background)
      if (alpha < 10) {
        skippedTransparent++;
        continue;
      }

      // Skip semi-transparent edge pixels (preserve edge anti-aliasing)
      if (alpha < 200) {
        skippedEdge++;
        continue;
      }

      // Get original color (resized to match upscaled dimensions)
      const origR = originalData[i];
      const origG = originalData[i + 1];
      const origB = originalData[i + 2];

      // Get current processed color (may have moiré artifacts from Lanczos3)
      const currR = processedData[i];
      const currG = processedData[i + 1];
      const currB = processedData[i + 2];

      // Blend: 80% original + 20% processed
      // This eliminates moiré while keeping any beneficial processing
      processedData[i] = Math.min(255, Math.round(
        origR * blendFactor + currR * (1 - blendFactor)
      ));
      processedData[i + 1] = Math.min(255, Math.round(
        origG * blendFactor + currG * (1 - blendFactor)
      ));
      processedData[i + 2] = Math.min(255, Math.round(
        origB * blendFactor + currB * (1 - blendFactor)
      ));

      // Preserve original alpha (don't modify transparency)
      restoredCount++;
    }

    const totalPixels = width * height;

    // Convert back to PNG
    const restoredBuffer = await sharp(processedData, {
      raw: { width, height, channels: 4 }
    })
      .png({ compressionLevel: 6 })
      .toBuffer();

    const duration = Date.now() - startTime;

    return {
      ...state,
      processedImage: restoredBuffer,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps
        }
      }
    };

  } catch (error: any) {
    log.error({ err: error.message }, 'Fabric color restoration failed');

    // On error, return state unchanged (don't break the pipeline)
    return {
      ...state,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps
        }
      }
    };
  }
}
