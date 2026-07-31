import * as fs from "node:fs/promises";
import * as path from "node:path";
import { artifact } from "../artifact.js";
import { buildCountrySubmissionApplication } from "../country-submissions/from-records.js";
import { getCountrySubmissionProvider } from "../country-submissions/index.js";
import type { SubmissionPayload } from "../country-submissions/types.js";
import { ensureApplicantInboxAlias } from "../inbox/alias.js";
import { hasAliasEmailForwardingConsent } from "../inbox/forwarding-consent.js";
import { assertInboxAliasDomainRoutable } from "../inbox/wait-for-message.js";
import { MdacPortalValidationError, normalizeMdacPortalPayload } from "../mdac/normalize.js";
import { MdacPortalError, runMdacPortalSubmission } from "../mdac/runner.js";
import { writeSubmissionResult } from "../result-writer.js";
import type { DigitalArrivalCardSubmissionResult } from "../submission-result.js";
import { supabase } from "../supabase.js";
import { normalizeTdacPortalPayload, TdacPortalValidationError } from "../tdac/normalize.js";
import { runTdacPortalSubmission, TdacPortalError } from "../tdac/runner.js";
import { normalizeVnPrearrivalPortalPayload, routeVnPrearrivalEmailAnswers, VnPrearrivalPortalValidationError } from "../vn-prearrival/normalize.js";
import { runVietnamPrearrivalPortalSubmission, VnPrearrivalPortalError } from "../vn-prearrival/runner.js";
import { loadCountrySubmissionContext } from "./answers.js";
import { NeedsHumanError, RetryableRunnerError, type DispatchOutcome } from "./types.js";

export type ArrivalCardPoolFlow = "mdac" | "tdac" | "vn_prearrival";

interface PortalResult {
  submitted: boolean;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  screenshots: string[];
  qrCodes?: string[];
  pdfs: string[];
  logs: string[];
}

async function persistFiles(
  jobId: string,
  prefix: string,
  paths: string[],
  contentType: "image/png" | "application/pdf",
  required = false,
): Promise<string[]> {
  const stored: string[] = [];
  for (let index = 0; index < paths.length; index += 1) {
    const filePath = paths[index];
    try {
      const bytes = await fs.readFile(filePath);
      const extension = contentType === "image/png" ? "png" : "pdf";
      const safeBase = path.basename(filePath).replace(/[^a-zA-Z0-9._-]+/gu, "-");
      const ref = await artifact.put(
        jobId,
        `${prefix}/${String(index + 1).padStart(2, "0")}-${safeBase || `artifact.${extension}`}`,
        bytes,
        { contentType, upsert: true },
      );
      stored.push(ref.path);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.warn(`[runner-pool] ${prefix} artifact persistence failed: ${message}`);
      if (required) {
        throw new Error(`Required ${prefix} artifact could not be persisted.`);
      }
    }
  }
  return stored;
}

function flowIdentity(flow: ArrivalCardPoolFlow): {
  countryCode: "MY" | "TH" | "VN";
  visaType: DigitalArrivalCardSubmissionResult["visaType"];
  provider: DigitalArrivalCardSubmissionResult["provider"];
} {
  if (flow === "mdac") {
    return {
      countryCode: "MY",
      visaType: "MY_MDAC_ARRIVAL_CARD",
      provider: "malaysia_mdac_live",
    };
  }
  if (flow === "tdac") {
    return {
      countryCode: "TH",
      visaType: "TH_TDAC_ARRIVAL_CARD",
      provider: "thailand_tdac_live",
    };
  }
  return {
    countryCode: "VN",
    visaType: "VN_PREARRIVAL_DECLARATION",
    provider: "vietnam_prearrival_live",
  };
}

async function preparePayload(
  applicationId: string,
  jobId: string,
  flow: ArrivalCardPoolFlow,
): Promise<{ payload: SubmissionPayload; applicantId: string }> {
  const context = await loadCountrySubmissionContext(applicationId);
  let submissionApplication = context.submissionApplication;

  if (flow === "vn_prearrival") {
    const managedAlias = await ensureApplicantInboxAlias(context.profile.id);
    await assertInboxAliasDomainRoutable(managedAlias.alias);
    if (!(await hasAliasEmailForwardingConsent(context.profile.id))) {
      throw new NeedsHumanError(
        "Vietnam Pre-Arrival official-email forwarding consent is required.",
      );
    }
    const answers = routeVnPrearrivalEmailAnswers(
      context.answers,
      managedAlias.alias,
      context.profile.email,
    );
    submissionApplication = buildCountrySubmissionApplication(
      context.profile,
      context.application,
      answers,
    );
  }

  const provider = getCountrySubmissionProvider(
    context.application.country,
    context.application.visa_type,
  );
  const identity = flowIdentity(flow);
  if (!provider || provider.countryCode !== identity.countryCode) {
    throw new NeedsHumanError(
      `${identity.visaType} country submission provider is not registered.`,
    );
  }
  const validation = provider.validate(submissionApplication);
  if (!validation.ok) {
    throw new NeedsHumanError(
      `${identity.visaType} is missing required answers: ${validation.missingRequiredFields.join(", ")}`,
    );
  }
  return {
    payload: provider.mapToSubmissionPayload(submissionApplication, {
      dryRun: false,
      idempotencyKey: `runner-pool:${jobId}`,
    }),
    applicantId: context.profile.id,
  };
}

