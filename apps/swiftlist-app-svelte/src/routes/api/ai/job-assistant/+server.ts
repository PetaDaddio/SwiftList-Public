import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { sanitizeAIPrompt } from '$lib/security/prompt-sanitizer';
import { aiLogger } from '$lib/utils/logger';

const log = aiLogger.child({ route: '/api/ai/job-assistant' });

const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
	log.error('ANTHROPIC_API_KEY is not set');
}

// Initialize Claude client
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// System prompt for the job assistant
const SYSTEM_PROMPT = `You are a helpful AI assistant for SwiftList, an AI-powered product image automation platform. You help users optimize their product images for various marketplaces.

Your role:
- Provide smart, actionable suggestions for image enhancements and marketplace optimization
- Be concise and friendly (2-3 sentences max)
- Focus on what will help the user sell more products
- Never mention costs, credits, or pricing
- Suggest specific enhancements based on their selections

Context about SwiftList features:
- Background Removal: Isolates product on transparent layer (great for Amazon, Shopify)
- High-Res Upscale: Enhances details up to 4K (essential for high-value products)
- Animated Spin: Creates 360° video from one image (boosts engagement)
- Lifestyle Scene: Places product in realistic setting (increases conversions on Etsy, Instagram)
- Product Held in Hands: AI generates hands holding the product (builds trust)
- Convert to SVG: Vectorizes logos and simple shapes (for scalable graphics)

Marketplace optimization tips:
- Amazon: Prefers clean white backgrounds, high resolution
- eBay: Benefits from multiple angles, lifestyle context
- Etsy: Loves lifestyle scenes, artistic presentations
- Facebook/Instagram: Lifestyle scenes perform best, authentic feel
- Pinterest: High-quality, aspirational imagery
- Poshmark: Model shots, lifestyle scenes
- Shopify: Flexible, but clean product shots + lifestyle mix

When giving suggestions:
1. Be specific about WHY a feature will help
2. Mention marketplace-specific benefits when relevant
3. Keep it actionable and positive
4. Don't overwhelm with too many suggestions at once`;

interface JobContext {
	enhancements: string[];
	marketplaces: string[];
	has_reference: boolean;
	product_type?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// SECURITY: Require authentication (calls paid Claude API)
		if (!locals.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const body = await request.json();

		// SECURITY: Validate input with Zod (prevents unbounded input + type safety)
		const assistantSchema = z.object({
			mode: z.enum(['proactive', 'interactive']),
			context: z.object({
				enhancements: z.array(z.string()).max(20).default([]),
				marketplaces: z.array(z.string()).max(10).default([]),
				has_reference: z.boolean().default(false),
				product_type: z.string().max(100).optional()
			}),
			user_question: z.string().max(500).optional()
		});

		const parseResult = assistantSchema.safeParse(body);
		if (!parseResult.success) {
			return json({ error: 'Invalid request data' }, { status: 400 });
		}

		const { mode, context, user_question: rawQuestion } = parseResult.data;

		// SECURITY: Sanitize user_question to prevent prompt injection
		let user_question = rawQuestion;
		if (user_question) {
			const sanitized = sanitizeAIPrompt(user_question);
			if (!sanitized.valid) {
				log.warn({ reason: sanitized.violations[0] }, 'User question failed prompt sanitization');
				return json({ error: 'Invalid question content' }, { status: 400 });
			}
			user_question = sanitized.sanitized;
		}

		// Check if Claude is available
		if (!anthropic) {
			return json({
				suggestion: "I'm here to help optimize your product images! Feel free to ask questions about which enhancements work best for your marketplaces.",
				action_buttons: [],
				fallback: true
			});
		}

		// Build context description
		const contextDescription = buildContextDescription(context);

		let userMessage: string;

		if (mode === 'proactive') {
			// Proactive mode: Generate smart suggestion based on current selections
			userMessage = `The user is creating a new job with these settings:
${contextDescription}

Provide a proactive, helpful suggestion. Format your response as:
SUGGESTION: [2-3 sentence suggestion]
ACTIONS: [comma-separated list of action IDs, or "none" if no specific actions]

Action IDs you can suggest:
- add_lifestyle_scene (if not selected and relevant)
- add_high_res_upscale (if not selected and relevant)
- add_animated_spin (if not selected and relevant)
- add_background_removal (if not selected and relevant)
- none (just informational suggestion)

Example format:
SUGGESTION: I noticed you're optimizing for Amazon and Etsy. Amazon prefers clean white backgrounds while Etsy shoppers love lifestyle scenes. Would you like to add both?
ACTIONS: add_lifestyle_scene, add_background_removal`;
		} else {
			// Interactive mode: Answer user question
			if (!user_question) {
				return json(
					{
						error: 'Missing required field: user_question for interactive mode'
					},
					{ status: 400 }
				);
			}

			userMessage = `The user is creating a job with these settings:
${contextDescription}

User question: "${user_question}"

Provide a helpful, concise answer (2-3 sentences max). Format as:
SUGGESTION: [your answer]
ACTIONS: none`;
		}

		// Call Claude Haiku
		const message = await anthropic.messages.create({
			model: 'claude-3-5-haiku-20241022',
			max_tokens: 300,
			system: SYSTEM_PROMPT,
			messages: [
				{
					role: 'user',
					content: userMessage
				}
			]
		});

		// Parse response
		const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
		const { suggestion, actions } = parseAssistantResponse(responseText);

		// Build action buttons
		const actionButtons = buildActionButtons(actions, context);

		return json({
			suggestion,
			action_buttons: actionButtons
		});
	} catch (error) {
		log.error({ err: error }, 'Job assistant failed');

		return json(
			{
				error: 'Failed to generate suggestion',
				fallback: {
					suggestion: "I'm here to help! Try asking about which enhancements work best for your selected marketplaces.",
					action_buttons: []
				}
			},
			{ status: 500 }
		);
	}
};

