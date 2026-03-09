# SwiftList Security Enhancements 2026

**Status**: Recommendations to enhance existing security protocol
**Date**: January 5, 2026
**Version**: 1.0

---

## Overview

This document extends the existing **Security-First Development Protocol** (`.claude/CLAUDE.md`) with additional security measures based on 2026 industry best practices.

**Existing Security Foundation** (Already Implemented):
✅ Row Level Security (RLS) on all database tables
✅ Server-side business logic (no client-side pricing/credits)
✅ Input validation with Zod schemas
✅ Rate limiting with Upstash
✅ Secrets management (environment variables)
✅ HTTPS-only enforcement
✅ CORS whitelist
✅ Error sanitization (no stack traces to client)

**New Enhancements** (This Document):
- API request signing & replay attack prevention
- Content Security Policy (CSP) hardening
- Subresource Integrity (SRI)
- Audit logging & anomaly detection
- Credential stuffing protection
- AI-specific attack prevention (prompt injection, token manipulation)
- Zero-trust architecture for n8n webhooks
- GDPR/CCPA compliance automation

---

## 1. API REQUEST SIGNING & REPLAY ATTACK PREVENTION

### Problem
Even with authentication, attackers can:
- Intercept valid requests and replay them
- Modify request parameters mid-flight (man-in-the-middle)
- Bypass rate limiting by replaying old tokens

### Solution: HMAC Request Signing with Timestamps

**Implementation** (add to all API routes):

