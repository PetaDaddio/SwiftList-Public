/**
 * A/B Testing Configuration
 * Handles: deterministic variant assignment, experiment caching, hash function
 *
 * Supports any number of variants (A/B, A/B/C, A/B/C/D, etc.)
 * Variant assignment is stateless — computed from hash(visitor_id + slug)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface ExperimentVariant {
	key: string; // 'control' | 'variant_a' | 'variant_b' | ...
	value: string; // The actual content (button text, headline, etc.)
	weight?: number; // Optional weight for uneven splits (default: equal)
}

export interface Experiment {
	id: string;
	slug: string;
	name: string;
	page: string;
	element: string;
	variants: ExperimentVariant[];
	traffic_pct: number;
	status: string;
}

export interface VariantAssignment {
	experimentId: string;
	slug: string;
	variant: string; // The variant key
	value: string; // The variant value (content to render)
}

// ============================================================================
// DETERMINISTIC HASH FUNCTION
// ============================================================================

/**
 * Simple string hash (djb2) — deterministic, fast, good distribution.
 * Used to assign visitors to variants without storing state.
 */
function djb2Hash(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return hash >>> 0; // Ensure unsigned 32-bit integer
}

/**
 * Assign a variant for a visitor + experiment combination.
 * Deterministic: same visitor always gets same variant for same experiment.
 */
export function assignVariant(visitorId: string, experiment: Experiment): VariantAssignment {
	const variants = experiment.variants;
	if (!variants || variants.length === 0) {
		return {
			experimentId: experiment.id,
			slug: experiment.slug,
			variant: 'control',
			value: ''
		};
	}

	// Check if visitor is in the traffic percentage
	if (experiment.traffic_pct < 100) {
		const trafficHash = djb2Hash(`${visitorId}:traffic:${experiment.slug}`);
		if (trafficHash % 100 >= experiment.traffic_pct) {
			// Visitor excluded from experiment — serve control
			return {
				experimentId: experiment.id,
				slug: experiment.slug,
				variant: variants[0].key,
				value: variants[0].value
			};
		}
	}

	// Check for weighted variants
	const hasWeights = variants.some((v) => v.weight !== undefined && v.weight !== null);

	if (hasWeights) {
		// Weighted assignment
		const totalWeight = variants.reduce((sum, v) => sum + (v.weight ?? 1), 0);
		const hash = djb2Hash(`${visitorId}:${experiment.slug}`);
		let bucket = hash % totalWeight;

		for (const variant of variants) {
			bucket -= variant.weight ?? 1;
			if (bucket < 0) {
				return {
					experimentId: experiment.id,
					slug: experiment.slug,
					variant: variant.key,
					value: variant.value
				};
			}
		}
	}

	// Equal-weight assignment (default)
	const hash = djb2Hash(`${visitorId}:${experiment.slug}`);
	const index = hash % variants.length;
	const selected = variants[index];

	return {
		experimentId: experiment.id,
		slug: experiment.slug,
		variant: selected.key,
		value: selected.value
	};
}

// ============================================================================
// EXPERIMENT CACHE (in-memory, server-side)
// ============================================================================

let cachedExperiments: Experiment[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch active (running) experiments from Supabase.
 * Cached in-memory for 5 minutes to avoid DB hits on every request.
 */
export async function getActiveExperiments(supabase: SupabaseClient): Promise<Experiment[]> {
	const now = Date.now();

	if (cachedExperiments.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedExperiments;
	}

	const { data, error } = await supabase
		.from('ab_experiments' as any)
		.select('id, slug, name, page, element, variants, traffic_pct, status')
		.eq('status', 'running');

	if (error) {
		// On error, return stale cache or empty
		return cachedExperiments;
	}

	cachedExperiments = ((data || []) as any[]).map((exp) => ({
		...exp,
		variants: (exp.variants as ExperimentVariant[]) || []
	}));
	cacheTimestamp = now;

	return cachedExperiments;
}

/**
 * Force-refresh the experiment cache (called after admin changes).
 */
export function invalidateExperimentCache(): void {
	cacheTimestamp = 0;
}

/**
 * Compute all variant assignments for a visitor across active experiments.
 */
export function computeAssignments(
	visitorId: string,
	experiments: Experiment[]
): Record<string, VariantAssignment> {
	const assignments: Record<string, VariantAssignment> = {};

	for (const experiment of experiments) {
		assignments[experiment.slug] = assignVariant(visitorId, experiment);
	}

	return assignments;
}
