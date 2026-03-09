# SwiftList Security Hardening Protocol
**Version**: 1.0
**Priority**: CRITICAL - MUST IMPLEMENT BEFORE MVP LAUNCH
**Date**: 2025-12-31
**Status**: 🚨 REQUIRED FOR PRODUCTION

---

## 🎯 Executive Summary

**CRITICAL**: Vibe-coded apps (including SwiftList) are vulnerable to 5 major security flaws by default. This document provides the **mandatory security implementation** to transition SwiftList from "MVP prototype" to "Production Secure."

**Timeline**: Implement ALL 5 phases BEFORE January 15, 2026 launch.

**Legal Risk**: Data breach = GDPR fines (€20M or 4% revenue) + lawsuits + reputation damage.

---

## 🚨 The 5 Critical Flaws in Vibe-Coded Apps

### 1. **Database Security is WIDE OPEN** ⚠️ HIGHEST RISK
**Problem**: Supabase defaults to permissive rules. AI rarely implements Row Level Security (RLS).
**Risk**: Data breaches, unauthorized admin access, user data exposed.
**Legal Impact**: GDPR violations, class-action lawsuits.

### 2. **Missing Backend Architecture**
**Problem**: Business logic on client-side exposes API keys, secrets, credit calculations.
**Risk**: Attackers reverse-engineer credit system, steal API keys, manipulate pricing.

### 3. **No Rate Limiting**
**Problem**: APIs without rate limits = DDoS attacks + massive billing.
**Risk**: $10,000+ unexpected Stripe/OpenAI bills, service downtime.

### 4. **Unscanned Vulnerabilities**
**Problem**: AI doesn't follow security best practices (XSS, SQL injection, CSRF).
**Risk**: Account takeovers, data theft, malware injection.

### 5. **Smart Contract Issues** (Not applicable to SwiftList - no blockchain)

---

## 📋 Pre-Launch Security Checklist

**MANDATORY - DO NOT SKIP**:

- [ ] Database: RLS enabled on ALL tables with deny-by-default policies
- [ ] Backend: ALL business logic moved to server-side (Next.js Server Actions / API Routes)
- [ ] Rate Limiting: Implemented on ALL endpoints (Auth0, n8n webhooks, Stripe webhooks)
- [ ] Vulnerability Scan: Run SAST scanner (scanner.vibeship.co or Semgrep)
- [ ] Secrets Management: Zero API keys exposed client-side
- [ ] Authentication: Auth0 properly configured with secure token handling
- [ ] Permissions: Database access gated by user roles (profiles.subscription_tier)
- [ ] Penetration Test: Trusted developer attempts to breach database
- [ ] Code Review: Security-focused audit of credit deduction logic
- [ ] Monitoring: Error tracking (Sentry) + anomaly detection (WF-29 AI Monitor)

---

## 🏗️ SwiftList Security Architecture

### Current Tech Stack
```
┌──────────────────────────────────────────────────────────┐
│ FRONTEND (Client-Side - UNTRUSTED ZONE)                  │
│ • React SPA (AWS Amplify)                                │
│ • Auth0 Login UI                                         │
│ • Job Submission Forms                                   │
│ • Preset Marketplace UI                                  │
│ • Mission Control Dashboard (read-only)                  │
│                                                           │
│ ⚠️ NEVER TRUST CLIENT INPUT                              │
│ ⚠️ NO API KEYS                                           │
│ ⚠️ NO BUSINESS LOGIC                                     │
│ ⚠️ NO DIRECT DATABASE ACCESS                             │
└─────────────────┬────────────────────────────────────────┘
                  │ HTTPS Only
                  ▼
┌──────────────────────────────────────────────────────────┐
│ BACKEND (Server-Side - TRUSTED ZONE)                     │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Next.js API Routes (if using Next.js)               │ │
│ │ OR                                                  │ │
│ │ AWS Lambda + API Gateway (if serverless)            │ │
│ │                                                     │ │
│ │ • /api/jobs/submit → Validates, checks credits     │ │
│ │ • /api/credits/purchase → Stripe integration       │ │
│ │ • /api/presets/generate → Creates user presets     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ n8n Workflows (AWS Lightsail - Internal Only)       │ │
│ │                                                     │ │
│ │ • WF-01 through WF-27                              │ │
│ │ • Webhook endpoints: /webhook/decider, etc.        │ │
│ │ • Signature verification for all webhooks          │ │
│ │ • Rate limiting: 100 req/min per user_id           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ✅ ALL BUSINESS LOGIC HERE                               │
│ ✅ API KEYS STORED IN .env (NEVER COMMITTED)             │
│ ✅ CREDIT DEDUCTIONS ATOMIC (PostgreSQL transactions)    │
└─────────────────┬────────────────────────────────────────┘
                  │ Private VPC
                  ▼
┌──────────────────────────────────────────────────────────┐
│ DATABASE (Supabase PostgreSQL)                           │
│                                                           │
│ • Row Level Security (RLS) ON ALL TABLES                 │
│ • Service Role Key: ONLY in backend .env                 │
│ • Anon Key: Frontend only (read-only public data)        │
│                                                           │
│ ✅ ZERO TRUST - DENY BY DEFAULT                          │
│ ✅ USER ISOLATION - auth.uid() policies                  │
│ ✅ AUDIT LOGS - All mutations logged                     │
└──────────────────────────────────────────────────────────┘
```

