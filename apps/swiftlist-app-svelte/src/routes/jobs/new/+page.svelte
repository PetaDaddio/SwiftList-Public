<script lang="ts">
	/**
	 * Job Wizard Page - Svelte 5
	 * 3-step wizard matching UX design specs with preset vibe support
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getPromptError } from '$lib/security/prompt-sanitizer';
	import { uploadImage } from '$lib/utils/upload';
	import { createClient } from '$lib/supabase/client';
	import OnboardingTour from '$lib/components/OnboardingTour.svelte';
	import { jobStep1Tour, jobStep2Tour, jobStep3Tour } from '$lib/config/onboarding-tours';

	// Check if preset vibe was passed via URL params
	const presetId = $page.url.searchParams.get('preset');
	const presetName = $page.url.searchParams.get('presetName');
	const presetCreator = $page.url.searchParams.get('presetCreator');
	const presetCreatorId = $page.url.searchParams.get('presetCreatorId');
	const presetThumbnail = $page.url.searchParams.get('presetThumbnail');
	const presetStylePrompt = $page.url.searchParams.get('stylePrompt');

	let step = $state<1 | 2 | 3>(1);
	let selectedFile = $state<File | null>(null);
	let selectedFileData = $state<{
		name: string;
		size: string;
		timestamp: string;
	} | null>(null);

	// Reference image state
	let selectedReferenceFile = $state<File | null>(null);
	let selectedReferenceFileData = $state<{
		name: string;
		size: string;
		timestamp: string;
	} | null>(null);
	let referenceStyleAnalysis = $state<{
		style_description: string;
		mood: string;
		suggested_prompt: string;
		photography_style: string;
	} | null>(null);
	let isAnalyzingReference = $state(false);
	let referenceAnalysisError = $state<string | null>(null);

	// Preset vibe from URL (if coming from Discover page)
	let selectedPresetVibe = $state<{
		id: string;
		name: string;
		creator: string;
		creatorId: string;
		thumbnail: string;
	} | null>(
		presetId && presetName
			? {
					id: presetId,
					name: presetName,
					creator: presetCreator || 'Unknown',
					creatorId: presetCreatorId || '',
					thumbnail: presetThumbnail || 'vintage-denim'
			  }
			: null
	);

	// Step 2: Marketplace selections (multi-select)
	let selectedMarketplaces = $state<string[]>([]);

	// Step 2: AI Enhancements
	// Primary mode: 4 distinct options
	// - 'remove-background': just cut out the product
	// - 'stylize-background': user describes a custom background in Step 3
	// - 'style-transfer': user uploads a reference image to match its style
	// - 'preset-vibe': curated preset selected from Discover page
	let primaryMode = $state<'remove-background' | 'stylize-background' | 'style-transfer' | 'preset-vibe' | null>(
		presetId ? 'preset-vibe' : null
	);
	// When a preset vibe or style transfer is active, lock out remove-bg and stylize-bg
	let primaryModeLocked = $derived(primaryMode === 'preset-vibe' || primaryMode === 'style-transfer');

	// Add-on enhancements (upscale, etc.) — independent of primary mode
	let selectedAddOns = $state<string[]>([]);
	// Track if upscale was auto-recommended (vs user-selected)
	let upscaleAutoRecommended = $state(false);
	// Derive enhancements array — backend expects 'stylize-background' for style transfer, presets, and custom stylize
	let selectedEnhancements = $derived.by(() => {
		const enhancements: string[] = [];
		if (primaryMode === 'remove-background') {
			enhancements.push('remove-background');
		}
		if (primaryMode === 'stylize-background' || primaryMode === 'style-transfer' || primaryMode === 'preset-vibe') {
			enhancements.push('stylize-background');
		}
		return [...enhancements, ...selectedAddOns];
	});

	// Step 3: Art direction
	let aiPrompt = $state('');
	let aiPromptConfirmed = $state(false); // Only show checkmark after Enter/blur
	let aiPromptError = $state(''); // Security validation error

	// Sparks: true when using another creator's preset (not your own, not system)
	let currentUserId = $derived($page.data.user?.id || '');
	let isSparksPreset = $derived(
		selectedPresetVibe != null &&
		selectedPresetVibe.creatorId !== '' &&
		selectedPresetVibe.creatorId !== currentUserId &&
		selectedPresetVibe.creatorId !== 'system-swiftlist-official'
	);

	// Image classification state (Gemini Flash 2.5)
	let isClassifying = $state(false);
	let isSubmitting = $state(false);
	let submitError = $state('');
	let classificationResult = $state<{
		product_name: string | null;
		product_type: string;
		confidence: number;
		recommended_workflow?: string;
		suggested_enhancements: string[];
		suggested_marketplaces: string[];
		resolution?: {
			width: number;
			height: number;
			needs_upscaling: boolean;
		};
		classification_failed?: boolean;
		error_message?: string;
	} | null>(null);

	// HEIC conversion state
	let isConvertingHeic = $state(false);
	let heicConversionError = $state('');

	/**
	 * Check if file is HEIC/HEIF format
	 */
	function isHeicFile(file: File): boolean {
		const heicTypes = ['image/heic', 'image/heif'];
		const heicExtensions = /\.(heic|heif)$/i;
		return heicTypes.includes(file.type.toLowerCase()) || heicExtensions.test(file.name);
	}

	/**
	 * Convert HEIC file to JPEG using multiple fallback methods:
	 * 1. Native browser Canvas API (works on Safari/macOS which has HEIC support)
	 * 2. Server-side Sharp conversion
	 * 3. Browser-based heic2any library
	 * Uses JPEG at 92% quality for optimal size/quality balance for product photos
	 * Returns converted File object or null on failure
	 */
	async function convertHeicToJpeg(file: File): Promise<File | null> {
		// Global timeout: cap the entire conversion at 20 seconds
		const globalTimeout = new Promise<null>((resolve) =>
			setTimeout(() => {
				heicConversionError = 'Conversion timed out. Please save your photo as JPEG first.';
				resolve(null);
			}, 20000)
		);

		return Promise.race([convertHeicToJpegInternal(file), globalTimeout]);
	}

	async function convertHeicToJpegInternal(file: File): Promise<File | null> {

		const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

		// Method 1: Try native browser Canvas API first (Safari/macOS has native HEIC support)
		try {
			const convertedFile = await convertWithCanvas(file, newFileName);
			if (convertedFile) {
				return convertedFile;
			}
		} catch (canvasError: any) {
		}

		// Method 2: Try server-side conversion with Sharp (15s timeout)
		try {
			const formData = new FormData();
			formData.append('file', file);

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 15000);

			const response = await fetch('/api/convert-heic', {
				method: 'POST',
				body: formData,
				signal: controller.signal
			});
			clearTimeout(timeoutId);

			if (response.ok) {
				const result = await response.json();

				// Convert base64 data URL to File
				const base64Data = result.data.split(',')[1];
				const binaryString = atob(base64Data);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				const blob = new Blob([bytes], { type: 'image/jpeg' });
				const convertedFile = new File([blob], result.filename, { type: 'image/jpeg' });

				return convertedFile;
			} else {
				const errorData = await response.json().catch(() => ({ message: 'Server conversion failed' }));
			}
		} catch (serverError: any) {
		}

		// Method 3: Try browser-based heic2any library (with 30s timeout for large files)
		try {

			let heic2any;
			try {
				const module = await import('heic2any');
				heic2any = module.default;
			} catch (importError: any) {
				throw new Error('Library load failed');
			}

			const convertedBlob = await Promise.race([
				heic2any({
					blob: file,
					toType: 'image/jpeg',
					quality: 0.92
				}),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('heic2any conversion timed out')), 30000)
				)
			]);

			const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

			if (!blob || blob.size === 0) {
				throw new Error('Empty result');
			}

			const convertedFile = new File([blob], newFileName, { type: 'image/jpeg' });
			return convertedFile;
		} catch (browserError: any) {
		}

		// All methods failed
		heicConversionError = 'This iPhone photo format could not be converted. Please open it in your Photos app, tap Share → Save to Files → choose JPEG format.';
		return null;
	}

	/**
	 * Convert image using native browser Canvas API
	 * Works on Safari/macOS which has native HEIC support
	 */
	async function convertWithCanvas(file: File, newFileName: string): Promise<File | null> {
		// Wrap in a timeout — Chrome silently fails on HEIC (no onload OR onerror fires)
		return Promise.race([
			new Promise<File | null>((resolve, reject) => {
				const url = URL.createObjectURL(file);
				const img = new Image();

				img.onload = () => {
					URL.revokeObjectURL(url);

					// Check if image actually loaded (Safari can decode HEIC)
					if (img.width === 0 || img.height === 0) {
						reject(new Error('Image failed to decode'));
						return;
					}

					// Create canvas and draw
					const canvas = document.createElement('canvas');
					canvas.width = img.width;
					canvas.height = img.height;
					const ctx = canvas.getContext('2d');

					if (!ctx) {
						reject(new Error('Canvas context failed'));
						return;
					}

					ctx.drawImage(img, 0, 0);

					// Convert to JPEG blob
					canvas.toBlob(
						(blob) => {
							if (!blob || blob.size === 0) {
								reject(new Error('Canvas toBlob failed'));
								return;
							}
							const convertedFile = new File([blob], newFileName, { type: 'image/jpeg' });
							resolve(convertedFile);
						},
						'image/jpeg',
						0.92
					);
				};

				img.onerror = () => {
					URL.revokeObjectURL(url);
					reject(new Error('Image load failed'));
				};

				img.src = url;
			}),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Canvas conversion timed out')), 5000)
			)
		]);
	}

	// Art Direction is stored in aiPrompt variable (line 67)

	const marketplaces = [
		{ id: 'amazon', label: 'Amazon', logo: '/logos/amazon-pay-svgrepo-com.svg', logoScale: 'h-16' },
		{ id: 'ebay', label: 'eBay', logo: '/logos/ebay-svgrepo-com.svg', logoScale: 'h-16' },
		{ id: 'etsy', label: 'Etsy', logo: '/logos/etsy-logo-svgrepo-com.svg', logoScale: 'h-16' },
		{ id: 'facebook', label: 'Facebook', logo: '/logos/facebook-5-logo-svgrepo-com.svg', logoScale: 'h-20' },
		{ id: 'instagram', label: 'Instagram', logo: '/logos/instagram-2-1-logo-svgrepo-com.svg', logoScale: 'h-8' },
		{ id: 'pinterest', label: 'Pinterest', logo: '/logos/pinterest-color-svgrepo-com.svg', logoScale: 'h-8' },
		{ id: 'poshmark', label: 'Poshmark', logo: '/logos/Poshmark_idE554Q801_0.svg', logoScale: 'h-6' },
		{ id: 'shopify', label: 'Shopify', logo: '/logos/shopify-logo.svg', logoScale: 'h-8' }
	];

	const aiEnhancements = [
		{
			id: 'remove-background',
			label: 'Remove Background',
			description: 'Isolates product on transparent layer.',
			icon: '🖼️',
			checked: true,
			available: true
		},
		{
			id: 'stylize-background',
			label: 'Stylize Background',
			description: 'Art direct your background in Step 3.',
			badge: 'POPULAR',
			icon: '🎨',
			checked: false,
			available: true
		},
		{
			id: 'upscale',
			label: 'High-Res Upscale',
			description: 'Enhances details up to 4K resolution.',
			badge: 'ADD-ON',
			icon: '📐',
			checked: false,
			available: true
		},
		{
			id: 'animated-spin',
			label: 'Animated Spin',
			description: 'Generates a 360° video from one image.',
			icon: '🔄',
			checked: false,
			available: false,
			badge: 'COMING SOON'
		},
		{
			id: 'product-held-in-hands',
			label: 'Product Held in Hands',
			description: 'AI generates hands holding your product.',
			icon: '✋',
			checked: false,
			available: true,
			badge: 'NEW'
		},
{
			id: 'invisible-mannequin',
			label: 'Invisible Mannequin',
			description: 'Makes clothing appear on a ghost mannequin — 3D shape, no visible form.',
			badge: 'NEW',
			icon: '👻',
			checked: false,
			available: true
		},
		{
			id: 'generate-product-description',
			label: 'Product Descriptions',
			description: 'AI-generated titles, descriptions & tags for your selected marketplaces.',
			badge: 'NEW',
			icon: '📝',
			checked: false,
			available: true
		}
	];

	// Get preset thumbnail background
	function getPresetBackground(thumbnail: string): string {
		const backgrounds: Record<string, string> = {
			'vintage-denim': 'linear-gradient(135deg, #1a3a52 0%, #2d5370 100%)',
			'minimalist-home': 'linear-gradient(135deg, #d4b896 0%, #c9a574 100%)',
			'neon-cyber': 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%)',
			'eco-friendly': 'linear-gradient(135deg, #8fb569 0%, #6fa34a 100%)',
			'luxury-watch': 'linear-gradient(135deg, #0a0a0a 0%, #1f1f1f 100%)',
			'sneaker-drop': 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'
		};
		return backgrounds[thumbnail] || 'linear-gradient(135deg, #00796B 0%, #004d40 100%)';
	}

	// Call Claude Haiku Job Assistant
	// Art direction is now a simple text input (aiPrompt variable)
	// No AI assistant functionality needed

	// Classify image with Gemini Flash 2.5
	async function classifyImage(file: File) {
		isClassifying = true;
		classificationResult = null;

		try {
			// Convert file to base64
			const reader = new FileReader();
			const base64Promise = new Promise<string>((resolve) => {
				reader.onload = () => resolve(reader.result as string);
				reader.readAsDataURL(file);
			});
			const imageBase64 = await base64Promise;

			// Call classification API
			const response = await fetch('/api/ai/classify-image', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					image_base64: imageBase64,
					file_name: file.name
				})
			});

			if (response.ok) {
				const result = await response.json();
				classificationResult = result;

				// Note: suggested_marketplaces from classification are available but NOT auto-selected.
				// Users always start Step 2 with all marketplaces deselected for intentional selection.

				if (result.suggested_enhancements) {
					// Auto-set primary mode from classification (only if not already set by preset/reference)
					const suggested = result.suggested_enhancements as string[];
					if (!primaryMode) {
						if (suggested.includes('remove-background')) primaryMode = 'remove-background';
					}
					// Add non-primary suggestions as add-ons
					const addOnSuggestions = suggested.filter(
						(e) => e !== 'remove-background' && e !== 'stylize-background'
					);
					selectedAddOns = Array.from(new Set([...selectedAddOns, ...addOnSuggestions]));
				}

				// Auto-check upscaling for low-resolution images
				if (result.resolution?.needs_upscaling && !selectedAddOns.includes('upscale')) {
					selectedAddOns = [...selectedAddOns, 'upscale'];
					upscaleAutoRecommended = true;
				}

			} else {
				const errData = await response.json().catch(() => ({ error: 'Classification failed' }));
				console.error('Classification API error:', response.status, errData);
				// Mark as failed so UI shows retry option instead of fake "Unknown Product"
				classificationResult = {
					product_name: null,
					product_type: 'general',
					confidence: 0,
					suggested_marketplaces: [],
					suggested_enhancements: ['remove-background'],
					classification_failed: true,
					error_message: errData.error || 'Could not identify product'
				} as any;
			}
		} catch (error) {
			console.error('Error classifying image:', error);
			classificationResult = {
				product_name: null,
				product_type: 'general',
				confidence: 0,
				suggested_marketplaces: [],
				suggested_enhancements: ['remove-background'],
				classification_failed: true,
				error_message: 'Network error — could not reach classification service'
			} as any;
		} finally {
			isClassifying = false;
		}
	}

	// Convert HEIC/HEIF to PNG using canvas
	async function convertImageToPNG(file: File): Promise<File> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					// Create canvas and draw image
					const canvas = document.createElement('canvas');
					canvas.width = img.width;
					canvas.height = img.height;
					const ctx = canvas.getContext('2d');
					if (!ctx) {
						reject(new Error('Failed to get canvas context'));
						return;
					}
					ctx.drawImage(img, 0, 0);

					// Convert to PNG blob
					canvas.toBlob((blob) => {
						if (!blob) {
							reject(new Error('Failed to convert image'));
							return;
						}
						// Create new File from blob
						const newFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.png'), {
							type: 'image/png'
						});
						resolve(newFile);
					}, 'image/png', 0.95);
				};
				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = e.target?.result as string;
			};
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});
	}

	// Handle file upload
	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		let file = target.files?.[0];

		if (file) {
			// Reset error state
			heicConversionError = '';

			// Check if HEIC and convert if needed
			if (isHeicFile(file)) {
				isConvertingHeic = true;
				try {
					const convertedFile = await convertHeicToJpeg(file);

					if (!convertedFile) {
						// heicConversionError is already set by convertHeicToJpeg
						if (!heicConversionError) {
							heicConversionError = 'Failed to convert iPhone photo. Please try saving as JPEG first.';
						}
						return;
					}
					file = convertedFile;
				} catch (err) {
					heicConversionError = 'Failed to convert iPhone photo. Please try saving as JPEG first.';
					return;
				} finally {
					isConvertingHeic = false;
				}
			}

			selectedFile = file;

			// Format file size
			const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

			// Get current timestamp
			const now = new Date();
			const timestamp = now.toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});

			selectedFileData = {
				name: file.name,
				size: `${sizeInMB} MB`,
				timestamp
			};

			// Classify image with Gemini Flash 2.5
			classifyImage(file);
		}
	}

	// Handle drag and drop for product image
	let isDragging = $state(false);

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		let file = event.dataTransfer?.files[0];
		if (file && (file.type.startsWith('image/') || file.name.match(/\.(heic|heif)$/i))) {
			// Reset error state
			heicConversionError = '';

			// Check if HEIC and convert if needed
			if (isHeicFile(file)) {
				isConvertingHeic = true;
				try {
					const convertedFile = await convertHeicToJpeg(file);

					if (!convertedFile) {
						// heicConversionError is already set by convertHeicToJpeg
						if (!heicConversionError) {
							heicConversionError = 'Failed to convert iPhone photo. Please try saving as JPEG first.';
						}
						return;
					}
					file = convertedFile;
				} catch (err) {
					heicConversionError = 'Failed to convert iPhone photo. Please try saving as JPEG first.';
					return;
				} finally {
					isConvertingHeic = false;
				}
			}

			selectedFile = file;

			const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
			const now = new Date();
			const timestamp = now.toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});

			selectedFileData = {
				name: file.name,
				size: `${sizeInMB} MB`,
				timestamp
			};

			// Classify image with Gemini Flash 2.5
			classifyImage(file);
		}
	}

	// Handle drag and drop for reference image
	let isReferenceDragging = $state(false);

	function handleReferenceDragOver(event: DragEvent) {
		event.preventDefault();
		isReferenceDragging = true;
	}

	function handleReferenceDragLeave() {
		isReferenceDragging = false;
	}

	async function handleReferenceDrop(event: DragEvent) {
		event.preventDefault();
		isReferenceDragging = false;

		let file = event.dataTransfer?.files[0];
		if (file && (file.type.startsWith('image/') || file.name.match(/\.(heic|heif)$/i))) {
			selectedReferenceFile = file;

			const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
			const now = new Date();
			const timestamp = now.toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});

			selectedReferenceFileData = {
				name: file.name,
				size: `${sizeInMB} MB`,
				timestamp
			};

			// Reference image = style transfer mode
			selectedPresetVibe = null;
			primaryMode = 'style-transfer';
			// Also trigger style analysis for drag-and-drop
			if (file) analyzeReferenceStyle(file);
		}
	}

	// Analyze reference image style with Gemini
	async function analyzeReferenceStyle(file: File) {
		isAnalyzingReference = true;
		referenceStyleAnalysis = null;
		referenceAnalysisError = null;

		try {
			// Convert file to base64
			const reader = new FileReader();
			const base64Promise = new Promise<string>((resolve) => {
				reader.onload = () => resolve(reader.result as string);
				reader.readAsDataURL(file);
			});
			const imageBase64 = await base64Promise;

			// Call style analysis API (45s timeout — Gemini can be slow on large images)
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 45_000);
			const response = await fetch('/api/ai/analyze-reference', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					image_base64: imageBase64,
					file_name: file.name
				}),
				signal: controller.signal
			});
			clearTimeout(timeout);

			if (response.ok) {
				const result = await response.json();
				referenceStyleAnalysis = result;

				// Auto-populate AI prompt with suggested style prompt
				if (result.suggested_prompt && !aiPrompt) {
					aiPrompt = result.suggested_prompt;
				}

			} else {
				const status = response.status;
				if (status === 413) {
					referenceAnalysisError = 'Image too large for style analysis. Try a smaller file (under 8MB).';
				} else {
					referenceAnalysisError = 'Style analysis failed. You can still use this image as a reference.';
				}
				console.error('Failed to analyze reference image:', status);
			}
		} catch (error) {
			referenceAnalysisError = 'Style analysis failed. You can still use this image as a reference.';
			console.error('Error analyzing reference image:', error);
		} finally {
			isAnalyzingReference = false;
		}
	}

	// Handle reference file selection
	async function handleReferenceFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		let file = input.files?.[0];
		if (file) {
			selectedReferenceFile = file;

			const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
			const now = new Date();
			const timestamp = now.toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});

			selectedReferenceFileData = {
				name: file.name,
				size: `${sizeInMB} MB`,
				timestamp
			};

			// Reference image = style transfer mode
			selectedPresetVibe = null;
			primaryMode = 'style-transfer';

			// Analyze the style of the reference image
			await analyzeReferenceStyle(file);
		}
	}

	// Toggle marketplace selection
	function toggleMarketplace(id: string) {
		if (selectedMarketplaces.includes(id)) {
			selectedMarketplaces = selectedMarketplaces.filter((m) => m !== id);
		} else {
			selectedMarketplaces = [...selectedMarketplaces, id];
		}
	}

	// Mutually exclusive add-ons: only one of these can be selected at a time
	const EXCLUSIVE_ADDONS = ['product-held-in-hands', 'invisible-mannequin', 'animated-spin'];

	// Fashion product types that allow invisible mannequin
	const FASHION_TYPES = ['clothing', 'fashion', 'apparel'];

	// Check if invisible mannequin is allowed based on classification
	let mannequinAllowed = $derived(
		classificationResult?.product_type ? FASHION_TYPES.includes(classificationResult.product_type) : false
	);

	// Toggle add-on enhancement (upscale, etc.)
	function toggleAddOn(id: string) {
		if (selectedAddOns.includes(id)) {
			selectedAddOns = selectedAddOns.filter((e) => e !== id);
			// Clear auto-recommended flag when user manually deselects upscale
			if (id === 'upscale') upscaleAutoRecommended = false;
		} else {
			// If selecting an exclusive add-on, deselect any other exclusive add-on
			if (EXCLUSIVE_ADDONS.includes(id)) {
				selectedAddOns = selectedAddOns.filter((e) => !EXCLUSIVE_ADDONS.includes(e));
			}
			selectedAddOns = [...selectedAddOns, id];
		}
	}

	// Set primary mode from segmented toggle
	function setPrimaryMode(mode: 'remove-background' | 'stylize-background' | 'style-transfer' | 'preset-vibe') {
		primaryMode = primaryMode === mode ? null : mode;
	}

	function handleNext() {
		if (step < 3) {
			const nextStep = (step + 1) as 1 | 2 | 3;
			// Always start Step 2 with a clean slate — no stale marketplace selections
			if (nextStep === 2) {
				selectedMarketplaces = [];
			}
			step = nextStep;
		}
	}

	function handleBack() {
		if (step > 1) {
			step = (step - 1) as 1 | 2 | 3;
		}
	}

	async function handleSubmit() {
		submitError = '';

		if (!selectedFile) {
			submitError = 'Please upload a product image first';
			return;
		}
		if (!classificationResult) {
			submitError = 'Image analysis failed or is still loading. Please re-upload your image.';
			return;
		}
		if (isSubmitting) return;
		isSubmitting = true;

		// Validate that style transfer has a reference image uploaded
		if (primaryMode === 'style-transfer' && !selectedReferenceFile) {
			submitError = 'Please upload a reference image for style transfer.';
			isSubmitting = false;
			return;
		}
		if (primaryMode === 'preset-vibe' && !selectedPresetVibe) {
			submitError = 'Please select a preset vibe from the Discover page.';
			isSubmitting = false;
			return;
		}
		if (primaryMode === 'stylize-background' && !aiPrompt.trim()) {
			submitError = 'Please describe your background style in Step 3.';
			isSubmitting = false;
			return;
		}

		try {
			// Get current user for upload path
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated. Please sign in again.');

			// Upload product image directly to Supabase Storage (bypasses server)
			const productUpload = await uploadImage(selectedFile!, user.id);
			if (productUpload.error) {
				throw new Error(`Image upload failed: ${productUpload.error}`);
			}

			// Upload reference image if provided
			let referenceImageUrl: string | undefined;
			if (selectedReferenceFile) {
				const refUpload = await uploadImage(selectedReferenceFile!, user.id);
				if (refUpload.error) {
					throw new Error(`Reference image upload failed: ${refUpload.error}`);
				}
				referenceImageUrl = refUpload.url;
			}

			// Call job creation API with URLs (not base64)
			const response = await fetch('/api/jobs/create', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					productImageUrl: productUpload.url,
					referenceImageUrl: referenceImageUrl,
					productName: classificationResult.product_name || classificationResult.product_type,
					productType: classificationResult.product_type,
					enhancements: selectedEnhancements,
					marketplaces: selectedMarketplaces,
					presetName: selectedPresetVibe ? selectedPresetVibe.name : undefined,
					presetId: selectedPresetVibe ? selectedPresetVibe.id : undefined,
					// Treat reference image analysis like a preset vibe — same Gemini pipeline
					presetStylePrompt: selectedPresetVibe && presetStylePrompt
						? presetStylePrompt
						: referenceStyleAnalysis?.suggested_prompt || undefined,
					aiPrompt: aiPrompt || undefined
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: `Server error (${response.status})` }));
				throw new Error(errorData.message || `Server error (${response.status})`);
			}

			const result = await response.json();

			// Redirect to processing page
			goto(`/jobs/${result.job_id}/processing`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error('Job submission failed:', message, error);
			submitError = message;
		} finally {
			isSubmitting = false;
		}
	}

	function removePresetVibe() {
		selectedPresetVibe = null;
		if (primaryMode === 'preset-vibe') primaryMode = null;
	}
