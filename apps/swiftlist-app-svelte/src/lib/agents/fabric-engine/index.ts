/**
 * ThreadLogic Fabric Engine
 * 10-Agent Multi-Agent Pipeline for Fashion/Textile Processing
 *
 * V2.0 Features:
 * - Gaussian anti-aliasing for smooth, non-pixelated edges
 * - Multi-step Lanczos3 upscaling for crisp output
 * - Fabric-specific polish matching jewelry pipeline quality
 *
 * Competitive positioning:
 * - Rivals Photoroom "Product Beautifier" (lighting normalization)
 * - Rivals Claid.ai "Product Preservation" (print/logo fidelity)
 * - Matches GemPerfect jewelry pipeline quality for crisp edges
 *
 * Usage:
 * ```typescript
 * import { processWithThreadLogic, ThreadLogicOrchestrator } from '$lib/agents/fabric-engine';
 *
 * // Simple usage (after CleanEdge)
 * const result = await processWithThreadLogic(
 *   cleanEdgeOutput,
 *   originalImage,
 *   jobId,
 *   userId
 * );
 *
 * // Advanced usage with orchestrator
 * const orchestrator = new ThreadLogicOrchestrator({ qualityThreshold: 0.90 });
 * const result = await orchestrator.execute(fabricJob);
 * ```
 *
 * @author SwiftList Team
 * @version 2.0.0
 */

// Main orchestrator
export { ThreadLogicOrchestrator, processWithThreadLogic } from './orchestrator';

// Types
export type {
  FabricCategory,
  PhotographyType,
  PrintType,
  FabricAnalysis,
  PrintRegion,
  TextureMetrics,
  EdgeSofteningParams,
  LightingParams,
  FabricQualityMetrics,
  FabricAgentState,
  FabricWorkflowNode,
  FabricJob,
  FabricPipelineResult,
  CritiqueResult
} from './types';

// Individual agents (for custom pipelines)
export { fabricClassifierAgent } from './agents/fabric-classifier';
export { textureSentryAgent, verifyTexturePreservation } from './agents/texture-sentry';
export { printGuardianAgent, restorePrintRegions, verifyPrintIntegrity } from './agents/print-guardian';
export { edgeSoftenerAgent } from './agents/edge-softener';
export { lightingNormalizerAgent } from './agents/lighting-normalizer';
export { upscalerAgent, fabricPolishAgent } from './agents/upscaler';
export { critiqueAgent } from './agents/critique-agent';
