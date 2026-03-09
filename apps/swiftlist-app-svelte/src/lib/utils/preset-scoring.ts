/**
 * Preset Library Feed Algorithm
 * Pure scoring function for ranking community presets in the feed.
 * 100-point scale with anti-domination rules.
 */

export interface ScoringPreset {
	id: string | number;
	creatorId?: string;
	createdAt?: string;
	trustScore?: number;
	favoritesCount?: number;
	usageCount: number;
	creatorAccountAge?: number; // days since creator account creation
	source: 'seed' | 'community';
}

export interface ScoringContext {
	followedUserIds: Set<string>;
	currentUserId: string | null;
}

/** Calculate a 0-100 display score for a preset */
export function calculatePresetScore(preset: ScoringPreset, context: ScoringContext): number {
	let score = 0;

	// Followed creator: +50
	if (preset.creatorId && context.followedUserIds.has(preset.creatorId)) {
		score += 50;
	}

	// Recency: +20 max, linear decay over 14 days
	if (preset.createdAt) {
		const daysSinceCreated = (Date.now() - new Date(preset.createdAt).getTime()) / (1000 * 60 * 60 * 24);
		score += Math.max(0, 20 * (1 - daysSinceCreated / 14));
	}

	// Creator trust score: +15 max
	const trustScore = preset.trustScore ?? 0;
	score += (trustScore / 100) * 15;

	// Favorites count: +10 max, capped at 10
	const favoritesCount = preset.favoritesCount ?? 0;
	score += Math.min(10, favoritesCount);

	// Usage count: +5 max, weak signal
	score += Math.min(5, (preset.usageCount ?? 0) / 2);

	// New creator boost: +10 if account < 30 days old
	if (preset.creatorAccountAge !== undefined && preset.creatorAccountAge < 30) {
		score += 10;
	}

	return score;
}

/** Apply anti-domination rules: per-creator cap, shuffle band */
export function applyAntiDomination<T extends ScoringPreset>(
	presets: T[],
	scores: Map<string | number, number>
): T[] {
	// Sort by score descending
	const sorted = [...presets].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));

	// Shuffle band: presets within 5 points of each other get randomized
	const shuffled = applyShuffleBand(sorted, scores);

	// Per-creator cap: max 3 in top 20
	return applyCreatorCap(shuffled, 20, 3);
}

function applyShuffleBand<T extends ScoringPreset>(
	sorted: T[],
	scores: Map<string | number, number>
): T[] {
	const result: T[] = [];
	let i = 0;

	while (i < sorted.length) {
		const baseScore = scores.get(sorted[i].id) ?? 0;
		// Collect all presets within 5 points of this one
		const band: T[] = [sorted[i]];
		let j = i + 1;
		while (j < sorted.length && baseScore - (scores.get(sorted[j].id) ?? 0) <= 5) {
			band.push(sorted[j]);
			j++;
		}

		// Shuffle the band using Fisher-Yates
		for (let k = band.length - 1; k > 0; k--) {
			const r = Math.floor(Math.random() * (k + 1));
			[band[k], band[r]] = [band[r], band[k]];
		}

		result.push(...band);
		i = j;
	}

	return result;
}

function applyCreatorCap<T extends ScoringPreset>(
	sorted: T[],
	topN: number,
	maxPerCreator: number
): T[] {
	const top: T[] = [];
	const overflow: T[] = [];
	const rest: T[] = [];
	const creatorCount = new Map<string, number>();

	for (let i = 0; i < sorted.length; i++) {
		if (i >= topN) {
			rest.push(sorted[i]);
			continue;
		}

		const creatorId = sorted[i].creatorId ?? '';
		const count = creatorCount.get(creatorId) ?? 0;

		if (count < maxPerCreator) {
			top.push(sorted[i]);
			creatorCount.set(creatorId, count + 1);
		} else {
			overflow.push(sorted[i]);
		}
	}

	return [...top, ...rest, ...overflow];
}

/** Score and rank community presets, appending seed presets after */
export function rankPresets<T extends ScoringPreset>(
	presets: T[],
	context: ScoringContext
): T[] {
	const community = presets.filter((p) => p.source === 'community');
	const seeds = presets.filter((p) => p.source === 'seed');

	// Score community presets
	const scores = new Map<string | number, number>();
	for (const preset of community) {
		scores.set(preset.id, calculatePresetScore(preset, context));
	}

	// Apply anti-domination and return community first, then seeds
	const ranked = applyAntiDomination(community, scores);
	return [...ranked, ...seeds];
}
