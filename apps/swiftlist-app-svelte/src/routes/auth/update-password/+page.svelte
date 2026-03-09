<script lang="ts">
	/**
	 * Update Password Page - Svelte 5
	 * User arrives here after clicking the password reset email link.
	 * They already have a session (from auth callback code exchange).
	 */

	import Logo from '$lib/components/Logo.svelte';
	import { toastState } from '$lib/stores/toast.svelte';
	import { goto } from '$app/navigation';
	import { createClient } from '$lib/supabase/client';

	let password = $state('');
	let confirmPassword = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let success = $state(false);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

	// Password validation (same rules as signup)
	const passwordErrors = $derived(() => {
		const errors: string[] = [];
		if (password.length > 0) {
			if (password.length < 8) errors.push('At least 8 characters');
			if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
			if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
			if (!/[0-9]/.test(password)) errors.push('One number');
			if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('One special character');
		}
		return errors;
	});

	const passwordsMatch = $derived(password.length > 0 && password === confirmPassword);
	const isValid = $derived(passwordErrors().length === 0 && passwordsMatch);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';

		if (!isValid) {
			error = 'Please fix the password requirements above.';
			return;
		}

		isLoading = true;

		try {
			const supabase = createClient();

			const { error: updateError } = await supabase.auth.updateUser({
				password
			});

			if (updateError) {
				throw new Error(updateError.message);
			}

			success = true;
			toastState.success('Password updated successfully!');

			// Redirect to dashboard after a brief delay
			setTimeout(() => goto('/dashboard'), 2000);
		} catch (err: any) {
			error = err.message;
			toastState.error(err.message);
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="min-h-screen bg-[#F8F5F0] flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<!-- Logo -->
		<div class="text-center mb-8">
			<a href="/" class="flex items-center justify-center group cursor-pointer mb-2">
				<Logo size={40} />
			</a>
			<p class="text-[#4B5563]">Set your new password</p>
		</div>

		<!-- Update Password Form -->
		<div class="bg-[#2C3E50] rounded-lg shadow-lg p-4 sm:p-8">
			{#if success}
				<div class="text-center space-y-4">
					<div class="flex justify-center">
						<span class="material-symbols-outlined text-[#00796B] text-5xl">check_circle</span>
					</div>
					<h2 class="text-xl font-semibold text-white">Password Updated</h2>
					<p class="text-gray-300 text-sm">
						Your password has been changed. Redirecting to your dashboard...
					</p>
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-6">
					<!-- New Password -->
					<div>
						<label for="password" class="block text-sm font-medium text-gray-300 mb-2">
							New Password <span class="text-red-400">*</span>
						</label>
						<div class="relative">
							<input
								type={showPassword ? 'text' : 'password'}
								id="password"
								bind:value={password}
								placeholder="••••••••"
								required
								disabled={isLoading}
								class="w-full px-4 py-3 pr-12 bg-[#34495E] border border-[#4A5F7F] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all"
							/>
							<button
								type="button"
								onclick={() => showPassword = !showPassword}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								<span class="material-symbols-outlined text-xl">
									{showPassword ? 'visibility_off' : 'visibility'}
								</span>
							</button>
						</div>
						{#if passwordErrors().length > 0}
							<ul class="mt-2 space-y-1">
								{#each passwordErrors() as reqError}
									<li class="text-xs text-red-400 flex items-center gap-1">
										<span class="material-symbols-outlined text-xs">close</span>
										{reqError}
									</li>
								{/each}
							</ul>
						{/if}
						{#if password.length > 0 && passwordErrors().length === 0}
							<p class="mt-2 text-xs text-green-400 flex items-center gap-1">
								<span class="material-symbols-outlined text-xs">check</span>
								Password meets all requirements
							</p>
						{/if}
					</div>

					<!-- Confirm Password -->
					<div>
						<label for="confirmPassword" class="block text-sm font-medium text-gray-300 mb-2">
							Confirm Password <span class="text-red-400">*</span>
						</label>
						<div class="relative">
							<input
								type={showConfirmPassword ? 'text' : 'password'}
								id="confirmPassword"
								bind:value={confirmPassword}
								placeholder="••••••••"
								required
								disabled={isLoading}
								class="w-full px-4 py-3 pr-12 bg-[#34495E] border border-[#4A5F7F] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all"
							/>
							<button
								type="button"
								onclick={() => showConfirmPassword = !showConfirmPassword}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
								aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
							>
								<span class="material-symbols-outlined text-xl">
									{showConfirmPassword ? 'visibility_off' : 'visibility'}
								</span>
							</button>
						</div>
						{#if confirmPassword.length > 0 && !passwordsMatch}
							<p class="mt-2 text-xs text-red-400 flex items-center gap-1">
								<span class="material-symbols-outlined text-xs">close</span>
								Passwords do not match
							</p>
						{/if}
						{#if passwordsMatch}
							<p class="mt-2 text-xs text-green-400 flex items-center gap-1">
								<span class="material-symbols-outlined text-xs">check</span>
								Passwords match
							</p>
						{/if}
					</div>

					{#if error}
						<div class="p-2 sm:p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-3">
							<span class="material-symbols-outlined text-red-400 text-sm mt-0.5">error</span>
							<p class="text-sm text-red-300">{error}</p>
						</div>
					{/if}

					<!-- Submit Button -->
					<button
						type="submit"
						disabled={isLoading || !isValid}
						class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isLoading ? 'Updating...' : 'Update Password'}
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
