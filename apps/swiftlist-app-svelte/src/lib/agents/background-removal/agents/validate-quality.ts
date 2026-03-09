/**
 * Agent 4: Quality Validation
 * Calculates comprehensive quality metrics to determine if fallback is needed
 */

import type { AgentState } from '../types';
import { assessQuality } from '../utils/quality-metrics';

/**
 * Quality Validation Agent
 *
 * Responsibilities:
 * 1. Calculate edge quality (from Agent 3)
 * 2. Calculate segmentation quality (alpha clarity)
 * 3. Calculate artifact-free score
 * 4. Compute weighted overall quality
 * 5. Update state with quality metrics
 *
 * Quality Formula:
 * Overall = 0.40 × Edge + 0.40 × Segmentation + 0.20 × Artifact-Free
 *
 * @param state - Current pipeline state
 * @returns Updated state with quality scores
 */
export async function qualityValidationAgent(state: AgentState): Promise<AgentState> {

  const startTime = Date.now();

  try {
    // Calculate comprehensive quality metrics
    const metrics = await assessQuality(state.processedImage);

    // Update state with quality metrics
    const updatedState: AgentState = {
      ...state,
      qualityScore: metrics.overallQuality,
      qualityMetrics: metrics,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          validateQuality: Date.now()
        }
      }
    };

    const duration = Date.now() - startTime;

    // Log quality breakdown

    // Determine if fallback is needed
    const needsFallback = metrics.overallQuality < 0.85;
    const canRetry = state.metadata.retryCount < 2;

    if (needsFallback && canRetry) {
    } else if (needsFallback && !canRetry) {
    } else {
    }

    return updatedState;
  } catch (error: any) {

    // On error, assume neutral quality (will trigger fallback if retries available)
    return {
      ...state,
      qualityScore: 0.7,
      qualityMetrics: {
        edgeQuality: 0.7,
        segmentationQuality: 0.7,
        artifactFreeScore: 0.7,
        overallQuality: 0.7
      },
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          validateQuality: Date.now()
        }
      }
    };
  }
}
