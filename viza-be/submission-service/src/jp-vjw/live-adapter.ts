import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { solveCaptcha } from "../captcha/index.js";
import type { RunnerExecutionContext } from "../queue/execution-context.js";
import {
  markJpVjwAccountRegistered,
  type PreparedJpVjwAccount,
} from "./account.js";
import { JpVjwPortalError } from "./errors.js";
import type { JpVjwPortalPayload, JpVjwYesNo } from "./normalize.js";
import {
  JP_VJW_ACCOUNT_CREATED_NAME,
  JP_VJW_CREATE_ACCOUNT_NAME,
  JP_VJW_GO_TO_LOGIN_NAME,
  JP_VJW_MFA_NO_NAME,
  JP_VJW_OPTIONAL_MFA_HEADING,
  JP_VJW_OPTIONAL_MFA_QUESTION,
  JP_VJW_YOUR_DETAILS_NAME,
} from "./selectors.js";

const OFFICIAL_ROOT = "https://www.vjw.digital.go.jp/";
const ROUTE_TIMEOUT_MS = 30_000;

export interface JpVjwManagedInbox {
  waitForVerification: (options: {
    applicantId: string;
    alias: string;
    since: string;
  }) => Promise<{ url?: string; code?: string }>;
}

export interface JpVjwLiveAdapterContext {
  page: Page;
  payload: JpVjwPortalPayload;
  account: PreparedJpVjwAccount;
  applicantId: string;
  inbox: JpVjwManagedInbox;
  logs: string[];
  screenshots: string[];
  qrCodes: string[];
  executionContext?: RunnerExecutionContext;
}

export interface JpVjwLiveAdapterResult {
  portalUrl: string;
  referenceNumber: null;
  submittedAt: string;
  qrArtifactPath: string;
  bodyText: string;
}

type HcaptchaBrowserWindow = typeof window & {
  __vizaHcaptchaOptions?: Record<string, unknown>;
  hcaptcha?: Record<string, unknown>;
};

function currentRoute(page: Page): string {
  return new URL(page.url()).hash.toLowerCase();
}

function normalizeOptionText(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").toUpperCase();
}

async function capturePage(context: JpVjwLiveAdapterContext, name: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "viza-jp-vjw-live-"));
  const filePath = path.join(directory, `${name}-${Date.now()}.png`);
  await context.page.screenshot({ path: filePath, fullPage: true });
  context.screenshots.push(filePath);
  return filePath;
}

async function fail(
  context: JpVjwLiveAdapterContext,
  code: string,
  message: string,
): Promise<never> {
  await capturePage(context, code).catch(() => undefined);
  throw new JpVjwPortalError(message, {
    code,
    screenshotPaths: context.screenshots,
    logs: context.logs,
  });
}

async function installHcaptchaCallbackCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const browserWindow = window as HcaptchaBrowserWindow;
    let captured: Record<string, unknown> | undefined;
    Object.defineProperty(browserWindow, "hcaptcha", {
      configurable: true,
      get: () => captured,
      set: (rawValue: unknown) => {
        if (!rawValue || typeof rawValue !== "object") {
          captured = undefined;
          return;
        }
        const value = rawValue as Record<string, unknown>;
        if (typeof value.render === "function" && value.__vizaWrapped !== true) {
          const originalRender = value.render.bind(value) as (
            container: unknown,
            options: Record<string, unknown>,
          ) => unknown;
          value.render = (container: unknown, options: Record<string, unknown>) => {
            browserWindow.__vizaHcaptchaOptions = options;
            return originalRender(container, options);
          };
          value.__vizaWrapped = true;
        }
        captured = value;
      },
    });
  });
}

