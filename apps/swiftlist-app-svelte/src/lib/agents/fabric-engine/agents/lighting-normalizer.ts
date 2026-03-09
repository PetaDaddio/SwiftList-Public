/**
 * ThreadLogic Agent 5: Lighting Normalizer
 *
 * Mimics Photoroom "Product Beautifier" logic:
 * - Normalize lighting without losing fabric true color
 * - Lift shadows to reveal detail
 * - Recover blown highlights
 * - Maintain color accuracy (critical for e-commerce)
 *
 * Challenge: Lighting correction often shifts fabric color. A red sweater
 * must REMAIN red, not shift to orange or pink. We use color anchors from
 * the original image to prevent drift.
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

import sharp from 'sharp';
import type { FabricAgentState, LightingParams } from '../types';
import { agentsLogger } from '$lib/utils/logger';

const log = agentsLogger.child({ pipeline: 'fabric-engine', agent: 'lighting-normalizer' });


/**
 * Sample color anchor points from the original image
 * Used to prevent color drift during lighting correction
 */
async function sampleColorAnchors(
  data: Buffer,
  width: number,
  height: number,
  sampleCount: number = 20
): Promise<Array<{ x: number; y: number; originalColor: { r: number; g: number; b: number } }>> {
  const anchors: Array<{ x: number; y: number; originalColor: { r: number; g: number; b: number } }> = [];

  // Sample from a grid pattern
  const gridSize = Math.ceil(Math.sqrt(sampleCount));
  const stepX = Math.floor(width / gridSize);
  const stepY = Math.floor(height / gridSize);

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const x = Math.floor(stepX * (gx + 0.5));
      const y = Math.floor(stepY * (gy + 0.5));

      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      // Skip transparent pixels
      if (alpha < 200) continue;

      anchors.push({
        x,
        y,
        originalColor: {
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2]
        }
      });

      if (anchors.length >= sampleCount) break;
    }
    if (anchors.length >= sampleCount) break;
  }

  return anchors;
}

/**
 * Estimate white balance from image histogram
 */
function estimateWhiteBalance(
  data: Buffer,
  width: number,
  height: number
): number {
  let totalR = 0, totalG = 0, totalB = 0;
  let count = 0;

  // Sample bright, neutral pixels
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];

    if (alpha < 200) continue;

    // Look for near-neutral pixels
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // Neutral: max-min < 30, and reasonably bright
    if ((max - min) < 30 && max > 100 && max < 250) {
      totalR += r;
      totalG += g;
      totalB += b;
      count++;
    }
  }

  if (count === 0) {
    return 5500; // Default daylight
  }

  const avgR = totalR / count;
  const avgG = totalG / count;
  const avgB = totalB / count;

  // Estimate color temperature from R/B ratio
  // This is a simplified approximation
  const rbRatio = avgR / (avgB + 1);

  if (rbRatio > 1.3) return 3200;  // Warm (incandescent)
  if (rbRatio > 1.1) return 4000;  // Warm-neutral
  if (rbRatio > 0.9) return 5500;  // Daylight
  if (rbRatio > 0.7) return 7000;  // Cool
  return 8500; // Very cool (overcast/shade)
}

/**
 * Calculate shadow/highlight metrics
 */
function analyzeShadowsHighlights(
  data: Buffer
): { shadowPercent: number; highlightPercent: number } {
  let shadowPixels = 0;
  let highlightPixels = 0;
  let totalPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 200) continue;

    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    totalPixels++;

    if (luminance < 50) shadowPixels++;
    if (luminance > 230) highlightPixels++;
  }

  return {
    shadowPercent: (shadowPixels / totalPixels) * 100,
    highlightPercent: (highlightPixels / totalPixels) * 100
  };
}

/**
 * Apply lighting normalization while preserving true colors
 */
