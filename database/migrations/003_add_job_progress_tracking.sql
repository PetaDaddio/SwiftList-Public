/**
 * Migration: Add Progress Tracking to Jobs Table
 *
 * Adds columns for BullMQ worker progress tracking:
 * - progress_percent (0-100)
 * - progress_message (user-friendly status)
 * - retry_count (attempt number)
 * - last_error (last error message for debugging)
 */

-- Add progress tracking columns
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  ADD COLUMN IF NOT EXISTS progress_message TEXT DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Add index for progress queries (for dashboard)
CREATE INDEX IF NOT EXISTS idx_jobs_status_progress ON jobs(status, progress_percent);

-- Add index for user job history queries
CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at DESC);

-- Add index for workflow analytics
CREATE INDEX IF NOT EXISTS idx_jobs_workflow_status ON jobs(workflow_id, status);

-- Update existing jobs to have 0% progress
UPDATE jobs
SET progress_percent = 0,
    progress_message = CASE
      WHEN status = 'pending' THEN 'Pending'
      WHEN status = 'processing' THEN 'Processing'
      WHEN status = 'completed' THEN 'Completed'
      WHEN status = 'failed' THEN 'Failed'
      ELSE 'Unknown'
    END
WHERE progress_percent IS NULL;

-- Create function to automatically update progress_message based on status
CREATE OR REPLACE FUNCTION update_job_progress_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-update progress_message when status changes
  IF NEW.status = 'pending' AND OLD.status != 'pending' THEN
    NEW.progress_message := 'Job queued';
    NEW.progress_percent := 0;
  ELSIF NEW.status = 'processing' AND OLD.status != 'processing' THEN
    NEW.progress_message := 'Processing started';
    IF NEW.progress_percent = 0 THEN
      NEW.progress_percent := 5;
    END IF;
  ELSIF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.progress_message := 'Completed successfully';
    NEW.progress_percent := 100;
  ELSIF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    NEW.progress_message := 'Job failed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating progress message
DROP TRIGGER IF EXISTS trigger_update_job_progress_message ON jobs;
CREATE TRIGGER trigger_update_job_progress_message
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_progress_message();

-- Add comment for documentation
COMMENT ON COLUMN jobs.progress_percent IS 'Job progress percentage (0-100). Updated by BullMQ workers.';
COMMENT ON COLUMN jobs.progress_message IS 'User-friendly progress message. Auto-updated by trigger or manually by worker.';
COMMENT ON COLUMN jobs.retry_count IS 'Number of retry attempts for this job (max 3).';
COMMENT ON COLUMN jobs.last_error IS 'Last error message if job failed or retried.';
