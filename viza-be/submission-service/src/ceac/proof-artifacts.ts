import type { Locator, Page } from "@playwright/test";
import type { UsSubmissionResult } from "../submission-result";
import { assertCeacPostbackHealthy, waitForAspNetPostbackStable } from "./aspnet";
import { assertNoGate } from "./gates";
import { isOfficialDs160ConfirmationPage } from "./pages";

export type Ds160ProofStoragePaths = {
  confirmationPdfStoragePath?: string;
  applicationPdfStoragePath?: string;
  emailConfirmationPdfStoragePath?: string;
};

const LANGUAGE_SELECTORS = [
  "#ctl00_ddlLanguage",
  'select[id$="_ddlLanguage"]',
  'select[name$="$ddlLanguage"]',
  'select[id*="Language" i]',
];

const PRINT_CONFIRMATION_SELECTORS = [
  "#ctl00_SiteContentPlaceHolder_FormView1_btnPrintConfirm",
  'input[type="submit"][value*="Print Confirmation" i]',
  'input[type="button"][value*="Print Confirmation" i]',
  'button:has-text("Print Confirmation")',
  'a:has-text("Print Confirmation")',
];

const ENGLISH_UI_MARKER = /(?:online nonimmigrant visa application|print confirmation|print application|email confirmation)/i;
const CHINESE_UI_MARKER = /(?:打印确认|打印申请|电子邮件确认|选择语言|确认页)/;

export class Ds160EnglishConfirmationError extends Error {
  readonly code = "ds160_english_confirmation_required" as const;

  constructor(message: string) {
    super(message);
    this.name = "Ds160EnglishConfirmationError";
  }
}

type LanguageOption = { label: string; value: string };

function visibleSelectorGroup(selectors: readonly string[]): string {
  return selectors.map(selector => `${selector}:visible`).join(", ");
}

async function uniqueVisibleControl(page: Page, selectors: readonly string[], label: string): Promise<Locator> {
  const locator = page.locator(visibleSelectorGroup(selectors));
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    throw new Ds160EnglishConfirmationError(`CEAC submitted confirmation ${label} control was not found.`);
  }
  if (count > 1) {
    throw new Ds160EnglishConfirmationError(`CEAC submitted confirmation ${label} control is ambiguous.`);
  }
  return locator.first();
}

async function readLanguageOptions(language: Locator): Promise<LanguageOption[]> {
  return language.locator("option").evaluateAll((options) => options.map((option) => ({
    label: (option.textContent ?? "").trim(),
    value: (option as HTMLOptionElement).value.trim(),
  })));
}

function isEnglishOption(option: LanguageOption): boolean {
  const label = option.label.trim().toLowerCase();
  const value = option.value.trim().toLowerCase();
  return label === "english" || value === "en-us" || value === "en";
}

async function readSelectedLanguage(language: Locator): Promise<LanguageOption> {
  return language.evaluate((element) => {
    const select = element as HTMLSelectElement;
    const option = select.selectedOptions[0];
    return {
      label: (option?.textContent ?? "").trim(),
      value: select.value.trim(),
    };
  });
}

async function assertEnglishConfirmationReadback(page: Page, expectedApplicationId: string): Promise<void> {
  const language = await uniqueVisibleControl(page, LANGUAGE_SELECTORS, "language");
  const selected = await readSelectedLanguage(language);
  if (!isEnglishOption(selected)) {
    throw new Ds160EnglishConfirmationError("CEAC confirmation language did not settle to English.");
  }
  assertCeacPostbackHealthy(page);
  await assertNoGate(page);
  if (!(await isOfficialDs160ConfirmationPage(page, expectedApplicationId))) {
    throw new Ds160EnglishConfirmationError("CEAC English confirmation page identity could not be verified.");
  }
  const body = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (!ENGLISH_UI_MARKER.test(body) || CHINESE_UI_MARKER.test(body)) {
    throw new Ds160EnglishConfirmationError("CEAC confirmation page did not expose the English UI after language selection.");
  }
}

/**
 * Select CEAC's own English confirmation language and verify the resulting
 * official page. This only changes the portal display language; it never
 * signs, submits, emails, or creates an application.
 */
export async function ensureEnglishDs160Confirmation(
  page: Page,
  expectedApplicationId: string,
): Promise<void> {
  if (!expectedApplicationId.trim()) {
    throw new Ds160EnglishConfirmationError("CEAC English confirmation requires the observed Application ID.");
  }
  assertCeacPostbackHealthy(page);
  await assertNoGate(page);
  if (!(await isOfficialDs160ConfirmationPage(page, expectedApplicationId))) {
    throw new Ds160EnglishConfirmationError("CEAC submitted confirmation page identity could not be verified.");
  }

  const language = await uniqueVisibleControl(page, LANGUAGE_SELECTORS, "language");
  const options = await readLanguageOptions(language);
  const englishOptions = options.filter(isEnglishOption);
  if (englishOptions.length !== 1 || !englishOptions[0]?.value) {
    throw new Ds160EnglishConfirmationError("CEAC confirmation page does not expose one selectable English option.");
  }
  const english = englishOptions[0];
  const selected = await readSelectedLanguage(language);
  if (!isEnglishOption(selected)) {
    await language.selectOption({ value: english.value }, { timeout: 10_000 });
    await waitForAspNetPostbackStable(page, 30_000);
  }
  await assertEnglishConfirmationReadback(page, expectedApplicationId);
}

