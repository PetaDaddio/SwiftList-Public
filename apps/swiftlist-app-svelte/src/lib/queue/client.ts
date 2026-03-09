/**
 * BullMQ Queue Client for SvelteKit
 *
 * Connects to Redis and submits jobs to BullMQ workers.
 * This runs on the server-side only (SvelteKit API routes).
 *
 * IMPORTANT: Must use $env/dynamic/private for environment variables in SvelteKit
 */

import { env } from '$env/dynamic/private';

/**
 * Job data structure matching BullMQ workers (BaseWorker.ts interface)
 *
 * MUST match: workers/src/core/BaseWorker.ts JobData interface
 */
export interface WorkerJobData {
	jobId: string; // Note: camelCase, not job_id
	userId: string;
	workflowId: string;
	inputUrl: string;
	parameters?: Record<string, unknown>;
}

/**
 * Submit a job to background removal queue via BullMQ
 *
 * Adds job to Redis queue — a separate Railway worker picks it up
 * and processes it asynchronously.
 *
 * @param jobData - Job data matching WorkerJobData interface
 * @param options - Optional BullMQ job options
 * @returns Job ID
 */
export async function submitBackgroundRemovalJob(
	jobData: WorkerJobData,
	options?: {
		priority?: number;
		delay?: number;
	}
): Promise<string> {
	// Fire-and-forget: the processing page triggers /api/jobs/process
	// which runs the full pipeline (CleanEdge, hands analysis, watermark, etc.)
	// BullMQ worker is deployed but not yet feature-complete for production jobs.
	try {
		const origin = env.ORIGIN || 'http://localhost:5173';
		fetch(`${origin}/api/jobs/process`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ job_id: jobData.jobId })
		}).catch(() => {
			// Fire-and-forget — processing page will also trigger this
		});
	} catch {
		// Non-fatal: processing page handles the actual trigger
	}

	return jobData.jobId;
}

/**
 * Generic job submission (placeholder for future BullMQ integration)
 *
 * TODO: When BullMQ worker supports full processing pipeline,
 * switch to real queue submission here.
 */
export async function submitJob(
	queueName: string,
	jobData: WorkerJobData,
	options?: {
		priority?: number;
		delay?: number;
	}
): Promise<string> {
	// Currently delegates to the same fire-and-forget pattern
	return submitBackgroundRemovalJob(jobData, options);
}

/**
 * Get workflow cost (credits required)
 */
export function getWorkflowCost(workflowId: string): number {
	const WORKFLOW_COSTS: Record<string, number> = {
		// Phase 1: Core Infrastructure
		'WF-01': 0,
		'WF-26': 0,
		'WF-27': 0,
		'WF-07': 5, // Background Removal

		// Phase 2: Essential Product Engines
		'WF-06': 10,
		'WF-08': 10,
		'WF-02': 15,
		'WF-03': 20,
		'WF-04': 12,
		'WF-05': 12,

		// Phase 3: Content Generation Suite
		'WF-10': 5, // Product Description
		'WF-11': 10,
		'WF-12': 10,
		'WF-13': 10,
		'WF-20': 10,

		// Phase 4: Image Enhancement Tools
		'WF-09': 10,
		'WF-14': 10, // Image Upscale
		'WF-19': 20,
		'WF-15': 11,
		'WF-16': 13,

		// Phase 5: Advanced Features
		'WF-17': 15, // Generate Preset
		'WF-18': 26,
		'WF-21': 25,
		'WF-22': 25,

		// Phase 6: Marketplace & Operations
		'WF-23': 10,
		'WF-25': 0,
		'WF-24': 0
	};

	return WORKFLOW_COSTS[workflowId] || 10;
}

/**
 * Get workflow metadata
 */
export function getWorkflowMetadata(workflowId: string): {
	id: string;
	name: string;
	credits: number;
	phase: string;
} | null {
	const WORKFLOW_METADATA: Record<
		string,
		{ id: string; name: string; credits: number; phase: string }
	> = {
		'WF-01': { id: 'WF-01', name: 'The Decider (Orchestrator)', credits: 0, phase: 'Phase 1' },
		'WF-26': { id: 'WF-26', name: 'Billing & Top-Up', credits: 0, phase: 'Phase 1' },
		'WF-27': { id: 'WF-27', name: 'Referral Engine', credits: 0, phase: 'Phase 1' },
		'WF-07': { id: 'WF-07', name: 'Background Removal', credits: 5, phase: 'Phase 1' },

		'WF-06': { id: 'WF-06', name: 'General Goods Engine', credits: 10, phase: 'Phase 2' },
		'WF-08': { id: 'WF-08', name: 'Simplify BG (White/Grey)', credits: 10, phase: 'Phase 2' },
		'WF-02': { id: 'WF-02', name: 'Jewelry Precision Engine', credits: 15, phase: 'Phase 2' },
		'WF-03': { id: 'WF-03', name: 'Fashion & Apparel Engine', credits: 20, phase: 'Phase 2' },
		'WF-04': { id: 'WF-04', name: 'Glass & Refraction Engine', credits: 12, phase: 'Phase 2' },
		'WF-05': { id: 'WF-05', name: 'Furniture & Spatial Engine', credits: 12, phase: 'Phase 2' },

		'WF-10': { id: 'WF-10', name: 'Product Description', credits: 5, phase: 'Phase 3' },
		'WF-11': { id: 'WF-11', name: 'Twitter Post Generator', credits: 10, phase: 'Phase 3' },
		'WF-12': { id: 'WF-12', name: 'Instagram Post Generator', credits: 10, phase: 'Phase 3' },
		'WF-13': { id: 'WF-13', name: 'Facebook Post Generator', credits: 10, phase: 'Phase 3' },
		'WF-20': { id: 'WF-20', name: 'SEO Blog Post', credits: 10, phase: 'Phase 3' },

		'WF-09': { id: 'WF-09', name: 'Lifestyle Setting', credits: 10, phase: 'Phase 4' },
		'WF-14': { id: 'WF-14', name: 'High-Res Upscale', credits: 10, phase: 'Phase 4' },
		'WF-19': { id: 'WF-19', name: 'Product Collage', credits: 20, phase: 'Phase 4' },
		'WF-15': { id: 'WF-15', name: 'Vector Model (Graphic)', credits: 11, phase: 'Phase 4' },
		'WF-16': { id: 'WF-16', name: 'Create SVG from Image', credits: 13, phase: 'Phase 4' },

		'WF-17': { id: 'WF-17', name: 'Generate Preset', credits: 15, phase: 'Phase 5' },
		'WF-18': { id: 'WF-18', name: 'Animated Product', credits: 26, phase: 'Phase 5' },
		'WF-21': { id: 'WF-21', name: 'YouTube to TikTok', credits: 25, phase: 'Phase 5' },
		'WF-22': { id: 'WF-22', name: 'Blog to YouTube', credits: 25, phase: 'Phase 5' },

		'WF-23': { id: 'WF-23', name: 'Market Optimizer', credits: 10, phase: 'Phase 6' },
		'WF-25': { id: 'WF-25', name: 'eBay Compliance', credits: 0, phase: 'Phase 6' },
		'WF-24': { id: 'WF-24', name: 'Lifeguard Audit', credits: 0, phase: 'Phase 6' }
	};

	return WORKFLOW_METADATA[workflowId] || null;
}