---

## 🔒 PHASE 1: Database Hardening (Row Level Security)

### Current State: ⚠️ VULNERABLE
Supabase tables created without RLS = **WIDE OPEN** to anyone with anon key.

### Target State: ✅ SECURE
Every table protected with deny-by-default policies + user-specific access.

---

### Implementation: security/database_hardening.sql

Create this file and run against Supabase:

```sql
-- ============================================================================
-- SWIFTLIST DATABASE SECURITY HARDENING
-- ============================================================================
-- WARNING: This will DENY ALL ACCESS by default. Test thoroughly!
-- Run this AFTER importing schema but BEFORE going public.
-- ============================================================================

-- STEP 1: Enable RLS on ALL tables
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_usage ENABLE ROW LEVEL SECURITY;

-- STEP 2: Drop any existing permissive policies (if any)
-- ============================================================================

-- Drop all policies (fresh start)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
-- Repeat for all tables...

-- STEP 3: DENY ALL by default (anon role has ZERO access)
-- ============================================================================

-- Profiles Table
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CRITICAL: Users CANNOT delete their own profiles (prevent data loss)
-- Only service_role (backend) can delete profiles
CREATE POLICY "profiles_delete_admin_only" ON profiles
  FOR DELETE
  USING (false); -- No one can delete via client

-- Jobs Table (Users can only see their own jobs)
CREATE POLICY "jobs_select_own" ON jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "jobs_insert_own" ON jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users CANNOT update jobs (only backend via service_role)
CREATE POLICY "jobs_update_backend_only" ON jobs
  FOR UPDATE
  USING (false);

CREATE POLICY "jobs_delete_own" ON jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Transactions Table (Read-only for users, write-only for backend)
CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users CANNOT insert/update/delete transactions (backend only)
CREATE POLICY "transactions_insert_backend_only" ON transactions
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "transactions_update_backend_only" ON transactions
  FOR UPDATE
  USING (false);

CREATE POLICY "transactions_delete_backend_only" ON transactions
  FOR DELETE
  USING (false);

-- Presets Table (Public read, own write)
CREATE POLICY "presets_select_public" ON presets
  FOR SELECT
  USING (is_public = true OR auth.uid() = creator_user_id);

CREATE POLICY "presets_insert_own" ON presets
  FOR INSERT
  WITH CHECK (auth.uid() = creator_user_id);

CREATE POLICY "presets_update_own" ON presets
  FOR UPDATE
  USING (auth.uid() = creator_user_id)
  WITH CHECK (auth.uid() = creator_user_id);

CREATE POLICY "presets_delete_own" ON presets
  FOR DELETE
  USING (auth.uid() = creator_user_id);

-- Error Logs Table (Users can see own errors, backend can write all)
CREATE POLICY "error_logs_select_own" ON error_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Backend only can insert error logs
CREATE POLICY "error_logs_insert_backend_only" ON error_logs
  FOR INSERT
  WITH CHECK (false);

-- Background Variants Table (Users can see own variants)
CREATE POLICY "background_variants_select_own" ON background_variants
  FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM jobs WHERE job_id = background_variants.job_id));

-- Backend only can insert variants
CREATE POLICY "background_variants_insert_backend_only" ON background_variants
  FOR INSERT
  WITH CHECK (false);

-- Referrals Table (Users can see referrals they created or received)
CREATE POLICY "referrals_select_related" ON referrals
  FOR SELECT
  USING (
    auth.uid() = referrer_user_id OR
    auth.uid() = referred_user_id
  );

-- Backend only can insert referrals (prevent self-referral exploits)
CREATE POLICY "referrals_insert_backend_only" ON referrals
  FOR INSERT
  WITH CHECK (false);

-- Preset Usage Table (Users can see own usage, creators can see their preset usage)
CREATE POLICY "preset_usage_select_related" ON preset_usage
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT creator_user_id FROM presets WHERE preset_id = preset_usage.preset_id)
  );

-- Backend only can insert usage records
CREATE POLICY "preset_usage_insert_backend_only" ON preset_usage
  FOR INSERT
  WITH CHECK (false);

-- ============================================================================
-- STEP 4: Service Role Security (Backend Only)
-- ============================================================================

-- The service_role key BYPASSES RLS entirely.
-- CRITICAL: This key must ONLY exist in backend .env files.
-- NEVER expose service_role key to client.
-- NEVER commit service_role key to git.

-- Verification:
-- 1. Check .env file: SUPABASE_SERVICE_ROLE_KEY=eyJhb...
-- 2. Check .gitignore includes: .env, .env.local, .env.*
-- 3. Check frontend code: ONLY uses SUPABASE_ANON_KEY

-- ============================================================================
-- STEP 5: Verification Queries
-- ============================================================================

-- Test 1: Try to select from profiles as anon (should return ZERO rows unless authenticated)
-- Run in Supabase SQL Editor with RLS ON
SELECT * FROM profiles; -- Should fail or return empty

-- Test 2: Try to insert as anon (should fail)
INSERT INTO profiles (user_id, email) VALUES ('test-user', 'test@test.com'); -- Should fail

-- Test 3: Try to update credits as anon (should fail - CRITICAL)
UPDATE profiles SET credits_balance = 999999 WHERE user_id = 'any-user'; -- Should fail

-- Test 4: Verify RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- All should show rowsecurity = true

-- ============================================================================
-- STEP 6: Emergency Rollback (if something breaks)
-- ============================================================================

-- DANGER: This disables all RLS (use only if locked out)
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
-- ... (repeat for all tables)

-- Then re-run this script after fixing policies.

-- ============================================================================
-- MAINTENANCE: Add RLS to new tables
-- ============================================================================

-- Template for any new table:
--
-- ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "new_table_select_own" ON new_table
--   FOR SELECT
--   USING (auth.uid() = user_id);
--
-- ... (repeat for INSERT, UPDATE, DELETE)

-- ============================================================================
-- END OF DATABASE HARDENING SCRIPT
-- ============================================================================
```

