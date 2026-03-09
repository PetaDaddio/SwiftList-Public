/**
 * ThreadLogic Agent: Upscaler
 *
 * High-quality upscaling for fabric/textile images using multi-step
 * Lanczos3 resampling with edge-aware anti-aliasing.
 *
 * Problem: Direct upscaling creates pixelation and moiré artifacts,
 * especially on fabric textures and print patterns.
 *
 * Solution: Multi-step upscaling with:
 * 1. Gradual 1.5x increments (prevents moiré)
 * 2. Edge-aware sharpening (preserves detail without halos)
 * 3. Adaptive processing based on fabric type
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

import sharp from 'sharp';
import type { FabricAgentState, FabricCategory } from '../types';
import { agentsLogger } from '$lib/utils/logger';

const log = agentsLogger.child({ pipeline: 'fabric-engine', agent: 'upscaler' });


/**
 * Get upscaling parameters based on fabric type
 */
function getUpscaleParams(category: FabricCategory): {
  sharpenSigma: number;
  sharpenM1: number;
  sharpenM2: number;
  medianKernel: number | null;
} {
  switch (category) {
    case 'knit':
      // Knits have texture that benefits from light sharpening
      return {
        sharpenSigma: 0.6,
        sharpenM1: 1.0,
        sharpenM2: 0.3,
        medianKernel: null // Don't median filter knits - preserves yarn texture
      };

    case 'leather':
      // Leather has grain that needs preservation
      return {
        sharpenSigma: 0.8,
        sharpenM1: 1.2,
        sharpenM2: 0.4,
        medianKernel: null
      };

    case 'metallic':
      // Metallic fabrics (sequins) need sharp edges
      return {
        sharpenSigma: 1.0,
        sharpenM1: 1.5,
        sharpenM2: 0.6,
        medianKernel: 3 // Light median to reduce shimmer artifacts
      };

    case 'opaque_woven':
    default:
      // Standard wovens (denim, cotton) - balanced approach
      return {
        sharpenSigma: 0.7,
        sharpenM1: 1.1,
        sharpenM2: 0.4,
        medianKernel: null
      };
  }
}

/**
 * Apply post-upscale alpha channel smoothing
 *
 * After multi-step Lanczos3 upscaling, the alpha channel may still have
 * residual staircase artifacts. This applies a light alpha blur to clean
 * them up without affecting the interior of the product.
 *
 * Key: Only smooth the alpha channel at the edge boundary, keeping
 * interior pixels fully opaque.
 */
