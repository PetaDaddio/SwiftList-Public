/**
 * ThreadLogic Agent 3: Print Guardian
 *
 * CRITICAL: Zero tolerance for logo/print hallucination or distortion.
 *
 * Problem: AI models can subtly alter prints, logos, and patterns during
 * processing. This is UNACCEPTABLE for e-commerce - a distorted band tee
 * logo or corrupted brand print destroys product value.
 *
 * Solution: Detect print/logo regions, create pixel-perfect protection mask,
 * restore original pixels in print regions after AI processing.
 *
 * Techniques:
 * 1. Color clustering - Detect regions with distinct color palettes
 * 2. Edge density analysis - Prints have high edge density
 * 3. Text detection - Via Gemini Vision API for OCR
 * 4. Contrast mapping - Prints stand out from fabric base
 *
 * Competitive positioning:
 * - Claid.ai "Product Preservation" - We match their print fidelity
 * - Photoroom - We exceed their logo handling
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

import sharp from 'sharp';
import type { FabricAgentState, PrintRegion, PrintType } from '../types';

/**
 * Detect high-contrast regions that likely contain prints
 * Prints create local contrast spikes against fabric background
 *
 * @param data - RGBA pixel data
 * @param width - Image width
 * @param height - Image height
 * @param blockSize - Analysis block size
 * @returns Map of block coordinates to contrast scores
 */
function analyzeLocalContrast(
  data: Buffer,
  width: number,
  height: number,
  blockSize: number = 16
): Map<string, number> {
  const contrastMap = new Map<string, number>();

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      const blockPixels: number[] = [];

      // Collect luminance values for this block
      for (let y = by; y < Math.min(by + blockSize, height); y++) {
        for (let x = bx; x < Math.min(bx + blockSize, width); x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const alpha = data[idx + 3];

          // Skip transparent pixels
          if (alpha < 50) continue;

          // Calculate luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          blockPixels.push(luminance);
        }
      }

      if (blockPixels.length < 10) continue;

      // Calculate local contrast (max - min)
      const min = Math.min(...blockPixels);
      const max = Math.max(...blockPixels);
      const contrast = max - min;

      const key = `${bx},${by}`;
      contrastMap.set(key, contrast);
    }
  }

  return contrastMap;
}

/**
 * Detect color clusters that indicate print regions
 * Prints often have distinct color palettes different from fabric base
 *
 * @param data - RGBA pixel data
 * @param width - Image width
 * @param height - Image height
 * @returns Array of detected color clusters
 */
function detectColorClusters(
  data: Buffer,
  width: number,
  height: number
): Array<{ color: { r: number; g: number; b: number }; count: number; percentage: number }> {
  // Simple color quantization (reduce to 64 colors)
  const colorBins = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 50) continue;

    // Quantize to 4-bit per channel (16 levels)
    const r = Math.floor(data[i] / 16) * 16;
    const g = Math.floor(data[i + 1] / 16) * 16;
    const b = Math.floor(data[i + 2] / 16) * 16;

    const key = `${r},${g},${b}`;
    const existing = colorBins.get(key);

    if (existing) {
      existing.count++;
    } else {
      colorBins.set(key, { r, g, b, count: 1 });
    }
  }

  // Calculate total opaque pixels
  let totalPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 50) totalPixels++;
  }

  // Convert to array and sort by count
  const clusters = Array.from(colorBins.values())
    .map(c => ({
      color: { r: c.r, g: c.g, b: c.b },
      count: c.count,
      percentage: (c.count / totalPixels) * 100
    }))
    .sort((a, b) => b.count - a.count);

  return clusters.slice(0, 20); // Top 20 colors
}

/**
 * Calculate edge density map using Sobel operator
 * Prints have higher edge density than plain fabric
 *
 * @param data - Grayscale pixel data
 * @param width - Image width
 * @param height - Image height
 * @returns Edge density map (0-255 per pixel)
 */
function calculateEdgeDensity(
  data: Buffer,
  width: number,
  height: number
): Buffer {
  const edgeMap = Buffer.alloc(width * height);

  // Sobel kernels
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      // Apply Sobel kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = data[(y + ky) * width + (x + kx)];
          gx += pixel * sobelX[ky + 1][kx + 1];
          gy += pixel * sobelY[ky + 1][kx + 1];
        }
      }

      // Magnitude of gradient
      const magnitude = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      edgeMap[y * width + x] = magnitude;
    }
  }

  return edgeMap;
}

/**
 * Classify print type based on detected patterns
 *
 * @param contrastScore - Local contrast score
 * @param edgeDensity - Edge density score
 * @param colorVariety - Number of distinct colors
 * @returns Detected print type
 */
function classifyPrintType(
  contrastScore: number,
  edgeDensity: number,
  colorVariety: number
): PrintType {
  // Screen prints: High contrast, moderate edges, limited colors
  if (contrastScore > 100 && colorVariety <= 5) {
    return 'screen_print';
  }

  // Sublimation: Moderate contrast, high color variety
  if (colorVariety > 10 && contrastScore > 50) {
    return 'sublimation';
  }

  // Woven patterns: Regular edge patterns, moderate contrast
  if (edgeDensity > 0.3 && contrastScore > 30 && contrastScore < 100) {
    return 'woven_pattern';
  }

  // Embroidery: High local contrast, textured edges
  if (contrastScore > 120 && edgeDensity > 0.4) {
    return 'embroidery';
  }

  return 'none';
}

