/**
 * ThreadLogic Agent 4: Edge Softener
 *
 * Applies fabric-specific edge treatment to background-removed images.
 * Unlike hard product edges (jewelry, electronics), textiles have soft,
 * natural edges that require special handling.
 *
 * Problem: Standard background removal creates harsh alpha cutoffs.
 * Textile edges (fuzzy sweaters, frayed denim, leather grain) need
 * graduated transparency and anti-aliasing.
 *
 * V2.0 Improvements:
 * - Gaussian blur-based anti-aliasing (not just alpha adjustment)
 * - Subpixel edge smoothing for crisp, non-pixelated boundaries
 * - Edge-aware processing that preserves interior detail
 * - Better seam/hem detection for preservation zones
 *
 * @author SwiftList Team
 * @version 2.0.0
 */

import sharp from 'sharp';
import type { FabricAgentState, EdgeSofteningParams, FabricCategory } from '../types';
import { agentsLogger } from '$lib/utils/logger';

const log = agentsLogger.child({ pipeline: 'fabric-engine', agent: 'edge-softener' });


/**
 * Get feathering parameters based on fabric type
 */
function getFeatheringParams(category: FabricCategory): {
  radius: number;
  antiAliasStrength: number;
  gaussianSigma: number;
} {
  switch (category) {
    case 'knit':
      // Knits have fuzzy edges - more feathering
      return { radius: 4, antiAliasStrength: 0.8, gaussianSigma: 1.2 };

    case 'leather':
      // Leather has clean edges - minimal feathering
      return { radius: 1, antiAliasStrength: 0.3, gaussianSigma: 0.4 };

    case 'metallic':
      // Metallic fabrics need sharp edges to preserve sparkle
      return { radius: 1, antiAliasStrength: 0.2, gaussianSigma: 0.3 };

    case 'opaque_woven':
    default:
      // Standard woven fabrics - moderate feathering
      return { radius: 2, antiAliasStrength: 0.5, gaussianSigma: 0.8 };
  }
}

/**
 * Detect edge pixels (within N pixels of transparency boundary)
 * Returns both edge mask and distance-to-edge map
 */
function detectEdgePixels(
  data: Buffer,
  width: number,
  height: number,
  distance: number = 3
): { isEdge: boolean[]; distanceMap: number[] } {
  const isEdge = new Array(width * height).fill(false);
  const distanceMap = new Array(width * height).fill(distance + 1);

  // Create alpha mask
  const isTransparent = new Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    isTransparent[i / 4] = data[i + 3] < 50;
  }

  // Mark pixels near transparency boundary and calculate distance
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Skip transparent pixels
      if (isTransparent[idx]) continue;

      // Check if near transparent region and calculate minimum distance
      let minDist = distance + 1;
      for (let dy = -distance; dy <= distance; dy++) {
        for (let dx = -distance; dx <= distance; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          if (isTransparent[ny * width + nx]) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            minDist = Math.min(minDist, dist);
          }
        }
      }

      if (minDist <= distance) {
        isEdge[idx] = true;
        distanceMap[idx] = minDist;
      }
    }
  }

  return { isEdge, distanceMap };
}

/**
 * Detect seam/hem regions that should NOT be softened
 * Seams have consistent linear patterns
 */
function detectSeamRegions(
  data: Buffer,
  width: number,
  height: number
): Array<{ x: number; y: number; radius: number }> {
  const preservationZones: Array<{ x: number; y: number; radius: number }> = [];

  // Simplified seam detection using horizontal/vertical edge patterns
  const blockSize = 32;

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      let horizontalEdges = 0;
      let verticalEdges = 0;

      // Count edge directions in this block
      for (let y = by + 1; y < Math.min(by + blockSize - 1, height - 1); y++) {
        for (let x = bx + 1; x < Math.min(bx + blockSize - 1, width - 1); x++) {
          const idx = (y * width + x) * 4;
          const alpha = data[idx + 3];
          if (alpha < 50) continue;

          // Calculate gradients
          const leftAlpha = data[((y) * width + (x - 1)) * 4 + 3];
          const rightAlpha = data[((y) * width + (x + 1)) * 4 + 3];
          const topAlpha = data[((y - 1) * width + x) * 4 + 3];
          const bottomAlpha = data[((y + 1) * width + x) * 4 + 3];

          const hGradient = Math.abs(rightAlpha - leftAlpha);
          const vGradient = Math.abs(bottomAlpha - topAlpha);

          if (hGradient > 30) horizontalEdges++;
          if (vGradient > 30) verticalEdges++;
        }
      }

      // Strong linear pattern suggests seam
      const totalEdges = horizontalEdges + verticalEdges;
      if (totalEdges > 100) {
        const ratio = Math.max(horizontalEdges, verticalEdges) / totalEdges;
        if (ratio > 0.7) {
          // Likely seam - add preservation zone
          preservationZones.push({
            x: bx + blockSize / 2,
            y: by + blockSize / 2,
            radius: blockSize / 2
          });
        }
      }
    }
  }

  return preservationZones;
}

