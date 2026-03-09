<script lang="ts">
	/**
	 * FollowButton - Follow/Unfollow a user
	 * Optimistic UI with POST/DELETE to /api/follows
	 */

	interface Props {
		userId: string;
		initialFollowing: boolean;
		size?: 'sm' | 'md';
	}

	let { userId, initialFollowing, size = 'sm' }: Props = $props();

	let isFollowing = $state(initialFollowing);
	let loading = $state(false);

	// Sync with parent when initialFollowing changes
	$effect(() => {
		isFollowing = initialFollowing;
	});

	async function toggle(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();

		if (loading) return;
		loading = true;

		const wasFollowing = isFollowing;
		isFollowing = !wasFollowing; // Optimistic

		try {
			const response = await fetch('/api/follows', {
				method: wasFollowing ? 'DELETE' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ following_id: userId })
			});

			if (!response.ok) {
				isFollowing = wasFollowing; // Revert
			}
		} catch {
			isFollowing = wasFollowing; // Revert
		} finally {
			loading = false;
		}
	}
</script>

{#if size === 'sm'}
	<button
		onclick={toggle}
		disabled={loading}
		class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 {isFollowing
			? 'bg-[#00796B]/10 text-[#00796B] hover:bg-red-50 hover:text-red-500'
			: 'bg-gray-100 text-[#4B5563] hover:bg-[#00796B]/10 hover:text-[#00796B]'}"
	>
		<span class="material-symbols-outlined text-[14px]">
			{isFollowing ? 'person_remove' : 'person_add'}
		</span>
		<span>{isFollowing ? 'Following' : 'Follow'}</span>
	</button>
{:else}
	<button
		onclick={toggle}
		disabled={loading}
		class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 {isFollowing
			? 'bg-[#00796B] text-white hover:bg-red-500'
			: 'bg-white text-[#2C3E50] border border-gray-200 hover:border-[#00796B] hover:text-[#00796B]'}"
	>
		<span class="material-symbols-outlined text-[18px]">
			{isFollowing ? 'person_remove' : 'person_add'}
		</span>
		<span>{isFollowing ? 'Following' : 'Follow'}</span>
	</button>
{/if}
