/**
 * Migration: Add Metadata Column to Jobs Table
 *
 * Adds JSONB column for flexible workflow-specific parameters:
 * - background_color (for simplify-background workflow)
 * - lifestyle_scene (for lifestyle-setting workflow)
 * - product_type (for general-goods-engine workflow)
 * - upscale_factor (for upscale workflow)
 * - Any future workflow parameters
 */

-- Add metadata column (JSONB for flexible key-value storage)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for querying by metadata keys
CREATE INDEX IF NOT EXISTS idx_jobs_metadata ON jobs USING gin(metadata);

-- Add comment for documentation
COMMENT ON COLUMN jobs.metadata IS 'Workflow-specific parameters (e.g., background_color, lifestyle_scene, upscale_factor)';

-- Example metadata structures:
-- WF-08 Simplify Background: {"background_color": "#FFFFFF"}
-- WF-09 Lifestyle Setting: {"lifestyle_scene": "coffee-shop"}
-- WF-06 General Goods Engine: {"product_type": "jewelry"}
-- WF-14 Upscaling: {"upscale_factor": 2}
