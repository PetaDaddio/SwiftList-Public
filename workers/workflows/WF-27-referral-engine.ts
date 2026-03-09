/**
 * WF-27: Referral Engine
 *
 * Credit injection for referrals - viral loop mechanism
 *
 * Priority: GROWTH ENGINE
 * Cost: $0.00 | Credits: 0 (Growth mechanism)
 * Integration: Supabase
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface ReferralInput {
  new_user_id: string;
  referral_code: string;
  referee_email?: string;
}

interface ReferralOutput {
  referrer_id: string;
  referee_bonus: number;
  referrer_bonus: number;
  referral_id: string;
}

export class ReferralEngineWorkflow extends BaseWorkflow {
  // Bonus credits configuration
  private readonly REFEREE_BONUS = 25; // New user gets 25 credits
  private readonly REFERRER_BONUS = 25; // Referrer gets 25 credits

  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as ReferralInput;

      // Validate inputs
      if (!input.new_user_id || !input.referral_code) {
        throw new Error('Missing required fields: new_user_id, referral_code');
      }

      await this.updateProgress(25, 'Validating referral code');

      // Find referrer by referral code
      const { data: referrer, error: referrerError } = await this.supabase
        .from('profiles')
        .select('user_id, referral_code, email')
        .eq('referral_code', input.referral_code)
        .single();

      if (referrerError || !referrer) {
        throw new Error('Invalid referral code');
      }

      // Prevent self-referral
      if (referrer.user_id === input.new_user_id) {
        throw new Error('Self-referral not allowed');
      }

      await this.updateProgress(50, 'Checking referral eligibility');

      // Check if this user has already used a referral code
      const { data: existingReferral } = await this.supabase
        .from('referrals')
        .select('referral_id')
        .eq('referee_id', input.new_user_id)
        .single();

      if (existingReferral) {
        throw new Error('User has already used a referral code');
      }

      await this.updateProgress(75, 'Adding bonus credits');

      // Create referral record
      const { data: referralRecord, error: referralError } = await this.supabase
        .from('referrals')
        .insert({
          referrer_id: referrer.user_id,
          referee_id: input.new_user_id,
          status: 'completed',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (referralError) {
        throw new Error(`Failed to create referral record: ${referralError.message}`);
      }

      // Add bonus credits to referee (new user)
      await this.supabase.rpc('add_credits', {
        p_user_id: input.new_user_id,
        p_amount: this.REFEREE_BONUS,
        p_source: 'referral_bonus',
        p_reference_id: referralRecord.referral_id,
        p_metadata: { type: 'referee', referrer_id: referrer.user_id }
      });

      // Add bonus credits to referrer (existing user)
      await this.supabase.rpc('add_credits', {
        p_user_id: referrer.user_id,
        p_amount: this.REFERRER_BONUS,
        p_source: 'referral_bonus',
        p_reference_id: referralRecord.referral_id,
        p_metadata: { type: 'referrer', referee_id: input.new_user_id }
      });

      const output: ReferralOutput = {
        referrer_id: referrer.user_id,
        referee_bonus: this.REFEREE_BONUS,
        referrer_bonus: this.REFERRER_BONUS,
        referral_id: referralRecord.referral_id
      };

      await this.updateProgress(100, 'Referral bonus credits added');

      // Optional: Send notification emails
      await this.notifyUsers(referrer.email, input.referee_email || '');

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
   * Send notification emails to referrer and referee
   */
  private async notifyUsers(referrerEmail: string, refereeEmail: string): Promise<void> {
    // TODO: Implement email notifications via Resend
    console.log(`[Email] Referrer ${referrerEmail} earned ${this.REFERRER_BONUS} credits`);
    if (refereeEmail) {
      console.log(`[Email] Referee ${refereeEmail} received ${this.REFEREE_BONUS} credits`);
    }
  }

  /**
   * Override validateInputs to skip default validation
   */
  protected async validateInputs(): Promise<void> {
    // Custom validation handled in execute()
  }
}
