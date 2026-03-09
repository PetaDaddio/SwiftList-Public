// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { VariantAssignment } from '$lib/ab/config';

declare global {
	namespace App {
		interface Error {
			message: string;
			errorId?: string;
		}
		interface Locals {
			supabase: SupabaseClient<Database>;
			session: Session | null;
			user: User | null;
			profile: Database['public']['Tables']['profiles']['Row'] | null;
			abTests: Record<string, VariantAssignment>;
			abVisitorId: string;
		}
		interface PageData {
			supabase: SupabaseClient<Database>;
			session: Session | null;
			user: User | null;
			profile: Database['public']['Tables']['profiles']['Row'] | null;
			abTests: Record<string, VariantAssignment>;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
