/**
 * SVG Tracer Utilities
 *
 * Pure functions for bitmap-to-SVG vector tracing.
 * Extracted from convert-to-svg endpoint for testability.
 *
 * No external dependencies — uses threshold-based contour detection
 * + Ramer-Douglas-Peucker path simplification + SVG path generation.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Point {
	x: number;
	y: number;
}

export interface ColorCluster {
	r: number;
	g: number;
	b: number;
	hex: string;
}

// ============================================================================
// BINARY BITMAP
// ============================================================================

/**
 * Convert raw RGBA pixel data to a binary (black/white) bitmap.
 * Pixels below the luminance threshold are considered "foreground" (true).
 * Transparent pixels (alpha < 128) are treated as white/background.
 */
export function toBinaryBitmap(
	pixels: Uint8Array,
	width: number,
	height: number,
	threshold: number
): boolean[][] {
	const bitmap: boolean[][] = [];
	for (let y = 0; y < height; y++) {
		bitmap[y] = [];
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;
			const r = pixels[idx];
			const g = pixels[idx + 1];
			const b = pixels[idx + 2];
			const a = pixels[idx + 3];
			// Luminance calculation, treating transparent as white
			const luminance = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
			bitmap[y][x] = luminance < threshold;
		}
	}
	return bitmap;
}

/**
 * Create a binary bitmap for a specific color cluster.
 * Pixels within `tolerance` distance of the cluster color are foreground.
 */
export function toBinaryBitmapForColor(
	pixels: Uint8Array,
	width: number,
	height: number,
	cluster: ColorCluster,
	tolerance: number
): boolean[][] {
	const bitmap: boolean[][] = [];
	for (let y = 0; y < height; y++) {
		bitmap[y] = [];
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;
			const r = pixels[idx];
			const g = pixels[idx + 1];
			const b = pixels[idx + 2];
			const a = pixels[idx + 3];
			if (a < 128) {
				bitmap[y][x] = false;
				continue;
			}
			const dr = r - cluster.r;
			const dg = g - cluster.g;
			const db = b - cluster.b;
			const dist = Math.sqrt(dr * dr + dg * dg + db * db);
			bitmap[y][x] = dist <= tolerance;
		}
	}
	return bitmap;
}

// ============================================================================
// CONTOUR TRACING
// ============================================================================

/**
 * Trace contours using a simplified marching squares / boundary following approach.
 * Returns arrays of points representing closed contour paths.
 */
export function traceContours(bitmap: boolean[][], width: number, height: number): Point[][] {
	const visited = new Set<string>();
	const contours: Point[][] = [];

	// Direction vectors for marching (right, down, left, up)
	const dx = [1, 0, -1, 0];
	const dy = [0, 1, 0, -1];

	function getPixel(x: number, y: number): boolean {
		if (x < 0 || x >= width || y < 0 || y >= height) return false;
		return bitmap[y][x];
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			// Find boundary pixels (black pixel adjacent to white/edge)
			if (!getPixel(x, y)) continue;

			const key = `${x},${y}`;
			if (visited.has(key)) continue;

			// Check if this is a boundary pixel
			const isBoundary =
				!getPixel(x - 1, y) ||
				!getPixel(x + 1, y) ||
				!getPixel(x, y - 1) ||
				!getPixel(x, y + 1);

			if (!isBoundary) continue;

			// Trace this contour using boundary following
			const contour: Point[] = [];
			let cx = x;
			let cy = y;
			let dir = 0; // Start moving right

			const maxSteps = width * height * 2;
			let steps = 0;

			do {
				const ckey = `${cx},${cy}`;
				if (!visited.has(ckey)) {
					contour.push({ x: cx, y: cy });
					visited.add(ckey);
				}

				// Turn right, then try each direction
				let found = false;
				const startDir = (dir + 3) % 4; // Turn right first
				for (let i = 0; i < 4; i++) {
					const tryDir = (startDir + i) % 4;
					const nx = cx + dx[tryDir];
					const ny = cy + dy[tryDir];
					if (getPixel(nx, ny)) {
						cx = nx;
						cy = ny;
						dir = tryDir;
						found = true;
						break;
					}
				}

				if (!found) break;
				steps++;
			} while ((cx !== x || cy !== y) && steps < maxSteps);

			// Only keep contours with enough points to be meaningful
			if (contour.length >= 4) {
				contours.push(contour);
			}
		}
	}

	return contours;
}

// ============================================================================
// PATH SIMPLIFICATION (Ramer-Douglas-Peucker)
// ============================================================================

/**
 * Calculate the perpendicular distance from a point to a line segment.
 */
export function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
	const ddx = lineEnd.x - lineStart.x;
	const ddy = lineEnd.y - lineStart.y;
	const lenSq = ddx * ddx + ddy * ddy;

	if (lenSq === 0) {
		const pdx = point.x - lineStart.x;
		const pdy = point.y - lineStart.y;
		return Math.sqrt(pdx * pdx + pdy * pdy);
	}

	const num = Math.abs(ddy * point.x - ddx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
	return num / Math.sqrt(lenSq);
}

/**
 * Simplify a contour path using the Ramer-Douglas-Peucker algorithm.
 * Reduces point count while preserving shape within epsilon tolerance.
 */