async function applyEdgeAntiAliasing(
  imageBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {

  // Extract RGBA data
  const { data } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create alpha-only buffer
  const alphaBuffer = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    alphaBuffer[i] = data[i * 4 + 3];
  }

  // Apply 1px Gaussian blur to alpha channel (light touch at high-res)
  const blurredAlpha = await sharp(alphaBuffer, {
    raw: { width, height, channels: 1 }
  })
    .blur(1.0) // 1px blur - subtle at high resolution
    .raw()
    .toBuffer();

  // Apply light blending at edge pixels only
  // Conservative approach: blend slightly, never drop alpha below 80% of original
  let smoothed = 0;
  for (let i = 0; i < width * height; i++) {
    const originalAlpha = data[i * 4 + 3];
    const blurred = blurredAlpha[i];

    // Semi-transparent edge pixel: light blend to smooth transitions
    if (originalAlpha > 10 && originalAlpha < 245) {
      // 70% original + 30% blurred (conservative, preserves most of BRIA's intent)
      const newAlpha = Math.round(originalAlpha * 0.7 + blurred * 0.3);
      // Never reduce below 80% of original alpha
      data[i * 4 + 3] = Math.max(newAlpha, Math.round(originalAlpha * 0.8));
      smoothed++;
    }
    // Opaque pixel near edge: very light smoothing
    else if (originalAlpha >= 245 && blurred < 240) {
      // 85% original + 15% blurred (barely perceptible per-pixel)
      data[i * 4 + 3] = Math.round(originalAlpha * 0.85 + blurred * 0.15);
      smoothed++;
    }
  }

  return sharp(data, {
    raw: { width, height, channels: 4 }
  })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * Upscaler Agent
 *
 * Applies high-quality upscaling with fabric-aware processing.
 * Uses multi-step Lanczos3 for gradual upscaling to prevent artifacts.
 *
 * @param state - Current pipeline state
 * @param targetScale - Target scale factor (default: auto based on input size)
 * @returns Updated state with upscaled image
 */
export async function upscalerAgent(
  state: FabricAgentState,
  targetScale?: number
): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    const image = sharp(state.processedImage);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Determine target scale
    // Default: scale up small images to at least 2000px on longest side
    const longestSide = Math.max(width, height);
    const minTargetSize = 2000;

    let scale = targetScale;
    if (!scale) {
      if (longestSide < minTargetSize) {
        scale = minTargetSize / longestSide;
      } else {
        scale = 1; // Already large enough
      }
    }

    // Don't upscale if already at target size
    if (scale <= 1.05) {
      return {
        ...state,
        metadata: {
          ...state.metadata,
          timestamps: {
            ...state.metadata.timestamps,
            upscaler: Date.now()
          }
        }
      };
    }

    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    // Get fabric-specific parameters
    const fabricCategory = state.fabricAnalysis?.category || 'opaque_woven';
    const params = getUpscaleParams(fabricCategory);

    let currentBuffer = state.processedImage;
    let currentWidth = width;
    let currentHeight = height;

    // Multi-step upscaling: scale in 1.5x increments
    const stepFactor = 1.5;
    let stepCount = 0;

    while (currentWidth * stepFactor <= targetWidth && currentHeight * stepFactor <= targetHeight) {
      const newWidth = Math.round(currentWidth * stepFactor);
      const newHeight = Math.round(currentHeight * stepFactor);

      currentBuffer = await sharp(currentBuffer)
        .resize(newWidth, newHeight, {
          kernel: 'lanczos3',
          fit: 'fill'
        })
        .toBuffer();

      currentWidth = newWidth;
      currentHeight = newHeight;
      stepCount++;

    }

    // Final resize to exact target dimensions
    if (currentWidth !== targetWidth || currentHeight !== targetHeight) {
      currentBuffer = await sharp(currentBuffer)
        .resize(targetWidth, targetHeight, {
          kernel: 'lanczos3',
          fit: 'fill'
        })
        .toBuffer();

    }

    // Apply fabric-specific sharpening

    let sharpened = await sharp(currentBuffer)
      .sharpen({
        sigma: params.sharpenSigma,
        m1: params.sharpenM1,
        m2: params.sharpenM2
      })
      .toBuffer();

    // Apply optional median filter (for metallic fabrics)
    if (params.medianKernel) {
      sharpened = await sharp(sharpened)
        .median(params.medianKernel)
        .toBuffer();
    }

    // Apply edge anti-aliasing
    const finalBuffer = await applyEdgeAntiAliasing(sharpened, targetWidth, targetHeight);

    const duration = Date.now() - startTime;

    return {
      ...state,
      processedImage: finalBuffer,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          upscaler: Date.now()
        }
      }
    };

  } catch (error: any) {
    log.error({ err: error.message }, 'Upscaling failed');

    // Return unchanged on error
    return {
      ...state,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          upscaler: Date.now()
        }
      }
    };
  }
}

/**
 * Apply fabric-specific post-processing polish
 * Similar to jewelry moiré polish but tuned for textiles
 */
export async function fabricPolishAgent(state: FabricAgentState): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    const image = sharp(state.processedImage);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Get fabric category
    const fabricCategory = state.fabricAnalysis?.category || 'opaque_woven';

    // Different polish based on fabric type
    let polishedBuffer: Buffer;

    switch (fabricCategory) {
      case 'knit':
        // Knits: Very light polish to preserve yarn texture
        polishedBuffer = await sharp(state.processedImage)
          .sharpen({
            sigma: 0.4,
            m1: 0.8,
            m2: 0.2
          })
          .toBuffer();
        break;

      case 'leather':
        // Leather: Enhance grain slightly
        polishedBuffer = await sharp(state.processedImage)
          .sharpen({
            sigma: 0.6,
            m1: 1.0,
            m2: 0.3
          })
          .modulate({ brightness: 1.02 }) // Very slight brightness boost
          .toBuffer();
        break;

      case 'metallic':
        // Metallic: Balance sparkle without artifacts
        polishedBuffer = await sharp(state.processedImage)
          .median(3) // Remove any shimmer artifacts
          .sharpen({
            sigma: 0.8,
            m1: 1.2,
            m2: 0.5
          })
          .toBuffer();
        break;

      case 'opaque_woven':
      default:
        // Standard wovens: Balanced polish
        polishedBuffer = await sharp(state.processedImage)
          .sharpen({
            sigma: 0.5,
            m1: 0.9,
            m2: 0.3
          })
          .toBuffer();
        break;
    }

    // Edge smoothing is now handled by edge-softener (pre-upscale contour smoothing)
    // and applyEdgeAntiAliasing (post-upscale). No additional edge processing needed here.

    const duration = Date.now() - startTime;

    return {
      ...state,
      processedImage: polishedBuffer,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          fabricPolish: Date.now()
        }
      }
    };

  } catch (error: any) {
    log.error({ err: error.message }, 'Fabric polish failed');

    return {
      ...state,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          fabricPolish: Date.now()
        }
      }
    };
  }
}
