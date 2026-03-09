<script lang="ts">
	/**
	 * Modal Component - Svelte 5
	 * Production-ready modal with backdrop and animation
	 */

	interface Props {
		isOpen?: boolean;
		title?: string;
		onClose?: () => void;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		children: import('svelte').Snippet;
	}

	let {
		isOpen = $bindable(false),
		title = '',
		onClose,
		size = 'md',
		children
	}: Props = $props();

	const sizeClasses = $derived.by(() => {
		switch (size) {
			case 'sm':
				return 'max-w-md';
			case 'md':
				return 'max-w-lg';
			case 'lg':
				return 'max-w-2xl';
			case 'xl':
				return 'max-w-4xl';
			default:
				return '';
		}
	});

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget && onClose) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && onClose) {
			onClose();
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in-up"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'modal-title' : undefined}
		tabindex="-1"
	>
		<div class={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${sizeClasses} max-h-[90vh] overflow-y-auto animate-fade-in-up delay-100`}>
			{#if title || onClose}
				<div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
					{#if title}
						<h2 id="modal-title" class="text-xl font-bold text-[#2C3E50] dark:text-white">
							{title}
						</h2>
					{/if}
					{#if onClose}
						<button
							onclick={onClose}
							class="p-2 -mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							aria-label="Close modal"
						>
							<span class="material-symbols-outlined">close</span>
						</button>
					{/if}
				</div>
			{/if}

			<div class="p-6">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
