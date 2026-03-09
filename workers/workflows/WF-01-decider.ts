/**
 * WF-01: The Decider (Orchestrator)
 *
 * Classification & Risk Analysis Router
 * Routes all jobs to appropriate specialized workflows based on product category
 *
 * Priority: CRITICAL - BUILD FIRST
 * Cost: $0.001 | Credits: 0 (Internal routing)
 * AI: Google Vertex AI Gemini 2.0 Flash Vision
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface DeciderInput {
  image_url: string;
  product_type?: string;
}

interface DeciderOutput {
  category: string;
  risk: string;
  route: string;
  confidence: number;
  reasoning: string;
}

export class DeciderWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as DeciderInput;

      // Validate inputs
      if (!input.image_url) {
        throw new Error('Missing required field: image_url');
      }

      await this.updateProgress(25, 'Downloading product image');
      const imageBuffer = await this.downloadImage(input.image_url);
      const base64Image = imageBuffer.toString('base64');

      await this.updateProgress(50, 'Analyzing product category with Gemini Vision');

      // Call Google Vertex AI Gemini Vision for classification
      const classification = await this.classifyProduct(base64Image);

      await this.updateProgress(75, 'Determining optimal workflow route');

      // Route to appropriate workflow based on category
      const route = this.determineRoute(classification.category);

      const output: DeciderOutput = {
        category: classification.category,
        risk: classification.risk,
        route,
        confidence: classification.confidence,
        reasoning: classification.reasoning
      };

      await this.updateProgress(100, 'Classification complete');

      return {
        success: true,
        output_data: output
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Call Gemini Vision to classify product
   */
  private async classifyProduct(base64Image: string): Promise<any> {
    const apiKey = process.env.GOOGLE_VERTEX_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_VERTEX_KEY not configured');
    }

    const prompt = `Analyze this product image and classify it into one of these categories:
- jewelry: Watches, rings, necklaces, earrings, bracelets, any metallic/reflective jewelry
- fashion: Clothing, apparel, shoes, bags, accessories
- glass_liquid: Glass bottles, crystal, transparent containers, liquids
- furniture: Chairs, tables, beds, large furniture items
- general: Everything else (electronics, toys, kitchen items, etc)

Also assess the risk level (high/medium/low) based on:
- Reflective surfaces (jewelry, glass)
- Transparent materials (glass, liquids)
- Complex fabrics (fashion)
- Spatial depth (furniture)

Return JSON format:
{
  "category": "jewelry|fashion|glass_liquid|furniture|general",
  "risk": "high|medium|low",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification"
}`;

    const response = await this.callAPI(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 500,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error('No response from Gemini Vision');
    }

    // Parse JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Determine which workflow to route to based on category
   */
  private determineRoute(category: string): string {
    const routes: Record<string, string> = {
      jewelry: 'WF-02',
      fashion: 'WF-03',
      glass_liquid: 'WF-04',
      furniture: 'WF-05',
      general: 'WF-06'
    };

    return routes[category] || 'WF-06'; // Default to general
  }
}
