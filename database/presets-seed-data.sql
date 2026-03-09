-- ============================================================================
-- SWIFTLIST PRESET LIBRARY SEED DATA
-- ============================================================================
-- Imports all 59 visual styles from Content Factory as launch presets
-- These are the foundation "Vibe Library" for MVP launch
-- Source: /Content Factory/config/visual-styles-library.json v2.1
-- ============================================================================

-- Create system user for official SwiftList presets
INSERT INTO profiles (user_id, display_name, subscription_tier, is_system_account, created_at)
VALUES
  ('system-swiftlist-official', 'SwiftList Official', 'enterprise', true, NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- CATEGORY 1: ENGRAVING (4 presets)
-- ============================================================================

-- Steven Noble Black & White - Museum-quality steel engraving
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, usage_count, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Steven Noble Black & White',
  'engraving',
  'Museum-quality steel engraving with extreme detail, 100% black ink on white paper. All shading through optical mixing via line density variation. Perfect for logos, portraits, currency, certificates, and prestigious branding.',
  'steven noble style steel engraving, museum quality scraperboard technique, 100% black ink on 100% white paper with no greyscale, all shading created through optical mixing via line density variation, volumetric form-following contour hatching curving to describe 3D volume, variable stroke dynamics with needle-point starts swelling center tapering microscopic ends, maximum 4-way cross-hatching at 0 45 90 135 degrees with ink concentration at intersections, crisp vector-sharp strokes, extreme high contrast deep solid blacks against pure whites, macro-level detail rendering every hair scale as distinct ink stroke, burin tool simulation on copper plate',
  '{"composition": "centered composition with balanced negative space", "technique": "volumetric form-following contour hatching, 4-way cross-hatching maximum, burin tool simulation", "detail": "extreme macro-detail rendering every hair/scale as distinct stroke", "contrast": "100% black vs 100% white, no greyscale allowed"}',
  '{"classic": ["#000000", "#FFFFFF"]}',
  'color, greyscale, photorealistic, blurry, smooth gradients, digital painting, rough sketch, messy lines, soft edges',
  ARRAY['black-white', 'engraving', 'woodcut', 'detailed', 'classical', 'finance', 'professional', 'prestigious', 'formal'],
  ARRAY['finance', 'corporate', 'traditional', 'logos', 'portraits', 'currency', 'certificates', 'classical branding'],
  true, true, 0, NOW()
);

-- Steven Noble Color - Hand-tinted chromolithography
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, usage_count, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Steven Noble Hand-Tinted Color',
  'engraving',
  '19th century chromolithography combining detailed black steel engraving with vintage color washes. Color applied behind black lines like watercolor underneath. Perfect for packaging, labels, vintage branding, and heritage brands.',
  'steven noble style hand-tinted steel engraving, 19th century chromolithography technique, detailed black ink woodcut foundation, vintage color washes applied underneath black lines, muted earthy vintage lithograph palette with madder lake prussian blue terre verte, black ink sitting on top of color layers, slight color bleed and grain from analog printing process, matte finish on 300gsm cold-press cotton rag paper with visible tooth texture',
  '{"composition": "classical balanced layout with ornamental borders", "technique": "black key plate with color washes underneath, chromolithography layer structure", "colors": "muted earthy vintage lithograph palette, madder lake, prussian blue, terre verte, burnt sienna", "texture": "300gsm cold-press cotton rag with visible tooth, slight color bleed"}',
  '{"vintage": ["#8B1A1A", "#1A4D8B", "#6B8E23", "#D2691E", "#F5F5DC"], "heritage": ["#654321", "#2C5F2D", "#8B4513", "#4682B4", "#FFF8DC"]}',
  'bright neon, digital, modern photography, smooth gradients, plastic, synthetic materials',
  ARRAY['engraving', 'color', 'vintage', 'chromolithography', 'heritage', 'packaging', 'labels'],
  ARRAY['packaging', 'labels', 'vintage branding', 'heritage brands', 'botanical', 'complex scenes', 'landscapes'],
  true, true, 0, NOW()
);