async function solveRegistrationHcaptcha(context: JpVjwLiveAdapterContext): Promise<void> {
  const iframe = context.page.locator("iframe[src*='hcaptcha.com/captcha']").first();
  const src = await iframe.getAttribute("src").catch(() => null);
  const siteKey = src ? new URL(src).hash.match(/(?:^|&)sitekey=([^&]+)/u)?.[1] : null;
  if (!siteKey) {
    return await fail(context, "jp_vjw_hcaptcha_sitekey_missing", "Visit Japan Web hCaptcha site key was not readable.");
  }
  const solved = await solveCaptcha({
    type: "hcaptcha",
    siteKey: decodeURIComponent(siteKey),
    pageUrl: context.page.url(),
  });
  const callbackInvoked = await context.page.evaluate((token) => {
    const browserWindow = window as HcaptchaBrowserWindow;
    for (const element of Array.from(document.querySelectorAll(
      "textarea[name='h-captcha-response'], textarea[name='g-recaptcha-response']",
    ))) {
      const response = element as HTMLTextAreaElement;
      response.value = token;
      response.dispatchEvent(new Event("input", { bubbles: true }));
      response.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const callback = browserWindow.__vizaHcaptchaOptions?.callback;
    if (typeof callback !== "function") return false;
    callback(token);
    return true;
  }, solved.text);
  if (!callbackInvoked) {
    await fail(context, "jp_vjw_hcaptcha_callback_missing", "Visit Japan Web hCaptcha callback was not captured.");
  }
  context.logs.push(`jpvjw_hcaptcha_solved solve_id=${solved.solveId}`);
}

async function waitForRoute(context: JpVjwLiveAdapterContext, routes: string[]): Promise<string> {
  try {
    await context.page.waitForFunction(
      (expected) => expected.some((route) => window.location.hash.toLowerCase().includes(route)),
      routes.map((route) => route.toLowerCase()),
      { timeout: ROUTE_TIMEOUT_MS },
    );
  } catch {
    await fail(
      context,
      "jp_vjw_unexpected_route",
      `Visit Japan Web did not reach the expected route (${routes.join(" or ")}).`,
    );
  }
  return currentRoute(context.page);
}

async function navigateRoute(context: JpVjwLiveAdapterContext, route: string): Promise<void> {
  context.executionContext?.assertOwned();
  await context.page.evaluate((target) => {
    window.location.hash = `#/${target}`;
  }, route);
  await waitForRoute(context, [route]);
  await context.page.locator("main").waitFor({ state: "visible", timeout: ROUTE_TIMEOUT_MS });
}

async function primaryButton(page: Page): Promise<Locator> {
  const selectors = [
    "form#form input[type='submit']",
    "form#form button[type='submit']",
    "footer .button-primary",
    "input.button-primary",
    "button.button-primary",
  ];
  for (const selector of selectors) {
    const candidate = page.locator(selector).filter({ visible: true }).last();
    if (await candidate.count()) return candidate;
  }
  return page.getByRole("button", { name: /下一步|登记|提交|确认|Next|Register|Submit|Confirm/i }).last();
}

async function clickPrimary(context: JpVjwLiveAdapterContext, owned = false): Promise<void> {
  if (owned) context.executionContext?.assertOwned();
  const button = await primaryButton(context.page);
  await button.scrollIntoViewIfNeeded();
  if (await button.isDisabled().catch(() => false)) {
    await fail(context, "jp_vjw_primary_action_disabled", "Visit Japan Web primary action remained disabled.");
  }
  await button.click();
}

async function fillControl(context: JpVjwLiveAdapterContext, name: string, value: string): Promise<void> {
  const control = context.page.locator(`[formcontrolname='${name}']`).first();
  if (!(await control.count())) {
    await fail(context, "jp_vjw_control_missing", `Visit Japan Web control ${name} was not found.`);
  }
  await control.fill(value);
}

export async function fillJpVjwVerificationCode(page: Page, code: string): Promise<boolean> {
  if (!/^\d{6}$/u.test(code)) return false;
  const otpInputs = page.locator("ng-otp-input input");
  if ((await otpInputs.count()) !== 6) return false;

  // ng-otp-input keeps its own Angular state and advances focus from one box
  // to the next on keyboard events. locator.fill() updates the visible DOM
  // value, but the production widget can still report every box as required.
  await otpInputs.first().click();
  await page.keyboard.type(code, { delay: 75 });

  let entered = await otpInputs.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value).join(""),
  );
  if (entered !== code) {
    for (let index = 0; index < 6; index += 1) {
      const input = otpInputs.nth(index);
      await input.click();
      await input.press("ControlOrMeta+A");
      await input.press(code[index]);
    }
    entered = await otpInputs.evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value).join(""),
    );
  }
  await otpInputs.last().press("Tab");
  return entered === code;
}

