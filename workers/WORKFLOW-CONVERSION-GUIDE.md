# Workflow Conversion Guide - n8n to TypeScript Workers

**Purpose**: Step-by-step guide for converting the remaining 46 n8n workflows to TypeScript workers

**Time per Workflow**: 2-3 hours (avg)
**Total Estimated Time**: 80-120 hours

---

## Conversion Process (5 Steps)

### Step 1: Analyze n8n Workflow JSON

**Example**: WF-10 (Product Description)

**n8n JSON** (`/n8n-workflows/json/WF-10-product-description.json`):
```json
{
  "nodes": [
    {
      "name": "Claude API",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.anthropic.com/v1/messages",
        "method": "POST",
        "authentication": "headerAuth",
        "body": {
          "model": "claude-3-5-sonnet-20241022",
          "messages": [
            {
              "role": "user",
              "content": "Generate a product description for: {{$json.image_url}}"
            }
          ]
        }
      }
    }
  ]
}
```

**Identify**:
- API provider: Claude (Anthropic)
- Input: Image URL
- Output: Product description text
- Cost: ~$0.0015 per description

---

### Step 2: Create Worker Class

**File**: `/workers/src/workers/ProductDescriptionWorker.ts`

```typescript
import { Job } from 'bullmq';
import { BaseWorker, WorkerResult, JobData } from '../core/BaseWorker';
import { ResilienceStrategy } from '../core/ResilienceStrategy';
import Anthropic from '@anthropic-ai/sdk';

export class ProductDescriptionWorker extends BaseWorker {
  private claude: Anthropic;
  private resilience: ResilienceStrategy;

  constructor() {
    super({
      name: 'ProductDescriptionWorker',
      concurrency: 10, // Text generation is fast, higher concurrency
      maxRetries: 3,
      timeout: 20000, // 20 seconds
    });

    this.claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.resilience = new ResilienceStrategy();
  }

  protected async processJob(job: Job<JobData>): Promise<WorkerResult> {
    const { jobId, inputUrl } = job.data;

    console.log(`[ProductDescription] Processing job ${jobId}`);

    // Check circuit breaker
    const available = await this.resilience.checkCircuitBreaker('claude');
    if (!available) throw new Error('Claude API unavailable');

    // Call Claude API with retry logic
    const response = await this.resilience.executeWithRetry(async () => {
      return await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Generate a compelling product description for this image: ${inputUrl}. Include:
            - Key features and benefits
            - Target audience
            - SEO-optimized keywords
            - Compelling call-to-action`,
          },
        ],
      });
    });

    // Extract description
    const description = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Save description to database (not Supabase Storage, since it's text)
    await this.supabase
      .from('jobs')
      .update({ output_data: { description } })
      .eq('job_id', jobId);

    // Calculate cost (Claude Sonnet pricing)
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = (inputTokens * 0.000003) + (outputTokens * 0.000015);

    return {
      success: true,
      metadata: { description, tokens: response.usage },
      costUsd,
    };
  }
}
```

---

### Step 3: Register in Workflow Registry

**File**: `/workers/src/config/workflows.config.ts`

```typescript
export const workflowRegistry: Record<string, WorkflowDefinition> = {
  // ... existing workflows ...

  'WF-10': {
    workflowId: 'WF-10',
    name: 'Product Description',
    queueName: 'product-description',
    workerClass: 'ProductDescriptionWorker',
    estimatedCostUsd: 0.0015,
    estimatedDurationMs: 2000,
    maxRetries: 3,
    timeout: 20000,
    priority: 9,
    providers: ['claude'],
  },
};
```

---

### Step 4: Initialize Worker in index.ts

**File**: `/workers/src/index.ts`

```typescript
// Import new worker
import { ProductDescriptionWorker } from './workers/ProductDescriptionWorker';

