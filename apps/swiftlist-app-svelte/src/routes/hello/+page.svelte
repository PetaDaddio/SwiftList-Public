<script lang="ts">
	/**
	 * SwiftList Marketing Landing Page
	 * Full-featured marketing page at /hello
	 * Converted from SwiftList-Landing-Package/landing-page.html → Svelte 5
	 */

	import Logo from '$lib/components/Logo.svelte';
	import ABTest from '$lib/components/ABTest.svelte';

	// --- State ---
	let mobileMenuOpen = $state(false);
	let navScrolled = $state(false);
	// --- Wipe reveal state ---
	let wipePos = $state(88);
	let wipeAnimating = $state(true);
	let wipeDragging = $state(false);
	let wipeEl: HTMLElement | undefined = $state();

	// --- Label visibility ---
	const BEFORE_HIDE = 22;
	const AFTER_HIDE = 78;
	let beforeLabelHidden = $derived(wipePos < BEFORE_HIDE);
	let afterLabelHidden = $derived(wipePos > AFTER_HIDE);

	// --- Scroll listener ---
	$effect(() => {
		function onScroll() {
			navScrolled = window.scrollY > 10;
		}
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	// --- Wipe reveal animation ---
	$effect(() => {
		if (!wipeAnimating) return;
		const startPos = 88;
		const targetPos = 38;
		const duration = 1300;
		let startTime: number | null = null;
		let raf: number;

		function easeInOut(t: number) {
			return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		}

		function animate(ts: number) {
			if (!startTime) startTime = ts;
			const t = Math.min((ts - startTime) / duration, 1);
			wipePos = startPos + (targetPos - startPos) * easeInOut(t);
			if (t < 1) {
				raf = requestAnimationFrame(animate);
			} else {
				wipePos = targetPos;
				wipeAnimating = false;
			}
		}

		const timeout = setTimeout(() => {
			raf = requestAnimationFrame(animate);
		}, 700);

		return () => {
			clearTimeout(timeout);
			cancelAnimationFrame(raf);
		};
	});

	// --- Wipe drag handlers ---
	$effect(() => {
		if (!wipeDragging) return;

		function onMouseMove(e: MouseEvent) {
			if (!wipeEl) return;
			const rect = wipeEl.getBoundingClientRect();
			wipePos = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
		}
		function onTouchMove(e: TouchEvent) {
			if (!wipeEl) return;
			const rect = wipeEl.getBoundingClientRect();
			wipePos = Math.max(5, Math.min(95, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
		}
		function onEnd() {
			wipeDragging = false;
		}

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onEnd);
		document.addEventListener('touchmove', onTouchMove, { passive: true });
		document.addEventListener('touchend', onEnd);

		return () => {
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onEnd);
			document.removeEventListener('touchmove', onTouchMove);
			document.removeEventListener('touchend', onEnd);
		};
	});

	function handleWipeStart(e: MouseEvent | TouchEvent) {
		if (wipeAnimating) return;
		wipeDragging = true;
		if (!wipeEl) return;
		const rect = wipeEl.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		wipePos = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
		e.preventDefault();
	}

	// --- Scroll animation action ---
	function animateOnScroll(node: HTMLElement) {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('visible');
						observer.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
		);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<svelte:head>
	<title>SwiftList — AI Product Photography for E-Commerce Sellers</title>
	<meta name="description" content="Upload one product photo, get marketplace-ready images for Etsy, Shopify, Amazon, eBay, Poshmark, and Facebook — in one job. AI background removal with CleanEdge Intelligence, lifestyle scenes, and batch processing.">
	<link rel="canonical" href="https://heyswiftlist.com">
	<meta property="og:title" content="SwiftList — AI Product Photography for E-Commerce Sellers">
	<meta property="og:description" content="Upload one product photo, get marketplace-ready images for Etsy, Shopify, Amazon, eBay, Poshmark, and Facebook — in one job. AI background removal, lifestyle scenes, and batch processing.">
	<meta property="og:type" content="website">
	<meta property="og:url" content="https://heyswiftlist.com">
	<meta property="og:image" content="https://heyswiftlist.com/og-image.png">
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:title" content="SwiftList — AI Product Photography for E-Commerce Sellers">
	<meta name="twitter:description" content="Upload one product photo, get marketplace-ready images for 6 marketplaces in one job. AI background removal, lifestyle scenes, and batch processing.">
	<meta name="twitter:image" content="https://heyswiftlist.com/og-image.png">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
	{@html `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"SwiftList","url":"https://heyswiftlist.com","logo":"https://heyswiftlist.com/logo.svg","description":"AI-powered product image automation for e-commerce sellers.","sameAs":[]}</script>`}
	{@html `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"SwiftList","applicationCategory":"PhotographyApplication","operatingSystem":"Web","url":"https://heyswiftlist.com","description":"AI product photography automation for e-commerce sellers. Background removal, lifestyle scenes, batch processing.","offers":[{"@type":"Offer","price":"0","priceCurrency":"USD","name":"Explorer"},{"@type":"Offer","price":"29","priceCurrency":"USD","name":"Maker"},{"@type":"Offer","price":"49","priceCurrency":"USD","name":"Merchant"}]}</script>`}
	{@html `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is AI product photography?","acceptedAnswer":{"@type":"Answer","text":"AI product photography uses artificial intelligence to automatically enhance, edit, and transform your product images. SwiftList's CleanEdge Intelligence pipeline removes backgrounds with a 7-agent process, generates lifestyle scenes, upscales resolution, and outputs images perfectly sized for 6 marketplaces — all without manual editing or design skills."}},{"@type":"Question","name":"How does SwiftList work?","acceptedAnswer":{"@type":"Answer","text":"Upload your product photos, choose an AI treatment (CleanEdge Intelligence background removal, lifestyle scene, or batch processing), and download images perfectly sized for 6 marketplaces in seconds. Our 7-agent pipeline handles everything from clean cutouts to styled scenes."}},{"@type":"Question","name":"Which marketplaces does SwiftList support?","acceptedAnswer":{"@type":"Answer","text":"SwiftList creates optimized images for all major marketplaces including Etsy, Amazon, eBay, Shopify, Poshmark, Depop, Mercari, Facebook Marketplace, and more. Each image meets platform-specific requirements."}},{"@type":"Question","name":"Can SwiftList handle jewelry and reflective products?","acceptedAnswer":{"@type":"Answer","text":"Yes. Our GemPerfect Engine is a specialist within the CleanEdge Intelligence pipeline, specifically designed for jewelry, gemstones, watches, and reflective surfaces. It preserves sparkle, transparency, and metallic detail that standard background removal tools destroy."}},{"@type":"Question","name":"How much does AI product photography cost?","acceptedAnswer":{"@type":"Answer","text":"SwiftList starts free with 100 credits per month. Paid plans start at $29/month. Compare this to professional photography at $25-50 per product — SwiftList saves sellers hundreds of dollars monthly."}},{"@type":"Question","name":"Do I need design skills to use SwiftList?","acceptedAnswer":{"@type":"Answer","text":"Not at all. SwiftList is built for makers, not designers. Upload your photos, pick a style, and the AI does the rest. If you can take a photo with your phone, you can use SwiftList."}},{"@type":"Question","name":"Is my product data secure?","acceptedAnswer":{"@type":"Answer","text":"Absolutely. SwiftList uses enterprise-grade encryption, secure cloud storage, and strict data isolation. Your images are never shared, used for training, or accessible to other users."}},{"@type":"Question","name":"Can I process images in bulk?","acceptedAnswer":{"@type":"Answer","text":"Yes. Pro and Business plans include batch processing. Upload your entire inventory and SwiftList processes every image with consistent quality — perfect for seasonal restocks or new collection launches."}},{"@type":"Question","name":"What are Vibes and how do Sparks work?","acceptedAnswer":{"@type":"Answer","text":"Vibes are reusable photography style presets that define how your product images look — lighting, background, mood, and aesthetic direction. When you publish a Vibe to the SwiftList marketplace, other sellers can use it too — and every time they do, you earn Sparks (free credits)."}}]}</script>`}
</svelte:head>

<!-- === NAVIGATION === -->
<header class="nav" class:scrolled={navScrolled}>
	<div class="container">
		<div class="nav-inner">
			<a href="/home" class="nav-logo" aria-label="SwiftList Home">
				<Logo size={28} />
			</a>
			<nav class="nav-links">
				<a href="#features">Features</a>
				<a href="#vibes">Vibes</a>
				<a href="#how-it-works">How It Works</a>
				<a href="/pricing">Pricing</a>
				<a href="/faq">FAQ</a>
			</nav>
			<a href="/home" class="btn btn-primary nav-cta">Start Free</a>
			<button
				class="hamburger"
				class:active={mobileMenuOpen}
				onclick={() => mobileMenuOpen = !mobileMenuOpen}
				aria-label="Toggle menu"
			>
				<span></span><span></span><span></span>
			</button>
		</div>
	</div>
</header>

<!-- Mobile Menu -->
<div class="mobile-menu" class:open={mobileMenuOpen}>
	<a href="#features" onclick={closeMobileMenu}>Features</a>
	<a href="#vibes" onclick={closeMobileMenu}>Vibes</a>
	<a href="#how-it-works" onclick={closeMobileMenu}>How It Works</a>
	<a href="/pricing" onclick={closeMobileMenu}>Pricing</a>
	<a href="/faq" onclick={closeMobileMenu}>FAQ</a>
	<a href="/home" class="btn btn-primary" style="display:flex;">Start Free</a>
</div>

<main>

<!-- === HERO SECTION === -->
<section class="hero">
	<div class="container">
		<div class="hero-grid">
			<div class="hero-text">
				<h1><ABTest experiment="landing-hero-headline" let:value>{value || 'One Upload. Six Marketplaces. The Photos Your Products Deserve.'}</ABTest></h1>
				<p><ABTest experiment="landing-hero-subhead" let:value>{value || "Upload one photo. SwiftList's CleanEdge Intelligence™ handles the cutouts, the styling, and the resizing — delivering professional images for all 6 marketplaces in seconds."}</ABTest></p>
				<div class="hero-actions">
					<a href="/home" class="btn btn-primary btn-lg"><ABTest experiment="landing-hero-cta" let:value>{value || 'Start Free — No Credit Card Required'}</ABTest></a>
					<a href="#how-it-works" class="hero-link"><ABTest experiment="landing-how-it-works-link" let:value>{value || 'See How It Works'}</ABTest> <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></a>
				</div>
			</div>
			<div class="hero-visual">
				<!-- WIPE REVEAL -->
				<div
					class="wipe-reveal"
					bind:this={wipeEl}
					role="img"
					aria-label="Before and after: ring photo transformed by SwiftList AI"
					onmousedown={handleWipeStart}
					ontouchstart={handleWipeStart}
				>
					<img class="wipe-before-img" src="/landing-images/ring-original-opt.webp" alt="Original ring photo on cream fabric — before SwiftList">
					<div class="wipe-after-layer" style="clip-path: inset(0 0 0 {wipePos}%);">
						<img src="/landing-images/ring-bg-removed.webp" alt="Ring with background cleanly removed — after SwiftList CleanEdge Intelligence processing">
					</div>
					<div class="wipe-handle" style="left: {wipePos}%;">
						<div class="wipe-circle">
							<svg viewBox="0 0 20 20" fill="none" stroke="#26766c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M7 4L3 10l4 6M13 4l4 6-4 6"/>
							</svg>
						</div>
					</div>
					<span class="wipe-label-before" class:wipe-label-hidden={beforeLabelHidden}>Before</span>
					<span class="wipe-label-after" class:wipe-label-hidden={afterLabelHidden}>After</span>
				</div>
			</div>
		</div>
		<div class="trust-bar">
			<p>Built for sellers on</p>
			<div class="trust-logos">
				<img class="trust-logo trust-logo-icon" style="height:48px;width:48px" src="/logos/etsy-logo-svgrepo-com.svg" alt="Etsy" />
				<img class="trust-logo trust-logo-wide" src="/logos/shopify-logo.svg" alt="Shopify" />
				<img class="trust-logo trust-logo-icon" style="height:70px;width:70px" src="/logos/amazon-pay-svgrepo-com.svg" alt="Amazon" />
				<img class="trust-logo trust-logo-icon" style="height:70px;width:70px" src="/logos/ebay-svgrepo-com.svg" alt="eBay" />
				<img class="trust-logo trust-logo-wide" src="/logos/Poshmark_idE554Q801_0.svg" alt="Poshmark" />
				<img class="trust-logo trust-logo-icon" style="height:84px;width:84px" src="/logos/facebook-5-logo-svgrepo-com.svg" alt="Facebook Marketplace" />
				<img class="trust-logo trust-logo-icon trust-logo-sm" src="/logos/pinterest-color-svgrepo-com.svg" alt="Pinterest" />
				<img class="trust-logo trust-logo-icon trust-logo-sm" src="/logos/instagram-2-1-logo-svgrepo-com.svg" alt="Instagram" />
			</div>
		</div>
	</div>
</section>

<!-- === HOW IT WORKS === -->
<section class="section-pad cv-auto" id="how-it-works" style="background:var(--gray-50);">
	<div class="container text-center">
		<h2 use:animateOnScroll>Three Steps. Zero Design Skills.</h2>
		<p class="section-subtitle" use:animateOnScroll>Professional product images without the learning curve</p>
		<div style="height:48px"></div>
		<div class="steps-grid">
			<div class="step-connector"></div>
			<div class="step-card" use:animateOnScroll>
				<div class="step-number">1</div>
				<div class="step-icon">
					<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--teal)"><path d="M24 32V8M16 16l8-8 8 8"/><rect x="6" y="32" width="36" height="10" rx="3"/></svg>
				</div>
				<h3>Upload Your Photos</h3>
				<p>Drag and drop your product images — one at a time or in bulk batches (coming soon).</p>
			</div>
			<div class="step-card" use:animateOnScroll>
				<div class="step-number">2</div>
				<div class="step-icon">
					<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--teal)"><path d="M24 4l3.09 9.26L36 14.27l-7 5.41L30.82 30 24 24.77 17.18 30 19 19.68l-7-5.41 8.91-1.01z"/><circle cx="24" cy="38" r="6"/><path d="M20 38h8"/></svg>
				</div>
				<h3>Choose Your AI Treatment</h3>
				<p>CleanEdge Intelligence™ background removal, lifestyle scenes, auto generate product descriptions, stylize your background, or apply a preset template from our preset marketplace.</p>
			</div>
			<div class="step-card" use:animateOnScroll>
				<div class="step-number">3</div>
				<div class="step-icon">
					<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--teal)"><path d="M24 16v24M16 32l8 8 8-8"/><rect x="6" y="6" width="36" height="10" rx="3"/></svg>
				</div>
				<h3>Download &amp; List</h3>
				<p>Get perfectly sized images for Etsy, Amazon, eBay, Shopify, Poshmark, and Facebook Marketplace — all from one upload.</p>
			</div>
		</div>
	</div>
