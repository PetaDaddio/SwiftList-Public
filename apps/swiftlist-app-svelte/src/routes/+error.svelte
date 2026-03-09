<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>Error {$page.status} - SwiftList</title>
</svelte:head>

<div class="min-h-screen bg-[#F8F5F0] flex items-center justify-center p-4">
	<div class="bg-white rounded-xl shadow-sm p-8 md:p-12 max-w-lg w-full text-center">
		<div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
			<span class="material-symbols-outlined text-red-500 text-4xl">error_outline</span>
		</div>

		<h1 class="text-4xl font-bold text-[#2C3E50] mb-2">{$page.status}</h1>

		<p class="text-lg text-[#4B5563] mb-8">
			{#if $page.status === 404}
				The page you're looking for doesn't exist or has been moved.
			{:else if $page.status === 500}
				Something went wrong on our end. Please try again.
			{:else if $page.status === 403}
				You don't have permission to access this page.
			{:else}
				{$page.error?.message || 'An unexpected error occurred.'}
			{/if}
		</p>

		<div class="flex flex-col sm:flex-row items-center justify-center gap-3">
			<button
				onclick={() => goto('/dashboard')}
				class="bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full sm:w-auto"
			>
				Go to Dashboard
			</button>
			<button
				onclick={() => history.back()}
				class="border border-gray-300 hover:border-gray-400 text-[#4B5563] font-semibold py-3 px-6 rounded-lg transition-colors w-full sm:w-auto"
			>
				Go Back
			</button>
		</div>
	</div>
</div>
