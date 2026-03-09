/**
 * URL Validation Utility
 *
 * SECURITY: Prevents SSRF attacks by restricting server-side fetches
 * to known-safe domains (Supabase Storage).
 */

// Allowed domains for server-side image fetches
const ALLOWED_HOSTNAME_SUFFIXES = [
	'.supabase.co',
	'.supabase.in'
];

/**
 * Validates that a URL points to an allowed domain (Supabase Storage).
 * Prevents SSRF attacks where an attacker submits internal network URLs
 * (e.g., 169.254.169.254, localhost) as image_url.
 */
export function validateImageUrl(url: string): { valid: boolean; error?: string } {
	try {
		const parsed = new URL(url);

		// Block non-HTTPS (except localhost in dev)
		if (parsed.protocol !== 'https:') {
			return { valid: false, error: 'Image URL must use HTTPS' };
		}

		// Check against allowed domains
		const isAllowed = ALLOWED_HOSTNAME_SUFFIXES.some(
			suffix => parsed.hostname.endsWith(suffix)
		);

		if (!isAllowed) {
			return { valid: false, error: 'Image URL must be from Supabase Storage' };
		}

		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}
}
