<script lang="ts">
	/**
	 * Edit Profile Modal Component - Svelte 5
	 * Matches dark card design from login/signup pages
	 */

	// Props
	interface Props {
		isOpen: boolean;
		onClose: () => void;
		user: {
			id: string;
			name: string;
			email: string;
			avatar: string | null;
			twitter_url: string | null;
			instagram_url: string | null;
			tiktok_url: string | null;
			website_url: string | null;
		};
		onProfileUpdated: (updatedProfile: { name: string; avatar: string | null }) => void;
	}

	let { isOpen, onClose, user, onProfileUpdated }: Props = $props();

	// Extract handle from stored URL (e.g., 'https://twitter.com/jane' → 'jane')
	function extractHandle(url: string | null, platform: 'twitter' | 'instagram' | 'tiktok'): string {
		if (!url) return '';
		const prefixes: Record<string, string[]> = {
			twitter: ['https://twitter.com/', 'https://x.com/', 'http://twitter.com/', 'http://x.com/'],
			instagram: ['https://instagram.com/', 'https://www.instagram.com/', 'http://instagram.com/'],
			tiktok: ['https://tiktok.com/@', 'https://www.tiktok.com/@', 'http://tiktok.com/@']
		};
		for (const prefix of prefixes[platform]) {
			if (url.toLowerCase().startsWith(prefix)) {
				return url.slice(prefix.length).replace(/\/+$/, '');
			}
		}
		return url; // fallback: return as-is
	}

	// Build full URL from handle
	function buildUrl(handle: string, platform: 'twitter' | 'instagram' | 'tiktok'): string | null {
		const clean = handle.trim().replace(/^@/, '');
		if (!clean) return null;
		const bases = { twitter: 'https://twitter.com/', instagram: 'https://instagram.com/', tiktok: 'https://tiktok.com/@' };
		return `${bases[platform]}${clean}`;
	}

	// Form state
	// eslint-disable-next-line svelte/valid-compile -- intentional: modal re-mounts on each open
	// svelte-ignore state_referenced_locally
	let displayName = $state(user.name);
	let avatarFile = $state<File | null>(null);
	// svelte-ignore state_referenced_locally
	let avatarPreview = $state<string | null>(user.avatar);
	// svelte-ignore state_referenced_locally
	let twitterHandle = $state(extractHandle(user.twitter_url, 'twitter'));
	// svelte-ignore state_referenced_locally
	let instagramHandle = $state(extractHandle(user.instagram_url, 'instagram'));
	// svelte-ignore state_referenced_locally
	let tiktokHandle = $state(extractHandle(user.tiktok_url, 'tiktok'));
	// svelte-ignore state_referenced_locally
	let websiteUrl = $state(user.website_url || '');
	let isUploading = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');
	let showDeleteConfirm = $state(false);
	let isLoggingOut = $state(false);

	// Handle avatar file selection
	function handleAvatarChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file) {
			// Validate file type
			if (!file.type.startsWith('image/')) {
				errorMessage = 'Please select an image file';
				return;
			}

			// Validate file size (max 2MB)
			if (file.size > 2 * 1024 * 1024) {
				errorMessage = 'Image must be less than 2MB';
				return;
			}

			avatarFile = file;

			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				avatarPreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);

			errorMessage = '';
		}
	}

	// Handle profile update
	async function handleSubmit(event: Event) {
		event.preventDefault();
		isUploading = true;
		errorMessage = '';
		successMessage = '';

		try {
			let avatarUrl = user.avatar;

			// Upload avatar if file selected (via API route)
			if (avatarFile) {
				const formData = new FormData();
				formData.append('avatar', avatarFile);

				const uploadRes = await fetch('/api/profile/avatar', {
					method: 'POST',
					body: formData
				});

				if (!uploadRes.ok) {
					let errMsg = 'Failed to upload avatar';
					try {
						const err = await uploadRes.json();
						errMsg = err.message || errMsg;
					} catch {
						// Response may be plain text (e.g. framework-level CSRF/routing errors)
						errMsg = (await uploadRes.text()) || errMsg;
					}
					throw new Error(errMsg);
				}

				const uploadData = await uploadRes.json();
				avatarUrl = uploadData.avatar_url;
			}

			// Build social URLs from handles
			const twitterUrl = buildUrl(twitterHandle, 'twitter');
			const instagramUrl = buildUrl(instagramHandle, 'instagram');
			const tiktokUrl = buildUrl(tiktokHandle, 'tiktok');
			const cleanWebsite = websiteUrl.trim()
				? (websiteUrl.trim().startsWith('http') ? websiteUrl.trim() : `https://${websiteUrl.trim()}`)
				: null;

			// Update profile via API route
			const updateRes = await fetch('/api/profile/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					display_name: displayName,
					avatar_url: avatarUrl,
					twitter_url: twitterUrl,
					instagram_url: instagramUrl,
					tiktok_url: tiktokUrl,
					website_url: cleanWebsite
				})
			});

			if (!updateRes.ok) {
				let errMsg = 'Failed to update profile';
				try {
					const err = await updateRes.json();
					errMsg = err.message || errMsg;
				} catch {
					// Response may be plain text (e.g. framework-level CSRF/routing errors)
					errMsg = (await updateRes.text()) || errMsg;
				}
				throw new Error(errMsg);
			}

			successMessage = 'Profile updated successfully!';

			// Notify parent component
			onProfileUpdated({
				name: displayName,
				avatar: avatarUrl
			});

			// Close modal after brief delay
			setTimeout(() => {
				onClose();
			}, 1000);
		} catch (error: any) {
			errorMessage = error.message || 'Failed to update profile';
		} finally {
			isUploading = false;
		}
	}

	// Handle account deletion
	async function handleDeleteAccount() {
		if (!showDeleteConfirm) {
			showDeleteConfirm = true;
			return;
		}

		try {
			// TODO: Implement account deletion
			// This should:
			// 1. Delete all user data (jobs, presets, etc.)
			// 2. Delete user profile
			// 3. Sign out user
			// 4. Redirect to home page
			alert('Account deletion coming soon! This will permanently delete all your data.');
			showDeleteConfirm = false;
		} catch (error: any) {
			errorMessage = error.message || 'Failed to delete account';
		}
	}

	// Handle change password
	function handleChangePassword() {
		// TODO: Implement password change flow
		alert('Password change coming soon! Check your email for reset instructions.');
	}

	// Handle logout
	async function handleLogout() {
		isLoggingOut = true;
		try {
			const res = await fetch('/auth/logout', { method: 'POST' });
			if (res.redirected) {
				window.location.href = res.url;
			} else {
				window.location.href = '/auth/login';
			}
		} catch {
			window.location.href = '/auth/login';
		}
	}

	// Close modal on escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Modal Overlay -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={() => onClose()}
	>
		<!-- Modal Content -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
		<div
			class="bg-[#2C3E50] rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
			role="document"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-gray-600/50">
				<h2 class="text-white font-bold text-2xl">Edit Profile</h2>
				<button
					onclick={onClose}
					class="text-gray-400 hover:text-white transition-colors"
				>
					<span class="material-symbols-outlined text-[28px]">close</span>
				</button>
			</div>

			<!-- Form -->
			<form onsubmit={handleSubmit} class="p-6 space-y-6">
				<!-- Avatar Section -->
				<div class="text-center">
					<label for="avatar-upload" class="cursor-pointer">
						<div class="relative inline-block">
							<!-- Avatar Preview -->
							<div class="w-24 h-24 rounded-full bg-[#34495E] flex items-center justify-center overflow-hidden border-2 border-[#00796B]">
								{#if avatarPreview}
									<img src={avatarPreview} alt="Avatar" class="w-full h-full object-cover" />
								{:else}
									<span class="material-symbols-outlined text-gray-400 text-5xl">person</span>
								{/if}
							</div>

							<!-- Upload Icon Overlay -->
							<div class="absolute bottom-0 right-0 bg-[#00796B] rounded-full p-2 border-2 border-[#2C3E50]">
								<span class="material-symbols-outlined text-white text-[16px]">photo_camera</span>
							</div>
						</div>
					</label>

					<input
						type="file"
						id="avatar-upload"
						accept="image/*"
						onchange={handleAvatarChange}
						class="hidden"
					/>

					<p class="text-gray-400 text-xs mt-2">Click to upload new avatar (max 2MB)</p>
				</div>

				<!-- Display Name -->
				<div>
					<label for="display-name" class="block text-sm font-medium text-gray-300 mb-2">
						Display Name <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						id="display-name"
						bind:value={displayName}
						placeholder="Your name"
						required
						class="w-full px-4 py-3 bg-[#34495E] border border-[#4A5F7F] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all"
					/>
				</div>

				<!-- Email (Read-Only) -->
				<div>
					<label for="email" class="block text-sm font-medium text-gray-300 mb-2">
						Email
					</label>
					<input
						type="email"
						id="email"
						value={user.email}
						disabled
						class="w-full px-4 py-3 bg-[#34495E]/50 border border-[#4A5F7F] rounded-lg text-gray-400 cursor-not-allowed"
					/>
					<p class="text-gray-400 text-xs mt-1">Email cannot be changed</p>
				</div>

				<!-- Social Links Section -->
				<div class="pt-2">
					<h3 class="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px]">share</span>
						Social Links
					</h3>

					<!-- Twitter / X -->
					<div class="mb-3">
						<label for="twitter-handle" class="block text-xs font-medium text-gray-400 mb-1">
							X / Twitter
						</label>
						<div class="flex">
							<span class="inline-flex items-center px-3 bg-[#2A3A4A] border border-r-0 border-[#4A5F7F] rounded-l-lg text-gray-400 text-sm">@</span>
							<input
								type="text"
								id="twitter-handle"
								bind:value={twitterHandle}
								placeholder="username"
								class="flex-1 px-3 py-2.5 bg-[#34495E] border border-[#4A5F7F] rounded-r-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all text-sm"
							/>
						</div>
					</div>

					<!-- Instagram -->
					<div class="mb-3">
						<label for="instagram-handle" class="block text-xs font-medium text-gray-400 mb-1">
							Instagram
						</label>
						<div class="flex">
							<span class="inline-flex items-center px-3 bg-[#2A3A4A] border border-r-0 border-[#4A5F7F] rounded-l-lg text-gray-400 text-sm">@</span>
							<input
								type="text"
								id="instagram-handle"
								bind:value={instagramHandle}
								placeholder="username"
								class="flex-1 px-3 py-2.5 bg-[#34495E] border border-[#4A5F7F] rounded-r-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all text-sm"
							/>
						</div>
					</div>

					<!-- TikTok -->
					<div class="mb-3">
						<label for="tiktok-handle" class="block text-xs font-medium text-gray-400 mb-1">
							TikTok
						</label>
						<div class="flex">
							<span class="inline-flex items-center px-3 bg-[#2A3A4A] border border-r-0 border-[#4A5F7F] rounded-l-lg text-gray-400 text-sm">@</span>
							<input
								type="text"
								id="tiktok-handle"
								bind:value={tiktokHandle}
								placeholder="username"
								class="flex-1 px-3 py-2.5 bg-[#34495E] border border-[#4A5F7F] rounded-r-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all text-sm"
							/>
						</div>
					</div>

					<!-- Website -->
					<div>
						<label for="website-url" class="block text-xs font-medium text-gray-400 mb-1">
							Website / Shop
						</label>
						<input
							type="text"
							id="website-url"
							bind:value={websiteUrl}
							placeholder="https://yourshop.com"
							class="w-full px-3 py-2.5 bg-[#34495E] border border-[#4A5F7F] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all text-sm"
						/>
					</div>
				</div>

				<!-- Change Password Button -->
				<div>
					<button
						type="button"
						onclick={handleChangePassword}
						class="w-full px-4 py-3 bg-[#34495E] border border-[#4A5F7F] rounded-lg text-white font-semibold hover:bg-[#3E5569] transition-all"
					>
						Change Password
					</button>
				</div>

				<!-- Error/Success Messages -->
				{#if errorMessage}
					<div class="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
						{errorMessage}
					</div>
				{/if}

				{#if successMessage}
					<div class="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-200 text-sm">
						{successMessage}
					</div>
				{/if}

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isUploading}
					class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
				>
					{#if isUploading}
						<span class="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
						Updating...
					{:else}
						Save Changes
					{/if}
				</button>

				<!-- Log Out -->
				<button
					type="button"
					onclick={handleLogout}
					disabled={isLoggingOut}
					class="w-full px-4 py-3 bg-[#34495E] border border-[#4A5F7F] rounded-lg text-white font-semibold hover:bg-[#3E5569] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
				>
					{#if isLoggingOut}
						<span class="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
						Logging out...
					{:else}
						<span class="material-symbols-outlined text-[20px]">logout</span>
						Log Out
					{/if}
				</button>

				<!-- Danger Zone -->
				<div class="pt-6 border-t border-gray-600/50">
					<h3 class="text-gray-300 font-semibold mb-3">Danger Zone</h3>

					{#if !showDeleteConfirm}
						<button
							type="button"
							onclick={handleDeleteAccount}
							class="w-full px-4 py-3 bg-transparent border border-red-500 rounded-lg text-red-400 font-semibold hover:bg-red-500/10 transition-all"
						>
							Delete Account
						</button>
					{:else}
						<div class="space-y-3">
							<p class="text-gray-300 text-sm">
								Are you sure? This action cannot be undone. All your data will be permanently deleted.
							</p>
							<div class="grid grid-cols-2 gap-3">
								<button
									type="button"
									onclick={() => (showDeleteConfirm = false)}
									class="px-4 py-2 bg-[#34495E] rounded-lg text-white font-semibold hover:bg-[#3E5569] transition-all"
								>
									Cancel
								</button>
								<button
									type="button"
									onclick={handleDeleteAccount}
									class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-all"
								>
									Yes, Delete
								</button>
							</div>
						</div>
					{/if}
				</div>
			</form>
		</div>
	</div>
{/if}
