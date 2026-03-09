/**
 * A/B Testing Statistical Analysis
 * Chi-squared test for multi-variant experiments (A/B/C/D/...)
 */

export interface VariantStats {
	variant: string;
	impressions: number;
	conversions: number;
	rate: number;
	liftVsControl: number | null;
}

export interface ExperimentResults {
	variants: VariantStats[];
	isSignificant: boolean;
	pValue: number | null;
	hasEnoughData: boolean;
	minSampleSize: number;
}

/**
 * Compute experiment results with statistical significance.
 * Uses chi-squared test for independence across all variants.
 *
 * @param data - Array of { variant, impressions, conversions } per variant
 * @param minImpressions - Minimum impressions per variant before testing (default: 100)
 */
export function computeExperimentResults(
	data: Array<{ variant: string; impressions: number; conversions: number }>,
	minImpressions = 100
): ExperimentResults {
	const variants: VariantStats[] = data.map((d) => ({
		variant: d.variant,
		impressions: d.impressions,
		conversions: d.conversions,
		rate: d.impressions > 0 ? d.conversions / d.impressions : 0,
		liftVsControl: null
	}));

	// Calculate lift vs control (first variant)
	const controlRate = variants[0]?.rate ?? 0;
	for (let i = 1; i < variants.length; i++) {
		if (controlRate > 0) {
			variants[i].liftVsControl = (variants[i].rate - controlRate) / controlRate;
		}
	}

	// Check minimum sample size
	const hasEnoughData = variants.every((v) => v.impressions >= minImpressions);

	if (!hasEnoughData || variants.length < 2) {
		return {
			variants,
			isSignificant: false,
			pValue: null,
			hasEnoughData,
			minSampleSize: minImpressions
		};
	}

	// Chi-squared test for independence
	const pValue = chiSquaredTest(variants);
	const isSignificant = pValue !== null && pValue < 0.05;

	return {
		variants,
		isSignificant,
		pValue,
		hasEnoughData,
		minSampleSize: minImpressions
	};
}

/**
 * Chi-squared test for a 2×N contingency table.
 * Rows: converted / not-converted
 * Columns: each variant
 *
 * Returns p-value or null if test cannot be performed.
 */
function chiSquaredTest(variants: VariantStats[]): number | null {
	const k = variants.length; // Number of variants
	if (k < 2) return null;

	const totalImpressions = variants.reduce((s, v) => s + v.impressions, 0);
	const totalConversions = variants.reduce((s, v) => s + v.conversions, 0);
	const totalNonConversions = totalImpressions - totalConversions;

	if (totalImpressions === 0 || totalConversions === 0 || totalNonConversions === 0) {
		return null;
	}

	let chiSquared = 0;

	for (const v of variants) {
		const observedConv = v.conversions;
		const observedNonConv = v.impressions - v.conversions;

		const expectedConv = (v.impressions * totalConversions) / totalImpressions;
		const expectedNonConv = (v.impressions * totalNonConversions) / totalImpressions;

		if (expectedConv > 0) {
			chiSquared += Math.pow(observedConv - expectedConv, 2) / expectedConv;
		}
		if (expectedNonConv > 0) {
			chiSquared += Math.pow(observedNonConv - expectedNonConv, 2) / expectedNonConv;
		}
	}

	const degreesOfFreedom = k - 1;
	return 1 - chiSquaredCDF(chiSquared, degreesOfFreedom);
}

/**
 * Approximate chi-squared CDF using the regularized incomplete gamma function.
 * Good enough for significance testing — no external stats library needed.
 */
function chiSquaredCDF(x: number, k: number): number {
	if (x <= 0) return 0;
	return regularizedGammaP(k / 2, x / 2);
}

/**
 * Regularized lower incomplete gamma function P(a, x).
 * Uses series expansion for small x, continued fraction for large x.
 */
function regularizedGammaP(a: number, x: number): number {
	if (x < 0) return 0;
	if (x === 0) return 0;

	if (x < a + 1) {
		// Series expansion
		return gammaPSeries(a, x);
	} else {
		// Continued fraction
		return 1 - gammaQCF(a, x);
	}
}

function gammaPSeries(a: number, x: number): number {
	const maxIterations = 200;
	const epsilon = 1e-10;

	let sum = 1 / a;
	let term = 1 / a;

	for (let n = 1; n < maxIterations; n++) {
		term *= x / (a + n);
		sum += term;
		if (Math.abs(term) < Math.abs(sum) * epsilon) break;
	}

	return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function gammaQCF(a: number, x: number): number {
	const maxIterations = 200;
	const epsilon = 1e-10;

	let b = x + 1 - a;
	let c = 1e30;
	let d = 1 / b;
	let h = d;

	for (let i = 1; i < maxIterations; i++) {
		const an = -i * (i - a);
		b += 2;
		d = an * d + b;
		if (Math.abs(d) < 1e-30) d = 1e-30;
		c = b + an / c;
		if (Math.abs(c) < 1e-30) c = 1e-30;
		d = 1 / d;
		const delta = d * c;
		h *= delta;
		if (Math.abs(delta - 1) < epsilon) break;
	}

	return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/**
 * Log of the gamma function using Stirling's approximation (Lanczos).
 */
function logGamma(x: number): number {
	const coefficients = [
		76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
		0.1208650973866179e-2, -0.5395239384953e-5
	];

	let y = x;
	let tmp = x + 5.5;
	tmp -= (x + 0.5) * Math.log(tmp);

	let sum = 1.000000000190015;
	for (const coef of coefficients) {
		y += 1;
		sum += coef / y;
	}

	return -tmp + Math.log((2.5066282746310005 * sum) / x);
}
