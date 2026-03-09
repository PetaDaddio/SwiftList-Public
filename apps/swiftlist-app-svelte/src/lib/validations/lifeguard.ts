/**
 * Lifeguard Report Validation Schema
 */

import { z } from 'zod';

export const incidentReportSchema = z.object({
	severity: z.enum(['critical', 'error', 'warning', 'info']),
	category: z.string().min(1).max(100),
	error_message: z.string().min(1).max(5000),
	error_stack: z.string().max(10000).optional(),
	error_code: z.string().max(100).optional(),
	job_id: z.string().uuid().optional(),
	request_path: z.string().max(500).optional(),
	request_method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).optional(),
	request_body: z.record(z.string(), z.unknown()).optional(),
	environment: z.enum(['production', 'staging', 'development']).optional(),
	user_agent: z.string().max(500).optional(),
	response_time_ms: z.number().min(0).optional(),
	memory_usage_mb: z.number().min(0).optional(),
	cpu_usage_percent: z.number().min(0).max(100).optional()
});

export type IncidentReportData = z.infer<typeof incidentReportSchema>;
