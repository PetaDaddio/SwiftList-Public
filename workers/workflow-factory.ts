/**
 * Workflow Factory
 *
 * Routes jobs to the correct workflow implementation
 * - Validates workflow IDs
 * - Instantiates workflow classes dynamically
 * - Provides centralized workflow management
 */

import { Job } from 'bullmq';
import { BaseWorkflow, WorkflowJobData } from './base-workflow';
import { WORKFLOW_REGISTRY, isValidWorkflowId, getAllWorkflowIds } from './workflows';

export class WorkflowFactory {
  /**
   * Create a workflow instance for the given job
   */
  static createWorkflow(job: Job<WorkflowJobData>): BaseWorkflow {
    const workflowId = job.data.workflow_id;

    // Validate workflow ID
    if (!isValidWorkflowId(workflowId)) {
      throw new Error(
        `Unknown workflow ID: ${workflowId}. Available workflows: ${getAllWorkflowIds().join(', ')}`
      );
    }

    // Get workflow class from registry
    const WorkflowClass = WORKFLOW_REGISTRY[workflowId];

    // Instantiate and return workflow
    return new WorkflowClass(job) as BaseWorkflow;
  }

  /**
   * Get workflow metadata by ID
   */
  static getWorkflowMetadata(workflowId: string): {
    id: string;
    name: string;
    credits: number;
    phase: string;
  } | null {
    // Workflow pricing and metadata (server-side only - NEVER expose to client)
    const WORKFLOW_METADATA: Record<
      string,
      { id: string; name: string; credits: number; phase: string }
    > = {
      // Phase 1: Core Infrastructure
      'WF-01': { id: 'WF-01', name: 'The Decider (Orchestrator)', credits: 0, phase: 'Phase 1' },
      'WF-26': { id: 'WF-26', name: 'Billing & Top-Up', credits: 0, phase: 'Phase 1' },
      'WF-27': { id: 'WF-27', name: 'Referral Engine', credits: 0, phase: 'Phase 1' },
      'WF-07': { id: 'WF-07', name: 'Background Removal', credits: 5, phase: 'Phase 1' },

      // Phase 2: Essential Product Engines
      'WF-06': { id: 'WF-06', name: 'General Goods Engine', credits: 10, phase: 'Phase 2' },
      'WF-08': { id: 'WF-08', name: 'Simplify BG (White/Grey)', credits: 10, phase: 'Phase 2' },
      'WF-02': { id: 'WF-02', name: 'Jewelry Precision Engine', credits: 15, phase: 'Phase 2' },
      'WF-03': { id: 'WF-03', name: 'Fashion & Apparel Engine', credits: 20, phase: 'Phase 2' },
      'WF-04': { id: 'WF-04', name: 'Glass & Refraction Engine', credits: 12, phase: 'Phase 2' },
      'WF-05': { id: 'WF-05', name: 'Furniture & Spatial Engine', credits: 12, phase: 'Phase 2' },

      // Phase 3: Content Generation Suite
      'WF-10': { id: 'WF-10', name: 'Product Description', credits: 5, phase: 'Phase 3' },
      'WF-11': { id: 'WF-11', name: 'Twitter Post Generator', credits: 10, phase: 'Phase 3' },
      'WF-12': { id: 'WF-12', name: 'Instagram Post Generator', credits: 10, phase: 'Phase 3' },
      'WF-13': { id: 'WF-13', name: 'Facebook Post Generator', credits: 10, phase: 'Phase 3' },
      'WF-20': { id: 'WF-20', name: 'SEO Blog Post', credits: 10, phase: 'Phase 3' },

      // Phase 4: Image Enhancement Tools
      'WF-09': { id: 'WF-09', name: 'Lifestyle Setting', credits: 10, phase: 'Phase 4' },
      'WF-14': { id: 'WF-14', name: 'High-Res Upscale', credits: 10, phase: 'Phase 4' },
      'WF-19': { id: 'WF-19', name: 'Product Collage', credits: 20, phase: 'Phase 4' },
      'WF-15': { id: 'WF-15', name: 'Vector Model (Graphic)', credits: 11, phase: 'Phase 4' },
      'WF-16': { id: 'WF-16', name: 'Create SVG from Image', credits: 13, phase: 'Phase 4' },

      // Phase 5: Advanced Features
      'WF-17': { id: 'WF-17', name: 'Generate Preset', credits: 15, phase: 'Phase 5' },
      'WF-18': { id: 'WF-18', name: 'Animated Product', credits: 26, phase: 'Phase 5' },
      'WF-21': { id: 'WF-21', name: 'YouTube to TikTok', credits: 25, phase: 'Phase 5' },
      'WF-22': { id: 'WF-22', name: 'Blog to YouTube', credits: 25, phase: 'Phase 5' },

      // Phase 6: Marketplace & Operations
      'WF-23': { id: 'WF-23', name: 'Market Optimizer', credits: 10, phase: 'Phase 6' },
      'WF-25': { id: 'WF-25', name: 'eBay Compliance', credits: 0, phase: 'Phase 6' },
      'WF-24': { id: 'WF-24', name: 'Lifeguard Audit', credits: 0, phase: 'Phase 6' },
    };

    return WORKFLOW_METADATA[workflowId] || null;
  }

  /**
   * Calculate credit cost for a workflow (server-side only)
   */
  static getWorkflowCost(workflowId: string): number {
    const metadata = this.getWorkflowMetadata(workflowId);
    return metadata?.credits || 0;
  }

  /**
   * Get all available workflows with metadata
   */
  static getAllWorkflows() {
    return getAllWorkflowIds().map((id) => this.getWorkflowMetadata(id)).filter(Boolean);
  }

  /**
   * Validate job data before creating workflow
   */
  static validateJobData(jobData: WorkflowJobData): {
    valid: boolean;
    error?: string;
  } {
    // Check required fields
    if (!jobData.job_id) {
      return { valid: false, error: 'Missing job_id' };
    }

    if (!jobData.user_id) {
      return { valid: false, error: 'Missing user_id' };
    }

    if (!jobData.workflow_id) {
      return { valid: false, error: 'Missing workflow_id' };
    }

    if (!isValidWorkflowId(jobData.workflow_id)) {
      return {
        valid: false,
        error: `Invalid workflow_id: ${jobData.workflow_id}`
      };
    }

    if (!jobData.input_data) {
      return { valid: false, error: 'Missing input_data' };
    }

    // Validate credits charged matches expected cost
    const expectedCost = this.getWorkflowCost(jobData.workflow_id);
    if (jobData.credits_charged !== expectedCost) {
      return {
        valid: false,
        error: `Credit mismatch: expected ${expectedCost}, got ${jobData.credits_charged}`
      };
    }

    return { valid: true };
  }
}
