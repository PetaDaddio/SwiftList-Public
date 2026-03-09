# SwiftList MVP: Claude Agent Use Case Analysis

**Date**: 2026-01-09
**Status**: Decision Document
**Decision**: MVP will include 5 agents, defer 6 to Phase 2

---

## Executive Summary

After analyzing 11 potential agent use cases, we've selected **5 agents for MVP** that provide maximum value with acceptable cost and complexity. The remaining 6 agents are deferred to Phase 2 based on dependencies, ROI timing, and MVP scope constraints.

---

## Evaluation Framework

Each agent is scored across 5 dimensions:

1. **User Value**: Impact on core user experience (1-10)
2. **Technical Complexity**: Implementation effort (Low/Medium/High)
3. **API Cost**: Expected monthly cost at scale (Low/Medium/High)
4. **Dependencies**: Prerequisites that must exist first
5. **Security Impact**: Risk introduced or mitigated

**MVP Threshold**: Agents scoring 7+ on User Value with Low/Medium complexity make the cut.

---

## MVP AGENTS (Phase 1 - 5 Agents)

### 1. SecurityScannerAgent ⭐️ (P0 - CRITICAL)

**Purpose**: Validate all user-generated prompts for injection attempts before execution

**User Value**: 10/10 (Security requirement, prevents platform abuse)

**Use Cases**:
- Scan preset prompts before marketplace publication
- Validate job submission prompts for hidden instructions
- Check custom style descriptions for PII exfiltration attempts

**Why MVP**:
- ✅ **P0 Security Requirement**: Prevents memory poisoning attacks
- ✅ **Legal/Compliance**: GDPR requires PII protection
- ✅ **Platform Safety**: One malicious preset can affect thousands of users

**Implementation**:
- Pattern matching (regex for common injection patterns)
- AI-powered semantic analysis (Haiku for speed + cost)
- Real-time blocking with user-friendly error messages

**Cost**: Low
- Model: Claude Haiku ($0.25/MTok)
- Avg prompt: ~200 tokens
- Expected usage: ~1,000 scans/day
- Monthly cost: ~$5-10

**Complexity**: Medium
- Core logic: 40% complete (existing preset-validator.ts)
- Need: API integration, audit logging, false positive handling

**Dependencies**: None

**Security Impact**: 🟢 Mitigates critical threats

**Status**: ✅ MVP - Implement Week 1

---

### 2. WorkflowRouterAgent ⭐️ (HIGH VALUE)

**Purpose**: Analyze product image and recommend optimal treatment workflow

**User Value**: 9/10 (Solves decision paralysis, improves results)

**Use Cases**:
- User uploads jewelry photo → Agent suggests "Jewelry Engine (WF-02)"
- User uploads craft photo → Agent suggests "Product Enhancement (WF-01)"
- User uploads clothing → Agent suggests "Fashion Staging (WF-03)"

**Example Interaction**:
```
User: [uploads ring photo]
Agent: "I can see this is a jewelry piece with a gemstone.
       I recommend the 'Jewelry Engine' workflow (WF-02) which:
       - Enhances gemstone sparkle
       - Creates professional lighting
       - Adds luxury background

       Would you like to proceed with this workflow?"
```

**Why MVP**:
- ✅ **Reduces friction**: Users don't need to understand 30+ workflows
- ✅ **Improves quality**: AI picks better workflow than novice user
- ✅ **Differentiator**: Competitors require manual workflow selection

**Implementation**:
- Gemini Vision 2.0 for image analysis (detect product type, quality, issues)
- Decision tree logic (map product attributes → workflow recommendations)
- Optional: Multi-workflow suggestions with explanations

**Cost**: Medium
- Model: Gemini 2.0 Flash (vision) - $0.075/1K requests
- Expected usage: 500 routing requests/day (50% of jobs, others use presets)
- Monthly cost: ~$35-40

**Complexity**: Medium
- Vision analysis: Straightforward (similar to existing WF-45)
- Routing logic: Need workflow metadata database
- Confidence scoring: "85% confident this is jewelry"

**Dependencies**:
- Workflow metadata (name, description, ideal_for tags)
- Product category taxonomy

**Security Impact**: 🟡 Medium risk
- Must validate routing decisions (prevent malicious workflow injection)
- Audit log all routing decisions

**Status**: ✅ MVP - Implement Week 1

---

### 3. PresetBuilderAgent ⭐️ (HIGH VALUE)

**Purpose**: Conversational preset creation (max 5 clarifying questions)

**User Value**: 9/10 (Makes preset creation accessible to non-technical users)

