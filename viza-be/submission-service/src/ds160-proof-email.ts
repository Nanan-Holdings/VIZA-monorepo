import { createHash, randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicantProfile, SubmissionQueueItem } from "./types";
import type { UsSubmissionResult } from "./submission-result";
import {
  startSubmissionQueueLeaseHeartbeat,
  SubmissionQueueOwnershipLostError,
  type SubmissionQueueLeaseHeartbeat,
} from "./submission-queue-claim";
import {
  startCeacSession, fillRetrieveApplicationForm, retrievalUrlFor,
  waitForDs160ConfirmationPage, ensureEnglishDs160Confirmation,
  resolveDs160ProofStartLocationCode,
  CeacError, GateDetectedError, NavigationError, SessionBootstrapError,
  type CeacErrorCode,
} from "./ceac";
import {
  sendOfficialDs160ConfirmationEmail, Ds160ConfirmationEmailError,
} from "./ceac/confirmation-email";
import { createDs160AuditStore, Ds160AuditStorageError, type Ds160AuditArtifactRef, type Ds160AuditStorageTransport } from "./ceac/audit-storage";
import { createDs160AuditStorageTransport } from "./ceac/audit-storage-transport";
import { decryptSecret, encryptSecret } from "./secret-cipher";

type EmailOutcome = "sent" | "failed" | "unknown";
export type Ds160EmailFailurePhase =
  | "preflight"
  | "bootstrap"
  | "retrieve"
  | "confirmation"
  | "send";

export type Ds160EmailFailureCause = "unknown" | "gate" | "navigation" | "bootstrap" | "ceac";

/** Public-safe failure metadata; never copy CEAC messages, URLs or context details. */
export interface Ds160EmailFailureEvidence {
  phase: Ds160EmailFailurePhase;
  cause: Ds160EmailFailureCause;
  ceacCode?: CeacErrorCode;
  status?: number;
}

export type Ds160EmailCaptureFailure = "page_closed" | "body" | "screenshot" | "form_metadata";

export interface Ds160EmailControlState {
  checked: boolean | null;
  disabled: boolean;
  type: string;
  namePresent: boolean;
  valuePresent: boolean;
}

export interface Ds160EmailControlMetadata {
  count: number;
  states: Ds160EmailControlState[];
  statesTruncated: boolean;
}

export interface Ds160EmailFormMetadata {
  controls: {
    no: Ds160EmailControlMetadata;
    yes: Ds160EmailControlMetadata;
    send: Ds160EmailControlMetadata;
  };
  noYesSameGroup: boolean;
  noYesSameForm: boolean;
  sendSameForm: boolean;
  formCount: number;
  form?: {
    method: "get" | "post" | "dialog" | "other";
    actionSafe: boolean;
    actionPath?: string;
    onsubmitHandlerPresent: boolean;
  };
  nativeValidity: {
    eligibleCount: number;
    validCount: number;
    invalidCount: number;
    allEligibleValid: boolean | null;
    anyInvalid: boolean;
  };
  aspNetValidation: {
    pageIsValidAvailable: boolean;
    pageIsValid?: boolean;
    validatorsAvailable: boolean;
    validatorCount?: number;
    validatorStatuses?: Array<boolean | null>;
    validValidatorCount?: number;
    invalidValidatorCount?: number;
    validatorStatusesTruncated?: boolean;
  };
  aspNetHiddenFields: {
    viewStatePresent: boolean;
    viewStateNonEmpty: boolean;
    eventValidationPresent: boolean;
    eventValidationNonEmpty: boolean;
  };
}

export interface Ds160EmailPageCapture {
  capturedAt: string;
  path?: string;
  body?: string;
  screenshotBase64?: string;
  formMetadata?: Ds160EmailFormMetadata;
  captureFailures: Ds160EmailCaptureFailure[];
}

type PublicDs160EmailCaptureFailure =
  | Ds160EmailCaptureFailure
  | "pre_send_page_closed"
  | "pre_send_body"
  | "pre_send_screenshot"
  | "pre_send_form_metadata";

