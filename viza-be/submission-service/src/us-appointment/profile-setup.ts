import type { Locator, Page } from "@playwright/test";
import type { AppointmentAccountCredentials } from "./runner";

export const US_VISA_SCHEDULING_PROFILE_PATH = "/en-US/profile/";
export const US_VISA_SCHEDULING_OFFICIAL_ORIGIN = "https://www.usvisascheduling.com";

const US_VISA_SCHEDULING_HOME_PATH = "/en-US/";
const US_VISA_SCHEDULING_START_APPLICATION_PATH = "/en-US/applicant_details/";

export const US_VISA_SCHEDULING_PROFILE_SELECTORS = {
  firstName: "#firstname",
  surname: "#lastname",
  primaryEmailLink: "a[href^='mailto:']:visible, a[href^='MAILTO:']:visible",
  contactEmail: "#atlas_emailaddress1",
  preferredLanguage: "#adx_preferredlanguageid",
  country: "#atlas_country",
  updateButton: "input#UpdateButton[type='button']",
  messagePanel: "#MessagePanel:visible",
} as const;

export type USVisaSchedulingProfileGateCode =
  | "invalid_credentials"
  | "unsupported_country"
  | "invalid_origin_override"
  | "primary_email_missing"
  | "primary_email_ambiguous"
  | "primary_email_mismatch"
  | "profile_selector_drift"
  | "profile_option_missing"
  | "profile_fill_failed"
  | "profile_update_failed"
  | "profile_update_rejected"
  | "profile_save_unconfirmed"
  | "profile_unexpected_redirect"
  | "profile_browser_error";

export type USVisaSchedulingProfileOperation =
  | "validate"
  | "locate"
  | "fill"
  | "update"
  | "wait";

export type USVisaSchedulingProfileField =
  | "credentials"
  | "origin"
  | "primary_email"
  | "firstname"
  | "lastname"
  | "contact_email"
  | "preferred_language"
  | "country"
  | "update_button";

export interface USVisaSchedulingProfileGate {
  code: USVisaSchedulingProfileGateCode;
  operation: USVisaSchedulingProfileOperation;
  field?: USVisaSchedulingProfileField;
  reason?: "not_editable" | "readback_mismatch" | "operation_timeout" | "interaction_failed";
  message: string;
}

export type USVisaSchedulingProfileCredentials = Pick<
  AppointmentAccountCredentials,
  "email" | "givenName" | "surname"
>;

export interface USVisaSchedulingProfileSetupInput {
  page: Page;
  credentials: USVisaSchedulingProfileCredentials;
  applyingCountryCode: string;
  /**
   * Test-only loopback origin override. Production callers must omit this so
   * the helper accepts only the verified official origin.
   */
  originOverride?: string;
  timeoutMs?: number;
}

export type USVisaSchedulingProfileSetupResult =
  | {
    state: "handled";
    handled: true;
    profileSaved: false;
    evidence: "message_observed";
  }
  | {
    state: "notprofile";
    handled: false;
    profileSaved: false;
    reason: "not_profile_path";
  }
  | {
    state: "gate";
    handled: true;
    profileSaved: false;
    gate: USVisaSchedulingProfileGate;
  }
  | {
    state: "profileSaved";
    handled: true;
    profileSaved: true;
    evidence: "success_message" | "trusted_navigation";
  };

interface VisibleOption {
  value: string;
  text: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: string | null | undefined): string {
  return normalizeText(value).toLowerCase();
}

function isEmailShape(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "[::1]"
    || normalized === "::1";
}

