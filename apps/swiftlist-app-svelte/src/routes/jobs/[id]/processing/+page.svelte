<script lang="ts">
	/**
	 * Job Processing Screen
	 * Shows grey pulsing gradient while job is being processed
	 * Polls job status every 3 seconds via server API (for proper auth)
	 * Redirects to completion page when done
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';

	const jobId = $derived($page.params.id);

	let status = $state('processing');
	let progressMessage = $state('Initializing workflow...');
	let errorMessage = $state('');
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	// Timeout protection to prevent infinite hangs
	const POLLING_TIMEOUT = 8 * 60 * 1000; // 8 minutes (AI processing can take 60s+)
	const MAX_CONSECUTIVE_FAILURES = 15; // 45 seconds of failures before giving up
	let pollingStartTime = 0;
	let pollCount = 0;
	let consecutiveFailures = 0;
	let elapsedSeconds = $state(0);

	// Track whether we have a real progress message from the database
	let hasDbProgress = $state(false);

	// Fallback status messages that rotate only when no DB progress is available
	const statusMessages = [
		'Analyzing pixels...',
		'Removing background...',
		'Enhancing image quality...',
		'Optimizing output...',
		'Finalizing results...'
	];

	let currentMessageIndex = $state(0);

	onMount(() => {
		// Rotate fallback status messages (only shown when no DB progress)
		const messageInterval = setInterval(() => {
			if (!hasDbProgress) {
				currentMessageIndex = (currentMessageIndex + 1) % statusMessages.length;
				progressMessage = statusMessages[currentMessageIndex];
			}
		}, 4000);

		// Track elapsed time for user feedback
		const timeTracker = setInterval(() => {
			elapsedSeconds++;
			if (elapsedSeconds > 300) {
				// 5 minutes
			}
		}, 1000);

		// Run async initialization in IIFE (onMount callbacks should not be async)
		(async () => {
			// Record polling start time for timeout protection
			pollingStartTime = Date.now();

			// Check job status first, then trigger if needed
			const shouldTrigger = await checkAndTriggerIfNeeded();

			// Start polling job status only if trigger succeeded or job already processing
			if (shouldTrigger || status !== 'failed') {
				pollJobStatus();
				pollInterval = setInterval(pollJobStatus, 3000);
			}
		})();

		return () => {
			clearInterval(messageInterval);
			clearInterval(timeTracker);
		};
	});

	async function checkAndTriggerIfNeeded(): Promise<boolean> {
		try {
			// Use server API endpoint for proper auth context (RLS requires auth.uid() = user_id)
			const response = await fetch(`/api/jobs/${jobId}`);

			if (!response.ok) {
				errorMessage = 'Job not found';
				status = 'failed';
				return false;
			}

			const data = await response.json();
			const job = data.job;

			if (!job) {
				errorMessage = 'Job not found';
				status = 'failed';
				return false;
			}

			// If already completed, redirect immediately
			if (job.status === 'completed') {
				window.location.href = `/jobs/${jobId}/complete`;
				return false;
			}

			// If already processing, just start polling (don't trigger again)
			if (job.status === 'processing') {
				return true;
			}

			// If failed, show error
			if (job.status === 'failed') {
				errorMessage = job.error_message || 'Job processing failed';
				status = 'failed';
				return false;
			}

			// If pending, trigger processing
			if (job.status === 'pending') {
				const processResponse = await fetch('/api/jobs/process', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ job_id: jobId })
				});

				if (!processResponse.ok) {
					const errorData = await processResponse.json();
					errorMessage = errorData.message || 'Failed to start job processing';
					status = 'failed';
					return false;
				}

				return true;
			}

			return true;
		} catch (err: any) {
			errorMessage = 'Failed to start job processing';
			status = 'failed';
			return false;
		}
	}

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	async function pollJobStatus() {
		try {
			// Timeout protection: stop polling after 5 minutes
			const elapsed = Date.now() - pollingStartTime;
			if (elapsed > POLLING_TIMEOUT) {
				console.error('⏱️ Polling timeout (5 minutes) - stopping');
				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = null;
				}
				status = 'failed';
				errorMessage =
					'Processing took too long (timeout after 5 minutes). Please try again or contact support.';
				return;
			}

			pollCount++;

			// Use server API endpoint for proper auth context (RLS requires auth.uid() = user_id)
			const response = await fetch(`/api/jobs/${jobId}`);

			if (!response.ok) {
				consecutiveFailures++;
				console.error(
					`❌ Job fetch error: ${response.status} (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`
				);

				// Stop polling after too many consecutive failures
				if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
					status = 'failed';
					errorMessage =
						'Unable to check job status (network error). Please check your connection and try again.';
				}

				if (response.status === 404) {
					errorMessage = 'Job not found';
					status = 'failed';
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
				}
				return;
			}

			// Reset consecutive failures on successful response
			consecutiveFailures = 0;

			const data = await response.json();
			const job = data.job;

			if (!job) {
				errorMessage = 'Job not found';
				status = 'failed';
				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = null;
				}
				return;
			}

			// Detect stale "processing" status (job stuck for > 10 minutes)
			if (job.status === 'processing' && job.updated_at) {
				const jobAge = Date.now() - new Date(job.updated_at).getTime();
				if (jobAge > 10 * 60 * 1000) {
					// 10 minutes
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
					status = 'failed';
					errorMessage =
						'Job appears stuck (no updates for 10+ minutes). Please try creating a new job.';
					return;
				}
			}

			// Update progress message from database (overrides rotating fallback)
			if (job.progress_message) {
				progressMessage = job.progress_message;
				hasDbProgress = true;
			}

			// Check job status
			if (job.status === 'completed') {
				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = null;
				}

				// Use window.location.href for guaranteed navigation
				const redirectUrl = `/jobs/${jobId}/complete`;

				// Redirect immediately
				window.location.href = redirectUrl;
			} else if (job.status === 'failed') {
				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = null;
				}
				status = 'failed';
				errorMessage = job.error_message || 'Job processing failed';
			}
		} catch (err: any) {
			consecutiveFailures++;
			console.error(
				`💥 Polling error (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`,
				err
			);

			// Stop polling after too many consecutive failures
			if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = null;
				}
				status = 'failed';
				errorMessage = 'Connection issues. Please check your network and try again.';
			}
		}
	}
</script>

<svelte:head>
	<title>Processing Job - SwiftList</title>
</svelte:head>

<div class="min-h-screen processing-bg flex items-center justify-center p-4">
	<div class="w-full max-w-2xl">
		{#if status === 'processing'}
			<!-- Modern Shimmer Loading Effect -->
			<div class="relative overflow-hidden rounded-xl h-96 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-200">
				<!-- Primary shimmer wave -->
				<div class="absolute inset-0 shimmer-animation"></div>

				<!-- Content overlay with subtle backdrop -->
				<div class="relative h-full flex flex-col items-center justify-center text-center p-8 bg-white/10 backdrop-blur-sm">
					<!-- Status message -->
					<h2 class="text-2xl md:text-3xl font-bold text-[#2C3E50] mb-3 drop-shadow-sm">
						Processing Your Image
					</h2>

					<p class="text-base md:text-lg text-[#4B5563] font-medium animate-fade-in-out">
						{progressMessage}
					</p>

					<p class="text-sm text-[#6B7280] mt-2">
						This may take up to a minute or more — please don't refresh the page.
					</p>

					<!-- Processing indicator dots -->
					<div class="flex gap-2 mt-6">
						<div class="w-3 h-3 bg-[#00796B] rounded-full animate-bounce" style="animation-delay: 0ms"></div>
						<div class="w-3 h-3 bg-[#00796B] rounded-full animate-bounce" style="animation-delay: 150ms"></div>
						<div class="w-3 h-3 bg-[#00796B] rounded-full animate-bounce" style="animation-delay: 300ms"></div>
					</div>

					<!-- Job ID -->
					<div class="mt-8 text-center">
						<p class="text-xs sm:text-sm font-mono text-[#4B5563] opacity-70">
							Job ID: {jobId?.slice(0, 8) ?? '...'}...
						</p>
					</div>

					<!-- Status auto-refreshes via polling -->
				</div>
			</div>
		{:else if status === 'failed'}
			<!-- Error state -->
			<div class="bg-white rounded-xl p-8 shadow-sm border border-red-200">
				<div class="text-center">
					<span class="material-symbols-outlined text-red-600 text-6xl mb-4 block">
						error
					</span>
					<h2 class="text-2xl font-bold text-[#2C3E50] mb-2">
						Processing Failed
					</h2>
					<p class="text-[#4B5563] mb-6">
						{errorMessage}
					</p>
					<div class="flex gap-4 justify-center">
						<button
							onclick={() => goto('/dashboard')}
							class="px-6 py-3 bg-gray-200 text-[#2C3E50] rounded-lg hover:bg-gray-300 transition-colors font-semibold"
						>
							Back to Dashboard
						</button>
						<button
							onclick={() => goto('/jobs/new')}
							class="px-6 py-3 bg-[#00796B] text-white rounded-lg hover:bg-[#00695C] transition-colors font-semibold"
						>
							Try Again
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Decorative background pattern with rotation animation */
	.processing-bg {
		background-color: #e6f7f1;
		position: relative;
		overflow: hidden;
	}

	.processing-bg::before {
		content: '';
		position: absolute;
		top: -25%;
		left: -25%;
		width: 150%;
		height: 150%;
		background-image: radial-gradient(circle at center center, #e2edea, #e6f7f1),
			repeating-radial-gradient(
				circle at center center,
				#e2edea,
				#e2edea,
				15px,
				transparent 30px,
				transparent 15px
			);
		background-blend-mode: multiply;
		animation: pulse-bg 4s ease-in-out infinite;
		z-index: 0;
	}

	/* Ensure content sits above the pulsating background */
	.processing-bg > * {
		position: relative;
		z-index: 1;
	}

	@keyframes pulse-bg {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.85;
		}
		50% {
			transform: scale(1.15);
			opacity: 1;
		}
	}

	/* Modern shimmer animation */
	.shimmer-animation {
		background: linear-gradient(
			90deg,
			transparent 0%,
			transparent 40%,
			rgba(255, 255, 255, 0.5) 50%,
			rgba(255, 255, 255, 0.8) 55%,
			rgba(255, 255, 255, 0.5) 60%,
			transparent 70%,
			transparent 100%
		);
		background-size: 200% 100%;
		animation: shimmer 2.5s infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	@keyframes fade-in-out {
		0%, 100% {
			opacity: 0.7;
		}
		50% {
			opacity: 1;
		}
	}

	.animate-fade-in-out {
		animation: fade-in-out 2s ease-in-out infinite;
	}
</style>
