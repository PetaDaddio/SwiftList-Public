<script lang="ts">
	/**
	 * Login Page - Svelte 5
	 * User authentication with Supabase
	 */

	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Card from '$lib/components/Card.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { toastState } from '$lib/stores/toast.svelte';
	import { goto } from '$app/navigation';

	import { page } from '$app/stores';
	import { createClient } from '$lib/supabase/client';

	let email = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let showPassword = $state(false);

	// Read redirect params (from pricing page or other sources)
	const nextUrl = $derived(() => {
		const plan = $page.url.searchParams.get('plan');
		const next = $page.url.searchParams.get('next');
		if (plan) return `/pricing?checkout=${plan}`;
		if (next && next.startsWith('/')) return next;
		return '/dashboard';
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		isLoading = true;

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || data.error || 'Failed to sign in');
			}

			toastState.success('Welcome back!');
			goto(nextUrl());
		} catch (err: any) {
			error = err.message;
			toastState.error(err.message);
		} finally {
			isLoading = false;
		}
	}

	async function handleGoogleSignIn() {
		try {
			isLoading = true;
			const supabase = createClient();
			const plan = $page.url.searchParams.get('plan');
			const next = $page.url.searchParams.get('next');
			const callbackNext = plan ? `/pricing?checkout=${plan}` : (next && next.startsWith('/') ? next : '/dashboard');
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

<div class="min-h-screen bg-[#F8F5F0] flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<!-- Logo -->
		<div class="text-center mb-8">
			<a href="/" class="flex items-center justify-center group cursor-pointer mb-2">
				<Logo size={40} />
			</a>
			<p class="text-[#4B5563]">Sign in to your account</p>
		</div>

		<!-- Login Form -->
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
				</div>

				{#if error}
					<div class="p-2 sm:p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-3">
						<span class="material-symbols-outlined text-red-400 text-sm mt-0.5">
							error
						</span>
						<p class="text-sm text-red-300">{error}</p>
					</div>
				{/if}

				<!-- Sign In Button -->
				<button
					type="submit"
					disabled={isLoading}
					class="w-full bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? 'Signing in...' : 'Sign In'}
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

				<!-- Google Sign In Button -->
				<button
					type="button"
					disabled={isLoading}
					onclick={handleGoogleSignIn}
					class="w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
						<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
						<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
						<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
					</svg>
					<span>Sign in with Google</span>
				</button>

				<div class="text-center space-y-2">
					<p class="text-sm text-gray-400">
						Don't have an account?
						<a href="/auth/signup" class="text-[#00796B] hover:text-[#00695C] font-medium transition-colors">
							Sign up
						</a>
					</p>
					<a
						href="/auth/reset-password"
						class="block text-sm text-gray-400 hover:text-[#00796B] transition-colors"
					>
						Forgot password?
					</a>
				</div>
			</form>
		</div>
	</div>
</div>
