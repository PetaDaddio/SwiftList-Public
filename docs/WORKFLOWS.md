# SwiftList Workflows Documentation

**Last Updated**: January 27, 2026
**Status**: MVP Complete + 4 New Workflows

---

## Overview

SwiftList provides AI-powered image processing workflows for e-commerce product photography. All workflows are designed to preserve the original product exactly as uploaded while applying professional enhancements.

---

## Core MVP Workflow

### WF-07: Background Removal + Style Transfer

**Status**: ✅ Production Ready
**Cost**: $0.073 per job
**Processing Time**: ~8-12 seconds

**What it does:**
1. Removes background using BRIA RMBG 2.0 ($0.018)
2. Analyzes reference image style with Gemini Flash 2.0
3. Generates custom background with Flux Pro 1.1 ($0.055)
4. Composites product with realistic shadows

**How to use:**
```typescript
const job = await createJob({
  product_image_url: 'https://...',
  reference_image_url: 'https://...', // Optional
  ai_prompt: 'outdoor garden setting', // Optional
  enhancements: ['remove-background'] // Triggers style transfer if reference/prompt provided
});
```

**Example use cases:**
- Product on SoHo NYC street
- Jewelry on marble countertop
- Boots in field of daisies

---

## New Workflows (January 27, 2026)

### WF-08: Simplify Background (White/Grey)

**Status**: ✅ Ready to Test
**Cost**: $0.018 per job (background removal only)
**Processing Time**: ~3 seconds
**Workflow ID**: `WF-08`
**Credits**: 10

**What it does:**
- Removes background with BRIA RMBG 2.0
- Composites product onto solid color background
- Perfect for marketplace compliance (eBay, Amazon, Etsy)

**How to use:**
```typescript
const job = await createJob({
  product_image_url: 'https://...',
  enhancements: ['simplify-background'],
  metadata: {
    background_color: '#FFFFFF' // Pure white (default)
  }
});
```

**Background color options:**
- `#FFFFFF` - Pure white (eBay/Amazon standard)
- `#F8F8F8` - Off-white (natural feel)
- `#E5E5E5` - Light grey (premium look)
- Any hex color code

**Example API call:**
```bash
POST /api/jobs/process
{
  "job_id": "uuid",
  "enhancements": ["simplify-background"],
  "metadata": {
    "background_color": "#FFFFFF"
  }
}
```

---

### WF-14: Image Upscaling

**Status**: ✅ Ready to Test
**Cost**: $0.01 per upscale
**Processing Time**: ~4-5 seconds
**Workflow ID**: `WF-14`
**Credits**: 10

**What it does:**
- Upscales image 2x or 4x using Real-ESRGAN
- Maintains product quality and detail
- Perfect for high-resolution marketplace listings

**How to use:**
```typescript
const job = await createJob({
  product_image_url: 'https://...',
  enhancements: ['upscale'],
  metadata: {
    upscale_factor: 2 // 2x or 4x (default: 2)
  }
});
```

**Upscale factors:**
- `2` - 2x upscale (recommended for most cases)
- `4` - 4x upscale (for very high resolution needs)

**Can be combined with other workflows:**
```typescript
// Remove background + upscale
enhancements: ['remove-background', 'upscale']

// Simplify background + upscale
enhancements: ['simplify-background', 'upscale']
```

**Note**: Upscaling always runs LAST in the pipeline to ensure highest quality output.

---

### WF-09: Lifestyle Setting

**Status**: ✅ Ready to Test
**Cost**: $0.073 per job ($0.018 BG removal + $0.055 Flux)
**Processing Time**: ~8-10 seconds
**Workflow ID**: `WF-09`
**Credits**: 10

**What it does:**
- Removes background with BRIA RMBG 2.0
- Places product in curated lifestyle scene
- Uses predefined scene templates for social media content

**How to use:**
```typescript
const job = await createJob({
  product_image_url: 'https://...',
  enhancements: ['lifestyle-setting'],
  metadata: {
    lifestyle_scene: 'coffee-shop' // See scene options below
  }
});
```

**Available lifestyle scenes:**

| Scene ID | Description | Best For |
|----------|-------------|----------|
| `coffee-shop` | Cozy cafe with warm lighting | Mugs, books, accessories |
| `outdoor-picnic` | Picnic blanket on grass | Food, outdoor gear |
| `bedroom-nightstand` | Modern nightstand with morning light | Skincare, books, tech |
| `kitchen-counter` | Clean marble counter | Appliances, kitchenware |
| `workspace-desk` | Minimalist desk setup | Tech, stationery, planners |
| `vanity-table` | Elegant vanity with mirror | Beauty, cosmetics, jewelry |
| `garden-outdoor` | Lush garden with greenery | Plants, outdoor products |
| `living-room` | Cozy couch setting | Home decor, blankets |
| `beach-sand` | Beach with ocean background | Vacation, summer products |
| `studio-minimal` | Clean studio background (default) | Any product |

**Example use cases:**
- Coffee mug on cafe table for Instagram
- Skincare on bedroom nightstand
- Tech accessories on workspace desk

---

### WF-06: General Goods Engine

**Status**: ✅ Ready to Test
**Cost**: $0.073 per job ($0.018 BG removal + $0.055 Flux)
**Processing Time**: ~8-10 seconds
**Workflow ID**: `WF-06`
**Credits**: 10

**What it does:**
- Automatically analyzes product type
- Applies category-specific background treatment
- Uses intelligent prompt strategies per product category

