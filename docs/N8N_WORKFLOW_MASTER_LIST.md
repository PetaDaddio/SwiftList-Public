# SwiftList n8n Workflows - Master List

**Date:** December 18, 2024
**Status:** Planning Phase
**Total Workflows:** 18

---

## 📋 Workflow Categories

1. **AI Image Treatments** (6 workflows) - Core product features
2. **Marketplace Formatters** (5 workflows) - Multi-marketplace optimization
3. **System Operations** (4 workflows) - Platform management
4. **User & Token Management** (3 workflows) - Economics & fraud prevention

---

## 🎨 Category 1: AI Image Treatments

### 1.1 Background Removal
**Priority:** 🔴 CRITICAL (MVP)
**Tier:** 1 (Gemini 2.0 Flash)
**Cost:** ~$0.001/request
**Processing Time:** 3-5 seconds

**Trigger:** Webhook (POST /webhook/background-removal)

**Input:**
```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "image_url": "https://s3.../original.jpg",
  "preset_id": "uuid" (optional)
}
```

**Processing Steps:**
1. Validate input
2. Fetch image from S3
3. Call Gemini API for background removal
4. Post-process (clean edges, transparency)
5. Store result to S3
6. Update job status
7. Distribute tokens (if preset used)

**Output:**
```json
{
  "job_id": "uuid",
  "status": "success",
  "output_url": "https://s3.../bg-removed.png",
  "cost_usd": 0.001,
  "processing_time_ms": 4200
}
```

**Marketplace Use:** Amazon, Etsy (white background requirement)

---

### 1.2 High-Res Upscale (4K)
**Priority:** 🟡 HIGH (MVP)
**Tier:** 2 (GPT-Image-1.5 via OpenRouter)
**Cost:** ~$0.04/request
**Processing Time:** 10-15 seconds

**Trigger:** Webhook (POST /webhook/upscale)

**Input:**
```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "image_url": "https://s3.../input.jpg",
  "target_resolution": "4K", // or "2K", "8K"
  "enhancement_level": "standard" // or "enhanced"
}
```

**Processing Steps:**
1. Validate input
2. Fetch image from S3
3. Call GPT-Image API for upscaling
4. Quality check with Flash 3 Lifeguard
5. Store result to S3
6. Update job status
7. Log cost

**Output:**
```json
{
  "job_id": "uuid",
  "status": "success",
  "output_url": "https://s3.../upscaled-4k.jpg",
  "original_resolution": "1024x1024",
  "new_resolution": "3840x2160",
  "quality_score": 0.92,
  "cost_usd": 0.04
}
```

**Marketplace Use:** All (high-quality images perform better)

---

### 1.3 Lifestyle Scene Generation
**Priority:** 🟡 HIGH (MVP)
**Tier:** 2 (GPT-Image-1.5 via OpenRouter)
**Cost:** ~$0.04/request
**Processing Time:** 15-20 seconds

**Trigger:** Webhook (POST /webhook/lifestyle-scene)

**Input:**
```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "product_image_url": "https://s3.../product.png",
  "scene_type": "modern_loft", // or "cozy_bedroom", "minimalist_office", etc.
  "preset_id": "uuid" (optional),
  "custom_prompt": "string" (optional)
}
```

**Processing Steps:**
1. Validate input
2. Fetch product image from S3
3. If preset_id: Fetch preset style vector and merge with prompt
4. Call GPT-Image API for scene generation
5. Quality check: Ensure product is prominent, lighting matches
6. Store result to S3
7. Distribute tokens (if preset used)
8. Update job status

**Output:**
```json
{
  "job_id": "uuid",
  "status": "success",
  "output_url": "https://s3.../lifestyle-scene.jpg",
  "scene_type": "modern_loft",
  "quality_score": 0.88,
  "preset_royalty_tokens": 10,
  "cost_usd": 0.04
}
```

**Marketplace Use:** Etsy (lifestyle images required), Poshmark (context sells)

---

### 1.4 Animated Spin (360° Video)
**Priority:** 🟢 MEDIUM (Phase 2)
**Tier:** 3 (Runway Gen-3 Alpha Turbo)
**Cost:** ~$0.30/request
**Processing Time:** 45-60 seconds

