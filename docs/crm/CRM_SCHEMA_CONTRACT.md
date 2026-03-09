# SwiftList CRM Schema Contract

**CRM Database**: `swiftlist-crm` (Supabase project `wtxhopdlumljkuhkbnzj`)
**Production Database**: `swiftlist-production` (Supabase project `YOUR_SUPABASE_PROJECT_REF`)
**Shared Key**: `email` (lowercase, trimmed, unique in contacts)

---

## Overview

The swiftlist-crm database is a smart CRM that replaces HubSpot. It's managed by Marketing Claude Code on a separate computer, with sync data pushed from this codebase (swiftlist-app-svelte).

**Who writes where:**
- **App Claude Code** (this repo) → writes to both databases
- **Marketing Claude Code** (other computer) → writes only to swiftlist-crm

---

## Existing CRM Tables (owned by Marketing Claude Code)

| Table | Purpose |
|-------|---------|
| `contacts` | Central contact record — identity, CRM fields, product activity |
| `waitlist` | Waitlist signups with UTM tracking and referral codes |
| `activities` | Event log (email opens, form submissions, status changes) |
| `email_sequences` | Drip campaign definitions |
| `email_sequence_steps` | Individual steps in drip campaigns |
| `contact_sequences` | Enrollment records linking contacts to sequences |
| `ccm_scores` | Concentric Circles Method scoring |
| `enrichment_log` | Data enrichment audit trail |
| `openform_submissions` | Form submission processing |

---

## Columns We Sync (App → CRM)

### `contacts` table — Production-linked columns

These columns are populated by the sync layer in `src/lib/crm/sync.ts`:

```
-- Identity linking (set on account creation)
swiftlist_user_id          UUID UNIQUE       -- production auth user ID
swiftlist_subscription_tier TEXT              -- 'free', 'pro', 'unlimited'
swiftlist_joined_at        TIMESTAMPTZ       -- when they created their account
display_name               TEXT              -- from production profile
avatar_url                 TEXT              -- from production profile
twitter_url                TEXT              -- full Twitter/X profile URL
instagram_url              TEXT              -- full Instagram profile URL
tiktok_url                 TEXT              -- full TikTok profile URL
website_url                TEXT              -- user's website or shop URL

-- Lifecycle (computed from product activity)
lifecycle_stage            TEXT DEFAULT 'lead'
  -- 'lead'    = waitlist signup, no account
  -- 'user'    = created account
  -- 'active'  = completed at least 1 job
  -- 'creator' = published at least 1 public vibe
  -- 'churned' = account deleted or inactive 90+ days

-- Product Activity Counters (synced by cron)
credits_balance            INTEGER DEFAULT 0
total_sparks_earned        INTEGER DEFAULT 0
total_sparks_spent         INTEGER DEFAULT 0
total_jobs_created         INTEGER DEFAULT 0
total_jobs_completed       INTEGER DEFAULT 0
total_jobs_failed          INTEGER DEFAULT 0
public_vibes_count         INTEGER DEFAULT 0
total_vibe_usage           INTEGER DEFAULT 0  -- sum of usage_count across public vibes

-- Timestamps
last_job_at                TIMESTAMPTZ
last_login_at              TIMESTAMPTZ
last_synced_at             TIMESTAMPTZ       -- when production last pushed data
```

### `waitlist` table — Written on /hello form submit

```
email, signup_source, utm_source, utm_medium, utm_campaign, status
```

### `activities` table — Event log entries

```
contact_id, activity_type, metadata (JSONB), created_at
```

---

## Sync Events

| Event | Trigger | What happens |
|-------|---------|-------------|
| **Waitlist signup** | `/hello` form → `POST /api/email-signup` | INSERT waitlist + UPSERT contacts (lead) + LOG `waitlist_signup` |
| **Account created** | Auth callback (`/auth/callback`) | UPSERT contacts (user, set swiftlist_user_id) + LOG `account_created` |
| **First job** | Job succeeded + total was 0 | UPDATE lifecycle → 'active' + LOG `first_job` |
| **Vibe published** | Preset set to is_public=true | UPDATE lifecycle → 'creator' + LOG `vibe_published` |
| **Tier change** | Subscription update | UPDATE tier + LOG `tier_upgraded` / `tier_downgraded` |
| **Profile updated** | `POST /api/profile/update` | UPSERT contacts (display_name, avatar, social links) |
| **Periodic sync** | `POST /api/cron/sync-crm` (cron) | UPDATE all counters for all linked users |

---

## Sync Architecture

### Files

| File | Purpose |
|------|---------|
| `src/lib/crm/client.ts` | CRM Supabase client (service_role + anon) |
| `src/lib/crm/sync.ts` | All sync functions (upserts, activity logging, bulk sync) |
| `src/routes/api/email-signup/+server.ts` | Waitlist form → CRM |
| `src/routes/auth/callback/+server.ts` | Account creation → CRM |
| `src/routes/api/cron/sync-crm/+server.ts` | Periodic bulk sync |

### Pattern

All sync functions are **fire-and-forget** — they never throw and never block the main request. CRM is not on the critical path.

```typescript
// Example: after creating a profile in auth callback
onUserSignup({
  email: user.email,
  userId: user.id,
  displayName,
  source: 'google'
}).catch(() => {}); // swallow errors
```

### Upsert Strategy

All contact syncs use **upsert by email** (`ON CONFLICT (email)`). If a waitlist lead later creates an account, their existing contact record gets upgraded (not duplicated).

---

## Environment Variables (Railway + .env)

```env
# CRM Database (server-side only)
CRM_SUPABASE_URL=https://wtxhopdlumljkuhkbnzj.supabase.co
CRM_SUPABASE_ANON_KEY=<anon key>              # for waitlist inserts
CRM_SUPABASE_SERVICE_ROLE_KEY=<service key>    # for contact upserts + activity logs

# Cron endpoint protection
CRON_SECRET=<random secret>
```

---

## RLS Policies

| Table | Policy | Role | Access |
|-------|--------|------|--------|
| `contacts` | `deny_all_contacts` | public | DENY ALL |
| `contacts` | `service_role_contacts_all` | service_role | FULL ACCESS |
| `waitlist` | `deny_all_waitlist` | public | DENY ALL |
| `waitlist` | `Allow anon waitlist signups` | anon | INSERT only |
| `waitlist` | `service_role_waitlist_all` | service_role | FULL ACCESS |
| `activities` | `deny_all_activities` | public | DENY ALL |
| `activities` | `service_role_activities_all` | service_role | FULL ACCESS |

---

## What Marketing Claude Code Owns

Everything NOT listed above is owned by the Marketing Claude Code:
- CRM-specific columns: `lead_status`, `deal_stage`, `icp_persona`, `expected_mrr`, `beta_access_status`, `contact_owner`, `tags`, `internal_notes`, etc.
- Email campaigns: `email_sequences`, `email_sequence_steps`, `contact_sequences`
- Scoring: `ccm_scores`
- Enrichment: `enrichment_log`
- Any future tables for the CRM UI

---

*Last updated: 2026-03-04*
*Contract version: 2.1 — Added social link columns (twitter_url, instagram_url, tiktok_url, website_url)*