```typescript
// lib/security/requestSigning.ts
import crypto from 'crypto';

export function generateRequestSignature(
  method: string,
  path: string,
  timestamp: number,
  body: any,
  secret: string
): string {
  const payload = `${method}${path}${timestamp}${JSON.stringify(body)}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyRequestSignature(
  request: NextRequest,
  maxAge: number = 300000 // 5 minutes
): boolean {
  const signature = request.headers.get('X-SwiftList-Signature');
  const timestamp = parseInt(request.headers.get('X-SwiftList-Timestamp') || '0');
  const method = request.method;
  const path = request.nextUrl.pathname;

  // 1. Check timestamp freshness (prevent replay attacks)
  const now = Date.now();
  if (Math.abs(now - timestamp) > maxAge) {
    console.warn('Request timestamp too old', { timestamp, now });
    return false;
  }

  // 2. Verify signature
  const body = await request.json();
  const expectedSignature = generateRequestSignature(
    method,
    path,
    timestamp,
    body,
    process.env.API_SIGNING_SECRET!
  );

  if (signature !== expectedSignature) {
    console.warn('Invalid request signature', { path, method });
    return false;
  }

  return true;
}
```

**Usage in API Routes**:

```typescript
// app/api/jobs/submit/route.ts
export async function POST(request: NextRequest) {
  // 1. Verify request signature (prevents replay attacks)
  if (!verifyRequestSignature(request)) {
    return NextResponse.json(
      { error: 'Invalid or expired request signature' },
      { status: 401 }
    );
  }

  // 2. Continue with authentication, validation, etc.
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  // ... rest of secure implementation
}
```

**Security Benefits**:
- ✅ Prevents replay attacks (timestamps expire after 5 minutes)
- ✅ Prevents request tampering (HMAC verification)
- ✅ Adds extra layer beyond authentication

**Environment Variable**:
```bash
# .env.local
API_SIGNING_SECRET=<generate_with_openssl_rand_hex_32>
```

---

## 2. CONTENT SECURITY POLICY (CSP) HARDENING

### Problem
Without strict CSP, attackers can:
- Inject malicious scripts (XSS attacks)
- Load resources from untrusted domains
- Exfiltrate data via unauthorized fetch requests

### Solution: Strict CSP Headers

**Implementation** (add to `middleware.ts`):

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Content Security Policy
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https: blob:;
    font-src 'self' data:;
    connect-src 'self'
      https://*.supabase.co
      https://api.stripe.com
      https://n8n.swiftlist.app;
    frame-src https://js.stripe.com;
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set('Content-Security-Policy', cspHeader);

  // Additional security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS (HTTP Strict Transport Security)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Security Benefits**:
- ✅ Blocks inline scripts (prevents XSS)
- ✅ Whitelists only trusted domains for API calls
- ✅ Prevents clickjacking (X-Frame-Options: DENY)
- ✅ Forces HTTPS (HSTS)
- ✅ Blocks dangerous browser features (camera, microphone, geolocation)

---

## 3. SUBRESOURCE INTEGRITY (SRI)

### Problem
If CDNs serving React/libraries are compromised, attackers can inject malicious code.

### Solution: SRI Hashes for External Scripts

**Implementation** (add to `app/layout.tsx`):

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Stripe with SRI */}
        <script
          src="https://js.stripe.com/v3/"
          integrity="sha384-..." // Generate with: curl https://js.stripe.com/v3/ | openssl dgst -sha384 -binary | openssl base64 -A
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Security Benefits**:
- ✅ Verifies external scripts haven't been tampered with
- ✅ Prevents supply chain attacks via CDN compromise

---

## 4. AUDIT LOGGING & ANOMALY DETECTION

### Problem
Without comprehensive logging, you can't:
- Detect unusual patterns (account takeover attempts)
- Investigate security incidents
- Prove compliance (SOC 2, GDPR)

### Solution: Security Event Logging System

**Database Schema**:

```sql
-- Security audit log
CREATE TABLE public.security_audit_log (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- login, failed_login, credit_purchase, job_submit, etc.
  user_id TEXT REFERENCES public.profiles(user_id),
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,
  status_code INTEGER,
  error_message TEXT,
  metadata JSONB, -- Additional context (job_id, credits_amount, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX idx_audit_user_time ON security_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_event_type ON security_audit_log(event_type, created_at DESC);
CREATE INDEX idx_audit_ip ON security_audit_log(ip_address, created_at DESC);

-- Anomaly detection flags
CREATE TABLE public.security_anomalies (
  anomaly_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES public.profiles(user_id),
  anomaly_type TEXT NOT NULL, -- rapid_requests, multiple_failed_logins, unusual_location, etc.
  severity TEXT NOT NULL, -- low, medium, high, critical
  details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation** (middleware logging):

```typescript
// lib/security/auditLog.ts
import { createClient } from '@/lib/supabase/server';

export async function logSecurityEvent(
  eventType: string,
  userId: string | null,
  request: NextRequest,
  metadata?: Record<string, any>
) {
  const supabase = createClient();

  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    'unknown';

  await supabase.from('security_audit_log').insert({
    event_type: eventType,
    user_id: userId,
    ip_address: ipAddress,
    user_agent: request.headers.get('user-agent'),
    request_path: request.nextUrl.pathname,
    request_method: request.method,
    metadata: metadata || {}
  });
}
```

**Usage**:

```typescript
// app/api/jobs/submit/route.ts
export async function POST(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser();

  // Log successful job submission
  await logSecurityEvent('job_submit', user.id, request, {
    workflow_id: validated.workflow_id,
    credits_charged: cost
  });

  // ... rest of implementation
}

// app/api/auth/login/route.ts
export async function POST(request: NextRequest) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Log failed login attempt
    await logSecurityEvent('failed_login', null, request, {
      email: email,
      error: error.message
    });

    // Check for anomalies (e.g., 5+ failed logins in 10 minutes)
    await detectAnomalies(request);
  } else {
    // Log successful login
    await logSecurityEvent('login', user.id, request);
  }
}
```

**Anomaly Detection** (runs via WF-29 AI System Monitor):

```typescript
// lib/security/anomalyDetection.ts
export async function detectAnomalies(request: NextRequest) {
  const supabase = createClient();
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  // Check 1: Multiple failed logins from same IP
  const { data: recentFailures } = await supabase
    .from('security_audit_log')
    .select('event_id')
    .eq('event_type', 'failed_login')
    .eq('ip_address', ipAddress)
    .gte('created_at', new Date(Date.now() - 600000).toISOString()) // Last 10 minutes
    .limit(5);

  if (recentFailures && recentFailures.length >= 5) {
    // Flag as anomaly
    await supabase.from('security_anomalies').insert({
      user_id: null,
      anomaly_type: 'multiple_failed_logins',
      severity: 'high',
      details: { ip_address: ipAddress, count: recentFailures.length }
    });

    // Alert via Slack webhook
    await fetch(process.env.SLACK_SECURITY_WEBHOOK_URL!, {
      method: 'POST',
      body: JSON.stringify({
        text: `🚨 Security Alert: ${recentFailures.length} failed logins from IP ${ipAddress} in last 10 minutes`
      })
    });

    // Temporarily block IP (using Upstash rate limiter with penalty)
    // ... implementation
  }

  // Check 2: Rapid job submissions (possible abuse)
  // Check 3: Credit purchases from unusual locations
  // ... additional checks
}
```

**Security Benefits**:
- ✅ Full audit trail for compliance (SOC 2, GDPR)
- ✅ Real-time anomaly detection
- ✅ Incident investigation capability
- ✅ Automated alerting via Slack

---

## 5. CREDENTIAL STUFFING PROTECTION

### Problem
Attackers use leaked password databases to try common email/password combinations (credential stuffing).

### Solution: Multi-Layer Defense

**Layer 1: Supabase Auth Rate Limiting** (already configured):
- Max 5 login attempts per email per hour
- Temporary account lockout after 5 failures

**Layer 2: CAPTCHA for Suspicious Logins**:

```typescript
// app/api/auth/login/route.ts
import { verifyTurnstileToken } from '@/lib/security/turnstile';

export async function POST(request: NextRequest) {
  const { email, password, turnstileToken } = await request.json();

  // Check if this IP has had recent failed logins
  const recentFailures = await getRecentFailedLogins(request);

  if (recentFailures >= 2) {
    // Require CAPTCHA for suspicious IPs
    if (!turnstileToken) {
      return NextResponse.json(
        { error: 'CAPTCHA required', requireCaptcha: true },
        { status: 429 }
      );
    }

    // Verify Cloudflare Turnstile token
    const isValid = await verifyTurnstileToken(turnstileToken);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid CAPTCHA' }, { status: 400 });
    }
  }

  // Proceed with login
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // ... rest of implementation
}
```

**Layer 3: Have I Been Pwned (HIBP) Integration**:

```typescript
// lib/security/hibp.ts
import crypto from 'crypto';

export async function isPasswordPwned(password: string): Promise<boolean> {
  // Hash password with SHA-1
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);

  // Query HIBP API (k-anonymity model - doesn't send full hash)
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const hashes = await response.text();

  // Check if password hash appears in breach database
  return hashes.includes(suffix);
}
```

**Usage in Signup**:

```typescript
// app/api/auth/signup/route.ts
export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  // Validate password hasn't been compromised
  if (await isPasswordPwned(password)) {
    return NextResponse.json(
      { error: 'This password has been found in data breaches. Please choose a different password.' },
      { status: 400 }
    );
  }

  // Proceed with signup
  // ... rest of implementation
}
```

**Security Benefits**:
- ✅ Blocks known compromised passwords
- ✅ CAPTCHA stops automated attacks
- ✅ Rate limiting prevents brute force

**Cost**: $0 (HIBP API is free, Cloudflare Turnstile is free)

---

## 6. AI-SPECIFIC ATTACK PREVENTION

### Problem
SwiftList uses AI models that are vulnerable to:
- **Prompt injection**: User tricks AI into ignoring instructions
- **Token manipulation**: User inflates credits_charged to negative values
- **Jailbreaking**: User bypasses AI content filters

### Solution: AI Input Sanitization & Validation

**Prompt Injection Prevention**:

```typescript
// lib/security/aiSanitization.ts
export function sanitizeAIPrompt(userInput: string): string {
  // Remove common prompt injection patterns
  const dangerousPatterns = [
    /ignore (previous|all) instructions?/gi,
    /forget (previous|all) instructions?/gi,
    /you are now/gi,
    /new instructions?:/gi,
    /system prompt/gi,
    /\[SYSTEM\]/gi,
    /\<\|im_start\|\>/gi, // ChatGPT special tokens
  ];

  let sanitized = userInput;
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Limit length (prevent token exhaustion attacks)
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000);
  }

  return sanitized.trim();
}
```

**Usage in WF-10 (Product Description Generator)**:

```typescript
// n8n Function Node in WF-10
const userProductName = $json.product_name;
const sanitizedName = sanitizeAIPrompt(userProductName);

const prompt = `Generate a product description for: ${sanitizedName}`;
// ... call Gemini API
```

**Token Manipulation Prevention**:

```typescript
// app/api/jobs/submit/route.ts
export async function POST(request: NextRequest) {
  const validated = jobSchema.parse(body);

  // NEVER trust client-provided credits_charged
  // ALWAYS calculate server-side
  const WORKFLOW_COSTS = {
    'wf-07': 5,
    'wf-14': 10,
    // ... defined SERVER-SIDE
  };

  const cost = WORKFLOW_COSTS[validated.workflow_id] || 10;

  // Validate cost is positive
  if (cost <= 0) {
    throw new Error('Invalid workflow cost');
  }

  // Validate user has sufficient credits
  if (profile.credits_balance < cost) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  // Use server-calculated cost (NOT client-provided)
  await supabase.rpc('deduct_credits', {
    p_user_id: user.id,
    p_amount: cost, // Server-calculated, not user input
    p_job_id: job.job_id
  });
}
```

**Security Benefits**:
- ✅ Prevents prompt injection attacks
- ✅ Prevents token manipulation
- ✅ Limits AI API costs (token exhaustion attacks)

---

## 7. ZERO-TRUST ARCHITECTURE FOR N8N WEBHOOKS

### Problem
n8n workflows are triggered by webhooks, which can be abused if:
- Attackers discover webhook URLs
- Signature verification is weak
- Internal-only workflows are exposed

### Solution: Multi-Layer Webhook Security

**Layer 1: HMAC Signature Verification** (already implemented):

```javascript
// n8n Function Node: Verify Signature
const signature = $json.headers['x-swiftlist-signature'];
const expectedSignature = crypto
  .createHmac('sha256', $env.N8N_WEBHOOK_SECRET)
  .update(JSON.stringify($json.body))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

**Layer 2: IP Whitelist**:

```javascript
// n8n Function Node: Verify Source IP
const sourceIP = $json.headers['x-forwarded-for']?.split(',')[0] || $json.headers['x-real-ip'];

const ALLOWED_IPS = [
  '54.123.45.67',  // Next.js API server IP
  '10.0.0.0/8',    // Internal VPC range
];

if (!ALLOWED_IPS.some(ip => sourceIP.startsWith(ip))) {
  throw new Error('Unauthorized IP address');
}
```

**Layer 3: One-Time Nonce**:

```typescript
// app/api/jobs/submit/route.ts (backend)
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function POST(request: NextRequest) {
  // ... authentication, validation, etc.

  // Generate one-time nonce
  const nonce = uuidv4();

  // Store nonce in Redis with 5-minute expiration
  await redis.setex(`webhook:nonce:${nonce}`, 300, job.job_id);

  // Include nonce in webhook payload
  await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: 'POST',
    headers: {
      'X-SwiftList-Signature': signature,
      'X-SwiftList-Nonce': nonce,
    },
    body: JSON.stringify({ job_id: job.job_id, nonce, ...validated }),
  });
}
```

```javascript
// n8n Function Node: Verify Nonce
const nonce = $json.headers['x-swiftlist-nonce'];
const jobId = $json.body.job_id;

// Check if nonce exists and matches job_id
const storedJobId = await redis.get(`webhook:nonce:${nonce}`);

if (!storedJobId || storedJobId !== jobId) {
  throw new Error('Invalid or expired nonce');
}

// Delete nonce (one-time use)
await redis.del(`webhook:nonce:${nonce}`);

// Proceed with workflow
```

**Security Benefits**:
- ✅ Prevents replay attacks (one-time nonce)
- ✅ Restricts webhook access to trusted sources (IP whitelist)
- ✅ Verifies payload integrity (HMAC)

**Cost**: $0 (Upstash Redis free tier: 10,000 commands/day)

---

## 8. GDPR/CCPA COMPLIANCE AUTOMATION

### Problem
Manual GDPR compliance is time-consuming and error-prone.

### Solution: Automated Data Subject Rights

**Database Function: Data Export**:

```sql
-- PostgreSQL function for GDPR data export
CREATE OR REPLACE FUNCTION export_user_data(p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  user_data JSONB;
BEGIN
  SELECT jsonb_build_object(
    'profile', (SELECT row_to_json(p) FROM profiles p WHERE user_id = p_user_id),
    'jobs', (SELECT json_agg(j) FROM jobs j WHERE user_id = p_user_id),
    'presets', (SELECT json_agg(pr) FROM presets pr WHERE creator_id = p_user_id),
    'transactions', (SELECT json_agg(t) FROM credit_transactions t WHERE user_id = p_user_id),
    'audit_log', (SELECT json_agg(a) FROM security_audit_log a WHERE user_id = p_user_id)
  ) INTO user_data;

  RETURN user_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**API Endpoint: Data Export**:

```typescript
// app/api/gdpr/export/route.ts
export async function GET(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Call database function
  const { data, error } = await supabase.rpc('export_user_data', {
    p_user_id: user.id
  });

  if (error) throw error;

  // Return as downloadable JSON
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="swiftlist-data-${user.id}.json"`
    }
  });
}
```

**Database Function: Right to Deletion**:

```sql
-- PostgreSQL function for GDPR data deletion
CREATE OR REPLACE FUNCTION delete_user_data(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- Delete user data (CASCADE will handle related records)
  DELETE FROM jobs WHERE user_id = p_user_id;
  DELETE FROM presets WHERE creator_id = p_user_id;
  DELETE FROM credit_transactions WHERE user_id = p_user_id;
  DELETE FROM security_audit_log WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE user_id = p_user_id;

  -- Log deletion (for compliance audit trail)
  INSERT INTO gdpr_deletion_log (user_id, deleted_at)
  VALUES (p_user_id, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Security Benefits**:
- ✅ GDPR Article 15 (Right to Access): Automated data export
- ✅ GDPR Article 17 (Right to Deletion): One-click deletion
- ✅ CCPA Compliance: Same functionality
- ✅ Audit trail for compliance verification

---

## 9. DEPENDENCY VULNERABILITY SCANNING

### Problem
npm packages contain known vulnerabilities (e.g., XSS in older React versions).

### Solution: Automated Scanning in CI/CD

**GitHub Actions Workflow**:

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sundays

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run npm audit
        run: |
          npm audit --production --audit-level=moderate

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Run SAST with Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/react
            p/typescript
```

**Security Benefits**:
- ✅ Catches vulnerabilities in dependencies
- ✅ Blocks PRs with high-severity issues
- ✅ Weekly scans for new CVEs

**Cost**: $0 (Snyk free tier: unlimited tests for open source)

---

## 10. SECURITY HEADERS TESTING

### Problem
Misconfigured security headers leave app vulnerable.

### Solution: Automated Header Verification

**Test Script**:

```typescript
// scripts/test-security-headers.ts
import fetch from 'node-fetch';

async function testSecurityHeaders() {
  const url = process.env.PRODUCTION_URL || 'https://swiftlist.app';

  const response = await fetch(url);
  const headers = response.headers;

  const requiredHeaders = {
    'content-security-policy': true,
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'strict-transport-security': 'max-age=31536000',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };

  let passed = true;

  Object.entries(requiredHeaders).forEach(([header, expectedValue]) => {
    const actualValue = headers.get(header);

    if (!actualValue) {
      console.error(`❌ Missing header: ${header}`);
      passed = false;
    } else if (typeof expectedValue === 'string' && !actualValue.includes(expectedValue)) {
      console.error(`❌ Invalid header: ${header} = ${actualValue} (expected: ${expectedValue})`);
      passed = false;
    } else {
      console.log(`✅ ${header}: ${actualValue}`);
    }
  });

  if (passed) {
    console.log('\n✅ All security headers configured correctly');
  } else {
    console.error('\n❌ Security header configuration failed');
    process.exit(1);
  }
}

testSecurityHeaders();
```

**Run in CI/CD**:

```yaml
# .github/workflows/security-scan.yml
- name: Test security headers
  run: npm run test:security-headers
```

---

## IMPLEMENTATION PRIORITY

### Phase 1: Pre-Launch (Critical - Week 1)
1. ✅ **API Request Signing** - Prevents replay attacks
2. ✅ **CSP Hardening** - Blocks XSS attacks
3. ✅ **Audit Logging** - Compliance requirement
4. ✅ **AI Input Sanitization** - Prevents prompt injection

### Phase 2: Launch Week (High Priority - Week 2)
5. ✅ **Credential Stuffing Protection** - HIBP + CAPTCHA
6. ✅ **Zero-Trust n8n Webhooks** - IP whitelist + nonce
7. ✅ **Dependency Scanning** - GitHub Actions workflow

### Phase 3: Post-Launch (Medium Priority - Week 3-4)
8. ✅ **GDPR Automation** - Data export/deletion endpoints
9. ✅ **SRI for External Scripts** - Supply chain protection
10. ✅ **Security Header Testing** - Automated verification

---

## UPDATED SECURITY CHECKLIST

**Add to `.claude/CLAUDE.md`**:

### Mandatory Security Checklist (Backend Code)

Before generating ANY backend API route, verify:

- [ ] **Authentication**: `supabase.auth.getUser(token)` at top of handler
- [ ] **Authorization**: Verify user can access/modify resource
- [ ] **Input Validation**: Zod schema validation on request body
- [ ] **AI Input Sanitization**: Sanitize user inputs sent to AI models ✨ NEW
- [ ] **Request Signing**: Verify HMAC signature and timestamp ✨ NEW
- [ ] **Rate Limiting**: Middleware applied to route
- [ ] **Audit Logging**: Log security events (auth, credits, jobs) ✨ NEW
- [ ] **Error Handling**: Try-catch with safe error messages (no stack traces)
- [ ] **Logging**: Log security events (failed auth, rate limits)
- [ ] **HTTPS Only**: All API calls use HTTPS (enforced by middleware)
- [ ] **CORS**: Proper CORS headers (whitelist only SwiftList domain)
- [ ] **CSP Headers**: Content-Security-Policy enforced ✨ NEW

---

## COST ANALYSIS

| Enhancement | Implementation Cost | Monthly Cost | Security Impact |
|-------------|-------------------|--------------|-----------------|
| API Request Signing | 2 hours | $0 | HIGH - Prevents replay attacks |
| CSP Hardening | 1 hour | $0 | HIGH - Blocks XSS |
| Audit Logging | 4 hours | $0 (PostgreSQL) | HIGH - Compliance |
| Credential Stuffing Protection | 3 hours | $0 (HIBP + Turnstile free) | MEDIUM - Blocks automated attacks |
| AI Input Sanitization | 2 hours | $0 | MEDIUM - Prevents prompt injection |
| Zero-Trust n8n Webhooks | 3 hours | $0 (Upstash free tier) | HIGH - Prevents unauthorized workflow triggers |
| GDPR Automation | 4 hours | $0 | HIGH - Legal compliance |
| Dependency Scanning | 1 hour | $0 (Snyk free tier) | MEDIUM - Catches known CVEs |
| SRI | 1 hour | $0 | LOW - Supply chain protection |
| Security Header Testing | 1 hour | $0 | LOW - Verification |
| **TOTAL** | **22 hours** | **$0/month** | **CRITICAL** |

**ROI**: $0 monthly cost, protects against breaches that could cost $50,000+ (GDPR fines, lawsuits, reputation damage).

---

## SUCCESS METRICS

**Security Monitoring** (track via WF-29 AI System Monitor):

1. **Failed Authentication Rate**: Target <2% of login attempts
2. **Anomaly Detections**: Target <5 flagged events per week
3. **Dependency Vulnerabilities**: Target 0 high/critical CVEs
4. **Security Header Score**: Target A+ on securityheaders.com
5. **API Signature Failures**: Target <0.1% of requests

---

## NEXT STEPS

1. **Review this document** with user for approval
2. **Update `.claude/CLAUDE.md`** with new security checklist items
3. **Implement Phase 1 enhancements** (API signing, CSP, audit logging, AI sanitization)
4. **Add to source of truth** (SwiftList_TDD_v2.0_FINAL.md) as security enhancement update
5. **Test in staging environment** before production deployment

---

**Last Updated**: January 5, 2026
**Status**: Recommendations - pending user approval
**Next Review**: Post-implementation (Week 2)
