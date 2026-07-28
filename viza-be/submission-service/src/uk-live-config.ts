export type UkSubmissionMode = "dry_run" | "live_assisted";

export interface UkSubmissionConfig {
  mode: UkSubmissionMode;
  liveSubmissionEnabled: boolean;
  playwrightHeadless: boolean;
  resultEncryptionConfigured: boolean;
}

function boolEnv(env: NodeJS.ProcessEnv, key: string, defaultValue: boolean): boolean {
  const raw = env[key];
  if (raw == null || raw.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function modeEnv(env: NodeJS.ProcessEnv): UkSubmissionMode {
  const raw = env.UK_SUBMISSION_MODE?.trim().toLowerCase();
  return raw === "live_assisted" ? "live_assisted" : "dry_run";
}

export function loadUkSubmissionConfig(env: NodeJS.ProcessEnv = process.env): UkSubmissionConfig {
  return {
    mode: modeEnv(env),
    liveSubmissionEnabled: boolEnv(env, "UK_LIVE_SUBMISSION_ENABLED", false),
    playwrightHeadless: boolEnv(env, "UK_PLAYWRIGHT_HEADLESS", false),
    resultEncryptionConfigured: (env.SUBMISSION_RESULT_SECRET_KEY?.length ?? 0) >= 16,
  };
}

export function validateUkLiveStart(config: UkSubmissionConfig): string | null {
  if (config.mode !== "live_assisted") {
    return "UK live assisted is blocked: set UK_SUBMISSION_MODE=live_assisted on this worker.";
  }
  if (!config.liveSubmissionEnabled) {
    return "UK live assisted is blocked: set UK_LIVE_SUBMISSION_ENABLED=true on this worker.";
  }
  if (!config.resultEncryptionConfigured) {
    return "UK live assisted is blocked: SUBMISSION_RESULT_SECRET_KEY must be at least 16 characters.";
  }
  return null;
}
