/**
 * PII Masking Utilities
 *
 * Provides utilities for masking Personally Identifiable Information (PII) in traces
 * and logs to ensure privacy compliance. All personally identifiable information
 * should be masked before traces leave the service.
 */

/**
 * PII patterns for masking
 * Covers common formats for email, phone, NRIC/FIN, and dates
 */
const PII_PATTERNS = [
	// Email addresses
	{ pattern: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, replacement: "[EMAIL]" },

	// Phone numbers (various formats)
	// Matches: 123-456-7890, 123.456.7890, 1234567890, +65 1234 5678
	{ pattern: /\b\+?\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, replacement: "[PHONE]" },

	// Singapore NRIC/FIN (S/T/F/G followed by 7 digits and letter)
	{ pattern: /\b[STFG]\d{7}[A-Z]\b/gi, replacement: "[NRIC]" },

	// Dates that might be DOB (DD/MM/YYYY, MM-DD-YYYY, etc.)
	{ pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, replacement: "[DATE]" },

	// UUID patterns (often used as user IDs)
	{
		pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
		replacement: "[UUID]",
	},
];

/**
 * Mask PII in text
 *
 * @param text - Text that may contain PII
 * @returns Text with PII replaced by placeholder tokens
 *
 * @example
 * ```typescript
 * const message = "Contact me at john@example.com or 123-456-7890";
 * const masked = maskPII(message);
 * // Returns: "Contact me at [EMAIL] or [PHONE]"
 * ```
 */
export function maskPII(text: string): string {
	let masked = text;
	for (const { pattern, replacement } of PII_PATTERNS) {
		masked = masked.replace(pattern, replacement);
	}
	return masked;
}

/**
 * Mask PII in trace metadata
 *
 * Removes or masks sensitive fields while preserving safe operational metadata.
 *
 * @param metadata - Raw trace metadata that may contain PII
 * @returns Sanitized metadata safe for tracing
 *
 * @example
 * ```typescript
 * const metadata = {
 *   user_id: "550e8400-e29b-41d4-a716-446655440000",
 *   intent: "visa_inquiry",
 *   email: "user@example.com"
 * };
 *
 * const masked = maskTraceMetadata(metadata);
 * // Returns: {
 * //   user_id: "[MASKED]",
 * //   intent: "visa_inquiry",
 * //   email: "[EMAIL]"
 * // }
 * ```
 */
export function maskTraceMetadata(
	metadata: Record<string, unknown>
): Record<string, unknown> {
	const masked = { ...metadata };

	// Remove or mask sensitive fields
	if (masked.user_id) {
		masked.user_id = "[MASKED]";
	}

	if (masked.applicant_id) {
		masked.applicant_id = "[MASKED]";
	}

	// Safe fields that don't contain PII
	const safeFields = [
		"intent",
		"env",
		"service",
		"version",
		"model_name",
		"session_id",
		"tool_name",
		"error_type",
		"risk_level",
		"scenario",
	];

	// Mask all string values not in safe list
	for (const key of Object.keys(masked)) {
		if (!safeFields.includes(key)) {
			if (typeof masked[key] === "string") {
				masked[key] = maskPII(masked[key] as string);
			}
		}
	}

	return masked;
}

/**
 * Check if text contains potential PII
 *
 * Useful for detecting PII before logging or tracing.
 *
 * @param text - Text to check for PII patterns
 * @returns True if text contains patterns matching PII
 *
 * @example
 * ```typescript
 * if (containsPII(userMessage)) {
 *   logger.warn("Message contains potential PII, masking before trace");
 *   userMessage = maskPII(userMessage);
 * }
 * ```
 */
export function containsPII(text: string): boolean {
	return PII_PATTERNS.some(({ pattern }) => pattern.test(text));
}

// Backward-compatible aliases
/** @deprecated Use maskPII instead */
export const maskPHI = maskPII;
/** @deprecated Use containsPII instead */
export const containsPHI = containsPII;
/** @deprecated Use maskTraceMetadata instead */
export const maskPhiTraceMetadata = maskTraceMetadata;
