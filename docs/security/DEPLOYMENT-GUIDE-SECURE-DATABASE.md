# SwiftList Secure Database Deployment Guide
**Date**: 2026-01-16
**Status**: 🟢 Ready to Deploy
**Fixes**: All 6 critical vulnerabilities

---

## 🚨 PRE-DEPLOYMENT CHECKLIST

Before deploying these security fixes, ensure:

- [ ] **Backup Existing Database**: Export all data from Supabase
- [ ] **Test on Staging First**: Apply to staging environment, run pen tests
- [ ] **Read Full Security Audit**: `/docs/security/SECURITY-AUDIT-2026-01-14.md`
- [ ] **Have Rollback Plan**: Know how to restore from backup
- [ ] **Schedule Maintenance Window**: 15-30 minutes downtime

---

## 📋 DEPLOYMENT STEPS

### Step 1: Backup Current Database (5 minutes)

1. Go to Supabase Dashboard → **Database** → **Backups**
2. Click **"Create Backup"**
3. Name: `pre-security-fix-2026-01-16`
4. Wait for backup to complete
5. **DO NOT PROCEED** until backup shows "Completed"

### Step 2: Deploy Secure Schema (5 minutes)

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **"New Query"**
3. Copy contents of `/supabase-schema-secure-2026-01-16.sql`
4. Paste into SQL Editor
5. **Review the SQL** (scroll through, check for typos)
6. Click **"Run"** (bottom right)
7. **Expected Output**: "SwiftList secure database schema deployed successfully! All 6 critical vulnerabilities fixed."
8. **If Errors**: Stop immediately, check error message, do NOT proceed

### Step 3: Deploy Storage Policies (5 minutes)

1. In Supabase SQL Editor, click **"New Query"**
2. Copy contents of `/supabase-storage-policies-secure.sql`
3. Paste into SQL Editor
4. **Review the SQL**
5. Click **"Run"**
6. **Expected Output**: "SwiftList storage bucket RLS policies deployed successfully! Vulnerability #4 fixed."
7. **If Errors**: Check if buckets already exist, may need to modify INSERT statements

### Step 4: Verify Deployment (5 minutes)

Run these queries in SQL Editor to verify fixes:

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'jobs', 'credit_transactions');
-- Expected: All rows should have rowsecurity = true

-- Check for dangerous USING (true) policies
SELECT schemaname, tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true';
-- Expected: 0 rows (no policies should use USING (true))

-- Check SECURITY DEFINER functions have authorization
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND security_type = 'DEFINER'
  AND routine_name IN ('deduct_credits', 'refund_credits');
-- Expected: Both functions should have auth checks in definition

-- Check storage policies exist
SELECT policyname, tablename
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';
-- Expected: At least 9 policies (3 per bucket)
```

### Step 5: Run Penetration Tests (10 minutes)

Follow instructions in `/docs/security/penetration-tests.md`:

1. Create two test users (Attacker and Victim)
2. Run all 7 penetration tests in browser console
3. **CRITICAL**: All attacks must FAIL with authorization errors
4. If ANY test passes (attack succeeds), **ROLLBACK IMMEDIATELY**

**Pass Criteria**:
- ✅ Test #1: RLS Bypass - BLOCKED
- ✅ Test #2: Credit Manipulation - BLOCKED
- ✅ Test #3: Storage Access - BLOCKED
- ✅ Test #4: Direct Insert - BLOCKED
- ✅ Test #5: Credit Balance - BLOCKED
- ✅ Test #6: Job Deletion - BLOCKED
- ✅ Test #7: Service Role - ALLOWED (correct)

### Step 6: Update API Routes (15 minutes)

**IMPORTANT**: API routes need to use service role client for webhook operations.

1. Create admin Supabase client:

```typescript
// File: /src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';

// ⚠️ NEVER expose to client-side code
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

2. Update webhook handlers to use `supabaseAdmin`:

```typescript
// Example: /src/routes/api/webhooks/job-complete/+server.ts
import { supabaseAdmin } from '$lib/supabase/admin';

export async function POST({ request }) {
  // Verify webhook signature first...

  // Use admin client for job updates
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .update({ status: 'completed', outputs: processedData })
    .eq('job_id', jobId);

  // Service role bypasses RLS (as intended for webhooks)
}
```

3. Update `.env.local` with service role key:

```bash
SUPABASE_URL=https://rvwxbvfrgffjojjbnefs.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here  # ⚠️ Keep secret!
```

### Step 7: Test End-to-End Flow (10 minutes)

1. **User Signup**: Create new account → Verify profile created
2. **Job Submission**: Submit test job → Verify credits deducted
3. **Job Processing**: Trigger n8n webhook → Verify job updated
4. **Job Completion**: Check outputs → Verify download works
5. **Credit Refund**: Cancel job → Verify credits refunded

**All steps must succeed without errors.**

---

## 🔧 ROLLBACK PROCEDURE

If anything goes wrong:

### Emergency Rollback (5 minutes)

