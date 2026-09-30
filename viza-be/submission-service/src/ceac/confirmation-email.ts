import { createHash } from "node:crypto";
import type { Locator, Page, Request, Response } from "@playwright/test";
import { assertCeacPostbackHealthy, waitForAspNetPostbackStable } from "./aspnet";
import { CeacError } from "./errors";
import { assertNoGate } from "./gates";
import { isOfficialDs160ConfirmationPage } from "./pages";

const CEAC_ORIGIN = "https://ceac.state.gov";
const EMAIL_PAGE_PATH = "/GenNIV/common/email.aspx";
const EMAIL_OPEN_SELECTOR = "#ctl00_SiteContentPlaceHolder_FormView1_btnEmailConfirm";
const EMAIL_SEND_SELECTOR = "#ctl00_SiteContentPlaceHolder_EmailButton";
const ADDITIONAL_EMAIL_YES_SELECTOR = "#ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_0";
const ADDITIONAL_EMAIL_NO_SELECTOR = "#ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_1";

// These are deliberately narrow candidate receipt phrases. They are only
// accepted as success evidence when they appear after the one final dispatch;
// a generic Thank You page or an instruction to send an email is insufficient.
const EMAIL_SENT_MARKER = /(?:confirmation email|email confirmation)\s+(?:has been|was|has successfully been)\s+(?:sent|e-?mailed)\b|email\s+sent\s+successfully\b/i;
const EMAIL_FAILURE_MARKER = /email.{0,60}(?:failed|unable|error)|unable to.{0,30}email/i;
const EMAIL_ADDRESS_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAX_NETWORK_EVENTS = 64;
const CRITICAL_RESOURCE_TYPES = new Set(["document", "xhr", "fetch"]);
const DEFAULT_OVERALL_TIMEOUT_MS = 180_000;
const MAX_OVERALL_TIMEOUT_MS = 180_000;

export type Ds160ConfirmationEmailNetworkPhase =
  | "confirmation"
  | "open"
  | "email_form"
  | "additional_recipient"
  | "send";

export type Ds160ConfirmationEmailCode =
  | "ds160_email_request_invalid"
  | "ds160_email_confirmation_unverified"
  | "ds160_email_form_unavailable"
  | "ds160_email_recipient_mismatch"
  | "ds160_email_additional_recipient_unavailable"
  | "ds160_email_send_control_unavailable"
  | "ds160_email_receipt_unconfirmed"
  | "ds160_email_failed";

export interface Ds160ConfirmationEmailNetworkEvent {
  kind: "request" | "response" | "request_failed";
  phase: Ds160ConfirmationEmailNetworkPhase;
  method: string;
  path: string;
  resourceType: string;
  status?: number;
  elapsedMs: number;
}

export interface Ds160ConfirmationEmailDiagnostics {
  sendAttempted: boolean;
  dispatchClickTimedOut: boolean;
  finalPath: string | null;
  elapsedMs: number;
  receiptEvidenceHash?: string;
  events: readonly Ds160ConfirmationEmailNetworkEvent[];
}

export class Ds160ConfirmationEmailError extends Error {
  readonly code: Ds160ConfirmationEmailCode;
  readonly diagnostics: Ds160ConfirmationEmailDiagnostics;

  constructor(code: Ds160ConfirmationEmailCode, message: string, diagnostics: Ds160ConfirmationEmailDiagnostics) {
    super(message);
    this.name = "Ds160ConfirmationEmailError";
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

export interface Ds160ConfirmationEmailOptions {
  page: Page;
  expectedApplicationId: string;
  verifiedRecipient: string;
  /** Reserve the durable email-send fence; this is called once immediately before dispatch. */
  beforeSend: () => void | Promise<void>;
  /** Assert that the current worker still owns the queue/session lease. */
  assertOwned: () => void | Promise<void>;
  /** Test-only and bounded runtime controls; production defaults match CEAC observations. */
  controlTimeoutMs?: number;
  postbackTimeoutMs?: number;
  dispatchTimeoutMs?: number;
  receiptTimeoutMs?: number;
  overallTimeoutMs?: number;
}

export interface Ds160ConfirmationEmailResult {
  status: "sent";
  applicationIdVerified: true;
  recipientVerified: true;
  diagnostics: Ds160ConfirmationEmailDiagnostics;
}

type MutableDiagnostics = {
  sendAttempted: boolean;
  dispatchClickTimedOut: boolean;
  finalPath: string | null;
  phase: Ds160ConfirmationEmailNetworkPhase;
  receiptEvidenceHash?: string;
  startedAt: number;
  events: Ds160ConfirmationEmailNetworkEvent[];
};

function clampTimeout(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), 60_000));
}

function clampOverallTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_OVERALL_TIMEOUT_MS;
  return Math.max(1, Math.min(Math.floor(value), MAX_OVERALL_TIMEOUT_MS));
}

function isMainDocumentNavigation(page: Page, request: Request): boolean {
  if (!request.isNavigationRequest() || request.resourceType() !== "document") return false;
  try {
    return request.frame() === page.mainFrame();
  } catch {
    return false;
  }
}

function officialPath(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== CEAC_ORIGIN || !/^\/GenNIV\//i.test(url.pathname)) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function currentOfficialPath(page: Page): string | null {
  return officialPath(page.url());
}

function hasHttpFailure(error: CeacError | undefined): boolean {
  const status = error?.context.details?.status;
  return typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599;
}

function diagnosticsSnapshot(diagnostics: MutableDiagnostics): Ds160ConfirmationEmailDiagnostics {
  return {
    sendAttempted: diagnostics.sendAttempted,
    dispatchClickTimedOut: diagnostics.dispatchClickTimedOut,
    finalPath: diagnostics.finalPath,
    elapsedMs: Math.max(0, Date.now() - diagnostics.startedAt),
    ...(diagnostics.receiptEvidenceHash ? { receiptEvidenceHash: diagnostics.receiptEvidenceHash } : {}),
    events: [...diagnostics.events],
  };
}

function recordNetworkEvent(
  diagnostics: MutableDiagnostics,
  event: Omit<Ds160ConfirmationEmailNetworkEvent, "elapsedMs">,
): void {
  const nextEvent: Ds160ConfirmationEmailNetworkEvent = {
    ...event,
    elapsedMs: Math.max(0, Date.now() - diagnostics.startedAt),
  };
  if (diagnostics.events.length < MAX_NETWORK_EVENTS) {
    diagnostics.events.push(nextEvent);
    return;
  }

  // CEAC confirmation pages can load enough images/scripts that a simple
  // first-64 cap loses the final POST. Keep the bounded list, but let
  // document/XHR/fetch, POST and failed requests evict asset noise. A send
  // phase only raises the priority of those critical events; delayed image or
  // script responses remain low priority even after the click starts.
  const priority = (candidate: Ds160ConfirmationEmailNetworkEvent): number => {
    const method = candidate.method.toUpperCase();
    const resourceType = candidate.resourceType.toLowerCase();
    const isAsset = method !== "POST" && !CRITICAL_RESOURCE_TYPES.has(resourceType);
    if (isAsset) return 1;
    const critical = candidate.kind === "request_failed"
      || method === "POST"
      || CRITICAL_RESOURCE_TYPES.has(resourceType)
      || (candidate.status !== undefined && candidate.status >= 400);
    if (!critical) return 1;
    return candidate.phase === "send" ? 3 : 2;
  };
  const nextPriority = priority(nextEvent);
  const replaceIndex = diagnostics.events.findIndex(candidate => priority(candidate) < nextPriority);
  if (replaceIndex >= 0) {
    diagnostics.events.splice(replaceIndex, 1);
    diagnostics.events.push(nextEvent);
  }
}

