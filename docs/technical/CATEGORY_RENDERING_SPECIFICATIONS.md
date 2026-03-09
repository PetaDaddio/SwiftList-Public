# Category-Specific Rendering Specifications
## SwiftList - 3D Modeling & Physics-Based Rendering Logic
## Lead Visual Expert Analysis
## Created: December 31, 2025

---

## EXECUTIVE SUMMARY

**Critical User Feedback**: "Makers think AI makes jewelry look too fake and AI generated rather than natural with correct reflective surfaces and subtle environmental lighting. We need to absolutely NAIL jewelry outputs."

This document defines the **physics-based rendering rules** and **specialized AI prompts** for each major product category in the maker economy. These rules will be built into n8n workflows and customized per LLM.

**Key Categories**:
1. 🎭 Jewelry & Metallic Objects (MOST CRITICAL)
2. 👗 Fashion & Apparel
3. 🪑 Furniture & Large Objects
4. 💧 Glass, Water & Liquids
5. 🌿 Organic Materials (Wood, Leather, Ceramics)

---

## THE RENDERING PROBLEM

### Why Jewelry Looks "AI Generated" (And How to Fix It)

**Common AI Failures**:
1. **Incorrect Specularity**: Too matte or too glossy, no variation
2. **Wrong Index of Refraction (IOR)**: Diamond looks like plastic
3. **Missing Subsurface Scattering**: No internal light bounce
4. **Flat Lighting**: No environment reflections
5. **Perfect Symmetry**: Too "computer perfect", lacks handmade character
6. **Wrong Material Properties**: Gold looks like yellow paint

**Physics-Based Solution**:
We must give the AI model **explicit instructions** about:
- Material IOR values (Diamond = 2.417, Gold = 0.47+3.5i)
- Roughness maps (polished gold = 0.01, brushed = 0.3)
- Environment lighting (HDRI with specific color temperature)
- Caustics rendering (light refraction patterns)
- Micro-surface detail (scratches, patina, wear)

---

## CATEGORY 1: JEWELRY & METALLIC OBJECTS (CRITICAL)

### Physical Properties to Simulate

**Metals** (Gold, Silver, Platinum):
```
Gold (24K):
  - Base Color: RGB(255, 215, 0) / Hex #FFD700
  - Metallic: 1.0 (100%)
  - Roughness: 0.01 (polished) to 0.4 (matte)
  - IOR: 0.47 + 3.5i (complex refractive index)
  - Specular Tint: Warm yellow (color temperature 2500K)
  - Environment Reflections: REQUIRED (shows surroundings)

Silver (Sterling 925):
  - Base Color: RGB(192, 192, 192) / Hex #C0C0C0
  - Metallic: 1.0
  - Roughness: 0.01 (polished) to 0.35 (brushed)
  - IOR: 0.05 + 4.0i
  - Specular Tint: Cool white (color temperature 6500K)
  - Tarnish Layer: Add slight yellow/brown at edges

Platinum:
  - Base Color: RGB(229, 228, 226) / Hex #E5E4E2
  - Metallic: 1.0
  - Roughness: 0.05 (very smooth)
  - IOR: 2.3 + 4.3i
  - Specular Tint: Neutral white
```

**Gemstones** (Diamond, Ruby, Sapphire):
```
Diamond:
  - Base Color: RGB(240, 255, 255) / Hex #F0FFFF (slight blue tint)
  - Transmission: 1.0 (fully transparent)
  - IOR: 2.417 (very high refraction)
  - Dispersion: 0.044 (creates rainbow fire)
  - Subsurface Scattering: Depth 0.1mm
  - Caustics: REQUIRED (light patterns on surfaces)
  - Cut Facets: Must show proper facet reflections
  - Clarity: IF/VVS (internally flawless, no inclusions visible)

Ruby (Corundum):
  - Base Color: RGB(224, 17, 95) / Hex #E0115F
  - Transmission: 0.7 (semi-transparent)
  - IOR: 1.76-1.77
  - Subsurface Scattering: Deep red glow
  - Pleochroism: Slight color shift by viewing angle

Sapphire:
  - Base Color: RGB(15, 82, 186) / Hex #0F52BA
  - Transmission: 0.7
  - IOR: 1.76-1.77
  - Star Effect (if cabochon): 6-ray asterism
```

### AI Prompt Engineering (Jewelry)