async function selectNative(
  context: JpVjwLiveAdapterContext,
  name: string,
  wanted: string,
  aliases: string[] = [],
): Promise<void> {
  const select = context.page.locator(`select[formcontrolname='${name}']`).first();
  if (!(await select.count())) {
    await fail(context, "jp_vjw_select_missing", `Visit Japan Web select ${name} was not found.`);
  }
  const candidates = [wanted, ...aliases].map(normalizeOptionText).filter(Boolean);
  const optionValue = await select.evaluate((element, normalizedCandidates) => {
    const htmlSelect = element as HTMLSelectElement;
    const options = Array.from(htmlSelect.options);
    const normalize = (value: string) => value.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").toUpperCase();
    const match = options.find((option) => {
      const label = normalize(option.textContent ?? "");
      const value = normalize(option.value);
      return normalizedCandidates.some((candidate) =>
        candidate === value || candidate === label || label.includes(candidate) || candidate.includes(label),
      );
    });
    return match?.value ?? null;
  }, candidates);
  if (!optionValue) {
    await fail(context, "jp_vjw_option_not_found", `Visit Japan Web option for ${name} could not be resolved.`);
  }
  await select.selectOption(optionValue);
}

async function setRadio(
  context: JpVjwLiveAdapterContext,
  name: string,
  answer: JpVjwYesNo,
): Promise<void> {
  let inputs = context.page.locator(`[formname='${name}'] input[type='radio']`);
  if ((await inputs.count()) < 2) {
    inputs = context.page.locator(`input[type='radio'][formcontrolname='${name}']`);
  }
  if ((await inputs.count()) < 2) {
    await fail(context, "jp_vjw_radio_missing", `Visit Japan Web radio ${name} was not found.`);
  }
  const input = inputs.nth(answer === "yes" ? 0 : 1);
  const id = await input.getAttribute("id");
  const label = id ? context.page.locator(`label[for='${id}']`).first() : null;
  if (label && await label.count()) await label.click();
  else await input.click({ force: true });
}

async function fillDateParts(
  context: JpVjwLiveAdapterContext,
  prefix: "dateOfBirth" | "dateOfExpiry",
  isoDate: string,
): Promise<void> {
  const [year, month, day] = isoDate.split("-");
  await selectNative(context, `${prefix}Year`, year);
  await selectNative(context, `${prefix}Month`, month, [String(Number(month))]);
  await selectNative(context, `${prefix}Day`, day, [String(Number(day))]);
}

function occupationCode(value: string): string {
  const normalized = value.normalize("NFKC").toLowerCase();
  if (/^\d{4}$/u.test(normalized)) return normalized;
  if (/student|学生/u.test(normalized)) return "0800";
  if (/unemployed|无业|無職/u.test(normalized)) return "0900";
  if (/doctor|physician|医生|醫生/u.test(normalized)) return "0600";
  if (/teacher|professor|教师|教員/u.test(normalized)) return "0700";
  if (/public servant|civil servant|公务员|公務員/u.test(normalized)) return "0300";
  if (/self.?employed|business owner|个体|自雇|自營/u.test(normalized)) return "0500";
  if (/president|executive|director|总经理|董事/u.test(normalized)) return "0200";
  if (/employee|engineer|developer|manager|公司职员|工程师|職員/u.test(normalized)) return "0100";
  return "0990";
}

function sexAliases(value: string): string[] {
  return /^m(?:ale)?$/iu.test(value) ? ["男", "Male", "M"] : /^f(?:emale)?$/iu.test(value) ? ["女", "Female", "F"] : ["其他", "Other"];
}

async function chooseAutocomplete(
  context: JpVjwLiveAdapterContext,
  input: Locator,
  wanted: string,
  label: string,
): Promise<void> {
  await input.fill(wanted);
  const options = context.page.locator("mat-option, [role='option']").filter({ visible: true });
  await options.first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
  const wantedNormalized = normalizeOptionText(wanted);
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index);
    const text = normalizeOptionText(await option.innerText().catch(() => ""));
    if (text.includes(wantedNormalized) || wantedNormalized.includes(text)) {
      await option.click();
      return;
    }
  }
  if (count === 1) {
    await options.first().click();
    return;
  }
  await fail(context, "jp_vjw_autocomplete_option_missing", `Visit Japan Web ${label} option could not be resolved.`);
}

