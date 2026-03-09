<script lang="ts">
	/**
	 * Password Reset Request Page - Svelte 5
	 * User enters email to receive a password reset link.
	 */

	import Logo from '$lib/components/Logo.svelte';
	import { toastState } from '$lib/stores/toast.svelte';

	let email = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let success = $state(false);


	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		isLoading = true;

		try {
			const response = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || data.error || 'Failed to send reset email');
			}

			success = true;
			toastState.success('Check your email for a reset link.');
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
			<p class="text-[#4B5563]">Reset your password</p>
		</div>

		<!-- Reset Form -->
		<div class="bg-[#2C3E50] rounded-lg shadow-lg p-4 sm:p-8">
			{#if success}
				<div class="text-center space-y-4">
					<div class="flex justify-center">
						<span class="material-symbols-outlined text-[#00796B] text-5xl">mark_email_read</span>
					</div>
					<h2 class="text-xl font-semibold text-white">Check your email</h2>
					<p class="text-gray-300 text-sm">
						If an account exists with <span class="text-white font-medium">{email}</span>,
						we've sent a password reset link. Check your inbox (and spam folder).
					</p>
					<a
						href="/auth/login"
						class="inline-block mt-4 text-[#00796B] hover:text-[#00695C] font-medium transition-colors"
					>
						Back to sign in
					</a>
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="space-y-6">
					<p class="text-gray-300 text-sm">
						Enter the email address associated with your account and we'll send you a link to reset your password.
					</p>

					<!-- Email Input -->
					<div>
						<label for="email" class="block text-sm font-medium text-gray-300 mb-2">
							Email <span class="text-red-400">*</span>
						</label>
						<input
							type="email"
							id="email"
							bind:value={email}
							placeholder="you@example.com"
							required
							disabled={isLoading}
							class="w-full px-4 py-3 bg-[#34495E] border border-[#4A5F7F] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all"
						/>
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
						disabled={isLoading}
						class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isLoading ? 'Sending...' : 'Send Reset Link'}
					</button>

					<div class="text-center">
						<a
							href="/auth/login"
							class="text-sm text-gray-400 hover:text-[#00796B] transition-colors"
						>
							Back to sign in
						</a>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
