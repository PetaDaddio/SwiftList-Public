# Run Database Migration: Add Job Metadata

To add the `metadata` JSONB column to the `jobs` table, run this SQL in Supabase SQL Editor:

## Option 1: Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_REF/sql/new
2. Paste the contents of `database/migrations/004_add_job_metadata.sql`
3. Click "Run"

## Option 2: Via psql (if installed)

```bash
psql "$DATABASE_URL" < database/migrations/004_add_job_metadata.sql
```

## SQL to Run

```sql
-- Add metadata column (JSONB for flexible key-value storage)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for querying by metadata keys
CREATE INDEX IF NOT EXISTS idx_jobs_metadata ON jobs USING gin(metadata);

-- Add comment for documentation
COMMENT ON COLUMN jobs.metadata IS 'Workflow-specific parameters (e.g., background_color, lifestyle_scene, upscale_factor)';
```

## Verify Migration

```sql
-- Check if column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'metadata';

-- Check if index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'jobs' AND indexname = 'idx_jobs_metadata';
```

## Example Usage

After migration, you can store workflow-specific data:

```sql
-- WF-08: Simplify Background
UPDATE jobs
SET metadata = '{"background_color": "#FFFFFF"}'
WHERE job_id = 'uuid-here';

-- WF-09: Lifestyle Setting
UPDATE jobs
SET metadata = '{"lifestyle_scene": "coffee-shop"}'
WHERE job_id = 'uuid-here';

-- WF-14: Upscaling
UPDATE jobs
SET metadata = '{"upscale_factor": 2}'
WHERE job_id = 'uuid-here';

-- Combined metadata
UPDATE jobs
SET metadata = '{"background_color": "#FFFFFF", "upscale_factor": 4}'
WHERE job_id = 'uuid-here';
```

## Notes

- `IF NOT EXISTS` makes this migration idempotent (safe to run multiple times)
- Default value is empty JSON object `{}`
- GIN index enables fast lookups on metadata keys
- JSONB type provides efficient storage and querying
