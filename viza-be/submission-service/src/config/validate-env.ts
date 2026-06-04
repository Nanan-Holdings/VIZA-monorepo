/**
 * DEP-003: startup env-var validation for submission-service.
 *
 * `validateEnv()` asserts the required env vars are present (and PORT, if set,
 * is numeric), throwing a single clear error listing every missing key.
 * Called at the top of src/index.ts before main(). The required/optional
 * split mirrors viza-be/submission-service/.env.example (SEC-006).
 */

/** Must be present for the service to boot at all. */
const REQUIRED_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUBMISSION_RESULT_SECRET_KEY",
] as const;

/** Feature-gated — absence disables a capability but doesn't block boot. */
const OPTIONAL_KEYS = [
  "RESEND_API_KEY",
  "RESEND_OPS_ALERT_TO",
  "TWOCAPTCHA_API_KEY",
  "IMAP_HOST",
  "IMAP_PORT",
  "IMAP_EMAIL",
  "IMAP_PASSWORD",
  "SLACK_WEBHOOK_URL",
  "NEXT_PUBLIC_SITE_URL",
  "RUNNER_CONCURRENCY_JSON",
  "RUNNER_PAUSED_COUNTRIES",
  "PORT",
] as const;

export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing = REQUIRED_KEYS.filter((k) => !env[k] || env[k]?.trim() === "");
  if (missing.length > 0) {
    throw new Error(
      `[config] Missing required env var(s): ${missing.join(", ")}. ` +
        `See viza-be/submission-service/.env.example.`,
    );
  }

  if (env.PORT && Number.isNaN(Number(env.PORT))) {
    throw new Error(`[config] PORT must be numeric, got '${env.PORT}'.`);
  }

  const missingOptional = OPTIONAL_KEYS.filter((k) => !env[k]);
  if (missingOptional.length > 0) {
    console.warn(
      `[config] Optional env var(s) not set (related features disabled): ${missingOptional.join(", ")}`,
    );
  }
}
