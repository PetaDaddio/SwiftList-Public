/**
 * Agent 0: Enhance (Stage 1 — "Upscale First, Cut Second")
 *
 * Runs Clarity Upscaler on the original image BEFORE segmentation.
 * This gives the segmentation model more pixel detail to work with,
 * producing cleaner edges — especially on fine details like jewelry
 * chains, gemstone facets, and fabric threads.
 *
 * Version-pinned to prevent model drift.
 */

import Replicate from 'replicate';
import sharp from 'sharp';
import { env } from '$env/dynamic/private';
import type { AgentState } from '../types';
import { bufferToDataUrl, downloadImage } from '../utils/buffer-helpers';
import { ENHANCE_MODEL_ID } from '../utils/model-router';
import { createLogger } from '$lib/utils/logger';

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

const logger = createLogger('enhance-agent');

/** Max dimension after enhancement — keeps Replicate costs reasonable */
const MAX_ENHANCED_DIMENSION = 4096;

/**
 * Retry wrapper for Replicate API calls with exponential backoff
 */
async function replicateWithRetry<T>(
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
 * Enhance Agent
 *
 * Upscales the original image using Clarity Upscaler before segmentation.
 * Skipped if image is already large enough (longest side > 2048px).
 *
 * @param state - Current pipeline state (after preprocess)
 * @param replicateApiKey - Optional API key override
 * @returns Updated state with enhanced image
 */
export async function enhanceAgent(state: AgentState, replicateApiKey?: string): Promise<AgentState> {
  const startTime = Date.now();

  try {
    // Check if image is already large — skip enhancement
    const meta = await sharp(state.processedImage).metadata();
    const longestSide = Math.max(meta.width || 0, meta.height || 0);

    if (longestSide >= 2048) {
      logger.info({ longestSide }, 'Image already large enough, skipping enhance');
      return {
        ...state,
        metadata: {
          ...state.metadata,
          enhanced: false,
          timestamps: {
            ...state.metadata.timestamps,
            enhance: Date.now()
          }
        }
      };
    }

    // Initialize Replicate client
    const apiKey = replicateApiKey || env.REPLICATE_API_KEY || '';
    if (!apiKey) {
      throw new Error('REPLICATE_API_KEY environment variable is not set');
    }
    const replicate = new Replicate({ auth: apiKey });

    // Convert image to data URL
    const dataUrl = bufferToDataUrl(state.processedImage);

    // Calculate scale factor (target ~2x but cap at MAX_ENHANCED_DIMENSION)
    const targetScale = Math.min(2, MAX_ENHANCED_DIMENSION / longestSide);
    const scaleFactor = Math.max(1.5, Math.round(targetScale * 10) / 10);

    logger.info({ longestSide, scaleFactor }, 'Enhancing image with Clarity Upscaler');

    // Call Clarity Upscaler (90s timeout per attempt)
    const output = await replicateWithRetry(async () => {
      const result = await withTimeout(
        replicate.run(
          ENHANCE_MODEL_ID as `${string}/${string}:${string}`,
          {
            input: {
              image: dataUrl,
              scale_factor: scaleFactor,
              dynamic: 6,
              creativity: 0.2,
              resemblance: 0.9,
              output_format: 'png'
            }
          }
        ),
        90_000,
        'Clarity Upscaler'
      );

      // Clarity Upscaler returns an array of URLs
      if (Array.isArray(result) && result.length > 0) {
        return result[0] as string;
      }
      if (typeof result === 'string') {
        return result;
      }
      throw new Error('Unexpected Clarity Upscaler output format');
    });

    // Download enhanced image
    const enhancedBuffer = await downloadImage(output);

    // Get enhanced dimensions
    const enhancedMeta = await sharp(enhancedBuffer).metadata();
    const enhancedWidth = enhancedMeta.width || meta.width || 0;
    const enhancedHeight = enhancedMeta.height || meta.height || 0;

    const duration = Date.now() - startTime;
    logger.info({ duration, enhancedWidth, enhancedHeight }, 'Enhancement complete');

    return {
      ...state,
      processedImage: enhancedBuffer,
      metadata: {
        ...state.metadata,
        enhanced: true,
        enhancedWidth,
        enhancedHeight,
        timestamps: {
          ...state.metadata.timestamps,
          enhance: Date.now()
        }
      }
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Enhance agent failed, continuing without enhancement');

    // Non-fatal: continue pipeline without enhancement
    return {
      ...state,
      metadata: {
        ...state.metadata,
        enhanced: false,
        timestamps: {
          ...state.metadata.timestamps,
          enhance: Date.now()
        }
      }
    };
  }
}
