import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			out: 'build',
			precompress: true
		}),
		// Auth is enforced via supabase.auth.getUser() in every route + CORS
		// allowlist in hooks.server.ts — safe to disable SvelteKit's own CSRF
		// origin check, which blocks multipart/form-data (avatar upload) POSTs.
		csrf: {
			checkOrigin: false
		},
		alias: {
			$lib: 'src/lib',
			$components: 'src/lib/components',
			$stores: 'src/lib/stores',
			$utils: 'src/lib/utils'
		}
	}
};

export default config;