// Initialize worker
const productDescriptionWorker = new ProductDescriptionWorker();
const pdWorker = new Worker(
  'product-description',
  async (job) => {
    return await productDescriptionWorker.execute(job);
  },
  {
    connection: redis,
    concurrency: productDescriptionWorker.getConfig().concurrency,
  }
);

workers.push(pdWorker);
console.log('✅ ProductDescriptionWorker registered');
```

---

### Step 5: Test Worker

**Test Script** (`/workers/test-worker.ts`):

```typescript
import { WorkflowOrchestrator } from './src/core/WorkflowOrchestrator';

const orchestrator = new WorkflowOrchestrator();

// Submit test job
const result = await orchestrator.submitJob({
  workflowId: 'WF-10',
  userId: 'test-user',
  imageUrl: 'https://example.com/test-product.jpg',
});

console.log('Job submitted:', result);

// Wait for completion
// (In production, user polls /api/jobs/[id] endpoint)
```

**Run**:
```bash
npm run build
npx tsx test-worker.ts
```

---

## Conversion Templates by Provider

### Template 1: Replicate API

**Used by**: WF-04 (BG Removal), WF-14 (Upscale), WF-09 (Lifestyle)

```typescript
protected async processJob(job: Job<JobData>): Promise<WorkerResult> {
  const output = await this.resilience.executeWithRetry(async () => {
    return await this.replicate.run('model/name:version', {
      input: { image: job.data.inputUrl },
    });
  });

  // Upload output to Supabase Storage
  const blob = await fetch(output).then((r) => r.blob());
  // ... upload logic ...

  return { success: true, outputUrl: '...', costUsd: 0.005 };
}
```

### Template 2: Claude API

**Used by**: WF-10 (Product Description), WF-17 (Preset Generation)

```typescript
protected async processJob(job: Job<JobData>): Promise<WorkerResult> {
  const response = await this.resilience.executeWithRetry(async () => {
    return await this.claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: 'Prompt here' }],
    });
  });

  const text = response.content[0].text;
  const costUsd = (response.usage.input_tokens * 0.000003) +
                  (response.usage.output_tokens * 0.000015);

  return { success: true, metadata: { text }, costUsd };
}
```

### Template 3: Gemini API

**Used by**: WF-11 (Facebook), WF-12 (Instagram), WF-13 (Twitter)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

protected async processJob(job: Job<JobData>): Promise<WorkerResult> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const result = await this.resilience.executeWithRetry(async () => {
    return await model.generateContent({
      contents: [{ parts: [{ text: 'Prompt here' }] }],
    });
  });

  const text = result.response.text();
  const costUsd = 0.0005; // Gemini Flash pricing

  return { success: true, metadata: { text }, costUsd };
}
```

### Template 4: OpenAI API

**Used by**: WF-17 (Embeddings), WF-04 (DALL-E)

```typescript
import OpenAI from 'openai';

protected async processJob(job: Job<JobData>): Promise<WorkerResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Text embedding
  const embedding = await this.resilience.executeWithRetry(async () => {
    return await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Text to embed',
    });
  });

  const vector = embedding.data[0].embedding;
  const costUsd = 0.00002; // OpenAI embedding pricing

  return { success: true, metadata: { vector }, costUsd };
}
```

---

## Workflow Priority List

### Phase 2: Core Features (Week 2) - **4 workflows**

1. **WF-10: Product Description** (Template 2: Claude)
   - Time: 2 hours
   - Priority: High (99.6% margin)

2. **WF-14: High-Res Upscale** (Template 1: Replicate)
   - Time: 2 hours
   - Priority: High (user-requested)

3. **WF-17: Preset Generation** (Template 2: Claude + Template 4: OpenAI)
   - Time: 4 hours (combines embeddings + Claude)
   - Priority: Critical (marketplace dependency)

4. **WF-07: Simplify Background** (Template 1: Replicate)
   - Time: 2 hours
   - Priority: Medium

**Total**: 10 hours

---

### Phase 3: Social Media (Week 3) - **3 workflows**

