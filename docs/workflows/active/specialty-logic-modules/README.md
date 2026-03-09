# SwiftList Specialty Logic Modules

**Purpose**: Reusable Node.js modules that provide category-specific processing parameters for workflows that need to handle jewelry, fashion, glass/liquid, and furniture differently.

**Architecture**: Tag-based specialty system where WF-01 tags jobs with metadata, and individual workflows check tags to apply appropriate specialty logic.

---

## Quick Start

###Usage in n8n Workflows

```javascript
// In any workflow (WF-07, WF-14, WF-16, etc.)
const SpecialtyLogic = require('./specialty-logic-modules/index.js');

// Get job metadata (contains specialty_engine tag from WF-01)
const job = $json;

// Check if this workflow supports specialty logic
if (SpecialtyLogic.workflowSupportsSpecialtyLogic('WF-07')) {

  // Get specialty configuration
  const config = SpecialtyLogic.getConfig(
    job.specialty_engine,        // "WF-02" (jewelry), "WF-03" (fashion), etc.
    'backgroundRemoval',         // Operation name
    job.current_image_url        // Arguments
  );

  // Use config in API call
  const result = await photoroom.removeBackground({
    imageUrl: job.current_image_url,
    ...config  // Applies jewelry/fashion/glass/furniture-specific settings
  });
}
```

---

## Modules

### JewelrySpecialty.js
Handles products made of metal and gemstones (rings, necklaces, bracelets).

**Key Features**:
- Preserve reflections and sparkle
- High contrast for metal
- Detail enhancement for engravings
- Fast 360° rotation (3-5 seconds)
- Sparkle animation effects

### FashionSpecialty.js
Handles clothing and apparel (dresses, shirts, accessories).

**Key Features**:
- Preserve fabric texture and drape
- Soft shadows for natural look
- Model context for lifestyle shots
- Medium 360° rotation (6-8 seconds)
- Fabric movement animation

### GlassSpecialty.js
Handles transparent products (bottles, glasses, jars, liquid containers).

**Key Features**:
- Preserve refraction and caustics
- Backlit + front lighting
- Transparency-aware upscaling
- Slow 360° rotation (10-12 seconds)
- Liquid pour animation

### FurnitureSpecialty.js
Handles large home goods (sofas, tables, chairs, decor).

**Key Features**:
- Preserve floor shadows
- Perspective correction
- Room context for lifestyle
- Very slow 360° rotation (15-20 seconds)
- Room flythrough animation

### GeneralSpecialty.js
Default handling for products that don't fit specialty categories.

---

## Supported Workflows

11 workflows support specialty logic:

| Workflow | Operation Name | Description |
|----------|---------------|-------------|
| **WF-07** | `backgroundRemoval` | Remove background with category-specific edge detection |
| **WF-08** | `simplifyBackground` | Solid color background with category-specific processing |
| **WF-09** | `lifestyleSetting` | Place product in contextually appropriate environment |
| **WF-10** | `productDescription` | Generate description with category-specific vocabulary |
| **WF-14** | `upscale` | High-res upscale with category-specific enhancement |
| **WF-15** | `colorVariants` | Generate color variants (metal tones, fabric colors, etc.) |
| **WF-16** | `threeSixtySpinConfig` | 360° spin with category-specific rotation speed/lighting |
| **WF-18** | `animation` | Video animation with category-specific physics/effects |
| **WF-19** | `productCollage` | Multi-panel layout with category-specific focal points |
| **WF-21** | `modelSwap` | Place product on AI model with category-specific placement |
| **WF-25** | `marketplaceCompliance` | Resize/format for marketplace with category-specific rules |

---

## Example: WF-07 (Background Removal) with Specialty Logic

