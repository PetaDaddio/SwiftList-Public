<script lang="ts">
	import { onMount } from 'svelte';
	import { driver, type DriveStep, type Driver } from 'driver.js';
	import 'driver.js/dist/driver.css';

	interface Props {
		tourId: string;
		steps: DriveStep[];
		autoStart?: boolean;
	}

	let { tourId, steps, autoStart = false }: Props = $props();

	let driverInstance: Driver | null = null;

	const STORAGE_KEY = `swiftlist-tour-${tourId}-done`;

	function isCompleted(): boolean {
		if (typeof window === 'undefined') return true;
		return localStorage.getItem(STORAGE_KEY) === 'true';
	}

	function markCompleted(): void {
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, 'true');
		}
	}

	export function startTour(): void {
		// Clear completion flag so it can auto-start fresh
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY);
		}
		driverInstance?.drive();
	}

	onMount(() => {
		let attempts = 0;
		const MAX_ATTEMPTS = 10;
		let intervalId: ReturnType<typeof setInterval>;

		function tryInitTour() {
			attempts++;

			// Filter steps to only those whose elements exist in the DOM
			const validSteps = steps.filter((step) => {
				if (!step.element) return true; // non-element steps always valid
				return document.querySelector(step.element as string) !== null;
			});

			// Retry if no elements found yet and we haven't exhausted attempts
			if (validSteps.length === 0 && attempts < MAX_ATTEMPTS) return;

			// Stop retrying
			clearInterval(intervalId);

			if (validSteps.length === 0) return;

			driverInstance = driver({
				showProgress: true,
				animate: true,
				overlayColor: 'rgba(0, 0, 0, 0.6)',
				stagePadding: 8,
				stageRadius: 8,
				popoverClass: 'swiftlist-tour-popover',
				nextBtnText: 'Next',
				prevBtnText: 'Back',
				doneBtnText: 'Got it!',
				steps: validSteps,
				onDestroyed: () => {
					markCompleted();
				}
			});

			if (autoStart && !isCompleted()) {
				driverInstance.drive();
			}
		}

		// Poll every 500ms for up to 5s waiting for async content to render
		intervalId = setInterval(tryInitTour, 500);

		return () => {
			clearInterval(intervalId);
			driverInstance?.destroy();
		};
	});
</script>

<style>
	:global(.swiftlist-tour-popover) {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		max-width: 340px;
	}

	:global(.swiftlist-tour-popover .driver-popover-title) {
		font-size: 1rem;
		font-weight: 700;
		color: #1a1a1a;
	}

	:global(.swiftlist-tour-popover .driver-popover-description) {
		font-size: 0.875rem;
		line-height: 1.5;
		color: #4a4a4a;
	}

	:global(.swiftlist-tour-popover .driver-popover-next-btn),
	:global(.swiftlist-tour-popover .driver-popover-done-btn) {
		background-color: #00796b;
		color: white;
		border: none;
		border-radius: 6px;
		padding: 6px 16px;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		text-shadow: none;
	}

	:global(.swiftlist-tour-popover .driver-popover-next-btn:hover),
	:global(.swiftlist-tour-popover .driver-popover-done-btn:hover) {
		background-color: #00695c;
	}

	:global(.swiftlist-tour-popover .driver-popover-prev-btn) {
		background-color: transparent;
		color: #666;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 6px 16px;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
	}

	:global(.swiftlist-tour-popover .driver-popover-prev-btn:hover) {
		background-color: #f5f5f5;
		color: #333;
	}

	:global(.swiftlist-tour-popover .driver-popover-progress-text) {
		color: #999;
		font-size: 0.75rem;
	}

	:global(.swiftlist-tour-popover .driver-popover-close-btn) {
		color: #999;
	}

	:global(.swiftlist-tour-popover .driver-popover-close-btn:hover) {
		color: #333;
	}
</style>