export function simplifyPath(points: Point[], epsilon: number): Point[] {
	if (points.length <= 2) return points;

	// Find the point with the maximum distance from the line between first and last
	let maxDist = 0;
	let maxIdx = 0;
	const first = points[0];
	const last = points[points.length - 1];

	for (let i = 1; i < points.length - 1; i++) {
		const dist = perpendicularDistance(points[i], first, last);
		if (dist > maxDist) {
			maxDist = dist;
			maxIdx = i;
		}
	}

	if (maxDist > epsilon) {
		const left = simplifyPath(points.slice(0, maxIdx + 1), epsilon);
		const right = simplifyPath(points.slice(maxIdx), epsilon);
		return [...left.slice(0, -1), ...right];
	}

	return [first, last];
}

// ============================================================================
// SVG PATH GENERATION
// ============================================================================

/**
 * Convert contour point arrays to an SVG path data string.
 * Each contour becomes a closed path (M...L...Z).
 */
export function contoursToSvgPaths(contours: Point[][]): string {
	return contours
		.map((contour) => {
			if (contour.length < 2) return '';
			const start = contour[0];
			const rest = contour.slice(1);
			return `M${start.x},${start.y} ${rest.map((p) => `L${p.x},${p.y}`).join(' ')} Z`;
		})
		.filter(Boolean)
		.join(' ');
}

// ============================================================================
// K-MEANS COLOR QUANTIZATION
// ============================================================================

/**
 * Simple K-means color quantization.
 * Groups pixel colors into k clusters and returns the dominant colors.
 */
export function quantizeColors(
	pixels: Uint8Array,
	width: number,
	height: number,
	k: number,
	maxIterations: number = 20
): ColorCluster[] {
	// Sample pixels (skip transparent ones)
	const samples: [number, number, number][] = [];
	const step = Math.max(1, Math.floor((width * height) / 5000)); // Sample up to ~5000 pixels
	for (let i = 0; i < width * height; i += step) {
		const idx = i * 4;
		if (pixels[idx + 3] < 128) continue; // Skip transparent
		samples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
	}

	if (samples.length < k) {
		// Not enough non-transparent pixels
		return [{ r: 0, g: 0, b: 0, hex: '#000000' }];
	}

	// Initialize centroids by picking evenly spaced samples
	const centroids: [number, number, number][] = [];
	for (let i = 0; i < k; i++) {
		const idx = Math.floor((i * samples.length) / k);
		centroids.push([...samples[idx]]);
	}

	// K-means iterations
	for (let iter = 0; iter < maxIterations; iter++) {
		// Assign samples to nearest centroid
		const clusters: [number, number, number][][] = Array.from({ length: k }, () => []);

		for (const sample of samples) {
			let minDist = Infinity;
			let bestCluster = 0;
			for (let c = 0; c < k; c++) {
				const dr = sample[0] - centroids[c][0];
				const dg = sample[1] - centroids[c][1];
				const db = sample[2] - centroids[c][2];
				const dist = dr * dr + dg * dg + db * db;
				if (dist < minDist) {
					minDist = dist;
					bestCluster = c;
				}
			}
			clusters[bestCluster].push(sample);
		}

		// Update centroids
		let converged = true;
		for (let c = 0; c < k; c++) {
			if (clusters[c].length === 0) continue;
			const newR = Math.round(clusters[c].reduce((s, p) => s + p[0], 0) / clusters[c].length);
			const newG = Math.round(clusters[c].reduce((s, p) => s + p[1], 0) / clusters[c].length);
			const newB = Math.round(clusters[c].reduce((s, p) => s + p[2], 0) / clusters[c].length);

			if (newR !== centroids[c][0] || newG !== centroids[c][1] || newB !== centroids[c][2]) {
				converged = false;
			}
			centroids[c] = [newR, newG, newB];
		}

		if (converged) break;
	}

	// Convert centroids to ColorCluster objects, sorted by frequency (largest cluster first)
	const clusterSizes: { cluster: ColorCluster; size: number }[] = [];

	// One more pass to count sizes
	const counts = new Array(k).fill(0);
	for (const sample of samples) {
		let minDist = Infinity;
		let bestCluster = 0;
		for (let c = 0; c < k; c++) {
			const dr = sample[0] - centroids[c][0];
			const dg = sample[1] - centroids[c][1];
			const db = sample[2] - centroids[c][2];
			const dist = dr * dr + dg * dg + db * db;
			if (dist < minDist) {
				minDist = dist;
				bestCluster = c;
			}
		}
		counts[bestCluster]++;
	}

	for (let c = 0; c < k; c++) {
		if (counts[c] === 0) continue;
		const [r, g, b] = centroids[c];
		const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
		clusterSizes.push({ cluster: { r, g, b, hex }, size: counts[c] });
	}

	clusterSizes.sort((a, b) => b.size - a.size);
	return clusterSizes.map((cs) => cs.cluster);
}

// ============================================================================
// SVG DOCUMENT GENERATION
// ============================================================================

/**
 * Generate a complete SVG document with a single monochrome path.
 */
export function generateMonoSvg(
	pathData: string,
	width: number,
	height: number
): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <path d="${pathData}" fill="#000000" fill-rule="evenodd"/>
</svg>`;
}

/**
 * Generate a complete SVG document with multiple colored paths.
 */
export function generateColorSvg(
	colorPaths: { color: string; pathData: string }[],
	width: number,
	height: number
): string {
	const paths = colorPaths
		.filter((cp) => cp.pathData.length > 0)
		.map((cp) => `  <path d="${cp.pathData}" fill="${cp.color}" fill-rule="evenodd"/>`)
		.join('\n');

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${paths}
</svg>`;
}