**Use Cases**:
- New user wants to create "Vintage Jewelry" preset
- Agent asks: Style era? Dominant color? Background preference? Mood? Lighting?
- Agent generates preset with optimized prompt

**Example Interaction**:
```
User: "I want to create a preset for my handmade pottery"
Agent: "Great! Let me help you create a pottery preset.
       Question 1/5: What style best describes your pottery?
       A) Rustic/earthy  B) Modern/minimalist  C) Colorful/artistic"

[After 5 questions]
Agent: "Perfect! I've created your 'Artisan Pottery' preset:
       Prompt: 'Handmade ceramic pottery in rustic earthy tones,
                natural clay texture, warm studio lighting,
                minimalist beige background, professional product photo'

       Would you like to preview this preset now?"
```

**Why MVP**:
- ✅ **Lowers barrier**: Non-marketers can create quality presets
- ✅ **Network effect**: More presets = more marketplace value
- ✅ **Monetization**: Enables creator economy (users sell presets)

**Implementation**:
- Structured conversation flow (max 5 questions)
- Tool use: `generate_preset_preview()` - runs quick test generation
- Cost cap: 50k tokens max per conversation
- Timeout: 60 seconds

**Cost**: Medium
- Model: Claude Sonnet 3.5 (conversational quality matters)
- Avg conversation: 5 turns × 1k tokens = 5k tokens
- Expected usage: 100 preset creations/day
- Monthly cost: ~$45-60

**Complexity**: Medium
- Conversation management: Standard agentic loop
- Question generation: Dynamic based on product category
- Preview generation: Calls existing n8n workflow

**Dependencies**:
- Tool: `generate_preset_preview(prompt)` → returns image URL
- Cost: Each preview costs ~5 credits (user pays, not platform)

**Security Impact**: 🟡 Medium risk
- Must enforce 5-question limit (prevent abuse)
- Must cap tokens/costs per user
- SecurityScannerAgent validates final preset

**Status**: ✅ MVP - Implement Week 2

---

### 4. QualityValidatorAgent ⭐️ (HIGH VALUE)

**Purpose**: Score output quality and decide pass/fail/retry before showing to user

**User Value**: 8/10 (Prevents bad outputs, improves user satisfaction)

**Use Cases**:
- Job completes → Agent validates output quality
- If quality score < 70% → Auto-retry with adjusted parameters
- If retry fails → Refund user, log failure for human review

**Quality Checks**:
```typescript
interface QualityScore {
  overall_score: number; // 0-100
  criteria: {
    resolution_adequate: boolean;    // Min 1000px width
    subject_in_focus: boolean;       // Product clearly visible
    background_clean: boolean;       // No artifacts if BG removed
    color_accurate: boolean;         // No severe color shifts
    composition_balanced: boolean;   // Product centered, well-framed
  };
  confidence: number; // 0-100
  recommendation: 'pass' | 'retry' | 'fail';
}
```

**Why MVP**:
- ✅ **User trust**: Never show obviously bad outputs
- ✅ **Reduces support**: Fewer "why did this fail?" tickets
- ✅ **Cost efficiency**: Auto-retry saves manual resubmissions

**Implementation**:
- Gemini Vision 2.0 for quality assessment
- Configurable quality thresholds per workflow
- Automatic retry logic (max 1 retry per job)
- Human review queue for edge cases

**Cost**: Medium-High
- Model: Gemini 2.0 Flash (vision analysis)
- Expected usage: 1,000 validations/day (all jobs)
- Monthly cost: ~$75-90

**Complexity**: Medium
- Vision analysis: Straightforward
- Retry logic: Requires job state management
- Threshold tuning: Need baseline quality data

**Dependencies**:
- Job retry mechanism in n8n
- Quality criteria definitions per workflow

**Security Impact**: 🟢 Low risk
- Audit log all quality decisions
- Monitor for gaming (users intentionally generating bad outputs for refunds)

**Status**: ✅ MVP - Implement Week 2

---

### 5. PresetRecommendationAgent ⭐️ (MEDIUM-HIGH VALUE)

**Purpose**: Suggest relevant presets based on product type and user intent

**User Value**: 7/10 (Improves marketplace discoverability)

**Use Cases**:
- User uploads jewelry photo → Agent suggests "Luxury Jewelry", "Vintage Gold", "Minimalist Modern"
- User searches "vintage" → Agent ranks presets by semantic relevance
- User views preset → Agent suggests "Users also loved..."

**Example Interaction**:
```
User: [uploads antique ring photo]
Agent: "Based on your image, here are 3 recommended presets:

1. 🏆 Vintage Jewelry Glamour (★4.8, 1.2k uses)
   'Perfect for antique pieces - warm tones, nostalgic feel'

2. Luxury Heritage Collection (★4.6, 890 uses)
   'Emphasizes craftsmanship and historical elegance'

3. Classic Gold Radiance (★4.5, 2.1k uses)
   'Enhances gold tones with soft, timeless lighting'

Tap any preset to preview it on your image."
```

