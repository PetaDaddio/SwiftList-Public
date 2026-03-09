<script lang="ts">
	/**
	 * ReportButton - Report a preset for content violation
	 * Small flag icon that opens a dropdown with reason options
	 */

	import { toastState } from '$lib/stores/toast.svelte';

	interface Props {
		presetId: string;
	}

	let { presetId }: Props = $props();

	let showDropdown = $state(false);
	let customReason = $state('');
	let loading = $state(false);
	let reported = $state(false);

	const REASON_OPTIONS = [
		'Inappropriate content',
		'Spam',
		'Misleading',
	];

	function openDropdown(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (reported) return;
		showDropdown = !showDropdown;
	}

	function closeDropdown() {
		showDropdown = false;
		customReason = '';
	}

	async function submitReport(reason: string) {
		if (loading || !reason.trim()) return;
		loading = true;

		try {
			const response = await fetch(`/api/presets/${presetId}/report`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason: reason.trim() })
			});

			const result = await response.json();

			if (response.ok && result.success) {
				reported = true;
				toastState.success(result.message || 'Report submitted — thank you');
			} else if (response.status === 401) {
				toastState.error('Please log in to report presets');
			} else {
				toastState.error(result.message || 'Failed to submit report');
			}
		} catch {
			toastState.error('Network error — please try again');
		} finally {
			loading = false;
			closeDropdown();
		}
	}
</script>

<div class="relative">
	<button
		onclick={openDropdown}
		disabled={reported}
		class="p-1 rounded-full transition-colors {reported
			? 'text-orange-400 cursor-default'
			: 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'}"
		aria-label={reported ? 'Reported' : 'Report preset'}
		title={reported ? 'Reported' : 'Report'}
	>
		<span class="material-symbols-outlined text-[20px]"
			style={reported ? 'font-variation-settings: "FILL" 1' : ''}
		>flag</span>
	</button>

	{#if showDropdown}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="fixed inset-0 z-40"
			onclick={closeDropdown}
		></div>
		<div class="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-64">
			<p class="text-xs font-semibold text-[#2C3E50] mb-2">Report this preset</p>

			{#each REASON_OPTIONS as reason}
				<button
					onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); submitReport(reason); }}
					disabled={loading}
					class="block w-full text-left px-3 py-2 text-sm text-[#4B5563] hover:bg-gray-50 rounded transition-colors"
				>
					{reason}
				</button>
			{/each}

			<div class="mt-2 border-t border-gray-100 pt-2">
				<input
					type="text"
					placeholder="Other reason..."
					bind:value={customReason}
					maxlength={500}
					class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#00796B]"
					onclick={(e: MouseEvent) => e.stopPropagation()}
				/>
				{#if customReason.trim()}
					<button
						onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); submitReport(customReason); }}
						disabled={loading}
						class="mt-1.5 w-full px-3 py-1.5 text-xs font-medium bg-[#00796B] text-white rounded hover:bg-[#00695C] transition-colors"
					>
						{loading ? 'Submitting...' : 'Submit Report'}
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
