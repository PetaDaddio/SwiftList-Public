<script lang="ts">
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/Logo.svelte';

	interface FAQ {
		q: string;
		a: string;
		tip: string;
	}

	interface FAQSection {
		category: string;
		icon: string;
		questions: FAQ[];
	}

	// SVG icons — Heroicons 2.0 outline style
	const icons = {
		gettingStarted: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" /></svg>`,
		myResults: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`,
		credits: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>`,
		marketplace: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" /></svg>`,
		security: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>`,
		account: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
		whats_coming: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>`
	};

	const tipIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>`;

	const chatIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>`;

	const faqs: FAQSection[] = [
		{
			category: 'What is SwiftList?',
			icon: icons.whats_coming,
			questions: [
				{
					q: 'What is SwiftList and who is it for?',
					a: 'SwiftList is an AI-powered product photography toolkit built by a former NIKE designer who saw firsthand how much time makers spend wrestling with product images instead of creating. Whether you sell handmade jewelry, 3D prints, apparel, or any physical product — SwiftList gives you studio-quality photos without the studio. Upload your product image, and our AI handles the rest: clean background removal, polished lifestyle scenes, and marketplace-ready output in seconds.',
					tip: 'SwiftList was designed for one reason: to give independent sellers the same visual quality that big brands take for granted — without the overhead.'
				},
				{
					q: 'What makes SwiftList different from other tools?',
					a: 'Three proprietary multi-agent AI systems power every job. CleanEdge Intelligence\u2122 delivers precision background removal, especially on difficult products like jewelry and reflective surfaces. GemPerfect Engine\u2122 is a dedicated refinement layer built specifically for stones, prongs, and fine metalwork. ThreadLogic\u2122 handles fabric and apparel with an understanding of texture, drape, and material behavior. These aren\u2019t generic filters — they\u2019re specialized systems designed to produce best-in-class output for real products sold by real makers.',
					tip: 'We ship improvements constantly. New features and engine upgrades are released regularly based on real feedback from sellers like you.'
				},
				{
					q: 'Why should I use SwiftList?',
					a: 'Because time is your most precious asset. Every hour you spend editing photos is an hour you\u2019re not designing, making, or selling. SwiftList automates the tedious parts of product photography so you can focus on what actually grows your business. Upload, process, download — and get back to the work that matters.',
					tip: 'Follow us on X and Instagram to stay up to date on new features, tips, and maker spotlights. Links coming soon!'
				}
			]
		},
		{
			category: 'Getting Started',
			icon: icons.gettingStarted,
			questions: [
				{
					q: 'How do I sign up?',
					a: 'Signing up takes under a minute. Head to swiftlist.app and click "Get Started." You can create an account with your email and a password, or sign in with Google for a one-click setup. No credit card required — you start with 100 free credits the moment your account is created.',
					tip: 'Already on the fence? Sign up for free first. No card, no commitment, and 100 credits in your account immediately. You can explore the full tool before ever spending a dollar.'
				},
				{
					q: 'I just signed up — where do I start?',
					a: 'Head to your Dashboard and hit "New Job" to upload your first product photo. Most first-timers start with Background Removal — it\'s the fastest way to see what SwiftList can do. Once that job is done, start a new job to apply a Vibe. Background Removal and Vibes are separate jobs — you don\'t do both in the same run. Vibes are preset scene styles that drop your product into a polished, marketplace-ready setting. Browse the Vibe library to find a look that fits your brand, or build your own. If you publish a Vibe and other makers use it, you\'ll earn Sparks — free credits added to your account automatically. Minimum image size is 512×512px; higher resolution gives you more to work with.',
					tip: 'Most sellers get consistently great results by their 3rd or 4th job. Browse the Vibe library before you start — finding the right style first makes the whole process faster.'
				},
				{
					q: 'What file formats work best?',
					a: 'SwiftList accepts JPG, PNG, WebP, and HEIC files up to 10MB. HEIC is the default format for iPhone photos — no need to convert before uploading. For best output quality, aim for at least 512×512px. Higher resolution means more detail our AI can preserve, especially on fine jewelry or intricate handmade items. Even lighting and clear contrast between your product and its background make the biggest difference in results.',
					tip: 'Not sure if your photo is good enough? Upload it and see. Our AI handles more than you might expect — and you can always reshoot if the result isn\'t right.'
				},
					{
					q: 'What are Vibes?',
					a: 'A Vibe is a preset scene style that transforms your product photo into a marketplace-ready image. Instead of building a custom backdrop for every listing, you pick a Vibe — a curated combination of lighting, setting, and atmosphere — and SwiftList applies it to your product automatically. You can use Vibes from our built-in library, discover styles shared by other makers in the community, or create and publish your own. When you publish a Vibe and another seller uses it, you earn 2 Sparks added to your account automatically — a subscription-only feature. Explorer tier users can browse and apply Vibes but won\'t earn Sparks. That\'s the Vibe Economy: great taste earns you credits.',
					tip: 'Your first Vibe is a few clicks away in your Dashboard. Try one on a product you already have — the difference is immediate.'
				}
			]
		},
		{
			category: 'My Results',
			icon: icons.myResults,
			questions: [
				{
					q: 'My background removal doesn\'t look perfect — what should I do?',
					a: 'A few things to check: Was the original photo well-lit with the product clearly separated from the background? Low contrast (e.g., a white ceramic mug on a white surface) is the most common culprit. Try re-uploading a higher-resolution version if you have one. If the product has reflective surfaces, transparency, or many fine details (like a ring with multiple prongs), those are genuinely harder — our CleanEdge Intelligence™ handles them better than most tools, but no AI is perfect every time.',
					tip: 'Edge quality on jewelry and handmade goods is something we\'ve invested heavily in. We ship improvements every sprint. If you\'re seeing consistent issues with a specific product type, let us know — your feedback directly shapes what we fix next.'
				},
				{
					q: 'The edges on my jewelry or small item look rough or choppy',
					a: 'Jewelry is one of the hardest challenges for background removal AI — fine prongs, reflective metal, and translucent stones all push any model\'s limits. SwiftList includes two engines specifically built for this: CleanEdge Intelligence™ for precision edge detection on complex shapes, and GemPerfect Engine™, our jewelry-specialized refinement layer tuned for stones, prongs, and reflective surfaces. If edges still look rough: (1) use a higher-res photo, (2) ensure clear contrast between the piece and background, (3) shoot on a mid-tone background — not pure white or pure black — for the best results.',
					tip: 'Jewelry edge quality is a top R&D priority. Each release improves on the last. If a specific piece is giving you trouble, reach out to our team and we\'ll look at it directly.'
				},
				{
					q: 'My image looks pixelated or low-res after processing',
					a: 'The output quality is directly tied to your input quality — SwiftList\'s AI enhances and refines, but can\'t fabricate detail that wasn\'t in the original photo. If your source image is low resolution, upscaling can help but has limits. For best results, start with the highest-resolution photo you have. Our AI upscaling tool works best on images that are already at least 800×800px.',
					tip: 'Upscaling is one of our most actively improved tools. If you\'re regularly working with lower-res source images, let us know — we\'re shaping our upscaling roadmap based on real seller needs.'
				},
				{
					q: 'Processing seems stalled — is something wrong?',
					a: 'Most jobs complete within 10–30 seconds. More complex treatments like lifestyle scene generation can take 1–2 minutes. If a job shows "Processing" for more than 3 minutes, try refreshing — the result may already be ready. If a job genuinely fails, you will not be charged credits for it. Credits are always automatically refunded on failed jobs. No exceptions.',
					tip: 'Occasional delays happen during high-traffic periods. We\'re actively scaling infrastructure ahead of full launch. Your credits are always safe — we\'d never charge you for a job that didn\'t complete.'
				}
			]
		},
		{
			category: 'Credits & Pricing',
			icon: icons.credits,
			questions: [
				{
					q: 'Is there actually a free tier, or is this a time-limited trial?',
					a: 'Genuinely free. The Explorer tier gives you 100 credits per month, every month, forever — no credit card required, no expiry date on your account. That\'s enough for roughly 20 background removals or a mix of treatments. We want you to use SwiftList, love it, and tell others about it before we ever ask for a dollar.',
					tip: 'Your 100 monthly credits reset on your account anniversary date. Make the most of them — and when you\'re ready to process at volume, upgrading takes 30 seconds.'
				},
				{
					q: 'I ran out of credits — now what?',
					a: 'The fastest path back is a credit pack — available instantly from your Account Settings, no subscription needed. Credit packs never expire, so stock up when it\'s convenient. If you\'re regularly hitting your limits, a subscription plan is better value: more credits per dollar, restocked every cycle. There\'s also a way to earn free credits without spending anything: publish a Vibe. Every time another maker uses your Vibe in their listings, you earn Sparks — credits that land in your balance automatically. Build something great and your community pays you back.',
					tip: 'Ready to upgrade? <a href="/pricing" class="underline font-medium hover:text-[#005f52] transition-colors">View our plans on the Pricing page</a> — takes 30 seconds and kicks in immediately.'
				},
				{
					q: 'What are Sparks?',
					a: 'Sparks are free credits you earn when another seller uses your published Vibe. Every time your Vibe is applied to someone else\'s product listing, you earn 2 Sparks automatically — no extra work, no tracking, no invoices. Sparks are a subscription-only feature; Explorer tier accounts can use Vibes but don\'t earn Sparks. When you use someone else\'s Vibe, they earn Sparks from your use. It\'s a creator economy built into SwiftList: publish great styles, earn free credits, keep your workflow running without always buying more. The more useful your Vibe, the more Sparks flow your way.',
					tip: 'Sparks accumulate in your credit balance just like purchased credits and never expire. Start with one well-crafted Vibe — the returns are ongoing.'
				},
				{
					q: 'Do you offer refunds?',
					a: 'Yes. We offer a 14-day money-back guarantee on all subscription plans — no questions asked. If SwiftList doesn\'t deliver the results you need within your first 14 days, contact us for a full refund. Credit packs are non-refundable once credits have been consumed (processing has already occurred), but we\'ll always consider unused credits on a case-by-case basis.',
					tip: 'Before you refund, let us try to fix the problem. Most refund requests come from a specific issue our team was able to resolve. Give us the chance to make it right — we\'d genuinely rather keep you than lose you.'
				},
				{
					q: 'What payment methods do you accept?',
					a: 'All major credit and debit cards — Visa, Mastercard, American Express, Discover — via Stripe, one of the world\'s most trusted payment processors. Your payment details are never stored on SwiftList servers. We\'re adding more payment options based on user requests.',
					tip: 'Have a payment preference we don\'t support yet? Let us know — user requests directly drive what we add to checkout next.'
				}
			]
		},
		{
			category: 'Commercial Use & Marketplaces',
			icon: icons.marketplace,
			questions: [
				{
					q: 'Can I use SwiftList images in my Etsy or eBay shop?',
					a: 'Yes — fully and completely. All images processed through SwiftList, including on the free Explorer tier, carry full commercial usage rights. Use them in Etsy listings, eBay stores, Instagram shops, wholesale catalogs, print materials — anywhere. You own the output. No attribution required, no royalty fees, no strings attached.',
					tip: 'SwiftList\'s background removal is tuned specifically for marketplace standards — eBay\'s recommended warm grey (#F5F5F5), Etsy\'s clean listing requirements. Generic tools guess at these specs. We\'ve built them in.'
				},
				{
					q: 'What marketplaces does SwiftList optimize for?',
					a: 'Etsy, eBay, Amazon, Shopify, Poshmark, and more. Each marketplace has specific image requirements — dimensions, background color, format — and SwiftList generates compliant assets automatically. eBay\'s recommended background is a specific warm grey (#F5F5F5), not pure white. We know the specs so you don\'t have to.',
					tip: 'We\'re continuously adding marketplace presets. If you sell on a platform we haven\'t covered yet, tell us — marketplace additions are fast to ship and high on our priority list.'
				},
				{
					q: 'Do I own the images I create with SwiftList?',
					a: 'Yes. Completely. The output images are yours. SwiftList processes your images using AI and returns the result to you — we make no claim on ownership of your outputs. This applies to all tiers, including Explorer.',
					tip: 'Ownership clarity matters for your business. If you ever have a specific question about usage rights for a particular context — licensing, print, wholesale — email us and we\'ll give you a straight answer.'
				}
			]
		},
		{
			category: 'Trust & Security',
			icon: icons.security,
			questions: [
				{
					q: 'Are my product photos safe? Could someone else see them?',
					a: 'Your images are stored in private, encrypted cloud storage. No other SwiftList user can access your uploads or outputs — ever. We use Row Level Security (RLS) at the database level, meaning your data is isolated at the infrastructure layer, not just by application code. Only you can see your images.',
					tip: 'Your product photos represent your business and your creative work. We treat that with the same seriousness you do. If you have a specific security question, our team will answer it directly and honestly.'
				},
				{
					q: 'How long do you store my images?',
					a: 'All processed images and job outputs are available for 30 days from the processing date. After 30 days, files are automatically and permanently deleted from our servers. We recommend downloading your results — especially final listing images — as soon as a job completes.',
					tip: 'We\'re exploring longer retention windows for higher subscription tiers. In the meantime, treat SwiftList as your processing engine and your local drive as your archive.'
				}
			]
		},
		{
			category: 'Account & Support',
			icon: icons.account,
			questions: [
				{
					q: 'How do I contact support?',
					a: 'Use the support button at the bottom of this page — you\'ll reach a real person who knows the product. Explorer tier users receive a response within 48 hours. Paid tier users get priority response within 24 hours. We\'re a focused team, not a ticket queue. If you\'re reporting a job issue, include your Job ID (visible in your job history) so we can pull up exactly what happened.',
					tip: 'We read every support email and use them to prioritize fixes. If something is broken or confusing, telling us isn\'t just getting help — it\'s making SwiftList better for you and every seller after you.'
				},
				{
					q: 'Can I upgrade or downgrade my plan?',
					a: 'Yes, anytime. Upgrades take effect immediately — you get more credits and features right away, with prorated billing. Downgrades take effect at the end of your current billing period. Your job history and presets carry over across all tier changes. Nothing gets deleted when you change plans.',
					tip: 'Not sure which tier fits your current volume? Start lower — you can upgrade the moment you hit your limits, and it takes 30 seconds. We\'ve made it easy on purpose.'
				},
				{
					q: 'What happens if I cancel my subscription?',
					a: 'Your account stays active through the end of your paid billing period — full access and every credit you\'ve already been granted is yours to use. When the billing period ends, your remaining credits stay in your account. Once those credits run out, you won\'t be able to run new jobs unless you re-subscribe or top up with a credit pack. Your job history, presets, and any Vibes you\'ve published stay in your account — nothing disappears. Coming back is as simple as picking a plan or grabbing a credit pack.',
					tip: 'Before you cancel, let us know why. Cancellation feedback is some of the most valuable input we receive. Even a one-line email helps us build a better product — and sometimes we can fix the thing that was frustrating you.'
				}
			]
		},
		{
			category: "What's Coming",
			icon: icons.whats_coming,
			questions: [
				{
					q: 'What new features are you working on?',
					a: 'SwiftList ships updates regularly. Active roadmap items include: batch processing (upload multiple images at once), expanded marketplace templates, Etsy integration for direct listing sync, a Vibe Marketplace for community-created styles, and mobile app support for on-the-go processing. We prioritize features directly based on what sellers tell us they need.',
					tip: 'The best way to influence what we build next is to tell us what\'s missing. Send us your request — high-demand features move to the top of our sprint. You\'re not just a user, you\'re shaping the product.'
				},
				{
					q: 'Can I suggest a feature?',
					a: 'Absolutely — and we genuinely mean it. Feature requests are reviewed by our product team weekly. Several features currently in development started as direct requests from early community members. Your experience as a seller is exactly the insight we need to build the right thing.',
					tip: 'Users who submit feature requests are the first to know when those features ship. We don\'t forget who asked for what — early community members have a real influence on SwiftList\'s direction.'
				},
				{
					q: 'Is SwiftList actively maintained and improved?',
					a: 'Yes — we\'re in active development and shipping new releases regularly. SwiftList is a product we\'re building with our community, not a static tool. When you run into something that doesn\'t work the way you expect, that feedback goes straight into our sprint planning. We\'re not just maintaining SwiftList — we\'re building toward a full end-to-end solution for product imagery.',
					tip: 'The version of SwiftList you\'re using today is the worst version it will ever be. We ship improvements continuously. Stick with us — the best is coming.'
				}
			]
		}
	];