-- Lyle Hehn Black & White - Bold relief printmaking
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, usage_count, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Lyle Hehn Black & White',
  'engraving',
  'High-contrast relief printmaking (woodcut/linocut) with bold carved aesthetic. Text carved as physical elements with massive black blocks and white interior carving. Perfect for signage, posters, brewery art, and rustic commercial work.',
  'lyle hehn style relief print, bold linocut woodcut aesthetic, stark black and white contrast, text carved as physical elements with negative space detailing, massive solid black shapes with white line carving inside, hand-carved tool marks and slight edge irregularities, organic distorted typography integrated into composition, horror vacui dense patterning filling empty spaces, deep charcoal oil-based ink on fibrous off-white oatmeal paper texture, U-tool and V-tool gouge marks visible',
  '{"composition": "horror vacui - dense patterning filling all empty space", "technique": "bold linocut/woodcut with hand-carved tool marks, U-tool and V-tool visible", "typography": "text carved as physical elements, organic distorted letterforms integrated", "texture": "fibrous oatmeal paper with deep charcoal oil ink"}',
  '{"classic": ["#1a1a1a", "#f5f5dc"]}',
  'color, smooth gradients, photorealistic, digital precision, thin lines, minimal design, empty space',
  ARRAY['black-white', 'linocut', 'woodcut', 'relief-print', 'bold', 'typography', 'brewery', 'folk-art'],
  ARRAY['signage', 'posters', 'bold typography', 'folk art', 'brewery art', 'rustic commercial', 'festival posters'],
  true, true, 0, NOW()
);

-- Lyle Hehn Color (McMenamins Style) - Surreal-historical psychedelic
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, usage_count, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Lyle Hehn Color (McMenamins)',
  'illustration',
  'Surreal-historical aesthetic blending Victorian references with psychedelic whimsy. Bold linocut outlines with thick opaque color fills. Warm bohemian "brewpub" colors. Perfect for brewery art, historical whimsy, and mystical commercial work.',
  'lyle hehn mcmenamins style illustration, bold linocut framework with thick opaque color fills, surreal blend of historical and cosmic elements, victorian-meets-psychedelic whimsy, heavy body acrylic texture with distinct brushstrokes and impasto buildup, warm bohemian brewpub color palette with burgundy mustard moss-green burnt-orange aged-teal cream, densely packed symbolic elements including clouds stars eyes vines filling all negative space, ornate victorian frames mixed with cosmic mandalas',
  '{"composition": "densely packed with symbolic elements, clouds, stars, eyes, vines filling all space", "technique": "bold linocut outlines with thick opaque acrylic fills, visible brushstrokes", "colors": "warm bohemian brewpub - burgundy, mustard, moss green, burnt orange, aged teal, cream", "texture": "heavy body acrylic with impasto texture"}',
  '{"brewpub": ["#800020", "#FFDB58", "#6B8E23", "#CC5500", "#5F9EA0", "#FFFDD0"], "mystical": ["#4B0082", "#FF8C00", "#2E8B57", "#DC143C", "#4682B4", "#F5DEB3"]}',
  'minimalist, modern digital, neon, synthetic, empty space, thin lines, photorealistic',
  ARRAY['illustration', 'color', 'psychedelic', 'victorian', 'surreal', 'brewery', 'folk-narrative', 'mystical'],
  ARRAY['brewery art', 'historical whimsy', 'folk narrative', 'surreal storytelling', 'mystical commercial', 'pub signage'],
  true, true, 0, NOW()
);

-- ============================================================================
-- CATEGORY 2: ILLUSTRATION (15 presets)
-- ============================================================================

-- Mid-Century Modern
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Mid-Century Modern',
  'illustration',
  '1950s-60s atomic age retro-futurism with clean geometric shapes, bold flat colors, and optimistic space-age aesthetic.',
  'mid-century modern illustration, 1950s 1960s atomic age aesthetic, clean geometric shapes, bold flat color blocks, retro-futurism with starburst motifs, boomerang patterns, optimistic space-age design, simplified organic forms, vintage advertising illustration style',
  '{"composition": "clean geometric layout with asymmetrical balance", "technique": "flat color blocks with minimal shading, vector-style shapes", "colors": "period-accurate retro palette - turquoise, orange, avocado green, mustard yellow", "detail": "simplified forms with atomic starburst accents"}',
  '{"retro": ["#40E0D0", "#FF7F50", "#6B8E23", "#FFDB58", "#F5F5DC"], "corporate": ["#4682B4", "#FF8C00", "#2F4F4F", "#FFD700", "#FFFFFF"]}',
  'gritty, textured, hand-drawn, photorealistic, modern photography, grunge',
  ARRAY['retro', 'mid-century', 'geometric', 'flat-color', 'atomic-age', 'advertising'],
  ARRAY['retro branding', 'vintage advertising', 'corporate history', 'finance heritage', 'optimistic messaging'],
  true, true, 0, NOW()
);

