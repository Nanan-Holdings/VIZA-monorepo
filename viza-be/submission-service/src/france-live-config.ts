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
  accountRegistrationEnabled: boolean;
  registrationTwoCaptchaEnabled: boolean;
  registrationMaxCaptchaAttempts: number;
  registrationEmailTimeoutMs: number;
  twoCaptchaConfigured: boolean;
  tlsAppointmentEnabled: boolean;
  tlsPaymentEnabled: boolean;
  tlsSupportedCountries: string;
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
    accountRegistrationEnabled: boolEnv(env, "FRANCE_ACCOUNT_REGISTRATION_ENABLED", false),
    registrationTwoCaptchaEnabled: boolEnv(env, "FRANCE_REGISTRATION_2CAPTCHA_ENABLED", false),
    registrationMaxCaptchaAttempts: positiveIntEnv(env, "FRANCE_REGISTRATION_MAX_CAPTCHA_ATTEMPTS", 3),
    registrationEmailTimeoutMs: positiveIntEnv(env, "FRANCE_REGISTRATION_EMAIL_TIMEOUT_MS", 180_000),
    twoCaptchaConfigured: Boolean(env.TWOCAPTCHA_API_KEY?.trim()),
    tlsAppointmentEnabled: boolEnv(env, "FRANCE_TLS_APPOINTMENT_ENABLED", false),
    tlsPaymentEnabled: boolEnv(env, "FRANCE_TLS_PAYMENT_ENABLED", false),
    tlsSupportedCountries: env.FRANCE_TLS_SUPPORTED_COUNTRIES?.trim().toUpperCase() || "CN",
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
  if (!/^https:\/\/application-form\.france-visas\.gouv\.fr\/?$/i.test(config.officialBaseUrl)) {
    return "France live assisted is blocked: FRANCE_OFFICIAL_BASE_URL must point to the official France-Visas origin.";
  }
  if (!config.officialReferenceEncryptionConfigured) {
    return "France live assisted is blocked: SUBMISSION_RESULT_SECRET_KEY must be set to encrypt official references.";
  }
  if (config.accountRegistrationEnabled && !config.registrationTwoCaptchaEnabled) {
    return "France live assisted is blocked: FRANCE_REGISTRATION_2CAPTCHA_ENABLED must be true when France account registration is enabled.";
  }
  if (config.accountRegistrationEnabled && !config.twoCaptchaConfigured) {
    return "France live assisted is blocked: TWOCAPTCHA_API_KEY must be set for France account registration.";
  }
  return null;
}

export function validateFranceTlsAppointmentStart(config: FranceSubmissionConfig): string | null {
  if (!config.tlsAppointmentEnabled) {
    return "France TLS appointment booking is blocked: FRANCE_TLS_APPOINTMENT_ENABLED must be true.";
  }
  if (!config.tlsPaymentEnabled) {
    return "France TLS appointment booking is blocked: FRANCE_TLS_PAYMENT_ENABLED must be true for online TLS service-fee confirmation.";
  }
  const liveBlocker = validateFranceLiveStart({
    ...config,
    paymentLiveEnabled: false,
    appointmentLiveEnabled: false,
  });
  if (liveBlocker) return liveBlocker;
  const countries = config.tlsSupportedCountries
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);
  if (!countries.includes("CN")) {
    return "France TLS appointment booking is blocked: FRANCE_TLS_SUPPORTED_COUNTRIES must include CN.";
  }
  return null;
}