```javascript
// WF-07: Background Removal n8n Function Node

const SpecialtyLogic = require('./specialty-logic-modules/index.js');
const job = $json;

// Check if job has specialty tag
if (job.specialty_engine) {
  // Get specialty configuration
  const config = SpecialtyLogic.getConfig(
    job.specialty_engine,
    'backgroundRemoval',
    job.current_image_url
  );

  // Example output for jewelry (specialty_engine: "WF-02"):
  // {
  //   preserveReflections: true,
  //   edgeFeathering: 0.5,
  //   minContrast: 0.8,
  //   alphaChannel: 'preserve-specular',
  //   provider: 'photoroom',
  //   fallbackProviders: ['removebg', 'clipdrop']
  // }

  // Apply to Photoroom API
  const result = await photoroom.removeBackground({
    imageUrl: job.current_image_url,
    preserveReflections: config.preserveReflections,
    edgeFeathering: config.edgeFeathering,
    minContrast: config.minContrast
  });

} else {
  // No specialty tag - use default processing
  const result = await photoroom.removeBackground({
    imageUrl: job.current_image_url
  });
}
```

---

## Database Schema

Jobs table includes specialty metadata:

```sql
CREATE TABLE jobs (
  job_id UUID PRIMARY KEY,
  user_id TEXT REFERENCES profiles(user_id),

  -- Original input
  original_image_url TEXT NOT NULL,

  -- Specialty metadata (from WF-01 analysis)
  category TEXT,           -- jewelry, fashion, glass, liquid, furniture, general
  specialty_engine TEXT,   -- WF-02, WF-03, WF-04, WF-05, WF-06
  material TEXT,           -- metal, fabric, glass, wood, plastic, other
  complexity TEXT,         -- simple, complex

  -- User preferences
  marketplace TEXT,        -- ebay, etsy, amazon, shopify
  preset_id UUID,

  -- Workflow execution
  requested_workflows TEXT[],
  current_image_url TEXT,
  workflow_chain TEXT[],

  -- Status
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Architecture Flow

```
1. User uploads jewelry photo
     ↓
2. WF-01 analyzes with Gemini Vision
     ↓
3. WF-01 tags job: specialty_engine = "WF-02"
     ↓
4. WF-01 stores tags in database
     ↓
5. User selects workflows: [WF-07, WF-14, WF-16]
     ↓
6. WF-07 executes:
   - Checks specialty_engine tag
   - Calls SpecialtyLogic.getConfig("WF-02", "backgroundRemoval")
   - Gets jewelry-specific config
   - Applies to Photoroom API
     ↓
7. WF-14 executes:
   - Checks specialty_engine tag
   - Calls SpecialtyLogic.getConfig("WF-02", "upscale")
   - Gets jewelry-specific upscale config (detail enhancement)
     ↓
8. WF-16 executes:
   - Checks specialty_engine tag
   - Calls SpecialtyLogic.getConfig("WF-02", "threeSixtySpinConfig")
   - Gets jewelry-specific 360° config (fast rotation, high reflections)
```

---

## Benefits

1. **Composable**: Any workflow can be used with any specialty category
2. **Extensible**: Add new categories (electronics, food) without modifying workflows
3. **DRY**: Specialty logic centralized in modules, not duplicated across workflows
4. **Maintainable**: Update jewelry logic once, applies to all 11 workflows
5. **Testable**: Each module can be unit tested independently

---

## Future Categories

Easy to add new specialty categories:

```javascript
// Create ElectronicsSpecialty.js
module.exports = {
  backgroundRemoval: (imageUrl) => ({
    preserveScreenReflections: true,
    edgeDetection: 'precise',
    provider: 'photoroom'
  }),
  // ... other operations
};

// Update index.js
const ElectronicsSpecialty = require('./ElectronicsSpecialty');

const SPECIALTY_MODULES = {
  'WF-02': JewelrySpecialty,
  'WF-03': FashionSpecialty,
  'WF-04': GlassSpecialty,
  'WF-05': FurnitureSpecialty,
  'WF-06': GeneralSpecialty,
  'WF-07-ELECTRONICS': ElectronicsSpecialty  // New category
};
```

---

**Last Updated**: January 5, 2026
**Status**: Complete - Ready for n8n workflow integration
**Next**: Update workflow JSON files to use these modules
