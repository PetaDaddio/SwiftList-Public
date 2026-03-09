# SwiftList Database Deployment Guide

## Prerequisites
- Supabase project created at https://app.supabase.com
- Project ID and credentials ready
- Supabase CLI installed: `npm install -g supabase`

## Step 1: Connect to Supabase Production

```bash
# Login to Supabase (if not already logged in)
supabase login

# Link to production project
supabase link --project-ref YOUR_PROJECT_ID

# Verify connection
supabase db remote commit
```

## Step 2: Deploy Database Schema

### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /home/user/apps/swiftlist-app-svelte

# Push schema to production
supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres"
```

### Option B: Using Supabase Dashboard SQL Editor

1. Go to https://app.supabase.com/project/YOUR_PROJECT_ID/sql
2. Copy entire contents of `/path/to/swiftlist/apps/swiftlist-app/scripts/schema.sql`
3. Paste into SQL Editor
4. Click "Run"

### Option C: Using psql Command Line

```bash
# Set connection string
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres"

# Execute schema
psql $DATABASE_URL < "/path/to/swiftlist/apps/swiftlist-app/scripts/schema.sql"
```

## Step 3: Verify Database Setup

Run these verification queries in Supabase SQL Editor:

```sql
-- Verify tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'jobs', 'credit_transactions');

-- Expected output: 3 rows (profiles, jobs, credit_transactions)

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'jobs', 'credit_transactions');

-- Expected output: All rowsecurity = true

-- Verify functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('deduct_credits', 'refund_credits');

-- Expected output: 2 rows (deduct_credits, refund_credits)

-- Verify indexes exist
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('jobs', 'credit_transactions');

-- Expected output: 3 rows (idx_jobs_user_id, idx_jobs_status, idx_transactions_user_id)
```

## Step 4: Create Test User (Optional)

```sql
-- Create test profile
INSERT INTO profiles (user_id, email, display_name, credits_balance)
VALUES ('test-user-id', 'test@swiftlist.app', 'Test User', 100);
```

## Database Schema Summary

### Tables Created
- **profiles** - User profiles with credit balance and subscription tier
- **jobs** - Job processing records with status tracking
- **credit_transactions** - Credit transaction history

### Functions Created
- **deduct_credits(user_id, amount, job_id)** - Deduct credits and record transaction
- **refund_credits(user_id, amount, job_id)** - Refund credits and record transaction

### Security Features
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Users can only access their own data
- ✅ Service role can update jobs for n8n webhooks
- ✅ Credit functions use SECURITY DEFINER for atomic operations

### Performance Optimizations
- ✅ Indexes on job queries (user_id, status, created_at)
- ✅ Indexes on transaction queries (user_id, created_at)
- ✅ Automatic timestamp updates via triggers

## Rollback (If Needed)

```sql
-- Drop all tables (CAUTION: This deletes all data)
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS deduct_credits;
DROP FUNCTION IF EXISTS refund_credits;
DROP FUNCTION IF EXISTS update_updated_at;
```

## Next Steps
After database deployment:
1. Configure storage buckets (see 02-storage-setup.md)
2. Deploy n8n workflows (see 03-n8n-deployment.md)
3. Configure environment variables (see .env.production.template)