function resolveExpectedOrigin(originOverride: string | undefined): string | null {
  if (originOverride === undefined) return US_VISA_SCHEDULING_OFFICIAL_ORIGIN;
  try {
    const parsed = new URL(originOverride);
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) {
      return null;
    }
    if (
      parsed.origin !== US_VISA_SCHEDULING_OFFICIAL_ORIGIN
      && !isLoopbackHost(parsed.hostname)
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isExactProfileUrl(value: string, expectedOrigin: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.origin === expectedOrigin
      && parsed.pathname === US_VISA_SCHEDULING_PROFILE_PATH;
  } catch {
    return false;
  }
}

function isTrustedOrigin(value: string, expectedOrigin: string): boolean {
  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function isAuthenticationPath(value: string): boolean {
  try {
    const parsed = new URL(value);
    return /(?:login|signin|sign-in|b2clogin|authorize)/i.test(parsed.pathname)
      || /b2clogin|atlasauth/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function hasRecognizedHomeEvidence(page: Page, expectedOrigin: string): Promise<boolean> {
  try {
    const current = new URL(page.url());
    if (current.origin !== expectedOrigin || current.pathname !== US_VISA_SCHEDULING_HOME_PATH) {
      return false;
    }
    const startApplication = page.locator("a#start_application:visible");
    if (await startApplication.count() !== 1) return false;
    const href = await startApplication.getAttribute("href");
    const linkText = normalizeText(await startApplication.innerText());
    if (!href || linkText.toLowerCase() !== "start application") return false;
    const target = new URL(href, expectedOrigin);
    return target.origin === expectedOrigin
      && target.pathname === US_VISA_SCHEDULING_START_APPLICATION_PATH;
  } catch {
    return false;
  }
}

function gateResult(
  code: USVisaSchedulingProfileGateCode,
  operation: USVisaSchedulingProfileOperation,
  message: string,
  field?: USVisaSchedulingProfileField,
  reason?: USVisaSchedulingProfileGate["reason"],
): USVisaSchedulingProfileSetupResult {
  return {
    state: "gate",
    handled: true,
    profileSaved: false,
    gate: { code, operation, ...(field ? { field } : {}), ...(reason ? { reason } : {}), message },
  };
}

function notProfileResult(): USVisaSchedulingProfileSetupResult {
  return {
    state: "notprofile",
    handled: false,
    profileSaved: false,
    reason: "not_profile_path",
  };
}

function profileSavedResult(
  evidence: "success_message" | "trusted_navigation",
): USVisaSchedulingProfileSetupResult {
  return {
    state: "profileSaved",
    handled: true,
    profileSaved: true,
    evidence,
  };
}

function messageIsError(message: string): boolean {
  return /cannot\s+be\s+empty|\brequired\b|\binvalid\b|\berror\b|\bfailed\b|\bfail(?:ed|ure)?\b|\bunable\b|\brejected\b|\bdenied\b|\bforbidden\b|already\s+exists|not\s+valid|must\s+be/i.test(message);
}

function messageIsSuccess(message: string): boolean {
  return /success|successfully|\bupdated\b|\bsaved\b|已更新|保存成功|更新成功/i.test(message);
}

async function readVisibleMessage(panel: Locator): Promise<string> {
  const messages = await panel.allTextContents().catch(() => []);
  return normalizeText(messages.join(" "));
}

async function readVisibleOptions(select: Locator): Promise<VisibleOption[]> {
  return select.locator("option").evaluateAll((nodes) => nodes.flatMap((node) => {
    const option = node as HTMLOptionElement;
    const style = window.getComputedStyle(option);
    if (option.hidden || option.disabled || style.display === "none" || style.visibility === "hidden") {
      return [];
    }
    return [{
      value: option.value,
      text: (option.textContent ?? "").replace(/\s+/g, " ").trim(),
    }];
  }));
}

function findOption(options: VisibleOption[], label: string): VisibleOption | null {
  const expected = normalizeText(label).toLowerCase();
  return options.find((option) => option.text.toLowerCase() === expected) ?? null;
}

async function readPrimaryEmail(
  primaryEmailLink: Locator,
): Promise<{ status: "ok"; email: string } | { status: "missing" | "ambiguous" | "invalid" }> {
  const count = await primaryEmailLink.count().catch(() => 0);
  if (count === 0) return { status: "missing" };
  if (count !== 1) return { status: "ambiguous" };
  const href = await primaryEmailLink.getAttribute("href").catch(() => null);
  const match = href?.trim().match(/^mailto:([^?]+)(?:\?.*)?$/i);
  if (!match) return { status: "invalid" };
  let email: string;
  try {
    email = normalizeEmail(decodeURIComponent(match[1]));
  } catch {
    return { status: "invalid" };
  }
  return isEmailShape(email) ? { status: "ok", email } : { status: "invalid" };
}

function selectorGate(
  field: USVisaSchedulingProfileField,
): USVisaSchedulingProfileSetupResult {
  return gateResult(
    "profile_selector_drift",
    "locate",
    "USVisaScheduling profile controls did not match the verified page contract.",
    field,
  );
}

interface ProfileFieldTarget {
  locator: Locator;
  field: USVisaSchedulingProfileField;
  value: string;
  kind: "text" | "select";
}

function fieldInteractionGate(
  field: USVisaSchedulingProfileField,
  reason: USVisaSchedulingProfileGate["reason"],
): USVisaSchedulingProfileSetupResult {
  return gateResult("profile_fill_failed", "fill", "USVisaScheduling profile field could not be verified against the bound data.", field, reason);
}

async function prepareProfileField(input: {
  target: ProfileFieldTarget;
  page: Page;
  expectedOrigin: string;
  deadline: number;
  verifyOnly?: boolean;
}): Promise<USVisaSchedulingProfileSetupResult | null> {
  const { target, page, deadline } = input;
  const timeout = () => ({ timeout: Math.max(1, Math.min(10_000, deadline - Date.now())) });
  try {
    if (page.isClosed()) return gateResult("profile_browser_error", "fill", "USVisaScheduling profile browser is unavailable.", target.field);
    if (!isExactProfileUrl(page.url(), input.expectedOrigin)) {
      return gateResult("profile_unexpected_redirect", "fill", "USVisaScheduling left the verified profile page during field preparation.", target.field);
    }
    if (Date.now() >= deadline) return fieldInteractionGate(target.field, "operation_timeout");
    // Matching existing values need no mutation, including provider-owned readonly
    // name fields. Compare exactly; a different immutable value must stop the flow.
    if (await target.locator.inputValue(timeout()) === target.value) return null;
    if (input.verifyOnly) return fieldInteractionGate(target.field, "readback_mismatch");
    const editable = target.kind === "text"
      ? await target.locator.isEditable(timeout())
      : await target.locator.isEnabled(timeout());
    if (!editable) return fieldInteractionGate(target.field, "not_editable");
    if (Date.now() >= deadline) return fieldInteractionGate(target.field, "operation_timeout");
    if (target.kind === "text") await target.locator.fill(target.value, timeout());
    else await target.locator.selectOption({ value: target.value }, timeout());
    if (!isExactProfileUrl(page.url(), input.expectedOrigin)) {
      return gateResult("profile_unexpected_redirect", "fill", "USVisaScheduling left the verified profile page during field preparation.", target.field);
    }
    if (await target.locator.inputValue(timeout()) !== target.value) return fieldInteractionGate(target.field, "readback_mismatch");
    return null;
  } catch (error: unknown) {
    if (page.isClosed()) return gateResult("profile_browser_error", "fill", "USVisaScheduling profile browser closed during field preparation.", target.field);
    if (!isExactProfileUrl(page.url(), input.expectedOrigin)) {
      return gateResult("profile_unexpected_redirect", "fill", "USVisaScheduling left the verified profile page during field preparation.", target.field);
    }
    return fieldInteractionGate(target.field, error instanceof Error && error.name === "TimeoutError" ? "operation_timeout" : "interaction_failed");
  }
}

/**
 * Fills the exact authenticated USVisaScheduling profile page observed for
 * mainland China and submits its single Update control. It never follows a
 * link, fills generic controls, touches the honeypot, or performs fee,
 * appointment, or booking actions.
 */
export async function setupUSVisaSchedulingProfile(
  input: USVisaSchedulingProfileSetupInput,
): Promise<USVisaSchedulingProfileSetupResult> {
  const expectedOrigin = resolveExpectedOrigin(input.originOverride);
  if (!expectedOrigin) {
    return gateResult(
      "invalid_origin_override",
      "validate",
      "USVisaScheduling profile setup received an invalid test origin override.",
      "origin",
    );
  }

  let currentUrl: string;
  try {
    if (input.page.isClosed()) {
      return gateResult(
        "profile_browser_error",
        "locate",
        "USVisaScheduling profile setup cannot use a closed page.",
      );
    }
    currentUrl = input.page.url();
  } catch {
    return gateResult(
      "profile_browser_error",
      "locate",
      "USVisaScheduling profile setup could not read the current page.",
    );
  }
  if (!isExactProfileUrl(currentUrl, expectedOrigin)) return notProfileResult();

  const givenName = normalizeText(input.credentials?.givenName);
  const surname = normalizeText(input.credentials?.surname);
  const accountEmail = normalizeEmail(input.credentials?.email);
  if (!givenName || !surname || !isEmailShape(accountEmail)) {
    return gateResult(
      "invalid_credentials",
      "validate",
      "USVisaScheduling profile setup requires the bound given name, surname, and account email.",
      "credentials",
    );
  }
  if (normalizeText(input.applyingCountryCode).toUpperCase() !== "CN") {
    return gateResult(
      "unsupported_country",
      "validate",
      "USVisaScheduling profile setup currently supports mainland China only.",
      "country",
    );
  }

  const firstName = input.page.locator(`${US_VISA_SCHEDULING_PROFILE_SELECTORS.firstName}:visible`);
  const surnameField = input.page.locator(`${US_VISA_SCHEDULING_PROFILE_SELECTORS.surname}:visible`);
  const primaryEmailLink = input.page.locator(US_VISA_SCHEDULING_PROFILE_SELECTORS.primaryEmailLink);
  const contactEmail = input.page.locator(`${US_VISA_SCHEDULING_PROFILE_SELECTORS.contactEmail}:visible`);
  const preferredLanguage = input.page.locator(`${US_VISA_SCHEDULING_PROFILE_SELECTORS.preferredLanguage}:visible`);
  const country = input.page.locator(`${US_VISA_SCHEDULING_PROFILE_SELECTORS.country}:visible`);
  const updateButton = input.page.locator(`${US_VISA_SCHEDULING_PROFILE_SELECTORS.updateButton}:visible`);
  const messagePanel = input.page.locator(US_VISA_SCHEDULING_PROFILE_SELECTORS.messagePanel);
  const configuredTimeout = input.timeoutMs ?? 15_000;
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.max(1_000, Math.min(configuredTimeout, 60_000)) : 15_000;

  await firstName.waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined);
  if (!isExactProfileUrl(input.page.url(), expectedOrigin)) {
    return gateResult(
      "profile_unexpected_redirect",
      "locate",
      "USVisaScheduling left the verified profile page before setup began.",
    );
  }

  const counts = await Promise.all([
    firstName.count().catch(() => 0),
    surnameField.count().catch(() => 0),
    primaryEmailLink.count().catch(() => 0),
    contactEmail.count().catch(() => 0),
    preferredLanguage.count().catch(() => 0),
    country.count().catch(() => 0),
    updateButton.count().catch(() => 0),
  ]);
  if (counts[0] !== 1) return selectorGate("firstname");
  if (counts[1] !== 1) return selectorGate("lastname");
  if (counts[2] === 0) {
    return gateResult(
      "primary_email_missing",
      "locate",
      "USVisaScheduling profile primary email link is missing.",
      "primary_email",
    );
  }
  if (counts[2] !== 1) {
    return gateResult(
      "primary_email_ambiguous",
      "locate",
      "USVisaScheduling profile has multiple visible primary email links.",
      "primary_email",
    );
  }
  if (counts[3] !== 1) return selectorGate("contact_email");
  if (counts[4] !== 1) return selectorGate("preferred_language");
  if (counts[5] !== 1) return selectorGate("country");
  if (counts[6] !== 1) return selectorGate("update_button");

  const primaryEmail = await readPrimaryEmail(primaryEmailLink);
  if (primaryEmail.status !== "ok") {
    return gateResult(
      primaryEmail.status === "ambiguous"
        ? "primary_email_ambiguous"
        : "primary_email_missing",
      "locate",
      primaryEmail.status === "ambiguous"
        ? "USVisaScheduling profile has multiple visible primary email links."
        : "USVisaScheduling profile primary email link is invalid.",
      "primary_email",
    );
  }
  if (primaryEmail.email !== accountEmail) {
    return gateResult(
      "primary_email_mismatch",
      "validate",
      "USVisaScheduling profile primary email does not match the bound account email.",
      "primary_email",
    );
  }

  const [updateEnabled, languageOptions, countryOptions] = await Promise.all([
    updateButton.isEnabled({ timeout: timeoutMs }).catch(() => false),
    readVisibleOptions(preferredLanguage).catch(() => []),
    readVisibleOptions(country).catch(() => []),
  ]);
  if (!updateEnabled) return selectorGate("update_button");
  const languageOption = findOption(languageOptions, "English");
  if (!languageOption) {
    return gateResult(
      "profile_option_missing",
      "locate",
      "USVisaScheduling profile language option English is missing.",
      "preferred_language",
    );
  }
  const countryOption = findOption(countryOptions, "China");
  if (!countryOption) {
    return gateResult(
      "profile_option_missing",
      "locate",
      "USVisaScheduling profile country option China is missing.",
      "country",
    );
  }

  if (!isExactProfileUrl(input.page.url(), expectedOrigin)) {
    return gateResult(
      "profile_unexpected_redirect",
      "fill",
      "USVisaScheduling left the verified profile page before setup fields were filled.",
    );
  }
  const targets: ProfileFieldTarget[] = [
    { locator: firstName, field: "firstname", value: givenName, kind: "text" },
    { locator: surnameField, field: "lastname", value: surname, kind: "text" },
    { locator: contactEmail, field: "contact_email", value: accountEmail, kind: "text" },
    { locator: preferredLanguage, field: "preferred_language", value: languageOption.value, kind: "select" },
    { locator: country, field: "country", value: countryOption.value, kind: "select" },
  ];
  const fillDeadline = Date.now() + timeoutMs;
  for (const target of targets) {
    const failure = await prepareProfileField({ target, page: input.page, expectedOrigin, deadline: fillDeadline });
    if (failure) return failure;
  }
  // Later change handlers can reset an earlier field; verify the complete bound
  // payload immediately before Update, without logging any actual input values.
  for (const target of targets) {
    const failure = await prepareProfileField({ target, page: input.page, expectedOrigin, deadline: fillDeadline, verifyOnly: true });
    if (failure) return failure;
  }
  if (Date.now() >= fillDeadline) return fieldInteractionGate("update_button", "operation_timeout");

  if (!isExactProfileUrl(input.page.url(), expectedOrigin)) {
    return gateResult(
      "profile_unexpected_redirect",
      "update",
      "USVisaScheduling left the verified profile page before the update action.",
    );
  }
  const initialUrl = input.page.url();
  const initialMessage = await readVisibleMessage(messagePanel);
  try {
    await updateButton.click({ timeout: Math.min(timeoutMs, 10_000) });
  } catch (error: unknown) {
    return gateResult(
      "profile_update_failed",
      "update",
      "USVisaScheduling profile update control could not be activated.",
      "update_button",
      error instanceof Error && error.name === "TimeoutError" ? "operation_timeout" : "interaction_failed",
    );
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (input.page.isClosed()) {
      return gateResult(
        "profile_browser_error",
        "wait",
        "USVisaScheduling profile update page closed before its result was confirmed.",
      );
    }
    const nextUrl = input.page.url();
    if (nextUrl !== initialUrl) {
      if (!isTrustedOrigin(nextUrl, expectedOrigin)) {
        return gateResult(
          "profile_unexpected_redirect",
          "wait",
          "USVisaScheduling profile update navigated outside the verified origin.",
        );
      }
      if (isAuthenticationPath(nextUrl)) {
        return gateResult(
          "profile_unexpected_redirect",
          "wait",
          "USVisaScheduling profile update returned to authentication before success was confirmed.",
        );
      }
      try {
        const nextPath = new URL(nextUrl).pathname;
        if (nextPath === US_VISA_SCHEDULING_PROFILE_PATH) {
          // A profile query/hash transition alone is not save evidence; keep
          // waiting for the profile message or a recognized home page.
        } else if (nextPath === US_VISA_SCHEDULING_HOME_PATH) {
          if (await hasRecognizedHomeEvidence(input.page, expectedOrigin)) {
            return profileSavedResult("trusted_navigation");
          }
        } else {
          return gateResult(
            "profile_unexpected_redirect",
            "wait",
            "USVisaScheduling profile update navigated to an unrecognized page.",
          );
        }
      } catch {
        return gateResult(
          "profile_unexpected_redirect",
          "wait",
          "USVisaScheduling profile update returned an unreadable navigation result.",
        );
      }
    }
    const message = await readVisibleMessage(messagePanel);
    if (message && message !== initialMessage) {
      if (messageIsError(message)) {
        return gateResult(
          "profile_update_rejected",
          "wait",
          "USVisaScheduling rejected the profile update; success was not confirmed.",
        );
      }
      if (messageIsSuccess(message)) return profileSavedResult("success_message");
      return {
        state: "handled",
        handled: true,
        profileSaved: false,
        evidence: "message_observed",
      };
    }
    await input.page.waitForTimeout(100).catch(() => undefined);
  }

  return gateResult(
    "profile_save_unconfirmed",
    "wait",
    "USVisaScheduling profile update did not expose a distinct success result.",
  );
}
