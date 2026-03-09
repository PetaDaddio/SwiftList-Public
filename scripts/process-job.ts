/**
 * Manual Job Processing Script
 *
 * Usage:
 *   bun scripts/process-job.ts <job_id>
 *
 * Example:
 *   bun scripts/process-job.ts 8f97936d-78f5-4d07-9180-a9e127b5bc2b
 *
 * This script manually triggers job processing for testing purposes.
 * In production, this will be automated with a worker process.
 */

const jobId = process.argv[2];

if (!jobId) {
  console.error('❌ Error: Job ID required');
  console.log('Usage: bun scripts/process-job.ts <job_id>');
  process.exit(1);
}

console.log(`🚀 Processing job: ${jobId}`);
console.log('');

// Call the job processing API
const response = await fetch('http://localhost:5174/api/jobs/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ job_id: jobId }),
});

if (response.ok) {
  const result = await response.json();
  console.log('✅ Job processed successfully!');
  console.log('');
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
} else {
  const error = await response.text();
  console.error('❌ Job processing failed:');
  console.error(error);
  process.exit(1);
}