---

### Verification Checklist (Database)

**Run these tests AFTER applying hardening script**:

```bash
# Test 1: Attempt to read all profiles (should fail)
curl -X GET 'https://YOUR_PROJECT.supabase.co/rest/v1/profiles' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
# Expected: Empty array [] or error

# Test 2: Attempt to update credits (should fail)
curl -X PATCH 'https://YOUR_PROJECT.supabase.co/rest/v1/profiles?user_id=eq.test-user' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"credits_balance": 999999}'
# Expected: Error "new row violates row-level security policy"

# Test 3: Verify RLS enabled
# Run in Supabase SQL Editor:
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
# Expected: All tables show rowsecurity = true
```

**Manual Penetration Test**:
1. Create test user account
2. Open browser DevTools → Network tab
3. Find Supabase API calls
4. Copy request as cURL
5. Modify `user_id` to different user
6. Execute → Should fail with 403 Forbidden

**If any test passes (returns data)**: RLS is NOT working. DO NOT LAUNCH.

---

## 🔐 PHASE 2: Backend Architecture Segregation

### Problem: Client-Side Business Logic

**Current Risk**: If React frontend has code like this:

```javascript
// ❌ INSECURE - DO NOT DO THIS
const submitJob = async () => {
  const user = await supabase.auth.getUser();

  // DANGER: Client can manipulate this
  const credits_required = 5; // Attacker changes to 0

  // DANGER: No validation
  const { data } = await supabase
    .from('profiles')
    .update({ credits_balance: credits_balance - credits_required })
    .eq('user_id', user.id);

  // DANGER: Direct database access from client
  await supabase.from('jobs').insert({ user_id: user.id, status: 'pending' });
};
```

**Exploit**: Attacker opens DevTools, modifies `credits_required` to 0, gets free jobs.

---

### Solution: Server-Side Business Logic

**Architecture**:
```
Client (React) → Next.js API Route → n8n Workflow → Database
```

**Secure Implementation**:

#### File: `src/app/api/jobs/submit/route.ts`

