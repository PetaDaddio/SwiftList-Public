/**
 * WF-13: Facebook Post Generator
 *
 * Creates long-form storytelling copy for Facebook
 *
 * Priority: SOCIAL MEDIA
 * Cost: $0.053 | Credits: 10 | Revenue: $0.50 | Margin: 89.4%
 * AI: Anthropic Claude 3.5 Sonnet
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface FacebookInput {
  product_image: string;
  product_name: string;
  product_story?: string;
}

interface FacebookOutput {
  post_content: string;
  word_count: number;
  engagement_hooks: string[];
  cta: string;
}

export class FacebookPostGeneratorWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as FacebookInput;

      // Validate inputs
      if (!input.product_image || !input.product_name) {
        throw new Error('Missing required fields: product_image, product_name');
      }

      await this.updateProgress(25, 'Analyzing product story potential');
      const imageBuffer = await this.downloadImage(input.product_image);
      const base64Image = imageBuffer.toString('base64');

      await this.updateProgress(50, 'Generating long-form Facebook content');

      // Generate Facebook post with Claude
      const fbContent = await this.generateFacebookPost(
        base64Image,
        input.product_name,
        input.product_story
      );

      await this.updateProgress(75, 'Optimizing for engagement');

      const output: FacebookOutput = {
        post_content: fbContent.post_content,
        word_count: fbContent.word_count,
        engagement_hooks: fbContent.engagement_hooks,
        cta: fbContent.cta
      };

      await this.updateProgress(100, 'Facebook content ready');

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
   * Generate Facebook post using Claude 3.5 Sonnet
   */
  private async generateFacebookPost(
    base64Image: string,
    productName: string,
    productStory?: string
  ): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const systemPrompt = 'You are a Facebook content creator specializing in storytelling and community engagement.';

    const userPrompt = `Create a long-form Facebook post for this product: "${productName}"
${productStory ? `Background story: ${productStory}` : ''}

Requirements:
- Long-form post (500-1000 words)
- Focus on emotional connection and storytelling
- Include benefits and community value
- End with clear call-to-action
- Natural, conversational tone

Return JSON format:
{
  "post_content": "string (500-1000 words)",
  "word_count": number,
  "engagement_hooks": ["hook1", "hook2"],
  "cta": "call to action"
}`;

    const response = await this.callAPI(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 3000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Image
                  }
                },
                {
                  type: 'text',
                  text: userPrompt
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.content?.[0]?.text;

    if (!textContent) {
      throw new Error('No response from Claude');
    }

    // Parse JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Claude');
    }

    return JSON.parse(jsonMatch[0]);
  }
}
