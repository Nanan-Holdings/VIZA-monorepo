import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import type { InboundMessage } from "../inbox/wait-for-message.js";
import {
  createCanadaPortalContext,
  installCanadaTrustedNavigationGuard,
  isCanadaPageSafe,
  launchCanadaPortalBrowser,
} from "./browser.js";
import {
  CANADA_TRV_PORTAL_URL,
  isTrustedCanadaPortalUrl,
} from "./readiness.js";

export const CANADA_PASSWORD_RECOVERY_SELECTORS = {
  requestEmail: "#user-control",
  requestSubmit: "#ForgotPassword\\.Title_action_button0",
  resetEmail: "#user-control",
  verificationCode: "#verification-code-control",
  newPassword: "#old-password-control",
  confirmPassword: "#password-control",
  updatePassword: "#ResetPassword\\.Title_action_button0",
} as const;

const CANADA_FORGOT_PASSWORD_URL =
  "https://portal-portail.apps.cic.gc.ca/forgotpassword?lang=en";

export type CanadaPasswordRecoveryCheckpoint =
  | "unexpected_redirect"
  | "reset_request_selector_drift"
  | "reset_request_rejected"
  | "reset_email_timeout"
  | "reset_email_untrusted"
  | "reset_code_unreadable"
  | "reset_form_selector_drift"
  | "reset_code_rejected"
  | "password_update_unverified";

export class CanadaPasswordRecoveryError extends Error {
  constructor(
    readonly checkpoint: CanadaPasswordRecoveryCheckpoint,
    message: string,
  ) {
    super(message);
    this.name = "CanadaPasswordRecoveryError";
  }
}

export interface CanadaPasswordRecoveryResult {
  checkpoint: "password_updated";
  /** Kept only in worker memory until the encrypted applicant vault is rotated. */
  password: string;
}

function normalizedBody(message: Pick<InboundMessage, "subject" | "text" | "html">): string {
  return [message.subject, message.text, message.html]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n")
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9a-f]{2})/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function headerValue(
  headers: InboundMessage["headers"],
  name: string,
): string {
  if (!headers) return "";
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return typeof match?.[1] === "string" ? match[1] : "";
}

const CANADA_EMAIL_AUTHSERV_ID = "mx.cloudflare.net";

