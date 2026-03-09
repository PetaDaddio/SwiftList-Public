/**
 * Agent 3: Edge Refinement
 * Improves edge quality through alpha matting and artifact removal
 *
 * JEWELRY LOGIC ENGINE:
 * - Detects high-saturation regions (gemstones, colored glass)
 * - Preserves original colors in protected regions
 * - Only applies fringing correction to edge pixels
 */

import sharp from 'sharp';
import type { AgentState } from '../types';
import { assessEdgeQuality, detectFringing } from '../utils/edge-detection';
import { detectGemstonesAndMetals, detectEdgePixels } from '../engines/jewelry-engine';

/**
 * Edge Refinement Agent
 *
 * Responsibilities:
 * 1. Calculate current edge quality
 * 2. Apply guided filter (blur) if edges need smoothing
 * 3. Detect and fix artifacts (halos, fringing)
 * 4. Update state with refined image
 *
 * @param state - Current pipeline state
 * @returns Updated state with refined edges
 */
export async function edgeRefinementAgent(state: AgentState): Promise<AgentState> {

  const startTime = Date.now();

  try {
    // 1. Assess current edge quality
    const { quality: edgeQuality, variance } = await assessEdgeQuality(state.processedImage);

    let refinedBuffer = state.processedImage;

    // Check if this is jewelry (needs special artifact handling)
    const jewelryTypes = [
      'jewelry', 'jewellery', 'ring', 'necklace', 'bracelet', 'earring', 'earrings',
      'pendant', 'brooch', 'watch', 'gemstone', 'diamond', 'pearl', 'gold', 'silver',
      'platinum', 'engagement ring', 'wedding ring', 'chain', 'bangle', 'anklet',
      'cufflink', 'cufflinks', 'tiara', 'crown'
    ];

    // Check if this is clothing (also needs moiré removal for crisp edges)
    const clothingTypes = [
      'clothing', 'clothes', 'apparel', 'fashion', 'garment', 'outfit',
      'shirt', 'blouse', 'top', 't-shirt', 'tshirt', 'sweater', 'hoodie', 'jacket',
      'coat', 'blazer', 'cardigan', 'vest', 'tank top',
      'pants', 'jeans', 'trousers', 'shorts', 'leggings', 'skirt',
      'dress', 'gown', 'romper', 'jumpsuit',
      'suit', 'tuxedo', 'uniform',
      'underwear', 'lingerie', 'swimwear', 'bikini', 'swimsuit',
      'activewear', 'sportswear', 'athleisure',
      'denim', 'leather jacket', 'knitwear', 'cashmere',
      'fabric', 'textile', 'cotton', 'silk', 'wool', 'polyester',
      'bag', 'handbag', 'purse', 'backpack', 'tote',
      'shoe', 'shoes', 'sneaker', 'boot', 'heel', 'sandal', 'loafer'
    ];

    const productTypeLower = (state.productType || '').toLowerCase();
    const isJewelryProduct = jewelryTypes.some(type => productTypeLower.includes(type));
    const isClothingProduct = clothingTypes.some(type => productTypeLower.includes(type));

    // 2. JEWELRY: Skip median/sharpen (causes moiré on metallic surfaces)
    // BUG-20260215-001: Sharp operations (blur, median, sharpen) on
    // metallic/gemstone textures create moiré patterns.
    // BUT jewelry still needs pixel-level CleanEdge edge color dilation
    // in the fringing section below — so we do NOT early-return here.
    // We just skip the median/sharpen step and let it flow through.
    if (isJewelryProduct) {
      // No median/sharpen — fall through to fringing detection below
    } else if (isClothingProduct) {

      // Step 1: Median filter to break up pixelation patterns
      // Using 3x3 for clothing (lighter touch to preserve fabric texture)
      let cleanedBuffer = await sharp(refinedBuffer)
        .median(3) // 3x3 median filter - gentler for fabric texture
        .toBuffer();

      // Step 2: Restore sharpness with fabric-appropriate settings
      cleanedBuffer = await sharp(cleanedBuffer)
        .sharpen({
          sigma: 0.8,  // Slightly tighter sharpening radius
          m1: 1.2,     // Moderate flat area sharpening
          m2: 0.5      // Lower edge sharpening (preserve soft fabric edges)
        })
        .toBuffer();

      refinedBuffer = cleanedBuffer;
    }
    // For ALL other products: Apply CleanEdge universal processing
    // This ensures consistent quality across toys, 3D prints, home goods, etc.
    else {

      // Step 1: Light median filter to clean up BRIA artifacts
      // 3x3 is gentle enough for any product type
      let cleanedBuffer = await sharp(refinedBuffer)
        .median(3)
        .toBuffer();

      // Step 2: Restore sharpness with balanced settings
      cleanedBuffer = await sharp(cleanedBuffer)
        .sharpen({
          sigma: 0.7,
          m1: 1.0,
          m2: 0.4
        })
        .toBuffer();

      // Step 3: Edge smoothing if quality is still low
      if (edgeQuality < 0.8) {
        const blurSigma = Math.max(0.5, (1 - edgeQuality) * 1.5);
        cleanedBuffer = await sharp(cleanedBuffer)
          .blur(blurSigma)
          .toBuffer();
      }

      refinedBuffer = cleanedBuffer;
    }

    // 3. Detect fringing
    const { hasFringing, severity } = await detectFringing(refinedBuffer);

    if (hasFringing) {

      const { data, info } = await sharp(refinedBuffer).raw().toBuffer({ resolveWithObject: true });

      // CONDITIONAL ROUTING: Choose fringing correction strategy based on product type
      // Use the same substring check as everywhere else (not exact match)
      const isJewelry = isJewelryProduct;

      let correctedPixels = 0;
      let skippedPixels = 0;

      if (isJewelry) {
        // ═══════════════════════════════════════════════════════════════
        // JEWELRY: CleanEdge Edge Color Dilation + Gemstone Restoration
        // ═══════════════════════════════════════════════════════════════
        // Uses the SAME proven CleanEdge edge color dilation formula as
        // the default path below, PLUS restores gemstone colors from
        // the original image. This replaces the old alphaRatio darkening
        // technique which created dark fringes on metallic edges.

        const imgWidth = info.width;
        const imgHeight = info.height;

        // Get original image pixels for gemstone color restoration
        const originalBuffer = state.originalImage;
        const { data: originalData, info: originalInfo } = await sharp(originalBuffer)
          .resize(info.width, info.height, { fit: 'fill' })
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Detect gemstones in ORIGINAL image (before background removal darkening)
        const { protectionMask, detectedGems, detectedMetals } = await detectGemstonesAndMetals(
          originalData,
          originalInfo.width,
          originalInfo.height
        );

        // CleanEdge parameters — SAME as the proven default formula
        const OPAQUE_THRESHOLD = 240;
        const EDGE_THRESHOLD = 10;
        const SEARCH_RADIUS = 4;

        let dilatedPixels = 0;
        let discardedPixels = 0;
        let preservedPixels = 0;
        let restoredPixels = 0;

        for (let y = 0; y < imgHeight; y++) {
          for (let x = 0; x < imgWidth; x++) {
            const i = (y * imgWidth + x) * 4;
            const pixelIndex = y * imgWidth + x;
            const alpha = data[i + 3];

            // Skip fully opaque and fully transparent
            if (alpha >= OPAQUE_THRESHOLD || alpha === 0) {
              // For fully opaque gemstone pixels, restore original color
              if (alpha >= OPAQUE_THRESHOLD && protectionMask[pixelIndex]) {
                data[i] = originalData[i];
                data[i + 1] = originalData[i + 1];
                data[i + 2] = originalData[i + 2];
                restoredPixels++;
              }
              continue;
            }

            // Discard very low alpha pixels (background remnants/noise)
            if (alpha < EDGE_THRESHOLD) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 0;
              discardedPixels++;
              continue;
            }

            // Semi-transparent gemstone pixel — restore original color, keep alpha
            if (protectionMask[pixelIndex] && alpha > 50) {
              data[i] = originalData[i];
              data[i + 1] = originalData[i + 1];
              data[i + 2] = originalData[i + 2];
              restoredPixels++;
              continue;
            }

            // Semi-transparent edge pixel — CleanEdge: find nearest opaque neighbor
            let bestR = data[i];
            let bestG = data[i + 1];
            let bestB = data[i + 2];
            let bestDist = Infinity;
            let found = false;

            for (let r = 1; r <= SEARCH_RADIUS && !found; r++) {
              for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                  if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                  const nx = x + dx;
                  const ny = y + dy;
                  if (nx < 0 || nx >= imgWidth || ny < 0 || ny >= imgHeight) continue;
                  const ni = (ny * imgWidth + nx) * 4;
                  const neighborAlpha = data[ni + 3];
                  if (neighborAlpha >= OPAQUE_THRESHOLD) {
                    const dist = dx * dx + dy * dy;
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestR = data[ni];
                      bestG = data[ni + 1];
                      bestB = data[ni + 2];
                      found = true;
                    }
                  }
                }
              }
            }

            if (found) {
              data[i] = bestR;
              data[i + 1] = bestG;
              data[i + 2] = bestB;
              dilatedPixels++;
            } else {
              data[i + 3] = Math.round(alpha * 0.5);
              preservedPixels++;
            }
          }
        }

        // Soft Alpha Cleanup — same as default CleanEdge
        let promotedOpaque = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha >= 200 && alpha < 255) {
            data[i + 3] = 255;
            promotedOpaque++;
          }
        }

      } else {
        // ═══════════════════════════════════════════════════════════════
        // CleanEdge DEFAULT: Edge Color Dilation + Soft Alpha Preservation
        // ═══════════════════════════════════════════════════════════════
        // Industry-standard technique used by Photoroom, rembg/PyMatting,
        // and ComfyUI-RMBG. Two-step approach:
        //
        // Step 1: EDGE COLOR DILATION — Replace RGB of semi-transparent
        //         edge pixels with the nearest fully-opaque foreground
        //         color. This removes background color contamination
        //         (the root cause of gray halos).
        //
        // Step 2: SOFT ALPHA CLEANUP — Preserve BRIA's 8-bit soft alpha
        //         matte as much as possible (it's high quality from BiRefNet).
        //         Only discard very low alpha pixels (background remnants).
        //         Keep the natural anti-aliasing gradient.
        //
        // This matches what PyMatting's estimate_foreground_ml does:
        // separate foreground color estimation from alpha estimation.

        const imgWidth = info.width;
        const imgHeight = info.height;

        // ── Step 1: Edge Color Dilation ──────────────────────────────
        // For every semi-transparent pixel, find the nearest fully-opaque
        // pixel and copy its RGB. This ensures edge pixels blend toward
        // the product color, not the background color.
        const OPAQUE_THRESHOLD = 240;   // Pixels above this are "definitely product"
        const EDGE_THRESHOLD = 10;      // Pixels below this are "definitely background"
        const SEARCH_RADIUS = 4;        // How far to search for opaque neighbor (px)

        let dilatedPixels = 0;
        let discardedPixels = 0;
        let preservedPixels = 0;

        for (let y = 0; y < imgHeight; y++) {
          for (let x = 0; x < imgWidth; x++) {
            const i = (y * imgWidth + x) * 4;
            const alpha = data[i + 3];

            // Skip fully opaque (already good) and fully transparent
            if (alpha >= OPAQUE_THRESHOLD || alpha === 0) continue;

            // Discard very low alpha pixels (background remnants/noise)
            if (alpha < EDGE_THRESHOLD) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 0;
              discardedPixels++;
              continue;
            }

            // This is a semi-transparent edge pixel — find nearest opaque neighbor
            // to get the true foreground color
            let bestR = data[i];
            let bestG = data[i + 1];
            let bestB = data[i + 2];
            let bestDist = Infinity;
            let found = false;

            // Search in expanding rings from the pixel
            for (let r = 1; r <= SEARCH_RADIUS && !found; r++) {
              for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                  // Only check pixels on the ring perimeter (not interior)
                  if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

                  const nx = x + dx;
                  const ny = y + dy;

                  // Bounds check
                  if (nx < 0 || nx >= imgWidth || ny < 0 || ny >= imgHeight) continue;

                  const ni = (ny * imgWidth + nx) * 4;
                  const neighborAlpha = data[ni + 3];

                  // Found an opaque neighbor — use its color
                  if (neighborAlpha >= OPAQUE_THRESHOLD) {
                    const dist = dx * dx + dy * dy;
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestR = data[ni];
                      bestG = data[ni + 1];
                      bestB = data[ni + 2];
                      found = true;
                    }
                  }
                }
              }
            }

            if (found) {
              // Replace RGB with nearest opaque foreground color
              // This removes background color contamination
              data[i] = bestR;
              data[i + 1] = bestG;
              data[i + 2] = bestB;
              // PRESERVE original alpha — keep BRIA's soft anti-aliasing
              dilatedPixels++;
            } else {
              // No opaque neighbor found within radius — pixel is likely
              // isolated noise or thin fringe. Reduce its alpha.
              data[i + 3] = Math.round(alpha * 0.5);
              preservedPixels++;
            }
          }
        }

        // ── Step 2: Soft Alpha Cleanup ───────────────────────────────
        // Light cleanup pass: promote nearly-opaque pixels to fully opaque
        // to eliminate subtle edge transparency that creates faint halos.
        // Keep everything else as-is to preserve BRIA's anti-aliasing.
        let promotedOpaque = 0;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];

          // Nearly opaque (200+) — promote to fully opaque
          // These are product pixels with slight transparency from BRIA
          if (alpha >= 200 && alpha < 255) {
            data[i + 3] = 255;
            promotedOpaque++;
          }
        }

        correctedPixels = dilatedPixels + discardedPixels + promotedOpaque;
      }

      refinedBuffer = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: info.channels
        }
      })
        .png({ compressionLevel: 6 }) // Convert raw pixels back to PNG format
        .toBuffer();
    }

    // 4. Update state
    const updatedState: AgentState = {
      ...state,
      processedImage: refinedBuffer,
      edgeQuality,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          refineEdges: Date.now()
        }
      }
    };

    const duration = Date.now() - startTime;

    return updatedState;
  } catch (error: any) {

    // On error, return state without refinement
    return {
      ...state,
      edgeQuality: 0.7, // Neutral default
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          refineEdges: Date.now()
        }
      }
    };
  }
}