</script>

<svelte:head>
	<title>FAQ — SwiftList</title>
	<meta name="description" content="Got questions about SwiftList? Find answers about credits, Vibes, Sparks, background removal quality, marketplace optimization, pricing, and more." />
</svelte:head>

<div class="min-h-screen bg-[#F8F5F0]">
	<!-- Header -->
	<header class="w-full px-6 py-6 md:px-12 flex items-center justify-between z-10 relative">
		<a href="/" class="flex items-center group cursor-pointer transition-transform duration-300 group-hover:scale-105">
			<Logo size={32} />
		</a>
		<nav class="flex items-center gap-6">
			<a href="/pricing" class="text-[#4B5563] hover:text-[#2C3E50] font-sans text-sm font-medium transition-colors">Pricing</a>
			<a href="/auth/login" class="text-[#4B5563] hover:text-[#2C3E50] font-sans text-sm font-medium transition-colors">Login</a>
		</nav>
	</header>

	<!-- Hero Section -->
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
		<h1 class="text-3xl sm:text-4xl md:text-5xl font-bold text-[#2C3E50] mb-4">Got questions? We've got answers.</h1>
		<p class="text-base sm:text-lg md:text-xl text-[#4B5563] max-w-2xl mx-auto">
			SwiftList is built to make your product photos sell. If something isn't working the way you expect, we want to fix it — and we want to keep you creating.
		</p>

		<!-- Category jump nav -->
		<div class="flex flex-wrap justify-center gap-2 mt-8">
			{#each faqs as section}
				<a
					href="#{section.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm text-[#4B5563] hover:text-[#00796B] hover:shadow-sm border border-transparent hover:border-[#00796B]/20 transition-all duration-200"
				>
					<span class="w-4 h-4 text-[#00796B] flex-shrink-0">{@html section.icon}</span>
					<span>{section.category}</span>
				</a>
			{/each}
		</div>
	</div>

	<!-- FAQ Sections -->
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
		{#each faqs as section (section.category)}
			<div
				class="mb-14"
				id={section.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
			>
				<div class="flex items-center gap-3 mb-6">
					<span class="w-6 h-6 text-[#00796B] flex-shrink-0">{@html section.icon}</span>
					<h2 class="text-xl sm:text-2xl font-bold text-[#2C3E50]">{section.category}</h2>
				</div>

				<div class="space-y-4">
					{#each section.questions as faq (faq.q)}
						<div class="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
							<div class="p-5 sm:p-6">
								<h3 class="text-base sm:text-lg font-semibold text-[#2C3E50] mb-3">{faq.q}</h3>
								<p class="text-sm text-[#4B5563] leading-relaxed">{faq.a}</p>
							</div>
							<!-- Tip callout -->
							<div class="mx-4 sm:mx-6 mb-5 sm:mb-6 bg-[#F0FAF9] border border-[#00796B]/20 rounded-lg px-4 py-3 flex gap-2.5">
								<span class="text-[#00796B] w-4 h-4 flex-shrink-0 mt-0.5">{@html tipIcon}</span>
								<p class="text-sm text-[#00695C] leading-relaxed">{@html faq.tip}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}

		<!-- Still have questions CTA -->
		<div class="mt-8 text-center">
			<div class="bg-white rounded-xl p-8 shadow-sm border border-[#00796B]/10">
				<div class="w-10 h-10 text-[#00796B] mx-auto mb-3">{@html chatIcon}</div>
				<h2 class="text-xl sm:text-2xl font-bold text-[#2C3E50] mb-2">Still stuck? We're here.</h2>
				<p class="text-sm sm:text-base text-[#4B5563] mb-6 max-w-lg mx-auto">
					Every question you send us makes SwiftList better. Our team reads every message — don't hesitate to reach out.
				</p>
				<div class="flex flex-col sm:flex-row items-center justify-center gap-3">
					<a
						href="/contact"
						class="w-full sm:w-auto bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 text-sm sm:text-base text-center"
					>
						Contact Support
					</a>
					<button
						onclick={() => goto('/pricing')}
						class="w-full sm:w-auto bg-white border-2 border-[#00796B] text-[#00796B] hover:bg-[#00796B] hover:text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 text-sm sm:text-base"
					>
						View Pricing
					</button>
				</div>
				<p class="text-xs text-[#9CA3AF] mt-4">We reply within 24–48 hours. Real humans, no bots.</p>
			</div>
		</div>
	</div>
</div>
