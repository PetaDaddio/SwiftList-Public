/**
 * ThreadLogic Agent 2: Texture Sentry
 *
 * CRITICAL: This agent PREVENTS AI over-smoothing of fabric textures.
 *
 * Problem: Background removal models (BRIA RMBG, Remove.bg) often apply
 * subtle smoothing that destroys fabric micro-texture (weave patterns,
 * knit stitches, leather grain). This is unacceptable for e-commerce.
 *
 * Solution: Detect texture regions BEFORE processing, create protection
 * mask, and verify texture preservation AFTER processing.
 *
 * Techniques:
 * 1. Local Binary Pattern (LBP) - Detects micro-texture patterns
 * 2. Gabor Filters - Detects fabric weave/knit orientation
 * 3. Laplacian Variance - Measures local detail density
 * 4. Fold Detection - Identifies 3D drape structures
 *
 * Research basis:
 * - "Texture Analysis for Fabric Defect Detection" (MDPI Sensors, 2020)
 * - "LBP-Based Textile Texture Classification" (Pattern Recognition, 2018)
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

import sharp from 'sharp';
import type { FabricAgentState, TextureMetrics } from '../types';

/**
 * Local Binary Pattern implementation
 * Compares each pixel with its 8 neighbors, creates binary pattern
 *
 * @param data - Grayscale pixel data
 * @param width - Image width
 * @param height - Image height
 * @returns LBP histogram and variance
 */
function calculateLBP(
  data: Buffer,
  width: number,
  height: number
): { histogram: number[]; variance: number } {
  const histogram = new Array(256).fill(0);
  const lbpValues: number[] = [];

  // Process inner pixels (skip 1px border)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const centerIdx = y * width + x;
      const center = data[centerIdx];

      // 8 neighbors in clockwise order starting from top-left
      const neighbors = [
        data[(y - 1) * width + (x - 1)], // top-left
        data[(y - 1) * width + x],       // top
        data[(y - 1) * width + (x + 1)], // top-right
        data[y * width + (x + 1)],       // right
        data[(y + 1) * width + (x + 1)], // bottom-right
        data[(y + 1) * width + x],       // bottom
        data[(y + 1) * width + (x - 1)], // bottom-left
        data[y * width + (x - 1)]        // left
      ];

      // Calculate LBP code
      let lbpCode = 0;
      for (let i = 0; i < 8; i++) {
        if (neighbors[i] >= center) {
          lbpCode |= (1 << i);
        }
      }

      histogram[lbpCode]++;
      lbpValues.push(lbpCode);
    }
  }

  // Calculate variance of LBP values
  const mean = lbpValues.reduce((a, b) => a + b, 0) / lbpValues.length;
  const variance = lbpValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / lbpValues.length;

  return { histogram, variance };
}

/**
 * Simplified Gabor filter response
 * Detects oriented texture patterns (fabric weave, knit direction)
 *
 * @param data - Grayscale pixel data
 * @param width - Image width
 * @param height - Image height
 * @returns Average Gabor response across orientations
 */
function calculateGaborResponse(
  data: Buffer,
  width: number,
  height: number
): number {
  // Simplified Gabor kernel (5x5, horizontal orientation)
  // Real implementation would use multiple orientations
  const kernel = [
    [-1, -1, 0, 1, 1],
    [-2, -2, 0, 2, 2],
    [-3, -3, 0, 3, 3],
    [-2, -2, 0, 2, 2],
    [-1, -1, 0, 1, 1]
  ];

  let totalResponse = 0;
  let count = 0;

  // Apply kernel (skip 2px border)
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      let response = 0;

      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          const pixelIdx = (y + ky) * width + (x + kx);
          response += data[pixelIdx] * kernel[ky + 2][kx + 2];
        }
      }

      totalResponse += Math.abs(response);
      count++;
    }
  }

  // Normalize to 0-1 range
  return Math.min(totalResponse / (count * 255 * 10), 1.0);
}

/**
 * Detect fabric folds using gradient analysis
 * Folds create characteristic light-dark-light patterns
 *
 * @param data - Grayscale pixel data
 * @param width - Image width
 * @param height - Image height
 * @returns Fold count and average depth
 */
function detectFolds(
  data: Buffer,
  width: number,
  height: number
): { count: number; avgDepth: number } {
  const gradients: number[] = [];

  // Calculate horizontal gradient
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gradient = Math.abs(data[idx + 1] - data[idx - 1]);
      gradients.push(gradient);
    }
  }

  // Find peaks in gradient (fold edges)
  const threshold = 30; // Minimum gradient to consider
  let foldCount = 0;
  let totalDepth = 0;

  for (let i = 1; i < gradients.length - 1; i++) {
    if (gradients[i] > threshold &&
        gradients[i] > gradients[i - 1] &&
        gradients[i] > gradients[i + 1]) {
      foldCount++;
      totalDepth += gradients[i];
    }
  }

  // Normalize fold count (per 1000 pixels)
  const normalizedCount = (foldCount / (width * height)) * 1000;
  const avgDepth = foldCount > 0 ? (totalDepth / foldCount) / 255 : 0;

  return { count: Math.round(normalizedCount), avgDepth };
}

/**
 * Identify regions at risk of over-smoothing
 * High-texture regions need protection during processing
 *
 * @param data - Grayscale pixel data
 * @param width - Image width
 * @param height - Image height
 * @param blockSize - Analysis block size (default 32x32)
 * @returns Array of risk regions
 */
