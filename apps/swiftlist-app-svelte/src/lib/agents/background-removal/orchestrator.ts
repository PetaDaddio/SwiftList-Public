/**
 * Background Removal Pipeline Orchestrator
 * DAG (Directed Acyclic Graph) executor with conditional branching
 *
 * v2: Added Enhance stage (Clarity Upscaler) before segmentation.
 *     Fallback loops back to segment (not refine_edges) to re-segment
 *     with an alternative version-pinned model.
 */

import type { AgentState, WorkflowNode } from './types';
import { enhanceAgent } from './agents/enhance';
import { preprocessAgent } from './agents/preprocess';
import { segmentationAgent } from './agents/segment';
import { edgeRefinementAgent } from './agents/refine-edges';
import { jewelrySpecialistAgent } from './agents/jewelry-specialist';
import { fabricSpecialistAgent } from './agents/fabric-specialist';
import { generalSpecialistAgent } from './agents/general-specialist';
import { qualityValidationAgent } from './agents/validate-quality';
import { fallbackAgent } from './agents/fallback';
import { postProcessingAgent } from './agents/postprocess';
import { createLogger } from '$lib/utils/logger';

const logger = createLogger('bg-removal-orchestrator');

/**
 * Background Removal Orchestrator
 * Executes 9-agent pipeline with conditional quality-based branching
 *
 * Pipeline Flow (v2 — "Upscale First, Cut Second"):
 * ┌─────────────┐
 * │   Enhance   │  (Clarity Upscaler — skipped if large enough)
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │ Preprocess  │
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │  Segment    │  ◄─── Fallback loops here (re-segment with alt model)
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │ Refine-Edge │  (CleanEdge v2 — universal)
 * └──────┬──────┘
 *        │
 *   Product Type?
 *        ├─JEWELRY──► Jewelry Specialist ──┐
 *        │                                  │
 *        ├─CLOTHING─► Fabric Specialist ───┤
 *        │                                  │
 *        └─OTHER───► General Specialist ──► │
 *                                          │
 *                                 ┌────────▼────────┐
 *                                 │ Validate-Qual   │
 *                                 └────────┬────────┘
 *                                          │
 *                                    Quality ≥0.85?
 *                                          ├─YES─► Postprocess ─► Done
 *                                          │
 *                                          └─NO──► Fallback ──┐
 *                                                             │
 *                                                    (loops to segment)
 */
export class BackgroundRemovalOrchestrator {
  private nodes: Map<string, WorkflowNode>;
  private edges: Map<string, string[]>;

  constructor() {
    // Initialize agent nodes
    this.nodes = new Map([
      ['enhance', enhanceAgent],
      ['preprocess', preprocessAgent],
      ['segment', segmentationAgent],
      ['refine_edges', edgeRefinementAgent],
      ['jewelry_specialist', jewelrySpecialistAgent],
      ['fabric_specialist', fabricSpecialistAgent],
      ['general_specialist', generalSpecialistAgent],
      ['validate_quality', qualityValidationAgent],
      ['fallback', fallbackAgent],
      ['postprocess', postProcessingAgent]
    ]);

    // Define DAG edges (adjacency list)
    this.edges = new Map([
      ['enhance', ['preprocess']],
      ['preprocess', ['segment']],
      ['segment', ['refine_edges']],
      ['refine_edges', ['jewelry_specialist', 'fabric_specialist', 'general_specialist', 'validate_quality']], // Conditional routing
      ['jewelry_specialist', ['validate_quality']],
      ['fabric_specialist', ['validate_quality']],
      ['general_specialist', ['validate_quality']],
      ['validate_quality', ['postprocess', 'fallback']], // Conditional branch
      ['fallback', ['segment']], // Retry loop — re-segment with alt model
      ['postprocess', []] // Terminal node
    ]);
  }

