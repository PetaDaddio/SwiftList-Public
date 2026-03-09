/**
 * ThreadLogic Agent 8: Critique Agent
 *
 * Chain-of-Verification step that validates output against:
 * 1. CleanEdge edge quality standards
 * 2. Original texture preservation
 * 3. Print/logo integrity
 * 4. Color fidelity
 * 5. Drape/fold realism
 *
 * This agent acts as a "quality gate" - if output doesn't meet standards,
 * it provides specific feedback for retry.
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

import sharp from 'sharp';
import type { FabricAgentState, CritiqueResult, FabricQualityMetrics } from '../types';
import { verifyTexturePreservation } from './texture-sentry';
import { verifyPrintIntegrity } from './print-guardian';
import { agentsLogger } from '$lib/utils/logger';

const log = agentsLogger.child({ pipeline: 'fabric-engine', agent: 'critique-agent' });


/**
 * Calculate color fidelity between original and processed
 * Uses simplified Delta E approximation
 */
async function calculateColorFidelity(
  originalImage: Buffer,
  processedImage: Buffer
): Promise<{ score: number; avgDeltaE: number }> {
  try {
    const original = sharp(originalImage);
    const processed = sharp(processedImage);

    const { width, height } = await original.metadata();

    const { data: origData } = await original
      .resize(width!, height!, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: procData } = await processed
      .resize(width!, height!, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let totalDeltaE = 0;
    let count = 0;

    // Sample pixels for color comparison
    for (let i = 0; i < origData.length; i += 16) { // Sample every 4th pixel
      const origAlpha = origData[i + 3];
      const procAlpha = procData[i + 3];

      // Only compare opaque pixels in both images
      if (origAlpha < 200 || procAlpha < 200) continue;

      // Simplified Delta E (CIE76 approximation)
      const dr = origData[i] - procData[i];
      const dg = origData[i + 1] - procData[i + 1];
      const db = origData[i + 2] - procData[i + 2];

      const deltaE = Math.sqrt(dr * dr + dg * dg + db * db);
      totalDeltaE += deltaE;
      count++;
    }

    if (count === 0) {
      return { score: 1.0, avgDeltaE: 0 };
    }

    const avgDeltaE = totalDeltaE / count;

    // Score: deltaE < 5 is imperceptible, > 20 is very different
    const score = Math.max(0, 1 - (avgDeltaE / 30));

    return { score, avgDeltaE };

  } catch (error) {
    log.error({ err: error }, 'Color fidelity check failed');
    return { score: 0.7, avgDeltaE: 15 };
  }
}

/**
 * Check edge quality against CleanEdge standards
 * Uses Laplacian variance on alpha channel
 */
async function checkEdgeConsistency(
  cleanEdgeOutput: Buffer,
  finalOutput: Buffer
): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Extract alpha channels
    const cleanEdgeAlpha = await sharp(cleanEdgeOutput)
      .extractChannel(3)
      .raw()
      .toBuffer();

    const finalAlpha = await sharp(finalOutput)
      .extractChannel(3)
      .raw()
      .toBuffer();

    // Compare alpha channel variance (edge sharpness)
    let cleanEdgeVariance = 0;
    let finalVariance = 0;

    for (let i = 1; i < cleanEdgeAlpha.length - 1; i++) {
      cleanEdgeVariance += Math.abs(cleanEdgeAlpha[i] - cleanEdgeAlpha[i - 1]);
      finalVariance += Math.abs(finalAlpha[i] - finalAlpha[i - 1]);
    }

    cleanEdgeVariance /= cleanEdgeAlpha.length;
    finalVariance /= finalAlpha.length;

    // Edge preservation ratio
    const edgeRatio = cleanEdgeVariance > 0 ? finalVariance / cleanEdgeVariance : 1;

    if (edgeRatio < 0.7) {
      issues.push('Edge sharpness significantly reduced from CleanEdge output');
    } else if (edgeRatio > 1.5) {
      issues.push('Edge artifacts introduced (over-sharpening)');
    }

    const score = Math.min(1, Math.max(0, 1 - Math.abs(1 - edgeRatio)));

    return { score, issues };

  } catch (error) {
    log.error({ err: error }, 'Edge consistency check failed');
    return { score: 0.7, issues: ['Edge consistency verification failed'] };
  }
}

