import type { Locator, Page } from "@playwright/test";
import {
  reportBadCaptcha,
  solveImageCaptcha,
  TwoCaptchaApiError,
} from "../captcha/index.js";

const OFFICIAL_HOSTS = new Set(["evisa.gov.tr", "www.evisa.gov.tr"]);

export const TR_SELECTORS = {
  visaType: "#vizeturuList",
  travelDocumentCountry: "#uyruklist",
  travelDocumentType: "#belgelist",
  captchaImage: "#captcha_image",
  captchaInput: "#recaptcha_response_field",
  captchaRefresh: "#captcha-refresh",
  continue: "#btnsubmit",
  arrivalDate: "#txtGelisTarihi",
  arrivalContinue: "#btnSubmit",
} as const;

export type TrLiveStage =
  | "eligibility"
  | "arrival_date"
  | "prerequisites"
  | "personal_information"
  | "email_verification"
  | "payment"
  | "unknown";

export interface TrPaymentCheckpoint {
  ready: boolean;
  amountCents: number | null;
  currency: "USD" | null;
  reason: string;
}

export interface TrLiveFlowResult {
  status:
    | "stopped_before_official_record"
    | "stopped_before_pay"
    | "needs_human"
    | "blocked";
  reachedStep: string;
  reason: string;
  payment?: TrPaymentCheckpoint;
}

export interface TrLiveFlowInput {
  page: Page;
  answers: Record<string, string>;
  entryUrl: string;
  captchaSolver?: typeof solveImageCaptcha;
  /** Explicit live-QA authorization. False remains the safe default. */
  allowOfficialApplicationCreation?: boolean;
  /** Managed-inbox callback; required when application creation is enabled. */
  waitForVerificationUrl?: (
    sentAfter: string,
    applicationReference: string,
  ) => Promise<string>;
  /**
   * A trusted evisa.gov.tr verification URL from the VIZA inbox. Supplying it
   * resumes an already-created application and only observes the payment page.
   */
  verificationUrl?: string;
}

/** Bind browser state without dropping any guarded live-flow option. */
export function bindTrLiveFlowPage(
  page: Page,
  input: Omit<TrLiveFlowInput, "page">,
): TrLiveFlowInput {
  return { ...input, page };
}

interface ControlMetadata {
  id: string;
  name: string;
  type: string;
  tag: string;
  text: string;
}

const PREREQUISITE_FIELDS: Array<{ pattern: RegExp; answer: string }> = [
  { pattern: /passport covers|passport.*valid|travel document.*valid/i, answer: "confirm_passport_covers_stay" },
  { pattern: /return ticket|hotel reservation|50\s*(?:usd|\$)/i, answer: "confirm_return_ticket_accommodation_funds" },
  { pattern: /tourism or business|touristic or trade/i, answer: "confirm_tourism_or_business" },
  { pattern: /supporting document|supportive document/i, answer: "confirm_supporting_document_valid" },
  { pattern: /airline|turkish airlines|pegasus|air onur/i, answer: "confirm_eligible_airline" },
  { pattern: /enter.*by air|entry.*by air|travell?ing.*by air/i, answer: "confirm_entry_by_air" },
  { pattern: /each and every|all (?:of )?the conditions|all requirements/i, answer: "confirm_all_official_prerequisites" },
];

const PERSONAL_FIELD_ALIASES: Record<string, readonly RegExp[]> = {
  given_names: [/given name/i, /first name/i, /givenname/i],
  surname: [/surname/i, /last name/i],
  date_of_birth: [/date of birth/i, /dateofbirth/i],
  place_of_birth: [/place of birth/i, /placeofbirth/i],
  mother_name: [/mother.?s name/i, /mothersname/i],
  father_name: [/father.?s name/i, /fathersname/i],
  travel_document_number: [/travel document number/i, /passport number/i, /docnumber/i],
  travel_document_issue_date: [/document issue date/i, /passport issue date/i, /docissuedate/i],
  travel_document_expiry_date: [/document expiry date/i, /passport expiry date/i, /docexpirydate/i],
  supporting_document_type: [/type of supp/i, /typeofsuppdoc/i],
  supporting_document_issued_by: [/supp.*doc.*from/i, /supporting document.*issued/i],
  supporting_document_number: [/supp.*doc.*number/i, /supporting document.*number/i],
  supporting_document_expiry_date: [/supp.*doc.*expiry/i, /supporting document.*expir/i],
  email_address: [/e-?mail address/i, /email/i],
  phone_number: [/telephone/i, /phone number/i],
  residence_address: [/residence address/i, /^address$/i],
};

