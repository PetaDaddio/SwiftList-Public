import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [sentrySvelteKit(), sveltekit(), tailwindcss()],
	css: {
		transformer: 'lightningcss'
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: [],
		alias: {
			$lib: new URL('./src/lib', import.meta.url).pathname,
			$components: new URL('./src/lib/components', import.meta.url).pathname,
			$stores: new URL('./src/lib/stores', import.meta.url).pathname,
			$utils: new URL('./src/lib/utils', import.meta.url).pathname
		}
	}
});