**Why MVP**:
- ✅ **Marketplace growth**: Helps new presets get discovered
- ✅ **User experience**: Reduces search time
- ✅ **Creator revenue**: More preset usage = more royalties

**Implementation**:
- Embedding-based semantic search (OpenAI text-embedding-3-small)
- Image analysis for content-based filtering
- Collaborative filtering (users who liked X also liked Y)
- Real-time ranking with popularity + relevance

**Cost**: Low
- Model: OpenAI embeddings ($0.02/1M tokens) + Gemini Vision (product analysis)
- Batch process preset embeddings (one-time: ~$5, updates: ~$0.50/day)
- Query cost: ~$0.001 per recommendation
- Expected usage: 500 recommendations/day
- Monthly cost: ~$15-20

**Complexity**: Low-Medium
- Embeddings: Standard RAG pattern
- Vision analysis: Reuses WorkflowRouterAgent logic
- Ranking algorithm: Weighted score (relevance × popularity × freshness)

**Dependencies**:
- Preset metadata (name, description, tags, usage_count, rating)
- Vector database (Supabase pgvector extension)

**Security Impact**: 🟢 Low risk
- Must prevent recommendation manipulation (fake usage counts)
- Audit log recommendation clicks for fraud detection

**Status**: ✅ MVP - Implement Week 3

---

## PHASE 2 AGENTS (Deferred - 6 Agents)

### 6. Marketplace Requirements Validator (DEFER TO PHASE 2)

**Purpose**: Validate outputs meet platform-specific requirements (Amazon, Etsy, Poshmark)

**User Value**: 6/10 (Valuable for power users, niche for MVP)

**Why Deferred**:
- ❌ **Niche feature**: Only 15-20% of users sell on specific platforms
- ❌ **High complexity**: Need to maintain specs for 10+ marketplaces
- ❌ **Data dependency**: Requires comprehensive platform specification database
- ✅ **Workaround exists**: Users can manually check platform requirements

**Phase 2 Timeline**: Month 3 post-launch (after user feedback on which platforms matter most)

**Estimated Effort**: 2 weeks (research specs, build validator, testing)

---

### 7. Batch Job Optimizer (DEFER TO PHASE 2)

**Purpose**: Intelligently queue and prioritize batch jobs for optimal throughput

**User Value**: 5/10 (Important at scale, premature for MVP)

**Why Deferred**:
- ❌ **Premature optimization**: MVP won't have enough load to justify
- ❌ **Requires data**: Need real usage patterns to optimize effectively
- ❌ **Diminishing returns**: n8n already has basic queuing
- ✅ **Simple alternative**: FIFO queue works fine for MVP scale

**Phase 2 Trigger**: When avg queue wait time exceeds 5 minutes

**Estimated Effort**: 1 week

---

### 8. Error Recovery Agent (DEFER TO PHASE 2)

**Purpose**: Diagnose job failures and suggest fixes or auto-recover

**User Value**: 7/10 (Reduces support burden, but need error data first)

**Why Deferred**:
- ❌ **Requires error knowledge base**: Don't know failure modes yet
- ❌ **Complex**: Needs integration with n8n error logs
- ❌ **Changing target**: Workflows will evolve rapidly in first 3 months
- ✅ **Manual alternative**: Support team can handle during MVP

**Phase 2 Timeline**: Month 2 post-launch (after collecting failure pattern data)

**Estimated Effort**: 2 weeks

---

### 9. User Onboarding Assistant (DEFER TO PHASE 2)

**Purpose**: Conversational guide for new users to understand workflows

**User Value**: 6/10 (Nice UX, but docs/videos work for MVP)

**Why Deferred**:
- ❌ **Alternative exists**: Quick-start guide + video tutorials
- ❌ **Medium cost**: Conversational agents are expensive per session
- ❌ **Low ROI initially**: Most MVP users are early adopters (self-sufficient)
- ✅ **Can A/B test**: Compare onboarding conversion with/without agent

**Phase 2 Timeline**: Month 4 post-launch (after measuring onboarding drop-off)

**Estimated Effort**: 1 week

---

### 10. Analytics Insight Generator (DEFER TO PHASE 2)

**Purpose**: Generate natural language insights about user's usage patterns

**User Value**: 5/10 (Engagement feature, not critical for core workflow)

