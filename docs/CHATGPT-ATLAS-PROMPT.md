# ChatGPT Atlas Agent Prompt - Update n8n Workflow

Copy and paste this entire prompt into ChatGPT Atlas in Agent mode:

---

I need you to update my n8n workflow at https://cryptostrategy.app.n8n.cloud

**Credentials:**
- Use my saved n8n credentials if available
- Workflow name: "Content Factory - Intelligence Master" or "CSG Content Factory"

**Task: Add 5 New RSS Feed Nodes**

Add these RSS feed sources to the existing workflow:

1. **Ondo Finance Blog**
   - URL: `https://blog.ondo.finance/feed/`
   - Node name: "RSS - Ondo Finance"
   - Priority: very_high
   - Signal bias: 3

2. **Ondo Foundation Blog**
   - URL: `https://blog.ondo.foundation/feed/`
   - Node name: "RSS - Ondo Foundation"
   - Priority: very_high
   - Signal bias: 3

3. **Centrifuge Blog**
   - URL: `https://centrifuge.io/blog/feed/`
   - Node name: "RSS - Centrifuge"
   - Priority: very_high
   - Signal bias: 3

4. **Blockchain Capital Medium**
   - URL: `https://medium.com/feed/blockchain-capital-blog`
   - Node name: "RSS - Blockchain Capital"
   - Priority: very_high
   - Signal bias: 3

5. **Pantera Capital Newsletter**
   - URL: `https://panteracapital.com/blockchain-letter/feed/`
   - Node name: "RSS - Pantera Capital"
   - Priority: very_high
   - Signal bias: 3

**Instructions:**

1. **Log into n8n** at https://cryptostrategy.app.n8n.cloud
2. **Open the workflow** named "Content Factory - Intelligence Master" or similar
3. **For each RSS feed above:**
   - Add a new "RSS Feed Read" node
   - Set the URL parameter to the feed URL
   - Name the node as specified
   - Position it vertically with the other RSS nodes
4. **Connect each new RSS node:**
   - Input: Connect from "Schedule - Every 6 Hours" trigger
   - Output: Connect to "Merge All Sources" node
5. **Update the "Normalize All Sources" code node:**
   - Find the `feedMap` object in the JavaScript code
   - Add these entries to the feedMap:
   ```javascript
   'ondo.finance': { name: 'Ondo Finance', priority: 'very_high', bias: 3 },
   'ondo.foundation': { name: 'Ondo Foundation', priority: 'very_high', bias: 3 },
   'centrifuge.io': { name: 'Centrifuge', priority: 'very_high', bias: 3 },
   'blockchain-capital': { name: 'Blockchain Capital', priority: 'very_high', bias: 3 },
   'panteracapital': { name: 'Pantera Capital', priority: 'very_high', bias: 3 }
   ```
6. **Save the workflow**
7. **Test the workflow** by clicking "Execute Workflow"
8. **Report back** with:
   - Screenshot of the updated workflow
   - Confirmation that all 5 feeds were added
   - Test execution results

**Context:**
These are high-priority RSS feeds for Real World Asset (RWA) and crypto tokenization news. Ondo Finance and Centrifuge are major players in the RWA space. Their investor blogs (Blockchain Capital, Pantera) also provide alpha.

**Important Notes:**
- Don't delete any existing nodes
- Keep all existing connections intact
- The workflow should run every 6 hours
- All feeds merge into "Merge All Sources" then "Normalize All Sources" then "Google Sheets - Append All"

---

END OF PROMPT