type EmailAuditEvidence = {
  audit?: Ds160AuditArtifactRef;
  auditUnavailable?: true;
  auditFailureStage?: "capture" | "encryption" | "storage";
  auditFailureCode?: Ds160AuditStorageError["code"];
  auditCaptureFailures?: PublicDs160EmailCaptureFailure[];
};

function safeOfficialPath(page: Page): string | undefined {
  try {
    const url = new URL(page.url());
    return url.origin === "https://ceac.state.gov" && /^\/GenNIV\//i.test(url.pathname)
      ? url.pathname : undefined;
  } catch {
    return undefined;
  }
}

const EMAIL_FORM_PATH = "/GenNIV/common/email.aspx";
const FORM_METADATA_TIMEOUT_MS = 2_000;
const MAX_CONTROL_STATES = 32;
const MAX_VALIDATOR_STATES = 64;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("form_metadata_timeout")), timeoutMs);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

async function captureDs160EmailFormMetadata(page: Page): Promise<Ds160EmailFormMetadata> {
  return withTimeout(page.evaluate((selectors) => {
    if (window.location.origin !== "https://ceac.state.gov" ||
      window.location.pathname.toLowerCase() !== selectors.emailPath.toLowerCase()) {
      throw new Error("form_metadata_page_changed");
    }
    type FormControl = HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement;
    type Validator = { isvalid?: unknown };

    const read = {
      safeType(element: Element): string {
        const raw = (element.getAttribute("type") ?? "").trim().toLowerCase();
        return /^(?:button|checkbox|email|file|hidden|image|number|password|radio|reset|search|submit|tel|text|url)$/.test(raw)
          ? raw : raw ? "other" : "missing";
      },
      controlMetadata(selector: string) {
        const elements = Array.from(document.querySelectorAll(selector));
        const states = elements.slice(0, selectors.maxControlStates).map(element => {
          const formControl = element as Partial<FormControl>;
          const isCheckable = element instanceof HTMLInputElement &&
            (element.type === "radio" || element.type === "checkbox");
          return {
            checked: isCheckable ? Boolean((element as HTMLInputElement).checked) : null,
            disabled: "disabled" in formControl ? Boolean(formControl.disabled) : element.hasAttribute("disabled"),
            type: read.safeType(element),
            namePresent: element.hasAttribute("name"),
            valuePresent: element.hasAttribute("value"),
          };
        });
        return { count: elements.length, states, statesTruncated: elements.length > selectors.maxControlStates };
      },
      sameForm(left: HTMLFormElement | null | undefined, right: HTMLFormElement | null | undefined): boolean {
        return Boolean(left && right && left === right);
      },
      hiddenField(name: string): { present: boolean; nonEmpty: boolean } {
        const input = document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement | null;
        return { present: Boolean(input), nonEmpty: Boolean(input?.value) };
      },
    };

    const noElements = Array.from(document.querySelectorAll(selectors.no));
    const yesElements = Array.from(document.querySelectorAll(selectors.yes));
    const sendElements = Array.from(document.querySelectorAll(selectors.send));
    const no = noElements.length === 1 ? noElements[0] : undefined;
    const yes = yesElements.length === 1 ? yesElements[0] : undefined;
    const send = sendElements.length === 1 ? sendElements[0] : undefined;
    const noForm = no instanceof HTMLInputElement ? no.form : undefined;
    const yesForm = yes instanceof HTMLInputElement ? yes.form : undefined;
    const sendForm = send instanceof HTMLInputElement || send instanceof HTMLButtonElement ? send.form : undefined;
    const form = sendForm ?? noForm ?? yesForm;
    const noName = no?.getAttribute("name");
    const yesName = yes?.getAttribute("name");
    const rawMethod = (form?.getAttribute("method") ?? form?.method ?? "").trim().toLowerCase();
    const method: "get" | "post" | "dialog" | "other" =
      rawMethod === "get" || rawMethod === "post" || rawMethod === "dialog" ? rawMethod : "other";
    let actionSafe = false;
    let actionPath: string | undefined;
    if (form) {
      try {
        const action = new URL(form.getAttribute("action") || window.location.href, window.location.href);
        actionSafe = action.origin === "https://ceac.state.gov" &&
          action.pathname.toLowerCase() === selectors.emailPath.toLowerCase();
        if (actionSafe) actionPath = action.pathname;
      } catch { /* metadata remains redacted */ }
    }
    const formControls = form ? Array.from(form.elements) : [];
    const eligibleControls = formControls.filter(control => {
      const candidate = control as unknown as { willValidate?: unknown };
      return candidate.willValidate === true;
    });
    const invalidCount = eligibleControls.filter(control => {
      const candidate = control as unknown as { validity?: ValidityState };
      return candidate.validity?.valid === false;
    }).length;
    const validCount = eligibleControls.length - invalidCount;
    const pageWindow = window as unknown as { Page_IsValid?: unknown; Page_Validators?: unknown };
    const rawValidators = pageWindow.Page_Validators;
    const validators: unknown[] = Array.isArray(rawValidators) ? rawValidators : [];
    const validatorStatuses = validators.slice(0, selectors.maxValidatorStates).map(value => {
      if (!value || typeof value !== "object" || !("isvalid" in value)) return null;
      const status = (value as Validator).isvalid;
      return typeof status === "boolean" ? status : null;
    });
    const knownValidatorStatuses = validatorStatuses.filter((value): value is boolean => typeof value === "boolean");
    const viewState = read.hiddenField("__VIEWSTATE");
    const eventValidation = read.hiddenField("__EVENTVALIDATION");
    return {
      controls: {
        no: read.controlMetadata(selectors.no),
        yes: read.controlMetadata(selectors.yes),
        send: read.controlMetadata(selectors.send),
      },
      noYesSameGroup: Boolean(no && yes && noName && yesName && noName === yesName),
      noYesSameForm: read.sameForm(noForm, yesForm),
      sendSameForm: read.sameForm(sendForm, noForm) && read.sameForm(sendForm, yesForm),
      formCount: document.forms.length,
      ...(form ? {
        form: {
          method,
          actionSafe,
          ...(actionPath ? { actionPath } : {}),
          onsubmitHandlerPresent: typeof form.onsubmit === "function" || form.hasAttribute("onsubmit"),
        },
      } : {}),
      nativeValidity: {
        eligibleCount: eligibleControls.length,
        validCount,
        invalidCount,
        allEligibleValid: eligibleControls.length > 0 ? invalidCount === 0 : null,
        anyInvalid: invalidCount > 0,
      },
      aspNetValidation: {
        pageIsValidAvailable: typeof pageWindow.Page_IsValid === "boolean",
        ...(typeof pageWindow.Page_IsValid === "boolean" ? { pageIsValid: pageWindow.Page_IsValid } : {}),
        validatorsAvailable: Array.isArray(rawValidators),
        ...(Array.isArray(rawValidators) ? {
          validatorCount: validators.length,
          validatorStatuses,
          validValidatorCount: knownValidatorStatuses.filter(Boolean).length,
          invalidValidatorCount: knownValidatorStatuses.filter(value => !value).length,
          validatorStatusesTruncated: validators.length > selectors.maxValidatorStates,
        } : {}),
      },
      aspNetHiddenFields: {
        viewStatePresent: viewState.present,
        viewStateNonEmpty: viewState.nonEmpty,
        eventValidationPresent: eventValidation.present,
        eventValidationNonEmpty: eventValidation.nonEmpty,
      },
    };
  }, {
    no: "#ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_1",
    yes: "#ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_0",
    send: "#ctl00_SiteContentPlaceHolder_EmailButton",
    emailPath: EMAIL_FORM_PATH,
    maxControlStates: MAX_CONTROL_STATES,
    maxValidatorStates: MAX_VALIDATOR_STATES,
  }), FORM_METADATA_TIMEOUT_MS);
}

