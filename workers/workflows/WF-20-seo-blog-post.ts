/**
 * WF-20: SEO Blog Post
 *
 * Generates 1500-word article with proper H-tags and SEO optimization
 *
 * Priority: LONG-FORM
 * Cost: $0.052 | Credits: 10 | Revenue: $0.50 | Margin: 89.6%
 * AI: Anthropic Claude 3 Opus
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface BlogInput {
  topic: string;
  keywords: string[];
  target_audience?: string;
}

interface BlogOutput {
  html_content: string;
  word_count: number;
  seo_score: number;
  meta_description: string;
}

export class SEOBlogPostWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as BlogInput;

      // Validate inputs
      if (!input.topic || !input.keywords || input.keywords.length === 0) {
        throw new Error('Missing required fields: topic, keywords');
      }

      await this.updateProgress(25, 'Researching topic and outlining article');

      await this.updateProgress(50, 'Generating 1500-word article with Claude Opus');

      // Generate blog post with Claude Opus
      const blogContent = await this.generateBlogPost(
        input.topic,
        input.keywords,
        input.target_audience
      );

      await this.updateProgress(75, 'Optimizing SEO and formatting HTML');

      const output: BlogOutput = {
        html_content: blogContent.html_content,
        word_count: blogContent.word_count,
        seo_score: blogContent.seo_score,
        meta_description: blogContent.meta_description
      };

      await this.updateProgress(100, 'Blog post ready');

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
   * Generate SEO blog post using Claude 3 Opus
   */
  private async generateBlogPost(
    topic: string,
    keywords: string[],
    targetAudience?: string
  ): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const systemPrompt = 'You are an expert SEO content writer specializing in long-form blog articles.';

    const userPrompt = `Write a comprehensive 1500-word blog post about ${topic}.

Target keywords: ${keywords.join(', ')}
${targetAudience ? `Target audience: ${targetAudience}` : ''}

Requirements:
- H1 title (include primary keyword)
- Introduction (150-200 words)
- 3-5 H2 sections with H3 subsections
- Conclusion with CTA
- Natural keyword integration (avoid keyword stuffing)
- Include internal linking suggestions
- Engaging, readable style
- Format as clean HTML

Return JSON format:
{
  "html_content": "string (full HTML with proper H1-H6 structure)",
  "word_count": number,
  "seo_score": 0-100,
  "meta_description": "string (max 160 chars)"
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
          model: 'claude-3-opus-20240229',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt
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
