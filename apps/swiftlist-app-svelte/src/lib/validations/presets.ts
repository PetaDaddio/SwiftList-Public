/**
 * Preset Validation Schemas
 */

import { z } from 'zod';

export const VALID_CATEGORIES = [
	'Vintage',
	'Jewelry',
	'Minimalist',
	'Eco-Friendly',
	'Tech',
	'Fashion',
	'Furniture',
	'Home',
	'3D Print'
] as const;

export const createPresetSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
	description: z
		.string()
		.min(1, 'Description is required')
		.max(500, 'Description must be 500 characters or less'),
	category: z.enum(VALID_CATEGORIES, { error: 'Invalid category' }),
	tags: z.array(z.string().max(50)).max(20).optional(),
	thumbnail_url: z.string().url().optional().nullable(),
	preset_config: z.record(z.string(), z.unknown()).optional(),
	is_public: z.boolean().optional().default(false)
});

export const updatePresetSchema = z
	.object({
		name: z.string().min(1).max(100).optional(),
		description: z.string().min(1).max(500).optional(),
		category: z.enum(VALID_CATEGORIES).optional(),
		tags: z.array(z.string().max(50)).max(20).optional(),
		is_public: z.boolean().optional(),
		thumbnail_url: z.string().url().optional().nullable(),
		preset_config: z.record(z.string(), z.unknown()).optional()
	})
	.refine((obj) => Object.keys(obj).length > 0, 'At least one field must be provided for update');

export const ensurePresetSchema = z.object({
	name: z.string().min(1, 'Preset name is required').max(100),
	category: z.enum(VALID_CATEGORIES, { error: 'Invalid category' }),
	stylePrompt: z.string().min(1, 'Style prompt is required').max(2000),
	description: z.string().max(500).optional(),
	backgroundColor: z.string().max(50).optional(),
	tags: z.array(z.string().max(50)).max(20).optional(),
	thumbnailUrl: z.string().max(500).optional()
});

export const favoriteSchema = z.object({
	preset_id: z.string().uuid('Invalid preset ID format')
});

export const usePresetSchema = z.object({
	job_id: z.string().uuid('Invalid job ID format')
});

export const followSchema = z.object({
	following_id: z.string().min(1, 'User ID is required')
});

export const reportSchema = z.object({
	reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be 500 characters or less')
});

export type CreatePresetData = z.infer<typeof createPresetSchema>;
export type UpdatePresetData = z.infer<typeof updatePresetSchema>;
export type EnsurePresetData = z.infer<typeof ensurePresetSchema>;
