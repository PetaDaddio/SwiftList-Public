# SwiftList Capacity Planning & Scaling Playbook
**Created:** 2026-03-03 | **Author:** CTO Analysis (Claude Code)
**Last Updated:** 2026-03-03

This document models SwiftList's infrastructure bottlenecks at specific user/job thresholds and provides a pre-populated scaling playbook to avoid downtime.

---

## Current Architecture Summary

| Component | Spec | Scaling Model |
|-----------|------|---------------|
| **SvelteKit App** | Railway, 512MB/1vCPU | Auto-scale 1–5 replicas (CPU 70%, memory 80%) |
| **BullMQ Workers** | Railway, 512MB/1vCPU, concurrency 5/instance | Auto-scale 1–5 replicas |
| **Supabase** | Micro compute (2-core ARM) | 60 direct / 200 pooler connections |
| **Redis (Upstash)** | Free tier | 500K commands/month, 10K commands/day |
| **Cloudflare** | CDN/WAF/DDoS | Effectively unlimited at our scale |

---

## Provider Rate Limits (Current Tier)

| Provider | Limit | Used For | Tier |
|----------|-------|----------|------|
| **Replicate RMBG** | 600 RPM | Background removal | Default |
| **fal.ai Bria RMBG** | 2 concurrent tasks | Background removal (alt) | Free |
| **Google Imagen 3** | 10 images/min (IPM) | Scene generation | Tier 1 |
| **Gemini Flash** | 300 RPM / 1,500 RPD | Vision analysis | Tier 1 |
| **Anthropic Haiku** | 50 RPM | Classification | Tier 1 |
| **Stripe** | 100 ops/sec | Payments | Default |

**App-level rate limits (our code):**
- Job submission: 30/min per user
- Auth endpoints: 10/min per IP
- Signup: 3/min per IP
- Default API: 100/min per user

---

## Bottleneck Model

### How to read this table
Each row represents a usage milestone. The "First Bottleneck" column shows what breaks first at that scale. Jobs/day assumes an average job uses: 1 BG removal call + 0.5 scene generation calls + 1 vision analysis call + 1 classification call.

| Milestone | Jobs/Day | ~Users (DAU) | First Bottleneck | Action Required |
|-----------|----------|-------------|-------------------|-----------------|
| **Soft Launch** | 50–100 | 10–20 | None | Monitor only |
| **Early Traction** | 200–400 | 40–80 | Upstash Redis free tier (500K cmds/mo) | Upgrade to Upstash Pay-as-you-go ($0.2/100K cmds) |
| **Growing** | 500–800 | 100–160 | fal.ai concurrency (2 tasks) | Deposit $1K for 40 concurrent tasks, OR route all BG removal through Replicate |
| **Product-Market Fit** | 1,000 | 200 | Imagen 3 at 10 IPM (600/hr ceiling) | Apply for Tier 2 (20 IPM) or batch scene generation off-peak |
| **Scaling** | 2,000 | 400 | Supabase Micro connections (200 pooler) | Upgrade Supabase compute to Small (4-core, 300 pooler connections) |
| **Growth** | 3,000–5,000 | 600–1,000 | Railway worker ceiling (5 replicas × 5 concurrent = 25 jobs) | Upgrade Railway plan for more replicas; increase worker concurrency to 10 |
| **Scale** | 10,000+ | 2,000+ | Multiple: Anthropic RPM, Imagen IPM, DB connections | Tier upgrades across all providers, dedicated Supabase compute, worker fleet scaling |

---

## Detailed Bottleneck Analysis

### 1. Upstash Redis — First to Hit (~800 jobs/day)

**Why:** BullMQ is chatty. Each job generates ~20 Redis operations (enqueue, dequeue, status updates, progress, completion, cleanup). At 800 jobs/day = 16,000 ops/day = 480K ops/month, bumping against the 500K free tier limit.

**Symptoms:** Jobs fail to enqueue, `READONLY` errors in worker logs, stale job statuses.

**Fix:**
- Upgrade to Upstash Pay-as-you-go: $0.2 per 100K commands beyond free tier
- At 2,000 jobs/day (40K ops/day, 1.2M ops/month): ~$1.40/month
- At 10,000 jobs/day: ~$11/month
- **Cost is negligible** — upgrade proactively at launch

**Action:** Upgrade Upstash plan before public launch.

### 2. fal.ai Concurrency — Tight Constraint (~500 jobs/day)

**Why:** Default fal.ai tier allows only 2 concurrent tasks. If a BG removal job takes 5 seconds, you can process 24 images/minute through fal.ai. At 500 jobs/day with burst traffic (e.g., batch uploads), queue backs up immediately.

**Symptoms:** Long wait times for BG removal, timeout errors, job failures.

**Fix options:**
1. **Deposit $1K with fal.ai** → 40 concurrent tasks (960 images/min at 5s each)
2. **Route all BG removal through Replicate** → 600 RPM, no concurrency limit
3. **Hybrid:** Replicate as primary, fal.ai as fallback (current architecture supports this)

