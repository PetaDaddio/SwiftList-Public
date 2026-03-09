# SwiftList Security Penetration Tests
**Date**: 2026-01-16
**Purpose**: Verify all 6 critical vulnerabilities are fixed

---

## How to Run These Tests

1. **Deploy Security Fixes First**:
   - Run `/supabase-schema-secure-2026-01-16.sql` in Supabase SQL Editor
   - Run `/supabase-storage-policies-secure.sql` in Supabase SQL Editor

2. **Create Two Test Users**:
   - User A (Attacker): Sign up at http://localhost:5173/auth/signup
   - User B (Victim): Sign up at http://localhost:5173/auth/signup
   - Note both user IDs (check Supabase Auth dashboard)

3. **Run Tests in Browser Console**:
   - Log in as User A
   - Open browser console (F12)
   - Copy-paste each test script
   - **Expected Result**: All attacks should FAIL with authorization errors

---

## Test #1: RLS Bypass Attack (Vuln #1)

**Objective**: Verify User A cannot update User B's job

```javascript
// ❌ ATTACK: Try to mark victim's job as completed
const VICTIM_USER_ID = 'USER_B_UUID_HERE';  // Replace with actual User B UUID

const { data, error } = await supabase
  .from('jobs')
  .update({
    status: 'completed',
    outputs: { malicious: 'hacked' }
  })
  .eq('user_id', VICTIM_USER_ID);

// ✅ EXPECTED: error is NOT null
// ✅ EXPECTED: error message contains "policy" or "permission denied"
console.log('RLS Bypass Test:');
console.log('Error:', error);
console.log('Data:', data);

if (error && error.message.includes('policy')) {
  console.log('✅ PASS: RLS correctly blocked unauthorized update');
} else if (data && data.length > 0) {
  console.log('🚨 FAIL: Attack succeeded! User updated victim\'s job');
} else {
  console.log('⚠️ UNKNOWN: Check error message');
}
```

**Pass Criteria**:
- `error` is NOT null
- `data` is null or empty array
- Error message mentions "policy" or "permission denied"

---

## Test #2: Credit Manipulation Attack (Vuln #2)

**Objective**: Verify User A cannot deduct credits from User B's account

```javascript
// ❌ ATTACK: Try to drain victim's credits
const VICTIM_USER_ID = 'USER_B_UUID_HERE';  // Replace with actual User B UUID

try {
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: VICTIM_USER_ID,
    p_amount: 10000,
    p_job_id: crypto.randomUUID()
  });

  // 🚨 FAIL: Attack succeeded
  console.log('🚨 FAIL: Successfully deducted victim\'s credits', data);
} catch (err) {
  // ✅ PASS: Exception thrown
  console.log('✅ PASS: Function blocked unauthorized access');
  console.log('Error:', err.message);

  if (err.message.includes('Unauthorized')) {
    console.log('✅ PASS: Correct error message');
  } else {
    console.log('⚠️ WARNING: Unexpected error message');
  }
}
```

**Pass Criteria**:
- Function throws exception
- Error message contains "Unauthorized"
- Victim's credit balance unchanged (verify in Supabase dashboard)

---

## Test #3: Storage Access Attack (Vuln #4)

**Objective**: Verify User A cannot access User B's uploaded files

```javascript
// ❌ ATTACK: Try to download victim's upload
const VICTIM_USER_ID = 'USER_B_UUID_HERE';  // Replace with actual User B UUID

// First, have User B upload a test file:
// const { data: uploadData } = await supabase.storage
//   .from('user-uploads')
//   .upload(`${USER_B_UUID}/test.jpg`, fileBlob);

// Then, as User A, try to download it:
const { data, error } = await supabase.storage
  .from('user-uploads')
  .download(`${VICTIM_USER_ID}/test.jpg`);

console.log('Storage Access Test:');
console.log('Error:', error);
console.log('Data:', data);

if (error && (error.statusCode === 403 || error.message.includes('policy'))) {
  console.log('✅ PASS: Storage RLS blocked unauthorized access');
} else if (data) {
  console.log('🚨 FAIL: Attack succeeded! Downloaded victim\'s file');
} else {
  console.log('⚠️ UNKNOWN: Check error details');
}
```

**Pass Criteria**:
- `error` is NOT null
- `error.statusCode` is 403 (Forbidden)
- `data` is null
- File was not downloaded

---

## Test #4: Direct Credit Transaction Insert (Vuln #6)

**Objective**: Verify users cannot directly insert fake transactions

```javascript
// ❌ ATTACK: Try to insert fake credit transaction
const { data, error } = await supabase
  .from('credit_transactions')
  .insert({
    user_id: await supabase.auth.getUser().then(r => r.data.user.id),
    amount: 1000000,  // Give myself infinite credits
    transaction_type: 'bonus',
    job_id: null
  });

console.log('Direct Insert Test:');
console.log('Error:', error);
console.log('Data:', data);

if (error && error.message.includes('policy')) {
  console.log('✅ PASS: RLS blocked direct transaction insert');
} else if (data) {
  console.log('🚨 FAIL: Attack succeeded! Inserted fake transaction');
} else {
  console.log('⚠️ UNKNOWN: Check error message');
}
```

