/**
 * Stripe Checkout Session Creator
 * POST /api/checkout/create-session
 *
 * Creates a Stripe Checkout session for:
 * - One-time credit pack purchases (mode: 'payment')
 * - Monthly subscription plans (mode: 'subscription')
 *
 * Returns a checkout_url for the client to redirect to.
 *
 * SECURITY:
 * - Requires authentication (Bearer token or session)
 * - user_id injected server-side into session metadata (never from client)
 * - pack_id validated against server-side whitelist
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { createClient } from '$lib/supabase/client';
import { jobsLogger } from '$lib/utils/logger';

const log = jobsLogger.child({ route: '/api/checkout/create-session' });

// One-time credit pack price IDs
// Starter: 100 credits ($19), Growth: 500 credits ($49), Scale: 1500 credits ($149)
const CREDIT_PACK_PRICE_MAP: Record<string, string | undefined> = {
	credits_100: env.STRIPE_PRICE_CREDITS_100,
	credits_500: env.STRIPE_PRICE_CREDITS_500,
	credits_1500: env.STRIPE_PRICE_CREDITS_1500
};

// Monthly subscription plan price IDs
// Maker: 400 credits/mo ($29), Merchant: 1100 credits/mo ($49), Agency: 2500 credits/mo ($99)
const SUBSCRIPTION_PRICE_MAP: Record<string, string | undefined> = {
	maker_monthly: env.STRIPE_PRICE_MAKER_MONTHLY,
	merchant_monthly: env.STRIPE_PRICE_MERCHANT_MONTHLY,
	agency_monthly: env.STRIPE_PRICE_AGENCY_MONTHLY
};

const CREDIT_PACK_IDS = ['credits_100', 'credits_500', 'credits_1500'] as const;
const SUBSCRIPTION_IDS = ['maker_monthly', 'merchant_monthly', 'agency_monthly'] as const;

const requestSchema = z.object({
	pack_id: z.enum([...CREDIT_PACK_IDS, ...SUBSCRIPTION_IDS]),
	// SECURITY: Restrict redirects to swiftlist.app to prevent open redirect attacks
	success_url: z.string().url().refine(
		url => { try { return new URL(url).hostname.endsWith('swiftlist.app') || new URL(url).hostname === 'localhost'; } catch { return false; } },
		'Redirect URL must be on swiftlist.app'
	).optional(),
	cancel_url: z.string().url().refine(
		url => { try { return new URL(url).hostname.endsWith('swiftlist.app') || new URL(url).hostname === 'localhost'; } catch { return false; } },
		'Redirect URL must be on swiftlist.app'
	).optional()
});

export const POST: RequestHandler = async ({ request }) => {
	const stripeSecretKey = env.STRIPE_SECRET_KEY;
	if (!stripeSecretKey) {
		log.error('STRIPE_SECRET_KEY not configured');
		throw error(500, 'Server configuration error');
	}

	// --- Authentication ---
	const authHeader = request.headers.get('authorization');
	const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

	const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		log.error('Supabase public env vars not configured');
		throw error(500, 'Server configuration error');
	}

	const supabase = createClient();

	let userId: string;
	if (token) {
		const { data: { user }, error: authError } = await supabase.auth.getUser(token);
		if (authError || !user) {
			log.warn({ err: authError?.message }, 'Invalid auth token');
			throw error(401, 'Unauthorized');
		}
		userId = user.id;
	} else {
		log.warn('No auth token provided');
		throw error(401, 'Unauthorized');
	}

	// --- Input Validation ---
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const parsed = requestSchema.safeParse(body);
	if (!parsed.success) {
		log.warn({ issues: parsed.error.issues }, 'Invalid request body');
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request');
	}

	const { pack_id, success_url, cancel_url } = parsed.data;

	const stripe = new Stripe(stripeSecretKey);
	const appUrl = env.PUBLIC_APP_URL || 'http://localhost:5173';

	// --- Determine mode: subscription vs one-time payment ---
	const isSubscription = (SUBSCRIPTION_IDS as readonly string[]).includes(pack_id);

	if (isSubscription) {
		// --- Subscription Checkout ---
		const priceId = SUBSCRIPTION_PRICE_MAP[pack_id];
		if (!priceId) {
			log.error({ pack_id }, `Stripe subscription price ID not configured for ${pack_id}`);
			throw error(500, `Payment not configured for plan: ${pack_id}`);
		}

		const defaultSuccessUrl = `${appUrl}/dashboard?purchase=success&plan=${pack_id}`;
		const defaultCancelUrl = `${appUrl}/dashboard?purchase=cancelled`;

		let session: Stripe.Checkout.Session;
		try {
			session = await stripe.checkout.sessions.create({
				mode: 'subscription',
				line_items: [
					{
						price: priceId,
						quantity: 1
					}
				],
				subscription_data: {
					metadata: {
						user_id: userId,
						plan_id: pack_id
					}
				},
				metadata: {
					user_id: userId,
					plan_id: pack_id
				},
				success_url: success_url ?? defaultSuccessUrl,
				cancel_url: cancel_url ?? defaultCancelUrl
			});
		} catch (stripeErr: any) {
			log.error({ err: stripeErr.message, userId, pack_id }, 'Stripe subscription session creation failed');
			throw error(500, 'Failed to create checkout session');
		}

		log.info({ userId, pack_id, sessionId: session.id }, 'Subscription checkout session created');
		return json({ checkout_url: session.url });
	} else {
		// --- One-time Payment Checkout ---
		const priceId = CREDIT_PACK_PRICE_MAP[pack_id];
		if (!priceId) {
			log.error({ pack_id }, `Stripe price ID not configured for ${pack_id}`);
			throw error(500, `Payment not configured for pack: ${pack_id}`);
		}

		const defaultSuccessUrl = `${appUrl}/dashboard?purchase=success&pack=${pack_id}`;
		const defaultCancelUrl = `${appUrl}/dashboard?purchase=cancelled`;

		let session: Stripe.Checkout.Session;
		try {
			session = await stripe.checkout.sessions.create({
				mode: 'payment',
				line_items: [
					{
						price: priceId,
						quantity: 1
					}
				],
				metadata: {
					user_id: userId,
					pack_id
				},
				success_url: success_url ?? defaultSuccessUrl,
				cancel_url: cancel_url ?? defaultCancelUrl,
				customer_creation: 'if_required'
			});
		} catch (stripeErr: any) {
			log.error({ err: stripeErr.message, userId, pack_id }, 'Stripe session creation failed');
			throw error(500, 'Failed to create checkout session');
		}

		log.info({ userId, pack_id, sessionId: session.id }, 'Checkout session created');
		return json({ checkout_url: session.url });
	}
};
