/**
 * CEAC DS-160 session bootstrap.
 *
 * Launches a Chromium context, opens the CEAC start page, verifies the page
 * identity, and returns a `CeacSession` handle the rest of the worker can
 * use. Failures surface as structured `SessionBootstrapError` instances.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  browserbaseEnabled,
  connectBrowserbaseCloudBrowser,
} from "../browserbase-session";
import { captureApplicationId } from "./checkpoints";
import {
  CEAC_APPLICATION_ID_PATTERN,
  CEAC_GATE_MARKERS,
  CEAC_URLS,
} from "./selectors";
import { assertPage, detectPage, type CeacPageId, type PageIdentityResult } from "./pages";
import { ManualActionRequiredError, SessionBootstrapError } from "./errors";
import { assertNoGate } from "./gates";
import { selectStartPageLocation } from "./start-page-location";
import { solveStartPageCaptchaWithRetry } from "./start-page-captcha";
import { gotoCeacStartPage } from "./start-page-navigation";

export const CEAC_DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export interface CeacSessionOptions {
  /** Headless mode for the underlying Chromium instance. Default: true. */
  headless?: boolean;
  /** Navigation timeout for initial page load (ms). Default: 60_000. */
  navigationTimeoutMs?: number;
  /**
   * Accept downloads from the browser context — required later for the
   * `.dat` save-to-file flow. Default: true.
   */
  acceptDownloads?: boolean;
  /** User agent override. CEAC is picky; leave unset unless diagnosing. */
  userAgent?: string;
  /** Optional run identifier for structured logging. */
  runId?: string;
  /**
   * When positive, visible live-assisted runs wait for the applicant to
   * complete the CEAC start-page location/CAPTCHA checkpoint manually.
   */
  manualStartWaitMs?: number;
  /** CEAC start-page post/location code to select before manual CAPTCHA. */
  startLocationCode?: string | null;
  /** Maximum automated 2captcha attempts for the CEAC start page. Default: 3. */
  captchaMaxAttempts?: number;
  /**
   * Allow the canonical CEAC runner to attach to an operator-owned local
   * Chrome session when a loopback CDP endpoint is explicitly configured.
   * Other callers retain the fresh-session bootstrap unless they opt in.
   */
  attachExistingFormFromEnvironment?: boolean;
  /**
   * Require an operator-owned, already-verified CEAC Chrome session. Missing
   * or unreachable CDP configuration fails closed instead of launching a new
   * browser that could re-enter the start-page CAPTCHA flow.
   */
  requireExistingFormFromEnvironment?: boolean;
  /**
   * Existing official CEAC Application ID. When present, a CDP attach may
   * also begin on CEAC's Start or Retrieve page so the stored draft can be
   * recovered. It never authorizes CAPTCHA handling or a new application.
   */
  resumeApplicationId?: string | null;
  /**
   * Explicitly allow the one attached CEAC Start page to create a new
   * official application after the applicant completes CAPTCHA manually.
   * This is mutually exclusive with stored-application recovery.
   */
  allowNewApplicationFromStart?: boolean;
}

export interface CeacSession {
  // Mutable: after a mid-orchestration SessionTimedOut we close and
  // rebuild the browser context, then swap these refs in place so that
  // the orchestrator's captured `session.page` keeps working.
  browser: Browser;
  context: BrowserContext;
  page: Page;
  readonly runId?: string;
  captchaSolve?: { telemetry: Array<Record<string, unknown>> };
  /** True only when this session reused an already-open CEAC form page. */
  attachedExistingForm?: boolean;
  /** Page identity verified at the CDP attachment boundary. */
  attachedPageId?: CeacPageId;
  /** Bounded time reserved for the applicant to complete the Start CAPTCHA. */
  manualStartWaitMs?: number;
  /** True only for the explicit, operator-approved attached Start flow. */
  newApplicationFromStart?: boolean;
  /** Close the browser and release resources. Safe to call multiple times. */
  close(): Promise<void>;
}

const CEAC_ATTACHABLE_FORM_PAGES: ReadonlySet<CeacPageId> = new Set([
  "personal_information_1",
  "personal_information_2",
  "travel_information",
  "travel_companions",
  "previous_us_travel",
  "address_and_phone",
  "passport",
  "us_contact",
  "family_relatives",
  "family_spouse",
  "work_education_present",
  "work_education_previous",
  "work_education_additional",
  "security_background_1",
  "security_background_2",
  "security_background_3",
  "security_background_4",
  "security_background_5",
  "upload_photo",
  "confirm_photo",
  "save_confirmation",
  "review",
  "sign_and_submit",
]);

