/**
 * Agent 1: Preprocess
 * Prepares image for segmentation with noise reduction and complexity detection
 *
 * IMPORTANT: Jewelry/metallic products skip median filter + normalize to prevent
 * moiré artifacts on reflective surfaces (BUG-20260206-001).
 * Large images (>2048px) are downsampled before segmentation to prevent
 * double-resample moiré when RMBG models internally resize.
 */

import sharp from 'sharp';
import type { AgentState } from '../types';
import { calculateComplexity, detectFineDetails } from '../utils/buffer-helpers';
import { isJewelryProduct } from '../utils/model-router';

/**
 * Maximum dimension to send to segmentation models.
 * RMBG models internally downsample to ~1024px — sending 4000px+ causes
 * double-resample artifacts (moiré) especially on metallic/reflective surfaces.
 * We downsample to 2048px max here, preserving the original for final compositing.
 */
const MAX_SEGMENTATION_DIMENSION = 2048;

/**
 * Preprocess Agent
 *
 * Responsibilities:
 * 1. Noise reduction using median filter (skipped for jewelry/metallic products)
 * 2. Contrast enhancement (skipped for jewelry/metallic products)
 * 3. Downsample large images to prevent double-resample moiré
 * 4. Detect background complexity
 * 5. Detect fine details (jewelry chains, fabric texture)
 * 6. Update state metadata with image characteristics
 *
 * @param state - Current pipeline state
 * @returns Updated state with preprocessed image
 */
export async function preprocessAgent(state: AgentState): Promise<AgentState> {

  const startTime = Date.now();

  try {
    const image = sharp(state.originalImage);
    const metadata = await image.metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;
    const isJewelry = isJewelryProduct(state.productType || '');

    let processed: Buffer;

    if (isJewelry) {
      // JEWELRY PATH: Skip median filter and normalize
      // Metallic surfaces have natural grain/reflections that median filter
      // destroys, creating interference patterns (moiré). Normalize amplifies
      // subtle artifacts on narrow-tonal-range silver/gold surfaces.
      // BUG-20260206-001: Moiré pattern on ring after background removal
      processed = state.originalImage;
    } else {
      // STANDARD PATH: Apply noise reduction + contrast enhancement
      // 1. Noise reduction (median filter)
      const denoised = await image
        .median(3) // 3x3 median filter (removes salt-and-pepper noise)
        .toBuffer();

      // 2. Contrast enhancement (normalize)
      processed = await sharp(denoised)
        .normalize() // Stretch contrast to full range
        .toBuffer();
    }

    // 3. Downsample large images to prevent double-resample moiré
    // Store original dimensions so postprocess can composite mask at full res
    //
    // JEWELRY EXCEPTION (BUG-20260215-001): Skip downsampling for jewelry entirely.
    // Metallic/gemstone textures are extremely sensitive to resize interpolation.
    // The downsample→BRIA→upscale chain creates compounding interpolation artifacts
    // that manifest as crosshatch moiré on reflective surfaces. BRIA handles
    // large images internally — let it work at full resolution for jewelry.
    let downsampled = false;
    if (!isJewelry && (originalWidth > MAX_SEGMENTATION_DIMENSION || originalHeight > MAX_SEGMENTATION_DIMENSION)) {
      processed = await sharp(processed)
        .resize(MAX_SEGMENTATION_DIMENSION, MAX_SEGMENTATION_DIMENSION, {
          fit: 'inside',       // Maintain aspect ratio, fit within bounds
          kernel: 'lanczos3',  // High-quality downsampling kernel
          withoutEnlargement: true
        })
        .toBuffer();
      downsampled = true;
    }

    // 4. Detect background complexity
    const complexity = await calculateComplexity(processed);

    // 5. Detect fine details
    const hasFineDetails = await detectFineDetails(processed);

    // 6. Update state with preprocessing results
    const updatedState: AgentState = {
      ...state,
      processedImage: processed,
      metadata: {
        ...state.metadata,
        complexity,
        hasFineDetails,
        originalWidth,
        originalHeight,
        downsampled,
        skippedMedianFilter: isJewelry,
        timestamps: {
          ...state.metadata.timestamps,
          preprocess: Date.now()
        }
      }
    };

    return updatedState;
  } catch (error: any) {

    // On error, return original state (skip preprocessing)
    return {
      ...state,
      metadata: {
        ...state.metadata,
        complexity: 0.5, // Neutral default
        hasFineDetails: false,
        timestamps: {
          ...state.metadata.timestamps,
          preprocess: Date.now()
        }
      }
    };
  }
}
