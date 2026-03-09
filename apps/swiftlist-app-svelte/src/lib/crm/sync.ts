/**
 * CRM Sync Functions
 *
 * Fire-and-forget sync from swiftlist-production → swiftlist-crm.
 * All functions are non-blocking and fail silently (CRM is not critical path).
 *
 * Pattern: Call these at the end of API routes after the main operation succeeds.
 * They never throw — errors are logged and swallowed.
 */

import { getCrmClient } from './client';
import { apiLogger } from '$lib/utils/logger';

const log = apiLogger.child({ module: 'crm-sync' });

// ============================================================
// TYPES
// ============================================================

type LifecycleStage = 'lead' | 'user' | 'active' | 'creator' | 'churned';

type ActivityEventType =
	| 'waitlist_signup'
	| 'account_created'
	| 'first_job'
	| 'vibe_published'
	| 'vibe_milestone'
	| 'sparks_earned'
	| 'tier_upgraded'
	| 'tier_downgraded'
	| 'account_deleted';

interface ContactUpsertData {
	email: string;
	display_name?: string;
	avatar_url?: string;
	twitter_url?: string;
	instagram_url?: string;
	tiktok_url?: string;
	website_url?: string;
	swiftlist_user_id?: string;
	swiftlist_subscription_tier?: string;
	swiftlist_joined_at?: string;
	lifecycle_stage?: LifecycleStage;
	lead_source?: string;
	lead_status?: string;
	deal_stage?: string;
}

interface ProductActivityData {
	credits_balance?: number;
	total_sparks_earned?: number;
	total_sparks_spent?: number;
	total_jobs_created?: number;
	total_jobs_completed?: number;
	total_jobs_failed?: number;
	public_vibes_count?: number;
	total_vibe_usage?: number;
	last_job_at?: string;
	last_login_at?: string;
}

// ============================================================
// CORE SYNC FUNCTIONS
// ============================================================

/**
 * Upsert a contact in the CRM by email.
 * Creates if new, updates if exists. Non-blocking, never throws.
 */
export async function syncContactToCrm(data: ContactUpsertData): Promise<void> {
	try {
		const crm = getCrmClient();
		if (!crm) return;

		const email = data.email.toLowerCase().trim();

		const { error } = await crm.from('contacts').upsert(
			{
				email,
				display_name: data.display_name,
				avatar_url: data.avatar_url,
				twitter_url: data.twitter_url,
				instagram_url: data.instagram_url,
				tiktok_url: data.tiktok_url,
				website_url: data.website_url,
				swiftlist_user_id: data.swiftlist_user_id,
				swiftlist_subscription_tier: data.swiftlist_subscription_tier,
				swiftlist_joined_at: data.swiftlist_joined_at,
				lifecycle_stage: data.lifecycle_stage,
				lead_source: data.lead_source,
				lead_status: data.lead_status,
				deal_stage: data.deal_stage,
				last_synced_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'email', ignoreDuplicates: false }
		);

		if (error) {
			log.error({ err: error, email }, 'CRM contact upsert failed');
		} else {
			log.debug({ email }, 'CRM contact synced');
		}
	} catch (err) {
		log.error({ err }, 'CRM sync error (swallowed)');
	}
}

/**
 * Update product activity counters for a contact by email.
 * Non-blocking, never throws.
 */
export async function syncProductActivity(
	email: string,
	activity: ProductActivityData
): Promise<void> {
	try {
		const crm = getCrmClient();
		if (!crm) return;

		const cleanEmail = email.toLowerCase().trim();

		const { error } = await crm
			.from('contacts')
			.update({
				...activity,
				last_synced_at: new Date().toISOString()
			})
			.eq('email', cleanEmail);

		if (error) {
			log.error({ err: error, email: cleanEmail }, 'CRM product activity sync failed');
		} else {
			log.debug({ email: cleanEmail }, 'CRM product activity synced');
		}
	} catch (err) {
		log.error({ err }, 'CRM activity sync error (swallowed)');
	}
}

/**
 * Log an activity event to the CRM activities table.
 * Looks up contact_id by email, then inserts activity.
 * Non-blocking, never throws.
 */
