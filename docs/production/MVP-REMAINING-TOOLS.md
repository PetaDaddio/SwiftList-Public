# SwiftList MVP — Remaining Production Tools

**Created**: February 19, 2026
**Target**: MVP Launch (Q1 2026)
**Status**: In Progress

---

## Tool Status Overview

| # | Tool | Status | Endpoint | Ralph Wiggum Script |
|---|------|--------|----------|-------------------|
| 1 | Product Description Generator | 🟡 Build Tonight | `/api/jobs/product-description` | Yes |
| 2 | Product in Hands | 🟡 Build Tonight | `/api/jobs/product-in-hands` | Yes |
| 3 | Invisible Mannequin | 🟠 Needs Testing/Fix | `/api/jobs/invisible-mannequin` | Yes |
| 4 | Convert to SVG | 🟠 Needs Testing/Fix | `/api/jobs/convert-to-svg` | Yes |

---

## 1. Product Description Generator

**Workflow**: WF-10 (Product Description)
**Priority**: P0 — Market research shows descriptions are a huge pain point for sellers

### What Exists
- Gemini 2.0 Flash image classifier at `/api/ai/classify-image` already identifies products
- Specialty Logic Modules in `/docs/workflows/active/specialty-logic-modules/`:
  - `JewelrySpecialty.js` — luxury tone, carat/clarity vocab
  - `FashionSpecialty.js` — approachable tone, fabric/fit vocab
  - `GlassSpecialty.js` — glass/liquid product vocab
  - `FurnitureSpecialty.js` — furniture/home product vocab
  - `GeneralSpecialty.js` — neutral fallback
- Job completion screen already delivers outputs categorized by marketplace

### What Needs Building
- API endpoint: `/api/jobs/product-description/+server.ts`
- Gemini Flash generates marketplace-specific descriptions (Etsy, Amazon, Poshmark, eBay)
- Integrate specialty logic modules for category-aware vocabulary
- Return multiple descriptions (one per marketplace) in single response
- Cost target: ~$0.002/description (Gemini Flash)

---

## 2. Product in Hands

**Workflow**: WF-37 (Product in Human Hands)
**Priority**: P1 — Lifestyle imagery with human interaction

### What Exists
- Scene Analyst (`src/lib/ai/scene-analyst.ts`) — extracts lighting, placement, mood from reference images
- `buildStyleComposerPrompt()` — converts scene analysis to Imagen generation prompt
- Fabric Intelligence routing (`src/lib/ai/fabric-intelligence.ts`)
- Fabric Engine orchestrator DAG pattern (parallel analysis, retry loops, quality gating)

### What Needs Building
- Hands Analyst agent (`src/lib/ai/hands-analyst.ts`) — analyzes hand grip, contact points, skin lighting
- Composition Validator — ensures hands frame product without obscuring it
- API endpoint: `/api/jobs/product-in-hands/+server.ts`
- Art direction field support (skin color, hand placement, style preferences)
- Gemini Imagen 3 generation with hands-aware prompt
- Cost target: ~$0.006-0.010/image (2x Gemini analysis + Imagen generation)

---

## 3. Invisible Mannequin (Ghost Mannequin)

**Workflow**: WF-TBD (Apparel Ghost Mannequin Effect)
**Priority**: P1 — Essential for clothing e-commerce

### What Exists
- Full endpoint at `/api/jobs/invisible-mannequin/+server.ts` (278 lines)
- 3-step pipeline: bg removal → garment classification (Gemini Flash) → generation
- Garment classification via Gemini 2.0 Flash (18 garment categories)
- Uses `gemini-2.0-flash-exp:generateContent` for image generation

### What Needs Fixing/Testing
- **CRITICAL**: Image generation uses text completion API (`generateContent`), NOT Imagen API. May need switching to Imagen 3 endpoint for actual image output
- End-to-end testing with real garment images
- Verify Gemini returns inline image data (not just text)
- Cost validation ($0.022/job estimate)

---

## 4. Convert to SVG

**Workflow**: WF-TBD (Raster to Vector Conversion)
**Priority**: P2 — Useful for logos, simple graphics

### What Exists
- Full endpoint at `/api/jobs/convert-to-svg/+server.ts` (294 lines)
- Pure JS bitmap-to-SVG tracer (no external dependencies)
- Marching squares contour detection + Ramer-Douglas-Peucker path simplification
- Two modes: 'simple' (512px) and 'detailed' (1024px)
- Returns SVG string directly

### What Needs Testing
- End-to-end testing with various image types
- Quality assessment vs. dedicated tools (potrace, vtracer)
- Verify output SVG renders correctly in browsers
- May need multi-color support (currently outputs single-color paths)

---

## Overnight Build Plan (Feb 19, 2026)

### Ralph Wiggum Scripts
Each tool has a dedicated Ralph Wiggum autonomous build prompt. Run in separate Terminal tabs:

1. **Product Description** — Builds new endpoint + integrates specialty modules
2. **Product in Hands** — Builds new endpoint + hands analyst + orchestrator
3. **Invisible Mannequin + SVG** — Tests/fixes existing endpoints

### Morning Review Checklist
- [ ] Check each Terminal tab for completion/errors
- [ ] Review generated code for security compliance (CLAUDE.md)
- [ ] Test each endpoint with sample images
- [ ] Commit passing code to main branch

---

## Related Documentation
- TDD v4.0: `/docs/TDD_MASTER_v4.0.md`
- Mission Control v7: `/n8n-workflows/MISSION_CONTROL_DASHBOARD_v7_BRIA_RMBG_2.html`
- Security Protocol: `/.claude/CLAUDE.md`
- Specialty Logic Modules: `/docs/workflows/active/specialty-logic-modules/`
