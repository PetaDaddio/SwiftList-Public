import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

import { lifeguardLogger } from '$lib/utils/logger';
import { incidentReportSchema } from '$lib/validations/lifeguard';

const log = lifeguardLogger.child({ route: '/api/lifeguard/report' });

// Load environment variables
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
const SLACK_WEBHOOK_URL = env.SLACK_WEBHOOK_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// Set aliases for consistency
const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL || '';

// Initialize Claude Sonnet
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// System prompt for Lifeguard analysis
const LIFEGUARD_SYSTEM_PROMPT = `You are Lifeguard, an AI debugging assistant for SwiftList, an AI-powered product image automation platform.

Your job:
1. Analyze error reports and identify the root cause
2. Suggest specific, actionable fixes
3. Recommend prevention steps to avoid similar issues

Context about SwiftList:
- Tech stack: SvelteKit, Supabase, BullMQ workers, Railway deployment
- Image processing: Replicate API, AWS S3 storage
- LLMs: Gemini Flash 2.5 (routing), Claude Haiku (assistant), Claude Sonnet (Lifeguard)
- Database: PostgreSQL with RLS policies
- Authentication: Supabase Auth

Be concise and technical. Focus on:
- What went wrong (root cause)
- How to fix it (specific code changes or config)
- How to prevent it (monitoring, validation, tests)

Format your response as:
ROOT CAUSE: [one sentence]
FIX: [specific steps, code snippets if relevant]
PREVENTION: [bullet points]`;

interface IncidentData {
	severity: string;
	category: string;
	error_message: string;
	error_stack?: string;
	error_code?: string;
	user_id?: string;
	job_id?: string;
	request_path?: string;
	request_method?: string;
	request_body?: Record<string, unknown>;
	environment?: string;
	user_agent?: string;
	response_time_ms?: number;
	memory_usage_mb?: number;
	cpu_usage_percent?: number;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// SECURITY: Require authentication.
		// This route uses SERVICE ROLE (bypasses RLS) and calls paid Claude Sonnet API.
		// Without auth, attackers can drain API credits and write arbitrary incident data.
		if (!locals.user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const body = await request.json();
		const parsed = incidentReportSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{ success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
				{ status: 400 }
			);
		}

		const incidentData: IncidentData = {
			...parsed.data,
			// SECURITY: Override user_id with authenticated user (never trust client-provided user_id)
			user_id: locals.user.id
		};
		log.info({ severity: incidentData.severity, category: incidentData.category }, 'Incident report received');

		// Step 1: Analyze error with Claude Sonnet
		let rootCause = '';
		let suggestedFix = '';
		let preventionSteps: string[] = [];

		if (anthropic) {
			try {
				const analysisPrompt = buildAnalysisPrompt(incidentData);

				const message = await anthropic.messages.create({
					model: 'claude-3-5-sonnet-20241022',
					max_tokens: 1000,
					system: LIFEGUARD_SYSTEM_PROMPT,
					messages: [
						{
							role: 'user',
							content: analysisPrompt
						}
					]
				});

				const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
				const parsed = parseAnalysisResponse(responseText);

				rootCause = parsed.rootCause;
				suggestedFix = parsed.fix;
				preventionSteps = parsed.prevention;
			} catch (err) {
				log.error({ err }, 'Claude Sonnet analysis failed');
				rootCause = 'Analysis failed - see error message for details';
				suggestedFix = 'Manual investigation required';
				preventionSteps = ['Add more error context', 'Check logs'];
			}
		} else {
			rootCause = 'Claude Sonnet not configured';
			suggestedFix = 'Configure ANTHROPIC_API_KEY';
			preventionSteps = ['Set up environment variables'];
		}

		// Step 2: Save incident to database
		let incidentId: string | null = null;