export interface CeacCdpAttachDependencies {
  connectOverCDP(endpoint: string, options: { timeout: number }): Promise<Browser>;
  assertNoGate(page: Page): Promise<void>;
  detectPage(page: Page): Promise<PageIdentityResult>;
  hasStartPageCaptcha(page: Page): Promise<boolean>;
  readApplicationId(page: Page): Promise<string | null>;
}

const DEFAULT_CDP_ATTACH_DEPENDENCIES: CeacCdpAttachDependencies = {
  connectOverCDP: (endpoint, options) => chromium.connectOverCDP(endpoint, options),
  assertNoGate,
  detectPage,
  readApplicationId: readCeacPageApplicationId,
  hasStartPageCaptcha: async (page) => {
    for (const selector of CEAC_GATE_MARKERS.solvableCaptchaSelectors) {
      if ((await page.locator(selector).count().catch(() => 0)) > 0) return true;
    }
    return false;
  },
};

export interface CeacCdpAttachOptions {
  runId?: string;
  resumeApplicationId?: string | null;
  manualStartWaitMs?: number;
  allowNewApplicationFromStart?: boolean;
}

type CeacCdpCandidate = {
  context: BrowserContext;
  page: Page;
  identity: PageIdentityResult;
  applicationId: string | null;
  route: string;
};

function officialRoute(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function normalizeCeacApplicationId(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized.match(CEAC_APPLICATION_ID_PATTERN)?.[0] ?? null;
}

export async function readCeacPageApplicationId(page: Page): Promise<string | null> {
  try {
    const url = new URL(page.url());
    const queryValue = [...url.searchParams.entries()].find(
      ([key]) => key.toLowerCase() === "applicationid",
    )?.[1];
    const fromQuery = normalizeCeacApplicationId(queryValue);
    if (fromQuery) return fromQuery;
  } catch {
    // The official-origin check reports malformed URLs before this helper runs.
  }

  const retrieveInput = page.locator(
    'input[id*="tbxApplicationID"], input[id*="txtApplicationID"], input[id*="ApplicationID"][type="text"]',
  ).first();
  if ((await retrieveInput.count().catch(() => 0)) > 0) {
    const fromInput = normalizeCeacApplicationId(
      await retrieveInput.inputValue({ timeout: 2_000 }).catch(() => ""),
    );
    if (fromInput) return fromInput;
  }

  const captured = await captureApplicationId(page);
  return normalizeCeacApplicationId(captured.applicationId);
}

function attachmentDiagnostics(
  candidates: CeacCdpCandidate[],
  expectedApplicationId: string | null,
): Array<Record<string, unknown>> {
  return candidates.map((candidate) => ({
    pageId: candidate.identity.id,
    route: candidate.route,
    applicationIdStatus: candidate.applicationId
      ? expectedApplicationId
        ? candidate.applicationId === expectedApplicationId
          ? "match"
          : "mismatch"
        : "present"
      : "missing",
    enteredForm: isAttachableCeacFormPage(candidate.identity.id),
    resumeEntry: isCeacResumeEntryPage(candidate.identity.id),
  }));
}

function missingCdpEndpointError(): SessionBootstrapError {
  return new SessionBootstrapError(
    "CEAC existing-session mode requires a configured loopback CDP endpoint; refusing to launch a replacement browser.",
    {
      details: {
        reason: "cdp_endpoint_missing",
        environment: ["CEAC_CHROME_CDP_ENDPOINT", "CEAC_CDP_ENDPOINT"],
        endpointExample: "http://127.0.0.1:<remote-debugging-port>",
        operatorContract: [
          "Start Chrome with a loopback remote-debugging port before completing CEAC security verification.",
          "Keep exactly one CEAC form tab for the stored Application ID open, or expose a uniquely matching tab.",
          "Do not leave the tab on Cloudflare, CAPTCHA, or Confirm Application ID/security-question pages.",
        ],
      },
    },
  );
}

function normalizeLoopbackCdpEndpoint(raw: string, source: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SessionBootstrapError(`${source} must be a valid loopback CDP URL.`);
  }

  const allowedProtocol = ["http:", "https:", "ws:", "wss:"].includes(parsed.protocol);
  const allowedHost = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    parsed.hostname.toLowerCase(),
  );
  if (!allowedProtocol || !allowedHost || parsed.username || parsed.password) {
    throw new SessionBootstrapError(
      `${source} must use an unauthenticated localhost, 127.0.0.1, or ::1 endpoint.`,
    );
  }
  return parsed.toString();
}