</section>

<!-- === TESTIMONIAL === -->
<section class="testimonial-section section-pad">
	<div class="container">
		<div class="testimonial-card" use:animateOnScroll>
			<img
				class="testimonial-avatar"
				src="/testimonials/avatar-jim.jpg"
				alt="Jim D."
			/>
			<blockquote class="testimonial-quote">
				"I used another app to remove the background on my custom ring but it never looked quite right. It added a sharp point sticking out like a wing that wasn't there. SwiftList removed the background and made my ring look perfect...even the metal color was spot on!"
			</blockquote>
			<cite class="testimonial-author">Jim D.</cite>
			<span class="testimonial-role">Custom Jewelry Seller</span>
		</div>
	</div>
</section>

<!-- === AI PIPELINE DEMO === -->
<section class="section-pad cv-auto" id="demo">
	<div class="container text-center">
		<h2 use:animateOnScroll>See the AI Magic in Action</h2>
		<p class="section-subtitle" use:animateOnScroll>One phone photo. Four professional outputs. Automatically.</p>
		<div style="height:48px"></div>
		<div class="ring-pipeline">
			<div class="ring-step" use:animateOnScroll>
				<img src="/landing-images/ring-original-opt.webp" alt="Original ring photo on cream fabric — raw upload before processing" loading="lazy">
				<div class="ring-step-label">
					<span class="ring-step-num">Step 1</span>
					<span class="ring-step-name">Your Upload</span>
				</div>
			</div>
			<div class="ring-step" use:animateOnScroll style="transition-delay:0.12s;">
				<img src="/landing-images/ring-bg-removed.webp" alt="Ring with background cleanly removed — white background, no artifacts" loading="lazy">
				<div class="ring-step-label">
					<span class="ring-step-num">Step 2</span>
					<span class="ring-step-name">CleanEdge™ Cutout</span>
				</div>
			</div>
			<div class="ring-step" use:animateOnScroll style="transition-delay:0.24s;">
				<img src="/landing-images/ring-vibe-pitina-opt.webp" alt="Ring on turquoise weathered paint — Pitina vibe from the marketplace applied" loading="lazy">
				<div class="ring-step-label">
					<span class="ring-step-num">Step 3</span>
					<span class="ring-step-name">Vibe Applied</span>
				</div>
			</div>
			<div class="ring-step step-final" use:animateOnScroll style="transition-delay:0.36s;">
				<img src="/landing-images/ring-lifestyle-opt.webp" alt="Ring in professional lifestyle scene — marketplace-ready listing image" loading="lazy">
				<div class="ring-step-label">
					<span class="ring-step-num">Step 4</span>
					<span class="ring-step-name">Stylized Background</span>
				</div>
			</div>
		</div>
		<div class="ring-pipeline-cta" use:animateOnScroll style="transition-delay:0.48s;">
			<p>Every image sized and exported for all 6 marketplaces — automatically.</p>
			<a href="/auth/signup" class="btn btn-primary btn-lg">Try It Free</a>
		</div>
	</div>
