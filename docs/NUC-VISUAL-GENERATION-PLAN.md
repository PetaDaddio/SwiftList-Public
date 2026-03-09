# Self-Hosted Visual Generation on Ubuntu NUC

**Goal**: Use your Ubuntu NUC to run free, self-hosted visual generation (images + videos) and integrate with Claude Code

**Status**: ⏳ Planning phase - Need NUC specs

---

## Overview

Your NUC can become a **free visual generation server** that:
1. Runs open-source AI models (Flux, CogVideoX, AnimateDiff)
2. Serves n8n workflows (already planned for n8n hosting)
3. Provides API endpoints for Claude Code MCP integration
4. Eliminates per-generation costs (free after setup)

---

## Critical Question: Does Your NUC Have a GPU?

### If YES (NVIDIA GPU with 8GB+ VRAM):
✅ **PERFECT** - Can run all visual generation models locally
- Image generation: Flux, SDXL (8GB VRAM)
- Video generation: CogVideoX-2B (12GB VRAM), LTX-Video (12GB VRAM)
- Frame interpolation: RIFE (minimal VRAM)
- Generation time: 30 seconds - 5 minutes per video

### If NO (CPU only or Intel integrated graphics):
⚠️ **STILL POSSIBLE** but slower
- CPU-based inference: 5-20 minutes per image, 30-60 minutes per video
- Use lighter models: Stable Diffusion 1.5, SDXL Turbo
- Offload heavy tasks to cloud when needed
- Best for: Image generation, preprocessing, n8n orchestration

---

## Recommended Architecture

### Setup 1: NUC as Visual Generation Server (If GPU Available)

```
Your MacBook (Claude Code)
  ↓
MCP Server (local)
  ↓
HTTP API → Ubuntu NUC (192.168.x.x or VPN)
  ↓
ComfyUI Server (running on NUC)
  ├─ Flux (image generation)
  ├─ CogVideoX-5B (video generation)
  ├─ AnimateDiff (animation)
  └─ RIFE (frame interpolation)
```

**Your prompt**: "Create exploded burger video"
**Flow**:
1. I call local MCP server
2. MCP sends request to NUC ComfyUI API
3. NUC generates video (3-12 minutes)
4. Returns video URL (served from NUC or uploaded to S3)
5. You get result in Claude Code

**Cost**: $0 per generation (after setup)

---

### Setup 2: NUC as n8n + Hybrid Cloud (If No GPU)

```
Your MacBook (Claude Code)
  ↓
n8n (running on NUC)
  ├─ Light tasks: Image preprocessing, resizing, compositing (CPU)
  ├─ Heavy tasks: Call fal.ai/Replicate for generation (paid)
  └─ Post-processing: Frame interpolation, video editing (CPU)
```

**Your prompt**: "Create exploded burger video"
**Flow**:
1. I call n8n workflow on NUC
2. NUC handles orchestration (free)
3. Calls fal.ai for heavy generation ($0.20-$0.40)
4. NUC does post-processing (free)
5. Returns final video

**Cost**: $0.20-$0.40 per video (50-80% cheaper than doing everything in cloud)

---

## What to Install on NUC

### Core Infrastructure
1. **ComfyUI** - Visual AI workflow manager (like n8n but for AI models)
2. **NVIDIA drivers + CUDA** (if GPU available)
3. **Python 3.10+** with PyTorch
4. **n8n** (as planned)
5. **Nginx** - Serve generated files and API endpoints

### AI Models to Download (Based on GPU)

#### If 8GB VRAM:
- **Flux Schnell** (12GB disk) - Fast image generation
- **SDXL Turbo** (7GB disk) - Fast, lower quality images
- **RIFE v4.6** (500MB disk) - Frame interpolation
- **Total**: ~20GB disk space, ~8GB VRAM usage

#### If 12GB+ VRAM:
- **Flux Dev** (24GB disk) - High quality images
- **CogVideoX-2B** (10GB disk) - Video generation
- **AnimateDiff** (5GB disk) - Animation
- **RIFE v4.6** (500MB disk) - Frame interpolation
- **Total**: ~40GB disk space, ~12GB VRAM usage

#### If 24GB+ VRAM (Ideal):
- **Flux Dev** (24GB disk)
- **CogVideoX-5B** (20GB disk) - Best quality video
- **SDXL** (7GB disk)
- **AnimateDiff** (5GB disk)
- **RIFE** (500MB disk)
- **Total**: ~57GB disk space, ~16GB VRAM usage

#### If NO GPU (CPU only):
- **Stable Diffusion 1.5** (5GB disk) - Basic images (slow)
- **SDXL Turbo** (7GB disk) - Optimized for CPU
- **RIFE** (500MB disk) - Frame interpolation
- **Total**: ~13GB disk space

---

## Network Configuration

