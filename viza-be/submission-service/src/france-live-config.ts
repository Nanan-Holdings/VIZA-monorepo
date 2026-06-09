export type FranceSubmissionMode = "dry_run" | "live_assisted";

export interface FranceSubmissionConfig {
  mode: FranceSubmissionMode;
  liveSubmissionEnabled: boolean;
  liveAssistedOnly: boolean;
  requireFinalUserConfirmation: boolean;
  requireOfficialReviewDiffPass: boolean;
  playwrightHeadless: boolean;
  captureTrace: boolean;
  captureScreenshot: boolean;
  liveMaxDurationSeconds: number;
  officialBaseUrl: string;
  paymentLiveEnabled: boolean;
  appointmentLiveEnabled: boolean;
  officialReferenceEncryptionConfigured: boolean;
}

function boolEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  defaultValue: boolean,
): boolean {
  const raw = env[key];
  if (raw == null || raw.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function modeEnv(env: NodeJS.ProcessEnv): FranceSubmissionMode {
  const raw = env.FRANCE_SUBMISSION_MODE?.trim().toLowerCase();
  return raw === "live_assisted" ? "live_assisted" : "dry_run";
}

function positiveIntEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  defaultValue: number,
): number {
  const parsed = Number.parseInt(env[key] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function loadFranceSubmissionConfig(
  env: NodeJS.ProcessEnv = process.env,
): FranceSubmissionConfig {
  return {
    mode: modeEnv(env),
    liveSubmissionEnabled: boolEnv(env, "FRANCE_LIVE_SUBMISSION_ENABLED", false),
    liveAssistedOnly: boolEnv(env, "FRANCE_LIVE_ASSISTED_ONLY", true),
    requireFinalUserConfirmation: boolEnv(env, "FRANCE_REQUIRE_FINAL_USER_CONFIRMATION", true),
    requireOfficialReviewDiffPass: boolEnv(env, "FRANCE_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS", true),
    playwrightHeadless: boolEnv(env, "FRANCE_PLAYWRIGHT_HEADLESS", false),
    captureTrace: boolEnv(env, "FRANCE_CAPTURE_TRACE", true),
    captureScreenshot: boolEnv(env, "FRANCE_CAPTURE_SCREENSHOT", true),
    liveMaxDurationSeconds: positiveIntEnv(env, "FRANCE_LIVE_MAX_DURATION_SECONDS", 1800),
    officialBaseUrl:
      env.FRANCE_OFFICIAL_BASE_URL?.trim() ||
      "https://application-form.france-visas.gouv.fr/",
    paymentLiveEnabled: boolEnv(env, "FRANCE_PAYMENT_LIVE_ENABLED", false),
    appointmentLiveEnabled: boolEnv(env, "FRANCE_APPOINTMENT_LIVE_ENABLED", false),
    officialReferenceEncryptionConfigured:
      (env.SUBMISSION_RESULT_SECRET_KEY?.length ?? 0) >= 16,
  };
}

export function validateFranceLiveStart(config: FranceSubmissionConfig): string | null {
  if (config.mode !== "live_assisted") {
    return "France live assisted is blocked: FRANCE_SUBMISSION_MODE must be live_assisted.";
  }
  if (!config.liveSubmissionEnabled) {
    return "France live assisted is blocked: FRANCE_LIVE_SUBMISSION_ENABLED must be true.";
  }
  if (!config.liveAssistedOnly) {
    return "France live assisted is blocked: FRANCE_LIVE_ASSISTED_ONLY must remain true.";
  }
  if (!config.requireFinalUserConfirmation) {
    return "France live assisted is blocked: FRANCE_REQUIRE_FINAL_USER_CONFIRMATION must remain true.";
  }
  if (!config.requireOfficialReviewDiffPass) {
    return "France live assisted is blocked: FRANCE_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS must remain true.";
  }
  if (config.paymentLiveEnabled) {
    return "France live assisted is blocked: FRANCE_PAYMENT_LIVE_ENABLED must remain false unless payment scope is explicitly reopened.";
  }
  if (config.appointmentLiveEnabled) {
    return "France live assisted is blocked: FRANCE_APPOINTMENT_LIVE_ENABLED must remain false unless appointment booking scope is explicitly reopened.";
  }
  if (!config.officialReferenceEncryptionConfigured) {
    return "France live assisted is blocked: SUBMISSION_RESULT_SECRET_KEY must be set to encrypt official references.";
  }
  return null;
}
