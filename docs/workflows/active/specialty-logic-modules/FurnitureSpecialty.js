/**
 * SwiftList Furniture/Home Decor Specialty Logic Module
 *
 * Provides furniture-specific processing parameters for workflows
 * Usage in n8n workflows:
 * const FurnitureSpecialty = require('./specialty-logic-modules/FurnitureSpecialty.js');
 */

module.exports = {

  backgroundRemoval: (imageUrl) => ({
    preserveShadows: true,            // Keep floor shadows
    edgeFeathering: 2.0,              // Very soft edges
    floorPlaneDetection: true,        // Detect ground plane
    perspectiveCorrect: true,         // Fix camera angle
    provider: 'photoroom',
    fallbackProviders: ['removebg', 'clipdrop']
  }),

  simplifyBackground: (imageUrl, targetColor = 'neutral-gray') => ({
    backgroundColor: targetColor,
    perspectiveCorrection: true,
    preserveFloorShadows: true,
    saturationAdjust: 1.0,
    sharpness: 1.0,
    provider: 'cloudinary'
  }),

  lifestyleSetting: (imageUrl) => ({
    context: 'home-interior',
    sceneOptions: [
      'modern-living-room',
      'minimalist-bedroom',
      'industrial-loft',
      'cozy-reading-nook'
    ],
    lighting: {
      type: 'room-ambient',
      intensity: 'medium',
      reflections: 'natural'
    },
    model: 'flux-1-pro'
  }),

  productDescription: (imageAnalysis) => ({
    vocabulary: [
      'dimensions', 'W×D×H', 'inches', 'cm',
      'solid wood', 'oak', 'walnut', 'pine', 'mahogany',
      'upholstered', 'fabric', 'leather', 'velvet',
      'assembly required', 'weight capacity', 'durable'
    ],
    template: '{product_type} crafted from {wood_type}. Dimensions: {width}W × {depth}D × {height}H. {style_description}.',
    seoKeywords: ['furniture', 'home decor', 'interior design'],
    tone: 'informative',
    callToAction: 'Transform your space today.'
  }),

  upscale: (imageUrl) => ({
    model: 'magnific-ai-standard',
    targetResolution: '4096x4096',
    enhanceFeatures: ['wood-grain', 'texture-detail', 'fabric-weave'],
    sharpness: 1.0,
    denoise: 0.4,
    provider: 'magnific'
  }),

  colorVariants: (imageUrl) => ({
    variants: [
      { name: 'Natural Oak', colorShift: { hue: 30, saturation: +10, brightness: +5 } },
      { name: 'Dark Walnut', colorShift: { hue: 20, saturation: +20, brightness: -25 } },
      { name: 'White Wash', colorShift: { hue: 0, saturation: -40, brightness: +30 } },
      { name: 'Espresso', colorShift: { hue: 15, saturation: +10, brightness: -40 } },
      { name: 'Gray Stain', colorShift: { hue: 0, saturation: -30, brightness: -10 } }
    ],
    preserveWoodGrain: true,
    maskingStrategy: 'wood-only',
    model: 'stable-diffusion-xl'
  }),

  threeSixtySpinConfig: (imageUrl) => ({
    rotationSpeed: 'very-slow',       // 15-20 seconds per revolution
    frames: 90,                       // 90 frames = 4° increments
    lighting: {
      type: 'room-ambient',
      intensity: 'medium',
      reflections: 'natural',
      shadowSoftness: 1.0             // Room-like shadows
    },
    cameraAngle: 'slight-above',      // Show depth and scale
    cameraDistance: 'far',            // Capture full furniture piece
    background: 'lifestyle-room',     // Not isolated
    postProcessing: {
      perspectiveCorrect: true,
      woodGrainEnhance: true,
      contextualDepth: true
    },
    model: 'stability-3d',
    fps: 24
  }),

  animation: (imageUrl) => ({
    duration: 8,                      // 8 seconds
    animationType: 'room-flythrough',
    effects: [
      'camera-orbit',                 // Circle around furniture
      'room-context',                 // Show in living space
      'lighting-shift',               // Day to evening
      'scale-reference'               // Show size context
    ],
    fps: 30,                          // Cinematic
    model: 'runway-gen-3-alpha',      // Best for environment
    outputFormat: 'mp4'
  }),

  productCollage: (imageUrls) => ({
    layout: 'furniture-showcase',
    panels: [
      { type: 'full-product', position: 'left', size: '60%' },
      { type: 'wood-grain-detail', position: 'top-right', size: '20%' },
      { type: 'angle-variation', position: 'middle-right', size: '20%' },
      { type: 'dimensions-diagram', position: 'bottom-right', size: '20%' }
    ],
    spacing: 10,
    background: 'neutral-gray'
  }),

  modelSwap: (imageUrl) => ({
    placement: 'staged-room-context',
    roomStyle: 'modern-minimalist',
    scaleReference: true,             // Show furniture in proper scale
    model: 'flux-1-pro'
  }),

  marketplaceCompliance: (imageUrl, marketplace) => {
    const configs = {
      amazon: {
        minResolution: '1000x1000',
        backgroundColor: 'white',
        format: 'JPEG',
        oversizeShippingTag: true,     // Amazon requires for large furniture
        dimensionsOverlay: true,
        compressionQuality: 85
      },
      wayfair: {
        minResolution: '2000x2000',
        backgroundColor: 'white',
        format: 'JPEG',
        multipleAngles: true,
        compressionQuality: 95
      },
      etsy: {
        minResolution: '2000x2000',
        backgroundColor: 'auto',
        format: 'JPEG',
        handcraftedTag: true,
        compressionQuality: 95
      }
    };
    return configs[marketplace] || configs.amazon;
  }
};