async function normalizeLighting(
  data: Buffer,
  width: number,
  height: number,
  params: LightingParams
): Promise<Buffer> {
  const output = Buffer.from(data);

  // Build color protection map from anchors
  const anchorColors = new Map<string, { r: number; g: number; b: number }>();
  for (const anchor of params.colorAnchors) {
    const key = `${Math.floor(anchor.x / 32)},${Math.floor(anchor.y / 32)}`;
    anchorColors.set(key, anchor.originalColor);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      // Skip transparent pixels
      if (alpha < 50) continue;

      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      // Shadow lifting (lift dark areas)
      if (luminance < 80) {
        const liftFactor = 1 + (params.shadowLift * (1 - luminance / 80));
        r = Math.min(255, Math.round(r * liftFactor));
        g = Math.min(255, Math.round(g * liftFactor));
        b = Math.min(255, Math.round(b * liftFactor));
      }

      // Highlight recovery (compress bright areas)
      if (luminance > 220) {
        const recoveryFactor = 1 - (params.highlightRecovery * ((luminance - 220) / 35));
        r = Math.max(0, Math.round(r * recoveryFactor + 255 * (1 - recoveryFactor)));
        g = Math.max(0, Math.round(g * recoveryFactor + 255 * (1 - recoveryFactor)));
        b = Math.max(0, Math.round(b * recoveryFactor + 255 * (1 - recoveryFactor)));
      }

      // Color anchor correction: prevent drift from original
      const blockKey = `${Math.floor(x / 32)},${Math.floor(y / 32)}`;
      const anchorColor = anchorColors.get(blockKey);

      if (anchorColor) {
        // Calculate current hue shift from anchor
        const newLum = 0.299 * r + 0.587 * g + 0.114 * b;
        const origLum = 0.299 * anchorColor.r + 0.587 * anchorColor.g + 0.114 * anchorColor.b;

        if (origLum > 30 && newLum > 30) {
          // Preserve original color ratios
          const rRatio = anchorColor.r / origLum;
          const gRatio = anchorColor.g / origLum;
          const bRatio = anchorColor.b / origLum;

          // Blend: 70% corrected luminance with original color ratios
          const blend = 0.7;
          r = Math.min(255, Math.round(r * (1 - blend) + newLum * rRatio * blend));
          g = Math.min(255, Math.round(g * (1 - blend) + newLum * gRatio * blend));
          b = Math.min(255, Math.round(b * (1 - blend) + newLum * bRatio * blend));
        }
      }

      output[idx] = r;
      output[idx + 1] = g;
      output[idx + 2] = b;
    }
  }

  return output;
}

/**
 * Lighting Normalizer Agent
 *
 * Corrects lighting while preserving fabric true colors.
 * Uses color anchors to prevent hue drift.
 *
 * @param state - Current pipeline state
 * @returns Updated state with normalized lighting
 */
export async function lightingNormalizerAgent(state: FabricAgentState): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    const image = sharp(state.processedImage);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Get RGBA data from processed image
    const { data: processedData } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Get RGBA data from original for color anchors
    const { data: originalData } = await sharp(state.originalImage)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Step 1: Sample color anchors from original
    const colorAnchors = await sampleColorAnchors(originalData, width, height, 25);

    // Step 2: Estimate current white balance
    const whiteBalance = estimateWhiteBalance(processedData, width, height);

    // Step 3: Analyze shadows/highlights
    const { shadowPercent, highlightPercent } = analyzeShadowsHighlights(processedData);

    // Calculate correction parameters
    const shadowLift = shadowPercent > 15 ? 0.3 : shadowPercent > 5 ? 0.15 : 0.05;
    const highlightRecovery = highlightPercent > 10 ? 0.3 : highlightPercent > 3 ? 0.15 : 0.05;

    // Create lighting params
    const lightingParams: LightingParams = {
      targetWhiteBalance: 5500, // Target daylight
      shadowLift,
      highlightRecovery,
      colorAnchors
    };

    // Step 4: Apply lighting normalization
    const normalizedData = await normalizeLighting(
      processedData,
      width,
      height,
      lightingParams
    );

    // Convert back to PNG
    const normalizedBuffer = await sharp(normalizedData, {
      raw: { width, height, channels: 4 }
    })
      .png({ compressionLevel: 6 })
      .toBuffer();

    const duration = Date.now() - startTime;

    return {
      ...state,
      processedImage: normalizedBuffer,
      lightingParams,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          lightingNormalizer: Date.now()
        }
      }
    };

  } catch (error: any) {
    log.error({ err: error.message }, 'Lighting normalization failed');

    return {
      ...state,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          lightingNormalizer: Date.now()
        }
      }
    };
  }
}
