# Rollback: CleanEdge Intelligence + GemPerfect Engine — A/A+ Grade

**Date:** 2026-02-16
**Grade:** A/A+ (confirmed on silver bangles + aquamarine cabochon ring)
**Git Commit:** See commit hash below after push

## What This Contains

These are the proven-working versions of the core image processing engines:

| File | Engine | Purpose |
|------|--------|---------|
| `refine-edges.ts` | CleanEdge Intelligence | Edge color dilation + soft alpha cleanup for ALL products. Jewelry skips median/sharpen but flows through CleanEdge fringing correction. |
| `jewelry-engine.ts` | GemPerfect Engine | Gemstone detection, metal detection, protection masks for jewelry color restoration |
| `jewelry-specialist.ts` | Jewelry Specialist Agent | Jewelry-specific pipeline orchestration |
| `edge-detection.ts` | Edge Detection Utils | Edge quality assessment + fringing detection |
| `shadow.ts` | Shadow Utility | Silhouette-based product shadow generation |

## Key Parameters (CleanEdge)

```
OPAQUE_THRESHOLD = 240   // Pixels above this are "definitely product"
EDGE_THRESHOLD = 10      // Pixels below this are "definitely background"
SEARCH_RADIUS = 4        // How far to search for opaque neighbor (px)
Soft alpha cleanup: alpha >= 200 promoted to 255
No-neighbor fallback: alpha * 0.5
```

## Architecture

- Jewelry: Skips median/sharpen (moiré protection) → flows to fringing detection → CleanEdge edge color dilation + gemstone color restoration from original image
- Clothing: median(3) + sharpen(0.8) → fringing detection → CleanEdge default
- Other products: median(3) + sharpen(0.7) + conditional blur → fringing detection → CleanEdge default

## How to Restore

```bash
ROLLBACK="docs/rollbacks/2026-02-16-cleanedge-gemperfect-A-grade"
SRC="apps/swiftlist-app-svelte/src/lib"

cp "$ROLLBACK/refine-edges.ts" "$SRC/agents/background-removal/agents/refine-edges.ts"
cp "$ROLLBACK/jewelry-engine.ts" "$SRC/agents/background-removal/engines/jewelry-engine.ts"
cp "$ROLLBACK/jewelry-specialist.ts" "$SRC/agents/background-removal/agents/jewelry-specialist.ts"
cp "$ROLLBACK/edge-detection.ts" "$SRC/agents/background-removal/utils/edge-detection.ts"
cp "$ROLLBACK/shadow.ts" "$SRC/utils/shadow.ts"
```

## Test Results

- Silver bangles (stacked, hammered texture): **A/A+** — clean edges, no moiré, texture preserved
- Silver ring with aquamarine cabochon: **B+/A-** — clean edges, minor pixelation at top curve