**BAD Prompt** (Generic AI):
```
"A gold ring with a diamond on a white background"
```

**Result**: Looks like a cartoon, flat lighting, plastic appearance

---

**GOOD Prompt** (Physics-Based):
```
"Product photography of a 14K yellow gold engagement ring with 1 carat round brilliant cut diamond (D color, VS1 clarity).

METAL RENDERING:
- Polished gold surface with roughness 0.02
- Warm specular highlights (2700K color temperature)
- Environment reflections showing neutral gray studio walls
- Micro-scratches and subtle patina at band edges (realistic wear)
- Subsurface scattering in thin gold prongs

GEMSTONE RENDERING:
- Diamond with IOR 2.417 (high refraction)
- 58 facets clearly visible with sharp facet reflections
- Fire/dispersion showing subtle rainbow spectrum in highlights
- Caustic light patterns on white surface beneath diamond
- Internal clarity with NO visible inclusions
- Proper light path: refraction → internal reflection → exit

LIGHTING:
- Key light: Softbox 45° angle, 5500K daylight balanced
- Fill light: Reflector opposite side (2:1 ratio)
- Rim light: Hair light from behind to separate from background
- HDRI environment: Studio_Soft_01.hdr (neutral gray walls, no color cast)

BACKGROUND:
- Pure white seamless (RGB 255,255,255)
- Soft contact shadow beneath ring (20% opacity, 8px gaussian blur)
- NO harsh drop shadows, NO floor plane visible

CAMERA:
- Macro lens simulation (100mm equivalent)
- Shallow depth of field (f/5.6)
- Focus point: Diamond table facet
- Slight defocus on band edges (realistic lens bokeh)

COMPOSITION:
- Ring at 30° tilt (shows profile and top facets)
- Diamond positioned in upper third (rule of thirds)
- 1500x1500px output, 300 DPI

PHYSICS:
- Accurate Fresnel reflections (view-dependent specular)
- Energy-conserving BRDF (metallic surface)
- Spectral rendering for diamond fire (not RGB approximation)
- Global illumination with 5 light bounces minimum

AVOID:
- Plastic/toy appearance
- Cartoon shading
- Perfect symmetry (add subtle imperfections)
- Flat matte finish
- Colored background reflections in metal
- Oversaturated gemstone color
- Soft/blurry facet edges
- Missing caustics
```

---

### Recommended Models for Jewelry

**Primary: Replicate - Nano Banana SDXL Pro 3**
- **Why**: Specialized in product rendering, understands PBR materials
- **Cost**: $0.05/image
- **Strengths**: Accurate metal rendering, proper specularity
- **Weaknesses**: Occasional facet count errors on complex cuts

**Fallback 1: Gemini 3 Flash with Vision + Rendering Hints**
- **Why**: Multimodal, can analyze reference image then generate
- **Cost**: $0.50/1M tokens (cheap for text, but image gen requires separate model)
- **Process**: Use Gemini to GENERATE the physics-based prompt, then pass to SDXL
- **Strengths**: Intelligent prompt augmentation
- **Weaknesses**: Requires 2-step process

**Fallback 2: Midjourney v7 (if API access)**
- **Why**: Best-in-class photorealism
- **Cost**: $0.08/image (estimated API pricing)
- **Strengths**: Unmatched realism, proper lighting
- **Weaknesses**: No official API yet, must use Discord bot workaround

**For WF-02 (Jewelry Precision Engine)**:
```javascript
// Dual model approach
Step 1: Gemini 2.5 Pro Vision
  Input: User's jewelry photo
  Output: {
    metal_type: "14K yellow gold",
    gemstone: "round brilliant diamond, 1ct estimated",
    setting_style: "4-prong solitaire",
    surface_condition: "polished with minor wear",
    lighting_analysis: "soft diffused, needs more contrast",
    physics_parameters: {
      gold_roughness: 0.03,
      diamond_ior: 2.417,
      environment: "neutral_studio"
    }
  }

Step 2: Nano Banana SDXL Pro 3 (Replicate)
  Input: Physics-based prompt (auto-generated from Step 1 JSON)
  Output: Physically accurate rendered jewelry image
  Cost: $0.001 (Gemini) + $0.05 (SDXL) = $0.051 total
```

---

## CATEGORY 2: FASHION & APPAREL

### Physical Properties to Simulate

