import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireAdmin } from '$lib/utils/admin-guard';
import { createServiceRoleClient } from '$lib/supabase/client';
import { computeExperimentResults } from '$lib/ab/stats';
import type { PageServerLoad } from './$types';

interface ABExperiment {
	id: string;
	slug: string;
	name: string;
	variants: Array<{ key: string; value: string }>;
	status: string;
	[key: string]: unknown;
}

interface ABEvent {
	experiment_id: string;
	variant: string;
	event_type: string;
}

export const load = (async ({ locals }) => {
	if (!locals.session) {
		throw redirect(303, '/auth/login?next=/admin/experiments');
	}

	const userId = locals.user?.id;
	requireAdmin(userId, env.ADMIN_USER_IDS);

	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceRoleKey) {
		return { experiments: [], results: {} };
	}

	const supabase = createServiceRoleClient(serviceRoleKey);

	// Fetch all experiments (cast — table not in generated types until migration applied)
	const { data: rawExperiments } = await supabase
		.from('ab_experiments' as any)
		.select('*')
		.order('created_at', { ascending: false });

	const experiments = (rawExperiments || []) as unknown as ABExperiment[];

	if (experiments.length === 0) {
		return { experiments: [], results: {} };
	}

	// Fetch aggregated event counts for all experiments
	const experimentIds = experiments.map((e) => e.id);

	const { data: rawEvents } = await supabase
		.from('ab_events' as any)
		.select('experiment_id, variant, event_type')
		.in('experiment_id', experimentIds);

	const events = (rawEvents || []) as unknown as ABEvent[];

	// Aggregate events per experiment
	const results: Record<
		string,
		ReturnType<typeof computeExperimentResults>
	> = {};

	for (const exp of experiments) {
		const expEvents = events.filter((e) => e.experiment_id === exp.id);
		const variants = exp.variants || [];

		// Build counts per variant
		const variantData = variants.map((v) => {
			const variantEvents = expEvents.filter((e) => e.variant === v.key);
			return {
				variant: v.key,
				impressions: variantEvents.filter((e) => e.event_type === 'impression').length,
				conversions: variantEvents.filter(
					(e) => e.event_type === 'click' || e.event_type === 'checkout' || e.event_type === 'purchase'
				).length
			};
		});

		results[exp.id] = computeExperimentResults(variantData);
	}

	return { experiments, results };
});
