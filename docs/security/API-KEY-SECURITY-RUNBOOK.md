# API Key Security Runbook
**Created:** 2026-03-03
**Trigger:** Gemini API key theft incident affecting another developer ($82K)

## SwiftList Risk Assessment: LOW
- All API keys are server-side only (`$env/dynamic/private` in +server.ts)
- No `VITE_PUBLIC_` prefixed secrets (client bundle is clean)
- No client-side AI API calls — all go through SvelteKit server routes
- Repository is private on GitHub
- `.gitignore` blocks all `.env` files

## Pre-Commit Hook (INSTALLED)
Location: `.git/hooks/pre-commit`
Blocks: API key patterns (Anthropic, Google, Stripe, Replicate, fal.ai, Slack), `.env` files

## Provider Billing Caps & Alerts

### Google Cloud (Gemini API)
1. Go to: https://console.cloud.google.com/billing/budgets
2. Create budget: **$50/month** (SwiftList pre-launch)
3. Alert thresholds: 50%, 90%, 100%
4. Enable: "Email alerts to billing admins"
5. **API Key Restrictions:**
   - Console > APIs & Services > Credentials
   - Edit your API key > Application restrictions > HTTP referrers
   - Add: `swiftlist.app/*` (production only)
   - API restrictions > Restrict key > Select only: Generative Language API
6. **Quotas:**
   - Console > APIs & Services > Generative Language API > Quotas
   - Set request-per-minute cap appropriate for your traffic

### Anthropic (Claude API)
1. Go to: https://console.anthropic.com/settings/limits
2. Set monthly spending limit: **$100/month**
3. Enable workspace notifications for spend thresholds
4. Anthropic auto-stops requests when limit is hit (no overage)

### Replicate
1. Go to: https://replicate.com/account/billing
2. Set monthly spending limit (hard cap available)
3. Replicate stops predictions when limit is reached

### fal.ai (Bria RMBG 2.0)
1. Go to: https://fal.ai/dashboard/billing
2. Set spending alerts
3. Review monthly usage regularly

### Stripe (Payments)
- Stripe secret key (prefix: `sk_live`) never touches the client
- Webhook secret (prefix: `whsec`) verified server-side via HMAC
- Publishable key (prefix: `pk_live`) is designed to be public — safe in client

### Supabase
- Anon key is designed to be public (RLS enforces security)
- Service role key is server-side only — never exposed to client
- Monitor: Supabase Dashboard > Settings > Usage

## Git History Cleanup (RECOMMENDED)

The `.env` files were committed before `.gitignore` was configured. Since keys are rotated and repo is private, this is low-urgency but good hygiene.

### Option A: BFG Repo Cleaner (simpler)
```bash
# Install
brew install bfg

# Remove .env files from all history
bfg --delete-files '.env' --no-blob-protection
bfg --delete-files '.env.local' --no-blob-protection
bfg --delete-files '.env.production' --no-blob-protection

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (coordinate with team)
git push --force
```

### Option B: git filter-repo (more control)
```bash
pip install git-filter-repo

git filter-repo --invert-paths \
  --path apps/swiftlist-app-svelte/.env \
  --path apps/swiftlist-app-svelte/.env.local \
  --path apps/swiftlist-app-svelte/.env.production \
  --path workers/.env \
  --path dashboard/.env \
  --path .env
```

**After either option:** Re-add remote and force push.

## Monitoring Checklist (Monthly)

- [ ] Check Google Cloud billing dashboard for unexpected spikes
- [ ] Check Anthropic usage dashboard
- [ ] Check Replicate billing page
- [ ] Check fal.ai usage
- [ ] Run `git log --all -p -- '*.env*' | head -20` to verify no new .env commits
- [ ] Review GitHub secret scanning alerts (Settings > Code security)
- [ ] Review Railway env vars — remove any unused keys

## Incident Response (If Key Compromised)

1. **Immediately rotate the key** at the provider's dashboard
2. Update the new key in Railway environment variables
3. Update local `.env` files
4. Restart Railway deployment to pick up new key
5. Check provider billing for unauthorized usage
6. If significant unauthorized charges: contact provider support immediately
7. Review access logs to determine how the key was compromised
8. Document in `/DEBUGGING-LOG.md`
