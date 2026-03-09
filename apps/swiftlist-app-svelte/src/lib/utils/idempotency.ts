/**
 * SwiftList Idempotency Utility
 * Prevents duplicate processing of identical job requests
 *
 * Idempotency Key Format: SHA256(job_id + workflow_id + input_hash)
 */

import crypto from 'crypto';
import { infraLogger } from '$lib/utils/logger';

const log = infraLogger.child({ component: 'idempotency' });

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingJobId?: string;
  existingOutputUrl?: string;
  completedAt?: string;
  status?: string;
}

export interface JobInput {
  job_id: string;
  workflow_id: string;
  input_data: any;
}

/**
 * Generate idempotency key from job parameters
 */
export function generateIdempotencyKey(job: JobInput): string {
  // Hash the input data for consistent key generation
  const inputString = typeof job.input_data === 'string'
    ? job.input_data
    : JSON.stringify(job.input_data);

  const inputHash = crypto
    .createHash('sha256')
    .update(inputString)
    .digest('hex');

  // Combine job_id, workflow_id, and input_hash
  const combined = `${job.job_id}|${job.workflow_id}|${inputHash}`;

  const idempotencyKey = crypto
    .createHash('sha256')
    .update(combined)
    .digest('hex');

  return idempotencyKey;
}

/**
 * Check if a job with the same idempotency key has already been processed
 */
export async function checkIdempotency(
  idempotencyKey: string,
  supabaseClient: any
): Promise<IdempotencyCheckResult> {
  try {
    // Query jobs table for existing job with same idempotency key
    const { data, error } = await supabaseClient
      .from('jobs')
      .select('id, status, output_url, completed_at')
      .eq('idempotency_key', idempotencyKey)
      .eq('status', 'completed')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error in this case)
      log.error({ err: error }, 'Error checking duplicate');
      // Fail open: allow processing if we can't check
      return { isDuplicate: false };
    }

    if (data) {
      // Found duplicate completed job
      return {
        isDuplicate: true,
        existingJobId: data.id,
        existingOutputUrl: data.output_url,
        completedAt: data.completed_at,
        status: data.status
      };
    }

    // No duplicate found
    return { isDuplicate: false };
  } catch (error) {
    log.error({ err: error }, 'Error during check');
    // Fail open: allow processing if we can't check
    return { isDuplicate: false };
  }
}

/**
 * Store idempotency key for a job
 */
export async function storeIdempotencyKey(
  jobId: string,
  idempotencyKey: string,
  supabaseClient: any
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('jobs')
      .update({ idempotency_key: idempotencyKey })
      .eq('id', jobId);

    if (error) {
      log.error({ err: error }, 'Error storing key');
      return false;
    }

    return true;
  } catch (error) {
    log.error({ err: error }, 'Error storing key');
    return false;
  }
}

/**
 * Mark job as duplicate
 */
export async function markAsDuplicate(
  jobId: string,
  originalJobId: string,
  supabaseClient: any
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('jobs')
      .update({
        is_duplicate: true,
        status: 'completed',
        output_url: null,
        error_message: `Duplicate of job ${originalJobId} - returned cached result`,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      log.error({ err: error }, 'Error marking as duplicate');
      return false;
    }

    return true;
  } catch (error) {
    log.error({ err: error }, 'Error marking as duplicate');
    return false;
  }
}

/**
 * Complete idempotency check and handle duplicate
 * Returns true if job should proceed, false if duplicate
 */
export async function handleIdempotency(
  job: JobInput,
  supabaseClient: any
): Promise<{ shouldProceed: boolean; cachedResult?: any }> {
  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(job);

  // Check for duplicates
  const check = await checkIdempotency(idempotencyKey, supabaseClient);

  if (check.isDuplicate) {

    // Mark current job as duplicate
    await markAsDuplicate(job.job_id, check.existingJobId!, supabaseClient);

    return {
      shouldProceed: false,
      cachedResult: {
        job_id: job.job_id,
        original_job_id: check.existingJobId,
        output_url: check.existingOutputUrl,
        completed_at: check.completedAt,
        status: 'completed',
        is_cached: true
      }
    };
  }

  // No duplicate - store key and proceed
  await storeIdempotencyKey(job.job_id, idempotencyKey, supabaseClient);

  return { shouldProceed: true };
}
