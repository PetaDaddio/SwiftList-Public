# Content Factory + Apify Integration

Since you have an Apify account and API, we can build a MUCH more powerful intelligence gathering system!

## Why Apify is Perfect for Content Factory

**Problem:** VCs and founders share best insights on LinkedIn/Twitter, but:
- No easy RSS feeds for social media
- Feedly doesn't capture Twitter/LinkedIn
- Manual checking is time-consuming

**Solution:** Apify scrapers → n8n → Content Factory

## Apify Actors You Can Use

### 1. LinkedIn Profile Scraper
**Actor:** `apify/linkedin-profile-scraper`
**What it does:** Scrapes LinkedIn profiles and posts
**Use for:** VC and founder LinkedIn updates

**Example VCs to scrape:**
- Chris Dixon (a16z)
- Matt Huang (Paradigm)
- Haseeb Qureshi (Dragonfly)
- Kyle Samani (Multicoin)

### 2. Twitter Scraper (X Scraper)
**Actor:** `apify/twitter-scraper` or `apify/tweet-scraper`
**What it does:** Scrapes tweets from specific accounts
**Use for:** Real-time VC/founder insights

**Example founders to scrape:**
- Vitalik Buterin (@VitalikButerin)
- Anatoly Yakovenko (@aeyakovenko)
- Stani Kulechov (@StaniKulechov)
- Carlos Domingo (@carlosdomingo) - Securitize

### 3. LinkedIn Company Scraper
**Actor:** `apify/linkedin-company-scraper`
**What it does:** Scrapes company pages and posts
**Use for:** RWA platforms, crypto infrastructure companies

**Companies to monitor:**
- Securitize
- Polymath
- Figure Technologies
- Ondo Finance
- Centrifuge

### 4. Web Scraper (Universal)
**Actor:** `apify/web-scraper`
**What it does:** Scrapes any website
**Use for:** VC blogs that don't have RSS

## New Content Factory Architecture

```
┌─────────────────────────────────────────┐
│         Intelligence Gathering          │
├─────────────────────────────────────────┤
│                                         │
│  RSS Feeds (VCs, Research)             │
│  └─> n8n RSS nodes                     │
│                                         │
│  Apify LinkedIn Scraper                │
│  └─> VC profiles → n8n Apify node      │
│                                         │
│  Apify Twitter Scraper                 │
│  └─> Founder tweets → n8n Apify node   │
│                                         │
│  All sources ↓                          │
│                                         │
│  Gemini Flash: Signal Detection        │
│  └─> Score 1-10, filter ≥7             │
│                                         │
│  Google Sheets: Content Queue          │
│                                         │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│         Content Generation              │
├─────────────────────────────────────────┤
│  Claude 3.5 Sonnet + NotebookLM        │
│  └─> Generate blog post                │
│                                         │
│  Imagen 3: Featured image              │
│                                         │
│  WordPress: Publish draft              │
└─────────────────────────────────────────┘
```

## n8n Workflows with Apify

### Workflow 1: LinkedIn VC Scraper

**Schedule:** Once per day (morning)

**Flow:**
```
Schedule Trigger (daily at 8am)
  ↓
Apify - LinkedIn Profile Scraper
  └─> Input: List of VC LinkedIn profile URLs
  └─> Returns: Latest posts from each VC
  ↓
Filter: Only posts from last 24 hours
  ↓
Gemini Flash: Signal Detection
  └─> Score each post 1-10
  ↓
Filter: Signal ≥ 8 (LinkedIn posts are high-signal)
  ↓
Google Sheets: Append to Content Queue
  └─> Mark source: "LinkedIn - [VC Name]"
```

### Workflow 2: Twitter Founder Monitor

**Schedule:** 3x per day (morning, afternoon, evening)

**Flow:**
```
Schedule Trigger (8am, 2pm, 8pm)
  ↓
Apify - Twitter Scraper
  └─> Input: List of founder Twitter handles
  └─> Returns: Latest tweets + threads
  ↓
Filter: Only from last 8 hours
  ↓
Filter: Exclude replies (or include based on context)
  ↓
Gemini Flash: Signal Detection
  └─> Score each tweet/thread 1-10
  └─> Bonus points for threads (more depth)
  ↓
Filter: Signal ≥ 7
  ↓
Google Sheets: Append to Content Queue
```

### Workflow 3: VC Blog Monitor (No RSS)

**Schedule:** Daily

**Flow:**
```
Schedule Trigger (daily)
  ↓
Apify - Web Scraper
  └─> Input: VC blog URLs without RSS
  └─> Example: Paradigm research page
  └─> Returns: Latest blog posts
  ↓
Filter: New posts since last check
  ↓
Gemini Flash: Signal Detection
  ↓
Filter: Signal ≥ 8
  ↓
Google Sheets: Append to Content Queue
```

## Configuration Lists

### LinkedIn VCs to Monitor