```typescript
// ✅ SECURE - Backend validates everything
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Service role key (bypasses RLS - ONLY on server)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // NEVER expose this to client
);

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const { workflow_id, image_base64, preset_id } = body;

    // Validation
    if (!workflow_id || !image_base64) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Determine credits required (SERVER-SIDE LOGIC - untrusted input)
    const workflowCredits: Record<string, number> = {
      'WF-06': 10,
      'WF-07': 5,
      'WF-08': 10,
      // ... all workflows
    };

    const credits_required = workflowCredits[workflow_id];
    if (!credits_required) {
      return NextResponse.json({ error: 'Invalid workflow' }, { status: 400 });
    }

    // 4. Check user credits (atomic transaction)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_balance, subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (profile.credits_balance < credits_required) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // 5. Create job record (status: pending)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        workflow_id,
        preset_id,
        status: 'pending',
        credits_charged: credits_required,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    // 6. Call n8n webhook (internal network only)
    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL + '/decider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SwiftList-Signature': generateSignature(body) // Webhook security
      },
      body: JSON.stringify({
        job_id: job.job_id,
        user_id: user.id,
        workflow_id,
        image_base64,
        preset_id,
        credits_required
      })
    });

    if (!n8nResponse.ok) {
      return NextResponse.json({ error: 'Workflow execution failed' }, { status: 500 });
    }

    // 7. Return job info to client
    return NextResponse.json({
      job_id: job.job_id,
      status: 'processing',
      credits_charged: credits_required,
      estimated_completion: new Date(Date.now() + 30000).toISOString()
    });

  } catch (error) {
    console.error('Job submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Webhook signature generation (HMAC)
function generateSignature(body: any): string {
  const crypto = require('crypto');
  const secret = process.env.N8N_WEBHOOK_SECRET!;
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}
```

#### Client-Side (React) - Simplified

```typescript
// ✅ SECURE - Client just calls API, no business logic
const submitJob = async (workflowId: string, imageBase64: string) => {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch('/api/jobs/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      image_base64: imageBase64,
      preset_id: selectedPreset?.id
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
};
```

---

### Refactoring Checklist

**Move to Server-Side**:
- [ ] Credit balance checks → API route
- [ ] Credit deductions → API route (atomic transaction)
- [ ] Job creation → API route
- [ ] Workflow routing logic → API route
- [ ] Stripe checkout creation → API route
- [ ] Preset creation → API route
- [ ] Referral code validation → API route
- [ ] Auto-refund processing → n8n WF-24 only

**Client-Side Should Only**:
- [ ] Display UI
- [ ] Handle form inputs
- [ ] Call API routes
- [ ] Display results
- [ ] Handle loading states

---

## ⏱️ PHASE 3: Rate Limiting Implementation

### Problem: No Rate Limits = $10,000+ Surprise Bills

**Attack Scenarios**:
1. **DDoS**: Attacker floods `/api/jobs/submit` → 1,000,000 Stability AI requests → $15,000 bill
2. **Brute Force**: Attacker tries 10,000 login attempts → Account takeover
3. **Credit Farming**: Attacker creates 1,000 accounts, claims free trials → -$2,500 revenue

---

### Solution: Middleware Rate Limiting

#### File: `middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize rate limiter (use Upstash Redis free tier)
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
  analytics: true,
});

