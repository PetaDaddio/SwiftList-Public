# Rate Limits & Anti-Abuse Strategy
## SwiftList - Exploration Document
## Created: December 31, 2025

---

## EXECUTIVE SUMMARY

You requested a "side discussion to explore further" on rate limits. This document explores two fundamental approaches to preventing abuse while maximizing user experience and revenue.

**The Core Question**: Should we limit how fast users can burn credits, or let economics be the only throttle?

---

## OPTION 1: Credit-Based Throttling Only (RECOMMENDED FOR MVP)

### Philosophy

"Users can run as many jobs as they want, as fast as they want, as long as they have credits."

### How It Works

```
User has 500 credits in account
↓
Runs 50 jobs in 10 minutes (10 credits each)
↓
Account balance: 0 credits
↓
Must purchase more credits to continue
↓
No artificial speed limits - economics is the brake
```

### Pros

1. **Maximum Revenue**: Power users can burn $100+ in an hour if they want
2. **Simple UX**: No confusing "rate limit exceeded" errors
3. **Self-Regulating**: Users naturally pace themselves to avoid burning money
4. **No Engineering Complexity**: Zero rate limiting logic needed
5. **Competitive Advantage**: "Unlimited speed" vs competitors with hard caps

### Cons

1. **API Cost Spikes**: If 10 users simultaneously burn 500 credits, that's $250 in API costs instantly
2. **Cash Flow Risk**: User spends $50 in credits, but you pay API providers before Stripe settles
3. **No Abuse Prevention**: Bot armies could drain Growth Pool credits
4. **Infrastructure Load**: 100 concurrent jobs could overwhelm single Lightsail instance

### Risk Mitigation

**Cash Flow Buffer**:
```
Keep $1,000 cash reserve for API costs
Stripe settles in 2 days
Max exposure: 2 days of API costs
If average daily API cost is $50, max float needed is $100
```

**Infrastructure Auto-Scaling**:
```
Monitor n8n queue depth
If queue > 50 jobs, spin up secondary instance (Active-Active mode)
Cost: $10/month extra only when needed
```

**Bot Detection**:
```sql
-- Flag suspicious activity: >100 jobs in 1 hour from new account
SELECT user_id, COUNT(*) as jobs_last_hour
FROM jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND user_id IN (
    SELECT user_id FROM profiles
    WHERE created_at > NOW() - INTERVAL '7 days'
  )
GROUP BY user_id
HAVING COUNT(*) > 100;
```

### Pricing Implications

**Scenario**: Power user wants to process 1,000 products in 1 day

**Without Rate Limits**:
- Buys 10,000 credits ($400 bulk pack)
- Runs 1,000 jobs @ 10 credits each
- SwiftList revenue: $400
- SwiftList COGS: ~$50 (avg $0.05/job)
- **Profit: $350 in one day**

**With Rate Limits** (e.g., 100 jobs/day):
- User has to spread across 10 days
- Might churn to competitor with no limits
- Lost revenue: $400

**Recommendation**: Let them spend. Big spenders are GOOD customers.

---

## OPTION 2: Velocity Caps (Tiered Rate Limits)

### Philosophy

"Prevent abuse and infrastructure overload with speed bumps, but scale with subscription tier."

### How It Works

```
┌────────────────────────────────────────────────┐
│  FREE TRIAL                                     │
│  10 jobs/hour, 50 jobs/day                     │
│  Prevents trial abuse, encourages upgrade      │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  STARTER ($17/month)                            │
│  20 jobs/hour, 100 jobs/day                    │
│  Good for casual sellers (5-10 products/day)   │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  PRO ($32/month)                                │
│  50 jobs/hour, 250 jobs/day                    │
│  Power users, batch processing                 │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  ENTERPRISE ($57/month)                         │
│  100 jobs/hour, 500 jobs/day                   │
│  High-volume sellers, agencies                 │
└────────────────────────────────────────────────┘
```

### Implementation

**Database Schema**:
```sql
CREATE TABLE public.rate_limit_config (
  tier TEXT PRIMARY KEY, -- free_trial, starter, pro, enterprise
  jobs_per_hour INTEGER NOT NULL,
  jobs_per_day INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rate_limit_config VALUES
  ('free_trial', 10, 50),
  ('starter', 20, 100),
  ('pro', 50, 250),
  ('enterprise', 100, 500);
```

