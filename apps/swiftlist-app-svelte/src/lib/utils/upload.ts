/**
 * File upload utilities
 *
 * SECURITY: Files are uploaded to Supabase Storage with proper access controls
 */

import { createClient } from '$lib/supabase/client';

export interface UploadResult {
	url: string;
	path: string;
	error?: string;
}

export async function uploadImage(file: File, userId: string): Promise<UploadResult> {
	try {
		const supabase = createClient();

		// Generate unique filename
		const fileExt = file.name.split('.').pop();
		const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

		// Upload to Supabase Storage
		const { data, error } = await supabase.storage
			.from('job-uploads')
			.upload(fileName, file, {
				cacheControl: '3600',
				upsert: false
			});

		if (error) {
			console.error('Upload error:', error);
			return {
				url: '',
				path: '',
				error: error.message || 'Failed to upload file'
			};
		}

		// Get public URL
		const { data: urlData } = supabase.storage.from('job-uploads').getPublicUrl(data.path);

		return {
			url: urlData.publicUrl,
			path: data.path
		};
	} catch (error: any) {
		console.error('Upload error:', error);
		return {
			url: '',
			path: '',
			error: error.message || 'Failed to upload file'
		};
	}
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