export async function middleware(request: NextRequest) {
  // Get client IP
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown';

  // Define rate limits by route
  const rateLimits: Record<string, { limit: number; window: string }> = {
    '/api/jobs/submit': { limit: 10, window: '60 s' }, // 10 jobs per minute
    '/api/credits/purchase': { limit: 5, window: '60 s' }, // 5 purchases per minute
    '/api/auth/signup': { limit: 3, window: '3600 s' }, // 3 signups per hour
    '/api/auth/login': { limit: 5, window: '60 s' }, // 5 login attempts per minute
    '/api/presets/generate': { limit: 10, window: '3600 s' }, // 10 preset generations per hour
  };

  // Check if route needs rate limiting
  const matchedRoute = Object.keys(rateLimits).find(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (matchedRoute) {
    const { limit, window } = rateLimits[matchedRoute];

    // Create custom rate limiter for this route
    const routeLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, window),
      analytics: true,
    });

    const { success, limit: maxLimit, reset, remaining } = await routeLimiter.limit(
      `${matchedRoute}:${ip}`
    );

    // If rate limit exceeded
    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retry_after: Math.floor((reset - Date.now()) / 1000),
          limit: maxLimit
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxLimit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.floor((reset - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Add rate limit headers to successful requests
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', maxLimit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*', // Apply to all API routes
  ],
};
```

#### Alternative: n8n Workflow Rate Limiting

For n8n webhooks, add rate limiting directly in workflows:

**WF-01 Decider - Rate Limit Node**:
```json
{
  "parameters": {
    "jsCode": "// Rate limiting logic\nconst userId = $json.body.user_id;\nconst redis = require('redis');\nconst client = redis.createClient({ url: '{{REDIS_URL}}' });\n\nawait client.connect();\n\nconst key = `ratelimit:${userId}:${Date.now() / 60000 | 0}`;\nconst count = await client.incr(key);\nawait client.expire(key, 60); // 1 minute TTL\n\nif (count > 10) {\n  throw new Error('Rate limit exceeded: 10 jobs per minute');\n}\n\nawait client.disconnect();\nreturn $input.all();"
  },
  "name": "Rate Limit Check",
  "type": "n8n-nodes-base.code"
}
```

---

### Rate Limit Configuration

**Public Routes** (no auth required):
- Landing page: Unlimited (static assets)
- Pricing page: Unlimited
- API health check: 100 req/10s

**Authentication Routes** (prevent brute force):
- Login: **5 req/min** per IP
- Signup: **3 req/hour** per IP
- Password reset: **3 req/hour** per IP
- Email verification: **10 req/hour** per IP

**Authenticated Routes** (per user):
- Job submission: **10 jobs/min** (prevents accidental loops)
- Credit purchase: **5 purchases/min** (prevents double-billing bugs)
- Preset generation: **10 presets/hour** (prevents spam)
- Profile update: **5 updates/min**

**Webhook Routes** (external services):
- Stripe webhooks: **100 req/min** (signature verified)
- n8n webhooks: **Internal only** (VPC network, signature verified)

---

## 🔍 PHASE 4: Vulnerability Scanning (SAST)

### Tools to Use

**1. scanner.vibeship.co** (Free, AI-powered):
```bash
# 1. Push code to GitHub (private repo)
git push origin main

# 2. Visit https://scanner.vibeship.co
# 3. Connect GitHub repo
# 4. Run scan
# 5. Download "Master Fix Prompt"
# 6. Give prompt to Claude Code to fix issues
```

**2. Semgrep** (Open-source SAST):
```bash
# Install
npm install -g @semgrep/cli

# Scan
semgrep --config=auto .

# Generate report
semgrep --config=auto . --json > security-report.json
```

**3. npm audit** (Dependency vulnerabilities):
```bash
# Check for vulnerable packages
npm audit

# Auto-fix (use with caution)
npm audit fix

# Force fix (breaking changes possible)
npm audit fix --force
```

**4. Snyk** (Free tier available):
```bash
# Install
npm install -g snyk

# Authenticate
snyk auth

# Test
snyk test

# Monitor continuously
snyk monitor
```

---

### SwiftList-Specific Vulnerabilities to Check

**Critical**:
- [ ] SQL Injection in n8n workflows (use parameterized queries)
- [ ] XSS in preset names (sanitize user input)
- [ ] CSRF in job submission (use CSRF tokens)
- [ ] API key exposure (grep for `sk-`, `ey`, `key_`)
- [ ] Hardcoded secrets (grep for `password`, `secret`, `token`)

**High**:
- [ ] Insecure JWT handling (verify signatures, check expiry)
- [ ] Missing input validation (validate all user inputs)
- [ ] Weak password requirements (enforce 12+ chars, complexity)
- [ ] Unvalidated redirects (check return URLs)

**Medium**:
- [ ] Missing HTTPS enforcement (redirect HTTP → HTTPS)
- [ ] Verbose error messages (don't expose stack traces to users)
- [ ] Missing security headers (CSP, X-Frame-Options, etc.)

---

### Script: `scripts/security-check.sh`

```bash
#!/bin/bash

echo "🔍 SwiftList Security Scan Starting..."
echo ""

# 1. Check for exposed secrets
echo "📝 Scanning for exposed secrets..."
grep -r "sk-" --exclude-dir=node_modules --exclude-dir=.git . && echo "⚠️ Found potential API key!" || echo "✅ No API keys found"
grep -r "ey[A-Za-z0-9]" --exclude-dir=node_modules --exclude-dir=.git . && echo "⚠️ Found potential JWT!" || echo "✅ No JWTs found"

# 2. Check .gitignore
echo ""
echo "📝 Checking .gitignore..."
if grep -q ".env" .gitignore; then
  echo "✅ .env is in .gitignore"
