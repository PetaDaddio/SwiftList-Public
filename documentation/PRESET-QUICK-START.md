# SwiftList Visual Presets - Quick Start Guide
**For Developers & API Users**

---

## Overview

SwiftList launches with **25 professional visual presets** imported from Content Factory's visual styles library. These presets give users instant access to premium artistic styles for product photography.

---

## Using Presets in API Calls

### Basic Job Submission with Preset

```javascript
POST https://n8n.swiftlist.app/webhook/decider
Content-Type: application/json

{
  "user_id": "auth0|user123",
  "image_base64": "iVBORw0KGgoAAAANS...",
  "preset_id": "uuid-steven-noble-bw",  // ← Apply preset
  "job_type": "lifestyle_image"
}
```

**Response**:
```json
{
  "job_id": "job_abc123",
  "status": "processing",
  "credits_charged": 10,
  "preset_applied": {
    "name": "Steven Noble Black & White",
    "category": "engraving",
    "creator": "SwiftList Official"
  },
  "estimated_completion": "2025-12-31T23:59:30Z"
}
```

---

## Database Queries

### Get All Public Presets

```sql
SELECT
  preset_id,
  preset_name,
  category,
  description,
  tags,
  best_for,
  is_featured,
  usage_count
FROM presets
WHERE is_public = true
ORDER BY is_featured DESC, usage_count DESC;
```

### Get Featured Presets Only

```sql
SELECT * FROM presets
WHERE is_featured = true AND is_public = true
ORDER BY preset_name;
```

### Search Presets by Tag

```sql
SELECT * FROM presets
WHERE 'crypto' = ANY(tags)  -- Find all crypto-suitable presets
AND is_public = true;
```

### Get Presets by Category

```sql
SELECT * FROM presets
WHERE category = 'engraving'
AND is_public = true;
```

---

## Preset Categories & Use Cases

| Category | Count | Best For | Example Presets |
|----------|-------|----------|-----------------|
| **engraving** | 4 | Finance, Formal, Heritage | Steven Noble B&W, Lyle Hehn B&W |
| **illustration** | 6 | Creative, Storytelling, Travel | Mid-Century, Comic Book, Hiker Booty |
| **print-technique** | 4 | Indie, Vintage, Events | Risograph, Blockprint, Letterpress |
| **digital** | 2 | Tech, Crypto, Futuristic | Cyberpunk Holographic, Glitch Art |
| **elements** | 3 | Decorative, Ornamental | Vintage Elements, Rustic Nature |
| **typography** | 1 | Signage, Bold Text | Sign Maker |
| **texture** | 1 | Analog, Vintage Photo | SuperGrain |
| **technical** | 1 | Engineering, RWA | Technical Blueprint |
| **3d-render** | 1 | Corporate, Modern | Modern Business 3D |

---

## Product Type → Preset Recommendations

### Auto-Suggest Logic for WF-01 Decider

```javascript
// Example routing logic in WF-01
const productCategory = geminiClassification.category;
const productTags = geminiClassification.tags;

let suggestedPresets = [];

// Finance/Corporate Products
if (productTags.includes('finance') || productTags.includes('corporate')) {
  suggestedPresets = [
    'steven-noble-bw',
    'mid-century-modern',
    'modern-business-3d'
  ];
}

// Crypto/Tech Products
else if (productTags.includes('crypto') || productTags.includes('tech')) {
  suggestedPresets = [
    'cyberpunk-holographic',
    'glitch-art',
    'esoteric-space',
    'technical-blueprint'
  ];
}

// Brewery/Craft Products
else if (productTags.includes('brewery') || productTags.includes('craft')) {
  suggestedPresets = [
    'lyle-hehn-bw',
    'lyle-hehn-color',
    'blockprint'
  ];
}

// Outdoor/Travel Products
else if (productTags.includes('outdoor') || productTags.includes('travel')) {
  suggestedPresets = [
    'hiker-booty-maps',
    'rustic-nature'
  ];
}

// Modern/Indie Products
else if (productTags.includes('modern') || productTags.includes('indie')) {
  suggestedPresets = [
    'risograph',
    'abstract-organic',
    'mid-century-modern'
  ];
}

// Default: General high-quality presets
else {
  suggestedPresets = [
    'steven-noble-bw',
    'risograph',
    'modern-business-3d'
  ];
}
```