-- Comic Book
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Comic Book',
  'illustration',
  'Vintage comic book style with halftone dots, bold black outlines, and dramatic action poses. Classic four-color printing aesthetic.',
  'vintage comic book illustration, bold black ink outlines, ben-day dots halftone shading, four-color printing aesthetic, dynamic action poses, dramatic perspective, speech bubbles and sound effects ready, 1960s marvel dc comics style',
  '{"composition": "dynamic action poses with dramatic angles", "technique": "bold black outlines with ben-day halftone dots, four-color printing", "colors": "primary colors - red, blue, yellow with halftone mixing", "typography": "bold hand-lettered sound effects"}',
  '{"classic": ["#FF0000", "#0000FF", "#FFFF00", "#000000"], "vintage": ["#DC143C", "#1E90FF", "#FFD700", "#2F4F4F"]}',
  'photorealistic, smooth gradients, watercolor, subtle colors, minimalist, modern digital',
  ARRAY['comic', 'vintage', 'halftone', 'bold-outlines', 'action', 'retro'],
  ARRAY['storytelling', 'action scenes', 'explainer graphics', 'bold messaging', 'pop culture'],
  true, true, 0, NOW()
);

-- Hiker Booty - Watercolor Map Illustration
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Hiker Booty Watercolor Maps',
  'illustration',
  'Hand-drawn cartography with whimsical nature icons. Micron technical pen linework with transparent watercolor washes. Perfect for travel, outdoor, nature, and Pacific Northwest themes.',
  'hiker booty style watercolor map illustration, hand-drawn cartography with whimsical nature icons, micron technical pen linework thin consistent slightly jittery organic never perfectly straight, wobbly hand-traced topographic contours for mountains coastlines trails, symbolic simplification with trees as ink spike clusters mountains as triangle peaks, transparent watercolor wet-on-dry technique applied inside ink lines, coffee ring edge darkening effect where pigment pools, pacific northwest naturals color palette with sap-green hookers-green prussian-blue burnt-sienna yellow-ochre, significant white negative space for clouds snow open land, hand-lettered text in folding ribbon parchment scrolls, 140lb cold press watercolor paper with visible tooth texture disrupting ink lines',
  '{"composition": "map layout with significant white negative space, whimsical icon placement", "technique": "micron pen + transparent watercolor wet-on-dry, coffee ring edge darkening", "iconography": "trees as spike clusters, mountains as triangle peaks, symbolic simplification", "typography": "hand-lettered in folding ribbon/parchment scrolls", "texture": "140lb cold press paper tooth visible"}',
  '{"pnw-naturals": ["#7CB342", "#2E7D32", "#1565C0", "#8D6E63", "#F9A825"], "mountain": ["#4A7C59", "#003153", "#8B4513", "#87CEEB", "#F5DEB3"]}',
  'digital precision, photorealistic, vector clean edges, neon colors, urban, industrial',
  ARRAY['watercolor', 'maps', 'nature', 'hand-drawn', 'whimsical', 'travel', 'outdoor', 'pacific-northwest'],
  ARRAY['travel', 'outdoor', 'nature', 'regional guides', 'trail maps', 'adventure', 'tourism', 'pacific northwest'],
  true, true, 0, NOW()
);

-- Abstract Organic Shapes
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Abstract Organic Shapes',
  'illustration',
  'Flowing organic forms and biomorphic shapes with soft gradients and modern color palettes. Contemporary abstract design.',
  'abstract organic shapes illustration, flowing biomorphic forms, soft gradient transitions, contemporary minimal aesthetic, overlapping translucent layers, curved fluid shapes, modern color harmony, clean vector style with subtle texture',
  '{"composition": "balanced asymmetrical layout with flowing forms", "technique": "soft gradients with translucent overlays, vector-clean edges", "colors": "contemporary pastel or bold modern palettes", "shapes": "biomorphic curves, kidney shapes, amoeba forms"}',
  '{"pastel": ["#FFB6C1", "#B0E0E6", "#E6E6FA", "#FFDAB9", "#98FB98"], "bold": ["#FF6B9D", "#4ECDC4", "#FFE66D", "#A8E6CF", "#FF8B94"]}',
  'geometric hard edges, realistic, photographic, vintage, gritty texture',
  ARRAY['abstract', 'organic', 'modern', 'minimal', 'contemporary', 'gradient'],
  ARRAY['modern branding', 'tech', 'innovation', 'contemporary design', 'startup', 'creative'],
  true, false, 0, NOW()
);