function observeOfficialNetwork(page: Page, diagnostics: MutableDiagnostics): () => void {
  const requestPhases = new WeakMap<Request, Ds160ConfirmationEmailNetworkPhase>();
  const onRequest = (request: Request) => {
    const path = officialPath(request.url());
    if (!path) return;
    const phase = diagnostics.phase;
    requestPhases.set(request, phase);
    recordNetworkEvent(diagnostics, {
      kind: "request",
      phase,
      method: request.method(),
      path,
      resourceType: request.resourceType(),
    });
  };
  const onResponse = (response: Response) => {
    const path = officialPath(response.url());
    if (!path) return;
    const request = response.request();
    recordNetworkEvent(diagnostics, {
      kind: "response",
      phase: requestPhases.get(request) ?? diagnostics.phase,
      method: request.method(),
      path,
      resourceType: request.resourceType(),
      status: response.status(),
    });
  };
  const onRequestFailed = (request: Request) => {
    const path = officialPath(request.url());
    if (!path) return;
    recordNetworkEvent(diagnostics, {
      kind: "request_failed",
      phase: requestPhases.get(request) ?? diagnostics.phase,
      method: request.method(),
      path,
      resourceType: request.resourceType(),
    });
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  return () => {
    page.off("request", onRequest);
    page.off("response", onResponse);
    page.off("requestfailed", onRequestFailed);
  };
}

async function uniqueVisible(page: Page, selector: string, label: string): Promise<Locator> {
  const locator = page.locator(`${selector}:visible`);
  const count = await locator.count().catch(() => 0);
  if (count !== 1) {
    throw new Error(`CEAC email ${label} control was not uniquely visible.`);
  }
  return locator.first();
}

async function assertOfficialConfirmation(
  page: Page,
  expectedApplicationId: string,
  diagnostics: MutableDiagnostics,
): Promise<void> {
  if (!currentOfficialPath(page)) {
    throw new Error("CEAC email confirmation requires the official CEAC origin.");
  }
  assertCeacPostbackHealthy(page);
  await assertNoGate(page);
  if (!(await isOfficialDs160ConfirmationPage(page, expectedApplicationId))) {
    throw new Error("CEAC submitted confirmation identity could not be verified before email dispatch.");
  }
  diagnostics.finalPath = currentOfficialPath(page);
}

async function assertEmailFormPage(page: Page, diagnostics: MutableDiagnostics): Promise<void> {
  if (currentOfficialPath(page)?.toLowerCase() !== EMAIL_PAGE_PATH.toLowerCase()) {
    throw new Error("CEAC email confirmation form did not open on the official email page.");
  }
  assertCeacPostbackHealthy(page);
  await assertNoGate(page);
  diagnostics.finalPath = currentOfficialPath(page);
}

async function readVisibleBody(page: Page, timeoutMs = 5_000): Promise<string> {
  const timeout = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(Math.floor(timeoutMs), 5_000)) : 5_000;
  return page.locator("body").innerText({ timeout }).catch(() => "");
}

function hashReceiptEvidence(body: string): string | undefined {
  const normalized = body.trim();
  return normalized ? createHash("sha256").update(normalized, "utf8").digest("hex") : undefined;
}

async function verifyRecipient(
  page: Page,
  recipient: string,
  diagnostics: MutableDiagnostics,
  timeoutMs = 5_000,
): Promise<void> {
  const body = await readVisibleBody(page, timeoutMs);
  const addresses = body.match(EMAIL_ADDRESS_PATTERN) ?? [];
  if (addresses.length !== 1 || addresses[0]?.toLowerCase() !== recipient.toLowerCase()) {
    throw new Ds160ConfirmationEmailError(
      "ds160_email_recipient_mismatch",
      "CEAC email recipient did not match the verified account recipient.",
      diagnosticsSnapshot(diagnostics),
    );
  }
}

async function controlValue(control: Locator): Promise<string> {
  return control.evaluate((element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) return element.value.trim();
    return (element.textContent ?? "").trim();
  });
}

async function readReceipt(
  page: Page,
  timeoutMs = 5_000,
): Promise<{ status: "sent" | "failed" | "unknown"; evidenceHash?: string }> {
  // Receipt text is only evidence when it is read from the CEAC page that
  // handled the email request.  A cross-origin redirect must never be able
  // to turn arbitrary text into a successful send result.
  if (!currentOfficialPath(page)) return { status: "unknown" };
  const body = await readVisibleBody(page, timeoutMs);
  if (!currentOfficialPath(page)) return { status: "unknown" };
  const evidenceHash = hashReceiptEvidence(body);
  if (EMAIL_FAILURE_MARKER.test(body)) return { status: "failed", evidenceHash };
  if (EMAIL_SENT_MARKER.test(body)) return { status: "sent", evidenceHash };
  return { status: "unknown", evidenceHash };
}

