/**
 * France-Visas sign-in flow.
 *
 * Two entry paths:
 *   - `restoreFvSession()` — rehydrates a stored storageState; if cookies
 *     are still valid we skip Keycloak and land on accueil.xhtml.
 *   - `signInWithPassword()` — fresh Keycloak login with email+password.
 *
 * The account-URL entry point (`application-form.france-visas.gouv.fr/fv-fo-dde/`)
 * redirects to Keycloak OAuth when unauthenticated, so both paths use it as
 * the starting URL and let the redirect chain unfold naturally.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { launchFvBrowser } from "./browser";
import { FV_URLS, FV_LOGIN_SELECTORS } from "./selectors";
import { waitForPage } from "./pages";
import { assertNoGate, ENTRY_RENDER_TIMEOUT_MS, waitForRenderedPage } from "./gates";

export { ENTRY_RENDER_TIMEOUT_MS, waitForRenderedPage };
import { makeSessionCloser } from "./session";
import { SessionBootstrapError } from "./errors";
import { redactOfficialUrl } from "../appointment-free-smoke";

export interface FvSignInInput {
  email: string;
  password: string;
}

export interface FvRestoreSessionOptions {
  /** Previously captured storage state (cookies + localStorage). */
  storageState: Parameters<Browser["newContext"]>[0] extends
    | (infer Opts & object)
    | undefined
    ? Opts extends { storageState?: infer S }
      ? NonNullable<S>
      : never
    : never;
  headless?: boolean;
  runId?: string;
}

export interface FvSignInOptions {
  headless?: boolean;
  runId?: string;
  /** Navigation timeout for the login round-trip. Default 60s. */
  timeoutMs?: number;
  /** Internal guard: disable recovery from the official single-tab 403. */
  retrySingleTabConflict?: boolean;
  /** Internal counter for bounded single-tab conflict recovery. */
  singleTabRetryAttempt?: number;
  /**
   * France-Visas emails a one-time access code after the password. Given the
   * ISO time the login was submitted, resolve the 6-digit code from the
   * account's inbox.
   */
  loginCodeProvider?: (sinceIso: string) => Promise<string>;
}

/** The one-time access-code field France-Visas shows after the password. */
export const FV_LOGIN_CODE_INPUT =
  'input[autocomplete="one-time-code"], input[name="otp"], input[id="otp"], input[name="code"], input[name="totp"], input[name*="code" i]:not([type="hidden"]):not([type="password"])';

/** The 6-digit access code in France-Visas' "Your authentication code" email. */
export function extractFranceVisasLoginCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const labelled = text.match(/code\D{0,20}(\d{6})\b/i);
  if (labelled) return labelled[1];
  const bare = text.match(/\b(\d{6})\b/);
  return bare ? bare[1] : null;
}

export interface FvSessionHandles {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  runId?: string;
  close(): Promise<void>;
}

const ACCUEIL_WAIT_TIMEOUT_MS = 120_000;

export function isFranceVisasSingleTabConflict(text: string): boolean {
  return /application is open in another tab|application est ouverte dans un autre onglet|应用程序在另一个标签页中打开/i.test(
    text,
  );
}

const SINGLE_TAB_RETRY_DELAYS_MS = [15_000, 45_000, 90_000] as const;

export function franceVisasSingleTabRetryDelayMs(attempt: number): number | null {
  return SINGLE_TAB_RETRY_DELAYS_MS[attempt] ?? null;
}

/**
 * Launch a stealth browser with stored `storageState` and confirm we land
 * on accueil.xhtml. If the stored cookies are expired, throws
 * `SessionBootstrapError` so the caller can fall back to `signInWithPassword`.
 */
