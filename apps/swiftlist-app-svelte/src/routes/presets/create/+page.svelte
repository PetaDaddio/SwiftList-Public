<script lang="ts">
	/**
	 * Create Preset Page
	 * Allows users to create new style presets from reference images
	 */

	import { goto } from '$app/navigation';
	import { createClient } from '$lib/supabase/client';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { toastState } from '$lib/stores/toast.svelte';

	const categories = [
		'Accessories', 'Art & Prints', 'Automotive', 'Bath & Body', 'Books & Media',
		'Candles & Fragrance', 'Collectibles', 'Craft Supplies', 'Eco-Friendly',
		'Fashion', 'Food & Beverage', 'Furniture', 'Garden & Outdoor', 'Home Goods',
		'Jewelry', 'Kids & Baby', 'Kitchen & Dining', 'Minimalist', 'Pet Supplies',
		'Seasonal & Holiday', 'Sporting Goods', 'Stationery & Paper', 'Tech',
		'Toys & Games', 'Vintage', 'Weddings & Events'
	];

	let name = $state('');
	let description = $state('');
	let category = $state('');
	let tags = $state('');
	let isPublic = $state(false);
	let referenceImage = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let submitting = $state(false);
	let uploadProgress = $state(0);

	function handleImageChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// Validate file type
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			toastState.error('Please upload a JPG, PNG, or WebP image');
			return;
		}

		// Validate file size (max 10MB)
		if (file.size > 10 * 1024 * 1024) {
			toastState.error('Image must be smaller than 10MB');
			return;
		}

		referenceImage = file;

		// Create preview
		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	async function handleSubmit() {
		// Validation
		if (!name.trim()) {
			toastState.error('Please enter a preset name');
			return;
		}

		if (!description.trim()) {
			toastState.error('Please enter a description');
			return;
		}

		if (!category) {
			toastState.error('Please select a category');
			return;
		}

		if (!referenceImage) {
			toastState.error('Please upload a reference image');
			return;
		}

		submitting = true;
		uploadProgress = 0;

		try {
			const supabase = createClient();

			// 1. Get current user
			const { data: { user }, error: authError } = await supabase.auth.getUser();
			if (authError || !user) {
				throw new Error('You must be logged in to create presets');
			}

			uploadProgress = 10;

			// 2. Upload reference image to Supabase Storage
			const fileName = `${user.id}/${Date.now()}-${referenceImage.name}`;
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from('preset-references')
				.upload(fileName, referenceImage, {
					cacheControl: '3600',
					upsert: false
				});

			if (uploadError) throw uploadError;

			uploadProgress = 40;

			// 3. Get public URL for reference image
			const { data: urlData } = supabase.storage
				.from('preset-references')
				.getPublicUrl(fileName);

			const referenceImageUrl = urlData.publicUrl;

			uploadProgress = 60;

			// 4. Submit job to API (WF-17 Preset Generator)
			const response = await fetch('/api/jobs/submit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					workflow_id: 'WF-17',
					input_data: {
						reference_image_url: referenceImageUrl,
						preset_name: name.trim(),
						preset_description: description.trim(),
						category: category,
						tags: tags.split(',').map(t => t.trim()).filter(Boolean),
						is_public: isPublic
					}
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to submit preset generation job');
			}

			const result = await response.json();

			uploadProgress = 100;

			toastState.success('Preset generation started! This will take 1-2 minutes.');

			// Redirect to job processing page
			goto(`/jobs/${result.job_id}/processing`);
		} catch (err: any) {
			console.error('Create preset error:', err);
			toastState.error(err.message || 'Failed to create preset');
		} finally {
			submitting = false;
			uploadProgress = 0;
		}
	}
</script>

<svelte:head>
	<title>Create Preset - SwiftList</title>
</svelte:head>