**Fabrics** (Cotton, Silk, Wool, Denim):
```
Cotton (T-Shirt):
  - Base Color: User-specified (e.g., white RGB 245,245,245)
  - Roughness: 0.7 (matte, non-reflective)
  - Subsurface Scattering: Shallow (0.5mm depth)
  - Fabric Weave: Visible at macro (thread texture)
  - Drape Coefficient: 0.6 (medium stiffness)
  - Wrinkles: Natural folding at joints (elbow, armpit)

Silk:
  - Sheen: Anisotropic specular (directional highlights)
  - Roughness: 0.2 (semi-glossy)
  - Drape: 0.9 (flows naturally, low stiffness)
  - Micro-Wrinkles: Fine parallel creases

Denim:
  - Weave Pattern: Visible twill diagonal lines
  - Color Fade: Lighter at stress points (knees, pockets)
  - Thickness: Visible fabric edge (3mm stacked layers)
  - Stitching: Contrast thread, 8 stitches per inch

Leather:
  - Surface Grain: Visible pores and texture
  - Roughness Variation: 0.3-0.6 (weathered areas rougher)
  - Edge Finish: Cut edges show fiber layers
  - Patina: Darker creases, lighter wear points
```

**The Drape Problem**:
AI often makes clothes look "painted on" or stiff like cardboard.

**Solution - Fabric Physics Simulation**:
```
Drape Coefficient = Fabric Weight / Fabric Stiffness

Cotton T-Shirt:
  Weight: 150 g/m²
  Stiffness: 250 N/m
  Drape: 0.6 (medium flow)

Silk Dress:
  Weight: 60 g/m²
  Stiffness: 50 N/m
  Drape: 1.2 (very flowy)

Wool Coat:
  Weight: 500 g/m²
  Stiffness: 1000 N/m
  Drape: 0.5 (structured, holds shape)
```

### AI Prompt Engineering (Fashion)

**GOOD Prompt** (Realistic Clothing):
```
"Fashion product photography of a women's navy blue silk blouse on a professional model.

FABRIC RENDERING:
- Silk charmeuse with anisotropic sheen (directional highlights)
- Roughness 0.25 (semi-glossy finish)
- Drape coefficient 1.1 (flows naturally with body movement)
- Micro-wrinkles along seams and arm creases
- Subtle transparency in thin areas (NOT see-through, just realistic)
- Fabric weight: 60 g/m² (lightweight, airy)

DRAPE PHYSICS:
- Natural folding at shoulder seams
- Gentle gather at waistline
- Sleeve falls with gravity (not stiff)
- Fabric follows body contour but NOT tight
- Collar stands correctly with interfacing support

COLOR & PATTERN:
- Navy blue base (RGB 0, 20, 50)
- Slight color variation in folds (darker in creases)
- Highlights shift from silver to blue (anisotropic)

MODEL POSE:
- Neutral standing pose, arms at sides
- Body type: Fit model size 2 (standard clothing sample size)
- Pose matches fabric flow (e.g., slight hip tilt creates natural drape)

LIGHTING:
- Key light: Large octabox 60° angle (soft, wraps around fabric)
- Fill light: Silver reflector (enhances silk sheen)
- Back light: Rim light to separate from background
- No harsh shadows (fabric detail is key)

BACKGROUND:
- Seamless white cyc wall
- Subtle gradient (lighter top, slightly darker bottom)
- NO distracting elements

CAMERA:
- 85mm portrait lens equivalent
- f/4 (sharp product, slight background blur)
- Focus on collar/neckline detail

AVOID:
- Fabric looks painted on body
- Stiff/cardboard appearance
- Perfect symmetry in drape folds
- Over-glossy "plastic bag" sheen
- See-through fabric (unless intentional)
- Unnatural pose that defies gravity
```

### Recommended Models for Fashion

**Primary: RunwayML Gen-3 Alpha / Act-Two**
- **Why**: Specializes in human models + fabric physics
- **Cost**: $0.12/image
- **Strengths**: Best-in-class drape simulation, realistic human models
- **Weaknesses**: Expensive, slower generation time

**Fallback: Fal.ai Fashion ControlNet**
- **Why**: Fine-tuned for clothing/fashion
- **Cost**: $0.08/image
- **Strengths**: Good at preserving fabric patterns, accurate colors

---

