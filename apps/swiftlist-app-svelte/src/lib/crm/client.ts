/**
 * CRM Supabase Client (Server-side only)
 *
 * Creates a Supabase client connected to the swiftlist-crm database.
 * Uses service_role key to bypass RLS for sync writes.
 *
 * SECURITY: This file must only be imported in +server.ts routes.
 * Never import in client-side code or shared files.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { apiLogger } from '$lib/utils/logger';

const log = apiLogger.child({ module: 'crm-client' });

let _crmClient: SupabaseClient | null = null;

/**
 * Get the CRM Supabase client (singleton, service_role).
 * Returns null if CRM env vars are not configured (graceful degradation).
 */
export function getCrmClient(): SupabaseClient | null {
	if (_crmClient) return _crmClient;

	const url = env.CRM_SUPABASE_URL;
	const serviceKey = env.CRM_SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceKey) {
		log.warn('CRM not configured — CRM_SUPABASE_URL or CRM_SUPABASE_SERVICE_ROLE_KEY missing');
		return null;
	}

	_crmClient = createClient(url, serviceKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});

	return _crmClient;
}

/**
 * Get the CRM Supabase client using anon key (for waitlist inserts only).
 * The waitlist table has an anon INSERT policy.
 */
export function getCrmAnonClient(): SupabaseClient | null {
	const url = env.CRM_SUPABASE_URL;
	const anonKey = env.CRM_SUPABASE_ANON_KEY;

	if (!url || !anonKey) {
		log.warn('CRM not configured — CRM_SUPABASE_URL or CRM_SUPABASE_ANON_KEY missing');
		return null;
	}

	return createClient(url, anonKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
}