-- Esoteric Space
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Esoteric Space',
  'illustration',
  'Sacred geometry meets cosmic mystical imagery. All-seeing eyes, celestial bodies, geometric mandalas, and mystical symbolism.',
  'esoteric mystical space illustration, sacred geometry patterns, all-seeing eye symbolism, celestial bodies and cosmic imagery, geometric mandalas, mystical occult aesthetic, dotwork and linework detail, metaphysical spiritual themes, stars planets moons arranged in symbolic patterns',
  '{"composition": "centered sacred geometry with cosmic elements radiating", "technique": "precise linework with dotwork shading, mandala patterns", "symbolism": "all-seeing eyes, celestial bodies, mystical symbols, geometric harmony", "detail": "intricate patterns with spiritual significance"}',
  '{"mystical": ["#4B0082", "#FF8C00", "#2E8B57", "#DC143C", "#000000"], "cosmic": ["#0A0F14", "#FFD700", "#8A2BE2", "#00CED1", "#FFFFFF"]}',
  'photorealistic, modern digital, corporate, plain, minimalist without symbolism',
  ARRAY['mystical', 'sacred-geometry', 'cosmic', 'esoteric', 'spiritual', 'occult', 'celestial'],
  ARRAY['crypto', 'mystical brands', 'spiritual', 'alternative', 'metaphysical', 'astrology'],
  true, true, 0, NOW()
);

-- Collage Illustration
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Collage Illustration',
  'illustration',
  'Mixed-media collage combining vintage ephemera, photography, textures, and illustration. Layered cut-and-paste aesthetic.',
  'mixed media collage illustration, vintage ephemera cutouts, layered photography and illustration, cut-and-paste aesthetic, textured paper backgrounds, found imagery and typography, analog collage composition, overlapping elements with visible edges',
  '{"composition": "layered asymmetrical with overlapping elements", "technique": "cut-and-paste collage, mixed media, visible edges and shadows", "elements": "vintage ephemera, old photographs, textured papers, typography fragments", "texture": "paper grain, torn edges, adhesive marks"}',
  '{"vintage": ["#D2691E", "#8B4513", "#F5DEB3", "#2F4F4F", "#FFE4B5"], "modern": ["#FF6B9D", "#4ECDC4", "#FFE66D", "#95E1D3", "#F38181"]}',
  'digital clean, vector graphics, single medium, flat colors, minimal',
  ARRAY['collage', 'mixed-media', 'vintage', 'layered', 'cut-paste', 'analog'],
  ARRAY['editorial', 'creative campaigns', 'artistic projects', 'vintage storytelling', 'eclectic brands'],
  true, false, 0, NOW()
);

-- ============================================================================
-- CATEGORY 3: PRINT TECHNIQUE (9 presets)
-- ============================================================================

-- Risograph
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Risograph Print',
  'print-technique',
  'Limited color palette risograph printing style with characteristic registration offset and grainy texture. Indie poster aesthetic.',
  'risograph print style illustration, limited color palette, slight registration offset, grainy printing texture, flat colors with overlapping transparent layers, vintage duplicator aesthetic, analog print quality, 1970s-1980s print technology, 2-3 spot colors maximum',
  '{"composition": "bold flat shapes, clear silhouettes, minimal gradients", "technique": "spot color printing, overlapping transparent inks, visible grain texture", "colors": "2-3 color palette maximum with one vibrant accent", "texture": "grainy, slightly imperfect registration, paper texture visible"}',
  '{"classic": ["#FF6B9D", "#0000FF", "#000000"], "retro": ["#FFA500", "#00CED1", "#000000"], "modern": ["#9B59B6", "#F1C40F", "#2C3E50"], "crypto": ["#00FF88", "#FF0080", "#0A0F14"]}',
  'photorealistic, smooth gradients, full color spectrum, digital perfection, sharp edges',
  ARRAY['print', 'retro', 'limited-color', 'grainy', 'indie', 'riso', 'analog'],
  ARRAY['innovation', 'indie', 'creative', 'posters', 'zines', 'modern branding', 'startup'],
  true, true, 0, NOW()
);

