<script lang="ts">
	/**
	 * Card Component - Svelte 5
	 * Production-ready card with glass morphism effect
	 */

	interface Props {
		variant?: 'default' | 'glass' | 'elevated' | 'bordered';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		class?: string;
		children: import('svelte').Snippet;
	}

	let {
		variant = 'default',
		padding = 'md',
		class: className = '',
		children
	}: Props = $props();

	const variantClasses = $derived.by(() => {
		switch (variant) {
			case 'glass':
				return 'glass-panel';
			case 'elevated':
				return 'bg-card shadow-soft';
			case 'bordered':
				return 'bg-white border-2 border-gray-200';
			default:
				return 'bg-white border border-gray-200';
		}
	});

	const paddingClasses = $derived.by(() => {
		switch (padding) {
			case 'none':
				return '';
			case 'sm':
				return 'p-4';
			case 'md':
				return 'p-6';
			case 'lg':
				return 'p-8';
			default:
				return '';
		}
	});

	const classes = $derived(`rounded-xl ${variantClasses} ${paddingClasses} ${className}`);
</script>

<div class={classes}>
	{@render children()}
</div>