async function waitForReceipt(
  page: Page,
  timeoutMs: number,
): Promise<{ status: "sent" | "failed" | "unknown"; evidenceHash?: string }> {
  const deadline = Date.now() + timeoutMs;
  let state: { status: "sent" | "failed" | "unknown"; evidenceHash?: string } = { status: "unknown" };
  while (Date.now() < deadline) {
    if (page.isClosed()) return state;
    // Re-check on every poll.  A delayed postback may navigate away after
    // the first response; in that case the body must remain unclassified.
    if (!currentOfficialPath(page)) return { status: "unknown" };
    state = await readReceipt(page, Math.max(1, deadline - Date.now()));
    if (state.status !== "unknown") return state;
    await page.waitForTimeout(Math.min(250, Math.max(1, deadline - Date.now())));
  }
  return state;
}

/**
 * Send CEAC's official confirmation email exactly once on the current page.
 * This function only operates on a previously verified submitted application;
 * it never signs, submits, creates a draft, opens a popup, or retries the
 * final Email Confirmation click.
 */
export async function sendOfficialDs160ConfirmationEmail(
  options: Ds160ConfirmationEmailOptions,
): Promise<Ds160ConfirmationEmailResult> {
  const diagnostics: MutableDiagnostics = {
    sendAttempted: false,
    dispatchClickTimedOut: false,
    finalPath: null,
    phase: "confirmation",
    startedAt: Date.now(),
    events: [],
  };
  const page = options.page;
  const expectedApplicationId = options.expectedApplicationId.trim();
  const recipient = options.verifiedRecipient.trim();
  const controlTimeoutMs = clampTimeout(options.controlTimeoutMs, 20_000);
  const postbackTimeoutMs = clampTimeout(options.postbackTimeoutMs, 30_000);
  const dispatchTimeoutMs = clampTimeout(options.dispatchTimeoutMs, 30_000);
  const receiptTimeoutMs = clampTimeout(options.receiptTimeoutMs, 30_000);
  const overallDeadline = Date.now() + clampOverallTimeout(options.overallTimeoutMs);
  const remainingBudget = (phaseTimeoutMs: number): number => Math.max(1, Math.min(phaseTimeoutMs, overallDeadline - Date.now()));
  const stopNetworkObserver = observeOfficialNetwork(page, diagnostics);

  const fail = (code: Ds160ConfirmationEmailCode, message: string): never => {
    diagnostics.finalPath = currentOfficialPath(page);
    throw new Ds160ConfirmationEmailError(code, message, diagnosticsSnapshot(diagnostics));
  };
  const requireVisible = async (
    selector: string,
    label: string,
    code: Ds160ConfirmationEmailCode,
    message: string,
  ): Promise<Locator> => {
    try {
      return await uniqueVisible(page, selector, label);
    } catch {
      return fail(code, message);
    }
  };

  try {
    if (!expectedApplicationId || !recipient || !EMAIL_ADDRESS_PATTERN.test(recipient)) {
      fail("ds160_email_request_invalid", "CEAC email confirmation request is incomplete.");
    }
    EMAIL_ADDRESS_PATTERN.lastIndex = 0;

    await options.assertOwned();
    await assertOfficialConfirmation(page, expectedApplicationId, diagnostics).catch((error: unknown) => {
      if (error instanceof Ds160ConfirmationEmailError) throw error;
      fail("ds160_email_confirmation_unverified", "CEAC submitted confirmation identity could not be verified.");
    });

    const openControl = await requireVisible(
      EMAIL_OPEN_SELECTOR,
      "open",
      "ds160_email_form_unavailable",
      "CEAC Email Confirmation control was unavailable.",
    );
    if (!(await openControl.isEnabled().catch(() => false))) {
      fail("ds160_email_form_unavailable", "CEAC Email Confirmation control was disabled.");
    }
    diagnostics.phase = "open";
    const emailPagePromise = page
      .waitForURL(url => officialPath(String(url)) === EMAIL_PAGE_PATH, {
        waitUntil: "domcontentloaded",
        timeout: remainingBudget(controlTimeoutMs),
      })
      .then(() => true)
      .catch(() => false);
    try {
      await openControl.click({ timeout: remainingBudget(controlTimeoutMs) });
    } catch {
      // A dispatched click may still complete navigation. Do not click the
      // official control again; the path check below determines the outcome.
    }
    const opened = await emailPagePromise;
    if (!opened && currentOfficialPath(page)?.toLowerCase() !== EMAIL_PAGE_PATH.toLowerCase()) {
      fail("ds160_email_form_unavailable", "CEAC Email Confirmation form did not open.");
    }
    if (!opened) {
      await waitForAspNetPostbackStable(page, remainingBudget(postbackTimeoutMs)).catch(() => undefined);
    }
    await assertEmailFormPage(page, diagnostics).catch(() => {
      fail("ds160_email_form_unavailable", "CEAC Email Confirmation form could not be verified.");
    });
    diagnostics.phase = "email_form";
    await verifyRecipient(page, recipient, diagnostics, remainingBudget(controlTimeoutMs));

    const noAdditional = await requireVisible(
      ADDITIONAL_EMAIL_NO_SELECTOR,
      "additional-recipient No",
      "ds160_email_additional_recipient_unavailable",
      "CEAC additional-recipient controls were unavailable.",
    );
    const yesAdditional = await requireVisible(
      ADDITIONAL_EMAIL_YES_SELECTOR,
      "additional-recipient Yes",
      "ds160_email_additional_recipient_unavailable",
      "CEAC additional-recipient controls were unavailable.",
    );
    const [noType, yesType] = await Promise.all([
      noAdditional.getAttribute("type"),
      yesAdditional.getAttribute("type"),
    ]);
    if (noType !== "radio" || yesType !== "radio") {
      fail("ds160_email_additional_recipient_unavailable", "CEAC additional-recipient controls were not radio choices.");
    }
    diagnostics.phase = "additional_recipient";
    if (!(await noAdditional.isChecked())) {
      await noAdditional.check({ timeout: remainingBudget(controlTimeoutMs) });
      await waitForAspNetPostbackStable(page, remainingBudget(postbackTimeoutMs));
      assertCeacPostbackHealthy(page);
      await assertNoGate(page);
    }
    if (!(await noAdditional.isChecked()) || (await yesAdditional.isChecked())) {
      fail("ds160_email_additional_recipient_unavailable", "CEAC additional-recipient No choice did not settle.");
    }
    await verifyRecipient(page, recipient, diagnostics, remainingBudget(controlTimeoutMs));

    // A recovered email page may already expose an explicit receipt from a
    // prior send. Stop before reserving or dispatching a second message.
    const existingReceipt = await readReceipt(page, remainingBudget(controlTimeoutMs));
    if (existingReceipt.status === "sent") {
      diagnostics.receiptEvidenceHash = existingReceipt.evidenceHash;
      fail("ds160_email_receipt_unconfirmed", "CEAC already exposed a confirmation-email receipt before dispatch.");
    }

    const sendControl = await requireVisible(
      EMAIL_SEND_SELECTOR,
      "send",
      "ds160_email_send_control_unavailable",
      "CEAC final Email Confirmation control was unavailable.",
    );
    if (!(await sendControl.isEnabled().catch(() => false)) || (await controlValue(sendControl)) !== "Email Confirmation") {
      fail("ds160_email_send_control_unavailable", "CEAC final Email Confirmation control was not enabled and exact.");
    }

    await options.assertOwned();
    await options.beforeSend();
    // The fence callback may involve a bounded RPC. Recheck ownership after
    // it returns and before the irreversible browser click; a loss here must
    // prevent dispatch rather than being mistaken for a click timeout.
    await options.assertOwned();
    diagnostics.phase = "send";
    diagnostics.sendAttempted = true;

    let mainDocumentNavigationStarted = false;
    let postDispatchFailure: CeacError | undefined;
    let resolveNavigationStarted: (() => void) | null = null;
    const navigationStarted = new Promise<void>(resolve => {
      resolveNavigationStarted = resolve;
    });
    let navigationTimer: ReturnType<typeof setTimeout> | undefined;
    let resolveNavigation: ((settled: boolean) => void) | null = null;
    const navigationSettled = new Promise<boolean>(resolve => {
      resolveNavigation = resolve;
    });
    const settleNavigation = (settled: boolean) => {
      if (!resolveNavigation) return;
      const resolveOnce = resolveNavigation;
      resolveNavigation = null;
      if (navigationTimer) clearTimeout(navigationTimer);
      navigationTimer = undefined;
      resolveOnce(settled);
    };
    const onMainDocumentRequest = (request: Request) => {
      if (!isMainDocumentNavigation(page, request)) return;
      mainDocumentNavigationStarted = true;
      if (!navigationTimer) {
        navigationTimer = setTimeout(
          () => settleNavigation(false),
          Math.max(1, overallDeadline - Date.now()),
        );
      }
      resolveNavigationStarted?.();
    };
    const onDomContentLoaded = () => {
      if (mainDocumentNavigationStarted) settleNavigation(true);
    };
    page.on("request", onMainDocumentRequest);
    page.on("domcontentloaded", onDomContentLoaded);
    try {
      // Keep the click/actionability budget short, but let a document
      // navigation that actually started during the click settle under the
      // overall run budget. CEAC can take over a minute between its 302 and
      // the final Complete_Done/AppError document.
      try {
        await sendControl.click({ timeout: remainingBudget(dispatchTimeoutMs) });
      } catch {
        diagnostics.dispatchClickTimedOut = true;
      }

      // Give a synchronous form submit one task to announce its document
      // request. Same-page/AJAX sends skip this wait and use the bounded
      // ASP.NET settlement path instead of paying the document-navigation
      // timeout.
      if (!mainDocumentNavigationStarted) {
        await Promise.race([
          navigationStarted,
          page.waitForTimeout(Math.min(400, remainingBudget(postbackTimeoutMs))).catch(() => undefined),
        ]);
      }

      // A timeout after dispatch is ambiguous. Settle once and inspect the
      // official receipt; never click the final control a second time.
      if (mainDocumentNavigationStarted) {
        await navigationSettled;
      } else {
        await waitForAspNetPostbackStable(page, remainingBudget(postbackTimeoutMs)).catch(() => undefined);
        // A delayed script can start a full navigation after the initial
        // detection grace. Once observed, wait for that document rather than
        // reading the old DOM.
        if (mainDocumentNavigationStarted) await navigationSettled;
      }
    } catch (error) {
      if ((error as { code?: string }).code === "GATE_DETECTED") throw error;
      if (error instanceof CeacError) postDispatchFailure = error;
      else throw error;
    } finally {
      if (navigationTimer) clearTimeout(navigationTimer);
      page.off("request", onMainDocumentRequest);
      page.off("domcontentloaded", onDomContentLoaded);
    }
    try {
      assertCeacPostbackHealthy(page);
    } catch (error) {
      // A timed-out same-page settlement is ambiguous after dispatch. Keep
      // the one-shot fence and inspect receipt evidence instead of retrying;
      // explicit CEAC gates remain fatal and are surfaced unchanged.
      if ((error as { code?: string }).code === "GATE_DETECTED") throw error;
      if (error instanceof CeacError) postDispatchFailure ??= error;
      else throw error;
    }
    try {
      await assertNoGate(page);
    } catch (error) {
      if ((error as { code?: string }).code === "GATE_DETECTED") throw error;
      if (error instanceof CeacError) postDispatchFailure ??= error;
      else throw error;
    }
    const receipt = await waitForReceipt(page, remainingBudget(receiptTimeoutMs));
    diagnostics.receiptEvidenceHash = receipt.evidenceHash;
    // A response body cannot turn an explicit HTTP failure into a success
    // receipt. Transport timeouts without a status remain ambiguous, so a
    // later explicit 2xx receipt is still accepted.
    if (receipt.status === "sent" && !hasHttpFailure(postDispatchFailure)) {
      diagnostics.finalPath = currentOfficialPath(page);
      return {
        status: "sent",
        applicationIdVerified: true,
        recipientVerified: true,
        diagnostics: diagnosticsSnapshot(diagnostics),
      };
    }
    if (hasHttpFailure(postDispatchFailure)) {
      return fail(
        "ds160_email_receipt_unconfirmed",
        "CEAC did not expose explicit confirmation-email receipt evidence after an HTTP failure.",
      );
    }
    if (receipt.status === "failed") {
      return fail("ds160_email_failed", "CEAC reported that the confirmation email was not sent.");
    }
    return fail(
      "ds160_email_receipt_unconfirmed",
      postDispatchFailure
        ? "CEAC did not expose explicit confirmation-email receipt evidence after a completed dispatch response."
        : "CEAC did not expose explicit confirmation-email receipt evidence.",
    );
  } finally {
    stopNetworkObserver();
  }
}
