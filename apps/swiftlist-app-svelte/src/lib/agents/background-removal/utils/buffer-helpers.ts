/**
 * Buffer Helper Utilities
 * Image buffer conversions and download helpers
 */

import sharp from 'sharp';

/** Timeout wrapper — rejects if the promise doesn't resolve within `ms` */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Convert Buffer to base64 data URL
 *
 * @param buffer - Image buffer
 * @param mimeType - MIME type (default: auto-detect)
 * @returns Data URL string
 */
export function bufferToDataUrl(buffer: Buffer, mimeType?: string): string {
  // Auto-detect MIME type from buffer header if not provided
  if (!mimeType) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      mimeType = 'image/png';
    } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      mimeType = 'image/jpeg';
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
      mimeType = 'image/webp';
    } else {
      mimeType = 'image/png'; // Default
    }
  }

  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Download image from URL to Buffer
 * Normalizes format to PNG with alpha channel for consistency
 *
 * @param url - Image URL (typically Replicate output URL)
 * @returns Image buffer (normalized to PNG)
 */
export async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await withTimeout(
      fetch(url),
      30_000,
      'Image download fetch'
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await withTimeout(
      response.arrayBuffer(),
      30_000,
      'Image download read body'
    );
    const rawBuffer = Buffer.from(arrayBuffer);

    // Normalize to PNG with alpha channel for consistent processing
    // This handles WebP, JPG, or any format Replicate returns
    try {
      const normalizedBuffer = await sharp(rawBuffer)
        .ensureAlpha() // Ensure alpha channel exists
        .png({
          compressionLevel: 6, // Faster than 100% quality, still lossless
          adaptiveFiltering: false // Avoid compatibility issues
        })
        .toBuffer();

      // Validate the normalized buffer can be read back
      try {
        const metadata = await sharp(normalizedBuffer).metadata();
        return normalizedBuffer;
      } catch (validationError: any) {
        // If validation fails, try returning raw buffer
        return rawBuffer;
      }
    } catch (sharpError: any) {
      // If Sharp fails, return raw buffer and let caller handle it
      return rawBuffer;
    }
  } catch (error: any) {
    throw new Error(`Image download failed: ${error.message}`);
  }
}

/**
 * Calculate image complexity using entropy
 * Higher entropy = more complex background
 *
 * @param buffer - Image buffer
 * @returns Complexity score (0-1)
 */
export async function calculateComplexity(buffer: Buffer): Promise<number> {
  try {
    const image = sharp(buffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    // Calculate histogram entropy
    const histogram = new Array(256).fill(0);
    const pixelCount = info.width * info.height * info.channels;

    // Build histogram
    for (let i = 0; i < data.length; i++) {
      histogram[data[i]]++;
    }

    // Calculate Shannon entropy
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (histogram[i] > 0) {
        const p = histogram[i] / pixelCount;
        entropy -= p * Math.log2(p);
      }
    }

    // Normalize entropy (max theoretical entropy for 8-bit = 8.0)
    const normalized = Math.min(entropy / 8.0, 1.0);

    return normalized;
  } catch (error) {
    return 0.5; // Neutral score on error
  }
}

/**
 * Detect fine details using high-frequency analysis
 * Jewelry chains, fabric texture, etc.
 *
 * @param buffer - Image buffer
 * @returns true if fine details detected
 */
export async function detectFineDetails(buffer: Buffer): Promise<boolean> {
  try {
    const image = sharp(buffer);

    // Convert to grayscale and apply high-pass filter
    const highPass = await image.greyscale().convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
    });

    // Get statistics
    const stats = await highPass.stats();

    // If high-frequency content is significant, image has fine details
    const avgChannelStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;

    const hasFineDetails = avgChannelStdDev > 30; // Empirical threshold

    return hasFineDetails;
  } catch (error) {
    return false;
  }
}

/**
 * Get image dimensions
 *
 * @param buffer - Image buffer
 * @returns { width, height }
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0
  };
}

/**
 * Ensure image has alpha channel
 * Converts RGB to RGBA if needed
 *
 * @param buffer - Image buffer
 * @returns Buffer with alpha channel
 */
export async function ensureAlphaChannel(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer);
  const { channels } = await image.metadata();

  if (!channels || channels < 4) {
    // Add alpha channel (full opacity)
    return await image.ensureAlpha().toBuffer();
  }

  return buffer; // Already has alpha
}
