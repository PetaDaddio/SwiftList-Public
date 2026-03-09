/**
 * Workflow Registry - Configuration for all 47 SwiftList workflows
 *
 * Maps workflow IDs to queue names, workers, and cost estimates
 */

export interface WorkflowDefinition {
  workflowId: string;
  name: string;
  queueName: string;
  workerClass: string;
  estimatedCostUsd: number;
  estimatedDurationMs: number;
  maxRetries: number;
  timeout: number; // milliseconds
  priority: number; // 1-10
  providers: string[]; // AI providers used
}

/**
 * Workflow Registry
 *
 * NOTE: Only WF-04 is fully implemented for MVP.
 * Remaining 46 workflows will be converted in phases.
 */
export const workflowRegistry: Record<string, WorkflowDefinition> = {
  // ===== PHASE 1: MVP CRITICAL =====

  'WF-04': {
    workflowId: 'WF-04',
    name: 'Background Removal',
    queueName: 'background-removal',
    workerClass: 'BackgroundRemovalWorker',
    estimatedCostUsd: 0.0023,
    estimatedDurationMs: 3000,
    maxRetries: 3,
    timeout: 30000,
    priority: 10,
    providers: ['replicate'], // NEVER use Photoroom (competitor)
  },

  // ===== PHASE 2: CORE FEATURES =====

  'WF-06': {
    workflowId: 'WF-06',
    name: 'General Goods Engine',
    queueName: 'general-goods',
    workerClass: 'GeneralGoodsWorker',
    estimatedCostUsd: 0.004, // Gemini 3 (Imagen 3) - PRIMARY image generation
    estimatedDurationMs: 4000,
    maxRetries: 3,
    timeout: 30000,
    priority: 8,
    providers: ['gemini'], // Google Gemini 3 (Imagen 3) - superior quality, 73% cheaper than SDXL
  },

  'WF-07': {
    workflowId: 'WF-07',
    name: 'Background Removal (High Quality)',
    queueName: 'background-removal',
    workerClass: 'BackgroundRemovalWorker',
    estimatedCostUsd: 0.018, // Bria RMBG 2.0 via fal.ai - PREMIUM QUALITY (256-level transparency)
    estimatedDurationMs: 4000,
    maxRetries: 3,
    timeout: 30000,
    priority: 10, // CRITICAL - feeds downstream workflows (WF-08, WF-09, etc.)
    providers: ['fal'], // Bria RMBG 2.0 - professional grade, non-binary alpha masks
    // NOTE: ClipDrop/Jasper requires Business plan (not viable for MVP)
    // NOTE: NEVER use Photoroom (competitor)
  },

  'WF-09': {
    workflowId: 'WF-09',
    name: 'Lifestyle Setting',
    queueName: 'lifestyle-setting',
    workerClass: 'LifestyleSettingWorker',
    estimatedCostUsd: 0.008, // Gemini 3 (Imagen 3) img2img mode
    estimatedDurationMs: 6000,
    maxRetries: 3,
    timeout: 35000,
    priority: 7,
    providers: ['gemini'], // Google Gemini 3 (Imagen 3) - 68% cheaper than Stability AI
  },

  'WF-10': {
    workflowId: 'WF-10',
    name: 'Product Description',
    queueName: 'product-description',
    workerClass: 'ProductDescriptionWorker',
    estimatedCostUsd: 0.0015,
    estimatedDurationMs: 2000,
    maxRetries: 3,
    timeout: 20000,
    priority: 9,
    providers: ['claude'],
  },

  'WF-14': {
    workflowId: 'WF-14',
    name: 'High-Res Upscale',
    queueName: 'image-upscale',
    workerClass: 'ImageUpscaleWorker',
    estimatedCostUsd: 0.005,
    estimatedDurationMs: 5000,
    maxRetries: 3,
    timeout: 40000,
    priority: 7,
    providers: ['replicate'],
  },

  'WF-17': {
    workflowId: 'WF-17',
    name: 'Generate Preset',
    queueName: 'preset-generation',
    workerClass: 'PresetGenerationWorker',
    estimatedCostUsd: 0.002,
    estimatedDurationMs: 3000,
    maxRetries: 3,
    timeout: 25000,
    priority: 8,
    providers: ['openai', 'claude'],
  },

  // ===== PHASE 3: SOCIAL MEDIA =====

  'WF-11': {
    workflowId: 'WF-11',
    name: 'Facebook Image',
    queueName: 'facebook-image',
    workerClass: 'FacebookImageWorker',
    estimatedCostUsd: 0.004,
    estimatedDurationMs: 4000,
    maxRetries: 3,
    timeout: 30000,
    priority: 6,
    providers: ['replicate', 'gemini'],
  },

  'WF-12': {
    workflowId: 'WF-12',
    name: 'Instagram Image',
    queueName: 'instagram-image',
    workerClass: 'InstagramImageWorker',
    estimatedCostUsd: 0.004,
    estimatedDurationMs: 4000,
    maxRetries: 3,
    timeout: 30000,
    priority: 6,
    providers: ['replicate', 'gemini'],
  },

  'WF-13': {
    workflowId: 'WF-13',
    name: 'Twitter/X Image',
    queueName: 'twitter-image',
    workerClass: 'TwitterImageWorker',
    estimatedCostUsd: 0.004,
    estimatedDurationMs: 4000,
    maxRetries: 3,
    timeout: 30000,
    priority: 6,
    providers: ['replicate', 'gemini'],
  },

  // ===== REMAINING 40 WORKFLOWS (To be implemented) =====
  // See /docs/n8n-workflows/MASTER_WORKFLOW_ROADMAP.md for full list
};
