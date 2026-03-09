# SwiftList MVP Production Deployment Checklist

**Status**: ✅ Ready for Execution - Awaiting User Confirmation
**Generated**: 2026-01-12
**Workflow ID Fix**: ✅ Complete (WF-01 → WF-04)
**Build Status**: ✅ Verified - No errors
**Webhook Secret**: ✅ Generated

---

## Pre-Flight Checks Complete ✅

### Code Changes Applied
- ✅ **Fixed**: `src/routes/jobs/new/+page.svelte:82` → `workflow_id: 'WF-04'`
- ✅ **Fixed**: `src/lib/validations/jobs.ts:15` → `z.literal('WF-04')`
- ✅ **Fixed**: `src/lib/validations/jobs.ts:16` → Error message updated
- ✅ **Fixed**: Job Wizard UI text → "Background Removal (WF-04)"

### Build Verification
```
✓ Client: 298 modules transformed
✓ Server: 210 modules transformed
✓ Output: 135.93 kB (server) + optimized client bundles
✓ Build time: 1.17s
✓ Status: SUCCESS - No compilation errors
```

### Security Credentials Generated
- ✅ **N8N_WEBHOOK_SECRET**: `ff033f604ba3df107a84ece113954a921b0932ec73e38e8f13ea7b26b63c8a87`
  - Algorithm: SHA-256
  - Length: 64 hex characters (256 bits)
  - Store securely in `.env.production`

---

## Deployment Execution Plan

**IMPORTANT**: Each step requires your explicit confirmation before execution.

---

## STEP 1: Gather Production Credentials

### Required Before Proceeding

**You need to provide:**

