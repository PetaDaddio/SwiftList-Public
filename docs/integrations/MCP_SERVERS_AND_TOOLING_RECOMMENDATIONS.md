# MCP Servers & Tooling Recommendations for SwiftList
## Infrastructure, Integration & Development Tools
## Created: December 31, 2025

---

## EXECUTIVE SUMMARY

**Current Status**:
- ✅ GitHub MCP (connected)
- ✅ n8n MCP (connected)
- ❌ PostgreSQL MCP (not connected) - **CRITICAL**
- ❌ Google Drive MCP (not connected)
- ❌ Slack MCP (not connected)

**Recommendations**: Install 8 essential MCP servers + configure 3 custom skills

**Impact**: 50% faster development, unified tooling, automated workflows

---

## CATEGORY 1: DATABASE & DATA LAYER (CRITICAL)

### PostgreSQL MCP Server
**Status**: Available but not connected
**Priority**: 🔴 **CRITICAL - Install Immediately**

**Why Essential for SwiftList**:
- Direct database queries from Claude Code (no context switching)
- Schema exploration (`DESCRIBE tables`, view relationships)
- Migration management (create, test, rollback)
- Data validation (check royalty calculations, credit balances)
- Performance analysis (EXPLAIN queries, identify slow operations)

**Installation**:
```bash
# Option 1: Official PostgreSQL MCP
claude mcp add --transport stdio postgres \
  --env DATABASE_URL="postgresql://user:pass@db.supabase.co:5432/postgres" \
  -- npx -y @modelcontextprotocol/server-postgres

# Option 2: Bytebase DBHub (Enhanced features)
claude mcp add --transport stdio postgres-enhanced \
  --env DATABASE_URL="${SUPABASE_DATABASE_URL}" \
  -- npx -y @bytebase/dbhub
```

**Use Cases for SwiftList**:
```
Example 1: Quick Data Check
> "How many users signed up today?"
[PostgreSQL MCP queries database]
> "23 signups today, 14 converted from free trial"

Example 2: Schema Exploration
> "Show me the creator_tiers table structure"
[Returns: columns, types, constraints, indexes]

Example 3: Migration Testing
> "Test this migration on staging database"
[Runs migration, validates schema, shows results]
```

**Testing Connection**:
```bash
# After installation
claude mcp list
# Should show: postgres - ✓ Connected

# Test query
> "Query the profiles table, show 5 most recent users"
```

---

## CATEGORY 2: PAYMENT PROCESSING (HIGH PRIORITY)

### Stripe MCP Server
**Status**: Not installed
**Priority**: 🟠 **HIGH - Install Week 1**

**Why Essential for SwiftList**:
- Customer management (create, update, list subscriptions)
- Payment history (track credit purchases, subscription charges)
- Webhook configuration (ensure WF-26 Billing workflow gets events)
- Refund processing (if Lifeguard needs to refund failed jobs)
- Subscription management (upgrades, downgrades, cancellations)

**Installation**:
```bash
claude mcp add --transport http stripe \
  --env STRIPE_API_KEY="${STRIPE_SECRET_KEY}" \
  https://mcp.stripe.com
```

**Use Cases for SwiftList**:
```
Example 1: Check Subscription Status
> "Show me all active Pro tier subscriptions"
[Lists customers with Pro subscription, renewal dates]

Example 2: Process Refund
> "Refund $5 to user_id abc123 for failed job"
[Creates Stripe refund, updates database]

Example 3: Webhook Debugging
> "Show recent webhook events for invoice.payment_succeeded"
[Displays webhook logs, helps debug WF-26]
```

**Critical for MVP**:
- WF-26 (Billing & Top-Up) depends on Stripe webhooks
- Need to test: signup → subscription → webhook → credit update
- Stripe MCP makes testing/debugging seamless

---

## CATEGORY 3: API & WORKFLOW INTEGRATION (CRITICAL)

### n8n MCP Server
**Status**: ✅ Connected
**Priority**: 🟢 **VERIFIED - Already Working**

**Capabilities**:
- Search workflows by name/ID
- Execute workflow (manual trigger)
- Get workflow details (JSON structure, nodes, connections)

