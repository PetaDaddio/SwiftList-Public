<script lang="ts">
	/**
	 * Toast Component - Svelte 5
	 * Production-ready toast notification system
	 */

	import { toastState } from '$lib/stores/toast.svelte';

	const iconMap = {
		success: 'check_circle',
		error: 'error',
		warning: 'warning',
		info: 'info'
	};

	const colorMap = {
		success: 'bg-status-success text-white',
		error: 'bg-status-error text-white',
		warning: 'bg-status-warning text-white',
		info: 'bg-status-info text-white'
	};
</script>

<div class="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
	{#each toastState.items as toast (toast.id)}
		<div
			class={`pointer-events-auto min-w-[320px] px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-up ${colorMap[toast.type]}`}
			role="alert"
		>
			<span class="material-symbols-outlined text-[24px]">
				{iconMap[toast.type]}
			</span>
			<p class="flex-1 font-medium">{toast.message}</p>
			<button
				onclick={() => toastState.dismiss(toast.id)}
				class="p-1 hover:bg-white/20 rounded transition-colors"
				aria-label="Dismiss"
			>
				<span class="material-symbols-outlined text-[20px]">close</span>
			</button>
		</div>
	{/each}
</div>
