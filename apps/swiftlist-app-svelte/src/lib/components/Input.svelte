<script lang="ts">
	/**
	 * Input Component - Svelte 5
	 * Production-ready input field with validation and error states
	 */

	interface Props {
		type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
		id?: string;
		name?: string;
		value?: string | number;
		placeholder?: string;
		label?: string;
		error?: string;
		disabled?: boolean;
		required?: boolean;
		class?: string;
		oninput?: (event: Event) => void;
		onchange?: (event: Event) => void;
	}

	let {
		type = 'text',
		id,
		name,
		value = $bindable(''),
		placeholder = '',
		label = '',
		error = '',
		disabled = false,
		required = false,
		class: className = '',
		oninput,
		onchange
	}: Props = $props();

	const hasError = $derived(!!error);
	const inputClasses = $derived.by(() => {
		const base = 'w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-[#2C3E50] dark:text-white transition-all outline-none';
		const focus = hasError
			? 'border-status-error focus:ring-2 focus:ring-status-error focus:border-transparent'
			: 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-[#00796B] focus:border-transparent';
		const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
		return `${base} ${focus} ${disabledClass} ${className}`;
	});
</script>

{#if label}
	<label for={id} class="block text-sm font-medium text-[#2C3E50] dark:text-white mb-2">
		{label}
		{#if required}
			<span class="text-status-error">*</span>
		{/if}
	</label>
{/if}

<input
	{id}
	{name}
	{type}
	{placeholder}
	{required}
	{disabled}
	bind:value
	class={inputClasses}
	oninput={oninput}
	onchange={onchange}
/>

{#if error}
	<p class="mt-2 text-sm text-status-error flex items-center gap-1">
		<span class="material-symbols-outlined text-[16px]">error</span>
		{error}
	</p>
{/if}