export function resolveCeacLocalCdpEndpoint(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configured = [
    ["CEAC_CHROME_CDP_ENDPOINT", env.CEAC_CHROME_CDP_ENDPOINT],
    ["CEAC_CDP_ENDPOINT", env.CEAC_CDP_ENDPOINT],
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([source, value]) => ({
      source,
      value: normalizeLoopbackCdpEndpoint(value.trim(), source),
    }));

  if (configured.length === 0) return null;
  if (configured.length === 2 && configured[0].value !== configured[1].value) {
    throw new SessionBootstrapError(
      "CEAC_CHROME_CDP_ENDPOINT and CEAC_CDP_ENDPOINT must resolve to the same loopback endpoint when both are set.",
    );
  }
  return configured[0].value;
}

export function isOfficialCeacFormUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "ceac.state.gov" &&
      /^\/genniv(?:\/|$)/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isAttachableCeacFormPage(
  pageId: CeacPageId | "unknown",
): pageId is CeacPageId {
  return pageId !== "unknown" && CEAC_ATTACHABLE_FORM_PAGES.has(pageId);
}

export function isCeacResumeEntryPage(pageId: CeacPageId | "unknown"): boolean {
  return pageId === "start" || pageId === "retrieve_application";
}

export function requiresCeacConfirmApplication(
  session: Pick<CeacSession, "attachedExistingForm">,
): boolean {
  return session.attachedExistingForm !== true;
}

/**
 * Connect to an already-running local Chrome and reuse its one active CEAC
 * form tab. Browser.close() disconnects a connected Playwright client; unlike
 * context.close(), it does not close the operator-owned default context/pages.
 */
