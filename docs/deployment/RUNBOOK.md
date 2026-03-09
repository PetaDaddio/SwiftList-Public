# SwiftList Operations Runbook

**Last Updated**: 2026-02-10
**Environment**: Railway (app) + Supabase (DB/auth) + Cloudflare (CDN/WAF)

---

## Quick Reference

| Service | Dashboard | Health Check |
|---------|-----------|-------------|
| App | [Railway Dashboard](https://railway.com/dashboard) | `curl https://swiftlist.app/api/health` |
| Database | [Supabase Dashboard](https://app.supabase.com) | Included in `/api/health` |
| Redis | Railway Redis service | Included in `/api/health` |
| DNS/CDN | [Cloudflare Dashboard](https://dash.cloudflare.com) | `dig swiftlist.app` |
| Errors | [Sentry Dashboard](https://sentry.io) | — |
| Alerts | #swiftlist-alerts Slack channel | — |

---

## Incident Response Procedures

### 1. App Not Responding (503 / timeout)

**Symptoms**: Users see 503 errors, health check fails, Railway shows service down.

**Diagnostic Steps**:
```bash
# 1. Check health endpoint
curl -s https://swiftlist.app/api/health | jq .

# 2. Check Railway service status
railway status

# 3. Check Railway logs (last 100 lines)
railway logs -n 100

# 4. Check if OOM killed
railway logs | grep -i "killed\|oom\|memory"
```

**Resolution**:
1. **Restart service**: Railway Dashboard → Service → Restart
2. **If OOM**: Increase memory allocation (Railway Dashboard → Settings → Resources → 1GB minimum)
3. **If deploy failed**: Check build logs, rollback to previous deployment
4. **If DNS issue**: Check Cloudflare dashboard for DNS propagation

**Escalation**: If unresolved after 15 minutes, check Supabase status page and Railway status page for platform outages.

---

### 2. Authentication Failing (401 / redirect loops)

**Symptoms**: Users can't log in, session not persisting, redirect loops to /auth/login.

**Diagnostic Steps**:
```bash
# 1. Check Supabase Auth status
curl -s https://YOUR_PROJECT.supabase.co/auth/v1/health

# 2. Verify Site URL in Supabase Auth settings
# Dashboard → Authentication → URL Configuration → Site URL should be https://swiftlist.app

# 3. Check redirect URLs include production domain
# Dashboard → Authentication → URL Configuration → Redirect URLs

# 4. Check JWT expiry in logs
railway logs | grep -i "jwt\|token\|session\|auth"
```

**Resolution**:
1. **Site URL wrong**: Supabase Dashboard → Authentication → URL Configuration → Set to `https://swiftlist.app`
2. **Missing redirect URL**: Add `https://swiftlist.app/auth/callback` to redirect URLs
3. **JWT expired**: Users need to re-login (sessions expire after Supabase default: 1 hour for access, 1 week for refresh)
4. **Cookie domain mismatch**: Verify `Secure: true`, `SameSite: Lax` in auth config
5. **CSRF blocking**: Verify `ORIGIN=https://swiftlist.app` is set in Railway env vars

---

### 3. Jobs Stuck in "Processing" State

**Symptoms**: Jobs don't complete, status stays "processing" indefinitely, user sees spinner.

**Diagnostic Steps**:
```bash
# 1. Check health endpoint for Redis connectivity
curl -s https://swiftlist.app/api/health | jq '.checks[] | select(.name=="redis")'

# 2. Check recent job processing errors
railway logs | grep -i "job\|process\|replicate\|error"

# 3. Check if circuit breaker is open for Replicate
railway logs | grep -i "circuit\|breaker\|open"

# 4. Check Replicate API status
curl -s https://api.replicate.com/v1/models -H "Authorization: Bearer $REPLICATE_API_KEY" | head -20
```

**Resolution**:
1. **Redis down**: Check Railway Redis service, restart if needed. Verify `REDIS_URL` env var.
2. **Replicate API down**: Circuit breaker should auto-handle. Check Replicate status page. Jobs will retry when API recovers.
3. **API key expired**: Rotate `REPLICATE_API_KEY` in Railway env vars, redeploy.
4. **Worker crashed**: If using separate worker service, restart it. Check worker logs.
5. **Manual job reset**: Update stuck jobs in Supabase:
   ```sql
   UPDATE jobs SET status = 'failed', error_message = 'Manual reset: stuck in processing'
   WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '30 minutes';
   ```

---

### 4. External API Down (Replicate / Gemini / Claude)

**Symptoms**: Image processing fails, classification fails, Lifeguard alerts fire.

**Diagnostic Steps**:
```bash
# 1. Check health endpoint metrics
curl -s https://swiftlist.app/api/health | jq '.metrics'

# 2. Check circuit breaker status in logs
railway logs | grep -i "circuit\|ServiceUnavailable"

# 3. Test individual APIs
# Replicate
curl -s https://api.replicate.com/v1/models -H "Authorization: Bearer $REPLICATE_API_KEY"

# Gemini
curl -s "https://generativelanguage.googleapis.com/v1/models?key=$GOOGLE_GEMINI_API_KEY"
```

**Resolution**:
1. **Circuit breaker is handling it**: The `protectedApiCall` wrapper automatically stops sending requests to down services. No immediate action needed.
2. **Check provider status pages**: [Replicate Status](https://status.replicate.com), [Google Cloud Status](https://status.cloud.google.com)
3. **If prolonged outage (>30 min)**: Post user-facing status update. Jobs will auto-retry when service recovers.
4. **If API key issue**: Rotate key in Railway env vars, trigger redeploy.

---

### 5. High Error Rate / Latency Alert

**Symptoms**: Slack alert from Lifeguard: "API Error Rate: X% (threshold: 3%)" or "API Latency p95: Xms (threshold: 5000ms)".

**Diagnostic Steps**:
```bash
# 1. Check current metrics
curl -s https://swiftlist.app/api/health | jq '.metrics'

# 2. Check recent errors in logs
railway logs -n 200 | grep -i "error\|500\|503"

# 3. Check Sentry for error grouping
# Open Sentry dashboard, check Issues tab sorted by last seen

# 4. Check if it's a single endpoint or widespread
railway logs | grep "status=5" | awk '{print $NF}' | sort | uniq -c | sort -rn
```

**Resolution**:
1. **Single endpoint failing**: Identify the route, check its specific dependencies (Supabase query, external API call)
2. **Database slow**: Check Supabase Dashboard → Database → Observability for slow queries
3. **Memory pressure**: Check Railway metrics for memory usage approaching limit
4. **Traffic spike**: Check if rate limiter is engaged. Consider Cloudflare WAF rules if attack.
5. **Cascading failure**: If multiple services are affected, start from infrastructure (Redis → Supabase → External APIs)

---

### 6. Memory Issues / OOM

**Symptoms**: Service restarts unexpectedly, Railway logs show "Killed" or memory exceeded.

**Diagnostic Steps**:
```bash
# 1. Check Railway metrics for memory usage
railway metrics

# 2. Check for memory-intensive operations
railway logs | grep -i "memory\|heap\|sharp\|image"
```

**Resolution**:
1. **Increase memory**: Railway Dashboard → Service → Settings → Resources → increase to 1.5GB or 2GB
2. **Image processing**: `sharp` library can consume significant memory for large images. Consider adding image size validation/limits.
3. **Memory leak**: Check if memory grows steadily over time (restart as temporary fix, investigate leak)
4. **Bulk operations**: If a user uploads many images simultaneously, BullMQ should rate-limit processing. Check queue concurrency settings.

---

### 7. Rate Limiting Triggered (429 errors)

**Symptoms**: Users report "Too many requests" errors, legitimate traffic being blocked.

**Current Limits**:
| Route Pattern | Limit |
|--------------|-------|
| `/api/auth/*` | 10 req/min per IP |
| `/api/jobs/submit*` | 30 req/min per IP |
| `/api/lifeguard/*` | 20 req/min per IP |
| `/api/*` (default) | 100 req/min per IP |
| Cloudflare WAF | 300 req/min (if configured) |

**Resolution**:
1. **Legitimate traffic**: Increase limits in `src/lib/utils/http-rate-limiter.ts` → `getRouteRateLimit()`
2. **Attack traffic**: Check Cloudflare WAF analytics, add firewall rules if needed
3. **Double-limiting**: If Cloudflare WAF limit (300/min) is lower than expected, requests never reach app-level limiter. Adjust Cloudflare rules.

---

## Environment Variables Checklist

Run this when deploying or if something seems misconfigured:

```bash
# Verify all required env vars are set (Railway)
railway variables | grep -E "VITE_PUBLIC_SUPABASE_URL|VITE_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|GOOGLE_GEMINI_API_KEY|REPLICATE_API_KEY|REDIS_URL|ORIGIN|NODE_ENV|VITE_PUBLIC_SENTRY_DSN"
```

Missing any of these will cause specific failures:
- No `ORIGIN` → CSRF errors on all form submissions
- No `REDIS_URL` → Health check shows Redis fail, jobs can't be submitted
- No `VITE_PUBLIC_SUPABASE_URL` → App can't connect to database at all
- No `SUPABASE_SERVICE_ROLE_KEY` → Admin operations fail (Lifeguard, job processing)
- No `VITE_PUBLIC_SENTRY_DSN` → Errors not tracked (silent failure, not blocking)

---

## Deployment Checklist

Before each deployment:

1. [ ] `npm run build` succeeds locally
2. [ ] `npm run check` shows 0 errors
3. [ ] No secrets in committed code (`git diff --cached | grep -i "sk-\|key=\|password="`)
4. [ ] Health check responds 200 after deploy: `curl https://swiftlist.app/api/health`
5. [ ] Auth flow works: login → dashboard → logout
6. [ ] Job submission works: upload image → processing → complete

---

## Rollback Procedure

If a deployment causes issues:

1. **Railway**: Dashboard → Service → Deployments → click previous successful deploy → "Rollback"
2. **Database migration**: Supabase Dashboard → SQL Editor → run rollback migration
3. **DNS changes**: Cloudflare → DNS → revert record changes (TTL is typically 5 min)

---

## Contact & Escalation

| Level | Who | When |
|-------|-----|------|
| L1 | Check this runbook | First response |
| L2 | Check Sentry + Railway logs | After 15 min unresolved |
| L3 | Check provider status pages | After 30 min, suspected platform issue |