**Recommendation:** Use Replicate as primary BG removal engine. Update `rate-limiter.ts` to reflect Replicate's actual 600 RPM limit (currently configured at 50 RPM — a 12x undercount).

### 3. Google Imagen 3 — Scene Generation Ceiling (~1,000 jobs/day)

**Why:** Tier 1 allows 10 images per minute (IPM). Scene generation is the most constrained AI endpoint. At 10 IPM, you can generate 600 images/hour or 14,400/day — sounds high, but burst traffic from batch jobs can exhaust the per-minute quota fast.

**Symptoms:** 429 errors from Gemini API, scene generation failures, partial job completions.

**Fix:**
1. **Apply for Tier 2** (requires billing history): 20 IPM
2. **Implement request queuing** with backpressure: if Imagen queue depth > 10, delay new scene generation jobs
3. **Cache common scenes:** If multiple products use the same scene preset, reuse the generated background
4. **Off-peak batching:** Queue scene generation jobs and process during low-traffic hours

**Tier progression:**
| Tier | IPM | How to Qualify |
|------|-----|----------------|
| 1 | 10 | Default |
| 2 | 20 | Billing history + request |
| 3 | 50 | Higher spend + request |

### 4. Supabase Connections — Database Scaling (~2,000 jobs/day)

**Why:** Micro compute gives 60 direct + 200 pooler connections. Each SvelteKit instance and each worker instance holds a connection pool. With 5 app replicas + 5 worker replicas, you're using 10 base connections + overhead per request.

**Symptoms:** `too many connections` errors, intermittent 500s, slow queries.

**Fix:**
| Supabase Compute | Direct | Pooler | Monthly Cost |
|-----------------|--------|--------|-------------|
| Micro (current) | 60 | 200 | $0 (included in Pro) |
| Small | 90 | 300 | $40/mo |
| Medium | 120 | 400 | $80/mo |
| Large | 160 | 500 | $160/mo |

**Recommendation:** Upgrade to Small ($40/mo) when DAU exceeds 300 or when you see connection pool warnings in logs.

### 5. Railway Workers — Concurrent Job Processing (~3,000 jobs/day)

**Why:** 5 replicas × 5 concurrency = 25 concurrent jobs max. If average job takes 30 seconds, throughput = 50 jobs/minute = 3,000 jobs/hour. Sounds like plenty, but burst traffic (user uploads 50 images at once) can saturate the pool.

**Symptoms:** Jobs sit in `waiting` state for minutes, BullMQ queue depth grows, processing page shows stale progress.

**Fix:**
1. Increase worker concurrency from 5 to 10 per instance (test memory usage first)
2. Upgrade Railway plan for more replicas (Hobby: max 6, Pro: max 42)
3. Add priority queues: single-image jobs get priority over batch jobs

### 6. Anthropic Haiku — Classification (~3,000+ jobs/day)

**Why:** Tier 1 allows 50 RPM (3,000 RPH). Each job makes 1 classification call. At 3,000 jobs/day concentrated in 8 business hours = 375/hr, well within limits. But batch uploads could spike to 50+ calls/minute.

**Fix:** Reach Tier 2 (1,000 RPM) by spending $40 cumulative on Anthropic API. At $0.001/classification call, this happens naturally around 40,000 jobs.

---

## Cost Projections

### Per-Job Cost Breakdown

| Component | Cost/Job | Notes |
|-----------|----------|-------|
| BG Removal (Replicate) | $0.0023 | RMBG v1.4 |
| BG Removal (fal.ai) | ~$0.003 | Bria RMBG 2.0 |
| Scene Generation (Imagen 3) | $0.004 | Only if scene requested (~50% of jobs) |
| Vision Analysis (Gemini Flash) | $0.001 | Per image analyzed |
| Classification (Haiku) | $0.001 | Per job |
| **Total (BG removal only)** | **~$0.005** | |
| **Total (BG + scene)** | **~$0.009** | |

### Monthly Infrastructure Cost at Scale

| Scale | Jobs/Month | AI API Cost | Supabase | Railway | Redis | Total Infra |
|-------|-----------|-------------|----------|---------|-------|-------------|
| Soft launch | 1,500 | $8 | $25 (Pro) | $5 | $0 | ~$38 |
| 500/day | 15,000 | $75 | $25 | $10 | $1 | ~$111 |
| 1,000/day | 30,000 | $150 | $25 | $20 | $3 | ~$198 |
| 3,000/day | 90,000 | $450 | $65 | $40 | $8 | ~$563 |
| 10,000/day | 300,000 | $1,500 | $105 | $80 | $20 | ~$1,705 |

**Revenue comparison at 1,000 jobs/day:**
- If 200 DAU × average Maker plan ($29/mo) = $5,800 MRR
- Infra cost: ~$198/mo
- **Margin: ~96.6%**

---

## Scaling Playbook — Quick Reference

