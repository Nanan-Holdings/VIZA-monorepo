import type { Page } from "@playwright/test";
import { createArrivalCardBrowserSession } from "../arrival-card-browser.js";
import type { SubmissionPayload } from "../country-submissions/types.js";
import {
  closeResourceBestEffort,
  launchAbortableResource,
} from "../queue/portal-safety.js";
import type { RunnerExecutionContext } from "../queue/execution-context.js";
import {
  JP_VJW_OFFICIAL_PORTAL_URL,
  JpVjwPortalValidationError,
  normalizeJpVjwPortalPayload,
  type JpVjwPortalPayload,
} from "./normalize.js";
import { JpVjwPortalError } from "./errors.js";
import { prepareJpVjwManagedAccount } from "./account.js";
import { submitJpVjwLive, type JpVjwManagedInbox } from "./live-adapter.js";
import {
  hasOfficialJpVjwQrEvidence,
  resolveJpVjwUserAgent,
} from "./selectors.js";

export interface JpVjwPortalSubmissionResult {
  country: "JP";
  visaType: "JP_VISIT_JAPAN_WEB";
  status: "qr_ready" | "blocked" | "validation_failed" | "official_portal_error";
  mode: "live_assisted" | "dry_run";
  provider: "jp_visit_japan_web_live";
  applicationId: string;
  submitted: boolean;
  qrReady: boolean;
  referenceNumber?: string | null;
  submittedAt?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  errorDetails?: { code: string; message: string; missingFields?: string[] };
  artifacts?: { screenshots: string[]; qrCodes: string[]; logs: string[]; traces: string[] };
}

export { JpVjwPortalError } from "./errors.js";

export interface JpVjwStatusLookup {
  getExistingResult: (applicationId: string, idempotencyKey: string) => Promise<JpVjwPortalSubmissionResult | null>;
}

export interface JpVjwPortalAdapterContext {
  page: Page;
  payload: JpVjwPortalPayload;
  logs: string[];
  screenshots: string[];
  qrCodes: string[];
  executionContext?: RunnerExecutionContext;
  applicantId?: string;
  aliasEmail?: string;
  inbox?: ManagedAliasInbox;
}

export interface JpVjwPortalAdapter {
  submit: (context: JpVjwPortalAdapterContext) => Promise<{
    portalUrl: string;
    referenceNumber?: string | null;
    submittedAt?: string | null;
    qrArtifactPath?: string | null;
    bodyText: string;
  }>;
}

export type ManagedAliasInbox = JpVjwManagedInbox;

export interface JpVjwPortalRunnerOptions {
  headless?: boolean;
  dryRun?: boolean;
  liveEnabled?: boolean;
  delegatedOperationApproved?: boolean;
  executionContext?: RunnerExecutionContext;
  adapter?: JpVjwPortalAdapter;
  statusLookup?: JpVjwStatusLookup;
  aliasEmail?: string;
  applicantId?: string;
  inbox?: ManagedAliasInbox;
}

function blockedResult(payload: JpVjwPortalPayload, code: string, message: string, mode: "live_assisted" | "dry_run" = "live_assisted"): JpVjwPortalSubmissionResult {
  return {
    country: "JP",
    visaType: "JP_VISIT_JAPAN_WEB",
    status: "blocked",
    mode,
    provider: "jp_visit_japan_web_live",
    applicationId: payload.applicationId,
    submitted: false,
    qrReady: false,
    referenceNumber: null,
    submittedAt: null,
    portalUrl: JP_VJW_OFFICIAL_PORTAL_URL,
    portalResponseSummary: message,
    errorDetails: { code, message },
    artifacts: { screenshots: [], qrCodes: [], logs: [code], traces: [] },
  };
}

function isQrReady(payload: JpVjwPortalPayload, response: Awaited<ReturnType<JpVjwPortalAdapter["submit"]>>): boolean {
  return hasOfficialJpVjwQrEvidence({
    portalUrl: response.portalUrl,
    bodyText: response.bodyText,
    qrElementVisible: Boolean(response.qrArtifactPath),
    qrArtifactPath: response.qrArtifactPath,
  }) && payload.applicationId.trim().length > 0;
}

