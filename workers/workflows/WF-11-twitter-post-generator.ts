/**
 * WF-11: Twitter Post Generator
 *
 * Creates viral tweet thread with hashtags
 *
 * Priority: SOCIAL MEDIA
 * Cost: $0.053 | Credits: 10 | Revenue: $0.50 | Margin: 89.4%
 * AI: Anthropic Claude 3.5 Sonnet
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface TwitterInput {
  product_image: string;
  product_name: string;
}

interface TwitterOutput {
  main_tweet: string;
  thread_tweets: string[];
  hashtags: string[];
  total_characters: number;
}

export class TwitterPostGeneratorWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as TwitterInput;

      // Validate inputs
      if (!input.product_image || !input.product_name) {
        throw new Error('Missing required fields: product_image, product_name');
      }

      await this.updateProgress(25, 'Analyzing product for viral potential');
      const imageBuffer = await this.downloadImage(input.product_image);
      const base64Image = imageBuffer.toString('base64');

      await this.updateProgress(50, 'Generating viral tweet thread');

      // Generate tweet thread with Claude
      const tweetThread = await this.generateTweetThread(base64Image, input.product_name);

      await this.updateProgress(75, 'Optimizing hashtags');

      const output: TwitterOutput = {
        main_tweet: tweetThread.main_tweet,
        thread_tweets: tweetThread.thread_tweets,
        hashtags: tweetThread.hashtags,
        total_characters: tweetThread.total_characters
      };

      await this.updateProgress(100, 'Twitter content ready');

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
   * Generate tweet thread using Claude 3.5 Sonnet
   */
  private async generateTweetThread(base64Image: string, productName: string): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const systemPrompt = 'You are a viral social media content creator specializing in Twitter/X.';

    const userPrompt = `Create a viral Twitter thread for this product: "${productName}"

Requirements:
- Main tweet: 280 characters max, compelling hook
- Follow with 2-4 tweets expanding on features, benefits, and call-to-action
- Include relevant hashtags (5-10)
- Each tweet should be engaging and shareable

Return JSON format:
{
  "main_tweet": "string (max 280 chars)",
  "thread_tweets": ["tweet2", "tweet3", "tweet4"],
  "hashtags": ["#hashtag1", "#hashtag2"],
  "total_characters": number
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
