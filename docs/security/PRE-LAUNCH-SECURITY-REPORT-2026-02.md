# SwiftList Pre-Launch Security Report

**Date:** 2026-02-20
**Auditor:** Claude Opus 4.6 (automated)
**Scope:** SwiftList SvelteKit monorepo (`apps/swiftlist-app-svelte`, `workers`)
**Purpose:** Pre-launch security checklist — audit only, no fixes applied

---

## Summary

| # | Check | Result | Severity |
|---|-------|--------|----------|
| 1 | npm audit (app) | **NEEDS_ATTENTION** | HIGH |
| 2 | npm audit (workers) | **PASS** | LOW |
| 3 | Secrets scan | **NEEDS_ATTENTION** | MEDIUM |
| 4 | Security headers | **PASS** (with note) | LOW |
| 5 | RLS policy check | **NEEDS_ATTENTION** | HIGH |
| 6 | Rate limiting | **PASS** | — |
| 7 | Environment variable audit | **PASS** | — |
| 8 | CORS audit | **PASS** | — |

### P0 Items (Must Fix Before Launch)

1. **12 HIGH-severity npm vulnerabilities** in `apps/swiftlist-app-svelte` — includes DoS vectors in @sveltejs/kit, devalue, and minimatch, plus XSS vectors in svelte SSR. Run `npm audit fix` (non-breaking fixes available for most).
2. **4 `USING (true)` RLS policies** in Supabase migrations — 2 of 4 are not properly scoped to `service_role` in SQL (only in comments). Any authenticated user could potentially read/write `agent_cost_tracking` and `security_alerts` tables.
3. **Hardcoded Supabase credentials** in `apps/swiftlist-app-svelte/src/routes/api/email-signup/+server.ts` — CRM anon key and project URL committed to source. Should be moved to environment variables.

---

## 1. npm audit — App (`apps/swiftlist-app-svelte`)

**Result: NEEDS_ATTENTION**

```
16 vulnerabilities (2 low, 2 moderate, 12 high)
```

### HIGH severity

| Package | Vulnerability | Advisory |
|---------|--------------|----------|
| @sveltejs/kit | Memory amplification DoS (formdata deserializer) | GHSA-j2f3-wq62-6q46 |
| @sveltejs/kit | DoS + possible SSRF (prerendering) | GHSA-j62c-4x62-9r35 |
| @sveltejs/kit | CPU exhaustion (remote form deserialization) | GHSA-88qp-p4qg-rqm6 |
| @sveltejs/kit | Memory exhaustion (remote form deserialization) | GHSA-vrhm-gvg7-fpcf |
| devalue | DoS via memory/CPU exhaustion in `devalue.parse` | GHSA-g2pg-6438-jwpf |
| devalue | DoS via memory exhaustion in `devalue.parse` | GHSA-vw5p-8cq8-m7mv |
| devalue | CPU/memory amplification from sparse arrays | GHSA-33hq-fvwr-56pm |
| devalue | Prototype pollution via `uneval` | GHSA-8qm3-746x-r74r |
| minimatch | ReDoS via repeated wildcards | GHSA-3ppc-4f35-3m26 |

### MODERATE severity

| Package | Vulnerability | Advisory |
|---------|--------------|----------|
| lodash | Prototype pollution in `_.unset`/`_.omit` | GHSA-xxjr-mmjv-4gpg |
| svelte | XSS via SSR spread attributes | GHSA-f7gr-6p89-r883 |
| svelte | XSS in SSR `<option>` element | GHSA-h7h7-mm68-gmrc |
| svelte | XSS via `<svelte:element>` tag names | GHSA-m56q-vw4c-c2cp |
| svelte | SSR prototype chain leak via spread | GHSA-crpf-4hrx-3jrp |

### LOW severity

| Package | Vulnerability | Advisory |
|---------|--------------|----------|
| cookie | Out-of-bounds characters accepted | GHSA-pxg6-pf52-xh8x |
| qs | arrayLimit bypass DoS | GHSA-w7fw-mjwx-w883 |

**Remediation:** `npm audit fix` resolves most non-breaking issues. The `minimatch` fix (via @sentry chain) requires `npm audit fix --force` and installs `archiver@4.0.2` (breaking change).

---

## 2. npm audit — Workers (`workers/`)

**Result: PASS**

```
1 low severity vulnerability
```

