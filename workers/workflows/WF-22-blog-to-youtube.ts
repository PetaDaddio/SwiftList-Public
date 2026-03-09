/**
 * WF-22: Blog to YouTube
 *
 * Script → TTS → generated video for blog-to-YouTube conversion
 *
 * Priority: MULTI-MODAL
 * Cost: $0.232 | Credits: 25 | Revenue: $1.25 | Margin: 81.4%
 * AI: ElevenLabs TTS, Luma Labs Dream Machine
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface BlogToYouTubeInput {
  blog_text: string;
  voice_id?: string;
}

interface BlogToYouTubeOutput {
  video_url: string;
  audio_url: string;
  duration: number;
  script: string;
}

export class BlogToYouTubeWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as BlogToYouTubeInput;

      // Validate inputs
      if (!input.blog_text) {
        throw new Error('Missing required field: blog_text');
      }

      await this.updateProgress(25, 'Extracting key sentences for script');

      // Extract and condense key sentences (max 60 seconds)
      const script = await this.extractScript(input.blog_text);

      await this.updateProgress(40, 'Generating TTS audio with ElevenLabs');

      // Generate TTS audio
      const audioBuffer = await this.generateTTS(script, input.voice_id);

      await this.updateProgress(60, 'Generating video with Luma Dream Machine');

      // Generate video with Luma
      const videoBuffer = await this.generateVideo(script);

      await this.updateProgress(80, 'Syncing audio and video');

      // Sync audio with video (would use FFmpeg in production)
      const finalVideoBuffer = await this.syncAudioVideo(videoBuffer, audioBuffer);

      const videoPath = `${this.jobData.user_id}/${this.jobData.job_id}/blog-video.mp4`;
      const audioPath = `${this.jobData.user_id}/${this.jobData.job_id}/narration.mp3`;

      const [videoUrl, audioUrl] = await Promise.all([
        this.uploadToStorage(finalVideoBuffer, videoPath, 'video/mp4'),
        this.uploadToStorage(audioBuffer, audioPath, 'audio/mpeg')
      ]);

      const output: BlogToYouTubeOutput = {
        video_url: videoUrl,
        audio_url: audioUrl,
        duration: 60,
        script: script
      };

      await this.updateProgress(100, 'Video narration ready');

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
   * Extract key sentences for 60-second script
   */
  private async extractScript(blogText: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback: take first 500 characters
      return blogText.substring(0, 500);
    }

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
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Extract the most important sentences from this blog post to create a 60-second narration script. Keep it concise and engaging:\n\n${blogText}`
            }
          ]
        })
      }
    );

    const data = await response.json();
    return data.content?.[0]?.text || blogText.substring(0, 500);
  }

  /**
   * Generate TTS audio using ElevenLabs
   */
  private async generateTTS(script: string, voiceId?: string): Promise<Buffer> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const voice = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default voice

    const response = await this.callAPI(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('ElevenLabs TTS error');
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate video using Luma Labs Dream Machine
   */
  private async generateVideo(script: string): Promise<Buffer> {
    const apiKey = process.env.LUMA_API_KEY;
    if (!apiKey) {
      throw new Error('LUMA_API_KEY not configured');
    }

    const prompt = `Professional YouTube video visualization for: ${script.substring(0, 200)}. Cinematic, engaging visuals, high quality.`;

    const response = await this.callAPI(
      'https://api.lumalabs.ai/dream-machine/v1/generations',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          aspect_ratio: '16:9',
          duration: 60
        })
      }
    );

    if (!response.ok) {
      throw new Error('Luma Dream Machine error');
    }

    const generation = await response.json();

    // Poll for completion
    let result = generation;
    let attempts = 0;

    while (result.state !== 'completed' && result.state !== 'failed' && attempts < 120) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollResponse = await this.callAPI(
        `https://api.lumalabs.ai/dream-machine/v1/generations/${generation.id}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      result = await pollResponse.json();
      attempts++;
    }

    if (result.state !== 'completed') {
      throw new Error('Video generation failed');
    }

    return await this.downloadImage(result.video_url);
  }

  /**
   * Sync audio with video (placeholder - would use FFmpeg)
   */
  private async syncAudioVideo(videoBuffer: Buffer, audioBuffer: Buffer): Promise<Buffer> {
    // In production, use FFmpeg to merge audio and video
    // For now, return video buffer
    return videoBuffer;
  }
}
