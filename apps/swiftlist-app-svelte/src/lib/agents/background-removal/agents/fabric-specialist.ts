/**
 * Agent 8: Fabric Specialist (ThreadLogic Integration)
 *
 * Wrapper agent that routes clothing/fashion products through
 * the ThreadLogic Fabric Engine for specialized processing.
 *
 * This agent:
 * 1. Takes CleanEdge output (background-removed image)
 * 2. Passes it through ThreadLogic 8-agent pipeline
 * 3. Returns enhanced image with fabric-specific optimizations
 *
 * ThreadLogic features:
 * - Texture preservation (anti-smoothing)
 * - Print/logo protection (zero distortion)
 * - Fabric-aware edge softening
 * - Photoroom-style lighting normalization
 * - Chain-of-Verification quality checks
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

import type { AgentState } from '../types';
import { processWithThreadLogic } from '../../fabric-engine';

/**
 * Fabric Specialist Agent
 *
 * Routes clothing products through ThreadLogic for fabric-specific
 * enhancements AFTER standard background removal.
 *
 * @param state - Current pipeline state (after CleanEdge background removal)
 * @returns Updated state with ThreadLogic enhancements applied
 */
export async function fabricSpecialistAgent(state: AgentState): Promise<AgentState> {

  const startTime = Date.now();

  try {
    // Generate job ID for ThreadLogic
    const jobId = `tl-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const userId = 'test-user'; // Will be replaced with actual user ID in production

    // Process through ThreadLogic
    const threadLogicResult = await processWithThreadLogic(
      state.processedImage,  // CleanEdge output (background removed)
      state.originalImage,   // Original image for reference
      jobId,
      userId,
      {
        photographyType: 'flatlay', // V1.0 default - flatlay only
        qualityThreshold: 0.85
      }
    );

    const duration = Date.now() - startTime;

    // Log results

    if (threadLogicResult.critiqueFeedback) {
    }

    // Update state with ThreadLogic results
    return {
      ...state,
      processedImage: threadLogicResult.buffer,
      qualityScore: threadLogicResult.qualityScore,
      threadLogicResult,
      metadata: {
        ...state.metadata,
        usedThreadLogic: true,
        timestamps: {
          ...state.metadata.timestamps,
          fabricSpecialist: Date.now()
        }
      }
    };

  } catch (error: any) {

    // On error, return state without ThreadLogic enhancements
    // The CleanEdge output is still valid
    return {
      ...state,
      metadata: {
        ...state.metadata,
        usedThreadLogic: false,
        timestamps: {
          ...state.metadata.timestamps,
          fabricSpecialist: Date.now()
        }
      }
    };
  }
}