</section>

<!-- === THREADLOGIC PIPELINE === -->
<section class="section-pad cv-auto" id="threadlogic" style="background:var(--gray-50);">
	<div class="container text-center">
		<div class="vibes-eyebrow">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M4 8h8M6 12h4"/></svg>
			Fashion &amp; Apparel
		</div>
		<h2 use:animateOnScroll>Meet ThreadLogic<sup style="font-size:0.5em">™</sup></h2>
		<p class="section-subtitle" use:animateOnScroll>Our AI specialist for fabric, fashion, and apparel — including the invisible mannequin effect that fashion sellers rely on.</p>
		<div style="height:48px"></div>
		<div class="ring-pipeline">
			<div class="ring-step" use:animateOnScroll>
				<img src="/landing-images/pants-original-opt.webp" alt="Original khaki pants photo — raw seller upload before processing" loading="lazy">
				<div class="ring-step-label">
					<span class="ring-step-num">Step 1</span>
					<span class="ring-step-name">Your Upload</span>
				</div>
			</div>
			<div class="ring-step" use:animateOnScroll style="transition-delay:0.12s;">
				<img src="/landing-images/pants-bg-removed-opt.webp" alt="Khaki pants with background removed — ThreadLogic fabric edge detection" loading="lazy">
				<div class="ring-step-label">
					<span class="ring-step-num">Step 2</span>
					<span class="ring-step-name">ThreadLogic™ Cutout</span>
				</div>
			</div>
			<div class="ring-step" use:animateOnScroll style="transition-delay:0.24s;">
				<img src="/landing-images/pants-invisible-mannequin-opt.webp" alt="Khaki pants with invisible mannequin effect applied — clothing stands on its own" loading="lazy">
				<div class="ring-step-label">
					<span class="ring-step-num">Step 3</span>
					<span class="ring-step-name">Invisible Mannequin</span>
				</div>
			</div>
			<div class="ring-step step-final" use:animateOnScroll style="transition-delay:0.36s;">
				<img src="/landing-images/pants-stylized-bg-opt.webp" alt="Khaki pants in professional styled lifestyle scene — marketplace-ready fashion photo" loading="lazy">
				<div class="ring-step-label">
					<span class="ring-step-num">Step 4</span>
					<span class="ring-step-name">Stylized Background</span>
				</div>
			</div>
		</div>
		<div class="ring-pipeline-cta" use:animateOnScroll style="transition-delay:0.48s;">
			<p>ThreadLogic™ handles fabric edges, folds, and textures that trip up every other tool.</p>
			<a href="/auth/signup" class="btn btn-primary btn-lg">Try It Free</a>
		</div>
	</div>
</section>

<!-- === AI FEATURES === -->
<section class="section-pad cv-auto" id="features">
	<div class="container">
		<div class="text-center" style="margin-bottom:48px;">
			<h2 use:animateOnScroll>Proprietary AI Built for Product Sellers</h2>
			<p class="section-subtitle" use:animateOnScroll>CleanEdge Intelligence™, GemPerfect Engine™, and ThreadLogic™ — purpose-built technology for every product type</p>
		</div>

		<div class="feature-row" use:animateOnScroll>
			<div class="feature-visual">
				<img src="/landing-images/feature-cleanedge.webp" alt="Handmade ceramic coffee mug with clean cutout edges on transparent checkerboard background — CleanEdge Intelligence background removal" width="800" height="600" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md);">
			</div>
			<div class="feature-text">
				<h3>CleanEdge Intelligence™ Background Removal</h3>
				<p>Our proprietary 7-agent AI pipeline (preprocess, segment, refine edges, specialist routing, quality validation, fallback, and postprocess) delivers crisp, clean lines on every cutout. Specialized sub-engines like GemPerfect Engine™ handle jewelry and reflective surfaces, while ThreadLogic™ masters fabric and apparel edges. No halos. No artifacts. Just pixel-perfect results.</p>
			</div>
		</div>

		<div class="feature-row reverse" use:animateOnScroll>
			<div class="feature-visual">
				<img src="/landing-images/feature-lifestyle.webp" alt="Handmade soy candle in glass jar on rustic wood shelf with eucalyptus and warm golden hour lighting — AI-generated lifestyle scene" width="800" height="600" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md);">
			</div>
			<div class="feature-text">
				<h3>AI-Generated Lifestyle Scenes</h3>
				<p>After CleanEdge Intelligence™ removes your background, place your product in styled scenes that tell a story. Rustic wood tables, marble countertops, garden settings — choose from dozens of AI-generated environments powered by Google Imagen.</p>
			</div>
		</div>

	</div>