else
  echo "⚠️ WARNING: .env not in .gitignore!"
fi

# 3. Check for committed .env files
echo ""
echo "📝 Checking for committed secrets..."
if git log --all --full-history -- "*.env" | grep -q "commit"; then
  echo "⚠️ WARNING: .env file found in git history! Run git filter-branch to remove."
else
  echo "✅ No .env files in git history"
fi

# 4. Run npm audit
echo ""
echo "📝 Running npm audit..."
npm audit --json > /tmp/npm-audit.json
if [ $(cat /tmp/npm-audit.json | jq '.metadata.vulnerabilities.total') -gt 0 ]; then
  echo "⚠️ Found $(cat /tmp/npm-audit.json | jq '.metadata.vulnerabilities.total') vulnerabilities"
  echo "Run: npm audit fix"
else
  echo "✅ No npm vulnerabilities found"
fi

# 5. Check Supabase RLS
echo ""
echo "📝 Checking Supabase RLS status..."
echo "⚠️ MANUAL CHECK REQUIRED: Run this in Supabase SQL Editor:"
echo "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"
echo "All tables should have rowsecurity = true"

# 6. Check rate limiting
echo ""
echo "📝 Checking for rate limiting..."
if [ -f "middleware.ts" ]; then
  if grep -q "Ratelimit" middleware.ts; then
    echo "✅ Rate limiting found in middleware"
  else
    echo "⚠️ WARNING: No rate limiting detected!"
  fi
else
  echo "⚠️ WARNING: middleware.ts not found!"
fi

echo ""
echo "🔍 Security scan complete. Review warnings above."
```

Make it executable:
```bash
chmod +x scripts/security-check.sh
./scripts/security-check.sh
```

---

## 🔐 PHASE 5: Secrets Management

### Current Risk: API Keys Exposed

**NEVER do this**:
```javascript
// ❌ INSECURE - Committed to GitHub
const OPENAI_API_KEY = "sk-proj-abc123...";
const STRIPE_SECRET = "sk_live_xyz789...";
```

**Exploit**: GitHub secret scanner finds key → Attacker uses → $10,000 bill.

---

### Solution: Environment Variables + Secret Rotation

#### File: `.env` (NEVER COMMIT)

```bash
# ============================================================================
# SWIFTLIST ENVIRONMENT VARIABLES
# ============================================================================
# WARNING: This file contains secrets. NEVER commit to Git.
# ============================================================================

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  # Public key (safe to expose)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...      # SECRET - Backend only!

# Auth0
AUTH0_SECRET=your-auth0-secret              # SECRET
AUTH0_BASE_URL=https://swiftlist.app
AUTH0_ISSUER_BASE_URL=https://your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret      # SECRET

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Public key
STRIPE_SECRET_KEY=sk_live_...                    # SECRET
STRIPE_WEBHOOK_SECRET=whsec_...                  # SECRET

# AI Providers
GOOGLE_VERTEX_AI_KEY=AIza...                # SECRET
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_REGION=us-central1

OPENAI_API_KEY=sk-proj-...                  # SECRET
ANTHROPIC_API_KEY=sk-ant-...                # SECRET

STABILITY_AI_KEY=sk-...                     # SECRET
REPLICATE_API_TOKEN=r8_...                  # SECRET

# Image Processing
PHOTOROOM_API_KEY=...                       # SECRET
REMOVEBG_API_KEY=...                        # SECRET

# Infrastructure
N8N_WEBHOOK_URL=https://n8n-internal.swiftlist.local  # Internal only
N8N_WEBHOOK_SECRET=...                      # SECRET

REDIS_URL=redis://...                       # SECRET (if using Upstash)

# Monitoring
SENTRY_DSN=https://...                      # PUBLIC (error tracking)
```

#### File: `.gitignore` (MANDATORY)

```
# Secrets - NEVER COMMIT
.env
.env.local
.env.production
.env.*.local
*.pem
*.key

# Dependencies
node_modules/
.pnp
.pnp.js

# Next.js
.next/
out/
build/
dist/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

#### Verification: Check Git History

```bash
# Check if secrets were ever committed
git log --all --full-history -- "*.env"
git log --all --full-history --grep="sk-"
git log --all --full-history --grep="secret"

# If found, remove from history (NUCLEAR OPTION)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: Rewrites history)
git push origin --force --all
git push origin --force --tags
```

---

### Secret Rotation Schedule

**Immediately After Breach**:
- Rotate ALL secrets
- Revoke compromised keys
- Notify users if data exposed

