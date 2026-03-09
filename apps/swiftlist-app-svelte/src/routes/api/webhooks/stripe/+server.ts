/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed → credits user with one-time credit pack purchase
 * - invoice.payment_succeeded  → credits user with monthly subscription credits
 *
 * SECURITY:
 * - Raw body required for HMAC signature verification
 * - STRIPE_WEBHOOK_SECRET (whsec_...) must be set as env var
 * - All credit grants via server-side Supabase RPC only
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { createServiceRoleClient } from '$lib/supabase/client';
import { jobsLogger } from '$lib/utils/logger';

const log = jobsLogger.child({ route: '/api/webhooks/stripe' });

// One-time credit packs — must match CREDIT_PACK_PRICE_MAP in create-session
// VERIFIED 2026-02-20: metadata keys (user_id, pack_id) match create-session route exactly
const CREDIT_PACKS: Record<string, number> = {
	credits_100: 100,
	credits_500: 500,
	credits_1500: 1500
};

// Monthly subscription plans — credits granted on each successful invoice payment
// Maker: 400/mo ($29), Merchant: 1100/mo ($49), Agency: 2500/mo ($99)
// VERIFIED 2026-02-20: metadata keys (user_id, plan_id) match create-session subscription_data.metadata exactly
const SUBSCRIPTION_CREDITS: Record<string, number> = {
	maker_monthly: 400,
	merchant_monthly: 1100,
	agency_monthly: 2500
};

// Map Stripe plan_id to profiles.subscription_tier value
const PLAN_TO_TIER: Record<string, string> = {
	maker_monthly: 'maker',
	merchant_monthly: 'merchant',
	agency_monthly: 'agency'
};

