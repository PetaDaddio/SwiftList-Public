/**
 * A/B Testing Event Tracking Endpoint
 * POST /api/ab/track
 *
 * Receives impression and conversion events from the client.
 * Fire-and-forget — always returns 200 to never block user flow.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceRoleClient } from '$lib/supabase/client';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

const EventSchema = z.object({
	experiment_id: z.string().uuid(),
	variant: z.string().min(1).max(50),
	event_type: z.enum(['impression', 'click', 'checkout', 'purchase']),
	metadata: z.record(z.string(), z.unknown()).optional().default({})
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const parsed = EventSchema.safeParse(body);

		if (!parsed.success) {
			return json({ ok: false }, { status: 400 });
		}

		const visitorId = cookies.get('sl_ab');
		if (!visitorId) {
			return json({ ok: false }, { status: 400 });
		}

		const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
		if (!serviceRoleKey) {
			return json({ ok: true }); // Silently skip if no key
		}

		const supabase = createServiceRoleClient(serviceRoleKey);

		await supabase.from('ab_events' as any).insert({
			experiment_id: parsed.data.experiment_id,
			visitor_id: visitorId,
			variant: parsed.data.variant,
			event_type: parsed.data.event_type,
			metadata: parsed.data.metadata
		});

		return json({ ok: true });
	} catch {
		// Never fail — tracking errors should not impact user experience
		return json({ ok: true });
	}
};
