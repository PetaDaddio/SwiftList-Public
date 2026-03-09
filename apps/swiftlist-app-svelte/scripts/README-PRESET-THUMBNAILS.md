# Preset Thumbnail Generation

Automatically generate 30 photorealistic preset thumbnails using AI image generation.

## Quick Start

### Option 1: Replicate (Recommended - Easiest Setup)

1. Get API token from https://replicate.com/account/api-tokens
2. Add to `.env.local`:
   ```bash
   REPLICATE_API_TOKEN=your_token_here
   ```
3. Run generation:
   ```bash
   npm run generate:presets
   ```

**Cost:** ~$0.09 total (30 images × $0.003 each)
**Time:** ~3 minutes (with rate limiting)
**Model:** Flux Pro 1.1 (photorealistic, e-commerce quality)

---

### Option 2: Google Imagen 3 (Vertex AI)

**Note:** Requires GCP project setup with Vertex AI enabled.

1. Enable Vertex AI in your GCP project
2. Create service account with Vertex AI permissions
3. Download service account JSON key
4. Set environment variables:
   ```bash
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```
5. Update script to use Vertex AI SDK:
   ```typescript
   import { ImageGenerationModel, VertexAI } from '@google-cloud/vertexai';

   const vertexAI = new VertexAI({ project: 'your-project-id', location: 'us-central1' });
   const model = vertexAI.preview.getGenerativeModel({ model: 'imagen-3.0-generate-001' });
   ```
6. Install Vertex AI SDK:
   ```bash
   npm install @google-cloud/vertexai
   ```

**Cost:** ~$0.12 total (30 images × $0.004 each)
**Time:** ~2-3 minutes
**Complexity:** High (requires GCP setup)

---

### Option 3: fal.ai (Alternative)

1. Get API key from https://fal.ai/dashboard/keys
2. Add to `.env.local`:
   ```bash
   FAL_KEY=your_key_here
   ```
3. Update script to use fal.ai endpoint (already commented in code)

**Cost:** ~$0.15 total (30 images × $0.005 each)
**Time:** ~2-3 minutes
**Model:** Flux Pro or Stable Diffusion XL

---

## What Gets Generated

For each of the 30 presets, the script generates a **16:9 landscape thumbnail** showing:

- **Jewelry presets** → Product on textured surface (e.g., turquoise bracelet on weathered wood)
- **Vintage presets** → Collectible styled authentically (e.g., Pyrex bowl in retro kitchen)
- **Fashion presets** → Item styled for marketplace (e.g., Lululemon leggings flat lay)
- **Home presets** → Decor in natural setting (e.g., linen bedding with rumpled texture)

All images are:
- Professional e-commerce quality
- 16:9 aspect ratio (optimized for cards)
- JPG format, ~200-500KB each
- Saved to `/static/preset-thumbnails/1.jpg` through `30.jpg`

---

## After Generation

Once all 30 images are generated, update `/src/routes/presets/+page.svelte`:

**Replace this:**
```svelte
<div class="relative aspect-video overflow-hidden"
     style={`background: linear-gradient(135deg, ${preset.backgroundColor} 0%, ${preset.backgroundColor}dd 100%)`}>
	<div class="w-full h-full flex items-center justify-center opacity-90">
		<span class="material-symbols-outlined text-white/30 text-[80px]">palette</span>
	</div>
</div>
```

**With this:**
```svelte
<div class="relative aspect-video overflow-hidden">
	<img
		src="/preset-thumbnails/{preset.id}.jpg"
		alt={preset.name}
		class="w-full h-full object-cover"
		loading="lazy"
	/>
</div>
```

---

## Troubleshooting

### Rate Limiting
If you hit rate limits, increase the delay between requests in the script:
```typescript
await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
```

### Failed Generations
The script logs failed presets at the end. Re-run to retry only failed ones:
```bash
npm run generate:presets -- --retry-failed
```

### Quality Issues
Adjust the image generation parameters in `buildImagePrompt()`:
- More detailed prompts = better results
- Add specific camera/lens details
- Specify lighting conditions explicitly

---

## Cost Comparison

| Provider      | Cost/Image | Total (30) | Setup Complexity | Quality      |
|---------------|------------|------------|------------------|--------------|
| Replicate     | $0.003     | **$0.09**  | ⭐ Easy          | Excellent    |
| Google Imagen | $0.004     | $0.12      | ⭐⭐⭐ Complex   | Excellent    |
| fal.ai        | $0.005     | $0.15      | ⭐⭐ Moderate    | Excellent    |

**Recommendation:** Use Replicate for easiest setup and lowest cost.

---

## Next Steps

After generating thumbnails:
1. ✅ Review all 30 images in `/static/preset-thumbnails/`
2. ✅ Update `+page.svelte` to display images
3. ✅ Test on mobile and desktop
4. ✅ Regenerate any low-quality thumbnails
5. ✅ Commit images to git (they're static assets)

---

**Questions?** Check the script comments in `generate-preset-thumbnails.ts` for detailed implementation notes.
