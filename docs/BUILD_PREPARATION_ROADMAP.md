# SwiftList v1.0 - Build Preparation Roadmap
**Date:** December 18, 2024
**Status:** Pre-Development Phase
**Target:** Production-ready code generation environment

---

## 🎯 Objective

Prepare a multi-agent development environment where:
- **Gemini** generates backend (Supabase, n8n workflows, API logic)
- **Claude Opus 4.5** generates frontend (React/Vue, responsive UI)
- **Flash 3** acts as internal "Lifeguard" for quality control
- All agents work from same context (PRD.md)

---

## 📋 Phase 1: Development Environment Setup (Priority 1)

### 1.1 Terminal Applications (Solve Rate Limit Issue)

**Current Issue:**
- Claude Desktop CLI hits rate limits after ~2.5 hours
- Resets at 1pm PT daily
- Blocks development workflow

**Solution: Multi-Terminal Strategy**

#### **Option A: iTerm2 (Recommended for Mac)**
```bash
# Install via Homebrew
brew install --cask iterm2
```

**Benefits:**
- Split panes (run multiple Claude sessions side-by-side)
- Session recording
- Hotkey windows
- Search chat history
- FREE

**Setup:**
1. Download: https://iterm2.com/
2. Configure profiles:
   - Profile 1: "Claude Code" (for Claude Desktop CLI)
   - Profile 2: "Gemini" (for Gemini API calls)
   - Profile 3: "GitHub Copilot" (for GitHub agent)

#### **Option B: Warp (AI-Native Terminal)**
```bash
# Install via Homebrew
brew install --cask warp
```

**Benefits:**
- Built-in AI command suggestions
- Workflows/notebooks for common tasks
- Cloud sync
- FREE tier available

**Setup:**
1. Download: https://www.warp.dev/
2. Sign in with GitHub account
3. Create workflows for:
   - SwiftList build commands
   - Supabase deployment
   - n8n workflow imports

#### **Option C: Kitty (Lightweight, Fast)**
```bash
# Install via Homebrew
brew install --cask kitty
```

**Benefits:**
- GPU-accelerated rendering
- Tiling/tabs
- Extremely fast
- FREE

**Recommendation:**
- **iTerm2** for your workflow (split panes for Claude + Gemini simultaneously)
- Keep Claude Desktop App as "design/review" interface
- Use iTerm2 for "build/execute" interface

---

### 1.2 GitHub Repository Structure

**Current Structure:**
```
SwiftList/
├── docs/
│   ├── PRD.md (✅ Created - master context)
│   ├── CTO_TECHNICAL_REVIEW.md (✅ Created)
│   ├── session-notes/ (✅ Created)
│   └── BUILD_PREPARATION_ROADMAP.md (this file)
├── n8n-workflows/
│   └── production/
└── .env
```

**Needed Structure for Build Phase:**
```
SwiftList/
├── docs/
│   ├── PRD.md
│   ├── API_SPEC.md (needed)
│   ├── DATABASE_SCHEMA.md (needed)
│   ├── n8n_WORKFLOW_SPECS/ (needed)
│   └── UX_REFINEMENTS.md (needed)
├── backend/
│   ├── supabase/
│   │   ├── migrations/
│   │   ├── functions/
│   │   └── seed.sql
│   ├── n8n-workflows/
│   │   ├── treatment-background-removal.json
│   │   ├── treatment-lifestyle-scene.json
│   │   ├── treatment-upscale.json
│   │   ├── treatment-animated-spin.json
│   │   └── lifeguard-audit.json
│   └── api/
│       └── routes/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
│   ├── public/
│   └── package.json
├── tests/
├── .env.example
└── README.md
```

**Action Items:**
- [ ] Create folder structure
- [ ] Add .gitignore (exclude .env, node_modules, etc.)
- [ ] Create README.md with setup instructions
- [ ] Add .env.example template

---

## 📋 Phase 2: Design Specifications (Priority 1)