async function registerAccount(context: JpVjwLiveAdapterContext): Promise<void> {
  const page = context.page;
  const create = page.getByRole("button", { name: JP_VJW_CREATE_ACCOUNT_NAME }).first();
  if (!(await create.isVisible().catch(() => false))) {
    await fail(context, "jp_vjw_create_account_missing", "Visit Japan Web create-account action was not visible.");
  }
  await create.click();
  await waitForRoute(context, ["vjwplo004"]);
  for (const name of [/同意.*使用协议|Agree.*Terms/i, /同意.*隐私政策|Agree.*Privacy/i]) {
    const checkbox = page.getByRole("checkbox", { name }).first();
    const checkboxId = await checkbox.getAttribute("id");
    const label = checkboxId ? page.locator(`label[for='${checkboxId}']`).first() : null;
    if (label && await label.count()) await label.click();
    else await checkbox.check({ force: true });
  }
  await clickPrimary(context);
  await waitForRoute(context, ["vjwplo002"]);
  await fillControl(context, "tmpEmail", context.account.email);
  await fillControl(context, "password", context.account.password);
  await fillControl(context, "passwordConfirm", context.account.password);
  await solveRegistrationHcaptcha(context);
  const sentAt = new Date().toISOString();
  await clickPrimary(context, true);
  await waitForRoute(context, ["vjwplo003"]);
  const verification = await context.inbox.waitForVerification({
    applicantId: context.applicantId,
    alias: context.account.email,
    since: sentAt,
  });
  if (!verification.code || !/^\d{6}$/u.test(verification.code)) {
    return await fail(context, "jp_vjw_verification_code_missing", "Visit Japan Web six-digit verification code was not received.");
  }
  const otpInputs = page.locator("ng-otp-input input");
  if ((await otpInputs.count()) !== 6) {
    return await fail(context, "jp_vjw_verification_inputs_missing", "Visit Japan Web six-digit verification inputs were not found.");
  }
  if (!(await fillJpVjwVerificationCode(page, verification.code))) {
    return await fail(context, "jp_vjw_verification_input_rejected", "Visit Japan Web did not accept the six-digit verification code input.");
  }
  await clickPrimary(context, true);
  const completedMessage = page.getByText(JP_VJW_ACCOUNT_CREATED_NAME).first();
  await completedMessage.waitFor({ state: "visible", timeout: ROUTE_TIMEOUT_MS }).catch(async () => {
    await fail(context, "jp_vjw_account_verification_failed", "Visit Japan Web did not confirm account creation.");
  });
  const loginScreenButton = page.getByRole("button", { name: JP_VJW_GO_TO_LOGIN_NAME }).first();
  if (!(await loginScreenButton.isVisible().catch(() => false))) {
    return await fail(context, "jp_vjw_login_screen_action_missing", "Visit Japan Web account creation succeeded, but the login-screen action was not visible.");
  }
  await loginScreenButton.click();
  await waitForRoute(context, ["vjwplo001"]);
  await markJpVjwAccountRegistered({
    applicantId: context.applicantId,
    correlationId: context.payload.applicationId,
  });
  context.logs.push("jpvjw_account_registered");
}

async function tryLogin(context: JpVjwLiveAdapterContext): Promise<boolean> {
  if (!currentRoute(context.page).includes("vjwplo001")) return true;
  await fillControl(context, "email", context.account.email).catch(async () => {
    const email = context.page.locator("input[type='email']").first();
    await email.fill(context.account.email);
  });
  await fillControl(context, "password", context.account.password);
  await clickPrimary(context, true);
  await context.page.waitForTimeout(2_500);
  return !currentRoute(context.page).includes("vjwplo001");
}

