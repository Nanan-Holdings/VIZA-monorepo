/**
 * LangSmith Configuration
 * 
 * Centralized configuration for LangSmith tracing, evaluation, and monitoring.
 * Provides client singleton and metadata helpers for consistent trace metadata.
 */

import { Client } from "langsmith";

/**
 * LangSmith configuration constants
 */
export const LANGSMITH_CONFIG = {
	// Production retention: 30 days
	prodRetentionDays: 30,

	// Staging retention: 90 days (more for debugging)
	stagingRetentionDays: 90,

	// Sample rate for production tracing (reduce cost)
	prodSampleRate: 0.1, // 10% of requests

	// Always trace errors
	alwaysTraceErrors: true,
};

/**
 * LangSmith client singleton
 * Automatically configured from environment variables:
 * - LANGSMITH_API_KEY
 * - LANGSMITH_ENDPOINT (optional)
 */
export const langsmithClient = new Client({
	apiKey: process.env.LANGSMITH_API_KEY,
});

/**
 * Standard metadata for all traces
 *
 * @param userId - User identifier (consider masking for PII compliance)
 * @param sessionId - Session/thread identifier for linking traces
 * @param intent - Classified user intent (optional)
 * @returns Metadata object for trace context
 *
 * @example
 * ```typescript
 * const metadata = getTraceMetadata(
 *   "[MASKED]",
 *   "session_abc123",
 *   "visa_inquiry"
 * );
 *
 * await agent.invoke(input, { metadata });
 * ```
 */
export function getTraceMetadata(
	userId: string,
	sessionId: string,
	intent?: string
): Record<string, unknown> {
	return {
		session_id: sessionId,
		user_id: userId, // Should be masked before calling
		intent,
		env: process.env.NODE_ENV || "development",
		service: "visa-agent",
		version: process.env.APP_VERSION || "1.0.0",
		model_name: "gemini-2.5-flash",
	};
}

/**
 * Determine if tracing should be enabled for this request
 * 
 * @param isError - Whether this is an error case
 * @returns Whether to enable tracing
 * 
 * @remarks
 * - Always traces in development
 * - Always traces errors in production
 * - Samples normal requests in production based on configured rate
 */
export function shouldTrace(isError: boolean = false): boolean {
	const env = process.env.NODE_ENV || "development";

	// Always trace in development
	if (env === "development") {
		return true;
	}

	// Always trace errors
	if (isError && LANGSMITH_CONFIG.alwaysTraceErrors) {
		return true;
	}

	// Sample based on configured rate
	return Math.random() < LANGSMITH_CONFIG.prodSampleRate;
}