export async function logCrmActivity(
	email: string,
	eventType: ActivityEventType,
	metadata: Record<string, unknown> = {}
): Promise<void> {
	try {
		const crm = getCrmClient();
		if (!crm) return;

		const cleanEmail = email.toLowerCase().trim();

		// Look up contact_id
		const { data: contact, error: lookupError } = await crm
			.from('contacts')
			.select('id')
			.eq('email', cleanEmail)
			.single();

		if (lookupError || !contact) {
			log.warn({ email: cleanEmail, eventType }, 'CRM activity log: contact not found');
			return;
		}

		const { error } = await crm.from('activities').insert({
			contact_id: contact.id,
			activity_type: eventType,
			metadata,
			created_at: new Date().toISOString()
		});

		if (error) {
			log.error({ err: error, email: cleanEmail, eventType }, 'CRM activity log insert failed');
		} else {
			log.debug({ email: cleanEmail, eventType }, 'CRM activity logged');
		}
	} catch (err) {
		log.error({ err }, 'CRM activity log error (swallowed)');
	}
}

// ============================================================
// CONVENIENCE FUNCTIONS (called from specific app events)
// ============================================================

/**
 * Called when a new user creates an account (signup or OAuth).
 * Upserts contact and logs account_created activity.
 */
export async function onUserSignup(params: {
	email: string;
	userId: string;
	displayName: string;
	avatarUrl?: string;
	source: 'signup' | 'google';
}): Promise<void> {
	const { email, userId, displayName, avatarUrl, source } = params;

	// Upsert contact — upgrades lead to user if they were on waitlist
	await syncContactToCrm({
		email,
		display_name: displayName,
		avatar_url: avatarUrl,
		swiftlist_user_id: userId,
		swiftlist_joined_at: new Date().toISOString(),
		swiftlist_subscription_tier: 'free',
		lifecycle_stage: 'user',
		lead_source: source,
		lead_status: 'Converted',
		deal_stage: 'Customer'
	});

	await logCrmActivity(email, 'account_created', {
		user_id: userId,
		source,
		display_name: displayName
	});
}

/**
 * Called when a user's subscription tier changes.
 */
export async function onTierChange(params: {
	email: string;
	oldTier: string;
	newTier: string;
}): Promise<void> {
	const { email, oldTier, newTier } = params;
	const isUpgrade = tierRank(newTier) > tierRank(oldTier);

	await syncContactToCrm({
		email,
		swiftlist_subscription_tier: newTier
	});

	await logCrmActivity(email, isUpgrade ? 'tier_upgraded' : 'tier_downgraded', {
		from: oldTier,
		to: newTier
	});
}

/**
 * Called when a user completes their first job.
 */
export async function onFirstJob(email: string, jobId: string): Promise<void> {
	await syncContactToCrm({
		email,
		lifecycle_stage: 'active'
	});

	await logCrmActivity(email, 'first_job', { job_id: jobId });
}

/**
 * Called when a user publishes a vibe (makes it public).
 */
export async function onVibePublished(
	email: string,
	vibeName: string,
	vibeId: string
): Promise<void> {
	await syncContactToCrm({
		email,
		lifecycle_stage: 'creator'
	});

	await logCrmActivity(email, 'vibe_published', {
		vibe_name: vibeName,
		vibe_id: vibeId
	});
}

// ============================================================
// BULK SYNC (for cron endpoint)
// ============================================================

/**
 * Sync all active users' product activity to CRM.
 * Called by /api/cron/sync-crm on a schedule.
 *
 * @param productionClient - Supabase client for swiftlist-production
 * @returns number of contacts synced
 */
