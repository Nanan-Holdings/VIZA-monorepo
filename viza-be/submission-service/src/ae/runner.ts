import { chromium, type Browser } from "@playwright/test";
import { resolveApplicationDocumentInventory } from "../documents/resolve-application-documents.js";
import { loadCountrySubmissionContext } from "../queue/answers.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/types.js";
import { TOURIST_LIVE_CHECKPOINTS } from "../tourist-live-checkpoints.js";
import { loadAeDocumentEvidenceFacts } from "./document-evidence.js";
import {
  aeDocumentEvidenceReviewBlockers,
  aeMissingRequired,
  missingAeDocuments,
  normalizeAeAnswers,
  type AeDocumentEvidenceFacts,
} from "./field-mappings.js";
import {
  aeAuthorizedCdpConnectionError,
  classifyAePortalState,
  readAeLiveConfig,
  requireOfficialAePortalUrl,
  validateAeLiveConfig,
  type AePortalState,
} from "./live-flow.js";

export interface AeRunInput {
  jobId: string;
  applicationId: string;
  answers: Record<string, string>;
  documentPaths?: ReadonlyMap<string, string>;
  documentKeys?: ReadonlySet<string>;
  documentEvidenceFacts?: AeDocumentEvidenceFacts;
  requireCompleteApplication?: boolean;
  authenticatedCdpEndpoint?: string;
  authorizedSessionMode?: "uae_pass" | "eligible_provider_account";
  documentUploadEnabled?: boolean;
  paymentCheckpointEnabled?: boolean;
  headless?: boolean;
}

export interface AeRunResult {
  status: "managed_payment_adapter_unavailable" | "blocked" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
  portalState?: AePortalState;
}

async function launchAeBrowser(input: AeRunInput): Promise<Browser> {
  if (input.authenticatedCdpEndpoint) {
    try {
      return await chromium.connectOverCDP(input.authenticatedCdpEndpoint, { timeout: 45_000 });
    } catch (error) {
      throw aeAuthorizedCdpConnectionError(error);
    }
  }
  const requestedChannel = process.env.AE_PLAYWRIGHT_CHANNEL?.trim();
  if (requestedChannel) {
    return chromium.launch({ headless: input.headless ?? true, channel: requestedChannel });
  }
  try {
    return await chromium.launch({ headless: input.headless ?? true, channel: "chrome" });
  } catch {
    return chromium.launch({ headless: input.headless ?? true });
  }
}

/**
 * ICP transaction-783 observer. It does not collect UAE Pass credentials,
 * create identity state, click Continue, upload without verified selectors,
 * capture authenticated page images, or invoke a payment control.
 */
