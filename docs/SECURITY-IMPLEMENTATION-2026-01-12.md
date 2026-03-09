# SwiftList Security Implementation - Military-Grade Payment Protection

**Date**: January 12, 2026
**Priority**: P0 - MUST IMPLEMENT BEFORE ACCEPTING PAYMENTS
**Source**: Security discussion with Rick Burk

---

## 🔐 Critical Security Requirements (PRE-LAUNCH)

### 1. Stripe Webhook Security (MILITARY-GRADE)

**Problem**: Standard `/api/stripe/webhook` paths are scanned by bots. Anyone can send fake payment webhooks to get free credits.

**Solution**: Multi-layered security with randomized endpoints

#### Implementation Requirements:

**A. Randomized Webhook URL**
```
❌ BAD:  /api/stripe/webhook
✅ GOOD: /api/webhooks/stripe-5f8a9c2d4e6b1a3f7890abcd
```

- Generate random 24+ character string
- Use cryptographically secure random generator
- Store in environment variable: `STRIPE_WEBHOOK_PATH`
- NEVER commit to git
- Rotate every 90 days

**B. HMAC Signature Verification (MANDATORY)**
```typescript
// apps/swiftlist-app-svelte/src/routes/api/webhooks/[random-string]/+server.ts
import Stripe from 'stripe';
import { error } from '@sveltejs/kit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST({ request }) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    throw error(401, 'Missing signature');
  }

  let event;
  try {
    // ✅ CRITICAL: Verify signature with Stripe's SDK
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    throw error(400, `Webhook Error: ${err.message}`);
  }

  // Now safe to process event
  switch (event.type) {
    case 'checkout.session.completed':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

**C. IP Whitelist (Stripe Servers Only)**
```typescript
// Stripe webhook IPs (verify current list at https://stripe.com/docs/ips)
const STRIPE_WEBHOOK_IPS = [
  '3.18.12.63',
  '3.130.192.231',
  '13.235.14.237',
  '13.235.122.149',
  // ... full list from Stripe docs
];

function verifyStripeIP(request: Request): boolean {
  const clientIP = request.headers.get('cf-connecting-ip') ||
                   request.headers.get('x-forwarded-for')?.split(',')[0];

  if (!clientIP || !STRIPE_WEBHOOK_IPS.includes(clientIP)) {
    console.error(`⚠️ Webhook from unauthorized IP: ${clientIP}`);
    return false;
  }
  return true;
}
```

**D. Idempotency Keys (Prevent Replay Attacks)**
```typescript
// Store processed event IDs in database
const processedEvents = new Set(); // In production: use Redis or database

async function handleWebhook(event: Stripe.Event) {
  // Check if event already processed
  const eventId = event.id;

  if (await isEventProcessed(eventId)) {
    console.log(`ℹ️ Event ${eventId} already processed (idempotent)`);
    return { received: true, duplicate: true };
  }

  // Process event
  await processPayment(event);

  // Mark as processed
  await markEventProcessed(eventId);

  return { received: true };
}
```

**E. Timestamp Validation (Prevent Replay Attacks)**
```typescript
function validateWebhookTimestamp(event: Stripe.Event): boolean {
  const eventTime = event.created * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (currentTime - eventTime > maxAge) {
    console.error(`⚠️ Webhook too old: ${(currentTime - eventTime) / 1000}s`);
    return false;
  }
  return true;
}
```

---

### 2. n8n Webhook Security (IF USED - OR ELIMINATE PER BOARD DECISION)

**Problem**: n8n webhooks can be discovered and abused to trigger free jobs.

**Solution**: HMAC signature verification + randomized URLs

#### Implementation:

**A. Generate Webhook Secret**
```bash
openssl rand -hex 32
# Output: 5f8a9c2d4e6b1a3f7890abcd1234567890abcdef1234567890abcdef12345678
```

Store in `.env.production`:
```bash
N8N_WEBHOOK_SECRET=5f8a9c2d4e6b1a3f7890abcd1234567890abcdef1234567890abcdef12345678
N8N_WEBHOOK_URL=https://[instance].app.n8n.cloud/webhook/swiftlist-job-5f8a9c2d
```

**B. Sign Outgoing Requests (SwiftList → n8n)**
```typescript
import crypto from 'crypto';

function generateHMAC(payload: any, secret: string): string {
  const data = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

// When calling n8n webhook
const payload = { job_id: 'abc123', user_id: 'user-xyz' };
const signature = generateHMAC(payload, process.env.N8N_WEBHOOK_SECRET!);

await fetch(process.env.N8N_WEBHOOK_URL!, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-SwiftList-Signature': signature,
    'X-SwiftList-Timestamp': Date.now().toString(),
  },
  body: JSON.stringify(payload),
});
```

**C. Verify Signatures in n8n Workflow**
```javascript
// n8n HTTP Request node - "Verify Signature" step
const incomingSignature = $headers['x-swiftlist-signature'];
const timestamp = parseInt($headers['x-swiftlist-timestamp']);
const secret = '[YOUR_N8N_WEBHOOK_SECRET]'; // Store in n8n credentials