1. Go to Supabase Dashboard → **Database** → **Backups**
2. Find backup: `pre-security-fix-2026-01-16`
3. Click **"Restore"**
4. **CRITICAL**: This will DELETE all data created after backup
5. Confirm restoration
6. Wait for completion
7. Verify site works
8. **Document what went wrong** for troubleshooting

### Partial Rollback (Manual)

If only one component failed (e.g., storage policies):

```sql
-- Rollback storage policies
DROP POLICY IF EXISTS "Users can view own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
-- ... drop other policies

-- Revert to old policies (if available)
-- Copy from backup SQL
```

---

## 📊 POST-DEPLOYMENT VERIFICATION

### Immediate Checks (First 30 minutes)

Monitor for:
- [ ] Authentication failures (users can't log in)
- [ ] Job submission errors (credits not deducting)
- [ ] File upload failures (storage access denied)
- [ ] Webhook errors (n8n can't update jobs)

**Check Logs**:
- Supabase Dashboard → **Logs** → **Database Logs**
- Look for "policy" or "permission denied" errors
- n8n workflow execution logs

### First 24 Hours

Monitor for:
- [ ] User complaints about access issues
- [ ] Spike in error rates (Sentry/logging)
- [ ] Webhook failures (check n8n execution history)

---

## 🎯 SUCCESS CRITERIA

Deployment is successful when:

- ✅ All 7 penetration tests PASS (attacks blocked)
- ✅ End-to-end user flow works (signup → job → completion)
- ✅ Webhooks can update jobs (service role works)
- ✅ No RLS-related errors in logs for 24 hours
- ✅ Zero security vulnerabilities in schema

---

## 📝 DEPLOYMENT REPORT TEMPLATE

```
SWIFTLIST SECURE DATABASE DEPLOYMENT REPORT
Date: YYYY-MM-DD
Deployed By: [Your Name]
Environment: [Staging / Production]

PRE-DEPLOYMENT:
[✅] Backup created: pre-security-fix-2026-01-16
[✅] Staging environment tested
[✅] Rollback plan documented

DEPLOYMENT:
[✅] Schema deployed: supabase-schema-secure-2026-01-16.sql
[✅] Storage policies deployed: supabase-storage-policies-secure.sql
[✅] Verification queries passed
[✅] Penetration tests: 7/7 PASS
[✅] API routes updated to use service role
[✅] End-to-end flow tested

POST-DEPLOYMENT:
[✅] No authentication failures
[✅] No job submission errors
[✅] No storage access errors
[✅] Webhooks functioning correctly

VULNERABILITIES FIXED:
✅ Vuln #1: RLS Bypass (USING true) - FIXED
✅ Vuln #2: SECURITY DEFINER missing auth - FIXED
✅ Vuln #3: Missing DELETE policies - FIXED
✅ Vuln #4: Storage bucket RLS - FIXED
✅ Vuln #5: Service role separation - FIXED
✅ Vuln #6: Direct transaction inserts - FIXED

STATUS: 🟢 PRODUCTION READY
SECURITY LEVEL: High (all critical vulnerabilities resolved)

NEXT STEPS:
1. [ ] Implement P0 agentic AI security (preset scanning, PII scrubbing)
2. [ ] Add rate limiting to API routes
3. [ ] Audit remaining API routes (/api/presets/*, /api/credits/*)
4. [ ] Phase 3: Implement agent audit logging
```

---

## 🚀 PRODUCTION DEPLOYMENT TIMELINE

**Total Time**: 1-2 hours (including testing)

| Task | Duration | Can Skip? |
|------|----------|-----------|
| Backup database | 5 min | ❌ NO |
| Deploy schema | 5 min | ❌ NO |
| Deploy storage policies | 5 min | ❌ NO |
| Verification queries | 5 min | ❌ NO |
| Penetration tests | 10 min | ❌ NO |
| Update API routes | 15 min | ❌ NO |
| End-to-end testing | 10 min | ❌ NO |
| Monitoring (24h) | Ongoing | ❌ NO |

---

## 🆘 TROUBLESHOOTING

### Issue: "policy" errors after deployment

**Symptoms**: Users can't access their own data
**Cause**: RLS policies too restrictive
**Fix**:
1. Check user is authenticated (`auth.uid()` returns value)
2. Verify user_id column matches auth.users(id) type (UUID)
3. Check policy uses correct syntax: `auth.uid() = user_id`

### Issue: Webhooks failing to update jobs

**Symptoms**: Jobs stuck in "processing" status
**Cause**: Service role not configured correctly
**Fix**:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` in environment variables
2. Check API route uses `supabaseAdmin` client (not regular client)
3. Verify n8n webhook uses correct Supabase URL and key

### Issue: Storage uploads failing

**Symptoms**: "policy violation" on file upload
**Cause**: Bucket policies too restrictive
**Fix**:
1. Check bucket exists: `SELECT * FROM storage.buckets`
2. Verify user uploading to correct path: `user-id/filename.ext`
3. Check file extension whitelisted in policy
4. Verify file size under limit (10MB for uploads, 5MB for thumbnails)

---

**CRITICAL REMINDER**: Do NOT deploy to production without running ALL penetration tests and verifying PASS status.

*End of Deployment Guide*
