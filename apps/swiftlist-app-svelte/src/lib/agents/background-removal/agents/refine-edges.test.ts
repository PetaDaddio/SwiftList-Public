/**
 * Regression Guard: CleanEdge Edge Color Dilation
 * BUG-20260217-001
 *
 * These tests ensure CleanEdge can NEVER be accidentally disabled or gutted.
 * CleanEdge has been silently broken ~10 times by well-meaning refactors.
 *
 * refine-edges.ts is a LOCKED FILE — proven A-grade background removal recipe.
 * These tests guard its actual structure, NOT an aspirational "v2" rewrite.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REFINE_EDGES_PATH = resolve(__dirname, 'refine-edges.ts');

describe('CleanEdge Regression Guard (BUG-20260217-001)', () => {
	const sourceCode = readFileSync(REFINE_EDGES_PATH, 'utf-8');

	it('must NOT gate CleanEdge behind any severity threshold', () => {
		const severityGate = /if\s*\([^)]*severity\s*[><=!]+[^)]*\)\s*\{[^}]*Edge Color Dilation/s;
		expect(sourceCode.match(severityGate)).toBeNull();
	});

	it('must contain Edge Color Dilation logic (not removed)', () => {
		expect(sourceCode).toContain('OPAQUE_THRESHOLD');
		expect(sourceCode).toContain('EDGE_THRESHOLD');
		expect(sourceCode).toContain('SEARCH_RADIUS');
		expect(sourceCode).toContain('Edge Color Dilation');
	});

	it('must contain Soft Alpha Cleanup step', () => {
		expect(sourceCode).toContain('Soft Alpha Cleanup');
		expect(sourceCode).toContain('alpha >= 200');
	});

	it('must contain jewelry detection pipeline', () => {
		// The locked file has jewelry-specific edge handling — this must NOT be removed
		expect(sourceCode).toContain('detectGemstonesAndMetals');
		expect(sourceCode).toContain('detectFringing');
		expect(sourceCode).toContain('isJewelryProduct');
	});

	it('must import from edge-detection and jewelry-engine', () => {
		expect(sourceCode).toContain("from '../utils/edge-detection'");
		expect(sourceCode).toContain("from '../engines/jewelry-engine'");
	});

	it('must export edgeRefinementAgent function', () => {
		expect(sourceCode).toContain('export async function edgeRefinementAgent');
	});

	it('must NOT contain console.log or console.warn', () => {
		expect(sourceCode).not.toContain('console.log');
		expect(sourceCode).not.toContain('console.warn');
	});
});

describe('Product Type Fallback Consistency', () => {
	it('processor must use "general" as fallback, not "default"', () => {
		const processorPath = resolve(
			__dirname,
			'../../../../routes/api/jobs/process/+server.ts'
		);
		const processorCode = readFileSync(processorPath, 'utf-8');

		const dangerousDefault = /product_type\s*\|\|\s*['"]default['"]/;
		expect(processorCode.match(dangerousDefault)).toBeNull();
		expect(processorCode).toContain("product_type || 'general'");
	});
});
