<script lang="ts">
	/**
	 * Fallback redirect — safety net if +page.server.ts redirect doesn't fire.
	 */
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/home', { replaceState: true });
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-[#F8F5F0]">
	<p class="text-[#4B5563] text-sm">Redirecting...</p>
</div>