## CATEGORY 3: FURNITURE & LARGE OBJECTS

### Physical Properties to Simulate

**The Perspective Problem**:
Large furniture (sofas, tables, beds) requires:
- Proper vanishing point perspective
- Correct shadow casting (contact shadows + ambient occlusion)
- Floor plane detection
- Scale accuracy (human-reference sizing)

**Wood Grain**:
```
Oak:
  - Grain Pattern: Wide rays, prominent medullary rays
  - Color: Light tan (RGB 210, 180, 140)
  - Finish: Satin polyurethane (roughness 0.4)
  - Pores: Open grain, visible texture

Walnut:
  - Grain Pattern: Wavy, swirling figure
  - Color: Dark chocolate brown (RGB 80, 50, 30)
  - Finish: Glossy lacquer (roughness 0.1)
  - Depth: Subsurface scattering shows wood depth

Pine:
  - Grain Pattern: Tight knots, resin pockets
  - Color: Yellow-tan (RGB 230, 200, 150)
  - Finish: Natural oil (roughness 0.6, matte)
```

### AI Prompt Engineering (Furniture)

**GOOD Prompt** (Realistic Furniture):
```
"Product photography of a mid-century modern walnut dining table, 72 inches long.

MATERIAL RENDERING:
- Black walnut wood with natural oil finish
- Grain pattern: Wavy cathedral figure on tabletop
- Roughness 0.5 (semi-matte, slight sheen in highlights)
- Open grain texture visible at macro (NOT smooth plastic)
- Color variation: Darker heartwood, lighter sapwood streaks
- Edge detail: Rounded bullnose edge, sanded to 220 grit

SPATIAL AWARENESS:
- Table on hardwood floor (oak planks, 3" wide)
- Floor plane: Horizontal reference, proper perspective
- Vanishing point: 1-point perspective (camera level with table)
- Scale reference: Table height 30" (standard dining height)

SHADOWS & LIGHTING:
- Contact shadow: Dark 1" strip directly under table edges (100% opacity)
- Ambient occlusion: Soft gradient shadow extending 6" from legs (fades to 0%)
- Reflected light: Floor reflects warm tone back onto table underside
- Key light: Softbox 45° angle, 5000K neutral
- Fill light: Bounce card opposite side

BACKGROUND:
- Neutral gray studio backdrop (RGB 200, 200, 200)
- Seamless transition from floor to wall (cyc wall curve)
- NO visible horizon line or hard floor edge

CAMERA:
- 50mm lens equivalent (natural perspective)
- f/8 (sharp throughout, no background blur for furniture)
- Eye level view (camera at 5 feet height, table is 2.5 feet)
- Slight 3/4 angle (shows length + width, not straight-on)

WOOD GRAIN DETAIL:
- Grain direction: Parallel to long axis of table
- Book-matched planks (mirror image grain pattern)
- Medullary rays visible (walnut characteristic)
- NO repetitive tiling (each plank unique grain)

AVOID:
- Floating in space (no floor reference)
- Perfect CG symmetry (add subtle wood color variation)
- Plastic/laminate appearance
- Incorrect scale (table looks dollhouse-sized)
- Harsh black drop shadow (unrealistic)
- Grain pattern repeats/tiles
```

### Recommended Models for Furniture

**Primary: Gemini 3 Flash with ControlNet Depth Map**
- **Why**: Understands spatial relationships, floor plane detection
- **Cost**: $0.50/1M tokens + $0.02 (ControlNet)
- **Process**:
  1. Gemini analyzes input image, detects floor plane
  2. Generates depth map (grayscale distance from camera)
  3. ControlNet uses depth map to guide SDXL rendering
  4. Result: Proper perspective and shadows

**Fallback: Stability AI SDXL 1024 with Perspective Hints**
- **Cost**: $0.015/image
- **Strengths**: Fast, cheap
- **Weaknesses**: May get perspective wrong on first try

---

## CATEGORY 4: GLASS, WATER & LIQUIDS

### Physical Properties to Simulate

**The Refraction Challenge**:
Transparent materials bend light according to IOR (Index of Refraction)

**IOR Values**:
```
Air: 1.0 (baseline)
Water: 1.33
Window Glass: 1.52
Crystal/Lead Glass: 1.6-1.7
Diamond: 2.417
Acrylic/Plastic: 1.49
```

