/**
 * Model Router v3
 * Multi-provider model registry: Replicate (version-pinned) + fal.ai (BRIA RMBG 2.0).
 * Replicate models use exact version hashes to prevent model drift
 * (root cause of BUG-20260217-002: moiré on jewelry from unpinned BRIA).
 *
 * BRIA RMBG 2.0 via fal.ai is the PRIMARY model for ALL product types.
 * Handles interior cutouts (ring holes, chair legs, handle gaps, frame openings)
 * that simpler models miss. Added after birefnet mask approach failed (BUG-20260218-001).
 */

import type { ModelSpec, ProductType } from '../types';

/**
 * Multi-provider model registry.
 * Replicate: NEVER use unpinned model IDs (e.g. 'bria/remove-background' without hash).
 * fal.ai: Uses endpoint path as modelId (e.g. 'fal-ai/bria/background/remove').
 */
export const MODEL_REGISTRY: Record<string, ModelSpec> = {
  // PRIMARY: BRIA RMBG 2.0 via fal.ai — premium quality for ALL product types
  // Output: RGBA PNG (background already removed, transparent)
  // Provider: fal.ai
  // Handles interior cutouts (ring holes, chair legs, handle gaps) that simpler models miss
  // 100% licensed training data, superior edge quality
  'bria-rmbg': {
    modelId: 'fal-ai/bria/background/remove',
    name: 'BRIA RMBG 2.0',
    costPerPrediction: 0.018,
    avgLatency: 4000,
    bestFor: ['jewelry', 'clothing', 'electronics', 'furniture', 'food', 'default'],
    outputType: 'rgba',
    provider: 'fal'
  },

  // FALLBACK 1: Lucataco Remove BG — version-pinned, fast general-purpose
  // Output: RGBA image (background already removed)
  // Provider: Replicate
  'lucataco-rmbg': {
    modelId: 'lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1',
    name: 'Lucataco Remove BG',
    costPerPrediction: 0.018,
    avgLatency: 3800,
    bestFor: ['jewelry', 'clothing', 'electronics', 'furniture', 'food', 'default'],
    outputType: 'rgba',
    provider: 'replicate'
  },

  // FALLBACK: Birefnet — mask-based, kept as fallback option
  // Output: B/W mask (white=foreground) — must be composited with original
  // Provider: Replicate
  'birefnet': {
    modelId: 'men1scus/birefnet:f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7',
    name: 'Birefnet',
    costPerPrediction: 0.02,
    avgLatency: 5000,
    bestFor: ['jewelry', 'clothing'],
    outputType: 'mask',
    provider: 'replicate'
  },

  // FALLBACK: CJWBW Rembg — broad compatibility
  // Output: RGBA image (background already removed)
  // Provider: Replicate
  'cjwbw-rembg': {
    modelId: 'cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
    name: 'CJWBW Rembg',
    costPerPrediction: 0.018,
    avgLatency: 3500,
    bestFor: ['clothing', 'furniture', 'default'],
    outputType: 'rgba',
    provider: 'replicate'
  }
};

/** Enhance model (Clarity Upscaler) — used by enhance agent */
export const ENHANCE_MODEL_ID = 'philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e';

/** Ordered fallback chain: BRIA (primary) → lucataco → birefnet → cjwbw */
export const FALLBACK_CHAIN: string[] = ['bria-rmbg', 'lucataco-rmbg', 'birefnet', 'cjwbw-rembg'];

/**
 * Jewelry product type detection
 */
const JEWELRY_TYPES = [
  'jewelry', 'jewellery', 'ring', 'necklace', 'bracelet', 'earring', 'earrings',
  'pendant', 'brooch', 'watch', 'gemstone', 'diamond', 'pearl', 'gold', 'silver',
  'platinum', 'engagement ring', 'wedding ring', 'chain', 'bangle', 'anklet',
  'cufflink', 'cufflinks', 'tiara', 'crown'
];

/**
 * Check if product type is jewelry-related
 */
export function isJewelryProduct(productType: string): boolean {
  const productTypeLower = (productType || '').toLowerCase();
  return JEWELRY_TYPES.some(type => productTypeLower.includes(type));
}

/**
 * Select primary model for segmentation.
 * BRIA RMBG 2.0 is the primary model for ALL product types.
 * Handles interior cutouts (holes, gaps, openings) that simpler models miss.
 */
export function selectModel(
  productType: ProductType,
  complexity: number = 0.5,
  hasFineDetails: boolean = false
): ModelSpec {
  return MODEL_REGISTRY['bria-rmbg'];
}

/**
 * Select next fallback model based on models already tried.
 *
 * @param triedModelIds - Set of model IDs already attempted
 * @param productType - Product category
 * @returns Next ModelSpec to try, or null if all exhausted
 */
export function selectFallbackModel(
  primaryModelId: string,
  productType: ProductType,
  triedModelIds?: Set<string>
): ModelSpec | null {
  // Single fallback chain for all product types: BRIA → lucataco → birefnet → cjwbw
  const chain = FALLBACK_CHAIN;

  // If triedModelIds provided, use it for precise tracking
  if (triedModelIds) {
    for (const key of chain) {
      const model = MODEL_REGISTRY[key];
      if (!triedModelIds.has(model.modelId)) {
        return model;
      }
    }
    return null;
  }

  // Legacy path: find next model after primaryModelId in chain
  let foundPrimary = false;
  for (const key of chain) {
    const model = MODEL_REGISTRY[key];
    if (model.modelId === primaryModelId) {
      foundPrimary = true;
      continue;
    }
    if (foundPrimary) {
      return model;
    }
  }

  // If primary wasn't in chain, return the first one from appropriate chain
  if (!foundPrimary) {
    return MODEL_REGISTRY[chain[0]];
  }

  return null;
}
