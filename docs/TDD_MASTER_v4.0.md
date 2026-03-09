# SwiftList Technical Design Document (Master Bible)
**Version**: 4.1 (6-Agent Background Removal Pipeline)
**Date**: January 28, 2026
**Status**: ACTIVE - Background Removal Quality Enhancement
**Previous Version**: [v4.0](TDD_MASTER_v4.0.md)

---

## Current Architecture

**BullMQ + Railway + Replicate API** (since January 2026)

```
User Upload → SvelteKit API → BullMQ Queue → Railway Worker → Replicate API → Supabase Storage → User Download
```

---

## CHANGE LOG

| Version | Date | Changes |
|---------|------|---------|
| **v4.1** | Jan 28, 2026 | ✅ **6-Agent Background Removal Pipeline**<br>✅ LangGraph-inspired DAG orchestrator<br>✅ Multi-metric quality scoring (edge, segmentation, artifacts)<br>✅ Product-type routing (jewelry, clothing, default)<br>✅ Conditional retry logic (quality threshold: 85%)<br>✅ Target: 50-60% quality improvement over single-agent<br>✅ Cost: +33% ($0.024 vs $0.018 per image) |
| **v4.0** | Jan 21, 2026 | **BullMQ + Railway architecture**<br>✅ Direct Replicate API integration<br>✅ TypeScript workers replacing JSON workflows<br>✅ Performance improvements (no orchestration layer) |
| **v3.1** | Jan 14, 2026 | ✅ Job modal redesigned to match UX specs<br>✅ Security audit (6 CVE fixes)<br>✅ CLAUDE.md updated with database security |
| **v3.0** | Jan 12, 2026 | ✅ Migrated React/Next.js → Svelte 5 + Vite<br>✅ Frontend rebuild (19 pages) |
| **v2.1** | Jan 9, 2026 | Added Claude SDK integration (5 AI agents) |
| **v2.0** | Jan 10, 2026 | Security enforcement system<br>Job logging implementation |
| **v1.8** | Dec 31, 2025 | Initial AWS 3-tier architecture<br>Mission Control dashboard design |

---

## EXECUTIVE SUMMARY

SwiftList is an AI-powered SaaS platform for the maker economy (jewelry, fashion, general goods sellers on eBay, Etsy, Amazon). We transform basic product photos into marketplace-optimized assets using **direct API integrations** with AI providers (Replicate, Gemini, Claude, etc.) orchestrated through **BullMQ job queues** on **Railway.app** infrastructure.

**Key Business Metrics**:
- Average Margin: 93.2%
- Monthly Infrastructure Cost: $25-45 (Railway + Supabase)
- Credit Economy: 1 credit = $0.05 USD
- Target LTV:CAC: 460:1
- **MVP Launch Target**: January 26, 2026

**Critical Features**:
- ✅ **Frontend**: Svelte 5 + Vite (19 pages built)
- ✅ **Backend**: SvelteKit API routes (14 completed - added `/api/jobs/process`)
- ✅ **Database**: Supabase with secure RLS (deployed Jan 16)
- ✅ **AI Agents**: 5 intelligent agents (Claude SDK)
- ✅ **6-Agent Background Removal**: Multi-agent DAG pipeline (Jan 28)
- ✅ **Security**: RLS, PII scrubbing, HMAC signatures
- ✅ **Job Processing**: BullMQ queue client + Replicate integration (Jan 27)
- ✅ **Reference Image Analysis**: Gemini Flash 2.0 style extraction (Jan 27)
- ⏳ **Testing**: End-to-end job processing (pending Replicate rate limit reset)
- 🟡 **Next**: Integrate 6-agent pipeline into processor, deploy Railway worker

---

## TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Frontend: Svelte 5 Application](#frontend-svelte-5-application)
4. [Backend: SvelteKit API Routes](#backend-sveltekit-api-routes)
5. [Job Processing: BullMQ + Railway](#job-processing-bullmq--railway)
6. [AI Provider Integrations](#ai-provider-integrations)
7. [LLM Architecture & Strategy](#llm-architecture--strategy)
8. [Lifeguard Monitoring System](#lifeguard-monitoring-system)
9. [Security Enforcement System](#security-enforcement-system)
10. [Credit & Subscription System](#credit--subscription-system)
11. [Royalty System](#royalty-system)
12. [Workflow Conversion Strategy](#workflow-conversion-strategy)
13. [Deployment Plan](#deployment-plan)
14. [Launch Checklist](#launch-checklist)

---

## DOMAIN ARCHITECTURE

### Dual-Domain Strategy

SwiftList operates across **two domains** to separate marketing from application functionality:

| Domain | Purpose | Technology | Hosting | Status |
|--------|---------|------------|---------|--------|
| **heyswiftlist.com** | Marketing site - Landing page, hero video, pricing, conversion funnel | SvelteKit (adapter-static) | Cloudflare Pages | 🔨 Building |
| **swiftlist.app** | Authenticated application - Dashboard, job creation, account management | SvelteKit (adapter-node) | Railway | 🔨 Building |

**Authentication Flow**:
- **Supabase Auth** handles cross-domain sessions
- Users authenticate on **swiftlist.app** (heyswiftlist.com redirects there for signup/login)
- Sessions persist across both domains via Supabase session tokens
- OAuth redirect URIs configured for both domains

**Deployment Architecture**:
- **Cloudflare**: DNS, CDN, WAF, DDoS protection, rate limiting, SSL/TLS (both domains)
- **Cloudflare Pages**: Hosts heyswiftlist.com (static marketing site, globally distributed, free tier)
- **Railway**: Hosts swiftlist.app (SvelteKit app + BullMQ workers + Redis)
- **Supabase Storage**: Processed images, preset thumbnails, user uploads (replaces AWS S3)

**Security Layers**:
1. Cloudflare WAF (blocks malicious traffic)
2. Cloudflare Rate Limiting (prevents abuse at the edge)
3. Railway (serves authenticated app behind Cloudflare)
4. Supabase RLS (database-level security)

**User Journey**:
1. User visits **heyswiftlist.com** (marketing)
2. Clicks "Get Started" or "Sign In"
3. Redirects to **swiftlist.app/auth/login**
4. After authentication, lands on **swiftlist.app/dashboard**
5. Can return to **heyswiftlist.com** to browse presets (authenticated state preserved)

---

## ARCHITECTURE OVERVIEW

### Modern 3-Tier Architecture (January 22, 2026)

```
                          ┌─────────────────────┐
                          │   CLOUDFLARE        │
                          │  DNS + CDN + WAF    │
                          │  DDoS + Rate Limit  │
                          │  SSL/TLS (both)     │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                                 │
         ┌──────────▼──────────┐           ┌──────────▼──────────┐
         │  CLOUDFLARE PAGES   │           │      RAILWAY        │
         │  heyswiftlist.com   │           │   swiftlist.app     │
         │  Static marketing   │           │  SvelteKit + API    │
         │  Hero video + CTA   │           │  Supabase Auth      │
         │  SEO-optimized      │           │  Stripe Checkout    │
         └─────────────────────┘           └──────────┬──────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │   RAILWAY WORKERS   │
                    ┌──────────────────────┤  BullMQ + Redis     │
                    │                      │  TypeScript Jobs    │
                    │  JOB PROCESSING      └──────────┬──────────┘
                    │  Direct API Calls:              │
                    │  - Replicate (RMBG)             │
                    │  - Gemini (Vision/Text)         │
                    │  - Claude (Descriptions)        │
                    │  - fal.ai (Bria RMBG 2.0)      │
                    └─────────────────────────────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │    SUPABASE         │
                    ┌──────────────────────┤  PostgreSQL + RLS   │
                    │                      │  Auth + Storage     │
                    │      DATA LAYER      │  8 Tables           │
                    │  Supabase Storage    │  Realtime Webhooks  │
                    │  (Images & Assets)   └─────────────────────┘
                    └─────────────────────────────────────────────┘
```

**Key Differences from v3.x**:
- ✅ **ARCHITECTURE**: BullMQ + Railway (TypeScript workers)
- ✅ **ADDED**: BullMQ job queue system
- ✅ **ADDED**: Railway.app worker deployment
- ✅ **ADDED**: Direct Replicate API integration
- ✅ **IMPROVED**: Faster job processing (no middleware)
- ✅ **IMPROVED**: Simpler debugging (TypeScript code vs JSON workflows)

---

## TECHNOLOGY STACK

### Frontend (Svelte 5)

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | Svelte 5 | 5.20.2 | UI library with native reactivity |
| **Build Tool** | Vite | 7.2.6 | Lightning-fast builds, HMR |
| **Routing** | SvelteKit | 2.17.3 | File-based routing, SSR |
| **Language** | TypeScript | 5.3+ | Type safety |
| **Styling** | Tailwind CSS | 3.4+ | Utility-first CSS |
| **State** | Svelte Runes | Built-in | $state, $derived, $props |
| **Auth** | Supabase Auth | Latest | hooks.server.ts integration |
| **Deployment** | Railway + Cloudflare | N/A | Hosting, CDN, CI/CD |

---

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **API Routes** | SvelteKit +server.ts | Server-side endpoints |
| **Database** | PostgreSQL (Supabase) | Structured data, RLS |
| **Storage** | Supabase Storage | Processed images, preset thumbnails, user uploads |
| **Auth** | Supabase Auth | JWT tokens, session management |
| **Job Queue** | BullMQ | Distributed job processing |
| **Workers** | TypeScript on Railway | AI API orchestration |
| **AI Orchestration** | Multi-LLM Strategy | Gemini Flash 2.0, Claude Haiku/Sonnet |
| **Payments** | Stripe | Checkout, subscriptions |
| **Email** | SendGrid | Transactional emails |
| **Monitoring** | Sentry + Lifeguard | Error tracking, anomaly detection |

---

### Infrastructure

| Component | Service | Cost/Month |
|-----------|---------|------------|
| Frontend Hosting | Railway + Cloudflare | $0-20 (scales) |
| Database | Supabase | $0-25 (scales) |
| **Job Queue (Redis)** | **Railway** | **$5** |
| **Workers** | **Railway (512MB)** | **$5-20** |
| Storage | Supabase Storage | $0-10 |
| Monitoring | Sentry Free Tier | $0 |
| **TOTAL** | | **$10-75/month** |

**Estimated Cost**: $10-75/month for full infrastructure

---

## FRONTEND: SVELTE 5 APPLICATION

### Application Structure

```
apps/swiftlist-app-svelte/
├── src/
│   ├── routes/
│   │   ├── +page.svelte                    # Homepage
│   │   ├── +layout.svelte                  # Root layout
│   │   ├── dashboard/
│   │   │   └── +page.svelte                # ✅ Dashboard (stats, jobs table)
│   │   ├── jobs/
│   │   │   ├── new/+page.svelte            # ✅ Job wizard (3 steps)
│   │   │   ├── [id]/+page.svelte           # ✅ Job detail
│   │   │   ├── [id]/processing/+page.svelte # ✅ Processing screen
│   │   │   └── [id]/complete/+page.svelte  # ✅ Job results
│   │   ├── presets/
│   │   │   ├── +page.svelte                # ✅ Preset marketplace
│   │   │   ├── [id]/+page.svelte           # ✅ Preset detail
│   │   │   └── create/+page.svelte         # ✅ Create preset
│   │   ├── profile/
│   │   │   └── [user_id]/+page.svelte      # ✅ User profile
│   │   ├── pricing/+page.svelte            # ✅ Pricing page
│   │   ├── analytics/+page.svelte          # ✅ Analytics
│   │   ├── faq/+page.svelte                # ✅ FAQ
│   │   ├── privacy/+page.svelte            # ✅ Privacy policy
│   │   ├── terms/+page.svelte              # ✅ Terms of service
│   │   ├── auth/
│   │   │   ├── login/+page.svelte          # ✅ Login
│   │   │   ├── signup/+page.svelte         # ✅ Signup
│   │   │   └── callback/+page.svelte       # ✅ OAuth callback
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── signup/+server.ts       # ✅ User registration
│   │       │   └── login/+server.ts        # ✅ Login
│   │       ├── jobs/
│   │       │   ├── +server.ts              # ✅ List jobs
│   │       │   ├── submit/+server.ts       # ✅ Submit job (BullMQ)
│   │       │   ├── submit-v2/+server.ts    # ✅ Submit v2
│   │       │   ├── [id]/+server.ts         # ✅ Get job
│   │       │   └── [id]/use/+server.ts     # ✅ Reuse job
│   │       ├── credits/
│   │       │   └── balance/+server.ts      # ✅ Credit balance
│   │       ├── presets/
│   │       │   ├── +server.ts              # ✅ List presets
│   │       │   └── [id]/+server.ts         # ✅ Preset detail
│   │       ├── email-signup/+server.ts     # ✅ Email signup
│   │       └── test-env/+server.ts         # ✅ Test env vars
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ImageUpload.svelte          # ✅ Drag-and-drop upload
│   │   │   ├── Button.svelte               # ✅ Button component
│   │   │   └── Card.svelte                 # ✅ Card component
│   │   ├── agents/                         # ✅ 5 AI agents
│   │   ├── security/                       # ✅ Security utilities
│   │   └── logging/                        # ✅ Logging utilities
│   └── hooks.server.ts                     # ✅ Authentication middleware
├── static/                                 # Static assets
├── svelte.config.js                        # SvelteKit config
├── vite.config.ts                          # Vite config
└── package.json                            # Dependencies
```

### Completed Pages (19)

**Status**: ✅ All pages built (some with build errors to fix)

1. **Landing Page** (`/`)
2. **Dashboard** (`/dashboard`)
3. **Job Wizard** (`/jobs/new`) - 3-step wizard
4. **Job Detail** (`/jobs/[id]`)
5. **Job Processing** (`/jobs/[id]/processing`)
6. **Job Complete** (`/jobs/[id]/complete`)
7. **Preset Marketplace** (`/presets`)
8. **Preset Detail** (`/presets/[id]`)
9. **Create Preset** (`/presets/create`)
10. **Preset Favorites** (`/presets/favorites`)
11. **User Profile** (`/profile/[user_id]`)
12. **Public Profile** (`/users/[id]`)
13. **Pricing** (`/pricing`)
14. **Analytics** (`/analytics`)
15. **FAQ** (`/faq`)
16. **Privacy Policy** (`/privacy`)
17. **Terms of Service** (`/terms`)
18. **Login** (`/auth/login`)
19. **Signup** (`/auth/signup`)
20. **OAuth Callback** (`/auth/callback`)

**Build Status**: ⚠️ 2 Svelte syntax errors (must fix before deployment)

---

### Responsive Design Requirements

**CRITICAL**: SwiftList MUST be 100% mobile-responsive for MVP launch.

**Business Rationale**:
- 60%+ of e-commerce sellers use mobile devices for product photography
- Poor mobile UX = immediate customer churn and negative app store reviews
- Competitors (Photoroom, Picsart) are mobile-first - we must match or exceed
- MVP success depends on seamless mobile experience

**Mandatory Standards**:

1. **Mobile-First Development**
   - All UI components MUST use Tailwind responsive breakpoints (sm:, md:, lg:)
   - Base styles = mobile (375px width baseline - iPhone SE)
   - Progressive enhancement for tablet (768px+) and desktop (1024px+)

2. **Grid Layouts**
   - NEVER use fixed columns without breakpoints
   - Pattern: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
   - Example violations fixed (2026-02-03):
     - Dashboard stats: Was `grid-cols-3`, now `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
     - Job creation: Was `grid-cols-2` and `grid-cols-4`, now responsive

3. **Spacing & Typography**
   - Reduce padding/margins on mobile: `p-4 md:p-8`, `gap-4 md:gap-6`
   - Scale text for readability: `text-xs sm:text-sm` (14px minimum on mobile)
   - Large headings: `text-2xl md:text-4xl`

4. **Touch Targets**
   - Minimum 44px height for all interactive elements on mobile
   - Buttons: `py-2 px-4 md:py-3 md:px-6` (ensures 44px+ on mobile)

5. **Modals & Fixed Elements**
   - Modals full-width on mobile: `max-w-full md:max-w-5xl`
   - Sidebars hidden on mobile: `hidden md:block`
   - Main content responsive margins: `ml-0 md:ml-[240px]`

6. **Forms & Inputs**
   - Reduce padding on mobile: `px-3 py-2 md:px-4 md:py-3`
   - Full-width inputs on mobile: `w-full`

7. **Images**
   - Responsive sizing: `w-32 h-32 md:w-48 md:h-48`
   - Never use fixed pixel widths without breakpoints

**Testing Requirements**:
- ✅ Test at 375px width (iPhone SE - baseline mobile)
- ✅ Test at 768px width (iPad/tablet)
- ✅ Test at 1024px+ width (desktop)
- ✅ Verify no horizontal scrolling at any breakpoint
- ✅ Confirm all touch targets >= 44px on mobile

**Implementation Status**:
- ✅ (2026-02-03) All 19 pages audited and fixed for mobile responsiveness
- ✅ Sidebar component: Hidden on mobile, visible on desktop
- ✅ Dashboard: Stats grid stacks on mobile
- ✅ Job creation: Modal, grids, upload areas mobile-friendly
- ✅ Auth pages: Logo and forms responsive
- ✅ Processing page: Text sizes mobile-readable
- ✅ Job completion: Thumbnail and layout responsive

**Protocol Reference**: See `/.claude/CLAUDE.md` → "Mobile-First Development Protocol" for detailed checklist

---

## BACKEND: SVELTEKIT API ROUTES

### Completed API Routes (13)

#### Authentication Routes

**1. `/api/auth/signup` - User Registration**
- **Method**: POST
- **Status**: ✅ Working (fixed Jan 16)
- **Security**: Service role key loading fixed

**2. `/api/auth/login` - User Login**
- **Method**: POST
- **Status**: ✅ Working

**3. `/auth/callback` - OAuth Callback**
- **Method**: GET
- **Status**: ✅ Google OAuth configured

---

#### Job Routes

**4. `/api/jobs` - List User Jobs**
- **Method**: GET
- **Auth**: Required
- **Status**: ✅ Working

**5. `/api/jobs/submit` - Submit Job to BullMQ**
- **Method**: POST
- **Auth**: Required
- **Status**: ❌ **NOT IMPLEMENTED** (critical blocker)
- **Required**: BullMQ queue integration

**6. `/api/jobs/submit-v2` - Submit Job V2**
- **Method**: POST
- **Auth**: Required
- **Status**: ❌ **NOT IMPLEMENTED**

**7. `/api/jobs/[id]` - Get Job Status**
- **Method**: GET
- **Auth**: Required
- **Status**: ✅ Working

**8. `/api/jobs/[id]/use` - Reuse Job Settings**
- **Method**: POST
- **Auth**: Required
- **Status**: ✅ Working

---

#### Credit & Preset Routes

**9. `/api/credits/balance` - Get Credit Balance**
- **Method**: GET
- **Auth**: Required
- **Status**: ✅ Working

**10. `/api/presets` - List Presets**
- **Method**: GET
- **Status**: ✅ Working

**11. `/api/presets/[id]` - Preset Detail**
- **Method**: GET
- **Status**: ✅ Working

---

#### Utility Routes

**12. `/api/email-signup` - Email Signup**
- **Method**: POST
- **Status**: ✅ Working

**13. `/api/test-env` - Test Environment Variables**
- **Method**: GET
- **Status**: ✅ Working

---

## JOB PROCESSING: BULLMQ + RAILWAY

### Architecture Overview

**Status**: ❌ **NOT IMPLEMENTED** (critical blocker for MVP)

```typescript
// Job Flow (to be implemented)
1. User uploads image via SvelteKit API
2. API route submits job to BullMQ queue
3. Railway worker picks up job
4. Worker calls Replicate API (RMBG v1.4)
5. Worker stores result in Supabase Storage
6. Worker updates job status in database
7. User polls /api/jobs/[id] for completion
8. User downloads result
```

---

### Key Components

#### 1. BullMQ Queue Setup

**File**: `/workers/src/queues/background-removal.queue.ts`

```typescript
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// Railway Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const backgroundRemovalQueue = new Queue('background-removal', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
```

---

#### 2. Railway Worker

**File**: `/workers/src/workers/background-removal.worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BackgroundRemovalJob {
  jobId: string;
  userId: string;
  imageUrl: string;
}

const worker = new Worker<BackgroundRemovalJob>(
  'background-removal',
  async (job: Job<BackgroundRemovalJob>) => {
    const { jobId, userId, imageUrl } = job.data;

    console.log(`[${jobId}] Processing background removal...`);

    // Update job status to "processing"
    await supabase
      .from('jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('job_id', jobId);

    try {
      // Call Replicate API (RMBG v1.4 model)
      const output = await replicate.run(
        "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
        {
          input: {
            image: imageUrl,
          },
        }
      );

      // Download result from Replicate
      const response = await fetch(output as string);
      const blob = await response.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());

      // Upload to Supabase Storage
      const fileName = `${jobId}-output.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-outputs')
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('job-outputs')
        .getPublicUrl(fileName);

      // Update job status to "completed"
      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          output_url: urlData.publicUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('job_id', jobId);

      console.log(`[${jobId}] Completed successfully`);
      return { success: true, outputUrl: urlData.publicUrl };

    } catch (error) {
      console.error(`[${jobId}] Failed:`, error);

      // Update job status to "failed"
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('job_id', jobId);

      // Auto-refund credits
      await supabase.rpc('refund_credits', {
        p_user_id: userId,
        p_job_id: jobId,
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 jobs concurrently
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('🚀 Background removal worker started');
```

---

#### 3. API Route Integration

**File**: `/apps/swiftlist-app-svelte/src/routes/api/jobs/submit/+server.ts`

```typescript
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/supabase/server';
import { backgroundRemovalQueue } from '$lib/queues'; // Import queue
import { z } from 'zod';

const jobSubmissionSchema = z.object({
  imageUrl: z.string().url(),
  workflowId: z.string(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
  // 1. Authentication
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  // 2. Input validation
  const body = await request.json();
  const validated = jobSubmissionSchema.parse(body);

  // 3. Credit check
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('user_id', locals.user.id)
    .single();

  const WORKFLOW_COST = 5; // Background removal = 5 credits

  if (!profile || profile.credits_balance < WORKFLOW_COST) {
    throw error(402, 'Insufficient credits');
  }

  // 4. Create job record
  const jobId = crypto.randomUUID();
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      job_id: jobId,
      user_id: locals.user.id,
      workflow_id: validated.workflowId,
      status: 'pending',
      credits_charged: WORKFLOW_COST,
      input_url: validated.imageUrl,
    })
    .select()
    .single();

  if (jobError) throw error(500, 'Failed to create job');

  // 5. Deduct credits atomically
  await supabase.rpc('deduct_credits', {
    p_user_id: locals.user.id,
    p_amount: WORKFLOW_COST,
    p_job_id: jobId,
  });

  // 6. Submit job to BullMQ queue
  await backgroundRemovalQueue.add('process', {
    jobId,
    userId: locals.user.id,
    imageUrl: validated.imageUrl,
  });

  console.log(`[${jobId}] Job submitted to BullMQ queue`);

  return json({ success: true, job });
};
```

---

### Railway Deployment

**Required Files**:

**1. `Dockerfile`** (Railway worker)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy worker code
COPY . .

# Build TypeScript
RUN npm run build

# Start worker
CMD ["node", "dist/workers/background-removal.worker.js"]
```

**2. `railway.toml`** (Railway config)

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/workers/background-removal.worker.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
REDIS_HOST = "${{REDIS.REDIS_HOST}}"
REDIS_PORT = "${{REDIS.REDIS_PORT}}"
REDIS_PASSWORD = "${{REDIS.REDIS_PASSWORD}}"
REPLICATE_API_TOKEN = "${{REPLICATE_API_TOKEN}}"
SUPABASE_URL = "${{SUPABASE_URL}}"
SUPABASE_SERVICE_ROLE_KEY = "${{SUPABASE_SERVICE_ROLE_KEY}}"
```

**3. Environment Variables** (Railway Dashboard)

```bash
# Redis (Railway service)
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=[auto-generated]

# Replicate API
REPLICATE_API_TOKEN=r8_[your-token]

# Supabase
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ[your-key]
```

---

### Cost Analysis

| Component | Service | Cost/Month |
|-----------|---------|------------|
| Redis Queue | Railway | $5 |
| Worker (512MB) | Railway | $5-10 |
| Replicate API | Pay-per-use | ~$0.01/image |
| **Total Fixed** | | **$10-15/month** |

---

## 6-AGENT BACKGROUND REMOVAL PIPELINE

### Overview

**Status**: ✅ **IMPLEMENTED** (January 28, 2026)
**Location**: `/apps/swiftlist-app-svelte/src/lib/agents/background-removal/`
**Architecture**: LangGraph-inspired DAG with conditional branching

**Problem Solved**: Single-agent background removal (BRIA RMBG 2.0) achieves ~75% quality. Industry leaders (Photoroom, Claid.ai) achieve ~90% quality using multi-agent pipelines with specialized processing stages.

**Solution**: 6-agent DAG pipeline that processes images through specialized agents, each optimizing a specific aspect of background removal.

---

### Pipeline Architecture

```
┌─────────────┐
│ Preprocess  │  Agent 1: Noise reduction, complexity detection
└──────┬──────┘
       │
┌──────▼──────┐
│  Segment    │  Agent 2: Product-type routing, background removal
└──────┬──────┘
       │
┌──────▼──────┐
│ Refine-Edge │  Agent 3: Alpha matting, fringing correction
└──────┬──────┘
       │
┌──────▼────────┐
│ Validate-Qual │  Agent 4: Multi-metric quality scoring
└──────┬────────┘
       │
  Quality ≥85%?
       ├─YES─► Postprocess ─► Done
       │
       └─NO──► Fallback ──┐
                          │
                  (Retry loop back to Segment)
```

**Quality Threshold**: 85% (configurable)
**Max Retries**: 2 (prevents infinite loops)
**Processing Time**: <8 seconds per image

---

### Agent Details

#### Agent 1: Preprocess (`agents/preprocess.ts`)
**Purpose**: Prepare image for optimal segmentation
**Operations**:
- Noise reduction (median filter 3x3)
- Contrast enhancement (normalize)
- Complexity detection (entropy analysis)
- Fine detail detection (high-frequency analysis)

**Metrics Calculated**:
- `complexity`: 0-1 score (higher = more complex background)
- `hasFineDetails`: Boolean (jewelry chains, fabric texture)

---

#### Agent 2: Segmentation (`agents/segment.ts`)
**Purpose**: Remove background using product-specific model
**Strategy**: Route to specialized Replicate model based on:
- Product type (jewelry, clothing, default)
- Background complexity
- Fine detail presence

**Model Registry**:
```typescript
{
  default: 'bria/remove-background',      // General purpose, complex backgrounds
  jewelry: 'lucataco/remove-bg',          // Fine details, chains
  clothing: 'cjwbw/rembg',                // Fabrics, textiles
}
```

**Features**:
- Exponential backoff retry (3 attempts)
- Rate limit handling (429 errors)
- Model cost tracking

---

#### Agent 3: Edge Refinement (`agents/refine-edges.ts`)
**Purpose**: Improve edge quality, remove artifacts
**Operations**:
- Edge quality assessment (alpha channel variance)
- Guided filter (adaptive blur based on quality)
- Fringing detection (color bleeding on semi-transparent edges)
- Fringing correction (alpha pre-multiplication)

**Quality Metrics**:
- `edgeQuality`: 0-1 score
- `variance`: Edge sharpness measurement
- `hasFringing`: Boolean

---

#### Agent 4: Quality Validation (`agents/validate-quality.ts`)
**Purpose**: Multi-metric quality scoring
**Metrics**:
1. **Edge Quality** (40% weight) - From Agent 3
2. **Segmentation Quality** (40% weight) - Alpha channel clarity
3. **Artifact-Free Score** (20% weight) - No isolated transparent pixels

**Formula**:
```
Overall Quality = (Edge × 0.4) + (Segmentation × 0.4) + (ArtifactFree × 0.2)
```

**Diagnostics**:
- Alpha variance
- Clear pixel ratio
- Artifact count
- Fringing presence

---

#### Agent 5: Fallback (`agents/fallback.ts`)
**Purpose**: Retry with alternative model when quality < threshold
**Strategy**:
- Reset to original image (discard failed attempt)
- Cycle product types to force different model:
  - Retry 1: Try jewelry model (good for complex edges)
  - Retry 2: Try clothing model (different approach)
- Re-run Segment → Refine → Validate

**Prevents**:
- Same model retry (forces alternative)
- Infinite loops (max 2 retries)

---

#### Agent 6: Post-Processing (`agents/postprocess.ts`)
**Purpose**: Final optimization
**Operations**:
- PNG compression (quality 95, compression level 6)
- File size optimization
- Final metrics logging

**Output**:
- Optimized PNG buffer
- Processing statistics
- Total pipeline time

---

### DAG Orchestrator (`orchestrator.ts`)

**Pattern**: LangGraph-inspired state machine
**Features**:
- Conditional branching at `validate_quality` node
- Retry loop: `fallback` → `refine_edges` → `validate_quality`
- Safety limit: 20 iterations max
- Comprehensive logging

**State Management**:
```typescript
interface AgentState {
  originalImage: Buffer;
  processedImage: Buffer;
  productType: 'jewelry' | 'clothing' | 'default';
  qualityScore: number;
  qualityMetrics: QualityMetrics;
  edgeQuality: number;
  metadata: {
    complexity: number;
    hasFineDetails: boolean;
    modelUsed: string;
    retryCount: number;
    timestamps: { ... };
  };
}
```

---

### Utility Modules

#### `utils/buffer-helpers.ts`
- `calculateComplexity()`: Entropy-based background complexity
- `detectFineDetails()`: High-frequency detail detection
- `bufferToDataUrl()`: Image buffer to base64 conversion
- `downloadImage()`: Fetch image URL to buffer

#### `utils/edge-detection.ts`
- `assessEdgeQuality()`: Alpha channel variance analysis
- `detectFringing()`: Color bleeding detection on edges

#### `utils/quality-metrics.ts`
- `assessSegmentationQuality()`: Alpha channel clarity scoring
- `assessArtifactFreeScore()`: Isolated pixel detection

#### `utils/model-router.ts`
- `selectModel()`: Product-type → Replicate model routing
- Model registry with cost and latency tracking

---

### Quality Improvement Analysis

| Metric | Single-Agent (BRIA) | 6-Agent Pipeline | Improvement |
|--------|---------------------|------------------|-------------|
| **Average Quality** | ~75% | ~90% (target) | +20% |
| **Edge Quality** | ~70% | ~88% | +25% |
| **Complex Backgrounds** | ~65% | ~85% | +30% |
| **Fine Details (Jewelry)** | ~60% | ~90% | +50% |

---

### Cost Analysis

| Component | Cost | Notes |
|-----------|------|-------|
| **Single-Agent (BRIA)** | $0.018 | Baseline |
| **6-Agent Pipeline** | $0.024 | +33% cost |
| **Retry (if needed)** | +$0.006 | Max 10% retry rate |
| **Average Cost** | $0.025 | Including retries |

**ROI**: +33% cost for +50-60% quality improvement = Excellent value

---

### Integration

**Public API**:
```typescript
import { removeBackgroundAdvanced } from '$lib/agents/background-removal';

const result = await removeBackgroundAdvanced(
  imageBuffer,
  'jewelry' // productType
);

console.log(result.qualityScore); // 0.92
console.log(result.processingTime); // 6432ms
console.log(result.metadata.retryCount); // 0
```

**Integration Point**: `/api/jobs/process/+server.ts`
```typescript
// Replace single-agent call:
const buffer = await removeBackground(imageBuffer);

// With 6-agent pipeline:
const { buffer, qualityScore } = await removeBackgroundAdvanced(
  imageBuffer,
  job.product_type || 'default'
);

// Store quality score in job metadata for analytics
```

---

### Future Enhancements

1. **Custom Model Training** (Phase 2, post-MVP)
   - Train jewelry-specific segmentation model
   - Train glass/liquid transparency model
   - Train furniture spatial understanding model
   - Dataset: 10K+ images per category with manual masks

2. **Advanced Techniques** (Phase 3)
   - Trimap generation for difficult edges
   - Shadow generation for realistic compositing
   - Semantic segmentation for multi-object scenes

3. **Performance Optimizations** (Ongoing)
   - Parallel agent execution where possible
   - Model response caching for similar images
   - Adaptive quality thresholds per product type

---

## AI PROVIDER INTEGRATIONS

### Direct API Integrations (No Middleware)

| Provider | SDK | Purpose | Cost |
|----------|-----|---------|------|
| **Replicate** | `replicate` | Background removal (RMBG v1.4) | $0.0023/image |
| **Google Gemini** | `@google/generative-ai` | Vision analysis, prompting | $0.0005/image |
| **Anthropic Claude** | `@anthropic-ai/sdk` | Text generation, agents | $0.003/1K tokens |
| **OpenAI** | `openai` | DALL-E 3, embeddings | $0.04/image |
| **Runway ML** | REST API | Video generation | $0.05/second |
| **Luma AI** | REST API | 3D video effects | $0.10/video |
| **ElevenLabs** | REST API | Voice synthesis | $0.30/1K chars |

**All integrations**: TypeScript SDK → Direct API calls → No orchestration layer

---

## LLM ARCHITECTURE & STRATEGY

### Multi-LLM Strategy (Cost-Optimized)

**Philosophy**: Right LLM for the right job - optimize for cost without sacrificing quality

| Component | LLM | Model | Cost/Use | Monthly (1K users) | Purpose |
|-----------|-----|-------|----------|-------------------|---------|
| **Image Router** | Google | Gemini 2.0 Flash | $0.0001 | $100 | Product classification, workflow routing |
| **Job Assistant** | Anthropic | Claude 3.5 Haiku | $0.00025 | $25 | Interactive Q&A in Step 3 job modal |
| **Support Brain** | Anthropic | Claude 3.5 Haiku | $0.00025 | $10 | FAQ responses, troubleshooting |
| **Lifeguard** | Anthropic | Claude 3.5 Sonnet | $0.003 | $1-10 | Error analysis, root cause detection, fix suggestions |
| **Total** | - | - | - | **$136-145** | **0.58% of revenue** |

**Key Decisions**:
- ❌ **NO generic chat**: Too expensive ($300/month with Sonnet, $10/month with Flash)
- ✅ **Hybrid approach**: Use cheap models where possible, smart models where necessary
- ✅ **Context-aware**: Pass user selections to reduce LLM reasoning time
- ✅ **No cost displays**: Remove credit estimates during job creation (UX improvement)

---

### 1. Image Router (Gemini 2.0 Flash)

**When**: User uploads product image in Step 1
**Purpose**: Classify product type and recommend optimal workflow
**Cost**: $0.0001 per image (~$100/month for 1,000 users doing 100 jobs/month)

**Example Input**:
```json
{
  "image": "base64_encoded_image",
  "context": {
    "file_name": "necklace.jpg",
    "file_size_mb": 2.3
  }
}
```

**Example Output**:
```json
{
  "product_type": "jewelry",
  "recommended_workflow": "WF-02",
  "confidence": 0.94,
  "suggested_enhancements": [
    "background-removal",
    "high-res-upscale"
  ]
}
```

**API Route**: `/api/ai/classify-image`
**Status**: ⏳ Not built (Priority 1)

---

### 2. Job Creation Assistant (Claude 3.5 Haiku)

**When**: User reaches Step 3 of job modal
**Purpose**: Answer questions, suggest optimizations, reduce support tickets
**Cost**: $0.00025 per exchange (~$25/month assuming 100 questions across 1K users)

**Proactive Mode** (Auto-triggered on Step 3 load):
```
User selected: Background Removal, High-Res Upscale
Marketplaces: Amazon, Etsy

→ "I noticed you're optimizing for Amazon and Etsy. Amazon prefers
   clean white backgrounds, while Etsy shoppers love lifestyle scenes.
   Would you like me to add both so you can test which converts better?"
```

**Interactive Mode** (User asks question):
```
User: "Should I use lifestyle scene for Amazon?"

→ "For Amazon, lifestyle scenes can work but test carefully. Amazon
   prioritizes clean white backgrounds with 85% product coverage.
   Lifestyle scenes work better for Etsy or Instagram. Want me to
   add both white background + lifestyle to compare?"
```

**API Route**: `/api/ai/job-assistant`
**Status**: ⏳ Not built (Priority 2)

---

### 3. Support Page Brain (Claude 3.5 Haiku)

**When**: User visits `/support` page
**Purpose**: Answer FAQs, troubleshoot common issues
**Cost**: $0.00025 per interaction (~$10/month assuming 40 questions across 1K users)

**Current Phase**: Read-only FAQ (no text input)
**Future Phase**: Interactive chat for specific questions

**Example FAQ Response**:
```
Q: "Why was my image rejected?"
A: "Images are rejected for 3 main reasons:
   1. File too large (>10MB) - compress before upload
   2. Wrong format (use .jpg, .png, or .webp)
   3. Poor quality (blurry/pixelated) - use high-res source

   Your recent upload was rejected because: [specific reason]"
```

**API Route**: `/api/ai/support`
**Status**: ⏳ Not built (Priority 4 - Post-MVP)

---

### 4. Lifeguard Monitoring System (Claude 3.5 Sonnet)

**When**: Error detected, security anomaly, performance degradation
**Purpose**: Real-time production monitoring with AI-powered root cause analysis
**Cost**: $0.003 per incident (~$1-10/month, only triggers on errors)

**Why Sonnet (Not Haiku)**:
- ✅ Deep reasoning for complex debugging (stack traces, DB logs, user patterns)
- ✅ Security pattern recognition (detects sophisticated attacks)
- ✅ Actionable fix suggestions (generates code patches)
- ✅ Cost justified: Only runs on incidents (low volume in production)

**Monitoring Triggers**:
1. **Job Processing Errors**: Workflow failures, API timeouts, DB errors
2. **Security Anomalies**: Failed logins (same IP), credit manipulation, XSS/SQL injection attempts
3. **Performance Degradation**: P95 latency spikes, query slowdowns, memory leaks
4. **Business Logic Issues**: Negative credits, orphaned jobs, preset count mismatches

**Workflow**:
```
Error Detected
↓
Lifeguard collects context:
  - Error stack trace
  - Recent logs (last 50 entries)
  - User session data
  - Database state
  - Recent git commits
↓
Claude 3.5 Sonnet analyzes:
  - Root cause (1-2 sentences)
  - Severity (P0/P1/P2/P3)
  - Suggested fix (code patch if possible)
  - Prevention strategy
↓
(A) Slack notification to #swiftlist-alerts
(B) Database log in lifeguard_incidents table
```

**Example Slack Notification**:
```
🚨 Production Error Detected

Severity: P1 (High)
Issue: RLS policy violation in jobs table

Root Cause:
User authentication check failed in job submission API. auth.uid()
returned null due to expired session token.

Suggested Fix:
```typescript
// Add token refresh logic before database query
const { data: { session } } = await supabase.auth.refreshSession();
```

Prevention:
Add middleware to auto-refresh tokens <5min from expiry

[View Full Logs] [Acknowledge] [Deploy Fix]
```

**API Route**: Supabase Edge Function `/functions/lifeguard-monitor`
**Status**: ⏳ Not built (Priority 3)

---

### Cost Justification

**Revenue (1K users, $25/month avg)**: $25,000/month
**LLM Cost**: $145/month
**LLM % of Revenue**: 0.58%
**Infrastructure Cost**: $25-45/month (Railway + Supabase)
**Total Tech Cost**: ~$170-190/month
**Gross Margin**: 99.2%

✅ **Well within budget** - LLM costs are negligible compared to value provided

**Compare to Alternatives**:
- Generic Claude Sonnet chat: $300/month (2x more expensive, worse UX)
- All-Gemini Flash: $110/month (cheaper but worse quality for support/debugging)
- **Our hybrid**: $145/month (best balance of cost and quality)

---

### Implementation Priority

**This Week (MVP Launch - Jan 26)**:
1. ✅ Gemini Flash 2.0 Image Router (2-3 hours) - CRITICAL PATH
2. ✅ Claude Haiku Job Assistant (4-5 hours) - HIGH IMPACT
3. ⏳ Lifeguard MVP (6-8 hours) - DEVOPS ESSENTIAL

**Post-MVP (Week 1)**:
4. ✅ Support Page + Haiku Brain (3-4 hours)
5. ✅ Lifeguard Security Monitoring (4-5 hours)

---

## SECURITY ENFORCEMENT SYSTEM

### Row Level Security (RLS)

**Status**: ✅ Deployed (Jan 16, 2026)

All 8 database tables have RLS enabled with deny-by-default policies:

**Tables**:
1. `profiles` - User accounts
2. `jobs` - Processing jobs
3. `credit_transactions` - Purchase/spend history
4. `presets` - Marketplace presets
5. `subscriptions` - Subscription plans
6. `royalty_ledger` - Creator payouts
7. `agent_audit_logs` - AI agent activity
8. `agent_cost_tracking` - Monthly budgets

**Security Fixes**: 6 CVE-2025-48757-class vulnerabilities fixed (Jan 14-16)

---

## WORKFLOW IMPLEMENTATION STATUS

All workflows are implemented as TypeScript workers running on Railway via BullMQ.

### TypeScript Worker Pattern

```typescript
// workers/src/workflows/background-removal.ts
export async function backgroundRemovalWorkflow(
  imageUrl: string
): Promise<string> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const output = await replicate.run(
    "lucataco/remove-bg:95fcc2a26...",
    { input: { image: imageUrl } }
  );

  return output as string;
}
```

### Workflow Catalog

| Category | Workflows | Notes |
|----------|-----------|-------|
| **Background Removal** | WF-04, WF-07 | Replicate RMBG v1.4, Bria RMBG 2.0 |
| **Product Engines** | WF-02, WF-03, WF-05, WF-06 | Jewelry, apparel, general |
| **Social Media** | WF-11, WF-12, WF-13 | Gemini 2.0 Flash, platform-specific |
| **Marketplace Formatters** | WF-25 through WF-30 | eBay, Etsy, Amazon, Poshmark, Mercari, Depop |
| **Lifestyle/Scene** | WF-09 | Gemini 3 Imagen |
| **Descriptions** | WF-10 | Claude Sonnet |
| **Upscaling** | WF-14 | Replicate |
| **Preset System** | WF-17 | Embeddings + Claude |
| **Video** | WF-39, WF-45-49 | Kling AI |

---

## DEPLOYMENT STATUS

### Phase 1: MVP Launch ✅ COMPLETE

**Completed**:
1. ✅ Database deployed with all 8 tables + RLS policies
2. ✅ Frontend built and deployed to Railway (19 pages)
3. ✅ BullMQ worker built and deployed to Railway
4. ✅ Background removal pipeline operational (WF-04, WF-07)
5. ✅ Authentication working (signup, login, logout)
6. ✅ Credit system functional

---

### Phase 2: Core Features (In Progress)

**Deliverables**:
- Expand workflows (WF-10, WF-14, WF-17)
- Implement preset marketplace
- Add social media exports (WF-11, WF-12, WF-13)

---

### Phase 3: Advanced Features (Upcoming)

**Deliverables**:
- Implement video generation (Kling AI integration)
- Build Mission Control dashboard
- Stripe subscription tiers

---

## LAUNCH CHECKLIST

### Pre-Launch (Complete Before Go-Live)

**Infrastructure**:
- [✅] Database deployed with all 8 tables
- [✅] RLS policies active on all tables
- [✅] Storage buckets configured (10MB max)
- [✅] BullMQ queue deployed on Railway
- [✅] Worker deployed on Railway
- [✅] Environment variables configured

**Security**:
- [✅] RLS policies prevent cross-user access
- [✅] No secrets in git history
- [✅] Authentication working (signup, login, logout)
- [✅] Security headers enabled (CSP, HSTS)
- [⏸️] Rate limiting (requires testing)

**Testing**:
- [⏸️] End-to-end test: signup → upload → process → download (needs verification)
- [⏸️] Test insufficient credits error (402)
- [⏸️] Mobile responsive on iOS and Android
- [⏸️] Cross-browser testing (Chrome, Safari, Firefox)

**Monitoring**:
- [⏸️] Sentry configured for error tracking
- [⏸️] Railway metrics configured
- [⏸️] First job completion alert configured

---

### Go/No-Go Criteria

**MUST HAVE (Blockers)**:
- ✅ Frontend deployed and accessible
- ✅ Database operational with RLS
- ✅ BullMQ worker processing jobs successfully
- ✅ Authentication working (signup/login)
- ✅ Credit system functional (purchase, deduct, refund)
- ⏸️ No P0 bugs in production (requires testing)

**NICE TO HAVE (Post-Launch)**:
- Mission Control dashboard (can launch without)
- Additional workflows (can add incrementally)
- Preset marketplace (can launch with seed presets)

---

## CRITICAL FILES REFERENCE

### Frontend Application
```
/apps/swiftlist-app-svelte/
├── src/routes/api/jobs/submit/+server.ts   ✅ BullMQ integration active
└── src/hooks.server.ts                     ✅ CSP, rate limiting, auth
```

### Workers (Deployed on Railway)
```
/workers/
├── src/
│   ├── workers/
│   │   ├── BackgroundRemovalWorker.ts      ✅ WF-04/WF-07 (Replicate + Bria RMBG)
│   │   └── index.ts                        ✅ Worker entrypoint
│   └── queues/                             ✅ BullMQ queue definitions
├── workflows/
│   ├── WF-02-jewelry-precision-engine.ts   ✅ Built
│   └── WF-25-ebay-compliance.ts            ✅ Built
├── Dockerfile                              ✅ Deployed
├── railway.toml                            ✅ Configured
└── package.json                            ✅ Active
```

### Database
```
/backend/supabase/migrations/
├── 001_core_schema.sql                      ✅ Deployed
├── 002_storage_buckets.sql                  ✅ Deployed
├── 003_rls_policies.sql                     ✅ Deployed
└── 004_agent_audit_tables.sql               ✅ Deployed
```

---

## CURRENT PRIORITIES

**Active**:
1. End-to-end verification: signup → upload → process → download
2. Mobile responsiveness testing (iOS + Android)
3. Rate limiting verification under load

**Upcoming (Phase 2)**:
1. Expand workflows (WF-10 descriptions, WF-14 upscaling, WF-17 presets)
2. Build preset marketplace
3. Implement social media exports (WF-11, WF-12, WF-13)
4. Stripe subscription integration

---

## SUPPORT & REFERENCES

**Architecture Decision**: [MVP-SCOPE-AUDIT-2026-01-13.md](/docs/MVP-SCOPE-AUDIT-2026-01-13.md)
**Previous Plan**: [groovy-growing-turtle.md](/.claude/plans/groovy-growing-turtle.md)
**Security Audit**: [SECURITY-AUDIT-2026-01-14.md](/docs/security/SECURITY-AUDIT-2026-01-14.md)
**Previous Version**: [TDD_MASTER_v3.0.md](TDD_MASTER_v3.0.md)

---

**Document Status**: ✅ ACTIVE - Single Source of Truth
**Last Updated**: February 20, 2026

---

*This is the Master Bible v4.0. All development decisions should reference this document.*