  /**
   * Execute the pipeline
   *
   * @param initialState - Starting state with original image
   * @returns Final state with processed image and quality metrics
   */
  async execute(initialState: AgentState): Promise<AgentState> {
    // Overall pipeline timeout (5 minutes) — prevents infinite hangs from API providers
    const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000;

    // Determine pipeline type based on product
    let pipelineType = 'CleanEdge Universal';
    if (this.isJewelry(initialState.productType)) {
      pipelineType = 'Jewelry + GemPerfect';
    } else if (this.isClothing(initialState.productType)) {
      pipelineType = 'Clothing + ThreadLogic';
    }

    logger.info({ productType: initialState.productType, pipelineType }, 'Pipeline started');

    let state = initialState;
    let currentNode = 'enhance';
    const visited = new Set<string>();
    let iterations = 0;
    const maxIterations = 20; // Safety limit
    let bestResult: AgentState | null = null; // Track best quality result across retries

    while (currentNode && iterations < maxIterations) {
      // Check overall pipeline timeout
      if (Date.now() - initialState.metadata.timestamps.start > PIPELINE_TIMEOUT_MS) {
        logger.error({ elapsedMs: Date.now() - initialState.metadata.timestamps.start }, 'Pipeline exceeded 5-minute timeout');
        throw new Error('Background removal pipeline timed out after 5 minutes');
      }

      // Execute current agent
      const nodeFunction = this.nodes.get(currentNode);

      if (!nodeFunction) {
        throw new Error(`Unknown agent node: ${currentNode}`);
      }

      // Run agent
      const agentStart = Date.now();
      state = await nodeFunction(state);
      logger.debug({ agent: currentNode, durationMs: Date.now() - agentStart }, 'Agent step completed');

      visited.add(currentNode);
      iterations++;

      // Determine next node (conditional branching logic)
      const possibleNext = this.edges.get(currentNode) || [];

      // Terminal node reached
      if (possibleNext.length === 0) {
        break;
      }

      // Conditional branching: refine_edges → specialist based on product type
      if (currentNode === 'refine_edges') {
        const productTypeLower = (state.productType || '').toLowerCase();

        if (this.isJewelry(productTypeLower)) {
          currentNode = 'jewelry_specialist';
        } else if (this.isClothing(productTypeLower)) {
          currentNode = 'fabric_specialist';
        } else {
          currentNode = 'general_specialist';
        }

        logger.info(
          { productType: state.productType, productTypeLower, selectedSpecialist: currentNode },
          'Specialist routing decision'
        );
      }
      // Conditional branching: validate_quality → postprocess OR fallback
      else if (currentNode === 'validate_quality') {
        // Product-type-aware quality thresholds:
        // Jewelry/glass have translucent areas that produce semi-transparent alpha — this is CORRECT
        // behavior but the segmentation scorer penalizes it. Use a lower threshold.
        const qualityThreshold = this.isJewelry(state.productType || '') ? 0.60 : 0.85;
        const qualityMeetsThreshold = state.qualityScore >= qualityThreshold;
        const canRetry = state.metadata.retryCount < 2;
        const usedThreadLogic = state.metadata.usedThreadLogic;

        // Track best result across all attempts — use it if we exhaust retries
        if (!bestResult || state.qualityScore > bestResult.qualityScore) {
          bestResult = { ...state };
        }

        if (qualityMeetsThreshold || usedThreadLogic) {
          logger.info({ qualityScore: state.qualityScore, threshold: qualityThreshold, usedThreadLogic }, 'Quality passed threshold');
          currentNode = 'postprocess';
        } else if (canRetry) {
          logger.warn({ qualityScore: state.qualityScore, threshold: qualityThreshold, retryCount: state.metadata.retryCount }, 'Quality below threshold, retrying');
          currentNode = 'fallback';
        } else {
          // Use best result from all attempts, not just the last one
          if (bestResult && bestResult.qualityScore > state.qualityScore) {
            logger.info({ bestScore: bestResult.qualityScore, lastScore: state.qualityScore }, 'Using best result from earlier attempt');
            state = bestResult;
          }
          logger.warn({ qualityScore: state.qualityScore }, 'Quality below threshold, max retries reached');
          currentNode = 'postprocess';
        }
      }
      // Fallback completes → go back to segment (re-segment with alt model)
      else if (currentNode === 'fallback') {
        currentNode = 'segment';
      }
      // All other nodes: sequential flow
      else {
        currentNode = possibleNext[0];
      }
    }

    // Safety check
    if (iterations >= maxIterations) {
      logger.error({ iterations }, 'Pipeline hit max iteration safety limit');
    }

    // Calculate total processing time
    const totalTime = Date.now() - state.metadata.timestamps.start;
    logger.info({ totalTimeMs: totalTime, qualityScore: state.qualityScore, iterations }, 'Pipeline completed');

    return state;
  }

  /**
   * Check if product type is jewelry
   */
  private isJewelry(productType: string): boolean {
    const jewelryTypes = [
      'jewelry', 'jewellery', 'ring', 'necklace', 'bracelet', 'earring', 'earrings',
      'pendant', 'brooch', 'watch', 'gemstone', 'diamond', 'pearl', 'gold', 'silver',
      'platinum', 'engagement ring', 'wedding ring', 'chain', 'bangle', 'anklet',
      'cufflink', 'cufflinks', 'tiara', 'crown'
    ];
    const typeLower = productType.toLowerCase();
    return jewelryTypes.some(type => typeLower.includes(type));
  }

  /**
   * Check if product type is clothing/fashion
   */
  private isClothing(productType: string): boolean {
    const clothingTypes = [
      'clothing', 'clothes', 'apparel', 'fashion', 'garment', 'outfit',
      'shirt', 'blouse', 'top', 't-shirt', 'tshirt', 'sweater', 'hoodie', 'jacket',
      'coat', 'blazer', 'cardigan', 'vest', 'tank top',
      'pants', 'jeans', 'trousers', 'shorts', 'leggings', 'skirt',
      'dress', 'gown', 'romper', 'jumpsuit',
      'suit', 'tuxedo', 'uniform',
      'underwear', 'lingerie', 'swimwear', 'bikini', 'swimsuit',
      'activewear', 'sportswear', 'athleisure',
      'denim', 'leather jacket', 'knitwear', 'cashmere',
      'fabric', 'textile', 'cotton', 'silk', 'wool', 'polyester',
      'bag', 'handbag', 'purse', 'backpack', 'tote',
      'shoe', 'shoes', 'sneaker', 'boot', 'heel', 'sandal', 'loafer'
    ];
    const typeLower = productType.toLowerCase();
    return clothingTypes.some(type => typeLower.includes(type));
  }
}
