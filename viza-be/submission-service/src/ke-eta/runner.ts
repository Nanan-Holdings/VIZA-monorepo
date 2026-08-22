import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { Page } from "@playwright/test";
import { createArrivalCardBrowserSession } from "../arrival-card-browser.js";
import { solveCaptcha } from "../captcha/index.js";
import type { SubmissionPayload } from "../country-submissions/types.js";
import {
  closeResourceBestEffort,
  launchAbortableResource,
} from "../queue/portal-safety.js";
import type { RunnerExecutionContext } from "../queue/execution-context.js";
import {
  KE_ETA_OFFICIAL_PORTAL_URL,
  KeEtaPortalValidationError,
  normalizeKeEtaPortalPayload,
  type KeEtaPortalPayload,
} from "./normalize.js";
import {
  extractKeEtaReference,
  hasOfficialKeEtaReferenceEvidence,
  isOfficialKeEtaUrl,
  isPdfBytes,
  KE_ETA_SELECTORS,
} from "./selectors.js";

export interface RestrictedVirtualCardHandoff {
  prepare: (input: { applicationId: string; amount: number; currency: "USD"; idempotencyKey: string }) => Promise<{
    paymentSessionId: string;
    pan: string;
    expiry: string;
    cvv: string;
    holderName: string;
    last4?: string;
  }>;
  finalize: (input: { paymentSessionId: string; outcome: "paid" | "failed" }) => Promise<void>;
}

export interface KeEtaPortalSubmissionResult {
  country: "KE";
  visaType: "KE_ETA";
  status: "submitted" | "approved" | "rejected" | "blocked" | "validation_failed" | "official_portal_error";
  mode: "live_assisted" | "dry_run";
  provider: "ke_eta_live";
  applicationId: string;
  submitted: boolean;
  officialReference?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  paymentReceipt?: string | null;
  approvalPdfStoragePath?: string | null;
  errorDetails?: { code: string; message: string; missingFields?: string[] };
  artifacts?: { screenshots: string[]; pdfs: string[]; logs: string[]; traces: string[] };
}

export class KeEtaPortalError extends Error {
  readonly code: string;
  readonly screenshotPaths: string[];
  readonly pdfPaths: string[];
  readonly logs: string[];
  readonly retryable: boolean;

  constructor(message: string, options: { code: string; screenshotPaths?: string[]; pdfPaths?: string[]; logs?: string[]; retryable?: boolean }) {
    super(message);
    this.name = "KeEtaPortalError";
    this.code = options.code;
    this.screenshotPaths = options.screenshotPaths ?? [];
    this.pdfPaths = options.pdfPaths ?? [];
    this.logs = options.logs ?? [];
    this.retryable = options.retryable ?? false;
  }
}

export interface KeEtaPortalAdapterContext {
  page: Page;
  payload: KeEtaPortalPayload;
  logs: string[];
  screenshots: string[];
  pdfs: string[];
  executionContext?: RunnerExecutionContext;
  takePaymentCard: () => Promise<Awaited<ReturnType<RestrictedVirtualCardHandoff["prepare"]>>>;
}

export interface KeEtaPortalAdapter {
  submit: (context: KeEtaPortalAdapterContext) => Promise<{
    portalUrl: string;
    bodyText: string;
    officialReference?: string | null;
    submittedAt?: string | null;
    approvedAt?: string | null;
    approvalPdfPath?: string | null;
    paymentReceipt?: string | null;
    status: "submitted" | "approved" | "rejected";
  }>;
}

export interface KeEtaStatusLookup {
  getExistingResult: (applicationId: string, idempotencyKey: string) => Promise<KeEtaPortalSubmissionResult | null>;
}

export interface KeEtaPortalRunnerOptions {
  headless?: boolean;
  dryRun?: boolean;
  liveEnabled?: boolean;
  executionContext?: RunnerExecutionContext;
  adapter?: KeEtaPortalAdapter;
  statusLookup?: KeEtaStatusLookup;
  payment?: RestrictedVirtualCardHandoff;
}