/** Capture visible official evidence and optional redacted form state; keep the result private. */
export async function captureDs160EmailPage(
  page: Page,
  options: { captureFormMetadata?: boolean } = {},
): Promise<Ds160EmailPageCapture> {
  const capturedAt = new Date().toISOString();
  const path = safeOfficialPath(page);
  try {
    if (page.isClosed()) return { capturedAt, path, captureFailures: ["page_closed"] };
  } catch {
    return { capturedAt, path, captureFailures: ["page_closed"] };
  }
  const captureFailures: Ds160EmailCaptureFailure[] = [];
  let body: string | undefined;
  let screenshotBase64: string | undefined;
  try { body = await page.locator("body").innerText({ timeout: 5_000 }); }
  catch { captureFailures.push("body"); }
  try { screenshotBase64 = (await page.screenshot({ timeout: 5_000 })).toString("base64"); }
  catch { captureFailures.push("screenshot"); }
  let formMetadata: Ds160EmailFormMetadata | undefined;
  if (options.captureFormMetadata && path?.toLowerCase() === EMAIL_FORM_PATH.toLowerCase()) {
    try { formMetadata = await captureDs160EmailFormMetadata(page); }
    catch { captureFailures.push("form_metadata"); }
  }
  return { capturedAt, path, body, screenshotBase64, ...(formMetadata ? { formMetadata } : {}), captureFailures };
}

