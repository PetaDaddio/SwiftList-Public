# SwiftList Lifeguard - Slack Integration Setup

## Overview

The SwiftList Lifeguard system uses Slack for real-time alerts and one-click fix approvals. This guide walks through complete Slack app setup.

---

## 🚀 Quick Setup (10 minutes)

### Step 1: Create Slack App

1. **Go to Slack API Console:**
   - Visit: https://api.slack.com/apps
   - Click "Create New App" → "From scratch"

2. **App Configuration:**
   - **App Name:** `SwiftList Lifeguard`
   - **Workspace:** Select your workspace
   - Click "Create App"

### Step 2: Enable Features

#### A. Incoming Webhooks

1. Navigate to: **Features → Incoming Webhooks**
2. Toggle "Activate Incoming Webhooks" → **ON**
3. Click "Add New Webhook to Workspace"
4. Select channel: **#swiftlist-alerts** (create if doesn't exist)
5. Click "Allow"
6. **Copy the Webhook URL** (you'll need this for Lambda)
   - Format: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`

#### B. Interactive Components

1. Navigate to: **Features → Interactivity & Shortcuts**
2. Toggle "Interactivity" → **ON**
3. **Request URL:** (you'll get this after deploying the button handler Lambda)
   - Format: `https://[lambda-function-url]/slack/actions`
   - Leave blank for now, update after Lambda deployment
4. Click "Save Changes"

#### C. Bot Token Scopes

1. Navigate to: **Features → OAuth & Permissions**
2. Scroll to **Scopes → Bot Token Scopes**
3. Add the following scopes:
   - `incoming-webhook` (send messages)
   - `chat:write` (post messages)
   - `chat:write.public` (post to public channels)
   - `files:write` (upload code diffs)
4. Click "Save Changes"

#### D. Install App to Workspace

1. Navigate to: **Settings → Install App**
2. Click "Install to Workspace"
3. Click "Allow"
4. **Copy the Bot User OAuth Token**
   - Format: `xoxb-...`
   - Store securely (you'll need this for advanced features)

### Step 3: Create Slack Channel

1. In Slack, create channel: **#swiftlist-alerts**
2. Invite the bot: `/invite @SwiftList Lifeguard`
3. Set channel purpose: "Automated alerts and fix approvals for SwiftList production"

---

## 🔐 Store Credentials Securely

### Add to AWS Systems Manager Parameter Store

```bash
# Store Slack Webhook URL
aws ssm put-parameter \
  --name "/swiftlist/slack/webhook-url" \
  --type "SecureString" \
  --value "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"

# Store Slack Bot Token (for interactive features)
aws ssm put-parameter \
  --name "/swiftlist/slack/bot-token" \
  --type "SecureString" \
  --value "xoxb-..."

# Store Slack Signing Secret (for verifying interactive requests)
aws ssm put-parameter \
  --name "/swiftlist/slack/signing-secret" \
  --type "SecureString" \
  --value "your_signing_secret_here"
```

### Update Lambda Environment Variables

In AWS Lambda console or via script:
```bash
aws lambda update-function-configuration \
  --function-name swiftlist-error-analyzer \
  --environment Variables="{
    SLACK_WEBHOOK_URL=/swiftlist/slack/webhook-url,
    SLACK_BOT_TOKEN=/swiftlist/slack/bot-token,
    SLACK_SIGNING_SECRET=/swiftlist/slack/signing-secret
  }"
```

---

## 📊 Slack Message Templates

### Template 1: Critical Error Alert

```json
{
  "channel": "#swiftlist-alerts",
  "username": "SwiftList Lifeguard",
  "icon_emoji": ":rotating_light:",
  "attachments": [{
    "color": "#ff0000",
    "title": "🚨 CRITICAL: API Error Rate Spike",
    "text": "*Root Cause:* Database connection pool exhausted\n*Affected Users:* ~500 users unable to create jobs\n*Urgency:* CRITICAL",
    "fields": [
      {
        "title": "Proposed Fix",
        "value": "```\nIncrease Supabase connection pool from 10 to 25 connections\nUpdate environment variable: SUPABASE_POOL_SIZE=25\n```",
        "short": false
      },
      {
        "title": "Estimated Fix Time",
        "value": "5 minutes",
        "short": true
      },
      {
        "title": "Impact if Not Fixed",
        "value": "Revenue loss: $200/hour",
        "short": true
      }
    ],
    "actions": [
      {
        "type": "button",
        "text": "✅ Approve & Deploy Fix",
        "style": "primary",
        "name": "approve",
        "value": "approve_fix"
      },
      {
        "type": "button",
        "text": "🔍 View Logs",
        "name": "logs",
        "value": "view_logs"
      },
      {
        "type": "button",
        "text": "❌ Ignore",
        "style": "danger",
        "name": "ignore",
        "value": "ignore_alert"
      }
    ],
    "footer": "Detected at 2026-01-07 21:15:32 UTC",
    "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png"
  }]
}
```

### Template 2: Performance Degradation Warning

```json
{
  "channel": "#swiftlist-alerts",
  "username": "SwiftList Lifeguard",
  "icon_emoji": ":warning:",
  "attachments": [{
    "color": "#ffcc00",
    "title": "⚠️ WARNING: Slow Database Queries",
    "text": "*Root Cause:* Missing index on jobs.status column\n*Affected Users:* Dashboard load time increased 3x (now 2.5s)\n*Urgency:* MEDIUM",
    "fields": [
      {
        "title": "Proposed Fix",
        "value": "```sql\nCREATE INDEX idx_jobs_status ON jobs(status);\nCREATE INDEX idx_jobs_user_created ON jobs(user_id, created_at DESC);\n```",
        "short": false
      },
      {
        "title": "Performance Impact",
        "value": "Dashboard queries will be 10x faster",
        "short": false
      }
    ],
    "actions": [
      {
        "type": "button",
        "text": "✅ Run Migration",
        "style": "primary",
        "name": "approve",
        "value": "approve_migration"
      },
      {
        "type": "button",
        "text": "📊 View Query Plan",
        "name": "explain",
        "value": "view_query_plan"
      }
    ],
    "footer": "Detected at 2026-01-07 21:30:00 UTC"
  }]
}
```

### Template 3: Fix Deployed Confirmation

```json
{
  "channel": "#swiftlist-alerts",
  "username": "SwiftList Lifeguard",
  "icon_emoji": ":white_check_mark:",
  "attachments": [{
    "color": "#00cc00",
    "title": "✅ Fix Deployed Successfully",
    "text": "*Issue:* Database connection pool exhausted\n*Fix:* Increased connection pool to 25\n*Deploy Time:* 3 minutes 42 seconds",
    "fields": [
      {
        "title": "Verification",
        "value": "✓ All health checks passing\n✓ Error rate returned to baseline\n✓ API response time: 120ms (normal)",
        "short": false
      },
      {
        "title": "Approved By",
        "value": "@rick",
        "short": true
      },
      {
        "title": "GitHub Commit",
        "value": "<https://github.com/your-org/swiftlist/commit/abc123|abc123>",
        "short": true
      }
    ],
    "footer": "Deployed at 2026-01-07 21:20:15 UTC"
  }]
}
```

### Template 4: Auto-Fix Proposal with Code Diff

```json
{
  "channel": "#swiftlist-alerts",
  "username": "SwiftList Lifeguard",
  "icon_emoji": ":robot_face:",
  "attachments": [{
    "color": "#0066cc",
    "title": "🤖 AI-Proposed Fix Ready",
    "text": "*Issue:* Credit deduction race condition\n*Analysis:* Multiple concurrent job submissions causing duplicate charges\n*Confidence:* 95%",
    "fields": [
      {
        "title": "Code Changes",
        "value": "```diff\n--- a/lib/supabase/rpc.ts\n+++ b/lib/supabase/rpc.ts\n@@ -10,7 +10,10 @@\n export async function deductCredits(userId: string, amount: number, jobId: string) {\n-  const { error } = await supabase.rpc('deduct_credits', {\n+  const { error } = await supabase.rpc('deduct_credits_atomic', {\n     p_user_id: userId,\n     p_amount: amount,\n-    p_job_id: jobId\n+    p_job_id: jobId,\n+    p_idempotency_key: `job_${jobId}_${Date.now()}`\n   });\n```",
        "short": false
      },
      {
        "title": "Database Migration",
        "value": "```sql\nCREATE UNIQUE INDEX idx_job_credit_deduction \nON job_credit_transactions(job_id, idempotency_key);\n```",
        "short": false
      },
      {
        "title": "Test Results",
        "value": "✓ Unit tests passing (45/45)\n✓ Integration tests passing (12/12)\n✓ Load test: 1000 concurrent requests, 0 duplicates",
        "short": false
      }
    ],
    "actions": [
      {
        "type": "button",
        "text": "✅ Deploy to Production",
        "style": "primary",
        "name": "deploy",
        "value": "deploy_fix",
        "confirm": {
          "title": "Deploy Fix to Production?",
          "text": "This will:\n• Apply database migration\n• Deploy code changes\n• Restart application servers\n\nEstimated downtime: < 30 seconds",
          "ok_text": "Deploy Now",
          "dismiss_text": "Cancel"
        }
      },
      {
        "type": "button",
        "text": "🧪 Deploy to Staging First",
        "name": "staging",
        "value": "deploy_staging"
      },
      {
        "type": "button",
        "text": "📝 Review Code",
        "name": "review",
        "value": "open_pr"
      }
    ],
    "footer": "AI Analysis completed in 15 seconds"
  }]
}
```

---

## 🧪 Testing Slack Integration

### Send Test Alert

```bash
curl -X POST "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#swiftlist-alerts",
    "username": "SwiftList Lifeguard",
    "icon_emoji": ":test_tube:",
    "text": "🧪 Test Alert: Slack integration is working!"
  }'
```

### Test Interactive Buttons

1. Send a message with buttons using the templates above
2. Click a button
3. Verify your Lambda function receives the interaction payload
4. Check CloudWatch Logs for the Lambda function

---

## 📱 Slack Mobile App

Ensure team members have Slack mobile app installed for:
- **Push notifications** for critical alerts
- **One-click approvals** from anywhere
- **Fast incident response** outside office hours

---

## 🔔 Notification Preferences

### Alert Levels

| Level | When to Alert | Notification |
|-------|---------------|--------------|
| **CRITICAL** | Service down, data loss risk, security breach | @channel + SMS |
| **HIGH** | Performance degradation, high error rate | @channel |
| **MEDIUM** | Warnings, optimization opportunities | Regular message |
| **LOW** | Info, successful auto-fixes | Collapsed thread |

### Configure in Slack

1. Channel preferences: #swiftlist-alerts
2. Notifications: All messages
3. Mobile push: Mentions and keywords only
4. Keywords: `CRITICAL`, `@rick`, `production down`

---

## 🎨 Customize Bot Appearance

1. Navigate to: **Settings → Basic Information → Display Information**
2. Upload bot avatar: Use SwiftList logo or robot icon
3. Set bot color: `#14b8a6` (SwiftList teal)
4. Add description: "AI-powered monitoring and auto-fix assistant for SwiftList"

---

## ✅ Verification Checklist

- [ ] Slack app created: SwiftList Lifeguard
- [ ] Incoming webhooks enabled
- [ ] Webhook URL stored in AWS Parameter Store
- [ ] Channel #swiftlist-alerts created
- [ ] Bot invited to channel
- [ ] Test alert sent successfully
- [ ] Interactive components configured
- [ ] Bot token and signing secret stored securely
- [ ] Mobile app installed and notifications enabled
- [ ] Team members added to channel

---

## 📞 Support

**Slack API Documentation:** https://api.slack.com/
**Troubleshooting:** Check CloudWatch Logs for Lambda function errors
**Rate Limits:** Slack allows ~1 message per second (burst to 5/sec)

---

**Last Updated:** January 7, 2026
**Status:** Ready for deployment
