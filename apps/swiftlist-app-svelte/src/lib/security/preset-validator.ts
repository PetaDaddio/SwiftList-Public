/**
 * Preset Prompt Validator for Marketplace Publication
 * Validates user-generated AI prompt presets before they can be published
 *
 * Security Threats Mitigated:
 * - Prompt injection (role hijacking, instruction override)
 * - Encoded injection (base64-like obfuscation)
 * - Excessive special characters (delimiter abuse)
 * - Oversized prompts (token stuffing)
 */

const MAX_PRESET_PROMPT_LENGTH = 1000;

/**
 * Patterns that indicate prompt injection attempts in marketplace presets.
 * These are broader than prompt-sanitizer.ts patterns because presets
 * are reused across many users (higher blast radius).
 */
const INJECTION_PATTERNS = [
	// Instruction override attempts
	/ignore.{0,20}(previous|prior|above|all).{0,20}(instructions?|prompts?|rules?)/i,
	/disregard.{0,20}(your|the|all).{0,20}(system|instructions?|prompts?|rules?)/i,
	/forget.{0,20}(everything|all|previous|prior|your)/i,
	/override.{0,20}(instructions?|prompts?|rules?|system)/i,

	// Role hijacking
	/you\s+are\s+now/i,
	/new\s+persona/i,
	/act\s+as\s+(a|an|the|if)/i,
	/pretend\s+(to\s+be|you\s+are)/i,
	/roleplay\s+as/i,
	/switch\s+to\s+(a|an|the)?\s*(new|different)/i,

	// System/role delimiters
	/^system\s*:/im,
	/^user\s*:/im,
	/^assistant\s*:/im,
	/\[INST\]/i,
	/###\s*(system|assistant|user)/i,
	/<\|.*?\|>/i,
	/<\/?system>/i,
	/<\/?prompt>/i,

	// Jailbreak phrases
	/do\s+anything\s+now/i,
	/DAN\s+mode/i,
	/developer\s+mode/i,
	/unrestricted\s+mode/i,
	/no\s+restrictions/i,
	/bypass.{0,20}(filter|safety|guard|content)/i,
];

/**
 * Detects base64-encoded content that may hide injection payloads.
 * Matches sequences of 20+ base64 characters (A-Za-z0-9+/=).
 */
const BASE64_PATTERN = /[A-Za-z0-9+/]{20,}={0,2}/;

/**
 * Detects excessive special character density.
 * A prompt with >30% special characters is suspicious.
 */
const SPECIAL_CHAR_THRESHOLD = 0.3;
const SPECIAL_CHARS = /[^a-zA-Z0-9\s.,!?;:'"()\-]/g;

export interface PresetValidationResult {
	valid: boolean;
	reason?: string;
}

/**
 * Validate a preset prompt before marketplace publication
 *
 * Returns a result object — never throws.
 *
 * @param prompt - Raw preset prompt text from user
 * @returns Validation result with optional rejection reason
 */
/**
 * NSFW/harmful content blocklist for marketplace presets.
 * Word-boundary matched to avoid false positives (e.g., "class" in "classic").
 */
const NSFW_BLOCKLIST = [
	// Sexual/nudity
	'nude', 'naked', 'nsfw', 'porn', 'pornograph', 'hentai', 'erotic', 'fetish',
	'lingerie', 'topless', 'bottomless', 'genitals', 'xxx', 'orgasm', 'masturbat',
	'stripper', 'escort', 'brothel', 'prostitut', 'sexually explicit', 'sex toy',
	'onlyfans', 'camgirl', 'camboy', 'bdsm', 'bondage', 'dominatrix',
	// Drugs
	'cocaine', 'heroin', 'methamphetamine', 'meth pipe', 'crack pipe', 'fentanyl',
	'drug paraphernalia', 'bong', 'crack rock', 'drug dealer', 'drug deal',
	'shoot up', 'snort', 'drug abuse', 'opioid abuse',
	// Violence/weapons
	'gore', 'gory', 'murder', 'mutilat', 'dismember', 'decapitat', 'torture',
	'mass shooting', 'school shooting', 'bomb threat', 'terrorist', 'terrorism',
	'genocide', 'ethnic cleansing', 'war crime',
	// Hate speech
	'white supremac', 'white power', 'nazi', 'swastika', 'kkk', 'ku klux',
	'racial slur', 'hate crime', 'lynch', 'neo-nazi', 'neonazi',
	'antisemit', 'islamophob', 'homophob', 'transphob',
	// Self-harm
	'suicide method', 'kill myself', 'self-harm', 'cutting myself', 'slit wrist',
	// Exploitation
	'child abuse', 'child exploit', 'pedophil', 'underage',
];

// Pre-compile blocklist into word-boundary regex patterns for performance
const NSFW_PATTERNS = NSFW_BLOCKLIST.map(
	(term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
);

/**
 * Validate preset text content against NSFW/harmful blocklist.
 * Checks name, description, tags, and optional ai_prompt.
 * Runs synchronously — zero external calls.
 */
export function validatePresetContent(fields: {
	name: string;
	description: string;
	tags?: string[];
	ai_prompt?: string;
}): PresetValidationResult {
	// Combine all text fields for scanning
	const textToScan = [
		fields.name,
		fields.description,
		...(fields.tags || []),
		fields.ai_prompt || '',
	].join(' ').toLowerCase();

	for (const pattern of NSFW_PATTERNS) {
		if (pattern.test(textToScan)) {
			return {
				valid: false,
				reason: 'Content contains prohibited terms that violate our community guidelines',
			};
		}
	}

	return { valid: true };
}

export function validatePresetPrompt(prompt: string): PresetValidationResult {
	// 1. Handle null/undefined gracefully
	const text = (prompt ?? '').trim();

	// 2. Empty string check
	if (text.length === 0) {
		return { valid: false, reason: 'Preset prompt cannot be empty' };
	}

	// 3. Length validation
	if (text.length > MAX_PRESET_PROMPT_LENGTH) {
		return {
			valid: false,
			reason: `Preset prompt exceeds maximum length of ${MAX_PRESET_PROMPT_LENGTH} characters`,
		};
	}

	// 4. Injection pattern detection
	for (const pattern of INJECTION_PATTERNS) {
		if (pattern.test(text)) {
			return {
				valid: false,
				reason: 'Preset prompt contains a prohibited phrase that could manipulate AI behavior',
			};
		}
	}

	// 5. Base64-encoded payload detection
	if (BASE64_PATTERN.test(text)) {
		const matches = text.match(BASE64_PATTERN);
		if (matches && matches[0].length >= 20) {
			return {
				valid: false,
				reason: 'Preset prompt contains encoded content that is not allowed',
			};
		}
	}

	// 6. Excessive special character detection
	const specialCount = (text.match(SPECIAL_CHARS) || []).length;
	const ratio = specialCount / text.length;
	if (ratio > SPECIAL_CHAR_THRESHOLD) {
		return {
			valid: false,
			reason: 'Preset prompt contains too many special characters',
		};
	}

	return { valid: true };
}
