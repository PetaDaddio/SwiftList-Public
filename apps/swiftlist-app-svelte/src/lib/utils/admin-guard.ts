/**
 * Admin Guard — Checks if a user is an admin via ADMIN_USER_IDS env var.
 *
 * Usage in +page.server.ts:
 * ```ts
 * import { requireAdmin } from '$lib/utils/admin-guard';
 * import { env } from '$env/dynamic/private';
 *
 * export const load: PageServerLoad = async ({ locals }) => {
 *   requireAdmin(locals.userId, env.ADMIN_USER_IDS);
 * };
 * ```
 */

import { error } from '@sveltejs/kit';

/**
 * Throws 403 if the userId is not in the admin list.
 * @param userId - Current authenticated user's UUID
 * @param adminUserIds - Comma-separated UUIDs from ADMIN_USER_IDS env var
 */
export function requireAdmin(userId: string | undefined, adminUserIds: string | undefined): void {
	if (!userId) {
		throw error(401, 'Authentication required');
	}

	if (!adminUserIds) {
		throw error(403, 'Admin access not configured');
	}

	const admins = adminUserIds
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);

	if (!admins.includes(userId)) {
		throw error(403, 'Admin access required');
	}
}

/**
 * Non-throwing variant — returns boolean.
 */
export function isAdmin(userId: string | undefined, adminUserIds: string | undefined): boolean {
	if (!userId || !adminUserIds) return false;

	const admins = adminUserIds
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);

	return admins.includes(userId);
}
