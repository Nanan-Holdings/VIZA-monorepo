import type { Browser, Page, Response } from "@playwright/test";
import {
  canadaUnsafePageUrl,
  createCanadaPortalContext,
  installCanadaTrustedNavigationGuard,
  isCanadaPageSafe,
  launchCanadaPortalBrowser,
} from "./browser.js";
import { assessCanadaPaymentEvidence } from "./payment-checkpoint.js";
import { CANADA_PURPOSE_PAGE, fillCanadaPurposePage } from "./purpose-page.js";
import { advanceCanadaPostPurpose } from "./post-purpose.js";
import {
  CANADA_TRV_PORTAL_URL,
  isTrustedCanadaApplicationUrl,
  isTrustedCanadaBrowserUrl,
  isTrustedCanadaCognitoUrl,
} from "./readiness.js";

export const CANADA_LOGIN_SELECTORS = {
  email: "#user-control",
  password: "#password-control",
  submit: "#Login\\.SignInTitle_action_button0",
} as const;

export const CANADA_DASHBOARD_SELECTORS = {
  gridResume: 'button[id^="Grid.actionContinue_"]',
  visitorVisaProduct: "#lobLink_0_0",
} as const;

export type CanadaLoginCheckpoint =
  | "authenticated_portal"
  | "account_activation_required"
  | "credentials_rejected"
  | "portal_api_unavailable"
  | "login_response_unverified"
  | "login_selector_drift"
  | "unexpected_redirect";

export interface CanadaLoginResult {
  checkpoint: CanadaLoginCheckpoint;
  url: string;
  title: string;
}

export type CanadaPortalFlowCheckpoint =
  | "terms_consent_required"
  | "terms_consent_record_required"
  | "draft_resume_link_missing"
  | "draft_resume_link_ambiguous"
  | "draft_resume_transition_failed"
  | "purpose_missing_answers"
  | "purpose_invalid_answers"
  | "purpose_selector_drift"
  | "purpose_transition_failed"
  | "purpose_filled"
  | "representative_status_required"
  | "representative_selector_drift"
  | "tourist_type_selector_drift"
  | "tourist_type_transition_failed"
  | "next_section_mapping_required"
  | "payment_checkpoint_observed"
  | "payment_entry_ready"
  | "account_activation_required"
  | "credentials_rejected"
  | "portal_api_unavailable"
  | "login_response_unverified"
  | "login_selector_drift"
  | "unexpected_redirect";

export interface CanadaPortalFlowResult {
  checkpoint: CanadaPortalFlowCheckpoint;
  url: string;
  missingFields?: string[];
  invalidFields?: string[];
  detail?: string;
  officialApplicationId?: string;
  officialPackageId?: string;
}

export type CanadaCognitoOutcome = "authenticated" | "rejected" | null;

export interface CanadaLoginEvidence {
  url: string;
  title: string;
  cognitoOutcome: CanadaCognitoOutcome;
  emailVisible: boolean;
  passwordVisible: boolean;
  authenticatedMarkerVisible: boolean;
  mainText: string;
}

export function classifyCanadaCognitoResponse(
  payload: unknown,
): CanadaCognitoOutcome {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as Record<string, unknown>;
  if (response.AuthenticationResult && typeof response.AuthenticationResult === "object") {
    return "authenticated";
  }
  const type = typeof response.__type === "string" ? response.__type : "";
  const message = typeof response.message === "string" ? response.message : "";
  if (/NotAuthorized|UserNotFound|PasswordResetRequired/i.test(`${type} ${message}`)) {
    return "rejected";
  }
  return null;
}

/**
 * A rejected Cognito result is authoritative even while the Angular login DOM
 * is remounting. Successful classification requires positive portal evidence:
 * either an authenticated-page marker, or both a Cognito AuthenticationResult
 * and a completed navigation away from the sign-in route.
 */