**Use Cases for SwiftList**:
```
Example 1: Debug Workflow
> "Show me the configuration for WF-02 Jewelry Precision Engine"
[Returns: workflow JSON, all nodes, Gemini API config, Replicate settings]

Example 2: Test Workflow
> "Execute WF-07 Background Removal with test image"
[Triggers workflow, returns job ID, monitors progress]

Example 3: List All Workflows
> "List all active workflows and their last execution time"
[Shows: 27 workflows, execution counts, error rates]
```

**Enhancement Opportunity**:
```bash
# If n8n MCP connection issues, reconfigure:
claude mcp get n8n-mcp
# Verify endpoint and API token

# Test connection:
> "List all n8n workflows"
```

---

### RESTful API MCP (Recommended)
**Status**: Not installed
**Priority**: 🟡 **MEDIUM - Install Week 2**

**Why Useful for SwiftList**:
- Test external APIs (Gemini, OpenAI, Photoroom, Replicate)
- Debug API responses (rate limits, error messages)
- Validate request/response schemas
- Monitor API health (success rates, latency)

**Installation**:
```bash
# Generic REST API client
claude mcp add --transport stdio rest-client \
  -- npx -y @modelcontextprotocol/server-fetch
```

**Use Cases**:
```
Example: Test Gemini API
> "Call Gemini 2.0 Flash API with test prompt"
POST https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent
[Shows: response, latency, token count, cost]

Example: Check Photoroom Rate Limit
> "Get rate limit headers from Photoroom API"
[Shows: X-RateLimit-Remaining, Reset time]
```

---

## CATEGORY 4: MONITORING & DEBUGGING (HIGH PRIORITY)

### Sentry MCP Server
**Status**: Not installed
**Priority**: 🟠 **HIGH - Install Week 1**

**Why Essential for SwiftList**:
- Error tracking across distributed system (n8n + React + API integrations)
- Real-time alerts (Slack integration for critical errors)
- Performance monitoring (slow workflows, API latency)
- Release tracking (correlate errors with deployments)

**Installation**:
```bash
claude mcp add --transport http sentry \
  --env SENTRY_DSN="${SENTRY_DSN}" \
  https://mcp.sentry.dev/mcp
```

**Use Cases for SwiftList**:
```
Example 1: Monitor Workflow Errors
> "Show errors in WF-02 Jewelry Engine from last 24 hours"
[Lists: 3 Gemini API timeouts, 1 Replicate generation failure]

Example 2: Performance Analysis
> "What's the slowest workflow?"
[Shows: WF-03 Fashion Engine avg 18 seconds, WF-06 General avg 3 seconds]

Example 3: User Impact
> "How many users affected by today's Photoroom outage?"
[Shows: 47 users, 89 failed jobs, $4.45 in refunds]
```

**Critical for Production**:
- Know about errors BEFORE users report them
- Auto-alert on Slack when error rate spikes
- Track job success rate (KPI for quality)

---

### Datadog MCP Server (Optional)
**Status**: Not installed
**Priority**: 🟡 **MEDIUM - Consider for Month 2**

**Why Useful**:
- Infrastructure monitoring (Lightsail CPU, RDS connections)
- Custom metrics (jobs/hour, credit burn rate)
- Log aggregation (n8n logs + application logs)
- APM (application performance monitoring)

**Cost Consideration**:
- Datadog: ~$15/host/month
- Alternative: AWS CloudWatch (included with AWS, but basic)
- **Recommendation**: Start with CloudWatch (free), upgrade to Datadog if needed

---

## CATEGORY 5: VERSION CONTROL & COLLABORATION (ALREADY HAVE)

### GitHub MCP Server
**Status**: ✅ Connected
**Priority**: 🟢 **VERIFIED - Core Tool**

**Already Using For**:
- Create/review pull requests
- Manage issues (bug tracking, feature requests)
- Push files (workflow backups, documentation)
- Repository management

**Enhanced Use Cases for SwiftList**:
```
Example 1: Automated Documentation
> "Create a PR with updated TDD v1.9"
[Creates branch, commits file, opens PR with description]

Example 2: Issue Tracking
> "Create GitHub issue for WF-02 quality improvement"
[Creates issue, assigns labels, links to project board]

Example 3: Workflow Backup
> "Push all n8n workflows to GitHub"
[Exports workflows, creates commit, pushes to repo]
```

---

### Slack MCP Server
**Status**: Available but not connected
**Priority**: 🟠 **HIGH - Install Week 1**

