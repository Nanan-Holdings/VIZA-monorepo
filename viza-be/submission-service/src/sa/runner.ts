import { chromium, type Browser } from "@playwright/test";
import {
  missingRequired,
  missingSaDocuments,
  normalizeSaAnswers,
  saOfficialPassportTypeLabel,
} from "./field-mappings.js";
import { loadCountrySubmissionContext } from "../queue/answers.js";
import {
  unavailableManagedPaymentBoundary,
  type ManagedPaymentHooks,
} from "../runners/managed-payment-boundary.js";
import { resolveApplicationDocumentInventory } from "../documents/resolve-application-documents.js";
import { softTranslationGate } from "../runners/standard-evisa.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/types.js";
import { TOURIST_LIVE_CHECKPOINTS } from "../tourist-live-checkpoints.js";
import {
  activateSaudiManagedAccount,
  advanceSaudiEligibilityCaptcha,
  loginSaudiManagedAccount,
  prepareSaudiManagedAccount,
  readSaudiLiveConfig,
  redactSaudiRunnerError,
  registerSaudiManagedAccount,
  requireOfficialSaudiPortalUrl,
  validateSaudiLiveConfig,
  waitForSaudiActivationUrl,
  type SaudiLiveConfig,
  type SaudiManagedAccount,
} from "./live-flow.js";
import {
  loadSaudiPrivacyAuthorization,
  type SaudiPrivacyAuthorization,
} from "./privacy-authorization.js";
import { shouldRegisterSaudiManagedAccount } from "./registration-policy.js";

export { shouldRegisterSaudiManagedAccount };