**Middleware (n8n webhook)**:
```javascript
// Rate limit check before job execution
async function checkRateLimit(userId) {
  const user = await db.query(
    'SELECT subscription_tier FROM profiles WHERE user_id = $1',
    [userId]
  );

  const limits = await db.query(
    'SELECT jobs_per_hour, jobs_per_day FROM rate_limit_config WHERE tier = $1',
    [user.subscription_tier]
  );

  // Check hourly limit
  const jobsLastHour = await db.query(`
    SELECT COUNT(*) as count
    FROM jobs
    WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '1 hour'
  `, [userId]);

  if (jobsLastHour.count >= limits.jobs_per_hour) {
    throw new Error(`Rate limit exceeded: ${limits.jobs_per_hour} jobs/hour for ${user.subscription_tier} tier`);
  }

  // Check daily limit
  const jobsToday = await db.query(`
    SELECT COUNT(*) as count
    FROM jobs
    WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '24 hours'
  `, [userId]);

  if (jobsToday.count >= limits.jobs_per_day) {
    throw new Error(`Daily limit exceeded: ${limits.jobs_per_day} jobs/day for ${user.subscription_tier} tier`);
  }

  return true; // Allowed to proceed
}
```

**User Experience**:
```
User clicks "Generate" on 11th job in 1 hour (Free Trial)
↓
Error Modal:
  "You've reached your hourly limit (10 jobs/hour)"
  "Upgrade to Starter for 20 jobs/hour"
  [Upgrade Now] [Wait 45 minutes]
```

### Pros

1. **Predictable Infrastructure Load**: Never more than X concurrent jobs
2. **Upsell Opportunity**: "Upgrade for higher limits" conversion funnel
3. **Abuse Prevention**: Free trial can't be botted for 1,000 jobs/day
4. **Fair Usage**: Prevents one user from monopolizing resources
5. **Cash Flow Protection**: Limits maximum API spend in short timeframe

### Cons

1. **Revenue Ceiling**: Power users can't spend more than tier allows
2. **Frustrating UX**: "Rate limit exceeded" errors feel like punishment
3. **Support Burden**: "Why can't I run more jobs? I have 500 credits!"
4. **Competitive Disadvantage**: Competitors might offer "unlimited speed"
5. **Engineering Complexity**: Rate limiting logic, caching, error handling

### Workaround: "Burst Mode"

**Hybrid Approach**: Allow burst purchases to bypass limits

```
User hits 100 job/day limit (Starter tier)
↓
Modal: "You've reached your daily limit"
  "Buy 'Burst Mode' for $10 to unlock 100 more jobs today"
  [Buy Burst Mode] [Upgrade to Pro]
↓
One-time purchase adds temporary limit increase
↓
User can continue, SwiftList gets extra $10 revenue
```

**Burst Mode Pricing**:
- Starter: $10 for +100 jobs/day (one-time)
- Pro: $20 for +250 jobs/day (one-time)
- Auto-resets at midnight

**Revenue Impact**:
- 10% of users buy Burst Mode once/month = $10-20 extra ARPU
- Reduces frustration of hard limits
- Creates urgency ("only available today")

---

## OPTION 3: HYBRID MODEL (COMPROMISE)

### Best of Both Worlds

**Free Trial**: Hard limits (10/hour, 50/day) to prevent abuse

**Paid Tiers**: No hard limits, credit-based only