function normalizedYes(value: string | undefined): boolean {
  return ["yes", "true", "1", "confirmed"].includes(value?.trim().toLowerCase() ?? "");
}

export function normalizeTrApplicationReference(value: string): string {
  return value.trim().toUpperCase();
}

/** Extract the official reference used to bind the managed verification mail. */
export function extractTrApplicationReference(value: string): string | null {
  const patterns = [
    /(?:application\s+)?(?:reference|ref\.?)(?:\s+(?:number|no\.?))?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,39})/i,
    /(?:başvuru|basvuru)\s+(?:referans(?:ı|i)?|numarası|numarasi)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,39})/i,
  ];
  for (const pattern of patterns) {
    const candidate = pattern.exec(value)?.[1];
    if (candidate) return normalizeTrApplicationReference(candidate);
  }
  return null;
}

export function isTrustedTrOfficialUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      OFFICIAL_HOSTS.has(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

export function requireTrustedTrOfficialUrl(value: string, boundary: string): void {
  if (!isTrustedTrOfficialUrl(value)) {
    throw new Error(`Türkiye ${boundary} left the verified official e-Visa host`);
  }
}

export function redactedTrVerificationNavigationFailure(_error: unknown): string {
  return "Türkiye verification navigation failed before the unpaid payment checkpoint";
}

function requireTrustedTrOfficialPage(page: Page, boundary: string): void {
  requireTrustedTrOfficialUrl(page.url(), boundary);
}

export function toTrPortalDate(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return value.trim();
}

export function shouldRetryTrCaptchaSolve(error: unknown): error is TwoCaptchaApiError {
  return (
    error instanceof TwoCaptchaApiError &&
    error.apiErrorCode === "ERROR_CAPTCHA_UNSOLVABLE"
  );
}

export function classifyTrArrivalEligibility(bodyText: string):
  | "visa_exempt"
  | "continue" {
  return /you are exempt from visa|visa[- ]exempt|vizeden muafsınız/i.test(bodyText)
    ? "visa_exempt"
    : "continue";
}

export function classifyTrStage(input: {
  url: string;
  bodyText: string;
  selectorIds?: readonly string[];
}): TrLiveStage {
  const body = input.bodyText.toLowerCase();
  const selectors = new Set(input.selectorIds ?? []);
  if (selectors.has("vizeturuList") || selectors.has("recaptcha_response_field")) return "eligibility";
  if (/payment|pay now|card number/.test(body) && /usd|us dollars|e-visa fee/.test(body)) return "payment";
  if (/e-?mail address verification|verify your e-?mail|verification message/.test(body)) return "email_verification";
  if (/personal information|given\/first name|travel document number/.test(body)) return "personal_information";
  if (/prerequisites|you must meet all|each and every one of the conditions/.test(body)) return "prerequisites";
  if (/date of arrival|arrival date in t[üu]rkiye/.test(body)) return "arrival_date";
  return "unknown";
}

function parseUsdAmount(bodyText: string): number | null {
  const patterns = [
    /(?:visa fee|total|amount)[^\d]{0,40}(?:usd|us\$|\$)\s*([\d,.]+)/i,
    /(?:visa fee|total|amount)[^\d]{0,40}([\d,.]+)\s*(?:usd|us dollars)/i,
    /(?:usd|us\$)\s*([\d,.]+)/i,
    /([\d,.]+)\s*(?:usd|us dollars)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(bodyText);
    if (!match) continue;
    const amount = Number.parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0 && amount < 10_000) {
      return Math.round(amount * 100);
    }
  }
  return null;
}

