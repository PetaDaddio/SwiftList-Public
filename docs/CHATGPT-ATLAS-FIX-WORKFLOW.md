# ChatGPT Atlas Agent Prompt - Fix and Organize n8n Workflow

Copy and paste this entire prompt into ChatGPT Atlas in Agent mode:

---

I need you to fix and organize my n8n workflow at https://cryptostrategy.app.n8n.cloud

**Workflow name:** "Content Factory - Intelligence Master" (or "CSG Content Factory")

## TASK 1: Delete the Old Trigger Node

1. **Find and DELETE the node named "A-Every 4 Hours"** (the old schedule trigger in the top left)
   - This is a duplicate trigger we don't need
   - Click on it and delete it
   - DO NOT delete "Schedule - Every 6 Hours" - we keep that one

## TASK 2: Fix the Twitter Scraper Connection

The "B-Scrape X (FIXED)" node needs to be properly integrated:

1. **Disconnect** "B-Scrape X (FIXED)" from wherever it's currently connected
2. **Connect it properly:**
   - **INPUT:** Draw a connection FROM "Schedule - Every 6 Hours" TO "B-Scrape X (FIXED)"
   - **OUTPUT:** Draw a connection FROM "B-Scrape X (FIXED)" TO "Merge All Sources" (as the FIRST input)
3. The flow should be: `Schedule → B-Scrape X → Merge All Sources`

## TASK 3: Organize the Workflow Layout

The nodes are scattered. Please reorganize them into a clean, logical layout:

### **Left Column - Trigger (Position: X=240):**
- "Schedule - Every 6 Hours" at position [240, 800]

### **Second Column - Data Sources (Position: X=460):**

**Twitter Source:**
- "B-Scrape X (FIXED)" at position [460, 100]

**RSS Feeds (stacked vertically, 80px apart):**
- "RSS - a16z Crypto" at position [460, 200]
- "RSS - Dragonfly" at position [460, 280]
- "RSS - Blockworks" at position [460, 360]
- "RSS - Bloomberg" at position [460, 440]
- "RSS - CoinDesk" at position [460, 520]
- "RSS - Cointelegraph" at position [460, 600]
- "RSS - Finance Magnates" at position [460, 680]
- "RSS - CryptoSlate" at position [460, 760]
- "RSS - FINRA News" at position [460, 840]
- "RSS - Google RWA" at position [460, 920]
- "RSS - The Block" at position [460, 1000]
- "RSS - Google Tokenized" at position [460, 1080]
- "RSS - Reuters" at position [460, 1160]
- "RSS - Messari" at position [460, 1240]
- "RSS - Ondo Finance" at position [460, 1320]
- "RSS - Ondo Foundation" at position [460, 1400]
- "RSS - Centrifuge" at position [460, 1480]
- "RSS - Blockchain Capital" at position [460, 1560]
- "RSS - Pantera Capital" at position [460, 1640]

### **Third Column - Processing (Position: X=680, X=900, X=1120):**
- "Merge All Sources" at position [680, 800]
- "Normalize All Sources" at position [900, 800]
- "Google Sheets - Append All" at position [1120, 800]

## TASK 4: Verify All Connections

After organizing, verify these connections are correct:

**FROM "Schedule - Every 6 Hours" TO:**
- B-Scrape X (FIXED)
- RSS - a16z Crypto
- RSS - Dragonfly
- RSS - Blockworks
- RSS - Bloomberg
- RSS - CoinDesk
- RSS - Cointelegraph
- RSS - Finance Magnates
- RSS - CryptoSlate
- RSS - FINRA News
- RSS - Google RWA
- RSS - The Block
- RSS - Google Tokenized
- RSS - Reuters
- RSS - Messari
- RSS - Ondo Finance
- RSS - Ondo Foundation
- RSS - Centrifuge
- RSS - Blockchain Capital
- RSS - Pantera Capital

**(All of the above connect TO "Merge All Sources")**

**Then the linear flow:**
- Merge All Sources → Normalize All Sources → Google Sheets - Append All

## TASK 5: Update the "Normalize All Sources" Code

The code node needs to handle Twitter data from the "B-Scrape X" node.

1. Click on "Normalize All Sources" node
2. Find the JavaScript code inside
3. Make sure the `feedMap` object includes ALL these entries:

```javascript
const feedMap = {
  'blockworks': { name: 'Blockworks', priority: 'high', bias: 2 },
  'bloomberg': { name: 'Bloomberg', priority: 'high', bias: 2 },
  'coindesk': { name: 'CoinDesk', priority: 'medium', bias: 0 },
  'cointelegraph': { name: 'Cointelegraph', priority: 'medium', bias: 0 },
  'financemagnates': { name: 'Finance Magnates', priority: 'medium', bias: 1 },
  'cryptoslate': { name: 'CryptoSlate', priority: 'medium', bias: 1 },
  'finra': { name: 'FINRA', priority: 'high', bias: 2 },
  'google.com/news': { name: 'Google News', priority: 'medium', bias: 0 },
  'theblock': { name: 'The Block', priority: 'high', bias: 2 },
  'reuters': { name: 'Reuters', priority: 'high', bias: 2 },
  'messari': { name: 'Messari', priority: 'high', bias: 2 },
  'a16zcrypto': { name: 'a16z Crypto', priority: 'very_high', bias: 3 },
  'dragonfly': { name: 'Dragonfly Capital', priority: 'very_high', bias: 3 },
  'ondo.finance': { name: 'Ondo Finance', priority: 'very_high', bias: 3 },
  'ondo.foundation': { name: 'Ondo Foundation', priority: 'very_high', bias: 3 },
  'centrifuge.io': { name: 'Centrifuge', priority: 'very_high', bias: 3 },
  'blockchain-capital': { name: 'Blockchain Capital', priority: 'very_high', bias: 3 },
  'panteracapital': { name: 'Pantera Capital', priority: 'very_high', bias: 3 }
};
```

4. Save the code

## TASK 6: Add Missing RSS Feeds (if not present)

Check if these RSS nodes exist. If missing, add them:

1. **RSS - a16z Crypto**
   - URL: `https://a16zcrypto.com/feed/`

2. **RSS - Dragonfly**
   - URL: `https://www.dragonfly.xyz/feed`

If they're missing, create them and connect them like the other RSS nodes.

## TASK 7: Save and Test

1. **Save the workflow** (click Save button)
2. **Take a screenshot** of the organized workflow
3. **Click "Execute Workflow"** to test it
4. **Report back with:**
   - Screenshot showing the clean, organized layout
   - Confirmation that "A-Every 4 Hours" was deleted
   - Confirmation that all connections are correct
   - Test execution results (should show data flowing to Google Sheets)

## VISUAL REFERENCE - Final Layout Should Look Like:

```
[Schedule - Every 6 Hours]
    ├─→ [B-Scrape X] ────────────┐
    ├─→ [RSS - a16z Crypto] ─────┤
    ├─→ [RSS - Dragonfly] ───────┤
    ├─→ [RSS - Blockworks] ──────┤
    ├─→ [RSS - Bloomberg] ───────┤
    ├─→ [RSS - CoinDesk] ────────┤
    ├─→ [RSS - Cointelegraph] ───┤
    ├─→ [RSS - Finance Magnates] ┤
    ├─→ [RSS - CryptoSlate] ─────┤
    ├─→ [RSS - FINRA News] ──────┤
    ├─→ [RSS - Google RWA] ──────┤
    ├─→ [RSS - The Block] ───────┤
    ├─→ [RSS - Google Tokenized]─┤
    ├─→ [RSS - Reuters] ─────────┤
    ├─→ [RSS - Messari] ─────────┤
    ├─→ [RSS - Ondo Finance] ────┤
    ├─→ [RSS - Ondo Foundation] ─┤
    ├─→ [RSS - Centrifuge] ──────┤
    ├─→ [RSS - Blockchain Cap.] ─┤
    └─→ [RSS - Pantera Capital] ─┤
                                  ↓
                    [Merge All Sources]
                             ↓
                [Normalize All Sources]
                             ↓
              [Google Sheets - Append All]
```

## IMPORTANT NOTES:

- **DO NOT delete any RSS nodes** that are already there
- **DO NOT change the Google Sheets node** configuration
- **DO NOT change the Apify configuration** in "B-Scrape X (FIXED)"
- **ONLY delete** the "A-Every 4 Hours" trigger node
- **The workflow should have exactly ONE trigger**: "Schedule - Every 6 Hours"
- **All RSS nodes should be perfectly aligned** in a vertical column at X=460
- **The processing nodes should be horizontal** at Y=800

## SUCCESS CRITERIA:

✅ Clean, organized layout with nodes properly aligned
✅ Only ONE schedule trigger (Every 6 Hours)
✅ Twitter scraper (B-Scrape X) properly connected
✅ All 19 RSS feeds present and connected
✅ All connections verified and working
✅ Workflow executes successfully
✅ Data flows to Google Sheets

---

END OF PROMPT

**After you paste this into Atlas, let it work for 2-3 minutes, then report back with the results!**
