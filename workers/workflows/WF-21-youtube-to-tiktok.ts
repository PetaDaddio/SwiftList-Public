/**
 * WF-21: YouTube to TikTok
 *
 * Cut detection + vertical crop to repurpose long-form to short-form
 *
 * Priority: VIDEO REPURPOSE
 * Cost: $0.432 | Credits: 25 | Revenue: $1.25 | Margin: 65.4%
 * AI: Vizard.ai Video Repurpose
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface YouTubeToTikTokInput {
  youtube_url: string;
  max_clips?: number;
}

interface YouTubeToTikTokOutput {
  clips: Array<{
    clip_url: string;
    duration: number;
    start_time: number;
  }>;
  total_clips: number;
}

export class YouTubeToTikTokWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as YouTubeToTikTokInput;

      // Validate inputs
      if (!input.youtube_url) {
        throw new Error('Missing required field: youtube_url');
      }

      const maxClips = input.max_clips || 3;

      await this.updateProgress(25, 'Downloading YouTube video');

      // Download YouTube video
      const videoBuffer = await this.downloadYouTubeVideo(input.youtube_url);

      await this.updateProgress(50, 'Detecting optimal cuts with Vizard.ai');

      // Process with Vizard.ai for cut detection and vertical crop
      const clips = await this.repurposeToShortForm(videoBuffer, maxClips);

      await this.updateProgress(75, 'Uploading TikTok-ready clips');

      // Upload all clips
      const uploadedClips = await Promise.all(
        clips.map(async (clip, idx) => {
          const clipPath = `${this.jobData.user_id}/${this.jobData.job_id}/clip-${idx + 1}.mp4`;
          const clipUrl = await this.uploadToStorage(
            clip.buffer,
            clipPath,
            'video/mp4'
          );
          return {
            clip_url: clipUrl,
            duration: clip.duration,
            start_time: clip.start_time
          };
        })
      );

      const output: YouTubeToTikTokOutput = {
        clips: uploadedClips,
        total_clips: uploadedClips.length
      };

      await this.updateProgress(100, 'Short-form clips ready');

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
   * Download YouTube video (simplified - would use yt-dlp in production)
   */
  private async downloadYouTubeVideo(url: string): Promise<Buffer> {
    // In production, use yt-dlp or similar
    // For now, just validate URL
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      throw new Error('Invalid YouTube URL');
    }

    // Placeholder: would download actual video
    return Buffer.from('');
  }

  /**
   * Repurpose video using Vizard.ai
   */
  private async repurposeToShortForm(
    videoBuffer: Buffer,
    maxClips: number
  ): Promise<Array<{ buffer: Buffer; duration: number; start_time: number }>> {
    const apiKey = process.env.VIZARD_API_KEY;
    if (!apiKey) {
      throw new Error('VIZARD_API_KEY not configured');
    }

    // Upload video to Vizard
    const formData = new FormData();
    const blob = new Blob([videoBuffer], { type: 'video/mp4' });
    formData.append('video', blob, 'input.mp4');
    formData.append('aspect_ratio', '9:16'); // Vertical for TikTok
    formData.append('max_clips', String(maxClips));
    formData.append('add_captions', 'true');

    const response = await this.callAPI(
      'https://api.vizard.ai/v1/video/repurpose',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey
        },
        body: formData as any
      }
    );

    if (!response.ok) {
      throw new Error(`Vizard.ai error: ${response.status}`);
    }

    const result = await response.json();
    const jobId = result.job_id;

    // Poll for completion
    let jobResult;
    let attempts = 0;
    const maxAttempts = 120; // 4 minutes timeout

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollResponse = await this.callAPI(
        `https://api.vizard.ai/v1/jobs/${jobId}`,
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );
      jobResult = await pollResponse.json();

      if (jobResult.status === 'completed') {
        break;
      } else if (jobResult.status === 'failed') {
        throw new Error('Vizard.ai processing failed');
      }

      attempts++;
    }

    if (!jobResult || jobResult.status !== 'completed') {
      throw new Error('Vizard.ai processing timed out');
    }

    // Download all clips
    const clips = await Promise.all(
      jobResult.clips.map(async (clip: any) => {
        const clipBuffer = await this.downloadImage(clip.url);
        return {
          buffer: clipBuffer,
          duration: clip.duration,
          start_time: clip.start_time
        };
      })
    );

    return clips;
  }
}