| Package | Vulnerability | Advisory |
|---------|--------------|----------|
| qs | arrayLimit bypass DoS | GHSA-w7fw-mjwx-w883 |

**Remediation:** `npm audit fix` in `workers/` directory.

---

## 3. Secrets Scan

**Result: NEEDS_ATTENTION**

### Hardcoded Stripe keys (`sk_live_*`, `sk_test_*`)
**PASS** — No hardcoded Stripe secret keys found in `apps/` or `workers/`.

### Hardcoded Supabase service role keys
**PASS** — All references to `SUPABASE_SERVICE_ROLE_KEY` use environment variable access patterns:
- App: `env.SUPABASE_SERVICE_ROLE_KEY` (via `$env/dynamic/private`) — correct SvelteKit pattern
- Workers: `process.env.SUPABASE_SERVICE_ROLE_KEY` — correct Node.js pattern

### Hardcoded Supabase credentials
**FAIL** — Found hardcoded CRM Supabase anon key and project URL:

**File:** `apps/swiftlist-app-svelte/src/routes/api/email-signup/+server.ts:6-8`
```typescript
const CRM_SUPABASE_URL = 'https://wtxhopdlumljkuhkbnzj.supabase.co';
const CRM_ANON_KEY = 'eyJhbGciOiJIUzI1Ni...';
```

**Risk:** MEDIUM. The anon key is designed to be public, but hardcoding credentials in source:
- Prevents key rotation without code deployment
- Exposes the CRM project URL/ref in git history permanently
- Violates the project's own secrets management policy (CLAUDE.md Section 5)

**Recommendation:** Move to `VITE_PUBLIC_CRM_SUPABASE_URL` and `VITE_PUBLIC_CRM_ANON_KEY` environment variables.

### Test file with env var references
**INFO** — `apps/swiftlist-app-svelte/test-supabase-connection.js` references `process.env.SUPABASE_SERVICE_ROLE_KEY`. This is a test utility, not deployed code, but should be excluded from production builds or removed before launch.

---

## 4. Security Headers Audit

**Result: PASS** (with advisory note)

**File:** `apps/swiftlist-app-svelte/src/hooks.server.ts:42-61`

| Header | Status | Value |
|--------|--------|-------|
| X-Frame-Options | **PRESENT** | `DENY` |
| X-Content-Type-Options | **PRESENT** | `nosniff` |
| Referrer-Policy | **PRESENT** | `strict-origin-when-cross-origin` |
| Permissions-Policy | **PRESENT** | `camera=(), microphone=(), geolocation=()` |
| Strict-Transport-Security | **PRESENT** (prod only) | `max-age=31536000; includeSubDomains` |
| Content-Security-Policy | **PRESENT** (prod only) | See breakdown below |

### CSP Breakdown (production)

```
default-src 'self'
script-src 'self' 'unsafe-inline'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
img-src 'self' data: blob: https://*.supabase.co https://*.replicate.delivery https://replicate.delivery
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.replicate.com https://gateway.ai.cloudflare.com
frame-ancestors 'none'
```

**Advisory notes:**
- `script-src 'unsafe-inline'` is required by SvelteKit for hydration but weakens XSS protection. Consider adding nonce-based CSP when SvelteKit supports it.
- `style-src 'unsafe-inline'` is standard for Tailwind CSS but noted for awareness.
- Security headers are only applied in production (`dev ? {} : {...}`). This is intentional for development convenience but means dev mode has no CSP/HSTS protection.

---

## 5. RLS Policy Check (Supabase Migrations)

**Result: NEEDS_ATTENTION**

Found **4 instances** of `USING (true)` across 3 migration files:

### 5a. `009_create_jobs_table.sql:105-109` — LOW RISK (properly scoped)

```sql
CREATE POLICY "Service role full access" ON public.jobs
FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

**Assessment:** The `TO service_role` clause restricts this policy to the service role only. **Acceptable** for backend job processing.

### 5b. `007_lifeguard_monitoring_system.sql:131-135` — LOW RISK (properly scoped)

```sql
CREATE POLICY "..." ON public.lifeguard_incidents
FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

**Assessment:** Properly scoped to `service_role`. **Acceptable**.

### 5c. `004_agent_audit_tables.sql:114-118` — **HIGH RISK** (NOT properly scoped)

```sql
CREATE POLICY "Backend can manage cost tracking"
  ON agent_cost_tracking
  FOR ALL
  USING (true) WITH CHECK (true); -- Service role only
```

