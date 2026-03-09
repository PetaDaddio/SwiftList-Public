# Migration 005: Job Outputs Table - Deployment Guide

**Migration File:** `005_create_job_outputs_table.sql`
**Status:** ⏳ Ready to deploy
**Priority:** P1 (Required for multiple marketplace outputs feature)

---

## What This Migration Does

Creates a new `job_outputs` table to store **multiple output files per job** (one for each selected marketplace).

### Current State (Before Migration)
- Each job has a single `output_url` column in the `jobs` table
- Only one output file per job (stored in `job-results` bucket)
- All marketplaces get the same image regardless of optimal dimensions

### New State (After Migration)
- Each job can have multiple outputs stored in `job_outputs` table
- One output per marketplace with optimized dimensions:
  - Amazon: 2048x2048
  - eBay: 1600x1600
  - Etsy: 2000x2000
  - Shopify: 2048x2048
  - Instagram/Facebook: 1080x1080
  - Pinterest: 1000x1500
  - Poshmark: 1600x1600

---

## Schema Changes

### New Table: `job_outputs`

```sql
CREATE TABLE job_outputs (
  output_id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(job_id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  output_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  dimensions TEXT,
  file_size_bytes BIGINT,
  content_type TEXT DEFAULT 'image/png',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_job_marketplace UNIQUE(job_id, marketplace)
);
```

### Indexes Created
- `idx_job_outputs_job_id` - Fast job lookup
- `idx_job_outputs_marketplace` - Fast marketplace filtering
- `idx_job_outputs_created` - Chronological queries

---

## Deployment Steps

### Step 1: Verify Prerequisites

Before running this migration:

1. **Backup existing data**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT COUNT(*) FROM jobs WHERE status = 'completed' AND output_url IS NOT NULL;
   ```
   Note: This migration will backfill existing completed jobs.

2. **Check current schema**
   ```sql
   -- Verify job_outputs table doesn't already exist
   SELECT EXISTS (
     SELECT FROM information_schema.tables
     WHERE table_schema = 'public'
     AND table_name = 'job_outputs'
   ) as table_exists;
   ```
   If returns `true`, migration already ran.

### Step 2: Run Migration in Supabase

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/[your-project-id]
   - Navigate to: SQL Editor

2. **Copy Migration SQL**
   - Open: `/database/migrations/005_create_job_outputs_table.sql`
   - Copy entire contents

3. **Execute Migration**
   - Paste SQL into Supabase SQL Editor
   - Click "Run" button
   - Wait for completion (should be instant)

4. **Expected Output**
   ```
   CREATE TABLE
   CREATE INDEX (3 times)
   COMMENT ON TABLE
   COMMENT ON COLUMN (4 times)
   INSERT 0 [X] (where X = number of legacy jobs backfilled)
   ```

### Step 3: Verify Migration Success

Run this verification query:

```sql
-- Check table exists and has correct structure
SELECT
  COUNT(*) as total_outputs,
  COUNT(DISTINCT job_id) as jobs_with_outputs,
  marketplace,
  AVG(file_size_bytes / 1024 / 1024)::NUMERIC(10,2) as avg_size_mb
FROM job_outputs
GROUP BY marketplace
ORDER BY total_outputs DESC;
```

**Expected Results:**
- `total_outputs` = number of legacy jobs with output_url
- `marketplace` = 'amazon' (all legacy jobs backfilled to amazon)
- `jobs_with_outputs` = same as total_outputs initially

### Step 4: Configure Storage Bucket (If Not Exists)

Create a new storage bucket for marketplace-specific outputs:

```sql
-- Check if job-outputs bucket exists
SELECT * FROM storage.buckets WHERE name = 'job-outputs';
```

If it doesn't exist, create it in Supabase Dashboard:
1. Go to: Storage → New bucket
2. Name: `job-outputs`
3. Public: ✅ Yes (for CDN delivery)
4. File size limit: 10 MB
5. Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`

### Step 5: Set RLS Policies

```sql
-- Enable RLS on job_outputs table
ALTER TABLE job_outputs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own job outputs
CREATE POLICY "Users can view their own job outputs"
ON job_outputs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jobs
    WHERE jobs.job_id = job_outputs.job_id
    AND jobs.user_id = auth.uid()
  )
);

-- Policy: Service role can insert/update outputs
CREATE POLICY "Service role can insert job outputs"
ON job_outputs FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update job outputs"
ON job_outputs FOR UPDATE
USING (auth.role() = 'service_role');
```

---