function blockedResult(payload: KeEtaPortalPayload, code: string, message: string, mode: "live_assisted" | "dry_run" = "live_assisted"): KeEtaPortalSubmissionResult {
  return {
    country: "KE",
    visaType: "KE_ETA",
    status: "blocked",
    mode,
    provider: "ke_eta_live",
    applicationId: payload.applicationId,
    submitted: false,
    officialReference: null,
    submittedAt: null,
    approvedAt: null,
    portalUrl: KE_ETA_OFFICIAL_PORTAL_URL,
    portalResponseSummary: message,
    paymentReceipt: null,
    approvalPdfStoragePath: null,
    errorDetails: { code, message },
    artifacts: { screenshots: [], pdfs: [], logs: [code], traces: [] },
  };
}

async function saveScreenshot(page: Page, name: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "viza-ke-eta-"));
  const filePath = path.join(directory, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function assertPdf(pathValue: string): Promise<void> {
  const bytes = await fs.readFile(pathValue).catch(() => null);
  if (!bytes || !isPdfBytes(bytes)) throw new KeEtaPortalError("Kenya eTA approval artifact is not an official PDF.", { code: "ke_eta_approval_pdf_invalid" });
}

function observeConfirmedDraftSteps(bodyText: string, logs: string[]): void {
  const expectedSteps = [
    "residenceCountry",
    "applicationType",
    "passportInformation",
    "selfieOrPhoto",
    "contactInformation",
    "tripInformation",
    "travelInformation",
    "customsDeclaration",
    "requiredDocuments",
    "confirmAndProceed",
    "selectTypeOfTa",
  ] as const;
  const labels: Record<(typeof expectedSteps)[number], RegExp> = {
    residenceCountry: /residence\s+country|country\s+of\s+residence/iu,
    applicationType: /select\s+type|individual\s+application/iu,
    passportInformation: /passport\s+information/iu,
    selfieOrPhoto: /selfie\s+or\s+photo/iu,
    contactInformation: /contact\s+information/iu,
    tripInformation: /trip\s+information/iu,
    travelInformation: /travel\s+information/iu,
    customsDeclaration: /customs\s+declaration/iu,
    requiredDocuments: /required\s+documents/iu,
    confirmAndProceed: /confirm\s+and\s+proceed/iu,
    selectTypeOfTa: /select\s+type\s+of\s+ta/iu,
  };
  const observed = expectedSteps.filter((step) => labels[step].test(bodyText));
  logs.push(`ke_eta_confirmed_draft_steps=${observed.length}/${expectedSteps.length}`);
  if (observed.length < expectedSteps.length) {
    throw new KeEtaPortalError("Kenya eTA draft steps or selectors have not been fully reconfirmed; refusing to advance or submit.", {
      code: "ke_eta_draft_steps_recon_required",
    });
  }
}

async function inspectDefaultPortal(context: KeEtaPortalAdapterContext): Promise<Awaited<ReturnType<KeEtaPortalAdapter["submit"]>>> {
  const { page, payload, logs, screenshots, pdfs, executionContext } = context;
  executionContext?.assertOwned();
  await page.goto(KE_ETA_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const portalUrl = page.url();
  const bodyText = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
  screenshots.push(await saveScreenshot(page, "landing"));
  if (!isOfficialKeEtaUrl(portalUrl)) {
    throw new KeEtaPortalError("Kenya eTA redirected away from the official host.", { code: "ke_eta_unexpected_host", screenshotPaths: screenshots });
  }
  if (/access\s+denied|web\s+page\s+blocked|cloudflare/i.test(bodyText)) {
    throw new KeEtaPortalError("Kenya eTA official portal is blocked before the form could be opened.", { code: "ke_eta_portal_blocked", screenshotPaths: screenshots, retryable: true });
  }
  observeConfirmedDraftSteps(bodyText, logs);
  const email = page.locator(KE_ETA_SELECTORS.email.join(",")).first();
  if ((await email.count().catch(() => 0)) > 0) await email.fill(payload.emailAddress);
  const passport = page.locator(KE_ETA_SELECTORS.passport.join(",")).first();
  if ((await passport.count().catch(() => 0)) > 0) await passport.fill(payload.passportNumber);
  const captcha = page.locator("[data-sitekey]").first();
  if ((await captcha.count().catch(() => 0)) > 0) {
    const siteKey = await captcha.getAttribute("data-sitekey");
    if (!siteKey) throw new KeEtaPortalError("Kenya eTA CAPTCHA site key was not readable.", { code: "ke_eta_captcha_sitekey_missing", screenshotPaths: screenshots });
    const solve = await solveCaptcha({ type: "recaptcha-v2", siteKey, pageUrl: portalUrl });
    await page.evaluate((token) => {
      for (const element of Array.from(document.querySelectorAll("textarea[name='g-recaptcha-response'], input[name='g-recaptcha-response']"))) {
        const input = element as HTMLInputElement | HTMLTextAreaElement;
        input.value = token;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, solve.text);
    logs.push(`ke_eta_captcha_solved solve_id=${solve.solveId}`);
  }
  // Live selectors are deliberately not guessed beyond the confirmed fields.
  // A reference and approval PDF are required before this adapter can report success.
  throw new KeEtaPortalError("Kenya eTA live form selectors have not been reconfirmed; refusing to submit without official evidence.", {
    code: "ke_eta_selector_recon_required",
    screenshotPaths: screenshots,
    logs,
  });
}

function assertSubmittedEvidence(response: Awaited<ReturnType<KeEtaPortalAdapter["submit"]>>): string {
  const reference = response.officialReference ?? extractKeEtaReference(response.bodyText);
  if (!hasOfficialKeEtaReferenceEvidence({ portalUrl: response.portalUrl, bodyText: response.bodyText, reference })) {
    throw new KeEtaPortalError("Kenya eTA response has no official reference evidence.", { code: "ke_eta_reference_missing" });
  }
  return reference!;
}

export async function runKeEtaPortalSubmission(
  payload: KeEtaPortalPayload,
  options: KeEtaPortalRunnerOptions = {},
): Promise<KeEtaPortalSubmissionResult> {
  options.executionContext?.assertOwned();
  if (options.dryRun) return blockedResult(payload, "ke_eta_dry_run", "Dry-run did not access the Kenya eTA portal.", "dry_run");
  if (!options.liveEnabled && process.env.KE_ETA_LIVE_ENABLED !== "true") return blockedResult(payload, "ke_eta_live_disabled", "Kenya eTA live gate is disabled; no official submission was attempted.");
  if (options.statusLookup) {
    const existing = await options.statusLookup.getExistingResult(payload.applicationId, payload.idempotencyKey);
    if (existing && (existing.status === "approved" || existing.status === "submitted") && existing.submitted && existing.officialReference) return existing;
  }
  if (!payload.attachments?.passportBioPage || !payload.attachments.passportPhoto) {
    return blockedResult(payload, "ke_eta_application_documents_missing", "Kenya eTA passport bio page and photo must be resolved from application_documents before submission.");
  }
  if (!options.payment) return blockedResult(payload, "ke_eta_payment_handoff_missing", "A restricted application-scoped virtual-card handoff is required before Kenya eTA payment.");

  const screenshots: string[] = [];
  const pdfs: string[] = [];
  const logs: string[] = [`ke_eta_start application=${payload.applicationId}`];
  type PreparedCard = Awaited<ReturnType<RestrictedVirtualCardHandoff["prepare"]>>;
  const paymentState: { value: PreparedCard | null } = { value: null };
  const takePaymentCard = async () => {
    options.executionContext?.checkpoint("kenya_eta_payment_card");
    paymentState.value ??= await options.payment!.prepare({
      applicationId: payload.applicationId,
      amount: payload.officialFeeAmount,
      currency: payload.officialFeeCurrency,
      idempotencyKey: payload.idempotencyKey,
    });
    return paymentState.value;
  };
  try {
    const response = options.adapter
      ? await options.adapter.submit({ page: undefined as unknown as Page, payload, logs, screenshots, pdfs, executionContext: options.executionContext, takePaymentCard })
      : await (async () => {
        const browserSession = await launchAbortableResource(options.executionContext?.signal, () => createArrivalCardBrowserSession({ prefix: "KE_ETA", headless: options.headless }), (resource) => resource.close());
        try {
          return await inspectDefaultPortal({ page: browserSession.page, payload, logs, screenshots, pdfs, executionContext: options.executionContext, takePaymentCard });
        } finally {
          await closeResourceBestEffort(browserSession);
        }
      })();
    options.executionContext?.assertOwned();
    const payment = paymentState.value;
    if (!payment) {
      throw new KeEtaPortalError("Kenya eTA adapter returned a submission result without consuming the application-scoped payment card.", {
        code: "ke_eta_payment_evidence_missing",
        screenshotPaths: screenshots,
      });
    }
    const reference = assertSubmittedEvidence(response);
    if (response.status === "approved") {
      if (!response.approvalPdfPath) throw new KeEtaPortalError("Kenya eTA approved response has no official PDF.", { code: "ke_eta_approval_pdf_missing", screenshotPaths: screenshots });
      await assertPdf(response.approvalPdfPath);
      pdfs.push(response.approvalPdfPath);
    }
    await options.payment.finalize({ paymentSessionId: payment.paymentSessionId, outcome: "paid" });
    const status = response.status === "approved" ? "approved" : response.status;
    return {
      country: "KE",
      visaType: "KE_ETA",
      status,
      mode: "live_assisted",
      provider: "ke_eta_live",
      applicationId: payload.applicationId,
      submitted: true,
      officialReference: reference,
      submittedAt: response.submittedAt ?? new Date().toISOString(),
      approvedAt: response.approvedAt ?? null,
      portalUrl: response.portalUrl,
      portalResponseSummary: response.status === "approved" ? "Official Kenya eTA reference and approval PDF captured." : "Official Kenya eTA reference captured; approval is pending.",
      paymentReceipt: response.paymentReceipt ?? null,
      approvalPdfStoragePath: pdfs[0] ?? null,
      artifacts: { screenshots, pdfs, logs, traces: [] },
    };
  } catch (error) {
    const payment = paymentState.value;
    if (payment) {
      await options.payment.finalize({ paymentSessionId: payment.paymentSessionId, outcome: "failed" }).catch(() => undefined);
    }
    throw error;
  }
}

export async function normalizeAndRunKeEtaPortalSubmission(
  payload: SubmissionPayload,
  options: KeEtaPortalRunnerOptions = {},
): Promise<KeEtaPortalSubmissionResult> {
  try {
    return await runKeEtaPortalSubmission(normalizeKeEtaPortalPayload(payload), options);
  } catch (error) {
    if (error instanceof KeEtaPortalValidationError) {
      return {
        ...blockedResult({
          applicationId: payload.applicationId,
          idempotencyKey: payload.idempotencyKey,
          emailAddress: "invalid@example.invalid",
          surname: "",
          givenNames: "",
          fullName: "",
          dateOfBirth: "",
          sex: "",
          nationality: "",
          passportNumber: "",
          passportIssueDate: "",
          passportExpiryDate: "",
          passportIssuingCountry: "",
          phoneNumber: "",
          residentialAddress: "",
          arrivalDate: "",
          departureDate: "",
          arrivalPoint: "",
          purposeOfVisit: "",
          purposeOfTravel: "",
          flightNumber: "",
          entryPoint: "",
          accommodationName: "",
          accommodationAddress: "",
          accommodationPhone: "",
          processingSpeed: "Standard",
          hasCurrencyOverUsd10000: "no",
          declarationConfirmed: "yes",
          attachments: {},
          officialFeeCurrency: "USD",
          officialFeeAmount: 30,
        }, "ke_eta_payload_validation_failed", error.message),
        status: "validation_failed",
        errorDetails: { code: error.code, message: error.message, missingFields: error.missingFields },
      };
    }
    throw error;
  }
}
