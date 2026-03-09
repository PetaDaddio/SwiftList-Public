#!/usr/bin/env node

/**
 * SwiftList Workflow Event Logging Integration Script
 * File: scripts/add-event-logging-to-workflows.js
 *
 * Purpose: Automatically add event logging nodes to all n8n workflows
 * - Inserts workflow_start event after webhook trigger
 * - Adds workflow_complete event before final database update
 * - Adds error_event logging in error trigger branches
 * - Updates jobs table with processing_time_seconds
 *
 * Usage:
 *   node scripts/add-event-logging-to-workflows.js --workflows-dir ./n8n-workflows --dry-run
 *   node scripts/add-event-logging-to-workflows.js --workflows-dir ./n8n-workflows --apply
 *
 * Author: Ralph Wiggum (AI Systems Architect)
 * Date: 2026-01-10
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  WORKFLOWS_DIRS: ['./n8n-workflows/json', './n8n-workflows'],
  BACKUP_DIR: './n8n-workflows/backups',
  DRY_RUN: true,
  VERBOSE: true
};

// Parse command line arguments
process.argv.forEach((arg, index) => {
  if (arg === '--workflows-dir' && process.argv[index + 1]) {
    CONFIG.WORKFLOWS_DIRS = [process.argv[index + 1]];
  }
  if (arg === '--apply') {
    CONFIG.DRY_RUN = false;
  }
  if (arg === '--dry-run') {
    CONFIG.DRY_RUN = true;
  }
  if (arg === '--quiet') {
    CONFIG.VERBOSE = false;
  }
});

// Logging utilities
function log(message, level = 'info') {
  if (!CONFIG.VERBOSE && level !== 'error') return;

  const prefix = {
    info: '✓',
    warn: '⚠️',
    error: '❌',
    debug: '🔍'
  }[level] || 'ℹ️';

  console.log(`${prefix} ${message}`);
}

/**
 * Create event logging node templates
 */
function createEventLoggingNodes(workflowId, webhookNodeName) {
  return {
    workflowStart: {
      parameters: {
        resource: "database",
        operation: "executeQuery",
        query: `INSERT INTO job_events (job_id, event_type, workflow_id, event_timestamp, metadata) VALUES ('{{ $('${webhookNodeName}').item.json.body.job_id }}', 'workflow_start', '${workflowId}', NOW(), '{"user_id": "{{ $('${webhookNodeName}').item.json.body.user_id }}"}'::jsonb) RETURNING *`
      },
      id: `log-workflow-start-${workflowId.toLowerCase()}`,
      name: "Event Log - Workflow Start",
      type: "n8n-nodes-base.postgres",
      typeVersion: 1,
      position: [0, 0], // Will be calculated based on webhook position
      credentials: {
        postgres: {
          id: "{{MISSING_CREDENTIAL_SUPABASE_POSTGRES}}",
          name: "Supabase PostgreSQL"
        }
      },
      notes: `🔍 JOB LOGGING\\nLogs workflow start event to job_events table\\nEnables execution timeline tracking for debugging\\n\\nWorkflow: ${workflowId}`
    },

    workflowComplete: {
      parameters: {
        jsCode: `// Calculate total workflow duration
const workflowStartTime = $('Event Log - Workflow Start').item.json.event_timestamp;
const currentTime = new Date();
const startTime = new Date(workflowStartTime);
const durationMs = currentTime - startTime;
const durationSeconds = Math.round(durationMs / 1000);

const jobId = $('${webhookNodeName}').item.json.body.job_id;
const workflowId = '${workflowId}';

return {
  job_id: jobId,
  workflow_id: workflowId,
  event_type: 'workflow_complete',
  duration_ms: durationMs,
  processing_time_seconds: durationSeconds,
  completed_at: currentTime.toISOString()
};`
      },
      id: `code-calc-duration-${workflowId.toLowerCase()}`,
      name: "Code - Calculate Workflow Duration",
      type: "n8n-nodes-base.code",
      typeVersion: 1,
      position: [0, 0],
      notes: "Calculates total workflow execution time from start event"
    },

    insertCompleteEvent: {
      parameters: {
        resource: "database",
        operation: "executeQuery",
        query: `INSERT INTO job_events (job_id, event_type, workflow_id, event_timestamp, duration_ms, metadata) VALUES ('{{ $json.job_id }}', 'workflow_complete', '{{ $json.workflow_id }}', NOW(), {{ $json.duration_ms }}, '{"completed_at": "{{ $json.completed_at }}"}'::jsonb)`
      },
      id: `log-workflow-complete-${workflowId.toLowerCase()}`,
      name: "Event Log - Workflow Complete",
      type: "n8n-nodes-base.postgres",
      typeVersion: 1,
      position: [0, 0],
      credentials: {
        postgres: {
          id: "{{MISSING_CREDENTIAL_SUPABASE_POSTGRES}}",
          name: "Supabase PostgreSQL"
        }
      },
      notes: `🔍 JOB LOGGING\\nLogs workflow completion event\\nRecords total execution time\\n\\nWorkflow: ${workflowId}`
    },

    updateProcessingTime: {
      parameters: {
        resource: "database",
        operation: "executeQuery",
        query: `UPDATE jobs SET processing_time_seconds = {{ $('Code - Calculate Workflow Duration').item.json.processing_time_seconds }}, completed_at = NOW() WHERE job_id = '{{ $('${webhookNodeName}').item.json.body.job_id }}'`
      },
      id: `update-processing-time-${workflowId.toLowerCase()}`,
      name: "Database - Update Processing Time",
      type: "n8n-nodes-base.postgres",
      typeVersion: 1,
      position: [0, 0],
      credentials: {
        postgres: {
          id: "{{MISSING_CREDENTIAL_SUPABASE_POSTGRES}}",
          "name": "Supabase PostgreSQL"
        }
      },
      notes: `⏱️ PROCESSING TIME TRACKING\\nUpdates jobs table with total processing time\\nEnables performance analytics\\n\\nWorkflow: ${workflowId}`
    },

    errorEvent: {
      parameters: {
        jsCode: `// Extract error details and prepare error event
const error = $input.item.json.error || {};
const jobId = $('${webhookNodeName}').item.json.body.job_id;
const workflowId = '${workflowId}';
const errorMessage = error.message || 'Unknown error';
const errorNode = error.node?.name || 'Unknown node';
const errorType = error.type || 'execution_error';

return {
  job_id: jobId,
  workflow_id: workflowId,
  event_type: 'error',
  metadata: {
    error_message: errorMessage,
    error_node: errorNode,
    error_type: errorType,
    timestamp: new Date().toISOString()
  }
};`
      },
      id: `code-prepare-error-${workflowId.toLowerCase()}`,
      name: "Code - Prepare Error Event",
      type: "n8n-nodes-base.code",
      typeVersion: 1,
      position: [0, 0],
      notes: "Extracts error details for logging to job_events"
    },

    insertErrorEvent: {
      parameters: {
        resource: "database",
        operation: "executeQuery",
        query: `INSERT INTO job_events (job_id, event_type, workflow_id, event_timestamp, metadata) VALUES ('{{ $json.job_id }}', 'error', '{{ $json.workflow_id }}', NOW(), '{{ JSON.stringify($json.metadata) }}'::jsonb)`
      },
      id: `log-error-${workflowId.toLowerCase()}`,
      name: "Event Log - Error Occurred",
      type: "n8n-nodes-base.postgres",
      typeVersion: 1,
      position: [0, 0],
      credentials: {
        postgres: {
          id: "{{MISSING_CREDENTIAL_SUPABASE_POSTGRES}}",
          name: "Supabase PostgreSQL"
        }
      },
      notes: `🔍 JOB LOGGING\\nLogs error events for debugging\\nEnables failure analysis\\n\\nWorkflow: ${workflowId}`
    }
  };
}

