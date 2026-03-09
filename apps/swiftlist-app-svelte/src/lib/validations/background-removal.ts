/**
 * Background Removal Validation Schemas
 * Zod schemas for input validation
 */

import { z } from 'zod';

/**
 * Product type validation
 */
export const productTypeSchema = z.enum([
  'jewelry',
  'furniture',
  'clothing',
  'electronics',
  'food',
  'default'
]);

/**
 * Quality threshold validation
 */
export const qualityThresholdSchema = z.object({
  /** Minimum acceptable quality score (0-1) */
  minQuality: z.number().min(0).max(1).default(0.85),

  /** Maximum retry attempts before accepting lower quality */
  maxRetries: z.number().int().min(0).max(3).default(2),

  /** Enable fallback model if primary fails quality check */
  enableFallback: z.boolean().default(true)
});

/**
 * Background removal options
 */
export const backgroundRemovalOptionsSchema = z.object({
  /** Product type for model routing */
  productType: productTypeSchema.default('default'),

  /** Quality threshold configuration */
  qualityThreshold: qualityThresholdSchema.default({
    minQuality: 0.85,
    maxRetries: 2,
    enableFallback: true
  }),

  /** Enable detailed logging */
  verbose: z.boolean().default(false)
});

export type BackgroundRemovalOptions = z.infer<typeof backgroundRemovalOptionsSchema>;