export function classifyTrPaymentCheckpoint(input: {
  url: string;
  bodyText: string;
  hasPaymentAction: boolean;
  hasCardControl: boolean;
}): TrPaymentCheckpoint {
  if (!isTrustedTrOfficialUrl(input.url)) {
    return { ready: false, amountCents: null, currency: null, reason: "payment page is not on the official Türkiye e-Visa host" };
  }
  const body = input.bodyText;
  if (!/payment|pay now|e-visa fee/i.test(body)) {
    return { ready: false, amountCents: null, currency: null, reason: "official payment heading is absent" };
  }
  if (!/usd|us dollars|us\$/i.test(body)) {
    return { ready: false, amountCents: null, currency: null, reason: "official USD currency evidence is absent" };
  }
  const amountCents = parseUsdAmount(body);
  if (amountCents === null) {
    return { ready: false, amountCents: null, currency: "USD", reason: "official payment amount could not be parsed" };
  }
  if (!input.hasPaymentAction && !input.hasCardControl) {
    return { ready: false, amountCents, currency: "USD", reason: "official payment controls are absent" };
  }
  if (/payment (?:completed|successful)|paid successfully/i.test(body)) {
    return { ready: false, amountCents, currency: "USD", reason: "page is already past the unpaid checkpoint" };
  }
  return { ready: true, amountCents, currency: "USD", reason: "verified official unpaid USD payment checkpoint" };
}

async function currentStage(page: Page): Promise<TrLiveStage> {
  requireTrustedTrOfficialPage(page, "stage observation");
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  const selectorIds = await page
    .locator("input[id], select[id], textarea[id]")
    .evaluateAll((controls) => controls.map((control) => control.id));
  return classifyTrStage({ url: page.url(), bodyText, selectorIds });
}

async function clickAndWait(page: Page, locator: Locator): Promise<void> {
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {}),
    locator.click({ timeout: 20_000 }),
  ]);
  await page.waitForTimeout(500);
}

export async function openTrOfficialApplication(page: Page, entryUrl: string): Promise<void> {
  await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  for (let hop = 0; hop < 4; hop += 1) {
    const url = new URL(page.url());
    if (url.hostname.toLowerCase() === "dtvgroup.com.tr") {
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Türkiye e-Visa DTV handoff left the verified HTTPS host");
      }
      const apply = page.getByRole("button", { name: /Apply for an e-Visa/i });
      await apply.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
      if ((await apply.count()) !== 1) throw new Error("DTV e-Visa handoff button is unavailable");
      await clickAndWait(page, apply);
      continue;
    }
    requireTrustedTrOfficialPage(page, "entry navigation");
    if ((await page.locator(TR_SELECTORS.visaType).count()) === 1) return;
    if (/\/apply\/?$/i.test(url.pathname)) {
      // The ASP.NET application is mounted after the public Angular route has
      // already reached DOMContentLoaded. Give its verified first control time
      // to attach before treating the page as another navigation hop.
      await page
        .locator(TR_SELECTORS.visaType)
        .waitFor({ state: "attached", timeout: 20_000 })
        .catch(() => undefined);
      if ((await page.locator(TR_SELECTORS.visaType).count()) === 1) return;
    }
    const semanticApply = page.getByRole("link", {
      name: /Apply Now|New application/i,
    }).first();
    await semanticApply.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    const apply = (await semanticApply.count()) > 0
      ? semanticApply
      : page.locator('a[href*="/apply"]').first();
    if ((await apply.count()) === 0) throw new Error("official Türkiye e-Visa Apply link is unavailable");
    await clickAndWait(page, apply);
  }
  throw new Error("Türkiye e-Visa entry redirect exceeded the safe navigation limit");
}

export async function setHiddenNativeSelect(page: Page, selector: string, value: string): Promise<void> {
  requireTrustedTrOfficialPage(page, "eligibility selection");
  const selected = await page.locator(selector).evaluate((node, selectedValue) => {
    if (!(node instanceof HTMLSelectElement)) return false;
    if (!Array.from(node.options).some((option) => option.value === selectedValue)) return false;
    node.value = selectedValue;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return node.value === selectedValue;
  }, value);
  if (!selected) throw new Error(`${selector}: official option is unavailable`);
}