**Rationale**:
- Free trial abuse is the real risk (bot armies)
- Paying customers are incentivized to NOT abuse (they're paying)
- Maximizes revenue from power users
- Simple implementation

### Implementation

```javascript
async function checkRateLimit(userId) {
  const user = await db.query(
    'SELECT subscription_tier FROM profiles WHERE user_id = $1',
    [userId]
  );

  // Only enforce limits on free trial
  if (user.subscription_tier === 'free_trial') {
    const jobsLastHour = await db.query(`
      SELECT COUNT(*) FROM jobs
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '1 hour'
    `, [userId]);

    if (jobsLastHour.count >= 10) {
      throw new Error('Free trial limit: 10 jobs/hour. Upgrade for unlimited speed!');
    }

    const jobsToday = await db.query(`
      SELECT COUNT(*) FROM jobs
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
    `, [userId]);

    if (jobsToday.count >= 50) {
      throw new Error('Free trial limit: 50 jobs/day. Upgrade for unlimited speed!');
    }
  }

  // Paid tiers: no limits, credits are the only brake
  return true;
}
```

### Conversion Funnel

```
User on free trial hits 10 jobs/hour
↓
"Upgrade to Starter for unlimited speed + 350 credits"
  ✅ No more rate limits
  ✅ 350 credits/month (~35 jobs)
  ✅ Only $17/month
  [Upgrade Now]
↓
Immediate upsell opportunity
```

---

## INFRASTRUCTURE IMPLICATIONS

### Concurrent Job Capacity

**Current Architecture**: Single Lightsail instance (2 vCPU, 4GB RAM)

**Estimated Capacity**:
- n8n can handle ~20-30 concurrent workflows
- Each workflow averages 5-10 seconds
- Throughput: ~150-300 jobs/hour

**With Active-Passive Failover**:
- Still only 1 active instance
- Capacity unchanged: ~150-300 jobs/hour

**Scaling Triggers**:

| Scenario | Infrastructure | Cost |
|----------|---------------|------|
| <150 jobs/hour | Single instance | $20/month |
| 150-300 jobs/hour | Active-Passive failover | $41/month |
| 300-600 jobs/hour | Active-Active (2× instances) | $98/month |
| 600+ jobs/hour | Active-Active + auto-scaling | $150+/month |

**Rate Limit Implications**:

**Without Rate Limits**:
- If 50 users simultaneously burn 100 credits each = 500 jobs
- Queue depth: 500 jobs
- Processing time: ~2-3 hours (backlog)
- User experience: "Your job is queued (position 247)"

**With Rate Limits** (50 jobs/hour max per user):
- Max 50 users × 50 jobs/hour = 2,500 jobs/hour
- Still need queue if >300 concurrent
- But limits WORST case scenario

**Recommendation**: Implement job queue with position indicator either way

---

## COST-BENEFIT ANALYSIS

### Scenario: 100 Active Users, No Rate Limits

**Assumptions**:
- 70% light users (10 jobs/day avg)
- 20% medium users (50 jobs/day avg)
- 10% power users (200 jobs/day avg)

**Daily Job Volume**:
```
Light: 70 users × 10 jobs = 700 jobs
Medium: 20 users × 50 jobs = 1,000 jobs
Power: 10 users × 200 jobs = 2,000 jobs
Total: 3,700 jobs/day
```

**API Costs** (avg $0.05/job):
```
3,700 jobs × $0.05 = $185/day
$185 × 30 days = $5,550/month
```

**Revenue** (avg 10 credits/job = $0.50):
```
3,700 jobs × $0.50 = $1,850/day
$1,850 × 30 days = $55,500/month
```

**Gross Margin**: $49,950/month (90%)

**Infrastructure Can Handle**:
- 3,700 jobs/day = 154 jobs/hour (avg)
- Well within single instance capacity
- Occasional spikes might queue

**Verdict**: No rate limits work fine at 100 users

---

### Scenario: 100 Active Users, With Rate Limits

**Assumptions**: Same user distribution, but capped at tier limits

**Daily Job Volume** (enforced limits):
```
Light (Starter tier, 100/day cap): 70 users × 10 jobs = 700 jobs
Medium (Pro tier, 250/day cap): 20 users × 50 jobs = 1,000 jobs
Power (Enterprise tier, 500/day cap): 10 users × 200 jobs = 2,000 jobs
Total: 3,700 jobs/day (SAME - limits not hit)
```

**BUT**: 2 power users want to do 600 jobs/day each

**Without Limits**:
```
2 users × 600 jobs = 1,200 extra jobs
Revenue: 1,200 × $0.50 = $600/day = $18,000/month
```

**With Limits**:
```
2 users × 500 jobs = 1,000 jobs (capped)
Revenue: 1,000 × $0.50 = $500/day = $15,000/month
Lost revenue: $3,000/month
```

**Verdict**: Rate limits cost $3,000/month in this scenario

---

## COMPETITIVE ANALYSIS

### How Do Competitors Handle This?

**Canva** (design platform):
- Free: 5 designs/month
- Pro: Unlimited designs
- No "jobs per hour" limits
- **Lesson**: Unlimited is the selling point

**Midjourney** (AI image generation):
- Free: 25 images (then paywall)
- Basic: ~200 images/month
- Standard: ~900 images/month
- Pro: Unlimited (fair use)
- No speed limits, just monthly quotas
- **Lesson**: Credits/quotas, not speed caps

**Jasper AI** (AI copywriting):
- Tier pricing by words/month
- No "words per hour" limits
- **Lesson**: Monthly budgets, unlimited speed

**Remove.bg** (background removal):
- Free: 1 image (then paywall)
- Paid: Credit-based, no rate limits
- **Lesson**: Pay per use, no artificial throttling

**Industry Standard**: Credit-based systems, monthly quotas, NO speed-based rate limits

**Competitive Positioning**:
```
SwiftList: "Unlimited speed processing - burn 1,000 credits in 10 minutes if you want"
Competitor: "100 jobs per day limit"

→ SwiftList wins power users
```

---

## RECOMMENDATIONS

### For MVP (Jan 15 Launch)

**Phase 1: OPTION 3 (Hybrid)**

```
Free Trial:
  ✅ 10 jobs/hour hard limit
  ✅ 50 jobs/day hard limit
  ✅ 200 credits (expires in 7 days)
  Rationale: Prevent abuse, encourage upgrade

Starter/Pro/Enterprise:
  ✅ No rate limits
  ✅ Credit-based only
  ✅ "Unlimited speed" marketing message
  Rationale: Maximize revenue, attract power users
```

**Implementation**:
- Simple rate limit check only for `subscription_tier = 'free_trial'`
- Database query: `COUNT(*) FROM jobs WHERE user_id = X AND created_at > NOW() - INTERVAL '1 hour'`
- Cost: ~$0 (just SQL queries)
- Engineering time: ~2 hours

### Month 2-3: Monitor & Adjust

**Watch for**:
1. Infrastructure load (queue depth, instance CPU)
2. API cost spikes (daily budget alerts)
3. Abuse patterns (bot detection queries)
4. User complaints ("too slow", "why is it queued?")

**Trigger for Adding Limits**:
- IF queue depth regularly >100 jobs
- AND infrastructure costs spike >$200/month
- THEN consider adding Pro/Enterprise tier limits

**But first try**:
- Active-Active load balancing ($98/month)
- Job queue optimization
- Horizontal scaling

### Long-Term: Dynamic Pricing

**"Surge Pricing" for Peak Times**:
```
Normal: 10 credits/job
Peak (Mon-Fri 9am-5pm): 12 credits/job
Off-Peak (nights/weekends): 8 credits/job

→ Incentivizes load distribution
→ No hard limits, just price signals
```

**"Priority Queue" Upsell**:
```
Standard queue: Free (5-10 min wait)
Priority queue: +5 credits (instant processing)

→ Let impatient users pay to skip line
→ Revenue from queue jumping
```

---

## DECISION MATRIX

| Criteria | Option 1: No Limits | Option 2: Velocity Caps | Option 3: Hybrid |
|----------|---------------------|------------------------|------------------|
| **Revenue Potential** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Abuse Prevention** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **User Experience** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Engineering Complexity** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Competitive Advantage** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Infrastructure Risk** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **MVP Readiness** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Weighted Score**:
- Option 1: 29/35 (83%)
- Option 2: 21/35 (60%)
- **Option 3: 30/35 (86%)** ← WINNER

---

## IMPLEMENTATION CHECKLIST

### Week 1 (MVP Launch)

**Rate Limiting**:
- [ ] Add rate limit check middleware to WF-01 (The Decider)
- [ ] Query: `COUNT(*) FROM jobs WHERE user_id = X AND subscription_tier = 'free_trial'`
- [ ] Error response: `{error: "Free trial limit exceeded", upgrade_url: "/pricing"}`
- [ ] Frontend: Display upgrade modal on rate limit error

**Monitoring**:
- [ ] CloudWatch alarm: Queue depth >50
- [ ] CloudWatch alarm: API costs >$50/day
- [ ] Slack alert: User hits rate limit (track conversion)

**Analytics**:
- [ ] Track: How many free trial users hit limits (conversion opportunity)
- [ ] Track: Average jobs/hour by tier (capacity planning)
- [ ] Track: Peak usage hours (surge pricing data)

### Month 2: Optimization

- [ ] Implement job queue position indicator
- [ ] A/B test: "Upgrade to remove limits" vs "Buy Burst Mode" conversion
- [ ] Monitor: Power user churn (did limits drive them away?)
- [ ] Consider: Dynamic pricing for peak times

---

## FINAL RECOMMENDATION

**For SwiftList MVP (January 15, 2026)**:

✅ **Implement Option 3 (Hybrid Model)**

**Free Trial**:
- 10 jobs/hour, 50 jobs/day hard limits
- 200 credits (7-day expiry)
- Upgrade CTA when limits hit

**Paid Tiers**:
- No rate limits (credit-based only)
- "Unlimited speed processing" marketing
- Power users can burn as fast as they want

**Why This Works**:
1. Prevents free trial abuse (biggest risk)
2. Maximizes revenue from paying customers
3. Competitive advantage ("unlimited speed")
4. Simple to implement (2 hours)
5. Easy to adjust based on data

**Cash Flow Protection**:
- Monitor daily API spend
- Alert if >$100/day
- $1,000 cash reserve buffer
- Stripe settles in 2 days (low float risk)

**Scaling Plan**:
- <150 jobs/hour: Current setup
- 150-300 jobs/hour: Active-Passive failover (already planned)
- 300-600 jobs/hour: Active-Active load balancing
- 600+ jobs/hour: Horizontal auto-scaling

**Next Steps**:
1. User approves Option 3
2. Implement rate limit check (2 hours)
3. Add monitoring/alerts (1 hour)
4. Test with eBay power user group
5. Monitor for 30 days, adjust if needed

---

**Ready for your decision on which option to proceed with.**
