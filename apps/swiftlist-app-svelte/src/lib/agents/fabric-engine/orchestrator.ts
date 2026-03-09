/**
 * ThreadLogic Fabric Engine Orchestrator
 * 10-Agent DAG (Directed Acyclic Graph) for Fashion/Textile Processing
 *
 * V2.0 Pipeline Architecture:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                    THREADLOGIC FABRIC ENGINE v2.0                    │
 * │                                                                       │
 * │  Input: CleanEdge Output (background-removed image)                  │
 * │                                                                       │
 * │  ┌─────────────────┐                                                 │
 * │  │ 1. Fabric       │ ← Gemini 2.5 Flash Vision classification        │
 * │  │    Classifier   │                                                 │
 * │  └────────┬────────┘                                                 │
 * │           │                                                           │
 * │  ┌────────▼────────┐   ┌─────────────────┐                           │
 * │  │ 2. Texture      │   │ 3. Print        │ ← Run in parallel         │
 * │  │    Sentry       │   │    Guardian     │                           │
 * │  └────────┬────────┘   └────────┬────────┘                           │
 * │           │                     │                                     │
 * │           └──────────┬──────────┘                                     │
 * │                      │                                                │
 * │  ┌───────────────────▼───────────────────┐                           │
 * │  │ 4. Edge Softener v2 (Gaussian AA)     │ ← NEW: Anti-aliasing      │
 * │  └───────────────────┬───────────────────┘                           │
 * │                      │                                                │
 * │  ┌───────────────────▼───────────────────┐                           │
 * │  │ 5. Lighting Normalizer (Photoroom)    │                           │
 * │  └───────────────────┬───────────────────┘                           │
 * │                      │                                                │
 * │  ┌───────────────────▼───────────────────┐                           │
 * │  │ 6. Color Restorer (print regions)     │                           │
 * │  └───────────────────┬───────────────────┘                           │
 * │                      │                                                │
 * │  ┌───────────────────▼───────────────────┐                           │
 * │  │ 7. Upscaler (multi-step Lanczos3)     │ ← NEW: Crisp upscaling    │
 * │  └───────────────────┬───────────────────┘                           │
 * │                      │                                                │
 * │  ┌───────────────────▼───────────────────┐                           │
 * │  │ 8. Fabric Polish (final refinement)   │ ← NEW: Final polish       │
 * │  └───────────────────┬───────────────────┘                           │
 * │                      │                                                │
 * │  ┌───────────────────▼───────────────────┐                           │
 * │  │ 9. Quality Validator                  │                           │
 * │  └───────────────────┬───────────────────┘                           │
 * │                      │                                                │
 * │               Quality ≥ 85%?                                         │
 * │                 │       │                                             │
 * │               YES      NO                                             │
 * │                 │       │                                             │
 * │                 │    ┌──▼──────────────────┐                          │
 * │                 │    │ Retry Loop (max 2)  │────┐                    │
 * │                 │    └─────────────────────┘    │                    │
 * │                 │                               │                    │
 * │                 ▼                               │                    │
 * │  ┌─────────────────────────────────────────────┴──┐                  │
 * │  │ 10. Critique Agent (Chain-of-Verification)    │                  │
 * │  └───────────────────┬───────────────────────────┘                  │
 * │                      │                                                │
 * │                      ▼                                                │
 * │               OUTPUT + Quality Metrics                               │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * @author SwiftList Team
 * @version 2.0.0
 */

import type {
  FabricAgentState,
  FabricJob,
  FabricPipelineResult,
  FabricWorkflowNode
} from './types';

// Import agents
import { fabricClassifierAgent } from './agents/fabric-classifier';
import { textureSentryAgent } from './agents/texture-sentry';
import { printGuardianAgent } from './agents/print-guardian';
import { edgeSoftenerAgent } from './agents/edge-softener';
import { lightingNormalizerAgent } from './agents/lighting-normalizer';
import { critiqueAgent } from './agents/critique-agent';
import { restorePrintRegions } from './agents/print-guardian';
import { upscalerAgent, fabricPolishAgent } from './agents/upscaler';
import { fabricColorRestorerAgent } from './agents/fabric-color-restorer';
import { agentsLogger } from '$lib/utils/logger';

const log = agentsLogger.child({ pipeline: 'fabric-engine' });

/**
 * Color Restorer Agent (Agent 6)
 * Restores original colors in print regions after all processing
 */