### 2.1 n8n Workflow Specifications

**What's Needed:**
Each n8n workflow needs a detailed specification document before code generation.

**Template:**
```markdown
# n8n Workflow Spec: [Treatment Name]

## Trigger
- Type: Webhook / Manual / Queue
- Authentication: API Key
- Rate Limit: X requests/minute

## Input Schema
{
  "job_id": "uuid",
  "user_id": "uuid",
  "image_url": "string",
  "treatment_config": {
    "param1": "value"
  }
}

## Processing Steps
1. Validate input
2. Fetch image from S3
3. Call AI service (Gemini/GPT/Runway)
4. Post-process result
5. Store output to S3
6. Update job status in Supabase
7. Distribute tokens (if preset used)

## Output Schema
{
  "job_id": "uuid",
  "status": "success",
  "output_url": "string",
  "cost_usd": 0.05,
  "processing_time_ms": 3400
}

## Error Handling
- Retry: 3 attempts, exponential backoff
- Fallback: Switch to backup model
- Notification: Update job status to "failed"

## Cost Model
- Tier 1: $0.001/request (Gemini Flash)
- Tier 2: $0.04/request (GPT-Image)
- Tier 3: $0.30/request (Runway Gen-3)

## Testing Checklist
- [ ] Valid input succeeds
- [ ] Invalid input fails gracefully
- [ ] Timeout handling works
- [ ] Token distribution calculates correctly
```

**Workflows to Specify:**
1. ✅ Background Removal (Tier 1 - Gemini Flash)
2. ✅ Lifestyle Scene Generation (Tier 2 - GPT-Image)
3. ✅ High-Res Upscale (Tier 2 - GPT-Image)
4. ✅ Animated Spin (Tier 3 - Runway Gen-3)
5. ✅ Hand Model Generation (Tier 2)
6. ✅ Convert to SVG (Tier 1)
7. ✅ Preset Creation (capture style vector)
8. ✅ Lifeguard Audit (Flash 3 quality check)
9. ✅ Panopticon Daily Fraud Scan
10. ✅ Token Distribution & Royalty Payout

**Action Items:**
- [ ] Create `/docs/n8n_WORKFLOW_SPECS/` folder
- [ ] Write spec for each workflow (use template above)
- [ ] Define AI model endpoints and authentication
- [ ] Map treatments to cost tiers

---

### 2.2 API Specification

**What's Needed:**
Complete REST API documentation for Gemini to implement.

**Structure:**
```markdown
# SwiftList API Specification v1.0

## Authentication
All requests require Bearer token:
```
Authorization: Bearer {user_jwt_token}
```

## Base URL
- Production: https://api.swiftlist.com/v1
- Staging: https://staging-api.swiftlist.com/v1

## Endpoints

### Jobs

#### POST /jobs
Create a new job

**Request:**
```json
{
  "name": "Product Launch v2",
  "original_image_url": "https://...",
  "reference_image_url": "https://..." (optional),
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
  "marketplaces": ["amazon", "etsy"]
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "processing",
  "estimated_completion_seconds": 45,
  "cost_credits": 15
}
```

#### GET /jobs/{job_id}
Get job status and results

#### GET /jobs
List user's jobs (paginated)

### Presets

#### POST /presets
Create a new preset

#### GET /presets
Browse public presets (discovery)

#### GET /presets/{preset_id}
Get preset details

#### POST /presets/{preset_id}/use
Use a preset (triggers token payment)

### Credits

#### GET /credits/balance
Get user's credit balance

#### POST /credits/purchase
Purchase credits

#### GET /credits/transactions
Transaction history

### Tokens (Creator Earnings)

#### GET /tokens/earnings
Get creator earnings

#### POST /tokens/withdraw
Withdraw tokens to USD

### Marketplace Integrations

#### POST /marketplaces/amazon/publish
Publish assets to Amazon

(etc. for Etsy, Poshmark, Shopify)
```

