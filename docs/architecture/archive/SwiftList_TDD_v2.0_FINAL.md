# SwiftList Technical Design Document (TDD) v2.0
## Updated: January 3, 2026
## Target MVP Launch: January 15, 2026 (12 Days)

---

## EXECUTIVE SUMMARY

SwiftList is an AI-powered SaaS platform for the maker economy (jewelry, fashion, general goods sellers on eBay, Etsy, Amazon). We transform basic product photos into marketplace-optimized assets across multiple categories using 27 specialized n8n workflows orchestrated on AWS infrastructure.

**Key Business Metrics**:
- Average Margin: 93.2% (up from 85%)
- Monthly Infrastructure Cost: $85.50 (down from $139)
- Mission Control Dashboard: $0/month (free tiers)
- Credit Economy: 1 credit = $0.05 USD
- Target LTV:CAC: 460:1
- MVP Launch: January 15, 2026

**Critical Updates (January 3, 2026)**:
- ✅ Infrastructure: Active-Passive failover approved ($41/month)
- ✅ Free Trial: 200 credits (150 base + 50 gamified bonuses)
- ✅ AI Models: 3-tier quality framework approved
- ✅ Royalties: ONLY available on mid/upper subscription tiers
- ✅ Creator Tiers: Bronze/Silver/Gold/Platinum system required
- ✅ A/B Testing: Custom build ($0 budget for MVP)
- ✅ **NEW**: Visual Presets Library (25 curated presets imported)
- ✅ **NEW**: Mission Control Dashboard ($0/month - free tiers)
- ✅ **NEW**: Security Enforcement System (automatic secure code generation)
- 🎯 Launch Partner: eBay Head of Product + power user test group

---

## TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure Decisions](#infrastructure-decisions)
3. [Security Enforcement System](#security-enforcement-system)
4. [Credit & Subscription System](#credit--subscription-system)
5. [Royalty System (UPDATED)](#royalty-system-updated)
6. [Free Trial Strategy](#free-trial-strategy)
7. [AI Model Quality Tiers](#ai-model-quality-tiers)
8. [Visual Presets Library](#visual-presets-library)
9. [Preset Learning System](#preset-learning-system)
10. [Workflow Evolution System](#workflow-evolution-system)
11. [All 36 n8n Workflows](#all-36-n8n-workflows)
12. [A/B Testing Framework](#ab-testing-framework)
13. [KPI Dashboard](#kpi-dashboard)
14. [Mission Control Dashboard](#mission-control-dashboard)
15. [Rate Limits & Anti-Abuse](#rate-limits--anti-abuse)
16. [Resilience & Failover](#resilience--failover)
17. [MVP Roadmap](#mvp-roadmap)
18. [Marketing GTM Strategy](#marketing-gtm-strategy)

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
| Mission Control | Vercel + Redis + WebSockets | $0/month | Dashboard (free tiers) |
| **TOTAL** | | **$56/month** | Infrastructure only |

**Note**: n8n confirmed hosted on AWS Lightsail to keep costs lower (not n8n Cloud)

---

## SECURITY ENFORCEMENT SYSTEM

### Overview

**Date Implemented**: January 3, 2026
**Status**: ACTIVE - All backend code generation now includes security by default

SwiftList implements a **security-first development approach** where all API routes, database queries, and backend functions automatically include mandatory security measures without requiring explicit developer requests.

### Security Architecture Files

| File | Purpose | Location |
|------|---------|----------|
| `.claude/CLAUDE.md` | Mandatory security rules for code generation | `/Content Factory/.claude/` |
| `.claude/skills/secure-code-builder.md` | Auto-invoked security enforcement skill | `/Content Factory/.claude/skills/` |
| `SECURITY-HARDENING-PROTOCOL.md` | Complete security implementation guide | `/SwiftList/` |
| `SECURITY-ENFORCEMENT-ACTIVE.md` | Quick reference and verification tests | `/SwiftList/` |

### Automatic Security Measures

All backend code generated for SwiftList includes these measures by default:

#### 1. Authentication & Authorization
```typescript
// Automatically included in every API route
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Authorization: Users can only access their own resources
if (resource.user_id !== user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

#### 2. Input Validation
```typescript
// Zod schemas automatically included for all request bodies
const schema = z.object({
  workflow_id: z.string().uuid(),
  image_url: z.string().url(),
  preset_id: z.string().uuid().optional(),
});
const validated = schema.parse(body);
```

#### 3. Server-Side Business Logic
```typescript
// Pricing, credits, permissions ALWAYS defined server-side
const WORKFLOW_COSTS = {
  'wf-07': 5,  // Background Removal
  'wf-02': 15, // Jewelry Engine
  // ... client CANNOT manipulate
};
```

#### 4. Row Level Security (Database)
```sql
-- All tables have RLS enabled with deny-by-default policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_backend_only" ON transactions
  FOR INSERT
  WITH CHECK (false); -- Users CANNOT insert, backend uses service role
```

#### 5. Rate Limiting
```typescript
// Middleware automatically applied to all routes
import { Ratelimit } from '@upstash/ratelimit';

const rateLimits = {
  '/api/jobs/submit': { limit: 10, window: '60 s' },
  '/api/auth/login': { limit: 5, window: '60 s' },
  '/api/credits/purchase': { limit: 5, window: '60 s' },
};
```

#### 6. Error Handling
```typescript
// Safe error messages automatically included
try {
  // ... operation
} catch (error) {
  console.error('Operation failed:', error); // Server-side only
  return NextResponse.json(
    { error: 'Operation failed' }, // ✅ No sensitive details
    { status: 500 }
  );
}
```

### Pre-Launch Security Checklist

**MANDATORY before January 15, 2026 MVP launch:**

- [ ] **Database**: Verify all 8 tables have RLS enabled
- [ ] **Backend**: All API routes include authentication check
- [ ] **Rate Limiting**: Middleware deployed with appropriate limits
- [ ] **SAST Scan**: Run `npm run security:scan` - 0 critical vulnerabilities
- [ ] **Secrets**: Verify no `.env` files in git history
- [ ] **Input Validation**: All routes use Zod schemas
- [ ] **Authorization**: Test users cannot access other users' data
- [ ] **Error Messages**: No stack traces or sensitive info leaked
- [ ] **Security Headers**: CSP, HSTS, X-Frame-Options configured
- [ ] **SECURITY.md**: Public security documentation published

### Legal & Compliance Context

**Why This Matters**:
- **GDPR Fines**: Up to €20M or 4% annual revenue for data breaches
- **Class-Action Lawsuits**: User data exposure can result in multi-million dollar settlements
- **Trust**: One breach destroys brand reputation irreversibly
- **Compliance**: Required for enterprise customers and eBay partnership

### Security Incident Response

**If vulnerability discovered**:
1. **Immediate** (0-15 min): Disable affected endpoint via feature flag
2. **Alert** (15-30 min): Notify #swiftlist-security Slack channel
3. **Investigate** (30 min - 2 hours): Determine scope of breach
4. **Patch** (2-4 hours): Deploy fix to production
5. **Notify Users** (72 hours): Email affected users if data exposed (GDPR requirement)
6. **Post-Mortem** (1 week): Document root cause, prevention measures

### Cost Impact

**Security Infrastructure**: $0/month additional cost
- Row Level Security: Built into PostgreSQL
- Rate limiting: Upstash Redis free tier (10K requests/day)
- SAST scanning: Free open-source tools (Semgrep, npm audit)
- Secrets management: Environment variables (no cost)

**Developer Time Savings**: Security is now automatic
- Before: 2-4 hours per API route to add security manually
- After: 0 hours - security included by default
- **Estimated savings: 40-80 hours for MVP** (10-20 API routes)

### Documentation References

**For implementation details, see**:
- `SECURITY-HARDENING-PROTOCOL.md` - Complete implementation guide
- `SECURITY-ENFORCEMENT-ACTIVE.md` - Quick reference and verification
- `.claude/CLAUDE.md` - System-level security rules
- `.claude/skills/secure-code-builder.md` - Security patterns library

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

## TAG-BASED SPECIALTY ARCHITECTURE

### Overview

**Status**: ACTIVE - Implemented January 5, 2026
**Architecture Type**: Tag-based metadata system (NOT routing-based)

SwiftList uses a **tag-based specialty architecture** where product categories (jewelry, fashion, glass, furniture) are handled through metadata tagging rather than workflow routing. This enables composability: any workflow can be used with any product category.

### Key Architectural Principles

1. **WF-01 tags, does NOT route**: WF-01 Orchestrator analyzes images and stores specialty metadata, then executes user's requested workflows
2. **User controls workflow selection**: Users choose which workflows to apply (WF-07, WF-14, WF-16, etc.)
3. **Workflows check tags**: Each specialty-aware workflow checks `job.specialty_engine` tag and applies category-specific logic
4. **Composable system**: Jewelry products can use WF-07 background removal, WF-14 upscale, WF-16 360° spin, WF-25 eBay compliance—any combination

### Architecture Flow

```
1. User uploads jewelry photo
     ↓
2. WF-01 analyzes with Gemini Vision
     ↓
3. WF-01 tags job: specialty_engine = "WF-02" (jewelry)
     ↓
4. WF-01 stores tags in database (category, specialty_engine, material, complexity)
     ↓
5. User selects workflows: [WF-07, WF-14, WF-16]
     ↓
6. WF-07 executes:
   - Checks specialty_engine tag
   - Calls SpecialtyLogic.getConfig("WF-02", "backgroundRemoval")
   - Gets jewelry-specific config (preserve reflections, high contrast)
   - Applies to Photoroom API
     ↓
7. WF-14 executes:
   - Checks specialty_engine tag
   - Calls SpecialtyLogic.getConfig("WF-02", "upscale")
   - Gets jewelry-specific upscale config (detail enhancement for engravings)
     ↓
8. WF-16 executes:
   - Checks specialty_engine tag
   - Calls SpecialtyLogic.getConfig("WF-02", "threeSixtySpinConfig")
   - Gets jewelry-specific 360° config (fast rotation 3-5s, enhanced reflections)
```

### Specialty Categories

| Category | Specialty Engine | Material | Key Features |
|----------|-----------------|----------|--------------|
| **Jewelry** | WF-02 | Metal, gemstones | Preserve reflections, high contrast, fast 360° (3-5s), sparkle animation |
| **Fashion** | WF-03 | Fabric | Preserve texture/drape, soft shadows, medium 360° (6-8s), fabric movement |
| **Glass/Liquid** | WF-04 | Glass | Preserve refraction, caustics, slow 360° (10-12s), liquid pour animation |
| **Furniture** | WF-05 | Wood | Preserve floor shadows, perspective correction, very slow 360° (15-20s), room flythrough |
| **General** | WF-06 | Other | Standard processing, default settings |

### 11 Specialty-Aware Workflows

These workflows check `job.specialty_engine` tag and apply category-specific configurations:

1. **WF-07**: Background Removal - Category-specific edge detection
2. **WF-08**: Simplify BG - Category-specific background colors
3. **WF-09**: Lifestyle Setting - Category-specific scene generation
4. **WF-10**: Product Description - Category-specific vocabulary
5. **WF-14**: High-Res Upscale - Category-specific detail enhancement
6. **WF-15**: Color Variants - Category-specific color palettes
7. **WF-16**: 360° Spin - **CRITICAL** - Category-specific rotation speed/lighting
8. **WF-18**: Animation - **CRITICAL** - Category-specific physics/effects
9. **WF-19**: Product Collage - Category-specific focal points
10. **WF-21**: AI Model Swap - Category-specific placement
11. **WF-25**: Marketplace Compliance - Category-specific rules

### Specialty Logic Modules

Located in `/SwiftList/specialty-logic-modules/`:

```javascript
// Central export providing easy access in n8n workflows
const SpecialtyLogic = require('./specialty-logic-modules/index.js');

// Check if workflow supports specialty logic
if (SpecialtyLogic.workflowSupportsSpecialtyLogic('WF-07')) {

  // Get specialty configuration
  const config = SpecialtyLogic.getConfig(
    job.specialty_engine,        // "WF-02" (jewelry), "WF-03" (fashion), etc.
    'backgroundRemoval',         // Operation name
    job.current_image_url        // Arguments
  );

  // Apply to API call
  const result = await photoroom.removeBackground({
    imageUrl: job.current_image_url,
    ...config  // Applies jewelry/fashion/glass/furniture-specific settings
  });
}
```

**Module Files**:
- `JewelrySpecialty.js` - Jewelry-specific parameters for 11 operations
- `FashionSpecialty.js` - Fashion-specific parameters for 11 operations
- `GlassSpecialty.js` - Glass/liquid-specific parameters for 11 operations
- `FurnitureSpecialty.js` - Furniture-specific parameters for 11 operations
- `GeneralSpecialty.js` - Default parameters for non-specialty products
- `index.js` - Central export with helper functions
- `README.md` - Complete usage documentation

### Benefits

1. **Composable**: Any workflow can be used with any specialty category
2. **Extensible**: Add new categories (electronics, food) without modifying workflows
3. **DRY**: Specialty logic centralized in modules, not duplicated across workflows
4. **Maintainable**: Update jewelry logic once, applies to all 11 workflows
5. **Testable**: Each module can be unit tested independently
6. **Future-proof**: Easy to add new workflows without breaking specialty support

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
- ✅ WF-23: Market Optimizer (compression)
- ✅ WF-25: eBay Compliance (image resize)

**Cost Impact**: $0 API costs, minimal compute

---

## VISUAL PRESETS LIBRARY

### Overview

**25 Curated Presets** imported from Content Factory Visual Styles v2.1

**All Official Presets: FREE** (no additional charge beyond base workflow credits)

**Integration Points**:
- WF-01 Decider: Recommends presets based on product category
- WF-17 Generate Preset: Converts user jobs into reusable presets
- WF-23 Market Optimizer: Applies presets during marketplace optimization
- Preset Marketplace: User discovery and community presets

### Database Schema

```sql
-- Presets table
CREATE TABLE public.presets (
  preset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  preset_name TEXT NOT NULL,
  category TEXT NOT NULL, -- engraving, illustration, print_technique, digital, elements, typography, texture, technical, 3d_render
  creator_id UUID REFERENCES public.profiles(user_id),
  is_official BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  description TEXT,
  best_for TEXT[], -- Array of use cases: finance, crypto, brewery, travel, etc.
  color_palettes JSONB, -- Available color schemes
  style_parameters JSONB, -- AI prompt parameters, technique details
  embedding vector(1536), -- pgvector for semantic search
  usage_count INTEGER DEFAULT 0,
  unique_users_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX ON presets USING ivfflat (embedding vector_cosine_ops);

-- Preset usage tracking
CREATE TABLE public.preset_usage (
  usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  preset_id UUID REFERENCES public.presets(preset_id),
  user_id UUID REFERENCES public.profiles(user_id),
  job_id UUID REFERENCES public.jobs(job_id),
  royalty_paid INTEGER DEFAULT 0, -- Credits paid to creator
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Preset Categories & Counts

| Category | Count | Featured Artist Styles |
|----------|-------|----------------------|
| **Engraving** | 4 | Steven Noble (×2), Lyle Hehn (×2) |
| **Illustration** | 6 | Hiker Booty, Mid-Century Modern, Comic Book, Esoteric Space |
| **Print Technique** | 6 | Risograph, Blockprint, Letterpress, Distressed Print |
| **Digital** | 2 | Cyberpunk Holographic, Glitch Art |
| **Elements** | 3 | Vintage Elements, Rustic Nature, Frames & Banners |
| **Typography** | 1 | Sign Maker |
| **Texture** | 1 | SuperGrain |
| **Technical** | 1 | Technical Blueprint |
| **3D Render** | 1 | Modern Business 3D |
| **TOTAL** | **25** | |

### Featured Artist Styles

**Lyle Hehn** (2 presets):
1. **Lyle Hehn Black & White**: Bold relief print (linocut/woodcut), hand-carved aesthetic
   - Best for: Brewery, Signage, Folk Art, Festival Posters
   - Color: Charcoal & Oatmeal

2. **Lyle Hehn Color (McMenamins)**: Surreal-historical psychedelic illustration
   - Best for: Brewery, Historical Whimsy, Mystical Commercial
   - Colors: Burgundy, Mustard, Moss Green, Burnt Orange

**Steven Noble** (2 presets):
1. **Steven Noble Black & White**: Museum-quality steel engraving
   - Best for: Finance, Logos, Currency, Certificates
   - Color: Pure B&W

2. **Steven Noble Hand-Tinted Color**: 19th century chromolithography
   - Best for: Packaging, Labels, Heritage Brands
   - Colors: Madder Lake, Prussian Blue, Terre Verte

**Hiker Booty** (1 preset):
1. **Hiker Booty Watercolor Maps**: Hand-drawn cartography with nature icons
   - Best for: Travel, Outdoor, Nature, Trail Maps
   - Colors: PNW Naturals, Mountain Tones

### Workflow Integration

**WF-01 Decider Enhancement**:
```javascript
// Decider now recommends presets based on product category
const recommendations = {
  jewelry: ["Steven Noble Black & White", "Mid-Century Modern", "Technical Blueprint"],
  brewery: ["Lyle Hehn Black & White", "Lyle Hehn Color", "Blockprint"],
  crypto: ["Cyberpunk Holographic", "Glitch Art", "Esoteric Space"],
  travel: ["Hiker Booty Watercolor Maps", "Rustic Nature", "Foliage Stamps"],
  finance: ["Steven Noble Black & White", "Steven Noble Hand-Tinted", "Modern Business 3D"]
};
```

**WF-23 Market Optimizer** (renamed from Preset Discovery Engine):
- Analyzes product type and target marketplace
- Recommends optimal preset for conversion
- Applies preset automatically if user has selected "Auto-optimize"
- Returns JSON with preset recommendations ranked by relevance

### Preset Marketplace Strategy

**Phase 1 (MVP Launch)**: All 25 official presets FREE
- Maximize adoption
- Build trust with professional quality
- Encourage experimentation

**Phase 2 (Month 2)**: Community presets eligible for royalties
- Users create derivative presets based on official library
- 1 credit surcharge per use (royalty to creator)
- Bronze/Silver/Gold/Platinum creator tiers apply

**Phase 3 (Month 3+)**: Premium preset packs
- Exclusive artist collaborations
- Seasonal/trending style packs
- Enterprise-only presets

---

## PRESET LEARNING SYSTEM

### Overview

**Status**: Integrated into MVP
**Purpose**: AI-powered system that learns from user behavior to continuously improve preset quality
**Impact**: Self-improving preset library that creates an impossible-to-replicate competitive moat

SwiftList's preset library doesn't just exist - it **learns and improves** automatically based on real user behavior. Every time a user applies a preset, the system collects data on what works and what doesn't, then uses AI to:
1. Identify successful patterns
2. Generate improved variations
3. A/B test improvements
4. Auto-deploy winners

**Result**: Preset library gets 2.6× better per year vs competitors who manually curate.

---

### 5-Layer Learning Architecture

#### Layer 1: Data Collection

**What We Track** (via `preset_usage_metrics` table):
```sql
CREATE TABLE preset_usage_metrics (
  usage_id UUID PRIMARY KEY,
  preset_id UUID REFERENCES presets(preset_id),
  preset_version_id UUID REFERENCES preset_versions(version_id),
  user_id TEXT REFERENCES profiles(user_id),
  job_id UUID REFERENCES jobs(job_id),

  -- Input context
  product_category TEXT,
  marketplace TEXT,
  input_image_url TEXT,

  -- Output quality
  output_image_url TEXT,
  execution_time_seconds FLOAT,
  ai_cost_usd DECIMAL(10, 4),

  -- User feedback (implicit + explicit)
  user_kept_result BOOLEAN, -- Did user download/use output?
  user_regenerated BOOLEAN,  -- Did user try another preset?
  user_rating INTEGER,        -- Optional 1-5 stars

  -- System feedback (automatic)
  image_quality_score FLOAT,        -- 0-100 (via WF-28 Gemini Vision)
  prompt_adherence_score FLOAT,     -- 0-100
  marketplace_compliance_score FLOAT, -- 0-100

  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Metric**: **Keep Rate** = % of users who kept result (didn't regenerate)
- Excellent: 70-90%
- Good: 50-70%
- Mediocre: 30-50%
- Poor: <30% (flag for improvement)

---

#### Layer 2: Quality Scoring

**Composite Quality Score** (0-100):
```javascript
quality_score =
  (keep_rate * 0.35) +           // 35% - Most important
  (avg_image_quality * 0.25) +   // 25% - Technical quality
  (usage_count_normalized * 0.15) + // 15% - Popularity
  (marketplace_compliance * 0.15) + // 15% - Meets requirements
  (user_ratings * 0.10)          // 10% - Explicit feedback
```

**Auto-Tiering** (updated nightly by WF-29):
- **S-Tier** (85-100): Featured on homepage, auto-recommended
- **A-Tier** (70-84): "Verified Quality" badge
- **B-Tier** (50-69): Available in marketplace
- **C-Tier** (30-49): Experimental (Pro/Enterprise only)
- **D-Tier** (0-29): Hidden, creator notified

---

#### Layer 3: Pattern Recognition

**WF-30: Preset Pattern Analyzer** (runs weekly):
- Analyzes top 20 presets by quality score
- Uses Gemini 2.0 Flash (FREE tier) to extract patterns
- Identifies what makes great presets work

**Example Output**:
```
"Top engraving presets (90+ score) explicitly state cross-hatching angles.
Presets WITHOUT explicit angles average 78.2 score.
Recommendation: Add '4-way cross-hatching at 0, 45, 90, 135 degrees' to engraving presets."
```

**Niche Detection**:
- Tracks searches with low click-through rate (<20%)
- Identifies gaps in preset library
- Recommends new preset categories

---

#### Layer 4: Automated Generation

**3 Generation Strategies**:

1. **WF-31: Preset Remixer** (genetic algorithm)
   - Combines two top presets → new hybrid
   - Example: "Steven Noble + Lyle Hehn" → "Noble-Hehn Hybrid Engraving"
   - Cost: $2-5/month

2. **WF-32: Preset Mutator** (variations)
   - Creates 3 variations of each top preset:
     - Variation A: Color palette shift
     - Variation B: Detail level adjustment
     - Variation C: Use case adaptation
   - Cost: $2-5/month

3. **WF-33: Preset Coach** (user assistance)
   - Analyzes user-created preset
   - Compares to top performers in same category
   - Provides actionable feedback
   - Cost: $0.01/preset

**Deployment**: All AI-generated presets start as C-Tier (Experimental), require A/B testing before promotion.

---

#### Layer 5: Curation & Deployment

**Hybrid Approach** (AI + Human):
```
User creates preset → Starts as C-Tier
  ↓
Collects 50+ uses over 2 weeks
  ↓
WF-29 calculates quality score
  ↓
If score >= 70 → AI flags for human review
  ↓
Human curator reviews (5 min):
  - Visual quality check
  - Brand safety check
  - Prompt appropriateness
  ↓
If approved → Promote to A-Tier or B-Tier
  ↓
If score >= 85 for 4 weeks → Auto-promote to S-Tier
```

**Human Time**: 5-10 min per preset review, ~1 hour/week at 100 users.

---

### Success Metrics

| Metric | Month 1 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Total presets | 25 | 500 | 2,000 |
| Avg quality score | 78 | 87 | 91 |
| S-Tier presets (85+) | 10 | 30 | 100 |
| AI-generated presets | 0 | 50 | 200 |
| Preset creation rate (%) | 0% | 20% | 40% |

**Key Indicator**: **40% network effect** = 40% of users create at least one preset.

At this level, SwiftList has a **strong competitive moat** that competitors cannot replicate.

---

### Cost Analysis

**Development** (one-time):
- Phase 1: Data collection (12 hours) = $1,200
- Phase 2: Quality scoring (16 hours) = $1,600
- Phase 3: Pattern recognition (12 hours) = $1,200
- Phase 4: Automated generation (30 hours) = $3,000
- Phase 5: Curation (24 hours) = $2,400
- **TOTAL**: 94 hours = $9,400

**Ongoing** (monthly):
- WF-28: Image Quality Scorer = $0 (FREE tier)
- WF-29: Quality Calculator = $0 (DB queries)
- WF-30: Pattern Analyzer = $0 (FREE tier)
- WF-31: Preset Remixer = $2-5
- WF-32: Preset Mutator = $2-5
- WF-33: Preset Coach = $50 (~500 presets/month @ $0.01)
- Human curator = $400 (4 hrs/week @ $100/hr)
- **TOTAL**: ~$460/month (at 1,000 users)

**ROI**: 300-500% (retention improvement + API cost savings + labor automation)

---

### Implementation Roadmap

See **MVP Roadmap** section for detailed phasing:
- **Month 1**: Phase 1 (Data collection) with MVP launch
- **Month 1-2**: Phase 2 (Quality scoring)
- **Month 2**: Phase 3 (Pattern recognition)
- **Month 2-3**: Phase 4 (Automated generation)
- **Month 3-4**: Phase 5 (Curation & marketplace)

---

## WORKFLOW EVOLUTION SYSTEM

### Overview

**Status**: Integrated into MVP
**Purpose**: Workflows automatically apply improved preset versions without human intervention
**Impact**: AGI-like self-improvement - wake up to "Preset improved by +22% overnight"

Instead of hardcoding presets in workflows, SwiftList workflows **dynamically query the database** for the latest approved preset version. Combined with the Preset Learning System, this creates a **self-evolving platform**:

1. AI discovers improvement (WF-30)
2. AI creates variation (WF-32)
3. A/B test validates improvement (WF-34)
4. Auto-promote to production (WF-35)
5. Monitor for safety (WF-36)
6. ALL users benefit automatically (zero human intervention)

---

### Database Architecture: 3-Tier Versioning

#### Enhanced Presets Table
```sql
CREATE TABLE presets (
  preset_id UUID PRIMARY KEY,
  preset_name TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Points to currently active version (what workflows use)
  active_version_id UUID REFERENCES preset_versions(version_id),

  -- Metadata
  creator_user_id TEXT,
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Preset Versions (Complete History)
```sql
CREATE TABLE preset_versions (
  version_id UUID PRIMARY KEY,
  preset_id UUID REFERENCES presets(preset_id),
  version_number TEXT NOT NULL, -- "1.0", "2.0", "2.1", etc.

  -- Frozen configuration snapshot
  base_prompt TEXT NOT NULL,
  style_modifiers JSONB,
  color_palettes JSONB,
  negative_prompt TEXT,
  tags TEXT[],
  best_for TEXT[],

  -- Performance metrics
  quality_score FLOAT,
  keep_rate_percent FLOAT,
  avg_execution_time_seconds FLOAT,
  avg_cost_usd DECIMAL(10, 4),

  -- Lifecycle status
  status TEXT NOT NULL, -- 'testing', 'approved', 'deprecated', 'rolled_back'
  testing_started_at TIMESTAMP,
  approved_at TIMESTAMP,
  deprecated_at TIMESTAMP,

  -- Change tracking
  change_type TEXT, -- 'ai_remix', 'ai_mutation', 'manual_edit'
  change_description TEXT,
  parent_version_id UUID REFERENCES preset_versions(version_id),
  created_by TEXT, -- 'system-ai' or user_id

  created_at TIMESTAMP DEFAULT NOW()
);
```

#### A/B Test Management
```sql
CREATE TABLE preset_version_tests (
  test_id UUID PRIMARY KEY,
  preset_id UUID REFERENCES presets(preset_id),
  version_a_id UUID REFERENCES preset_versions(version_id), -- Champion
  version_b_id UUID REFERENCES preset_versions(version_id), -- Challenger

  -- Test configuration
  traffic_split_percent INTEGER DEFAULT 50, -- % to version_b
  started_at TIMESTAMP NOT NULL,
  scheduled_end_at TIMESTAMP NOT NULL,

  -- Results
  version_a_uses INTEGER DEFAULT 0,
  version_a_keep_rate FLOAT,
  version_a_quality_score FLOAT,

  version_b_uses INTEGER DEFAULT 0,
  version_b_keep_rate FLOAT,
  version_b_quality_score FLOAT,

  -- Statistical analysis
  is_statistically_significant BOOLEAN DEFAULT false,
  p_value FLOAT,
  winner TEXT, -- 'version_a', 'version_b', 'inconclusive'

  status TEXT DEFAULT 'running', -- 'running', 'completed', 'cancelled'
  completed_at TIMESTAMP
);
```

---

### Workflow Dynamic Loading (Example: WF-02)

**OLD (Static)** - Never improves:
```javascript
const preset = {
  base_prompt: "steven noble style steel engraving...",
  style_modifiers: {"composition": "centered..."}
};
```

**NEW (Dynamic)** - Always uses best version:
```javascript
// Node: "Load Active Preset Version"
const presetQuery = await db.query(`
  SELECT
    pv.version_id,
    pv.version_number,
    pv.base_prompt,
    pv.style_modifiers,
    pv.color_palettes,
    pv.negative_prompt,
    pv.quality_score
  FROM presets p
  INNER JOIN preset_versions pv ON p.active_version_id = pv.version_id
  WHERE p.preset_id = $1 AND pv.status = 'approved'
`, [selectedPresetId]);

const activePreset = presetQuery.rows[0];

// Check for A/B test (auto-participate)
const abTest = await db.query(`
  SELECT version_b_id, traffic_split_percent
  FROM preset_version_tests
  WHERE preset_id = $1
    AND status = 'running'
    AND NOW() BETWEEN started_at AND scheduled_end_at
`, [selectedPresetId]);

let finalPreset = activePreset;

if (abTest.rows.length > 0) {
  const random = Math.random() * 100;
  if (random < abTest.rows[0].traffic_split_percent) {
    // User gets challenger version (being tested)
    const versionB = await db.query(`
      SELECT * FROM preset_versions WHERE version_id = $1
    `, [abTest.rows[0].version_b_id]);
    finalPreset = versionB.rows[0];
  }
}

// Use dynamically loaded preset (always latest approved or in A/B test)
await stabilityAPI.generate({
  prompt: finalPreset.base_prompt,
  ...finalPreset.style_modifiers,
  negative_prompt: finalPreset.negative_prompt
});
```

**Result**: Workflow automatically uses:
- Latest approved version by default
- Challenger version during A/B tests (auto-participates)
- Rolled-back version if new version failed

---

### Automatic Evolution Cycle

**Weekly Cycle** (zero human intervention):

```
Monday: WF-30 discovers improvement
  "Top presets explicitly state cross-hatching angles"
  ↓
Tuesday: WF-32 creates variation
  "Steven Noble v2.3" with explicit "0, 45, 90, 135 degrees"
  ↓
Wednesday: WF-34 deploys A/B test
  50% get v2.2 (champion), 50% get v2.3 (challenger)
  ↓
Days 1-7: Collect 200+ real user interactions
  v2.2: 126 uses, 71.1% keep rate
  v2.3: 124 uses, 87.2% keep rate
  ↓
Next Wednesday: WF-35 analyzes results
  Improvement: +22.6% (p = 0.0023, statistically significant)
  ↓
AUTO-PROMOTION: Update active_version_id to v2.3
  ↓
Slack Notification: "🎉 Preset improved by +22% overnight"
  ↓
Days 8-10: WF-36 monitors for problems every 4 hours
  If performance drops >10% → auto-rollback to v2.2
  ↓
Result: All users now get v2.3 automatically
```

**Human Involvement**: 0 hours (unless rollback occurs)

---

### Safety Safeguards

#### 1. Statistical Rigor
- **Minimum sample size**: 200 uses per variant
- **Statistical significance**: p < 0.05 (95% confidence)
- **Minimum duration**: 7 days
- **Chi-squared test**: Validates improvement is real, not noise

#### 2. Automatic Rollback (WF-36)
- Monitors new versions every 4 hours for 48 hours
- **Rollback trigger**: >10% performance drop with 50+ uses
- **Actions**:
  - Instant revert to previous version
  - Mark new version as 'rolled_back'
  - Alert human curator for investigation
  - Create curator task in dashboard

#### 3. Human Override
Curator dashboard allows:
- **Pause test**: Freeze traffic split, investigate
- **Stop & revert**: Cancel test, keep champion
- **Approve early**: Skip remaining test duration
- **Extend test**: Add 7 more days if inconclusive

#### 4. Audit Trail
```sql
CREATE TABLE preset_version_rollbacks (
  rollback_id UUID PRIMARY KEY,
  preset_id UUID,
  from_version_id UUID,
  to_version_id UUID,
  reason TEXT, -- 'performance_drop', 'manual_curator', 'user_complaints'
  performance_drop_percent FLOAT,
  rolled_back_at TIMESTAMP,
  rolled_back_by TEXT -- 'system-auto' or user_id
);
```

---

### Impact Comparison

#### Without Evolution (Manual Curation)
- Month 1: 25 presets, 78 avg quality
- Month 12: 25 presets, 84 avg quality (+0.5 pts/month)
- Human effort: 40 hours/month
- Improvement rate: 2-3 presets/month

#### With Evolution (Automated)
- Month 1: 25 presets, 78 avg quality
- Month 12: 250 presets, 91 avg quality (+1.3 pts/month)
- Human effort: 2 hours/week (curator oversight)
- Improvement rate: 3-5 presets/week

**Result**:
- **13× more presets** after 12 months
- **2.6× faster improvement** rate
- **95% less human time**
- **Impossible-to-replicate moat** (years of usage data)

---

### New Workflows for Evolution

See **All 36 n8n Workflows** section for details on:
- **WF-34**: A/B Test Manager (deploys tests daily)
- **WF-35**: Statistical Analyzer (auto-promotes winners daily)
- **WF-36**: Rollback Monitor (safety net, runs every 4 hours)

---

### Cost Analysis

**Development** (one-time):
- Enhanced database schema: 4 hours = $400
- Modify WF-02 to WF-06 (dynamic loading): 8 hours = $800
- Build WF-34, 35, 36: 20 hours = $2,000
- Curator dashboard: 8 hours = $800
- **TOTAL**: 40 hours = $4,000

**Ongoing** (monthly):
- WF-34: A/B Test Manager = $0 (DB queries)
- WF-35: Statistical Analyzer = $0 (DB queries)
- WF-36: Rollback Monitor = $0 (DB queries)
- Database storage (version history) = $10-15
- Human curator oversight = $400 (4 hrs/week)
- **TOTAL**: ~$415/month (at 1,000 users)

**ROI**: 4,873%
- API cost savings: $2,000/month (fewer regenerations)
- Retention improvement: $15,000/month (higher quality)
- Labor savings: $3,200/month (vs manual curation)

---

### Implementation Roadmap

See **MVP Roadmap** section for detailed phasing:
- **Month 1**: Database schema + dynamic loading in workflows
- **Month 2**: WF-34 A/B Test Manager
- **Month 2**: WF-35 Statistical Analyzer
- **Month 2**: WF-36 Rollback Monitor
- **Month 3**: Curator dashboard for manual overrides

---

## ALL 36 N8N WORKFLOWS

### Phase 1: Core Infrastructure (CRITICAL - Build First)

#### WF-01: The Decider (Orchestrator)
- **Function**: Analyzes product images and tags jobs with specialty metadata (does NOT route - uses tag-based architecture)
- **Model**: Gemini 2.0 Flash (FREE) → fallback Claude 3.5 Haiku
- **Input**: Product image + metadata
- **Output**: JSON {"category": "jewelry", "specialty_engine": "WF-02", "material": "metal", "complexity": "complex", "preset_recommendations": [...]}
- **Architecture**: Tag-based system where WF-01 tags jobs with specialty metadata, then executes user's requested workflows. Each workflow checks tags and applies specialty logic if applicable.
- **Specialty Metadata Stored**: category, specialty_engine, material, complexity
- **Cost**: $0.001 (or $0 with free tier)
- **Credits**: N/A (internal analysis)
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
- **Function**: Remove background, create transparent PNG with specialty-aware edge detection
- **Model**: Photoroom API → fallback Remove.bg → Cloudinary
- **Specialty Logic**: Checks job.specialty_engine tag and applies category-specific configs (jewelry: preserve reflections, fashion: soft edges, glass: preserve refraction, furniture: preserve floor shadows)
- **Output**: 1500×1500px transparent PNG
- **Cost**: $0.02
- **Credits**: 5 credits ($0.25 revenue)
- **Margin**: 80%
- **Priority**: **MOST USED WORKFLOW - SPECIALTY AWARE**

---

### Phase 2: Essential Product Engines

#### WF-06: General Goods Specialty Logic Module
- **Function**: Provides default processing parameters for products that don't fit specialty categories
- **Architecture**: Node.js module providing standard configs for all 11 specialty-aware workflows
- **Used By**: WF-07, WF-08, WF-09, WF-10, WF-14, WF-15, WF-16, WF-18, WF-19, WF-21, WF-25
- **Use Case**: Fallback for products (non-jewelry/fashion/glass/furniture)
- **Key Features**: Standard processing, medium rotation (8s), neutral settings
- **Cost**: $0 (logic module, not API calls)
- **Credits**: N/A (applied within other workflows)
- **Priority**: **HIGH - CORE VALUE ENGINE**

#### WF-08: Simplify BG (White/Grey)
- **Function**: Force hex color background with specialty-aware processing (local)
- **Tool**: GraphicsMagick
- **Specialty Logic**: Checks job.specialty_engine tag for category-specific background colors and processing
- **Output**: 4 image assets + metadata
- **Cost**: $0.00 (API) / $0.052 (COGS w/ royalty)
- **Credits**: 10 credits
- **Margin**: 89.6%
- **Priority**: **HIGH MARGIN - SPECIALTY AWARE**

#### WF-02: Jewelry Specialty Logic Module
- **Function**: Provides jewelry-specific processing parameters for 11 specialty-aware workflows
- **Architecture**: Node.js module (not standalone workflow) providing configs for preserve reflections, enhance sparkle, fast 360° rotation (3-5s), etc.
- **Used By**: WF-07, WF-08, WF-09, WF-10, WF-14, WF-15, WF-16, WF-18, WF-19, WF-21, WF-25
- **Key Features**: Preserve metal reflections, high contrast, detail enhancement, fast rotation, sparkle animation effects
- **Cost**: $0 (logic module, not API calls)
- **Credits**: N/A (applied within other workflows)
- **Priority**: **SPECIALTY - HIGH VALUE**

#### WF-03: Fashion Specialty Logic Module
- **Function**: Provides fashion-specific processing parameters for 11 specialty-aware workflows
- **Architecture**: Node.js module providing configs for fabric texture preservation, soft shadows, medium 360° rotation (6-8s), etc.
- **Used By**: WF-07, WF-08, WF-09, WF-10, WF-14, WF-15, WF-16, WF-18, WF-19, WF-21, WF-25
- **Key Features**: Preserve fabric texture/drape, model context, medium rotation, fabric movement animation
- **Cost**: $0 (logic module, not API calls)
- **Credits**: N/A (applied within other workflows)
- **Priority**: **SPECIALTY - FASHION**

#### WF-04: Glass/Liquid Specialty Logic Module
- **Function**: Provides glass/liquid-specific processing parameters for 11 specialty-aware workflows
- **Architecture**: Node.js module providing configs for transparency preservation, refraction handling, slow 360° rotation (10-12s), etc.
- **Used By**: WF-07, WF-08, WF-09, WF-10, WF-14, WF-15, WF-16, WF-18, WF-19, WF-21, WF-25
- **Key Features**: Preserve refraction/caustics, backlit+front lighting, transparency-aware upscaling, liquid pour animation
- **Cost**: $0 (logic module, not API calls)
- **Credits**: N/A (applied within other workflows)
- **Priority**: **SPECIALTY - GLASS**

#### WF-05: Furniture Specialty Logic Module
- **Function**: Provides furniture-specific processing parameters for 11 specialty-aware workflows
- **Architecture**: Node.js module providing configs for perspective correction, floor shadows, very slow 360° rotation (15-20s), etc.
- **Used By**: WF-07, WF-08, WF-09, WF-10, WF-14, WF-15, WF-16, WF-18, WF-19, WF-21, WF-25
- **Key Features**: Preserve floor shadows, perspective correction, room context, very slow rotation, room flythrough animation
- **Cost**: $0 (logic module, not API calls)
- **Credits**: N/A (applied within other workflows)
- **Priority**: **SPECIALTY - FURNITURE**

---

### Phase 3: Content Generation Suite

#### WF-10: Product Description Generator
- **Function**: SEO title + 5 bullet points with category-specific vocabulary
- **Model**: Gemini 2.0 Flash (FREE) OR Gemini 3 Flash
- **Specialty Logic**: Checks job.specialty_engine tag for category-specific vocabulary (jewelry: sparkle/shimmer/luxurious, fashion: fit/drape/style, glass: clarity/transparency, furniture: comfort/craftsmanship)
- **Cost**: $0.001
- **Credits**: 5 credits
- **Margin**: 99.6% (HIGHEST)
- **Priority**: **MOST PROFITABLE - SPECIALTY AWARE**

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
- **Function**: In-paint product in lifestyle context with category-specific scene generation (table, room, etc)
- **Model**: Flux.1 Pro
- **Specialty Logic**: Checks job.specialty_engine tag for contextually appropriate environments (jewelry: luxury display, fashion: model wearing, glass: bar/restaurant, furniture: lifestyle room)
- **Cost**: $0.052
- **Credits**: 10 credits
- **Margin**: 89.6%
- **Includes**: Preset ID storage in pgvector
- **Priority**: **SPECIALTY AWARE**

#### WF-14: High-Res Upscale
- **Function**: 4× detail hallucination enhancement with category-specific detail preservation
- **Model**: Magnific AI OR Stability Fast (discrepancy in docs)
- **Specialty Logic**: Checks job.specialty_engine tag for category-specific enhancement (jewelry: detail enhancement for engravings, fashion: fabric texture, glass: transparency preservation, furniture: wood grain)
- **Cost**: $0.02 (COGS) / $0.05 (Build)
- **Credits**: 10 credits
- **Margin**: 96%
- **Note**: Clarify Magnific vs Stability
- **Priority**: **SPECIALTY AWARE**

#### WF-19: Product Collage
- **Function**: Smart grid layout of 3-5 images with category-specific focal points
- **Tool**: Sharp.js (local Node.js)
- **Specialty Logic**: Checks job.specialty_engine tag for layout emphasis (jewelry: close-up details, fashion: full-body shots, glass: transparency showcase, furniture: room context views)
- **Cost**: $0.005 (Build) / $0.052 (COGS)
- **Credits**: 20 credits
- **Margin**: 94.8%
- **Priority**: **SPECIALTY AWARE**

#### WF-15: Color Variants
- **Function**: Generate 3-5 color variants with category-specific palettes
- **Model**: Stable Diffusion
- **Specialty Logic**: Checks job.specialty_engine tag for appropriate color variants (jewelry: metal tones gold/silver/rose gold, fashion: fabric colors, glass: liquid colors, furniture: wood stains/finishes)
- **Cost**: $0.075
- **Credits**: 15 credits
- **Priority**: **SPECIALTY AWARE**

#### WF-16: 360° Spin
- **Function**: Multi-angle product rotation with category-specific rotation speed and lighting
- **Model**: Stability 3D
- **Specialty Logic**: **CRITICAL** - Checks job.specialty_engine tag for rotation parameters (jewelry: fast 3-5s/72 frames/enhanced reflections, fashion: medium 6-8s/60 frames/soft shadows, glass: slow 10-12s/120 frames/caustic effects, furniture: very slow 15-20s/90 frames/room context)
- **Cost**: $0.15
- **Credits**: 25 credits
- **Priority**: **SPECIALTY AWARE - CRITICAL**

---

### Phase 5: Advanced Features

#### WF-17: Generate Preset
- **Function**: Convert user job → reusable preset with embedding
- **Model**: Gemini 2.0 Flash (FREE) for embedding
- **Storage**: pgvector in PostgreSQL
- **Cost**: $0.00
- **Credits**: Free feature for Pro+ users

#### WF-18: Animation (Short Video)
- **Function**: 3-5 second product animation with category-specific physics and effects
- **Model**: Runway Gen-3 → fallback Luma Dream Machine → Pika Labs
- **Specialty Logic**: **CRITICAL** - Checks job.specialty_engine tag for animation type (jewelry: sparkle-rotate with light reflections, fashion: fabric-movement with drape physics, glass: liquid-pour with transparency, furniture: room-flythrough with context)
- **Cost**: $0.25
- **Credits**: 40 credits
- **Priority**: **SPECIALTY AWARE - CRITICAL**

#### WF-21: AI Model Swap
- **Function**: Place product on AI-generated human model with category-specific placement
- **Model**: Fal.ai Fashion ControlNet
- **Specialty Logic**: Checks job.specialty_engine tag for appropriate model placement (jewelry: hand-wearing/neck display, fashion: model-wearing/on-body, glass: hand-holding, furniture: lifestyle context with person)
- **Cost**: $0.08
- **Credits**: 15 credits
- **Priority**: **SPECIALTY AWARE**

#### WF-22: Voice-to-Description
- **Function**: Voice note → product description
- **Model**: OpenAI Whisper → GPT-4o
- **Cost**: $0.015
- **Credits**: 5 credits

---

### Phase 6: Operations & Monitoring

#### WF-23: Market Optimizer
- **Function**: Analyze product + marketplace → recommend optimal preset
- **Tool**: Semantic search (pgvector) + marketplace requirements
- **Cost**: $0.00
- **Credits**: Free (post-processing)
- **Integration**: Returns preset recommendations ranked by conversion potential

#### WF-24: Lifeguard (Auto-Refund)
- **Function**: Detect failed jobs, issue credit refunds
- **Model**: Gemini 2.0 Flash (FREE) for analysis
- **Trigger**: Runs every 5 minutes
- **Action**: Auto-refund + log to system_audits
- **Cost**: $0.00

#### WF-25: eBay/Etsy/Amazon Compliance
- **Function**: Resize/format for marketplace requirements with category-specific rules
- **Tool**: GraphicsMagick
- **Specialty Logic**: Checks job.specialty_engine tag for marketplace-specific category rules (jewelry: white background required, fashion: model context allowed, glass: transparency handling, furniture: minimum resolution 2000px)
- **Cost**: $0.00
- **Credits**: Free (post-processing)
- **Priority**: **SPECIALTY AWARE**

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

## MISSION CONTROL DASHBOARD

### Overview

**Real-time workflow monitoring system** inspired by air traffic control and NYC subway command centers.

**Core Value**:
- Proactive problem detection (not reactive firefighting)
- Data-driven optimization (see which workflows need attention)
- Confidence in system health (glanceable status for entire platform)
- AI co-pilot for operations (automated alerts, suggestions, predictions)

### Strategic Rationale

**1. Complex Distributed System Visibility**:
- 27 independent workflows
- 16+ external API dependencies
- Multi-provider fallback chains
- Real money flowing through (credits, refunds, royalties)

**Example**: See WF-07 failure rate spike from 2% → 15% and proactively switch to Remove.bg fallback before users notice.

**2. Proactive Lifeguard (vs Reactive)**:
- Detect BEFORE jobs fail (e.g., Photoroom API latency increasing)
- Auto-scale resources (spin up secondary n8n instance if primary is overloaded)
- Predictive alerts (Stability AI nearing rate limit, budget running low)

**3. Data-Driven Product Decisions**:
- Which workflows are most profitable? (usage × margin)
- Which workflows have longest queue times? (optimize those first)
- Which presets are most popular? (double down on similar styles)
- What time of day has highest load? (scale infrastructure accordingly)

### Core Metrics Dashboard

**System-Wide KPIs** (Top Banner):
```
┌─────────────────────────────────────────────────────────────┐
│  JOBS TODAY        ACTIVE NOW       AVG COMPLETION    UPTIME │
│     847              12                23.4s          99.2%  │
│  ↑ 23% vs yesterday  (normal)         (target: <30s)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  REVENUE TODAY     CREDITS USED      REFUNDS       MARGIN    │
│    $423.50           8,470          12 ($60)       93.2%    │
│  ↑ 18% vs yesterday  (normal)       0.7% rate    (target: 90%+) │
└─────────────────────────────────────────────────────────────┘
```

### Live Workflow Network Map

**Animated visualization** showing:
- Jobs entering WF-01 Decider (pulsing dots)
- Routing decisions (branching paths)
- Jobs in flight (moving dots along workflow paths)
- Completions (green checkmarks)
- Errors (red X's with click-to-details)
- Queue depths (thickness of workflow pipes)
- Bottlenecks (red highlight on slow workflows)

**Color Coding**:
- 🟢 Green = Healthy (0-5 jobs queued)
- 🟡 Yellow = Moderate Load (6-10 jobs queued)
- 🔴 Red = High Load / Bottleneck (11+ jobs queued)
- ⚫ Black = Down / Error State

### AI-Powered Insights

**Gemini 2.0 Flash (FREE tier)** analyzes system every 15 minutes:

**Optimization Opportunities**:
- WF-02 Jewelry avg completion time is 45s (target: 30s)
- Suggestion: Consider upgrading to Gemini 2.5 Flash for 3x speed boost
- Estimated savings: ~15s per job, $0.02 cost reduction

**Capacity Planning**:
- Peak load today: 3:00-4:00 PM (47 concurrent jobs)
- Primary n8n instance at 78% capacity (warning threshold)
- Suggestion: Schedule secondary instance auto-scale at 70%

**Anomaly Detection**:
- WF-26 Billing received 3 failed Stripe webhooks (12-2 PM)
- Possible Stripe downtime or signature mismatch
- Action: Check Stripe dashboard, verify webhook secret

### Dashboard Modules

**Module 1: System Health Overview** (Hero Section)
- Real-time job count (updates every second via WebSocket)
- System uptime percentage (99.X%)
- Active jobs in progress
- Average completion time
- Revenue today

**Module 2: Workflow Network Map** (Center Stage)
- Animated graph showing job flow
- Workflow nodes (size = usage volume)
- Job paths (thickness = queue depth)
- Color coding (green/yellow/red health)
- Click to drill down

**Module 3: Workflow Ranking Table** (Left Panel)
- Sortable performance metrics
- Sparkline charts (24h trend)
- Click workflow → Detail view

**Module 4: AI Insights Panel** (Right Panel)
- Optimization suggestions
- Capacity warnings
- Anomaly alerts
- Cost projections

**Module 5: Live Activity Feed** (Bottom Ticker)
```
[12:34:56] Job #8471 → WF-07 → Completed (18.2s) ✅
[12:34:52] Job #8470 → WF-10 → Completed (8.1s) ✅
[12:34:48] Job #8469 → WF-06 → Failed (Timeout) ❌ [Auto-retry initiated]
[12:34:45] Job #8468 → WF-02 → In Progress (32s elapsed...)
[12:34:40] WF-24 Lifeguard → Refunded 5 credits to user_xyz ↩️
```

### Technical Implementation

**Data Sources**:
- **Primary**: Supabase PostgreSQL (jobs, error_logs, transactions)
- **Real-Time**: n8n Webhook Listeners (telemetry on job completion)
- **Cache**: Redis (Upstash free tier, 10k requests/day)

**Frontend Tech Stack**:
- **React**: Component-based UI for modular dashboard widgets
- **D3.js**: Data visualization (network graphs, charts, animations)
- **WebSockets**: Real-time updates (jobs appear instantly)
- **Tailwind CSS**: Rapid styling with dark mode support
- **Vercel**: Hosting (free tier)

**Backend: WF-28 Dashboard Telemetry** (n8n workflow):
```
Cron Trigger (every 60s)
  ↓
Query Supabase (jobs, error_logs, transactions)
  ↓
Aggregate metrics (jobs/workflow, success rates, revenue)
  ↓
Store in Redis cache
  ↓
Broadcast to WebSocket clients (dashboard)
  ↓
Run AI analysis (Gemini Flash) every 15min
  ↓
Post insights to dashboard
```

**WF-29: AI System Monitor** (runs every 15 minutes):
```javascript
Cron Trigger (*/15 * * * *)
  ↓
Fetch last 15min metrics from Redis
  ↓
Compare to baseline (last 7 days avg)
  ↓
Detect anomalies:
  - Success rate drop >5%
  - Avg time increase >50%
  - Error rate spike >3×
  - Unusual traffic patterns
  ↓
Generate AI insights via Gemini 2.0 Flash (FREE):
  Prompt: "Analyze this workflow performance data and suggest
           optimizations. Baseline: {baseline}, Current: {current}.
           Identify: 1) Performance regressions, 2) Cost optimization
           opportunities, 3) Capacity concerns, 4) Anomalies"
  ↓
Parse AI response → Structured insights
  ↓
Store in `ai_insights` table
  ↓
Broadcast to dashboard (WebSocket)
  ↓
If critical (P0): Send Slack alert #swiftlist-ops
```

### Cost Analysis

**Infrastructure Costs**:
- Dashboard Frontend (Vercel): **$0/month** (free tier)
- Redis Cache (Upstash): **$0/month** (10k requests/day free tier)
- WebSocket Server (Socket.io on Vercel): **$0/month** (low traffic)
- AI Analysis (Gemini 2.0 Flash): **$0/month** (FREE tier, 96 runs/day)

**Total Incremental Cost**: **$0/month**

(Assumes staying within free tiers. If traffic explodes, Redis Pro is $10/month, Vercel Pro is $20/month)

### Deployment Strategy

**Phase 1: MVP Dashboard** (Week 4-5 after launch)
- System health banner (jobs, uptime, avg time, revenue)
- Workflow ranking table (sortable by jobs/revenue/success)
- Simple AI insights (Gemini analyzes daily, posts to Slack)
- **Timeline**: 3-5 days
- **Tech**: React + Supabase polling (no WebSockets yet)

**Phase 2: Real-Time Network Viz** (Week 6-8)
- D3.js network graph showing workflow connections
- WebSocket integration for real-time updates
- Animated job flow (dots moving through system)
- **Timeline**: 1-2 weeks
- **Tech**: D3.js + Socket.io + real-time telemetry

**Phase 3: Advanced AI Co-Pilot** (Month 2-3)
- WF-29 AI Monitor (15min cron)
- Anomaly detection algorithms
- Predictive capacity planning
- Auto-scaling triggers
- **Timeline**: 2-3 weeks
- **Tech**: Gemini 2.0 Flash + ML baselines

### ROI Analysis

**Value Delivered**:

**1. Prevent Revenue Loss**:
- Detect WF-07 failure spike → Switch to fallback → Save ~$50/day in lost revenue
- Catch Stripe webhook issues → Prevent missed payments → $200+/week saved

**2. Reduce Support Load**:
- Auto-detect issues before users complain → 80% fewer "my job failed" tickets
- Estimated savings: 5 hours/week support time = $25/hour × 5 = $125/week

**3. Data-Driven Optimization**:
- See WF-10 has 100% margin → Market heavily → +20% signups = +$500/month revenue
- Identify slow workflows → Optimize → Better user experience → Higher retention

**Conservative ROI**: $200-500/month in prevented losses + reduced support costs

**Break-even**: Immediate (no ongoing costs)

### Recommendation: **BUILD Phase 1 in Week 4**

**Why**:
- Strategic necessity (not optional) for 27-workflow system
- Zero incremental cost ($0/month)
- No competitor has this (competitive differentiation)
- Scales operations as SwiftList grows
- Enables future features (auto-scaling, predictive pricing, user-facing status page)

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
    "lastFailure": "2026-01-03T10:15:00Z",
    "status": "healthy"
  },
  "claude-3.5-haiku": {
    "successRate": 0.98,
    "avgLatency": 1.8,
    "lastFailure": "2026-01-02T14:22:00Z",
    "status": "healthy"
  },
  "photoroom": {
    "successRate": 0.87,
    "avgLatency": 3.5,
    "lastFailure": "2026-01-03T11:45:00Z",
    "status": "degraded"
  }
}
```

---

## MVP ROADMAP

### Target Launch: January 15, 2026 (12 Days)

### Week 1 (Jan 3-9): Infrastructure & Core Workflows

**Days 1-2: Infrastructure Setup**
- [ ] Deploy primary Lightsail instance (n8n Docker)
- [ ] Deploy secondary Lightsail instance (standby)
- [ ] Configure Route 53 health checks
- [ ] Set up RDS PostgreSQL with schema (including presets table)
- [ ] Configure S3 buckets for asset storage
- [ ] Deploy Amplify React app (basic shell)

**Days 3-5: Critical Workflows**
- [ ] WF-01: The Decider (with preset recommendations + fallback logic)
- [ ] WF-26: Billing & Top-Up (Stripe integration)
- [ ] WF-07: Background Removal (Photoroom + fallbacks)
- [ ] WF-06: General Goods Engine (Stability AI)
- [ ] WF-24: Lifeguard (auto-refund system)

**Days 6-7: Preset Library Setup**
- [ ] Import 25 official presets to database
- [ ] Generate embeddings using Gemini 2.0 Flash
- [ ] Build preset marketplace UI (browse by category)
- [ ] Test preset recommendations in WF-01

### Week 2 (Jan 10-15): Product Engines & Launch Prep

**Days 8-10: Specialty Engines & Content**
- [ ] WF-02: Jewelry Precision Engine
- [ ] WF-08: Simplify BG (GraphicsMagick)
- [ ] WF-10: Product Description Generator
- [ ] WF-17: Generate Preset (pgvector)
- [ ] WF-23: Market Optimizer (preset recommendations)
- [ ] WF-27: Referral Engine

**Days 11-12: Integration Testing**
- [ ] Test full job flow (upload → WF-01 → WF-06 → WF-08 → preset application → output)
- [ ] Test credit deductions and royalty payments
- [ ] Test Stripe webhooks
- [ ] Test failover (kill primary instance, verify recovery)
- [ ] Load test (100 concurrent jobs)
- [ ] Test all 25 presets on sample products

**Days 13-14: Launch Prep & eBay Partnership**
- [ ] Build simple admin dashboard (basic KPIs)
- [ ] Implement A/B test framework
- [ ] Set up first test (signup CTA)
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

### Week 3-4: Mission Control & Iteration

**Week 3 (Jan 16-22): Mission Control Phase 1**
- [ ] Build WF-28: Dashboard Telemetry (n8n workflow)
- [ ] Set up Redis cache (Upstash free tier)
- [ ] Build React dashboard with system health banner
- [ ] Add workflow ranking table (sortable)
- [ ] Implement basic AI insights (Gemini daily analysis)

**Week 4 (Jan 23-29): Optimization & Features**
- [ ] Add WF-29: AI System Monitor (15min anomaly detection)
- [ ] Implement WebSocket real-time updates
- [ ] Add live activity feed
- [ ] Build Phase 2 workflows based on beta feedback
- [ ] Launch first preset creation contest

### Post-Launch (Month 2+)

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

### Jobs Table with Specialty Metadata (Tag-Based Architecture)

```sql
-- Jobs table with specialty metadata for tag-based architecture
CREATE TABLE public.jobs (
  job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES public.profiles(user_id),

  -- Original input
  original_image_url TEXT NOT NULL,

  -- Specialty metadata (from WF-01 analysis) - TAG-BASED ARCHITECTURE
  category TEXT,           -- jewelry, fashion, glass, liquid, furniture, general
  specialty_engine TEXT,   -- WF-02, WF-03, WF-04, WF-05, WF-06
  material TEXT,           -- metal, fabric, glass, wood, plastic, other
  complexity TEXT,         -- simple, complex

  -- User preferences
  marketplace TEXT,        -- ebay, etsy, amazon, shopify
  preset_id UUID REFERENCES public.presets(preset_id),

  -- Workflow execution (tag-based: user selects workflows, NOT routed by WF-01)
  requested_workflows TEXT[],  -- User's selected workflows ["WF-07", "WF-14", "WF-16"]
  current_image_url TEXT,      -- Latest output from workflow chain
  workflow_chain TEXT[],       -- Execution history ["WF-01", "WF-07", "WF-14"]

  -- Credits & cost
  credits_charged INTEGER,
  ai_cost_usd DECIMAL(10, 4),

  -- Status
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Job logging (added 2026-01-10)
  processing_time_seconds INTEGER  -- Total processing time, calculated on completion
);

-- Indexes for specialty queries
CREATE INDEX idx_jobs_specialty ON jobs(specialty_engine, status);
CREATE INDEX idx_jobs_category ON jobs(category, created_at DESC);
CREATE INDEX idx_jobs_user_status ON jobs(user_id, status);

-- Indexes for job logging and performance analytics (added 2026-01-10)
CREATE INDEX idx_jobs_processing_time ON jobs(processing_time_seconds DESC NULLS LAST) WHERE processing_time_seconds IS NOT NULL;
CREATE INDEX idx_jobs_workflow_time ON jobs(workflow_chain, processing_time_seconds DESC) WHERE processing_time_seconds IS NOT NULL;
```

**Key Architectural Changes**:
- **Tag-based, NOT routing**: WF-01 tags jobs with `specialty_engine` metadata
- **User controls workflow selection**: `requested_workflows` array contains user's selected workflows
- **Composable system**: Any workflow can be used with any specialty category
- **11 specialty-aware workflows** check `specialty_engine` tag and apply category-specific logic

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

### Job Events Audit Log Table (Added 2026-01-10)

**Purpose**: Granular event tracking for workflow execution debugging, performance analysis, and customer support.

```sql
-- Job events audit log for granular execution tracking
CREATE TABLE public.job_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL,

  -- Event classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'workflow_start',
    'workflow_complete',
    'api_call',
    'error',
    'retry',
    'timeout'
  )),

  -- Workflow identification
  workflow_id TEXT,  -- WF-01, WF-07, WF-46, etc.

  -- Timing information
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,  -- How long this event/operation took

  -- Flexible metadata storage (JSON)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Constraints
  CONSTRAINT fk_job_events_job
    FOREIGN KEY (job_id)
    REFERENCES public.jobs(job_id)
    ON DELETE CASCADE,  -- GDPR compliance: delete events when job deleted

  CONSTRAINT chk_duration_positive
    CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

-- Indexes for fast queries
CREATE INDEX idx_job_events_job_timestamp ON job_events(job_id, event_timestamp DESC);
CREATE INDEX idx_job_events_workflow_timestamp ON job_events(workflow_id, event_timestamp DESC) WHERE workflow_id IS NOT NULL;
CREATE INDEX idx_job_events_type_timestamp ON job_events(event_type, event_timestamp DESC);
CREATE INDEX idx_job_events_workflow_type ON job_events(workflow_id, event_type, event_timestamp DESC) WHERE workflow_id IS NOT NULL;
CREATE INDEX idx_job_events_metadata ON job_events USING GIN (metadata);

-- Row Level Security (RLS) policies
ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job events"
ON job_events FOR SELECT
USING (
  job_id IN (
    SELECT job_id FROM jobs WHERE user_id = auth.uid()::TEXT
  )
);

CREATE POLICY "Backend can insert job events"
ON job_events FOR INSERT
WITH CHECK (true);  -- Service role only

CREATE POLICY "Job events are immutable"
ON job_events FOR UPDATE
USING (false);  -- No updates allowed - audit log

CREATE POLICY "Job events cascade delete only"
ON job_events FOR DELETE
USING (false);  -- Only CASCADE deletes allowed
```

**Use Cases**:
- **Customer Support**: View execution timeline when user reports issue
- **Performance Analysis**: Identify bottlenecks (which API calls take longest)
- **Cost Tracking**: Track API costs per workflow execution
- **Debugging**: Full event history for failed jobs
- **Analytics**: Average processing time per workflow type

**Example Query**:
```sql
-- Get execution timeline for a job
SELECT
  event_type,
  workflow_id,
  event_timestamp,
  duration_ms,
  metadata
FROM job_events
WHERE job_id = 'abc-123-xyz'
ORDER BY event_timestamp ASC;
```

**Google Sheets Sync**: WF-28 (Job Log Exporter) syncs jobs table to Google Sheets every 5 minutes for easy non-technical access. See Workflow Catalog section for details.

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
| Mission Control (Vercel + Redis + WebSockets) | $0 |
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
| WF-11 | Twitter Post Generator | 3 | Medium | Phase 2 |
| WF-12 | Instagram Post Generator | 3 | Medium | Phase 2 |
| WF-13 | Facebook Post Generator | 3 | Medium | Phase 2 |
| WF-14 | High-Res Upscale | 4 | Medium | Phase 3 |
| WF-15 | Color Variants | 4 | Low | Phase 3 |
| WF-16 | 360° Spin | 5 | Low | Phase 3 |
| WF-17 | Generate Preset | 5 | High | Ready to build |
| WF-18 | Animation | 5 | Low | Phase 3 |
| WF-19 | Product Collage | 4 | Medium | Phase 3 |
| WF-20 | SEO Blog Post | 3 | Low | Phase 3 |
| WF-21 | AI Model Swap | 5 | Low | Phase 4 |
| WF-22 | Voice-to-Description | 5 | Low | Phase 4 |
| WF-23 | Market Optimizer | 6 | Medium | Ready to build |
| WF-24 | Lifeguard | 6 | CRITICAL | Ready to build |
| WF-25 | Marketplace Compliance | 6 | Medium | Ready to build |
| WF-26 | Billing & Top-Up | 1 | CRITICAL | Ready to build |
| WF-27 | Referral Engine | 1 | CRITICAL | Ready to build |

**MVP Scope (Week 1-2)**: WF-01, 02, 06, 07, 08, 10, 17, 23, 24, 26, 27

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

### v2.1 (January 5, 2026)

**Major Updates**:
- ✅ **NEW**: Tag-Based Specialty Architecture section
  - Complete architectural redesign from routing to tag-based metadata system
  - WF-01 now tags jobs instead of routing to specialty engines
  - 11 specialty-aware workflows check tags and apply category-specific logic
  - Specialty logic modules (jewelry, fashion, glass, furniture, general)
  - Composable system: any workflow works with any specialty category
- ✅ **UPDATED**: WF-01 Orchestrator description
  - Changed from "Routes all jobs to specialized engines" to "Analyzes and tags jobs with specialty metadata"
  - Outputs specialty metadata: category, specialty_engine, material, complexity
  - Executes user's requested workflows (user controls workflow selection)
- ✅ **UPDATED**: WF-02 through WF-06 descriptions
  - Changed from standalone engines to specialty logic modules
  - Node.js modules providing parameters for 11 specialty-aware workflows
  - $0 cost (logic modules, not API calls)
- ✅ **UPDATED**: 11 specialty-aware workflow descriptions
  - WF-07, WF-08, WF-09, WF-10, WF-14, WF-15, WF-16, WF-18, WF-19, WF-21, WF-25
  - Added "Specialty Logic" section to each workflow
  - WF-16 and WF-18 marked as **CRITICAL** for specialty logic
  - Detailed category-specific parameters documented
- ✅ **NEW**: Jobs table schema with specialty metadata
  - Added columns: category, specialty_engine, material, complexity
  - Added columns: requested_workflows (TEXT[]), workflow_chain (TEXT[])
  - Added indexes for specialty queries
  - Documented tag-based architecture in schema notes
- ✅ **NEW**: Specialty logic modules documentation
  - `/SwiftList/specialty-logic-modules/` directory structure
  - 6 module files: JewelrySpecialty.js, FashionSpecialty.js, GlassSpecialty.js, FurnitureSpecialty.js, GeneralSpecialty.js, index.js
  - Complete usage examples for n8n workflows

**Architectural Impact**:
- Enables composability: jewelry products can now use WF-07, WF-14, WF-16, WF-25, etc.
- Future-proof: new workflows automatically support all specialty categories
- Extensible: new categories (electronics, food) can be added without modifying existing workflows
- DRY: specialty logic centralized, not duplicated across 11 workflows

### v2.0 (January 3, 2026)

**Major Updates**:
- ✅ **NEW**: Security Enforcement System section
  - Automatic security measures for all backend code generation
  - `.claude/CLAUDE.md` with mandatory security rules
  - `.claude/skills/secure-code-builder.md` auto-invoked skill
  - Pre-launch security checklist (10 items)
  - Authentication, authorization, input validation, rate limiting, RLS all automatic
  - Estimated 40-80 hours developer time savings for MVP
  - $0/month additional infrastructure cost
- ✅ Updated Table of Contents to include Security Enforcement System (section 3)
- ✅ Updated Executive Summary with security enforcement status

### v1.9 (January 3, 2026)

**Major Updates**:
- ✅ **NEW**: Added Visual Presets Library section (25 curated presets from Content Factory)
  - Database schema for presets table with pgvector support
  - Integration with WF-01 Decider and WF-23 Market Optimizer
  - Featured artist styles: Lyle Hehn (×2), Steven Noble (×2), Hiker Booty (×1)
  - All official presets FREE strategy
- ✅ **NEW**: Added Mission Control Dashboard section
  - Real-time workflow monitoring system ($0/month using free tiers)
  - AI-powered insights via Gemini 2.0 Flash (FREE tier)
  - Live job flow visualization with WebSocket updates
  - Comprehensive KPI tracking across Financial, Operational, Product metrics
  - WF-28 Dashboard Telemetry and WF-29 AI System Monitor workflows
- ✅ **UPDATED**: Statistics in Executive Summary
  - Average Margin: 85% → **93.2%**
  - Monthly Infrastructure Cost: $139 → **$85.50** (corrected to $56 base)
  - Added: Mission Control Dashboard: $0/month (free tiers)
- ✅ **UPDATED**: Workflow names in All 27 n8n Workflows section
  - WF-11: "Twitter Post Generator" (was Title Optimizer)
  - WF-12: "Instagram Post Generator" (was Bullet Points Generator)
  - WF-13: "Facebook Post Generator" (was Keyword Extractor)
  - WF-17: "Generate Preset" (was Social Media Captions)
  - WF-23: "Market Optimizer" (was Preset Discovery Engine / Asset Optimizer)
- ✅ Updated Table of Contents to include new sections
- ✅ Enhanced WF-01 Decider to include preset recommendations
- ✅ Updated MVP Roadmap to include preset library setup and Mission Control Phase 1

**Note**: Infrastructure cost corrected from $139 to $56 base (Mission Control adds $0).

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
**Monitoring**: CloudWatch + Slack alerts + Mission Control Dashboard

**Deployment**: Automated via GitHub Actions (TBD)

---

**END OF TDD v2.0**

*Last Updated: January 3, 2026*
*Next Review: Daily (per protocol)*
*Next Version: v2.1 (next session)*
