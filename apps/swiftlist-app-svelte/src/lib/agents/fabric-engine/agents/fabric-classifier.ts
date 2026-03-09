/**
 * ThreadLogic Agent 1: Fabric Classifier
 *
 * First agent in the pipeline. Uses Gemini 2.5 Flash Vision to classify:
 * - Fabric category (opaque_woven, knit, leather, metallic)
 * - Photography type (flatlay, mannequin, on_model, hanging)
 * - Specific fabric type (denim, cashmere, leather, etc.)
 * - Drape and texture properties
 *
 * Cost: ~$0.001 per classification (Gemini 2.5 Flash)
 *
 * @author SwiftList Team
 * @version 1.0.0
 */

import type { FabricAgentState, FabricAnalysis, FabricCategory, PhotographyType, PrintType } from '../types';
import { agentsLogger } from '$lib/utils/logger';

const log = agentsLogger.child({ pipeline: 'fabric-engine', agent: 'fabric-classifier' });


/**
 * Call Gemini 2.5 Flash Vision API for fabric classification
 */
async function classifyWithGemini(
  imageBase64: string,
  apiKey: string
): Promise<FabricAnalysis> {
  const prompt = `Analyze this clothing/textile product image and provide a JSON classification:

{
  "category": "opaque_woven" | "knit" | "leather" | "metallic" | "unknown",
  "specificType": "string (e.g., denim, cashmere, silk, cotton, polyester, leather, suede, sequin)",
  "drapeFactor": 0.0-1.0 (0=stiff like denim, 1=fluid like silk),
  "textureComplexity": 0.0-1.0 (0=smooth, 1=highly textured like cable knit),
  "reflectivity": 0.0-1.0 (0=matte, 1=highly reflective like sequins),
  "printType": "screen_print" | "embroidery" | "woven_pattern" | "sublimation" | "none",
  "printCoverage": 0-100 (percentage of fabric covered by print),
  "photographyType": "flatlay" | "mannequin" | "on_model" | "hanging"
}

Category definitions:
- opaque_woven: Denim, cotton twill, canvas, linen, chambray
- knit: Sweaters, jersey, ribbed, fleece, terry cloth
- leather: Real leather, faux leather, suede, patent
- metallic: Sequins, metallic thread, lamé, holographic

Be precise. Output ONLY valid JSON, no explanation.`;

  // 30-second timeout — Gemini Flash is fast, if it stalls we fall back
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
          ]
        }],
        generationConfig: {
          temperature: 0.2, // Low temp for consistent classification
          maxOutputTokens: 500,
        }
      })
    }
  ).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('No response from Gemini');
  }

  // Extract JSON from response
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse Gemini response as JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate and return
  return {
    category: validateCategory(parsed.category),
    specificType: parsed.specificType || 'unknown',
    drapeFactor: clamp(parsed.drapeFactor || 0.5, 0, 1),
    textureComplexity: clamp(parsed.textureComplexity || 0.5, 0, 1),
    reflectivity: clamp(parsed.reflectivity || 0, 0, 1),
    printType: validatePrintType(parsed.printType),
    printCoverage: clamp(parsed.printCoverage || 0, 0, 100),
    confidence: 0.9 // Gemini typically high confidence
  };
}

function validateCategory(cat: string): FabricCategory {
  const valid: FabricCategory[] = ['opaque_woven', 'knit', 'leather', 'metallic', 'unknown'];
  return valid.includes(cat as FabricCategory) ? cat as FabricCategory : 'unknown';
}

function validatePrintType(type: string): PrintType {
  const valid: PrintType[] = ['screen_print', 'embroidery', 'woven_pattern', 'sublimation', 'none'];
  return valid.includes(type as PrintType) ? type as PrintType : 'none';
}

function validatePhotographyType(type: string): PhotographyType {
  const valid: PhotographyType[] = ['flatlay', 'mannequin', 'on_model', 'hanging'];
  return valid.includes(type as PhotographyType) ? type as PhotographyType : 'flatlay';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Fallback classification using basic image analysis
 * Used when Gemini API fails or is unavailable
 */
async function fallbackClassification(): Promise<FabricAnalysis> {
  return {
    category: 'opaque_woven', // Safe default
    specificType: 'cotton',
    drapeFactor: 0.5,
    textureComplexity: 0.5,
    reflectivity: 0.1,
    printType: 'none',
    printCoverage: 0,
    confidence: 0.3 // Low confidence for fallback
  };
}

/**
 * Fabric Classifier Agent
 *
 * First agent in ThreadLogic pipeline. Classifies fabric type,
 * photography style, and texture properties to guide downstream agents.
 *
 * @param state - Current pipeline state
 * @param apiKey - Gemini API key (GOOGLE_GEMINI_API_KEY), passed from caller (+server.ts)
 * @returns Updated state with fabric analysis
 */
export async function fabricClassifierAgent(state: FabricAgentState, apiKey?: string): Promise<FabricAgentState> {

  const startTime = Date.now();

  try {
    if (!apiKey) {
      const fallback = await fallbackClassification();
      return updateStateWithAnalysis(state, fallback, startTime, 0);
    }

    // Convert image to base64
    const imageBase64 = state.originalImage.toString('base64');

    const analysis = await classifyWithGemini(imageBase64, apiKey);

    // Estimate API cost (~$0.001 per Gemini Flash call)
    const apiCost = 0.001;

    return updateStateWithAnalysis(state, analysis, startTime, apiCost);

  } catch (error: any) {
    log.error({ err: error.message }, 'Fabric classification failed');

    const fallback = await fallbackClassification();
    return updateStateWithAnalysis(state, fallback, startTime, 0);
  }
}

function updateStateWithAnalysis(
  state: FabricAgentState,
  analysis: FabricAnalysis,
  startTime: number,
  apiCost: number
): FabricAgentState {
  const duration = Date.now() - startTime;

  return {
    ...state,
    fabricAnalysis: analysis,
    metadata: {
      ...state.metadata,
      complexity: Math.max(
        analysis.textureComplexity,
        analysis.printCoverage / 100,
        state.metadata.complexity
      ),
      timestamps: {
        ...state.metadata.timestamps,
        fabricClassifier: Date.now()
      },
      costs: {
        geminiCalls: state.metadata.costs.geminiCalls + 1,
        totalApiCost: state.metadata.costs.totalApiCost + apiCost
      }
    }
  };
}