## Post-Migration Checklist

After running migration 005:

- [ ] Table `job_outputs` exists
- [ ] 3 indexes created successfully
- [ ] Legacy jobs backfilled to `amazon` marketplace
- [ ] Storage bucket `job-outputs` exists and is public
- [ ] RLS policies configured
- [ ] Test query returns expected data
- [ ] No errors in Supabase logs

---

## Rollback Plan (Emergency Only)

If you need to rollback this migration:

```sql
-- WARNING: This will delete all marketplace-specific outputs
DROP TABLE IF EXISTS job_outputs CASCADE;

-- Restore single-output system
-- (No action needed - jobs.output_url column still exists)
```

**Note:** Rollback will lose all marketplace-specific output data. Only use in emergency.

---

## Next Steps After Migration

Once migration 005 is deployed:

1. **Update Job Processor** (`/api/jobs/process/+server.ts`)
   - Modify `generateAndUploadBackground()` to create multiple outputs
   - Generate one image per selected marketplace with optimal dimensions
   - Upload to `job-outputs` bucket
   - Insert records into `job_outputs` table

2. **Create API Endpoint** (`/api/jobs/[id]/outputs/+server.ts`)
   - GET endpoint to fetch all outputs for a job
   - Returns array of outputs with marketplace, URL, dimensions

3. **Update Job Complete Page** (`/routes/jobs/complete/+page.svelte`)
   - Fetch outputs from new API endpoint
   - Display marketplace-specific downloads
   - Show dimensions for each output

4. **Update TDD Documentation**
   - Document new `job_outputs` table schema
   - Update entity relationship diagram
   - Add migration to change log

---

## Testing After Deployment

### Test 1: Verify Legacy Job Backfill

```sql
-- Check that completed jobs with output_url are in job_outputs
SELECT
  j.job_id,
  j.output_url as legacy_url,
  jo.output_url as new_url,
  jo.marketplace
FROM jobs j
LEFT JOIN job_outputs jo ON j.job_id = jo.job_id
WHERE j.status = 'completed'
AND j.output_url IS NOT NULL
LIMIT 10;
```

**Expected:** All legacy jobs should have matching records in `job_outputs` with `marketplace = 'amazon'`.

### Test 2: Create New Job with Multiple Outputs

1. Submit a job with multiple marketplaces selected (e.g., Amazon + Etsy + Instagram)
2. Job processor should create 3 records in `job_outputs`
3. Each record should have different dimensions:
   - Amazon: 2048x2048
   - Etsy: 2000x2000
   - Instagram: 1080x1080

```sql
-- Verify new job has multiple outputs
SELECT
  output_id,
  marketplace,
  dimensions,
  file_size_bytes,
  output_url
FROM job_outputs
WHERE job_id = '[job-id-from-test]'
ORDER BY marketplace;
```

### Test 3: API Endpoint

```bash
# Test GET /api/jobs/[id]/outputs
curl http://localhost:5173/api/jobs/[job-id]/outputs
```

**Expected Response:**
```json
{
  "outputs": [
    {
      "output_id": "...",
      "marketplace": "amazon",
      "output_url": "https://[project].supabase.co/storage/v1/object/public/job-outputs/...",
      "dimensions": "2048x2048",
      "file_size_bytes": 1234567,
      "created_at": "2026-01-28T..."
    },
    ...
  ]
}
```

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution:** Table already created. Run verification query to check:

```sql
SELECT COUNT(*) FROM job_outputs;
```

### Issue: Backfill inserts 0 rows

**Cause:** No legacy jobs with `output_url` set.

**Solution:** This is expected for new installations. Continue with next steps.

### Issue: RLS policy prevents reads

**Symptom:** API returns empty array even though outputs exist.

**Solution:** Check RLS policies:

```sql
SELECT * FROM pg_policies WHERE tablename = 'job_outputs';
```

Ensure policy exists and matches user_id correctly.

### Issue: Storage bucket doesn't exist

**Symptom:** File upload fails with "bucket not found".

**Solution:** Create bucket manually in Supabase Dashboard → Storage.

---

## Support

**Questions?** Check:
1. Migration file: `005_create_job_outputs_table.sql`
2. TDD documentation: `docs/TDD_MASTER_v4.x.md`
3. GitHub issues: https://github.com/your-org/swiftlist/issues

**Ready to Deploy:** ✅ Yes (tested in staging)

---

**Last Updated:** 2026-01-28
**Migration Version:** 005
**Status:** ⏳ Awaiting deployment
