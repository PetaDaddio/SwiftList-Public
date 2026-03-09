/**
 * Agent 2: Segmentation
 *
 * Performs background removal using multi-provider model routing:
 * - Replicate: version-pinned models (lucataco-rmbg, birefnet, cjwbw-rembg)
 * - fal.ai: BRIA RMBG 2.0 (primary model for all product types)
 *
 * Tracks tried models via `triedModels` Set in metadata so the
 * fallback agent can select the next untried model.
 *
 * Version-pinned Replicate models to prevent model drift (BUG-20260217-002).
 * BRIA RMBG 2.0 added after birefnet mask approach failed (BUG-20260218-001).
 */

import Replicate from 'replicate';
import { fal } from '@fal-ai/client';
import sharp from 'sharp';
import { env } from '$env/dynamic/private';
import type { AgentState, ModelSpec } from '../types';
import { selectModel } from '../utils/model-router';
import { bufferToDataUrl, downloadImage } from '../utils/buffer-helpers';
import { cleanInteriorHoles } from '../utils/interior-cleanup';
import { createLogger } from '$lib/utils/logger';

const logger = createLogger('segment-agent');

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
 * Retry wrapper for API calls with exponential backoff
 */
async function apiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const is429 = err.message?.includes('429') || err.message?.includes('Too Many Requests');

      if (!is429 || attempt === maxRetries - 1) {
        throw err;
      }

      const retryAfterMatch = err.message?.match(/retry_after[":]*\s*(\d+)/);
      const retryAfter = retryAfterMatch
        ? parseInt(retryAfterMatch[1]) * 1000
        : baseDelay * Math.pow(2, attempt);

      await new Promise((resolve) => setTimeout(resolve, retryAfter));
    }
  }

  throw lastError;
}

/**
 * Call Replicate model for background removal
 *
 * @param model - Model spec from registry
 * @param imageDataUrl - Base64 data URL of the image
 * @param apiKey - Replicate API key
 * @returns URL to the model output image
 */
async function callReplicate(model: ModelSpec, imageDataUrl: string, apiKey: string): Promise<string> {
  const replicate = new Replicate({ auth: apiKey });

  const output = await apiWithRetry(async () => {
    return withTimeout(
      (replicate.run(model.modelId as `${string}/${string}:${string}`, {
        input: {
          image: imageDataUrl
        }
      }) as Promise<unknown>).then(r => r as string),
      90_000,
      `Replicate ${model.name}`
    );
  });

  return output;
}

/**
 * Call fal.ai BRIA RMBG 2.0 for background removal
 *
 * BRIA outputs RGBA PNG directly (transparent background) — no mask compositing needed.
 * Uses fal.subscribe for queue-based execution with automatic polling.
 *
 * @param model - Model spec from registry (modelId = fal.ai endpoint)
 * @param imageBuffer - Raw image buffer
 * @param apiKey - fal.ai API key
 * @returns URL to the RGBA PNG output
 */
async function callFal(model: ModelSpec, imageBuffer: Buffer, apiKey: string): Promise<string> {
  // Configure fal.ai client with API key
  fal.config({ credentials: apiKey });

  // Upload image buffer to fal.ai storage to get a URL
  // fal.ai requires image_url, not base64
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
  const file = new File([blob], 'input.png', { type: 'image/png' });
  const imageUrl = await withTimeout(
    fal.storage.upload(file),
    60_000,
    'fal.ai storage upload'
  );

  logger.info({ imageUrl, model: model.name }, 'Uploaded image to fal.ai storage');

  // Call BRIA RMBG 2.0 via fal.subscribe (waits for result)
  const result = await apiWithRetry(async () => {
    return withTimeout(
      fal.subscribe(model.modelId, {
        input: {
          image_url: imageUrl
        },
        logs: false
      }),
      90_000,
      `fal.ai ${model.name}`
    );
  });

  // Extract output image URL from fal.ai response
  const outputUrl = (result as any)?.data?.image?.url;
  if (!outputUrl) {
    logger.error({ result: JSON.stringify(result).slice(0, 500) }, 'Unexpected fal.ai response structure');
    throw new Error(`fal.ai returned no image URL. Response keys: ${Object.keys((result as any)?.data || {}).join(', ')}`);
  }

  logger.info({
    outputUrl,
    width: (result as any)?.data?.image?.width,
    height: (result as any)?.data?.image?.height,
    fileSize: (result as any)?.data?.image?.file_size
  }, 'fal.ai BRIA output received');

  return outputUrl;
}

/**
 * Apply a B/W segmentation mask to the original image.
 * White pixels in mask = foreground (keep), black = background (transparent).
 * Resizes mask to match original image dimensions if needed.
 *
 * Handles mask polarity detection: if the mask is mostly white (>80%),
 * it's likely inverted (background=white) and we flip it.
 */