async function skipOptionalMfa(context: JpVjwLiveAdapterContext): Promise<void> {
  const heading = context.page.getByText(JP_VJW_OPTIONAL_MFA_HEADING).first();
  const question = context.page.getByText(JP_VJW_OPTIONAL_MFA_QUESTION).first();
  const dashboard = context.page.getByText(JP_VJW_YOUR_DETAILS_NAME).first();
  let landing: "mfa" | "dashboard" | null = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const questionVisible = await question.isVisible().catch(() => false);
    if (questionVisible && await heading.isVisible().catch(() => false)) {
      landing = "mfa";
      break;
    }
    if (await dashboard.isVisible().catch(() => false)) {
      landing = "dashboard";
      break;
    }
    await context.page.waitForTimeout(250);
  }
  if (landing !== "mfa") return;

  // The MFA page can finish an asynchronous transition after its heading was
  // observed. Never let a stale MFA decision select a later profile radio.
  if (!(await question.isVisible().catch(() => false))) return;

  const no = context.page.getByRole("radio", { name: JP_VJW_MFA_NO_NAME }).first();
  if (!(await no.isVisible().catch(() => false))) {
    return await fail(context, "jp_vjw_optional_mfa_no_missing", "Visit Japan Web optional MFA opt-out was not visible.");
  }
  const noId = await no.getAttribute("id");
  const noLabel = noId ? context.page.locator(`label[for='${noId}']`).first() : null;
  if (noLabel && await noLabel.isVisible().catch(() => false)) await noLabel.click();
  else await no.check({ force: true });
  if (!(await no.isChecked().catch(() => false))) {
    return await fail(context, "jp_vjw_optional_mfa_no_unchecked", "Visit Japan Web optional MFA opt-out did not remain selected.");
  }
  await clickPrimary(context, true);
  await dashboard
    .waitFor({ state: "visible", timeout: ROUTE_TIMEOUT_MS })
    .catch(async () => {
      await fail(context, "jp_vjw_optional_mfa_exit_failed", "Visit Japan Web did not leave the optional MFA setup page.");
    });
  context.logs.push("jpvjw_optional_mfa_skipped");
}