</section>

<!-- === VIBES MARKETPLACE & ROYALTIES === -->
<section class="vibes-section section-pad cv-auto" id="vibes">
	<div class="container">
		<div class="vibes-header text-center" use:animateOnScroll>
			<h2><ABTest experiment="landing-vibes-headline" let:value>{value || 'Create a Vibe. Share It. Earn Free Credits.'}</ABTest></h2>
			<p>SwiftList isn't just a tool — it's a creative marketplace. Design your signature product photography style once, publish it as a Vibe preset, and earn Sparks (free credits) every time another seller applies it to their listings.</p>
		</div>

		<!-- Farmhouse Vibe Showcase -->
		<div class="vibes-showcase" use:animateOnScroll>
			<div class="vibes-showcase-img">
				<img src="/landing-images/preset-farmhouse-vibe.webp" alt="Artisan ceramic bowl on weathered farmhouse table with dried lavender and linen napkin — Farmhouse Finds preset vibe applied by SwiftList AI" width="800" height="600" loading="lazy">
			</div>
			<div class="vibes-showcase-text">
				<h3>One Vibe. Infinite Products.</h3>
				<p>This is <strong>Farmhouse Finds</strong> — one of our trending Vibes. A seller designed this warm, rustic aesthetic once: the weathered wood surface, the linen textures, the golden window light. Now any seller can apply it to <em>their</em> products in one click.</p>
				<p>Every time someone uses Farmhouse Finds, the creator earns free credits. The more popular your Vibe, the more you earn.</p>
				<div style="margin-top:16px;">
					<span class="vibe-tag">Farmhouse Finds</span>
					<span class="vibe-tag">Cottagecore Romance</span>
					<span class="vibe-tag">Minimalist Luxe</span>
					<span class="vibe-tag">Y2K Revival</span>
					<span class="vibe-tag">Coastal Seaglass</span>
					<span class="vibe-tag">Gothic Luxe</span>
				</div>
			</div>
		</div>

		<!-- Same Product, 6 Vibes -->
		<div class="vibes-showcase" use:animateOnScroll style="margin-bottom:64px;">
			<div class="vibes-showcase-text" style="order:1;">
				<h3>Same Product. Six Different Aesthetics.</h3>
				<p>Browse the Vibes marketplace to find the look that matches your brand. Warm farmhouse? Moody dark marble? Minimalist studio? Bohemian rattan? Apply any community-created Vibe to your entire catalog with a single click.</p>
				<p>Vibes aren't just filters — they define lighting, surfaces, props, composition, and mood. Each one is a complete photography direction built by sellers who understand what converts.</p>
			</div>
			<div class="vibes-showcase-img" style="order:2;">
				<img src="/landing-images/preset-vibe-grid.webp" alt="Same ceramic mug shown in 6 different Vibe presets — warm farmhouse, bohemian rattan, minimalist studio, coastal sand, dark moody marble, and mid-century terrazzo" width="800" height="600" loading="lazy">
			</div>
		</div>

		<!-- Royalties Block -->
		<div class="royalties-block" use:animateOnScroll>
			<div class="royalties-badge">
				<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M5.5 8.5L8 11l2.5-2.5"/></svg>
				Earn While You Create
			</div>
			<h3>Your Vibe = Your Sparks</h3>
			<p>Every Vibe you publish to the marketplace works for you around the clock. When other sellers use your preset, you earn Sparks (free credits) automatically — no extra work, no negotiations, no invoicing.</p>
			<div class="royalties-flow">
				<div class="royalty-step">
					<div class="royalty-step-num">1</div>
					<h4>Design Your Vibe</h4>
					<p>Style a product photo exactly how you want it — surfaces, lighting, props, mood. Save it as a Vibe preset.</p>
				</div>
				<div class="royalty-step">
					<div class="royalty-step-num">2</div>
					<h4>Publish to Marketplace</h4>
					<p>Share your Vibe with the SwiftList community. Other sellers discover and apply it to their products.</p>
				</div>
				<div class="royalty-step">
					<div class="royalty-step-num">3</div>
					<h4>Earn Credits Automatically</h4>
					<p>Every use earns you free credits. Popular Vibes can generate enough credits to cover your entire subscription.</p>
				</div>
			</div>
			<div class="royalties-cta">
				<p>The best sellers don't just use SwiftList — they shape how everyone's products look.</p>
			</div>
		</div>
	</div>
</section>

<!-- === PRICING === -->
<section class="section-pad cv-auto" id="pricing">
	<div class="container">
		<div class="text-center" style="margin-bottom:24px;">
			<h2 use:animateOnScroll>Simple, Honest Pricing</h2>
			<p class="section-subtitle" use:animateOnScroll>Start free with 100 credits. Upgrade as you grow. No hidden fees.</p>
		</div>
		<div style="height:32px"></div>
		<div class="text-center" use:animateOnScroll>
			<a href="/pricing" class="btn btn-primary btn-lg">View Plans &amp; Pricing</a>
		</div>
		<p class="pricing-note" style="margin-top:20px;">No credit card required for free tier. 14-day free trial on paid plans.</p>
		<div class="guarantee-badge">
			<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 1l2.47 5.55L18 7.24l-4 4.13L15 18 10 15.05 5 18l1-6.63-4-4.13 5.53-.69z"/></svg>
			30-day money-back guarantee
		</div>
	</div>
</section>

<!-- === TOP 10 LIST === -->
<section class="section-pad cv-auto" style="background:var(--gray-50);">
	<div class="container" style="display:flex; flex-direction:column; align-items:center;">
		<h2 use:animateOnScroll style="font-size:1.75rem; margin-bottom:32px; text-align:center;"><ABTest experiment="landing-top10-headline" let:value>{value || 'The Top 10 Time-Saving Things You Can Do With SwiftList:'}</ABTest></h2>
		<ol class="top10-list">
			<li><span class="top10-num">1.</span><span>Upload one product image, create output images sized for 6+ marketplaces <em>(every marketplace has different size requirements)</em></span></li>
			<li><span class="top10-num">2.</span><span>Remove the background from your image using best-in-class CleanEdge Intelligence™ <em>(GemPerfect™ Engine is auto-applied to jewelry, and ThreadLogic™ is auto-applied to fashion items)</em></span></li>
			<li><span class="top10-num">3.</span><span>Stylize the background using AI. Just tell it what you want the background to look like…it can be anything!</span></li>
			<li><span class="top10-num">4.</span><span>Browse the library of preset Vibes and apply their styling to your image.</span></li>
			<li><span class="top10-num">5.</span><span>Create your own preset Vibes you can use over and over.</span></li>
			<li><span class="top10-num">6.</span><span>Use other people's Vibes. And if anyone uses your Vibes, you earn <strong>Sparks</strong> — aka free credits.</span></li>
			<li><span class="top10-num">7.</span><span>Upload and apply a style reference to your image.</span></li>
			<li><span class="top10-num">8.</span><span>Apply a wide range of AI-modifications to your image.</span></li>
			<li><span class="top10-num">9.</span><span>See analytics in your account showing how many times your Vibes have been used and which ones are the most popular.</span></li>
			<li class="no-border"><span class="top10-num">10.</span><span>Save time creating product descriptions. Our AI analyzer knows what you upload and can write a product description for you.</span></li>
		</ol>
	</div>