**How to use:**
```typescript
const job = await createJob({
  product_image_url: 'https://...',
  enhancements: ['general-goods-engine'],
  metadata: {
    product_type: 'jewelry' // See product types below
  }
});
```

**Supported product types:**

| Product Type | Background Style |
|--------------|------------------|
| `jewelry` | Luxury display with soft gradients, studio highlights |
| `clothing` | Fashion photography with neutral tones, editorial depth |
| `electronics` | Modern tech background with clean gradients, sharp lighting |
| `furniture` | Interior design setting with complementary decor |
| `accessories` | Lifestyle photography, modern and stylish |
| `beauty` | Clean pastels, diffused studio lighting, premium feel |
| `home` | Warm ambient lighting, cozy interior setting |
| `toys` | Playful colorful background, family-friendly |
| `sports` | Active lifestyle with dynamic lighting |
| `default` | Professional studio background (fallback) |

**Example use cases:**
- Automatic styling for jewelry listings
- Fashion product photography
- Electronics product pages

---

## Workflow Combinations

You can combine multiple workflows in a single job:

### Example 1: Marketplace-Ready with Upscale
```typescript
enhancements: ['simplify-background', 'upscale']
metadata: {
  background_color: '#FFFFFF',
  upscale_factor: 2
}
// Cost: $0.028 ($0.018 BG + $0.01 upscale)
```

### Example 2: Lifestyle + Upscale
```typescript
enhancements: ['lifestyle-setting', 'upscale']
metadata: {
  lifestyle_scene: 'coffee-shop',
  upscale_factor: 4
}
// Cost: $0.083 ($0.018 BG + $0.055 Flux + $0.01 upscale)
```

### Example 3: Custom Style + Upscale
```typescript
enhancements: ['remove-background', 'upscale']
reference_image_url: 'https://...',
ai_prompt: 'modern minimalist setting',
metadata: {
  upscale_factor: 2
}
// Cost: $0.083 ($0.018 BG + $0.055 Flux + $0.01 upscale)
```

---

## Processing Order

Workflows are always executed in this order:

1. **Background Removal** (if any workflow requires it)
2. **Style Transfer / Background Generation**
   - Custom style (reference + prompt)
   - Lifestyle setting
   - General Goods Engine
   - Simplify background
3. **Upscaling** (always last)

This ensures maximum quality at each step.

---

## Cost Summary

| Workflow | Base Cost | Additional Notes |
|----------|-----------|------------------|
| Background Removal | $0.018 | BRIA RMBG 2.0 |
| Style Transfer | $0.073 | BG removal + Flux Pro 1.1 |
| Simplify Background | $0.018 | BG removal only |
| Lifestyle Setting | $0.073 | BG removal + Flux Pro 1.1 |
| General Goods Engine | $0.073 | BG removal + Flux Pro 1.1 |
| Upscaling | $0.01 | Real-ESRGAN |

**Combined workflow example:**
- Lifestyle + Upscale = $0.083
- Simplify + Upscale = $0.028

---

## Technical Details

### APIs Used

1. **BRIA RMBG 2.0** (Background Removal)
   - Model: `bria/remove-background`
   - Cost: $0.018 per image
   - Provider: Replicate

2. **Flux Pro 1.1** (Background Generation)
   - Model: `black-forest-labs/flux-1.1-pro`
   - Cost: $0.055 per generation
   - Max dimensions: 1440x1440
   - Provider: Replicate

3. **Real-ESRGAN** (Upscaling)
   - Model: `nightmareai/real-esrgan`
   - Cost: $0.01 per upscale
   - Factors: 2x or 4x
   - Provider: Replicate

4. **Gemini Flash 2.0** (Style Analysis)
   - Model: `gemini-2.0-flash-exp`
   - Cost: Free (within quota)
   - Provider: Google

### Image Compositing

- Library: Sharp (Node.js)
- Shadow generation: 15px blur, 40% opacity
- Color grading: +5% brightness, +10% saturation
- Output format: PNG with alpha channel

---

## Error Handling

All workflows include:
- ✅ Retry logic with exponential backoff (3 attempts)
- ✅ Rate limit handling (429 errors)
- ✅ Dimension validation (max 1440x1440 for Flux)
- ✅ Automatic scaling with aspect ratio preservation
- ✅ Graceful fallbacks for API failures

---

## Testing

To test a workflow:

```bash
# 1. Upload product image via UI
# 2. Select enhancements
# 3. Set metadata (if needed)
# 4. Submit job
# 5. Check output in Supabase Storage

# Or via API:
curl -X POST http://localhost:5173/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "uuid-here",
    "enhancements": ["simplify-background"],
    "metadata": {"background_color": "#FFFFFF"}
  }'
```

---

## Roadmap

### Phase 1 (Post-MVP)
- ✅ WF-08: Simplify Background
- ✅ WF-14: Image Upscaling
- ✅ WF-09: Lifestyle Setting
- ✅ WF-06: General Goods Engine

### Phase 2 (Q1 2026)
- [ ] WF-02: Jewelry Precision Engine
- [ ] WF-03: Fashion & Apparel Engine
- [ ] WF-04: Glass & Refraction Engine
- [ ] WF-05: Furniture & Spatial Engine

### Phase 3 (Q2 2026)
- [ ] WF-10: Product Description Generation
- [ ] WF-19: Product Collage
- [ ] WF-17: Generate Preset (Marketplace)

---

## Support

For questions or issues:
- GitHub Issues: https://github.com/your-org/swiftlist/issues
- Documentation: `/docs/TDD_MASTER_v4.0.md`

---

**Built with**: Replicate, Sharp, Gemini, SvelteKit, Supabase