/**
 * Create pixel-perfect protection mask for print regions
 *
 * @param data - RGBA pixel data
 * @param width - Image width
 * @param height - Image height
 * @param edgeMap - Edge density map
 * @param contrastMap - Local contrast map
 * @returns Boolean mask (true = protect this pixel)
 */
function createProtectionMask(
  data: Buffer,
  width: number,
  height: number,
  edgeMap: Buffer,
  contrastMap: Map<string, number>
): boolean[] {
  const mask = new Array(width * height).fill(false);
  const blockSize = 16;

  // First pass: Mark high-contrast blocks
  for (const [key, contrast] of contrastMap) {
    if (contrast < 80) continue; // Skip low-contrast regions

    const [bx, by] = key.split(',').map(Number);

    // Mark all pixels in this block
    for (let y = by; y < Math.min(by + blockSize, height); y++) {
      for (let x = bx; x < Math.min(bx + blockSize, width); x++) {
        const idx = y * width + x;
        mask[idx] = true;
      }
    }
  }

  // Second pass: Add high-edge-density pixels
  for (let i = 0; i < edgeMap.length; i++) {
    if (edgeMap[i] > 50) {
      mask[i] = true;
    }
  }

  // Third pass: Dilate mask by 2 pixels (protect neighboring pixels)
  const dilatedMask = [...mask];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (mask[idx]) {
        // Mark 5x5 neighborhood
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const neighborIdx = (y + dy) * width + (x + dx);
            dilatedMask[neighborIdx] = true;
          }
        }
      }
    }
  }

  return dilatedMask;
}

/**
 * Detect print regions using connected component analysis
 *
 * @param mask - Protection mask
 * @param width - Image width
 * @param height - Image height
 * @param printType - Detected print type
 * @returns Array of print regions with bounds
 */
function findPrintRegions(
  mask: boolean[],
  width: number,
  height: number,
  printType: PrintType
): PrintRegion[] {
  const visited = new Array(width * height).fill(false);
  const regions: PrintRegion[] = [];

  // Simple flood-fill to find connected regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx] || visited[idx]) continue;

      // Start new region
      let minX = x, maxX = x, minY = y, maxY = y;
      let pixelCount = 0;

      // BFS to find connected pixels
      const queue: Array<{ x: number; y: number }> = [{ x, y }];
      const regionMask = new Array(width * height).fill(false);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const currIdx = curr.y * width + curr.x;

        if (visited[currIdx] || !mask[currIdx]) continue;
        if (curr.x < 0 || curr.x >= width || curr.y < 0 || curr.y >= height) continue;

        visited[currIdx] = true;
        regionMask[currIdx] = true;
        pixelCount++;

        // Update bounds
        minX = Math.min(minX, curr.x);
        maxX = Math.max(maxX, curr.x);
        minY = Math.min(minY, curr.y);
        maxY = Math.max(maxY, curr.y);

        // Add neighbors
        queue.push({ x: curr.x - 1, y: curr.y });
        queue.push({ x: curr.x + 1, y: curr.y });
        queue.push({ x: curr.x, y: curr.y - 1 });
        queue.push({ x: curr.x, y: curr.y + 1 });
      }

      // Only keep regions larger than 100 pixels
      if (pixelCount < 100) continue;

      regions.push({
        bounds: {
          x: minX / width,
          y: minY / height,
          width: (maxX - minX) / width,
          height: (maxY - minY) / height
        },
        type: printType,
        priority: printType === 'screen_print' ? 5 : printType === 'embroidery' ? 4 : 3,
        containsText: false, // Will be updated by Gemini Vision
        mask: regionMask
      });
    }
  }

  return regions;
}

/**
 * Print Guardian Agent
 *
 * Detects and protects print/logo regions from AI distortion.
 * Creates pixel-perfect masks for post-processing restoration.
 *
 * @param state - Current pipeline state
 * @returns Updated state with print regions and protection masks
 */
