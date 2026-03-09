/**
 * Agent: General Product Specialist (CleanEdge Universal)
 *
 * Provides the same quality of color restoration and edge cleanup
 * that GemPerfect (jewelry) and ThreadLogic (clothing) provide,
 * but for ALL other product categories: toys, 3D prints, home goods,
 * collectibles, electronics, art, etc.
 *
 * The core technique is identical to GemPerfect's approach:
 * - Resize original image to match processed dimensions
 * - For every non-transparent pixel, blend 80% original + 20% processed
 * - This eliminates moiré artifacts, shadow remnants, and color shifts
 *   introduced by BRIA background removal and upscaling
 *
 * CleanEdge is SwiftList's marketing term for universally clean edges.
 * This agent ensures that promise is kept for every product type.
 *
 * v1.1: Added BRIA alpha promotion (alpha>=250 → 255) to fix semi-transparent
 *       foreground pixels. BRIA RMBG 2.0 outputs 90% of foreground at alpha
 *       250-254, causing background bleed-through on all product types.
 *
 * @author SwiftList Team
 * @version 1.1.0
 */

import sharp from 'sharp';
import type { AgentState } from '../types';
import { agentsLogger } from '$lib/utils/logger';

const log = agentsLogger.child({ pipeline: 'background-removal', agent: 'general-specialist' });


/**
 * General Product Specialist Agent
 *
 * Runs for non-jewelry, non-clothing products to ensure CleanEdge quality.
 * Same 80/20 original color blend technique as GemPerfect/ThreadLogic.
 *
 * @param state - Current pipeline state (after edge refinement)
 * @returns Updated state with color-restored image
 */
export async function generalSpecialistAgent(state: AgentState): Promise<AgentState> {

  const startTime = Date.now();

  try {
    const processedImage = sharp(state.processedImage);
    const processedMeta = await processedImage.metadata();
    const width = processedMeta.width!;
    const height = processedMeta.height!;

    // Get pixel data from the processed image
    const { data: processedData } = await processedImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Resize original image to match processed dimensions
    const { data: originalData } = await sharp(state.originalImage)
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Pixel-level color restoration
    // Process ALL non-transparent pixels, including semi-transparent edges.
    // The old approach skipped alpha < 200, which left darkened/discolored
    // edge pixels untouched — creating a visible gray halo on white backgrounds.
    let restoredCount = 0;
    let restoredEdge = 0;
    let skippedTransparent = 0;

    for (let i = 0; i < processedData.length; i += 4) {
      const alpha = processedData[i + 3];

      // Skip fully transparent pixels (background already removed)
      if (alpha < 10) {
        skippedTransparent++;
        continue;
      }

      // Get original color
      const origR = originalData[i];
      const origG = originalData[i + 1];
      const origB = originalData[i + 2];

      // Get current processed color
      const currR = processedData[i];
      const currG = processedData[i + 1];
      const currB = processedData[i + 2];

      // Graduated blend factor based on alpha confidence:
      // - Fully opaque (alpha >= 200): 80% original (proven effective)
      // - Semi-transparent (alpha 10-200): graduated 30%-80% based on alpha
      //   Lower alpha = less confidence in original pixel alignment = less original blending
      //   This prevents artifacts from misaligned original pixels at edges
      let effectiveBlend: number;
      if (alpha >= 200) {
        effectiveBlend = 0.8; // Full confidence: 80% original
      } else {
        // Scale blend from 0.3 (at alpha=10) to 0.8 (at alpha=200)
        const alphaRatio = (alpha - 10) / (200 - 10);
        effectiveBlend = 0.3 + alphaRatio * 0.5;
        restoredEdge++;
      }

      // Blend: effectiveBlend% original + (1 - effectiveBlend)% processed
      processedData[i] = Math.min(255, Math.round(
        origR * effectiveBlend + currR * (1 - effectiveBlend)
      ));
      processedData[i + 1] = Math.min(255, Math.round(
        origG * effectiveBlend + currG * (1 - effectiveBlend)
      ));
      processedData[i + 2] = Math.min(255, Math.round(
        origB * effectiveBlend + currB * (1 - effectiveBlend)
      ));

      // Preserve alpha (don't modify transparency)
      restoredCount++;
    }

    const totalPixels = width * height;

    // BRIA alpha promotion: BRIA RMBG 2.0 almost never outputs true alpha=255.
    // 90% of foreground pixels come out at alpha 250-254 — clearly intended to be
    // fully opaque. Promote these to 255 to eliminate residual background
    // bleed-through on ALL product types (not just jewelry).
    let alphaPromotionCount = 0;
    for (let i = 0; i < processedData.length; i += 4) {
      const a = processedData[i + 3];
      if (a >= 250 && a < 255) {
        processedData[i + 3] = 255;
        alphaPromotionCount++;
      }
    }

    // Convert back to PNG
    const restoredBuffer = await sharp(processedData, {
      raw: { width, height, channels: 4 }
    })
      .png({ compressionLevel: 6 })
      .toBuffer();

    const duration = Date.now() - startTime;
    log.info(
      { duration, restoredCount, restoredEdge, skippedTransparent, alphaPromotionCount, totalPixels },
      'General specialist complete'
    );

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
    log.error({ err: error.message }, 'General specialist failed');

    // On error, return state unchanged
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
