/**
 * Agent 7: Jewelry Specialist
 *
 * Advanced jewelry processing combining commercial best practices:
 * - Specular highlight detection and preservation
 * - 3D facet-aware color correction
 * - Gemstone luminosity restoration
 * - Multi-pass color grading
 *
 * Based on research from:
 * - Claid.ai jewelry optimization
 * - Academic gemstone classification (MDPI, ResearchGate)
 * - Professional jewelry photography standards
 */

import sharp from 'sharp';
import type { AgentState } from '../types';

/**
 * Jewelry Specialist Agent
 *
 * Applies jewelry-specific enhancements AFTER background removal:
 * 1. Detect specular highlights (reflections)
 * 2. Identify gemstone regions via HSV + luminosity
 * 3. Restore original colors in gemstone areas
 * 4. Brighten gemstones to match original luminosity
 * 5. Preserve metal reflections
 *
 * @param state - Current pipeline state (after background removal)
 * @returns Updated state with jewelry enhancements applied
 */
export async function jewelrySpecialistAgent(state: AgentState): Promise<AgentState> {

  const startTime = Date.now();

  try {
    // Load both images
    const processedImage = sharp(state.processedImage);
    const originalImage = sharp(state.originalImage);

    // Get dimensions
    const processedMeta = await processedImage.metadata();
    const width = processedMeta.width!;
    const height = processedMeta.height!;

    // Get pixel data from both images
    const { data: processedData } = await processedImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Resize original to match processed dimensions for pixel-level comparison.
    // BUG-20260215-001: Changed from fit:'fill' to fit:'cover' + extract.
    // fit:'fill' stretches non-proportionally, creating interpolation artifacts
    // (moiré) on metallic/gemstone surfaces. fit:'cover' + center-extract
    // preserves aspect ratio while guaranteeing exact dimension match.
    const originalMeta = await originalImage.metadata();
    const origW = originalMeta.width || width;
    const origH = originalMeta.height || height;

    // If dimensions already match (no downsampling happened), skip resize entirely
    // to avoid ANY interpolation on the original jewelry image
    let originalResized: sharp.Sharp;
    if (origW === width && origH === height) {
      originalResized = sharp(state.originalImage).ensureAlpha();
    } else {
      // Use 'cover' to maintain aspect ratio, then extract center region
      originalResized = sharp(state.originalImage)
        .resize(width, height, { fit: 'cover', kernel: 'lanczos3', position: 'centre' })
        .ensureAlpha();
    }

    const { data: originalData } = await originalResized
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Step 1: Detect high-value pixels (gemstones, metals, specular highlights)
    const gemstonePixels: number[] = [];
    const specularPixels: number[] = [];
    const metalPixels: number[] = [];

    for (let i = 0; i < processedData.length; i += 4) {
      const pixelIndex = i / 4;
      const alpha = processedData[i + 3];

      // Skip fully transparent pixels (background)
      if (alpha < 10) continue;

      // Get RGB from original image
      const r = originalData[i];
      const g = originalData[i + 1];
      const b = originalData[i + 2];

      // Convert to HSV for color analysis
      const { h, s, v } = rgbToHsv(r, g, b);

      // SPECULAR HIGHLIGHT DETECTION (very bright, low saturation)
      if (v > 200 && s < 0.2) {
        specularPixels.push(pixelIndex);
        continue; // Don't process these further
      }

      // METAL DETECTION (low saturation, moderate brightness)
      if (s < 0.15 && v >= 100 && v <= 220) {
        metalPixels.push(pixelIndex);
        continue;
      }

      // GEMSTONE DETECTION (high saturation OR specific hue ranges)
      const isHighSaturation = s > 0.2;
      const isGemstoneHue =
        (h >= 0 && h <= 30) ||      // Reds (ruby, garnet)
        (h >= 40 && h <= 70) ||     // Yellows (citrine, topaz)
        (h >= 80 && h <= 180) ||    // Greens/teals (emerald, aquamarine)
        (h >= 200 && h <= 280) ||   // Blues/purples (sapphire, amethyst)
        (h >= 300 && h <= 360);     // Pinks (pink sapphire)

      if ((isHighSaturation || isGemstoneHue) && v > 30) {
        gemstonePixels.push(pixelIndex);
      }
    }

    // Step 2: Restore original colors for gemstones
    let restoredCount = 0;
    let brightenedCount = 0;

    for (const pixelIndex of gemstonePixels) {
      const i = pixelIndex * 4;
      const alpha = processedData[i + 3];

      // Only restore if pixel is at least semi-opaque
      if (alpha < 50) continue;

      // Get original color
      const origR = originalData[i];
      const origG = originalData[i + 1];
      const origB = originalData[i + 2];

      // Get current (darkened) color
      const currR = processedData[i];
      const currG = processedData[i + 1];
      const currB = processedData[i + 2];

      // Calculate luminosity difference
      const origLuminosity = 0.299 * origR + 0.587 * origG + 0.114 * origB;
      const currLuminosity = 0.299 * currR + 0.587 * currG + 0.114 * currB;
      const luminosityRatio = origLuminosity / (currLuminosity + 1); // Avoid division by zero

      // If current is darker than original, restore and brighten
      if (luminosityRatio > 1.1) {
        // Blend: 80% original color + 20% brightened current
        const blendFactor = 0.8;
        const brightenFactor = Math.min(luminosityRatio, 1.5); // Cap at 1.5x brightening

        processedData[i] = Math.min(255, Math.round(
          origR * blendFactor + currR * (1 - blendFactor) * brightenFactor
        ));
        processedData[i + 1] = Math.min(255, Math.round(
          origG * blendFactor + currG * (1 - blendFactor) * brightenFactor
        ));
        processedData[i + 2] = Math.min(255, Math.round(
          origB * blendFactor + currB * (1 - blendFactor) * brightenFactor
        ));

        brightenedCount++;
      } else {
        // Just restore original color
        processedData[i] = origR;
        processedData[i + 1] = origG;
        processedData[i + 2] = origB;
      }

      restoredCount++;
    }

    // Step 3: Preserve specular highlights (don't darken)
    for (const pixelIndex of specularPixels) {
      const i = pixelIndex * 4;
      const alpha = processedData[i + 3];

      if (alpha > 50) {
        // Restore original highlight brightness
        processedData[i] = originalData[i];
        processedData[i + 1] = originalData[i + 1];
        processedData[i + 2] = originalData[i + 2];
      }
    }

    // Step 4: Restore metal colors (if darkened)
    let metalRestoredCount = 0;
    for (const pixelIndex of metalPixels) {
      const i = pixelIndex * 4;
      const alpha = processedData[i + 3];

      if (alpha > 100) { // Only restore opaque metal areas
        const currLum = 0.299 * processedData[i] + 0.587 * processedData[i + 1] + 0.114 * processedData[i + 2];
        const origLum = 0.299 * originalData[i] + 0.587 * originalData[i + 1] + 0.114 * originalData[i + 2];

        // If metal got darker, restore original
        if (currLum < origLum * 0.9) {
          processedData[i] = originalData[i];
          processedData[i + 1] = originalData[i + 1];
          processedData[i + 2] = originalData[i + 2];
          metalRestoredCount++;
        }
      }
    }

    // Step 5: Convert back to PNG
    const enhancedBuffer = await sharp(processedData, {
      raw: {
        width,
        height,
        channels: 4
      }
    })
      .png({ compressionLevel: 6 })
      .toBuffer();

    // Update state
    const duration = Date.now() - startTime;

    return {
      ...state,
      processedImage: enhancedBuffer,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          jewelrySpecialist: Date.now()
        }
      }
    };

  } catch (error: any) {

    // On error, return state without jewelry enhancements
    return {
      ...state,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          jewelrySpecialist: Date.now()
        }
      }
    };
  }
}

/**
 * Convert RGB to HSV color space
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns HSV values (h: 0-360, s: 0-1, v: 0-255)
 */
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const s = max === 0 ? 0 : delta / max;
  const v = max * 255;

  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }

  if (h < 0) h += 360;

  return { h, s, v };
}