/**
 * Verify drape/fold preservation
 * Folds should not be flattened or exaggerated
 */
async function checkDrapePreservation(
  originalImage: Buffer,
  processedImage: Buffer
): Promise<{ score: number; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Convert both to grayscale for fold analysis
    const { data: origGray, info: origInfo } = await sharp(originalImage)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: procGray } = await sharp(processedImage)
      .resize(origInfo.width, origInfo.height, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate local contrast (fold indicator)
    let origContrast = 0;
    let procContrast = 0;

    const blockSize = 8;
    let blockCount = 0;

    for (let by = 0; by < origInfo.height - blockSize; by += blockSize) {
      for (let bx = 0; bx < origInfo.width - blockSize; bx += blockSize) {
        let origMin = 255, origMax = 0;
        let procMin = 255, procMax = 0;

        for (let y = by; y < by + blockSize; y++) {
          for (let x = bx; x < bx + blockSize; x++) {
            const idx = y * origInfo.width + x;
            origMin = Math.min(origMin, origGray[idx]);
            origMax = Math.max(origMax, origGray[idx]);
            procMin = Math.min(procMin, procGray[idx]);
            procMax = Math.max(procMax, procGray[idx]);
          }
        }

        origContrast += (origMax - origMin);
        procContrast += (procMax - procMin);
        blockCount++;
      }
    }

    if (blockCount === 0) {
      return { score: 1.0, issues: [] };
    }

    origContrast /= blockCount;
    procContrast /= blockCount;

    // Drape preservation ratio
    const drapeRatio = origContrast > 5 ? procContrast / origContrast : 1;

    if (drapeRatio < 0.6) {
      issues.push('Fabric folds/drapes appear flattened');
    } else if (drapeRatio > 1.4) {
      issues.push('Fabric folds/drapes appear exaggerated');
    }

    const score = Math.min(1, Math.max(0, 1 - Math.abs(1 - drapeRatio) * 0.8));

    return { score, issues };

  } catch (error) {
    log.error({ err: error }, 'Drape preservation check failed');
    return { score: 0.7, issues: ['Drape verification failed'] };
  }
}

/**
 * Critique Agent
 *
 * Final quality validation step. Checks output against all standards
 * and provides specific feedback for improvements.
 *
 * @param state - Current pipeline state (final output)
 * @returns Updated state with critique results and final quality score
 */