async function selectNativeByLabel(
  page: import("@playwright/test").Page,
  selector: string,
  label: string,
): Promise<boolean> {
  return page.evaluate(
    ({ selector: selectSelector, label: optionLabel }) => {
      const select = document.querySelector(selectSelector) as HTMLSelectElement | null;
      if (!select) return false;
      const option = Array.from(select.options).find(
        (candidate) => candidate.text.trim().toLowerCase() === optionLabel.toLowerCase(),
      );
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { selector, label },
  );
}

/**
 * Saudi Arabia e-Visa runner (RUN-SA-001) — built from scratch.
 *
 * Verifies the public eligibility controls, prepares and activates the managed
 * account, and logs in until the next explicitly classified portal boundary.
 * It never treats an unverified authenticated page as submission success.
 */

async function launchSaudiBrowser(headless: boolean, remoteEndpoint?: string): Promise<Browser> {
  if (remoteEndpoint) {
    try {
      return await chromium.connectOverCDP(remoteEndpoint, { timeout: 45_000 });
    } catch {
      throw new Error("VisitSaudi remote browser endpoint was not reachable");
    }
  }
  const requestedChannel = process.env.SA_PLAYWRIGHT_CHANNEL?.trim();
  if (requestedChannel) {
    return chromium.launch({ headless, channel: requestedChannel });
  }
  try {
    return await chromium.launch({ headless, channel: "chrome" });
  } catch {
    return chromium.launch({ headless });
  }
}

export interface SaRunInput {
  jobId: string;
  applicationId: string;
  answers: Record<string, string>;
  visaType?: string;
  headless?: boolean;
  paymentHooks?: ManagedPaymentHooks;
  documentPaths?: ReadonlyMap<string, string>;
  documentKeys?: ReadonlySet<string>;
  requireCompleteApplication?: boolean;
  solveEligibilityCaptcha?: boolean;
  privacyAuthorization?: SaudiPrivacyAuthorization | null;
  applicantId?: string;
  managedAccount?: SaudiManagedAccount;
  liveConfig?: SaudiLiveConfig;
}

export interface SaRunResult {
  status: "managed_payment_adapter_unavailable" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

/**
 * Resolve an observed VisitSaudi payment checkpoint through the shared
 * staff-review boundary. Routing every payment stop through this helper keeps
 * the halt reason standardized and guarantees no managed card is acquired or
 * finalized — observing the official payment page is never authorization.
 */
async function saudiPaymentCheckpoint(
  input: SaRunInput,
  observed: string,
  artefacts: string[],
): Promise<SaRunResult> {
  const boundary = await unavailableManagedPaymentBoundary({
    country: "saudi_arabia",
    visaType: input.visaType ?? "SA_E_VISA",
    hooks: input.paymentHooks,
  });
  return {
    status: boundary.status,
    reason: `${boundary.reason}; observed checkpoint: ${observed}`,
    reachedStep: "payment_checkpoint_observed_no_charge",
    artefacts,
  };
}

export async function runSaRunner(input: SaRunInput): Promise<SaRunResult> {
  const normalizedAnswers = normalizeSaAnswers(input.answers);
  const missing = missingRequired(normalizedAnswers);
  if (missing.length > 0) {
    return { status: "needs_human", reason: `missing required answers: ${missing.join(", ")}`, reachedStep: "validation", artefacts: [] };
  }
  if (input.requireCompleteApplication) {
    const missingDocuments = missingSaDocuments(
      input.documentKeys ?? input.documentPaths?.keys() ?? [],
    );
    if (missingDocuments.length > 0) {
      return {
        status: "needs_human",
        reason: `missing required documents: ${missingDocuments.join(", ")}`,
        reachedStep: "document_validation",
        artefacts: [],
      };
    }
  }

  let baseUrl: string;
  try {
    baseUrl = requireOfficialSaudiPortalUrl(
      process.env.SA_PORTAL_URL ?? TOURIST_LIVE_CHECKPOINTS.saudi_arabia.url,
      "configured entry URL",
    );
  } catch (error) {
    return {
      status: "blocked",
      reason: error instanceof Error ? error.message : "VisitSaudi entry URL is invalid",
      reachedStep: "portal_configuration",
      artefacts: [],
    };
  }

  softTranslationGate("saudi_arabia", normalizedAnswers); // RUN-CORE-007 (non-fatal)
  const remoteEndpoint = process.env.SA_BROWSER_API_ENDPOINT?.trim()
    || process.env.SA_BRIGHTDATA_BROWSER_API_ENDPOINT?.trim();
  let browser: Browser;
  try {
    browser = await launchSaudiBrowser(input.headless ?? true, remoteEndpoint);
  } catch (error) {
    return {
      status: "blocked",
      reason: error instanceof Error ? error.message : "VisitSaudi browser connection failed",
      reachedStep: "browser_connection",
      artefacts: [],
    };
  }
  const ctx = browser.contexts()[0] ?? await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  const artefacts: string[] = [];
  let reachedStep = "landing";

  try {
    if (input.liveConfig?.loginEnabled && input.managedAccount?.confirmed) {
      reachedStep = "account_login";
      const checkpoint = await loginSaudiManagedAccount(
        page,
        input.managedAccount,
        input.applicationId,
        input.privacyAuthorization ?? null,
      );
      if (checkpoint.checkpoint === "payment") {
        return saudiPaymentCheckpoint(input, checkpoint.message, artefacts);
      }
      return {
        status: "needs_human",
        reason: checkpoint.message,
        reachedStep: checkpoint.checkpoint,
        artefacts,
      };
    }
    if (
      input.liveConfig?.accountPreparationEnabled &&
      input.managedAccount?.registrationSubmitted &&
      !input.managedAccount.confirmed &&
      input.applicantId
    ) {
      reachedStep = "account_activation";
      const activationUrl = await waitForSaudiActivationUrl(
        input.applicantId,
        new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString(),
        30_000,
      );
      let checkpoint = await activateSaudiManagedAccount({
        page,
        activationUrl,
        applicantId: input.applicantId,
        applicationId: input.applicationId,
        privacyAuthorization: input.privacyAuthorization ?? null,
        correlationId: input.jobId,
      });
      if (checkpoint.checkpoint !== "activation_verified") {
        return {
          status: "needs_human",
          reason: checkpoint.message,
          reachedStep: checkpoint.checkpoint,
          artefacts,
        };
      }
      input.managedAccount.confirmed = true;
      if (input.liveConfig.loginEnabled) {
        checkpoint = await loginSaudiManagedAccount(
          page,
          input.managedAccount,
          input.applicationId,
          input.privacyAuthorization ?? null,
        );
      }
      if (checkpoint.checkpoint === "payment") {
        return saudiPaymentCheckpoint(input, checkpoint.message, artefacts);
      }
      return {
        status: "needs_human",
        reason: checkpoint.message,
        reachedStep: checkpoint.checkpoint,
        artefacts,
      };
    }
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    requireOfficialSaudiPortalUrl(page.url(), "entry navigation");
    const title = await page.title().catch(() => "");
    if (/just a moment|attention required/i.test(title)) {
      return { status: "anti_bot_gate", reason: `anti-bot gate: ${title}`, reachedStep, artefacts };
    }

    const missingSelectors: string[] = [];
    for (const selector of TOURIST_LIVE_CHECKPOINTS.saudi_arabia.requiredSelectors) {
      if ((await page.locator(selector).count()) === 0) missingSelectors.push(selector);
    }
    if (missingSelectors.length > 0) {
      return {
        status: "blocked",
        reason: `official portal checkpoint drift: missing selectors: ${missingSelectors.join(", ")}`,
        reachedStep: "checkpoint_mismatch",
        artefacts,
      };
    }

    reachedStep = "form";
    const passportTypeLabel = saOfficialPassportTypeLabel(normalizedAnswers.passport_type);
    if (!passportTypeLabel) {
      return {
        status: "needs_human",
        reason: "VisitSaudi requires a truthful supported passport type before eligibility",
        reachedStep: "passport_type_unsupported",
        artefacts,
      };
    }
    if (!(await selectNativeByLabel(page, "#PassportType", passportTypeLabel))) {
      return {
        status: "blocked",
        reason: `VisitSaudi passport type option is unavailable: ${passportTypeLabel}`,
        reachedStep: "passport_type_option_unmatched",
        artefacts,
      };
    }
    const nationality = normalizedAnswers.nationality.trim();
    const nationalityLabel = /^(chn|china|中国)$/i.test(nationality)
      ? "China"
      : nationality;
    if (!(await selectNativeByLabel(page, "#Nationality", nationalityLabel))) {
      return {
        status: "needs_human",
        reason: "VisitSaudi nationality option could not be matched to the supplied application answer",
        reachedStep: "nationality_option_unmatched",
        artefacts,
      };
    }

    if (!input.solveEligibilityCaptcha) {
      return {
        status: "needs_human",
        reason: "VisitSaudi eligibility controls are available and the next transition is CAPTCHA-gated",
        reachedStep: "captcha_required",
        artefacts,
      };
    }
    let checkpoint = await advanceSaudiEligibilityCaptcha(
      page,
      input.applicationId,
      input.privacyAuthorization ?? null,
    );
    if (
      shouldRegisterSaudiManagedAccount({
        checkpoint: checkpoint.checkpoint,
        accountPreparationEnabled: Boolean(input.liveConfig?.accountPreparationEnabled),
        accountConfirmed: Boolean(input.managedAccount?.confirmed),
      })
    ) {
      if (!input.applicantId || !input.managedAccount) {
        return {
          status: "blocked",
          reason: "VisitSaudi managed-account context is unavailable",
          reachedStep: "account_context_missing",
          artefacts,
        };
      }
      const registrationStartedAt = new Date().toISOString();
      checkpoint = await registerSaudiManagedAccount({
        page,
        applicantId: input.applicantId,
        applicationId: input.applicationId,
        answers: normalizedAnswers,
        account: input.managedAccount,
        privacyAuthorization: input.privacyAuthorization ?? null,
        correlationId: input.jobId,
      });
      if (checkpoint.checkpoint === "activation_pending" || checkpoint.checkpoint === "login") {
        const activationUrl = await waitForSaudiActivationUrl(
          input.applicantId,
          registrationStartedAt,
        );
        checkpoint = await activateSaudiManagedAccount({
          page,
          activationUrl,
          applicantId: input.applicantId,
          applicationId: input.applicationId,
          privacyAuthorization: input.privacyAuthorization ?? null,
          correlationId: input.jobId,
        });
        if (checkpoint.checkpoint === "activation_verified") {
          input.managedAccount.confirmed = true;
          input.managedAccount.registrationSubmitted = true;
        }
      }
    }
    if (input.liveConfig?.loginEnabled && input.managedAccount?.confirmed) {
      checkpoint = await loginSaudiManagedAccount(
        page,
        input.managedAccount,
        input.applicationId,
        input.privacyAuthorization ?? null,
      );
    }
    if (checkpoint.checkpoint === "payment") {
      return saudiPaymentCheckpoint(input, checkpoint.message, artefacts);
    }
    return {
      status: "needs_human",
      reason: checkpoint.message,
      reachedStep: checkpoint.checkpoint,
      artefacts,
    };
  } catch (err) {
    return { status: "blocked", reason: redactSaudiRunnerError(err), reachedStep, artefacts };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

export async function runOne(
  applicationId: string,
  jobId?: string,
  paymentHooks?: ManagedPaymentHooks,
): Promise<DispatchOutcome> {
  const config = readSaudiLiveConfig();
  if (!config.preSubmitEnabled) {
    throw new NeedsHumanError("Saudi live pre-submit QA is disabled (SA_PRE_SUBMIT_QA_ENABLED=false)");
  }
  const configBlockers = validateSaudiLiveConfig(config);
  if (configBlockers.length > 0) {
    throw new NeedsHumanError(`Saudi live configuration is incomplete: ${configBlockers.join(", ")}`);
  }
  const context = await loadCountrySubmissionContext(applicationId);
  if (context.application.country !== "saudi_arabia" || context.application.visa_type !== "SA_E_VISA") {
    throw new NeedsHumanError("Saudi runner received an application outside SA_E_VISA");
  }
  const answers = normalizeSaAnswers(context.answers);
  const missingAnswers = missingRequired(answers);
  if (missingAnswers.length > 0) {
    throw new NeedsHumanError(`Saudi application is incomplete: ${missingAnswers.join(", ")}`);
  }
  const documentKeys = await resolveApplicationDocumentInventory(applicationId);
  const missingDocuments = missingSaDocuments(documentKeys);
  if (missingDocuments.length > 0) {
    throw new NeedsHumanError(`Saudi documents are incomplete: ${missingDocuments.join(", ")}`);
  }
  const privacyAuthorization = config.accountPreparationEnabled || config.loginEnabled || config.twoCaptchaEnabled
    ? await loadSaudiPrivacyAuthorization(applicationId)
    : null;
  if ((config.accountPreparationEnabled || config.loginEnabled || config.twoCaptchaEnabled) && !privacyAuthorization) {
    throw new NeedsHumanError(
      "Saudi Privacy Policy authorization is missing or stale; record the current VisitSaudi policy consent before account/CAPTCHA work",
    );
  }
  let managedAccount: SaudiManagedAccount | undefined;
  if (config.accountPreparationEnabled || config.loginEnabled) {
    const profileRecord = context.profile as unknown as Record<string, unknown>;
    const alias = typeof profileRecord.inbox_alias === "string" ? profileRecord.inbox_alias : "";
    managedAccount = await prepareSaudiManagedAccount({
      applicantId: context.application.applicant_id,
      applicationId,
      alias,
      privacyAuthorization,
      correlationId: jobId ?? applicationId,
    });
  }
  const result = await runSaRunner({
    jobId: jobId ?? applicationId,
    applicationId,
    answers,
    paymentHooks,
    documentKeys,
    requireCompleteApplication: true,
    solveEligibilityCaptcha: config.twoCaptchaEnabled,
    privacyAuthorization,
    applicantId: context.application.applicant_id,
    managedAccount,
    liveConfig: config,
  });
  switch (result.status) {
    case "managed_payment_adapter_unavailable":
      return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: result.artefacts };
    case "blocked":
    case "anti_bot_gate":
      throw new RetryableRunnerError(`${result.status}: ${result.reason}`);
    case "needs_human":
      throw new NeedsHumanError(result.reason);
    default:
      throw new Error(`unexpected saudi status: ${result.status}`);
  }
}
