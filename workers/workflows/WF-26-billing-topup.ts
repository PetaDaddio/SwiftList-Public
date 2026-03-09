/**
 * WF-26: Billing & Top-Up
 *
 * Update user credits ledger based on Stripe payment events
 *
 * Priority: CRITICAL
 * Cost: $0.00 | Credits: 0 (System workflow)
 * Integrations: Stripe, Supabase
 */

import { BaseWorkflow, WorkflowResult } from '../base-workflow';

interface BillingInput {
  payment_intent_id: string;
  amount: number;
  user_id: string;
  stripe_event_type: string;
  metadata?: Record<string, any>;
}

interface BillingOutput {
  credits_added: number;
  new_balance: number;
  transaction_id: string;
}

export class BillingTopUpWorkflow extends BaseWorkflow {
  async execute(): Promise<WorkflowResult> {
    try {
      const input = this.jobData.input_data as BillingInput;

      // Validate inputs
      if (!input.payment_intent_id || !input.amount || !input.user_id) {
        throw new Error('Missing required fields: payment_intent_id, amount, user_id');
      }

      await this.updateProgress(25, 'Validating Stripe payment');

      // Verify payment intent with Stripe
      const paymentVerified = await this.verifyStripePayment(input.payment_intent_id);
      if (!paymentVerified) {
        throw new Error('Payment verification failed');
      }

      await this.updateProgress(50, 'Calculating credits');

      // Calculate credits based on payment amount
      // Conversion rate: $0.50 = 10 credits = $0.05 per credit
      const creditsToAdd = Math.floor(input.amount * 20); // $1 = 20 credits

      await this.updateProgress(75, 'Updating user credit balance');

      // Add credits to user account using database transaction
      const { data: transaction, error: txError } = await this.supabase.rpc('add_credits', {
        p_user_id: input.user_id,
        p_amount: creditsToAdd,
        p_source: 'stripe_payment',
        p_reference_id: input.payment_intent_id,
        p_metadata: input.metadata || {}
      });

      if (txError) {
        throw new Error(`Failed to add credits: ${txError.message}`);
      }

      // Get updated balance
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('credits_balance')
        .eq('user_id', input.user_id)
        .single();

      const output: BillingOutput = {
        credits_added: creditsToAdd,
        new_balance: profile?.credits_balance || creditsToAdd,
        transaction_id: transaction?.transaction_id || ''
      };

      await this.updateProgress(100, 'Credits added successfully');

      // Optional: Send confirmation email (if configured)
      await this.sendConfirmationEmail(input.user_id, creditsToAdd);

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
   * Verify payment with Stripe API
   */
  private async verifyStripePayment(paymentIntentId: string): Promise<boolean> {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    try {
      const response = await this.callAPI(
        `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (!response.ok) {
        return false;
      }

      const paymentIntent = await response.json();
      return paymentIntent.status === 'succeeded';
    } catch (error) {
      console.error('Stripe verification error:', error);
      return false;
    }
  }

  /**
   * Send confirmation email (optional)
   */
  private async sendConfirmationEmail(userId: string, credits: number): Promise<void> {
    // TODO: Implement email sending via Resend or similar
    // For now, just log
    console.log(`[Email] User ${userId} received ${credits} credits`);
  }

  /**
   * Override validateInputs to skip default validation
   */
  protected async validateInputs(): Promise<void> {
    // Custom validation handled in execute()
  }
}
