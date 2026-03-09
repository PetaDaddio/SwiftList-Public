<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!--
	Minimal layout for /home — intentionally excludes the root layout's
	white footer so the home page can render its own footer.
-->
{@render children()}
