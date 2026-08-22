import * as fs from "node:fs/promises";
import * as path from "node:path";
import { artifact } from "../artifact.js";
import { buildCountrySubmissionApplication } from "../country-submissions/from-records.js";
import { getCountrySubmissionProvider } from "../country-submissions/index.js";
import type { SubmissionPayload } from "../country-submissions/types.js";
import { resolveApplicationDocumentPaths } from "../documents/resolve-application-documents.js";
import { ensureApplicationInboxAlias } from "../inbox/alias.js";
import { hasAliasEmailForwardingConsent } from "../inbox/forwarding-consent.js";
import { assertInboxAliasDomainRoutable, waitForApplicationMessage } from "../inbox/wait-for-message.js";
import {
  JpVjwPortalError,
  normalizeAndRunJpVjwPortalSubmission,
  type JpVjwPortalSubmissionResult,
} from "../jp-vjw/runner.js";
import {
  KeEtaPortalError,
  normalizeAndRunKeEtaPortalSubmission,
  type KeEtaPortalSubmissionResult,
} from "../ke-eta/runner.js";
import { writeRunnerPoolSubmissionResult } from "../result-writer.js";
import { loadManagedOfficialFeeExecutionContext } from "../official-fee/execution-context.js";
import { createManagedPaymentHooks } from "../official-fee/managed-payment-hooks.js";
import type { ManagedPaymentCard } from "../runners/managed-payment-boundary.js";
import type { JpVisitJapanWebSubmissionResult, KeEtaSubmissionResult } from "../submission-result.js";
import { supabase } from "../supabase.js";
import { loadCountrySubmissionContext } from "./answers.js";
import { NeedsHumanError, RetryableRunnerError, type DispatchOutcome } from "./types.js";
import {
  RunnerJobOwnershipLostError,
  requirePoolExecutionIdentity,
  type RunnerExecutionContext,
} from "./execution-context.js";

export type AutomatedPortalPoolFlow = "jp_vjw" | "ke_eta";
type AutomatedPortalResult = JpVjwPortalSubmissionResult | KeEtaPortalSubmissionResult;

interface AutomatedFlowIdentity {
  countryCode: "JP" | "KE";
  visaType: "JP_VISIT_JAPAN_WEB" | "KE_ETA";
  provider: "jp_visit_japan_web_live" | "ke_eta_live";
}

function flowIdentity(flow: AutomatedPortalPoolFlow): AutomatedFlowIdentity {
  return flow === "jp_vjw"
    ? { countryCode: "JP", visaType: "JP_VISIT_JAPAN_WEB", provider: "jp_visit_japan_web_live" }
    : { countryCode: "KE", visaType: "KE_ETA", provider: "ke_eta_live" };
}

async function preparePayload(
  applicationId: string,
  jobId: string,
  flow: AutomatedPortalPoolFlow,
): Promise<{ payload: SubmissionPayload; applicantId: string }> {
  const context = await loadCountrySubmissionContext(applicationId);
  const managedAlias = await ensureApplicationInboxAlias(applicationId, context.profile.id);
  await assertInboxAliasDomainRoutable(managedAlias.alias);
  if (!(await hasAliasEmailForwardingConsent(context.profile.id))) {
    throw new NeedsHumanError(`${flow} official-email forwarding consent is required.`);
  }
  const answers = {
    ...context.answers,
    alias_email_address: managedAlias.alias,
    email_address: managedAlias.alias,
  };
  const applicationDocumentPaths = flow === "ke_eta"
    ? await resolveApplicationDocumentPaths(applicationId)
    : new Map<string, string>();
  const attachments = {
    passportBioPage: applicationDocumentPaths.get("passport_copy")
      ?? applicationDocumentPaths.get("passport_bio_page")
      ?? applicationDocumentPaths.get("passport_bio_page_upload"),
    passportPhoto: applicationDocumentPaths.get("applicant_photo")
      ?? applicationDocumentPaths.get("photo")
      ?? applicationDocumentPaths.get("passport_photo")
      ?? applicationDocumentPaths.get("passport_photo_upload"),
    flightItinerary: applicationDocumentPaths.get("flight_itinerary"),
    accommodationProof: applicationDocumentPaths.get("accommodation_booking")
      ?? applicationDocumentPaths.get("accommodation_proof"),
    invitationLetter: applicationDocumentPaths.get("invitation_letter"),
  };
  const submissionApplication = buildCountrySubmissionApplication(
    context.profile,
    context.application,
    answers,
  );
  const identity = flowIdentity(flow);
  const provider = getCountrySubmissionProvider(context.application.country, context.application.visa_type);
  if (
    !provider
    || provider.countryCode !== identity.countryCode
    || !provider.supportedVisaTypes.includes(identity.visaType)
  ) {
    throw new NeedsHumanError(`${identity.visaType} country submission provider is not registered.`);
  }
  const validation = provider.validate(submissionApplication);
  if (!validation.ok) {
    throw new NeedsHumanError(`${identity.visaType} is missing required answers: ${validation.missingRequiredFields.join(", ")}`);
  }
  const mappedPayload = provider.mapToSubmissionPayload(submissionApplication, {
      dryRun: false,
      idempotencyKey: `runner-pool:${jobId}`,
    });
  if (flow === "ke_eta") {
    const officialFee = await loadManagedOfficialFeeExecutionContext(applicationId);
    mappedPayload.metadata = {
      ...mappedPayload.metadata,
      attachments,
      officialFeeAmount: officialFee.canonicalAmountCents / 100,
      officialFeeCurrency: officialFee.canonicalCurrency,
    };
  }
  return {
    payload: mappedPayload,
    applicantId: context.profile.id,
  };
}