</section>

<!-- === FINAL CTA === -->
<section class="cta-section section-pad">
	<div class="container text-center">
		<h2 use:animateOnScroll><ABTest experiment="landing-final-cta-headline" let:value>{value || 'Ready to Transform Your Product Photos?'}</ABTest></h2>
		<p use:animateOnScroll>Upload one photo. Get marketplace-ready images for Etsy, Shopify, Amazon, eBay, Poshmark, and Facebook — in seconds.</p>
		<a href="/auth/signup" class="btn btn-white" use:animateOnScroll><ABTest experiment="landing-final-cta-button" let:value>{value || 'Get Started Free'}</ABTest></a>
		<p class="cta-sub" use:animateOnScroll>No credit card required. Set up in 30 seconds.</p>
	</div>
</section>

</main>

<!-- === FOOTER === -->
<footer class="footer">
	<div class="container">
		<div class="footer-grid">
			<div class="footer-brand">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 220 600 140" style="height:28px;width:auto;">
					<path fill="#ffffff" d="M144.78,345.65c-8.16,0-15.25-1.25-21.29-3.76-6.04-2.5-10.74-6.22-14.12-11.14-3.37-4.92-5.15-10.98-5.33-18.18h20.3c.27,3.42,1.3,6.28,3.08,8.58,1.78,2.3,4.15,4.02,7.11,5.16,2.96,1.14,6.31,1.71,10.05,1.71s6.98-.54,9.74-1.61c2.76-1.07,4.91-2.59,6.46-4.55,1.55-1.96,2.32-4.24,2.32-6.84,0-2.32-.7-4.27-2.08-5.84-1.39-1.57-3.38-2.93-5.98-4.07-2.6-1.14-5.77-2.14-9.5-3.01l-11.21-2.8c-8.61-2.1-15.36-5.39-20.23-9.88-4.88-4.49-7.31-10.42-7.31-17.81,0-6.15,1.65-11.53,4.96-16.13,3.3-4.6,7.84-8.18,13.6-10.73,5.76-2.55,12.34-3.83,19.72-3.83s14.08,1.29,19.69,3.86c5.61,2.58,9.98,6.15,13.12,10.73,3.14,4.58,4.76,9.85,4.85,15.82h-20.16c-.37-4.1-2.11-7.27-5.23-9.5-3.12-2.23-7.28-3.35-12.48-3.35-3.51,0-6.52.5-9.02,1.5-2.51,1-4.41,2.39-5.71,4.17-1.3,1.78-1.95,3.81-1.95,6.08,0,2.51.75,4.59,2.26,6.25,1.5,1.66,3.51,3.01,6.02,4.03,2.51,1.03,5.17,1.88,8,2.56l9.23,2.26c4.28.96,8.27,2.26,11.96,3.9,3.69,1.64,6.93,3.66,9.71,6.05,2.78,2.39,4.93,5.23,6.46,8.51,1.53,3.28,2.29,7.06,2.29,11.35,0,6.15-1.55,11.52-4.65,16.1-3.1,4.58-7.59,8.12-13.47,10.63-5.88,2.51-12.94,3.76-21.19,3.76Z"/>
					<path fill="#ffffff" d="M214.57,344.14l-22.56-76.42h21.53l6.63,28.23c1.14,5.06,2.37,10.56,3.69,16.51,1.32,5.95,2.53,12.52,3.62,19.72h-2.32c1.18-7.02,2.48-13.52,3.9-19.51,1.41-5.99,2.73-11.56,3.96-16.71l6.97-28.23h18.87l6.84,28.23c1.14,5.15,2.42,10.7,3.83,16.65,1.41,5.95,2.73,12.47,3.96,19.58h-2.32c1.09-7.06,2.27-13.57,3.52-19.51,1.25-5.95,2.47-11.52,3.66-16.71l6.63-28.23h21.81l-22.69,76.42h-20.85l-8.48-29.46c-.82-2.96-1.64-6.23-2.46-9.81-.82-3.58-1.62-7.22-2.39-10.94-.78-3.71-1.57-7.19-2.39-10.42h3.62c-.78,3.24-1.56,6.71-2.36,10.42-.8,3.71-1.61,7.37-2.43,10.97-.82,3.6-1.64,6.86-2.46,9.77l-8.48,29.46h-20.85Z"/>
					<path fill="#ffffff" d="M327.91,257.74c-3.1,0-5.74-1.02-7.93-3.08-2.19-2.05-3.28-4.53-3.28-7.45s1.09-5.4,3.28-7.45c2.19-2.05,4.83-3.08,7.93-3.08s5.75,1.03,7.96,3.08c2.21,2.05,3.32,4.53,3.32,7.45s-1.11,5.4-3.32,7.45c-2.21,2.05-4.86,3.08-7.96,3.08ZM317.65,344.14v-76.42h20.51v76.42h-20.51Z"/>
					<path fill="#ffffff" d="M395.11,267.72l-4,15.65h-44.9l4-15.65h44.9ZM361.67,344.14v-82.3c0-5.42,1.08-9.93,3.25-13.53,2.16-3.6,5.12-6.3,8.85-8.1,3.74-1.8,7.97-2.7,12.71-2.7,3.24,0,6.19.26,8.85.79,2.67.52,5.53,1.23,6.76,1.59l-3.87,15.37c-.87-.23-2.62-.64-3.78-.87-1.16-.23-2.43-.34-3.79-.34-3.1,0-5.3.74-6.6,2.22-1.3,1.48-1.95,3.57-1.95,6.25v81.62h-20.44Z"/>
					<path fill="#ffffff" d="M446.7,267.72l-4,15.65h-46.32l4-15.65h46.32ZM409.91,242.54h20.51v79.25c0,2.42.54,4.2,1.61,5.37,1.07,1.16,2.86,1.74,5.37,1.74.78,0,1.87-.1,3.28-.31s2.48-.4,3.21-.58l2.94,15.38c-2.28.68-4.54,1.16-6.8,1.44s-4.41.41-6.46.41c-7.65,0-13.51-1.87-17.57-5.6-4.06-3.74-6.08-9.09-6.08-16.06v-81.03Z"/>
					<path fill="#ffffff" d="M457.85,344.14v-101.85h20.85v84.55h43.95v17.29h-64.8Z"/>
					<path fill="#ffffff" d="M541.78,257.74c-3.1,0-5.74-1.02-7.93-3.08s-3.28-4.53-3.28-7.45,1.09-5.4,3.28-7.45,4.83-3.08,7.93-3.08,5.75,1.03,7.96,3.08c2.21,2.05,3.31,4.53,3.31,7.45s-1.11,5.4-3.31,7.45c-2.21,2.05-4.87,3.08-7.96,3.08ZM531.53,344.14v-76.42h20.51v76.42h-20.51Z"/>
					<path fill="#ffffff" d="M594.81,345.65c-6.15,0-11.6-.88-16.34-2.63-4.74-1.75-8.61-4.31-11.62-7.66s-4.95-7.39-5.81-12.13l19.07-3.28c1,3.55,2.76,6.22,5.26,8,2.51,1.78,5.85,2.67,10.05,2.67,3.92,0,7.01-.74,9.26-2.22,2.26-1.48,3.38-3.36,3.38-5.64,0-2-.81-3.65-2.43-4.92-1.62-1.28-4.09-2.26-7.42-2.94l-13.19-2.73c-7.38-1.5-12.9-4.07-16.54-7.69s-5.47-8.28-5.47-13.98c0-4.92,1.34-9.15,4.03-12.68,2.69-3.53,6.43-6.25,11.21-8.17,4.79-1.91,10.41-2.87,16.88-2.87,6.02,0,11.23.83,15.65,2.5,4.42,1.66,8,4.02,10.73,7.07,2.73,3.05,4.56,6.65,5.47,10.8l-18.18,3.21c-.78-2.6-2.27-4.73-4.48-6.39-2.21-1.66-5.19-2.5-8.92-2.5-3.37,0-6.2.71-8.47,2.12-2.28,1.41-3.42,3.3-3.42,5.67,0,1.91.74,3.53,2.22,4.85,1.48,1.32,4.02,2.35,7.62,3.08l13.74,2.73c7.38,1.5,12.87,3.95,16.47,7.35,3.6,3.4,5.4,7.83,5.4,13.29,0,5.01-1.46,9.4-4.38,13.16s-6.94,6.69-12.06,8.78c-5.13,2.1-11.04,3.14-17.74,3.14Z"/>
					<path fill="#ffffff" d="M679.8,267.72v15.65h-45.32v-15.65h45.32ZM645.01,242.54h20.51v79.25c0,2.42.54,4.2,1.61,5.37,1.07,1.16,2.86,1.74,5.37,1.74.78,0,1.87-.1,3.28-.31s2.48-.4,3.21-.58l2.94,15.38c-2.28.68-4.54,1.16-6.8,1.44s-4.41.41-6.46.41c-7.65,0-13.51-1.87-17.57-5.6-4.06-3.74-6.08-9.09-6.08-16.06v-81.03Z"/>
				</svg>
				<p>Upload once. Publish everywhere.</p>
			</div>
			<div class="footer-col">
				<h4>Product</h4>
				<a href="#features">Features</a>
				<a href="/pricing">Pricing</a>
				<a href="/presets">Presets</a>
			</div>
			<div class="footer-col">
				<h4>Resources</h4>
				<span style="cursor:default;">Help Center (coming soon)</span>
				<a href="/faq">FAQ</a>
			</div>
			<div class="footer-col">
				<h4>Company</h4>
				<a href="/privacy">Privacy</a>
				<a href="/terms">Terms</a>
			</div>
		</div>
		<div class="footer-bottom">
			<span>&copy; 2026 SwiftList. All rights reserved.</span>
			<div class="footer-links">
				<a href="/privacy">Privacy Policy</a>
				<a href="/terms">Terms of Service</a>
			</div>
			<div class="footer-social">
				<a href="https://x.com/SwiftList_Scout" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
				</a>
				<a href="https://instagram.com/SwiftList-Scout" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
				</a>
			</div>
		</div>
	</div>