</script>

<svelte:head>
	<title>Start New Job - SwiftList</title>
</svelte:head>

<div class="min-h-screen flex bg-[#F8F5F0]">
	<!-- Backdrop overlay -->
	<div class="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"></div>

	<!-- Modal -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div class="bg-white w-full max-w-full md:max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
			<!-- Header -->
			<div class="px-4 sm:px-6 py-3 border-b border-gray-200">
				<div class="flex justify-between items-start mb-0.5">
					<h2 class="text-[#2C3E50] font-bold text-xl">Start a New Job</h2>
					<button
						onclick={() => goto('/dashboard')}
						class="p-2 rounded-full hover:bg-gray-100 transition-colors text-[#4B5563]"
					>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
				<p class="text-[#4B5563] text-sm">Upload your assets to begin the transformation.</p>

				<!-- Step Indicators -->
				<div class="flex items-center gap-4 mt-3">
					<div class="flex items-center gap-2">
						<div
							class={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
								step === 1
									? 'bg-[#00796B] text-white'
									: step > 1
										? 'bg-green-500 text-white'
										: 'bg-gray-200 text-gray-500'
							}`}
						>
							{step > 1 ? '✓' : '1'}
						</div>
						<span class={`text-sm font-medium ${step === 1 ? 'text-[#00796B]' : 'text-[#4B5563]'}`}>
							Uploads
						</span>
					</div>

					<div class="flex-1 h-[2px] bg-gray-200"></div>

					<div class="flex items-center gap-2">
						<div
							class={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
								step === 2
									? 'bg-[#00796B] text-white'
									: step > 2
										? 'bg-green-500 text-white'
										: 'bg-gray-200 text-gray-500'
							}`}
						>
							{step > 2 ? '✓' : '2'}
						</div>
						<span class={`text-sm font-medium ${step === 2 ? 'text-[#00796B]' : 'text-[#4B5563]'}`}>
							Settings
						</span>
					</div>

					<div class="flex-1 h-[2px] bg-gray-200"></div>

					<div class="flex items-center gap-2">
						<div
							class={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
								step === 3 ? 'bg-[#00796B] text-white' : 'bg-gray-200 text-gray-500'
							}`}
						>
							3
						</div>
						<span class={`text-sm font-medium ${step === 3 ? 'text-[#00796B]' : 'text-[#4B5563]'}`}>
							Review
						</span>
					</div>
				</div>
			</div>

			<!-- Content -->
			<div class="p-4 md:p-5 overflow-y-auto flex-1">
				<!-- Step 1: Upload -->
				{#if step === 1}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
						<!-- Left Column: Product Image -->
						<div>
							<div class="flex items-center justify-between mb-2">
								<h3 class="text-[#2C3E50] font-bold text-sm">
									Product Image <span class="text-[#00796B]">*</span>
								</h3>
								<span class="text-xs font-semibold text-[#00796B] bg-[#E8F5F4] px-2 py-0.5 rounded">
									REQUIRED
								</span>
							</div>
							<p class="text-[#4B5563] text-xs mb-2">This is the main image we will modify.</p>

							<!-- Upload Area -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								data-tour="step1-product-upload"
								class={`border-2 border-dashed rounded-lg p-3 md:p-5 text-center transition-all min-h-[200px] md:min-h-[260px] flex flex-col items-center justify-center ${
									isDragging ? 'border-[#00796B] bg-[#00796B]/5' : selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gradient-to-br from-orange-200 to-orange-300 cursor-pointer'
								}`}
								ondragover={handleDragOver}
								ondragleave={handleDragLeave}
								ondrop={handleDrop}
							>
								{#if isConvertingHeic}
									<!-- HEIC Converting State -->
									<div class="flex flex-col items-center">
										<div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
											<div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
										</div>
										<p class="text-[#2C3E50] font-semibold mb-2">
											📱 Converting iPhone Photo...
										</p>
										<p class="text-[#4B5563] text-sm">
											This takes about 5 seconds
										</p>
										<div class="mt-4 w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
											<div class="h-full bg-blue-500 rounded-full animate-pulse" style="width: 60%"></div>
										</div>
									</div>
								{:else if heicConversionError}
									<!-- HEIC Conversion Error State -->
									<div class="flex flex-col items-center max-w-md">
										<div class="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
											<span class="material-symbols-outlined text-amber-600 text-3xl">phone_iphone</span>
										</div>
										<p class="text-amber-700 font-semibold mb-2 text-center">iPhone Photo Format Detected</p>
										<p class="text-[#4B5563] text-sm text-center mb-3">
											HEIC files need to be converted to JPEG before uploading.
										</p>
										<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-left w-full">
											<p class="text-blue-800 text-xs font-semibold mb-2">📱 On your iPhone:</p>
											<ol class="text-blue-700 text-xs list-decimal list-inside space-y-1 mb-3">
												<li>Open the photo in <strong>Photos</strong> app</li>
												<li>Tap <strong>Share</strong> (box with arrow)</li>
												<li>Scroll down and tap <strong>"Save to Files"</strong></li>
												<li>Tap <strong>Options</strong> at the top</li>
												<li>Change format from HEIC to <strong>JPEG</strong></li>
												<li>Save, then upload the JPEG file</li>
											</ol>
											<p class="text-blue-800 text-xs font-semibold mb-2">💻 On Mac (easiest):</p>
											<ol class="text-blue-700 text-xs list-decimal list-inside space-y-1">
												<li>Open the HEIC in <strong>Preview</strong></li>
												<li>File → <strong>Export</strong> → Choose <strong>JPEG</strong></li>
												<li>Upload the exported JPEG file</li>
											</ol>
										</div>
										<label class="cursor-pointer">
											<span class="bg-[#00796B] hover:bg-[#00695C] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
												Upload JPEG File
											</span>
											<input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onchange={handleFileSelect} class="hidden" />
										</label>
									</div>
								{:else if !selectedFile}
									<label class="flex flex-col items-center cursor-pointer w-full">
										<div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-3">
											<span class="material-symbols-outlined text-[#00796B] text-2xl">
												add_photo_alternate
											</span>
										</div>
										<p class="text-[#2C3E50] font-semibold text-sm mb-1">
											Drag & Drop your product image here or <span class="text-[#00796B]">click to upload</span>
										</p>
										<p class="text-[#4B5563] text-xs mt-2">
											Accepts: .jpg, .png, .webp, .heic • Max 10MB • Min 500×500px
										</p>
										<input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onchange={handleFileSelect} class="hidden" />
									</label>
								{:else}
									<!-- File Uploaded Confirmation -->
									<div class="w-full">
										<div class="flex items-center justify-center gap-3 mb-3">
											<span class="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
											<div class="text-left">
												<p class="text-[#2C3E50] font-semibold">{selectedFileData?.name}</p>
												<p class="text-[#4B5563] text-sm">
													{selectedFileData?.size} • {selectedFileData?.timestamp}
												</p>
											</div>
										</div>

										<!-- Gemini Classification Status -->
										{#if isClassifying}
											<div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
												<div class="flex items-center gap-2">
													<div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
													<p class="text-blue-700 text-sm font-medium">AI analyzing your product...</p>
												</div>
											</div>
										{:else if classificationResult?.classification_failed}
											<!-- Classification failed — show warning with retry -->
											<div class="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
												<div class="flex items-center gap-2 mb-2">
													<span class="material-symbols-outlined text-yellow-600 text-sm">warning</span>
													<div class="text-yellow-700 flex-1">
														<p class="text-sm font-semibold">Could not identify product</p>
														<p class="text-xs">{classificationResult.error_message || 'Classification unavailable'}</p>
													</div>
												</div>
												<div class="flex items-center gap-3 mt-2">
													<button
														type="button"
														onclick={() => { if (selectedFile) classifyImage(selectedFile); }}
														class="text-xs font-medium text-yellow-700 hover:text-yellow-800 underline"
													>
														Retry classification
													</button>
													<span class="text-xs text-yellow-600">or continue with default settings</span>
												</div>
											</div>
										{:else if classificationResult}
											<div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
												<div class="flex items-center gap-2 mb-2">
													<span class="material-symbols-outlined text-green-600 text-sm">psychology</span>
													<div class="text-green-700 flex-1">
														<p class="text-sm font-semibold">
															{classificationResult.product_name || 'Product Identified'}
														</p>
														<p class="text-xs">
															Category: <span class="capitalize">{classificationResult.product_type.replace('_', ' ')}</span>
															• Confidence: {(classificationResult.confidence * 100).toFixed(0)}%
														</p>
														{#if classificationResult.resolution}
															<p class="text-xs mt-1">
																Resolution: {classificationResult.resolution.width}x{classificationResult.resolution.height}px
																{#if classificationResult.resolution.needs_upscaling}
																	<span class="inline-block ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium">
																		⚠️ Below marketplace recommended (1600px)
																	</span>
																{:else}
																	<span class="inline-block ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
																		✓ Marketplace ready
																	</span>
																{/if}
															</p>
														{/if}
													</div>
												</div>
												<p class="text-green-600 text-xs">
													✓ Smart defaults applied to Step 2
													{#if classificationResult.resolution?.needs_upscaling}
														• Upscaling auto-enabled
													{/if}
												</p>
											</div>
										{/if}

										<button
											onclick={() => {
												selectedFile = null;
												selectedFileData = null;
												classificationResult = null;
											}}
											class="text-[#4B5563] hover:text-red-600 transition-colors text-sm underline mt-3"
										>
											Remove file
										</button>
									</div>
								{/if}
							</div>
						</div>

						<!-- Right Column: Reference Image (Preset Vibe or Upload) -->
						<div>
							<div class="flex items-center justify-between mb-2">
								<h3 class="text-[#2C3E50] font-bold text-sm">Reference Image</h3>
								<span class="text-xs font-semibold text-[#8B6914] bg-[#F4C430] px-2 py-0.5 rounded">
									OPTIONAL
								</span>
							</div>
							<p class="text-[#4B5563] text-xs mb-2">Use this for style transfer or mood matching.</p>

							<!-- Reference Image Area -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								data-tour="step1-reference-upload"
								class={`border-2 border-dashed rounded-lg p-3 md:p-5 text-center transition-all min-h-[200px] md:min-h-[260px] flex flex-col items-center justify-center ${
									isReferenceDragging
										? 'border-[#00796B] bg-[#00796B]/5'
										: selectedReferenceFile
										? 'border-green-500 bg-green-50'
										: selectedPresetVibe
										? ''
										: 'border-gray-300 bg-gradient-to-br from-purple-200 to-purple-300 cursor-pointer'
								}`}
								style={selectedPresetVibe && !selectedReferenceFile
									? `background: ${getPresetBackground(selectedPresetVibe.thumbnail)}`
									: ''}
								ondragover={!selectedPresetVibe ? handleReferenceDragOver : undefined}
								ondragleave={!selectedPresetVibe ? handleReferenceDragLeave : undefined}
								ondrop={!selectedPresetVibe ? handleReferenceDrop : undefined}
							>
								{#if selectedPresetVibe && !selectedReferenceFile}
									<!-- Preset Selected -->
									<div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center mb-3">
										<span class="material-symbols-outlined text-[#00796B] text-3xl">brush</span>
									</div>
									<p class="text-white font-bold text-lg mb-1">{selectedPresetVibe.name} Style Selected</p>
									<p class="text-white/80 text-sm mb-4">by {selectedPresetVibe.creator}</p>
									<button
										onclick={removePresetVibe}
										class="text-white/90 hover:text-white text-sm underline"
									>
										Click to change or remove this style
									</button>
								{:else if selectedReferenceFile}
									<!-- Reference File Uploaded -->
									<div class="w-full">
										<div class="flex items-center justify-center gap-3 mb-3">
											{#if isAnalyzingReference}
												<div class="animate-spin text-[#00796B]">
													<span class="material-symbols-outlined text-4xl">autorenew</span>
												</div>
												<div class="text-left">
													<p class="text-[#2C3E50] font-semibold">Analyzing style...</p>
													<p class="text-[#4B5563] text-sm">SwiftList AI analyzing your image</p>
												</div>
											{:else}
												<span class="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
												<div class="text-left">
													<p class="text-[#2C3E50] font-semibold">{selectedReferenceFileData?.name}</p>
													<p class="text-[#4B5563] text-sm">
														{selectedReferenceFileData?.size} • {selectedReferenceFileData?.timestamp}
													</p>
												</div>
											{/if}
										</div>

										{#if referenceAnalysisError && !isAnalyzingReference}
											<!-- Style Analysis Error -->
											<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-left">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-amber-600 text-lg">warning</span>
													<p class="text-amber-800 text-xs">{referenceAnalysisError}</p>
												</div>
											</div>
										{:else if referenceStyleAnalysis && !isAnalyzingReference}
											<!-- Style Analysis Results -->
											<div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 mb-4 text-left">
												<div class="flex items-center gap-2 mb-2">
													<span class="material-symbols-outlined text-purple-600">palette</span>
													<h4 class="text-[#2C3E50] font-semibold text-sm">Style Analysis</h4>
												</div>
												<p class="text-[#4B5563] text-xs mb-3">{referenceStyleAnalysis.style_description}</p>
												<div class="flex gap-2 flex-wrap">
													<span class="bg-purple-200 text-purple-800 text-xs px-2 py-1 rounded-full">
														{referenceStyleAnalysis.photography_style}
													</span>
													<span class="bg-pink-200 text-pink-800 text-xs px-2 py-1 rounded-full">
														{referenceStyleAnalysis.mood}
													</span>
												</div>
											</div>
										{/if}

										<button
											onclick={() => {
												selectedReferenceFile = null;
												selectedReferenceFileData = null;
												referenceStyleAnalysis = null;
												referenceAnalysisError = null;
											}}
											class="text-[#4B5563] hover:text-red-600 transition-colors text-sm underline"
										>
											Remove file
										</button>
									</div>
								{:else}
									<!-- No Preset or File Selected - Show Upload UI -->
									<label class="flex flex-col items-center cursor-pointer w-full">
										<div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-3">
											<span class="material-symbols-outlined text-[#00796B] text-2xl">
												add_photo_alternate
											</span>
										</div>
										<p class="text-[#2C3E50] font-semibold text-sm mb-1">
											Drag & Drop your reference image here or <span class="text-[#00796B]">click to upload</span>
										</p>
										<p class="text-[#4B5563] text-xs mt-2">
											Accepts: .png, .jpg, .webp • Max size: 10MB
										</p>
										<input
											type="file"
											accept="image/*"
											onchange={handleReferenceFileSelect}
											class="hidden"
										/>
									</label>
								{/if}
							</div>

							<!-- Info Note -->
							<div class="flex items-start gap-2 mt-2 text-xs text-[#4B5563]">
								<span class="material-symbols-outlined text-[16px]">info</span>
								<p>
									Higher resolution images produce better results. We recommend at least 1024×1024px for best
									quality.
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Step 2: Configuration -->
				{#if step === 2}
					<div class="space-y-5">
						<!-- Optimize for Marketplaces -->
						<div data-tour="step2-marketplaces">
							<h3 class="text-[#2C3E50] font-bold text-base mb-1">Optimize for Marketplaces</h3>
							<p class="text-[#4B5563] text-xs mb-3">
								Select all relevant marketplaces for asset optimization.
							</p>

							<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
								{#each marketplaces as marketplace}
									<button
										onclick={() => toggleMarketplace(marketplace.id)}
										class={`relative p-3 rounded-lg border-2 transition-all text-center hover:border-[#00796B]/50 ${
											selectedMarketplaces.includes(marketplace.id)
												? 'border-[#00796B] bg-[#00796B]/5'
												: 'border-gray-200'
										}`}
									>
										{#if selectedMarketplaces.includes(marketplace.id)}
											<div
												class="absolute -top-2 -right-2 w-5 h-5 bg-[#00796B] rounded-full flex items-center justify-center"
											>
												<span class="material-symbols-outlined text-white text-[14px]">check</span>
											</div>
										{/if}

										<!-- Logo or Icon -->
										<div class="h-9 flex items-center justify-center mb-1">
											{#if marketplace.logo}
												<img
													src={marketplace.logo}
													alt={marketplace.label}
													class={`${marketplace.logoScale} w-auto object-contain`}
												/>
											{:else}
												<span class="material-symbols-outlined text-gray-400 text-4xl">storefront</span>
											{/if}
										</div>

										<p class="text-[#2C3E50] text-sm font-medium">{marketplace.label}</p>
									</button>
								{/each}
							</div>
						</div>

						<!-- AI Enhancements -->
						<div data-tour="step2-primary-mode">
							<h3 class="text-[#2C3E50] font-bold text-base mb-1 flex items-center gap-2">
								<span class="material-symbols-outlined text-[#00796B] text-[20px]">auto_awesome</span>
								AI Enhancements
							</h3>
							<p class="text-[#4B5563] text-xs mb-3">
								Select a primary tool, then add optional enhancements below.
							</p>

							<!-- Primary Mode: Segmented Toggle (4 buttons) -->
							<div class="grid grid-cols-2 sm:grid-cols-4 rounded-lg border-2 border-gray-200 overflow-hidden mb-3">
								<button
									onclick={() => setPrimaryMode('remove-background')}
									disabled={primaryModeLocked}
									class={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-sm font-semibold transition-all border-r border-b md:border-b-0 border-gray-200 ${
										primaryMode === 'remove-background'
											? 'bg-[#00796B] text-white'
											: primaryModeLocked
												? 'bg-gray-100 text-gray-300 cursor-not-allowed'
												: 'bg-white text-[#4B5563] hover:bg-gray-50'
									}`}
								>
									<div class="flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[18px]">layers_clear</span>
										<span>Remove BG</span>
									</div>
								</button>
								<button
									onclick={() => setPrimaryMode('stylize-background')}
									disabled={primaryModeLocked}
									class={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 text-sm font-semibold transition-all border-b md:border-b-0 md:border-r border-gray-200 ${
										primaryMode === 'stylize-background'
											? 'bg-[#00796B] text-white'
											: primaryModeLocked
												? 'bg-gray-100 text-gray-300 cursor-not-allowed'
												: 'bg-white text-[#4B5563] hover:bg-gray-50'
									}`}
								>
									<div class="flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[18px]">brush</span>
										<span>Stylize BG</span>
									</div>
									<span class={`text-[10px] font-normal leading-tight ${primaryMode === 'stylize-background' ? 'text-white/70' : 'text-gray-400'}`}>describe on next step</span>
								</button>
								<button
									onclick={() => setPrimaryMode('style-transfer')}
									disabled={!selectedReferenceFile}
									class={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-sm font-semibold transition-all border-r border-gray-200 ${
										primaryMode === 'style-transfer'
											? 'bg-[#00796B] text-white'
											: !selectedReferenceFile
												? 'bg-gray-50 text-gray-300 cursor-not-allowed'
												: 'bg-white text-[#4B5563] hover:bg-gray-50'
									}`}
								>
									<div class="flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[18px]">palette</span>
										<span>Style Transfer</span>
									</div>
								</button>
								<button
									onclick={() => setPrimaryMode('preset-vibe')}
									disabled={!selectedPresetVibe}
									class={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-sm font-semibold transition-all ${
										primaryMode === 'preset-vibe'
											? 'bg-[#00796B] text-white'
											: !selectedPresetVibe
												? 'bg-gray-50 text-gray-300 cursor-not-allowed'
												: 'bg-white text-[#4B5563] hover:bg-gray-50'
									}`}
								>
									<div class="flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[18px]">auto_fix_high</span>
										<span>Preset Vibe</span>
									</div>
								</button>
							</div>

							<!-- Primary mode description -->
							{#if primaryMode === 'remove-background'}
								<p class="text-xs text-[#4B5563] mb-3 text-center">Isolates your product on a transparent layer.</p>
							{:else if primaryMode === 'stylize-background'}
								<p class="text-xs text-[#4B5563] mb-3 text-center">Describe your custom background on the next step.</p>
							{:else if primaryMode === 'style-transfer'}
								<p class="text-xs text-[#4B5563] mb-3 text-center">Applies style from your reference image.</p>
							{:else if primaryMode === 'preset-vibe'}
								<p class="text-xs text-[#4B5563] mb-3 text-center">Applies <strong>{selectedPresetVibe?.name}</strong> style to your product.</p>
							{:else}
								<p class="text-xs text-gray-400 mb-3 text-center">Select a primary tool above to get started.</p>
							{/if}

							<!-- Add-on Enhancements -->
							<div data-tour="step2-addons" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{#each aiEnhancements.filter(e => e.id !== 'remove-background' && e.id !== 'stylize-background') as enhancement}
									{@const isExclusive = EXCLUSIVE_ADDONS.includes(enhancement.id)}
									{@const selectedExclusive = selectedAddOns.find(a => EXCLUSIVE_ADDONS.includes(a))}
									{@const isLockedByExclusive = isExclusive && selectedExclusive && selectedExclusive !== enhancement.id}
									{@const isMannequinLocked = enhancement.id === 'invisible-mannequin' && !mannequinAllowed}
									{@const isDisabled = !enhancement.available || isLockedByExclusive || isMannequinLocked}
									<button
										onclick={() => !isDisabled && toggleAddOn(enhancement.id)}
										disabled={isDisabled}
										class={`relative p-3 rounded-lg border-2 transition-all text-left ${
											isDisabled
												? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
												: selectedAddOns.includes(enhancement.id)
													? 'border-[#00796B] bg-[#00796B]/5 hover:border-[#00796B]/70'
													: 'border-gray-200 hover:border-[#00796B]/50'
										}`}
									>
										{#if selectedAddOns.includes(enhancement.id) && enhancement.available}
											<div
												class="absolute -top-2 -right-2 w-5 h-5 bg-[#00796B] rounded-full flex items-center justify-center"
											>
												<span class="material-symbols-outlined text-white text-[14px]">check</span>
											</div>
										{/if}

										<div class="flex items-start gap-2">
											<span class={`material-symbols-outlined text-[20px] ${!enhancement.available ? 'text-gray-400' : 'text-[#00796B]'}`}>
												{#if enhancement.id === 'upscale'}
													hd
												{:else if enhancement.id === 'animated-spin'}
													360
												{:else if enhancement.id === 'product-held-in-hands'}
													pan_tool
												{:else if enhancement.id === 'invisible-mannequin'}
													checkroom
												{:else}
													auto_fix_high
												{/if}
											</span>
											<div class="flex-1">
												<div class="flex items-center gap-2 mb-1">
													<p class={`font-semibold text-sm ${!enhancement.available ? 'text-gray-500' : 'text-[#2C3E50]'}`}>
														{enhancement.label}
													</p>
													{#if enhancement.badge}
														<span class={`text-[10px] font-bold px-2 py-0.5 rounded ${
															!enhancement.available
																? 'bg-gray-400 text-white'
																: 'bg-[#00796B] text-white'
														}`}>
															{enhancement.badge}
														</span>
													{/if}
													{#if enhancement.id === 'upscale' && upscaleAutoRecommended && selectedAddOns.includes('upscale')}
														<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-white">
															RECOMMENDED
														</span>
													{/if}
												</div>
												<p class={`text-xs leading-relaxed ${!enhancement.available ? 'text-gray-400' : 'text-[#4B5563]'}`}>
													{enhancement.description}
												</p>
												{#if enhancement.id === 'upscale' && upscaleAutoRecommended && selectedAddOns.includes('upscale') && classificationResult?.resolution}
													<p class="text-[11px] text-amber-700 mt-1 leading-snug">
														Your image is {classificationResult.resolution.width}x{classificationResult.resolution.height}px — we recommend upscaling for best results.
													</p>
												{/if}
												{#if enhancement.id === 'invisible-mannequin' && !mannequinAllowed && classificationResult}
													<p class="text-[11px] text-amber-700 mt-1 leading-snug">
														Only available for clothing and fashion items.
													</p>
												{/if}
											</div>
										</div>
									</button>
								{/each}

								<!-- More Tools Coming Soon -->
								<div class="p-3 rounded-lg bg-[#00796B] text-center col-span-2">
									<p class="text-white text-sm font-semibold">More Tools Coming Soon!</p>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Step 3: Refine -->
				{#if step === 3}
					<div class="space-y-5">
						<!-- Progress Bar -->
						<div class="w-full bg-gray-200 rounded-full h-2 mb-2">
							<div class="bg-[#00796B] h-2 rounded-full" style="width: 100%;"></div>
						</div>

						<!-- Apply a Style (only shown if coming from a preset link) -->
						{#if selectedPresetVibe}
							<div>
								<h3 class="text-[#2C3E50] font-bold text-base mb-1 flex items-center gap-2">
									<span class="material-symbols-outlined text-[#00796B]">palette</span>
									Applied Preset
								</h3>

								<div class="border-2 border-[#00796B] bg-[#00796B]/5 rounded-lg p-4">
									<div
										class="mb-3 p-4 rounded-lg flex items-center gap-3"
										style={`background: ${getPresetBackground(selectedPresetVibe.thumbnail)}`}
									>
										<div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center flex-shrink-0">
											<span class="material-symbols-outlined text-[#00796B] text-2xl">brush</span>
										</div>
										<div class="flex-1">
											<p class="text-white font-bold text-base">{selectedPresetVibe.name}</p>
											<p class="text-white/80 text-sm">by {selectedPresetVibe.creator}</p>
										</div>
										<button
											onclick={removePresetVibe}
											class="text-white/80 hover:text-white transition-colors"
											type="button"
										>
											<span class="material-symbols-outlined text-[20px]">close</span>
										</button>
									</div>
									<p class="text-[#4B5563] text-xs">
										This preset's style will be applied to your product image.
									</p>
								</div>
							</div>
						{/if}

						<!-- Style Transfer summary (reference image) -->
						{#if primaryMode === 'style-transfer' && referenceStyleAnalysis}
							<div>
								<h3 class="text-[#2C3E50] font-bold text-base mb-1 flex items-center gap-2">
									<span class="material-symbols-outlined text-[#00796B]">palette</span>
									Style Transfer
									<span class="text-xs font-semibold text-white bg-green-500 px-2 py-1 rounded">READY</span>
								</h3>
								<div class="border-2 border-[#00796B] bg-[#00796B]/5 rounded-lg p-4">
									<p class="text-sm text-[#2C3E50] mb-1 font-medium">{referenceStyleAnalysis.photography_style}</p>
									<p class="text-xs text-[#4B5563]">{referenceStyleAnalysis.style_description}</p>
								</div>
							</div>
						{/if}

						<!-- Stylize Background: Art Direction (only for custom stylize mode) -->
						{#if primaryMode === 'stylize-background'}
							<div>
								<h3 class="text-[#2C3E50] font-bold text-base mb-1 flex items-center gap-2">
									<span class="material-symbols-outlined text-[#00796B]">brush</span>
									Describe Your Background
									<span class="text-xs font-semibold text-[#00796B] bg-[#E8F5F4] px-2 py-1 rounded">REQUIRED</span>
								</h3>
								<p class="text-[#4B5563] text-xs mb-2">Tell us what background style you want for your product.</p>
								<textarea
									bind:value={aiPrompt}
									placeholder="e.g., Rustic wooden table with soft morning light, or Clean white marble surface with green plants..."
									rows="3"
									class="w-full border-2 border-gray-200 rounded-lg p-3 text-sm text-[#2C3E50] placeholder-gray-400 focus:border-[#00796B] focus:outline-none resize-none"
								></textarea>
								{#if aiPrompt.trim()}
									<p class="text-xs text-green-600 mt-1 flex items-center gap-1">
										<span class="material-symbols-outlined text-[14px]">check_circle</span>
										Background description set
									</p>
								{:else}
									<p class="text-xs text-amber-600 mt-1 flex items-center gap-1">
										<span class="material-symbols-outlined text-[14px]">warning</span>
										Please describe your desired background to continue
									</p>
								{/if}
							</div>
						{/if}

					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
				{#if step === 1}
					<button
						onclick={() => goto('/presets')}
						class="text-[#4B5563] hover:text-[#2C3E50] font-medium transition-colors"
					>
						Cancel
					</button>
				{:else}
					<button
						onclick={handleBack}
						class="flex items-center gap-2 text-[#4B5563] hover:text-[#2C3E50] font-medium transition-colors"
					>
						<span class="material-symbols-outlined text-[20px]">arrow_back</span>
						Back
					</button>
				{/if}

				{#if step < 3}
					<button
						onclick={handleNext}
						disabled={step === 1 && !selectedFile}
						class="flex items-center gap-2 bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2.5 px-5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Next Step
						<span class="material-symbols-outlined text-[20px]">arrow_forward</span>
					</button>
				{:else}
					<div class="flex items-center gap-3">
						{#if submitError}
							<p class="text-red-600 text-sm font-medium max-w-[300px] truncate" title={submitError}>
								<span class="material-symbols-outlined text-[16px] align-middle">error</span>
								{submitError}
							</p>
						{/if}
						<button
							data-tour="step3-generate"
							onclick={handleSubmit}
							disabled={isSubmitting}
							class="flex items-center gap-2 bg-[#00796B] hover:bg-[#00695C] text-white font-semibold py-2.5 px-5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<span class="material-symbols-outlined text-[20px]">{isSubmitting ? 'hourglass_empty' : 'auto_awesome'}</span>
							{isSubmitting ? 'Submitting...' : 'Generate Assets'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

{#if step === 1}
	<OnboardingTour tourId="job-step1" steps={jobStep1Tour} autoStart />
{:else if step === 2}
	<OnboardingTour tourId="job-step2" steps={jobStep2Tour} autoStart />
{:else if step === 3}
	<OnboardingTour tourId="job-step3" steps={jobStep3Tour} autoStart />
{/if}