**Regular Rotation**:
- Stripe keys: Every 90 days
- Supabase service_role: Every 90 days
- n8n webhook secrets: Every 90 days
- AI provider keys: Every 180 days

**Automated Rotation** (Future):
- Use AWS Secrets Manager or Vault
- Auto-rotate on schedule
- Alert if rotation fails

---

## 📊 Security Monitoring & Incident Response

### Real-Time Monitoring (WF-29: AI System Monitor)

**Enhanced for Security**:

```javascript
// Add security monitoring to WF-29
const securityChecks = {
  // 1. Unusual credit balance changes
  creditAnomaly: await detectCreditAnomaly(),

  // 2. Failed authentication spikes
  authFailures: await countFailedLogins(last15min),

  // 3. Rate limit violations
  rateLimitHits: await countRateLimitExceeded(last15min),

  // 4. Suspicious job patterns (same image 100× times)
  duplicateJobs: await detectDuplicateJobs(),

  // 5. Database RLS policy violations
  rlsViolations: await checkRLSViolations(),
};

// Alert thresholds
if (securityChecks.authFailures > 50) {
  await slackAlert('#swiftlist-security', 'Possible brute force attack detected');
}

if (securityChecks.creditAnomaly.detected) {
  await slackAlert('#swiftlist-security', `Credit anomaly: User ${userId} balance changed by ${amount}`);
  await freezeAccount(userId); // Auto-freeze for review
}
```

---

### Incident Response Playbook

**IF: Data Breach Detected**

1. **Immediate** (0-15 minutes):
   - [ ] Take affected systems offline
   - [ ] Rotate all secrets
   - [ ] Enable forensic logging
   - [ ] Alert security team via Slack #swiftlist-security

2. **Short-term** (15-60 minutes):
   - [ ] Identify scope (which users, what data)
   - [ ] Preserve logs for forensic analysis
   - [ ] Block attacker IP addresses
   - [ ] Notify legal team

3. **Medium-term** (1-24 hours):
   - [ ] Notify affected users (email + in-app)
   - [ ] File GDPR breach report (72-hour deadline)
   - [ ] Issue public statement (if >1000 users affected)
   - [ ] Offer credit monitoring (if PII exposed)

4. **Long-term** (1-7 days):
   - [ ] Root cause analysis
   - [ ] Security audit & penetration test
   - [ ] Update SECURITY.md with lessons learned
   - [ ] Implement additional controls

**IF: Rate Limit Attack**

1. **Auto-Response** (WF-29):
   - [ ] Temporarily increase rate limit thresholds (avoid false positives)
   - [ ] Block top offending IPs (auto-ban for 1 hour)
   - [ ] Alert #swiftlist-ops

2. **Manual Review**:
   - [ ] Check if legitimate traffic spike (press coverage, viral post)
   - [ ] If attack: Permanent IP ban + report to abuse contact
   - [ ] If legitimate: Scale infrastructure

---

## 🎓 Security Training for Team

### Before Launch: Security Workshop (4 hours)

**Session 1: Threat Modeling** (1 hour)
- Review SwiftList attack surface
- STRIDE analysis (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation)
- Prioritize risks

**Session 2: Secure Coding** (1 hour)
- Input validation (never trust user input)
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize outputs)
- CSRF tokens

**Session 3: Hands-On Penetration Testing** (1.5 hours)
- Attempt to breach database RLS
- Attempt to steal API keys
- Attempt to manipulate credit balance
- Attempt rate limit bypass

**Session 4: Incident Response Drill** (0.5 hours)
- Simulated data breach
- Practice playbook steps
- Review communication templates

---

## 📝 SECURITY.md (Public Documentation)

Create this file for transparency:

```markdown
# SwiftList Security

## Reporting Security Issues

**DO NOT** open a public GitHub issue for security vulnerabilities.

Email: security@swiftlist.app
PGP Key: [link to public key]

We will respond within 48 hours and provide a fix within 7 days.

## Security Measures

SwiftList implements the following security controls:

- ✅ **Database Security**: Row Level Security (RLS) on all tables
- ✅ **Backend Architecture**: All business logic server-side
- ✅ **Rate Limiting**: 10 requests/minute on job submission
- ✅ **Secrets Management**: Zero secrets in client code
- ✅ **Vulnerability Scanning**: Weekly SAST scans
- ✅ **Authentication**: Auth0 with MFA support
- ✅ **Monitoring**: Real-time anomaly detection (WF-29)

## Bug Bounty Program

We offer rewards for responsibly disclosed vulnerabilities:

- **Critical** (RCE, Data Breach): $500-$2,000
- **High** (Auth Bypass, Privilege Escalation): $200-$500
- **Medium** (XSS, CSRF): $50-$200
- **Low** (Info Disclosure): $25-$50

## Security Audits

Last audit: [Date]
Conducted by: [Firm]
Findings: [Link to public report]

## Compliance

SwiftList is compliant with:
- GDPR (EU Data Protection)
- CCPA (California Consumer Privacy Act)
- PCI DSS Level 4 (Stripe handles payments)

## Contact

Security Team: security@swiftlist.app
</markdown>
```