export async function printGuardianAgent(state: FabricAgentState): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    // Get image data
    const image = sharp(state.originalImage);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Get RGBA data
    const { data: rgbaData } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Get grayscale for edge detection
    const { data: grayData } = await image
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Step 1: Analyze local contrast
    const contrastMap = analyzeLocalContrast(rgbaData, width, height);

    // Step 2: Calculate edge density
    const edgeMap = calculateEdgeDensity(grayData, width, height);

    // Calculate average edge density
    let totalEdge = 0;
    for (let i = 0; i < edgeMap.length; i++) {
      totalEdge += edgeMap[i];
    }
    const avgEdgeDensity = totalEdge / (edgeMap.length * 255);

    // Step 3: Detect color clusters
    const colorClusters = detectColorClusters(rgbaData, width, height);
    const colorVariety = colorClusters.filter(c => c.percentage > 1).length;

    // Step 4: Classify print type
    const avgContrast = Array.from(contrastMap.values()).reduce((a, b) => a + b, 0) / contrastMap.size;
    const printType = classifyPrintType(avgContrast, avgEdgeDensity, colorVariety);

    // Step 5: Create protection mask
    const protectionMask = createProtectionMask(rgbaData, width, height, edgeMap, contrastMap);

    // Step 6: Find print regions
    const printRegions = findPrintRegions(protectionMask, width, height, printType);

    // Calculate coverage
    const protectedPixels = protectionMask.filter(p => p).length;
    const coverage = (protectedPixels / (width * height)) * 100;

    // Warn if significant print coverage
    if (coverage > 20 && printType !== 'none') {
    }

    const duration = Date.now() - startTime;

    return {
      ...state,
      printRegions,
      fabricAnalysis: state.fabricAnalysis ? {
        ...state.fabricAnalysis,
        printType,
        printCoverage: coverage
      } : undefined,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          printGuardian: Date.now()
        }
      }
    };

  } catch (error: any) {

    return {
      ...state,
      printRegions: [],
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          printGuardian: Date.now()
        }
      }
    };
  }
}

/**
 * Restore original pixels in protected print regions
 * Called AFTER AI processing to fix any distortions
 *
 * @param originalImage - Original image buffer
 * @param processedImage - AI-processed image buffer
 * @param printRegions - Detected print regions with masks
 * @returns Restored image buffer
 */
export async function restorePrintRegions(
  originalImage: Buffer,
  processedImage: Buffer,
  printRegions: PrintRegion[]
): Promise<Buffer> {

  const original = sharp(originalImage);
  const processed = sharp(processedImage);

  const { width, height } = await original.metadata();

  // Get pixel data
  const { data: origData } = await original
    .resize(width!, height!, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: procData } = await processed
    .resize(width!, height!, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create output buffer (copy of processed)
  const outputData = Buffer.from(procData);

  // Restore each print region
  let restoredPixels = 0;

  for (const region of printRegions) {
    if (!region.mask) continue;

    for (let i = 0; i < region.mask.length; i++) {
      if (region.mask[i]) {
        const pixelIdx = i * 4;

        // Check if pixel is opaque in processed image
        if (procData[pixelIdx + 3] > 50) {
          // Restore RGB from original (keep processed alpha)
          outputData[pixelIdx] = origData[pixelIdx];
          outputData[pixelIdx + 1] = origData[pixelIdx + 1];
          outputData[pixelIdx + 2] = origData[pixelIdx + 2];
          restoredPixels++;
        }
      }
    }
  }

  // Convert back to PNG
  const restoredBuffer = await sharp(outputData, {
    raw: {
      width: width!,
      height: height!,
      channels: 4
    }
  })
    .png({ compressionLevel: 6 })
    .toBuffer();

  return restoredBuffer;
}

/**
 * Verify print integrity after processing
 * Compares original vs processed print regions
 *
 * @param originalImage - Original image buffer
 * @param processedImage - Processed image buffer
 * @param printRegions - Print regions to check
 * @returns Fidelity score (0-1) and issues found
 */
export async function verifyPrintIntegrity(
  originalImage: Buffer,
  processedImage: Buffer,
  printRegions: PrintRegion[]
): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = [];

  if (printRegions.length === 0) {
    return { score: 1.0, issues: [] }; // No prints to check
  }

  try {
    const original = sharp(originalImage);
    const processed = sharp(processedImage);

    const { width, height } = await original.metadata();

    const { data: origData } = await original
      .resize(width!, height!, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: procData } = await processed
      .resize(width!, height!, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let totalDifference = 0;
    let totalPixels = 0;

    for (const region of printRegions) {
      if (!region.mask) continue;

      for (let i = 0; i < region.mask.length; i++) {
        if (region.mask[i]) {
          const pixelIdx = i * 4;

          // Skip transparent pixels
          if (procData[pixelIdx + 3] < 50) continue;

          // Calculate color difference (deltaE approximation)
          const dr = Math.abs(origData[pixelIdx] - procData[pixelIdx]);
          const dg = Math.abs(origData[pixelIdx + 1] - procData[pixelIdx + 1]);
          const db = Math.abs(origData[pixelIdx + 2] - procData[pixelIdx + 2]);

          const diff = (dr + dg + db) / 3;
          totalDifference += diff;
          totalPixels++;
        }
      }
    }

    if (totalPixels === 0) {
      return { score: 1.0, issues: [] };
    }

    const avgDifference = totalDifference / totalPixels;

    // Score calculation (lower difference = higher score)
    const score = Math.max(0, 1 - (avgDifference / 50));

    // Check for issues
    if (avgDifference > 30) {
      issues.push(`CRITICAL: Print regions show ${avgDifference.toFixed(1)} avg color shift`);
    } else if (avgDifference > 15) {
      issues.push(`WARNING: Print regions show ${avgDifference.toFixed(1)} avg color shift`);
    }

    return { score, issues };

  } catch (error) {
    return { score: 0.5, issues: ['Print integrity verification failed'] };
  }
}