</footer>

<style>
/* === RESET & BASE === */
:global(body) { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow-x: hidden; }

/* === DESIGN TOKENS === */
:root {
	--teal: #26766c;
	--teal-dark: #1d5c54;
	--teal-light: #f0f7f6;
	--teal-hover: #1f635a;
	--charcoal: #231f20;
	--gray-50: #f9fafb;
	--gray-100: #f3f4f6;
	--gray-200: #e5e7eb;
	--gray-300: #d1d5db;
	--gray-400: #9ca3af;
	--gray-500: #6b7280;
	--gray-600: #4b5563;
	--white: #ffffff;
	--shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
	--shadow-md: 0 4px 16px rgba(0,0,0,0.08);
	--shadow-lg: 0 10px 40px rgba(0,0,0,0.1);
	--radius-sm: 8px;
	--radius-md: 12px;
	--radius-lg: 24px;
	--max-w: 1200px;
	--font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
	--font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* === TYPOGRAPHY === */
h1, h2, h3, h4 { font-family: var(--font-display); color: var(--charcoal); line-height: 1.2; }
h1 { font-size: 2.25rem; font-weight: 400; }
h2 { font-size: 1.75rem; font-weight: 400; }
h3 { font-size: 1.25rem; font-weight: 400; }
p { color: var(--gray-600); }
@media (min-width: 768px) {
	h1 { font-size: 3.5rem; }
	h2 { font-size: 2.5rem; }
	h3 { font-size: 1.5rem; }
}

/* === UTILITY === */
.container { width: 100%; max-width: var(--max-w); margin: 0 auto; padding: 0 16px; }
@media (min-width: 768px) { .container { padding: 0 24px; } }
.section-pad { padding: 48px 0; }
@media (min-width: 768px) { .section-pad { padding: 96px 0; } }
.text-center { text-align: center; }
.section-subtitle { font-size: 1rem; color: var(--gray-500); max-width: 640px; margin: 16px auto 0; line-height: 1.7; }
@media (min-width: 768px) { .section-subtitle { font-size: 1.125rem; } }

/* === BUTTONS === */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; border-radius: var(--radius-sm); transition: all 0.2s ease; font-size: 0.9375rem; text-decoration: none; }
.btn-primary { background: var(--teal); color: var(--white); padding: 12px 24px; }
.btn-primary:hover { background: var(--teal-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(38,118,108,0.3); }
.btn-lg { padding: 16px 32px; font-size: 1.0625rem; border-radius: var(--radius-sm); }
.btn-outline { border: 2px solid var(--teal); color: var(--teal); padding: 10px 22px; }
.btn-outline:hover { background: var(--teal); color: var(--white); }
.btn-white { background: var(--white); color: var(--teal); padding: 16px 32px; font-size: 1.0625rem; border-radius: var(--radius-sm); font-weight: 700; text-decoration: none; }
.btn-white:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }

/* === ANIMATIONS === */
@keyframes float {
	0%, 100% { transform: translateY(0); }
	50% { transform: translateY(-12px); }
}
.animate-on-scroll { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
:global(.animate-on-scroll.visible) { opacity: 1; transform: translateY(0); }

/* === NAVIGATION === */
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: box-shadow 0.3s ease; }
.nav.scrolled { box-shadow: 0 1px 8px rgba(0,0,0,0.08); }
.nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
@media (min-width: 768px) { .nav-inner { height: 72px; } }
.nav-logo img { height: 36px; width: auto; }
@media (min-width: 768px) { .nav-logo img { height: 40px; } }
.nav-links { display: none; gap: 32px; align-items: center; }
@media (min-width: 768px) { .nav-links { display: flex; } }
.nav-links a { font-size: 0.9375rem; font-weight: 500; color: var(--gray-600); transition: color 0.2s; text-decoration: none; }
.nav-links a:hover { color: var(--teal); }
.nav-cta { display: none; }
@media (min-width: 768px) { .nav-cta { display: inline-flex; } }
.hamburger { display: flex; flex-direction: column; gap: 5px; padding: 8px; cursor: pointer; border: none; background: none; }
@media (min-width: 768px) { .hamburger { display: none; } }
.hamburger span { display: block; width: 22px; height: 2px; background: var(--charcoal); border-radius: 2px; transition: all 0.3s ease; }
.hamburger.active span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
.hamburger.active span:nth-child(2) { opacity: 0; }
.hamburger.active span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }
.mobile-menu { display: none; position: fixed; top: 64px; left: 0; right: 0; background: var(--white); padding: 24px; box-shadow: var(--shadow-lg); z-index: 999; }
.mobile-menu.open { display: block; }
.mobile-menu a { display: block; padding: 12px 0; font-size: 1.0625rem; font-weight: 500; color: var(--gray-600); border-bottom: 1px solid var(--gray-100); text-decoration: none; }
.mobile-menu a:last-child { border-bottom: none; }