export async function bulkSyncProductActivity(
	productionClient: import('@supabase/supabase-js').SupabaseClient
): Promise<number> {
	const crm = getCrmClient();
	if (!crm) {
		log.warn('CRM not configured — skipping bulk sync');
		return 0;
	}

	// Get all contacts that have a swiftlist_user_id
	const { data: crmContacts, error: crmError } = await crm
		.from('contacts')
		.select('email, swiftlist_user_id')
		.not('swiftlist_user_id', 'is', null);

	if (crmError || !crmContacts?.length) {
		log.warn({ err: crmError }, 'No CRM contacts with swiftlist_user_id');
		return 0;
	}

	let synced = 0;

	for (const contact of crmContacts) {
		try {
			if (!contact.swiftlist_user_id) continue;

			// Fetch profile from production
			const { data: profile } = await productionClient
				.from('profiles')
				.select('credits_balance, display_name, avatar_url, twitter_url, instagram_url, tiktok_url, website_url, subscription_tier')
				.eq('user_id', contact.swiftlist_user_id)
				.single();

			if (!profile) continue;

			// Fetch job counts from production
			const { count: totalJobs } = await productionClient
				.from('jobs')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', contact.swiftlist_user_id);

			const { count: completedJobs } = await productionClient
				.from('jobs')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', contact.swiftlist_user_id)
				.eq('status', 'succeeded');

			const { count: failedJobs } = await productionClient
				.from('jobs')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', contact.swiftlist_user_id)
				.eq('status', 'failed');

			// Fetch last job timestamp
			const { data: lastJob } = await productionClient
				.from('jobs')
				.select('created_at')
				.eq('user_id', contact.swiftlist_user_id)
				.order('created_at', { ascending: false })
				.limit(1)
				.single();

			// Fetch public vibes count
			const { count: publicVibes } = await productionClient
				.from('presets')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', contact.swiftlist_user_id)
				.eq('is_public', true);

			// Fetch total vibe usage (sum of usage_count across public vibes)
			const { data: vibeUsage } = await productionClient
				.from('presets')
				.select('usage_count')
				.eq('user_id', contact.swiftlist_user_id)
				.eq('is_public', true);

			const totalVibeUsage = vibeUsage?.reduce(
				(sum, v) => sum + (v.usage_count || 0),
				0
			) ?? 0;

			// Fetch sparks from credit_transactions
			const { data: sparksData } = await productionClient
				.from('credit_transactions')
				.select('amount, transaction_type')
				.eq('user_id', contact.swiftlist_user_id)
				.in('transaction_type', ['royalty', 'purchase']);

			const totalSparksEarned = sparksData
				?.filter((t) => t.transaction_type === 'royalty')
				.reduce((sum, t) => sum + (t.amount || 0), 0) ?? 0;

			const totalSparksSpent = sparksData
				?.filter((t) => t.amount < 0)
				.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) ?? 0;

			// Determine lifecycle stage
			let lifecycleStage: LifecycleStage = 'user';
			if ((publicVibes ?? 0) > 0) lifecycleStage = 'creator';
			else if ((completedJobs ?? 0) > 0) lifecycleStage = 'active';

			// Update CRM contact
			await syncProductActivity(contact.email, {
				credits_balance: profile.credits_balance ?? 0,
				total_sparks_earned: totalSparksEarned,
				total_sparks_spent: totalSparksSpent,
				total_jobs_created: totalJobs ?? 0,
				total_jobs_completed: completedJobs ?? 0,
				total_jobs_failed: failedJobs ?? 0,
				public_vibes_count: publicVibes ?? 0,
				total_vibe_usage: totalVibeUsage,
				last_job_at: lastJob?.created_at ?? undefined
			});

			// Also update display name, avatar, social links, tier, and lifecycle
			await syncContactToCrm({
				email: contact.email,
				display_name: profile.display_name,
				avatar_url: profile.avatar_url,
				twitter_url: profile.twitter_url ?? undefined,
				instagram_url: profile.instagram_url ?? undefined,
				tiktok_url: profile.tiktok_url ?? undefined,
				website_url: profile.website_url ?? undefined,
				swiftlist_subscription_tier: profile.subscription_tier ?? 'free',
				lifecycle_stage: lifecycleStage
			});

			synced++;
		} catch (err) {
			log.error({ err, email: contact.email }, 'Bulk sync error for contact (continuing)');
		}
	}

	log.info({ synced, total: crmContacts.length }, 'Bulk CRM sync completed');
	return synced;
}

// ============================================================
// HELPERS
// ============================================================

function tierRank(tier: string): number {
	const ranks: Record<string, number> = { free: 0, pro: 1, unlimited: 2 };
	return ranks[tier] ?? 0;
}