async function persistFiles(
  jobId: string,
  prefix: string,
  paths: string[],
  contentType: "image/png" | "application/pdf",
): Promise<string[]> {
  const stored: string[] = [];
  for (let index = 0; index < paths.length; index += 1) {
    try {
      const bytes = await fs.readFile(paths[index]);
      const extension = contentType === "image/png" ? "png" : "pdf";
      const safeBase = path.basename(paths[index]).replace(/[^a-zA-Z0-9._-]+/gu, "-");
      const storedArtifact = await artifact.put(
        jobId,
        `${prefix}/${String(index + 1).padStart(2, "0")}-${safeBase || `artifact.${extension}`}`,
        bytes,
        { contentType, upsert: true },
      );
      stored.push(storedArtifact.path);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.warn(`[runner-pool] ${prefix} artifact persistence failed: ${message}`);
    }
  }
  return stored;
}

async function lookupExistingResult(
  applicationId: string,
  visaType: string,
): Promise<AutomatedPortalResult | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("submission_result")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw new Error(`automated portal status lookup failed: ${error.message}`);
  const result = data?.submission_result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const candidate = result as Record<string, unknown>;
  return candidate.visaType === visaType ? candidate as unknown as AutomatedPortalResult : null;
}

async function executePortal(
  flow: AutomatedPortalPoolFlow,
  payload: SubmissionPayload,
  executionContext: RunnerExecutionContext,
  applicantId: string,
): Promise<AutomatedPortalResult> {
  const identity = flowIdentity(flow);
  if (flow === "jp_vjw") {
    return normalizeAndRunJpVjwPortalSubmission(payload, {
      headless: process.env.JP_VJW_PLAYWRIGHT_HEADLESS !== "false",
      executionContext,
      statusLookup: {
        getExistingResult: async (applicationId, idempotencyKey) => {
          const existing = await lookupExistingResult(applicationId, identity.visaType);
          const jpExisting = existing?.country === "JP" ? existing as JpVisitJapanWebSubmissionResult : null;
          return jpExisting
            ? {
              ...jpExisting,
              status: jpExisting.status,
              mode: jpExisting.mode,
              provider: jpExisting.provider,
              applicationId,
              submitted: jpExisting.submitted,
              qrReady: jpExisting.qrReady,
              portalUrl: jpExisting.portalUrl,
              portalResponseSummary: `${jpExisting.portalResponseSummary} (${idempotencyKey})`,
            }
            : null;
        },
      },
      applicantId,
      aliasEmail: payload.countrySpecific.alias_email_address,
      inbox: {
        waitForVerification: async ({ applicantId: inboxApplicantId, alias, since }) => {
          void alias;
          const message = await waitForApplicationMessage(
            payload.applicationId,
            inboxApplicantId,
            (candidate) => /visit\s+japan|digital\.go\.jp|vjw|verification/i.test(
              `${candidate.subject ?? ""} ${candidate.text ?? ""} ${candidate.html ?? ""}`,
            ),
            Number(process.env.JP_VJW_EMAIL_VERIFICATION_TIMEOUT_MS ?? "180000"),
            { since },
          );
          const source = `${message.text ?? ""} ${message.html ?? ""}`;
          return { url: source.match(/https?:\/\/[^\s"'<>]+/i)?.[0] };
        },
      },
    });
  }
  const paymentHooks = createManagedPaymentHooks({
    applicationId: payload.applicationId,
    workerId: executionContext.workerId,
    country: "kenya",
    visaType: "KE_ETA",
  });
  let issuedCard: ManagedPaymentCard | null = null;
  return normalizeAndRunKeEtaPortalSubmission(payload, {
    headless: process.env.KE_ETA_PLAYWRIGHT_HEADLESS !== "false",
    executionContext,
    statusLookup: {
      getExistingResult: async (applicationId) => {
        const existing = await lookupExistingResult(applicationId, identity.visaType);
        return existing as KeEtaSubmissionResult | null;
      },
    },
    payment: {
      prepare: async ({ amount, currency }) => {
        if (currency !== "USD" || !Number.isFinite(amount) || amount <= 0) {
          throw new KeEtaPortalError("Kenya eTA official payment amount is invalid.", {
            code: "ke_eta_official_fee_invalid",
          });
        }
        issuedCard ??= await paymentHooks.takePaymentCard?.() ?? null;
        if (!issuedCard) {
          throw new KeEtaPortalError("Kenya eTA managed virtual card could not be issued.", {
            code: "ke_eta_managed_card_unavailable",
          });
        }
        return {
          paymentSessionId: issuedCard.attemptId,
          pan: issuedCard.pan,
          expiry: issuedCard.expiry,
          cvv: issuedCard.cvv,
          holderName: issuedCard.holderName,
          last4: issuedCard.pan.slice(-4),
        };
      },
      finalize: async ({ paymentSessionId, outcome }) => {
        if (!issuedCard || issuedCard.attemptId !== paymentSessionId) {
          throw new KeEtaPortalError("Kenya eTA payment finalizer received an unknown card attempt.", {
            code: "ke_eta_payment_attempt_mismatch",
          });
        }
        await paymentHooks.finalizePaymentCard?.(
          issuedCard,
          outcome === "paid" ? "consumed" : "review_required",
        );
      },
    },
  });
}

function isSuccessful(result: AutomatedPortalResult): boolean {
  return result.country === "JP"
    ? result.status === "qr_ready" && result.submitted && result.qrReady
    : (result.status === "submitted" || result.status === "approved") && result.submitted && Boolean(result.officialReference);
}

function resultStatus(result: AutomatedPortalResult): "submitted" | "qr_ready" | "approved" | "rejected" | "needs_attention" | "failed" {
  if (result.country === "JP" && result.status === "qr_ready") return "qr_ready";
  if (result.country === "KE" && result.status === "approved") return "approved";
  if (result.country === "KE" && result.status === "submitted") return "submitted";
  if (result.country === "KE" && result.status === "rejected") return "rejected";
  if (result.status === "blocked" || result.status === "validation_failed") return "needs_attention";
  return "failed";
}

function errorDetail(error: unknown): {
  code: string;
  message: string;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
  retryable: boolean;
} {
  if (error instanceof JpVjwPortalError) {
    return { code: error.code, message: error.message, screenshots: error.screenshotPaths, pdfs: [], logs: error.logs, retryable: false };
  }
  if (error instanceof KeEtaPortalError) {
    return { code: error.code, message: error.message, screenshots: error.screenshotPaths, pdfs: error.pdfPaths, logs: error.logs, retryable: error.retryable };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { code: "automated_portal_runner_failed", message: message.slice(0, 500), screenshots: [], pdfs: [], logs: [], retryable: false };
}

export async function runAutomatedPortalPoolFlow(
  applicationId: string,
  jobId: string,
  flow: AutomatedPortalPoolFlow,
  executionContext?: RunnerExecutionContext,
): Promise<DispatchOutcome> {
  const poolIdentity = requirePoolExecutionIdentity(executionContext, jobId, "Automated portal pool execution");
  const owned = poolIdentity.executionContext;
  const identity = flowIdentity(flow);
  try {
    const { payload, applicantId } = await preparePayload(applicationId, jobId, flow);
    owned.assertOwned();
    const portal = await executePortal(flow, payload, owned, applicantId);
    owned.assertOwned();
    const screenshots = await persistFiles(jobId, `${flow}/screenshots`, portal.artifacts?.screenshots ?? [], "image/png");
    const sourceQrCodes = portal.country === "JP" ? (portal.artifacts?.qrCodes ?? []) : [];
    const qrCodes = await persistFiles(jobId, `${flow}/qr`, sourceQrCodes, "image/png");
    const sourcePdfs = portal.country === "KE" ? (portal.artifacts?.pdfs ?? []) : [];
    const pdfs = await persistFiles(jobId, `${flow}/pdfs`, sourcePdfs, "application/pdf");
    if (portal.country === "JP" && portal.status === "qr_ready" && qrCodes.length === 0) {
      throw new JpVjwPortalError("Visit Japan Web QR evidence could not be persisted.", {
        code: "jp_vjw_qr_persistence_failed",
        screenshotPaths: portal.artifacts?.screenshots,
        logs: portal.artifacts?.logs,
      });
    }
    if (portal.country === "KE" && portal.status === "approved" && pdfs.length === 0) {
      throw new KeEtaPortalError("Kenya eTA approval PDF could not be persisted.", {
        code: "ke_eta_approval_pdf_persistence_failed",
        screenshotPaths: portal.artifacts?.screenshots,
        pdfPaths: portal.artifacts?.pdfs,
        logs: portal.artifacts?.logs,
      });
    }
    const result: JpVisitJapanWebSubmissionResult | KeEtaSubmissionResult = {
      ...portal,
      artifacts: portal.country === "JP"
        ? { ...(portal.artifacts ?? { screenshots: [], qrCodes: [], logs: [], traces: [] }), screenshots, qrCodes, traces: [] }
        : { ...(portal.artifacts ?? { screenshots: [], pdfs: [], logs: [], traces: [] }), screenshots, pdfs, traces: [] },
      ...(portal.country === "KE" ? { approvalPdfStoragePath: pdfs[0] ?? null } : {}),
    } as JpVisitJapanWebSubmissionResult | KeEtaSubmissionResult;
    owned.assertOwned();
    await writeRunnerPoolSubmissionResult(owned, result, resultStatus(result));
    if (!isSuccessful(result)) throw new NeedsHumanError(`${identity.visaType} stopped without authoritative official evidence.`);
    return { outcome: "submitted_pending_pay", reachedStep: result.country === "JP" ? "official_qr" : "official_reference", artefacts: [...screenshots, ...qrCodes, ...pdfs] };
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === "AbortError";
    if (error instanceof RunnerJobOwnershipLostError || isAbortError || owned.signal.aborted) {
      const reason = owned.signal.reason;
      throw reason instanceof Error ? reason : error;
    }
    if (error instanceof NeedsHumanError) throw error;
    const detail = errorDetail(error);
    owned.assertOwned();
    const screenshots = await persistFiles(jobId, `${flow}/errors`, detail.screenshots, "image/png");
    const pdfs = await persistFiles(jobId, `${flow}/error-pdfs`, detail.pdfs, "application/pdf");
    const failure: JpVisitJapanWebSubmissionResult | KeEtaSubmissionResult = flow === "jp_vjw"
      ? {
        country: "JP", visaType: "JP_VISIT_JAPAN_WEB", status: "official_portal_error", mode: "live_assisted", provider: "jp_visit_japan_web_live",
        applicationId, submitted: false, qrReady: false, portalUrl: "https://www.vjw.digital.go.jp/", portalResponseSummary: detail.message,
        errorDetails: { code: detail.code, message: detail.message }, artifacts: { screenshots, qrCodes: [], logs: detail.logs, traces: [] },
      }
      : {
        country: "KE", visaType: "KE_ETA", status: "official_portal_error", mode: "live_assisted", provider: "ke_eta_live",
        applicationId, submitted: false, officialReference: null, portalUrl: "https://etakenya.go.ke/", portalResponseSummary: detail.message,
        errorDetails: { code: detail.code, message: detail.message }, artifacts: { screenshots, pdfs, logs: detail.logs, traces: [] },
      };
    owned.assertOwned();
    await writeRunnerPoolSubmissionResult(owned, failure, "failed");
    if (detail.retryable) throw new RetryableRunnerError(detail.message);
    throw new NeedsHumanError(detail.message);
  }
}
