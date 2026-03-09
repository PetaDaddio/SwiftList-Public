/**
 * A/B Testing Client-Side Tracker
 * Handles: impression deduplication, conversion tracking
 *
 * All tracking is fire-and-forget — never blocks user flow.
 */

import { browser } from '$app/environment';

/**
 * Track an impression for an experiment.
 * Deduplicated per session via sessionStorage.
 */
export function trackImpression(
	experimentSlug: string,
	variant: string,
	experimentId: string
): void {
	if (!browser) return;

	const dedupKey = `sl_ab_imp_${experimentSlug}`;
	if (sessionStorage.getItem(dedupKey)) return;

	sessionStorage.setItem(dedupKey, '1');

	sendEvent(experimentId, variant, 'impression');
}

/**
 * Track a conversion event (click, checkout, purchase).
 * Not deduplicated — each click/action counts.
 */
export function trackConversion(
	experimentSlug: string,
	eventType: 'click' | 'checkout' | 'purchase',
	metadata?: Record<string, unknown>
): void {
	if (!browser) return;

	// Get experiment assignment from page data (stored as data attribute by ABTest component)
	const assignmentData = document.querySelector(`[data-ab-experiment="${experimentSlug}"]`);
	const experimentId = assignmentData?.getAttribute('data-ab-experiment-id') || '';
	const variant = assignmentData?.getAttribute('data-ab-variant') || '';

	if (!experimentId || !variant) return;

	sendEvent(experimentId, variant, eventType, metadata);
}

/**
 * Fire-and-forget POST to /api/ab/track.
 * Uses navigator.sendBeacon when available for reliability on page unload.
 */
function sendEvent(
	experimentId: string,
	variant: string,
	eventType: string,
	metadata?: Record<string, unknown>
): void {
	const payload = JSON.stringify({
		experiment_id: experimentId,
		variant,
		event_type: eventType,
		metadata: metadata || {}
	});

	// Prefer sendBeacon for reliability (survives page navigation)
	if (navigator.sendBeacon) {
		const blob = new Blob([payload], { type: 'application/json' });
		navigator.sendBeacon('/api/ab/track', blob);
		return;
	}

	// Fallback to fetch
	fetch('/api/ab/track', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload,
		keepalive: true
	}).catch(() => {
		// Silently fail — tracking should never break the user experience
	});
}
