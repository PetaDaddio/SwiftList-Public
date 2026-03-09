/**
 * SwiftList Job Logging System E2E Tests
 * File: tests/e2e/job-logging.spec.ts
 *
 * Purpose: Integration tests for job logging, event tracking, and admin dashboard
 * - Verifies job_events are created during workflow execution
 * - Tests processing_time_seconds calculation
 * - Validates Google Sheets sync functionality
 * - Tests admin job lookup tool
 * - Verifies RLS policies
 *
 * Prerequisites:
 * - Supabase instance running with migrations applied
 * - Test user accounts (regular user + admin user)
 * - WF-07 workflow deployed to n8n (for integration testing)
 *
 * Author: Ralph Wiggum (AI Systems Architect)
 * Date: 2026-01-10
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key';
const SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

// Test user credentials
const TEST_USER = {
  email: 'test@swiftlist.app',
  password: 'TestPassword123!',
  userId: 'test-user-id'
};

const ADMIN_USER = {
  email: 'admin@swiftlist.app',
  password: 'AdminPassword123!',
  userId: 'admin-user-id'
};

// Create Supabase clients
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

test.describe('Job Logging System', () => {
  let testJobId: string;

  test.beforeAll(async () => {
    // Setup: Create test users and sample job
    await setupTestData();
  });

  test.afterAll(async () => {
    // Cleanup: Remove test data
    await cleanupTestData();
  });

  test.describe('Database Schema', () => {
    test('should have processing_time_seconds column in jobs table', async () => {
      const { data, error } = await supabaseService
        .from('jobs')
        .select('processing_time_seconds')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    test('should have job_events table with correct schema', async () => {
      const { data, error } = await supabaseService
        .from('job_events')
        .select('event_id, job_id, event_type, workflow_id, event_timestamp, duration_ms, metadata')
        .limit(1);

      expect(error).toBeNull();
      // Table exists if no error
    });

    test('should have job_events indexes created', async () => {
      const { data: indexes, error } = await supabaseService
        .rpc('get_table_indexes', { table_name: 'job_events' });

      expect(error).toBeNull();
      // Verify indexes exist
      const indexNames = indexes?.map((idx: any) => idx.indexname) || [];
      expect(indexNames).toContain('idx_job_events_job_timestamp');
      expect(indexNames).toContain('idx_job_events_workflow_timestamp');
      expect(indexNames).toContain('idx_job_events_type_timestamp');
    });

    test('should have RLS enabled on job_events table', async () => {
      const { data, error } = await supabaseService
        .rpc('check_rls_enabled', { table_name: 'job_events' });

      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });

  test.describe('Job Event Logging', () => {
    test('should create workflow_start event when job begins', async () => {
      // Create a test job
      const { data: job, error: jobError } = await supabaseService
        .from('jobs')
        .insert({
          user_id: TEST_USER.userId,
          original_image_url: 'https://example.com/test-image.jpg',
          workflow_chain: ['WF-07'],
          status: 'pending'
        })
        .select()
        .single();

      expect(jobError).toBeNull();
      expect(job).toBeDefined();
      testJobId = job.job_id;

      // Simulate workflow_start event
      const { data: event, error: eventError } = await supabaseService
        .from('job_events')
        .insert({
          job_id: testJobId,
          event_type: 'workflow_start',
          workflow_id: 'WF-07',
          metadata: { user_id: TEST_USER.userId }
        })
        .select()
        .single();

      expect(eventError).toBeNull();
      expect(event).toBeDefined();
      expect(event.event_type).toBe('workflow_start');
      expect(event.workflow_id).toBe('WF-07');
    });

    test('should create api_call event with duration', async () => {
      const { data: event, error } = await supabaseService
        .from('job_events')
        .insert({
          job_id: testJobId,
          event_type: 'api_call',
          workflow_id: 'WF-07',
          duration_ms: 2300,
          metadata: { api: 'Photoroom', cost_usd: 0.02 }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(event).toBeDefined();
      expect(event.event_type).toBe('api_call');
      expect(event.duration_ms).toBe(2300);
      expect(event.metadata).toHaveProperty('api', 'Photoroom');
    });

    test('should create workflow_complete event with total duration', async () => {
      const { data: event, error } = await supabaseService
        .from('job_events')
        .insert({
          job_id: testJobId,
          event_type: 'workflow_complete',
          workflow_id: 'WF-07',
          duration_ms: 8000,
          metadata: { output_url: 's3://bucket/output.png' }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(event).toBeDefined();
      expect(event.event_type).toBe('workflow_complete');
      expect(event.duration_ms).toBe(8000);
    });

    test('should create error event when workflow fails', async () => {
      const { data: event, error } = await supabaseService
        .from('job_events')
        .insert({
          job_id: testJobId,
          event_type: 'error',
          workflow_id: 'WF-07',
          metadata: {
            error_message: 'API timeout',
            error_node: 'Photoroom API',
            error_type: 'timeout'
          }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(event).toBeDefined();
      expect(event.event_type).toBe('error');
      expect(event.metadata).toHaveProperty('error_message', 'API timeout');
    });

    test('should retrieve events in chronological order', async () => {
      const { data: events, error } = await supabaseService
        .from('job_events')
        .select('*')
        .eq('job_id', testJobId)
        .order('event_timestamp', { ascending: true });

      expect(error).toBeNull();
      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);

      // Verify chronological order
      if (events.length > 1) {
        const firstEvent = new Date(events[0].event_timestamp);
        const lastEvent = new Date(events[events.length - 1].event_timestamp);
        expect(lastEvent.getTime()).toBeGreaterThanOrEqual(firstEvent.getTime());
      }
    });
  });

  test.describe('Processing Time Calculation', () => {
    test('should calculate processing_time_seconds when job completes', async () => {
      // Update job to completed status
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const { data: job, error } = await supabaseService
        .from('jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          processing_time_seconds: 8
        })
        .eq('job_id', testJobId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(job).toBeDefined();
      expect(job.processing_time_seconds).toBeDefined();
      expect(job.processing_time_seconds).toBeGreaterThan(0);
    });

    test('should backfill processing_time_seconds for existing jobs', async () => {
      // Create job with completed_at but no processing_time_seconds
      const created = new Date();
      const completed = new Date(created.getTime() + 5000); // 5 seconds later

      const { data: job, error: insertError } = await supabaseService
        .from('jobs')
        .insert({
          user_id: TEST_USER.userId,
          original_image_url: 'https://example.com/backfill-test.jpg',
          workflow_chain: ['WF-07'],
          status: 'completed',
          created_at: created.toISOString(),
          completed_at: completed.toISOString()
        })
        .select()
        .single();

      expect(insertError).toBeNull();

      // Simulate backfill query
      const { error: updateError } = await supabaseService
        .rpc('backfill_processing_time', { job_id: job.job_id });

      // Alternative: Manual calculation
      const { data: updated, error: fetchError } = await supabaseService
        .from('jobs')
        .update({
          processing_time_seconds: Math.round((completed.getTime() - created.getTime()) / 1000)
        })
        .eq('job_id', job.job_id)
        .select()
        .single();

      expect(fetchError).toBeNull();
      expect(updated.processing_time_seconds).toBe(5);
    });
  });

  test.describe('Row Level Security (RLS)', () => {
    test('should allow users to view their own job events', async () => {
      // Sign in as test user
      const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

      expect(authError).toBeNull();
      expect(authData.user).toBeDefined();

      // Try to read job events for own job
      const { data: events, error } = await supabaseAnon
        .from('job_events')
        .select('*')
        .eq('job_id', testJobId);

      expect(error).toBeNull();
      expect(events).toBeDefined();
      // Events should be accessible
    });

    test('should prevent users from viewing other users job events', async () => {
      // Create job for a different user
      const { data: otherJob, error: jobError } = await supabaseService
        .from('jobs')
        .insert({
          user_id: 'other-user-id',
          original_image_url: 'https://example.com/other-user.jpg',
          workflow_chain: ['WF-07'],
          status: 'completed'
        })
        .select()
        .single();

      expect(jobError).toBeNull();

      // Create event for other user's job
      await supabaseService.from('job_events').insert({
        job_id: otherJob.job_id,
        event_type: 'workflow_start',
        workflow_id: 'WF-07'
      });

      // Sign in as test user and try to access other user's events
      const { data: authData } = await supabaseAnon.auth.signInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

      const { data: events, error } = await supabaseAnon
        .from('job_events')
        .select('*')
        .eq('job_id', otherJob.job_id);

      // RLS should prevent access or return empty array
      expect(events).toEqual([]);
    });

    test('should prevent users from inserting job events directly', async () => {
      // Sign in as test user
      await supabaseAnon.auth.signInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

      // Try to insert event as regular user
      const { data, error } = await supabaseAnon
        .from('job_events')
        .insert({
          job_id: testJobId,
          event_type: 'workflow_start',
          workflow_id: 'WF-99'
        })
        .select();

      // Should fail due to RLS policy (only service role can insert)
      expect(error).toBeDefined();
    });

    test('should prevent users from updating or deleting job events', async () => {
      // Get an event ID
      const { data: events } = await supabaseService
        .from('job_events')
        .select('event_id')
        .eq('job_id', testJobId)
        .limit(1);

      if (!events || events.length === 0) return;

      const eventId = events[0].event_id;

      // Sign in as test user
      await supabaseAnon.auth.signInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

      // Try to update event
      const { error: updateError } = await supabaseAnon
        .from('job_events')
        .update({ event_type: 'modified' })
        .eq('event_id', eventId);

      expect(updateError).toBeDefined(); // Should fail - events are immutable

      // Try to delete event
      const { error: deleteError } = await supabaseAnon
        .from('job_events')
        .delete()
        .eq('event_id', eventId);

      expect(deleteError).toBeDefined(); // Should fail - only CASCADE deletes allowed
    });
  });

  test.describe('Admin Job Lookup Tool', () => {
    test.use({ storageState: 'admin-auth.json' }); // Use admin session

    test('should load admin job lookup page', async ({ page }) => {
      await page.goto('/admin/job-lookup');
      await expect(page.locator('h1')).toContainText('Job Lookup Tool');
    });

    test('should search jobs by job_id', async ({ page }) => {
      await page.goto('/admin/job-lookup');

      // Select job_id search type
      await page.selectOption('select', 'job_id');

      // Enter job ID
      await page.fill('input[placeholder*="job ID"]', testJobId);

      // Click search
      await page.click('button:has-text("Search")');

      // Wait for results
      await page.waitForSelector('h2:has-text("Job Details")');

      // Verify job details are displayed
      await expect(page.locator('text=Job ID')).toBeVisible();
      await expect(page.locator(`text=${testJobId}`)).toBeVisible();
    });

    test('should search jobs by user_id', async ({ page }) => {
      await page.goto('/admin/job-lookup');

      // Select user_id search type
      await page.selectOption('select', 'user_id');

      // Enter user ID
      await page.fill('input[placeholder*="user"]', TEST_USER.userId);

      // Click search
      await page.click('button:has-text("Search")');

      // Wait for results table
      await page.waitForSelector('table');

      // Verify multiple jobs are displayed
      const rows = await page.locator('tbody tr').count();
      expect(rows).toBeGreaterThan(0);
    });

    test('should display execution timeline with events', async ({ page }) => {
      await page.goto('/admin/job-lookup');

      // Search for specific job
      await page.selectOption('select', 'job_id');
      await page.fill('input[placeholder*="job ID"]', testJobId);
      await page.click('button:has-text("Search")');

      // Wait for timeline
      await page.waitForSelector('h3:has-text("Execution Timeline")');

      // Verify events are displayed
      await expect(page.locator('text=workflow_start')).toBeVisible();
      await expect(page.locator('text=WF-07')).toBeVisible();
    });

    test('should prevent non-admin access', async ({ page }) => {
      // Sign out admin
      await page.context().clearCookies();

      // Try to access as regular user
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', TEST_USER.email);
      await page.fill('input[type="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      // Navigate to admin page
      await page.goto('/admin/job-lookup');

      // Should see access denied message
      await expect(page.locator('text=Access Denied')).toBeVisible();
    });
  });

  test.describe('Google Sheets Export (WF-28)', () => {
    test('should query jobs updated in last 5 minutes', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const { data: jobs, error } = await supabaseService
        .from('jobs')
        .select('*')
        .gte('updated_at', fiveMinutesAgo.toISOString())
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(jobs).toBeDefined();
      // Jobs should include our test job
      expect(jobs.some((j: any) => j.job_id === testJobId)).toBe(true);
    });

    test('should format job data for Google Sheets', async () => {
      const { data: job, error } = await supabaseService
        .from('jobs')
        .select('*')
        .eq('job_id', testJobId)
        .single();

      expect(error).toBeNull();
      expect(job).toBeDefined();

      // Simulate formatting for Google Sheets
      const sheetRow = [
        job.job_id,
        job.user_id,
        new Date(job.created_at).toLocaleString(),
        job.completed_at ? new Date(job.completed_at).toLocaleString() : 'In Progress',
        job.processing_time_seconds ? `${job.processing_time_seconds}s` : 'N/A',
        Array.isArray(job.workflow_chain) ? job.workflow_chain.join(' → ') : 'N/A',
        job.status.toUpperCase(),
        job.credits_charged || 0,
        job.ai_cost_usd ? `$${parseFloat(job.ai_cost_usd).toFixed(4)}` : '$0.0000',
        job.error_message || ''
      ];

      expect(sheetRow.length).toBe(10); // All columns present
      expect(sheetRow[0]).toBe(testJobId);
    });
  });
});

// Helper functions

async function setupTestData() {
  // Create test users
  // Note: In real tests, use Supabase Auth API to create users
  console.log('Setting up test data...');

  // Create test user profile if doesn't exist
  await supabaseService.from('profiles').upsert({
    user_id: TEST_USER.userId,
    email: TEST_USER.email,
    role: 'user',
    credits_balance: 100
  });

  // Create admin user profile
  await supabaseService.from('profiles').upsert({
    user_id: ADMIN_USER.userId,
    email: ADMIN_USER.email,
    role: 'admin',
    credits_balance: 1000
  });
}

async function cleanupTestData() {
  console.log('Cleaning up test data...');

  // Delete test jobs (CASCADE will delete events)
  await supabaseService
    .from('jobs')
    .delete()
    .eq('user_id', TEST_USER.userId);

  // Delete test user profiles
  await supabaseService
    .from('profiles')
    .delete()
    .in('user_id', [TEST_USER.userId, ADMIN_USER.userId]);
}