**Subsurface Scattering** (Light penetrates, scatters, exits):
```
Water (Clear):
  - Absorption Color: Slight blue tint (RGB 230, 240, 255)
  - Scattering Distance: 10cm (light travels far)
  - Turbidity: 0 (crystal clear)

Wine (Red):
  - Absorption: Deep red (RGB 100, 10, 10)
  - Scattering Distance: 1cm (concentrated color)
  - Edge Glow: Lighter red at thin edges (meniscus)

Milk:
  - Scattering: High (multiple scattering events)
  - Absorption: White (RGB 255, 250, 245)
  - Translucent, NOT transparent
```

**Caustics** (Light patterns from refraction):
```
Glass of Water:
  - Caustic patterns on table surface beneath glass
  - Intensity: 2x brighter than ambient
  - Pattern: Curved lines following glass curvature
  - Color: Slight chromatic aberration (red/blue fringing)
```

### AI Prompt Engineering (Glass & Liquids)

**GOOD Prompt** (Realistic Glass):
```
"Product photography of a wine glass filled with red wine (Cabernet Sauvignon).

GLASS RENDERING:
- Lead crystal wine glass, thin walls (2mm thickness)
- IOR 1.65 (high refraction, creates strong distortion)
- Roughness 0.01 (perfectly smooth, polished)
- Transmission 0.95 (nearly fully transparent)
- Dispersion 0.02 (slight rainbow edge fringing)
- Fingerprints: 1-2 subtle smudges (realistic touch marks)

WINE RENDERING:
- Color: Deep garnet red (RGB 90, 15, 20)
- Subsurface Scattering: 0.8cm depth (light penetrates wine)
  - Edge Glow: Lighter ruby red at meniscus (RGB 150, 40, 40)
  - Center: Nearly opaque dark red
- Meniscus: Slight curve where wine meets glass (surface tension)
- Sediment: None (filtered wine)

REFRACTION & CAUSTICS:
- Background objects distorted through glass stem
- Caustic light patterns on white surface beneath glass
- Wine refracts light at IOR 1.34 (alcohol/water mix)
- Table reflection shows inverted glass image (Fresnel reflection)

LIGHTING:
- Key light: Softbox 30° angle (creates caustics)
- Back light: Rim light through wine (shows edge glow)
- HDRI: Kitchen_01.hdr (neutral environment reflections in glass)

BACKGROUND:
- White tablecloth (linen texture, subtle weave)
- Seamless white backdrop behind
- Contact shadow: Sharp 1" band under glass base
- Caustic patterns: 6" diameter pool of light beneath glass

CAMERA:
- Macro lens 100mm equivalent
- f/5.6 (glass sharp, background slightly soft)
- Focus: Wine surface meniscus

PHYSICS:
- Ray tracing with 8+ light bounces (glass requires multiple reflections)
- Dispersion rendering (chromatic aberration at edges)
- Fresnel reflections (view-dependent, stronger at grazing angles)

AVOID:
- Solid/opaque glass (must be transparent)
- No refraction/distortion (looks flat)
- Missing caustics (dead giveaway of fake rendering)
- Perfect cleanliness (add subtle fingerprints/dust)
- Uniform wine color (must show subsurface gradient)
```

### Recommended Models for Glass/Liquids

**Primary: OpenAI DALL-E 3 with Ray-Trace Rendering Hint**
- **Why**: Strong at transparency, refraction, caustics
- **Cost**: $0.04/image (1024x1024)
- **Strengths**: Understands physics terminology in prompts
- **Weaknesses**: Occasional caustic pattern errors

**Fallback: Midjourney v7 --style raw**
- **Why**: Photorealistic mode excels at transparent materials
- **Cost**: $0.08/image (estimated)
- **Strengths**: Best caustics rendering
- **Weaknesses**: Less controllable via prompt

---

## CATEGORY 5: ORGANIC MATERIALS (Wood, Leather, Ceramics)

### Physical Properties

**Leather** (Full Grain):
```
Surface Texture:
  - Grain Pattern: Natural pore structure (NOT uniform)
  - Roughness Map: 0.4-0.7 (matte to semi-gloss based on finish)
  - Creases: Darker in folds (dye accumulation)
  - Edge: Raw cut edge shows fiber layers

Patina (Aged Leather):
  - Wear Points: Lighter color (oils/friction)
  - Creases: Darker (dye concentration)
  - Overall: Color deepens with age
```

