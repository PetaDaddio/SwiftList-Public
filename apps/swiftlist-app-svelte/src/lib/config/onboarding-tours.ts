/**
 * Onboarding Tour Definitions — Driver.js step configs for each page.
 *
 * Each tour targets elements via `data-tour` attributes.
 * Steps are filtered at runtime (missing elements are skipped).
 */
import type { DriveStep } from 'driver.js';

// ─── Home Page ───────────────────────────────────────────────
export const homeTour: DriveStep[] = [
	{
		element: '[data-tour="home-start-job"]',
		popover: {
			title: 'Start a New Job',
			description:
				'Upload your product image and transform it with AI tools like Remove Background (CleanEdge Intelligence™) or Stylize Background.',
			side: 'bottom',
			align: 'center'
		}
	},
	{
		element: '[data-tour="home-explore-presets"]',
		popover: {
			title: 'Explore Preset Vibes',
			description:
				'Browse ready-made styles from our library. Find a Vibe you love and instantly apply it to your images.',
			side: 'bottom',
			align: 'center'
		}
	}
];

// ─── Presets Page (Sidebar + Content) ────────────────────────
export const presetsTour: DriveStep[] = [
	{
		element: '[data-tour="sidebar-edit-profile"]',
		popover: {
			title: 'Your Profile',
			description: 'Update your display name, avatar, and profile details.',
			side: 'right',
			align: 'center'
		}
	},
	{
		element: '[data-tour="sidebar-start-job"]',
		popover: {
			title: 'Start a New Job',
			description:
				'Upload a photo and transform it with AI tools like Remove Background or Stylize Background.',
			side: 'right',
			align: 'center'
		}
	},
	{
		element: '[data-tour="sidebar-discover"]',
		popover: {
			title: 'Discover Vibes',
			description:
				'Browse the full Preset Vibes library — curated and community styles for every aesthetic.',
			side: 'right',
			align: 'center'
		}
	},
	{
		element: '[data-tour="sidebar-favorites"]',
		popover: {
			title: 'Your Favorites',
			description: 'Save Vibes you love and access them quickly for future jobs.',
			side: 'right',
			align: 'center'
		}
	},
	{
		element: '[data-tour="sidebar-my-studio"]',
		popover: {
			title: 'My Studio',
			description:
				"Your creative hub — Vibes you've created and your most recent jobs.",
			side: 'right',
			align: 'center'
		}
	},
	{
		element: '[data-tour="sidebar-analytics"]',
		popover: {
			title: 'Analytics',
			description:
				'See how many people have used your Vibes and track your creator impact.',
			side: 'right',
			align: 'center'
		}
	},
	{
		element: '[data-tour="sidebar-credits"]',
		popover: {
			title: 'Credits',
			description: 'Your current balance. Top up anytime to keep creating.',
			side: 'right',
			align: 'center'
		}
	},
	{
		element: '[data-tour="preset-use-vibe"]',
		popover: {
			title: 'Use this Vibe',
			description:
				'Tap to instantly apply this style to your uploaded image.',
			side: 'left',
			align: 'center'
		}
	}
];

// ─── Job Creator: Step 1 (Upload) ────────────────────────────
export const jobStep1Tour: DriveStep[] = [
	{
		element: '[data-tour="step1-product-upload"]',
		popover: {
			title: 'Upload Your Product Image',
			description:
				'Drag and drop or click to upload the image you want to transform. This is your main product photo.',
			side: 'bottom',
			align: 'center'
		}
	},
	{
		element: '[data-tour="step1-reference-upload"]',
		popover: {
			title: 'Style Reference (Optional)',
			description:
				'Upload a reference image for style transfer — one way to create your own unique Vibe.',
			side: 'bottom',
			align: 'center'
		}
	}
];

// ─── Job Creator: Step 2 (Settings) ─────────────────────────
export const jobStep2Tour: DriveStep[] = [
	{
		element: '[data-tour="step2-marketplaces"]',
		popover: {
			title: 'Choose Your Output Sizes',
			description:
				'Pick a platform to get the right image dimensions — whether you\'re listing on a marketplace or just need polished images.',
			side: 'bottom',
			align: 'center'
		}
	},
	{
		element: '[data-tour="step2-primary-mode"]',
		popover: {
			title: 'AI Enhancements',
			description:
				'Pick your main tool: Remove Background or Stylize Background. Style Transfer and Preset Vibe auto-select if you started from a Vibe.',
			side: 'bottom',
			align: 'center'
		}
	},
	{
		element: '[data-tour="step2-addons"]',
		popover: {
			title: 'Add-on Enhancements',
			description:
				'Stack extras on top — show your product held in hands, generate AI descriptions, upscale to 4K, and more.',
			side: 'top',
			align: 'center'
		}
	}
];

// ─── Job Creator: Step 3 (Review) ────────────────────────────
export const jobStep3Tour: DriveStep[] = [
	{
		element: '[data-tour="step3-generate"]',
		popover: {
			title: 'Generate Your Assets',
			description:
				'Submit your job! If you chose Stylize Background, describe what you want in the background first.',
			side: 'top',
			align: 'center'
		}
	}
];

// ─── Job Completion ──────────────────────────────────────────
export const jobCompleteTour: DriveStep[] = [
	{
		element: '[data-tour="complete-download-all"]',
		popover: {
			title: 'Download All',
			description:
				'Grab a ZIP file with all your marketplace-optimized images in one click.',
			side: 'bottom',
			align: 'center'
		}
	},
	{
		element: '[data-tour="complete-view-download"]',
		popover: {
			title: 'View & Download',
			description:
				'Open any individual image at full size in a new window, or download it directly.',
			side: 'left',
			align: 'center'
		}
	},
	{
		element: '[data-tour="complete-save-preset"]',
		popover: {
			title: 'Save as a Vibe',
			description:
				'Love the result? Save it as a Preset Vibe so you or the community can reuse this style.',
			side: 'top',
			align: 'center'
		}
	}
];