async function solveEligibilityCaptcha(
  page: Page,
  solver: typeof solveImageCaptcha,
): Promise<void> {
  requireTrustedTrOfficialPage(page, "eligibility CAPTCHA");
  const captureStableChallenge = async (): Promise<Buffer> => {
    const image = page.locator(TR_SELECTORS.captchaImage);
    await image.waitFor({ state: "visible", timeout: 10_000 });
    let previous: Buffer | null = null;
    for (let sample = 0; sample < 10; sample += 1) {
      const current = await image.screenshot({ timeout: 10_000 });
      if (previous?.equals(current)) return current;
      previous = current;
      await page.waitForTimeout(400);
    }
    throw new Error("Türkiye CAPTCHA bitmap did not stabilize");
  };

  const refreshChallenge = async (): Promise<void> => {
    const colorboxClose = page.locator("#cboxClose");
    if ((await colorboxClose.count()) === 1) {
      await colorboxClose
        .evaluate((node) => (node as HTMLElement).click())
        .catch(() => undefined);
      await page
        .waitForFunction(() => {
          const overlay = document.querySelector<HTMLElement>("#cboxOverlay");
          return !overlay || getComputedStyle(overlay).display === "none";
        }, undefined, { timeout: 5_000 })
        .catch(() => undefined);
    }
    await page
      .locator(TR_SELECTORS.captchaRefresh)
      .evaluate((node) => (node as HTMLElement).click());
    await page.waitForTimeout(300);
  };

  let lastError = "CAPTCHA was not accepted";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const image = await captureStableChallenge();
    let solved: Awaited<ReturnType<typeof solveImageCaptcha>>;
    try {
      solved = await solver(image, 120_000, { comment: "Türkiye e-Visa eligibility CAPTCHA" });
    } catch (error) {
      if (
        attempt < 2 &&
        shouldRetryTrCaptchaSolve(error) &&
        (await page.locator(TR_SELECTORS.captchaRefresh).count()) === 1
      ) {
        lastError = error.message;
        await refreshChallenge();
        continue;
      }
      throw error;
    }
    if (!solved.text.trim()) throw new Error("TWOCAPTCHA returned an empty Türkiye CAPTCHA answer");
    requireTrustedTrOfficialPage(page, "eligibility CAPTCHA submission");
    await page.locator(TR_SELECTORS.captchaInput).fill(solved.text.trim());
    await clickAndWait(page, page.locator(TR_SELECTORS.continue));
    if ((await currentStage(page)) !== "eligibility") return;
    const validation = await page.locator("#valmsg").innerText().catch(() => "");
    lastError = validation.trim() || lastError;
    await reportBadCaptcha(solved.solveId).catch(() => undefined);
    if (attempt < 2 && (await page.locator(TR_SELECTORS.captchaRefresh).count()) === 1) {
      // A rejected answer is rendered in a Colorbox modal. Its overlay
      // intercepts normal Playwright pointer events, including the CAPTCHA
      // refresh link. Close the modal through the page DOM and invoke the
      // portal's own refresh handler directly so the next solve always uses a
      // fresh challenge rather than timing out behind the overlay.
      await refreshChallenge();
    }
  }
  throw new Error(`Türkiye eligibility CAPTCHA failed: ${lastError}`);
}

async function controlMetadata(locator: Locator): Promise<ControlMetadata> {
  return locator.evaluate((node) => {
    const control = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const labelText = control.id
      ? Array.from(document.querySelectorAll("label")).find(
          (label) => label.htmlFor === control.id,
        )?.textContent ?? ""
      : "";
    const container = control.closest(".item, .field, .form-group, li, tr");
    return {
      id: control.id ?? "",
      name: control.getAttribute("name") ?? "",
      type: control instanceof HTMLInputElement ? control.type : "",
      tag: control.tagName.toLowerCase(),
      text: `${labelText} ${container?.textContent ?? ""}`.replace(/\s+/g, " ").trim(),
    };
  });
}

async function findSemanticControl(
  page: Page,
  patterns: readonly RegExp[],
  allowedTypes?: readonly string[],
): Promise<Locator | null> {
  const controls = page.locator("input:not([type=hidden]), select, textarea");
  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = controls.nth(index);
    const metadata = await controlMetadata(control);
    const controlType = metadata.type || metadata.tag;
    if (allowedTypes && !allowedTypes.includes(controlType)) continue;
    const searchable = `${metadata.id} ${metadata.name} ${metadata.text}`;
    if (patterns.some((pattern) => pattern.test(searchable))) return control;
  }
  return null;
}