export function classifyCanadaLoginEvidence(
  evidence: CanadaLoginEvidence,
): CanadaLoginResult {
  if (!isTrustedCanadaBrowserUrl(evidence.url)) {
    return {
      checkpoint: "unexpected_redirect",
      url: evidence.url,
      title: evidence.title,
    };
  }
  if (evidence.cognitoOutcome === "rejected") {
    return {
      checkpoint: "credentials_rejected",
      url: evidence.url,
      title: evidence.title,
    };
  }

  const loginControlsVisible = evidence.emailVisible || evidence.passwordVisible;
  const pathname = new URL(evidence.url).pathname.replace(/\/$/, "") || "/";
  const leftSignInRoute = pathname !== "/signin";
  const positivelyAuthenticated =
    evidence.authenticatedMarkerVisible ||
    (evidence.cognitoOutcome === "authenticated" && leftSignInRoute);
  if (!loginControlsVisible && positivelyAuthenticated) {
    return {
      checkpoint: "authenticated_portal",
      url: evidence.url,
      title: evidence.title,
    };
  }

  if (evidence.cognitoOutcome === "authenticated") {
    return {
      checkpoint: "portal_api_unavailable",
      url: evidence.url,
      title: evidence.title,
    };
  }
  if (/verify|verification|activate|activation/i.test(evidence.mainText)) {
    return {
      checkpoint: "account_activation_required",
      url: evidence.url,
      title: evidence.title,
    };
  }
  if (/invalid|incorrect|not recognized|does not match|try again/i.test(evidence.mainText)) {
    return {
      checkpoint: "credentials_rejected",
      url: evidence.url,
      title: evidence.title,
    };
  }
  return {
    checkpoint: "login_response_unverified",
    url: evidence.url,
    title: evidence.title,
  };
}

async function unexpectedCanadaLoginRedirect(page: Page): Promise<CanadaLoginResult> {
  return {
    checkpoint: "unexpected_redirect",
    url: canadaUnsafePageUrl(page),
    title: await page.title().catch(() => ""),
  };
}

function unexpectedCanadaFlowRedirect(page: Page): CanadaPortalFlowResult {
  return {
    checkpoint: "unexpected_redirect",
    url: canadaUnsafePageUrl(page),
  };
}

async function classifyAfterLogin(
  page: Page,
  cognitoOutcome: CanadaCognitoOutcome,
): Promise<CanadaLoginResult> {
  if (!isCanadaPageSafe(page, "either")) {
    return unexpectedCanadaLoginRedirect(page);
  }
  const url = page.url();
  const title = await page.title();
  const [emailVisible, passwordVisible, mainText, authenticatedMarkerStates] =
    await Promise.all([
      page.locator(CANADA_LOGIN_SELECTORS.email).isVisible().catch(() => false),
      page.locator(CANADA_LOGIN_SELECTORS.password).isVisible().catch(() => false),
      page.locator("main").innerText({ timeout: 5_000 }).catch(() => ""),
      Promise.all([
        page
          .getByRole("button", { name: "I accept", exact: true })
          .isVisible()
          .catch(() => false),
        page
          .locator(CANADA_DASHBOARD_SELECTORS.gridResume)
          .first()
          .isVisible()
          .catch(() => false),
        page
          .locator(CANADA_DASHBOARD_SELECTORS.visitorVisaProduct)
          .isVisible()
          .catch(() => false),
        page
          .locator(CANADA_PURPOSE_PAGE.visitorVisa)
          .isVisible()
          .catch(() => false),
      ]),
    ]);
  return classifyCanadaLoginEvidence({
    url,
    title,
    cognitoOutcome,
    emailVisible,
    passwordVisible,
    authenticatedMarkerVisible: authenticatedMarkerStates.some(Boolean),
    mainText,
  });
}

export async function submitCanadaPortalLogin(input: {
  page: Page;
  email: string;
  password: string;
}): Promise<CanadaLoginResult> {
  if (!isCanadaPageSafe(input.page, "portal")) {
    return unexpectedCanadaLoginRedirect(input.page);
  }
  let cognitoOutcome: CanadaCognitoOutcome = null;
  let settleSignal: (() => void) | undefined;
  const settled = new Promise<void>((resolve) => {
    settleSignal = resolve;
  });
  const onResponse = async (response: Response) => {
    try {
      const url = new URL(response.url());
      if (!isTrustedCanadaCognitoUrl(url)) return;
      const outcome = classifyCanadaCognitoResponse(await response.json().catch(() => null));
      if (!outcome) return;
      cognitoOutcome = outcome;
      settleSignal?.();
    } catch {
      // Keep waiting for navigation or a visible official result.
    }
  };
  input.page.on("response", onResponse);
  try {
    if (!isCanadaPageSafe(input.page, "portal")) {
      return unexpectedCanadaLoginRedirect(input.page);
    }
    await input.page.locator(CANADA_LOGIN_SELECTORS.email).fill(input.email);
    if (!isCanadaPageSafe(input.page, "portal")) {
      return unexpectedCanadaLoginRedirect(input.page);
    }
    await input.page.locator(CANADA_LOGIN_SELECTORS.password).fill(input.password);
    if (!isCanadaPageSafe(input.page, "portal")) {
      return unexpectedCanadaLoginRedirect(input.page);
    }
    await input.page.locator(CANADA_LOGIN_SELECTORS.submit).click();
    await Promise.race([
      input.page.waitForURL(
        (url) => isTrustedCanadaBrowserUrl(url) && url.pathname !== "/signin",
        { timeout: 20_000 },
      ),
      settled,
      input.page.waitForTimeout(20_000),
    ]).catch(() => undefined);

    if (cognitoOutcome === "authenticated") {
      await input.page
        .waitForURL(
          (url) => isTrustedCanadaBrowserUrl(url) && url.pathname !== "/signin",
          { timeout: 20_000 },
        )
        .catch(() => undefined);
    } else {
      await input.page.waitForTimeout(500);
    }
    return classifyAfterLogin(input.page, cognitoOutcome);
  } finally {
    input.page.off("response", onResponse);
  }
}

