/**
 * Universal Layout Load (runs on both server AND client)
 *
 * This is the critical piece of the Supabase SSR auth pattern.
 * It creates a browser-side Supabase client that:
 * 1. Uses the session data passed from the server (+layout.server.ts)
 * 2. Manages auth state changes (token refresh, sign-in/out)
 * 3. Calls `invalidate('supabase:auth')` on auth state changes to re-run server loads
 *
 * Without this, full-page loads (like Stripe redirect) lose the session.
 */

import { createBrowserClient, isBrowser } from '@supabase/ssr';
import type { LayoutLoad } from './$types';
import type { Database } from '$lib/types/database';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	/**
	 * Declare a dependency on Supabase auth so that when
	 * `invalidate('supabase:auth')` is called, this load function re-runs.
	 */
	depends('supabase:auth');

	/**
	 * createBrowserClient handles cookies automatically in the browser.
	 * No need to pass a cookies option — it reads/writes document.cookie internally.
	 * The isSingleton option ensures only one client instance exists.
	 */
	const supabase = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
		global: {
			fetch
		},
		isSingleton: true
	});

	/**
	 * On the server side, we already have the validated session from hooks.server.ts.
	 * On the client side, we use getSession() to hydrate from cookies.
	 * getSession() is safe here because getUser() already validated in hooks.server.ts.
	 */
	const {
		data: { session }
	} = await supabase.auth.getSession();

	return {
		supabase,
		session,
		user: data.user,
		profile: data.profile,
		abTests: data.abTests ?? {}
	};
};