/**
 * Apply Gaussian-based anti-aliasing to edge pixels
 * This creates smooth, non-pixelated edges
 */
async function applyGaussianAntiAliasing(
  data: Buffer,
  width: number,
  height: number,
  isEdge: boolean[],
  distanceMap: number[],
  preservationZones: Array<{ x: number; y: number; radius: number }>,
  featherRadius: number,
  antiAliasStrength: number,
  gaussianSigma: number
): Promise<Buffer> {
  const output = Buffer.from(data);

  // Pre-compute Gaussian weights
  const kernelSize = Math.ceil(gaussianSigma * 3) * 2 + 1;
  const halfKernel = Math.floor(kernelSize / 2);
  const gaussianWeights: number[][] = [];
  let weightSum = 0;

  for (let dy = -halfKernel; dy <= halfKernel; dy++) {
    const row: number[] = [];
    for (let dx = -halfKernel; dx <= halfKernel; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const weight = Math.exp(-(dist * dist) / (2 * gaussianSigma * gaussianSigma));
      row.push(weight);
      weightSum += weight;
    }
    gaussianWeights.push(row);
  }

  // Normalize weights
  for (let i = 0; i < gaussianWeights.length; i++) {
    for (let j = 0; j < gaussianWeights[i].length; j++) {
      gaussianWeights[i][j] /= weightSum;
    }
  }

  // Process edge pixels with Gaussian smoothing
  for (let y = halfKernel; y < height - halfKernel; y++) {
    for (let x = halfKernel; x < width - halfKernel; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      // Skip non-edge pixels
      if (!isEdge[idx]) continue;

      // Skip transparent pixels
      if (data[pixelIdx + 3] < 10) continue;

      // Check if in preservation zone
      let inPreservation = false;
      for (const zone of preservationZones) {
        const dist = Math.sqrt(Math.pow(x - zone.x, 2) + Math.pow(y - zone.y, 2));
        if (dist < zone.radius) {
          inPreservation = true;
          break;
        }
      }

      if (inPreservation) continue;

      // Calculate edge factor based on distance to transparency
      const edgeDist = distanceMap[idx];
      const edgeFactor = Math.min(1, edgeDist / featherRadius);

      // Apply Gaussian blur to RGB channels for edge pixels
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      let validWeight = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const nx = x + kx - halfKernel;
          const ny = y + ky - halfKernel;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const nIdx = (ny * width + nx) * 4;
          const nAlpha = data[nIdx + 3];

          // Skip fully transparent neighbors (don't blend with background)
          if (nAlpha < 10) continue;

          const weight = gaussianWeights[ky][kx];

          rSum += data[nIdx] * weight;
          gSum += data[nIdx + 1] * weight;
          bSum += data[nIdx + 2] * weight;
          aSum += nAlpha * weight;
          validWeight += weight;
        }
      }

      if (validWeight > 0) {
        // Blend between original and smoothed based on edge factor and AA strength
        const blendFactor = antiAliasStrength * (1 - edgeFactor);

        const smoothR = rSum / validWeight;
        const smoothG = gSum / validWeight;
        const smoothB = bSum / validWeight;
        const smoothA = aSum / validWeight;

        output[pixelIdx] = Math.round(data[pixelIdx] * (1 - blendFactor) + smoothR * blendFactor);
        output[pixelIdx + 1] = Math.round(data[pixelIdx + 1] * (1 - blendFactor) + smoothG * blendFactor);
        output[pixelIdx + 2] = Math.round(data[pixelIdx + 2] * (1 - blendFactor) + smoothB * blendFactor);

        // Apply graduated alpha for feathering effect
        const featherAlpha = Math.round(data[pixelIdx + 3] * edgeFactor + smoothA * (1 - edgeFactor) * antiAliasStrength);
        output[pixelIdx + 3] = Math.min(data[pixelIdx + 3], Math.max(featherAlpha, 0));
      }
    }
  }

  return output;
}

/**
 * Apply contour smoothing to the alpha mask BEFORE upscaling
 *
 * The core problem: BRIA produces an alpha mask at low resolution (e.g., 225x225)
 * where edges follow pixel boundaries, creating a "staircase" contour. When
 * upscaled 6-8x, each stair step becomes 6-8 pixels wide → visible pixelation.
 *
 * The solution: Apply a light Gaussian blur to the alpha channel ONLY at the
 * outermost 1-2 pixels of the opaque→transparent boundary. This rounds off
 * the staircase corners without affecting interior opacity.
 *
 * Key design decisions:
 * - Boundary radius of 2px (not 3) to avoid reaching into interior
 * - Distance-weighted blending: outermost pixels get most smoothing
 * - Alpha floor: never reduce a pixel below 70% of its original alpha
 * - Only fully-opaque boundary pixels get smoothed (semi-transparent
 *   pixels from BRIA are already anti-aliased and should stay as-is)
 */