async function colorRestorerAgent(state: FabricAgentState): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    // Only restore if we have print regions to protect
    if (!state.printRegions || state.printRegions.length === 0) {
      return {
        ...state,
        metadata: {
          ...state.metadata,
          timestamps: {
            ...state.metadata.timestamps,
            colorRestorer: Date.now()
          }
        }
      };
    }

    const restoredImage = await restorePrintRegions(
      state.originalImage,
      state.processedImage,
      state.printRegions
    );

    const duration = Date.now() - startTime;

    return {
      ...state,
      processedImage: restoredImage,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          colorRestorer: Date.now()
        }
      }
    };

  } catch (error: any) {
    log.warn({ err: error.message }, 'Color restoration failed, continuing');
    return {
      ...state,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          colorRestorer: Date.now()
        }
      }
    };
  }
}

/**
 * Quality Validator Agent (Agent 7)
 * Quick quality check to determine if retry is needed
 */
async function qualityValidatorAgent(state: FabricAgentState): Promise<FabricAgentState> {

  // For now, pass through - detailed validation in Critique Agent
  // This could be expanded for fast-fail on obvious issues

  return {
    ...state,
    metadata: {
      ...state.metadata,
      timestamps: {
        ...state.metadata.timestamps,
        qualityValidator: Date.now()
      }
    }
  };
}

/**
 * ThreadLogic Orchestrator
 * Executes 10-agent DAG pipeline for fabric/textile processing
 * V2.0: Added upscaling and fabric polish for crisp, jewelry-quality output
 */
export class ThreadLogicOrchestrator {
  private nodes: Map<string, FabricWorkflowNode>;
  private qualityThreshold: number;
  private maxRetries: number;

  constructor(options?: { qualityThreshold?: number; maxRetries?: number }) {
    this.qualityThreshold = options?.qualityThreshold ?? 0.85;
    this.maxRetries = options?.maxRetries ?? 2;

    // Initialize agent nodes (10 agents in v2.0)
    this.nodes = new Map<string, FabricWorkflowNode>([
      ['fabric_classifier', fabricClassifierAgent],
      ['texture_sentry', textureSentryAgent],
      ['print_guardian', printGuardianAgent],
      ['edge_softener', edgeSoftenerAgent],
      ['lighting_normalizer', lightingNormalizerAgent],
      ['color_restorer', colorRestorerAgent],
      ['upscaler', upscalerAgent],           // Multi-step Lanczos3 upscaling
      ['fabric_color_restorer', fabricColorRestorerAgent], // Post-upscale moiré fix (mirrors GemPerfect)
      ['fabric_polish', fabricPolishAgent],  // Final fabric-specific polish
      ['quality_validator', qualityValidatorAgent],
      ['critique_agent', critiqueAgent]
    ]);
  }