// Verify timestamp (prevent replay attacks)
if (Date.now() - timestamp > 300000) { // 5 minutes
  throw new Error('Webhook expired');
}

// Compute expected signature
const crypto = require('crypto');
const payload = JSON.stringify($json);
const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (incomingSignature !== expectedSignature) {
  throw new Error('Invalid signature');
}

// Signature valid - proceed
```

---

### 3. API Route Security (ALL ENDPOINTS)

**A. Rate Limiting**
```typescript
// apps/swiftlist-app-svelte/src/hooks.server.ts
import { ratelimit } from '@/lib/ratelimit';

export async function handle({ event, resolve }) {
  const ip = event.request.headers.get('cf-connecting-ip') ||
             event.request.headers.get('x-forwarded-for')?.split(',')[0] ||
             'unknown';

  // Different limits for different routes
  if (event.url.pathname.startsWith('/api/jobs')) {
    const { success } = await ratelimit.limit(`jobs:${ip}`, 10, '1m'); // 10 req/min
    if (!success) {
      return new Response('Too many requests', { status: 429 });
    }
  }

  if (event.url.pathname.startsWith('/api/auth')) {
    const { success } = await ratelimit.limit(`auth:${ip}`, 5, '5m'); // 5 req/5min
    if (!success) {
      return new Response('Too many requests', { status: 429 });
    }
  }

  return resolve(event);
}
```

**B. Authentication Middleware**
```typescript
// EVERY API route must verify auth
export async function POST({ request, locals }) {
  // ✅ MANDATORY: Verify user is authenticated
  const supabase = locals.supabase;
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401 }
    );
  }

  // User verified - proceed
}
```

---

### 4. Environment Variable Security

**✅ GOOD: Current .gitignore**
```gitignore
.env
.env.local
.env.*.local
.env.production
.env.development
```

**❌ NEVER DO THIS:**
- Commit `.env` files
- Hardcode API keys in code
- Share credentials in Slack/Discord
- Use default webhook paths like `/api/stripe/webhook`

**✅ DO THIS:**
- Use environment variables for ALL secrets
- Rotate secrets every 90 days
- Use different secrets for dev/staging/production
- Use randomized webhook URLs (24+ characters)
- Store production secrets in 1Password/Vault

---

### 5. Database Security (RLS)

**✅ ALREADY IMPLEMENTED:**
- All tables have RLS enabled
- Deny-by-default policies
- Users can only access their own data
- Server-side credit deduction functions

**⚠️ CRITICAL: Never Trust Client**
```typescript
// ❌ BAD: Client specifies credits to deduct
const { credits } = await request.json();
await deductCredits(user.id, credits, job.id);

// ✅ GOOD: Server determines credits based on workflow
const WORKFLOW_COSTS = {
  'background-removal': 5,
  'jewelry-engine': 15,
};
const credits = WORKFLOW_COSTS[workflow_id];
await deductCredits(user.id, credits, job.id);
```

---

## 🚨 Pre-Launch Security Checklist

Before accepting ANY payments:

- [ ] Stripe webhook uses randomized URL (not `/api/stripe/webhook`)
- [ ] HMAC signature verification enabled
- [ ] IP whitelist configured for Stripe webhooks
- [ ] Idempotency keys implemented (prevent duplicate charges)
- [ ] Timestamp validation active (prevent replay attacks)
- [ ] Rate limiting enabled on all public endpoints
- [ ] All API routes verify authentication
- [ ] Credit costs defined SERVER-SIDE only
- [ ] n8n webhooks use HMAC signatures (if not eliminated)
- [ ] `.env.production` is gitignored
- [ ] No secrets in git history (`git log --all -- "*.env*"`)
- [ ] RLS policies tested (unauthenticated users get 0 rows)

---

## 📋 Security Testing Protocol

### Test 1: Fake Payment Attack
```bash
# Attacker tries to send fake Stripe webhook
curl -X POST https://swiftlist.com/api/webhooks/stripe-5f8a9c2d4e6b1a3f \
  -H "Content-Type: application/json" \
  -d '{"type": "checkout.session.completed", "data": {"object": {"amount_total": 2900}}}'

# Expected: 400 Bad Request (signature verification failed)
```

### Test 2: Replay Attack
```bash
# Attacker intercepts legitimate webhook and resends it 10 minutes later
# Expected: Rejected (timestamp too old OR idempotency key already used)
```

### Test 3: Direct Database Access
```bash
# Attacker tries to read other users' jobs via Supabase client
# Expected: RLS blocks query, returns 0 rows
```

---

## 🔗 References

- **Stripe Webhook Security**: https://stripe.com/docs/webhooks/signatures
- **Stripe IP Addresses**: https://stripe.com/docs/ips
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Supabase RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security

---

**Status**: 🔴 NOT YET IMPLEMENTED - REQUIRED BEFORE MVP LAUNCH
**Owner**: Development Team
**Review Date**: Before first payment accepted

**CRITICAL**: This is not optional. Implementing these security measures is MANDATORY before accepting any payments or going live.