1. **Supabase Credentials** (from https://app.supabase.com/project/_/settings/api)
   ```
   PROJECT_ID: ___________________
   VITE_PUBLIC_SUPABASE_URL: https://_________.supabase.co
   VITE_PUBLIC_SUPABASE_ANON_KEY: eyJ_________________
   SUPABASE_SERVICE_ROLE_KEY: eyJ_________________
   DATABASE_PASSWORD: ___________________
   ```

2. **n8n Instance Details**
   ```
   N8N_BASE_URL: https://_________________.com
   N8N_API_KEY (if using API import): ___________________
   ```

3. **Anthropic API Key**
   ```
   ANTHROPIC_API_KEY: sk-ant-api03-___________________
   ```

**⏸️ CONFIRMATION REQUIRED**:
- [ ] I have all Supabase credentials ready
- [ ] I have n8n instance accessible
- [ ] I have Anthropic API key ready

**Reply**: "CREDENTIALS READY" when you've gathered all credentials above

---

## STEP 2: Database Migration

### What Will Be Created

**Tables (3)**:
- `profiles` - User data with credit balance (default: 100 credits)
- `jobs` - Job processing records
- `credit_transactions` - Transaction audit log

**Functions (2)**:
- `deduct_credits(user_id, amount, job_id)` - Atomic credit deduction
- `refund_credits(user_id, amount, job_id)` - Atomic credit refund

**Security Features**:
- Row Level Security (RLS) enabled on all tables
- Users can only access own data
- Service role can update jobs (for n8n)
- Indexes on user_id, status, created_at

### Execution Command

**Option A: Using Supabase SQL Editor** (Recommended for first deployment)
```
1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/sql
2. Copy contents of: /path/to/swiftlist/apps/swiftlist-app/scripts/schema.sql
3. Paste into SQL Editor
4. Click "Run"
5. Verify output shows "SwiftList database schema created successfully!"
```

**Option B: Using psql Command Line**
```bash
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres"

psql $DATABASE_URL < "/path/to/swiftlist/apps/swiftlist-app/scripts/schema.sql"
```

### Verification Queries

After migration, run these in Supabase SQL Editor:

```sql
-- Verify tables exist (should return 3 rows)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'jobs', 'credit_transactions');

-- Verify RLS is enabled (all should show rowsecurity = true)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'jobs', 'credit_transactions');

-- Verify functions exist (should return 2 rows)
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('deduct_credits', 'refund_credits');
```

### Rollback (If Needed)

```sql
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS deduct_credits;
DROP FUNCTION IF EXISTS refund_credits;
DROP FUNCTION IF EXISTS update_updated_at;
```

**⏸️ CONFIRMATION REQUIRED**:
- [ ] I understand what will be created
- [ ] I have reviewed the schema.sql file
- [ ] I am ready to execute database migration

**Reply**: "EXECUTE DATABASE MIGRATION" when ready to proceed

---

## STEP 3: Storage Bucket Configuration

### What Will Be Created

**Bucket 1: job-uploads**
- Purpose: User-uploaded original images
- Public: Yes (read-only)
- Size limit: 10 MB per file
- MIME types: image/jpeg, image/jpg, image/png, image/webp

**Bucket 2: job-outputs**
- Purpose: AI-processed result images
- Public: Yes (read-only)
- Size limit: 50 MB per file
- MIME types: Same as uploads

### Execution Steps

**Via Supabase Dashboard** (Recommended):

1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets
2. Click "New bucket"

**Create Bucket 1**:
- Name: `job-uploads`
- Public: ✅ Yes
- File size limit: `10485760` (10 MB in bytes)
- Allowed MIME types: `image/jpeg,image/jpg,image/png,image/webp`
- Click "Create bucket"

**Create Bucket 2**:
- Name: `job-outputs`
- Public: ✅ Yes
- File size limit: `52428800` (50 MB in bytes)
- Allowed MIME types: `image/jpeg,image/jpg,image/png,image/webp`
- Click "Create bucket"

### Configure RLS Policies

Run these in Supabase SQL Editor:

```sql
-- job-uploads: Users can upload to own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- job-uploads: Public read access
CREATE POLICY "Public can view uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-uploads');

-- job-outputs: Service role can upload
CREATE POLICY "Service role can upload outputs"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'job-outputs');

-- job-outputs: Public read access
CREATE POLICY "Public can view outputs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-outputs');
```

### Verification

```sql
-- Verify buckets exist
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('job-uploads', 'job-outputs');

-- Expected output:
-- job-uploads | public=true | file_size_limit=10485760
-- job-outputs | public=true | file_size_limit=52428800
```

**⏸️ CONFIRMATION REQUIRED**:
- [ ] I understand bucket configuration
- [ ] I am ready to create storage buckets
- [ ] I am ready to configure RLS policies

**Reply**: "EXECUTE STORAGE SETUP" when ready to proceed

---

## STEP 4: n8n Workflow Deployment

### What Will Be Imported

**Workflow 1: WF-04 - Background Removal** ⭐ CRITICAL
- File: `/home/user/swiftlist/n8n-workflows/active/wf-04-background-removal.json`
- Size: 10.8 KB
- Purpose: Removes backgrounds from product images
- Cost: 5 credits per job
- Trigger: Webhook (POST /webhook/job-webhook)

**Workflow 2: WF-24 - Credit Lifeguard** ⭐ CRITICAL
- File: `/home/user/swiftlist/n8n-workflows/active/WF-24-credit-lifeguard.json`
- Purpose: Auto-refunds credits for failed jobs
- Trigger: Cron (every 5 minutes)
- Essential for: User trust and credit integrity

### Pre-Import Configuration

You'll need to configure these credentials in n8n:

**Supabase Credential**:
```
Type: HTTP Request / Generic
Name: SwiftList Production DB
Base URL: https://YOUR_PROJECT_ID.supabase.co/rest/v1
Headers:
  - apikey: YOUR_SERVICE_ROLE_KEY
  - Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

**Anthropic Credential**:
```
Type: HTTP Request / Generic
Name: Anthropic Claude API
Base URL: https://api.anthropic.com/v1
Headers:
  - x-api-key: YOUR_ANTHROPIC_API_KEY
  - anthropic-version: 2023-06-01
```

### Execution Steps

**Option A: UI Import** (Recommended):

1. Login to n8n: YOUR_N8N_BASE_URL
2. Click "Workflows" → "Import from File"
3. Import `wf-04-background-removal.json`
   - Configure Supabase credentials
   - Configure Anthropic credentials
   - Copy webhook URL (will be like: https://your-n8n.com/webhook/job-webhook)
   - Toggle "Active" to ON
4. Import `WF-24-credit-lifeguard.json`
   - Configure Supabase credentials
   - Set cron schedule: `*/5 * * * *` (every 5 minutes)
   - Toggle "Active" to ON

**Option B: API Import**:

```bash
export N8N_API_KEY="YOUR_API_KEY"
export N8N_BASE_URL="YOUR_N8N_BASE_URL"

# Import WF-04
curl -X POST "$N8N_BASE_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"/home/user/swiftlist/n8n-workflows/active/wf-04-background-removal.json"

# Import WF-24
curl -X POST "$N8N_BASE_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"/home/user/swiftlist/n8n-workflows/active/WF-24-credit-lifeguard.json"
```

### Post-Import Configuration

**CRITICAL: Add Webhook Signature Verification to WF-04**

In n8n workflow editor:
1. Open WF-04
2. After "Job Webhook" node, add "Code" node
3. Insert this verification code:

```javascript
const crypto = require('crypto');

// Get signature from header
const signature = $input.item.json.headers['x-swiftlist-signature'];
const secret = 'ff033f604ba3df107a84ece113954a921b0932ec73e38e8f13ea7b26b63c8a87';
const jobId = $input.item.json.job_id;

// Calculate expected signature
const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(jobId)
  .digest('hex');

// Verify
if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}

