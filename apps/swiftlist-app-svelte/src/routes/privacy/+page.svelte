<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import Logo from '$lib/components/Logo.svelte';
</script>

<svelte:head>
	<title>Privacy Policy - SwiftList</title>
	<meta name="description" content="SwiftList Privacy Policy. How we handle your data, product images, and personal information on our AI photography platform." />
</svelte:head>

<div class="min-h-screen bg-[#F8F5F0]">
	<!-- Header -->
	<header class="border-b border-gray-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<a href="/" class="flex items-center group transition-transform duration-300 group-hover:scale-105">
					<Logo size={28} />
				</a>
				<div class="flex items-center gap-4">
					<a href="/auth/login" class="text-sm font-medium text-[#4B5563] hover:text-[#2C3E50] transition-colors">
						Sign In
					</a>
					<Button variant="primary" onclick={() => goto('/auth/signup')}>
						Get Started
					</Button>
				</div>
			</div>
		</div>
	</header>

	<!-- Content -->
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
		<h1 class="text-5xl font-bold text-[#2C3E50] mb-4">Privacy Policy</h1>
		<p class="text-[#4B5563] mb-8">Effective Date: February 24, 2026</p>

		<div class="prose prose-lg max-w-none text-[#2C3E50] space-y-8">
			<section>
				<h2 class="text-2xl font-bold mb-4">1. Introduction</h2>
				<p class="text-[#4B5563] leading-relaxed">
					Welcome to SwiftList ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered image processing platform ("the Service").
				</p>
				<p class="text-[#4B5563] leading-relaxed mt-4">
					By using SwiftList, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, please do not use our Service.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">2. Information We Collect</h2>

				<h3 class="text-xl font-semibold mb-3 mt-4">2.1 Personal Information</h3>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					When you register for an account, we collect:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li>Email address</li>
					<li>Display name</li>
					<li>Account credentials (securely hashed)</li>
					<li>Google OAuth profile information (if you sign in with Google)</li>
					<li>Payment information (processed securely through Stripe—we do not store credit card numbers)</li>
				</ul>

				<h3 class="text-xl font-semibold mb-3 mt-6">2.2 User-Generated Content</h3>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					When you use our AI tools, we collect:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li>Images you upload for processing</li>
					<li>AI-generated outputs and processed files</li>
					<li>Vibes you create and publish</li>
					<li>Custom AI prompts and settings</li>
				</ul>

				<h3 class="text-xl font-semibold mb-3 mt-6">2.3 Marketplace and Creator Economy Data</h3>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					When you participate in the Vibe Marketplace, we collect:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li>Vibes you publish and their associated AI prompt configurations</li>
					<li>Vibe usage counts for Sparks calculations</li>
					<li>Sparks balance and transaction history (earned and spent)</li>
					<li>Creator attribution metadata for published Vibes</li>
				</ul>

				<h3 class="text-xl font-semibold mb-3 mt-6">2.4 Usage and Analytics Data</h3>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					We automatically collect information about your use of the Service:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li>Job processing history and workflow usage</li>
					<li>Credit balance and transaction history</li>
					<li>Device information (browser type, operating system, IP address)</li>
					<li>Session data and usage patterns</li>
					<li>Error logs and diagnostic information</li>
				</ul>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">3. How We Use Your Information</h2>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					We use your information for the following purposes:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li><strong>Service Delivery:</strong> To process images, generate AI outputs, and provide core platform functionality</li>
					<li><strong>Account Management:</strong> To create and manage your account, process payments, and track credits</li>
					<li><strong>Communication:</strong> To send service updates, billing notifications, and respond to support requests</li>
					<li><strong>Improvement:</strong> To analyze usage patterns, improve AI models, and develop new features</li>
					<li><strong>Creator Sparks:</strong> To track Vibe usage and calculate Sparks earned by creators in the Vibe Marketplace</li>
					<li><strong>Security:</strong> To detect fraud, prevent abuse, and ensure platform security</li>
					<li><strong>Legal Compliance:</strong> To comply with legal obligations and enforce our Terms of Service</li>
				</ul>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">4. AI Model Training</h2>
				<p class="text-[#4B5563] leading-relaxed">
					<strong>We do NOT use your uploaded images or processed outputs to train AI models without your explicit consent.</strong> Your content remains private unless you choose to publish Vibes to the public marketplace. Third-party AI providers (Replicate, fal.ai, Google, Anthropic) may have their own data policies—we only use providers with appropriate privacy protections for business data processing.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">5. Data Sharing and Disclosure</h2>

				<h3 class="text-xl font-semibold mb-3 mt-4">5.1 Third-Party AI Providers</h3>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					To provide AI processing services, we share your images with trusted third-party AI providers including:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li>Replicate — RMBG v1.4 (background removal)</li>
					<li>fal.ai — Bria RMBG 2.0 (background removal)</li>
					<li>Google — Gemini 2.5 Flash (image analysis), Imagen 3 (lifestyle scene generation)</li>
					<li>Anthropic — Claude API (text generation)</li>
				</ul>
				<p class="text-[#4B5563] leading-relaxed mt-4">
					These providers are committed to appropriate data privacy standards for business data processing. We select providers based on their privacy practices and data handling commitments.
				</p>

				<h3 class="text-xl font-semibold mb-3 mt-6">5.2 Service Providers</h3>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					We work with trusted service providers for:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li><strong>Supabase:</strong> Database hosting and authentication</li>
					<li><strong>Stripe:</strong> Payment processing</li>
					<li><strong>Cloudflare:</strong> CDN, DDoS protection, and security</li>
					<li><strong>Railway.app:</strong> Worker hosting and job processing</li>
				</ul>

				<h3 class="text-xl font-semibold mb-3 mt-6">5.3 Legal Obligations</h3>
				<p class="text-[#4B5563] leading-relaxed">
					We may disclose your information if required by law, court order, or government request, or to protect the rights, property, or safety of SwiftList, our users, or others.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">6. Data Retention</h2>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li><strong>Processed Files:</strong> Stored for 30 days, then automatically deleted</li>
					<li><strong>Account Data:</strong> Retained while your account is active and for 90 days after account deletion</li>
					<li><strong>Transaction History:</strong> Retained for 7 years for tax and legal compliance</li>
					<li><strong>Public Vibes:</strong> Remain available in the Vibe Marketplace unless you unpublish or delete them</li>
				</ul>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">7. Data Security</h2>
				<p class="text-[#4B5563] leading-relaxed">
					We implement industry-standard security measures including:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li>End-to-end encryption for data transmission (HTTPS/TLS)</li>
					<li>Row Level Security (RLS) policies in our database</li>
					<li>Encrypted storage for files and credentials</li>
					<li>Regular security audits and vulnerability scanning</li>
					<li>SOC 2 compliant infrastructure providers</li>
				</ul>
				<p class="text-[#4B5563] leading-relaxed mt-4">
					However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">8. Your Rights (GDPR & CCPA)</h2>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					Depending on your location, you may have the following rights:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li><strong>Access:</strong> Request a copy of your personal data</li>
					<li><strong>Correction:</strong> Update or correct inaccurate information</li>
					<li><strong>Deletion:</strong> Request deletion of your account and data (subject to legal retention requirements)</li>
					<li><strong>Portability:</strong> Export your data in a machine-readable format</li>
					<li><strong>Opt-Out:</strong> Unsubscribe from marketing emails (service emails cannot be disabled)</li>
					<li><strong>Restrict Processing:</strong> Limit how we use your data in certain circumstances</li>
				</ul>
				<p class="text-[#4B5563] leading-relaxed mt-4">
					To exercise these rights, contact us at <a href="mailto:privacy@heyswiftlist.com" class="text-[#00796B] hover:underline">privacy@heyswiftlist.com</a>.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">9. Cookies and Tracking</h2>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					We use cookies and similar technologies for:
				</p>
				<ul class="list-disc pl-6 text-[#4B5563] space-y-2">
					<li><strong>Essential Cookies:</strong> Required for authentication and security (cannot be disabled)</li>
					<li><strong>Analytics Cookies:</strong> To understand how users interact with the Service</li>
					<li><strong>Preference Cookies:</strong> To remember your settings and preferences</li>
				</ul>
				<p class="text-[#4B5563] leading-relaxed mt-4">
					You can control cookies through your browser settings, but disabling essential cookies may limit functionality.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">10. Children's Privacy</h2>
				<p class="text-[#4B5563] leading-relaxed">
					SwiftList is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If we discover that we have inadvertently collected such information, we will delete it immediately.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">11. International Data Transfers</h2>
				<p class="text-[#4B5563] leading-relaxed">
					Your data may be transferred to and processed in countries other than your own. We ensure adequate safeguards are in place through Standard Contractual Clauses (SCCs) and data processing agreements with all third-party providers.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">12. Changes to This Privacy Policy</h2>
				<p class="text-[#4B5563] leading-relaxed">
					We may update this Privacy Policy from time to time. We will notify you of material changes via email or through the Service. The "Effective Date" at the top indicates when the policy was last updated. Continued use of the Service after changes constitutes acceptance of the updated policy.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-bold mb-4">13. Contact Information</h2>
				<p class="text-[#4B5563] leading-relaxed mb-4">
					For questions about this Privacy Policy or to exercise your data rights, contact us at:
				</p>
				<p class="text-[#4B5563]">
					<strong>Email:</strong> <a href="mailto:privacy@heyswiftlist.com" class="text-[#00796B] hover:underline">privacy@heyswiftlist.com</a>
				</p>
			</section>
		</div>

		<div class="mt-12 text-center">
			<Button variant="secondary" onclick={() => goto('/')}>
				Back to Home
			</Button>
		</div>
	</div>
</div>