**Ceramics** (Stoneware):
```
Glaze:
  - Base: Semi-gloss clear glaze
  - Roughness: 0.2 (smooth but not perfect)
  - Imperfections: Tiny pinholes, crazing (fine cracks)
  - Color Variation: Kiln effects (darker at base, lighter at rim)

Unglazed Areas:
  - Clay Body: Matte rough surface (roughness 0.9)
  - Absorption: Slight subsurface scattering (porous)
```

### Recommended Models

**Wood Products**: Stability AI SDXL (good at organic textures)
**Leather Goods**: Nano Banana SDXL Pro 3 (material detail)
**Ceramics**: Gemini 3 Flash → SDXL (prompt generation + render)

---

## MODEL SELECTION MATRIX

| Category | Primary Model | Cost | Fallback | Workflow |
|----------|--------------|------|----------|----------|
| **Jewelry** | Nano Banana SDXL Pro 3 | $0.05 | Gemini 3 Flash + SDXL | WF-02 |
| **Fashion** | RunwayML Act-Two | $0.12 | Fal.ai ControlNet | WF-03 |
| **Glass/Liquid** | DALL-E 3 | $0.04 | Midjourney v7 | WF-04 |
| **Furniture** | Gemini 3 Flash + ControlNet | $0.03 | SDXL 1024 | WF-05 |
| **General Goods** | SDXL 1024 | $0.015 | Gemini 3 Flash | WF-06 |

---

## WORKFLOW IMPLEMENTATION

### WF-02: Jewelry Precision Engine (CRITICAL)

**Step-by-Step Logic**:

```javascript
// Step 1: Analyze input image with Gemini Vision
const analysis = await geminiVision.analyze(inputImage, {
  prompt: `
    Analyze this jewelry item. Identify:
    1. Metal type (gold/silver/platinum/other) and karat
    2. Gemstone type, cut, and estimated carat weight
    3. Setting style (prong/bezel/channel/pave)
    4. Surface condition (polished/brushed/hammered/worn)
    5. Lighting issues in current photo
    6. Suggested physics parameters for realistic rendering
  `
});

// Step 2: Generate physics-based rendering prompt
const renderingPrompt = buildJewelryPrompt({
  metal: {
    type: analysis.metal_type, // "14K yellow gold"
    roughness: analysis.surface_condition === 'polished' ? 0.02 : 0.4,
    ior: METAL_IOR_TABLE[analysis.metal_type], // Complex IOR lookup
    color: METAL_COLOR_TABLE[analysis.metal_type], // RGB values
    patina: analysis.wear_level > 0.3 // Add edge darkening
  },
  gemstone: {
    type: analysis.gemstone, // "diamond"
    cut: analysis.cut_style, // "round brilliant"
    ior: GEMSTONE_IOR_TABLE[analysis.gemstone], // 2.417 for diamond
    dispersion: GEMSTONE_DISPERSION[analysis.gemstone], // 0.044
    clarity: "VS1", // Default high clarity for hero shots
    carat: analysis.estimated_carat,
    facets: CUT_FACET_COUNT[analysis.cut_style] // 58 for round brilliant
  },
  lighting: {
    key_light: "softbox_45deg_5500K",
    fill_ratio: 2.0, // Key is 2x brighter than fill
    rim_light: true,
    hdri: "studio_neutral_gray.hdr",
    caustics: true // REQUIRED for gemstones
  },
  rendering: {
    bounces: 8, // Light bounces for ray tracing
    samples: 256, // Quality (higher = less noise)
    engine: "path_tracing" // vs. bidirectional
  }
});

// Step 3: Render with Replicate (Nano Banana)
const rendered = await replicate.run("fofr/sdxl-pro-3", {
  input: {
    prompt: renderingPrompt,
    negative_prompt: "plastic, cartoon, toy, flat lighting, no reflections, solid color gemstone, blurry facets, missing caustics",
    width: 1024,
    height: 1024,
    guidance_scale: 12, // Strong adherence to prompt
    num_inference_steps: 50 // Quality iterations
  }
});

// Step 4: Post-processing (if needed)
const final = await postProcess(rendered, {
  sharpen: 0.3, // Enhance facet edges
  contrast: 1.1, // Boost specular highlights
  color_grade: "neutral_gray_balance", // No color cast
  resize: [1500, 1500] // Marketplace standard
});

return final;
```