**Action Items:**
- [ ] Create `/docs/API_SPEC.md`
- [ ] Define all endpoints with request/response schemas
- [ ] Specify authentication/authorization rules
- [ ] Document rate limits
- [ ] Add error code reference

---

### 2.3 Database Schema (Expanded)

**What's Needed:**
Complete PostgreSQL schema with all tables, indexes, and relationships.

**Already Have (from TDD):**
- `profiles` table
- `presets` table
- `jobs` table
- `orders` table
- `transactions` table

**Still Need:**
- `assets` table (stores generated files)
- `marketplace_listings` table (tracks published assets)
- `audit_logs` table (Lifeguard/Panopticon records)
- `api_keys` table (for external integrations)
- `subscriptions` table (Stripe billing)
- `payouts` table (token withdrawals)

**Action Items:**
- [ ] Create `/docs/DATABASE_SCHEMA.md`
- [ ] Expand schema with missing tables
- [ ] Add ALL indexes (from CTO review)
- [ ] Define RLS (Row Level Security) policies for Supabase
- [ ] Write seed data SQL (50 presets for cold start)

---

### 2.4 UX Refinements Document

**What's Needed:**
Implement feedback from UX review (from 2024-12-18_UX_Architecture_Review.md)

**Critical Missing Flows:**
1. **Preset Creation Modal**
   - Triggered after job completion
   - Fields: Name, Description, Categories, Visibility (Public/Private)
   - "Save as Preset" button

2. **Creator Earnings Dashboard**
   - Add to "My Studio" page
   - Show: Tokens earned, top earning preset, payout available
   - "Withdraw Earnings" CTA

3. **Enhanced Preset Discovery**
   - Add social proof badges: "🔥 Trending", "⭐ Top Rated", "👑 Best Seller"
   - Show weekly usage stats
   - Add reviews/ratings

4. **Edit Job Flow**
   - "Edit Job Settings" button on results page
   - Re-opens wizard at Step 2
   - Only charges for NEW treatments

5. **Mobile Responsive Views**
   - Job creation wizard (optimized for mobile)
   - Preset discovery (card grid → list view)
   - Dashboard (stacked metrics)

**Action Items:**
- [ ] Create `/docs/UX_REFINEMENTS.md`
- [ ] Design preset creation modal (detailed mockup)
- [ ] Design earnings dashboard widget
- [ ] Specify mobile breakpoints and responsive behavior
- [ ] Create component library (buttons, cards, modals)

---

## 📋 Phase 3: Payment Integration Setup (Priority 2)

### 3.1 Stripe Account Configuration

**What's Needed:**
1. **Stripe Account** (sign up at stripe.com)
2. **Test Mode API Keys** (for development)
3. **Production API Keys** (for launch)

**Stripe Products to Create:**

#### A. Subscription Plans
```
Starter Plan:
- Price: $0/month
- Credits: 100/month
- Metered billing: $0.50 per 10 additional credits

Pro Maker Plan:
- Price: $29/month
- Credits: 500/month
- Metered billing: $0.40 per 10 additional credits

Studio Plan:
- Price: Custom (contact sales)
- Credits: Unlimited
```

#### B. One-Time Credit Purchases
```
Credit Bundles:
- 100 credits: $9.99
- 500 credits: $39.99 (20% discount)
- 1000 credits: $69.99 (30% discount)
```

#### C. Creator Payouts (Stripe Connect)
```
- Enable Stripe Connect for creator withdrawals
- Minimum payout: $10 (100 tokens)
- Payout schedule: Weekly automatic, or manual on-demand
```

**Stripe Webhooks to Configure:**
```
subscription.created
subscription.updated
subscription.deleted
payment_intent.succeeded
payment_intent.failed
charge.refunded
payout.paid
```

**Action Items:**
- [ ] Sign up for Stripe account
- [ ] Get Test API keys (pk_test_... and sk_test_...)
- [ ] Create subscription products in Stripe Dashboard
- [ ] Set up Stripe Connect for creator payouts
- [ ] Configure webhooks (point to your API endpoint)
- [ ] Add Stripe keys to `.env` file

