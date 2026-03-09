/**
 * SwiftList Jewelry Specialty Logic Module
 *
 * Provides jewelry-specific processing parameters for workflows
 * that need category-aware behavior (WF-07, WF-08, WF-09, WF-10, WF-14, WF-15, WF-16, WF-18, WF-19, WF-21, WF-25)
 *
 * Usage in n8n workflows:
 * const JewelrySpecialty = require('./specialty-logic-modules/JewelrySpecialty.js');
 * const config = JewelrySpecialty.backgroundRemoval(imageUrl);
 */

module.exports = {

  /**
   * WF-07: Background Removal
   * Jewelry needs to preserve metal reflections and gemstone sparkle
   */
  backgroundRemoval: (imageUrl) => ({
    preserveReflections: true,
    edgeFeathering: 0.5,              // Soft edges for gemstones
    minContrast: 0.8,                 // High contrast for clarity
    alphaChannel: 'preserve-specular', // Keep shiny areas
    provider: 'photoroom',             // Best for reflective surfaces
    fallbackProviders: ['removebg', 'clipdrop']
  }),

  /**
   * WF-08: Simplify Background
   * Jewelry pops on high-contrast backgrounds
   */
  simplifyBackground: (imageUrl, targetColor = 'white') => ({
    backgroundColor: targetColor,
    contrastBoost: 1.3,                // Make metal shine
    saturationAdjust: 1.1,             // Enhance gemstone colors
    sharpness: 1.5,                    // Crisp edges
    provider: 'cloudinary',
    transformations: [
      { effect: 'contrast:30' },
      { background: targetColor },
      { quality: 'auto:best' }
    ]
  }),

  /**
   * WF-09: Lifestyle Setting
   * Jewelry looks best in luxury contexts
   */
  lifestyleSetting: (imageUrl) => ({
    context: 'luxury',
    sceneOptions: [
      'jewelry-box-velvet',
      'black-marble-surface',
      'silk-fabric-background',
      'premium-gift-packaging'
    ],
    lighting: {
      type: 'studio',
      intensity: 'high',
      reflections: 'enhanced'
    },
    model: 'flux-1-pro',
    prompt: 'luxury jewelry presentation, velvet jewelry box, professional product photography, studio lighting'
  }),

  /**
   * WF-10: Product Description
   * Jewelry needs specific gemological vocabulary
   */
  productDescription: (imageAnalysis) => ({
    vocabulary: [
      'carat', 'clarity', 'cut', 'color',
      'setting', 'prong', 'band', 'gemstone',
      '14K', '18K', 'white gold', 'yellow gold', 'rose gold',
      'diamond', 'sapphire', 'emerald', 'ruby',
      'engagement', 'wedding', 'anniversary',
      'brilliant', 'princess', 'cushion', 'emerald cut'
    ],
    template: '{metal_type} {product_type} featuring {gemstone_description}. {setting_style} with {carat_weight}ct {gemstone_type}. {quality_descriptors}',
    seoKeywords: [
      'engagement ring',
      'wedding band',
      'diamond jewelry',
      'fine jewelry',
      'luxury jewelry'
    ],
    tone: 'luxury',
    callToAction: 'Timeless elegance for your special moments.'
  }),

  /**
   * WF-14: High-Res Upscale
   * Jewelry needs detail enhancement for engravings and gemstone facets
   */
  upscale: (imageUrl) => ({
    model: 'magnific-ai-detail-enhancement',
    targetResolution: '4096x4096',
    enhanceFeatures: [
      'reflections',
      'engravings',
      'gemstone-facets',
      'metal-texture'
    ],
    sharpness: 1.5,                    // High for crisp detail
    denoise: 0.3,                      // Minimal (preserve texture)
    provider: 'magnific',
    fallbackProvider: 'cloudinary'
  }),

  /**
   * WF-15: Color Variants
   * Jewelry variants are metal tones (gold, silver, rose gold)
   */
  colorVariants: (imageUrl) => ({
    variants: [
      { name: 'White Gold', colorShift: { hue: 0, saturation: -20, brightness: +10 } },
      { name: 'Yellow Gold', colorShift: { hue: 45, saturation: +30, brightness: 0 } },
      { name: 'Rose Gold', colorShift: { hue: 15, saturation: +20, brightness: -5 } },
      { name: 'Platinum', colorShift: { hue: 0, saturation: -30, brightness: +15 } },
      { name: 'Silver', colorShift: { hue: 0, saturation: -25, brightness: +5 } }
    ],
    preserveGemstones: true,           // Don't recolor stones
    maskingStrategy: 'metal-only',
    model: 'stable-diffusion-xl'
  }),

  /**
   * WF-16: 360° Spin
   * CRITICAL: Jewelry needs fast rotation with enhanced reflections
   */
  threeSixtySpinConfig(imageUrl) {
    return {
      rotationSpeed: 'fast',           // 3-5 seconds per revolution
      frames: 72,                      // 72 frames = 5° increments
      lighting: {
        type: 'studio',
        intensity: 'high',
        reflections: 'enhanced',       // Show metal sparkle
        shadowSoftness: 0.3,
        keyLightAngle: 45,
        fillLightIntensity: 0.6
      },
      cameraAngle: 'eye-level',        // Straight on
      cameraDistance: 'medium',
      background: 'solid-white',
      postProcessing: {
        contrastBoost: 1.3,
        sharpness: 1.5,
        colorGrading: 'luxury'
      },
      model: 'stability-3d',
      outputFormat: 'mp4',
      fps: 24                          // Smooth motion
    };
  },

  /**
   * WF-18: Animation (Short Video)
   * CRITICAL: Jewelry animations showcase sparkle and rotation
   */
  animation: (imageUrl) => ({
    duration: 3,                       // 3 seconds
    animationType: 'sparkle-rotate',
    effects: [
      'light-ray-reflections',         // Sun glints on metal
      'gemstone-sparkle',              // Diamond shimmer
      'slow-rotation',                 // 180° turn
      'zoom-in-detail'                 // Close-up on stone
    ],
    lighting: {
      type: 'dynamic',
      sunGlintIntensity: 0.8,
      sparkleFrequency: 'high'
    },
    fps: 60,                           // Smooth sparkle effects
    model: 'runway-gen-3-alpha',       // Best for reflections
    fallbackModel: 'luma-dream-machine',
    outputFormat: 'mp4',
    quality: 'ultra'
  }),

  /**
   * WF-19: Product Collage
   * Jewelry collages zoom in on gemstones and metal details
   */
  productCollage: (imageUrls) => ({
    layout: 'jewelry-showcase',
    panels: [
      { type: 'full-product', position: 'left', size: '60%' },
      { type: 'gemstone-closeup', position: 'top-right', size: '20%' },
      { type: 'metal-detail', position: 'middle-right', size: '20%' },
      { type: 'side-angle', position: 'bottom-right', size: '20%' }
    ],
    zoomLevels: {
      gemstoneCloseup: 3.0,            // 3× zoom on stone
      metalDetail: 2.5                 // 2.5× zoom on engraving
    },
    spacing: 10,
    background: 'white',
    borderStyle: 'luxury-gold-frame'
  }),

  /**
   * WF-21: AI Model Swap
   * Place jewelry on model's hand, neck, or ear
   */
  modelSwap: (imageUrl, modelType = 'hand') => ({
    placementOptions: {
      hand: {
        position: 'left-ring-finger',
        angle: 'natural-pose',
        lighting: 'soft-natural'
      },
      neck: {
        position: 'center-chest',
        chainLength: 'auto-detect',
        lighting: 'soft-natural'
      },
      ear: {
        position: 'earlobe',
        perspective: 'side-profile',
        lighting: 'soft-natural'
      }
    },
    model: 'fal-ai-fashion-controlnet',
    preserveJewelryDetail: true,
    matchSkinTone: true,
    modelPose: modelType
  }),

  /**
   * WF-25: Marketplace Compliance
   * eBay, Etsy, Amazon have different jewelry requirements
   */
  marketplaceCompliance: (imageUrl, marketplace) => {
    const configs = {
      ebay: {
        minResolution: '1600x1600',
        maxFileSize: '12MB',
        backgroundColor: 'white',       // eBay requires white
        format: 'JPEG',
        colorSpace: 'sRGB',
        addWatermark: false,            // eBay prohibits watermarks
        contrastBoost: 1.2,             // Make metal pop on white
        compressionQuality: 90
      },
      etsy: {
        minResolution: '2000x2000',
        maxFileSize: '10MB',
        backgroundColor: 'auto',        // Etsy allows lifestyle
        format: 'JPEG',
        colorSpace: 'sRGB',
        addCraftedByTag: true,
        preserveContext: true,          // Keep lifestyle scene
        compressionQuality: 95
      },
      amazon: {
        minResolution: '1000x1000',     // Amazon minimum
        maxFileSize: '10MB',
        backgroundColor: 'white',       // Amazon prefers white
        format: 'JPEG',
        colorSpace: 'sRGB',
        aspectRatio: '1:1',             // Square required
        compressionQuality: 85,
        metalContentLabel: true         // Required for precious metals
      }
    };

    return configs[marketplace] || configs.ebay;
  }
};