**Trigger:** Webhook (POST /webhook/animated-spin)

**Input:**
```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "image_url": "https://s3.../product.png",
  "duration_seconds": 10,
  "rotation_direction": "clockwise", // or "counterclockwise"
  "background": "transparent" // or "white", "custom"
}
```

**Processing Steps:**
1. Validate input
2. Fetch image from S3
3. Call Runway Gen-3 API for video generation
4. Quality check: Smooth rotation, no artifacts
5. Store video to S3
6. Generate thumbnail
7. Update job status
8. Log cost (high tier)

**Output:**
```json
{
  "job_id": "uuid",
  "status": "success",
  "output_video_url": "https://s3.../spin-360.mp4",
  "thumbnail_url": "https://s3.../spin-thumb.jpg",
  "duration_seconds": 10,
  "file_size_mb": 14.2,
  "quality_score": 0.91,
  "cost_usd": 0.30
}
```

**Marketplace Use:** Amazon (video increases conversion 80%), Shopify

---

### 1.5 Hand Model Generation
**Priority:** 🟢 MEDIUM (Phase 2)
**Tier:** 2 (GPT-Image-1.5 via OpenRouter)
**Cost:** ~$0.04/request
**Processing Time:** 15-20 seconds

**Trigger:** Webhook (POST /webhook/hand-model)

**Input:**
```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "product_image_url": "https://s3.../product.png",
  "hand_type": "female_manicured", // or "male_casual", "diverse", etc.
  "pose": "holding", // or "wearing", "displaying"
  "background": "white" // or "lifestyle", "transparent"
}
```

**Processing Steps:**
1. Validate input
2. Fetch product image
3. Call GPT-Image API with hand model prompt
4. Quality check: Natural hand position, realistic skin tone
5. Store result to S3
6. Update job status

**Output:**
```json
{
  "job_id": "uuid",
  "status": "success",
  "output_url": "https://s3.../hand-model.jpg",
  "hand_type": "female_manicured",
  "quality_score": 0.85,
  "cost_usd": 0.04
}
```

**Marketplace Use:** Etsy (shows scale), Poshmark (demonstrates wearability)

---

### 1.6 Convert to SVG (Vectorization)
**Priority:** 🟢 LOW (Phase 3)
**Tier:** 1 (Gemini 2.0 Flash + image processing)
**Cost:** ~$0.002/request
**Processing Time:** 5-8 seconds

**Trigger:** Webhook (POST /webhook/convert-svg)

**Input:**
```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "image_url": "https://s3.../logo.png",
  "simplification_level": "standard" // or "detailed", "minimal"
}
```

**Processing Steps:**
1. Validate input (best for logos/simple graphics)
2. Fetch image
3. Use image processing library (Potrace/ImageMagick) or Gemini for edge detection
4. Convert to SVG format
5. Optimize SVG (reduce nodes)
6. Store result to S3
7. Update job status

**Output:**
```json
{
  "job_id": "uuid",
  "status": "success",
  "output_url": "https://s3.../logo.svg",
  "file_size_kb": 12,
  "node_count": 347,
  "cost_usd": 0.002
}
```

**Marketplace Use:** Shopify (scalable logos), print-on-demand

---

## 🏪 Category 2: Marketplace Formatters

### 2.1 Amazon Asset Package Generator
**Priority:** 🔴 CRITICAL (MVP)
**Trigger:** Webhook (POST /webhook/format-amazon)

**Input:**
```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "processed_images": [
    {
      "type": "main",
      "url": "https://s3.../bg-removed.png"
    },
    {
      "type": "lifestyle",
      "url": "https://s3.../lifestyle-scene.jpg"
    }
  ],
  "metadata": {
    "title": "Vintage Leather Handbag",
    "bullet_points": ["Point 1", "Point 2", ...],
    "description": "string"
  }
}
```

