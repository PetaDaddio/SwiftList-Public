/**
 * Email Signup / Waitlist API Endpoint
 * POST /api/email-signup
 *
 * Writes to BOTH CRM tables:
 * 1. waitlist (via anon key — has INSERT policy for anon)
 * 2. contacts (via service_role key — upserts a lead record)
 *
 * Called from the /hello waitlist form.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { apiLogger } from '$lib/utils/logger';
import { getCrmAnonClient } from '$lib/crm/client';
import { syncContactToCrm, logCrmActivity } from '$lib/crm/sync';

const log = apiLogger.child({ route: '/api/email-signup' });

const emailSignupSchema = z.object({
	email: z.string().email().max(254),
	source: z.string().max(100).optional(),
	utm_source: z.string().max(200).optional(),
	utm_medium: z.string().max(200).optional(),
	utm_campaign: z.string().max(200).optional()
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const parseResult = emailSignupSchema.safeParse(body);
		if (!parseResult.success) {
			return json({ error: 'Please enter a valid email address.' }, { status: 400 });
		}

		const { email, source, utm_source, utm_medium, utm_campaign } = parseResult.data;
		const cleanEmail = email.toLowerCase().trim();

		// 1. Insert into waitlist table (anon key — has INSERT policy)
		const crmAnon = getCrmAnonClient();
		if (!crmAnon) {
			log.error('CRM anon client not configured');
			return json({ error: 'Server configuration error' }, { status: 500 });
		}

		const { error: insertError } = await crmAnon.from('waitlist').insert({
			email: cleanEmail,
			signup_source: source || 'hello_page',
			utm_source: utm_source || null,
			utm_medium: utm_medium || null,
			utm_campaign: utm_campaign || null,
			status: 'pending'
		});

		if (insertError) {
			if (insertError.code === '23505') {
				return json({
					success: true,
					message: "You're already on the list! We'll be in touch."
				});
			}
			log.error({ err: insertError }, 'CRM waitlist insert error');
			return json({ error: 'Failed to save your email. Please try again.' }, { status: 500 });
		}

		// 2. Fire-and-forget: upsert contact record + log activity (service_role)
		syncContactToCrm({
			email: cleanEmail,
			lifecycle_stage: 'lead',
			lead_source: source || 'hello_page',
			lead_status: 'New',
			deal_stage: 'Waitlist'
		}).catch(() => {});

		logCrmActivity(cleanEmail, 'waitlist_signup', {
			source: source || 'hello_page',
			utm_source,
			utm_medium,
			utm_campaign
		}).catch(() => {});

		return json({
			success: true,
			message: "You're on the list! We'll notify you at launch."
		});
	} catch (err) {
		log.error({ err }, 'Unexpected error');
		return json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
	}
};
