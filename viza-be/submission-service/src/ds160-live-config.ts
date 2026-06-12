export type Ds160SubmissionMode = "dry_run" | "live_assisted";

export interface Ds160SubmissionConfig {
  mode: Ds160SubmissionMode;
  liveSubmissionEnabled: boolean;
  liveAssistedOnly: boolean;
  requireFinalUserConfirmation: boolean;
  requireOfficialReviewDiffPass: boolean;
  ceacBaseUrl: string;
  playwrightHeadless: boolean;
  captureTrace: boolean;
  captureScreenshot: boolean;
  liveMaxDurationSeconds: number;
  submissionSecretConfigured: boolean;
}

function readBool(
  env: NodeJS.ProcessEnv,
  key: string,
  defaultValue: boolean,
): boolean {
  const value = env[key];
  if (value === undefined || value.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readInt(
  env: NodeJS.ProcessEnv,
  key: string,
  defaultValue: number,
): number {
  const raw = env[key];
  if (!raw?.trim()) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readMode(env: NodeJS.ProcessEnv): Ds160SubmissionMode {
  const raw = env.DS160_SUBMISSION_MODE?.trim().toLowerCase();
  return raw === "live_assisted" ? "live_assisted" : "dry_run";
}

export function loadDs160SubmissionConfig(
  env: NodeJS.ProcessEnv = process.env,
): Ds160SubmissionConfig {
  return {
    mode: readMode(env),
    liveSubmissionEnabled: readBool(env, "DS160_LIVE_SUBMISSION_ENABLED", false),
    liveAssistedOnly: readBool(env, "DS160_LIVE_ASSISTED_ONLY", true),
    requireFinalUserConfirmation: readBool(env, "DS160_REQUIRE_FINAL_USER_CONFIRMATION", true),
    requireOfficialReviewDiffPass: readBool(env, "DS160_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS", true),
    ceacBaseUrl: env.DS160_CEAC_BASE_URL?.trim() || "https://ceac.state.gov/genniv/",
    playwrightHeadless: readBool(env, "DS160_PLAYWRIGHT_HEADLESS", false),
    captureTrace: readBool(env, "DS160_CAPTURE_TRACE", true),
    captureScreenshot: readBool(env, "DS160_CAPTURE_SCREENSHOT", true),
    liveMaxDurationSeconds: readInt(env, "DS160_LIVE_MAX_DURATION_SECONDS", 1800),
    submissionSecretConfigured: Boolean(
      env.SUBMISSION_RESULT_SECRET_KEY && env.SUBMISSION_RESULT_SECRET_KEY.length >= 16,
    ),
  };
}

export function validateDs160LiveStart(config: Ds160SubmissionConfig): string | null {
  if (config.mode !== "live_assisted") {
    return "DS160_SUBMISSION_MODE is dry_run; live CEAC submission is disabled by default.";
  }
  if (!config.liveSubmissionEnabled) {
    return "DS160_LIVE_SUBMISSION_ENABLED must be true before live assisted CEAC can start.";
  }
  if (!config.requireOfficialReviewDiffPass) {
    return "DS160_REQUIRE_OFFICIAL_REVIEW_DIFF_PASS must remain true.";
  }
  if (!/^https:\/\/ceac\.state\.gov\/genniv\/?$/i.test(config.ceacBaseUrl)) {
    return "DS160_CEAC_BASE_URL must point to the official https://ceac.state.gov/genniv/ origin.";
  }
  if (!Number.isFinite(config.liveMaxDurationSeconds) || config.liveMaxDurationSeconds <= 0) {
    return "DS160_LIVE_MAX_DURATION_SECONDS must be a positive number.";
  }
  if (!config.submissionSecretConfigured) {
    return "SUBMISSION_RESULT_SECRET_KEY must be set before storing live DS-160 retrieval secrets.";
  }
  return null;
}