---

## Color Palette Selection

### Available Palettes per Preset

Most presets include multiple color palette options:

```javascript
// Steven Noble B&W
{
  "classic": ["#000000", "#FFFFFF"]
}

// Risograph Print
{
  "classic": ["#FF6B9D", "#0000FF", "#000000"],
  "retro": ["#FFA500", "#00CED1", "#000000"],
  "modern": ["#9B59B6", "#F1C40F", "#2C3E50"],
  "crypto": ["#00FF88", "#FF0080", "#0A0F14"]
}

// Lyle Hehn Color
{
  "brewpub": ["#800020", "#FFDB58", "#6B8E23", "#CC5500", "#5F9EA0", "#FFFDD0"],
  "mystical": ["#4B0082", "#FF8C00", "#2E8B57", "#DC143C", "#4682B4", "#F5DEB3"]
}
```

### Specify Palette in API Call

```javascript
POST /webhook/decider
{
  "user_id": "auth0|user123",
  "image_base64": "...",
  "preset_id": "uuid-risograph",
  "color_palette": "crypto"  // ← Select crypto palette
}
```

---

## Workflow Routing with Presets

### How Presets Affect Workflow Selection

```
┌─────────────────────────────────────────────────────┐
│ WF-01: Decider Orchestrator                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Classify product (jewelry, furniture, etc.)     │
│  2. Check if preset_id provided                     │
│                                                      │
│  IF preset_id EXISTS:                                │
│    ├─ Load preset from database                     │
│    ├─ Determine workflow based on:                  │
│    │    • Product category                          │
│    │    • Preset category                           │
│    │    • Preset technique requirements             │
│    │                                                 │
│    └─ Route to appropriate engine:                  │
│         • WF-02 (Jewelry + engraving preset)        │
│         • WF-06 (General + any preset)              │
│         • Post-processing for print techniques      │
│                                                      │
│  ELSE (no preset):                                   │
│    └─ Use default routing (product category only)   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Preset Application Examples

### Example 1: Finance Product + Steven Noble Engraving

**Input**:
```json
{
  "user_id": "auth0|user123",
  "product_image": "corporate-coin.jpg",
  "preset_id": "steven-noble-bw"
}
```

**Workflow**:
1. WF-01 classifies: `category: "general"`
2. Loads preset: `Steven Noble Black & White`
3. Routes to: WF-06 General Goods Engine
4. Injects prompt: "...with steven noble style steel engraving, 100% black ink on white paper, cross-hatching..."
5. Stability AI SDXL generates image
6. Post-process: Convert to pure B&W, enhance contrast
7. Output: Corporate coin in museum-quality engraving

**Credits**: 10 (WF-06 base) + 0 (official preset free) = **10 credits**

---

### Example 2: Crypto Hardware Wallet + Risograph

**Input**:
```json
{
  "user_id": "auth0|user123",
  "product_image": "hardware-wallet.jpg",
  "preset_id": "risograph",
  "color_palette": "crypto"
}
```

**Workflow**:
1. WF-01 classifies: `category: "general"`
2. Loads preset: `Risograph Print`
3. Routes to: WF-06 General Goods Engine
4. Generates lifestyle image (default)
5. Post-process: Apply Risograph simulation
   - Reduce to 3 colors: `#00FF88`, `#FF0080`, `#0A0F14`
   - Add grain texture
   - Apply registration offset
6. Output: Hardware wallet in indie poster aesthetic

**Credits**: 10 (WF-06) + 0 (official preset) = **10 credits**

---

### Example 3: Brewery Coaster + Lyle Hehn Color

**Input**:
```json
{
  "user_id": "auth0|user123",
  "product_image": "brewery-coaster.jpg",
  "preset_id": "lyle-hehn-color",
  "color_palette": "brewpub"
}
```

