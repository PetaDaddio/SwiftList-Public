/**
 * AI Output PII Scrubber
 * Redacts personally identifiable information from AI-generated text
 * before storage in Supabase or delivery to clients.
 *
 * Security Threats Mitigated:
 * - Accidental PII leakage from AI model outputs
 * - Data exfiltration via AI-generated product descriptions
 * - GDPR/CCPA compliance for stored AI content
 *
 * PII Types Detected:
 * - Email addresses → [EMAIL]
 * - Phone numbers (US + international) → [PHONE]
 * - SSNs (XXX-XX-XXXX) → [SSN]
 * - Credit card numbers (13-16 digits, Luhn-detectable) → [CARD]
 * - Street addresses → [ADDRESS]
 * - Labeled names (Name: / Customer:) → [NAME]
 */

/**
 * Validate a number sequence using the Luhn algorithm.
 * Used to detect credit card numbers with high confidence.
 */
function passesLuhn(digits: string): boolean {
	let sum = 0;
	let alternate = false;

	for (let i = digits.length - 1; i >= 0; i--) {
		let n = parseInt(digits[i], 10);
		if (alternate) {
			n *= 2;
			if (n > 9) n -= 9;
		}
		sum += n;
		alternate = !alternate;
	}

	return sum % 10 === 0;
}

/**
 * Scrub PII from AI-generated text output.
 *
 * @param text - Raw AI output text
 * @returns Sanitized text with PII replaced by redaction tokens
 */
export function scrubAIOutput(text: string): string {
	if (!text) return '';

	let result = text;

	// 1. SSNs (XXX-XX-XXXX) — must run before generic digit patterns
	result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

	// 2. Credit card numbers — 13-16 digit sequences (with optional spaces/dashes)
	result = result.replace(
		/\b(\d[ -]?){12,15}\d\b/g,
		(match) => {
			const digits = match.replace(/[ -]/g, '');
			if (digits.length >= 13 && digits.length <= 16 && passesLuhn(digits)) {
				return '[CARD]';
			}
			return match;
		}
	);

	// 3. Email addresses
	result = result.replace(
		/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
		'[EMAIL]'
	);

	// 4. Phone numbers — US and international formats
	//    +1 (555) 123-4567, 555-123-4567, (555) 123-4567, +44 20 7946 0958, etc.
	//    Negative lookbehind prevents matching tails of long digit sequences
	result = result.replace(
		/(?<!\d)(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g,
		'[PHONE]'
	);

	// 5. Street addresses — number followed by street name patterns
	//    e.g. "123 Main Street", "4567 Oak Blvd", "89 Elm Ave #201"
	result = result.replace(
		/\b\d{1,6}\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Place|Pl|Way|Circle|Cir|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Highway|Hwy)\.?\b(?:\s*(?:#|Apt|Suite|Ste|Unit)\s*\w+)?/gi,
		'[ADDRESS]'
	);

	// 6. Labeled names — "Name: John Smith" or "Customer: Jane Doe"
	result = result.replace(
		/(?:Name|Customer)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g,
		(match) => {
			const label = match.split(':')[0];
			return `${label}: [NAME]`;
		}
	);

	return result;
}