<div class="min-h-screen bg-[#F8F5F0] dark:bg-[#201512]">
	<!-- Header -->
	<header class="border-b border-gray-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<a href="/" class="flex items-center group transition-transform duration-300 group-hover:scale-105">
					<Logo size={28} />
				</a>
				<div class="flex items-center gap-4">
					<Button variant="secondary" onclick={() => goto('/presets')}>
						{#snippet children()}
							<span class="material-symbols-outlined">arrow_back</span>
							<span class="hidden sm:inline">Back to Marketplace</span>
						{/snippet}
					</Button>
					<Button variant="secondary" onclick={() => goto('/dashboard')}>
						{#snippet children()}
							<span class="material-symbols-outlined">dashboard</span>
							<span class="hidden sm:inline">Dashboard</span>
						{/snippet}
					</Button>
				</div>
			</div>
		</div>
	</header>

	<!-- Content -->
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
		<!-- Header -->
		<div class="text-center mb-12">
			<h1 class="text-5xl font-bold text-[#2C3E50] mb-4">Create Style Preset</h1>
			<p class="text-xl text-[#4B5563] max-w-2xl mx-auto">
				Upload a reference image and let AI analyze its style to create a reusable preset
			</p>
			<div class="flex items-center justify-center gap-2 mt-4 text-sm text-[#4B5563]">
				<span class="material-symbols-outlined text-[#00796B]">info</span>
				<span>Cost: 15 credits per preset generation</span>
			</div>
		</div>

		<!-- Form -->
		<Card variant="elevated" class="p-8">
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-8">
				<!-- Reference Image Upload -->
				<div>
					<label for="reference-image-upload" class="block text-sm font-semibold text-[#2C3E50] mb-3">
						Reference Image <span class="text-red-500">*</span>
					</label>
					<p class="text-sm text-[#4B5563] mb-4">
						Upload a product image that represents the style you want to capture
					</p>

					{#if imagePreview}
						<div class="relative aspect-video max-w-md mx-auto mb-4 overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-700">
							<img src={imagePreview} alt="Preview" class="w-full h-full object-cover" />
							<button
								type="button"
								onclick={() => {
									referenceImage = null;
									imagePreview = null;
								}}
								class="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
							>
								<span class="material-symbols-outlined text-sm">close</span>
							</button>
						</div>
					{/if}

					<div class="flex items-center justify-center w-full">
						<label class="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
							<div class="flex flex-col items-center justify-center pt-5 pb-6">
								<span class="material-symbols-outlined text-4xl text-[#4B5563] mb-3">
									cloud_upload
								</span>
								<p class="mb-2 text-sm text-[#4B5563]">
									<span class="font-semibold">Click to upload</span> or drag and drop
								</p>
								<p class="text-xs text-[#4B5563]">PNG, JPG, or WebP (max 10MB)</p>
							</div>
							<input
								id="reference-image-upload"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onchange={handleImageChange}
								class="hidden"
							/>
						</label>
					</div>
				</div>

				<!-- Preset Name -->
				<div>
					<label for="name" class="block text-sm font-semibold text-[#2C3E50] mb-3">
						Preset Name <span class="text-red-500">*</span>
					</label>
					<input
						id="name"
						type="text"
						bind:value={name}
						placeholder="e.g., Vintage Jewelry Studio"
						maxlength="100"
						class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#00796B]"
						required
					/>
					<p class="text-xs text-[#4B5563] mt-2">{name.length}/100 characters</p>
				</div>

				<!-- Description -->
				<div>
					<label for="description" class="block text-sm font-semibold text-[#2C3E50] mb-3">
						Description <span class="text-red-500">*</span>
					</label>
					<textarea
						id="description"
						bind:value={description}
						placeholder="Describe the style, mood, and key characteristics of this preset..."
						rows="4"
						maxlength="500"
						class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#00796B] resize-none"
						required
					></textarea>
					<p class="text-xs text-[#4B5563] mt-2">{description.length}/500 characters</p>
				</div>

				<!-- Category -->
				<div>
					<label for="category" class="block text-sm font-semibold text-[#2C3E50] mb-3">
						Category <span class="text-red-500">*</span>
					</label>
					<select
						id="category"
						bind:value={category}
						class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#00796B]"
						required
					>
						<option value="" disabled>Select a category</option>
						{#each categories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>

				<!-- Tags -->
				<div>
					<label for="tags" class="block text-sm font-semibold text-[#2C3E50] mb-3">
						Tags (Optional)
					</label>
					<input
						id="tags"
						type="text"
						bind:value={tags}
						placeholder="e.g., luxury, gold, elegant (comma-separated)"
						class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#00796B]"
					/>
					<p class="text-xs text-[#4B5563] mt-2">Add comma-separated tags to help others discover your preset</p>
				</div>

				<!-- Visibility -->
				<div>
					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={isPublic}
							class="w-5 h-5 text-[#00796B] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-[#00796B]"
						/>
						<div>
							<span class="text-sm font-semibold text-[#2C3E50]">Make this preset public</span>
							<p class="text-xs text-[#4B5563]">Others can discover and use your preset in the marketplace</p>
						</div>
					</label>
				</div>

				<!-- Submit Button -->
				<div class="pt-4">
					<Button
						type="submit"
						variant="primary"
						fullWidth
						size="lg"
						disabled={submitting}
					>
						{#snippet children()}
							{#if submitting}
								<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
								<span>Creating Preset... {uploadProgress}%</span>
							{:else}
								<span class="material-symbols-outlined text-xl">auto_awesome</span>
								<span class="text-lg font-semibold">Generate Preset (15 Credits)</span>
							{/if}
						{/snippet}
					</Button>

					<p class="text-xs text-center text-[#4B5563] mt-4">
						By creating a preset, you agree to our <a href="/terms" class="text-[#00796B] hover:underline">Terms of Service</a>
					</p>
				</div>
			</form>
		</Card>

		<!-- How It Works -->
		<Card variant="bordered" class="mt-12 p-8">
			<h2 class="text-2xl font-bold text-[#2C3E50] mb-6 flex items-center gap-2">
				<span class="material-symbols-outlined text-[#00796B]">help_outline</span>
				<span>How Preset Generation Works</span>
			</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div class="text-center">
					<div class="w-12 h-12 bg-[#00796B]/10 rounded-full flex items-center justify-center mx-auto mb-3">
						<span class="text-2xl font-bold text-[#00796B]">1</span>
					</div>
					<h3 class="font-semibold text-[#2C3E50] mb-2">Upload Reference</h3>
					<p class="text-sm text-[#4B5563]">
						Provide a product image that represents the style you want to capture
					</p>
				</div>
				<div class="text-center">
					<div class="w-12 h-12 bg-[#00796B]/10 rounded-full flex items-center justify-center mx-auto mb-3">
						<span class="text-2xl font-bold text-[#00796B]">2</span>
					</div>
					<h3 class="font-semibold text-[#2C3E50] mb-2">AI Analysis</h3>
					<p class="text-sm text-[#4B5563]">
						Claude Vision analyzes lighting, composition, color palette, and mood
					</p>
				</div>
				<div class="text-center">
					<div class="w-12 h-12 bg-[#00796B]/10 rounded-full flex items-center justify-center mx-auto mb-3">
						<span class="text-2xl font-bold text-[#00796B]">3</span>
					</div>
					<h3 class="font-semibold text-[#2C3E50] mb-2">Preset Created</h3>
					<p class="text-sm text-[#4B5563]">
						Your preset is saved and ready to use for future product images
					</p>
				</div>
			</div>
		</Card>
	</div>
</div>