---

### 3.2 Payment Flow Design

**User Journey: Subscribe to Pro Maker**
```
1. User clicks "Choose Pro" on pricing page
2. Modal opens with Stripe Checkout
3. User enters card details
4. Stripe processes payment
5. Webhook confirms payment to backend
6. Backend updates user tier in Supabase
7. User redirected to dashboard
8. Credits balance updated
```

**User Journey: Purchase Credit Bundle**
```
1. User clicks "Top Up +" button
2. Modal shows credit bundle options
3. User selects bundle (e.g., 500 credits for $39.99)
4. Stripe Checkout processes payment
5. Webhook confirms payment
6. Backend adds credits to user balance
7. Modal closes, balance updates
```

**User Journey: Creator Withdraws Earnings**
```
1. Creator clicks "Withdraw Earnings" (must have 100+ tokens = $10)
2. Modal prompts for Stripe Connect onboarding (first time only)
3. Creator completes identity verification
4. Selects withdrawal amount (in tokens)
5. Backend converts tokens → USD (100 tokens = $10)
6. Stripe Connect processes payout
7. Funds arrive in creator's bank account (2-3 days)
8. Transaction logged in payouts table
```

**Action Items:**
- [ ] Design Stripe Checkout integration (use Stripe Elements)
- [ ] Implement webhook handler in backend
- [ ] Build Stripe Connect onboarding flow
- [ ] Add payment history UI
- [ ] Test with Stripe test cards

---

## 📋 Phase 4: AI Model Access & Configuration (Priority 1)

### 4.1 Required API Keys

**Already Have:**
- ✅ n8n API Key
- ✅ Google AI API Key (Gemini Flash 3)
- ✅ Anthropic API Key (Claude 3.5 Sonnet)

**Still Need:**

#### A. OpenRouter (Intelligence Gateway)
- Sign up: https://openrouter.ai/
- Purpose: Multi-model routing for Gemini/GPT/Runway
- Cost: Pay-as-you-go, ~20% markup over direct API
- **Benefit:** Single API for all models + automatic fallback

#### B. OpenAI (GPT-Image-1.5)
- Sign up: https://platform.openai.com/
- Purpose: Tier 2 image editing (upscale, lifestyle scenes)
- Cost: ~$0.04/generation
- **Alternative:** Access via OpenRouter

#### C. Runway ML (Gen-3 Alpha Turbo)
- Sign up: https://runwayml.com/
- Purpose: Tier 3 video generation (animated spin)
- Cost: ~$0.30/generation (10-second video)
- **Note:** Requires approval for API access

#### D. Supabase
- Sign up: https://supabase.com/
- Purpose: PostgreSQL database + authentication + storage
- Plan: Free tier for development, Pro plan ($25/mo) for production
- **Setup:**
  - Create new project
  - Enable pgvector extension (for preset similarity)
  - Configure RLS policies
  - Set up S3-compatible storage buckets

#### E. AWS (For Production Deployment)
- Sign up: https://aws.amazon.com/
- Services needed:
  - **Amplify** (frontend hosting)
  - **Lightsail** (n8n server - 4GB/2-vCPU minimum)
  - **RDS** (PostgreSQL - if not using Supabase in prod)
  - **S3** (asset storage)
  - **DataSync** (backup to NUC cluster)
- **Alternative for MVP:** Use Supabase for everything, delay AWS migration

**Action Items:**
- [ ] Sign up for OpenRouter
- [ ] Sign up for Runway ML (request API access)
- [ ] Create Supabase project
- [ ] Enable pgvector extension in Supabase
- [ ] Set up S3 buckets (or Supabase Storage)
- [ ] Add all API keys to `.env` file
- [ ] Create `.env.example` template (without sensitive values)

---

### 4.2 AI Model Testing & Benchmarking

**Before generating code, test each AI model:**