export async function restoreFvSession(
  options: FvRestoreSessionOptions,
): Promise<FvSessionHandles> {
  const { browser, context, page } = await launchFvBrowser({
    headless: options.headless ?? true,
    storageState: options.storageState,
    acceptDownloads: true,
  });

  try {
    await page.goto(FV_URLS.ACCUEIL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await assertNoGate(page);
    await waitForPage(page, "accueil", { timeoutMs: ACCUEIL_WAIT_TIMEOUT_MS });
  } catch (err) {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw new SessionBootstrapError(
      "Stored storageState did not restore an authenticated France-Visas session",
      {
        url: redactOfficialUrl(page.url()),
        details: {
          cause: err instanceof Error ? err.message : String(err),
          runId: options.runId,
        },
      },
    );
  }

  return {
    browser,
    context,
    page,
    runId: options.runId,
    close: makeSessionCloser(browser, context),
  };
}

/**
 * Fresh sign-in via Keycloak using email + password.
 *
 * Flow:
 *   1. Navigate to the FV application entry URL — redirects to Keycloak login.
 *   2. Fill username (`input[name="username"]`) and password.
 *   3. Click Log in → Keycloak issues auth code → FV callback lands on accueil.
 *   4. Assert we reached accueil.xhtml; else throw SessionBootstrapError.
 *
 * If Keycloak presents a CAPTCHA on login (rare, rate-limit driven), this
 * path will fail with a gate error — the caller should retry from a fresh
 * IP or surface the blocker to ops.
 */
export async function signInWithPassword(
  input: FvSignInInput,
  options: FvSignInOptions = {},
): Promise<FvSessionHandles> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const handles = await launchFvBrowser({
    headless: options.headless ?? true,
    acceptDownloads: true,
  });
  const { browser, context, page } = handles;
  /** Where each sign-in step landed, for the failure message (paths only). */
  const trace: string[] = [];

  try {
    // Hit the application entry; Keycloak will redirect if unauthenticated.
    await page.goto(`${FV_URLS.ACCUEIL.replace(/\/accueil\.xhtml$/, "/")}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    // Through the remote browser the Keycloak login page stays empty for
    // several seconds after the HTML arrives (measured ~6-10s). Wait for it to
    // render before judging it; a page still blank after this is a real gate.
    await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);

    const entryText = await page
      .locator("body")
      .innerText({ timeout: 5_000 })
      .catch(() => "");
    if (isFranceVisasSingleTabConflict(entryText)) {
      throw new Error("France-Visas single-tab session conflict");
    }

    // If we're already authenticated (e.g. cookies persisted in the profile
    // dir from a prior run), the redirect chain settles on accueil directly.
    const earlyUrl = page.url();
    if (/accueil\.xhtml/i.test(earlyUrl)) {
      await assertNoGate(page);
      return {
        browser, context, page,
        runId: options.runId,
        close: makeSessionCloser(browser, context),
      };
    }

    // Else we land on Keycloak login. Assert no unsolvable gate.
    await assertNoGate(page);

    // Through the remote browser the access-code POST is occasionally lost and
    // France-Visas returns to its login form; one fresh login (with a new
    // emailed code) recovers it.
    const loginRedirectTimeoutMs = Math.min(timeoutMs, 60_000);
    for (let loginAttempt = 1; loginAttempt <= MAX_LOGIN_ATTEMPTS; loginAttempt += 1) {
      trace.push(`login${loginAttempt}`);
      await submitLoginWithCode(page, input, options, timeoutMs, loginRedirectTimeoutMs, trace);
      if (/accueil\.xhtml/i.test(page.url())) break;
      const backOnLogin = await page
        .locator(FV_LOGIN_SELECTORS.email)
        .first()
        .isVisible()
        .catch(() => false);
      if (loginAttempt === MAX_LOGIN_ATTEMPTS) break;
      if (!backOnLogin) {
        // A dropped connection leaves Chrome's error page: start the login
        // over from the application entry.
        if (!isBrowserErrorPage(page)) break;
        await page
          .goto(`${FV_URLS.ACCUEIL.replace(/\/accueil\.xhtml$/, "/")}`, {
            waitUntil: "domcontentloaded",
            timeout: timeoutMs,
          })
          .catch(() => undefined);
        await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);
        if (/accueil\.xhtml/i.test(page.url())) break;
      }
    }

    const postLoginText = await page
      .locator("body")
      .innerText({ timeout: 5_000 })
      .catch(() => "");
    if (isFranceVisasSingleTabConflict(postLoginText)) {
      throw new Error("France-Visas single-tab session conflict");
    }

    // Explicit identity check — waitForURL returns on match OR on timeout;
    // we assert separately so an unexpected mid-flow page surfaces clearly.
    await waitForPage(page, "accueil", { timeoutMs: ACCUEIL_WAIT_TIMEOUT_MS });

    return {
      browser, context, page,
      runId: options.runId,
      close: makeSessionCloser(browser, context),
    };
  } catch (err) {
    const title = await page.title().catch(() => "");
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 2_000 })
      .catch(() => "");
    const bodyPreview = bodyText.replace(/\s+/g, " ").trim().slice(0, 1_000);
    const singleTabRetryAttempt = options.singleTabRetryAttempt ?? 0;
    const singleTabRetryDelayMs = franceVisasSingleTabRetryDelayMs(singleTabRetryAttempt);
    if (
      isFranceVisasSingleTabConflict(bodyText) &&
      options.retrySingleTabConflict !== false &&
      singleTabRetryDelayMs !== null
    ) {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
      console.warn(
        `[fv-sign-in] Official single-tab lock detected; retrying in ${singleTabRetryDelayMs}ms ` +
          `(attempt ${singleTabRetryAttempt + 1}/${SINGLE_TAB_RETRY_DELAYS_MS.length})`,
      );
      await new Promise((resolve) => setTimeout(resolve, singleTabRetryDelayMs));
      return signInWithPassword(input, {
        ...options,
        singleTabRetryAttempt: singleTabRetryAttempt + 1,
      });
    }
    const diagnosticBase = await captureSignInFailureDiagnostics(page, options.runId);
    const where = await describeSignInPage(page, title);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw new SessionBootstrapError(
      `France-Visas sign-in failed: ${err instanceof Error ? err.message : String(err)} [${where}]` +
        (trace.length ? ` [trace=${trace.join(" > ")}]` : ""),
      {
        url: redactOfficialUrl(page.url()),
        details: {
          runId: options.runId,
          title,
          bodyPreview,
          diagnostics: diagnosticBase,
        },
      },
    );
  }
}

/**
 * Where sign-in stopped, safe to store in queue errors: the official page path
 * (no query), its title, and the login form's own feedback message (e.g.
 * "Invalid username or password."). Never page body text, which can contain
 * applicant data.
 */
async function describeSignInPage(page: Page, title: string): Promise<string> {
  let pathPart = "";
  try {
    const url = new URL(page.url());
    pathPart = `${url.host}${url.pathname}`;
  } catch {
    pathPart = "(no url)";
  }
  const feedback = await page
    .locator("#input-error, .kc-feedback-text, .alert-error, .alert-warning, [id^='input-error']")
    .first()
    .innerText({ timeout: 1_000 })
    .catch(() => "");
  const parts = [`page=${pathPart}`, `title=${title.trim() || "(none)"}`];
  const message = feedback.replace(/\s+/g, " ").trim().slice(0, 200);
  if (message) parts.push(`message=${message}`);
  return parts.join("; ");
}

async function captureSignInFailureDiagnostics(
  page: Page,
  runId: string | undefined,
): Promise<{ screenshotPath: string | null; htmlPath: string | null; textPath: string | null } | null> {
  const configuredRoot = process.env.SUBMISSION_ARTIFACTS_DIR?.trim();
  const root = configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(os.tmpdir(), "viza-submission-artifacts");
  const dir = path.join(root, "france-visas", runId ?? "latest");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.mkdir(dir, { recursive: true }).catch(() => undefined);
  const screenshotPath = path.join(dir, `${stamp}-sign-in.png`);
  const out: { screenshotPath: string | null; htmlPath: string | null; textPath: string | null } = {
    screenshotPath,
    htmlPath: null,
    textPath: null,
  };
  try {
    const mask = [page.locator(
      "input:not([type='checkbox']):not([type='radio']):not([type='submit']):not([type='button']), textarea, [contenteditable='true']",
    )];
    await page.screenshot({ path: screenshotPath, fullPage: true, mask, timeout: 10_000 });
  } catch {
    out.screenshotPath = null;
  }
  return out;
}


const MAX_LOGIN_ATTEMPTS = 2;

/**
 * Fill the login form, submit it, and complete France-Visas' emailed
 * access-code step if it appears. Leaves the page wherever France-Visas lands.
 */
async function submitLoginWithCode(
  page: Page,
  input: FvSignInInput,
  options: FvSignInOptions,
  timeoutMs: number,
  loginRedirectTimeoutMs: number,
  trace: string[],
): Promise<void> {
  // Fill credentials. Keycloak surfaces the form as plain HTML; no PrimeFaces
  // here, so direct field access works.
  const username = page.locator(FV_LOGIN_SELECTORS.email).first();
  const password = page.locator(FV_LOGIN_SELECTORS.password).first();
  await username.waitFor({ state: "visible", timeout: timeoutMs });
  await username.fill(input.email);
  await password.fill(input.password);

  // Click Log in, then either land on accueil or reach France-Visas'
  // emailed one-time access-code step.
  const submit = page.locator(FV_LOGIN_SELECTORS.submit).first();
  const loginSubmittedAt = new Date(Date.now() - 5_000).toISOString();
  await submit.click();
  const reachedAccueil = page
    .waitForURL(/accueil\.xhtml/i, { timeout: loginRedirectTimeoutMs })
    .then(() => "accueil" as const)
    .catch(() => "timeout" as const);
  const askedForCode = page
    .locator(FV_LOGIN_CODE_INPUT)
    .first()
    .waitFor({ state: "visible", timeout: loginRedirectTimeoutMs })
    .then(() => "code" as const)
    .catch(() => "timeout" as const);
  const afterLogin = await Promise.race([
    reachedAccueil,
    askedForCode.then((outcome) => (outcome === "code" ? outcome : reachedAccueil)),
  ]);
  trace.push(`${afterLogin}@${pagePath(page)}`);
  if (afterLogin === "code") {
    if (!options.loginCodeProvider) {
      throw new Error("France-Visas asked for the emailed access code, but no inbox is available to read it");
    }
    const code = await options.loginCodeProvider(loginSubmittedAt);
    // Submit the form that owns the code field (Enter), so a sibling
    // "send a new code" button can never be pressed by mistake.
    const codeField = page.locator(FV_LOGIN_CODE_INPUT).first();
    await codeField.fill(code);
    await Promise.all([
      page.waitForURL(/accueil\.xhtml/i, { timeout: loginRedirectTimeoutMs }).catch(() => undefined),
      codeField.press("Enter"),
    ]);
    trace.push(`code-sent@${pagePath(page)}`);
    // The redirect after the code sometimes fails in the remote browser
    // (Chrome's own error page), although the session is signed in. Open
    // the application home directly instead of waiting on the error page.
    // The connection itself can drop for a moment, so retry a few times.
    for (let open = 1; open <= HOME_OPEN_ATTEMPTS && !/accueil\.xhtml/i.test(page.url()); open += 1) {
      if (open > 1) await page.waitForTimeout(3_000 * (open - 1));
      await page
        .goto(FV_URLS.ACCUEIL, { waitUntil: "domcontentloaded", timeout: loginRedirectTimeoutMs })
        .catch(() => undefined);
      await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);
      trace.push(`home${open}@${pagePath(page)}`);
      // Back on the login form means the session was not signed in: no use
      // reopening the home page, the caller logs in again.
      if (await page.locator(FV_LOGIN_SELECTORS.email).first().isVisible().catch(() => false)) break;
    }
  }
}

const HOME_OPEN_ATTEMPTS = 3;

/** host + path of the current page (no query, which can carry tokens). */
function pagePath(page: Page): string {
  try {
    const url = new URL(page.url());
    return `${url.host}${url.pathname}`;
  } catch {
    return page.url().slice(0, 40);
  }
}

/** Chrome's own "page could not be loaded" screen (the connection dropped). */
function isBrowserErrorPage(page: Page): boolean {
  return /^chrome-error:|chromewebdata/i.test(page.url());
}