**Estimated Time**: 8-12 seconds total
**Cost**: $0.001 (Gemini) + $0.05 (Replicate) = $0.051
**Quality**: Near-photographic for jewelry

---

### WF-03: Fashion Engine

**Step-by-Step Logic**:

```javascript
// Step 1: Fabric analysis
const fabricAnalysis = await geminiVision.analyze(inputImage, {
  prompt: `
    Analyze this clothing item:
    1. Fabric type (cotton/silk/wool/denim/leather)
    2. Color and any patterns
    3. Drape characteristics (stiff/flowy/structured)
    4. Current lighting issues
    5. Model pose suggestion for natural drape
  `
});

// Step 2: Calculate fabric physics parameters
const drapeCoefficient = calculateDrape({
  fabric_type: fabricAnalysis.fabric,
  weight: FABRIC_WEIGHT_TABLE[fabricAnalysis.fabric], // g/m²
  stiffness: FABRIC_STIFFNESS_TABLE[fabricAnalysis.fabric] // N/m
});

// Step 3: Generate fashion prompt with physics
const fashionPrompt = buildFashionPrompt({
  fabric: {
    type: fabricAnalysis.fabric,
    roughness: FABRIC_ROUGHNESS[fabricAnalysis.fabric],
    drape: drapeCoefficient,
    sheen: fabricAnalysis.fabric === 'silk' ? 'anisotropic' : 'matte',
    transparency: fabricAnalysis.fabric === 'silk' ? 0.1 : 0.0
  },
  model: {
    body_type: "fit_model_size_2", // Standard sample size
    pose: fabricAnalysis.suggested_pose || "neutral_standing",
    skin_tone: "neutral_medium" // Doesn't distract from product
  },
  lighting: {
    type: "soft_fashion", // Large diffused sources
    ratio: 1.5, // Gentle fill (not dramatic)
    rim: true // Separates fabric from background
  }
});

// Step 4: Render with RunwayML
const rendered = await runwayML.generate({
  prompt: fashionPrompt,
  model: "gen-3-alpha",
  guidance: 10,
  steps: 40
});

return rendered;
```

**Estimated Time**: 15-20 seconds
**Cost**: $0.12
**Quality**: Best-in-class fabric drape physics

---

## PROMPT LIBRARY (TEMPLATES)

### Template 1: Metallic Jewelry
```
"[PRODUCT_TYPE] made of [METAL_TYPE] with [GEMSTONE_TYPE].

METAL: [METAL_COLOR] with roughness [0.01-0.4], metallic 1.0, IOR [COMPLEX_IOR]
GEMSTONE: IOR [2.417 for diamond], dispersion [0.044], [FACET_COUNT] facets visible
LIGHTING: Softbox 45°, 5500K, fill ratio 2:1, HDRI studio_neutral.hdr, caustics enabled
BACKGROUND: Pure white RGB(255,255,255), soft contact shadow
CAMERA: Macro 100mm, f/5.6, focus on [FOCAL_POINT]
PHYSICS: 8+ bounces, spectral rendering, Fresnel reflections
AVOID: Plastic, cartoon, toy, flat lighting, no caustics"
```

### Template 2: Fabric/Fashion
```
"[CLOTHING_TYPE] made of [FABRIC_TYPE] on professional model.

FABRIC: Roughness [0.2-0.7], drape coefficient [CALCULATED], [SHEEN_TYPE]
DRAPE: Natural folding at [SEAMS], gravity-driven flow, [STIFFNESS] stiffness
MODEL: Fit size 2, [POSE], neutral skin tone
LIGHTING: Soft octabox 60°, silver fill, rim light
BACKGROUND: White seamless, subtle gradient
CAMERA: 85mm portrait, f/4
AVOID: Painted-on, stiff, perfect symmetry, plastic sheen"
```

### Template 3: Glass/Transparent
```
"[GLASS_OBJECT] containing [LIQUID_TYPE].

GLASS: IOR [1.5-1.7], roughness 0.01, transmission 0.95, dispersion [0.02]
LIQUID: IOR [1.33-1.34], subsurface scattering [COLOR], meniscus curve
CAUSTICS: Ray-traced patterns on surface, [DIAMETER] spread
LIGHTING: Back-light through liquid (edge glow), softbox for caustics
BACKGROUND: White with visible caustic patterns
CAMERA: Macro 100mm, f/5.6
PHYSICS: 8+ bounces, dispersion rendering, Fresnel
AVOID: Opaque, no refraction, missing caustics, solid color liquid"
```