### Phase 1: Pre-Launch (NOW)
- [ ] Upgrade Upstash Redis to Pay-as-you-go
- [ ] Update Replicate rate limit in `rate-limiter.ts` from 50 to 600 RPM
- [ ] Confirm Gemini Flash model version (2.0 Flash retired March 3, 2026 — migrate to 2.5 Flash if needed)
- [ ] Set up provider billing alerts (see `docs/security/API-KEY-SECURITY-RUNBOOK.md`)
- [ ] Verify Railway auto-scaling is configured correctly

### Phase 2: 0–500 Jobs/Day (Launch)
- [ ] Monitor Upstash Redis command usage daily
- [ ] Monitor fal.ai queue depth — switch to Replicate-primary if latency spikes
- [ ] Watch for 429 errors in Sentry from any AI provider
- [ ] Set up Supabase connection monitoring (Dashboard > Database > Connections)

### Phase 3: 500–2,000 Jobs/Day (Traction)
- [ ] Apply for Imagen 3 Tier 2 (20 IPM)
- [ ] Upgrade Supabase compute to Small ($40/mo)
- [ ] Consider increasing BullMQ worker concurrency from 5 to 10
- [ ] Implement scene generation request queuing with backpressure
- [ ] Review Railway replica count — may need to increase max from 5

### Phase 4: 2,000–5,000 Jobs/Day (Growth)
- [ ] Upgrade Railway to Pro plan (up to 42 replicas)
- [ ] Apply for Imagen 3 Tier 3 (50 IPM)
- [ ] Implement scene caching for common presets
- [ ] Add priority queues (single > batch)
- [ ] Evaluate Supabase Medium compute ($80/mo)

### Phase 5: 5,000+ Jobs/Day (Scale)
- [ ] Dedicated Supabase compute
- [ ] Multi-region Railway deployment
- [ ] Provider-level SLAs with Replicate/Google
- [ ] Consider dedicated GPU instances for BG removal
- [ ] CDN-level image caching for processed outputs

---

## Monitoring Checklist (Weekly)

| Metric | Where to Check | Alert Threshold |
|--------|---------------|-----------------|
| Redis commands/day | Upstash Dashboard | >15,000/day |
| Supabase connections | Supabase Dashboard > Database | >150 pooler |
| BullMQ queue depth | Railway worker logs | >50 waiting jobs |
| Imagen 3 RPM | Google Cloud Console > Quotas | >8 IPM sustained |
| Replicate RPM | Replicate Dashboard | >400 RPM sustained |
| Job failure rate | Sentry + `/api/admin/metrics` | >5% |
| Worker memory | Railway Dashboard | >400MB per replica |
| P95 job duration | BullMQ metrics | >60 seconds |

---

## Emergency Playbook

### Scenario: AI Provider Rate Limited (429 Errors)
1. Check which provider is rate limited (Sentry alerts)
2. If Replicate: verify RPM limit is set to 600 (not 50)
3. If Imagen: enable request queuing, delay scene generation
4. If fal.ai: route all BG removal through Replicate
5. If Anthropic: reduce classification calls (cache recent results)

### Scenario: Database Connection Exhaustion
1. Check Supabase connection count in Dashboard
2. Identify if app or workers are holding connections
3. Reduce Railway replica count temporarily
4. Upgrade Supabase compute tier
5. Review connection pooling config (pgbouncer settings)

### Scenario: Worker Queue Backed Up
1. Check BullMQ queue depth in worker logs
2. If jobs are stuck: check for hung worker processes
3. Scale workers: increase Railway max replicas
4. If persistent: increase concurrency from 5 to 10
5. Prioritize single-image jobs over batch

### Scenario: Redis Command Limit Hit
1. Upstash will return READONLY errors
2. Upgrade to Pay-as-you-go immediately (takes effect instantly)
3. No data loss — BullMQ retries failed operations
4. Consider reducing BullMQ polling frequency if cost is a concern

---

## Key Insight: The Real Bottleneck Sequence

```
1. Upstash Redis free tier        →  ~800 jobs/day   →  $1/mo fix
2. fal.ai concurrency (2 tasks)   →  ~500 jobs/day   →  Use Replicate instead
3. Imagen 3 (10 IPM)              →  ~1,000 jobs/day  →  Apply for Tier 2
4. Supabase connections (200)     →  ~2,000 jobs/day  →  $40/mo upgrade
5. Railway workers (25 concurrent) →  ~3,000 jobs/day  →  Increase concurrency + replicas
```

The first three bottlenecks are all solvable with configuration changes or tier upgrades — no code changes needed. SwiftList's architecture scales well to ~3,000 jobs/day before requiring any significant infrastructure work.

---

## ⚠️ URGENT: Gemini 2.0 Flash Retirement

Gemini 2.0 Flash was retired on **March 3, 2026**. If SwiftList's vision analysis endpoints reference `gemini-2.0-flash`, they will start returning errors.

**Recommended migration:** Gemini 2.5 Flash (or latest stable Flash model)
**Files to check:** Any file importing or referencing the Gemini model ID for vision analysis.
**Priority:** IMMEDIATE — this affects production functionality.
