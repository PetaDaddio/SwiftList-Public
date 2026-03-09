<script lang="ts">
	/**
	 * Job Modal - Svelte 5
	 * Modal for starting new jobs with optional preset vibe
	 */

	import Modal from './Modal.svelte';

	interface Props {
		isOpen?: boolean;
		onClose?: () => void;
		presetVibe?: {
			id: number;
			name: string;
			creator: { name: string; avatar: string | null };
		} | null;
	}

	let { isOpen = $bindable(false), onClose, presetVibe = null }: Props = $props();

	let imageUrl = $state('');
	let selectedWorkflow = $state('wf-07');

	const workflows = [
		{ id: 'wf-07', name: 'Background Removal', credits: 5 },
		{ id: 'wf-02', name: 'Jewelry Engine', credits: 15 },
		{ id: 'wf-03', name: 'Lifestyle Setting Creation', credits: 20 },
		{ id: 'wf-04', name: 'Product in Hands', credits: 18 }
	];

	function handleSubmit() {
		// TODO: Submit job to backend
		alert(`Submitting job with workflow ${selectedWorkflow}${presetVibe ? ` and preset "${presetVibe.name}"` : ''}`);
		if (onClose) onClose();
	}
</script>

<Modal bind:isOpen {onClose} title="Start New Job" size="lg">
	<div class="space-y-6">
		{#if presetVibe}
			<!-- Preset Vibe Info -->
			<div class="bg-[#E8F5F4] border border-[#00796B]/20 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<span class="material-symbols-outlined text-[#00796B] text-2xl">palette</span>
					<div>
						<p class="text-sm text-[#4B5563] font-medium">Using Preset Vibe</p>
						<p class="text-[#2C3E50] font-bold">{presetVibe.name}</p>
						<p class="text-xs text-[#4B5563]">by {presetVibe.creator.name}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Image Upload -->
		<div>
			<label for="image-url" class="block text-sm font-semibold text-[#2C3E50] mb-2">
				Product Image URL
			</label>
			<input
				id="image-url"
				type="text"
				bind:value={imageUrl}
				placeholder="https://example.com/product.jpg"
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00796B] focus:border-transparent"
			/>
		</div>

		<!-- Workflow Selection -->
		<div>
			<label for="workflow" class="block text-sm font-semibold text-[#2C3E50] mb-2">
				Select Workflow
			</label>
			<select
				id="workflow"
				bind:value={selectedWorkflow}
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00796B] focus:border-transparent"
			>
				{#each workflows as workflow}
					<option value={workflow.id}>
						{workflow.name} ({workflow.credits} credits)
					</option>
				{/each}
			</select>
		</div>

		<!-- Submit Button -->
		<div class="flex items-center justify-end gap-3 pt-4">
			<button
				onclick={onClose}
				class="px-6 py-3 border border-gray-300 text-[#4B5563] font-semibold rounded-lg hover:bg-gray-50 transition-colors"
			>
				Cancel
			</button>
			<button
				onclick={handleSubmit}
				class="px-6 py-3 bg-[#00796B] hover:bg-[#00695C] text-white font-semibold rounded-lg transition-colors"
			>
				Start Job
			</button>
		</div>
	</div>
</Modal>