5. **WF-11: Facebook Image** (Template 3: Gemini)
   - Time: 2 hours

6. **WF-12: Instagram Image** (Template 3: Gemini)
   - Time: 2 hours

7. **WF-13: Twitter/X Image** (Template 3: Gemini)
   - Time: 2 hours

**Total**: 6 hours

---

### Phase 4: Advanced (Weeks 4-8) - **40 workflows**

**Categories**:
- Product Engines (WF-02, WF-03, WF-05, WF-06): 20 hours
- Video (WF-18, WF-22, WF-39, WF-45-49): 30 hours
- System (WF-24, WF-28, WF-00): 10 hours
- Remaining: 50 hours

**Total**: 110 hours

---

## Common Pitfalls & Solutions

### Pitfall 1: Memory Leaks

**Symptom**: Worker OOM (Out of Memory) errors

**Cause**: Loading entire images into memory

**Solution**: Use streaming
```typescript
// ❌ BAD: Load entire file into memory
const buffer = await fs.readFile(imagePath);

// ✅ GOOD: Stream directly to storage
const stream = fs.createReadStream(imagePath);
await this.supabase.storage.from('bucket').upload(fileName, stream);
```

---

### Pitfall 2: Incorrect Cost Calculation

**Symptom**: Billing mismatches

**Cause**: Using estimated costs instead of actual usage

**Solution**: Calculate from API response
```typescript
// ❌ BAD: Fixed cost
const costUsd = 0.003;

// ✅ GOOD: Calculate from tokens
const costUsd = (response.usage.input_tokens * PRICE_PER_INPUT_TOKEN) +
                (response.usage.output_tokens * PRICE_PER_OUTPUT_TOKEN);
```

---

### Pitfall 3: Missing Circuit Breaker

**Symptom**: Cascading failures when provider is down

**Cause**: Not checking circuit breaker before API calls

**Solution**: Always check before calling
```typescript
// ✅ GOOD: Check circuit breaker
const available = await this.resilience.checkCircuitBreaker('replicate');
if (!available) throw new Error('Provider unavailable');

const output = await this.replicate.run(...);

// Record success
await this.resilience.recordCircuitBreakerSuccess('replicate');
```

---

## Testing Checklist

Before deploying a new worker:

- [ ] Worker extends `BaseWorker`
- [ ] Implements `processJob()` method
- [ ] Uses `ResilienceStrategy.executeWithRetry()`
- [ ] Checks circuit breaker before API calls
- [ ] Calculates exact cost (not estimated)
- [ ] Uploads output to Supabase Storage (for images) or database (for text)
- [ ] Returns `WorkerResult` with `success`, `outputUrl`, `costUsd`
- [ ] Registered in `workflows.config.ts`
- [ ] Initialized in `index.ts`
- [ ] Tested with real job submission
- [ ] Verified in Railway logs

---

## Estimated Timeline

| Phase | Workflows | Hours | Calendar |
|-------|-----------|-------|----------|
| **Phase 1 (MVP)** | 1 (WF-04) | ✅ Complete | Week 1 |
| **Phase 2 (Core)** | 4 (WF-07, 10, 14, 17) | 10 hours | Week 2 |
| **Phase 3 (Social)** | 3 (WF-11, 12, 13) | 6 hours | Week 3 |
| **Phase 4 (Advanced)** | 40 workflows | 110 hours | Weeks 4-8 |
| **TOTAL** | **47 workflows** | **121 hours** | **8 weeks** |

**Recommendation**: Convert workflows **on-demand** based on user requests, not all upfront.

---

## Support & References

**BaseWorker**: `/workers/src/core/BaseWorker.ts`
**Example Worker**: `/workers/src/workers/BackgroundRemovalWorker.ts`
**Workflow Registry**: `/workers/src/config/workflows.config.ts`
**n8n Workflows**: `/n8n-workflows/json/`

---

**Document Status**: ✅ Reference Guide
**Last Updated**: January 21, 2026
