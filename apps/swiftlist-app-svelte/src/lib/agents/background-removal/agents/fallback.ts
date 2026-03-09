/**
 * Agent 5: Fallback
 *
 * Retries segmentation with an alternative version-pinned model
 * if quality validation fails. Uses `triedModels` Set from metadata
 * to avoid re-trying models that already failed.
 *
 * v2: Uses triedModels Set instead of comparing model names.
 *     All model IDs are version-pinned (no auto-updating models).
 */

import Replicate from 'replicate';
import { env } from '$env/dynamic/private';
import type { AgentState } from '../types';
import { selectFallbackModel } from '../utils/model-router';
import { bufferToDataUrl, downloadImage } from '../utils/buffer-helpers';
import { createLogger } from '$lib/utils/logger';

const logger = createLogger('fallback-agent');

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
 * Fallback Agent
 *
 * Responsibilities:
 * 1. Check if max retries reached (limit: 2)
 * 2. Select next untried model using triedModels Set
 * 3. Re-run segmentation on ORIGINAL image (not preprocessed)
 * 4. Track tried model in triedModels Set
 * 5. Return to quality validation
 *
 * @param state - Current pipeline state
 * @returns Updated state with fallback result
 */
export async function fallbackAgent(state: AgentState): Promise<AgentState> {
  const startTime = Date.now();

  // 1. Check max retries
  if (state.metadata.retryCount >= 2) {
    logger.warn({ retryCount: state.metadata.retryCount }, 'Max retries reached, accepting current quality');
    return {
      ...state,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          fallback: Date.now()
        }
      }
    };
  }

  try {
    // 2. Increment retry count
    const newRetryCount = state.metadata.retryCount + 1;

    // 3. Select next untried model using triedModels Set
    const triedModels = new Set(state.metadata.triedModels || []);
    const primaryModelId = state.metadata.modelUsed || '';
    const fallbackModel = selectFallbackModel(primaryModelId, state.productType, triedModels);

    if (!fallbackModel) {
      logger.warn({ triedCount: triedModels.size }, 'No untried fallback models remaining');
      return {
        ...state,
        metadata: {
          ...state.metadata,
          retryCount: newRetryCount,
          timestamps: {
            ...state.metadata.timestamps,
            fallback: Date.now()
          }
        }
      };
    }

    logger.info({ model: fallbackModel.name, modelId: fallbackModel.modelId, retry: newRetryCount }, 'Trying fallback model');

    // 4. Initialize Replicate client
    const apiKey = env.REPLICATE_API_KEY || '';
    if (!apiKey) {
      throw new Error('REPLICATE_API_KEY environment variable is not set');
    }
    const replicate = new Replicate({ auth: apiKey });

    // 5. Re-run segmentation on ORIGINAL image (not preprocessed)
    const dataUrl = bufferToDataUrl(state.originalImage);

    const output = await replicateWithRetry(async () => {
      const runPromise = replicate.run(fallbackModel.modelId as `${string}/${string}:${string}`, {
        input: {
          image: dataUrl
        }
      });
      // 90-second timeout — prevents infinite hang if Replicate stalls
      const result = await Promise.race([
        runPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Fallback replicate.run timed out after 90s')), 90_000)
        )
      ]);
      return (result as unknown) as string;
    });

    // 6. Download result
    const fallbackBuffer = await downloadImage(output);

    // 7. Track tried model
    triedModels.add(fallbackModel.modelId);

    const duration = Date.now() - startTime;
    logger.info({ duration, model: fallbackModel.name }, 'Fallback segmentation complete');

    return {
      ...state,
      processedImage: fallbackBuffer,
      metadata: {
        ...state.metadata,
        modelUsed: fallbackModel.name,
        retryCount: newRetryCount,
        triedModels: [...triedModels],
        timestamps: {
          ...state.metadata.timestamps,
          fallback: Date.now()
        }
      }
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Fallback agent failed, accepting current quality');

    return {
      ...state,
      metadata: {
        ...state.metadata,
        retryCount: state.metadata.retryCount + 1,
        timestamps: {
          ...state.metadata.timestamps,
          fallback: Date.now()
        }
      }
    };
  }
}