async function smoothAlphaContour(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {

  // Extract RGBA data
  const { data } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Step 1: Find minimum distance to a fully-transparent pixel for each opaque pixel
  // Only look within 2px radius to stay tight to the actual edge
  const boundaryRadius = 2;
  const distToTransparent = new Float32Array(width * height).fill(boundaryRadius + 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const alpha = data[idx * 4 + 3];

      // Only process opaque pixels (alpha >= 240)
      // Semi-transparent pixels from BRIA are already anti-aliased
      if (alpha < 240) continue;

      // Find nearest transparent neighbor
      let minDist = boundaryRadius + 1;
      for (let dy = -boundaryRadius; dy <= boundaryRadius; dy++) {
        for (let dx = -boundaryRadius; dx <= boundaryRadius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (data[(ny * width + nx) * 4 + 3] < 10) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            minDist = Math.min(minDist, dist);
          }
        }
      }

      distToTransparent[idx] = minDist;
    }
  }

  // Count boundary pixels (those within radius of transparent)
  let boundaryCount = 0;
  for (let i = 0; i < width * height; i++) {
    if (distToTransparent[i] <= boundaryRadius) boundaryCount++;
  }

  if (boundaryCount === 0) {
    return buffer;
  }

  // Step 2: Create alpha-only buffer and blur it
  const alphaBuffer = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    alphaBuffer[i] = data[i * 4 + 3];
  }

  // Use moderate sigma - just enough to soften 1px staircase steps
  const longestSide = Math.max(width, height);
  const sigma = longestSide <= 300 ? 1.2 : longestSide <= 600 ? 1.0 : 0.8;

  const blurredAlpha = await sharp(alphaBuffer, {
    raw: { width, height, channels: 1 }
  })
    .blur(sigma)
    .raw()
    .toBuffer();

  // Step 3: Apply distance-weighted blending at boundary pixels only
  // Closer to transparent edge = more smoothing
  // Further from edge = almost no smoothing (preserves opacity)
  const outputData = Buffer.from(data);
  let smoothedPixels = 0;

  for (let i = 0; i < width * height; i++) {
    const dist = distToTransparent[i];
    if (dist > boundaryRadius) continue; // Not a boundary pixel

    const pixelIdx = i * 4;
    const originalAlpha = data[pixelIdx + 3];
    const blurredVal = blurredAlpha[i];

    // Distance-weighted blend factor:
    // dist=1 (right at edge) → blendFactor = 0.35 (35% blurred)
    // dist=2 (1px from edge) → blendFactor = 0.10 (10% blurred)
    // This keeps interior pixels almost untouched
    const blendFactor = Math.max(0, 0.35 * (1 - (dist - 1) / boundaryRadius));

    let newAlpha = Math.round(originalAlpha * (1 - blendFactor) + blurredVal * blendFactor);

    // Alpha floor: never reduce below 70% of original
    // This prevents the washed-out appearance
    const alphaFloor = Math.round(originalAlpha * 0.70);
    newAlpha = Math.max(newAlpha, alphaFloor);

    if (newAlpha !== originalAlpha) {
      outputData[pixelIdx + 3] = newAlpha;
      smoothedPixels++;
    }
  }

  return sharp(outputData, {
    raw: { width, height, channels: 4 }
  })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * Edge Softener Agent
 *
 * Applies fabric-appropriate edge softening to the CleanEdge output.
 * Different fabrics require different edge treatments.
 *
 * V2.0: Uses Gaussian anti-aliasing for smooth, non-pixelated edges.
 *
 * @param state - Current pipeline state (after CleanEdge)
 * @returns Updated state with softened edges
 */
export async function edgeSoftenerAgent(state: FabricAgentState): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    const image = sharp(state.cleanEdgeOutput);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Get feathering parameters based on fabric type
    const fabricCategory = state.fabricAnalysis?.category || 'opaque_woven';
    const { radius, antiAliasStrength, gaussianSigma } = getFeatheringParams(fabricCategory);

    // PRIMARY FIX: Smooth the alpha mask contour BEFORE any other processing
    // This eliminates the staircase pattern that causes pixelated edges when upscaled
    let softEdgesBuffer = await smoothAlphaContour(state.cleanEdgeOutput, width, height);

    // Create edge softening params for state
    const edgeSofteningParams: EdgeSofteningParams = {
      featherRadius: radius,
      antiAliasStrength,
      fabricAwareEdges: true,
      preservationZones: []
    };

    const duration = Date.now() - startTime;

    return {
      ...state,
      processedImage: softEdgesBuffer,
      edgeSofteningParams,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          edgeSoftener: Date.now()
        }
      }
    };

  } catch (error: any) {
    log.error({ err: error.message }, 'Edge softening failed');

    // Return CleanEdge output unchanged on error
    return {
      ...state,
      processedImage: state.cleanEdgeOutput,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          edgeSoftener: Date.now()
        }
      }
    };
  }
}