**Why Deferred**:
- ❌ **Nice-to-have**: Doesn't impact core job success
- ❌ **Requires data**: Need 30+ days of user activity for meaningful insights
- ❌ **Low urgency**: Users care more about results than analytics
- ✅ **Simple alternative**: Basic usage dashboard with charts

**Phase 2 Timeline**: Month 6 post-launch (retention/engagement focus)

**Estimated Effort**: 1 week

---

### 11. A/B Test Coordinator (DEFER TO PHASE 2)

**Purpose**: Run multiple treatments in parallel, automatically select best output

**User Value**: 8/10 (High value for power users, but expensive)

**Why Deferred**:
- ❌ **Cost multiplier**: Runs 2-4x workflows per job (4x API costs)
- ❌ **Complex orchestration**: Requires parallel workflow execution
- ❌ **Advanced feature**: MVP users need simplicity first
- ❌ **Pricing model**: Need to figure out how to charge (4x cost = 4x price?)

**Phase 2 Timeline**: Month 5 post-launch (after introducing tiered pricing)

**Estimated Effort**: 2 weeks

---

## Cost Projection: MVP Agent System

### Monthly API Costs (at 1,000 jobs/day scale):

| Agent | Model | Usage | Cost/Month |
|-------|-------|-------|------------|
| SecurityScannerAgent | Claude Haiku | 1,000 scans/day | $10 |
| WorkflowRouterAgent | Gemini 2.0 Flash | 500 routes/day | $40 |
| PresetBuilderAgent | Claude Sonnet 3.5 | 100 conversations/day | $60 |
| QualityValidatorAgent | Gemini 2.0 Flash | 1,000 validations/day | $90 |
| PresetRecommendationAgent | OpenAI Embeddings + Gemini | 500 recs/day | $20 |
| **TOTAL MVP** | | | **$220/month** |

**Per-Job Agent Cost**: $0.22 (vs $0.15-1.50 for actual image generation)

**Profit Margin Impact**: Agent costs = ~15-20% of total AI costs (acceptable overhead for UX improvement)

---

## Implementation Roadmap

### Week 1 (Critical Path):
- ✅ SecurityScannerAgent (P0 - blocks marketplace launch)
- ✅ WorkflowRouterAgent (core UX)
- ✅ Agent security layer (cost caps, timeouts, PII scrubbing)
- ✅ Audit logging system

### Week 2 (User Experience):
- ✅ PresetBuilderAgent (marketplace growth)
- ✅ QualityValidatorAgent (satisfaction)

### Week 3 (Optimization):
- ✅ PresetRecommendationAgent (discoverability)
- ✅ Agent performance monitoring dashboard
- ✅ Security testing (injection attempts, cost overflow)

### Week 4 (Polish):
- ✅ Integration testing (all agents working together)
- ✅ Load testing (agent response times under load)
- ✅ Documentation (agent architecture, API usage)

---

## Success Metrics

### MVP Launch Targets (Month 1):

**Security**:
- ❌ Zero malicious presets published (100% blocked by SecurityScannerAgent)
- ✅ False positive rate < 5% (don't block legitimate presets)

**User Experience**:
- ✅ 70%+ of users use WorkflowRouterAgent instead of manual selection
- ✅ 80%+ of routed jobs result in 4+ star ratings
- ✅ 50%+ of presets created via PresetBuilderAgent (vs manual)

**Quality**:
- ✅ 90%+ of jobs pass QualityValidatorAgent on first attempt
- ✅ Auto-retry success rate > 60% (failed jobs fixed on retry)

**Discoverability**:
- ✅ 40%+ of preset uses come from PresetRecommendationAgent suggestions
- ✅ Avg click-through rate on recommendations > 15%

**Cost Control**:
- ✅ Agent costs stay under $500/month (first 3 months)
- ✅ No single user exceeds $50/month in agent costs

---

## Decision Log

**Date**: 2026-01-09
**Decision Maker**: Ralph Wiggum (Autonomous Architect)
**Approved By**: Rick B. (Product Owner)

**Key Decisions**:
1. ✅ Include 5 agents in MVP (not 11) - focus on core value
2. ✅ SecurityScannerAgent is non-negotiable (P0 security)
3. ✅ PresetBuilderAgent is key differentiator for marketplace
4. ✅ WorkflowRouterAgent solves #1 user pain point (decision paralysis)
5. ✅ Defer marketplace validator, batch optimizer, and onboarding assistant to Phase 2

**Rationale**: Maximize user value while minimizing complexity and cost. The 5 selected agents directly impact core workflows, security, and marketplace growth. Deferred agents either require data we don't have yet or address edge cases.

---

**Next Steps**: Proceed to AGENT-ARCHITECTURE.md design phase.