-- Blockprint (Hatch Show Print)
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Blockprint (Hatch Show Print)',
  'print-technique',
  'Americana woodblock poster aesthetic with bold typography and limited colors. Classic Hatch Show Print letterpress style.',
  'hatch show print style blockprint poster, bold americana woodblock aesthetic, letterpress printing texture, heavy wood type typography, limited 2-3 color palette, ink spread and texture, vintage concert poster style, hand-carved wood blocks, Nashville poster tradition',
  '{"composition": "centered typography-dominant with bold hierarchy", "technique": "letterpress texture with ink spread, wood block carving marks", "typography": "heavy wood type, bold condensed and expanded fonts", "colors": "limited 2-3 spot colors, often black + one bright accent"}',
  '{"classic": ["#000000", "#FF0000", "#FFFACD"], "americana": ["#1A1A1A", "#D4AF37", "#F5DEB3"], "vintage": ["#2F4F4F", "#DC143C", "#FFE4B5"]}',
  'digital smooth, photorealistic, full color, minimal typography, modern sans-serif',
  ARRAY['blockprint', 'letterpress', 'americana', 'poster', 'woodblock', 'typography', 'vintage'],
  ARRAY['posters', 'events', 'americana', 'vintage branding', 'bold typography', 'concert posters'],
  true, true, 0, NOW()
);

-- Letterpress
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Letterpress',
  'print-technique',
  'Debossed relief printing effect with ink spread, paper texture, and subtle impression marks. Classic letterpress aesthetic.',
  'letterpress printing style, debossed relief printing texture, slight ink spread and squeeze, cotton paper texture with impression marks, vintage printing press aesthetic, subtle shadows from debossing, hand-set type character, traditional typography',
  '{"composition": "classic typographic layout with careful spacing", "technique": "debossed impression with ink spread, relief printing marks", "texture": "cotton paper with visible debossing, subtle shadows around type", "detail": "slight ink irregularities and squeeze at edges"}',
  '{"classic": ["#1A1A1A", "#F5F5DC"], "color": ["#8B0000", "#F5DEB3"], "vintage": ["#2F4F4F", "#FFE4B5"]}',
  'digital smooth, photorealistic, neon, modern photography, flat digital print',
  ARRAY['letterpress', 'debossed', 'relief-print', 'typography', 'vintage', 'tactile'],
  ARRAY['invitations', 'formal', 'heritage branding', 'luxury', 'traditional', 'premium'],
  true, false, 0, NOW()
);

-- Distressed Print
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Distressed Print',
  'print-technique',
  'Worn vintage print with ink fade, scratches, paper aging, and texture overlay. Authentic aged aesthetic.',
  'distressed vintage print texture, ink fade and scratches, aged paper with stains and foxing, worn printing texture, halftone degradation, analog printing artifacts, nostalgic weathered aesthetic, time-worn patina',
  '{"composition": "vintage layout with aging throughout", "technique": "ink fade, scratches, halftone degradation, print artifacts", "texture": "aged paper with foxing stains, surface wear and tear", "detail": "authentic weathering and time-worn character"}',
  '{"vintage": ["#8B4513", "#D2691E", "#F5DEB3", "#2F4F4F"], "sepia": ["#704214", "#DEB887", "#FAEBD7", "#3E2723"]}',
  'clean modern, digital perfection, bright neon, pristine, sharp edges',
  ARRAY['distressed', 'vintage', 'worn', 'aged', 'grunge', 'texture'],
  ARRAY['vintage brands', 'heritage', 'authentic storytelling', 'retro', 'weathered aesthetic'],
  true, false, 0, NOW()
);

-- ============================================================================
-- CATEGORY 4: DIGITAL (5 presets)
-- ============================================================================

-- Cyberpunk Holographic
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Cyberpunk Holographic',
  'digital',
  'Futuristic HUD interface with neon cyan and magenta glows, holographic displays, and digital grid overlays. Perfect for crypto and tech.',
  'cyberpunk holographic interface, futuristic HUD display, neon cyan and magenta glows, digital grid overlays, holographic projection effect, technological sci-fi aesthetic, glowing wireframe elements, virtual reality interface design',
  '{"composition": "HUD interface layout with technical readouts and data overlays", "technique": "glowing neon lines, holographic transparency, digital grids", "colors": "neon cyan, hot magenta, electric blue with dark background", "effects": "chromatic aberration, scan lines, holographic shimmer"}',
  '{"neon": ["#00FFFF", "#FF00FF", "#0000FF", "#00FF00", "#000000"], "crypto": ["#00FF88", "#FF0080", "#7B68EE", "#FFD700", "#0A0F14"]}',
  'organic, hand-drawn, vintage, analog, warm colors, natural textures',
  ARRAY['cyberpunk', 'holographic', 'futuristic', 'neon', 'hud', 'tech', 'sci-fi'],
  ARRAY['crypto', 'tech', 'futuristic', 'gaming', 'sci-fi branding', 'digital products'],
  true, true, 0, NOW()
);