async function assignControlValue(control: Locator, value: string): Promise<void> {
  const tag = await control.evaluate((node) => node.tagName.toLowerCase());
  if (tag === "select") {
    const selected = await control.selectOption(value).catch(() => []);
    if (selected.length === 0) {
      const byLabel = await control.selectOption({ label: value }).catch(() => []);
      if (byLabel.length === 0) throw new Error("official select option is unavailable");
    }
    return;
  }
  await control.evaluate((node, nextValue) => {
    const field = node as HTMLInputElement | HTMLTextAreaElement;
    field.value = nextValue;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function fillArrivalDate(
  page: Page,
  value: string,
): Promise<"visa_exempt" | "continued"> {
  requireTrustedTrOfficialPage(page, "arrival-date entry");
  let control = await findSemanticControl(
    page,
    [
      /arrival date/i,
      /vstdate/i,
      /arrivaldate/i,
      /var[iı]s.*tarih/i,
      /gelis.*tarih/i,
    ],
    ["text", "date"],
  );
  if (!control) {
    const kendoDateCandidates = page.locator(
      '.k-datepicker input:visible, input[data-role="datepicker"]:visible',
    );
    if ((await kendoDateCandidates.count()) === 1) {
      control = kendoDateCandidates.first();
    }
  }
  if (!control) {
    // The current ASP.NET/Kendo arrival page renders its date input without a
    // useful label/id relationship. At this stage there must be exactly one
    // visible editable text/date input; retaining the single-control
    // invariant prevents accidentally filling an unrelated widget if the
    // official page changes again.
    const candidates = page.locator(
      'input:is([type="text"], [type="date"]):visible:not([readonly]):not([disabled]):not(.select2-input):not([role="combobox"]):not(#recaptcha_response_field)',
    );
    if ((await candidates.count()) === 1) control = candidates.first();
  }
  if (!control) throw new Error("Türkiye arrival-date control is unavailable or ambiguous");
  await assignControlValue(control, toTrPortalDate(value));
  await page.waitForTimeout(750);
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  if (classifyTrArrivalEligibility(bodyText) === "visa_exempt") {
    return "visa_exempt";
  }
  const next = page.locator(TR_SELECTORS.arrivalContinue);
  if ((await next.count()) !== 1 || !(await next.isVisible().catch(() => false))) {
    throw new Error("Türkiye arrival Save and Continue control is unavailable");
  }
  await clickAndWait(page, next);
  return "continued";
}

export function prerequisiteAnswerKey(label: string): string | null {
  return PREREQUISITE_FIELDS.find((entry) => entry.pattern.test(label))?.answer ?? null;
}

async function confirmPrerequisites(page: Page, answers: Record<string, string>): Promise<string[]> {
  requireTrustedTrOfficialPage(page, "prerequisite confirmation");
  const checkboxes = page.locator('input[type="checkbox"]');
  const missing: string[] = [];
  for (let index = 0; index < (await checkboxes.count()); index += 1) {
    const checkbox = checkboxes.nth(index);
    const { text } = await controlMetadata(checkbox);
    const answerKey = prerequisiteAnswerKey(text);
    if (!answerKey) {
      missing.push(`unmapped_official_prerequisite_${index + 1}`);
      continue;
    }
    if (!normalizedYes(answers[answerKey])) {
      missing.push(answerKey);
      continue;
    }
    await checkbox.check();
  }
  if (missing.length === 0) await clickAndWait(page, page.locator(TR_SELECTORS.continue));
  return [...new Set(missing)];
}

async function fillPersonalInformation(page: Page, answers: Record<string, string>): Promise<string[]> {
  requireTrustedTrOfficialPage(page, "personal-information entry");
  const missingControls: string[] = [];
  const supportingType = answers.supporting_document_type;
  const portalAnswers: Record<string, string> = {
    given_names: answers.given_names,
    surname: answers.surname,
    date_of_birth: toTrPortalDate(answers.date_of_birth),
    place_of_birth: answers.place_of_birth,
    mother_name: answers.mother_name,
    father_name: answers.father_name,
    travel_document_number: answers.travel_document_number,
    travel_document_issue_date: toTrPortalDate(answers.travel_document_issue_date),
    travel_document_expiry_date: toTrPortalDate(answers.travel_document_expiry_date),
    supporting_document_type: ({ none: "0", visa: "1", residence_permit: "2" } as Record<string, string>)[supportingType] ?? supportingType,
    supporting_document_issued_by:
      supportingType === "visa"
        ? answers.supporting_visa_issued_by
        : answers.supporting_residence_permit_issued_by,
    supporting_document_number: answers.supporting_document_number,
    supporting_document_expiry_date: toTrPortalDate(
      supportingType === "visa"
        ? answers.supporting_visa_expiry_date
        : answers.supporting_residence_permit_expiry_date,
    ),
    email_address: answers.email_address,
    phone_number: answers.phone_number,
    residence_address: answers.residence_address,
  };

  for (const [key, patterns] of Object.entries(PERSONAL_FIELD_ALIASES)) {
    const value = portalAnswers[key]?.trim();
    if (!value) continue;
    const control = await findSemanticControl(page, patterns);
    if (!control) {
      missingControls.push(key);
      continue;
    }
    await assignControlValue(control, value);
  }

  const commitment = await findSemanticControl(
    page,
    [/entry commitment/i, /information form/i, /read and accept/i],
    ["checkbox"],
  );
  if (commitment) {
    if (!normalizedYes(answers.confirm_entry_commitment)) {
      missingControls.push("confirm_entry_commitment");
    } else {
      await commitment.check();
    }
  }
  return [...new Set(missingControls)];
}

async function observePaymentCheckpoint(page: Page): Promise<TrPaymentCheckpoint> {
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  const hasCardControl =
    (await page.locator('input[autocomplete="cc-number"], input[name*="card" i], iframe[src*="payment" i]').count()) > 0;
  const hasPaymentAction =
    (await page.getByRole("button", { name: /Pay|Proceed to Payment/i }).count()) > 0 ||
    (await page.locator('input[type="submit"][value*="Pay" i], a[href*="payment" i]').count()) > 0;
  return classifyTrPaymentCheckpoint({
    url: page.url(),
    bodyText,
    hasCardControl,
    hasPaymentAction,
  });
}

async function followVerificationToPayment(
  page: Page,
  verificationUrl: string,
): Promise<TrPaymentCheckpoint> {
  if (!isTrustedTrOfficialUrl(verificationUrl)) {
    return {
      ready: false,
      amountCents: null,
      currency: null,
      reason: "Türkiye verification URL is not on the trusted official host",
    };
  }
  try {
    await page.goto(verificationUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (!isTrustedTrOfficialUrl(page.url())) {
      return {
        ready: false,
        amountCents: null,
        currency: null,
        reason: "Türkiye verification navigation left the trusted official host",
      };
    }
    let payment = await observePaymentCheckpoint(page);
    if (payment.ready) return payment;

    const approval = page.getByRole("button", {
      name: /Approve|Confirm and Proceed|Verify and Continue/i,
    }).first();
    await approval.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
    if ((await approval.count()) === 1) {
      requireTrustedTrOfficialPage(page, "verification approval");
      await clickAndWait(page, approval);
      payment = await observePaymentCheckpoint(page);
    }
    return payment;
  } catch (error) {
    return {
      ready: false,
      amountCents: null,
      currency: null,
      reason: redactedTrVerificationNavigationFailure(error),
    };
  }
}

export async function runTrLiveFlow(input: TrLiveFlowInput): Promise<TrLiveFlowResult> {
  if (input.verificationUrl) {
    const payment = await followVerificationToPayment(input.page, input.verificationUrl);
    return payment.ready
      ? { status: "stopped_before_pay", reachedStep: "official_payment", reason: payment.reason, payment }
      : { status: "blocked", reachedStep: "payment_checkpoint_mismatch", reason: payment.reason, payment };
  }

  try {
    await openTrOfficialApplication(input.page, input.entryUrl);
    await setHiddenNativeSelect(input.page, TR_SELECTORS.visaType, "1");
    await setHiddenNativeSelect(
      input.page,
      TR_SELECTORS.travelDocumentCountry,
      input.answers.travel_document_country,
    );
    await setHiddenNativeSelect(
      input.page,
      TR_SELECTORS.travelDocumentType,
      input.answers.travel_document_type,
    );
    await solveEligibilityCaptcha(input.page, input.captchaSolver ?? solveImageCaptcha);

    if ((await currentStage(input.page)) !== "arrival_date") {
      return { status: "blocked", reachedStep: "arrival_checkpoint_mismatch", reason: "official Türkiye arrival-date page was not reached" };
    }
    const arrivalResult = await fillArrivalDate(
      input.page,
      input.answers.intended_arrival_date,
    );
    if (arrivalResult === "visa_exempt") {
      return {
        status: "stopped_before_official_record",
        reachedStep: "visa_exempt",
        reason:
          "The official Türkiye portal states that this applicant is visa-exempt for the selected tourist arrival; no e-Visa application was created.",
      };
    }
    if ((await currentStage(input.page)) !== "prerequisites") {
      return { status: "blocked", reachedStep: "prerequisite_checkpoint_mismatch", reason: "official Türkiye prerequisite page was not reached" };
    }
    const missingPrerequisites = await confirmPrerequisites(input.page, input.answers);
    if (missingPrerequisites.length > 0) {
      return {
        status: "needs_human",
        reachedStep: "prerequisites",
        reason: `missing truthful prerequisite confirmations: ${missingPrerequisites.join(", ")}`,
      };
    }
    if ((await currentStage(input.page)) !== "personal_information") {
      return { status: "blocked", reachedStep: "personal_checkpoint_mismatch", reason: "official Türkiye personal-information page was not reached" };
    }
    const missingControls = await fillPersonalInformation(input.page, input.answers);
    if (missingControls.length > 0) {
      return {
        status: "blocked",
        reachedStep: "personal_control_mismatch",
        reason: `official Türkiye personal controls unavailable: ${missingControls.join(", ")}`,
      };
    }

    if (!input.allowOfficialApplicationCreation) {
      return {
        status: "stopped_before_official_record",
        reachedStep: "personal_information_pre_submit",
        reason: "Türkiye form prepared; live-QA application-creation gate is disabled",
      };
    }
    if (!input.waitForVerificationUrl) {
      return {
        status: "blocked",
        reachedStep: "managed_inbox_unavailable",
        reason: "Türkiye managed-inbox verification callback is unavailable",
      };
    }

    const sentAfter = new Date().toISOString();
    requireTrustedTrOfficialPage(input.page, "official application creation");
    await input.page.locator(TR_SELECTORS.continue).click({ timeout: 20_000 });
    await input.page.waitForTimeout(750);
    requireTrustedTrOfficialPage(input.page, "application creation confirmation");
    const verify = input.page.getByRole("button", {
      name: /Verify|Confirm and Proceed/i,
    }).first();
    await verify.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
    if ((await verify.count()) === 1) {
      requireTrustedTrOfficialPage(input.page, "application creation confirmation");
      await clickAndWait(input.page, verify);
      requireTrustedTrOfficialPage(input.page, "application creation transition");
    }

    const afterSubmitStage = await currentStage(input.page);
    if (!["email_verification", "unknown"].includes(afterSubmitStage)) {
      return {
        status: "blocked",
        reachedStep: "official_application_creation_mismatch",
        reason: `Türkiye official application did not reach email verification (stage: ${afterSubmitStage})`,
      };
    }
    const applicationReference = extractTrApplicationReference(
      `${input.page.url()}\n${await input.page.locator("body").innerText({ timeout: 10_000 }).catch(() => "")}`,
    );
    if (!applicationReference) {
      return {
        status: "blocked",
        reachedStep: "official_application_reference_missing",
        reason:
          "Türkiye official application reached email verification without an observable reference for inbox correlation",
      };
    }
    const verificationUrl = await input.waitForVerificationUrl(
      sentAfter,
      applicationReference,
    );
    const payment = await followVerificationToPayment(input.page, verificationUrl);
    return payment.ready
      ? {
          status: "stopped_before_pay",
          reachedStep: "official_payment",
          reason: payment.reason,
          payment,
        }
      : {
          status: "blocked",
          reachedStep: "payment_checkpoint_mismatch",
          reason: payment.reason,
          payment,
        };
  } catch (error) {
    return {
      status: "blocked",
      reachedStep: "live_flow_error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