**Why Essential for SwiftList**:
- Real-time alerts (errors, system events)
- Deployment notifications (new workflow version live)
- User milestones (first Platinum creator unlocked!)
- Team collaboration (async updates)

**Installation**:
```bash
claude mcp add --transport stdio slack \
  --env SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}" \
  -- npx -y @modelcontextprotocol/server-slack
```

**Use Cases for SwiftList**:
```
Example 1: Alert on Error Spike
> "Post to #alerts: WF-02 error rate >10%"
[Sends Slack message with error details, link to Sentry]

Example 2: Milestone Notification
> "Post to #growth: First Platinum creator achieved!"
[Sends celebratory message with creator stats]

Example 3: Daily Summary
> "Post to #metrics: Today's stats (signups, MRR, API costs)"
[Auto-generated daily report]
```

---

### Google Drive MCP Server
**Status**: Available but not connected
**Priority**: 🟡 **MEDIUM - Install Week 2**

**Why Useful**:
- Import KPI list (user has comprehensive list on Drive)
- Store design mockups (badge designs, UI screenshots)
- Collaborate on documents (marketing copy, blog posts)
- Archive important files (contracts, legal docs)

**Installation**:
```bash
claude mcp add --transport stdio gdrive \
  --env GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json" \
  -- npx -y @modelcontextprotocol/server-gdrive
```

**Use Cases**:
```
Example: Import KPI List
> "Read the SwiftList KPIs spreadsheet from Google Drive"
[Imports data, converts to markdown, updates TDD]
```

---

## CATEGORY 6: CLOUD INFRASTRUCTURE (AWS)

### AWS MCP Server (If Available)
**Status**: Not installed
**Priority**: 🟡 **MEDIUM - Research Availability**

**Why Useful for SwiftList**:
- Lightsail instance management (start, stop, monitor)
- S3 bucket operations (upload assets, check storage costs)
- RDS management (backups, scaling, performance)
- CloudWatch metrics (infrastructure monitoring)

**Installation** (if available):
```bash
# Check if AWS MCP exists in registry
claude mcp --help

# If available:
claude mcp add --transport http aws \
  --env AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY}" \
  --env AWS_SECRET_ACCESS_KEY="${AWS_SECRET_KEY}" \
  https://api.aws.amazon.com/mcp
```

**Alternative**: Use AWS CLI via Bash tool
```bash
# Check Lightsail instance status
aws lightsail get-instance --instance-name swiftlist-primary

# Monitor S3 storage costs
aws s3api list-buckets
aws s3 ls s3://swiftlist-assets --summarize
```

---

## RECOMMENDED CUSTOM SKILLS

Based on your existing slash commands, create these domain-specific skills:

### Skill 1: SwiftList Infrastructure Manager
**Command**: `/infra` (new custom skill)

**Purpose**: Unified infrastructure operations

**Features**:
- Deploy Lightsail instances
- Configure Route 53 failover
- Set up RDS database
- Manage S3 buckets
- Monitor CloudWatch alarms

**Implementation**:
```bash
# Create skill in .claude/skills/infra.md
cat > .claude/skills/infra.md <<'EOF'
---
name: infra
description: Manage SwiftList AWS infrastructure - Lightsail, RDS, S3, Route 53
---

You are the infrastructure manager for SwiftList. Use the following tools:

- AWS CLI (via Bash tool)
- PostgreSQL MCP (database management)
- GitHub MCP (infrastructure as code)

When managing infrastructure:
1. Always check current state before changes
2. Use staging environment first
3. Document all changes in GitHub
4. Alert team on Slack after deployments
EOF
```

---

### Skill 2: SwiftList API Integration Manager
**Command**: `/api-test` (new custom skill)

**Purpose**: Test and debug external APIs

**Features**:
- Test Gemini, OpenAI, Anthropic, Replicate APIs
- Validate API keys and rate limits
- Monitor API health scores
- Document API response schemas
- Generate fallback chain configs

**Implementation**:
```bash
cat > .claude/skills/api-test.md <<'EOF'
---
name: api-test
description: Test and debug SwiftList AI provider APIs - Gemini, OpenAI, Replicate, etc.
---

You test external APIs for SwiftList. Your tools:

- RESTful API MCP (HTTP requests)
- Sentry MCP (error tracking)
- Slack MCP (alert on failures)

When testing APIs:
1. Check rate limits first
2. Use test API keys (not production)
3. Validate response schemas
4. Document errors in Sentry
5. Update health dashboard
EOF
```

