<script lang="ts">
	/**
	 * Button Component - Svelte 5
	 * Production-ready button with variants, loading states, and haptic feedback
	 */

	interface Props {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		type?: 'button' | 'submit' | 'reset';
		onclick?: (event: MouseEvent) => void;
		class?: string;
		children: import('svelte').Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		fullWidth = false,
		type = 'button',
		onclick,
		class: className = '',
		children
	}: Props = $props();

	const isDisabled = $derived(disabled || loading);

	const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 haptic-btn disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2';

	const variantClasses = $derived.by(() => {
		switch (variant) {
			case 'primary':
				return 'bg-[#00796B] hover:bg-[#00695C] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white shadow-lg shadow-[#00796B]/20 focus:ring-[#00796B]';
			case 'secondary':
				return 'bg-[#2C3E50] hover:bg-[#2C3E50]/90 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white focus:ring-secondary';
			case 'danger':
				return 'bg-status-error hover:bg-status-error/90 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white focus:ring-status-error';
			case 'ghost':
				return 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-[#2C3E50] dark:text-white disabled:opacity-50 focus:ring-[#00796B]';
			default:
				return '';
		}
	});

	const sizeClasses = $derived.by(() => {
		switch (size) {
			case 'sm':
				return 'h-9 px-4 text-sm';
			case 'md':
				return 'h-11 px-6 text-base';
			case 'lg':
				return 'h-12 px-8 text-lg';
			default:
				return '';
		}
	});

	const widthClass = $derived(fullWidth ? 'w-full' : '');

	const classes = $derived(`${baseClasses} ${variantClasses} ${sizeClasses} ${widthClass} ${className}`);
</script>

<button
	{type}
	disabled={isDisabled}
	class={classes}
	onclick={onclick}
>
	{#if loading}
		<span class="animate-spin material-symbols-outlined text-[20px]">
			progress_activity
		</span>
	{/if}
	{@render children()}
</button>
