/**
 * WF-10: Product Description
 *
 * Text-only analysis generating SEO title, short desc, long desc, bullet points, and keywords
 *
 * Priority: HIGHEST MARGIN
 * Cost: $0.001 | Credits: 5 | Revenue: $0.25 | Margin: 99.6%
 * AI: Claude 3.5 Sonnet (Anthropic API)
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';
import Anthropic from '@anthropic-ai/sdk';

interface ProductDescriptionInput {
  product_image: string;
  product_category?: string;
  marketplace?: string; // eBay, Etsy, Amazon, etc.
}

interface ProductDescriptionOutput {
  seo_title: string; // 60 chars max
  short_description: string; // 150 chars max
  long_description: string; // 500 words max
  bullet_points: string[]; // 5-7 points
  seo_keywords: string[]; // 10-15 keywords
  category: string;
}

export class ProductDescriptionWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as ProductDescriptionInput;

      // Validate inputs
      if (!input.product_image) {
        throw new Error('Missing required field: product_image');
      }

      await this.updateProgress(25, 'Analyzing product features');
      const imageBuffer = await this.downloadImage(input.product_image);
      const base64Image = imageBuffer.toString('base64');

      await this.updateProgress(50, 'Generating SEO-optimized description with Claude');

      // Generate description with Claude 3.5 Sonnet
      const description = await this.generateDescription(
        base64Image,
        input.product_category,
        input.marketplace
      );

      await this.updateProgress(75, 'Validating output');

      // Validate title length (max 60 chars)
      if (description.seo_title.length > 60) {
        description.seo_title = description.seo_title.substring(0, 57) + '...';
      }

      // Validate short description (max 150 chars)
      if (description.short_description.length > 150) {
        description.short_description = description.short_description.substring(0, 147) + '...';
      }

      const output: ProductDescriptionOutput = {
        seo_title: description.seo_title,
        short_description: description.short_description,
        long_description: description.long_description,
        bullet_points: description.bullet_points,
        seo_keywords: description.seo_keywords,
        category: description.category
      };

      await this.updateProgress(100, 'Description generation complete');

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
   * Generate product description using Claude 3.5 Sonnet with Vision
   */
  private async generateDescription(
    base64Image: string,
    category?: string,
    marketplace?: string
  ): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({
      apiKey
    });

    const marketplaceGuidelines = marketplace ? `\nOptimize for ${marketplace} marketplace requirements.` : '';

    const prompt = `Analyze this product image and generate comprehensive e-commerce content:

${category ? `Product category: ${category}` : ''}${marketplaceGuidelines}

Generate the following in JSON format:
1. **seo_title**: SEO-optimized title (max 60 characters) - focus on key features and benefits
2. **short_description**: Compelling short description (max 150 characters) for listing previews
3. **long_description**: Detailed product description (500 words) covering features, benefits, materials, dimensions, and use cases
4. **bullet_points**: 5-7 compelling bullet points highlighting key features and benefits
5. **seo_keywords**: 10-15 SEO keywords relevant to this product
6. **category**: Detected product category

Focus on persuasive, benefit-driven language that converts browsers into buyers.

Return ONLY valid JSON with this exact structure:
{
  "seo_title": "string (max 60 chars)",
  "short_description": "string (max 150 chars)",
  "long_description": "string (500 words max)",
  "bullet_points": ["point1", "point2", "point3", "point4", "point5"],
  "seo_keywords": ["keyword1", "keyword2", ...],
  "category": "detected category"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
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
              text: prompt
            }
          ]
        }
      ]
    });

    const textContent = message.content[0].type === 'text' ? message.content[0].text : '';

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
