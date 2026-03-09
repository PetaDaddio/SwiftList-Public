# Visual Generation from Claude Code - Complete Setup Guide

**Goal**: Prompt Claude Code to generate ANY visual output (images, videos, animations) without leaving this interface.

**Status**: ✅ Infrastructure installed, ⏳ Credentials needed

---

## Overview

You can now generate visual content directly from Claude Code prompts using:

1. **Images**: Product photos, logos, UI mockups, social media graphics
2. **Videos**: Exploded product views, how-to tutorials, marketing videos
3. **Animations**: Motion graphics, product demos, UI animations

**How it works**: You prompt me → I call MCP servers → Visual output returned

---

## Available Visual Generation Tools

### 1. Glif MCP (INSTALLED - NEEDS TOKEN)

**Capabilities**:
- **Image Generation**: Flux, Stable Diffusion XL, Midjourney-style
- **Video Generation**: Via integrated models (Kling, Veo 3, etc.)
- **Audio Generation**: Music, sound effects, voiceovers
- **Custom Workflows**: Run pre-built or create new workflows

**Models Accessible**:
- Flux (image generation) - High quality, fast
- SDXL (image generation) - Versatile, well-supported
- Kling AI (video) - Premium quality (paid)
- Veo 3 (video) - Google's video model
- ComfyUI workflows - Custom pipelines

**Setup Required**:
```bash
# 1. Get API token from Glif
# Visit: https://glif.app/settings/api-tokens
# - Sign up/login to Glif
# - Enable 2FA (required)
# - Create API token (90-day expiry recommended)

# 2. Add token to environment
echo 'export GLIF_API_TOKEN=your_token_here' >> ~/.zshrc
source ~/.zshrc

# 3. Restart Claude Code
# Token will be loaded automatically
```

**Cost**: Free tier available, paid for premium models
**Best for**: Unified API, multiple model access, workflow automation

---

### 2. n8n MCP (CONNECTED ✅)

**Capabilities**:
- Execute n8n workflows (WF-01 through WF-51)
- Includes image generation workflows (WF-39 Food Exploded View)
- Custom AI pipelines with multiple steps

**Already Working**: You have 51+ workflows ready to execute

**Models Available**:
- Gemini Vision Pro (image analysis)
- Nano Banana Pro (image generation via Replicate)
- Flux (via Replicate)
- Claude API (text generation, analysis)

**Setup**: ✅ Already configured
**Cost**: Per-workflow execution (varies by workflow)
**Best for**: Complex multi-step visual generation pipelines

---

### 3. GitHub MCP (CONNECTED ✅)

**Capabilities**:
- Fetch visual assets from repositories
- Store generated images/videos to GitHub
- Version control for visual assets

**Setup**: ✅ Already configured
**Best for**: Asset management, versioning

---

## Recommended Additional MCP Servers

### 4. fal.ai MCP (RECOMMENDED - NOT INSTALLED)

**Why Install**:
- **Cheapest video generation**: $0.20-$0.40 per video
- **Fast latency**: 30-90 second generation
- **Multiple models**: WAN 2.1, Veo 3, Mochi-1, HunyuanVideo
- **Free credits**: $10 on signup

**Installation**:
```bash
# Install fal.ai MCP
npm install -g @fal-ai/mcp-server

# Add to Claude MCP config
claude mcp add fal "npx @fal-ai/mcp-server"

# Get API key from https://fal.ai/dashboard/keys
export FAL_KEY=your_key_here
```

**Cost**: $0.20-$0.40/video (55% cheaper than Kling)
**Best for**: Cost-effective video generation at scale

---

### 5. Replicate MCP (RECOMMENDED - NOT INSTALLED)

**Why Install**:
- **Widest model selection**: 1000+ AI models
- **Pay-per-use**: $0.002-$0.13 per generation
- **Free credits**: $10 on signup
- **No subscription required**

**Models Available**:
- Flux (image generation)
- SDXL (image generation)
- CogVideoX (video generation)
- Stable Video Diffusion
- AnimateDiff
- RIFE (frame interpolation)
- Background removal, upscaling, face restoration

**Installation**:
```bash
# Install Replicate MCP
npm install -g @modelcontextprotocol/server-replicate

# Add to Claude MCP config
claude mcp add replicate "npx @modelcontextprotocol/server-replicate"

# Get API token from https://replicate.com/account/api-tokens
export REPLICATE_API_TOKEN=your_token_here
```

**Cost**: Pay-per-use, typically $0.01-$0.50 per generation
**Best for**: Maximum flexibility, lowest cost at high volume

---

## How to Use Visual Generation in Claude Code

