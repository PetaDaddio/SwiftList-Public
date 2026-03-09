# SwiftList Workers - Railway.app Deployment Guide

**Date:** January 13, 2026
**Purpose:** Deploy BullMQ workers to Railway.app for production job processing

---

## Prerequisites

1. **Railway CLI installed:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Railway account:** Sign up at [railway.app](https://railway.app)

3. **Environment variables ready:**
   - Supabase credentials
   - Replicate API key
   - Anthropic API key
   - OpenAI API key
   - Slack webhook URL

---

## Deployment Steps

### Step 1: Login to Railway

```bash
railway login
```

This will open a browser window for authentication.

### Step 2: Initialize Project

```bash
cd /home/user/Documents/Content\ Factory/SwiftList/workers
railway init
```

Select "Create a new project" and name it "swiftlist-workers".

### Step 3: Add Redis Service

Railway Marketplace has a Redis template:

```bash
railway add
```

Select "Redis" from the marketplace. This will:
- Create a Redis instance
- Auto-generate `REDIS_URL` environment variable
- Link it to your workers service

**Alternative:** Use Upstash Redis (free tier)
- Create account at [upstash.com](https://upstash.com)
- Create Redis database
- Copy connection URL
- Add as `REDIS_URL` in Railway

### Step 4: Set Environment Variables

```bash
# Set all required environment variables
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
railway variables set REPLICATE_API_KEY=your-replicate-api-key
railway variables set ANTHROPIC_API_KEY=your-anthropic-api-key
railway variables set OPENAI_API_KEY=your-openai-api-key
railway variables set SLACK_BOT_TOKEN=your-slack-bot-token
railway variables set SLACK_ALERT_CHANNEL=#swiftlist-alerts
railway variables set NODE_ENV=production
railway variables set WORKER_CONCURRENCY=5
railway variables set SENTRY_DSN=your-sentry-dsn (optional)
```

**Note:** `REDIS_URL` is auto-generated if you added Redis from marketplace.

If using Upstash or external Redis:
```bash
railway variables set REDIS_HOST=your-redis-host
railway variables set REDIS_PORT=6379
railway variables set REDIS_PASSWORD=your-redis-password
```

### Step 5: Deploy Workers

```bash
railway up
```

This will:
1. Build Docker image from `Dockerfile`
2. Push to Railway container registry
3. Deploy workers service
4. Start health check endpoint on `/health`

**Deployment logs:**
```bash
railway logs
```

### Step 6: Verify Deployment

Check health endpoint:
```bash
railway domain
# Copy the domain, then:
curl https://your-workers-domain.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "memory": {...},
  "queue": {
    "waiting": 0,
    "active": 0,
    "completed": 5,
    "failed": 0,
    "delayed": 0,
    "total": 5
  },
  "timestamp": "2026-01-13T10:00:00.000Z"
}
```

### Step 7: Connect Svelte App to Railway Workers

Update Svelte app environment variables:

**File:** `apps/swiftlist-app-svelte/.env`

```bash
# Use same Redis as workers
REDIS_HOST=your-railway-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-railway-redis-password

# OR if using REDIS_URL from Railway:
REDIS_URL=redis://:password@host:port
```

**Important:** Svelte app and workers must connect to the **same Redis instance** for BullMQ to work.

---

## Testing End-to-End

### Test 1: Submit Background Removal Job

```bash
# From Svelte app
curl -X POST http://localhost:5173/api/jobs/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "workflow_id": "WF-07",
    "input_data": {
      "image_url": "https://example.com/test.jpg"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "job_id": "uuid-here",
  "workflow_name": "Background Removal",
  "status": "pending",
  "credits_deducted": 5,
  "remaining_credits": 95,
  "estimated_completion_time": "30-60 seconds"
}
```

### Test 2: Monitor Job Processing

```bash
# Watch Railway logs
railway logs --follow
```

You should see:
```
[Worker] Processing job uuid-here (WF-07)
[Worker] Downloading product image
[Worker] Removing background with Replicate RMBG
[Worker] Uploading transparent PNG
[Worker] Job uuid-here completed successfully
✅ Job uuid-here completed
```

### Test 3: Verify Job Completion

Query Supabase `jobs` table:
```sql
SELECT * FROM jobs WHERE job_id = 'uuid-here';
```

Expected fields:
- `status`: 'completed'
- `progress_percent`: 100
- `output_data`: {transparent_png_url: '...'}
- `completed_at`: timestamp

### Test 4: Download Result

```bash
curl -O https://your-supabase-project.supabase.co/storage/v1/object/public/job-outputs/user-id/job-id/transparent.png
```

---

## Monitoring & Maintenance

### View Logs

```bash
# Real-time logs
railway logs --follow

# Filter by service
railway logs --service swiftlist-workers

# Last 100 lines
railway logs --tail 100
```

### Restart Workers

```bash
railway restart
```

### Scale Workers (if needed)

Railway auto-scales based on load. To manually adjust:

1. Go to Railway dashboard
2. Select "swiftlist-workers" service
3. Settings > Resources
4. Adjust memory/CPU

**Recommended for MVP:**
- Memory: 512MB - 1GB
- CPU: 0.5 vCPU
- Concurrency: 5 workers

### Monitor Queue Metrics

```bash
curl https://your-workers-domain.railway.app/metrics
```

Response:
```json
{
  "waiting": 2,
  "active": 3,
  "completed": 145,
  "failed": 2,
  "delayed": 0,
  "total": 152
}
```

**Alerts:**
- If `waiting` > 50: Consider scaling up
- If `failed` > 10%: Check error logs
- If `active` = 0 for >10 min: Workers may be crashed

---

## Troubleshooting

### Issue 1: Workers Not Picking Up Jobs

**Symptoms:**
- Jobs stuck in `pending` status
- No activity in Railway logs

**Fixes:**
1. Verify Redis connection:
   ```bash
   railway variables get REDIS_URL
   ```
2. Check worker logs for errors:
   ```bash
   railway logs | grep ERROR
   ```
3. Restart workers:
   ```bash
   railway restart
   ```

### Issue 2: High Memory Usage

**Symptoms:**
- Worker crashes with OOM errors
- Deployment fails

**Fixes:**
1. Reduce worker concurrency:
   ```bash
   railway variables set WORKER_CONCURRENCY=3
   ```
2. Increase Railway memory allocation (Settings > Resources)
3. Check for memory leaks in workflows

### Issue 3: Replicate API Rate Limiting

**Symptoms:**
- Jobs fail with "429 Too Many Requests"
- Error logs show rate limit errors

**Fixes:**
1. Implement exponential backoff (already in `BaseWorkflow.callAPI()`)
2. Reduce worker concurrency
3. Upgrade Replicate plan if hitting limits

### Issue 4: Database Connection Errors

**Symptoms:**
- "Failed to connect to Supabase" errors
- Job updates not saving

**Fixes:**
1. Verify Supabase URL and Service Role Key:
   ```bash
   railway variables get SUPABASE_URL
   railway variables get SUPABASE_SERVICE_ROLE_KEY
   ```
2. Check Supabase dashboard for outages
3. Verify RLS policies allow service role access

---

## Cost Estimation

**Railway Pricing (Hobby Plan):**
- $5/month base
- Workers service: ~$10-20/month (512MB RAM, 0.5 vCPU)
- Redis addon: ~$5/month
- **Total:** ~$20-30/month

**Upstash Alternative (Free Tier):**
- 10,000 commands/day free
- Enough for MVP testing
- Upgrade to $10/month for production

**API Costs (per 1000 jobs):**
- Replicate (background removal): $20
- Anthropic (product descriptions): $5
- OpenAI (embeddings): $0.10
- **Total:** ~$25/1000 jobs

---

## Production Checklist

Before going live:

- [ ] All environment variables set in Railway
- [ ] Redis connected and accessible
- [ ] Workers processing test jobs successfully
- [ ] Health endpoint returning 200 OK
- [ ] Logs show no errors
- [ ] Supabase connection working
- [ ] API keys valid and not rate-limited
- [ ] Sentry error tracking configured (optional)
- [ ] Lifeguard monitoring active
- [ ] Slack alerts working

---

## Rollback Procedure

If deployment fails:

1. **Revert to previous deployment:**
   ```bash
   railway rollback
   ```

2. **Check previous deployment logs:**
   ```bash
   railway logs --deployment PREVIOUS_DEPLOYMENT_ID
   ```

3. **Fix issues locally, test, then redeploy:**
   ```bash
   npm run dev  # Test locally first
   railway up   # Deploy when ready
   ```

---

## CI/CD Integration (Future)

For automated deployments, integrate with GitHub Actions:

**File:** `.github/workflows/deploy-workers.yml`

```yaml
name: Deploy Workers to Railway

on:
  push:
    branches: [main]
    paths:
      - 'workers/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy to Railway
        run: |
          cd workers
          railway up --service swiftlist-workers
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## Support

**Railway Documentation:** [docs.railway.app](https://docs.railway.app)
**Community Discord:** [discord.gg/railway](https://discord.gg/railway)
**SwiftList Issues:** Report at GitHub repo

---

**Deployment Status:** ⏳ Ready to Deploy
**Last Updated:** January 13, 2026