return { verified: true, job_id: jobId };
```

### Get Webhook URL

After importing WF-04:
1. Open workflow in n8n
2. Click on "Job Webhook" node
3. Copy "Production URL"
4. It will look like: `https://your-n8n.com/webhook/job-webhook`
5. Save this for environment variables

### Test Workflow

```bash
# Set variables
JOB_ID="test-$(uuidgen | tr '[:upper:]' '[:lower:]')"
WEBHOOK_URL="YOUR_N8N_WEBHOOK_URL"
SECRET="ff033f604ba3df107a84ece113954a921b0932ec73e38e8f13ea7b26b63c8a87"

# Generate signature
SIGNATURE=$(echo -n "$JOB_ID" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Send test request
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-SwiftList-Signature: $SIGNATURE" \
  -d '{
    "job_id": "'$JOB_ID'",
    "user_id": "test-user-id",
    "workflow_id": "WF-04",
    "input_data": {
      "image_url": "https://example.com/test.jpg"
    }
  }'

# Should return 200 OK if workflow is active and configured correctly
```

**⏸️ CONFIRMATION REQUIRED**:
- [ ] I have n8n instance ready
- [ ] I understand credential configuration
- [ ] I am ready to import workflows
- [ ] I will add signature verification code

**Reply**: "EXECUTE N8N IMPORT" when ready to proceed

---

## STEP 5: Environment Variable Configuration

### Create Production Environment File

Create `.env.production` in project root with these values:

```bash
# ==========================================
# SUPABASE CONFIGURATION
# ==========================================
VITE_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# ==========================================
# N8N CONFIGURATION
# ==========================================
VITE_PUBLIC_N8N_WEBHOOK_URL=YOUR_N8N_WEBHOOK_URL_FROM_STEP_4
N8N_WEBHOOK_SECRET=ff033f604ba3df107a84ece113954a921b0932ec73e38e8f13ea7b26b63c8a87

# ==========================================
# ANTHROPIC AI
# ==========================================
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE

# ==========================================
# APPLICATION
# ==========================================
VITE_PUBLIC_APP_URL=https://swiftlist.app
NODE_ENV=production
```

### Security Checklist

