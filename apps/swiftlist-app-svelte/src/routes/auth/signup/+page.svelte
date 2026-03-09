<script lang="ts">
	/**
	 * Signup Page - Svelte 5
	 * New user registration with Supabase
	 */

	import { toastState } from '$lib/stores/toast.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { createClient } from '$lib/supabase/client';
	import Logo from '$lib/components/Logo.svelte';

	// Read plan param from pricing page redirect
	const planParam = $derived($page.url.searchParams.get('plan'));

	let email = $state('');
	let displayName = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let validationErrors = $state<Array<{ field: string; message: string }>>([]);
	let showVerification = $state(false);
	let verificationEmail = $state('');
	let showPassword = $state(false);

	// Live password strength checks (mirror server-side Zod rules)
	const passwordChecks = $derived({
		length: password.length >= 8,
		uppercase: /[A-Z]/.test(password),
		lowercase: /[a-z]/.test(password),
		number: /[0-9]/.test(password),
		special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
	});
	const passwordValid = $derived(
		passwordChecks.length && passwordChecks.uppercase && passwordChecks.lowercase &&
		passwordChecks.number && passwordChecks.special
	);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		validationErrors = [];

		// Client-side validation — catch errors before burning a server request
		if (!passwordValid) {
			const errors: Array<{ field: string; message: string }> = [];
			if (!passwordChecks.length) errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
			if (!passwordChecks.uppercase) errors.push({ field: 'password', message: 'Must contain at least one uppercase letter' });
			if (!passwordChecks.lowercase) errors.push({ field: 'password', message: 'Must contain at least one lowercase letter' });
			if (!passwordChecks.number) errors.push({ field: 'password', message: 'Must contain at least one number' });
			if (!passwordChecks.special) errors.push({ field: 'password', message: 'Must contain at least one special character (!@#$%...)' });
			validationErrors = errors;
			error = 'Please fix the errors below';
			toastState.error(error);
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/api/auth/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, displayName, password, plan: planParam || undefined })
			});

			const data = await response.json();

			if (!response.ok) {
				// Handle rate limiting with user-friendly message
				if (response.status === 429) {
					const retrySeconds = data.retryAfter || 60;
					error = `Please wait ${retrySeconds} seconds before trying again.`;
					toastState.error(error);
					return;
				}

				// Handle validation errors
				if (data.validationErrors) {
					validationErrors = data.validationErrors;
					error = 'Please fix the errors below';
				} else {
					error = data.message || data.error || 'Failed to create account';
				}
				toastState.error(error);
				return;
			}

			if (data.needsVerification) {
				// Show "check your email" screen instead of redirecting
				verificationEmail = email;
				showVerification = true;
				return;
			}

			// Auto-confirmed (dev mode fallback)
			toastState.success('Account created! Welcome to SwiftList!');
			goto('/dashboard');
		} catch (err: any) {
			error = err.message || 'Network error - please try again';
			toastState.error(error);
		} finally {
			isLoading = false;
		}
	}

	async function handleGoogleSignUp() {
		try {
			isLoading = true;
			const supabase = createClient();
			const callbackNext = planParam ? `/pricing?checkout=${planParam}` : '/dashboard';
			const { error: authError } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackNext)}`
				}
			});

			if (authError) throw authError;
		} catch (err: any) {
			error = err.message;
			toastState.error(err.message);
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign Up - SwiftList</title>
</svelte:head>

<div class="min-h-screen bg-[#F8F5F0] flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<!-- Logo -->
		<div class="text-center mb-8">
			<a href="/" class="flex items-center justify-center group cursor-pointer mb-2">
				<Logo size={40} />
			</a>
			<p class="text-[#4B5563]">Create your account</p>
		</div>

		{#if showVerification}
			<!-- Email Verification Screen -->
			<div class="bg-[#2C3E50] rounded-lg shadow-lg p-4 sm:p-8 text-center">
				<div class="mb-6">
					<span class="material-symbols-outlined text-[#00796B] text-[48px]">mark_email_read</span>
				</div>
				<h2 class="text-xl font-bold text-white mb-3">Check your email</h2>
				<p class="text-gray-300 mb-2">
					We sent a confirmation link to:
				</p>
				<p class="text-white font-semibold mb-6">{verificationEmail}</p>
				<p class="text-sm text-gray-400 mb-6">
					Click the link in the email to verify your account and get started with your 100 free credits.
				</p>
				<div class="space-y-3">
					<p class="text-xs text-gray-500">
						Didn't receive it? Check your spam folder or
						<button
							type="button"
							onclick={() => { showVerification = false; }}
							class="text-[#00796B] hover:text-[#00695C] underline"
						>
							try again
						</button>
					</p>
					<a
						href="/auth/login"
						class="inline-block text-sm text-[#00796B] hover:text-[#00695C] font-medium transition-colors"
					>
						Back to Sign In
					</a>
				</div>
			</div>
		{:else}
		<!-- Signup Form -->
		<div class="bg-[#2C3E50] rounded-lg shadow-lg p-4 sm:p-8">
			<form onsubmit={handleSubmit} class="space-y-6">
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

				<!-- Display Name Input -->
				<div>
					<label for="displayName" class="block text-sm font-medium text-gray-300 mb-2">
						Display Name <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						id="displayName"
						bind:value={displayName}
						placeholder="Your Name"
						required
						disabled={isLoading}
						class="w-full px-4 py-3 bg-[#34495E] border border-[#4A5F7F] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:border-transparent transition-all"
					/>
				</div>

				<!-- Password Input -->
				<div>
					<label for="password" class="block text-sm font-medium text-gray-300 mb-2">
						Password <span class="text-red-400">*</span>
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
					{#if password.length > 0}
						<div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
							<p class="text-xs {passwordChecks.length ? 'text-green-400' : 'text-gray-400'}">
								{passwordChecks.length ? '✓' : '○'} 8+ characters
							</p>
							<p class="text-xs {passwordChecks.uppercase ? 'text-green-400' : 'text-gray-400'}">
								{passwordChecks.uppercase ? '✓' : '○'} Uppercase letter
							</p>
							<p class="text-xs {passwordChecks.lowercase ? 'text-green-400' : 'text-gray-400'}">
								{passwordChecks.lowercase ? '✓' : '○'} Lowercase letter
							</p>
							<p class="text-xs {passwordChecks.number ? 'text-green-400' : 'text-gray-400'}">
								{passwordChecks.number ? '✓' : '○'} Number
							</p>
							<p class="text-xs {passwordChecks.special ? 'text-green-400' : 'text-gray-400'}">
								{passwordChecks.special ? '✓' : '○'} Special character
							</p>
						</div>
					{:else}
						<p class="mt-2 text-xs text-gray-400">
							Must be at least 8 characters with uppercase, lowercase, number, and special character
						</p>
					{/if}
				</div>

				{#if error}
					<div class="p-4 bg-red-900/20 border border-red-800 rounded-lg">
						<div class="flex items-start gap-3">
							<span class="material-symbols-outlined text-red-400 text-sm mt-0.5">
								error
							</span>
							<p class="text-sm text-red-300">{error}</p>
						</div>
						{#if validationErrors.length > 0}
							<ul class="mt-3 ml-7 space-y-1">
								{#each validationErrors as validationError}
									<li class="text-xs text-red-300">
										• {validationError.message}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}

				<!-- Create Account Button -->
				<button
					type="submit"
					disabled={isLoading}
					class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? 'Creating account...' : 'Create Account'}
				</button>

				<!-- Divider -->
				<div class="relative my-6">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-gray-600"></div>
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="px-2 bg-[#2C3E50] text-gray-400">Or continue with</span>
					</div>
				</div>

				<!-- Google Sign Up Button -->
				<button
					type="button"
					disabled={isLoading}
					onclick={handleGoogleSignUp}
					class="w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
						<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
						<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
						<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
					</svg>
					<span>Sign up with Google</span>
				</button>

				<p class="text-center text-sm text-gray-400">
					Already have an account?
					<a href={planParam ? `/auth/login?plan=${planParam}` : '/auth/login'} class="text-[#00796B] hover:text-[#00695C] font-medium transition-colors">
						Sign in
					</a>
				</p>
			</form>

			<!-- Free Credits Callout -->
			<div class="mt-6 p-4 bg-[#00796B]/20 border border-[#00796B]/30 rounded-lg flex items-start gap-3">
				<span class="material-symbols-outlined text-[#00796B] text-[20px] mt-0.5">
					workspace_premium
				</span>
				<div>
					<p class="text-sm font-semibold text-white">
						Get 100 Free Credits
					</p>
					<p class="text-xs text-gray-300 mt-1">
						Start transforming your product images immediately after signup!
					</p>
				</div>
			</div>
		</div>
		{/if}
	</div>
</div>
