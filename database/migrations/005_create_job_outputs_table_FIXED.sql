/**
 * Migration: Create Job Outputs Table for Multiple Marketplace Outputs
 * FIXED VERSION - Compatible with existing schema (output_image_url)
 *
 * Allows storing multiple output files per job (one per selected marketplace).
 * Each job can have outputs optimized for different marketplaces:
 * - Amazon: 2048x2048
 * - eBay: 1600x1600
 * - Etsy: 2000x2000
 * - Shopify: 2048x2048
 * - Instagram/Facebook: 1080x1080
 * - Pinterest: 1000x1500
 * - Poshmark: 1600x1600
 */

-- Create job_outputs table
CREATE TABLE IF NOT EXISTS job_outputs (
  output_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  output_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  dimensions TEXT,           -- Format: "2048x2048"
  file_size_bytes BIGINT,
  content_type TEXT DEFAULT 'image/png',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each job can have only one output per marketplace
  CONSTRAINT unique_job_marketplace UNIQUE(job_id, marketplace)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_job_outputs_job_id ON job_outputs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_outputs_marketplace ON job_outputs(marketplace);
CREATE INDEX IF NOT EXISTS idx_job_outputs_created ON job_outputs(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE job_outputs IS 'Stores multiple output files per job, one for each selected marketplace';
COMMENT ON COLUMN job_outputs.marketplace IS 'Target marketplace: amazon, ebay, etsy, shopify, instagram, facebook, pinterest, poshmark';
COMMENT ON COLUMN job_outputs.output_url IS 'Public URL from Supabase storage (job-outputs bucket)';
COMMENT ON COLUMN job_outputs.filename IS 'Generated filename format: product_{marketplace}_{dimensions}.png';
COMMENT ON COLUMN job_outputs.dimensions IS 'Image dimensions in WIDTHxHEIGHT format (e.g., "2048x2048")';
COMMENT ON COLUMN job_outputs.file_size_bytes IS 'File size in bytes for storage tracking';

-- Backfill existing jobs with their single output
-- FIXED: Use output_image_url instead of output_url
-- This migrates the old single-output system to the new multi-output system
INSERT INTO job_outputs (job_id, marketplace, output_url, filename, dimensions)
SELECT
  job_id,
  'amazon' AS marketplace,  -- Default to Amazon for legacy jobs
  output_image_url,         -- FIXED: Correct column name
  CONCAT('product_amazon_legacy.png') AS filename,
  '2048x2048' AS dimensions -- Estimate for legacy outputs
FROM jobs
WHERE output_image_url IS NOT NULL  -- FIXED: Correct column name
  AND status = 'completed'
ON CONFLICT (job_id, marketplace) DO NOTHING;

-- Verification query (run after migration)
-- SELECT
--   COUNT(*) as total_outputs,
--   COUNT(DISTINCT job_id) as jobs_with_outputs,
--   marketplace,
--   AVG(file_size_bytes / 1024 / 1024) as avg_size_mb
-- FROM job_outputs
-- GROUP BY marketplace
-- ORDER BY total_outputs DESC;

-- Success message
DO $$
DECLARE
  table_exists BOOLEAN;
  output_count INTEGER;
BEGIN
  -- Check if table was created
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'job_outputs'
  ) INTO table_exists;

  -- Count outputs
  SELECT COUNT(*) INTO output_count FROM job_outputs;

  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'Migration 005: Job Outputs Table - COMPLETE';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  ✓ Table created: job_outputs';
  RAISE NOTICE '  ✓ Indexes created: 3';
  RAISE NOTICE '  ✓ Legacy jobs backfilled: %', output_count;
  RAISE NOTICE '  ✓ Unique constraint: (job_id, marketplace)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Update job processor to generate multiple outputs';
  RAISE NOTICE '  2. Create API endpoint: GET /api/jobs/[id]/outputs';
  RAISE NOTICE '  3. Update Job Complete page to display marketplace outputs';
  RAISE NOTICE '==============================================================';
END $$;
