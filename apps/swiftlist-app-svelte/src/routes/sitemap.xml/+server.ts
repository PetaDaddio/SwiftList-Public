import type { RequestHandler } from './$types';

/**
 * Dynamic XML Sitemap for Google Search Console
 * Serves public pages + community preset detail pages from Supabase
 */
export const GET: RequestHandler = async ({ locals }) => {
	const baseUrl = 'https://swiftlist.app';

	// Static public pages with priorities
	const staticPages = [
		{ url: '/home', changefreq: 'weekly', priority: '1.0' },
		{ url: '/hello', changefreq: 'monthly', priority: '0.9' },
		{ url: '/presets', changefreq: 'daily', priority: '0.9' },
		{ url: '/pricing', changefreq: 'monthly', priority: '0.8' },
		{ url: '/faq', changefreq: 'monthly', priority: '0.7' },
		{ url: '/terms', changefreq: 'yearly', priority: '0.3' },
		{ url: '/privacy', changefreq: 'yearly', priority: '0.3' }
	];

	// Fetch public preset IDs from Supabase for dynamic pages
	let presetUrls: { url: string; changefreq: string; priority: string }[] = [];
	try {
		const supabase = locals.supabase;
		const { data: presets } = await supabase
			.from('presets')
			.select('preset_id, updated_at')
			.eq('is_public', true)
			.order('usage_count', { ascending: false })
			.limit(500);

		if (presets) {
			presetUrls = presets.map((p) => ({
				url: `/presets/${p.preset_id}`,
				changefreq: 'weekly',
				priority: '0.6'
			}));
		}
	} catch {
		// Non-critical — static pages still get indexed
	}

	const allPages = [...staticPages, ...presetUrls];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
	.map(
		(page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
	)
	.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=3600'
		}
	});
};