**Pass Criteria**:
- `error` is NOT null
- `data` is null
- Error mentions "policy" or "permission denied"
- No new transaction appears in database

---

## Test #5: Profile Credit Balance Manipulation

**Objective**: Verify users cannot directly modify their own credit balance

```javascript
// ❌ ATTACK: Try to give myself infinite credits
const currentUser = await supabase.auth.getUser();

const { data, error } = await supabase
  .from('profiles')
  .update({
    credits_balance: 999999  // Set to 1 million credits
  })
  .eq('user_id', currentUser.data.user.id);

console.log('Profile Update Test:');
console.log('Error:', error);
console.log('Data:', data);

if (error && error.message.includes('policy')) {
  console.log('✅ PASS: RLS prevented credit balance modification');
} else if (data && data.length > 0) {
  console.log('🚨 FAIL: Attack succeeded! Modified credit balance');
} else {
  console.log('⚠️ UNKNOWN: Check error details');
}
```

**Pass Criteria**:
- `error` is NOT null
- `data` is null or empty
- Credit balance unchanged in database

---

## Test #6: Job Deletion Attempt (Vuln #3)

**Objective**: Verify DELETE policies prevent data loss

```javascript
// ❌ ATTACK: Try to delete own job
const currentUser = await supabase.auth.getUser();

// First create a test job
const { data: jobData } = await supabase
  .from('jobs')
  .insert({
    user_id: currentUser.data.user.id,
    workflow_id: 'test-workflow',
    original_image_url: 'https://example.com/test.jpg',
    status: 'pending',
    credits_charged: 10
  })
  .select()
  .single();

// Try to delete it
const { data, error } = await supabase
  .from('jobs')
  .delete()
  .eq('job_id', jobData.job_id);

console.log('Job Deletion Test:');
console.log('Error:', error);
console.log('Data:', data);

if (error && error.message.includes('policy')) {
  console.log('✅ PASS: DELETE policy prevented job deletion');
} else if (data) {
  console.log('🚨 FAIL: Job was deleted (should be soft delete only)');
} else {
  console.log('⚠️ UNKNOWN: Check error details');
}
```

**Pass Criteria**:
- `error` is NOT null
- Job still exists in database
- Error mentions "policy"

---

## Test #7: Service Role Operations (Legitimate)

**Objective**: Verify service role CAN perform authorized operations

**NOTE**: This test must be run from an API route (backend), not browser console

```typescript
// File: /src/routes/api/test-service-role/+server.ts
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  // Create admin client with service role key
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Test: Service role CAN update job status
    const { data: jobData } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .limit(1)
      .single();

    if (!jobData) {
      return json({ error: 'No jobs found for testing' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .update({ status: 'processing' })
      .eq('job_id', jobData.job_id);

    if (error) {
      return json({
        status: '🚨 FAIL',
        message: 'Service role could not update job',
        error
      });
    }

    return json({
      status: '✅ PASS',
      message: 'Service role successfully updated job',
      data
    });
  } catch (err) {
    return json({
      status: '🚨 FAIL',
      message: 'Exception thrown',
      error: err.message
    });
  }
}
```

**Pass Criteria**:
- No error thrown
- Job status updated successfully
- Confirms service role (n8n webhooks) can operate

---

## Summary Report Template

After running all tests, fill out this report:

```
SWIFTLIST PENETRATION TEST REPORT
Date: YYYY-MM-DD
Tester: [Your Name]

TEST RESULTS:
✅ Test #1 (RLS Bypass): PASS / FAIL
✅ Test #2 (Credit Manipulation): PASS / FAIL
✅ Test #3 (Storage Access): PASS / FAIL
✅ Test #4 (Direct Transaction Insert): PASS / FAIL
✅ Test #5 (Credit Balance Manipulation): PASS / FAIL
✅ Test #6 (Job Deletion): PASS / FAIL
✅ Test #7 (Service Role Operations): PASS / FAIL

CRITICAL VULNERABILITIES FIXED: 6 / 6

DEPLOYMENT STATUS:
[ ] Schema deployed: supabase-schema-secure-2026-01-16.sql
[ ] Storage policies deployed: supabase-storage-policies-secure.sql
[ ] All tests passed
[ ] Ready for production deployment

NEXT STEPS:
1. [ ] Deploy to production Supabase
2. [ ] Update API routes to use service role client for webhooks
3. [ ] Implement P0 agentic AI security (preset scanning, PII scrubbing)
4. [ ] Re-run tests on production environment
```

---

**IMPORTANT**: Do NOT deploy to production until ALL tests PASS.

*End of Penetration Tests*