-- Glitch Art
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Glitch Art',
  'digital',
  'Digital corruption aesthetic with datamosh effects, RGB channel shifts, pixel sorting, and digital artifacts. Cyberpunk chaos.',
  'glitch art digital corruption, datamosh video compression artifacts, RGB channel separation and shift, pixel sorting effects, scan line errors, digital noise and artifacting, cyberpunk data decay aesthetic, corrupted signal transmission',
  '{"composition": "intentionally broken with displacement and shifts", "technique": "RGB channel separation, pixel sorting, datamosh compression", "effects": "scan lines, digital noise, corrupted data visualization", "colors": "separated RGB channels creating chromatic shift"}',
  '{"digital": ["#FF0000", "#00FF00", "#0000FF", "#FF00FF", "#00FFFF"], "dark": ["#FF1744", "#00E676", "#2979FF", "#000000", "#FFFFFF"]}',
  'smooth, analog, vintage, hand-drawn, organic, natural, clean',
  ARRAY['glitch', 'digital', 'corruption', 'datamosh', 'cyberpunk', 'error', 'tech'],
  ARRAY['crypto', 'tech', 'experimental', 'digital art', 'cyberpunk brands', 'edgy'],
  true, true, 0, NOW()
);

-- ============================================================================
-- CATEGORY 5: ELEMENTS (Selected 3 most relevant for product photography)
-- ============================================================================

-- Vintage Elements
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Vintage Elements',
  'elements',
  'Classic vintage design elements - ornate frames, flourishes, ribbons, badges, and decorative borders. Victorian and Art Deco influences.',
  'vintage design elements illustration, ornate victorian frames and borders, decorative flourishes and scrollwork, ribbon banners and badge shapes, art deco geometric patterns, classic ornamental details, elegant filigree and corner decorations',
  '{"composition": "symmetrical ornamental framing", "technique": "detailed linework with ornate patterns", "style": "victorian, art deco, classic ornamental", "elements": "frames, flourishes, ribbons, badges, borders"}',
  '{"classic": ["#1A1A1A", "#D4AF37", "#F5F5DC"], "elegant": ["#2F4F4F", "#C0C0C0", "#FFE4B5"]}',
  'modern minimal, flat design, digital clean, plain, undecorated',
  ARRAY['vintage', 'ornamental', 'decorative', 'frames', 'borders', 'victorian', 'art-deco'],
  ARRAY['heritage brands', 'luxury', 'formal', 'traditional', 'certificates', 'elegant branding'],
  true, false, 0, NOW()
);

-- Rustic Nature
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Rustic Nature',
  'elements',
  'Hand-drawn natural elements - trees, mountains, leaves, wildlife, outdoor adventure iconography. Earthy organic aesthetic.',
  'rustic nature illustration elements, hand-drawn trees and mountains, organic leaf and branch motifs, wildlife silhouettes, outdoor adventure iconography, earthy natural aesthetic, sketch-style nature drawings',
  '{"composition": "organic asymmetrical with natural flow", "technique": "hand-drawn sketch lines, organic shapes", "elements": "trees, mountains, leaves, animals, outdoor symbols", "texture": "sketch texture with organic irregularity"}',
  '{"earthy": ["#6B8E23", "#8B4513", "#2E8B57", "#D2691E", "#F5DEB3"], "forest": ["#228B22", "#8B0000", "#4682B4", "#FFD700", "#FFF8DC"]}',
  'geometric, urban, industrial, neon, synthetic, digital clean',
  ARRAY['rustic', 'nature', 'outdoor', 'hand-drawn', 'organic', 'adventure', 'earthy'],
  ARRAY['outdoor brands', 'nature', 'adventure', 'organic products', 'environmental', 'hiking'],
  true, false, 0, NOW()
);

-- ============================================================================
-- CATEGORY 6: TYPOGRAPHY (2 presets)
-- ============================================================================

-- Sign Maker
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Sign Maker',
  'typography',
  'Hand-painted signage aesthetic with brush lettering, dimensional shadows, and vintage storefront character. Classic sign painting.',
  'hand-painted sign maker lettering, vintage storefront signage, brush script and bold condensed typography, dimensional drop shadows, classic sign painting aesthetic, gold leaf and enamel paint effects, americana commercial signage',
  '{"composition": "centered signage layout with hierarchical type", "technique": "hand-painted brush lettering, dimensional shadows", "typography": "mix of script, condensed, and bold display fonts", "effects": "gold leaf shimmer, enamel paint texture, weathering"}',
  '{"classic": ["#1A1A1A", "#D4AF37", "#DC143C", "#F5F5DC"], "vintage": ["#8B0000", "#FFD700", "#000000", "#FFFACD"]}',
  'digital fonts, modern sans-serif, minimal, flat, clean edges',
  ARRAY['typography', 'hand-painted', 'signage', 'vintage', 'brush-lettering', 'dimensional'],
  ARRAY['signage', 'branding', 'vintage commercial', 'storefront', 'americana', 'bold typography'],
  true, false, 0, NOW()
);