function publicCaptureFailures(
  preSendCapture: Ds160EmailPageCapture | undefined,
  finalCapture: Ds160EmailPageCapture,
): PublicDs160EmailCaptureFailure[] {
  return [
    ...(preSendCapture?.captureFailures.map(failure => `pre_send_${failure}` as const) ?? []),
    ...finalCapture.captureFailures,
  ];
}

/** Keep partial official evidence; a screenshot failure must not discard text. */
export async function persistDs160EmailEvidence(input: {
  page: Page;
  jobId: string;
  runId: string;
  outcome: EmailOutcome;
  reserved: boolean;
  preSendCapture?: Ds160EmailPageCapture;
}, dependencies: {
  encrypt?: typeof encryptSecret;
  transport?: Ds160AuditStorageTransport;
} = {}): Promise<EmailAuditEvidence> {
  const evidence: EmailAuditEvidence = {};
  const finalCapture = await captureDs160EmailPage(input.page);
  const captureFailures = publicCaptureFailures(input.preSendCapture, finalCapture);
  if (captureFailures.length) evidence.auditCaptureFailures = captureFailures;
  const hasPreSendContent = Boolean(input.preSendCapture?.body?.trim() || input.preSendCapture?.screenshotBase64);
  if (!finalCapture.body?.trim() && !finalCapture.screenshotBase64 && !hasPreSendContent) {
    return { ...evidence, auditUnavailable: true, auditFailureStage: "capture" };
  }
  let stage: "encryption" | "storage" = "encryption";
  try {
    const encrypt = dependencies.encrypt ?? encryptSecret;
    const ciphertext = encrypt(JSON.stringify({
      version: 1, evidenceKind: "official_confirmation_email", capturedAt: finalCapture.capturedAt,
      ...(finalCapture.path ? { path: finalCapture.path } : {}),
      body: finalCapture.body, screenshotBase64: finalCapture.screenshotBase64,
      captureFailures: finalCapture.captureFailures,
      ...(input.preSendCapture ? { preSend: input.preSendCapture } : {}),
      outcome: input.outcome, reserved: input.reserved,
    }));
    stage = "storage";
    const store = createDs160AuditStore(encrypt, {
      jobId: input.jobId, runId: input.runId,
      transport: dependencies.transport ?? createDs160AuditStorageTransport({
        url: process.env.SUPABASE_URL!, key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      }),
      onStored: ref => { evidence.audit = { path: ref.path, sha256: ref.sha256, sizeBytes: ref.sizeBytes }; },
    });
    await store.write("official-evidence.enc", ciphertext);
  } catch (error) {
    evidence.auditUnavailable = true;
    evidence.auditFailureStage = stage;
    if (error instanceof Ds160AuditStorageError) evidence.auditFailureCode = error.code;
  }
  return evidence;
}
type EmailPayload = Record<string, unknown> & {
  action: "official_ceac_email";
  email: {
    status: string;
    request_id: string;
    recipient_sha256: string;
    send_started_at?: string | null;
  };
};