- [ ] ✅ All placeholders replaced with actual values
- [ ] ✅ No trailing spaces or newlines
- [ ] ✅ File permissions set to 600 (read/write owner only)
- [ ] ✅ `.env.production` added to `.gitignore`
- [ ] ✅ Credentials stored in password manager

### Verify Configuration

```bash
# Check file exists
ls -la .env.production

# Verify no placeholder text remains
grep -E "(YOUR_|PLACEHOLDER|___)" .env.production
# Should output nothing if all values filled in

# Set file permissions
chmod 600 .env.production
```

**⏸️ CONFIRMATION REQUIRED**:
- [ ] I have created `.env.production` file
- [ ] All credentials are filled in
- [ ] No placeholder text remains
- [ ] File is secure (chmod 600)

**Reply**: "ENV CONFIGURED" when ready to proceed

---

## STEP 6: Application Deployment

### Final Pre-Deploy Build

```bash
# Build with production environment
NODE_ENV=production npm run build

# Verify build output
ls -lh .svelte-kit/output/
```

### Deployment Options

**Option A: Vercel** (Recommended for SvelteKit)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Project Settings → Environment Variables → Add all from .env.production
```

**Option B: Netlify**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod

# Set environment variables in Netlify dashboard
```

**Option C: Self-Hosted (Node.js)**
```bash
# Build for Node adapter
npm install @sveltejs/adapter-node

# Update svelte.config.js to use adapter-node
# Build
npm run build

# Start production server
node build/index.js
```

### Post-Deployment Verification

Test these endpoints:

```bash
APP_URL="https://your-deployed-app.com"

# 1. Health check
curl $APP_URL

# 2. API endpoints respond
curl $APP_URL/api/jobs
# Should return 401 Unauthorized (expected - not logged in)

# 3. Pages render
curl -I $APP_URL/pricing
# Should return 200 OK
```

**⏸️ CONFIRMATION REQUIRED**:
- [ ] I have chosen deployment platform
- [ ] Build completed successfully
- [ ] Environment variables configured in platform
- [ ] Application is accessible at production URL

**Reply**: "APP DEPLOYED" when live

---

## STEP 7: End-to-End Testing

### Test Suite

**Test 1: User Signup**
1. Go to: https://your-app.com/auth/signup
2. Create account with test email
3. Verify:
   - [ ] Account created successfully
   - [ ] Redirected to dashboard
   - [ ] Credit balance shows 100 credits

**Test 2: Job Submission**
1. Go to: https://your-app.com/jobs/new
2. Upload test image (JPG/PNG)
3. Select marketplace (optional)
4. Submit job
5. Verify:
   - [ ] Job created in database
   - [ ] Credits deducted (95 remaining)
   - [ ] Job status = "pending"
   - [ ] Webhook sent to n8n

**Test 3: Job Processing**
1. Wait 10-30 seconds
2. Refresh dashboard
3. Verify:
   - [ ] Job status updates to "processing"
   - [ ] Job status updates to "completed"
   - [ ] Processed image URL in outputs
   - [ ] Image accessible from storage bucket

**Test 4: Failed Job Refund**
1. Manually set job status to "failed" in Supabase
2. Wait 5 minutes (for WF-24 cron)
3. Check credit_transactions table
4. Verify:
   - [ ] Refund transaction created
   - [ ] Credits added back to balance
   - [ ] Transaction type = "refund"

### Database Verification Queries

```sql
-- Check user profile
SELECT * FROM profiles WHERE email = 'your-test-email@example.com';

-- Check jobs created
SELECT job_id, workflow_id, status, credits_charged, created_at
FROM jobs
ORDER BY created_at DESC
LIMIT 5;

-- Check credit transactions
SELECT transaction_id, amount, transaction_type, created_at
FROM credit_transactions
ORDER BY created_at DESC
LIMIT 10;
```

**⏸️ CONFIRMATION REQUIRED**:
- [ ] User signup works
- [ ] Job submission works
- [ ] Credits deducted correctly
- [ ] Job processing completes
- [ ] Failed job refunds work

