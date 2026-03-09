/**
 * SwiftList Webhook Notifier Utility
 * Sends HMAC-signed notifications to WF-24 error webhook for immediate refund processing
 *
 * IMPORTANT: This is a server-side only utility. Env vars must be passed in from
 * $env/dynamic/private in the calling +server.ts file.
 */

import crypto from 'crypto';
import { infraLogger } from '$lib/utils/logger';

const log = infraLogger.child({ component: 'webhook-notifier' });

export interface JobFailurePayload {
  job_id: string;
  user_id: string;
  credits_charged: number;
  error_message: string;
  workflow_id: string;
  failed_at: string;
}

export interface WebhookNotifierConfig {
  webhookUrl: string;
  secret: string;
}

export class WebhookNotifier {
  private webhookUrl: string;
  private secret: string;

  constructor(config: WebhookNotifierConfig) {
    this.webhookUrl = config.webhookUrl;
    this.secret = config.secret;
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Notify WF-24 of job failure for immediate refund processing
   */
  async notifyJobFailure(payload: JobFailurePayload): Promise<boolean> {
    try {
      const payloadString = JSON.stringify(payload);
      const signature = this.generateSignature(payloadString);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SwiftList-Signature': signature
        },
        body: payloadString
      });

      if (!response.ok) {
        log.error({ status: response.status, jobId: payload.job_id }, 'Webhook notification failed');
        return false;
      }

      log.info({ jobId: payload.job_id }, 'Webhook notification sent');
      return true;
    } catch (err) {
      // Don't throw - webhook notification failure shouldn't break error handling
      log.error({ err, jobId: payload.job_id }, 'Webhook notification error');
      return false;
    }
  }
}

/**
 * Create a WebhookNotifier instance with environment config.
 * Call this from +server.ts files where $env/dynamic/private is available.
 */
export function createWebhookNotifier(webhookUrl: string, secret: string): WebhookNotifier {
  if (!webhookUrl || !secret) {
    throw new Error(
      'WebhookNotifier requires ERROR_WEBHOOK_URL and WEBHOOK_SECRET env vars. ' +
      'Pass them from $env/dynamic/private in your +server.ts file.'
    );
  }
  return new WebhookNotifier({ webhookUrl, secret });
}