		if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
			try {
				const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/lifeguard_incidents`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						apikey: SUPABASE_SERVICE_ROLE_KEY,
						Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
						Prefer: 'return=representation'
					},
					body: JSON.stringify({
						severity: incidentData.severity,
						category: incidentData.category,
						error_message: incidentData.error_message,
						error_stack: incidentData.error_stack,
						error_code: incidentData.error_code,
						user_id: incidentData.user_id,
						job_id: incidentData.job_id,
						request_path: incidentData.request_path,
						request_method: incidentData.request_method,
						request_body: incidentData.request_body,
						environment: incidentData.environment || 'production',
						user_agent: incidentData.user_agent,
						response_time_ms: incidentData.response_time_ms,
						memory_usage_mb: incidentData.memory_usage_mb,
						cpu_usage_percent: incidentData.cpu_usage_percent,
						root_cause_analysis: rootCause,
						suggested_fix: suggestedFix,
						prevention_steps: preventionSteps
					})
				});

				if (supabaseResponse.ok) {
					const result = await supabaseResponse.json();
					incidentId = result[0]?.id;
				} else {
					log.error({ status: supabaseResponse.status }, 'Failed to save incident to database');
				}
			} catch (err) {
				log.error({ err }, 'Database save failed');
			}
		}

		// Step 3: Send Slack notification
		if (SLACK_WEBHOOK_URL) {
			try {
				await sendSlackNotification({
					incident_id: incidentId || 'unknown',
					severity: incidentData.severity,
					category: incidentData.category,
					error_message: incidentData.error_message,
					root_cause: rootCause,
					suggested_fix: suggestedFix,
					prevention_steps: preventionSteps,
					environment: incidentData.environment || 'production',
					request_path: incidentData.request_path
				});

				// Update incident to mark as notified
				if (incidentId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
					await fetch(`${SUPABASE_URL}/rest/v1/lifeguard_incidents?id=eq.${incidentId}`, {
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json',
							apikey: SUPABASE_SERVICE_ROLE_KEY,
							Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
						},
						body: JSON.stringify({
							slack_notified: true,
							slack_notification_sent_at: new Date().toISOString()
						})
					});
				}
			} catch (err) {
				log.error({ err }, 'Slack notification failed');
			}
		}

		return json({
			success: true,
			incident_id: incidentId
		});
	} catch (error) {
		log.error({ err: error }, 'Report processing failed');

		return json(
			{
				success: false,
				error: 'Failed to process error report'
			},
			{ status: 500 }
		);
	}
};

function buildAnalysisPrompt(incident: IncidentData): string {
	let prompt = `Analyze this error:\n\n`;
	prompt += `Error: ${incident.error_message}\n`;

	if (incident.error_stack) {
		prompt += `Stack: ${incident.error_stack}\n`;
	}

	if (incident.error_code) {
		prompt += `Code: ${incident.error_code}\n`;
	}

	prompt += `Category: ${incident.category}\n`;
	prompt += `Severity: ${incident.severity}\n`;

	if (incident.request_path) {
		prompt += `Path: ${incident.request_path}\n`;
	}

	if (incident.request_method) {
		prompt += `Method: ${incident.request_method}\n`;
	}

	if (incident.environment) {
		prompt += `Environment: ${incident.environment}\n`;
	}

	prompt += `\nProvide root cause analysis, fix suggestion, and prevention steps.`;

	return prompt;
}

function parseAnalysisResponse(text: string): {
	rootCause: string;
	fix: string;
	prevention: string[];
} {
	const lines = text.split('\n');
	let rootCause = '';
	let fix = '';
	const prevention: string[] = [];

	let currentSection = '';

	for (const line of lines) {
		if (line.startsWith('ROOT CAUSE:')) {
			currentSection = 'root';
			rootCause = line.replace('ROOT CAUSE:', '').trim();
		} else if (line.startsWith('FIX:')) {
			currentSection = 'fix';
			fix = line.replace('FIX:', '').trim();
		} else if (line.startsWith('PREVENTION:')) {
			currentSection = 'prevention';
		} else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
			if (currentSection === 'prevention') {
				prevention.push(line.trim().replace(/^[-•]\s*/, ''));
			}
		} else if (line.trim() && currentSection === 'fix') {
			fix += '\n' + line;
		}
	}

	// Fallback if parsing fails
	if (!rootCause) rootCause = text.substring(0, 200);
	if (!fix) fix = 'See full analysis above';

	return { rootCause, fix, prevention };
}

async function sendSlackNotification(data: {
	incident_id: string;
	severity: string;
	category: string;
	error_message: string;
	root_cause: string;
	suggested_fix: string;
	prevention_steps: string[];
	environment: string;
	request_path?: string;
}): Promise<void> {
	if (!SLACK_WEBHOOK_URL) return;

	const severityEmoji = {
		critical: '🚨',
		error: '❌',
		warning: '⚠️',
		info: 'ℹ️'
	}[data.severity] || '⚠️';

	const color = {
		critical: '#FF0000',
		error: '#FF6B6B',
		warning: '#FFA500',
		info: '#4A90E2'
	}[data.severity] || '#FFA500';

	const message: { text: string; blocks: any[] } = {
		text: `${severityEmoji} SwiftList Lifeguard Alert: ${data.severity.toUpperCase()} - ${data.category}`,
		blocks: [
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: `${severityEmoji} ${data.severity.toUpperCase()}: ${data.category}`
				}
			},
			{
				type: 'section',
				fields: [
					{
						type: 'mrkdwn',
						text: `*Environment:*\n${data.environment}`
					},
					{
						type: 'mrkdwn',
						text: `*Incident ID:*\n${data.incident_id}`
					}
				]
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Error:*\n\`\`\`${data.error_message}\`\`\``
				}
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Root Cause (AI Analysis):*\n${data.root_cause}`
				}
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Suggested Fix:*\n${data.suggested_fix}`
				}
			}
		]
	};

	if (data.prevention_steps.length > 0) {
		message.blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Prevention:*\n${data.prevention_steps.map((s) => `• ${s}`).join('\n')}`
			}
		});
	}

	if (data.request_path) {
		message.blocks.push({
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `Path: \`${data.request_path}\``
				}
			]
		});
	}

	await fetch(SLACK_WEBHOOK_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(message)
	});
}