export async function runAeRunner(input: AeRunInput): Promise<AeRunResult> {
  const answers = normalizeAeAnswers(input.answers);
  if (input.requireCompleteApplication) {
    const missingAnswers = aeMissingRequired(answers);
    if (missingAnswers.length > 0) {
      return {
        status: "needs_human",
        reason: `missing required answers: ${missingAnswers.join(", ")}`,
        reachedStep: "validation",
        artefacts: [],
      };
    }
    const missingDocuments = missingAeDocuments(
      input.documentKeys ?? input.documentPaths?.keys() ?? [],
      answers.current_nationality,
    );
    if (missingDocuments.length > 0) {
      return {
        status: "needs_human",
        reason: `missing required documents: ${missingDocuments.join(", ")}`,
        reachedStep: "document_validation",
        artefacts: [],
      };
    }
    const evidenceBlockers = aeDocumentEvidenceReviewBlockers(
      input.documentEvidenceFacts ?? {},
    );
    if (evidenceBlockers.length > 0) {
      return {
        status: "needs_human",
        reason: `document content review required: ${evidenceBlockers.join(", ")}`,
        reachedStep: "document_content_review",
        artefacts: [],
      };
    }
  }

  if (
    input.authenticatedCdpEndpoint &&
    input.requireCompleteApplication &&
    !["uae_pass", "eligible_provider_account"].includes(input.authorizedSessionMode ?? "")
  ) {
    return {
      status: "needs_human",
      reason: "UAE authenticated browser requires an explicitly authorized session mode",
      reachedStep: "identity_session_authorization",
      artefacts: [],
    };
  }

  let browser: Browser;
  try {
    browser = await launchAeBrowser(input);
  } catch (error) {
    return {
      status: "blocked",
      reason: error instanceof Error ? error.message : "UAE browser connection failed",
      reachedStep: "authorized_cdp_unreachable",
      artefacts: [],
    };
  }
  const context = browser.contexts()[0] ?? await browser.newContext({
    acceptDownloads: true,
    locale: "en-US",
  });
  const page = await context.newPage();
  const artefacts: string[] = [];
  try {
    await page.goto(TOURIST_LIVE_CHECKPOINTS.united_arab_emirates.url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(8_000);
    requireOfficialAePortalUrl(page.url(), "transaction 783 navigation");
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const productHeading = TOURIST_LIVE_CHECKPOINTS.united_arab_emirates.requiredText;
    const portalState = classifyAePortalState({
      url: page.url(),
      title: await page.title().catch(() => ""),
      bodyText,
      hasDocumentInput: (await page.locator('input[type="file"]').count()) > 0,
      hasApplicantControl: (await page.locator('input[name*="passport" i], input[name*="beneficiary" i]').count()) > 0,
      hasIdentityControl: (await page.getByRole("button", { name: /uae pass|sign in|login|الهوية الرقمية|تسجيل الدخول/i }).count()) > 0,
      hasPaymentControl: (await page.getByRole("button", { name: /pay|payment|دفع/i }).count()) > 0,
      productVerified: /issueVisa\/request\/783/i.test(page.url()) && bodyText.includes(productHeading),
    });
    if (portalState.checkpoint === "payment") {
      if (!input.paymentCheckpointEnabled) {
        return {
          status: "needs_human",
          reason: "ICP payment summary is visible but observational payment QA is disabled",
          reachedStep: "payment_checkpoint_disabled",
          artefacts,
          portalState,
        };
      }
      return {
        status: "managed_payment_adapter_unavailable",
        reason: portalState.message,
        reachedStep: "payment_checkpoint_observed_no_charge",
        artefacts,
        portalState,
      };
    }
    if (portalState.checkpoint === "document_upload" && !input.documentUploadEnabled) {
      return {
        status: "needs_human",
        reason: "ICP document controls are visible but document upload QA is disabled",
        reachedStep: "document_upload_disabled",
        artefacts,
        portalState,
      };
    }
    if (
      portalState.checkpoint === "maintenance" ||
      portalState.checkpoint === "selector_drift" ||
      portalState.checkpoint === "session_expired" ||
      portalState.checkpoint === "wrong_product"
    ) {
      return {
        status: "blocked",
        reason: portalState.message,
        reachedStep: portalState.checkpoint,
        artefacts,
        portalState,
      };
    }
    return {
      status: "needs_human",
      reason: portalState.message,
      reachedStep: portalState.checkpoint,
      artefacts,
      portalState,
    };
  } finally {
    await page.close().catch(() => undefined);
    await browser.close();
  }
}

export async function runOne(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
  const config = readAeLiveConfig();
  if (!config.preSubmitEnabled) {
    throw new NeedsHumanError("UAE live pre-submit QA is disabled (AE_PRE_SUBMIT_QA_ENABLED=false)");
  }
  const blockers = validateAeLiveConfig(config);
  if (blockers.length > 0) {
    throw new NeedsHumanError(`UAE live configuration is incomplete: ${blockers.join(", ")}`);
  }
  if (!config.authenticatedCdpEnabled) {
    throw new NeedsHumanError(
      "UAE transaction 783 requires an authorized UAE PASS or eligible provider browser session; ordinary foreign tourist username creation is unavailable",
    );
  }
  const context = await loadCountrySubmissionContext(applicationId);
  if (context.application.country !== "united_arab_emirates" || context.application.visa_type !== "AE_TOURIST_VISA") {
    throw new NeedsHumanError("UAE runner received an application outside AE_TOURIST_VISA");
  }
  const answers = normalizeAeAnswers(context.answers);
  const missingAnswers = aeMissingRequired(answers);
  if (missingAnswers.length > 0) {
    throw new NeedsHumanError(`UAE application is incomplete: ${missingAnswers.join(", ")}`);
  }
  const documentKeys = await resolveApplicationDocumentInventory(applicationId);
  const missingDocuments = missingAeDocuments(documentKeys, answers.current_nationality);
  if (missingDocuments.length > 0) {
    throw new NeedsHumanError(`UAE documents are incomplete: ${missingDocuments.join(", ")}`);
  }
  const documentEvidenceFacts = await loadAeDocumentEvidenceFacts(applicationId);
  const evidenceBlockers = aeDocumentEvidenceReviewBlockers(documentEvidenceFacts);
  if (evidenceBlockers.length > 0) {
    throw new NeedsHumanError(
      `UAE document content review is incomplete: ${evidenceBlockers.join(", ")}`,
    );
  }
  const endpoint = process.env.AE_CDP_ENDPOINT?.trim() || process.env.AE_CHROME_CDP_ENDPOINT?.trim();
  if (!endpoint) throw new NeedsHumanError("UAE authorized CDP endpoint is unavailable");
  const result = await runAeRunner({
    jobId: jobId ?? applicationId,
    applicationId,
    answers,
    documentKeys,
    documentEvidenceFacts,
    requireCompleteApplication: true,
    authenticatedCdpEndpoint: endpoint,
    authorizedSessionMode: config.sessionMode as "uae_pass" | "eligible_provider_account",
    documentUploadEnabled: config.documentUploadEnabled,
    paymentCheckpointEnabled: config.paymentCheckpointEnabled,
  });
  if (result.status === "managed_payment_adapter_unavailable") {
    return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: result.artefacts };
  }
  if (result.status === "blocked") throw new RetryableRunnerError(`uae: ${result.reason}`);
  throw new NeedsHumanError(result.reason);
}