function emailDomain(value: string): string {
  const angleAddress = value.match(/<[^<>@]+@([^<>\s]+)>/);
  const bareAddress = value.match(/(?:^|\s)[^\s<>@]+@([^\s<>]+)/);
  return (angleAddress?.[1] ?? bareAddress?.[1] ?? "")
    .replace(/[>,;]+$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function isOfficialCanadaMailDomain(value: string): boolean {
  const domain = value.trim().replace(/\.$/, "").toLowerCase();
  return (
    domain === "cic.gc.ca" ||
    domain.endsWith(".cic.gc.ca") ||
    domain === "canada.ca" ||
    domain.endsWith(".canada.ca")
  );
}

function domainsAlign(left: string, right: string): boolean {
  const a = left.trim().replace(/\.$/, "").toLowerCase();
  const b = right.trim().replace(/\.$/, "").toLowerCase();
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function authMethodDomains(
  authenticationResult: string,
  method: "dkim" | "dmarc",
  property: "header.d" | "header.from",
): string[] {
  const methodPattern = new RegExp(`(?:^|;)\\s*${method}=pass\\b([^;]*)`, "gi");
  const domains: string[] = [];
  for (const match of authenticationResult.matchAll(methodPattern)) {
    const propertyPattern = new RegExp(
      `\\b${property.replace(".", "\\.")}=([^\\s;]+)`,
      "i",
    );
    const domain = match[1].match(propertyPattern)?.[1];
    if (domain) domains.push(domain.replace(/\.$/, "").toLowerCase());
  }
  return domains;
}

/**
 * The Email Worker joins duplicate Authentication-Results headers with a
 * newline. Accept exactly one receiver-authenticated Cloudflare result, and
 * require both DKIM and DMARC identities to align with the official From
 * domain. A sender-injected duplicate using Cloudflare's authserv-id therefore
 * makes the message ambiguous and fails closed.
 */
function hasTrustedCanadaAuthenticationResults(
  authenticationResults: string,
  fromDomain: string,
): boolean {
  const trustedResults = authenticationResults
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => {
      const authservId = value.match(/^([^;\s]+)\s*;/)?.[1]?.toLowerCase();
      return authservId === CANADA_EMAIL_AUTHSERV_ID;
    });
  if (trustedResults.length !== 1) return false;

  const trusted = trustedResults[0];
  const dkimDomains = authMethodDomains(trusted, "dkim", "header.d");
  const dmarcDomains = authMethodDomains(trusted, "dmarc", "header.from");
  return (
    /(?:^|;)\s*spf=pass\b/i.test(trusted) &&
    dkimDomains.some(
      (domain) =>
        isOfficialCanadaMailDomain(domain) && domainsAlign(domain, fromDomain),
    ) &&
    dmarcDomains.some(
      (domain) =>
        isOfficialCanadaMailDomain(domain) && domainsAlign(domain, fromDomain),
    )
  );
}

function isCanadaPasswordResetPurpose(
  message: Pick<InboundMessage, "subject" | "text" | "html">,
): boolean {
  const body = normalizedBody(message);
  return (
    /IRCC Portal/i.test(body) &&
    /(?:forgot password|lost verification code|reset your password)/i.test(body)
  );
}

/**
 * IRCC currently sends the Portal message through authenticated Amazon SES,
 * while the RFC From header remains on the official cic.gc.ca host. Requiring
 * both the official header identity and passing authentication keeps a forged
 * alias message from being accepted as a reset code.
 */
export function isTrustedCanadaPasswordResetMessage(
  message: Pick<
    InboundMessage,
    "from_addr" | "subject" | "text" | "html" | "headers"
  >,
): boolean {
  const fromHeader = headerValue(message.headers, "from");
  const authentication = headerValue(message.headers, "authentication-results");
  const fromDomain = emailDomain(fromHeader);
  const officialHeader =
    fromDomain === "notification.portal-portail.apps.cic.gc.ca";
  const authenticated = hasTrustedCanadaAuthenticationResults(
    authentication,
    fromDomain,
  );
  const envelopeDomain = emailDomain(message.from_addr);
  const trustedEnvelope =
    envelopeDomain === "amazonses.com" ||
    envelopeDomain.endsWith(".amazonses.com") ||
    envelopeDomain === "notification.portal-portail.apps.cic.gc.ca";
  const resetPurpose = isCanadaPasswordResetPurpose(message);
  return officialHeader && authenticated && trustedEnvelope && resetPurpose;
}

export type CanadaPasswordResetCandidate =
  | { status: "ignore" }
  | { status: "untrusted" }
  | { status: "unreadable" }
  | { status: "ready"; code: string };

/**
 * Used directly by the mailbox predicate so an untrusted or ambiguous message
 * is never returned (and therefore never marked processed) by waitForMessage.
 */
export function classifyCanadaPasswordResetCandidate(
  message: Pick<
    InboundMessage,
    "from_addr" | "subject" | "text" | "html" | "headers"
  >,
): CanadaPasswordResetCandidate {
  if (!isCanadaPasswordResetPurpose(message)) return { status: "ignore" };
  if (!isTrustedCanadaPasswordResetMessage(message)) return { status: "untrusted" };
  const code = extractCanadaPasswordResetCode(message);
  return code ? { status: "ready", code } : { status: "unreadable" };
}

/** Returns one context-bound six-digit code, never an arbitrary body number. */
export function extractCanadaPasswordResetCode(
  message: Pick<InboundMessage, "subject" | "text" | "html">,
): string | null {
  const body = normalizedBody(message);
  const candidates = new Set<string>();
  const patterns = [
    /enter\s+(?:this\s+)?code\s*\[?\s*([0-9]{6})\s*\]?/gi,
    /(?:verification|confirmation)\s+code(?:\s+is|\s*:)?\s*\[?\s*([0-9]{6})\s*\]?/gi,
  ];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) candidates.add(match[1]);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

/** IRCC policy: 8-15 chars with upper, lower, numeric and special characters. */
export function generateCanadaPortalPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const random = randomBytes(9);
  const suffix = [...random]
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
  return `V!z9${suffix}`;
}

function requireTrustedCanadaRecoveryPage(page: Page): void {
  if (isCanadaPageSafe(page, "portal")) return;
  throw new CanadaPasswordRecoveryError(
    "unexpected_redirect",
    "IRCC password recovery left the exact trusted HTTPS portal origin.",
  );
}

async function exactSelectorCounts(
  page: Page,
  selectors: readonly string[],
): Promise<boolean> {
  const counts = await Promise.all(
    selectors.map((selector) => page.locator(selector).count()),
  );
  return counts.every((count) => count === 1);
}

async function visibleResetError(page: Page): Promise<string> {
  const values = await page
    .locator('[role="alert"]:visible, .alert:visible, .error:visible')
    .allTextContents()
    .catch(() => [] as string[]);
  return values.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Completes VIZA-managed IRCC password recovery through the applicant alias.
 * The returned password must be encrypted into applicant_secret immediately;
 * it is never logged or persisted by this module.
 */
export async function recoverCanadaIrccPortalPassword(input: {
  applicantId: string;
  email: string;
  headless?: boolean;
  mailboxTimeoutMs?: number;
}): Promise<CanadaPasswordRecoveryResult> {
  const browser = await launchCanadaPortalBrowser(input.headless ?? true);
  const context = await createCanadaPortalContext(browser);
  const page = await context.newPage();
  const disposeNavigationGuard = await installCanadaTrustedNavigationGuard(page);
  try {
    try {
      await page.goto(CANADA_FORGOT_PASSWORD_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    } catch (error) {
      if (!isCanadaPageSafe(page, "portal")) {
        requireTrustedCanadaRecoveryPage(page);
      }
      throw error;
    }
    requireTrustedCanadaRecoveryPage(page);
    await Promise.all(
      [
        CANADA_PASSWORD_RECOVERY_SELECTORS.requestEmail,
        CANADA_PASSWORD_RECOVERY_SELECTORS.requestSubmit,
      ].map((selector) =>
        page.locator(selector).waitFor({ state: "visible", timeout: 30_000 }),
      ),
    ).catch(() => undefined);
    requireTrustedCanadaRecoveryPage(page);
    if (
      !(await exactSelectorCounts(page, [
        CANADA_PASSWORD_RECOVERY_SELECTORS.requestEmail,
        CANADA_PASSWORD_RECOVERY_SELECTORS.requestSubmit,
      ]))
    ) {
      throw new CanadaPasswordRecoveryError(
        "reset_request_selector_drift",
        "IRCC forgot-password controls did not match the verified selector map.",
      );
    }

    requireTrustedCanadaRecoveryPage(page);
    await page.locator(CANADA_PASSWORD_RECOVERY_SELECTORS.requestEmail).fill(input.email);
    requireTrustedCanadaRecoveryPage(page);
    const requestedAt = new Date().toISOString();
    await page.locator(CANADA_PASSWORD_RECOVERY_SELECTORS.requestSubmit).click();
    await page
      .waitForURL(
        (url) => isTrustedCanadaPortalUrl(url) && url.pathname === "/resetpassword",
        { timeout: 30_000 },
      )
      .catch(() => undefined);
    await page.waitForTimeout(500);
    requireTrustedCanadaRecoveryPage(page);
    if (new URL(page.url()).pathname !== "/resetpassword") {
      throw new CanadaPasswordRecoveryError(
        "reset_request_rejected",
        "IRCC did not open the reset-password form after the managed alias request.",
      );
    }

    let message: InboundMessage;
    let sawUntrustedCandidate = false;
    let sawUnreadableCandidate = false;
    const { InboxTimeoutError, inbox } = await import(
      "../inbox/wait-for-message.js"
    );
    try {
      message = await inbox.waitForMessage(
        input.applicantId,
        (candidate) => {
          const classification = classifyCanadaPasswordResetCandidate(candidate);
          if (classification.status === "untrusted") sawUntrustedCandidate = true;
          if (classification.status === "unreadable") sawUnreadableCandidate = true;
          return classification.status === "ready";
        },
        input.mailboxTimeoutMs ?? 120_000,
        { since: requestedAt, newestFirst: true },
      );
    } catch (error) {
      if (error instanceof InboxTimeoutError) {
        if (sawUntrustedCandidate) {
          throw new CanadaPasswordRecoveryError(
            "reset_email_untrusted",
            "The received password-reset message failed official-sender authentication checks.",
          );
        }
        if (sawUnreadableCandidate) {
          throw new CanadaPasswordRecoveryError(
            "reset_code_unreadable",
            "The authenticated IRCC reset message did not contain one unambiguous confirmation code.",
          );
        }
        throw new CanadaPasswordRecoveryError(
          "reset_email_timeout",
          "The VIZA managed inbox did not receive an IRCC reset message before timeout.",
        );
      }
      throw error;
    }

    const matchedCandidate = classifyCanadaPasswordResetCandidate(message);
    if (matchedCandidate.status === "untrusted") {
      throw new CanadaPasswordRecoveryError(
        "reset_email_untrusted",
        "The received password-reset message failed official-sender authentication checks.",
      );
    }
    if (matchedCandidate.status !== "ready") {
      throw new CanadaPasswordRecoveryError(
        "reset_code_unreadable",
        "The authenticated IRCC reset message did not contain one unambiguous confirmation code.",
      );
    }
    const code = matchedCandidate.code;

    const resetSelectors = [
      CANADA_PASSWORD_RECOVERY_SELECTORS.resetEmail,
      CANADA_PASSWORD_RECOVERY_SELECTORS.verificationCode,
      CANADA_PASSWORD_RECOVERY_SELECTORS.newPassword,
      CANADA_PASSWORD_RECOVERY_SELECTORS.confirmPassword,
      CANADA_PASSWORD_RECOVERY_SELECTORS.updatePassword,
    ];
    await Promise.all(
      resetSelectors.map((selector) =>
        page.locator(selector).waitFor({ state: "visible", timeout: 30_000 }),
      ),
    ).catch(() => undefined);
    requireTrustedCanadaRecoveryPage(page);
    if (!(await exactSelectorCounts(page, resetSelectors))) {
      throw new CanadaPasswordRecoveryError(
        "reset_form_selector_drift",
        "IRCC reset-password controls did not match the verified selector map.",
      );
    }

    const password = generateCanadaPortalPassword();
    requireTrustedCanadaRecoveryPage(page);
    await page.locator(CANADA_PASSWORD_RECOVERY_SELECTORS.resetEmail).fill(input.email);
    requireTrustedCanadaRecoveryPage(page);
    await page
      .locator(CANADA_PASSWORD_RECOVERY_SELECTORS.verificationCode)
      .fill(code);
    requireTrustedCanadaRecoveryPage(page);
    await page.locator(CANADA_PASSWORD_RECOVERY_SELECTORS.newPassword).fill(password);
    requireTrustedCanadaRecoveryPage(page);
    await page.locator(CANADA_PASSWORD_RECOVERY_SELECTORS.confirmPassword).fill(password);
    requireTrustedCanadaRecoveryPage(page);
    await page.locator(CANADA_PASSWORD_RECOVERY_SELECTORS.updatePassword).click();
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    requireTrustedCanadaRecoveryPage(page);

    const errorText = await visibleResetError(page);
    if (/invalid|expired|incorrect|does not match|try again/i.test(errorText)) {
      throw new CanadaPasswordRecoveryError(
        "reset_code_rejected",
        "IRCC rejected the managed password-reset confirmation.",
      );
    }
    const pathname = new URL(page.url()).pathname;
    const body = await page.locator("main").innerText({ timeout: 5_000 }).catch(() => "");
    const updated =
      pathname === "/signin" ||
      /password.{0,80}(?:successfully\s+)?(?:updated|changed|reset)/i.test(body);
    if (!updated) {
      throw new CanadaPasswordRecoveryError(
        "password_update_unverified",
        "IRCC did not display a verified password-update result.",
      );
    }

    return { checkpoint: "password_updated", password };
  } finally {
    await disposeNavigationGuard();
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export const CANADA_PASSWORD_RECOVERY_ENTRY_URL = CANADA_FORGOT_PASSWORD_URL;
export const CANADA_PASSWORD_RECOVERY_LOGIN_URL = CANADA_TRV_PORTAL_URL;