#### Test 1: Background Removal (Tier 1 - Gemini Flash)
```bash
# Sample cURL request
curl -X POST https://api.openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "Remove background from this product image: [image_url]"
      }
    ]
  }'
```

**Success Criteria:**
- Clean background removal (no artifacts)
- Processing time < 5 seconds
- Cost < $0.002/request

#### Test 2: Lifestyle Scene (Tier 2 - GPT-Image)
**Success Criteria:**
- Realistic product placement
- Consistent lighting
- Processing time < 15 seconds
- Cost ~$0.04/request

#### Test 3: Animated Spin (Tier 3 - Runway)
**Success Criteria:**
- Smooth 360° rotation
- 10-second video output
- Processing time < 60 seconds
- Cost ~$0.30/request

**Action Items:**
- [ ] Write test scripts for each AI model
- [ ] Benchmark processing times
- [ ] Measure actual costs
- [ ] Compare quality vs alternatives
- [ ] Document results in `/docs/AI_MODEL_BENCHMARKS.md`

---

## 📋 Phase 5: Code Generation Strategy (Priority 1)

### 5.1 Agent Responsibilities

**Gemini's Role: Backend Development**
```
Responsibilities:
- Supabase database schema creation
- PostgreSQL migrations
- RLS (Row Level Security) policies
- Supabase Edge Functions (serverless API)
- n8n workflow JSON generation
- Token distribution logic
- Lifeguard audit system (Flash 3 integration)
- Stripe webhook handlers

Context Required:
- PRD.md
- DATABASE_SCHEMA.md
- API_SPEC.md
- n8n_WORKFLOW_SPECS/

Output:
- /backend/supabase/migrations/*.sql
- /backend/supabase/functions/*.ts
- /backend/n8n-workflows/*.json
- /backend/api/routes/*.ts
```

**Claude Opus 4.5's Role: Frontend Development**
```
Responsibilities:
- React/Vue component library
- Page layouts (Home, Discovery, My Studio, Job Creation, Results)
- Responsive design (desktop + mobile)
- State management (Zustand/Redux)
- API integration (fetch calls to Supabase/backend)
- Stripe Checkout integration
- Form validation
- Error handling UI

Context Required:
- PRD.md
- UX_REFINEMENTS.md
- API_SPEC.md
- Component mockups (from Stitch)

Output:
- /frontend/src/components/*.tsx
- /frontend/src/pages/*.tsx
- /frontend/src/hooks/*.ts
- /frontend/src/utils/*.ts
- /frontend/tailwind.config.js
```

**Flash 3's Role: Quality Control (Lifeguard)**
```
Responsibilities:
- Review generated code for security vulnerabilities
- Check API input validation
- Verify error handling
- Test edge cases
- Flag potential issues before deployment

Context Required:
- Generated code from Gemini and Claude
- Security best practices checklist

Output:
- Code review reports
- Security audit logs
- Suggested fixes
```

---

### 5.2 Code Generation Workflow

**Step-by-Step Process:**

#### Phase 1: Backend (Gemini)
```
1. Gemini reads PRD.md, DATABASE_SCHEMA.md, API_SPEC.md
2. Generates Supabase migrations
3. Generates Edge Functions (API endpoints)
4. Generates n8n workflow JSONs
5. Flash 3 reviews code (security audit)
6. Fix issues flagged by Flash 3
7. Commit to GitHub: /backend/*
```

#### Phase 2: Frontend (Claude Opus 4.5)
```
1. Claude reads PRD.md, UX_REFINEMENTS.md, API_SPEC.md
2. Generates component library (buttons, cards, modals)
3. Generates page layouts (Home, Discovery, Dashboard, etc.)
4. Generates responsive CSS (Tailwind)
5. Integrates API calls to backend
6. Flash 3 reviews code (UX/accessibility audit)
7. Fix issues flagged by Flash 3
8. Commit to GitHub: /frontend/*
```

