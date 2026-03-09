/**
 * Background Removal Pipeline Types
 * 7-Agent DAG Architecture for Advanced Background Removal
 * Now with ThreadLogic Fabric Engine integration for clothing
 */

import type { FabricPipelineResult, FabricQualityMetrics } from '../fabric-engine/types';

/**
 * Product type categories for model routing
 */
export type ProductType =
  | 'jewelry'
  | 'furniture'
  | 'clothing'
  | 'electronics'
  | 'food'
  | 'default';

/**
 * Quality score breakdown
 */
export interface QualityMetrics {
  /** Edge quality score (0-1), weight: 40% */
  edgeQuality: number;

  /** Segmentation quality score (0-1), weight: 40% */
  segmentationQuality: number;

  /** Artifact-free score (0-1), weight: 20% */
  artifactFreeScore: number;

  /** Overall weighted quality score (0-1) */
  overallQuality: number;

  /** Additional diagnostic metrics */
  diagnostics?: {
    alphaVariance?: number;
    clearPixelRatio?: number;
    artifactCount?: number;
    hasFringing?: boolean;
  };
}

/**
 * Replicate model specification
 */
export interface ModelSpec {
  /** Model identifier (Replicate version-pinned ID or fal.ai endpoint) */
  modelId: string;

  /** Model name for logging */
  name: string;

  /** Cost per prediction (USD) */
  costPerPrediction: number;

  /** Average latency (milliseconds) */
  avgLatency: number;

  /** Best for these product types */
  bestFor: ProductType[];

  /** Output type: 'rgba' = background-removed image, 'mask' = B/W segmentation mask */
  outputType: 'rgba' | 'mask';

  /** API provider: 'replicate' (default) or 'fal' */
  provider?: 'replicate' | 'fal';
}

/**
 * Agent state - passed through the DAG pipeline
 */
export interface AgentState {
  /** Original input image buffer */
  originalImage: Buffer;

  /** Currently processed image buffer */
  processedImage: Buffer;

  /** Product type for model routing */
  productType: ProductType;

  /** Quality metrics (populated by validate-quality agent) */
  qualityScore: number;
  qualityMetrics?: QualityMetrics;

  /** Edge quality (populated by refine-edges agent) */
  edgeQuality?: number;

  /** ThreadLogic results (populated by fabric-specialist agent for clothing) */
  threadLogicResult?: FabricPipelineResult;

  /** Metadata collected during processing */
  metadata: {
    /** Image complexity (0-1, higher = more complex) */
    complexity?: number;

    /** Has fine details requiring special handling */
    hasFineDetails?: boolean;

    /** Original image width before downsampling */
    originalWidth?: number;

    /** Original image height before downsampling */
    originalHeight?: number;

    /** Whether image was downsampled for segmentation */
    downsampled?: boolean;

    /** Whether median filter was skipped (jewelry/metallic) */
    skippedMedianFilter?: boolean;

    /** Whether image was enhanced (Clarity Upscaler) before segmentation */
    enhanced?: boolean;

    /** Enhanced image width (after upscale) */
    enhancedWidth?: number;

    /** Enhanced image height (after upscale) */
    enhancedHeight?: number;

    /** Model used for segmentation */
    modelUsed?: string;

    /** Array of model IDs already tried (for fallback tracking) */
    triedModels?: string[];

    /** Retry count for fallback logic */
    retryCount: number;

    /** ThreadLogic processing flag */
    usedThreadLogic?: boolean;

    /** Processing timestamps */
    timestamps: {
      start: number;
      enhance?: number;
      preprocess?: number;
      segment?: number;
      refineEdges?: number;
      jewelrySpecialist?: number;
      fabricSpecialist?: number;
      validateQuality?: number;
      fallback?: number;
      postprocess?: number;
    };
  };
}

/**
 * Agent function signature
 * Pure function: takes state, returns new state
 */
export type WorkflowNode = (state: AgentState) => Promise<AgentState>;

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  /** Final processed image buffer */
  buffer: Buffer;

  /** Overall quality score (0-1) */
  qualityScore: number;

  /** Detailed quality metrics */
  metrics: QualityMetrics;

  /** Metadata from processing */
  metadata: AgentState['metadata'];

  /** Total processing time (ms) */
  processingTime: number;
}
