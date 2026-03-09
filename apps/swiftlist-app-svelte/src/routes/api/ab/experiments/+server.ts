/**
 * A/B Experiments Admin CRUD Endpoint
 * GET  /api/ab/experiments — List all experiments
 * POST /api/ab/experiments — Create new experiment
 * PATCH /api/ab/experiments — Update experiment (status, winner)
 *
 * Admin-only — requires authenticated admin user.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceRoleClient } from '$lib/supabase/client';
import { isAdmin } from '$lib/utils/admin-guard';
import { invalidateExperimentCache } from '$lib/ab/config';
import { env } from '$env/dynamic/private';
import { z } from 'zod';

function requireAdminRequest(locals: App.Locals): void {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	if (!isAdmin(locals.user.id, env.ADMIN_USER_IDS)) {
		throw error(403, 'Admin access required');
	}
}

const VariantSchema = z.object({
	key: z.string().min(1).max(50),
	value: z.string().min(1).max(500),
	weight: z.number().int().min(1).optional()
});

const CreateExperimentSchema = z.object({
	slug: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
	name: z.string().min(1).max(200),
	description: z.string().max(1000).optional(),
	page: z.string().min(1).max(200),
	element: z.string().min(1).max(200),
	variants: z.array(VariantSchema).min(2).max(10),
	traffic_pct: z.number().int().min(0).max(100).optional().default(100)
});

const UpdateExperimentSchema = z.object({
	id: z.string().uuid(),
	status: z.enum(['draft', 'running', 'paused', 'completed']).optional(),
	winner: z.string().max(50).optional(),
	traffic_pct: z.number().int().min(0).max(100).optional(),
	variants: z.array(VariantSchema).min(2).max(10).optional(),
	name: z.string().min(1).max(200).optional(),
	description: z.string().max(1000).optional()
});

export const GET: RequestHandler = async ({ locals }) => {
	requireAdminRequest(locals);

	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceRoleKey) {
		throw error(500, 'Service role key not configured');
	}

	const supabase = createServiceRoleClient(serviceRoleKey);

	const { data, error: dbError } = await supabase
		.from('ab_experiments' as any)
		.select('*')
		.order('created_at', { ascending: false });

	if (dbError) {
		throw error(500, dbError.message);
	}

	return json({ experiments: data || [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdminRequest(locals);

	const body = await request.json();
	const parsed = CreateExperimentSchema.safeParse(body);

	if (!parsed.success) {
		return json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceRoleKey) {
		throw error(500, 'Service role key not configured');
	}

	const supabase = createServiceRoleClient(serviceRoleKey);

	const { data, error: dbError } = await supabase
		.from('ab_experiments' as any)
		.insert({
			slug: parsed.data.slug,
			name: parsed.data.name,
			description: parsed.data.description || null,
			page: parsed.data.page,
			element: parsed.data.element,
			variants: parsed.data.variants,
			traffic_pct: parsed.data.traffic_pct
		})
		.select()
		.single();

	if (dbError) {
		if (dbError.code === '23505') {
			return json({ error: 'Experiment slug already exists' }, { status: 409 });
		}
		throw error(500, dbError.message);
	}

	invalidateExperimentCache();
	return json({ experiment: data }, { status: 201 });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	requireAdminRequest(locals);

	const body = await request.json();
	const parsed = UpdateExperimentSchema.safeParse(body);

	if (!parsed.success) {
		return json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceRoleKey) {
		throw error(500, 'Service role key not configured');
	}

	const supabase = createServiceRoleClient(serviceRoleKey);

	// Build update object
	const update: Record<string, unknown> = {};
	if (parsed.data.status !== undefined) {
		update.status = parsed.data.status;
		if (parsed.data.status === 'running') update.started_at = new Date().toISOString();
		if (parsed.data.status === 'completed') update.ended_at = new Date().toISOString();
	}
	if (parsed.data.winner !== undefined) update.winner = parsed.data.winner;
	if (parsed.data.traffic_pct !== undefined) update.traffic_pct = parsed.data.traffic_pct;
	if (parsed.data.variants !== undefined) update.variants = parsed.data.variants;
	if (parsed.data.name !== undefined) update.name = parsed.data.name;
	if (parsed.data.description !== undefined) update.description = parsed.data.description;

	const { data, error: dbError } = await supabase
		.from('ab_experiments' as any)
		.update(update)
		.eq('id', parsed.data.id)
		.select()
		.single();

	if (dbError) {
		throw error(500, dbError.message);
	}

	invalidateExperimentCache();
	return json({ experiment: data });
};