#### Phase 3: Integration Testing
```
1. Deploy backend to Supabase staging
2. Deploy frontend to Vercel/Netlify staging
3. Run end-to-end tests:
   - User signup/login
   - Job creation
   - Payment flow
   - Preset usage
   - Token distribution
4. Flash 3 monitors for runtime errors
5. Fix bugs
6. Deploy to production
```

**Action Items:**
- [ ] Create `/docs/CODE_GENERATION_WORKFLOW.md`
- [ ] Define prompts for Gemini (backend generation)
- [ ] Define prompts for Claude Opus 4.5 (frontend generation)
- [ ] Set up GitHub branches (main, staging, development)
- [ ] Configure CI/CD pipeline (GitHub Actions)

---

### 5.3 Prompt Templates for Agents

#### Gemini Backend Prompt Template
```
You are a senior backend engineer building the SwiftList SaaS platform.

CONTEXT:
- Read the complete PRD: [attach PRD.md]
- Database schema: [attach DATABASE_SCHEMA.md]
- API specification: [attach API_SPEC.md]

TASK:
Generate the Supabase migration file for the [TABLE_NAME] table.

REQUIREMENTS:
- Use PostgreSQL syntax
- Include indexes for common queries
- Add RLS policies for security
- Include helpful comments
- Follow Supabase best practices

OUTPUT FORMAT:
Provide a single .sql file with:
1. CREATE TABLE statement
2. Indexes
3. RLS policies
4. Seed data (if applicable)
```

#### Claude Opus 4.5 Frontend Prompt Template
```
You are a senior frontend engineer building the SwiftList SaaS platform.

CONTEXT:
- Read the complete PRD: [attach PRD.md]
- UX refinements: [attach UX_REFINEMENTS.md]
- API endpoints: [attach API_SPEC.md]

TASK:
Generate the [COMPONENT_NAME] React component.

REQUIREMENTS:
- Use TypeScript
- Use Tailwind CSS for styling
- Make it responsive (mobile + desktop)
- Include error handling
- Add loading states
- Follow React best practices

OUTPUT FORMAT:
Provide a single .tsx file with:
1. Component code
2. Props interface
3. Helper functions
4. CSS classes (Tailwind)
```

#### Flash 3 Lifeguard Audit Prompt Template
```
You are an AI code reviewer acting as the "Lifeguard" for SwiftList.

CONTEXT:
- Security best practices
- OWASP Top 10 vulnerabilities
- React/Node.js common pitfalls

TASK:
Review this [BACKEND/FRONTEND] code for security and quality issues.

CODE:
[paste generated code here]

CHECK FOR:
- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication/authorization issues
- Input validation gaps
- Error handling missing
- Performance bottlenecks

OUTPUT FORMAT:
Provide a report with:
1. CRITICAL issues (must fix before deployment)
2. WARNINGS (should fix)
3. SUGGESTIONS (nice to have)
4. Overall security grade (A-F)
```

**Action Items:**
- [ ] Create `/docs/AGENT_PROMPTS.md` with all templates
- [ ] Test prompts with sample requests
- [ ] Refine based on output quality

---

## 📋 Phase 6: Testing & Deployment Setup (Priority 3)

### 6.1 Testing Strategy

**Unit Tests:**
- Backend: Supabase Edge Functions
- Frontend: React components (Jest + React Testing Library)

**Integration Tests:**
- API endpoint testing (Postman/Insomnia collections)
- n8n workflow testing (manual trigger + verify output)

**End-to-End Tests:**
- User signup → job creation → payment → download
- Preset creation → discovery → usage → token payment
- Use Playwright or Cypress

**Action Items:**
- [ ] Set up Jest for backend tests
- [ ] Set up React Testing Library for frontend tests
- [ ] Create Postman collection for API testing
- [ ] Write E2E test scripts (Playwright)

---

### 6.2 Deployment Configuration

**Staging Environment:**
- Frontend: Vercel (free tier)
- Backend: Supabase (free tier)
- n8n: n8n.cloud (your existing instance)

