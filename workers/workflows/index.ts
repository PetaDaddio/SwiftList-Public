/**
 * SwiftList Workflow Registry
 *
 * Central registry for all 27 workflow classes
 * Automatically imports and exports all workflow implementations
 */

// Phase 1: Core Infrastructure (CRITICAL)
export { DeciderWorkflow } from './WF-01-decider';
export { BillingTopUpWorkflow } from './WF-26-billing-topup';
export { ReferralEngineWorkflow } from './WF-27-referral-engine';
export { BackgroundRemovalWorkflow } from './WF-07-background-removal';

// Phase 2: Essential Product Engines
export { GeneralGoodsEngineWorkflow } from './WF-06-general-goods-engine';
export { SimplifyBgWorkflow } from './WF-08-simplify-bg';
export { JewelryPrecisionEngineWorkflow } from './WF-02-jewelry-precision-engine';
export { FashionApparelEngineWorkflow } from './WF-03-fashion-apparel-engine';
export { GlassRefractionEngineWorkflow } from './WF-04-glass-refraction-engine';
export { FurnitureSpatialEngineWorkflow } from './WF-05-furniture-spatial-engine';

// Phase 3: Content Generation Suite
export { ProductDescriptionWorkflow } from './WF-10-product-description';
export { TwitterPostGeneratorWorkflow } from './WF-11-twitter-post-generator';
export { InstagramPostGeneratorWorkflow } from './WF-12-instagram-post-generator';
export { FacebookPostGeneratorWorkflow } from './WF-13-facebook-post-generator';
export { SEOBlogPostWorkflow } from './WF-20-seo-blog-post';

// Phase 4: Image Enhancement Tools
export { LifestyleSettingWorkflow } from './WF-09-lifestyle-setting';
export { HighResUpscaleWorkflow } from './WF-14-high-res-upscale';
export { ProductCollageWorkflow } from './WF-19-product-collage';
export { VectorModelGraphicWorkflow } from './WF-15-vector-model-graphic';
export { CreateSVGFromImageWorkflow } from './WF-16-create-svg-from-image';

// Phase 5: Advanced Features
export { GeneratePresetWorkflow } from './WF-17-generate-preset';
export { AnimatedProductWorkflow } from './WF-18-animated-product';
export { YouTubeToTikTokWorkflow } from './WF-21-youtube-to-tiktok';
export { BlogToYouTubeWorkflow } from './WF-22-blog-to-youtube';

// Phase 6: Marketplace & Operations
export { MarketOptimizerWorkflow } from './WF-23-market-optimizer';
export { EbayComplianceWorkflow } from './WF-25-ebay-compliance';
export { LifeguardAuditWorkflow } from './WF-24-lifeguard-audit';

/**
 * Workflow Registry Map
 * Maps workflow IDs to their implementation classes
 */
import { BaseWorkflow } from '../base-workflow';

export const WORKFLOW_REGISTRY: Record<string, typeof BaseWorkflow> = {
  // Phase 1
  'WF-01': DeciderWorkflow as any,
  'WF-26': BillingTopUpWorkflow as any,
  'WF-27': ReferralEngineWorkflow as any,
  'WF-07': BackgroundRemovalWorkflow as any,

  // Phase 2
  'WF-06': GeneralGoodsEngineWorkflow as any,
  'WF-08': SimplifyBgWorkflow as any,
  'WF-02': JewelryPrecisionEngineWorkflow as any,
  'WF-03': FashionApparelEngineWorkflow as any,
  'WF-04': GlassRefractionEngineWorkflow as any,
  'WF-05': FurnitureSpatialEngineWorkflow as any,

  // Phase 3
  'WF-10': ProductDescriptionWorkflow as any,
  'WF-11': TwitterPostGeneratorWorkflow as any,
  'WF-12': InstagramPostGeneratorWorkflow as any,
  'WF-13': FacebookPostGeneratorWorkflow as any,
  'WF-20': SEOBlogPostWorkflow as any,

  // Phase 4
  'WF-09': LifestyleSettingWorkflow as any,
  'WF-14': HighResUpscaleWorkflow as any,
  'WF-19': ProductCollageWorkflow as any,
  'WF-15': VectorModelGraphicWorkflow as any,
  'WF-16': CreateSVGFromImageWorkflow as any,

  // Phase 5
  'WF-17': GeneratePresetWorkflow as any,
  'WF-18': AnimatedProductWorkflow as any,
  'WF-21': YouTubeToTikTokWorkflow as any,
  'WF-22': BlogToYouTubeWorkflow as any,

  // Phase 6
  'WF-23': MarketOptimizerWorkflow as any,
  'WF-25': EbayComplianceWorkflow as any,
  'WF-24': LifeguardAuditWorkflow as any,
};

/**
 * Get workflow class by workflow ID
 */
export function getWorkflowClass(workflowId: string): typeof BaseWorkflow | null {
  return WORKFLOW_REGISTRY[workflowId] || null;
}

/**
 * Check if workflow ID exists
 */
export function isValidWorkflowId(workflowId: string): boolean {
  return workflowId in WORKFLOW_REGISTRY;
}

/**
 * Get all available workflow IDs
 */
export function getAllWorkflowIds(): string[] {
  return Object.keys(WORKFLOW_REGISTRY);
}
