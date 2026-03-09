<script lang="ts">
	/**
	 * ABTest Component — Svelte 5
	 *
	 * Renders the assigned variant for a given experiment.
	 * Supports any number of variants (A/B, A/B/C, etc.)
	 *
	 * Usage:
	 * <ABTest experiment="pricing-cta-text" let:variant let:value>
	 *   <button>{value}</button>
	 * </ABTest>
	 */
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { trackImpression } from '$lib/ab/tracker';

	export let experiment: string;

	// Read assignment from page data (set by hooks.server.ts → layout)
	$: assignment = $page.data.abTests?.[experiment];
	$: variant = assignment?.variant ?? 'control';
	$: value = assignment?.value ?? '';
	$: experimentId = assignment?.experimentId ?? '';

	// Auto-fire impression on mount (deduplicated in tracker)
	onMount(() => {
		if (experimentId && variant) {
			trackImpression(experiment, variant, experimentId);
		}
	});
</script>

{#if assignment}
	<span
		data-ab-experiment={experiment}
		data-ab-experiment-id={experimentId}
		data-ab-variant={variant}
		style="display: contents;"
	>
		<slot {variant} {value} />
	</span>
{:else}
	<!-- No experiment running — render slot with defaults -->
	<slot {variant} {value} />
{/if}
