/**
 * Security Test Suite for AI Output PII Scrubber
 * Tests redaction of personally identifiable information from AI outputs
 */

import { describe, it, expect } from 'vitest';
import { scrubAIOutput } from './output-scrubber';

describe('AI Output PII Scrubber', () => {
	describe('Email Redaction', () => {
		it('should redact standard email addresses', () => {
			const input = 'Contact john.doe@example.com for details';
			expect(scrubAIOutput(input)).toBe('Contact [EMAIL] for details');
		});

		it('should redact emails with subdomains', () => {
			const input = 'Send to user@mail.company.co.uk';
			expect(scrubAIOutput(input)).toBe('Send to [EMAIL]');
		});

		it('should redact emails with plus addressing', () => {
			const input = 'Email seller+shop@gmail.com for pricing';
			expect(scrubAIOutput(input)).toBe('Email [EMAIL] for pricing');
		});
	});

	describe('Phone Number Redaction', () => {
		it('should redact US phone with dashes', () => {
			const input = 'Call 555-123-4567 for support';
			expect(scrubAIOutput(input)).toBe('Call [PHONE] for support');
		});

		it('should redact US phone with parentheses', () => {
			const input = 'Phone: (555) 123-4567';
			expect(scrubAIOutput(input)).toBe('Phone: [PHONE]');
		});

		it('should redact international phone with country code', () => {
			const input = 'International: +1 555-123-4567';
			expect(scrubAIOutput(input)).toBe('International: [PHONE]');
		});

		it('should redact UK phone number', () => {
			const input = 'UK office: +44 20 7946 0958';
			expect(scrubAIOutput(input)).toBe('UK office: [PHONE]');
		});
	});

	describe('SSN Redaction', () => {
		it('should redact SSN pattern XXX-XX-XXXX', () => {
			const input = 'SSN on file: 123-45-6789';
			expect(scrubAIOutput(input)).toBe('SSN on file: [SSN]');
		});

		it('should redact multiple SSNs', () => {
			const input = 'Records: 111-22-3333 and 444-55-6666';
			expect(scrubAIOutput(input)).toBe('Records: [SSN] and [SSN]');
		});
	});

	describe('Credit Card Redaction', () => {
		it('should redact Visa-style 16-digit card number', () => {
			const input = 'Card: 4532015112830366';
			expect(scrubAIOutput(input)).toBe('Card: [CARD]');
		});

		it('should redact card number with spaces', () => {
			const input = 'Payment: 4532 0151 1283 0366';
			expect(scrubAIOutput(input)).toBe('Payment: [CARD]');
		});

		it('should redact card number with dashes', () => {
			const input = 'CC: 4532-0151-1283-0366';
			expect(scrubAIOutput(input)).toBe('CC: [CARD]');
		});

		it('should not redact non-Luhn digit sequences', () => {
			const input = 'Order number: 1234567890123456';
			// 1234567890123456 does not pass Luhn
			expect(scrubAIOutput(input)).toBe('Order number: 1234567890123456');
		});
	});

	describe('Street Address Redaction', () => {
		it('should redact standard street address', () => {
			const input = 'Located at 123 Main Street in downtown';
			expect(scrubAIOutput(input)).toBe('Located at [ADDRESS] in downtown');
		});

		it('should redact address with abbreviation', () => {
			const input = 'Ship to 4567 Oak Blvd';
			expect(scrubAIOutput(input)).toBe('Ship to [ADDRESS]');
		});

		it('should redact address with apartment number', () => {
			const input = 'Address: 89 Elm Ave #201';
			expect(scrubAIOutput(input)).toBe('Address: [ADDRESS]');
		});

		it('should redact address with multi-word street name', () => {
			const input = 'Office at 500 North Michigan Ave';
			expect(scrubAIOutput(input)).toBe('Office at [ADDRESS]');
		});
	});

	describe('Labeled Name Redaction', () => {
		it('should redact "Name: First Last" pattern', () => {
			const input = 'Name: John Smith ordered this item';
			expect(scrubAIOutput(input)).toBe('Name: [NAME] ordered this item');
		});

		it('should redact "Customer: First Last" pattern', () => {
			const input = 'Customer: Jane Doe requested a refund';
			expect(scrubAIOutput(input)).toBe('Customer: [NAME] requested a refund');
		});

		it('should redact names with middle name', () => {
			const input = 'Name: Mary Jane Watson';
			expect(scrubAIOutput(input)).toBe('Name: [NAME]');
		});
	});

	describe('Clean Text Passthrough', () => {
		it('should not modify clean product descriptions', () => {
			const clean = 'Beautiful handmade silver ring with turquoise stone. Perfect for everyday wear.';
			expect(scrubAIOutput(clean)).toBe(clean);
		});

		it('should not modify clean metadata', () => {
			const clean = 'Category: Jewelry | Material: Sterling Silver | Size: 7';
			expect(scrubAIOutput(clean)).toBe(clean);
		});

		it('should not modify text with common numbers', () => {
			const clean = 'Pack of 12 items, weight 250g, dimensions 10x15cm';
			expect(scrubAIOutput(clean)).toBe(clean);
		});
	});

	describe('Multiple PII Types in One String', () => {
		it('should redact email and phone in same string', () => {
			const input = 'Contact john@example.com or call 555-123-4567';
			const result = scrubAIOutput(input);
			expect(result).toBe('Contact [EMAIL] or call [PHONE]');
		});

		it('should redact all PII types in a paragraph', () => {
			const input =
				'Name: John Smith, SSN 123-45-6789, email john@test.com, card 4532015112830366, at 123 Main Street, phone 555-123-4567';
			const result = scrubAIOutput(input);

			expect(result).toContain('[NAME]');
			expect(result).toContain('[SSN]');
			expect(result).toContain('[EMAIL]');
			expect(result).toContain('[CARD]');
			expect(result).toContain('[ADDRESS]');
			expect(result).toContain('[PHONE]');
			expect(result).not.toContain('John Smith');
			expect(result).not.toContain('123-45-6789');
			expect(result).not.toContain('john@test.com');
			expect(result).not.toContain('4532015112830366');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty string', () => {
			expect(scrubAIOutput('')).toBe('');
		});

		it('should handle null/undefined gracefully', () => {
			expect(scrubAIOutput(null as any)).toBe('');
			expect(scrubAIOutput(undefined as any)).toBe('');
		});

		it('should handle string with only whitespace', () => {
			expect(scrubAIOutput('   ')).toBe('   ');
		});

		it('should preserve surrounding text structure', () => {
			const input = 'Line 1\nEmail: test@example.com\nLine 3';
			const result = scrubAIOutput(input);
			expect(result).toBe('Line 1\nEmail: [EMAIL]\nLine 3');
		});
	});
});