function buildContextDescription(context: JobContext): string {
	const parts: string[] = [];

	if (context.product_type) {
		parts.push(`Product type: ${context.product_type}`);
	}

	if (context.enhancements && context.enhancements.length > 0) {
		parts.push(`Selected enhancements: ${context.enhancements.join(', ')}`);
	} else {
		parts.push('No enhancements selected yet');
	}

	if (context.marketplaces && context.marketplaces.length > 0) {
		parts.push(`Target marketplaces: ${context.marketplaces.join(', ')}`);
	} else {
		parts.push('No marketplaces selected yet');
	}

	if (context.has_reference) {
		parts.push('User uploaded a reference image for style matching');
	}

	return parts.join('\n');
}

function parseAssistantResponse(text: string): { suggestion: string; actions: string[] } {
	const lines = text.split('\n');
	let suggestion = '';
	let actions: string[] = [];

	for (const line of lines) {
		if (line.startsWith('SUGGESTION:')) {
			suggestion = line.replace('SUGGESTION:', '').trim();
		} else if (line.startsWith('ACTIONS:')) {
			const actionsText = line.replace('ACTIONS:', '').trim();
			if (actionsText.toLowerCase() !== 'none') {
				actions = actionsText.split(',').map((a) => a.trim());
			}
		}
	}

	// Fallback if parsing fails
	if (!suggestion) {
		suggestion = text;
	}

	return { suggestion, actions };
}

function buildActionButtons(
	actions: string[],
	context: JobContext
): Array<{ label: string; action: string; enhancement_id?: string }> {
	const buttons: Array<{ label: string; action: string; enhancement_id?: string }> = [];

	const actionMap: Record<string, { label: string; enhancement_id: string }> = {
		add_lifestyle_scene: { label: 'Add Lifestyle Scene', enhancement_id: 'lifestyle-scene' },
		add_high_res_upscale: { label: 'Add High-Res Upscale', enhancement_id: 'high-res-upscale' },
		add_animated_spin: { label: 'Add Animated Spin', enhancement_id: 'animated-spin' },
		add_background_removal: { label: 'Add Background Removal', enhancement_id: 'remove-background' },
		add_product_held_in_hands: { label: 'Add Hand Holding', enhancement_id: 'product-held-in-hands' }
	};

	for (const action of actions) {
		const actionDef = actionMap[action];
		if (actionDef) {
			// Only add if not already selected
			if (!context.enhancements.includes(actionDef.enhancement_id)) {
				buttons.push({
					label: actionDef.label,
					action: 'add_enhancement',
					enhancement_id: actionDef.enhancement_id
				});
			}
		}
	}

	// Always add "No thanks" / "Got it" button
	buttons.push({
		label: buttons.length > 0 ? 'No thanks' : 'Got it',
		action: 'dismiss'
	});

	return buttons;
}