**Reply**: "ALL TESTS PASSED" when complete

---

## STEP 8: Monitoring Setup

### What to Monitor

**Database Metrics**:
- Active jobs by status
- Credit transaction volume
- Failed job rate

**n8n Metrics**:
- Workflow execution count
- Execution success rate
- Average execution time

**Application Metrics**:
- API response times
- Error rate
- User signup rate

### Monitoring Queries

Save these as Supabase Dashboard queries:

```sql
-- Active jobs by status
SELECT status, COUNT(*) as count
FROM jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Failed job rate (last 24h)
SELECT
  COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*) as failure_rate
FROM jobs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Credit usage (last 24h)
SELECT
  SUM(amount) FILTER (WHERE transaction_type = 'deduct') as credits_used,
  SUM(amount) FILTER (WHERE transaction_type = 'refund') as credits_refunded,
  COUNT(DISTINCT user_id) as active_users
FROM credit_transactions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Alert Thresholds

Set up alerts for:
- ⚠️ Failed job rate > 5%
- ⚠️ n8n workflow inactive
- ⚠️ API response time > 2 seconds
- 🔴 Database connection failures
- 🔴 Storage bucket errors

**⏸️ CONFIRMATION REQUIRED**:
- [ ] Monitoring queries saved
- [ ] Alert thresholds configured
- [ ] Ready to monitor production

**Reply**: "MONITORING ACTIVE" when set up

---

## Deployment Complete Checklist

### Infrastructure
- [ ] Database schema migrated
- [ ] Storage buckets configured
- [ ] n8n workflows imported and active
- [ ] Environment variables configured
- [ ] Application deployed

### Verification
- [ ] User signup works
- [ ] Job submission works
- [ ] Credit system works
- [ ] Workflow processing works
- [ ] Refund system works

### Security
- [ ] RLS policies verified
- [ ] Webhook signature verification added
- [ ] Environment variables secured
- [ ] Service role key protected
- [ ] No secrets in git

### Monitoring
- [ ] Database queries saved
- [ ] n8n executions monitored
- [ ] Alerts configured
- [ ] Error tracking enabled

### Documentation
- [ ] Deployment guide reviewed
- [ ] API documentation updated
- [ ] Troubleshooting guide accessible
- [ ] Rollback procedure documented

---

## Rollback Procedure

If issues occur, rollback in reverse order:

1. **Deactivate n8n workflows**
   - Toggle "Active" to OFF in n8n
   - Prevents new jobs from processing

2. **Revert application deployment**
   - Revert to previous deployment
   - Or set maintenance mode

3. **Restore database** (if needed)
   - Run rollback SQL commands from Step 2
   - Or restore from Supabase backup

4. **Delete storage buckets** (if needed)
   - Only if buckets causing issues
   - Backup files first if any exist

---

## Success Criteria

✅ **MVP is live when:**
- Users can sign up and get 100 credits
- Users can upload images
- Background removal workflow processes jobs
- Credits are deducted correctly
- Failed jobs are auto-refunded
- Images are stored and accessible

---

## Next Steps After Deployment

1. Monitor first 100 jobs closely
2. Gather user feedback
3. Optimize workflow performance
4. Add additional workflows (WF-01, WF-02, etc.)
5. Implement Stripe integration
6. Add preset marketplace
7. Build analytics dashboard

---

## Support

**Documentation**:
- Database: `deployment/01-database-setup.md`
- Storage: `deployment/02-storage-setup.md`
- n8n: `deployment/03-n8n-deployment.md`

**Troubleshooting**:
- Check n8n execution logs
- Review Supabase logs
- Check browser console for errors
- Verify environment variables

**Contact**:
- Reply with "HELP - [issue description]" for assistance

---

**STATUS**: ✅ Ready for execution - Awaiting your confirmation for each step

**Generated**: 2026-01-12
**Workflow ID**: WF-04 (Fixed)
**Build Status**: Verified
**Webhook Secret**: Generated and secure