**Production Environment:**
- Frontend: AWS Amplify (as per architecture)
- Backend: AWS Lightsail (n8n) + Supabase Pro
- Database: Supabase Pro or AWS RDS
- Storage: AWS S3 + DataSync to NUC cluster

**Action Items:**
- [ ] Set up Vercel account (staging frontend)
- [ ] Configure environment variables in Vercel
- [ ] Set up AWS Amplify (production frontend)
- [ ] Deploy n8n to AWS Lightsail
- [ ] Configure DNS (domain → Amplify/Lightsail)

---

## 🎯 IMMEDIATE NEXT STEPS (This Week)

### Today (Dec 18):
- [x] Install iTerm2 or Warp terminal
- [ ] Create GitHub folder structure
- [ ] Write DATABASE_SCHEMA.md (complete version)
- [ ] Write API_SPEC.md

### Tomorrow (Dec 19):
- [ ] Write n8n workflow specs (start with 3 most critical)
- [ ] Sign up for OpenRouter, Runway ML
- [ ] Create Supabase project
- [ ] Test AI model APIs (benchmarks)

### Day 3 (Dec 20):
- [ ] Write UX_REFINEMENTS.md (design missing flows)
- [ ] Set up Stripe account
- [ ] Create subscription products in Stripe
- [ ] Write CODE_GENERATION_WORKFLOW.md

### Day 4 (Dec 21):
- [ ] Generate backend code with Gemini (database migrations)
- [ ] Review with Flash 3
- [ ] Commit to GitHub

### Day 5 (Dec 22):
- [ ] Generate frontend code with Claude Opus 4.5 (component library)
- [ ] Review with Flash 3
- [ ] Commit to GitHub

---

## 📊 Readiness Checklist

Before starting code generation, verify:

### Documentation
- [ ] PRD.md (✅ complete)
- [ ] DATABASE_SCHEMA.md (complete with indexes)
- [ ] API_SPEC.md (all endpoints documented)
- [ ] n8n_WORKFLOW_SPECS (at least 5 workflows specified)
- [ ] UX_REFINEMENTS.md (missing flows designed)

### Accounts & API Keys
- [ ] iTerm2 or Warp installed
- [ ] GitHub repository structured
- [ ] Supabase project created
- [ ] OpenRouter API key
- [ ] Runway ML API access
- [ ] Stripe account configured
- [ ] All keys in .env file

### Testing Environment
- [ ] AI models tested and benchmarked
- [ ] Supabase connected and functional
- [ ] n8n accessible and configured
- [ ] Stripe test mode working

### Code Generation Setup
- [ ] Agent prompts written
- [ ] Gemini context prepared
- [ ] Claude Opus 4.5 context prepared
- [ ] Flash 3 audit checklist ready

---

## 🚀 Timeline Estimate

**Documentation Phase:** 3-4 days
**Environment Setup:** 2-3 days
**Backend Code Generation:** 3-5 days
**Frontend Code Generation:** 5-7 days
**Integration & Testing:** 5-7 days
**Deployment to Staging:** 2-3 days

**Total:** ~3-4 weeks to MVP

---

## 💡 Pro Tips

1. **Use iTerm2 split panes:**
   - Left pane: Claude (frontend)
   - Right pane: Gemini (backend)
   - Bottom pane: Terminal commands

2. **Keep PRD.md as single source of truth:**
   - All agents reference this
   - Update it when requirements change
   - Version control in Git

3. **Test incrementally:**
   - Don't wait until everything is built
   - Test each component as it's generated
   - Fix issues immediately

4. **Use Flash 3 proactively:**
   - Review code before committing
   - Catch security issues early
   - Cheaper than fixing in production

---

**Status:** Ready to proceed with Phase 1 (Documentation) and Phase 4 (API Key Setup)

**Next Session Focus:** Create DATABASE_SCHEMA.md and API_SPEC.md

---

Last Updated: Dec 18, 2024