---

### Skill 3: SwiftList n8n Workflow Manager
**Command**: `/workflow` (new custom skill)

**Purpose**: Manage all 27 n8n workflows

**Features**:
- List workflows with status
- Execute workflows for testing
- Debug workflow failures
- Export/import workflows
- Version control workflows in GitHub

**Implementation**:
```bash
cat > .claude/skills/workflow.md <<'EOF'
---
name: workflow
description: Manage SwiftList's 27 n8n workflows - execute, debug, version control
---

You manage n8n workflows for SwiftList. Your tools:

- n8n MCP (workflow operations)
- GitHub MCP (version control)
- Sentry MCP (error tracking)
- Slack MCP (alerts)

When managing workflows:
1. Always test in n8n staging first
2. Export workflow JSON before changes
3. Commit to GitHub after modifications
4. Monitor error rates in Sentry
5. Alert team on Slack for production deployments
EOF
```

---

## INSTALLATION PRIORITY & TIMELINE

### Week 1 (Jan 1-5): Essential Infrastructure
**Install Immediately**:
1. ✅ PostgreSQL MCP (database access)
2. ✅ Stripe MCP (payment testing)
3. ✅ Slack MCP (alerts & collaboration)
4. ✅ Sentry MCP (error tracking)

**Configuration**:
```bash
# Day 1: PostgreSQL
export SUPABASE_DATABASE_URL="postgresql://..."
claude mcp add --transport stdio postgres \
  --env DATABASE_URL="${SUPABASE_DATABASE_URL}" \
  -- npx -y @modelcontextprotocol/server-postgres

# Day 1: Stripe
export STRIPE_SECRET_KEY="sk_test_..."
claude mcp add --transport http stripe \
  --env STRIPE_API_KEY="${STRIPE_SECRET_KEY}" \
  https://mcp.stripe.com

# Day 2: Slack
export SLACK_BOT_TOKEN="xoxb-..."
claude mcp add --transport stdio slack \
  --env SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}" \
  -- npx -y @modelcontextprotocol/server-slack

# Day 2: Sentry
export SENTRY_DSN="https://...@sentry.io/..."
claude mcp add --transport http sentry \
  --env SENTRY_DSN="${SENTRY_DSN}" \
  https://mcp.sentry.dev/mcp

# Verify all connections
claude mcp list
```

---

### Week 2 (Jan 6-12): Development Tools
**Install When Needed**:
1. ⏳ Google Drive MCP (import KPI list)
2. ⏳ RESTful API MCP (API testing)
3. ⏳ AWS MCP (if available)

---

### Month 2+: Advanced Monitoring
**Install for Scale**:
1. ⏳ Datadog MCP (advanced metrics)
2. ⏳ Custom monitoring integrations

---

## PROJECT CONFIGURATION FILE

Create `.mcp.json` in project root for team consistency:

```json
{
  "mcpServers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${SUPABASE_DATABASE_URL}"
      }
    },
    "n8n": {
      "type": "http",
      "url": "https://cryptostrategy.app.n8n.cloud/mcp-server/http",
      "headers": {
        "Authorization": "Bearer ${N8N_API_KEY}"
      }
    },
    "stripe": {
      "type": "http",
      "url": "https://mcp.stripe.com",
      "headers": {
        "Authorization": "Bearer ${STRIPE_SECRET_KEY}"
      }
    },
    "slack": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}"
      }
    },
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${SENTRY_AUTH_TOKEN}"
      }
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PAT}"
      }
    },
    "gdrive": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "${GOOGLE_CREDENTIALS_PATH}"
      }
    }
  }
}
```

**Commit to GitHub**:
```bash
git add .mcp.json
git commit -m "Add MCP server configuration for team"
git push origin main
```

---

## TESTING CHECKLIST

After installing each MCP server, verify:

```bash
# 1. Check connection status
claude mcp list
# Expected: All servers show ✓ Connected

# 2. Test PostgreSQL MCP
> "Show me the profiles table structure"
# Expected: Returns table columns, types, constraints

# 3. Test Stripe MCP
> "List all Stripe customers created this week"
# Expected: Returns customer list or empty array

# 4. Test Slack MCP
> "Post test message to #general: MCP server connected!"
# Expected: Message appears in Slack

# 5. Test Sentry MCP
> "List recent errors in SwiftList project"
# Expected: Returns error list or "No errors"

# 6. Test n8n MCP
> "List all n8n workflows"
# Expected: Returns workflow list with IDs and names

# 7. Test GitHub MCP
> "List open issues in SwiftList repository"
# Expected: Returns issue list
```

---

## BENEFITS SUMMARY

### Development Speed
**Without MCP Servers**:
- Claude: "What's in the database?"
- You: Open DBeaver, write query, copy results
- Claude: "OK, now update the schema"
- You: Open Supabase, run migration, copy output
- **Time**: 5-10 minutes per query

**With PostgreSQL MCP**:
- Claude: "What's in the database?"
- [PostgreSQL MCP queries instantly]
- Claude: "Update schema with this migration"
- [PostgreSQL MCP runs migration, validates]
- **Time**: 10 seconds

**50-100× faster iteration**

---

### Error Detection
**Without Sentry MCP**:
- User reports: "My job failed"
- You: Check n8n logs, check Sentry dashboard, check database
- **Time**: 15-30 minutes to diagnose

**With Sentry MCP**:
- Claude: "Show errors for job_id xyz123"
- [Sentry MCP shows: Gemini API timeout, stack trace, affected users]
- **Time**: 5 seconds

**100× faster debugging**

---

### Payment Management
**Without Stripe MCP**:
- User asks: "Why was I charged twice?"
- You: Log into Stripe dashboard, search customer, check invoices
- **Time**: 5 minutes

**With Stripe MCP**:
- Claude: "Show Stripe charges for user_id abc123 this month"
- [Stripe MCP returns: 2 charges, both legitimate (subscription + credit top-up)]
- **Time**: 10 seconds

**30× faster customer support**

---

## COST ANALYSIS

| MCP Server | Setup Time | Monthly Cost | Value |
|------------|-----------|--------------|-------|
| PostgreSQL | 5 min | $0 | ⭐⭐⭐⭐⭐ |
| Stripe | 10 min | $0 | ⭐⭐⭐⭐⭐ |
| Slack | 15 min | $0 | ⭐⭐⭐⭐ |
| Sentry | 10 min | $0 (free tier) | ⭐⭐⭐⭐⭐ |
| n8n | 0 min (done) | $0 | ⭐⭐⭐⭐⭐ |
| GitHub | 0 min (done) | $0 | ⭐⭐⭐⭐⭐ |
| Google Drive | 20 min | $0 | ⭐⭐⭐ |
| Datadog | 30 min | $15/mo | ⭐⭐⭐ (Month 2+) |

**Total Setup Time**: ~2 hours
**Total Monthly Cost**: $0 (MVP), $15 (scaled)
**Time Saved**: 10-20 hours/week

**ROI**: Massive positive (2 hours setup saves 40+ hours/month)

---

## FINAL RECOMMENDATIONS

### Immediate Actions (Today):
1. ✅ Install PostgreSQL MCP (5 min)
2. ✅ Install Stripe MCP (10 min)
3. ✅ Install Slack MCP (15 min)
4. ✅ Install Sentry MCP (10 min)
5. ✅ Test all connections (10 min)

**Total Time**: 50 minutes
**Impact**: 50× faster development for next 15 days

---

### Week 1 Actions:
1. ✅ Create `.mcp.json` configuration file
2. ✅ Commit to GitHub (team consistency)
3. ✅ Build custom `/infra`, `/api-test`, `/workflow` skills
4. ✅ Document MCP usage in team onboarding

---

### Optional (Week 2+):
1. ⏳ Install Google Drive MCP (import KPI list)
2. ⏳ Install RESTful API MCP (advanced API testing)
3. ⏳ Research AWS MCP availability
4. ⏳ Consider Datadog for Month 2 scaling

---

**Next Step**: Install the 4 critical MCP servers (PostgreSQL, Stripe, Slack, Sentry) and verify connections.

**Total Impact**: Transform Claude Code from documentation tool → full development environment with database access, payment integration, monitoring, and team collaboration built-in.