/**
 * Invoke CEAC's official Print Confirmation control exactly once. CEAC uses
 * window.print on the same page, so the caller's subsequent page.pdf captures
 * the already verified English official rendering without creating a popup.
 */
export async function printOfficialDs160Confirmation(
  page: Page,
  expectedApplicationId: string,
): Promise<void> {
  await assertEnglishConfirmationReadback(page, expectedApplicationId);
  const printControl = await uniqueVisibleControl(page, PRINT_CONFIRMATION_SELECTORS, "Print Confirmation");
  const disabled = await printControl.evaluate((element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) return element.disabled;
    return element.getAttribute("aria-disabled") === "true";
  });
  if (disabled) {
    throw new Ds160EnglishConfirmationError("CEAC Print Confirmation control is disabled.");
  }
  await page.evaluate(() => {
    // CEAC's control invokes window.print() on this same page.  The worker
    // captures the verified page with page.pdf() immediately afterward, so
    // suppress only the native print dialog side effect; the official control
    // and its resulting page remain the source of the artifact.
    window.print = () => undefined;
  });
  await printControl.click({ timeout: 10_000 });
  // The print action is a same-page control. Re-read the official identity,
  // gate state and language after it settles before a caller captures bytes.
  await assertEnglishConfirmationReadback(page, expectedApplicationId);
}

/**
 * Prepare one verified official confirmation surface for PDF capture. This is
 * shared by submitted-result capture and later proof recovery; it never signs,
 * submits, emails, or creates an application.
 */
export async function prepareEnglishDs160ConfirmationCapture(
  page: Page,
  expectedApplicationId: string,
): Promise<void> {
  await ensureEnglishDs160Confirmation(page, expectedApplicationId);
  await printOfficialDs160Confirmation(page, expectedApplicationId);
}

export function mergeUsProofStoragePaths(
  result: unknown,
  paths: Ds160ProofStoragePaths,
): UsSubmissionResult {
  if (!isSubmittedUsResult(result)) {
    throw new Error("DS-160 proof recovery requires a submitted US DS-160 result.");
  }
  return {
    ...result,
    ...withoutEmpty(paths),
  };
}

export async function waitForDs160ConfirmationPage(page: Page): Promise<void> {
  const printControlGroups = [
    [
      'input[type="submit"][value*="Print Confirmation" i]',
      'input[type="button"][value*="Print Confirmation" i]',
      'button:has-text("Print Confirmation")',
      'a:has-text("Print Confirmation")',
    ].join(", "),
    [
      'input[type="submit"][value*="Print Application" i]',
      'input[type="button"][value*="Print Application" i]',
      'button:has-text("Print Application")',
      'a:has-text("Print Application")',
    ].join(", "),
    [
      'input[type="submit"][value*="Email Confirmation" i]',
      'input[type="button"][value*="Email Confirmation" i]',
      'button:has-text("Email Confirmation")',
      'a:has-text("Email Confirmation")',
    ].join(", "),
  ];
  const viewConfirmationControls = [
    'input[type="radio"][id*="radConfirmPage"]',
    'input[type="radio"][value*="radConfirmPage" i]',
    'input[type="submit"][value*="View Confirmation" i]',
    'input[type="button"][value*="View Confirmation" i]',
    'button:has-text("View Confirmation")',
    'a:has-text("View Confirmation")',
  ].join(", ");
  const continueControls = [
    'input[type="submit"][value="Continue" i]',
    'input[type="button"][value="Continue" i]',
    'button:has-text("Continue")',
    'a:has-text("Continue")',
  ].join(", ");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await hasOfficialProofControls(page, printControlGroups)) return;
    if (await clickFirstAvailable(page, viewConfirmationControls)) {
      await clickFirstAvailable(page, continueControls);
      continue;
    }
    if (await clickFirstAvailable(page, continueControls)) continue;
    await page.waitForTimeout(1_000);
  }
  throw new Error("CEAC confirmation page was not reached after DS-160 retrieval.");
}

async function hasOfficialProofControls(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    if ((await page.locator(visibleSelectors(selector)).count().catch(() => 0)) === 0) return false;
  }
  return true;
}

async function clickFirstAvailable(page: Page, selector: string): Promise<boolean> {
  const control = page.locator(visibleSelectors(selector)).first();
  if ((await control.count().catch(() => 0)) === 0) return false;
  try {
    await control.click({ force: true, timeout: 10_000 });
  } catch {
    await control.evaluate("el => el.click()");
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
  } catch {
    await page.waitForTimeout(2_000);
  }
  return true;
}

function visibleSelectors(selector: string): string {
  return selector.split(",").map(part => `${part.trim()}:visible`).join(", ");
}

function isSubmittedUsResult(value: unknown): value is UsSubmissionResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<UsSubmissionResult>;
  return result.country === "US" && result.status === "submitted" && typeof result.applicationId === "string";
}

function withoutEmpty(paths: Ds160ProofStoragePaths): Ds160ProofStoragePaths {
  return Object.fromEntries(
    Object.entries(paths).filter(([, value]) => typeof value === "string" && value.trim()),
  ) as Ds160ProofStoragePaths;
}