/**
 * Uses only selectors verified on the public IRCC Portal sign-in page. It does
 * not create an account, accept terms, open an application, upload a file,
 * enter payment details, or submit anything.
 */
export async function loginToCanadaIrccPortal(input: {
  email: string;
  password: string;
  headless?: boolean;
}): Promise<CanadaLoginResult> {
  const browser = await launchCanadaPortalBrowser(input.headless ?? true);
  const context = await createCanadaPortalContext(browser);
  const page = await context.newPage();
  const disposeNavigationGuard = await installCanadaTrustedNavigationGuard(page);
  try {
    try {
      await page.goto(CANADA_TRV_PORTAL_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    } catch (error) {
      if (!isCanadaPageSafe(page, "portal")) {
        return unexpectedCanadaLoginRedirect(page);
      }
      throw error;
    }
    if (!isCanadaPageSafe(page, "portal")) {
      return unexpectedCanadaLoginRedirect(page);
    }

    const counts = await Promise.all(
      Object.values(CANADA_LOGIN_SELECTORS).map((selector) =>
        page.locator(selector).count(),
      ),
    );
    if (counts.some((count) => count !== 1)) {
      return {
        checkpoint: "login_selector_drift",
        url: page.url(),
        title: await page.title(),
      };
    }

    return submitCanadaPortalLogin({ page, email: input.email, password: input.password });
  } finally {
    await disposeNavigationGuard();
    await context.close();
    await browser.close();
  }
}

function idsFromDraftUrl(url: string): {
  officialApplicationId?: string;
  officialPackageId?: string;
} {
  try {
    const parsed = new URL(url);
    if (!isTrustedCanadaApplicationUrl(parsed)) return {};
    const applicationId = parsed.searchParams.get("appId")?.trim();
    const packageId = parsed.searchParams.get("appPkgId")?.trim();
    return {
      ...(applicationId ? { officialApplicationId: applicationId } : {}),
      ...(packageId ? { officialPackageId: packageId } : {}),
    };
  } catch {
    return {};
  }
}

async function observePaymentCheckpoint(page: Page): Promise<CanadaPortalFlowResult | null> {
  const [headingTexts, buttonTexts, cardFieldCount] = await Promise.all([
    page.getByRole("heading").allTextContents(),
    page.getByRole("button").allTextContents(),
    page.locator('input[autocomplete="cc-number"], input[name*="card" i]').count(),
  ]);
  const evidence = assessCanadaPaymentEvidence({
    url: page.url(),
    headingTexts,
    buttonTexts,
    cardFieldCount,
  });
  if (!evidence.reached) return null;
  return {
    checkpoint: evidence.entryReady
      ? "payment_entry_ready"
      : "payment_checkpoint_observed",
    url: page.url(),
    ...idsFromDraftUrl(page.url()),
  };
}

async function waitForCanadaDraftRoute(page: Page): Promise<boolean> {
  const hasDraftRoute = (url: URL): boolean =>
    isTrustedCanadaApplicationUrl(url) && url.pathname.replace(/\/$/, "") !== "";
  if (isCanadaPageSafe(page, "application") && hasDraftRoute(new URL(page.url()))) {
    return true;
  }

  await Promise.race([
    page.waitForURL(hasDraftRoute, { timeout: 45_000 }),
    page.locator(CANADA_PURPOSE_PAGE.visitorVisa).waitFor({
      state: "attached",
      timeout: 45_000,
    }),
    page.waitForTimeout(45_000),
  ]).catch(() => undefined);
  if (!isCanadaPageSafe(page, "application")) return false;
  return hasDraftRoute(new URL(page.url())) ||
    (await page.locator(CANADA_PURPOSE_PAGE.visitorVisa).count()) === 1;
}

/**
 * Authenticated, resumable flow through only the IRCC controls verified in
 * live QA. It never invents an answer, signs, submits, enters card data, or
 * clicks a payment action.
 */
export async function runCanadaIrccPortalFlow(input: {
  email: string;
  password: string;
  answers: Record<string, string>;
  portalTermsAuthorized: boolean;
  advancePurposePage: boolean;
  headless?: boolean;
}): Promise<CanadaPortalFlowResult> {
  const headless = input.headless ?? true;
  const browser: Browser = await launchCanadaPortalBrowser(headless);
  const context = await createCanadaPortalContext(browser);
  const page = await context.newPage();
  const disposeNavigationGuard = await installCanadaTrustedNavigationGuard(page);
  try {
    try {
      await page.goto(CANADA_TRV_PORTAL_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    } catch (error) {
      if (!isCanadaPageSafe(page, "portal")) {
        return unexpectedCanadaFlowRedirect(page);
      }
      throw error;
    }
    if (!isCanadaPageSafe(page, "portal")) {
      return unexpectedCanadaFlowRedirect(page);
    }
    const counts = await Promise.all(
      Object.values(CANADA_LOGIN_SELECTORS).map((selector) => page.locator(selector).count()),
    );
    if (counts.some((count) => count !== 1)) {
      return { checkpoint: "login_selector_drift", url: page.url() };
    }
    const login = await submitCanadaPortalLogin({
      page,
      email: input.email,
      password: input.password,
    });
    if (login.checkpoint !== "authenticated_portal") {
      return { checkpoint: login.checkpoint, url: login.url };
    }
    if (!isCanadaPageSafe(page, "either")) {
      return unexpectedCanadaFlowRedirect(page);
    }

    const accept = page.getByRole("button", { name: "I accept", exact: true });
    const termsRequired = /\/terms(?:\?|$)/.test(new URL(page.url()).pathname) ||
      (await accept.count()) === 1;
    if (termsRequired) {
      if (!isCanadaPageSafe(page, "portal")) {
        return unexpectedCanadaFlowRedirect(page);
      }
      if (!input.portalTermsAuthorized) {
        return { checkpoint: "terms_consent_required", url: page.url() };
      }
      if ((await accept.count()) !== 1) {
        return {
          checkpoint: "next_section_mapping_required",
          url: page.url(),
          detail: "terms_accept_selector_drift",
        };
      }
      if (!isCanadaPageSafe(page, "portal")) {
        return unexpectedCanadaFlowRedirect(page);
      }
      await accept.click();
      await page
        .waitForURL(
          (url) => isTrustedCanadaBrowserUrl(url) && url.pathname !== "/terms",
          { timeout: 30_000 },
        )
        .catch(() => undefined);
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    } else if (!input.portalTermsAuthorized) {
      return { checkpoint: "terms_consent_record_required", url: page.url() };
    }
    if (!isCanadaPageSafe(page, "either")) {
      return unexpectedCanadaFlowRedirect(page);
    }

    const paymentAtEntry = await observePaymentCheckpoint(page);
    if (paymentAtEntry) return paymentAtEntry;

    if (!isCanadaPageSafe(page, "either")) {
      return unexpectedCanadaFlowRedirect(page);
    }
    if ((await page.locator(CANADA_PURPOSE_PAGE.visitorVisa).count()) !== 1) {
      const resumeButtons = page.getByRole("button", {
        name: /^Continue - Online application/,
      });
      const legacyResumes = page.locator(
        'a[href*="tr-rt.apps.cic.gc.ca"][href*="continue=true"]',
      );
      await Promise.race([
        page.locator(CANADA_PURPOSE_PAGE.visitorVisa).waitFor({
          state: "attached",
          timeout: 20_000,
        }),
        resumeButtons.first().waitFor({ state: "visible", timeout: 20_000 }),
        page.locator(CANADA_DASHBOARD_SELECTORS.gridResume).first().waitFor({
          state: "visible",
          timeout: 20_000,
        }),
        legacyResumes.first().waitFor({ state: "visible", timeout: 20_000 }),
        page.waitForTimeout(20_000),
      ]).catch(() => undefined);
      if (!isCanadaPageSafe(page, "either")) {
        return unexpectedCanadaFlowRedirect(page);
      }

      if ((await page.locator(CANADA_PURPOSE_PAGE.visitorVisa).count()) === 1) {
        if (!isCanadaPageSafe(page, "application")) {
          return unexpectedCanadaFlowRedirect(page);
        }
        // The authenticated account opened directly into its only draft.
      } else {
        if (!isCanadaPageSafe(page, "portal")) {
          return unexpectedCanadaFlowRedirect(page);
        }
        const resumeButtonCount = await resumeButtons.count();
        if (resumeButtonCount > 1) {
          return { checkpoint: "draft_resume_link_ambiguous", url: page.url() };
        }
        if (resumeButtonCount === 1) {
          if (!isCanadaPageSafe(page, "portal")) {
            return unexpectedCanadaFlowRedirect(page);
          }
          await resumeButtons.click();
          if (!(await waitForCanadaDraftRoute(page))) {
            return { checkpoint: "draft_resume_transition_failed", url: page.url() };
          }
        } else {
          const gridResumes = page.locator(CANADA_DASHBOARD_SELECTORS.gridResume);
          const gridResumeCount = await gridResumes.count();
          if (gridResumeCount > 1) {
            return { checkpoint: "draft_resume_link_ambiguous", url: page.url() };
          }
          if (gridResumeCount === 1) {
            if (!isCanadaPageSafe(page, "portal")) {
              return unexpectedCanadaFlowRedirect(page);
            }
            await gridResumes.click();
            if (!(await waitForCanadaDraftRoute(page))) {
              return { checkpoint: "draft_resume_transition_failed", url: page.url() };
            }
          } else {
            const resumeCount = await legacyResumes.count();
            if (resumeCount === 0) {
              return { checkpoint: "draft_resume_link_missing", url: page.url() };
            }
            if (resumeCount !== 1) {
              return { checkpoint: "draft_resume_link_ambiguous", url: page.url() };
            }
            const href = await legacyResumes.getAttribute("href");
            if (!href) return { checkpoint: "draft_resume_link_missing", url: page.url() };
            const target = new URL(href, page.url());
            if (!isTrustedCanadaApplicationUrl(target)) {
              return unexpectedCanadaFlowRedirect(page);
            }
            await page.goto(target.toString(), {
              waitUntil: "domcontentloaded",
              timeout: 60_000,
            });
            if (!(await waitForCanadaDraftRoute(page))) {
              return { checkpoint: "draft_resume_transition_failed", url: page.url() };
            }
          }
        }
      }
    }
    if (!isCanadaPageSafe(page, "application")) {
      return unexpectedCanadaFlowRedirect(page);
    }

    let ids = idsFromDraftUrl(page.url());
    const currentPath = new URL(page.url()).pathname.replace(/\/$/, "");
    const purposeVisible =
      currentPath === "/purpose" ||
      (await page.locator(CANADA_PURPOSE_PAGE.visitorVisa).count()) === 1;
    if (purposeVisible) {
      const purpose = await fillCanadaPurposePage({
        page,
        answers: input.answers,
        advance: input.advancePurposePage,
      });
      if (purpose.checkpoint === "unexpected_redirect") {
        return unexpectedCanadaFlowRedirect(page);
      }
      ids = idsFromDraftUrl(page.url());
      if (purpose.checkpoint === "purpose_missing_answers") {
        return {
          checkpoint: purpose.checkpoint,
          url: page.url(),
          missingFields: purpose.missingFields,
          ...ids,
        };
      }
      if (purpose.checkpoint === "purpose_invalid_answers") {
        return {
          checkpoint: purpose.checkpoint,
          url: page.url(),
          invalidFields: purpose.invalidFields,
          ...ids,
        };
      }
      if (purpose.checkpoint === "purpose_selector_drift") {
        return {
          checkpoint: purpose.checkpoint,
          url: page.url(),
          detail: purpose.detail,
          ...ids,
        };
      }
      if (!purpose.advanced) {
        return { checkpoint: "purpose_filled", url: page.url(), ...ids };
      }

      await page
        .waitForURL(
          (url) =>
            isTrustedCanadaApplicationUrl(url) &&
            url.pathname.replace(/\/$/, "") !== "/purpose",
          { timeout: 30_000 },
        )
        .catch(() => undefined);
      if (!isCanadaPageSafe(page, "application")) {
        return unexpectedCanadaFlowRedirect(page);
      }
      if (new URL(page.url()).pathname.replace(/\/$/, "") === "/purpose") {
        return {
          checkpoint: "purpose_transition_failed",
          url: page.url(),
          ...ids,
        };
      }
      ids = idsFromDraftUrl(page.url());
    }

    if (!isCanadaPageSafe(page, "application")) {
      return unexpectedCanadaFlowRedirect(page);
    }
    const payment = await observePaymentCheckpoint(page);
    if (payment) return payment;
    const postPurpose = await advanceCanadaPostPurpose(page);
    return {
      checkpoint: postPurpose.checkpoint,
      url: postPurpose.url,
      ...(postPurpose.detail ? { detail: postPurpose.detail } : {}),
      ...idsFromDraftUrl(postPurpose.url),
    };
  } finally {
    await disposeNavigationGuard();
    await context.close();
    await browser.close();
  }
}