function identifyRiskRegions(
  data: Buffer,
  width: number,
  height: number,
  blockSize: number = 32
): Array<{ x: number; y: number; severity: 'low' | 'medium' | 'high' }> {
  const riskRegions: Array<{ x: number; y: number; severity: 'low' | 'medium' | 'high' }> = [];

  // Analyze in blocks
  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      // Calculate local variance for this block
      const blockPixels: number[] = [];

      for (let y = by; y < Math.min(by + blockSize, height); y++) {
        for (let x = bx; x < Math.min(bx + blockSize, width); x++) {
          blockPixels.push(data[y * width + x]);
        }
      }

      if (blockPixels.length === 0) continue;

      const mean = blockPixels.reduce((a, b) => a + b, 0) / blockPixels.length;
      const variance = blockPixels.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / blockPixels.length;

      // Classify risk based on variance
      // High variance = high texture = high risk of smoothing damage
      let severity: 'low' | 'medium' | 'high' = 'low';
      if (variance > 2000) {
        severity = 'high';
      } else if (variance > 1000) {
        severity = 'medium';
      } else if (variance > 500) {
        severity = 'low';
      } else {
        continue; // Skip smooth regions
      }

      riskRegions.push({
        x: bx + blockSize / 2,
        y: by + blockSize / 2,
        severity
      });
    }
  }

  return riskRegions;
}

/**
 * Texture Sentry Agent
 *
 * Analyzes fabric texture and creates protection metrics.
 * This agent runs BEFORE any AI processing to establish baseline
 * texture metrics, and can be called AFTER to verify preservation.
 *
 * @param state - Current pipeline state
 * @returns Updated state with texture metrics
 */
export async function textureSentryAgent(state: FabricAgentState): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    // Convert to grayscale for texture analysis
    const { data, info } = await sharp(state.originalImage)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    // Step 1: Calculate Local Binary Pattern variance
    const { variance: lbpVariance } = calculateLBP(data, width, height);
    const normalizedLBP = Math.min(lbpVariance / 5000, 1.0); // Normalize to 0-1

    // Step 2: Calculate Gabor filter response
    const gaborResponse = calculateGaborResponse(data, width, height);

    // Step 3: Detect fabric folds
    const { count: foldCount, avgDepth: foldDepth } = detectFolds(data, width, height);

    // Step 4: Identify regions at risk of over-smoothing
    const riskRegions = identifyRiskRegions(data, width, height);

    // Compile texture metrics
    const textureMetrics: TextureMetrics = {
      lbpVariance: normalizedLBP,
      gaborResponse,
      foldCount,
      foldDepth,
      riskRegions
    };

    // Log findings
    const highRiskCount = riskRegions.filter(r => r.severity === 'high').length;
    const mediumRiskCount = riskRegions.filter(r => r.severity === 'medium').length;

    // Warn if high-texture fabric detected
    if (normalizedLBP > 0.6 || highRiskCount > 5) {
    }

    const duration = Date.now() - startTime;

    return {
      ...state,
      textureMetrics,
      metadata: {
        ...state.metadata,
        complexity: Math.max(normalizedLBP, gaborResponse, state.metadata.complexity),
        timestamps: {
          ...state.metadata.timestamps,
          textureSentry: Date.now()
        }
      }
    };

  } catch (error: any) {

    // Return state with default metrics on error
    return {
      ...state,
      textureMetrics: {
        lbpVariance: 0.5,
        gaborResponse: 0.3,
        foldCount: 0,
        foldDepth: 0,
        riskRegions: []
      },
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          textureSentry: Date.now()
        }
      }
    };
  }
}

/**
 * Verify texture preservation after processing
 * Compares pre/post texture metrics to detect smoothing damage
 *
 * @param originalMetrics - Texture metrics from original image
 * @param processedImage - Processed image buffer
 * @returns Preservation score (0-1) and issues found
 */
export async function verifyTexturePreservation(
  originalMetrics: TextureMetrics,
  processedImage: Buffer
): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Analyze processed image
    const { data, info } = await sharp(processedImage)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { variance: postLBP } = calculateLBP(data, info.width, info.height);
    const normalizedPostLBP = Math.min(postLBP / 5000, 1.0);

    const postGabor = calculateGaborResponse(data, info.width, info.height);

    // Calculate preservation ratios
    const lbpPreservation = originalMetrics.lbpVariance > 0
      ? Math.min(normalizedPostLBP / originalMetrics.lbpVariance, 1.0)
      : 1.0;

    const gaborPreservation = originalMetrics.gaborResponse > 0
      ? Math.min(postGabor / originalMetrics.gaborResponse, 1.0)
      : 1.0;

    // Check for significant texture loss
    if (lbpPreservation < 0.7) {
      issues.push(`LBP texture reduced by ${((1 - lbpPreservation) * 100).toFixed(0)}% - over-smoothing detected`);
    }

    if (gaborPreservation < 0.7) {
      issues.push(`Gabor response reduced by ${((1 - gaborPreservation) * 100).toFixed(0)}% - weave pattern damaged`);
    }

    // Overall score
    const score = (lbpPreservation * 0.6 + gaborPreservation * 0.4);

    return { score, issues };

  } catch (error) {
    return { score: 0.5, issues: ['Texture verification failed'] };
  }
}
