/**
 * SwiftList Glass/Liquid Specialty Logic Module
 *
 * Provides glass/liquid-specific processing parameters for workflows
 * Usage in n8n workflows:
 * const GlassSpecialty = require('./specialty-logic-modules/GlassSpecialty.js');
 */

module.exports = {

  backgroundRemoval: (imageUrl) => ({
    preserveRefraction: true,
    edgeDetection: 'conservative',    // Don't cut off caustics
    alphaChannel: 'gradient',         // Smooth transparency
    keepReflections: true,            // Preserve surface reflections
    provider: 'photoroom',
    fallbackProviders: ['removebg', 'clipdrop']
  }),

  simplifyBackground: (imageUrl, targetColor = 'gradient-to-white') => ({
    backgroundColor: targetColor,
    transparencyHandling: 'preserve',
    refractionAware: true,
    saturationAdjust: 1.0,
    sharpness: 1.2,
    provider: 'cloudinary'
  }),

  lifestyleSetting: (imageUrl) => ({
    context: 'sophisticated',
    sceneOptions: [
      'wine-pairing-table-setting',
      'bar-top-lifestyle',
      'kitchen-counter-pour',
      'outdoor-picnic-scene'
    ],
    lighting: {
      type: 'backlit + front',
      intensity: 'variable',
      causticEffects: true
    },
    model: 'flux-1-pro'
  }),

  productDescription: (imageAnalysis) => ({
    vocabulary: [
      'capacity', 'ml', 'oz', 'glass', 'crystal',
      'handcrafted', 'dishwasher safe', 'lead-free',
      'transparent', 'elegant', 'durable'
    ],
    template: '{product_type} with {capacity} capacity. Crafted from {material_type}. {use_case_description}.',
    seoKeywords: ['glassware', 'drinkware', 'barware', 'crystal'],
    tone: 'sophisticated',
    callToAction: 'Perfect for any occasion.'
  }),

  upscale: (imageUrl) => ({
    model: 'magnific-ai-transparency-aware',
    targetResolution: '4096x4096',
    enhanceFeatures: ['refraction', 'caustics', 'reflections'],
    sharpness: 1.2,
    denoise: 0.2,                     // Low (preserve light patterns)
    provider: 'magnific'
  }),

  colorVariants: (imageUrl) => ({
    variants: [
      { name: 'Clear Glass', colorShift: { hue: 0, saturation: 0, brightness: 0 } },
      { name: 'Red Wine', colorShift: { hue: 340, saturation: +60, brightness: -30 } },
      { name: 'White Wine', colorShift: { hue: 50, saturation: +20, brightness: +10 } },
      { name: 'Blue Tint', colorShift: { hue: 210, saturation: +30, brightness: 0 } },
      { name: 'Amber', colorShift: { hue: 30, saturation: +40, brightness: -10 } }
    ],
    preserveTransparency: true,
    maskingStrategy: 'liquid-only',
    model: 'stable-diffusion-xl'
  }),

  threeSixtySpinConfig: (imageUrl) => ({
    rotationSpeed: 'slow',            // 10-12 seconds per revolution
    frames: 120,                      // 120 frames = 3° increments (smooth refraction)
    lighting: {
      type: 'backlit + front',
      intensity: 'variable',
      reflections: 'captured',
      causticEffects: true,           // Light patterns through glass
      backlightIntensity: 0.7
    },
    cameraAngle: 'eye-level',
    background: 'gradient-to-white',  // Show transparency
    postProcessing: {
      transparencyEnhance: true,
      refractionCorrection: true,
      contrastBoost: 1.1
    },
    model: 'stability-3d',
    fps: 30
  }),

  animation: (imageUrl) => ({
    duration: 4,                      // 4 seconds
    animationType: 'liquid-pour',
    effects: [
      'liquid-physics',               // Realistic pour
      'refraction-animation',         // Light through liquid
      'bubble-simulation',            // If carbonated
      'transparency-shift'            // Angle changes
    ],
    fps: 60,                          // Smooth liquid motion
    model: 'luma-dream-machine',      // Best for physics
    outputFormat: 'mp4'
  }),

  productCollage: (imageUrls) => ({
    layout: 'glass-showcase',
    panels: [
      { type: 'full-product', position: 'left', size: '60%' },
      { type: 'transparency-view', position: 'top-right', size: '20%' },
      { type: 'filled-with-liquid', position: 'middle-right', size: '20%' },
      { type: 'top-down-view', position: 'bottom-right', size: '20%' }
    ],
    spacing: 10,
    background: 'gradient-white'
  }),

  modelSwap: (imageUrl) => ({
    placement: 'model-hand-holding',
    naturalPose: true,
    preserveRefraction: true,
    model: 'fal-ai-fashion-controlnet'
  }),

  marketplaceCompliance: (imageUrl, marketplace) => {
    const configs = {
      amazon: {
        minResolution: '1000x1000',
        backgroundColor: 'white',
        format: 'JPEG',
        hazmatLabel: true,              // Amazon requires hazmat info for glass
        fragilityWarning: true,
        compressionQuality: 85
      },
      etsy: {
        minResolution: '2000x2000',
        backgroundColor: 'auto',
        format: 'JPEG',
        handcraftedTag: true,
        compressionQuality: 95
      },
      ebay: {
        minResolution: '1600x1600',
        backgroundColor: 'white',
        format: 'JPEG',
        compressionQuality: 90
      }
    };
    return configs[marketplace] || configs.amazon;
  }
};