  /**
   * Execute the ThreadLogic pipeline
   *
   * @param job - Fabric processing job from queue
   * @returns Pipeline result with processed image and metrics
   */
  async execute(job: FabricJob): Promise<FabricPipelineResult> {
    // Overall ThreadLogic pipeline timeout (3 minutes) — prevents infinite hangs
    const THREADLOGIC_TIMEOUT_MS = 3 * 60 * 1000;

    const startTime = Date.now();

    // Initialize state
    let state: FabricAgentState = {
      originalImage: typeof job.inputImage === 'string'
        ? Buffer.from(job.inputImage, 'base64')
        : job.inputImage,
      processedImage: job.cleanEdgeOutput,
      cleanEdgeOutput: job.cleanEdgeOutput,
      photographyType: job.photographyType || 'flatlay',
      qualityScore: 0,
      metadata: {
        complexity: 0,
        retryCount: 0,
        timestamps: {
          start: startTime
        },
        costs: {
          geminiCalls: 0,
          totalApiCost: 0
        }
      }
    };

    try {
      log.info({ photographyType: state.photographyType }, 'ThreadLogic pipeline started');

      // Phase 1: Classification
      state = await this.nodes.get('fabric_classifier')!(state);

      // Phase 2: Analysis (parallel)

      // Run texture and print analysis in parallel
      const [textureState, printState] = await Promise.all([
        this.nodes.get('texture_sentry')!(state),
        this.nodes.get('print_guardian')!(state)
      ]);

      // Merge parallel results
      state = {
        ...state,
        textureMetrics: textureState.textureMetrics,
        printRegions: printState.printRegions,
        fabricAnalysis: printState.fabricAnalysis || state.fabricAnalysis,
        metadata: {
          ...state.metadata,
          complexity: Math.max(
            textureState.metadata.complexity,
            printState.metadata.complexity
          ),
          timestamps: {
            ...state.metadata.timestamps,
            textureSentry: textureState.metadata.timestamps.textureSentry,
            printGuardian: printState.metadata.timestamps.printGuardian
          }
        }
      };

      // Phase 3: Processing with retry loop
      let attempts = 0;
      let passed = false;

      while (attempts < this.maxRetries && !passed) {
        // Check ThreadLogic pipeline timeout
        if (Date.now() - startTime > THREADLOGIC_TIMEOUT_MS) {
          log.error({ elapsedMs: Date.now() - startTime }, 'ThreadLogic pipeline exceeded 3-minute timeout');
          throw new Error('ThreadLogic pipeline timed out after 3 minutes');
        }

        if (attempts > 0) {
          state.metadata.retryCount = attempts;

          // Reset processed image to CleanEdge output for retry
          state.processedImage = state.cleanEdgeOutput;
        }

        // Phase 3a: Edge Softening v2 (Gaussian anti-aliasing)
        state = await this.nodes.get('edge_softener')!(state);

        // Phase 3b: Lighting Normalization
        state = await this.nodes.get('lighting_normalizer')!(state);

        // Phase 3c: Color Restoration (print regions)
        state = await this.nodes.get('color_restorer')!(state);

        // Phase 3d: Upscaling (multi-step Lanczos3 for crisp output)
        state = await this.nodes.get('upscaler')!(state);

        // Phase 3d.5: Fabric Color Restoration (post-upscale moiré elimination)
        // Same technique as GemPerfect: blend 80% original colors back to kill Lanczos3 artifacts
        state = await this.nodes.get('fabric_color_restorer')!(state);

        // Phase 3e: Fabric Polish (final refinement)
        state = await this.nodes.get('fabric_polish')!(state);

        // Phase 3f: Quality Validation
        state = await this.nodes.get('quality_validator')!(state);

        // Phase 5: Critique (Chain-of-Verification)
        state = await this.nodes.get('critique_agent')!(state);

        // Check if quality threshold met
        if (state.qualityScore >= this.qualityThreshold) {
          passed = true;
          log.info({ qualityScore: state.qualityScore, attempts: attempts + 1 }, 'ThreadLogic quality passed');
        } else {
          attempts++;
          if (attempts < this.maxRetries) {
            log.warn({ qualityScore: state.qualityScore, attempt: attempts }, 'ThreadLogic quality retry');
          }
        }
      }

      // Finalize result
      const totalTime = Date.now() - startTime;

      return {
        buffer: state.processedImage,
        qualityScore: state.qualityScore,
        metrics: state.qualityMetrics!,
        fabricAnalysis: state.fabricAnalysis!,
        metadata: state.metadata,
        processingTime: totalTime,
        approved: passed,
        critiqueFeedback: passed ? undefined : 'Quality below threshold after max retries'
      };

    } catch (error: any) {
      log.error({ err: error }, 'ThreadLogic pipeline failed');

      const totalTime = Date.now() - startTime;

      return {
        buffer: state.cleanEdgeOutput, // Return CleanEdge output on failure
        qualityScore: 0,
        metrics: {
          overallQuality: 0,
          edgeQuality: 0,
          texturePreservation: 0,
          printFidelity: 0,
          colorAccuracy: 0,
          drapePreservation: 0,
          diagnostics: {
            smoothingArtifacts: 0,
            printDistortion: 1,
            colorShiftDeltaE: 100,
            lostTexturePercent: 100
          }
        },
        fabricAnalysis: state.fabricAnalysis || {
          category: 'unknown',
          specificType: 'unknown',
          drapeFactor: 0.5,
          textureComplexity: 0.5,
          reflectivity: 0,
          printType: 'none',
          printCoverage: 0,
          confidence: 0
        },
        metadata: state.metadata,
        processingTime: totalTime,
        approved: false,
        critiqueFeedback: `Pipeline failed: ${error.message}`
      };
    }
  }
}

/**
 * Integration with CleanEdge
 * This function is called by the main background removal orchestrator
 * when a clothing/fashion product is detected
 *
 * @param cleanEdgeOutput - Output from CleanEdge background removal
 * @param originalImage - Original input image
 * @param jobId - Job identifier
 * @param userId - User identifier
 * @returns ThreadLogic processed result
 */
export async function processWithThreadLogic(
  cleanEdgeOutput: Buffer,
  originalImage: Buffer,
  jobId: string,
  userId: string,
  options?: {
    photographyType?: 'flatlay' | 'mannequin' | 'on_model' | 'hanging';
    qualityThreshold?: number;
  }
): Promise<FabricPipelineResult> {

  const orchestrator = new ThreadLogicOrchestrator({
    qualityThreshold: options?.qualityThreshold ?? 0.85
  });

  const job: FabricJob = {
    jobId,
    userId,
    inputImage: originalImage,
    cleanEdgeOutput,
    photographyType: options?.photographyType,
    qualityThreshold: options?.qualityThreshold,
    createdAt: Date.now()
  };

  return orchestrator.execute(job);
}