Create in Apify/n8n as array:
```json
[
  "https://www.linkedin.com/in/chrisdixon/",
  "https://www.linkedin.com/in/matthuang/",
  "https://www.linkedin.com/in/hosseeb/",
  "https://www.linkedin.com/in/kylejsamani/",
  "https://www.linkedin.com/in/nic-carter/",
  "https://www.linkedin.com/in/carlosdomingo/",
  "https://www.linkedin.com/in/runekek/"
]
```

### Twitter Handles to Monitor

```json
[
  "cdixon",
  "matthuang",
  "hosseeb",
  "KyleSamani",
  "nic__carter",
  "VitalikButerin",
  "aeyakovenko",
  "StaniKulechov",
  "carlosdomingo",
  "RuneKek",
  "ljxie",
  "jessewldn"
]
```

### RWA Company LinkedIn Pages

```json
[
  "https://www.linkedin.com/company/securitize/",
  "https://www.linkedin.com/company/polymath-network/",
  "https://www.linkedin.com/company/figure-technologies/",
  "https://www.linkedin.com/company/ondo-finance/",
  "https://www.linkedin.com/company/centrifuge/"
]
```

## Apify in n8n Setup

### Step 1: Add Apify Credential to n8n

1. Log into: https://cryptostrategy.app.n8n.cloud
2. Go to: Credentials → Add Credential
3. Search: "Apify"
4. Add your Apify API token
5. Test connection

### Step 2: Install Apify Node (if not already)

n8n cloud should have Apify node by default. If not:
- Settings → Community Nodes
- Search: n8n-nodes-apify
- Install

### Step 3: Create Workflow

Use Apify node in your workflow:
```
Node: Apify
├─ Actor: linkedin-profile-scraper
├─ Run Mode: Blocking (wait for results)
├─ Input:
│  └─ startUrls: [{ url: "linkedin-profile-url" }]
├─ Dataset Mapping: Full
└─ Output: JSON
```

## Cost Considerations

**Apify Pricing:**
- Free tier: $5 credit/month
- Paid: Pay-as-you-go for scraping

**Typical costs:**
- LinkedIn profile scrape: $0.01-0.05 per profile
- Twitter scrape: $0.005-0.02 per 100 tweets
- Web scraper: $0.01-0.10 per site

**For Content Factory (estimated):**
- 10 LinkedIn VCs daily: ~$0.50/day = $15/month
- 15 Twitter accounts 3x/day: ~$1/day = $30/month
- Total Apify: ~$45/month

**Still cheaper than:** Zapier + manual monitoring ($100+/month)

## Feedly Alternative Strategy

**Original plan:** RSS feeds only
**New plan with Apify:** RSS + Social scraping

### For Feedly:

**Option 1: Export OPML and use RSS directly**
- Free, works great for blogs/news sites
- Use for: VC blogs with RSS, research sites

**Option 2: Apify Feedly Scraper (if exists)**
- Check if there's an Apify actor for Feedly
- Probably not needed if we use RSS directly

**Option 3: Use Claude Browser Extension manually**
- When you need deep Feedly curation
- Export specific feeds to add to RSS list

**Recommendation:** Use RSS for blogs + Apify for LinkedIn/Twitter

## Signal Scoring Adjustments

Social media posts need different scoring:

**LinkedIn Posts:**
- Minimum signal threshold: 8 (LinkedIn = high-effort content)
- Bonus for: Company updates, partnership announcements
- Filter out: Job postings, generic "thoughts on..."

**Twitter/X:**
- Minimum signal threshold: 7
- Bonus for: Threads (indicate depth)
- Bonus for: Original data/charts
- Filter out: Single tweet opinions, retweets without comment

**VC Blogs:**
- Minimum signal threshold: 9 (everything they publish is high-signal)
- Always include if new

## Next Steps for Apify Integration

1. **Log into your Apify account**
2. **Get your Apify API token**
3. **Add to n8n credentials**
4. **Test one scraper** (LinkedIn profile or Twitter)
5. **Create lists** of VCs/founders to monitor
6. **Build first Apify workflow** in n8n
7. **Test signal detection** with scraped content
8. **Combine with RSS** aggregator

## Workflow Files to Create

I can create these n8n workflow JSONs for you:

1. `workflows/intelligence/apify-linkedin-vcs-v1.json`
2. `workflows/intelligence/apify-twitter-founders-v1.json`
3. `workflows/intelligence/apify-rwa-companies-v1.json`

**Want me to create these now?**

## Benefits of Apify Integration

✅ **Capture LinkedIn insights** (VCs share alpha here)
✅ **Monitor Twitter threads** (founders share real-time updates)
✅ **Track RWA companies** (product launches, partnerships)
✅ **No RSS needed** (works for any platform)
✅ **Automated** (runs on schedule, no manual checking)
✅ **Combined with RSS** (comprehensive intelligence gathering)
✅ **Signal filtered** (only high-quality content reaches you)

This is WAY more powerful than Feedly alone!