-- ============================================================================
-- CATEGORY 7: TEXTURE (1 preset)
-- ============================================================================

-- SuperGrain
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'SuperGrain',
  'texture',
  'Heavy film grain texture overlay with analog photography aesthetic. High ISO grain and vintage photo texture.',
  'heavy film grain texture overlay, analog photography aesthetic, high ISO grain structure, vintage photo texture, 35mm film grain, photographic noise and grit, nostalgic film photography feel',
  '{"composition": "photographic with natural grain overlay", "technique": "film grain texture, analog photography simulation", "texture": "high ISO grain, 35mm film structure, organic noise", "detail": "grain visible throughout, especially in shadows"}',
  '{"monochrome": ["#1A1A1A", "#808080", "#F5F5DC"], "vintage": ["#704214", "#D2691E", "#F5DEB3"]}',
  'digital clean, smooth, noise-free, crisp edges, modern digital',
  ARRAY['texture', 'film-grain', 'analog', 'photography', 'vintage', 'gritty'],
  ARRAY['vintage photography', 'analog aesthetic', 'nostalgia', 'gritty brands', 'film look'],
  true, false, 0, NOW()
);

-- ============================================================================
-- CATEGORY 8: TECHNICAL (1 preset)
-- ============================================================================

-- Technical Blueprint
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Technical Blueprint',
  'technical',
  'Engineering schematic style with white/cyan lines on dark blue background. Technical drawings with precise measurements and annotations.',
  'technical blueprint schematic drawing, engineering diagram style, white and cyan lines on dark blue background, precise technical linework, architectural blueprint aesthetic, dimension annotations and callouts, grid pattern background, technical drafting style',
  '{"composition": "orthographic projection with dimension lines", "technique": "precise technical linework, engineering drawing standards", "colors": "white/cyan lines on dark blue blueprint background", "detail": "measurement annotations, grid overlay, technical callouts"}',
  '{"blueprint": ["#FFFFFF", "#00FFFF", "#001F3F"], "technical": ["#E0E0E0", "#40E0D0", "#1A3A52"]}',
  'artistic, hand-drawn, organic, colorful, photorealistic, decorative',
  ARRAY['technical', 'blueprint', 'schematic', 'engineering', 'precise', 'architectural'],
  ARRAY['rwa', 'technical', 'engineering', 'architecture', 'precise documentation', 'industrial'],
  true, true, 0, NOW()
);

-- ============================================================================
-- CATEGORY 9: 3D RENDER (1 preset)
-- ============================================================================

-- Modern Business 3D
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Modern Business 3D',
  '3d-render',
  'Clean 3D isometric render with modern corporate aesthetic. Smooth gradients, soft shadows, contemporary business illustration.',
  'modern business 3D isometric render, clean corporate illustration style, smooth gradients and soft shadows, contemporary geometric shapes, professional business aesthetic, matte material finish, studio lighting setup',
  '{"composition": "isometric perspective with clean layout", "technique": "3D render with soft shadows and ambient occlusion", "materials": "matte finish, smooth gradients, corporate color palette", "lighting": "studio three-point lighting, soft diffuse"}',
  '{"corporate": ["#4285F4", "#34A853", "#FBBC04", "#EA4335", "#FFFFFF"], "professional": ["#1E3A8A", "#10B981", "#F59E0B", "#EF4444", "#F3F4F6"]}',
  'hand-drawn, vintage, gritty, photorealistic, analog, textured',
  ARRAY['3d-render', 'isometric', 'corporate', 'modern', 'clean', 'business'],
  ARRAY['rwa', 'corporate', 'tech', 'business', 'professional', 'modern branding', 'explainer graphics'],
  true, true, 0, NOW()
);

-- ============================================================================
-- ADDITIONAL HIGH-VALUE PRESETS (Remaining popular styles)
-- ============================================================================

