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

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { launchFvBrowser } from "./browser";
import { FV_URLS, FV_LOGIN_SELECTORS } from "./selectors";
import { waitForPage } from "./pages";
import { assertNoGate } from "./gates";
import { makeSessionCloser } from "./session";
import { SessionBootstrapError } from "./errors";

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
}

export interface FvSessionHandles {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  runId?: string;
  close(): Promise<void>;
}

const ACCUEIL_WAIT_TIMEOUT_MS = 45_000;

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
  });

  try {
    await page.goto(FV_URLS.ACCUEIL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForPage(page, "accueil", { timeoutMs: ACCUEIL_WAIT_TIMEOUT_MS });
  } catch (err) {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw new SessionBootstrapError(
      "Stored storageState did not restore an authenticated France-Visas session",
      {
        url: page.url(),
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
  });
  const { browser, context, page } = handles;

  try {
    // Hit the application entry; Keycloak will redirect if unauthenticated.
    await page.goto(`${FV_URLS.ACCUEIL.replace(/\/accueil\.xhtml$/, "/")}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

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

    // Fill credentials. Keycloak surfaces the form as plain HTML; no PrimeFaces
    // here, so direct field access works.
    const username = page.locator(FV_LOGIN_SELECTORS.email).first();
    const password = page.locator(FV_LOGIN_SELECTORS.password).first();
    await username.waitFor({ state: "visible", timeout: timeoutMs });
    await username.fill(input.email);
    await password.fill(input.password);

    // Click Log in and wait for the redirect chain to settle on accueil.
    const submit = page.locator(FV_LOGIN_SELECTORS.submit).first();
    await Promise.all([
      page.waitForURL(/accueil\.xhtml/i, { timeout: timeoutMs }).catch(() => undefined),
      submit.click(),
    ]);

    // Explicit identity check — waitForURL returns on match OR on timeout;
    // we assert separately so an unexpected mid-flow page surfaces clearly.
    await waitForPage(page, "accueil", { timeoutMs: ACCUEIL_WAIT_TIMEOUT_MS });

    return {
      browser, context, page,
      runId: options.runId,
      close: makeSessionCloser(browser, context),
    };
  } catch (err) {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw new SessionBootstrapError(
      `France-Visas sign-in failed: ${err instanceof Error ? err.message : String(err)}`,
      {
        url: page.url(),
        details: { runId: options.runId },
      },
    );
  }
}
