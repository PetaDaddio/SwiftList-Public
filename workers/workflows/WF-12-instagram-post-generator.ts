/**
 * WF-12: Instagram Post Generator
 *
 * Creates Instagram caption and first comment with hashtags
 *
 * Priority: SOCIAL MEDIA
 * Cost: $0.053 | Credits: 10 | Revenue: $0.50 | Margin: 89.4%
 * AI: Anthropic Claude 3.5 Sonnet
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface InstagramInput {
  product_image: string;
  product_name: string;
}

interface InstagramOutput {
  caption: string;
  first_comment: string;
  hashtags: string[];
  emoji_count: number;
}

export class InstagramPostGeneratorWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as InstagramInput;

      // Validate inputs
      if (!input.product_image || !input.product_name) {
        throw new Error('Missing required fields: product_image, product_name');
      }

      await this.updateProgress(25, 'Analyzing product for Instagram engagement');
      const imageBuffer = await this.downloadImage(input.product_image);
      const base64Image = imageBuffer.toString('base64');

      await this.updateProgress(50, 'Generating Instagram content');

      // Generate Instagram post with Claude
      const igContent = await this.generateInstagramPost(base64Image, input.product_name);

      await this.updateProgress(75, 'Optimizing hashtags');

      const output: InstagramOutput = {
        caption: igContent.caption,
        first_comment: igContent.first_comment,
        hashtags: igContent.hashtags,
        emoji_count: igContent.emoji_count
      };

      await this.updateProgress(100, 'Instagram content ready');

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
   * Generate Instagram post using Claude 3.5 Sonnet
   */
  private async generateInstagramPost(base64Image: string, productName: string): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const systemPrompt = 'You are an Instagram content creator specializing in product marketing.';

    const userPrompt = `Create Instagram post content for this product: "${productName}"

Requirements:
1) Engaging caption (150-300 chars) with emojis and call-to-action
2) First comment with 20-30 relevant hashtags organized by category

Return JSON format:
{
  "caption": "string (150-300 chars with emojis)",
  "first_comment": "string (hashtags only)",
  "hashtags": ["#hashtag1", "#hashtag2", ...],
  "emoji_count": number
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
          max_tokens: 2000,
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