/**
 * Extract workflow ID from workflow name or filename
 */
function extractWorkflowId(workflow) {
  // Try to extract from workflow.name first
  const nameMatch = workflow.name?.match(/WF-\d+/);
  if (nameMatch) return nameMatch[0];

  // Fallback: return placeholder
  return 'WF-XX';
}

/**
 * Find webhook trigger node
 */
function findWebhookNode(workflow) {
  return workflow.nodes.find(node =>
    node.type === 'n8n-nodes-base.webhook' ||
    node.type === 'n8n-nodes-base.webhookTrigger'
  );
}

/**
 * Find error trigger node
 */
function findErrorTriggerNode(workflow) {
  return workflow.nodes.find(node =>
    node.type === 'n8n-nodes-base.errorTrigger'
  );
}

/**
 * Find the "Mark Job Completed" database update node
 */
function findJobCompletedNode(workflow) {
  return workflow.nodes.find(node =>
    node.type === 'n8n-nodes-base.postgres' &&
    (node.name?.includes('Completed') ||
     node.parameters?.query?.includes('UPDATE jobs SET status') ||
     node.parameters?.query?.includes("status = 'completed'"))
  );
}

/**
 * Check if workflow already has event logging
 */
function hasEventLogging(workflow) {
  return workflow.nodes.some(node =>
    node.name?.includes('Event Log') ||
    node.id?.includes('log-workflow-start') ||
    node.parameters?.query?.includes('INSERT INTO job_events')
  );
}

/**
 * Process a single workflow file
 */