**Assessment:** The comment says "Service role only" but the SQL has **no `TO service_role` clause**. This means **any authenticated user** can read/write `agent_cost_tracking`. This is a **P0 vulnerability**.

### 5d. `004_agent_audit_tables.sql:176-180` — **HIGH RISK** (NOT properly scoped)

```sql
CREATE POLICY "Backend can manage security alerts"
  ON security_alerts
  FOR ALL
  USING (true) WITH CHECK (true); -- Service role only
```

**Assessment:** Same issue — missing `TO service_role` clause. **Any authenticated user** can read/write `security_alerts`. This is a **P0 vulnerability** — an attacker could:
- Read all security alert data (information disclosure)
- Insert fake security alerts (data poisoning)
- Delete security alerts to cover tracks

**Recommendation:** Add `TO service_role` to both policies in migration 004, or replace with `auth.jwt()->>'role' = 'service_role'` check.

---

## 6. Rate Limiting Check

**Result: PASS**

**File:** `apps/swiftlist-app-svelte/src/hooks.server.ts:90-120`

Rate limiting is implemented via:
- `checkHttpRateLimit()` from `$lib/utils/http-rate-limiter`
- `getRouteRateLimit()` for per-route configuration
- Applied to all `/api/*` routes (except `/api/health`)
- Client IP detection: `cf-connecting-ip` > `x-forwarded-for` > `getClientAddress()`
- Returns proper `429` response with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers

---

## 7. Environment Variable Audit

**Result: PASS**

| Check | Status |
|-------|--------|
| `.env.example` exists (root) | **YES** |
| `.env.example` exists (app) | **YES** |
| `.gitignore` excludes `.env` | **YES** |
| `.gitignore` excludes `.env.local` | **YES** |
| `.gitignore` excludes `.env.*.local` | **YES** |
| `.gitignore` excludes `.env.production` | **YES** |
| `.gitignore` excludes `.env.development` | **YES** |

---

## 8. CORS Audit

**Result: PASS**

**File:** `apps/swiftlist-app-svelte/src/hooks.server.ts:30-36, 74-88, 168-175`

- **No wildcard `*` origin** — uses explicit allowlist
- **Development:** `http://localhost:5173`, `http://localhost:4173`
- **Production:** `https://swiftlist.app`, `https://www.swiftlist.app`, `https://swiftlist-app-svelte-production.up.railway.app`
- Origin validated before setting `Access-Control-Allow-Origin` header
- `Access-Control-Allow-Credentials: true` only set for allowed origins
- Preflight (`OPTIONS`) handled correctly with `204` response

---

## P0 Action Items (Block Launch)

| # | Issue | File | Action Required |
|---|-------|------|-----------------|
| P0-1 | 12 HIGH npm vulnerabilities (DoS, XSS) | `apps/swiftlist-app-svelte/` | Run `npm audit fix`; evaluate `--force` for minimatch/sentry chain |
| P0-2 | `USING (true)` without `TO service_role` on `agent_cost_tracking` | `004_agent_audit_tables.sql:117` | Add `TO service_role` or proper auth check |
| P0-3 | `USING (true)` without `TO service_role` on `security_alerts` | `004_agent_audit_tables.sql:179` | Add `TO service_role` or proper auth check |

## P1 Action Items (Fix Within 1 Week Post-Launch)

| # | Issue | File | Action Required |
|---|-------|------|-----------------|
| P1-1 | Hardcoded CRM Supabase anon key | `email-signup/+server.ts:6-8` | Move to environment variables |
| P1-2 | CSP uses `'unsafe-inline'` for scripts | `hooks.server.ts:53` | Monitor SvelteKit nonce support; upgrade when available |
| P1-3 | `test-supabase-connection.js` in production tree | `apps/swiftlist-app-svelte/` | Remove or add to `.gitignore` before launch |

## P2 Action Items (Post-Launch Hardening)

| # | Issue | File | Action Required |
|---|-------|------|-----------------|
| P2-1 | Svelte SSR XSS advisories (moderate) | svelte dependency | Update svelte to latest patched version |
| P2-2 | lodash prototype pollution | lodash dependency | Replace with native methods or update |
| P2-3 | HSTS `preload` directive missing | `hooks.server.ts:50` | Add `preload` and submit to HSTS preload list |

---

*Report generated 2026-02-20 by automated security audit. No code changes were made.*