export async function critiqueAgent(state: FabricAgentState): Promise<FabricAgentState> {

  const startTime = Date.now();

  const issues: CritiqueResult['issues'] = [];
  const recommendations: string[] = [];

  try {

    // 1. Edge Consistency (vs CleanEdge)
    const edgeResult = await checkEdgeConsistency(state.cleanEdgeOutput, state.processedImage);
    issues.push(...edgeResult.issues.map(issue => ({
      type: 'edge_artifact' as const,
      severity: 'moderate' as const,
      description: issue
    })));

    // 2. Texture Preservation
    let textureScore = 1.0;
    if (state.textureMetrics) {
      const textureResult = await verifyTexturePreservation(state.textureMetrics, state.processedImage);
      textureScore = textureResult.score;
      issues.push(...textureResult.issues.map(issue => ({
        type: 'smoothing' as const,
        severity: textureResult.score < 0.5 ? 'critical' as const : 'moderate' as const,
        description: issue
      })));
    }

    // 3. Print Integrity
    let printScore = 1.0;
    if (state.printRegions && state.printRegions.length > 0) {
      const printResult = await verifyPrintIntegrity(
        state.originalImage,
        state.processedImage,
        state.printRegions
      );
      printScore = printResult.score;
      issues.push(...printResult.issues.map(issue => ({
        type: 'print_distortion' as const,
        severity: printResult.score < 0.5 ? 'critical' as const : 'moderate' as const,
        description: issue
      })));
    }

    // 4. Color Fidelity
    const colorResult = await calculateColorFidelity(state.originalImage, state.processedImage);
    if (colorResult.avgDeltaE > 15) {
      issues.push({
        type: 'color_shift',
        severity: colorResult.avgDeltaE > 25 ? 'critical' : 'moderate',
        description: `Color shifted by ΔE=${colorResult.avgDeltaE.toFixed(1)} (threshold: 15)`
      });
    }

    // 5. Drape Preservation
    const drapeResult = await checkDrapePreservation(state.originalImage, state.processedImage);
    issues.push(...drapeResult.issues.map(issue => ({
      type: 'drape_loss' as const,
      severity: 'moderate' as const,
      description: issue
    })));

    // Compile scores
    const scores: CritiqueResult['scores'] = {
      edgeConsistency: edgeResult.score,
      texturePreservation: textureScore,
      printIntegrity: printScore,
      colorFidelity: colorResult.score,
      drapeRealism: drapeResult.score
    };

    // Calculate overall quality score (weighted average)
    const weights = {
      edgeConsistency: 0.15,
      texturePreservation: 0.25,
      printIntegrity: 0.30, // Highest weight - prints are critical
      colorFidelity: 0.20,
      drapeRealism: 0.10
    };

    const overallQuality =
      scores.edgeConsistency * weights.edgeConsistency +
      scores.texturePreservation * weights.texturePreservation +
      scores.printIntegrity * weights.printIntegrity +
      scores.colorFidelity * weights.colorFidelity +
      scores.drapeRealism * weights.drapeRealism;

    // Generate recommendations for issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const moderateIssues = issues.filter(i => i.severity === 'moderate');

    if (criticalIssues.length > 0) {
      recommendations.push('CRITICAL issues found - retry with adjusted parameters');
      for (const issue of criticalIssues) {
        if (issue.type === 'smoothing') {
          recommendations.push('→ Reduce smoothing/feathering parameters');
        } else if (issue.type === 'print_distortion') {
          recommendations.push('→ Enable strict print preservation mode');
        } else if (issue.type === 'color_shift') {
          recommendations.push('→ Increase color anchor density');
        }
      }
    }

    // Determine pass/fail
    const passed = overallQuality >= 0.85 && criticalIssues.length === 0;

    // Compile critique result
    const critiqueResult: CritiqueResult = {
      passed,
      scores,
      issues,
      recommendations
    };

    // Compile quality metrics
    const qualityMetrics: FabricQualityMetrics = {
      overallQuality,
      edgeQuality: scores.edgeConsistency,
      texturePreservation: scores.texturePreservation,
      printFidelity: scores.printIntegrity,
      colorAccuracy: scores.colorFidelity,
      drapePreservation: scores.drapeRealism,
      diagnostics: {
        smoothingArtifacts: issues.filter(i => i.type === 'smoothing').length,
        printDistortion: 1 - scores.printIntegrity,
        colorShiftDeltaE: colorResult.avgDeltaE,
        lostTexturePercent: (1 - scores.texturePreservation) * 100
      }
    };

    // Log results

    if (issues.length > 0) {
    }

    if (recommendations.length > 0) {
      for (const rec of recommendations) {
      }
    }

    const duration = Date.now() - startTime;

    return {
      ...state,
      qualityScore: overallQuality,
      qualityMetrics,
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          critiqueAgent: Date.now()
        }
      }
    };

  } catch (error: any) {
    log.error({ err: error.message }, 'Critique agent failed');

    return {
      ...state,
      qualityScore: 0.5, // Unknown quality
      metadata: {
        ...state.metadata,
        timestamps: {
          ...state.metadata.timestamps,
          critiqueAgent: Date.now()
        }
      }
    };
  }
}