function processWorkflow(filePath) {
  log(`Processing: ${path.basename(filePath)}`, 'debug');

  try {
    // Read workflow file
    const workflowContent = fs.readFileSync(filePath, 'utf-8');
    const workflow = JSON.parse(workflowContent);

    // Check if already has event logging
    if (hasEventLogging(workflow)) {
      log(`Skipping ${path.basename(filePath)} - already has event logging`, 'warn');
      return { skipped: true, reason: 'already_has_logging' };
    }

    // Extract workflow ID
    const workflowId = extractWorkflowId(workflow);
    if (workflowId === 'WF-XX') {
      log(`Warning: Could not extract workflow ID from ${path.basename(filePath)}`, 'warn');
    }

    // Find key nodes
    const webhookNode = findWebhookNode(workflow);
    const errorTriggerNode = findErrorTriggerNode(workflow);
    const jobCompletedNode = findJobCompletedNode(workflow);

    if (!webhookNode) {
      log(`Skipping ${path.basename(filePath)} - no webhook trigger found`, 'warn');
      return { skipped: true, reason: 'no_webhook_trigger' };
    }

    const webhookNodeName = webhookNode.name;

    // Create event logging nodes
    const eventNodes = createEventLoggingNodes(workflowId, webhookNodeName);

    // Calculate positions for new nodes
    const webhookPos = webhookNode.position || [250, 300];
    eventNodes.workflowStart.position = [webhookPos[0] + 200, webhookPos[1]];

    if (jobCompletedNode) {
      const completedPos = jobCompletedNode.position || [2000, 100];
      eventNodes.workflowComplete.position = [completedPos[0] - 400, completedPos[1]];
      eventNodes.insertCompleteEvent.position = [completedPos[0] - 200, completedPos[1]];
      eventNodes.updateProcessingTime.position = [completedPos[0], completedPos[1] + 100];
    }

    if (errorTriggerNode) {
      const errorPos = errorTriggerNode.position || [250, 700];
      eventNodes.errorEvent.position = [errorPos[0] + 200, errorPos[1]];
      eventNodes.insertErrorEvent.position = [errorPos[0] + 400, errorPos[1]];
    }

    // Add new nodes to workflow
    workflow.nodes.push(
      eventNodes.workflowStart,
      eventNodes.workflowComplete,
      eventNodes.insertCompleteEvent,
      eventNodes.updateProcessingTime,
      eventNodes.errorEvent,
      eventNodes.insertErrorEvent
    );

    // Update connections (simplified - manual connection recommended)
    // Note: Full connection logic would be complex, recommend manual verification

    // Add metadata
    workflow.meta = workflow.meta || {};
    workflow.meta.event_logging_added = true;
    workflow.meta.event_logging_version = '1.0.0';
    workflow.meta.event_logging_date = new Date().toISOString();

    // Save or preview
    if (CONFIG.DRY_RUN) {
      log(`[DRY RUN] Would update ${path.basename(filePath)}`, 'info');
      log(`  - Added ${Object.keys(eventNodes).length} event logging nodes`, 'info');
      log(`  - Workflow ID: ${workflowId}`, 'info');
      log(`  - Webhook node: ${webhookNodeName}`, 'info');
      return { processed: true, dryRun: true };
    } else {
      // Create backup
      const backupPath = path.join(CONFIG.BACKUP_DIR, `${path.basename(filePath)}.backup`);
      fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
      fs.writeFileSync(backupPath, workflowContent);
      log(`Created backup: ${backupPath}`, 'info');

      // Write updated workflow
      fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
      log(`Updated: ${path.basename(filePath)}`, 'info');
      return { processed: true, applied: true };
    }

  } catch (error) {
    log(`Error processing ${path.basename(filePath)}: ${error.message}`, 'error');
    return { error: true, message: error.message };
  }
}

/**
 * Main execution
 */
function main() {
  console.log('='.repeat(70));
  console.log('SwiftList Workflow Event Logging Integration Script');
  console.log('='.repeat(70));
  console.log(`Mode: ${CONFIG.DRY_RUN ? 'DRY RUN (preview only)' : 'APPLY (will modify files)'}`);
  console.log(`Workflow directories: ${CONFIG.WORKFLOWS_DIRS.join(', ')}`);
  console.log('='.repeat(70));
  console.log('');

  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    total: 0
  };

  // Process each directory
  CONFIG.WORKFLOWS_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) {
      log(`Directory not found: ${dir}`, 'warn');
      return;
    }

    const files = fs.readdirSync(dir).filter(f =>
      f.endsWith('.json') &&
      f.startsWith('WF-') &&
      !f.includes('backup')
    );

    log(`Found ${files.length} workflow files in ${dir}`, 'info');

    files.forEach(file => {
      const filePath = path.join(dir, file);
      results.total++;

      const result = processWorkflow(filePath);

      if (result.processed) results.processed++;
      if (result.skipped) results.skipped++;
      if (result.error) results.errors++;
    });
  });

  // Summary
  console.log('');
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total workflows: ${results.total}`);
  console.log(`Processed: ${results.processed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors}`);
  console.log('='.repeat(70));

  if (CONFIG.DRY_RUN) {
    console.log('');
    console.log('This was a DRY RUN. No files were modified.');
    console.log('To apply changes, run with --apply flag:');
    console.log('  node scripts/add-event-logging-to-workflows.js --apply');
  } else {
    console.log('');
    console.log('Files have been updated. Backups created in:', CONFIG.BACKUP_DIR);
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Review updated workflows in n8n editor');
    console.log('2. Manually verify node connections');
    console.log('3. Test workflow execution');
    console.log('4. Deploy to production n8n instance');
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { processWorkflow, createEventLoggingNodes };