export const POST: RequestHandler = async ({ request }) => {
	const stripeSecretKey = env.STRIPE_SECRET_KEY;
	const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

	if (!stripeSecretKey || !webhookSecret) {
		log.error('Stripe keys not configured');
		throw error(500, 'Server configuration error');
	}

	const stripe = new Stripe(stripeSecretKey);

	// Raw body required for signature verification
	const rawBody = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		log.warn('Missing stripe-signature header');
		throw error(400, 'Missing signature');
	}

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
	} catch (err: any) {
		log.warn({ err: err.message }, 'Webhook signature verification failed');
		throw error(400, 'Webhook signature verification failed');
	}

	log.info({ type: event.type, id: event.id }, 'Stripe webhook received');

	// --- One-time credit pack purchase ---
	if (event.type === 'checkout.session.completed') {
		const session = event.data.object as Stripe.Checkout.Session;

		// Handle subscription checkout: set tier immediately (credits granted via invoice event)
		if (session.mode === 'subscription') {
			const userId = session.metadata?.user_id;
			const planId = session.metadata?.plan_id;

			if (userId && planId) {
				const tierName = PLAN_TO_TIER[planId];
				if (tierName) {
					const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
					if (serviceRoleKey) {
						const supabase = createServiceRoleClient(serviceRoleKey);
						const { error: tierError } = await supabase
							.from('profiles')
							.update({ subscription_tier: tierName })
							.eq('user_id', userId);

						if (tierError) {
							log.error({ err: tierError, userId, tierName }, 'Failed to set subscription tier on checkout');
						} else {
							log.info({ userId, tierName, sessionId: session.id }, 'Subscription tier set on initial checkout');
						}
					}
				}
			}
			return json({ received: true });
		}

		if (session.payment_status !== 'paid') {
			log.info({ sessionId: session.id }, 'Session not paid, skipping');
			return json({ received: true });
		}

		const userId = session.metadata?.user_id;
		const packId = session.metadata?.pack_id;

		if (!userId || !packId) {
			log.error({ sessionId: session.id, metadata: session.metadata }, 'Missing metadata in session');
			throw error(400, 'Missing session metadata');
		}

		const creditsToGrant = CREDIT_PACKS[packId];
		if (!creditsToGrant) {
			log.error({ packId }, 'Unknown pack_id in session metadata');
			throw error(400, 'Unknown credit pack');
		}

		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			log.error('SUPABASE_SERVICE_ROLE_KEY not configured');
			throw error(500, 'Server configuration error');
		}

		const supabase = createServiceRoleClient(serviceRoleKey);

		const { error: rpcError } = await supabase.rpc('grant_credits', {
			p_user_id: userId,
			p_amount: creditsToGrant,
			p_stripe_session_id: session.id
		});

		if (rpcError) {
			log.error({ err: rpcError, userId, creditsToGrant }, 'Failed to grant credits via RPC');
			throw error(500, 'Failed to grant credits');
		}

		log.info(
			{ userId, packId, creditsToGrant, sessionId: session.id },
			'Credits granted successfully (one-time pack)'
		);
	}

	// --- Monthly subscription credit grant ---
	// Fires on initial subscription payment AND every renewal
	if (event.type === 'invoice.payment_succeeded') {
		const invoice = event.data.object as Stripe.Invoice;

		// Only process subscription invoices (not standalone invoices)
		if (!(invoice as any).subscription) {
			log.info({ invoiceId: invoice.id }, 'Non-subscription invoice, skipping');
			return json({ received: true });
		}

		// Retrieve subscription to get metadata
		let subscription: Stripe.Subscription;
		try {
			subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);
		} catch (stripeErr: any) {
			log.error({ err: stripeErr.message, subscriptionId: (invoice as any).subscription }, 'Failed to retrieve subscription');
			throw error(500, 'Failed to retrieve subscription');
		}

		const userId = subscription.metadata?.user_id;
		const planId = subscription.metadata?.plan_id;

		if (!userId || !planId) {
			log.error(
				{ subscriptionId: subscription.id, metadata: subscription.metadata },
				'Missing metadata in subscription'
			);
			throw error(400, 'Missing subscription metadata');
		}

		const creditsToGrant = SUBSCRIPTION_CREDITS[planId];
		if (!creditsToGrant) {
			log.error({ planId }, 'Unknown plan_id in subscription metadata');
			throw error(400, 'Unknown subscription plan');
		}

		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			log.error('SUPABASE_SERVICE_ROLE_KEY not configured');
			throw error(500, 'Server configuration error');
		}

		const supabase = createServiceRoleClient(serviceRoleKey);

		// Use invoice ID as idempotency key to prevent double-granting on retries
		const { error: rpcError } = await supabase.rpc('grant_credits', {
			p_user_id: userId,
			p_amount: creditsToGrant,
			p_stripe_session_id: invoice.id
		});

		if (rpcError) {
			log.error({ err: rpcError, userId, creditsToGrant, planId }, 'Failed to grant subscription credits via RPC');
			throw error(500, 'Failed to grant credits');
		}

		// Update subscription tier on the user's profile
		const tierName = PLAN_TO_TIER[planId];
		if (tierName) {
			const { error: tierError } = await supabase
				.from('profiles')
				.update({ subscription_tier: tierName })
				.eq('user_id', userId);

			if (tierError) {
				log.error({ err: tierError, userId, tierName }, 'Failed to update subscription_tier');
			} else {
				log.info({ userId, tierName }, 'Subscription tier updated');
			}
		}

		log.info(
			{ userId, planId, creditsToGrant, invoiceId: invoice.id, subscriptionId: subscription.id },
			'Credits granted successfully (subscription renewal)'
		);
	}

	// --- Subscription cancelled → downgrade to free tier ---
	if (event.type === 'customer.subscription.deleted') {
		const subscription = event.data.object as Stripe.Subscription;
		const userId = subscription.metadata?.user_id;

		if (!userId) {
			log.error({ subscriptionId: subscription.id }, 'Missing user_id in cancelled subscription metadata');
			return json({ received: true });
		}

		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			log.error('SUPABASE_SERVICE_ROLE_KEY not configured');
			throw error(500, 'Server configuration error');
		}

		const supabase = createServiceRoleClient(serviceRoleKey);

		const { error: tierError } = await supabase
			.from('profiles')
			.update({ subscription_tier: 'explorer' })
			.eq('user_id', userId);

		if (tierError) {
			log.error({ err: tierError, userId }, 'Failed to downgrade subscription_tier');
		} else {
			log.info({ userId, subscriptionId: subscription.id }, 'Subscription cancelled, tier reset to explorer');
		}
	}

	return json({ received: true });
};
