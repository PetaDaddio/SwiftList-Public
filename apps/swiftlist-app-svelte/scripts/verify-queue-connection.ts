/**
 * Verify BullMQ Queue Connection
 *
 * Tests that SvelteKit API can connect to Redis and submit jobs to BullMQ.
 *
 * Usage:
 *   npx tsx scripts/verify-queue-connection.ts
 */

import { Queue } from 'bullmq';

// Load environment variables
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

console.log('🔍 Verifying BullMQ Queue Connection...\n');

console.log('Configuration:');
console.log(`  REDIS_HOST: ${REDIS_HOST}`);
console.log(`  REDIS_PORT: ${REDIS_PORT}`);
console.log(`  REDIS_PASSWORD: ${REDIS_PASSWORD ? '***' : '(not set)'}\n`);

async function verifyConnection() {
	try {
		// Test 1: Create queue instance
		console.log('📝 Test 1: Creating queue instance...');
		const queue = new Queue('background-removal', {
			connection: {
				host: REDIS_HOST,
				port: REDIS_PORT,
				password: REDIS_PASSWORD,
				maxRetriesPerRequest: null,
				enableReadyCheck: false
			}
		});
		console.log('✅ Queue instance created\n');

		// Test 2: Get queue stats
		console.log('📝 Test 2: Getting queue statistics...');
		const [waiting, active, completed, failed] = await Promise.all([
			queue.getWaitingCount(),
			queue.getActiveCount(),
			queue.getCompletedCount(),
			queue.getFailedCount()
		]);

		console.log('✅ Queue statistics retrieved:');
		console.log(`  Waiting: ${waiting}`);
		console.log(`  Active: ${active}`);
		console.log(`  Completed: ${completed}`);
		console.log(`  Failed: ${failed}\n`);

		// Test 3: Submit test job
		console.log('📝 Test 3: Submitting test job...');
		const testJob = await queue.add('test-job', {
			jobId: 'test-' + Date.now(),
			userId: 'test-user',
			workflowId: 'WF-07',
			inputUrl: 'https://example.com/test.jpg',
			parameters: { test: true }
		});

		console.log(`✅ Test job submitted: ${testJob.id}\n`);

		// Test 4: Clean up test job
		console.log('📝 Test 4: Cleaning up test job...');
		await testJob.remove();
		console.log('✅ Test job removed\n');

		// Close queue
		await queue.close();

		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('✅ ALL TESTS PASSED');
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log('\nYour BullMQ integration is working correctly!');
		console.log('You can now start your SvelteKit app and create jobs.\n');

		process.exit(0);
	} catch (error: any) {
		console.error('\n❌ CONNECTION FAILED\n');
		console.error('Error:', error.message);
		console.error('\nTroubleshooting:');
		console.error('1. Verify Redis is running');
		console.error('2. Check REDIS_HOST, REDIS_PORT, REDIS_PASSWORD in .env.local');
		console.error('3. Test Redis connection:');
		console.error(`   redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} -a ${REDIS_PASSWORD} ping`);
		console.error('4. Restart dev server after changing environment variables\n');

		process.exit(1);
	}
}

verifyConnection();
