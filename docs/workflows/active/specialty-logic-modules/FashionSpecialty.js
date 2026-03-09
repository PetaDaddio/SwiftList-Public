/**
 * SwiftList Fashion/Apparel Specialty Logic Module
 *
 * Provides fashion-specific processing parameters for workflows
 * Usage in n8n workflows:
 * const FashionSpecialty = require('./specialty-logic-modules/FashionSpecialty.js');
 */

module.exports = {

  backgroundRemoval: (imageUrl) => ({
    preserveFabricTexture: true,
    edgeFeathering: 1.5,              // Softer edges for clothing
    handleTransparency: true,         // Detect sheer fabrics
    keepShadows: 'soft',              // Preserve natural shadows
    provider: 'photoroom',
    fallbackProviders: ['removebg', 'clipdrop']
  }),

  simplifyBackground: (imageUrl, targetColor = 'neutral-gray') => ({
    backgroundColor: targetColor,
    preserveFabricTexture: true,
    naturalLighting: true,
    saturationAdjust: 1.0,            // Natural color
    sharpness: 1.0,
    provider: 'cloudinary'
  }),

  lifestyleSetting: (imageUrl) => ({
    context: 'fashion',
    sceneOptions: [
      'model-wearing-garment',
      'wardrobe-hanger',
      'boutique-display',
      'lifestyle-casual-setting'
    ],
    lighting: {
      type: 'soft-box',
      intensity: 'medium',
      reflections: 'natural'
    },
    model: 'flux-1-pro'
  }),

  productDescription: (imageAnalysis) => ({
    vocabulary: [
      'fabric', 'fit', 'silhouette', 'drape', 'tailored',
      'casual', 'formal', 'cotton', 'silk', 'polyester',
      'breathable', 'stretch', 'comfortable', 'stylish'
    ],
    template: '{garment_type} crafted from {fabric_type}. {fit_description} with {style_details}. Perfect for {occasion}.',
    seoKeywords: ['womens fashion', 'mens clothing', 'apparel', 'style'],
    tone: 'approachable',
    callToAction: 'Elevate your wardrobe today.'
  }),

  upscale: (imageUrl) => ({
    model: 'magnific-ai-texture-preservation',
    targetResolution: '4096x4096',
    enhanceFeatures: ['fabric-weave', 'stitching', 'buttons'],
    sharpness: 1.0,                   // Moderate (natural look)
    denoise: 0.5                      // Moderate (smooth fabric)
  }),

  colorVariants: (imageUrl) => ({
    variants: [
      { name: 'Black', colorShift: { hue: 0, saturation: -100, brightness: -30 } },
      { name: 'Navy Blue', colorShift: { hue: 220, saturation: +40, brightness: -20 } },
      { name: 'Burgundy', colorShift: { hue: 340, saturation: +50, brightness: -10 } },
      { name: 'Forest Green', colorShift: { hue: 120, saturation: +30, brightness: -15 } },
      { name: 'Cream', colorShift: { hue: 40, saturation: -20, brightness: +20 } }
    ],
    preserveTexture: true,
    maskingStrategy: 'fabric-only',
    model: 'stable-diffusion-xl'
  }),

  threeSixtySpinConfig: (imageUrl) => ({
    rotationSpeed: 'medium',          // 6-8 seconds per revolution
    frames: 60,                       // 60 frames = 6° increments
    lighting: {
      type: 'soft-box',
      intensity: 'medium',
      reflections: 'natural',
      shadowSoftness: 0.8             // Soft shadows for fabric
    },
    cameraAngle: 'slight-above',      // Show drape and fit
    background: 'neutral-gray',
    postProcessing: {
      fabricDetailEnhance: true,
      colorAccuracy: 'high'
    },
    model: 'stability-3d',
    fps: 24
  }),

  animation: (imageUrl) => ({
    duration: 5,                      // 5 seconds
    animationType: 'fabric-movement',
    effects: [
      'fabric-drape-physics',         // Cloth simulation
      'model-walk',                   // Motion context
      'wind-effect',                  // Fabric flutter
      'zoom-out-full-outfit'          // Show complete look
    ],
    fps: 30,                          // Natural motion
    model: 'runway-gen-3-alpha',      // Best for fabric physics
    outputFormat: 'mp4'
  }),

  productCollage: (imageUrls) => ({
    layout: 'fashion-showcase',
    panels: [
      { type: 'full-outfit', position: 'left', size: '60%' },
      { type: 'fabric-detail', position: 'top-right', size: '20%' },
      { type: 'stitching-closeup', position: 'middle-right', size: '20%' },
      { type: 'tag-label', position: 'bottom-right', size: '20%' }
    ],
    spacing: 10,
    background: 'neutral-gray'
  }),

  modelSwap: (imageUrl) => ({
    placement: 'fashion-model-body',
    modelPose: 'standing-casual',
    preserveFabricDrape: true,
    matchBodyType: 'average',
    model: 'fal-ai-fashion-controlnet'
  }),

  marketplaceCompliance: (imageUrl, marketplace) => {
    const configs = {
      etsy: {
        minResolution: '2000x2000',
        backgroundColor: 'auto',       // Etsy allows lifestyle
        format: 'JPEG',
        addModelingTag: true,
        preserveContext: true,
        compressionQuality: 95
      },
      amazon: {
        minResolution: '1000x1000',
        backgroundColor: 'white',
        format: 'JPEG',
        aspectRatio: '1:1',
        compressionQuality: 85
      },
      ebay: {
        minResolution: '1600x1600',
        backgroundColor: 'white',
        format: 'JPEG',
        compressionQuality: 90
      }
    };
    return configs[marketplace] || configs.etsy;
  }
};