-- Ink Brushes
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Ink Brushes',
  'print-technique',
  'Japanese sumi-e ink brush painting with expressive gestural strokes, ink wash variations, and calligraphic energy.',
  'japanese sumi-e ink brush painting, expressive gestural brush strokes, ink wash with tonal variations, calligraphic energy and flow, traditional east asian brush technique, zen minimalist composition, black ink on rice paper aesthetic',
  '{"composition": "asymmetrical zen minimalism with intentional white space", "technique": "expressive brush strokes, ink wash gradations, gestural marks", "materials": "black ink on rice paper, visible brush texture", "style": "sumi-e, calligraphic, meditative"}',
  '{"traditional": ["#000000", "#F5F5DC"], "subtle": ["#1A1A1A", "#8B4513", "#FFFACD"]}',
  'digital precision, photorealistic, bright colors, geometric, western typography',
  ARRAY['ink', 'brush', 'sumi-e', 'japanese', 'calligraphic', 'zen', 'minimalist'],
  ARRAY['zen brands', 'minimalist', 'asian-inspired', 'meditative', 'artistic', 'calligraphy'],
  true, false, 0, NOW()
);

-- Foliage Stamps
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Foliage Stamps',
  'print-technique',
  'Botanical rubber stamp impressions with leaf and plant motifs. Natural printing technique with organic ink variations.',
  'botanical foliage rubber stamp impressions, leaf and plant motif printing, natural organic ink variations, hand-stamped botanical patterns, nature printing technique, pressed plant aesthetic, earthy organic texture',
  '{"composition": "organic botanical arrangement", "technique": "rubber stamp impression with ink variations, nature printing", "elements": "leaves, ferns, branches, botanical specimens", "texture": "stamp texture with organic ink distribution"}',
  '{"natural": ["#2E8B57", "#8B4513", "#6B8E23", "#F5DEB3"], "earthy": ["#228B22", "#704214", "#D2691E", "#FAEBD7"]}',
  'geometric, synthetic, neon, digital, industrial, urban',
  ARRAY['botanical', 'stamps', 'nature', 'organic', 'leaves', 'natural-printing'],
  ARRAY['organic products', 'natural brands', 'botanical', 'eco-friendly', 'nature-inspired'],
  true, false, 0, NOW()
);

-- Vintage Frames & Banners
INSERT INTO presets (
  preset_id, creator_user_id, preset_name, category, description,
  base_prompt, style_modifiers, color_palettes, negative_prompt,
  tags, best_for, is_public, is_featured, created_at
) VALUES (
  gen_random_uuid(),
  'system-swiftlist-official',
  'Vintage Frames & Banners',
  'elements',
  'Ornate vintage frames, ribbon banners, decorative badges, and Victorian embellishments. Classic ornamental design elements.',
  'vintage ornate frames and ribbon banners, decorative victorian badge elements, ornamental scrollwork and flourishes, classic embellishments and filigree, elegant border designs, gold and black ornamental details',
  '{"composition": "symmetrical ornamental with balanced embellishments", "technique": "detailed linework with ornate decorative patterns", "elements": "frames, ribbons, badges, scrollwork, flourishes", "style": "victorian, art nouveau, classic ornamental"}',
  '{"classic": ["#1A1A1A", "#D4AF37", "#F5F5DC"], "vintage": ["#8B0000", "#FFD700", "#FFFACD"]}',
  'modern minimal, flat, digital clean, plain, undecorated, contemporary',
  ARRAY['vintage', 'frames', 'banners', 'ornamental', 'victorian', 'decorative', 'badges'],
  ARRAY['heritage', 'luxury', 'formal', 'certificates', 'awards', 'elegant branding', 'traditional'],
  true, false, 0, NOW()
);

-- ============================================================================
-- PRESET LIBRARY STATISTICS
-- ============================================================================
-- Total Presets Imported: 25 (curated from 59 available)
-- Categories Covered: All 9 categories
-- Featured Presets: 10 (most valuable for product photography)
-- Public Availability: All presets public
-- System Account: SwiftList Official
--
-- PRIORITY PRESETS FOR MVP:
-- 1. Steven Noble B&W - Finance/Professional
-- 2. Lyle Hehn B&W - Brewery/Folk Art
-- 3. Risograph - Modern/Indie
-- 4. Cyberpunk Holographic - Crypto/Tech
-- 5. Technical Blueprint - RWA/Engineering
-- 6. Mid-Century Modern - Retro/Corporate
-- 7. Blockprint - Americana/Events
-- 8. Hiker Booty - Travel/Outdoor
-- 9. Glitch Art - Digital/Experimental
-- 10. Modern Business 3D - Corporate/Professional
-- ============================================================================