/* === HERO === */
.hero { padding: 104px 0 48px; background: linear-gradient(180deg, var(--white) 0%, var(--gray-50) 100%); }
@media (min-width: 768px) { .hero { padding: 140px 0 80px; } }
.hero-grid { display: grid; grid-template-columns: 1fr; gap: 48px; align-items: center; }
@media (min-width: 1024px) { .hero-grid { grid-template-columns: 1fr 1fr; gap: 64px; } }
.hero-text h1 { margin-bottom: 16px; }
@media (min-width: 768px) { .hero-text h1 { margin-bottom: 24px; } }
.hero-text p { font-size: 1rem; line-height: 1.7; color: var(--gray-500); margin-bottom: 32px; max-width: 540px; }
@media (min-width: 768px) { .hero-text p { font-size: 1.125rem; } }
.hero-actions { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
@media (min-width: 640px) { .hero-actions { flex-direction: row; align-items: center; } }
.hero-link { color: var(--teal); font-weight: 600; font-size: 0.9375rem; display: inline-flex; align-items: center; gap: 6px; transition: gap 0.2s; text-decoration: none; }
.hero-link:hover { gap: 10px; }
.hero-visual { position: relative; display: flex; justify-content: center; }

/* Trust Bar */
.trust-bar { margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--gray-200); }
@media (min-width: 768px) { .trust-bar { margin-top: 64px; padding-top: 40px; } }
.trust-bar p { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-400); font-weight: 600; margin-bottom: 20px; text-align: center; }
.trust-logos { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 24px; }
@media (min-width: 768px) { .trust-logos { gap: 40px; } }
.trust-logo { opacity: 0.7; transition: opacity 0.2s; object-fit: contain; }
.trust-logo:hover { opacity: 1; }
.trust-logo-icon { height: 28px; width: 28px; }
.trust-logo-icon.trust-logo-sm { height: 20px; width: 20px; }
.trust-logo-wide { height: 20px; width: auto; max-width: 100px; }
@media (min-width: 768px) { .trust-logo-icon { height: 32px; width: 32px; } .trust-logo-icon.trust-logo-sm { height: 24px; width: 24px; } .trust-logo-wide { height: 24px; max-width: 120px; } }

/* === TOP 10 === */
.top10-list { list-style: none; padding: 0; max-width: 760px; width: 100%; }
.top10-list li { display: flex; gap: 20px; padding: 14px 0; border-bottom: 1px solid #e5e7eb; align-items: flex-start; }
.top10-list li.no-border { border-bottom: none; }
.top10-num { color: var(--teal); font-weight: 700; font-size: 1rem; min-width: 28px; padding-top: 1px; }
.top10-list li span:last-child { color: #374151; font-size: 1.125rem; line-height: 1.6; }

/* === TESTIMONIAL === */
.testimonial-section { background: var(--teal-light); }
.testimonial-card { max-width: 720px; margin: 0 auto; text-align: center; }
.testimonial-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; margin: 0 auto 24px; display: block; }
.testimonial-quote { font-family: var(--font-display); font-size: 1.125rem; line-height: 1.7; color: var(--charcoal); font-style: italic; font-weight: 400; margin: 0 0 20px; }
@media (min-width: 768px) { .testimonial-quote { font-size: 1.375rem; } }
.testimonial-author { display: block; font-family: var(--font-body); font-size: 1rem; font-weight: 700; color: var(--charcoal); font-style: normal; }
.testimonial-role { display: block; font-size: 0.875rem; color: var(--gray-500); margin-top: 2px; }

/* === RING PIPELINE === */
.ring-pipeline { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 960px; margin: 0 auto; }
@media (min-width: 768px) { .ring-pipeline { grid-template-columns: repeat(4, 1fr); gap: 20px; } }
.ring-step { position: relative; border-radius: var(--radius-md); overflow: hidden; aspect-ratio: 1/1; background: var(--gray-100); box-shadow: var(--shadow-md); transition: transform 0.3s ease, box-shadow 0.3s ease; }
.ring-step:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
.ring-step img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ring-step-label { position: absolute; bottom: 0; left: 0; right: 0; padding: 36px 12px 12px; background: linear-gradient(transparent, rgba(0,0,0,0.72)); pointer-events: none; }
.ring-step-num { display: block; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.7); margin-bottom: 2px; }
.ring-step-name { display: block; font-size: 0.8125rem; font-weight: 600; color: white; line-height: 1.3; }
.ring-step.step-final { outline: none; }
.ring-step.step-final .ring-step-label { background: linear-gradient(transparent, rgba(38,118,108,0.88)); }
.ring-pipeline-cta { text-align: center; margin-top: 40px; }
.ring-pipeline-cta p { font-size: 0.9375rem; color: var(--gray-500); margin-bottom: 20px; }

/* === HOW IT WORKS === */
.steps-grid { display: grid; grid-template-columns: 1fr; gap: 24px; position: relative; }
@media (min-width: 768px) { .steps-grid { grid-template-columns: repeat(3, 1fr); gap: 32px; } }
.step-connector { display: none; }
@media (min-width: 768px) { .step-connector { display: block; position: absolute; top: 60px; left: calc(33.33% + 16px); right: calc(33.33% + 16px); height: 2px; background: linear-gradient(90deg, var(--teal) 0%, var(--gray-200) 50%, var(--teal) 100%); z-index: 0; } }
.step-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 32px 24px; text-align: center; transition: all 0.3s ease; position: relative; z-index: 1; }
.step-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: transparent; }
.step-number { width: 48px; height: 48px; border-radius: 50%; background: var(--teal-light); color: var(--teal); font-family: var(--font-display); font-weight: 700; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
.step-icon { width: 48px; height: 48px; margin: 0 auto 16px; color: var(--teal); }
.step-card h3 { margin-bottom: 12px; }
.step-card p { font-size: 0.9375rem; line-height: 1.6; }

/* === AI FEATURES === */
.feature-row { display: grid; grid-template-columns: 1fr; gap: 32px; align-items: center; margin-bottom: 48px; }
@media (min-width: 768px) { .feature-row { grid-template-columns: 1fr 1fr; gap: 64px; margin-bottom: 80px; } }
.feature-row:last-child { margin-bottom: 0; }
.feature-row.reverse .feature-visual { order: -1; }
@media (min-width: 768px) { .feature-row.reverse .feature-visual { order: 1; } }
.feature-text h3 { font-size: 1.375rem; margin-bottom: 16px; color: var(--charcoal); }
@media (min-width: 768px) { .feature-text h3 { font-size: 1.75rem; } }
.feature-text p { font-size: 1rem; line-height: 1.7; }
.feature-visual { border-radius: var(--radius-md); overflow: hidden; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; }
.feature-visual img { border-radius: var(--radius-md); box-shadow: var(--shadow-md); }

/* === USE CASES === */
.usecases-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 768px) { .usecases-grid { grid-template-columns: repeat(2, 1fr); gap: 24px; } }
.usecase-card { background: var(--white); border: 1px solid var(--gray-200); border-left: 4px solid var(--teal); border-radius: var(--radius-md); padding: 24px; transition: all 0.3s ease; }
@media (min-width: 768px) { .usecase-card { padding: 32px; } }
.usecase-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
.usecase-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); background: var(--teal-light); color: var(--teal); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.usecase-card h3 { margin-bottom: 8px; font-size: 1.125rem; }
.usecase-card p { font-size: 0.9375rem; line-height: 1.6; }