async function applyMaskToImage(originalBuffer: Buffer, maskBuffer: Buffer): Promise<Buffer> {
  const originalMeta = await sharp(originalBuffer).metadata();
  const origW = originalMeta.width!;
  const origH = originalMeta.height!;

  logger.info({ origW, origH }, 'Applying mask: original image dimensions');

  // Single pipeline: resize + greyscale + extract raw in one pass
  // removeAlpha() ensures we get exactly 1 channel (not 4 from downloadImage's ensureAlpha)
  const { data: maskData, info: maskInfo } = await sharp(maskBuffer)
    .resize(origW, origH, { fit: 'fill' })
    .greyscale()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const expectedPixels = origW * origH;

  logger.info({
    maskChannels: maskInfo.channels,
    maskWidth: maskInfo.width,
    maskHeight: maskInfo.height,
    maskDataLength: maskData.length,
    expectedPixels,
    match: maskData.length === expectedPixels
  }, 'Mask extraction diagnostics');

  // Detect mask polarity: count bright vs dark pixels
  let brightPixels = 0;
  for (let i = 0; i < maskData.length; i++) {
    if (maskData[i] > 128) brightPixels++;
  }
  const brightRatio = brightPixels / maskData.length;

  logger.info({
    brightPixels,
    totalPixels: maskData.length,
    brightRatio: brightRatio.toFixed(3),
    inverted: brightRatio > 0.8
  }, 'Mask polarity analysis');

  // If mask is >80% white, it's likely inverted (background=white, foreground=black)
  // Flip it so white=foreground, black=background
  const needsInvert = brightRatio > 0.8;
  if (needsInvert) {
    logger.info('Inverting mask polarity (detected background=white)');
    for (let i = 0; i < maskData.length; i++) {
      maskData[i] = 255 - maskData[i];
    }
  }

  // Get original as RGBA raw pixels
  const originalRgba = await sharp(originalBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();

  logger.info({
    originalRgbaLength: originalRgba.length,
    expectedRgba: expectedPixels * 4,
    rgbaMatch: originalRgba.length === expectedPixels * 4
  }, 'Original RGBA buffer diagnostics');

  // Apply mask: set alpha channel based on mask brightness
  const result = Buffer.from(originalRgba);
  const pixelCount = Math.min(maskData.length, expectedPixels);
  for (let i = 0; i < pixelCount; i++) {
    // Each pixel is 4 bytes (RGBA), alpha is at offset 3
    result[i * 4 + 3] = maskData[i]; // white(255)=opaque, black(0)=transparent
  }

  // Reconstruct PNG from raw RGBA
  return await sharp(result, {
    raw: { width: origW, height: origH, channels: 4 }
  })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * Segmentation Agent
 *
 * Removes the background using the appropriate provider:
 * - fal.ai: BRIA RMBG 2.0 (primary for all products, handles interior cutouts)
 * - Replicate: lucataco-rmbg, birefnet, cjwbw-rembg (fallbacks)
 *
 * Records the model ID in `metadata.triedModels` so the fallback
 * agent knows which models have already been attempted.
 *
 * @param state - Current pipeline state (after preprocess / enhance)
 * @param replicateApiKey - Optional Replicate API key override
 * @param falApiKey - Optional fal.ai API key override
 * @returns Updated state with background removed
 */
export async function segmentationAgent(
  state: AgentState,
  replicateApiKey?: string,
  falApiKey?: string
): Promise<AgentState> {
  const startTime = Date.now();

  try {
    // Select model (jewelry→BRIA via fal.ai, everything else→lucataco via Replicate)
    const complexity = state.metadata.complexity || 0.5;
    const hasFineDetails = state.metadata.hasFineDetails || false;
    const model = selectModel(state.productType, complexity, hasFineDetails);

    logger.info({
      model: model.name,
      modelId: model.modelId,
      provider: model.provider || 'replicate',
      productType: state.productType
    }, 'Starting segmentation');

    let outputUrl: string;

    if (model.provider === 'fal') {
      // fal.ai path (BRIA RMBG 2.0)
      const apiKey = falApiKey || env.FAL_KEY || '';
      if (!apiKey) {
        throw new Error('FAL_KEY environment variable is not set. Required for BRIA RMBG 2.0.');
      }
      outputUrl = await callFal(model, state.processedImage, apiKey);
    } else {
      // Replicate path (lucataco, birefnet, cjwbw)
      const apiKey = replicateApiKey || env.REPLICATE_API_KEY || '';
      if (!apiKey) {
        throw new Error('REPLICATE_API_KEY environment variable is not set');
      }
      const dataUrl = bufferToDataUrl(state.processedImage);
      outputUrl = await callReplicate(model, dataUrl, apiKey);
    }

    // Download model output (downloadImage has its own 30s timeout)
    const modelOutput = await downloadImage(outputUrl);

    // If model outputs a mask, composite it with the original image
    let segmentedBuffer: Buffer;
    if (model.outputType === 'mask') {
      logger.info('Applying mask to original image (mask-output model)');
      segmentedBuffer = await applyMaskToImage(state.processedImage, modelOutput);
    } else {
      segmentedBuffer = modelOutput;
    }

    // Clean up interior holes that BRIA missed (filigree gaps, bangle openings, etc.)
    // Only runs for jewelry products; returns unchanged buffer for everything else.
    segmentedBuffer = await cleanInteriorHoles(segmentedBuffer, state.originalImage, state.productType);

    // Track which models have been tried
    const triedModels = new Set(state.metadata.triedModels || []);
    triedModels.add(model.modelId);

    const duration = Date.now() - startTime;
    logger.info({ duration, model: model.name, provider: model.provider || 'replicate' }, 'Segmentation complete');

    return {
      ...state,
      processedImage: segmentedBuffer,
      metadata: {
        ...state.metadata,
        modelUsed: model.name,
        triedModels: [...triedModels],
        timestamps: {
          ...state.metadata.timestamps,
          segment: Date.now()
        }
      }
    };
  } catch (error: any) {
    throw new Error(`Segmentation agent failed: ${error.message}`);
  }
}