### Option A: Local Network Access (Fastest)
- ComfyUI runs on NUC at `http://192.168.x.x:8188`
- Your MacBook connects directly via local network
- No internet latency, maximum speed
- **Limitation**: Only works when on same network

### Option B: Tailscale VPN (Recommended)
- Install Tailscale on NUC + MacBook
- Access NUC from anywhere via private VPN
- ComfyUI at `http://100.x.x.x:8188` (Tailscale IP)
- **Benefit**: Works from anywhere, secure, free

### Option C: Public Endpoint (Advanced)
- Expose ComfyUI via Cloudflare Tunnel
- Access from anywhere via HTTPS
- Add authentication (API keys)
- **Benefit**: Can integrate with SwiftList production later

---

## Estimated Setup Time

### If GPU Available:
- **Hardware check**: 10 minutes (verify GPU, drivers)
- **NVIDIA driver + CUDA install**: 30 minutes
- **ComfyUI setup**: 1 hour
- **Model downloads**: 2-4 hours (depends on internet speed)
- **n8n integration**: 1 hour
- **MCP bridge setup**: 1 hour
- **Total**: 5-7 hours

### If CPU Only:
- **Python environment setup**: 30 minutes
- **ComfyUI setup**: 1 hour
- **Model downloads**: 1-2 hours
- **n8n integration**: 1 hour
- **Total**: 3-4 hours

---

## Performance Expectations

### With GPU (8GB VRAM):
- **Image generation**: 5-15 seconds (Flux Schnell)
- **Video generation**: 5-10 minutes (CogVideoX-2B, 5 seconds output)
- **Frame interpolation**: 10-30 seconds (RIFE)
- **Total for exploded view**: ~6-12 minutes

### With GPU (16GB+ VRAM):
- **Image generation**: 10-30 seconds (Flux Dev, high quality)
- **Video generation**: 6-12 minutes (CogVideoX-5B, 10 seconds output)
- **Frame interpolation**: 10-30 seconds (RIFE)
- **Total for exploded view**: ~7-15 minutes

### With CPU Only:
- **Image generation**: 5-20 minutes (SDXL)
- **Video generation**: 30-60 minutes (CogVideoX-2B)
- **Frame interpolation**: 2-5 minutes (RIFE)
- **Total for exploded view**: ~40-90 minutes

---

## Cost Analysis

### Cloud-Only (Current Plan):
- 100 videos/month @ $0.30/video = $30/month = **$360/year**
- 1000 videos/month @ $0.30/video = $300/month = **$3,600/year**

### Self-Hosted (NUC):
- Setup time: 5-7 hours one-time
- Electricity: ~50W @ $0.12/kWh = ~$4.32/month = **$52/year**
- Model downloads: Free (open source)
- Per-video cost: **$0**
- **Breakeven**: After ~12 videos (if paying $0.30/video)

### Hybrid (NUC + Cloud):
- Light tasks on NUC: Free
- Heavy generation via fal.ai: $0.20/video
- 100 videos/month = $20/month = **$240/year** (40% savings)

---

## Next Steps

### Immediate (Today):
1. **Check NUC GPU**: SSH to NUC, run `lspci | grep -i vga`
2. **Check VRAM**: If NVIDIA GPU, run `nvidia-smi`
3. **Report specs**: Tell me what GPU (if any) and VRAM available

### If GPU Available:
4. Install NVIDIA drivers + CUDA
5. Install ComfyUI
6. Download models (Flux, CogVideoX)
7. Test local generation
8. Create MCP bridge to NUC

### If No GPU:
4. Install CPU-optimized models
5. Set up hybrid n8n workflows (NUC orchestration + cloud generation)
6. Use NUC for preprocessing/post-processing

---

## Ralph Wiggum Prompt (After GPU Check)

Once you confirm GPU specs, I'll create a Ralph prompt that:
1. SSH to your NUC
2. Install all required software
3. Download AI models
4. Configure ComfyUI server
5. Create API endpoints
6. Build MCP bridge
7. Test end-to-end: Prompt in Claude Code → Generated on NUC

---

## Questions for You

1. **Does your NUC have an NVIDIA GPU?** If yes, which model?
2. **What's the NUC's local IP?** (e.g., 192.168.1.50)
3. **Do you have SSH access?** Can you SSH to it from your MacBook?
4. **Do you want n8n on the NUC too?** (as originally planned)
5. **Network preference?** Local-only, Tailscale VPN, or public endpoint?

---

**Bottom Line**:
- ✅ **Yes, your NUC can do free visual generation**
- ✅ **Better with GPU, but works without (just slower)**
- ✅ **Will integrate with Claude Code via MCP**
- ✅ **$0 per generation after setup**
- ✅ **Perfect for SwiftList development/testing**

Let me know your NUC specs and I'll create the setup automation!