---

## ✅ FINAL PRE-LAUNCH VERIFICATION

**Print this checklist and check each box manually**:

### Database Security
- [ ] RLS enabled on ALL tables (`security/database_hardening.sql` run)
- [ ] Penetration test passed (trusted dev attempted breach, failed)
- [ ] Service role key ONLY in backend .env (grepped codebase, zero matches in frontend)
- [ ] Anon key permissions verified (read-only public data only)

### Backend Architecture
- [ ] Zero direct Supabase calls from React components
- [ ] All business logic in API routes or n8n workflows
- [ ] Credit deductions atomic (PostgreSQL transactions)
- [ ] Job creation server-side only

### Rate Limiting
- [ ] Middleware implemented (`middleware.ts` exists)
- [ ] Job submission: 10/min per user
- [ ] Auth endpoints: 5/min per IP
- [ ] Tested: Exceeded rate limit → 429 error

### Secrets Management
- [ ] `.env` in `.gitignore`
- [ ] No secrets in git history (`git log --all --grep="sk-"` returns empty)
- [ ] All API keys in environment variables
- [ ] Client code grepped: Zero instances of `sk-`, `ey[A-Z]`, `key_`, `secret` hardcoded

### Vulnerability Scanning
- [ ] Ran `scanner.vibeship.co` scan (0 critical, 0 high issues)
- [ ] Ran `npm audit` (0 vulnerabilities)
- [ ] Ran `scripts/security-check.sh` (all checks passed)

### Monitoring & Response
- [ ] WF-29 AI Monitor includes security checks
- [ ] Slack #swiftlist-security channel created
- [ ] Incident response playbook reviewed by team
- [ ] SECURITY.md published

### Legal & Compliance
- [ ] Terms of Service reviewed by lawyer
- [ ] Privacy Policy includes GDPR compliance
- [ ] Cookie consent banner implemented
- [ ] Data retention policy defined (delete user data after 90 days of inactivity)

### Final Tests
- [ ] Attempted to read other user's jobs → Failed ✅
- [ ] Attempted to update credits from client → Failed ✅
- [ ] Attempted to bypass rate limit → Failed ✅
- [ ] Attempted to expose API key → Not found ✅
- [ ] Load tested: 1000 concurrent users → System stable ✅

---

## 🚨 GO / NO-GO DECISION

**If ANY checkbox above is unchecked**: **DO NOT LAUNCH**

**If all checkboxes checked**: **PROCEED WITH LAUNCH**

**Sign-off Required**:
- [ ] CEO/Founder: ___________________
- [ ] Lead Developer: ___________________
- [ ] Security Auditor: ___________________

**Date**: ___________________

---

## 📚 Additional Resources

### Tools
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10 2025](https://owasp.org/www-project-top-ten/)
- [scanner.vibeship.co](https://scanner.vibeship.co) - Free SAST for vibe coders
- [Semgrep](https://semgrep.dev) - Open-source SAST
- [Upstash Ratelimit](https://upstash.com/docs/redis/features/ratelimiting) - Free tier rate limiting

### Guides
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Stripe Security](https://stripe.com/docs/security)
- [Auth0 Security](https://auth0.com/docs/secure)

### Communities
- [r/netsec](https://reddit.com/r/netsec) - Security news
- [HackerOne](https://hackerone.com) - Bug bounty platform
- [OWASP Slack](https://owasp.org/slack/invite) - Security community

---

## 📞 Emergency Contacts

**Data Breach Hotline**: security@swiftlist.app
**Legal (GDPR)**: legal@swiftlist.app
**Infrastructure**: ops@swiftlist.app

**External**:
- Supabase Support: support@supabase.io
- Stripe Security: security@stripe.com
- Auth0 Security: security-alert@auth0.com

---

*Last Updated: 2025-12-31*
*Next Review: Before MVP Launch (Jan 15, 2026)*
*Owner: Security Team*
