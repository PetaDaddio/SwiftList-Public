<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!--
	Minimal layout for /hello — intentionally excludes the root layout's
	white footer so the Coming Soon page can render its own dark footer.
-->
{@render children()}