---

## TESTING & QUALITY ASSURANCE

### Jewelry QA Checklist:
- [ ] Metal shows environment reflections (not solid color)
- [ ] Gemstone facets are sharp and countable
- [ ] Caustic light patterns visible beneath diamond
- [ ] Specular highlights have correct color temperature (warm for gold, cool for silver)
- [ ] Micro-scratches or patina present (not too perfect)
- [ ] IOR refraction visible (background distorts through gemstone)
- [ ] No "plastic toy" appearance

### Fashion QA Checklist:
- [ ] Fabric drapes naturally (not painted on body)
- [ ] Wrinkles at natural stress points (elbows, shoulders)
- [ ] Sheen matches fabric type (matte cotton, glossy silk)
- [ ] Fabric edge shows thickness (not 2D cutout)
- [ ] Model pose complements drape direction
- [ ] No "cardboard stiff" appearance

### Glass/Liquid QA Checklist:
- [ ] Refraction distorts background objects
- [ ] Caustic patterns present on surface beneath
- [ ] Liquid shows edge glow (subsurface scattering)
- [ ] Glass has subtle fingerprints or imperfections
- [ ] Meniscus curve visible at liquid/glass interface
- [ ] Chromatic aberration at high-refraction edges

---

## ADDITIONAL CATEGORIES TO CONSIDER

### 6. Electronics & Tech
**Challenge**: Reflective screens, brushed aluminum, LED lights
**Solution**: Polarized lighting to control screen reflections, separate render pass for glowing LEDs
**Model**: SDXL with "product photography" fine-tuning

### 7. Food Products
**Challenge**: Subsurface scattering (bread, cheese), wetness (fruits), steam/condensation
**Solution**: High-quality reference images, "food photography" style prompts
**Model**: Midjourney v7 (excels at appetizing food renders)

### 8. Cosmetics & Beauty
**Challenge**: Translucent liquids, glass bottles, metallic caps, label detail
**Solution**: Combine glass rendering + label overlay + lighting
**Model**: Gemini 3 Flash (analysis) + DALL-E 3 (render)

---

## FINAL RECOMMENDATIONS

### For MVP (Jan 15 Launch):

**CRITICAL: Nail These 3 Categories First**:
1. ✅ **Jewelry** (WF-02): Use Replicate Nano Banana Pro 3 + physics-based prompts
2. ✅ **General Goods** (WF-06): Use Stability SDXL (fast, cheap, good enough)
3. ✅ **Background Removal** (WF-07): Use Photoroom (already in TDD)

**Phase 2 (Post-Launch, based on eBay tester feedback)**:
4. Fashion (WF-03): Add if apparel sellers in test group
5. Glass/Liquid (WF-04): Add if glass/beverage sellers request
6. Furniture (WF-05): Add if furniture sellers request

### Model Budget for 100 Jobs/Day:

| Workflow | Model | Jobs/Day | Cost/Job | Daily Cost |
|----------|-------|----------|----------|------------|
| WF-01 (Decider) | Gemini 2.0 Free | 100 | $0.00 | $0.00 |
| WF-02 (Jewelry) | Nano Banana Pro 3 | 20 | $0.05 | $1.00 |
| WF-06 (General) | SDXL 1024 | 60 | $0.015 | $0.90 |
| WF-07 (BG Remove) | Photoroom | 100 | $0.02 | $2.00 |
| WF-10 (Description) | Gemini 2.0 Free | 80 | $0.00 | $0.00 |
| **TOTAL** | | | | **$3.90/day** |

**Monthly API costs**: $3.90 × 30 = $117/month (well within budget)

---

## NEXT STEPS

1. **User Approval**: Confirm physics-based approach and model selections
2. **Prompt Testing**: Generate 10 test renders per category with sample images
3. **Quality Benchmark**: Compare AI renders vs. professional product photography
4. **Iteration**: Refine prompts based on eBay tester feedback
5. **Documentation**: Create prompt library in n8n for each category

---

**Ready to implement. Awaiting user approval to begin testing with Gemini 2.0 Flash and Replicate Nano Banana Pro 3.**
