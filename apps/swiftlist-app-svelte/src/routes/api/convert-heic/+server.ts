/**
 * HEIC to JPEG Conversion API Endpoint
 * POST /api/convert-heic
 *
 * Converts HEIC/HEIF images to JPEG using macOS sips (native HEIC support)
 * Falls back to Sharp if sips is not available
 *
 * SECURITY:
 * - Authentication required
 * - Max file size: 15MB
 * - Only accepts HEIC/HEIF files
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

const execAsync = promisify(exec);

// Max file size: 15MB (HEIC files can be large)
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// 1. Authentication check
		if (!locals.user) {
			throw error(401, 'Unauthorized - Please sign in');
		}

		// 2. Parse form data
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			throw error(400, 'No file provided');
		}

		// 3. Validate file size
		if (file.size > MAX_FILE_SIZE) {
			throw error(400, `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
		}

		// 4. Validate file type
		const isHeic = file.type.toLowerCase().includes('heic') ||
			file.type.toLowerCase().includes('heif') ||
			file.name.toLowerCase().endsWith('.heic') ||
			file.name.toLowerCase().endsWith('.heif');

		if (!isHeic) {
			throw error(400, 'Only HEIC/HEIF files can be converted');
		}

		// 5. Convert to buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// 6. Try sips (macOS native tool with HEIC support)
		try {
			const jpegBuffer = await convertWithSips(buffer, file.name);

			// Return as base64 data URL
			const base64 = jpegBuffer.toString('base64');
			const dataUrl = `data:image/jpeg;base64,${base64}`;
			const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

			return json({
				success: true,
				data: dataUrl,
				filename: newFileName,
				contentType: 'image/jpeg',
				originalSize: file.size,
				convertedSize: jpegBuffer.length
			});
		} catch (sipsError: any) {
		}

		// 7. Fallback to Sharp (may not work for all HEIC variants)
		try {
			const sharp = (await import('sharp')).default;
			const jpegBuffer = await sharp(buffer)
				.jpeg({ quality: 92 })
				.toBuffer();

			const base64 = jpegBuffer.toString('base64');
			const dataUrl = `data:image/jpeg;base64,${base64}`;
			const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

			return json({
				success: true,
				data: dataUrl,
				filename: newFileName,
				contentType: 'image/jpeg',
				originalSize: file.size,
				convertedSize: jpegBuffer.length
			});
		} catch (sharpError: any) {
			throw error(400, 'This HEIC format could not be converted. Please save as JPEG on your device first.');
		}
	} catch (err: any) {

		// Re-throw SvelteKit errors
		if (err.status) {
			throw err;
		}

		throw error(500, `Conversion failed: ${err.message || 'Unknown error'}`);
	}
};

/**
 * Convert HEIC to JPEG using macOS sips command
 * sips has native HEIC support on macOS
 */
async function convertWithSips(buffer: Buffer, originalName: string): Promise<Buffer> {
	// Create temp directory for conversion
	const tempDir = join(tmpdir(), 'swiftlist-heic');
	await mkdir(tempDir, { recursive: true });

	const uniqueId = crypto.randomBytes(8).toString('hex');
	const inputPath = join(tempDir, `${uniqueId}-input.heic`);
	const outputPath = join(tempDir, `${uniqueId}-output.jpg`);

	try {
		// Write input file
		await writeFile(inputPath, buffer);

		// Run sips conversion
		// sips -s format jpeg input.heic --out output.jpg
		await execAsync(`sips -s format jpeg "${inputPath}" --out "${outputPath}"`, {
			timeout: 30000 // 30 second timeout
		});

		// Read converted file
		const jpegBuffer = await readFile(outputPath);

		if (jpegBuffer.length === 0) {
			throw new Error('sips produced empty output');
		}

		return jpegBuffer;
	} finally {
		// Cleanup temp files
		try {
			await unlink(inputPath).catch(() => {});
			await unlink(outputPath).catch(() => {});
		} catch {
			// Ignore cleanup errors
		}
	}
}