async function executePortal(
  flow: ArrivalCardPoolFlow,
  payload: SubmissionPayload,
  applicantId: string,
): Promise<PortalResult> {
  if (flow === "mdac") {
    return runMdacPortalSubmission(normalizeMdacPortalPayload(payload), {
      headless: process.env.MDAC_WORKER_PLAYWRIGHT_HEADLESS !== "false",
      stopBeforeSubmit: process.env.MDAC_STOP_BEFORE_SUBMIT === "1",
    });
  }
  if (flow === "tdac") {
    return runTdacPortalSubmission(normalizeTdacPortalPayload(payload), {
      headless: process.env.TDAC_PLAYWRIGHT_HEADLESS !== "false",
      stopBeforeSubmit: process.env.TDAC_STOP_BEFORE_SUBMIT === "1",
    });
  }
  return runVietnamPrearrivalPortalSubmission(
    normalizeVnPrearrivalPortalPayload(payload),
    {
      headless: process.env.VN_PREARRIVAL_PLAYWRIGHT_HEADLESS !== "false",
      stopBeforeSubmit: process.env.VN_PREARRIVAL_STOP_BEFORE_SUBMIT === "1",
      applicantId,
    },
  );
}

function portalErrorDetails(error: unknown): {
  code: string;
  message: string;
  summary: string;
  screenshots: string[];
  logs: string[];
  retryable: boolean;
} {
  if (error instanceof MdacPortalError) {
    return {
      code: error.code,
      message: error.message,
      summary: error.portalSummary ?? error.message,
      screenshots: error.screenshotPaths,
      logs: [],
      retryable: true,
    };
  }
  if (error instanceof TdacPortalError) {
    return {
      code: error.code,
      message: error.message,
      summary: error.portalSummary ?? error.message,
      screenshots: error.screenshotPaths,
      logs: error.logs,
      retryable: true,
    };
  }
  if (error instanceof VnPrearrivalPortalError) {
    return {
      code: error.code,
      message: error.message,
      summary: error.portalSummary,
      screenshots: error.screenshotPaths,
      logs: error.logs,
      retryable: true,
    };
  }
  const validation =
    error instanceof MdacPortalValidationError ||
    error instanceof TdacPortalValidationError ||
    error instanceof VnPrearrivalPortalValidationError;
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: validation ? "arrival_card_validation_failed" : "arrival_card_pool_failed",
    message,
    summary: message,
    screenshots: [],
    logs: [],
    retryable: !validation,
  };
}

export async function runArrivalCardPoolFlow(
  applicationId: string,
  jobId: string,
  flow: ArrivalCardPoolFlow,
): Promise<DispatchOutcome> {
  const identity = flowIdentity(flow);
  try {
    const { payload, applicantId } = await preparePayload(applicationId, jobId, flow);
    const portal = await executePortal(flow, payload, applicantId);
    const screenshots = await persistFiles(
      jobId,
      `${flow}/screenshots`,
      portal.screenshots,
      "image/png",
    );
    const pdfs = await persistFiles(
      jobId,
      `${flow}/pdfs`,
      portal.pdfs,
      "application/pdf",
    );
    const qrCodes = await persistFiles(
      jobId,
      `${flow}/qr`,
      portal.qrCodes ?? [],
      "image/png",
      flow === "vn_prearrival" && portal.submitted,
    );
    const result: DigitalArrivalCardSubmissionResult = {
      country: identity.countryCode,
      visaType: identity.visaType,
      status: portal.submitted ? "submitted" : "official_portal_error",
      mode: "live_assisted",
      provider: identity.provider,
      applicationId,
      submitted: portal.submitted,
      confirmationNumber: portal.confirmationNumber ?? null,
      referenceNumber: portal.referenceNumber ?? null,
      portalUrl: portal.portalUrl,
      portalResponseSummary: portal.portalResponseSummary,
      confirmationPdfStoragePath: pdfs[0] ?? null,
      artifacts: {
        screenshots,
        qrCodes,
        pdfs,
        logs: portal.logs,
        traces: [],
      },
    };
    await writeSubmissionResult(applicationId, result, portal.submitted ? "submitted" : "failed");
    if (!portal.submitted) {
      throw new NeedsHumanError(
        `${identity.visaType} stopped without an official confirmation.`,
      );
    }
    return {
      outcome: "submitted_pending_pay",
      reachedStep: "official_confirmation",
      artefacts: [...pdfs, ...qrCodes],
    };
  } catch (error) {
    if (error instanceof NeedsHumanError) throw error;
    const detail = portalErrorDetails(error);
    const screenshots = await persistFiles(
      jobId,
      `${flow}/errors`,
      detail.screenshots,
      "image/png",
    );
    const result: DigitalArrivalCardSubmissionResult = {
      country: identity.countryCode,
      visaType: identity.visaType,
      status: detail.code.includes("validation")
        ? "validation_failed"
        : "official_portal_error",
      mode: "live_assisted",
      provider: identity.provider,
      applicationId,
      submitted: false,
      confirmationNumber: null,
      referenceNumber: null,
      portalUrl:
        flow === "mdac"
          ? "https://imigresen-online.imi.gov.my/mdac/main"
          : flow === "tdac"
            ? "https://tdac.immigration.go.th/arrival-card/#/home"
            : "https://prearrival.immigration.gov.vn/",
      portalResponseSummary: detail.summary,
      errorDetails: { code: detail.code, message: detail.message },
      artifacts: { screenshots, pdfs: [], logs: detail.logs, traces: [] },
    };
    await writeSubmissionResult(applicationId, result, "failed");
    if (detail.retryable) throw new RetryableRunnerError(detail.message);
    throw new NeedsHumanError(detail.message);
  }
}