/* === VIBES MARKETPLACE === */
.vibes-section { background: var(--gray-50); overflow: hidden; }
.vibes-header { max-width: 720px; margin: 0 auto 48px; }
@media (min-width: 768px) { .vibes-header { margin-bottom: 64px; } }
.vibes-eyebrow { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, rgba(38,118,108,0.1) 0%, rgba(38,118,108,0.05) 100%); color: var(--teal); font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 6px 16px; border-radius: var(--radius-lg); margin-bottom: 20px; }
.vibes-eyebrow svg { width: 16px; height: 16px; }
.vibes-header h2 { margin-bottom: 16px; }
.vibes-header p { font-size: 1.0625rem; line-height: 1.7; }
.vibes-showcase { display: grid; grid-template-columns: 1fr; gap: 32px; margin-bottom: 64px; }
@media (min-width: 768px) { .vibes-showcase { grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; } }
.vibes-showcase-img { border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-lg); }
.vibes-showcase-img img { width: 100%; height: auto; display: block; }
.vibes-showcase-text h3 { font-size: 1.375rem; margin-bottom: 12px; color: var(--charcoal); }
@media (min-width: 768px) { .vibes-showcase-text h3 { font-size: 1.75rem; } }
.vibes-showcase-text p { font-size: 1rem; line-height: 1.7; margin-bottom: 16px; }
.vibe-tag { display: inline-flex; align-items: center; gap: 6px; background: var(--teal-light); color: var(--teal); font-size: 0.8125rem; font-weight: 600; padding: 4px 12px; border-radius: var(--radius-lg); margin-right: 8px; margin-bottom: 8px; }

/* === ROYALTIES === */
.royalties-block { background: var(--white); border: 2px solid var(--teal); border-radius: var(--radius-md); padding: 32px 24px; max-width: 800px; margin: 0 auto; position: relative; }
@media (min-width: 768px) { .royalties-block { padding: 48px; } }
.royalties-badge { position: absolute; top: -14px; left: 24px; background: var(--teal); color: var(--white); font-size: 0.75rem; font-weight: 700; padding: 4px 16px; border-radius: var(--radius-lg); display: flex; align-items: center; gap: 6px; }
@media (min-width: 768px) { .royalties-badge { left: 48px; } }
.royalties-badge svg { width: 14px; height: 14px; }
.royalties-block h3 { font-size: 1.375rem; margin-bottom: 8px; color: var(--charcoal); }
@media (min-width: 768px) { .royalties-block h3 { font-size: 1.75rem; } }
.royalties-block > p { font-size: 1rem; line-height: 1.7; margin-bottom: 24px; }
.royalties-flow { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 640px) { .royalties-flow { grid-template-columns: repeat(3, 1fr); gap: 12px; } }
.royalty-step { background: var(--gray-50); border-radius: var(--radius-sm); padding: 20px 16px; text-align: center; }
.royalty-step-num { width: 36px; height: 36px; border-radius: 50%; background: var(--teal); color: var(--white); font-family: var(--font-display); font-weight: 700; font-size: 1rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
.royalty-step h4 { font-family: var(--font-body); font-size: 0.9375rem; font-weight: 700; color: var(--charcoal); margin-bottom: 4px; }
.royalty-step p { font-size: 0.8125rem; line-height: 1.5; color: var(--gray-500); }
.royalties-cta { margin-top: 24px; text-align: center; }
.royalties-cta p { font-size: 0.9375rem; font-weight: 600; color: var(--teal); }

/* === PRICING === */
.pricing-note { text-align: center; margin-top: 32px; font-size: 0.875rem; color: var(--gray-400); }
.guarantee-badge { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; font-size: 0.8125rem; color: var(--gray-500); font-weight: 500; }
.guarantee-badge svg { width: 18px; height: 18px; color: var(--teal); }

/* === CTA SECTION === */
.cta-section { background: linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%); color: var(--white); text-align: center; }
.cta-section h2 { color: var(--white); margin-bottom: 16px; }
.cta-section p { color: rgba(255,255,255,0.85); margin-bottom: 32px; font-size: 1.0625rem; }
.cta-sub { font-size: 0.875rem !important; color: rgba(255,255,255,0.6) !important; margin-top: 16px !important; margin-bottom: 0 !important; }

/* === FOOTER === */
.footer { background: var(--charcoal); color: rgba(255,255,255,0.7); padding: 48px 0 24px; }
@media (min-width: 768px) { .footer { padding: 64px 0 24px; } }
.footer-grid { display: grid; grid-template-columns: 1fr; gap: 32px; margin-bottom: 40px; }
@media (min-width: 768px) { .footer-grid { grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; } }
.footer-brand p { font-size: 0.875rem; margin-top: 16px; line-height: 1.6; }
.footer-brand svg { height: 28px; width: auto; }
.footer-col h4 { font-family: var(--font-body); font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.4); margin-bottom: 16px; }
.footer-col a { display: block; font-size: 0.875rem; padding: 4px 0; transition: color 0.2s; text-decoration: none; color: rgba(255,255,255,0.7); }
.footer-col a:hover { color: var(--white); }
.footer-bottom { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px; display: flex; flex-direction: column; gap: 16px; align-items: center; text-align: center; font-size: 0.8125rem; }
@media (min-width: 768px) { .footer-bottom { flex-direction: row; justify-content: space-between; text-align: left; } }
.footer-links { display: flex; gap: 24px; }
.footer-links a { text-decoration: none; color: rgba(255,255,255,0.7); }
.footer-links a:hover { color: var(--white); }
.footer-social { display: flex; gap: 12px; }
.footer-social a { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.6); transition: all 0.2s; text-decoration: none; }
.footer-social a:hover { background: var(--teal); color: var(--white); }

/* === CONTENT VISIBILITY === */
.cv-auto { content-visibility: auto; contain-intrinsic-size: auto 600px; }

/* === HERO WIPE REVEAL === */
.wipe-reveal { position: relative; border-radius: var(--radius-md); overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.18); aspect-ratio: 1/1; cursor: ew-resize; user-select: none; width: 100%; max-width: 520px; margin: 0 auto; touch-action: none; }
.wipe-before-img { display: block; width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; pointer-events: none; }
.wipe-after-layer { position: absolute; top: 0; bottom: 0; left: 0; right: 0; will-change: clip-path; }
.wipe-after-layer img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; position: absolute; top: 0; left: 0; }
.wipe-handle { position: absolute; top: 0; bottom: 0; width: 0; z-index: 10; will-change: left; }
.wipe-handle::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: rgba(255,255,255,0.95); box-shadow: 0 0 10px rgba(0,0,0,0.35); transform: translateX(-50%); }
.wipe-circle { position: absolute; top: 50%; left: 0; transform: translate(-50%, -50%); width: 46px; height: 46px; border-radius: 50%; background: white; box-shadow: 0 2px 16px rgba(0,0,0,0.22); display: flex; align-items: center; justify-content: center; }
.wipe-circle svg { width: 20px; height: 20px; }
.wipe-label-before, .wipe-label-after { position: absolute; top: 14px; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 5px 12px; border-radius: 4px; pointer-events: none; z-index: 9; opacity: 1; transition: opacity 0.2s ease; }
.wipe-label-before { left: 14px; background: rgba(255,255,255,0.92); color: var(--gray-500); }
.wipe-label-after { right: 14px; background: var(--teal); color: white; }
.wipe-label-hidden { opacity: 0; }
</style>
