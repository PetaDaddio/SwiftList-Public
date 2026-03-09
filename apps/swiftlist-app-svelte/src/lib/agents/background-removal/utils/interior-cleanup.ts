/**
 * Interior Hole Cleanup (v3 — tuned thresholds)
 *
 * Fixes small interior openings that BRIA RMBG 2.0 misses — filigree gaps,
 * spaces between stacked bangles, lattice patterns, etc.
 *
 * v2 fixes the silver-on-white problem where pure color matching fails because
 * the product color overlaps with the background. Now uses TWO signals:
 *   1. Color distance to sampled background
 *   2. Local texture variance (smooth = background, textured = metal)
 *
 * Then clusters candidates and only removes coherent groups of the right size.
 *
 * v3 improvements:
 *   - Raised MAX_CLUSTER_RATIO from 3% → 25% (bangle gaps = 15-20% of interior)
 *   - Corner-based background sampling avoids shadow contamination near product
 *   - Geometric safety: large clusters (>2000px) must have ≥15% of their border
 *     adjacent to transparent pixels (proves they're enclosed gaps, not product)
 *
 * Algorithm:
 * 1. Flood-fill from borders through transparent pixels → "exterior"
 * 2. Sample background color from exterior (original image RGB)
 * 3. Mark interior opaque pixels matching background color as candidates
 * 4. Filter candidates by local variance (reject textured metal surfaces)
 * 5. Connected component analysis — only remove clusters of 15–N pixels
 *
 * SAFETY: Only touches pixels INSIDE the product boundary. Outer edges and
 * the product surface are never modified. CleanEdge handles edge refinement
 * separately and is not affected by this step.
 */

import sharp from 'sharp';
import { createLogger } from '$lib/utils/logger';

const logger = createLogger('interior-cleanup');

/** Minimum cluster size to remove (filters noise) */
const MIN_CLUSTER_PX = 15;

/** Maximum cluster size as fraction of interior pixels (filters product)
 *  0.25 = 25% — stacked bangle gaps can be 15-20% of interior area.
 *  The texture variance filter (smooth vs textured) is the real guard
 *  against removing product surfaces — this ratio is a backstop. */
const MAX_CLUSTER_RATIO = 0.25;

/** Local variance window radius (5x5 = radius 2) */
const VARIANCE_RADIUS = 2;

/** Max local variance for a pixel to be considered "smooth background" */
const MAX_SMOOTH_VARIANCE = 450;

/**
 * Clean interior holes left by BRIA segmentation
 *
 * @param segmentedBuffer - RGBA PNG from BRIA (background removed)
 * @param originalBuffer  - Original image before any processing
 * @param productType     - Product type string for gating
 * @returns Cleaned buffer (or original if no cleanup needed)
 */