export async function runJpVjwPortalSubmission(
  payload: JpVjwPortalPayload,
  options: JpVjwPortalRunnerOptions = {},
): Promise<JpVjwPortalSubmissionResult> {
  options.executionContext?.assertOwned();
  if (options.dryRun) return blockedResult(payload, "jp_vjw_dry_run", "Dry-run did not access Visit Japan Web.", "dry_run");
  if (!options.delegatedOperationApproved && process.env.JP_VJW_DELEGATED_OPERATION_APPROVED !== "true") {
    return blockedResult(payload, "jp_vjw_delegated_operation_not_approved", "Visit Japan Web terms require the traveller to operate registration or information entry unless delegated operation is expressly approved; no account, CAPTCHA, or official submission action was attempted.");
  }
  if (!options.liveEnabled && process.env.JP_VJW_LIVE_ENABLED !== "true") {
    return blockedResult(payload, "jp_vjw_live_disabled", "Japan Visit Japan Web live gate is disabled; no official submission was attempted.");
  }
  if (options.statusLookup) {
    const existing = await options.statusLookup.getExistingResult(payload.applicationId, payload.idempotencyKey);
    if (existing?.status === "qr_ready" && existing.qrReady && existing.submitted) return existing;
  }
  if (!options.adapter && (!options.applicantId || !options.aliasEmail || !options.inbox)) {
    return blockedResult(payload, "jp_vjw_alias_context_missing", "A managed alias/applicant context is required before creating a Visit Japan Web session.");
  }

  const screenshots: string[] = [];
  const qrCodes: string[] = [];
  const logs: string[] = [`jpvjw_start application=${payload.applicationId}`];
  if (options.adapter) {
    const response = await options.adapter.submit({
      page: undefined as unknown as Page,
      payload,
      logs,
      screenshots,
      qrCodes,
      executionContext: options.executionContext,
    });
    options.executionContext?.assertOwned();
    if (!isQrReady(payload, response)) {
      throw new JpVjwPortalError("Visit Japan Web adapter did not provide official QR evidence.", {
        code: "jp_vjw_qr_evidence_missing",
        screenshotPaths: screenshots,
        logs,
      });
    }
    return {
      country: "JP",
      visaType: "JP_VISIT_JAPAN_WEB",
      status: "qr_ready",
      mode: "live_assisted",
      provider: "jp_visit_japan_web_live",
      applicationId: payload.applicationId,
      submitted: true,
      qrReady: true,
      referenceNumber: response.referenceNumber ?? null,
      submittedAt: response.submittedAt ?? new Date().toISOString(),
      portalUrl: response.portalUrl,
      portalResponseSummary: "Official Visit Japan Web QR evidence captured.",
      artifacts: { screenshots, qrCodes: response.qrArtifactPath ? [response.qrArtifactPath] : qrCodes, logs, traces: [] },
    };
  }

  const browserSession = await launchAbortableResource(
    options.executionContext?.signal,
    () => createArrivalCardBrowserSession({ prefix: "JP_VJW", headless: options.headless }),
    (resource) => resource.close(),
  );
  const adapterContext = {
    page: browserSession.page,
    payload,
    logs,
    screenshots,
    qrCodes,
    executionContext: options.executionContext,
    applicantId: options.applicantId,
    aliasEmail: options.aliasEmail,
    inbox: options.inbox,
  } satisfies JpVjwPortalAdapterContext;
  try {
    const cdpSession = await browserSession.context.newCDPSession(browserSession.page);
    await cdpSession.send("Network.setUserAgentOverride", {
      userAgent: resolveJpVjwUserAgent(),
    });
    logs.push("jpvjw_user_agent_override=windows_chrome");
    const account = await prepareJpVjwManagedAccount({
      applicantId: options.applicantId!,
      aliasEmail: options.aliasEmail!,
      correlationId: payload.applicationId,
    });
    const response = await submitJpVjwLive({
      page: adapterContext.page,
      payload,
      account,
      applicantId: options.applicantId!,
      inbox: options.inbox!,
      logs,
      screenshots,
      qrCodes,
      executionContext: options.executionContext,
    });
    options.executionContext?.assertOwned();
    if (!isQrReady(payload, response)) {
      throw new JpVjwPortalError("Official Visit Japan Web QR page was not reached; refusing qr_ready.", {
        code: "jp_vjw_qr_evidence_missing",
        screenshotPaths: screenshots,
        logs,
      });
    }
    return {
      country: "JP",
      visaType: "JP_VISIT_JAPAN_WEB",
      status: "qr_ready",
      mode: "live_assisted",
      provider: "jp_visit_japan_web_live",
      applicationId: payload.applicationId,
      submitted: true,
      qrReady: true,
      referenceNumber: response.referenceNumber,
      submittedAt: response.submittedAt,
      portalUrl: response.portalUrl,
      portalResponseSummary: "Official Visit Japan Web QR evidence captured.",
      artifacts: { screenshots, qrCodes, logs, traces: [] },
    };
  } finally {
    await closeResourceBestEffort(browserSession);
  }
}

export async function normalizeAndRunJpVjwPortalSubmission(
  payload: SubmissionPayload,
  options: JpVjwPortalRunnerOptions = {},
): Promise<JpVjwPortalSubmissionResult> {
  try {
    return await runJpVjwPortalSubmission(normalizeJpVjwPortalPayload(payload), options);
  } catch (error) {
    if (error instanceof JpVjwPortalValidationError) {
      return {
        ...blockedResult({
          applicationId: payload.applicationId,
          idempotencyKey: payload.idempotencyKey,
          passportType: "Ordinary passport",
          surname: "",
          givenNames: "",
          emailAddress: "invalid@example.invalid",
          fullName: "",
          dateOfBirth: "",
          sex: "",
          nationality: "",
          passportNumber: "",
          passportExpiryDate: "",
          passportIssuingCountry: "",
          phoneNumber: "",
          residenceCountry: "",
          occupation: "",
          residenceCity: "",
          arrivalDate: "",
          portOfEntry: "",
          arrivalAirline: "",
          flightNumber: "",
          lastEmbarkationCountry: "",
          departureCityOrPort: "",
          purposeOfVisit: "",
          plannedStayDays: 0,
          accommodationName: "",
          accommodationAddress: "",
          accommodationPostalCode: "",
          accommodationPhone: "",
          immigrationAnswers: {
            hasBeenDeported: "no",
            hasCriminalRecord: "no",
            hasControlledSubstancesOrWeapons: "no",
            declarationConfirmed: "yes",
          },
          customsAnswers: {
            hasProhibitedGoods: "no",
            hasRestrictedGoods: "no",
            hasGoldOrGoldProducts: "no",
            hasDutiableGoods: "no",
            hasCommercialGoods: "no",
            hasGoodsForOtherPerson: "no",
            hasUnaccompaniedBaggage: "no",
            hasCashOrValuablesOverThreshold: "no",
            declarationConfirmed: "yes",
          },
          customsDeclaration: "no",
          immigrationDeclaration: "yes",
          finalDeclaration: "yes",
        }, "jp_vjw_payload_validation_failed", error.message),
        status: "validation_failed",
        errorDetails: { code: error.code, message: error.message, missingFields: error.missingFields },
      };
    }
    throw error;
  }
}