**Workflow**:
1. WF-01 classifies: `category: "general"`
2. Loads preset: `Lyle Hehn Color (McMenamins)`
3. Routes to: WF-06
4. Injects prompt: "...lyle hehn mcmenamins style, bold linocut framework, warm bohemian brewpub colors, surreal victorian-psychedelic..."
5. Applies color palette: Burgundy, mustard, moss green, burnt orange
6. Output: Brewery coaster in McMenamins surreal style

**Credits**: 10 (WF-06) + 0 (official preset) = **10 credits**

---

### Example 4: Diamond Ring + Steven Noble Engraving

**Input**:
```json
{
  "user_id": "auth0|user123",
  "product_image": "diamond-ring.jpg",
  "preset_id": "steven-noble-bw"
}
```

**Workflow**:
1. WF-01 classifies: `category: "jewelry"` (high precision needed)
2. Loads preset: `Steven Noble Black & White`
3. Routes to: **WF-02 Jewelry Precision Engine** (upgrade from WF-06)
4. Gemini 2.5 Pro analyzes 3D bounding box
5. Replicate Nano Banana generates with engraving overlay
6. Post-process: Pure B&W conversion, cross-hatch enhancement
7. Output: Diamond ring in museum-quality engraving

**Credits**: 12 (WF-02 base) + 0 (official preset) = **12 credits**

---

## Featured Presets (Top 10)

These presets are highlighted in the marketplace UI:

| Preset Name | Category | Best For | Why Featured |
|-------------|----------|----------|--------------|
| Steven Noble Black & White | engraving | Finance, Formal, Logos | Highest quality formal aesthetic |
| Lyle Hehn Black & White | engraving | Brewery, Folk Art | Unique bold relief print style |
| Lyle Hehn Color | illustration | Brewery, Mystical | Distinctive McMenamins aesthetic |
| Mid-Century Modern | illustration | Retro, Corporate | Broad appeal, professional |
| Comic Book | illustration | Storytelling, Pop Culture | High engagement, fun |
| Hiker Booty Maps | illustration | Travel, Outdoor | Unique niche, Pacific Northwest |
| Risograph Print | print-technique | Modern, Indie | Trending indie aesthetic |
| Blockprint | print-technique | Americana, Events | Classic poster style |
| Cyberpunk Holographic | digital | Crypto, Tech | Perfect for crypto products |
| Glitch Art | digital | Crypto, Edgy | Experimental, attention-grabbing |
| Technical Blueprint | technical | RWA, Engineering | Professional technical aesthetic |
| Modern Business 3D | 3d-render | Corporate, Tech | Clean professional look |

---

## Preset Usage Tracking

### Increment Usage Counter

```sql
-- Every time a preset is applied
UPDATE presets
SET usage_count = usage_count + 1,
    updated_at = NOW()
WHERE preset_id = $1;
```

### Log Preset Usage for Royalties

```sql
-- If preset charges credits (user-created presets)
INSERT INTO preset_usage (
  preset_id,
  user_id,
  job_id,
  credits_charged,
  creator_royalty,
  platform_fee
) VALUES (
  $1,  -- preset_id
  $2,  -- user_id
  $3,  -- job_id
  3,   -- credits charged for this preset
  2.4, -- 80% to creator
  0.6  -- 20% platform fee
);
```

**Note**: Official SwiftList presets (Content Factory imports) are **free**, so no preset_usage record for royalties. Only track in `presets.usage_count` for popularity metrics.

---

## Testing Presets Locally

### 1. Import Seed Data

```bash
# From /SwiftList/database/
psql $SUPABASE_CONNECTION_STRING -f presets-seed-data.sql
```

### 2. Verify Import

```sql
SELECT COUNT(*) FROM presets WHERE creator_user_id = 'system-swiftlist-official';
-- Should return: 25
```

### 3. Test WF-23 Preset Discovery