**Processing Steps:**
1. Validate input
2. For each image:
   - Resize to Amazon specs (main: 2048x2048, lifestyle: 1080p video)
   - Ensure white background (#FFFFFF) for main image
   - Compress to <10MB
   - Verify resolution ≥1000px shortest side
3. Generate metadata JSON for Amazon API
4. Package all assets into downloadable ZIP
5. Store to S3
6. Update job status

**Output:**
```json
{
  "job_id": "uuid",
  "status": "success",
  "package_url": "https://s3.../amazon-package.zip",
  "assets": [
    {
      "filename": "product_image_amazon_listing_main.jpg",
      "resolution": "2048x2048",
      "file_size_mb": 2.4
    },
    {
      "filename": "product_image_amazon_lifestyle_1.mp4",
      "resolution": "1080p",
      "file_size_mb": 14.2,
      "duration_seconds": 10
    }
  ],
  "metadata_file": "amazon_metadata.json"
}
```

---

### 2.2 Etsy Asset Package Generator
**Priority:** 🔴 CRITICAL (MVP)
**Trigger:** Webhook (POST /webhook/format-etsy)

**Input:** Similar to Amazon formatter

**Processing Steps:**
1. Validate input
2. For each image:
   - Resize to Etsy specs (main: 2000x2000)
   - Allow lifestyle backgrounds (preferred over white)
   - Compress to <10MB
   - Verify resolution ≥2000px shortest side
3. Generate metadata with 13 tags
4. Package assets
5. Store to S3

**Output:**
```json
{
  "job_id": "uuid",
  "status": "success",
  "package_url": "https://s3.../etsy-package.zip",
  "assets": [
    {
      "filename": "etsy_listing_thumbnail_crop.jpg",
      "resolution": "2000x2000",
      "file_size_mb": 1.8
    }
  ],
  "metadata": {
    "title": "string (140 chars max)",
    "tags": ["tag1", "tag2", ..., "tag13"],
    "description": "string"
  }
}
```

---

### 2.3 Poshmark Asset Package Generator
**Priority:** 🟡 HIGH (MVP)
**Trigger:** Webhook (POST /webhook/format-poshmark)

**Etsy specs:** 1280x1280 min, lifestyle/flat lay preferred

---

### 2.4 Shopify Asset Package Generator
**Priority:** 🟢 MEDIUM (Phase 2)
**Trigger:** Webhook (POST /webhook/format-shopify)

**Shopify specs:** Flexible, but optimize for 1024x1024+, support variants

---

### 2.5 eBay Asset Package Generator
**Priority:** 🟢 LOW (Phase 3)
**Trigger:** Webhook (POST /webhook/format-ebay)

**eBay specs:** Similar to Amazon, 1600x1600 recommended

---

## ⚙️ Category 3: System Operations

### 3.1 Preset Style Extraction
**Priority:** 🔴 CRITICAL (MVP - Network Effect Core)
**Tier:** 1 (Gemini 2.0 Flash + pgvector)
**Cost:** ~$0.002/request
**Processing Time:** 3-5 seconds

**Trigger:** Webhook (POST /webhook/extract-preset-style)

**Purpose:** Extract style vector from reference image for preset creation

**Input:**
```json
{
  "preset_id": "uuid",
  "creator_id": "uuid",
  "reference_image_url": "https://s3.../reference.jpg",
  "preset_name": "Neon Cyberpunk",
  "description": "Futuristic neon lighting with cyberpunk aesthetic",
  "categories": ["Tech", "Minimalist"],
  "visibility": "public"
}
```

**Processing Steps:**
1. Validate input
2. Fetch reference image
3. Call Gemini API to analyze style features:
   - Color palette
   - Lighting style
   - Composition
   - Mood/aesthetic
4. Generate 1536-dimensional style vector (for pgvector similarity search)
5. Store vector in database (presets table)
6. Initialize USAT score = 1.00
7. Set usage counters to 0
8. Return preset_id

**Output:**
```json
{
  "preset_id": "uuid",
  "status": "success",
  "style_vector": [0.23, -0.41, ...], // 1536 dimensions
  "extracted_features": {
    "dominant_colors": ["#FF006E", "#00F5FF", "#1A1A2E"],
    "lighting": "neon",
    "mood": "energetic",
    "composition": "centered"
  }
}
```

**Critical for:** Preset marketplace discovery, similarity recommendations

---

### 3.2 Lifeguard Quality Audit
**Priority:** 🔴 CRITICAL (MVP - Quality Control)
**Tier:** 1 (Google Flash 3)
**Cost:** ~$0.0001/request
**Processing Time:** 2-3 seconds

**Trigger:** Called after EVERY AI treatment (internal)

**Purpose:** Quality check generated assets before delivery to user

**Input:**
```json
{
  "job_id": "uuid",
  "treatment_type": "background_removal",
  "original_image_url": "https://s3.../original.jpg",
  "processed_image_url": "https://s3.../processed.png",
  "expected_outcome": "clean background removal, no artifacts"
}
```

**Processing Steps:**
1. Fetch both images
2. Call Flash 3 with quality criteria:
   - Did treatment succeed?
   - Are there visible artifacts?
   - Does output match expected quality?
   - Rate quality 0.0-1.0
3. If quality_score < 0.7: Flag for retry
4. If quality_score < 0.5: Auto-refund user, log failure
5. Store quality score in jobs table
6. Return pass/fail

**Output:**
```json
{
  "job_id": "uuid",
  "quality_score": 0.92,
  "status": "pass",
  "issues_detected": [],
  "recommendation": "deliver"
}
```

**Failure Example:**
```json
{
  "job_id": "uuid",
  "quality_score": 0.45,
  "status": "fail",
  "issues_detected": [
    "Background removal incomplete (left edge has artifacts)",
    "Product edges are blurry"
  ],
  "recommendation": "retry_or_refund"
}
```

---

### 3.3 Panopticon Daily Fraud Scan
**Priority:** 🟡 HIGH (MVP)
**Trigger:** Cron (daily at 2am UTC)

**Purpose:** Detect gaming/fraud in token economy

**Processing Steps:**
1. Query database for suspicious patterns (last 24 hours):
   - UUR (Unique Usage Ratio) < 0.05 (same users using preset repeatedly)
   - IP collision (multiple accounts from same IP using each other's presets)
   - Credit circularity (users sending credits back and forth)
   - Rapid preset creation (>10 presets/day from one user)
   - Zero-usage presets marked public (spam)
2. Calculate fraud scores
3. For high-risk accounts:
   - Flag in database (integrity_flag = true)
   - Pause token payouts
   - Send alert to admin dashboard
4. Generate daily fraud report

**Output:**
```json
{
  "scan_date": "2024-12-18",
  "accounts_flagged": 3,
  "patterns_detected": [
    {
      "user_id": "uuid",
      "issue": "UUR_LOW",
      "uur_score": 0.03,
      "preset_id": "uuid",
      "recommendation": "investigate"
    }
  ],
  "report_url": "https://s3.../fraud-report-2024-12-18.json"
}
```

---

### 3.4 Token Payout Processor
**Priority:** 🟡 HIGH (MVP)
**Trigger:** Cron (weekly on Fridays) OR Manual (user-initiated withdrawal)

**Purpose:** Convert tokens → USD via Stripe Connect

**Input (Manual Trigger):**
```json
{
  "user_id": "uuid",
  "withdrawal_amount_tokens": 200,
  "payout_method": "stripe_connect"
}
```

**Processing Steps:**
1. Validate user has ≥100 tokens ($10 minimum)
2. Check integrity_flag (if true, reject payout)
3. Calculate USD amount (100 tokens = $10)
4. Call Stripe Connect API to initiate payout
5. Deduct tokens from user balance
6. Log transaction in payouts table
7. Update user's total_earned counter
8. Send confirmation email

**Output:**
```json
{
  "payout_id": "uuid",
  "user_id": "uuid",
  "tokens_withdrawn": 200,
  "usd_amount": 20.00,
  "stripe_payout_id": "po_xxxxx",
  "status": "pending", // becomes "paid" in 2-3 days
  "estimated_arrival": "2024-12-21"
}
```

---

## 👤 Category 4: User & Token Management

### 4.1 Job Orchestrator (Master Workflow)
**Priority:** 🔴 CRITICAL (MVP - Core Logic)
**Trigger:** Webhook (POST /webhook/create-job)

**Purpose:** Main entry point for all job creation, orchestrates sub-workflows

**Input:**
```json
{
  "user_id": "uuid",
  "name": "Product Launch v2",
  "original_image_url": "https://s3.../upload.jpg",
  "reference_image_url": "https://s3.../reference.jpg" (optional),
  "preset_id": "uuid" (optional),
  "treatments": [
    {
      "type": "background_removal",
      "config": {}
    },
    {
      "type": "upscale",
      "config": {
        "target_resolution": "4K"
      }
    }
  ],
  "marketplaces": ["amazon", "etsy"],
  "custom_prompt": "Add golden hour lighting" (optional)
}
```

**Processing Steps:**
1. Validate user has sufficient credits
2. Calculate total cost (sum of all treatments + marketplace formatters)
3. Deduct credits from user balance
4. Create job record in database (status: "processing")
5. **For each treatment** (in sequence or parallel based on dependencies):
   - Call appropriate treatment workflow
   - Wait for completion
   - Run Lifeguard audit
   - If fail: Retry once, then refund
   - Store asset URL
6. **For each marketplace:**
   - Call formatter workflow
   - Generate download package
7. If preset_id used:
   - Distribute 10 tokens to preset creator (7 to creator, 3 to platform)
   - Log transaction
   - Increment preset usage counter
8. Update job status to "completed"
9. Return all asset URLs

**Output:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "credits_charged": 25,
  "processing_time_seconds": 47,
  "assets": {
    "treatments": [
      {
        "type": "background_removal",
        "url": "https://s3.../bg-removed.png",
        "quality_score": 0.92
      },
      {
        "type": "upscale",
        "url": "https://s3.../upscaled-4k.jpg",
        "quality_score": 0.88
      }
    ],
    "marketplaces": {
      "amazon": {
        "package_url": "https://s3.../amazon-package.zip",
        "preview_url": "https://s3.../amazon-preview.jpg"
      },
      "etsy": {
        "package_url": "https://s3.../etsy-package.zip",
        "preview_url": "https://s3.../etsy-preview.jpg"
      }
    }
  },
  "token_distribution": {
    "preset_creator": "user_xyz",
    "tokens_earned": 7,
    "platform_fee": 3
  }
}
```

**Critical:** This is the main workflow that ties everything together

---

### 4.2 Credit Top-Up Handler
**Priority:** 🔴 CRITICAL (MVP)
**Trigger:** Webhook from Stripe (payment_intent.succeeded)

**Purpose:** Add credits to user account after successful payment

**Input (from Stripe webhook):**
```json
{
  "stripe_event_id": "evt_xxxxx",
  "payment_intent_id": "pi_xxxxx",
  "user_id": "uuid",
  "amount_usd": 39.99,
  "credit_package": "500_credits"
}
```

**Processing Steps:**
1. Verify Stripe webhook signature (security)
2. Check if event already processed (idempotency)
3. Add credits to user balance in database
4. Log transaction in transactions table
5. Send confirmation email
6. Return success

**Output:**
```json
{
  "user_id": "uuid",
  "credits_added": 500,
  "new_balance": 650,
  "transaction_id": "uuid"
}
```

---

### 4.3 Subscription Manager
**Priority:** 🟡 HIGH (MVP)
**Trigger:** Webhook from Stripe (subscription.created, subscription.updated, subscription.deleted)

**Purpose:** Manage user subscription tier and monthly credit allocation

**Input (from Stripe):**
```json
{
  "stripe_event_id": "evt_xxxxx",
  "subscription_id": "sub_xxxxx",
  "user_id": "uuid",
  "tier": "pro_maker", // or "starter", "studio"
  "status": "active" // or "canceled", "past_due"
}
```

**Processing Steps:**
1. Verify webhook signature
2. Update user tier in database
3. If new subscription: Add monthly credits (Starter: 100, Pro: 500)
4. If subscription canceled: Set tier to "Starter" at end of billing period
5. Log subscription change
6. Send email notification

**Output:**
```json
{
  "user_id": "uuid",
  "tier": "pro_maker",
  "monthly_credits": 500,
  "next_billing_date": "2025-01-18"
}
```

---

## 📊 Workflow Summary

### By Priority:

**🔴 CRITICAL (MVP - Build First):**
1. Job Orchestrator (master workflow)
2. Background Removal
3. High-Res Upscale
4. Lifestyle Scene Generation
5. Preset Style Extraction
6. Lifeguard Quality Audit
7. Amazon Formatter
8. Etsy Formatter
9. Poshmark Formatter
10. Credit Top-Up Handler
11. Subscription Manager

**Total MVP Workflows: 11**

---

**🟡 HIGH (Phase 2):**
1. Panopticon Fraud Scan
2. Token Payout Processor
3. Shopify Formatter

**Total Phase 2 Workflows: 3**

---

**🟢 MEDIUM/LOW (Phase 3):**
1. Animated Spin
2. Hand Model Generation
3. Convert to SVG
4. eBay Formatter

**Total Phase 3 Workflows: 4**

---

## 🎯 Recommended Build Order

### Week 1: Foundation (3 workflows)
1. **Job Orchestrator** - Core logic, test harness
2. **Background Removal** - Simplest treatment, validate AI integration
3. **Lifeguard Quality Audit** - Quality control from day 1

### Week 2: Core Treatments (3 workflows)
4. **High-Res Upscale** - Tier 2 service integration
5. **Lifestyle Scene Generation** - Preset integration test
6. **Preset Style Extraction** - Enable network effect

### Week 3: Marketplace & Payments (5 workflows)
7. **Amazon Formatter**
8. **Etsy Formatter**
9. **Poshmark Formatter**
10. **Credit Top-Up Handler**
11. **Subscription Manager**

**Total MVP Build Time: 3 weeks**

---

## 💰 Cost Model Per Workflow

| Workflow | AI Service | Cost/Request | Credits |
|----------|-----------|--------------|---------|
| Background Removal | Gemini Flash | $0.001 | 1 |
| Upscale | GPT-Image | $0.04 | 4 |
| Lifestyle Scene | GPT-Image | $0.04 | 4 |
| Animated Spin | Runway Gen-3 | $0.30 | 30 |
| Hand Model | GPT-Image | $0.04 | 4 |
| SVG Convert | Gemini Flash | $0.002 | 1 |
| Preset Extraction | Gemini Flash | $0.002 | 0 (free) |
| Lifeguard Audit | Flash 3 | $0.0001 | 0 (free) |
| Formatters | N/A | $0 | 0 (free) |

**Typical Job Cost:**
- Basic (bg removal + 1 formatter): 1 credit = $0.10
- Standard (bg removal + upscale + 2 formatters): 5 credits = $0.50
- Premium (all treatments + 3 formatters): 40+ credits = $4.00

**Margins:**
- User pays $0.10/credit
- Actual COGS: $0.001-0.30/treatment
- **Target margin: 60%+** ✅

---

## 🔧 Technical Specifications

### All Workflows Must Include:

1. **Environment Variables (Required):**
   - `GOOGLE_AI_API_KEY` (Gemini)
   - `OPENROUTER_API_KEY` (GPT-Image, Runway)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `AWS_S3_BUCKET`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `STRIPE_WEBHOOK_SECRET`

2. **Error Handling:**
   - 3 retry attempts with exponential backoff
   - Timeout: 30s (Tier 1), 120s (Tier 2/3)
   - Auto-refund on persistent failure
   - Log all errors to monitoring

3. **Monitoring:**
   - Log execution time
   - Log cost per request
   - Log quality scores
   - Alert on failures >5%

4. **Security:**
   - Never log API keys
   - Validate all webhook signatures (Stripe)
   - Sanitize user inputs
   - Use authentication on all webhooks

---

## 📋 Next Steps

1. **Review this list** - Confirm workflows match product vision
2. **Prioritize** - Adjust build order if needed
3. **Write detailed specs** - Create `/docs/n8n_WORKFLOW_SPECS/[workflow-name].md` for each
4. **Generate JSON** - Use n8n-workflow-builder skill to create actual workflow files
5. **Test in n8n** - Import and test each workflow
6. **Deploy** - Move to production n8n instance

---

Last Updated: December 18, 2024