export async function cleanInteriorHoles(
  segmentedBuffer: Buffer,
  originalBuffer: Buffer,
  productType: string
): Promise<Buffer> {
  if (!hasInteriorHoleRisk(productType)) {
    return segmentedBuffer;
  }

  const startTime = Date.now();

  try {
    const { data: segRgba, info } = await sharp(segmentedBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const totalPixels = w * h;

    const { data: origRgba } = await sharp(originalBuffer)
      .resize(w, h, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Grayscale of original for variance computation
    const gray = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      gray[i] = Math.round(
        origRgba[i * 4] * 0.299 +
        origRgba[i * 4 + 1] * 0.587 +
        origRgba[i * 4 + 2] * 0.114
      );
    }

    // ── Step 1: Flood-fill from borders → exterior mask ──
    const exterior = new Uint8Array(totalPixels);
    const queue: number[] = [];

    for (let x = 0; x < w; x++) {
      const topI = x;
      const botI = (h - 1) * w + x;
      if (segRgba[topI * 4 + 3] < 50) { exterior[topI] = 1; queue.push(topI); }
      if (segRgba[botI * 4 + 3] < 50) { exterior[botI] = 1; queue.push(botI); }
    }
    for (let y = 1; y < h - 1; y++) {
      const leftI = y * w;
      const rightI = y * w + (w - 1);
      if (segRgba[leftI * 4 + 3] < 50) { exterior[leftI] = 1; queue.push(leftI); }
      if (segRgba[rightI * 4 + 3] < 50) { exterior[rightI] = 1; queue.push(rightI); }
    }

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const y = Math.floor(idx / w);
      const x = idx % w;
      const neighbors = [
        y > 0 ? idx - w : -1,
        y < h - 1 ? idx + w : -1,
        x > 0 ? idx - 1 : -1,
        x < w - 1 ? idx + 1 : -1
      ];
      for (const ni of neighbors) {
        if (ni < 0 || exterior[ni]) continue;
        if (segRgba[ni * 4 + 3] < 50) {
          exterior[ni] = 1;
          queue.push(ni);
        }
      }
    }

    // ── Step 2: Sample background color from CORNERS ──
    // Using corners avoids shadow contamination near the product, which pulls
    // the mean darker and causes interior gap pixels to fail the color filter.
    const cornerSize = Math.max(Math.round(w * 0.15), 20);
    let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;

    for (let i = 0; i < totalPixels; i++) {
      if (!exterior[i]) continue;
      const px = i % w;
      const py = Math.floor(i / w);
      // Only sample from corner regions (15% inset from each edge)
      const inCorner =
        (px < cornerSize || px >= w - cornerSize) &&
        (py < cornerSize || py >= h - cornerSize);
      if (!inCorner) continue;
      bgR += origRgba[i * 4];
      bgG += origRgba[i * 4 + 1];
      bgB += origRgba[i * 4 + 2];
      bgCount++;
    }

    // Fallback: if corners don't have enough exterior pixels, use all exterior
    if (bgCount < 100) {
      bgR = 0; bgG = 0; bgB = 0; bgCount = 0;
      for (let i = 0; i < totalPixels; i++) {
        if (!exterior[i]) continue;
        bgR += origRgba[i * 4];
        bgG += origRgba[i * 4 + 1];
        bgB += origRgba[i * 4 + 2];
        bgCount++;
      }
    }

    if (bgCount < 100) {
      logger.debug('Not enough exterior pixels to sample background — skipping');
      return segmentedBuffer;
    }

    bgR = Math.round(bgR / bgCount);
    bgG = Math.round(bgG / bgCount);
    bgB = Math.round(bgB / bgCount);

    // Adaptive color threshold based on background variance
    let bgVarSum = 0;
    for (let i = 0; i < totalPixels; i++) {
      if (!exterior[i]) continue;
      const dr = origRgba[i * 4] - bgR;
      const dg = origRgba[i * 4 + 1] - bgG;
      const db = origRgba[i * 4 + 2] - bgB;
      bgVarSum += dr * dr + dg * dg + db * db;
    }
    const bgStdDev = Math.sqrt(bgVarSum / bgCount);
    const colorThreshold = Math.max(25, Math.min(50, bgStdDev * 2.5));

    logger.info({
      bgColor: { r: bgR, g: bgG, b: bgB },
      bgStdDev: bgStdDev.toFixed(1),
      colorThreshold: colorThreshold.toFixed(1),
      exteriorPixels: bgCount
    }, 'Background color sampled');

    // ── Step 3: Mark candidates (color match + smooth texture) ──
    const candidates = new Uint8Array(totalPixels);
    let candidateCount = 0;

    for (let y = VARIANCE_RADIUS; y < h - VARIANCE_RADIUS; y++) {
      for (let x = VARIANCE_RADIUS; x < w - VARIANCE_RADIUS; x++) {
        const i = y * w + x;

        // Must be interior and opaque
        if (exterior[i]) continue;
        if (segRgba[i * 4 + 3] < 128) continue;

        // Color distance to background
        const r = origRgba[i * 4];
        const g = origRgba[i * 4 + 1];
        const b = origRgba[i * 4 + 2];
        const dist = Math.sqrt(
          (r - bgR) * (r - bgR) +
          (g - bgG) * (g - bgG) +
          (b - bgB) * (b - bgB)
        );
        if (dist >= colorThreshold) continue;

        // Local variance check: compute grayscale variance in (2R+1)x(2R+1) window
        // Low variance = smooth background, high variance = textured metal
        let sum = 0, sumSq = 0, count = 0;
        for (let dy = -VARIANCE_RADIUS; dy <= VARIANCE_RADIUS; dy++) {
          for (let dx = -VARIANCE_RADIUS; dx <= VARIANCE_RADIUS; dx++) {
            const ni = (y + dy) * w + (x + dx);
            const v = gray[ni];
            sum += v;
            sumSq += v * v;
            count++;
          }
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;

        if (variance < MAX_SMOOTH_VARIANCE) {
          candidates[i] = 1;
          candidateCount++;
        }
      }
    }

    if (candidateCount === 0) {
      logger.info('No smooth background-colored interior pixels found');
      return segmentedBuffer;
    }

    logger.info({ candidateCount }, 'Candidates after color + texture filter');

    // ── Step 4: Connected component analysis — keep only right-sized clusters ──
    const componentId = new Int32Array(totalPixels); // 0 = unassigned
    const clusterSizes: Map<number, number> = new Map();
    let nextCluster = 1;

    for (let i = 0; i < totalPixels; i++) {
      if (!candidates[i] || componentId[i] !== 0) continue;

      // BFS to find this connected cluster
      const clusterId = nextCluster++;
      const clusterQueue: number[] = [i];
      componentId[i] = clusterId;
      let clusterHead = 0;
      let size = 0;

      while (clusterHead < clusterQueue.length) {
        const idx = clusterQueue[clusterHead++];
        size++;
        const cy = Math.floor(idx / w);
        const cx = idx % w;

        const neighbors = [
          cy > 0 ? idx - w : -1,
          cy < h - 1 ? idx + w : -1,
          cx > 0 ? idx - 1 : -1,
          cx < w - 1 ? idx + 1 : -1
        ];
        for (const ni of neighbors) {
          if (ni < 0 || componentId[ni] !== 0 || !candidates[ni]) continue;
          componentId[ni] = clusterId;
          clusterQueue.push(ni);
        }
      }
      clusterSizes.set(clusterId, size);
    }

    // Determine max cluster size (fraction of interior opaque pixels)
    const interiorOpaqueCount = totalPixels - bgCount;
    const maxClusterPx = Math.max(500, Math.round(interiorOpaqueCount * MAX_CLUSTER_RATIO));

    // ── Step 5: Geometric validation for large clusters ──
    // Large clusters (>2000px) could be product surface false positives
    // (e.g., smooth gray ring metal on gray background). Require that at
    // least 15% of the cluster's border pixels are adjacent to transparent
    // areas — proving the cluster is a genuine enclosed gap, not product.
    const LARGE_CLUSTER_THRESHOLD = 2000;
    const MIN_TRANSPARENT_BORDER_RATIO = 0.15;

    const geometryPass = new Set<number>(); // cluster IDs that pass geometry check

    for (const [clusterId, size] of clusterSizes) {
      if (size < MIN_CLUSTER_PX || size > maxClusterPx) continue;

      // Small clusters skip geometry check (filigree gaps are fine)
      if (size < LARGE_CLUSTER_THRESHOLD) {
        geometryPass.add(clusterId);
        continue;
      }

      // For large clusters: count border pixels adjacent to transparent areas
      let borderPixels = 0;
      let transparentAdjacent = 0;

      for (let i = 0; i < totalPixels; i++) {
        if (componentId[i] !== clusterId) continue;
        const cy = Math.floor(i / w);
        const cx = i % w;
        const neighbors = [
          cy > 0 ? i - w : -1,
          cy < h - 1 ? i + w : -1,
          cx > 0 ? i - 1 : -1,
          cx < w - 1 ? i + 1 : -1
        ];
        // Is this pixel on the cluster border?
        let isBorder = false;
        let hasTransparentNeighbor = false;
        for (const ni of neighbors) {
          if (ni < 0) { isBorder = true; continue; }
          if (componentId[ni] !== clusterId) {
            isBorder = true;
            if (segRgba[ni * 4 + 3] < 128) {
              hasTransparentNeighbor = true;
            }
          }
        }
        if (isBorder) {
          borderPixels++;
          if (hasTransparentNeighbor) transparentAdjacent++;
        }
      }

      const transparentRatio = borderPixels > 0 ? transparentAdjacent / borderPixels : 0;

      if (transparentRatio >= MIN_TRANSPARENT_BORDER_RATIO) {
        geometryPass.add(clusterId);
        logger.debug({
          clusterId, size, borderPixels, transparentAdjacent,
          transparentRatio: transparentRatio.toFixed(3)
        }, 'Large cluster passed geometry check — enclosed gap');
      } else {
        logger.debug({
          clusterId, size, borderPixels, transparentAdjacent,
          transparentRatio: transparentRatio.toFixed(3)
        }, 'Large cluster FAILED geometry check — likely product surface');
      }
    }

    // Remove only clusters that pass all checks
    const result = Buffer.from(segRgba);
    let cleaned = 0;
    let clustersRemoved = 0;
    let clustersSkippedSmall = 0;
    let clustersSkippedLarge = 0;
    let clustersSkippedGeometry = 0;

    for (const [clusterId, size] of clusterSizes) {
      if (size < MIN_CLUSTER_PX) {
        clustersSkippedSmall++;
        continue;
      }
      if (size > maxClusterPx) {
        clustersSkippedLarge++;
        continue;
      }
      if (!geometryPass.has(clusterId)) {
        clustersSkippedGeometry++;
        continue;
      }
      clustersRemoved++;
    }

    // Apply removal
    for (let i = 0; i < totalPixels; i++) {
      if (componentId[i] === 0) continue;
      const size = clusterSizes.get(componentId[i]) || 0;
      if (size >= MIN_CLUSTER_PX && size <= maxClusterPx && geometryPass.has(componentId[i])) {
        result[i * 4 + 3] = 0;
        cleaned++;
      }
    }

    if (cleaned === 0) {
      logger.info({
        clustersSkippedSmall,
        clustersSkippedLarge,
        clustersSkippedGeometry,
        totalClusters: clusterSizes.size
      }, 'No valid clusters found — image unchanged');
      return segmentedBuffer;
    }

    const duration = Date.now() - startTime;
    logger.info({
      cleaned,
      clustersRemoved,
      clustersSkippedSmall,
      clustersSkippedLarge,
      clustersSkippedGeometry,
      totalClusters: clusterSizes.size,
      maxClusterPx,
      durationMs: duration
    }, 'Interior hole cleanup complete');

    return sharp(result, { raw: { width: w, height: h, channels: 4 } })
      .png({ compressionLevel: 6 })
      .toBuffer();

  } catch (error: any) {
    logger.error({ error: error.message }, 'Interior cleanup failed — returning original');
    return segmentedBuffer;
  }
}

/**
 * Check if product type is prone to interior holes
 */
function hasInteriorHoleRisk(productType: string): boolean {
  const riskTypes = [
    'jewelry', 'jewellery', 'ring', 'necklace', 'bracelet', 'earring', 'earrings',
    'pendant', 'brooch', 'bangle', 'anklet', 'chain', 'tiara', 'crown',
    'cufflink', 'cufflinks', 'filigree', 'lattice'
  ];
  const lower = productType.toLowerCase();
  return riskTypes.some(t => lower.includes(t));
}
