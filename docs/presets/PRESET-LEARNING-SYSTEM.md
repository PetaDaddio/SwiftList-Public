# SwiftList Preset Learning System
## AI-Powered Visual Style Improvement Through User-Generated Training

**Date**: January 3, 2026
**Status**: Design Phase
**Purpose**: Enable SwiftList to learn from user-generated presets and continuously improve visual style quality

---

## EXECUTIVE SUMMARY

SwiftList currently has **25 curated professional presets** (Steven Noble, Lyle Hehn, Hiker Booty, etc.) as the foundation "Vibe Library." This document outlines how to build a **self-improving learning system** that:

1. **Learns from user-generated presets** (what works, what doesn't)
2. **Automatically improves existing presets** based on usage data
3. **Generates new presets** by combining successful patterns
4. **Curates quality** through algorithmic and human review
5. **Rewards creators** whose presets perform well (token royalties)

**Key Innovation**: SwiftList becomes **smarter over time** as users create, test, and refine visual styles - creating a **network effect moat** competitors cannot replicate.

---

## CURRENT STATE ANALYSIS

### Existing Preset Structure (Database Schema)

```sql
CREATE TABLE presets (
  preset_id UUID PRIMARY KEY,
  creator_user_id TEXT REFERENCES profiles(user_id),
  preset_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'engraving', 'illustration', 'print', etc.
  description TEXT,

  -- Core prompt engineering
  base_prompt TEXT NOT NULL,
  style_modifiers JSONB, -- composition, technique, colors, texture
  color_palettes JSONB, -- {"vintage": ["#8B1A1A", ...], "heritage": [...]}
  negative_prompt TEXT,

  -- Metadata
  tags TEXT[],
  best_for TEXT[], -- use cases: 'packaging', 'logos', 'jewelry', etc.

  -- Quality & discovery
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,

  -- Search & discovery (WF-23 Market Optimizer)
  embedding VECTOR(1536), -- pgvector for semantic search

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Observations**:
- ✅ **Good foundation**: Structured prompts, metadata, embeddings for search
- ⚠️ **Missing**: Quality scores, A/B testing results, performance metrics
- ⚠️ **Missing**: Learning feedback loop (which presets work best?)
- ⚠️ **Missing**: Preset versioning (track improvements over time)

---

## LEARNING SYSTEM ARCHITECTURE

### Overview: 5-Layer Learning Pipeline

```
Layer 1: Data Collection
  ↓
Layer 2: Quality Scoring (Algorithmic + Human)
  ↓
Layer 3: Pattern Recognition (AI Analysis)
  ↓
Layer 4: Preset Generation (Automated Improvement)
  ↓
Layer 5: Curation & Deployment (Human-in-Loop)
```

---

## LAYER 1: DATA COLLECTION

### What Data to Collect

Every time a user uses a preset (via WF-02-06 Specialty Engines or WF-09 Lifestyle Setting), log:

```sql
CREATE TABLE preset_usage_metrics (
  usage_id UUID PRIMARY KEY,
  preset_id UUID REFERENCES presets(preset_id),
  user_id TEXT REFERENCES profiles(user_id),
  job_id UUID REFERENCES jobs(job_id),

  -- Input context
  product_category TEXT, -- 'jewelry', 'fashion', 'furniture', etc.
  marketplace TEXT, -- 'amazon', 'etsy', 'poshmark'
  input_image_url TEXT,

  -- Output quality
  output_image_url TEXT,
  execution_time_seconds FLOAT,
  ai_cost_usd DECIMAL(10, 4),

  -- User feedback (explicit)
  user_rating INTEGER, -- 1-5 stars (optional, collected later)
  user_kept_result BOOLEAN, -- Did user download/use the output?
  user_regenerated BOOLEAN, -- Did user try again with different preset?

  -- System feedback (implicit)
  image_quality_score FLOAT, -- 0-100 (automatic AI quality detection)
  prompt_adherence_score FLOAT, -- 0-100 (how well output matched prompt)
  marketplace_compliance_score FLOAT, -- 0-100 (Amazon/Etsy requirements)

  -- A/B testing
  ab_test_variant TEXT, -- If preset has multiple versions being tested

  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Metrics**:
1. **Usage Count**: How often preset is used
2. **Keep Rate**: % of users who kept the result (didn't regenerate)
3. **Quality Score**: Automated AI assessment of output quality
4. **Marketplace Compliance**: Does output meet Amazon/Etsy requirements?
5. **User Ratings**: Explicit 5-star feedback (optional)

---

### Automatic Quality Detection (Image Quality Score)

**Implementation**: WF-28 (new workflow)

**Purpose**: Automatically score every generated image for technical quality

**Method**: Use CLIP (OpenAI) or Gemini Vision to analyze outputs for:
- **Clarity**: Sharp vs blurry (0-100)
- **Composition**: Balanced vs cluttered (0-100)
- **Color Harmony**: Professional vs amateurish (0-100)
- **Prompt Adherence**: How well output matches style description (0-100)
- **Technical Issues**: Artifacts, distortions, text errors (penalties)

**Example**:
```javascript
// WF-28: Image Quality Scorer
const qualityCheck = await gemini.vision({
  image: outputImageUrl,
  prompt: `Analyze this product image and score it on:
    1. Sharpness/Clarity (0-100)
    2. Composition Balance (0-100)
    3. Color Harmony (0-100)
    4. Professional Quality (0-100)
    5. Technical Issues (list any artifacts, distortions, text errors)

    Return JSON: {clarity, composition, color_harmony, professional, issues, overall_score}`
});

// Store in database
await db.preset_usage_metrics.update({
  usage_id: currentUsageId,
  image_quality_score: qualityCheck.overall_score,
  quality_breakdown: qualityCheck
});
```

**Cost**: $0.002/image (Gemini Vision FREE tier)
**Runs**: Automatically after every preset usage
**Impact**: Objective quality data for every single output (no human review needed)

---

### Implicit User Feedback (Keep Rate)

**Track user behavior** to infer satisfaction:

```javascript
// When user downloads/publishes result
await db.preset_usage_metrics.update({
  usage_id: currentUsageId,
  user_kept_result: true // Implicit: User was satisfied
});

// When user clicks "Try another style"
await db.preset_usage_metrics.update({
  usage_id: currentUsageId,
  user_kept_result: false,
  user_regenerated: true // Implicit: User was NOT satisfied
});

// Calculate Keep Rate for preset
const keepRate = await db.query(`
  SELECT
    preset_id,
    COUNT(*) FILTER (WHERE user_kept_result = true) * 100.0 / COUNT(*) as keep_rate_percent
  FROM preset_usage_metrics
  WHERE preset_id = $1
  GROUP BY preset_id
`);
```

**Why This Matters**: Keep Rate is a **leading indicator** of preset quality without requiring explicit ratings.

**Benchmarks**:
- **Excellent Preset**: 70-90% keep rate
- **Good Preset**: 50-70% keep rate
- **Mediocre Preset**: 30-50% keep rate
- **Poor Preset**: <30% keep rate (candidate for removal/improvement)

---

## LAYER 2: QUALITY SCORING

### Composite Quality Score (0-100)

Combine multiple signals into single preset quality score:

```javascript
// WF-29: Preset Quality Calculator (runs nightly)
function calculatePresetQualityScore(presetId) {
  const metrics = db.getPresetMetrics(presetId);

  const weights = {
    keep_rate: 0.35,           // 35% - Most important (user satisfaction)
    avg_image_quality: 0.25,   // 25% - Technical quality
    usage_count: 0.15,         // 15% - Popularity
    marketplace_compliance: 0.15, // 15% - Meets platform requirements
    user_ratings: 0.10         // 10% - Explicit feedback (optional)
  };

  // Normalize usage count (sigmoid function to prevent dominance)
  const normalizedUsage = 100 / (1 + Math.exp(-0.001 * (metrics.usage_count - 500)));

  const qualityScore =
    (weights.keep_rate * metrics.keep_rate_percent) +
    (weights.avg_image_quality * metrics.avg_image_quality_score) +
    (weights.usage_count * normalizedUsage) +
    (weights.marketplace_compliance * metrics.avg_compliance_score) +
    (weights.user_ratings * (metrics.avg_user_rating / 5 * 100));

  return qualityScore;
}
```

**Example**:
```
Preset: "Steven Noble Black & White"
- Keep Rate: 85% → 85 * 0.35 = 29.75
- Avg Image Quality: 92 → 92 * 0.25 = 23.00
- Usage Count: 1,200 → normalize to 89 → 89 * 0.15 = 13.35
- Marketplace Compliance: 95% → 95 * 0.15 = 14.25
- User Ratings: 4.7/5 → 94 → 94 * 0.10 = 9.40

Total Quality Score: 89.75/100 (EXCELLENT)
```

**Store in Database**:
```sql
ALTER TABLE presets ADD COLUMN quality_score FLOAT DEFAULT 0;
ALTER TABLE presets ADD COLUMN quality_updated_at TIMESTAMP;

-- Update nightly via WF-29
UPDATE presets SET
  quality_score = (calculated score),
  quality_updated_at = NOW()
WHERE preset_id = $1;
```

---

### Quality Tiers (Automatic Curation)

Based on quality score, automatically categorize presets:

| Tier | Score Range | Label | Action |
|------|------------|-------|--------|
| S-Tier | 85-100 | "Featured" | Auto-promote to homepage, feature in WF-01 recommendations |
| A-Tier | 70-84 | "Verified" | Show in marketplace with "Verified Quality" badge |
| B-Tier | 50-69 | "Community" | Available in marketplace, no special promotion |
| C-Tier | 30-49 | "Experimental" | Visible only to creator + Pro/Enterprise users |
| D-Tier | 0-29 | "Low Quality" | Auto-hide from marketplace, notify creator for improvement |

**Implementation**:
```sql
-- Auto-update preset tier based on quality score (WF-29 nightly)
UPDATE presets SET
  is_featured = CASE WHEN quality_score >= 85 THEN true ELSE false END,
  is_public = CASE WHEN quality_score >= 30 THEN true ELSE false END,
  quality_tier = CASE
    WHEN quality_score >= 85 THEN 'S-Tier'
    WHEN quality_score >= 70 THEN 'A-Tier'
    WHEN quality_score >= 50 THEN 'B-Tier'
    WHEN quality_score >= 30 THEN 'C-Tier'
    ELSE 'D-Tier'
  END
WHERE quality_updated_at IS NOT NULL;
```

**Impact**:
- **Network effect**: Best presets automatically rise to top
- **Quality control**: Poor presets automatically demoted
- **Creator incentive**: Quality = visibility = royalties

---

## LAYER 3: PATTERN RECOGNITION (AI ANALYSIS)

### Identify What Makes Great Presets

**Goal**: Understand **why** certain presets perform better than others.

**Implementation**: WF-30 (weekly AI analysis)

**Method**: Use Gemini 2.0 Flash (FREE) to analyze top-performing presets and extract patterns.

```javascript
// WF-30: Preset Pattern Analyzer (runs weekly)

// Step 1: Get top 20 presets by quality score
const topPresets = await db.query(`
  SELECT preset_id, preset_name, base_prompt, style_modifiers,
         quality_score, keep_rate_percent, category
  FROM presets
  WHERE quality_score >= 70
  ORDER BY quality_score DESC
  LIMIT 20
`);

// Step 2: Analyze with AI
const analysis = await gemini.flash({
  prompt: `Analyze these top-performing visual presets and identify common patterns:

${JSON.stringify(topPresets, null, 2)}

For each category (engraving, illustration, print, etc.), identify:
1. **Successful Prompt Patterns**: What language/structure works best?
2. **Effective Style Modifiers**: Which composition/technique/texture settings are most common?
3. **Color Palette Trends**: What color schemes perform best for each use case?
4. **Negative Prompt Patterns**: What exclusions are most effective?
5. **Use Case Alignment**: How do best_for tags correlate with quality scores?

Return detailed analysis with specific recommendations for preset improvement.`
});

// Step 3: Store insights
await db.preset_insights.insert({
  analysis_id: uuid(),
  analysis_date: new Date(),
  top_patterns: analysis.patterns,
  recommendations: analysis.recommendations,
  created_at: new Date()
});
```

**Output Example**:
```json
{
  "patterns": {
    "engraving": {
      "successful_prompt_keywords": [
        "volumetric form-following contour hatching",
        "cross-hatching at defined angles",
        "burin tool simulation",
        "extreme detail rendering"
      ],
      "effective_modifiers": {
        "composition": "centered with balanced negative space",
        "technique": "3-4 way cross-hatching maximum",
        "contrast": "100% black vs white, no greyscale"
      },
      "best_color_palettes": {
        "black-white": ["#000000", "#FFFFFF"],
        "vintage-sepia": ["#5C4033", "#F5F5DC"]
      },
      "critical_negative_prompts": [
        "color",
        "greyscale",
        "photorealistic",
        "smooth gradients"
      ]
    },
    "illustration": {
      "successful_prompt_keywords": [
        "bold linocut framework",
        "thick opaque fills",
        "densely packed symbolic elements",
        "horror vacui patterning"
      ]
      // ... more patterns
    }
  },
  "recommendations": [
    "Presets with 'volumetric form-following' language score 23% higher in engraving category",
    "Color palettes with 5-6 colors perform better than 2-3 colors for illustration",
    "Negative prompts explicitly excluding 'photorealistic' improve keep rate by 18%"
  ]
}
```

**Cost**: $0 (Gemini 2.0 Flash FREE tier, runs weekly)
**Impact**: Data-driven insights for improving existing presets and creating new ones

---

### Identify Underserved Niches

**Goal**: Find gaps in preset library (popular use cases with no good presets)

```javascript
// WF-30: Niche Opportunity Detector

// Step 1: Analyze user search queries that return no good matches
const unsuccessfulSearches = await db.query(`
  SELECT
    search_query,
    COUNT(*) as search_count,
    AVG(CASE WHEN clicked_result THEN 1 ELSE 0 END) as click_through_rate
  FROM preset_search_logs
  WHERE search_date >= NOW() - INTERVAL '30 days'
  GROUP BY search_query
  HAVING AVG(CASE WHEN clicked_result THEN 1 ELSE 0 END) < 0.2
  ORDER BY search_count DESC
  LIMIT 50
`);

// Step 2: Cluster similar searches to identify themes
const nicheOpportunities = await gemini.flash({
  prompt: `Analyze these unsuccessful preset searches and identify underserved niches:

${JSON.stringify(unsuccessfulSearches)}

Group similar searches into themes and recommend:
1. What new preset categories should we create?
2. What specific styles are users looking for but not finding?
3. What use cases are underserved?

Return actionable recommendations for preset creation.`
});

// Output: "Users frequently search for 'minimalist product photography' and 'clean white studio' but click rate is only 12%. Opportunity: Create 3-5 presets for modern minimalist commercial photography."
```

**Impact**: Proactively create presets for high-demand, low-supply niches

---

## LAYER 4: PRESET GENERATION (AUTOMATED IMPROVEMENT)

### Strategy 1: Remix Top Performers (Genetic Algorithm)

**Goal**: Create new presets by combining successful elements from multiple top presets

**Method**: Treat presets as "genes" and use genetic algorithm to breed new combinations

```javascript
// WF-31: Preset Remixer (runs weekly)

function remixPresets(preset1, preset2, category) {
  // Combine base prompts (50/50 mix)
  const remixedBasePrompt = `${preset1.base_prompt.split(',').slice(0, 3).join(',')}, ${preset2.base_prompt.split(',').slice(0, 3).join(',')}`;

  // Merge style modifiers (best of both)
  const remixedModifiers = {
    composition: preset1.style_modifiers.composition, // Take from preset1
    technique: preset2.style_modifiers.technique,     // Take from preset2
    colors: blendColorSchemes(preset1, preset2),      // Blend both
    texture: preset1.style_modifiers.texture          // Take from preset1
  };

  // Combine color palettes
  const remixedPalettes = {
    "hybrid": [
      ...preset1.color_palettes.vintage.slice(0, 3),
      ...preset2.color_palettes.heritage.slice(0, 3)
    ]
  };

  // Union of negative prompts (avoid bad outcomes from both)
  const remixedNegatives = [
    ...preset1.negative_prompt.split(','),
    ...preset2.negative_prompt.split(',')
  ].filter(unique).join(', ');

  return {
    preset_name: `${preset1.preset_name} × ${preset2.preset_name} Remix`,
    category: category,
    base_prompt: remixedBasePrompt,
    style_modifiers: remixedModifiers,
    color_palettes: remixedPalettes,
    negative_prompt: remixedNegatives,
    is_ai_generated: true,
    parent_preset_ids: [preset1.preset_id, preset2.preset_id]
  };
}

// Example: Remix "Steven Noble B&W" (89.75 score) + "Lyle Hehn B&W" (84.20 score)
const newPreset = remixPresets(stevenNoble, lyleHehn, 'engraving');

// Result: "Noble-Hehn Hybrid Engraving" with:
// - Steven Noble's volumetric hatching technique
// - Lyle Hehn's bold linocut composition
// - Merged negative prompts from both
// - New color palette blending both styles
```

**A/B Test New Presets**:
- Deploy remix as **C-Tier** (Experimental)
- Track usage for 2 weeks
- If quality score > 70, promote to **B-Tier** (Community)
- If quality score > 85, promote to **A-Tier** (Verified)

**Impact**: Systematically discover new high-quality styles without manual creation

---

### Strategy 2: AI-Generated Variations (Mutation)

**Goal**: Create variations of top presets by intelligently modifying parameters

**Method**: Use Gemini to generate variations that preserve core style but explore parameter space

```javascript
// WF-32: Preset Mutator (runs weekly)

async function mutatePreset(originalPreset) {
  const variations = await gemini.flash({
    prompt: `You are a visual style expert. Given this high-performing preset (quality score: ${originalPreset.quality_score}), create 3 variations that:

    1. PRESERVE the core aesthetic (same category, same fundamental technique)
    2. MODIFY ONE aspect significantly:
       - Variation A: Change color palette (warm → cool, or vice versa)
       - Variation B: Adjust detail level (more intricate OR more minimalist)
       - Variation C: Shift use case (make it better for different product types)

    Original Preset:
    ${JSON.stringify(originalPreset, null, 2)}

    Return 3 complete preset definitions in JSON format, each with:
    - preset_name (descriptive of the variation)
    - base_prompt (modified appropriately)
    - style_modifiers (adjusted for variation)
    - color_palettes (new palettes if color variation)
    - best_for (updated use cases)
    - variation_type ("color_shift" | "detail_adjustment" | "use_case_shift")`,
    response_format: 'json'
  });

  return variations; // Array of 3 new presets
}

// Example: Mutate "Steven Noble Black & White" (89.75 score)
const mutations = await mutatePreset(stevenNoblePreset);

// Result:
// 1. "Steven Noble Warm Sepia" - same technique, vintage color palette
// 2. "Steven Noble Simplified" - same technique, reduced detail for faster execution
// 3. "Steven Noble for Fashion" - adapted for fabric/apparel instead of logos
```

**Deployment Strategy**:
1. Create mutations as **C-Tier** (Experimental)
2. A/B test against original for 2 weeks
3. If mutation outperforms original, promote to same tier as original
4. If mutation underperforms, archive but keep data for learning

**Impact**: Explore parameter space systematically, discover improvements to existing presets

---

### Strategy 3: User Preset Improvement (AI Coaching)

**Goal**: Help users improve their own presets using AI recommendations

**Method**: When user creates a new preset, analyze it and suggest improvements

```javascript
// WF-33: Preset Coach (triggered when user creates preset)

async function coachUserPreset(userPreset) {
  // Get similar high-quality presets in same category
  const similarTopPresets = await db.query(`
    SELECT * FROM presets
    WHERE category = $1
      AND quality_score >= 80
      AND embedding <-> $2 < 0.3
    ORDER BY quality_score DESC
    LIMIT 5
  `, [userPreset.category, userPreset.embedding]);

  // AI analysis comparing user preset to top performers
  const feedback = await gemini.flash({
    prompt: `You are a visual style coach. A user just created this preset:

${JSON.stringify(userPreset, null, 2)}

Compare it to these top-performing presets in the same category (score 80+):

${JSON.stringify(similarTopPresets, null, 2)}

Provide specific, actionable feedback:
1. What's working well? (positive reinforcement)
2. What could be improved? (specific suggestions)
3. Recommended changes to base_prompt, style_modifiers, color_palettes
4. Predicted quality score if user implements your suggestions

Be encouraging but specific. Focus on learnings from top presets.`
  });

  return feedback;
}

// Show feedback to user in UI:
// "Great start! Your preset captures the vintage aesthetic well. To improve:
//  1. Add specific cross-hatching angles (top presets use '0, 45, 90, 135 degrees')
//  2. Strengthen negative prompts (add 'photorealistic, smooth gradients')
//  3. Reduce color palette to 4-5 colors (top presets average 4.2 colors)
//  Predicted score if improved: 72/100 (currently estimated: 58/100)"
```

**UI Integration**:
- Show feedback immediately after preset creation
- User can accept/reject suggestions (A/B test)
- Track whether improved presets perform better (validate coaching)

**Impact**: Educate users, raise average quality of user-generated presets

---

## LAYER 5: CURATION & DEPLOYMENT

### Human-in-Loop Quality Review

**Problem**: Fully automated curation could miss edge cases or promote undesirable content

**Solution**: Hybrid approach with AI pre-screening + human final approval

**Workflow**:

```
User creates preset
  ↓
AI Quality Coach provides feedback (WF-33)
  ↓
User publishes → Starts as C-Tier (Experimental)
  ↓
Collects usage data for 2 weeks (min 50 uses)
  ↓
WF-29 calculates quality score
  ↓
If score >= 70 → AI flags for human review
  ↓
Human curator reviews (5 min per preset):
  - Visual quality check
  - Prompt appropriateness check
  - Brand safety check (no offensive content)
  ↓
If approved → Promote to B-Tier (Community) or A-Tier (Verified)
If rejected → Keep at C-Tier with feedback to creator
  ↓
If score >= 85 for 4 weeks → Auto-promote to S-Tier (Featured)
```

**Human Curator Dashboard**:
```
┌────────────────────────────────────────────────────────┐
│ Presets Pending Review (Score >= 70)                   │
├────────────────────────────────────────────────────────┤
│ Preset: "Industrial Blueprint Tech"                    │
│ Creator: user_12345                                    │
│ Quality Score: 78.5/100                                │
│ Keep Rate: 72%                                         │
│ Usage Count: 127 (2 weeks)                             │
│ Category: illustration                                 │
│                                                         │
│ Sample Outputs: [img] [img] [img]                      │
│                                                         │
│ AI Assessment: "Strong technical quality, good prompt  │
│ structure. No safety issues detected."                 │
│                                                         │
│ [✓ Approve as A-Tier] [× Reject] [? Need More Data]    │
└────────────────────────────────────────────────────────┘
```

**Time Investment**: 5-10 min per preset review
**Volume**: Estimate 5-10 presets/week reach 70+ score (at 100 users)
**Cost**: ~1 hour/week curator time

---

### Preset Versioning (Track Improvements)

**Problem**: If we improve a preset, we lose historical performance data

**Solution**: Version presets like software releases

```sql
CREATE TABLE preset_versions (
  version_id UUID PRIMARY KEY,
  preset_id UUID REFERENCES presets(preset_id),
  version_number INTEGER NOT NULL, -- 1, 2, 3, etc.

  -- Snapshot of preset at this version
  base_prompt TEXT NOT NULL,
  style_modifiers JSONB,
  color_palettes JSONB,
  negative_prompt TEXT,

  -- Performance comparison
  quality_score_before FLOAT,
  quality_score_after FLOAT,
  improvement_percentage FLOAT,

  -- What changed
  change_type TEXT, -- 'manual_edit', 'ai_remix', 'ai_mutation', 'user_improvement'
  change_description TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT -- 'system-ai' or user_id
);

-- Example: Track improvement
INSERT INTO preset_versions (
  version_id, preset_id, version_number,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  quality_score_before, quality_score_after, improvement_percentage,
  change_type, change_description, created_by
) VALUES (
  gen_random_uuid(),
  'preset-123',
  2,
  '(new improved prompt)',
  '(new modifiers)',
  '(new palettes)',
  '(new negatives)',
  78.5, -- Score before improvement
  84.2, -- Score after improvement
  7.3,  -- 7.3% improvement
  'ai_mutation',
  'Added specific cross-hatching angles and strengthened negative prompts based on WF-32 mutation analysis',
  'system-ai'
);
```

**Benefits**:
- **Rollback capability**: If new version performs worse, revert to previous
- **Learning data**: Track which changes actually improve quality
- **Transparency**: Users can see preset evolution history

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)

**Goal**: Build data collection infrastructure

- [ ] Create `preset_usage_metrics` table
- [ ] Modify WF-02 to WF-06 to log preset usage after each job
- [ ] Implement "Keep Result" vs "Try Another Style" tracking in frontend
- [ ] Create WF-28: Image Quality Scorer (Gemini Vision)
- [ ] Test data collection with 25 official presets

**Deliverables**:
- Database schema deployed
- Workflows logging usage data
- WF-28 automatically scoring every output

**Estimated Time**: 8-12 hours
**Cost**: $0 (uses existing infrastructure)

---

### Phase 2: Quality Scoring (Week 3-4)

**Goal**: Implement automated quality scoring and tiering

- [ ] Create WF-29: Preset Quality Calculator (runs nightly)
- [ ] Implement composite quality score algorithm
- [ ] Add `quality_score`, `quality_tier` columns to presets table
- [ ] Build admin dashboard showing preset quality rankings
- [ ] Test with official presets (should all be S-Tier or A-Tier)

**Deliverables**:
- Nightly quality score updates
- Automatic tier assignments (S/A/B/C/D)
- Admin dashboard showing preset leaderboard

**Estimated Time**: 12-16 hours
**Cost**: $0 (Gemini Flash FREE tier)

---

### Phase 3: Pattern Recognition (Month 2)

**Goal**: Extract insights from usage data

- [ ] Create WF-30: Preset Pattern Analyzer (runs weekly)
- [ ] Create `preset_insights` table for storing AI analysis
- [ ] Implement niche opportunity detector (unsuccessful searches)
- [ ] Build insights dashboard for internal team
- [ ] Document learnings in "Preset Best Practices" guide

**Deliverables**:
- Weekly AI-generated insights report
- Data-driven recommendations for preset improvement
- Gap analysis (underserved niches)

**Estimated Time**: 8-12 hours
**Cost**: $0 (Gemini Flash FREE tier, runs weekly)

---

### Phase 4: Automated Generation (Month 2-3)

**Goal**: Build AI-powered preset creation and improvement

- [ ] Create WF-31: Preset Remixer (genetic algorithm)
- [ ] Create WF-32: Preset Mutator (variations generator)
- [ ] Create WF-33: Preset Coach (user feedback system)
- [ ] Implement A/B testing framework for new presets
- [ ] Add `parent_preset_ids`, `is_ai_generated` to presets table

**Deliverables**:
- 5-10 new AI-generated presets per week
- User preset improvement coaching
- A/B testing infrastructure

**Estimated Time**: 20-30 hours
**Cost**: $5-10/month (Gemini API calls for generation)

---

### Phase 5: Curation & Deployment (Month 3-4)

**Goal**: Human-in-loop quality control and deployment

- [ ] Build curator dashboard for preset review
- [ ] Implement preset versioning system
- [ ] Create rollback mechanism (revert to previous version)
- [ ] Build public preset marketplace with filters
- [ ] Launch "Featured Presets" section on homepage

**Deliverables**:
- Full preset marketplace with quality tiers
- Curator workflow (5-10 min per preset review)
- Preset version history and rollback

**Estimated Time**: 16-24 hours
**Cost**: ~1 hour/week curator time

---

## SUCCESS METRICS

### Short-Term (Month 1-3)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Preset usage data coverage | 100% | 0% | ⏳ Phase 1 |
| Official presets quality score | >85/100 | N/A | ⏳ Phase 2 |
| User-created presets (total) | 50+ | 0 | ⏳ Post-launch |
| AI-generated presets (total) | 20+ | 0 | ⏳ Phase 4 |
| Average preset keep rate | >60% | N/A | ⏳ Phase 1 |

---

### Long-Term (Month 6-12)

| Metric | Target | Measurement |
|--------|--------|-------------|
| User-created presets | 500+ | Total in marketplace |
| AI-generated presets | 100+ | Total from WF-31, WF-32 |
| Average quality score (all presets) | 65+ | Weighted average |
| S-Tier presets | 30+ | Count with score >= 85 |
| Preset royalties paid | $5,000+/month | Total to creators |
| Network effect | 40% | % of users who create presets |

**Key Indicator**: **Network Effect Strength**
- At 40%+ preset creation rate, SwiftList has strong network effect
- Each new user potentially adds new presets → more value for all users
- Competitors cannot easily replicate years of community-curated styles

---

## COMPETITIVE MOAT ANALYSIS

### Why This Creates an Unfair Advantage

**Problem**: Most AI image tools are commodities (anyone can access Stable Diffusion, DALL-E, etc.)

**SwiftList's Moat**: Proprietary **preset library** that gets better over time

**Comparison**:

| Factor | Competitors | SwiftList Learning System |
|--------|-------------|---------------------------|
| Preset Quality | Static (manually curated) | Improves automatically (AI + data) |
| Preset Variety | Fixed library | Grows with user contributions |
| Niche Coverage | Generic styles | Detects and fills underserved niches |
| Improvement Speed | Slow (manual updates) | Fast (weekly AI analysis) |
| Network Effect | None | Strong (more users = better presets) |

**Defensibility Timeline**:
- **Month 1**: SwiftList = competitors (both have curated presets)
- **Month 6**: SwiftList has 3× more presets (500 vs 150)
- **Month 12**: SwiftList has 10× more presets (2,000 vs 200)
- **Month 24**: **Impossible to catch up** (5,000+ presets, years of quality data)

**Economic Moat**:
- Competitor must spend 100s of hours manually curating presets
- SwiftList automates this with AI (zero marginal cost)
- SwiftList's presets improve based on real usage data (competitor has no data)

---

## COST ANALYSIS

### Development Costs

| Phase | Time | Labor Cost (@ $100/hr) |
|-------|------|------------------------|
| Phase 1: Foundation | 12 hours | $1,200 |
| Phase 2: Quality Scoring | 16 hours | $1,600 |
| Phase 3: Pattern Recognition | 12 hours | $1,200 |
| Phase 4: Automated Generation | 30 hours | $3,000 |
| Phase 5: Curation | 24 hours | $2,400 |
| **TOTAL** | **94 hours** | **$9,400** |

---

### Ongoing Costs (Monthly)

| Item | Cost |
|------|------|
| WF-28 Image Quality Scorer (Gemini Vision) | $0 (FREE tier, ~10K images/month) |
| WF-29 Quality Calculator (nightly) | $0 (database queries only) |
| WF-30 Pattern Analyzer (weekly) | $0 (Gemini Flash FREE tier) |
| WF-31 Preset Remixer (weekly) | $2-5 (Gemini API, ~50 remixes/month) |
| WF-32 Preset Mutator (weekly) | $2-5 (Gemini API, ~100 mutations/month) |
| WF-33 Preset Coach (per user) | $0.01/preset (Gemini Flash) |
| Human curator (1 hour/week) | $400/month (@ $100/hr) |
| **TOTAL** | **~$410/month** |

**At Scale (1,000 users)**:
- Image Quality Scorer: $20/month (exceeds FREE tier)
- Preset Coach: $50/month (~500 new presets/month)
- Human curator: $800/month (2 hours/week)
- **TOTAL**: ~$880/month

**ROI**:
- Increased preset quality → higher keep rate → fewer regenerations → lower API costs
- Network effect → more user retention → higher LTV
- Estimated ROI: **300-500%** (moat value + retention improvement)

---

## RISKS & MITIGATIONS

### Risk 1: AI-Generated Presets Underperform

**Likelihood**: MEDIUM
**Impact**: MEDIUM

**Mitigation**:
- Start AI-generated presets as C-Tier (Experimental)
- Require 2 weeks of usage data before promotion
- A/B test against human-created presets
- Keep human curator as final approval gate

---

### Risk 2: Quality Score Algorithm Bias

**Likelihood**: MEDIUM
**Impact**: HIGH

**Example**: Algorithm favors popular styles (black & white) over niche styles (psychedelic), even if niche styles are high quality for their use case.

**Mitigation**:
- Calculate quality score **within category** (compare engraving presets to other engraving, not to illustration)
- Normalize usage count (sigmoid function prevents dominance)
- Human curator can override algorithm for exceptional niche presets

---

### Risk 3: User Gaming the System

**Likelihood**: LOW
**Impact**: MEDIUM

**Example**: User creates low-quality preset, then uses it 100 times themselves to boost usage count.

**Mitigation**:
- Weight usage from **different users** more than same user
- Cap impact of any single user on quality score (max 10% from one user)
- Human curator reviews all presets before A-Tier promotion
- Detect suspicious patterns (WF-30 fraud detection)

---

### Risk 4: Preset Plagiarism

**Likelihood**: MEDIUM
**Impact**: MEDIUM

**Example**: User copies official preset verbatim, republishes as their own.

**Mitigation**:
- Use pgvector embedding similarity to detect duplicates
- Flag presets with >95% similarity to existing presets
- Require creator to acknowledge "inspired by" original
- Official presets have special badge (cannot be replicated)

---

## FUTURE ENHANCEMENTS (Post-MVP)

### 1. Preset Collaboration (Month 6+)

Allow multiple users to co-create presets:
- User A creates base preset
- User B suggests improvement (fork)
- If improvement performs better, both get royalty split

**Impact**: Accelerates preset improvement, builds community

---

### 2. Preset Challenges (Month 9+)

Weekly themed challenges:
- "Best Vintage Jewelry Preset" (prize: $100 + featured placement)
- "Most Creative Fashion Preset" (prize: $100 + featured placement)

**Impact**: Engagement, content creation, viral growth

---

### 3. Preset Marketplace Analytics (Month 12+)

Show creators detailed analytics:
- Usage trends over time
- Keep rate by product category
- Revenue from royalties
- Top use cases

**Impact**: Educate creators, improve preset quality, retention

---

### 4. "Preset of the Month" Program (Month 6+)

Feature one community preset per month:
- Spotlight on homepage
- Interview with creator
- Bonus royalty multiplier (2× for the month)

**Impact**: Creator recognition, community building, quality signal

---

## CONCLUSION

The **SwiftList Preset Learning System** transforms visual styles from a **static asset** into a **continuously improving network effect moat**.

**Key Benefits**:
1. **Automatic Quality Improvement**: AI analyzes usage data and improves presets weekly
2. **Niche Discovery**: Detects underserved use cases and creates presets to fill gaps
3. **User Education**: Coaches users to create better presets (raises average quality)
4. **Network Effect**: More users → more presets → more value → stronger moat
5. **Defensibility**: Competitors cannot replicate years of community-curated data

**Investment**:
- Development: 94 hours (~$9,400 labor cost)
- Ongoing: ~$410-880/month (mostly human curator time)

**ROI**:
- Estimated 300-500% (moat value + retention improvement + reduced regenerations)
- Becomes impossible to compete with after 12-24 months

**Next Steps**:
1. Review and approve this design (30 min)
2. Begin Phase 1 implementation (Week 1-2: Foundation)
3. Launch with MVP (collect usage data from day 1)
4. Iterate based on real user behavior

**The preset library is SwiftList's unfair advantage. This system makes it self-improving.**

---

*Document Created: January 3, 2026*
*Status: Design Complete - Pending Approval for Implementation*
*Next Review: After Phase 1 completion (2 weeks)*
