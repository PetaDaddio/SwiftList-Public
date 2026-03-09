/**
 * Quality Metrics Utilities
 * Calculates quality scores for background removal results
 */

import sharp from 'sharp';
import type { QualityMetrics } from '../types';

/**
 * Calculate edge quality using Laplacian variance on alpha channel
 * Higher variance = sharper edges = better quality
 *
 * @param buffer - Image buffer with alpha channel
 * @returns Edge quality score (0-1)
 */
export async function calculateEdgeQuality(buffer: Buffer): Promise<number> {
  try {
    const image = sharp(buffer);
    const { channels } = await image.metadata();

    // Ensure image has alpha channel
    if (!channels || channels < 4) {
      return 0.5; // Neutral score
    }

    // Extract alpha channel
    const alphaChannel = await image
      .extractChannel(3) // Alpha is channel 3 (0=R, 1=G, 2=B, 3=A)
      .toBuffer();

    // Calculate pixel-to-pixel variance (Laplacian approximation)
    const { data, info } = await sharp(alphaChannel).raw().toBuffer({ resolveWithObject: true });

    let variance = 0;
    let count = 0;

    const width = info.width;
    const height = info.height;

    // Calculate variance using horizontal and vertical differences
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const center = data[idx];
        const left = data[idx - 1];
        const right = data[idx + 1];
        const top = data[idx - width];
        const bottom = data[idx + width];

        // Laplacian: |4*center - (left + right + top + bottom)|
        const laplacian = Math.abs(4 * center - (left + right + top + bottom));
        variance += laplacian;
        count++;
      }
    }

    const avgVariance = variance / count;

    // Normalize to 0-1 (empirically, good edges have variance > 50)
    const normalized = Math.min(avgVariance / 100, 1.0);

    return normalized;
  } catch (error) {
    return 0.5; // Neutral score on error
  }
}

/**
 * Assess segmentation quality by checking alpha channel clarity
 * Good segmentation has clear alpha values (near 0 or near 255)
 *
 * @param buffer - Image buffer with alpha channel
 * @returns Segmentation quality score (0-1)
 */
export async function assessSegmentation(buffer: Buffer): Promise<number> {
  try {
    const image = sharp(buffer);
    const { channels } = await image.metadata();

    if (!channels || channels < 4) {
      return 0.5;
    }

    // Extract alpha channel
    const alphaChannel = await image.extractChannel(3).toBuffer();
    const { data } = await sharp(alphaChannel).raw().toBuffer({ resolveWithObject: true });

    let clearPixels = 0;
    const totalPixels = data.length;

    // Count pixels with clear alpha (0-10 or 245-255)
    for (let i = 0; i < totalPixels; i++) {
      const alpha = data[i];
      if (alpha <= 10 || alpha >= 245) {
        clearPixels++;
      }
    }

    const clarityRatio = clearPixels / totalPixels;

    // Good segmentation should have >85% clear pixels
    return Math.min(clarityRatio / 0.85, 1.0);
  } catch (error) {
    return 0.5;
  }
}

/**
 * Detect artifacts (isolated transparent pixels, holes, halos)
 *
 * @param buffer - Image buffer with alpha channel
 * @returns Artifact-free score (0-1, higher = fewer artifacts)
 */
export async function detectArtifacts(buffer: Buffer): Promise<number> {
  try {
    const image = sharp(buffer);
    const { channels } = await image.metadata();

    if (!channels || channels < 4) {
      return 1.0; // No alpha channel = no artifacts (RGB image)
    }

    // Extract alpha channel
    const alphaChannel = await image.extractChannel(3).toBuffer();
    const { data, info } = await sharp(alphaChannel).raw().toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    let artifactCount = 0;

    // Detect isolated transparent pixels (surrounded by opaque neighbors)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const center = data[idx];

        // If pixel is transparent (< 128)
        if (center < 128) {
          // Check if all 8 neighbors are opaque (> 200)
          const neighbors = [
            data[idx - 1], // left
            data[idx + 1], // right
            data[idx - width], // top
            data[idx + width], // bottom
            data[idx - width - 1], // top-left
            data[idx - width + 1], // top-right
            data[idx + width - 1], // bottom-left
            data[idx + width + 1] // bottom-right
          ];

          const opaqueNeighbors = neighbors.filter((n) => n > 200).length;

          // If 6+ neighbors are opaque, this is likely an artifact
          if (opaqueNeighbors >= 6) {
            artifactCount++;
          }
        }
      }
    }

    const totalPixels = width * height;
    const artifactRatio = artifactCount / totalPixels;

    // Good results have <0.5% artifacts
    const score = Math.max(1.0 - artifactRatio / 0.005, 0);

    return score;
  } catch (error) {
    return 0.8; // Assume good quality on error
  }
}

/**
 * Calculate overall quality score using weighted formula
 *
 * Formula: 0.40 × Edge + 0.40 × Segmentation + 0.20 × Artifact-Free
 *
 * @param edgeQuality - Edge quality score (0-1)
 * @param segmentationQuality - Segmentation quality score (0-1)
 * @param artifactFreeScore - Artifact-free score (0-1)
 * @returns QualityMetrics object with overall score
 */
export function calculateOverallQuality(
  edgeQuality: number,
  segmentationQuality: number,
  artifactFreeScore: number
): QualityMetrics {
  const overallQuality =
    0.4 * edgeQuality + 0.4 * segmentationQuality + 0.2 * artifactFreeScore;

  return {
    edgeQuality,
    segmentationQuality,
    artifactFreeScore,
    overallQuality,
    diagnostics: {
      // Additional metrics can be added here
    }
  };
}

/**
 * Comprehensive quality assessment (combines all metrics)
 *
 * @param buffer - Image buffer with alpha channel
 * @returns Complete quality metrics
 */
export async function assessQuality(buffer: Buffer): Promise<QualityMetrics> {
  const [edgeQuality, segmentationQuality, artifactFreeScore] = await Promise.all([
    calculateEdgeQuality(buffer),
    assessSegmentation(buffer),
    detectArtifacts(buffer)
  ]);

  return calculateOverallQuality(edgeQuality, segmentationQuality, artifactFreeScore);
}