```bash
curl -X POST https://n8n.swiftlist.app/webhook/preset-discovery \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "product_category": "finance",
    "desired_vibe": "professional, formal, prestigious"
  }'
```

**Expected Response**:
```json
{
  "recommendations": [
    {
      "preset_id": "uuid-1",
      "preset_name": "Steven Noble Black & White",
      "match_score": 0.95,
      "category": "engraving",
      "preview_url": "s3://...",
      "credits": 0
    },
    {
      "preset_id": "uuid-2",
      "preset_name": "Mid-Century Modern",
      "match_score": 0.87,
      "category": "illustration",
      "preview_url": "s3://...",
      "credits": 0
    }
  ]
}
```

---

## Frontend Integration

### React Component Example

```jsx
import { useState, useEffect } from 'react';

function PresetSelector({ productImage, onSelectPreset }) {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  useEffect(() => {
    // Fetch featured presets on load
    fetch('/api/presets?featured=true')
      .then(res => res.json())
      .then(data => setPresets(data.presets));
  }, []);

  const handleSelect = (preset) => {
    setSelectedPreset(preset);
    onSelectPreset(preset.preset_id);
  };

  return (
    <div className="preset-selector">
      <h2>Choose a Vibe</h2>

      {/* Featured Presets */}
      <div className="featured-presets">
        {presets.filter(p => p.is_featured).map(preset => (
          <div
            key={preset.preset_id}
            className={`preset-card ${selectedPreset?.preset_id === preset.preset_id ? 'selected' : ''}`}
            onClick={() => handleSelect(preset)}
          >
            <img src={preset.preview_url} alt={preset.preset_name} />
            <h3>{preset.preset_name}</h3>
            <p>{preset.category}</p>
            <span className="free-badge">FREE</span>
          </div>
        ))}
      </div>

      {/* Browse All Link */}
      <a href="/presets/browse">Browse All 25 Presets →</a>
    </div>
  );
}
```

---

## Common Issues & Solutions

### Issue 1: Preset Not Applying

**Symptom**: Job completes but doesn't look like selected preset

**Solution**:
1. Check `jobs.metadata` field for preset info
2. Verify `base_prompt` was injected into AI call
3. Check WF-01 logs for routing decision
4. Ensure post-processing step ran (for print techniques)

---

### Issue 2: Wrong Workflow Selected

**Symptom**: Jewelry + engraving preset routes to WF-06 instead of WF-02

**Solution**:
```javascript
// In WF-01, ensure priority logic:
if (productCategory === 'jewelry' && preset.category === 'engraving') {
  // ALWAYS route to WF-02 for jewelry + engraving
  targetWorkflow = 'WF-02';
} else if (productCategory === 'jewelry') {
  // Other jewelry presets can use WF-02 or WF-06
  targetWorkflow = preset.requires_precision ? 'WF-02' : 'WF-06';
}
```

---

### Issue 3: Color Palette Not Applied

**Symptom**: Risograph preset uses wrong colors

**Solution**:
```javascript
// Verify palette selection in request
const selectedPalette = request.body.color_palette || 'classic';
const colors = preset.color_palettes[selectedPalette];

// Inject into prompt
const finalPrompt = `${preset.base_prompt} using color palette: ${colors.join(', ')}`;
```

---

## Next Steps

1. **Import Presets**: Run `presets-seed-data.sql` against Supabase
2. **Test Discovery**: Verify WF-23 returns relevant presets
3. **Build UI**: Create preset marketplace in React frontend
4. **Monitor Usage**: Track which presets are most popular
5. **Iterate**: Add more presets based on user demand

---

## Support & Resources

- **Full Documentation**: `/SwiftList/documentation/VISUAL-STYLES-INTEGRATION.md`
- **Preset Database Schema**: `/SwiftList/database/schema.sql`
- **Workflow Integration**: `/SwiftList/n8n-workflows/json/WF-23_Preset_Discovery.json`
- **Content Factory Source**: `/Content Factory/config/visual-styles-library.json`

---

*Quick Start Guide - SwiftList Visual Presets v1.0*