export function isDs160OfficialEmailJob(item: Pick<SubmissionQueueItem, "provider" | "ceac_result_payload">): boolean {
  return item.provider === "ceac_proof" && item.ceac_result_payload?.action === "official_ceac_email";
}

export function parseDs160EmailPayload(value: unknown): EmailPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ds160_email_request_invalid");
  const row = value as Record<string, unknown>;
  const email = row.email as Record<string, unknown> | undefined;
  if (row.action !== "official_ceac_email" || !email || typeof email !== "object" ||
      !/^[0-9a-f-]{36}$/i.test(String(email.request_id ?? "")) ||
      !/^[0-9a-f]{64}$/.test(String(email.recipient_sha256 ?? "")) ||
      !["queued", "sending", "sent", "unknown", "failed"].includes(String(email.status))) {
    throw new Error("ds160_email_request_invalid");
  }
  return row as EmailPayload;
}

export function ds160RecipientDigest(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

const DS160_EMAIL_CEAC_CODES: Partial<Record<CeacErrorCode, string>> = {
  UNEXPECTED_PAGE: "ds160_email_unexpected_page",
  SESSION_EXPIRED: "ds160_email_session_expired",
  NAVIGATION_FAILED: "ds160_email_navigation_failed",
  VALIDATION_FAILED: "ds160_email_validation_failed",
  SESSION_BOOTSTRAP_FAILED: "ds160_email_session_bootstrap_failed",
  GATE_DETECTED: "ds160_email_gate_detected",
  MANUAL_ACTION_REQUIRED: "ds160_email_manual_action_required",
  DS160_REVIEW_UNVERIFIED: "ds160_email_review_unverified",
  DS160_REVIEW_MISMATCH: "ds160_email_review_mismatch",
};

function safeCeacStatus(error: CeacError): number | undefined {
  const status = error.context.details?.status;
  return typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599
    ? status : undefined;
}

function ceacFailureCause(error: CeacError): Ds160EmailFailureCause {
  if (error instanceof GateDetectedError) return "gate";
  if (error instanceof NavigationError) return "navigation";
  if (error instanceof SessionBootstrapError) return "bootstrap";
  return "ceac";
}

export function classifyDs160EmailFailure(
  error: unknown,
  reserved: boolean,
  phase: Ds160EmailFailurePhase = "preflight",
): {
  status: EmailOutcome; code: string; failure?: Ds160EmailFailureEvidence;
} {
  // A persisted reservation is conservative: even a failed click could have
  // dispatched the POST. Only a fresh, explicit user request can authorize more.
  const ceacError = !reserved && error instanceof CeacError ? error : null;
  const classifiedCeacCode = ceacError ? DS160_EMAIL_CEAC_CODES[ceacError.code] : undefined;
  const failure: Ds160EmailFailureEvidence | undefined = reserved ? undefined : {
    phase,
    cause: ceacError ? ceacFailureCause(ceacError) : "unknown",
    ...(classifiedCeacCode ? { ceacCode: ceacError!.code } : {}),
    ...(ceacError && safeCeacStatus(ceacError) !== undefined ? { status: safeCeacStatus(ceacError) } : {}),
  };
  return {
    status: reserved ? "unknown" : "failed",
    code: error instanceof Ds160ConfirmationEmailError
      ? error.code
      : reserved ? "ds160_email_receipt_unconfirmed"
        : classifiedCeacCode
          ?? (error instanceof Error && /^ds160_email_(?:recipient_changed|submitted_identity_required|retrieval_data_required|config_blocked)$/.test(error.message)
            ? error.message : "ds160_email_retrieval_failed"),
    ...(failure ? { failure } : {}),
  };
}

export interface Ds160EmailJobDependencies {
  client: SupabaseClient;
  headless: boolean;
  leaseSeconds: number;
  loadProfile: (applicationId: string) => Promise<ApplicantProfile>;
  loadAnswers: (applicationId: string) => Promise<Record<string, string>>;
  configurationError?: string | null;
  /** Local fixtures exercise the same job/lease code without portal traffic. */
  runtime?: Partial<{
    startSession: typeof startCeacSession;
    retrieve: typeof fillRetrieveApplicationForm;
    waitForConfirmation: typeof waitForDs160ConfirmationPage;
    ensureEnglish: typeof ensureEnglishDs160Confirmation;
    sendEmail: typeof sendOfficialDs160ConfirmationEmail;
  }>;
  /** Local fixtures can replace evidence persistence without changing production behavior. */
  persistEvidence?: typeof persistDs160EmailEvidence;
}

/** Proof-only job: never writes application state and never invokes signing. */
export async function processDs160OfficialEmailJob(
  item: SubmissionQueueItem,
  dependencies: Ds160EmailJobDependencies,
): Promise<void> {
  const { client } = dependencies;
  const runtime = {
    startSession: startCeacSession, retrieve: fillRetrieveApplicationForm,
    waitForConfirmation: waitForDs160ConfirmationPage, ensureEnglish: ensureEnglishDs160Confirmation,
    sendEmail: sendOfficialDs160ConfirmationEmail, ...dependencies.runtime,
  };
  const runId = `ds160-email-${randomUUID()}`;
  let session: Awaited<ReturnType<typeof startCeacSession>> | null = null;
  let lease: SubmissionQueueLeaseHeartbeat | null = null;
  let reserved = false;
  let failurePhase: Ds160EmailFailurePhase = "preflight";
  let outcome: EmailOutcome = "failed";
  let errorCode: string | null = null;
  let preSendCapture: Ds160EmailPageCapture | undefined;
  const evidence: Record<string, unknown> = { runId };
  const claim = { p_queue_id: item.id, p_worker_id: item.locked_by, p_locked_at: item.locked_at };
  const assertOwned = (): void => {
    if (!lease) throw new SubmissionQueueOwnershipLostError();
    lease.assertOwned();
  };
  console.log(`[ceac-email] Starting ${runId}`);

  try {
    let payload = parseDs160EmailPayload(item.ceac_result_payload);
    reserved = Boolean(payload.email.send_started_at);
    if (!item.locked_by || !item.locked_at) throw new SubmissionQueueOwnershipLostError();
    const { data: started, error: startError } = await client.rpc("start_ds160_proof_email", claim);
    if (startError || !Array.isArray(started) || started.length !== 1) throw new SubmissionQueueOwnershipLostError();
    // A second handler may have received an older claim snapshot. Only the
    // locked, fresh row returned by start can authorize browser preparation.
    payload = parseDs160EmailPayload(started[0].ceac_result_payload);
    reserved = Boolean(payload.email.send_started_at);
    lease = await startSubmissionQueueLeaseHeartbeat({
      client, queueId: item.id, workerId: item.locked_by, leaseSeconds: dependencies.leaseSeconds,
      onOwnershipLost: async () => { if (session) await session.close(); },
    });
    if (reserved || payload.email.status === "sent" || payload.email.status === "unknown") {
      throw new Error("ds160_email_send_already_reserved");
    }
    if (dependencies.configurationError) throw new Error("ds160_email_config_blocked");

    const [{ data: application, error: appError }, profile] = await Promise.all([
      client.from("applications").select("submission_result,ds160_application_id")
        .eq("id", item.application_id).single(),
      dependencies.loadProfile(item.application_id),
    ]);
    const result = application?.submission_result as Partial<UsSubmissionResult> | null;
    if (appError || !result || result.country !== "US" || result.status !== "submitted" ||
        !result.applicationId || result.applicationId !== application.ds160_application_id || !profile.auth_user_id) {
      throw new Error("ds160_email_submitted_identity_required");
    }
    const { data: authData, error: authError } = await client.auth.admin.getUserById(profile.auth_user_id);
    const recipient = authData.user?.email?.trim();
    if (authError || !recipient || ds160RecipientDigest(recipient) !== payload.email.recipient_sha256) {
      throw new Error("ds160_email_recipient_changed");
    }
    const answers = await dependencies.loadAnswers(item.application_id);
    const location = resolveDs160ProofStartLocationCode(answers);
    const securityAnswer = result.securityAnswer ??
      (result.securityAnswerCipher ? decryptSecret(result.securityAnswerCipher) : null);
    if (!securityAnswer || !result.surnameFirst5 || !result.yearOfBirth) throw new Error("ds160_email_retrieval_data_required");
    assertOwned();
    failurePhase = "bootstrap";
    session = await runtime.startSession({
      headless: dependencies.headless, acceptDownloads: true, runId,
      startAction: "retrieve", startLocationCode: location, captchaMaxAttempts: 3,
    });
    assertOwned();
    failurePhase = "retrieve";
    await session.page.goto(retrievalUrlFor(result.applicationId), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await runtime.retrieve(session.page, {
      applicationId: result.applicationId, surnameFirstFive: result.surnameFirst5,
      yearOfBirth: String(result.yearOfBirth), securityAnswer,
    });
    failurePhase = "confirmation";
    await runtime.waitForConfirmation(session.page);
    await runtime.ensureEnglish(session.page, result.applicationId);
    assertOwned();
    console.log(`[ceac-email] ${runId} official_confirmation_verified`);
    failurePhase = "send";
    const receipt = await runtime.sendEmail({
      page: session.page, expectedApplicationId: result.applicationId, verifiedRecipient: recipient,
      assertOwned,
      beforeSend: async () => {
        assertOwned();
        preSendCapture = await captureDs160EmailPage(session!.page, { captureFormMetadata: true });
        assertOwned();
        const { data, error } = await client.rpc("reserve_ds160_email_send", claim);
        if (error || !Array.isArray(data) || data.length !== 1) throw new SubmissionQueueOwnershipLostError();
        reserved = true;
        assertOwned();
        console.log(`[ceac-email] ${runId} dispatch_reserved`);
      },
    });
    evidence.diagnostics = receipt.diagnostics;
    outcome = "sent";
  } catch (error) {
    const failure = classifyDs160EmailFailure(error, reserved, failurePhase);
    outcome = failure.status;
    errorCode = failure.code;
    if (failure.failure) evidence.failure = failure.failure;
    if (error instanceof Ds160ConfirmationEmailError) evidence.diagnostics = error.diagnostics;
    evidence.ownershipLost = error instanceof SubmissionQueueOwnershipLostError || lease?.isOwnershipLost() === true;
  } finally {
    // Private, encrypted official evidence allows a disputed/slow response to
    // be diagnosed without logging the applicant's confirmation or recipient.
    if (session) {
      const persistEvidence = dependencies.persistEvidence ?? persistDs160EmailEvidence;
      Object.assign(evidence, await persistEvidence({
        page: session.page, jobId: item.id, runId, outcome, reserved, preSendCapture,
      }));
    }
    // Do not expose a terminal/retryable row until the provider session closes.
    let closed = !session;
    try { if (session) { await session.close(); closed = true; } }
    finally { await lease?.stopRenewal(); }
    if (!closed) throw new Error("ds160_email_session_cleanup_failed");
    if (lease && !lease.isOwnershipLost()) {
      lease.assertOwned();
      const { data, error } = await client.rpc("settle_ds160_proof_email", {
        ...claim, p_status: outcome, p_error_code: errorCode, p_evidence: evidence,
      });
      if (error || !Array.isArray(data) || data.length !== 1) {
        throw new Error("ds160_email_settlement_unconfirmed");
      }
      console.log(`[ceac-email] ${runId} ${outcome}`);
    } else {
      console.log(`[ceac-email] ${runId} ownership_lost_no_replay`);
    }
  }
}
