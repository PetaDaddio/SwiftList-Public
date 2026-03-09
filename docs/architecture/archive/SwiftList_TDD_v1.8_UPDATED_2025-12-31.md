# SwiftList Technical Design Document (TDD) v1.8
## Updated: December 31, 2025
## Target MVP Launch: January 15, 2026 (15 Days)

---

## EXECUTIVE SUMMARY

SwiftList is an AI-powered SaaS platform for the maker economy (jewelry, fashion, general goods sellers on eBay, Etsy, Amazon). We transform basic product photos into marketplace-optimized assets across multiple categories using 27 specialized n8n workflows orchestrated on AWS infrastructure.

**Key Business Metrics**:
- Average Margin: 85%+
- Monthly Infrastructure Cost: $139
- Credit Economy: 1 credit = $0.05 USD
- Target LTV:CAC: 460:1
- MVP Launch: January 15, 2026

**Critical Updates (December 31, 2025)**:
- ✅ Infrastructure: Active-Passive failover approved ($41/month)
- ✅ Free Trial: 200 credits (150 base + 50 gamified bonuses)
- ✅ AI Models: 3-tier quality framework approved
- ✅ Royalties: ONLY available on mid/upper subscription tiers
- ✅ Creator Tiers: Bronze/Silver/Gold/Platinum system required
- ✅ A/B Testing: Custom build ($0 budget for MVP)
- 🎯 Launch Partner: eBay Head of Product + power user test group

---

## TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure Decisions](#infrastructure-decisions)
3. [Credit & Subscription System](#credit--subscription-system)
4. [Royalty System (UPDATED)](#royalty-system-updated)
5. [Free Trial Strategy](#free-trial-strategy)
6. [AI Model Quality Tiers](#ai-model-quality-tiers)
7. [All 27 n8n Workflows](#all-27-n8n-workflows)
8. [A/B Testing Framework](#ab-testing-framework)
9. [KPI Dashboard](#kpi-dashboard)
10. [Rate Limits & Anti-Abuse](#rate-limits--anti-abuse)
11. [Resilience & Failover](#resilience--failover)
12. [MVP Roadmap](#mvp-roadmap)
13. [Marketing GTM Strategy](#marketing-gtm-strategy)

---

## ARCHITECTURE OVERVIEW

### AWS 3-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER LAYER                               │
│  React SPA (AWS Amplify) - Supabase Auth - Stripe Checkout  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  ORCHESTRATION LAYER                         │
│  n8n (AWS Lightsail Docker) - Active-Passive Failover       │
│  Route 53 Health Checks - <60s Recovery Time                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                               │
│  PostgreSQL (RDS) - S3 Intelligent-Tiering - pgvector       │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Cost | Purpose |
|-------|-----------|------|---------|
| Frontend | AWS Amplify + React | ~$5/month | Hosting, CDN, CI/CD |
| Auth | Supabase Auth | $0 (free tier) | User authentication |
| Orchestration | n8n (Lightsail) | $20/month (2× instances) | Workflow engine |
| Database | PostgreSQL (RDS) | $15/month | Structured data |
| Storage | S3 Intelligent-Tiering | ~$10/month | Asset storage |
| Payments | Stripe | 2.9% + $0.30/txn | Billing & subscriptions |
| Email | SendGrid | $0 (12K/month free) | Transactional emails |
| Monitoring | CloudWatch | ~$5/month | Logs, metrics, alarms |
| Failover | Route 53 | $1/month | Health checks |
| **TOTAL** | | **$56/month** | Infrastructure only |

**Note**: n8n confirmed hosted on AWS Lightsail to keep costs lower (not n8n Cloud)

---

## INFRASTRUCTURE DECISIONS

### 1. Active-Passive Failover Architecture (APPROVED)

**Decision**: Option A - Active-Passive for MVP

**Implementation**:
```
Primary Instance:
- AWS Lightsail $10/month (2 vCPU, 4GB RAM, 80GB SSD)
- Running: n8n Docker container + all 27 workflows
- Status: ACTIVE (handles all traffic)

Secondary Instance:
- AWS Lightsail $10/month (identical specs)
- Running: n8n Docker container + all 27 workflows
- Status: STANDBY (stopped, starts on failover)

Health Check:
- AWS Route 53 health check every 30 seconds
- Monitors: /healthz endpoint on primary
- Failover trigger: 2 consecutive failures (60 seconds)
- DNS TTL: 60 seconds
- Total recovery time: <60 seconds

Cost: $41/month ($20 instances + $1 Route 53 + $20 existing)
Uptime SLA: 99.9% (projected)
```

**Upgrade Path**: If traffic exceeds 2,000 jobs/day, migrate to Active-Active with AWS ALB ($98/month)

### 2. Workflow Backup Strategy

**Daily Backups** (MVP → 100 users):
```bash
# Runs at 2 AM UTC daily
n8n export:workflow --all --output=/backups/workflows_$(date +%Y%m%d).json
git add .
git commit -m "Daily workflow backup"
git push origin main

# Retention: 90 days
find /backups -name "workflows_*.json" -mtime +90 -delete
```

**6-Hour Backups** (100+ users):
```bash
# Runs at 00:00, 06:00, 12:00, 18:00 UTC
n8n export:workflow --all --output=/backups/workflows_$(date +%Y%m%d_%H%M).json
```

**Disaster Recovery**:
- Quarterly DR drills (restore from backup, verify all 27 workflows)
- 1-click restore script for individual workflows
- Slack alert if export fails

---

## CREDIT & SUBSCRIPTION SYSTEM

### Credit Economy

**Base Unit**: 1 Credit = $0.05 USD

### Subscription Tiers

| Tier | Price/Month | Credits Included | Rollover | Royalty Eligible |
|------|-------------|------------------|----------|------------------|
| **Free Trial** | $0 | 200 (7-day expiry) | No | ❌ No |
| **Starter** | $17 | 350 | Yes (1 month) | ❌ No |
| **Pro** | $32 | 700 | Yes (3 months) | ✅ **Yes** |
| **Enterprise** | $57 | 1,250 | Yes (6 months) | ✅ **Yes** |

**CRITICAL UPDATE**: Royalties ONLY available on Pro ($32) and Enterprise ($57) tiers. Free trial and Starter tier users CANNOT earn royalties from presets.

### Credit Top-Up Pricing

| Package | Credits | Price | Bonus | Effective Price/Credit |
|---------|---------|-------|-------|----------------------|
| Starter Pack | 100 | $5 | - | $0.05 |
| Value Pack | 250 | $11.25 | +10% | $0.045 |
| Pro Pack | 500 | $21 | +20% | $0.042 |
| Bulk Pack | 1,000 | $40 | +25% | $0.040 |

---

## ROYALTY SYSTEM (UPDATED)

### Eligibility Requirements

**NEW RULE**: Users must be on Pro ($32) or Enterprise ($57) tier to:
1. Mark presets as "Public"
2. Earn royalties when others use their presets
3. Appear in preset marketplace discovery

**Rationale**: Prevents free tier abuse, ensures all creators are paying customers, increases ARPU

### Creator Tier System (NEW)

**Badge System**: Users earn tier badges based on preset performance

```
┌──────────────────────────────────────────────────────────┐
│  BRONZE CREATOR                                           │
│  Requirements: 0-100 preset uses, Pro tier subscriber     │
│  Earning Cap: 1,000 credits/month ($50)                   │
│  Badge Color: #CD7F32                                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  SILVER CREATOR                                           │
│  Requirements: 101-500 preset uses, Pro tier subscriber   │
│  Earning Cap: 2,500 credits/month ($125)                  │
│  Badge Color: #C0C0C0                                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  GOLD CREATOR                                             │
│  Requirements: 501-2,000 preset uses, Pro tier subscriber │
│  Earning Cap: 5,000 credits/month ($250)                  │
│  Badge Color: #FFD700                                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  PLATINUM CREATOR                                         │
│  Requirements: 2,001+ preset uses, Enterprise tier        │
│  Earning Cap: 10,000 credits/month ($500)                 │
│  Badge Color: #E5E4E2                                     │
└──────────────────────────────────────────────────────────┘
```

### Royalty Mechanics

**Base Royalty**: 1 credit per preset use (surcharge on top of job cost)

**Example**:
- User runs WF-08 (Simplify BG): Base cost 10 credits
- Uses public preset by Gold Creator: +1 credit surcharge
- Total cost to user: 11 credits
- Creator earns: 1 credit royalty
- SwiftList nets: 10 credits

**Spend-to-Earn Requirement** (NEW):
- Must spend ≥100 credits in last 90 days to earn royalties
- Prevents "earn-only" users who never buy credits
- Ensures all creators remain paying customers

**Overflow to Growth Pool**:
- Earnings beyond tier cap → Growth Pool
- Used for: Referral bonuses, free trial subsidies, "Preset of the Month" contests

### Anti-Gaming Protocols

**UUR Detection** (Unique Usage Ratio):
```sql
-- Flags wash trading when <5% unique users
SELECT creator_id, preset_id,
       unique_users_count::float / NULLIF(usage_count, 0) as UUR
FROM presets
WHERE is_public = true
  AND usage_count > 100
  AND unique_users_count::float / usage_count < 0.05;
```

**IP Collision Detection**:
```sql
-- Freezes accounts when >5 from same IP in 1 hour
SELECT ip_address, COUNT(DISTINCT user_id) as account_count
FROM transactions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(DISTINCT user_id) > 5;
```

**Credit Circularity Detection**:
```sql
-- Detects reciprocal preset usage loops
SELECT
  p1.creator_id as creator_a,
  p2.creator_id as creator_b,
  COUNT(*) as reciprocal_uses
FROM jobs j1
JOIN presets p1 ON j1.preset_id = p1.preset_id
JOIN jobs j2 ON j2.user_id = p1.creator_id
JOIN presets p2 ON j2.preset_id = p2.preset_id
WHERE p2.creator_id = j1.user_id
  AND p1.creator_id != p2.creator_id
GROUP BY p1.creator_id, p2.creator_id
HAVING COUNT(*) > 10;
```

**Quality Score**:
```sql
CREATE VIEW preset_quality AS
SELECT
  preset_id,
  usage_count,
  unique_users_count,
  (unique_users_count::float / (usage_count / 100.0)) as quality_score
FROM presets
WHERE usage_count > 100;
```

---

## FREE TRIAL STRATEGY

### Allocation: 200 Credits (APPROVED)

**Base Credits**: 150 credits on signup

**Gamified Bonuses** (50 credits total):
- ✅ Upload first product: +10 credits
- ✅ Generate first eBay listing: +10 credits
- ✅ Create first preset: +10 credits
- ✅ Share on social media: +10 credits
- ✅ Invite a friend: +10 credits

**Expiration**: 7 days from signup

**Expected Usage**:
- 200 credits = ~10-20 full workflow outputs
- Average user completes 40% of bonuses (~170 credits total)
- Enough to test multi-marketplace optimization

### COGS Analysis

**Per Trial User**:
```
30% complete all bonuses (200 credits):
  20 workflow runs × $0.02 avg = $0.40

50% complete some bonuses (~170 credits):
  17 workflow runs × $0.015 avg = $0.30

20% barely engage (150 credits):
  7 workflow runs × $0.015 avg = $0.10

Weighted Average COGS: $0.29 per trial user
```

**For 100 Trial Users**: $29 total COGS

**Expected Conversion**: 22% (vs 3-5% industry average)

**Revenue from 22 conversions**:
- 22 users × $17/month avg = $374/month
- Annual revenue: $4,488
- LTV (12 months): $4,488
- CAC: $29 / 0.22 = $132
- **LTV:CAC = 34:1** (excellent)

---

## AI MODEL QUALITY TIERS

### Tier 1: Customer-Facing Outputs (HIGH QUALITY REQUIRED)

**Rule**: Users see these outputs publicly - MUST be excellent quality

**Model**: Gemini 3 Flash OR Claude 3.5 Sonnet

**Workflows**:
- ✅ WF-02: Jewelry Precision Engine
- ✅ WF-03: Fashion & Apparel Engine
- ✅ WF-04: Glass & Refraction Engine
- ✅ WF-05: Furniture & Spatial Engine
- ✅ WF-06: General Goods Engine
- ✅ WF-10: Product Description Generator
- ✅ WF-11: Twitter Post Generator
- ✅ WF-12: Instagram Post Generator
- ✅ WF-13: Facebook Post Generator

**Cost Impact**: Higher API costs justified by conversion quality

### Tier 2: Internal Logic (MEDIUM QUALITY OK)

**Rule**: Users never see these - just classification/routing

**Model**: Gemini 2.0 Flash Experimental (FREE) OR Gemini 3 Flash

**Workflows**:
- ✅ WF-01: The Decider (classification only)
- ✅ WF-17: Generate Preset (internal embedding)
- ✅ WF-24: Lifeguard (monitoring/refunds)

**Cost Impact**: $0 using free tier (1,500 requests/day limit)

### Tier 3: Simple Transformations (LOCAL PROCESSING)

**Rule**: No AI needed - just image manipulation

**Model**: GraphicsMagick, Sharp.js, local tools

**Workflows**:
- ✅ WF-08: Simplify BG (hex color force)
- ✅ WF-23: Asset Optimizer (compression)
- ✅ WF-25: eBay Compliance (image resize)

**Cost Impact**: $0 API costs, minimal compute

---

## ALL 27 N8N WORKFLOWS

### Phase 1: Core Infrastructure (CRITICAL - Build First)

#### WF-01: The Decider (Orchestrator)
- **Function**: Routes all jobs to specialized engines
- **Model**: Gemini 2.0 Flash (FREE) → fallback Claude 3.5 Haiku
- **Input**: Product image + metadata
- **Output**: JSON {"category": "jewelry", "risk": "high", "route": "WF-02"}
- **Cost**: $0.001 (or $0 with free tier)
- **Credits**: N/A (internal routing)
- **Priority**: **CRITICAL - BUILD FIRST**

#### WF-26: Billing & Top-Up
- **Function**: Stripe webhook → update credit balance
- **Integration**: Stripe Payment Intent
- **Database**: UPDATE profiles SET credit_balance = credit_balance + amount
- **Cost**: $0.00
- **Priority**: **CRITICAL**

#### WF-27: Referral Engine
- **Function**: Award bonus credits to referrer + referee
- **Trigger**: User signup with referral code
- **Bonus**: +10 credits to both parties
- **Source**: Growth Pool
- **Cost**: $0.00
- **Priority**: **CRITICAL FOR GROWTH**

#### WF-07: Background Removal
- **Function**: Remove background, create transparent PNG
- **Model**: Photoroom API → fallback Remove.bg → Cloudinary
- **Output**: 1500×1500px transparent PNG
- **Cost**: $0.02
- **Credits**: 5 credits ($0.25 revenue)
- **Margin**: 80%
- **Priority**: **MOST USED WORKFLOW**

---

### Phase 2: Essential Product Engines

#### WF-06: General Goods Engine
- **Function**: Standard background replacement
- **Model**: Stability AI SDXL 1024
- **Use Case**: Handles majority of products (non-specialty)
- **Cost**: $0.015
- **Credits**: 10 credits
- **Priority**: **HIGH - CORE VALUE ENGINE**

#### WF-08: Simplify BG (White/Grey)
- **Function**: Force hex color background (local)
- **Tool**: GraphicsMagick
- **Output**: 4 image assets + metadata
- **Cost**: $0.00 (API) / $0.052 (COGS w/ royalty)
- **Credits**: 10 credits
- **Margin**: 89.6%
- **Priority**: **HIGH MARGIN**

#### WF-02: Jewelry Precision Engine
- **Function**: 3D bounding box + specular map for metallic products
- **Model 1**: Gemini 3 Flash (geometry analysis)
- **Model 2**: Replicate Nano Banana SDXL (render)
- **Cost**: $0.052
- **Credits**: 12 credits
- **Priority**: **SPECIALTY - HIGH VALUE**

#### WF-03: Fashion & Apparel Engine
- **Function**: Human model generation with fabric drape physics
- **Model**: RunwayML Act-Two
- **Cost**: $0.12
- **Credits**: 15 credits
- **Priority**: **SPECIALTY - FASHION**

#### WF-04: Glass & Refraction Engine
- **Function**: Ray-trace transparency masking
- **Model**: OpenAI DALL-E 3 OR GPT-4o In-Painting
- **Cost**: $0.04
- **Credits**: 10 credits
- **Priority**: **SPECIALTY - GLASS**

#### WF-05: Furniture & Spatial Engine
- **Function**: Floor plane detection, perspective correction
- **Model**: Gemini 3 Flash
- **Cost**: $0.035
- **Credits**: 12 credits
- **Priority**: **SPECIALTY - FURNITURE**

---

### Phase 3: Content Generation Suite

#### WF-10: Product Description Generator
- **Function**: SEO title + 5 bullet points
- **Model**: Gemini 2.0 Flash (FREE) OR Gemini 3 Flash
- **Cost**: $0.001
- **Credits**: 5 credits
- **Margin**: 99.6% (HIGHEST)
- **Priority**: **MOST PROFITABLE**

#### WF-11: Twitter Post Generator
- **Function**: 280-char tweet + thread + hashtags
- **Model**: Claude 3.5 Sonnet
- **Cost**: $0.053
- **Credits**: 10 credits
- **Margin**: 89.4%

#### WF-12: Instagram Post Generator
- **Function**: IG caption + first comment tags
- **Model**: Claude 3.5 Sonnet
- **Cost**: $0.053
- **Credits**: 10 credits
- **Margin**: 89.4%

#### WF-13: Facebook Post Generator
- **Function**: Long-form storytelling copy
- **Model**: Claude 3.5 Sonnet
- **Cost**: $0.053
- **Credits**: 10 credits
- **Margin**: 89.4%

#### WF-20: SEO Blog Post
- **Function**: 1,500-word article with H-tags
- **Model**: Claude 3.5 Sonnet (OR Gemini 3 Flash - TBD)
- **Cost**: $0.052
- **Credits**: 10 credits
- **Margin**: 89.6%
- **Note**: Model discrepancy in docs - needs resolution

---

### Phase 4: Image Enhancement Tools

#### WF-09: Lifestyle Setting
- **Function**: In-paint product in lifestyle context (table, room, etc)
- **Model**: Flux.1 Pro
- **Cost**: $0.052
- **Credits**: 10 credits
- **Margin**: 89.6%
- **Includes**: Preset ID storage in pgvector

#### WF-14: High-Res Upscale
- **Function**: 4× detail hallucination enhancement
- **Model**: Magnific AI OR Stability Fast (discrepancy in docs)
- **Cost**: $0.02 (COGS) / $0.05 (Build)
- **Credits**: 10 credits
- **Margin**: 96%
- **Note**: Clarify Magnific vs Stability

#### WF-19: Product Collage
- **Function**: Smart grid layout of 3-5 images
- **Tool**: Sharp.js (local Node.js)
- **Cost**: $0.005 (Build) / $0.052 (COGS)
- **Credits**: 20 credits
- **Margin**: 94.8%

#### WF-15: Color Variants
- **Function**: Generate 3-5 color variants of product
- **Model**: Stable Diffusion
- **Cost**: $0.075
- **Credits**: 15 credits

#### WF-16: 360° Spin
- **Function**: Multi-angle product rotation
- **Model**: Stability 3D
- **Cost**: $0.15
- **Credits**: 25 credits

---

### Phase 5: Advanced Features

#### WF-17: Generate Preset
- **Function**: Convert user job → reusable preset with embedding
- **Model**: Gemini 2.0 Flash (FREE) for embedding
- **Storage**: pgvector in PostgreSQL
- **Cost**: $0.00
- **Credits**: Free feature for Pro+ users

#### WF-18: Animation (Short Video)
- **Function**: 3-5 second product animation
- **Model**: Runway Gen-3 → fallback Luma Dream Machine → Pika Labs
- **Cost**: $0.25
- **Credits**: 40 credits

#### WF-21: AI Model Swap
- **Function**: Place product on AI-generated human model
- **Model**: Fal.ai Fashion ControlNet
- **Cost**: $0.08
- **Credits**: 15 credits

#### WF-22: Voice-to-Description
- **Function**: Voice note → product description
- **Model**: OpenAI Whisper → GPT-4o
- **Cost**: $0.015
- **Credits**: 5 credits

---

### Phase 6: Operations & Monitoring

#### WF-23: Asset Optimizer
- **Function**: Compress images for marketplace specs
- **Tool**: Sharp.js compression
- **Cost**: $0.00
- **Credits**: Free (post-processing)

#### WF-24: Lifeguard (Auto-Refund)
- **Function**: Detect failed jobs, issue credit refunds
- **Model**: Gemini 2.0 Flash (FREE) for analysis
- **Trigger**: Runs every 5 minutes
- **Action**: Auto-refund + log to system_audits
- **Cost**: $0.00

#### WF-25: eBay/Etsy/Amazon Compliance
- **Function**: Resize/format for marketplace requirements
- **Tool**: GraphicsMagick
- **Cost**: $0.00
- **Credits**: Free (post-processing)

---

## A/B TESTING FRAMEWORK

### Decision: Custom Build ($0 Budget)

**Rationale**: No budget for SaaS platforms ($500+/month), build lean custom solution

### Architecture

```javascript
// Feature flags table
CREATE TABLE public.ab_tests (
  test_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_name TEXT NOT NULL,
  variants JSONB NOT NULL, -- {"A": 50, "B": 50}
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'draft', -- draft, active, paused, completed
  target_metric TEXT, -- conversion_rate, credit_burn, preset_created
  sample_size INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

// User variant assignments
CREATE TABLE public.ab_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES public.ab_tests(test_id),
  user_id UUID REFERENCES public.profiles(user_id),
  variant TEXT NOT NULL, -- "A" or "B" or "C"
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(test_id, user_id)
);

// Event tracking
CREATE TABLE public.ab_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES public.ab_assignments(assignment_id),
  event_type TEXT NOT NULL, -- signup, first_job, subscription, preset_created
  event_value NUMERIC, -- revenue, credits spent, etc
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### React Component

```javascript
// Custom hook: useABTest
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useABTest(testName) {
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    async function assignVariant() {
      const { data: user } = await supabase.auth.getUser();

      // Check if already assigned
      const { data: existing } = await supabase
        .from('ab_assignments')
        .select('variant')
        .eq('test_id', testName)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        setVariant(existing.variant);
        return;
      }

      // Assign new variant (50/50 split)
      const newVariant = Math.random() < 0.5 ? 'A' : 'B';

      await supabase.from('ab_assignments').insert({
        test_id: testName,
        user_id: user.id,
        variant: newVariant
      });

      setVariant(newVariant);
    }

    assignVariant();
  }, [testName]);

  return variant;
}
```

### Usage Example

```javascript
// In SignupFlow.jsx
import { useABTest } from './hooks/useABTest';

export function SignupCTA() {
  const variant = useABTest('signup_cta_test');

  if (variant === 'A') {
    return <button>Start Free Trial</button>;
  }

  if (variant === 'B') {
    return <button>Get 200 Free Credits</button>;
  }

  return null; // Loading
}
```

### Priority Test Roadmap (Per User Request)

**Week 1-2**:
1. ✅ Signup flow CTAs
   - Variant A: "Start Free Trial"
   - Variant B: "Get 200 Free Credits"
   - Variant C: "Try SwiftList Free"
   - Metric: Signup completion rate

2. ✅ Pricing page copy
   - Variant A: "Most Popular" badge on Pro tier
   - Variant B: "Best Value" badge on Pro tier
   - Variant C: No badge
   - Metric: Pro tier selection rate

**Week 3-4**:
3. ✅ Preset discovery page layout
   - Variant A: Grid view (default)
   - Variant B: List view with previews
   - Variant C: Masonry layout
   - Metric: Preset click-through rate

4. ✅ Email subject lines
   - Test: "Your SwiftList credits expire in 3 days" vs "Don't lose your 50 credits"
   - Metric: Email open rate

**Month 2**:
5. ✅ Social share prompts
   - Variant A: "+10 credits for sharing"
   - Variant B: "Help a friend, get 10 credits"
   - Metric: Share completion rate

### Analytics Dashboard

**Simple SQL Queries**:
```sql
-- A/B test performance
SELECT
  t.test_name,
  a.variant,
  COUNT(DISTINCT a.user_id) as users,
  COUNT(e.event_id) FILTER (WHERE e.event_type = 'conversion') as conversions,
  (COUNT(e.event_id) FILTER (WHERE e.event_type = 'conversion')::float /
   COUNT(DISTINCT a.user_id)) as conversion_rate
FROM ab_tests t
JOIN ab_assignments a ON t.test_id = a.test_id
LEFT JOIN ab_events e ON a.assignment_id = e.assignment_id
WHERE t.status = 'active'
GROUP BY t.test_name, a.variant;
```

**Cost**: $0 (uses existing PostgreSQL)

---

## KPI DASHBOARD

### Decision: TBD - Awaiting Google Drive Import

User has comprehensive KPI list on Google Drive to be imported. Will update this section upon import.

### Confirmed Top Priority KPIs

Based on conversation, these are critical daily metrics:

1. **Revenue Metrics**:
   - MRR (Monthly Recurring Revenue)
   - Credit purchases (one-time revenue)
   - ARPU (Average Revenue Per User)

2. **User Metrics**:
   - DAU/MAU (Daily/Monthly Active Users)
   - Free trial → Paid conversion rate
   - Churn rate (monthly)

3. **Engagement Metrics**:
   - Jobs per user per day
   - Presets created (total & per user)
   - Preset usage (viral coefficient)

4. **Network Effect Metrics**:
   - Public preset usage rate
   - Top performing presets
   - Creator tier distribution (Bronze/Silver/Gold/Platinum)

5. **Financial Health**:
   - LTV:CAC ratio
   - API cost per job (actual COGS)
   - Gross margin %

6. **Operations**:
   - Flagged wash trading incidents
   - Lifeguard refunds issued
   - System uptime %

### Dashboard Technology: TBD

Options under consideration:
- Custom React dashboard (full control, more work)
- Retool (~$10/user/month, rapid build)
- PostHog (free tier, analytics focused)

**Budget**: $0 for MVP, allocate funds after revenue

---

## RATE LIMITS & ANTI-ABUSE

### Status: Requires Further Discussion

User requested "side discussion to explore further" - parking for follow-up.

### Proposed Approach (Draft)

**Option 1: Credit-Based Throttling Only**
- No hard rate limits
- Users can run as many jobs as they have credits
- Abuse prevention through economics

**Option 2: Velocity Caps**
```
Free Tier: 10 jobs/hour, 50 jobs/day
Starter: 20 jobs/hour, 100 jobs/day
Pro: 50 jobs/hour, 250 jobs/day
Enterprise: 100 jobs/hour, 500 jobs/day
```

**Recommendation**: Start with Option 1 for MVP, add Option 2 if abuse detected

---

## RESILIENCE & FAILOVER

### Multi-Provider Fallback Chains (APPROVED)

#### WF-01: The Decider
- Primary: Gemini 3 Flash
- Fallback 1: Claude 3.5 Haiku
- Fallback 2: GPT-4o-mini
- Trigger: <90% success rate in last hour

#### WF-02: Jewelry Precision Engine
- Primary: Gemini 3 Flash
- Fallback 1: Claude 3.5 Sonnet
- Fallback 2: GPT-4o
- Trigger: <90% success rate

#### WF-07: Background Removal
- Primary: Photoroom
- Fallback 1: Remove.bg
- Fallback 2: Cloudinary Background Removal
- Trigger: <90% success rate

#### WF-10: Product Description
- Primary: Gemini 3 Flash
- Fallback 1: Claude 3.5 Haiku
- Fallback 2: GPT-4o-mini
- Trigger: <90% success rate

### Adapter Pattern Implementation

```javascript
// ai-provider-adapter.js
class AIProviderAdapter {
  constructor() {
    this.healthMetrics = new Map();
  }

  async generate(config) {
    const { task, input, providers, fallbackStrategy } = config;

    // Sort providers by health score
    const sortedProviders = providers.sort((a, b) => {
      const healthA = this.healthMetrics.get(a)?.successRate || 1;
      const healthB = this.healthMetrics.get(b)?.successRate || 1;
      return healthB - healthA;
    });

    for (const provider of sortedProviders) {
      try {
        console.log(`Attempting ${task} with ${provider}...`);

        const result = await this.callProvider(provider, input);

        if (result.success) {
          this.recordSuccess(provider);
          return result;
        }
      } catch (error) {
        console.error(`${provider} failed:`, error);
        this.recordFailure(provider);
        continue;
      }
    }

    throw new Error(`All AI providers failed for task: ${task}`);
  }

  async callProvider(provider, input) {
    switch (provider) {
      case 'gemini-3-flash':
        return await this.callGemini(input);
      case 'claude-3.5-haiku':
        return await this.callClaude(input);
      case 'gpt-4o-mini':
        return await this.callOpenAI(input);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  recordSuccess(provider) {
    const current = this.healthMetrics.get(provider) || {
      successRate: 1,
      recentAttempts: []
    };
    current.recentAttempts.push(true);
    this.updateHealthMetrics(provider, current);
  }

  recordFailure(provider) {
    const current = this.healthMetrics.get(provider) || {
      successRate: 1,
      recentAttempts: []
    };
    current.recentAttempts.push(false);
    this.updateHealthMetrics(provider, current);
  }

  updateHealthMetrics(provider, metrics) {
    // Keep last 100 attempts
    metrics.recentAttempts = metrics.recentAttempts.slice(-100);

    // Calculate success rate
    const successes = metrics.recentAttempts.filter(Boolean).length;
    metrics.successRate = successes / metrics.recentAttempts.length;

    this.healthMetrics.set(provider, metrics);

    // Auto-failover logic
    if (metrics.successRate < 0.90) {
      console.warn(`⚠️ ${provider} degraded (${(metrics.successRate * 100).toFixed(1)}% success rate)`);
    }
  }
}

// Usage in n8n workflows
const aiProvider = new AIProviderAdapter();

const result = await aiProvider.generate({
  task: 'jewelry_analysis',
  input: imageData,
  providers: ['gemini-3-flash', 'claude-3.5-sonnet', 'gpt-4o'],
  fallbackStrategy: 'sequential'
});
```

### Health Monitoring Dashboard

**Endpoint**: `/api/health/providers`

```json
{
  "gemini-3-flash": {
    "successRate": 0.95,
    "avgLatency": 2.3,
    "lastFailure": "2025-12-31T10:15:00Z",
    "status": "healthy"
  },
  "claude-3.5-haiku": {
    "successRate": 0.98,
    "avgLatency": 1.8,
    "lastFailure": "2025-12-30T14:22:00Z",
    "status": "healthy"
  },
  "photoroom": {
    "successRate": 0.87,
    "avgLatency": 3.5,
    "lastFailure": "2025-12-31T11:45:00Z",
    "status": "degraded"
  }
}
```

---

## MVP ROADMAP

### Target Launch: January 15, 2026 (15 Days)

### Week 1 (Jan 1-5): Infrastructure & Core Workflows

**Days 1-2: Infrastructure Setup**
- [ ] Deploy primary Lightsail instance (n8n Docker)
- [ ] Deploy secondary Lightsail instance (standby)
- [ ] Configure Route 53 health checks
- [ ] Set up RDS PostgreSQL with schema
- [ ] Configure S3 buckets for asset storage
- [ ] Deploy Amplify React app (basic shell)

**Days 3-5: Critical Workflows**
- [ ] WF-01: The Decider (with fallback logic)
- [ ] WF-26: Billing & Top-Up (Stripe integration)
- [ ] WF-07: Background Removal (Photoroom + fallbacks)
- [ ] WF-06: General Goods Engine (Stability AI)
- [ ] WF-24: Lifeguard (auto-refund system)

### Week 2 (Jan 6-12): Product Engines & Testing

**Days 6-8: Specialty Engines**
- [ ] WF-02: Jewelry Precision Engine
- [ ] WF-08: Simplify BG (GraphicsMagick)
- [ ] WF-10: Product Description Generator
- [ ] WF-17: Generate Preset (pgvector)
- [ ] WF-27: Referral Engine

**Days 9-10: Gemini API Testing**
- [ ] Test Gemini 2.0 Flash Experimental (free tier)
- [ ] Benchmark vs Gemini 3 Flash (paid)
- [ ] Verify 1,500/day rate limit
- [ ] Document quality differences
- [ ] Update workflow configs

**Days 11-12: Integration Testing**
- [ ] Test full job flow (upload → WF-01 → WF-06 → WF-08 → output)
- [ ] Test credit deductions and royalty payments
- [ ] Test Stripe webhooks
- [ ] Test failover (kill primary instance, verify recovery)
- [ ] Load test (100 concurrent jobs)

### Week 3 (Jan 13-15): Launch Prep & eBay Partnership

**Day 13: Dashboard & A/B Testing**
- [ ] Build simple admin dashboard (basic KPIs)
- [ ] Implement A/B test framework
- [ ] Set up first test (signup CTA)

**Day 14: eBay Power User Prep**
- [ ] Create private beta onboarding flow
- [ ] Prepare 500 credit welcome package for beta testers
- [ ] Set up dedicated Slack channel for feedback
- [ ] Build feedback collection form

**Day 15: LAUNCH**
- [ ] Final smoke tests
- [ ] Deploy to production
- [ ] Invite eBay head of product contact
- [ ] Invite power user test group
- [ ] Monitor dashboard for first 24 hours

### Post-Launch (Week 4+)

**Phase 2 Features** (Based on feedback):
- [ ] WF-03: Fashion Engine (if apparel sellers in beta)
- [ ] WF-04: Glass Engine (if needed)
- [ ] WF-11-13: Social media suite
- [ ] WF-09: Lifestyle settings
- [ ] Redo/refine system (incremental pricing)

**Phase 3 Features** (Month 2+):
- [ ] WF-18: Animation (video)
- [ ] WF-14: High-res upscale
- [ ] WF-15: Color variants
- [ ] Advanced A/B tests
- [ ] Marketing automation

---

## MARKETING GTM STRATEGY

### Status: Requires Comprehensive Planning

User requested "We need to think through the entire Marketing GTM strategy"

### Confirmed Launch Partner

**eBay Head of Product** (User's Contact):
- Personal connection willing to test
- Access to eBay power user group
- Potential for official eBay integration/partnership

### Viral Coefficient Measurement

**Key Metrics**:
1. Preset shares (public preset creation rate)
2. Social posts (WF-11-13 usage → actual social media posts)
3. Users referred (WF-27 referral engine conversion)
4. Viral loop time (signup → first preset → first share)

**Formula**:
```
Viral Coefficient (K) =
  (Invites Sent per User) × (Conversion Rate of Invites)

Target: K > 1.0 (exponential growth)
```

**Tracking Implementation**:
```sql
CREATE TABLE public.viral_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(user_id),
  event_type TEXT, -- preset_shared, social_posted, referral_sent
  referral_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calculate viral coefficient
SELECT
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) FILTER (WHERE event_type = 'referral_sent') as invites_sent,
  COUNT(*) FILTER (WHERE event_type = 'referral_converted') as conversions,
  (COUNT(*) FILTER (WHERE event_type = 'referral_converted')::float /
   NULLIF(COUNT(*) FILTER (WHERE event_type = 'referral_sent'), 0)) as conversion_rate
FROM viral_events
GROUP BY week
ORDER BY week DESC;
```

### Growth Pool Transparency Report

**Decision**: Option B - Private dashboard for MVP, public transparency in Month 2

**Monthly Report Template**:
```
Growth Pool Report - January 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Overflow Collected: 12,450 credits ($622.50)

Sources:
- Earning cap overflow: 8,200 credits (66%)
- Flagged wash trading: 3,100 credits (25%)
- Terminated accounts: 1,150 credits (9%)

Allocations:
- Referral bonuses paid: 4,500 credits (36%)
- Free trial subsidies: 3,950 credits (32%)
- "Preset of the Month" contest: 2,000 credits (16%)
- Rollover to next month: 2,000 credits (16%)
```

### Content Marketing (TBD)

**Channels to Explore**:
- YouTube tutorials (jewelry sellers)
- eBay Seller Forums
- Etsy Seller Community
- Facebook Groups (maker economy)
- TikTok (product photography hacks)

**Awaiting**: Full GTM strategy document creation

---

## DATABASE SCHEMA UPDATES

### New Tables for Creator Tiers

```sql
-- Creator tier tracking
CREATE TABLE public.creator_tiers (
  tier_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(user_id) UNIQUE,
  tier_name TEXT NOT NULL, -- bronze, silver, gold, platinum
  total_preset_uses INTEGER DEFAULT 0,
  earning_cap INTEGER NOT NULL, -- 1000, 2500, 5000, 10000
  badge_color TEXT,
  tier_achieved_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- A/B testing tables (see A/B Testing Framework section)

-- Viral event tracking
CREATE TABLE public.viral_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(user_id),
  event_type TEXT,
  referral_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Growth Pool ledger
CREATE TABLE public.growth_pool_ledger (
  entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type TEXT, -- earning_cap_overflow, wash_trading, account_termination
  source_user_id UUID REFERENCES public.profiles(user_id),
  amount_credits INTEGER NOT NULL,
  allocated_to TEXT, -- referral_bonus, free_trial, contest, rollover
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Updated Profiles Table

```sql
ALTER TABLE public.profiles
ADD COLUMN subscription_tier TEXT DEFAULT 'free_trial', -- free_trial, starter, pro, enterprise
ADD COLUMN royalty_eligible BOOLEAN DEFAULT FALSE, -- TRUE only for pro/enterprise
ADD COLUMN spend_last_90_days INTEGER DEFAULT 0, -- for spend-to-earn requirement
ADD COLUMN creator_tier_id UUID REFERENCES public.creator_tiers(tier_id);
```

---

## TECHNICAL DEBT & DISCREPANCIES

### Known Issues to Resolve

1. **WF-20: SEO Blog Post Model Discrepancy**
   - Build List: Claude 3.5 Sonnet
   - COGS Sheet: Gemini 3.0 Pro
   - **Action**: User to decide which model for final implementation

2. **WF-14: High-Res Upscale Service Discrepancy**
   - Build List: Magnific AI ($0.05)
   - COGS Sheet: Stability Fast ($0.02)
   - **Action**: Clarify which service to use

3. **WF-19: Product Collage Cost Discrepancy**
   - Build List: $0.005 (Sharp.js local)
   - COGS Sheet: $0.052 (includes royalty)
   - **Action**: Confirm COGS includes $0.05 royalty load

4. **Rate Limits: Pending Discussion**
   - User requested "side discussion to explore further"
   - **Action**: Schedule follow-up to finalize approach

5. **KPI List Import: Pending**
   - User has comprehensive list on Google Drive
   - **Action**: Import file and update KPI Dashboard section

---

## SECURITY & COMPLIANCE

### Zero Trust Security Mesh (Existing)

Per imported docs, 5-layer security architecture:

1. **Frontend Layer**: Supabase Auth JWT validation
2. **API Gateway Layer**: Rate limiting, request validation
3. **Workflow Layer**: n8n authentication, webhook signing
4. **Data Layer**: PostgreSQL RLS policies
5. **Storage Layer**: S3 bucket policies, presigned URLs

### Data Privacy

**GDPR Compliance**:
- Right to deletion (CASCADE on user_id)
- Right to export (JSON dump of all user data)
- Privacy policy linked in Terms & Conditions

**Data Usage for Model Training**:
Per Terms & Conditions Section 8:
- Anonymized Input used for AI model training
- Anonymized Output used for market insights
- No PII linked to training data

---

## BUDGET & FINANCIAL PROJECTIONS

### MVP Infrastructure Cost

| Service | Monthly Cost |
|---------|-------------|
| AWS Lightsail (2× instances) | $20 |
| AWS RDS PostgreSQL | $15 |
| AWS S3 Intelligent-Tiering | $10 |
| AWS Amplify | $5 |
| AWS CloudWatch | $5 |
| Route 53 Health Checks | $1 |
| **Total Infrastructure** | **$56** |

### Variable Costs (Per 100 Users)

| Item | Cost |
|------|------|
| Free trials (100 @ $0.29) | $29 |
| API costs (avg $0.02/job) | Variable |
| Stripe fees (2.9% + $0.30) | Variable |

### Revenue Projections (Month 1)

**Assumptions**:
- 100 trial users
- 22% conversion rate
- 50% choose Starter, 50% choose Pro

**Revenue**:
```
22 conversions:
- 11 Starter @ $17 = $187
- 11 Pro @ $32 = $352
Total MRR: $539

Credit top-ups (est 30% of users):
- 6 users @ $11.25 avg = $67.50

Total Month 1 Revenue: $606.50
```

**Costs**:
```
Infrastructure: $56
Free trials: $29
API costs (est): $50
Total Month 1 Costs: $135
```

**Net Profit Month 1**: $471.50 (78% margin)

---

## DAILY SUMMARY PROTOCOL

### Requirement (Per User Request)

**User Quote**: "Make it a required action every day to summarize and update our daily progress as well as our TDD."

### Implementation

**End of Each Session**:
1. Create daily summary document: `DAILY_SUMMARY_YYYY-MM-DD.md`
2. Update this master TDD with any new decisions
3. Increment version number (v1.8 → v1.9)
4. Commit to version control

**Daily Summary Template**:
```markdown
# SwiftList Daily Summary - [DATE]

## Decisions Made Today
- [List all strategic decisions]

## Work Completed
- [List all tasks completed]

## Blockers / Issues
- [List any blockers or unresolved issues]

## Tomorrow's Priorities
- [List top 3-5 priorities for next session]

## TDD Updates
- [List sections updated in master TDD]

## Metrics (if applicable)
- Tasks completed: X
- Code written: X lines
- Tests passed: X/Y
```

---

## APPENDIX A: WORKFLOW MASTER LIST

Complete list of all 27 workflows with status:

| ID | Name | Phase | Priority | Status |
|----|------|-------|----------|--------|
| WF-01 | The Decider | 1 | CRITICAL | Ready to build |
| WF-02 | Jewelry Engine | 2 | High | Ready to build |
| WF-03 | Fashion Engine | 2 | High | Phase 2 |
| WF-04 | Glass Engine | 2 | Medium | Phase 2 |
| WF-05 | Furniture Engine | 2 | Medium | Phase 2 |
| WF-06 | General Goods | 2 | High | Ready to build |
| WF-07 | Background Removal | 1 | CRITICAL | Ready to build |
| WF-08 | Simplify BG | 2 | High | Ready to build |
| WF-09 | Lifestyle Setting | 4 | Medium | Phase 2 |
| WF-10 | Product Description | 3 | High | Ready to build |
| WF-11 | Twitter Generator | 3 | Medium | Phase 2 |
| WF-12 | Instagram Generator | 3 | Medium | Phase 2 |
| WF-13 | Facebook Generator | 3 | Medium | Phase 2 |
| WF-14 | High-Res Upscale | 4 | Medium | Phase 3 |
| WF-15 | Color Variants | 4 | Low | Phase 3 |
| WF-16 | 360° Spin | 5 | Low | Phase 3 |
| WF-17 | Generate Preset | 5 | High | Ready to build |
| WF-18 | Animation | 5 | Low | Phase 3 |
| WF-19 | Product Collage | 4 | Medium | Phase 3 |
| WF-20 | SEO Blog Post | 3 | Low | Phase 3 |
| WF-21 | AI Model Swap | 5 | Low | Phase 4 |
| WF-22 | Voice-to-Description | 5 | Low | Phase 4 |
| WF-23 | Asset Optimizer | 6 | Medium | Ready to build |
| WF-24 | Lifeguard | 6 | CRITICAL | Ready to build |
| WF-25 | Marketplace Compliance | 6 | Medium | Ready to build |
| WF-26 | Billing & Top-Up | 1 | CRITICAL | Ready to build |
| WF-27 | Referral Engine | 1 | CRITICAL | Ready to build |

**MVP Scope (Week 1-2)**: WF-01, 02, 06, 07, 08, 10, 17, 24, 26, 27

---

## APPENDIX B: API PROVIDERS & CREDENTIALS

### Required API Keys for MVP

| Provider | Workflows | Pricing | Rate Limits |
|----------|-----------|---------|-------------|
| Google Vertex AI (Gemini) | WF-01, 02, 10 | $0-0.50/1M tokens | 1,500/day (free tier) |
| Photoroom | WF-07 | $0.02/image | 10,000/month |
| Stability AI | WF-06 | $0.015/image | Unlimited (pay-per-use) |
| Stripe | WF-26 | 2.9% + $0.30 | N/A |
| Supabase | All | $0 (free tier) | 500MB DB, 1GB storage |
| AWS (Lightsail, RDS, S3) | Infrastructure | $56/month | N/A |

### Fallback Providers (Configure Later)

| Provider | Purpose | Workflows |
|----------|---------|-----------|
| Claude (Anthropic) | AI fallback | WF-01, 10, 11-13 |
| OpenAI (GPT-4o) | AI fallback | WF-01, 04 |
| Remove.bg | BG removal fallback | WF-07 |
| Cloudinary | BG removal fallback | WF-07 |

---

## APPENDIX C: ENVIRONMENT VARIABLES

```bash
# .env (n8n instance)

# Database
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/swiftlist
PGVECTOR_ENABLED=true

# AWS
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=swiftlist-assets-prod

# Supabase
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Google Vertex AI
GOOGLE_CLOUD_PROJECT=swiftlist-prod
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# AI Providers
PHOTOROOM_API_KEY=...
STABILITY_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...

# Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# n8n
N8N_ENCRYPTION_KEY=...
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=...

# Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## CHANGELOG

### v1.8 (December 31, 2025)

**Major Updates**:
- ✅ Added Active-Passive failover architecture ($41/month approved)
- ✅ Updated free trial to 200 credits (150 base + 50 gamified bonuses)
- ✅ Implemented 3-tier AI model quality framework
- ✅ **CRITICAL**: Royalties now ONLY available on Pro/Enterprise tiers
- ✅ Added Bronze/Silver/Gold/Platinum creator tier system with badges
- ✅ Added spend-to-earn requirement (100 credits/90 days)
- ✅ Designed custom A/B testing framework ($0 budget)
- ✅ Added multi-provider fallback chains with adapter pattern
- ✅ Set MVP launch target: January 15, 2026 (15 days)
- ✅ Confirmed eBay head of product launch partnership
- ✅ Updated workflow backup strategy (daily → 6-hour at 100 users)
- ✅ Added daily summary protocol requirement

**Pending Items**:
- ⏳ Rate limits strategy (requires follow-up discussion)
- ⏳ KPI list import from Google Drive
- ⏳ WF-20 model selection (Claude vs Gemini)
- ⏳ WF-14 service selection (Magnific vs Stability)
- ⏳ Full Marketing GTM strategy document

### v1.7 (Previous Version)
- Original TDD from Gemini collaboration
- 27 workflows defined
- AWS 3-tier architecture specified
- Credit system & royalty model established

---

## CONTACT & DEPLOYMENT INFO

**Production Domain**: TBD
**Staging Domain**: TBD
**n8n Admin**: https://n8n.swiftlist.com (behind VPN)
**Database**: RDS PostgreSQL (private subnet)
**Monitoring**: CloudWatch + Slack alerts

**Deployment**: Automated via GitHub Actions (TBD)

---

**END OF TDD v1.8**

*Last Updated: December 31, 2025*
*Next Review: Daily (per protocol)*
*Next Version: v1.9 (next session)*