export async function attachToExistingCeacSession(
  endpoint: string,
  options: CeacCdpAttachOptions = {},
  dependencies: CeacCdpAttachDependencies = DEFAULT_CDP_ATTACH_DEPENDENCIES,
): Promise<CeacSession> {
  const normalizedEndpoint = normalizeLoopbackCdpEndpoint(endpoint, "CEAC CDP endpoint");
  const resumeApplicationId = options.resumeApplicationId?.trim().toUpperCase() ?? "";
  const allowNewApplicationFromStart = options.allowNewApplicationFromStart === true;
  if (resumeApplicationId && allowNewApplicationFromStart) {
    throw new SessionBootstrapError(
      "CEAC CDP attach cannot recover a stored application and create a new application in the same run.",
    );
  }
  if (resumeApplicationId && !/^AA[A-Z0-9]{8,10}$/.test(resumeApplicationId)) {
    throw new SessionBootstrapError(
      "CEAC CDP resume requires a valid stored official Application ID.",
    );
  }
  let browser: Browser;
  try {
    browser = await dependencies.connectOverCDP(normalizedEndpoint, { timeout: 45_000 });
  } catch {
    throw new SessionBootstrapError(
      "Configured CEAC loopback CDP endpoint could not be reached; refusing to launch a replacement browser.",
    );
  }

  try {
    const officialPages = browser.contexts().flatMap((context) =>
      context.pages()
        .filter((page) => isOfficialCeacFormUrl(page.url()))
        .map((page) => ({ context, page })),
    );
    if (officialPages.length === 0) {
      throw new SessionBootstrapError(
        "CEAC CDP attach found no open official form page.",
        { details: { reason: "official_ceac_tab_missing", officialPageCount: 0 } },
      );
    }

    const candidates: CeacCdpCandidate[] = [];
    for (const candidate of officialPages) {
      const route = officialRoute(candidate.page.url());
      const pageUrl = new URL(candidate.page.url());
      if (/\/common\/confirmapplicationid\.aspx$/i.test(pageUrl.pathname)) {
        candidates.push({
          ...candidate,
          identity: { id: "unknown", heading: null, url: candidate.page.url() },
          applicationId: null,
          route,
        });
        continue;
      }

      await dependencies.assertNoGate(candidate.page);
      const identity = await dependencies.detectPage(candidate.page);
      const eligible =
        isAttachableCeacFormPage(identity.id) || isCeacResumeEntryPage(identity.id);
      candidates.push({
        ...candidate,
        identity,
        applicationId: eligible
          ? normalizeCeacApplicationId(await dependencies.readApplicationId(candidate.page))
          : null,
        route,
      });
    }

    const eligible = candidates.filter(
      (candidate) =>
        isAttachableCeacFormPage(candidate.identity.id) ||
        isCeacResumeEntryPage(candidate.identity.id),
    );
    const expectedApplicationId = normalizeCeacApplicationId(resumeApplicationId);
    if (eligible.length === 0) {
      const confirmApplicationPage = candidates.some(
        (candidate) => /\/common\/confirmapplicationid\.aspx$/i.test(candidate.route),
      );
      throw new SessionBootstrapError(
        confirmApplicationPage
          ? "CEAC CDP attach refused the Confirm Application ID / security-question page."
          : "CEAC CDP attach did not find an entered or recoverable DS-160 form page.",
        {
          details: {
            reason: confirmApplicationPage
              ? "confirm_application_security_page"
              : "attachable_ceac_tab_missing",
            pages: attachmentDiagnostics(candidates, expectedApplicationId),
          },
        },
      );
    }

    let selected: CeacCdpCandidate | undefined;

    if (expectedApplicationId) {
      const matching = eligible.filter(
        (candidate) => candidate.applicationId === expectedApplicationId,
      );
      if (matching.length === 1) {
        selected = matching[0];
      } else {
        const singleBlankResumeEntry =
          officialPages.length === 1 &&
          eligible.length === 1 &&
          isCeacResumeEntryPage(eligible[0].identity.id) &&
          eligible[0].applicationId === null;
        if (singleBlankResumeEntry) {
          selected = eligible[0];
        } else {
          throw new SessionBootstrapError(
            "CEAC CDP attach could not identify one form tab for the stored Application ID.",
            {
              details: {
                reason: "matching_ceac_tab_not_unique",
                officialPageCount: officialPages.length,
                eligiblePageCount: eligible.length,
                matchingPageCount: matching.length,
                pages: attachmentDiagnostics(candidates, expectedApplicationId),
              },
            },
          );
        }
      }
    } else if (officialPages.length === 1 && eligible.length === 1) {
      selected = eligible[0];
    } else {
      throw new SessionBootstrapError(
        "CEAC CDP attach requires a stored Application ID when more than one official tab is open.",
        {
          details: {
            reason: "stored_application_id_required_for_tab_selection",
            officialPageCount: officialPages.length,
            eligiblePageCount: eligible.length,
            pages: attachmentDiagnostics(candidates, null),
          },
        },
      );
    }

    if (!selected) throw new SessionBootstrapError("CEAC CDP tab selection failed closed.");

    const { context, page, identity } = selected;
    const resumeEntry = isCeacResumeEntryPage(identity.id);
    if (
      resumeEntry &&
      !resumeApplicationId &&
      !(allowNewApplicationFromStart && identity.id === "start")
    ) {
      throw new SessionBootstrapError(
        "CEAC CDP attach refused the Start/Retrieve page because stored recovery credentials are unavailable.",
        { detected: identity.id, url: selected.route },
      );
    }
    if (allowNewApplicationFromStart && identity.id !== "start") {
      throw new SessionBootstrapError(
        "CEAC new-application attach requires exactly one official Start page.",
        { detected: identity.id, url: selected.route },
      );
    }
    const manualStartWaitMs = Math.max(0, options.manualStartWaitMs ?? 0);
    if (
      identity.id === "start" &&
      await dependencies.hasStartPageCaptcha(page) &&
      manualStartWaitMs === 0
    ) {
      throw new ManualActionRequiredError(
        "ceac_start_captcha",
        "CEAC Start page requires manual CAPTCHA completion before a stored application can be retrieved.",
        { detected: "start", url: selected.route },
      );
    }
    if (!resumeEntry && !isAttachableCeacFormPage(identity.id)) {
      throw new SessionBootstrapError(
        `CEAC CDP attach refused page identity \"${identity.id}\"; an entered DS-160 form page is required.`,
        { detected: identity.id, url: selected.route },
      );
    }

    return {
      browser,
      context,
      page,
      runId: options.runId,
      attachedExistingForm: true,
      attachedPageId: identity.id as CeacPageId,
      manualStartWaitMs,
      newApplicationFromStart: allowNewApplicationFromStart,
      close: makeConnectedBrowserCloser(browser),
    };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
}

/**
 * Launch a browser and navigate to the CEAC DS-160 start page.
 *
 * The CEAC start page normally requires a location selection and image
 * CAPTCHA. Location is selected automatically when possible, and the image
 * CAPTCHA is solved through 2Captcha.
 *
 * Does **not** select embassies or begin a new application — those steps
 * belong to downstream helpers that build on this bootstrap.
 */
export async function startCeacSession(
  options: CeacSessionOptions = {},
): Promise<CeacSession> {
  const attachRequested =
    options.attachExistingFormFromEnvironment ||
    options.requireExistingFormFromEnvironment;
  if (attachRequested) {
    const cdpEndpoint = resolveCeacLocalCdpEndpoint();
    if (cdpEndpoint) {
      return attachToExistingCeacSession(cdpEndpoint, {
        runId: options.runId,
        resumeApplicationId: options.resumeApplicationId,
        manualStartWaitMs: options.manualStartWaitMs,
        allowNewApplicationFromStart: options.allowNewApplicationFromStart,
      });
    }
    if (options.requireExistingFormFromEnvironment) {
      throw missingCdpEndpointError();
    }
  }

  const headless = options.headless ?? true;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 60_000;
  const acceptDownloads = options.acceptDownloads ?? true;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    let page: Page;
    if (browserbaseEnabled("CEAC")) {
      const cloud = await connectBrowserbaseCloudBrowser({ prefix: "CEAC" });
      browser = cloud.browser;
      context = cloud.context;
      page = cloud.page;
    } else {
      browser = await chromium.launch({
        headless,
        ...(process.env.PLAYWRIGHT_CHANNEL?.trim() && process.env.PLAYWRIGHT_CHANNEL !== "bundled"
          ? { channel: process.env.PLAYWRIGHT_CHANNEL.trim() }
          : {}),
      });
      context = await browser.newContext({
        acceptDownloads,
        userAgent: options.userAgent ?? CEAC_DEFAULT_USER_AGENT,
      });
      page = await context.newPage();
    }

    try {
      await gotoCeacStartPage(page, navigationTimeoutMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SessionBootstrapError(
        `Failed to load CEAC start page within ${navigationTimeoutMs}ms`,
        {
          url: CEAC_URLS.START,
          details: { cause: message, runId: options.runId },
        },
      );
    }

    // Check for anti-bot / captcha / manual-intervention gates BEFORE page
    // identity assertion. A gated page should surface as a structured gate
    // error, not as an "unexpected page" or "unknown page" failure.
    await assertNoGate(page);

    // Verify we landed somewhere sensible. The start page heading matches
    // "Welcome" / "Start an Application"; if the heading is something else
    // (e.g. an outage page) we want a structured failure, not a silent
    // continuation into field-fill code.
    try {
      await assertPage(page, "start");
    } catch (err) {
      // Re-probe once so the error context includes what we actually saw.
      const probe = await detectPage(page);
      throw new SessionBootstrapError(
        `CEAC start page identity check failed (detected "${probe.id}")`,
        {
          expected: "start",
          detected: probe.id,
          url: probe.url,
          details: {
            heading: probe.heading,
            cause: err instanceof Error ? err.message : String(err),
            runId: options.runId,
          },
        },
      );
    }

    const onStartPage = /\/GenNIV\/Default\.aspx/i.test(page.url());
    if (onStartPage && options.startLocationCode) {
      const locationOutcome = await selectStartPageLocation(page, {
        locationCode: options.startLocationCode,
      });
      if (
        locationOutcome.status === "missing_selector" ||
        locationOutcome.status === "missing_option" ||
        locationOutcome.status === "failed"
      ) {
        throw new ManualActionRequiredError(
          "start_application",
          `CEAC start location ${locationOutcome.locationCode} could not be selected automatically. Please choose the location manually, then complete the start-page CAPTCHA.`,
          {
            detected: "start",
            url: page.url(),
            details: {
              runId: options.runId,
              checkpoint: "ceac_start_location",
              locationCode: locationOutcome.locationCode,
              status: locationOutcome.status,
              reason: "reason" in locationOutcome ? locationOutcome.reason : undefined,
            },
          },
        );
      }
      console.warn(`[ceac] CEAC start location selected: ${locationOutcome.locationCode}`);
    }

    let captchaSolveTelemetry: Array<Record<string, unknown>> | undefined;
    const captchaSelector = CEAC_GATE_MARKERS.solvableCaptchaSelectors.join(", ");
    const captchaPresent = captchaSelector
      ? (await page.locator(captchaSelector).count().catch(() => 0)) > 0
      : false;
    if (captchaPresent || /\/GenNIV\/Default\.aspx/i.test(page.url())) {
      console.warn("[ceac] Solving CEAC start-page CAPTCHA with 2Captcha.");
      const solved = await withTimeout(
        solveStartPageCaptchaWithRetry(
          page,
          options.captchaMaxAttempts ?? 3,
        ),
        readStartCaptchaTimeoutMs(),
        "CEAC start-page CAPTCHA solve timed out",
      );
      captchaSolveTelemetry = solved.telemetry.map((entry) => ({ ...entry }));
      await assertNoGate(page);
    }

    const session: CeacSession = {
      browser,
      context,
      page,
      runId: options.runId,
      captchaSolve: captchaSolveTelemetry ? { telemetry: captchaSolveTelemetry } : undefined,
      close: makeCloser(browser, context),
    };

    return session;
  } catch (err) {
    // Make sure we do not leak a browser if bootstrap fails mid-way.
    try {
      if (context) await context.close();
    } catch {
      // best-effort cleanup
    }
    try {
      if (browser) await browser.close();
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

/**
 * Rebuild a session's browser context in-place for mid-orchestration
 * recovery after CEAC invalidates the server-side session.
 *
 * Closes the current browser + context, launches a fresh stealth
 * browser, runs the normal start-page CAPTCHA bootstrap, then mutates
 * the passed session's refs so downstream code that already holds
 * `session.page` keeps working with the new browser state.
 *
 * Does NOT run the ConfirmApplicationID flow or the retrieve form —
 * that is the caller's responsibility (via `resume-application.ts`)
 * because the retrieve credentials live in the orchestrator, not here.
 */
export async function rebuildSessionForResume(
  session: CeacSession,
  options: CeacSessionOptions = {},
): Promise<void> {
  if (session.attachedExistingForm) {
    throw new ManualActionRequiredError(
      "ceac_attached_session_expired",
      "The attached CEAC session expired. Re-open the stored application in the same CDP-enabled Chrome and complete any security or CAPTCHA checkpoint manually before retrying.",
      {
        detected: "session_expired",
        details: {
          reason: "attached_session_expired",
          replacementBrowserLaunched: false,
        },
      },
    );
  }
  try { await session.close(); } catch { /* best-effort */ }
  const fresh = await startCeacSession({ ...options, runId: session.runId });
  // Swap in the new refs. Close function closes the NEW browser.
  session.browser = fresh.browser;
  session.context = fresh.context;
  session.page = fresh.page;
  session.captchaSolve = fresh.captchaSolve;
  (session as { close: () => Promise<void> }).close = fresh.close;
}

function makeCloser(
  browser: Browser,
  context: BrowserContext,
): () => Promise<void> {
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    try {
      await context.close();
    } catch {
      // best-effort cleanup
    }
    try {
      await browser.close();
    } catch {
      // best-effort cleanup
    }
  };
}

function makeConnectedBrowserCloser(browser: Browser): () => Promise<void> {
  let disconnected = false;
  return async () => {
    if (disconnected) return;
    disconnected = true;
    // For a browser obtained through connectOverCDP, Browser.close() closes
    // the Playwright connection. Never close the operator-owned context.
    await browser.close().catch(() => undefined);
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new SessionBootstrapError(message, {
      url: CEAC_URLS.START,
      details: { timeoutMs },
    })), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function readStartCaptchaTimeoutMs(): number {
  const raw = process.env.DS160_START_CAPTCHA_TIMEOUT_MS?.trim();
  if (!raw) return 180_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180_000;
}