async function ensureAuthenticated(context: JpVjwLiveAdapterContext): Promise<void> {
  await installHcaptchaCallbackCapture(context.page);
  await context.page.goto(OFFICIAL_ROOT, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await context.page.locator("main").waitFor({ state: "visible", timeout: ROUTE_TIMEOUT_MS });
  if (!currentRoute(context.page).includes("vjwplo001")) return;
  if (context.account.reuseExistingAccount && await tryLogin(context)) {
    if (context.account.registrationState !== "registered") {
      await markJpVjwAccountRegistered({
        applicantId: context.applicantId,
        correlationId: context.payload.applicationId,
      });
    }
    await skipOptionalMfa(context);
    context.logs.push("jpvjw_account_login_reused");
    return;
  }
  if (context.account.reuseExistingAccount) {
    await context.page.goto(OFFICIAL_ROOT, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
  await registerAccount(context);
  if (currentRoute(context.page).includes("vjwplo001") && !(await tryLogin(context))) {
    await fail(context, "jp_vjw_login_failed", "Visit Japan Web rejected the managed account login.");
  }
  await skipOptionalMfa(context);
  context.logs.push("jpvjw_authenticated");
}

async function openProfileRegistration(context: JpVjwLiveAdapterContext): Promise<void> {
  const profileControl = context.page.locator("[formcontrolname='hasJapanesePassport']").first();
  if (await profileControl.isVisible().catch(() => false)) return;

  let action = context.page.getByRole("button", { name: JP_VJW_YOUR_DETAILS_NAME }).first();
  if (!(await action.isVisible().catch(() => false))) {
    action = context.page.getByText(JP_VJW_YOUR_DETAILS_NAME).first();
  }
  if (!(await action.isVisible().catch(() => false))) {
    return await fail(context, "jp_vjw_profile_entry_missing", "Visit Japan Web user-details action was not visible.");
  }
  await action.click();
  await profileControl.waitFor({ state: "visible", timeout: ROUTE_TIMEOUT_MS }).catch(async () => {
    await fail(context, "jp_vjw_profile_form_missing", "Visit Japan Web did not open the user-details form.");
  });
}

async function registerProfile(context: JpVjwLiveAdapterContext): Promise<void> {
  await openProfileRegistration(context);
  await setRadio(context, "hasJapanesePassport", "no");
  await setRadio(context, "hasReentryPermission", "no");
  await setRadio(context, "isTaxExemptionEnabled", "no");
  await clickPrimary(context);
  await waitForRoute(context, ["vjwppr002"]);
  const methods = context.page.locator("input[type='radio'][formcontrolname='regType']");
  if ((await methods.count()) < 2) await fail(context, "jp_vjw_manual_passport_option_missing", "Manual passport entry option was not found.");
  await methods.nth(1).click({ force: true });
  await clickPrimary(context);
  await waitForRoute(context, ["vjwppr005"]);
  await fillControl(context, "passportNumber", context.payload.passportNumber.toUpperCase());
  await fillControl(context, "familyName", context.payload.surname.toUpperCase());
  await fillControl(context, "givenName", context.payload.givenNames.toUpperCase());
  await selectNative(context, "nationality", context.payload.nationality, ["CHN", "China", "中国"]);
  await fillDateParts(context, "dateOfBirth", context.payload.dateOfBirth);
  await selectNative(context, "sex", context.payload.sex, sexAliases(context.payload.sex));
  await fillDateParts(context, "dateOfExpiry", context.payload.passportExpiryDate);
  const optionalOccupation = context.page.locator("select[formcontrolname='occupation']").first();
  if (await optionalOccupation.count()) await selectNative(context, "occupation", occupationCode(context.payload.occupation));
  const profileCountry = context.page.locator("input[formcontrolname='countryName']").first();
  if (await profileCountry.count()) await profileCountry.fill(context.payload.residenceCountry.toUpperCase());
  const profileCity = context.page.locator("input[formcontrolname='cityName']").first();
  if (await profileCity.count()) await profileCity.fill(context.payload.residenceCity.toUpperCase());
  await clickPrimary(context, true);
  const next = await waitForRoute(context, ["vjwppr008", "vjwppr009"]);
  if (next.includes("vjwppr008")) {
    await clickPrimary(context);
    await waitForRoute(context, ["vjwppr009"]);
  }
  await clickPrimary(context, true);
  await context.page.locator("app-vjwppr010").first().waitFor({
    state: "visible",
    timeout: ROUTE_TIMEOUT_MS,
  }).catch(async () => {
    await fail(context, "jp_vjw_profile_save_unconfirmed", "Visit Japan Web did not confirm the traveller profile save.");
  });
  context.logs.push("jpvjw_profile_registered");
}

async function fillJapanAddress(context: JpVjwLiveAdapterContext, route: "vjwpti002" | "vjwpic021"): Promise<void> {
  const postalControl = route === "vjwpti002" ? "postalCode" : "postalCode";
  await fillControl(context, postalControl, context.payload.accommodationPostalCode.replace(/-/gu, ""));
  const autoButton = context.page.getByRole("button", { name: /邮政编码.*自动|郵便番号.*自動|postal code/i }).first();
  if (await autoButton.isVisible().catch(() => false)) {
    await autoButton.click();
    await context.page.waitForTimeout(600);
  }
  await fillControl(context, "address", context.payload.accommodationAddress.toUpperCase());
  const nameControl = route === "vjwpti002" ? "placeOfStay" : "optionalAddress";
  await fillControl(context, nameControl, context.payload.accommodationName.toUpperCase());
  const phoneControl = route === "vjwpti002" ? "telephoneNumberInJapan" : "telephone";
  await fillControl(context, phoneControl, context.payload.accommodationPhone.replace(/[^0-9]/gu, ""));
}

async function openExistingTrip(context: JpVjwLiveAdapterContext, title: string): Promise<boolean> {
  const titleLink = context.page.getByText(title, { exact: true }).first();
  if (!(await titleLink.isVisible().catch(() => false))) return false;
  await titleLink.click();
  await waitForRoute(context, ["vjwpti006"]);
  context.logs.push("jpvjw_existing_trip_reused");
  return true;
}

async function registerTrip(context: JpVjwLiveAdapterContext, title: string): Promise<void> {
  await navigateRoute(context, "vjwpti001");
  await fillControl(context, "travelTitle", title);
  await fillControl(context, "arrivalSheduleDate", context.payload.arrivalDate);
  const airlineCode = context.payload.arrivalAirline.trim().toUpperCase().match(/^[A-Z0-9]{2}/u)?.[0]
    ?? context.payload.arrivalAirline.trim();
  await selectNative(context, "airlineCompany", airlineCode, [context.payload.arrivalAirline]);
  await fillControl(context, "flightNumber", context.payload.flightNumber);
  const departure = context.page.locator("#textboxDeparture").first();
  if (!(await departure.count())) await fail(context, "jp_vjw_departure_autocomplete_missing", "Departure-point autocomplete was not found.");
  await chooseAutocomplete(context, departure, context.payload.departureCityOrPort.toUpperCase(), "departure point");
  await clickPrimary(context);
  await waitForRoute(context, ["vjwpti002"]);
  await fillJapanAddress(context, "vjwpti002");
  await clickPrimary(context);
  await waitForRoute(context, ["vjwpti004"]);
  await clickPrimary(context, true);
  await context.page.locator("app-vjwpti005").first().waitFor({
    state: "visible",
    timeout: ROUTE_TIMEOUT_MS,
  }).catch(async () => {
    await fail(context, "jp_vjw_trip_save_unconfirmed", "Visit Japan Web did not confirm the trip save.");
  });
  await navigateRoute(context, "vjwpti006");
  context.logs.push("jpvjw_trip_registered");
}

async function clickImmigrationAndCustoms(context: JpVjwLiveAdapterContext): Promise<void> {
  const action = context.page.getByRole("button", { name: /入境审查.*海关申报|入国.*税関申告|Immigration.*Customs/i }).first();
  if (!(await action.isVisible().catch(() => false))) {
    await fail(context, "jp_vjw_immigration_customs_action_missing", "Immigration and customs action was not visible on the trip dashboard.");
  }
  await action.click();
  await waitForRoute(context, ["vjwpic004"]);
}

function assertSupportedCustomsPath(context: JpVjwLiveAdapterContext): void {
  const values = Object.entries(context.payload.customsAnswers)
    .filter(([key]) => key !== "declarationConfirmed")
    .map(([, value]) => value);
  if (values.some((value) => value === "yes")) {
    throw new JpVjwPortalError(
      "Visit Japan Web affirmative customs detail branches require additional item-level answers.",
      {
        code: "jp_vjw_affirmative_customs_details_required",
        screenshotPaths: context.screenshots,
        logs: context.logs,
      },
    );
  }
}

async function completeImmigrationAndCustoms(context: JpVjwLiveAdapterContext): Promise<string> {
  assertSupportedCustomsPath(context);
  await selectNative(context, "occupation", occupationCode(context.payload.occupation));
  await fillControl(context, "countryName", context.payload.residenceCountry.toUpperCase());
  await fillControl(context, "cityName", context.payload.residenceCity.toUpperCase());
  await fillControl(context, "immigrationDate", context.payload.arrivalDate);
  await fillControl(context, "flightNo", `${context.payload.arrivalAirline}${context.payload.flightNumber}`.replace(/\s+/gu, ""));
  const departure = context.page.locator("#textboxDeparture").first();
  await chooseAutocomplete(context, departure, context.payload.departureCityOrPort.toUpperCase(), "departure point");
  await clickPrimary(context);
  const afterBasic = await waitForRoute(context, ["vjwpic021", "vjwpic043"]);
  if (afterBasic.includes("vjwpic043")) {
    await setRadio(context, "answer", "no");
    await clickPrimary(context);
    await waitForRoute(context, ["vjwpic021"]);
  }
  await fillJapanAddress(context, "vjwpic021");
  await clickPrimary(context);
  await waitForRoute(context, ["vjwpic005"]);
  await selectNative(context, "purposeOfTravel", context.payload.purposeOfVisit, ["0", "Tourism", "旅游"]);
  const years = context.page.locator("[formcontrolname='durationStayYears']").first();
  if (await years.count()) await years.fill("0");
  const months = context.page.locator("[formcontrolname='durationStayMonths']").first();
  if (await months.count()) await months.fill("0");
  await fillControl(context, "durationStayDays", String(context.payload.plannedStayDays));
  await clickPrimary(context);
  await waitForRoute(context, ["vjwpic006"]);
  await setRadio(context, "question01", context.payload.immigrationAnswers.hasBeenDeported);
  await setRadio(context, "question02", context.payload.immigrationAnswers.hasCriminalRecord);
  await setRadio(context, "question03", context.payload.immigrationAnswers.hasControlledSubstancesOrWeapons);
  await clickPrimary(context);
  await waitForRoute(context, ["vjwpic009"]);
  const pages: Array<{ route: string; control: string; answer: JpVjwYesNo; next: string }> = [
    { route: "vjwpic009", control: "answer", answer: context.payload.customsAnswers.hasProhibitedGoods, next: "vjwpic010" },
    { route: "vjwpic010", control: "answer", answer: context.payload.customsAnswers.hasRestrictedGoods, next: "vjwpic011" },
    { route: "vjwpic011", control: "answer", answer: context.payload.customsAnswers.hasGoldOrGoldProducts, next: "vjwpic012" },
    { route: "vjwpic012", control: "answer", answer: context.payload.customsAnswers.hasDutiableGoods, next: "vjwpic046" },
  ];
  for (const step of pages) {
    if (!currentRoute(context.page).includes(step.route)) await waitForRoute(context, [step.route]);
    await setRadio(context, step.control, step.answer);
    await clickPrimary(context);
    await waitForRoute(context, [step.next]);
  }
  await setRadio(context, "answer01", context.payload.customsAnswers.hasCommercialGoods);
  await setRadio(context, "answer02", context.payload.customsAnswers.hasGoodsForOtherPerson);
  await setRadio(context, "answer03", context.payload.customsAnswers.hasCashOrValuablesOverThreshold);
  await setRadio(context, "answer04", context.payload.customsAnswers.hasUnaccompaniedBaggage);
  await clickPrimary(context);
  await waitForRoute(context, ["vjwpic019"]);
  const confirmation = context.page.locator("input[formcontrolname='confirmChk']").first();
  if (!(await confirmation.count())) await fail(context, "jp_vjw_final_confirmation_missing", "Final Visit Japan Web declaration confirmation was not found.");
  const confirmationId = await confirmation.getAttribute("id");
  const confirmationLabel = confirmationId ? context.page.locator(`label[for='${confirmationId}']`).first() : null;
  if (confirmationLabel && await confirmationLabel.count()) await confirmationLabel.click();
  else await confirmation.check({ force: true });
  context.executionContext?.assertOwned();
  const submittedAt = new Date().toISOString();
  await clickPrimary(context, true);
  await context.page.locator("app-vjwpic022").first().waitFor({
    state: "visible",
    timeout: ROUTE_TIMEOUT_MS,
  }).catch(async () => {
    await fail(context, "jp_vjw_definitive_save_unconfirmed", "Visit Japan Web did not confirm the definitive declaration save.");
  });
  const qrAction = context.page.getByRole("button", { name: /显示QR码|顯示QR碼|QRコードを表示|Display QR/i }).first();
  if (await qrAction.isVisible().catch(() => false)) await qrAction.click();
  else {
    const qrLink = context.page.getByText(/显示QR码|QRコードを表示|Display QR/i).first();
    if (await qrLink.isVisible().catch(() => false)) await qrLink.click();
  }
  await waitForRoute(context, ["vjwpic026"]);
  return submittedAt;
}

async function captureQr(context: JpVjwLiveAdapterContext): Promise<string> {
  const qr = context.page.locator("qrcode img, .viewer-qrcode img, .qrcode img").first();
  await qr.waitFor({ state: "visible", timeout: ROUTE_TIMEOUT_MS }).catch(async () => {
    await fail(context, "jp_vjw_qr_element_missing", "Official Visit Japan Web QR element was not visible.");
  });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "viza-jp-vjw-qr-"));
  const filePath = path.join(directory, `official-qr-${Date.now()}.png`);
  await qr.screenshot({ path: filePath });
  context.qrCodes.push(filePath);
  return filePath;
}

export async function submitJpVjwLive(context: JpVjwLiveAdapterContext): Promise<JpVjwLiveAdapterResult> {
  context.executionContext?.assertOwned();
  await ensureAuthenticated(context);
  const title = `VIZA-${context.payload.applicationId.slice(0, 8).toUpperCase()}`;
  const existingTrip = await openExistingTrip(context, title);
  if (!existingTrip) {
    await registerProfile(context);
    await navigateRoute(context, "vjwpco001");
    if (!(await openExistingTrip(context, title))) await registerTrip(context, title);
  }
  const existingQr = context.page.getByRole("button", { name: /显示QR码|QRコードを表示|Display QR/i }).first();
  let submittedAt = new Date().toISOString();
  if (await existingQr.isVisible().catch(() => false)) {
    await existingQr.click();
    await waitForRoute(context, ["vjwpic026"]);
    context.logs.push("jpvjw_existing_official_qr_reused");
  } else {
    await clickImmigrationAndCustoms(context);
    submittedAt = await completeImmigrationAndCustoms(context);
  }
  const qrArtifactPath = await captureQr(context);
  const bodyText = (await context.page.locator("body").innerText()).replace(/\s+/gu, " ").trim().slice(0, 2_000);
  context.logs.push("jpvjw_official_qr_captured");
  return {
    portalUrl: context.page.url(),
    referenceNumber: null,
    submittedAt,
    qrArtifactPath,
    bodyText,
  };
}
