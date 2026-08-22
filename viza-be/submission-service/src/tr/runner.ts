import { chromium, type Browser } from "@playwright/test";
import { TOURIST_LIVE_CHECKPOINTS } from "../tourist-live-checkpoints.js";
import {
  loadCanonicalAnswers,
  loadSubmissionPreflightContext,
  matchesSubmissionPreflightApplication,
} from "../queue/answers.js";
import { ensureApplicantInboxAlias } from "../inbox/alias.js";
import { inbox } from "../inbox/wait-for-message.js";
import type { ManagedPaymentHooks } from "../runners/managed-payment-boundary.js";
import {
  NeedsHumanError,
  RetryableRunnerError,
  type DispatchOutcome,
} from "../queue/types.js";
import { validateTrSubmissionPreflight } from "./preflight.js";
import {
  bindTrLiveFlowPage,
  runTrLiveFlow,
  type TrLiveFlowInput,
  type TrLiveFlowResult,
} from "./live-flow.js";
import { extractTrVerificationUrl, isTrVerificationEmail } from "./email.js";

/**
 * Türkiye e-Visa runner (RUN-TR-001). The official site is an ASP.NET/Kendo
 * multi-step flow and sometimes redirects through DTV, so it cannot use the
 * generic HTML-field runner. This runner reaches the prepared personal page,
 * then stops before creating an official application or sending verification
 * email. `runTrLiveFlow` can also verify an already-authorized email link and
 * stop at a strict unpaid USD payment checkpoint without touching card data.
 */
export type TrRunnerInput = Omit<TrLiveFlowInput, "page" | "entryUrl"> & {
  entryUrl?: string;
  headless?: boolean;
};

export async function runTrRunner(input: TrRunnerInput): Promise<TrLiveFlowResult> {
  let browser: Browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: input.headless ?? true });
  } catch {
    browser = await chromium.launch({ headless: input.headless ?? true });
  }
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  try {
    const liveFlowInput: Omit<TrLiveFlowInput, "page"> = {
      ...input,
      entryUrl:
        input.entryUrl ??
        process.env.TR_PORTAL_URL ??
        TOURIST_LIVE_CHECKPOINTS.turkey.url,
    };
    return await runTrLiveFlow(bindTrLiveFlowPage(page, liveFlowInput));
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function runOne(
  applicationId: string,
  _jobId?: string,
  _paymentHooks?: ManagedPaymentHooks,
): Promise<DispatchOutcome> {
  const [answers, context] = await Promise.all([
    loadCanonicalAnswers(applicationId),
    loadSubmissionPreflightContext(applicationId),
  ]);
  if (!matchesSubmissionPreflightApplication(context, "turkey", "TR_E_VISA")) {
    throw new NeedsHumanError(
      "Türkiye runner received an application outside TR_E_VISA",
    );
  }
  const managedEmailAlias =
    context.inboxAlias ?? (await ensureApplicantInboxAlias(context.applicantId)).alias;
  const preflight = validateTrSubmissionPreflight({
    answers,
    managedEmailAlias,
    documents: context.documents,
    captchaConfigured: Boolean(process.env.TWOCAPTCHA_API_KEY?.trim()),
  });
  if (!preflight.readyForEligibility) {
    const eligibilityFailures = [
      preflight.eligibilityMissingAnswers.length > 0
        ? `missing answers: ${preflight.eligibilityMissingAnswers.join(", ")}`
        : "",
      preflight.missingCredentials.includes("TWOCAPTCHA_API_KEY")
        ? "missing credentials: TWOCAPTCHA_API_KEY"
        : "",
    ]
      .filter(Boolean)
      .join("; ");
    throw new NeedsHumanError(
      `TR_E_VISA eligibility preflight failed: ${eligibilityFailures}`,
    );
  }

  const result = await runTrRunner({
    answers: preflight.normalizedAnswers,
    headless: process.env.TR_HEADFUL !== "1",
    // Eligibility can be established from the first official pages even when
    // later personal/document prerequisites are incomplete. Never create an
    // official record unless both the operator gate and full preflight pass.
    allowOfficialApplicationCreation:
      process.env.TR_LIVE_QA_TO_PAYMENT === "1" && preflight.ready,
    waitForVerificationUrl: async (sentAfter, applicationReference) => {
      const message = await inbox.waitForMessage(
        context.applicantId,
        (candidate) => isTrVerificationEmail(candidate, applicationReference),
        180_000,
        { since: sentAfter, newestFirst: true },
      );
      const url = extractTrVerificationUrl(message);
      if (!url) throw new Error("Türkiye verification email did not contain a trusted official URL");
      return url;
    },
  });
  switch (result.status) {
    case "stopped_before_official_record":
    case "stopped_before_pay":
      return { outcome: "halted_before_pay", reachedStep: result.reachedStep, artefacts: [] };
    case "needs_human":
      throw new NeedsHumanError(result.reason);
    case "blocked":
      throw new RetryableRunnerError(result.reason);
    default:
      throw new Error(`unexpected Türkiye runner status: ${String(result.status)}`);
  }
}