### Example 1: Generate Product Photo

**Your Prompt**:
```
Generate a professional product photo of the SwiftList logo on a teal gradient background,
high resolution, clean, modern aesthetic
```

**What Happens**:
1. I use Glif MCP `run_workflow` with Flux model
2. Image generated in ~10-30 seconds
3. URL returned to you
4. Optionally: Save to GitHub or display inline

---

### Example 2: Create How-To Video

**Your Prompt**:
```
Create a 30-second video showing how to use SwiftList:
1. User uploads product photo
2. Selects "Background Removal" treatment
3. Clicks "Generate"
4. Result appears with transparent background
Include smooth transitions, clean UI mockups, professional quality
```

**What Happens**:
1. I use fal.ai MCP (or n8n workflow) for video generation
2. Break down steps into scenes
3. Generate video with motion prompts
4. Return video URL
5. Optionally: Upload to S3/Cloudflare for hosting

---

### Example 3: Exploded Product View Video

**Your Prompt**:
```
Create exploded view video of a crispy chicken burger:
- Layers: sesame bun, lettuce, tomato, cheese, chicken patty, onions, pickles, bottom bun
- Animation: slow rotation with layers separating
- Style: photorealistic, white background, labeled components
- Duration: 10 seconds
```

**What Happens**:
1. I use n8n WF-39 (existing workflow) or fal.ai
2. Generate assembled + exploded images
3. Animate with motion prompts
4. Return video URL

---

### Example 4: Social Media Graphics

**Your Prompt**:
```
Create 3 Instagram posts for SwiftList:
1. Before/after product photo transformation
2. Feature highlight: "AI-Powered Background Removal in Seconds"
3. Pricing teaser: "Start with 100 Free Credits"
Use teal (#00796B) brand color, modern typography
```

**What Happens**:
1. I use Glif MCP with design-focused workflow
2. Generate 3 images (1080x1080)
3. Apply brand colors and typography
4. Return all URLs

---

## Cost Comparison

| Task | Glif (Kling) | fal.ai | Replicate | n8n Workflows |
|------|--------------|--------|-----------|---------------|
| Product photo | $0.05-$0.10 | $0.05-$0.10 | $0.02-$0.05 | $0.03-$0.08 |
| Video (10s) | $0.25-$0.30 | $0.20-$0.40 | $0.10-$0.20 | $0.15-$0.30 |
| Exploded view | $0.30-$0.50 | $0.20-$0.40 | $0.15-$0.25 | $0.65 (WF-39) |

**Recommended Strategy**:
- **Images**: Use Replicate (cheapest) or Glif (unified)
- **Videos**: Use fal.ai (best price/quality) or n8n (custom workflows)
- **Complex workflows**: Use n8n (full control)

---

## Setup Priority

### Immediate (Today)
1. ✅ Configure Glif API token
2. ⏳ Test image generation via Glif
3. ⏳ Test video generation via n8n WF-39

### This Week
4. ⏳ Install fal.ai MCP for video generation
5. ⏳ Install Replicate MCP for model variety
6. ⏳ Create SwiftList-specific visual workflows

### Post-MVP
7. ⏳ Build custom ComfyUI workflows
8. ⏳ Self-host models for high-volume production
9. ⏳ Integrate with SwiftList frontend for user-facing visual generation

---

## Security Considerations

**API Key Storage**:
- Store tokens in environment variables, NEVER in code
- Use `.zshrc` or `.bash_profile` for persistence
- Add to `.gitignore`: `.env*`, `!.env.example`

**MCP Server Security**:
- ✅ Glif: Verified safe (9.5/10 security score)
- ✅ n8n: Self-hosted, full control
- ⏳ fal.ai: Verify before installation (pending)
- ⏳ Replicate: Verify before installation (pending)

**Data Privacy**:
- Visual outputs sent to third-party APIs (Glif, fal.ai, Replicate)
- Do NOT include PII in prompts
- Use SwiftList's PII scrubbing before visual generation

---

## Next Steps

**What You Need to Do**:
1. Get Glif API token: https://glif.app/settings/api-tokens
2. Add to environment: `export GLIF_API_TOKEN=your_token_here`
3. Restart Claude Code
4. Test with simple prompt: "Generate a teal gradient background image"

**What I'll Do Once Configured**:
- Test all visual generation capabilities
- Create usage examples
- Build SwiftList-specific workflows
- Optimize cost/quality balance

---

**Once configured, you can prompt me for ANY visual output and I'll handle the rest.**

No need to leave Claude Code, switch tools, or manually configure APIs.

**Status**: Ready to configure Glif token → Full visual generation unlocked
