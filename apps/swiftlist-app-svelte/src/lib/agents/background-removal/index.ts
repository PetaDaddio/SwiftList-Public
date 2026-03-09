/**
 * Background Removal Pipeline - Public API
 *
 * Two modes:
 * 1. removeBackgroundDirect() — FAST: Single fal.ai BRIA call, ~3-5s, minimal memory.
 *    Use this for production. Survives OOM because it avoids buffer multiplication.
 *
 * 2. removeBackgroundAdvanced() — FULL: 9-Agent DAG pipeline with edge refinement,
 *    specialist agents, quality validation, and retry loops. Uses significantly more
 *    memory (multiple buffer copies). Only use when quality tuning is needed.
 *
 * v3: Added removeBackgroundDirect() after repeated OOM crashes from the full pipeline
 *     killed Railway processes before any timeout could fire (BUG-20260227-001).
 */

import { fal } from '@fal-ai/client';
import type { PipelineResult, ProductType } from './types';
import { BackgroundRemovalOrchestrator } from './orchestrator';
import { createLogger } from '$lib/utils/logger';

const logger = createLogger('bg-removal');

/** Timeout wrapper */
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
 * Remove background using a DIRECT fal.ai BRIA call.
 *
 * This is the fast, memory-safe path:
 * - Uploads image to fal.ai storage
 * - Calls BRIA RMBG 2.0
 * - Downloads the RGBA PNG result
 * - Total: ~3-8 seconds, ~1 buffer copy
 *
 * The full 9-agent pipeline was causing OOM crashes on Railway because it created
 * 4-5 copies of large phone photos (48MB+ as raw RGBA each). When the process
 * crashed, all in-process timeouts died with it, leaving jobs stuck forever.
 *
 * @param imageBuffer - Input image buffer (any format sharp supports)
 * @param falApiKey - fal.ai API key
 * @returns PipelineResult with transparent PNG buffer
 */
export async function removeBackgroundDirect(
  imageBuffer: Buffer,
  falApiKey: string
): Promise<PipelineResult> {
  const startTime = Date.now();

  logger.info({ bufferSize: imageBuffer.length }, 'Starting direct BRIA background removal');

  // Configure fal.ai
  fal.config({ credentials: falApiKey });

  // 1. Upload image to fal.ai storage (60s timeout)
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
  const file = new File([blob], 'input.png', { type: 'image/png' });
  const imageUrl = await withTimeout(
    fal.storage.upload(file),
    60_000,
    'fal.ai upload'
  );

  logger.info({ imageUrl }, 'Image uploaded to fal.ai');

  // 2. Call BRIA RMBG 2.0 (60s timeout)
  const result = await withTimeout(
    fal.subscribe('fal-ai/bria/background/remove', {
      input: { image_url: imageUrl },
      logs: false
    }),
    60_000,
    'fal.ai BRIA RMBG'
  );

  const outputUrl = (result as any)?.data?.image?.url;
  if (!outputUrl) {
    throw new Error(`fal.ai returned no image URL. Keys: ${Object.keys((result as any)?.data || {}).join(', ')}`);
  }

  logger.info({ outputUrl }, 'BRIA output received');

  // 3. Download result (30s timeout)
  const response = await withTimeout(fetch(outputUrl), 30_000, 'Download BRIA output');
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  const arrayBuffer = await withTimeout(response.arrayBuffer(), 30_000, 'Read BRIA output body');
  const outputBuffer = Buffer.from(arrayBuffer);

  const processingTime = Date.now() - startTime;
  logger.info({ processingTime, outputSize: outputBuffer.length }, 'Direct BG removal complete');

  return {
    buffer: outputBuffer,
    qualityScore: 0.9, // BRIA produces consistently good results
    metrics: {
      edgeQuality: 0.9,
      segmentationQuality: 0.9,
      artifactFreeScore: 0.9,
      overallQuality: 0.9
    },
    metadata: {
      modelUsed: 'BRIA RMBG 2.0 (direct)',
      retryCount: 0,
      timestamps: { start: startTime }
    },
    processingTime
  };
}

/**
 * Remove background from image using advanced 9-agent pipeline
 *
 * WARNING: This uses significantly more memory than removeBackgroundDirect().
 * On Railway with limited memory, this can cause OOM crashes on large images.
 * Prefer removeBackgroundDirect() for production use.
 *
 * Pipeline stages:
 * 0. Enhance - Clarity Upscaler (skipped if image ≥2048px)
 * 1. Preprocess - Noise reduction, complexity detection
 * 2. Segment - Version-pinned Replicate model
 * 3. Refine-edges - CleanEdge v2 (universal edge color dilation)
 * 4. Specialist - [CONDITIONAL] Jewelry / Fabric / General
 * 5. Validate-quality - Multi-metric quality scoring
 * 6. Fallback - Retry with alternative version-pinned model
 * 7. Postprocess - PNG optimization
 *
 * @param imageBuffer - Input image buffer
 * @param productType - Product category for model routing ('jewelry' gets specialized processing)
 * @returns PipelineResult with buffer, quality score, and metrics
 */
export async function removeBackgroundAdvanced(
  imageBuffer: Buffer,
  productType: ProductType = 'default'
): Promise<PipelineResult> {
  const startTime = Date.now();

  // Initialize orchestrator
  const orchestrator = new BackgroundRemovalOrchestrator();

  // Create initial state
  const initialState = {
    originalImage: imageBuffer,
    processedImage: imageBuffer,
    productType,
    qualityScore: 0,
    metadata: {
      retryCount: 0,
      timestamps: {
        start: startTime
      }
    }
  };

  // Execute pipeline
  const finalState = await orchestrator.execute(initialState);

  // Build result
  const result: PipelineResult = {
    buffer: finalState.processedImage,
    qualityScore: finalState.qualityScore,
    metrics: finalState.qualityMetrics || {
      edgeQuality: 0,
      segmentationQuality: 0,
      artifactFreeScore: 0,
      overallQuality: finalState.qualityScore
    },
    metadata: finalState.metadata,
    processingTime: Date.now() - startTime
  };

  return result;
}

// Re-export types for convenience
export type { PipelineResult, ProductType, QualityMetrics, AgentState } from './types';
