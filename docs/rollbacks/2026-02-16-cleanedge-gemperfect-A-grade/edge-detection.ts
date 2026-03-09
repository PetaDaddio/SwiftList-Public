/**
 * Edge Detection Utilities
 * Advanced edge quality assessment and fringing detection
 */

import sharp from 'sharp';

/**
 * Assess edge quality using alpha channel variance analysis
 * Complements quality-metrics.ts with additional diagnostics
 *
 * @param buffer - Image buffer with alpha channel
 * @returns Detailed edge quality assessment
 */
export async function assessEdgeQuality(
  buffer: Buffer
): Promise<{ quality: number; variance: number }> {
  try {
    const image = sharp(buffer);
    const { channels } = await image.metadata();

    if (!channels || channels < 4) {
      return { quality: 0.5, variance: 0 };
    }

    // Extract alpha channel
    const alphaChannel = await image.extractChannel(3).toBuffer();
    const { data, info } = await sharp(alphaChannel).raw().toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    // Calculate variance using Sobel operator (more accurate than Laplacian)
    let totalVariance = 0;
    let edgePixelCount = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // Sobel X gradient
        const gx =
          -1 * data[idx - width - 1] +
          1 * data[idx - width + 1] +
          -2 * data[idx - 1] +
          2 * data[idx + 1] +
          -1 * data[idx + width - 1] +
          1 * data[idx + width + 1];

        // Sobel Y gradient
        const gy =
          -1 * data[idx - width - 1] +
          -2 * data[idx - width] +
          -1 * data[idx - width + 1] +
          1 * data[idx + width - 1] +
          2 * data[idx + width] +
          1 * data[idx + width + 1];

        // Gradient magnitude
        const magnitude = Math.sqrt(gx * gx + gy * gy);

        if (magnitude > 10) {
          // Threshold for edge pixels
          totalVariance += magnitude;
          edgePixelCount++;
        }
      }
    }

    const avgVariance = edgePixelCount > 0 ? totalVariance / edgePixelCount : 0;

    // Normalize (empirically, good edges have variance 50-200)
    const quality = Math.min(Math.max(avgVariance / 150, 0), 1.0);

    return { quality, variance: avgVariance };
  } catch (error) {
    return { quality: 0.5, variance: 0 };
  }
}

/**
 * Detect color fringing (chromatic aberration at edges)
 * Fringing occurs when RGB values bleed beyond the alpha boundary
 *
 * @param buffer - Image buffer with alpha channel
 * @returns { hasFringing: boolean, severity: number (0-1) }
 */
export async function detectFringing(
  buffer: Buffer
): Promise<{ hasFringing: boolean; severity: number }> {
  try {
    const image = sharp(buffer);
    const { channels } = await image.metadata();

    if (!channels || channels < 4) {
      return { hasFringing: false, severity: 0 };
    }

    // Get RGBA data
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    let fringingPixels = 0;
    let edgePixelCount = 0;

    // Check pixels at alpha edges (alpha transition zones)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4; // RGBA has 4 channels
        const alpha = data[idx + 3];

        // Check if this is an edge pixel (alpha transition)
        const leftAlpha = data[(y * width + (x - 1)) * 4 + 3];
        const rightAlpha = data[(y * width + (x + 1)) * 4 + 3];
        const topAlpha = data[((y - 1) * width + x) * 4 + 3];
        const bottomAlpha = data[((y + 1) * width + x) * 4 + 3];

        const maxAlphaDiff = Math.max(
          Math.abs(alpha - leftAlpha),
          Math.abs(alpha - rightAlpha),
          Math.abs(alpha - topAlpha),
          Math.abs(alpha - bottomAlpha)
        );

        // If alpha difference > 50, this is an edge pixel
        if (maxAlphaDiff > 50) {
          edgePixelCount++;

          // Check if RGB values are non-zero despite low alpha (fringing indicator)
          if (alpha < 100) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const brightness = (r + g + b) / 3;

            // If pixel has low alpha but high brightness, it's likely fringing
            if (brightness > 30) {
              fringingPixels++;
            }
          }
        }
      }
    }

    const severity = edgePixelCount > 0 ? fringingPixels / edgePixelCount : 0;
    const hasFringing = severity > 0.05; // >5% of edge pixels have fringing

    return { hasFringing, severity };
  } catch (error) {
    return { hasFringing: false, severity: 0 };
  }
}
