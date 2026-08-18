import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type Locator, type Page } from "@playwright/test";
import { solveCaptcha, solveImageCaptcha, reportBadCaptcha } from "../captcha/index.js";
import { createArrivalCardBrowserSession } from "../arrival-card-browser.js";
import { inbox, type InboundMessage, InboxDomainUnroutableError, InboxTimeoutError } from "../inbox/wait-for-message.js";
import { closeResourceBestEffort, launchAbortableResource } from "../queue/portal-safety.js";
import { RunnerJobOwnershipLostError, type RunnerExecutionContext } from "../queue/execution-context.js";
import {
  KR_EARRIVAL_ADDITIONAL_QUESTION_KEYS,
  isOfficialAdditionalQuestionKey,
} from "./official-options.js";
import {
  KR_EARRIVAL_CHECK_EDIT_URL,
  KR_EARRIVAL_OFFICIAL_PORTAL_URL,
  type KrEArrivalPortalPayload,
} from "./normalize.js";

export interface KrEArrivalPortalSubmissionResult {
  submitted: boolean;
  issueNumber?: string | null;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  submittedAt?: string | null;
  validUntil?: string | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
}

export class KrEArrivalPortalError extends Error {
  readonly screenshotPaths: string[];
  readonly logs: string[];
  readonly portalSummary?: string;
  readonly code: string;
  readonly retryable: boolean;
  readonly blocked: boolean;

  constructor(
    message: string,
    options: {
      code: string;
      screenshotPaths?: string[];
      logs?: string[];
      portalSummary?: string;
      retryable?: boolean;
      blocked?: boolean;
    },
  ) {
    super(message);
    this.name = "KrEArrivalPortalError";
    this.code = options.code;
    this.screenshotPaths = options.screenshotPaths ?? [];
    this.logs = options.logs ?? [];
    this.portalSummary = options.portalSummary;
    this.retryable = options.retryable ?? false;
    this.blocked = options.blocked ?? /(?:blocked|captcha|dynamic_field_drift|selector_drift|otp_)/iu.test(options.code);
  }
}

async function findVisible(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const count = await page.locator(selector).count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = page.locator(selector).nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return null;
}

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "viza-kr-eac-"));
}

function safeSummary(value: string, sensitiveValues: string[] = []): string {
  let redacted = value;
  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue.trim()) redacted = redacted.split(sensitiveValue).join("[redacted]");
  }
  return redacted
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[email]")
    .replace(/\b[A-Z0-9]{6,12}\b/gu, (candidate) => {
      if (/\d/.test(candidate)) return "[redacted-id]";
      return candidate;
    })
    .replace(/\b\d{6}\b/gu, "[otp]")
    .replace(/\b\d{7,}\b/gu, "[redacted-number]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 700);
}

async function saveScreenshot(
  page: Page,
  dir: string,
  name: string,
  logs: string[],
  sensitiveValues: string[] = [],
): Promise<string> {
  const filePath = path.join(dir, `${name}-${Date.now()}.png`);
  await page.evaluate((values) => {
    const stateKey = "__vizaKrEacScreenshotState";
    const currentWindow = window as Window & {
      [stateKey]?: {
        elements: Array<{ element: HTMLInputElement | HTMLTextAreaElement; value: string }>;
        textNodes: Array<{ node: Text; value: string }>;
      };
    };
    const state = {
      elements: [] as Array<{ element: HTMLInputElement | HTMLTextAreaElement; value: string }>,
      textNodes: [] as Array<{ node: Text; value: string }>,
    };
    const replacements = values.filter((value) => value.trim()).map((value) => [value, "[redacted]"] as const);
    const replaceText = (source: string): string => {
      let output = source;
      for (const [needle, replacement] of replacements) output = output.split(needle).join(replacement);
      return output
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[email]")
        .replace(/\b\d{6}\b/gu, "[otp]")
        .replace(/\b\d{7,}\b/gu, "[redacted-number]");
    };
    const fieldSelector = [
      "input[name*='email' i]",
      "input[class*='eml' i]",
      "input[id*='email' i]",
      "input[id*='eml' i]",
      "input[name*='passport' i]",
      "input[class*='ps_no' i]",
      "input[id*='passport' i]",
      "input[id*='ps_no' i]",
      "input[name*='phone' i]",
      "input[name*='tel' i]",
      "input[class*='tel' i]",
      "input[id*='phone' i]",
      "input[id*='tel' i]",
      "input[name*='idcd' i]",
      "input[id*='idcd' i]",
      "input[class*='auth' i]",
      "input[id*='auth' i]",
      "textarea[name*='email' i]",
    ].join(",");
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(fieldSelector).forEach((element) => {
      state.elements.push({ element, value: element.value });
      element.value = "[redacted]";
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      const parent = textNode.parentElement;
      if (parent && !/^(SCRIPT|STYLE|NOSCRIPT)$/u.test(parent.tagName)) {
        const replacement = replaceText(textNode.nodeValue ?? "");
        if (replacement !== textNode.nodeValue) {
          state.textNodes.push({ node: textNode, value: textNode.nodeValue ?? "" });
          textNode.nodeValue = replacement;
        }
      }
      node = walker.nextNode();
    }
    currentWindow[stateKey] = state;
  }, sensitiveValues);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
  } finally {
    await page.evaluate(() => {
      const stateKey = "__vizaKrEacScreenshotState";
      const currentWindow = window as Window & {
        [stateKey]?: {
          elements: Array<{ element: HTMLInputElement | HTMLTextAreaElement; value: string }>;
          textNodes: Array<{ node: Text; value: string }>;
        };
      };
      const state = currentWindow[stateKey];
      if (!state) return;
      for (const entry of state.elements) entry.element.value = entry.value;
      for (const entry of state.textNodes) entry.node.nodeValue = entry.value;
      delete currentWindow[stateKey];
    }).catch(() => undefined);
  }
  logs.push(`kr_eac_screenshot ${name}`);
  return filePath;
}

async function fillInput(page: Page, selector: string, value: string, label: string): Promise<void> {
  const input = page.locator(selector).first();
  await input.waitFor({ state: "attached", timeout: 30_000 });
  const visible = await input.isVisible().catch(() => false);
  const disabled = await input.isDisabled().catch(() => false);
  const readonly = (await input.getAttribute("readonly").catch(() => null)) !== null;
  if (!visible || disabled || readonly || !(await input.isEditable().catch(() => false))) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card field ${label} is not an editable official control.`,
      { code: "kr_eac_control_not_editable", blocked: true },
    );
  }
  await input.fill(value);
}

async function selectExact(page: Page, selector: string, value: string, label: string): Promise<void> {
  const select = page.locator(selector).first();
  await select.waitFor({ state: "visible", timeout: 30_000 });
  const options = await select.locator("option").evaluateAll((elements) =>
    elements.map((element) => ({ value: (element as HTMLOptionElement).value, text: element.textContent?.trim() ?? "" })),
  );
  if (!options.some((option) => option.value === value)) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} option ${value} is not present; portal options changed.`,
      { code: "kr_eac_official_option_drift", portalSummary: safeSummary(JSON.stringify(options)), blocked: true },
    );
  }
  await select.selectOption({ value });
}

async function fillDate(
  page: Page,
  selectors: { year: string; month: string; day: string },
  value: string,
  label: string,
): Promise<void> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new KrEArrivalPortalError(`Invalid ${label} date supplied to the official portal.`, { code: "kr_eac_invalid_date" });
  await selectExact(page, selectors.year, match[1], `${label} year`);
  await selectExact(page, selectors.month, match[2], `${label} month`);
  await selectExact(page, selectors.day, match[3], `${label} day`);
}

async function clickVisible(
  page: Page,
  selectors: string[],
  label: string,
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const target = await findVisible(page, selectors);
  if (!target) throw new KrEArrivalPortalError(`Official Korea e-Arrival Card ${label} control was not found.`, { code: "kr_eac_selector_drift" });
  executionContext?.assertOwned();
  await target.click({ timeout: 20_000 });
}

function normalizeAddressForMatch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\[jibun\][^\n]*/giu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function addressContainsOrMatches(query: string, candidate: string): boolean {
  const normalizedQuery = normalizeAddressForMatch(query);
  const normalizedCandidate = normalizeAddressForMatch(candidate);
  if (!normalizedQuery || !normalizedCandidate) return false;
  return normalizedQuery === normalizedCandidate
    || normalizedCandidate.includes(normalizedQuery)
    || normalizedQuery.includes(normalizedCandidate);
}

async function selectOfficialStayAddress(
  page: Page,
  payload: KrEArrivalPortalPayload,
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const addressQuery = payload.addressEnglish || payload.addressKorean;
  const postalQuery = payload.postalCode;
  const query = addressQuery || postalQuery;
  if (!query) {
    throw new KrEArrivalPortalError(
      "Korea e-Arrival Card requires a stay address for the official address lookup.",
      { code: "kr_eac_address_missing", blocked: true },
    );
  }
  const language = /[\uac00-\ud7a3]/u.test(query) ? "ko" : "en";
  const button = await findVisible(
    page,
    language === "ko" ? [".btnKorAddr"] : [".btnEngAddr"],
  );
  if (!button) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address lookup control was not observable.",
      { code: "kr_eac_address_widget_drift", blocked: true },
    );
  }
  executionContext?.assertOwned();
  await button.click({ timeout: 20_000 });
  const postalOnly = !addressQuery || /^\d{5}$/u.test(addressQuery.trim());
  const keyword = await findVisible(
    page,
    postalOnly ? ["#keywordZipCode", "#keywordAddr"] : ["#keywordAddr"],
  );
  if (!keyword) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address search input was not observable.",
      { code: "kr_eac_address_widget_drift", blocked: true },
    );
  }
  await keyword.fill(query);
  const search = await findVisible(
    page,
    postalOnly ? ["#btnSearchZipCode", "#btnSearchAddr"] : ["#btnSearchAddr"],
  );
  if (!search) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address search control was not observable.",
      { code: "kr_eac_address_widget_drift", blocked: true },
    );
  }
  executionContext?.assertOwned();
  await search.click({ timeout: 20_000 });
  const resultLinks = page.locator("a[onclick^='addrSet(']");
  const findMatchingResult = async (
    requireAddressMatch: boolean,
    requirePostalMatch = false,
  ): Promise<Locator | null> => {
    await resultLinks.first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    const count = await resultLinks.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = resultLinks.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      const onclick = await candidate.getAttribute("onclick").catch(() => null);
      const match = onclick
        ? /addrSet\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/u.exec(onclick)
        : null;
      if (!match) continue;
      const candidatePostal = match[1].trim();
      const candidateAddress = (language === "ko" ? match[3] : match[2]).trim();
      const postalMatches = candidatePostal === postalQuery.trim();
      const addressMatches = !postalOnly && addressQuery
        ? addressContainsOrMatches(addressQuery, candidateAddress)
        : true;
      if (
        (requireAddressMatch && addressMatches && (!requirePostalMatch || postalMatches))
        || (!requireAddressMatch && postalMatches && addressMatches)
      ) {
        return candidate;
      }
    }
    return null;
  };

  let selected = await findMatchingResult(!postalOnly && Boolean(addressQuery), Boolean(postalQuery));
  if (!selected && addressQuery && postalQuery) {
    // Address text can be transliterated or abbreviated in saved data. If the
    // address search has no exact result, use the official postal-code tab and
    // still require the returned ZIP/address pair to match the saved values.
    const zipKeyword = await findVisible(page, ["#keywordZipCode"]);
    const zipSearch = await findVisible(page, ["#btnSearchZipCode"]);
    if (zipKeyword && zipSearch) {
      await zipKeyword.fill(postalQuery);
      executionContext?.assertOwned();
      await zipSearch.click({ timeout: 20_000 });
      selected = await findMatchingResult(true, true);
    }
  }
  if (!selected) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address lookup did not return an exact matching result.",
      { code: "kr_eac_address_match_failed", blocked: true },
    );
  }
  executionContext?.assertOwned();
  await selected.click({ timeout: 20_000 });
  await page.waitForTimeout(300);
  const korean = await page.locator("input.soj_prrpl_rnm_bs_han_addr").first().inputValue().catch(() => "");
  const english = await page.locator("input.soj_prrpl_rnm_bs_eng_addr").first().inputValue().catch(() => "");
  const postal = await page.locator("input.zip").first().inputValue().catch(() => "");
  if (!korean || !english || postal !== payload.postalCode) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address widget did not commit a complete address result.",
      { code: "kr_eac_address_commit_failed", blocked: true },
    );
  }
}

function normalizeTravelLookupValue(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function travelLookupMatches(expected: string, observed: string): boolean {
  const expectedNormalized = normalizeTravelLookupValue(expected);
  const observedNormalized = normalizeTravelLookupValue(observed);
  if (!expectedNormalized || !observedNormalized) return false;
  return expectedNormalized === observedNormalized
    || expectedNormalized.includes(observedNormalized)
    || observedNormalized.includes(expectedNormalized);
}

async function readOfficialTravelLookupValue(page: Page, selectors: string[]): Promise<string> {
  const field = page.locator(selectors.join(",")).first();
  if (await field.count().catch(() => 0) === 0) return "";
  return await field.inputValue().catch(async () => await field.getAttribute("value").catch(() => "") ?? "");
}

/**
 * The official page performs the previous/next airport lookup through its
 * visible `.btnSrchNav` control.  We only read the hidden values written by
 * that official widget; we never populate them ourselves.  Unknown flight
 * numbers are allowed by the portal and leave those values empty.
 */
async function acknowledgeOfficialTravelLookupPrompt(
  page: Page,
  label: string,
  logs: string[],
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const dialogs = page.locator(".popBox, [role='dialog'], .ui-dialog");
  const count = await dialogs.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const dialog = dialogs.nth(index);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    const body = await dialog.innerText().catch(() => "");
    if (!/(?:flight|ship|airport|port|not found|unknown|unable|조회|항공|선박|공항|항구|없)/iu.test(body)) continue;
    const confirmation = dialog
      .locator("button, input[type='button'], input[type='submit'], a, [role='button']")
      .filter({ hasText: /^(?:ok|confirm|close|확인|닫기)$/iu })
      .first();
    if (await confirmation.count().catch(() => 0) === 0 || !(await confirmation.isVisible().catch(() => false))) {
      throw new KrEArrivalPortalError(
        `Official Korea e-Arrival Card ${label} lookup prompt has no observable confirmation control.`,
        { code: "kr_eac_travel_lookup_prompt_drift", blocked: true },
      );
    }
    executionContext?.assertOwned();
    await confirmation.click({ timeout: 15_000 });
    logs.push(`kr_eac_${label}_lookup_prompt_acknowledged`);
    return;
  }
}

async function lookupOfficialTravelLocation(
  page: Page,
  scope: string,
  segment: "E" | "D",
  identifier: string | null,
  expectedCountry: string | null,
  expectedCity: string | null,
  label: string,
  logs: string[],
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const hasExpectedLocation = Boolean(expectedCountry || expectedCity);
  if (!identifier) {
    if (hasExpectedLocation) {
      throw new KrEArrivalPortalError(
        `Korea e-Arrival Card ${label} location cannot be verified without a flight or ship identifier.`,
        { code: "kr_eac_travel_lookup_input_missing", blocked: true },
      );
    }
    return;
  }

  const lookup = await findVisible(page, [`${scope} .btnSrchNav[data-edgb='${segment}']`]);
  if (!lookup) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} travel lookup control was not observable.`,
      { code: "kr_eac_travel_lookup_selector_drift", blocked: true },
    );
  }
  executionContext?.assertOwned();
  await lookup.click({ timeout: 20_000 });
  await page.waitForTimeout(750);
  await acknowledgeOfficialTravelLookupPrompt(page, label, logs, executionContext);

  const countrySelector = segment === "E"
    ? [`${scope} .ent_strp_nat_nm`]
    : [`${scope} .dep_strp_nat_nm`];
  const citySelector = segment === "E"
    ? [`${scope} .ent_str_apt`]
    : [`${scope} .dep_str_apt`];
  const observedCountry = await readOfficialTravelLookupValue(page, countrySelector);
  const observedCity = await readOfficialTravelLookupValue(page, citySelector);

  if (expectedCountry && !travelLookupMatches(expectedCountry, observedCountry)) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} country lookup did not match the saved answer.`,
      { code: "kr_eac_travel_lookup_mismatch", blocked: true },
    );
  }
  if (expectedCity && !travelLookupMatches(expectedCity, observedCity)) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} airport or port lookup did not match the saved answer.`,
      { code: "kr_eac_travel_lookup_mismatch", blocked: true },
    );
  }
  logs.push(`kr_eac_${label}_lookup_${observedCountry || observedCity ? "matched" : "unresolved"}`);
}

async function chooseNationality(
  page: Page,
  code: string,
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const selector = page.locator(".info_wrap.applyNo01 .info_nat").first();
  await selector.waitFor({ state: "visible", timeout: 30_000 });
  executionContext?.assertOwned();
  await selector.click();
  // The nationality widget uses its own option class on the official page;
  // the generic `.as-options-value` class belongs to unrelated dropdowns.
  const options = page.locator(".nat-options-value");
  await options.first().waitFor({ state: "visible", timeout: 30_000 });
  const normalized = code.trim().toUpperCase();
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index);
    if (!(await option.isVisible().catch(() => false))) continue;
    const candidate = await option.evaluate((element) => ({
      code: element.getAttribute("data-code")?.trim().toUpperCase() ?? "",
      text: element.textContent?.trim().toUpperCase() ?? "",
      nat: element.getAttribute("data-natEnchr3PosCd")?.trim().toUpperCase() ?? "",
    }));
    if (candidate.code === normalized || candidate.nat === normalized || candidate.text === normalized || candidate.text.includes(normalized)) {
      executionContext?.assertOwned();
      await option.click();
      const selected = page.locator(".info_wrap.applyNo01 .info_nat").first();
      const selectedCode = await selected.getAttribute("data-code").catch(() => null);
      const selectedNat = await selected.getAttribute("data-natenchr3poscd").catch(() => null);
      if ((!selectedCode || selectedCode.trim() !== candidate.code)
        && (!selectedNat || selectedNat.trim().toUpperCase() !== candidate.nat)) {
        throw new KrEArrivalPortalError(
          "Official Korea e-Arrival Card nationality widget did not commit the selected country.",
          { code: "kr_eac_nationality_widget_drift", blocked: true },
        );
      }
      return;
    }
  }
  throw new KrEArrivalPortalError(
    `Official Korea e-Arrival Card nationality option ${code} was not found.`,
    { code: "kr_eac_official_nationality_drift", blocked: true },
  );
}

async function waitForOfficialLanding(page: Page, logs: string[]): Promise<string> {
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => undefined);
  const body = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
  logs.push(`kr_eac_landing_url ${new URL(page.url()).pathname}`);
  if (/web page blocked|url you requested has been blocked|access denied|cloudflare|forbidden/i.test(body)) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card portal blocked the browser session.",
      { code: "kr_eac_official_portal_blocked", portalSummary: safeSummary(body), retryable: true },
    );
  }
  return body;
}

async function openIndividualForm(
  page: Page,
  payload: KrEArrivalPortalPayload,
  logs: string[],
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  executionContext?.assertOwned();
  await page.goto(KR_EARRIVAL_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForOfficialLanding(page, logs);
  await clickVisible(page, ["label[for='chkAgreement1']"], "required privacy consent", executionContext);
  await clickVisible(page, ["label[for='chkAgreement3']"], "terms consent", executionContext);
  await clickVisible(page, ["label[for='chkAgreement4']"], "representative age consent", executionContext);
  await fillInput(page, "#emlAddr1", payload.emailAddress, "representative email");
  await fillInput(page, "#emlAddr2", payload.emailAddress, "representative email confirmation");
  await clickVisible(page, ["#btnOk"], "agreement confirmation", executionContext);
  await page.waitForURL(/\/portal\/apply\/individual\.do/i, { timeout: 45_000 }).catch(() => undefined);
  await page.locator(".info_wrap.applyNo01").waitFor({ state: "visible", timeout: 45_000 });
  const ocrClose = await findVisible(page, ["#btnPopClose"]);
  if (ocrClose) {
    executionContext?.assertOwned();
    await ocrClose.click({ timeout: 20_000 });
    await page.locator("#btnPopClose").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
    logs.push("kr_eac_passport_ocr_modal_closed_manual_entry");
  }
}

async function fillOfficialForm(
  page: Page,
  payload: KrEArrivalPortalPayload,
  logs: string[],
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const scope = ".info_wrap.applyNo01";
  await fillInput(page, `${scope} .ps_fmnm`, payload.surname, "surname");
  await fillInput(page, `${scope} .ps_gvnm`, payload.givenName, "given name");
  await fillDate(page, {
    year: `${scope} .btd_year`,
    month: `${scope} .btd_month`,
    day: `${scope} .btd_day`,
  }, payload.dateOfBirth, "date of birth");
  await chooseNationality(page, payload.nationality, executionContext);
  await selectExact(page, `${scope} .sd_cd`, payload.gender, "gender");
  await fillInput(page, `${scope} .ps_no`, payload.passportNumber, "passport number");
  await fillDate(page, {
    year: `${scope} .ps_expr_year`,
    month: `${scope} .ps_expr_month`,
    day: `${scope} .ps_expr_day`,
  }, payload.passportExpiryDate, "passport expiry");

  await clickVisible(
    page,
    payload.arrivalMode === "air" ? [`${scope} .btnEntAir`] : [`${scope} .btnEntSea`],
    "arrival mode",
    executionContext,
  );
  await fillInput(page, `${scope} .ent_prr_ymd`, payload.arrivalDate, "arrival date");
  if (payload.arrivalMode === "air") {
    await fillInput(page, `${scope} .ent_cno_nm`, payload.arrivalFlightNumber ?? "", "arrival flight");
  } else {
    await fillInput(page, `${scope} .ent_ship_nm`, payload.arrivalShipName ?? "", "arrival ship");
  }
  await lookupOfficialTravelLocation(
    page,
    scope,
    "E",
    payload.arrivalMode === "air" ? payload.arrivalFlightNumber : payload.arrivalShipName,
    payload.previousDepartureCountry,
    payload.previousDepartureCity,
    "previous-departure",
    logs,
    executionContext,
  );

  await clickVisible(
    page,
    payload.departureMode === "air" ? [`${scope} .btnDepAir`] : [`${scope} .btnDepSea`],
    "departure mode",
    executionContext,
  );
  await fillInput(page, `${scope} .dep_prr_ymd`, payload.departureDate, "departure date");
  if (payload.departureMode === "air" && payload.departureFlightNumber) {
    await fillInput(page, `${scope} .dep_cno_nm`, payload.departureFlightNumber, "departure flight");
  }
  if (payload.departureMode === "sea" && payload.departureShipName) {
    await fillInput(page, `${scope} .dep_ship_nm`, payload.departureShipName, "departure ship");
  }
  await lookupOfficialTravelLocation(
    page,
    scope,
    "D",
    payload.departureMode === "air" ? payload.departureFlightNumber : payload.departureShipName,
    payload.nextDestinationCountry,
    payload.nextDestinationCity,
    "next-destination",
    logs,
    executionContext,
  );

  await selectExact(page, `${scope} .ent_purp_cd`, payload.purposeCode, "entry purpose");
  if (payload.purposeCode === "99" && payload.purposeOther) {
    await fillInput(page, `${scope} .ent_purp_cd_dir`, payload.purposeOther, "entry purpose details");
  }
  await selectOfficialStayAddress(page, payload, executionContext);
  if (payload.addressDetail) {
    await fillInput(page, `${scope} .soj_prrpl_rnm_det_addr`, payload.addressDetail, "stay address detail");
  }
  await fillInput(page, `${scope} .soj_prrar_tel`, payload.koreaContactNumber, "Korea contact number");
  await selectExact(page, `${scope} .occp_cd`, payload.occupationCode, "occupation");
  if (payload.occupationCode === "99" && payload.occupationOther) {
    await fillInput(page, `${scope} .occp_cd_dir`, payload.occupationOther, "occupation details");
  }
  const representativeEmail = page.locator(`${scope} .rep_eml_addr`).first();
  const representativeValue = await representativeEmail.inputValue().catch(() => "");
  if (representativeValue && representativeValue.toLowerCase() !== payload.emailAddress.toLowerCase()) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card representative email does not match the managed alias.",
      { code: "kr_eac_email_state_drift", blocked: true },
    );
  }
  if (payload.dodIdNumber) await fillInput(page, `${scope} .idcdNo`, payload.dodIdNumber, "DoD ID");

  await validateDynamicOfficialFields(page, payload.additionalAnswers, executionContext);
  logs.push("kr_eac_form_filled");
}

async function validateDynamicOfficialFields(
  page: Page,
  answers: Record<string, string>,
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const rows = page.locator(".info_wrap.applyNo01 .ansRow");
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    if (!(await row.isVisible().catch(() => false))) continue;
    const field = row.locator("input:not([type='hidden']), select, textarea").first();
    const fieldCount = await field.count().catch(() => 0);
    if (fieldCount === 0) continue;
    const key = await field.getAttribute("name").catch(() => null)
      ?? await row.getAttribute("data-item-cd").catch(() => null);
    const value = key ? answers[key] : undefined;
    if (KR_EARRIVAL_ADDITIONAL_QUESTION_KEYS.length === 0 || !key || !isOfficialAdditionalQuestionKey(key)) {
      throw new KrEArrivalPortalError(
        `Official Korea e-Arrival Card displayed an unreviewed conditional field${key ? ` ${key}` : ""}.`,
        { code: "kr_eac_dynamic_field_drift", blocked: true },
      );
    }
    if (!value) {
      throw new KrEArrivalPortalError(
        `Official Korea e-Arrival Card displayed an unmapped conditional field${key ? ` ${key}` : ""}.`,
        { code: "kr_eac_dynamic_field_drift" },
      );
    }
    const tagName = await field.evaluate((element) => element.tagName.toLowerCase());
    const inputType = tagName === "input"
      ? (await field.getAttribute("type").catch(() => null))?.toLowerCase() ?? "text"
      : "";
    if (tagName === "select") {
      const options = await field.locator("option").evaluateAll((elements) =>
        elements.map((element) => ({
          value: (element as HTMLOptionElement).value.trim(),
          label: element.textContent?.trim() ?? "",
        })),
      );
      const selected = options.find((option) => option.value === value || option.label === value);
      if (!selected) {
        throw new KrEArrivalPortalError(
          `Official Korea e-Arrival Card dynamic option ${key} is not present in the portal snapshot.`,
          { code: "kr_eac_dynamic_field_drift", blocked: true },
        );
      }
      executionContext?.assertOwned();
      await field.selectOption({ value: selected.value });
      continue;
    }
    if (inputType === "radio" || inputType === "checkbox") {
      const controls = row.locator(`input[type='${inputType}']`);
      const controlCount = await controls.count();
      let selectedControl: Locator | null = null;
      for (let controlIndex = 0; controlIndex < controlCount; controlIndex += 1) {
        const control = controls.nth(controlIndex);
        const controlValue = (await control.getAttribute("value").catch(() => ""))?.trim() ?? "";
        const label = await control.evaluate((element) => {
          const closestLabel = element.closest("label");
          return closestLabel?.textContent?.trim() ?? "";
        }).catch(() => "");
        if (controlValue === value || label === value) {
          selectedControl = control;
          break;
        }
      }
      if (!selectedControl) {
        throw new KrEArrivalPortalError(
          `Official Korea e-Arrival Card dynamic ${inputType} option ${key} is not present in the portal snapshot.`,
          { code: "kr_eac_dynamic_field_drift", blocked: true },
        );
      }
      executionContext?.assertOwned();
      await selectedControl.check();
      continue;
    }
    if (!(await field.isEditable().catch(() => false))) {
      throw new KrEArrivalPortalError(
        `Official Korea e-Arrival Card dynamic field ${key} is not editable.`,
        { code: "kr_eac_dynamic_field_drift", blocked: true },
      );
    }
    executionContext?.assertOwned();
    await field.fill(value);
  }
}

function extractSixDigitCode(message: Pick<InboundMessage, "subject" | "text" | "html">): string | null {
  const visibleHtml = (message.html ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ");
  return /(?<![\w-])\d{6}(?![\w-])/u.exec([message.subject ?? "", message.text ?? "", visibleHtml].join("\n"))?.[0] ?? null;
}

async function handleEmailVerification(
  page: Page,
  applicantId: string | undefined,
  screenshots: string[],
  logs: string[],
  tempDir: string,
  sensitiveValues: string[],
  executionContext?: RunnerExecutionContext,
): Promise<boolean> {
  const sendButton = await findVisible(page, ["#btnSendAuthNo", ".btnSendAuthNo"]);
  const codeInput = await findVisible(page, [".auth_no", "input[name='certCd']"]);
  if (!sendButton && !codeInput) return false;
  if (!applicantId) throw new KrEArrivalPortalError("Korea e-Arrival Card email verification requires an applicant inbox identity.", { code: "kr_eac_otp_applicant_missing" });

  screenshots.push(await saveScreenshot(page, tempDir, "email-verification", logs, sensitiveValues));
  const requestedAfter = new Date().toISOString();
  if (sendButton) {
    executionContext?.assertOwned();
    await sendButton.click({ timeout: 15_000 });
  }
  const timeoutMs = Number.parseInt(process.env.KR_EAC_OTP_TIMEOUT_MS ?? "300000", 10);
  let message: InboundMessage;
  try {
    message = await inbox.waitForMessage(
      applicantId,
      (candidate) => {
        const content = [candidate.subject ?? "", candidate.text ?? "", candidate.html ?? ""].join("\n");
        return /e-?arrival|arrival card|verification|인증/i.test(content) && extractSixDigitCode(candidate) !== null;
      },
      Number.isFinite(timeoutMs) ? Math.max(10_000, timeoutMs) : 300_000,
      { since: requestedAfter, pollIntervalMs: 3_000 },
    );
  } catch (error) {
    const code = error instanceof InboxDomainUnroutableError
      ? "kr_eac_otp_inbox_unroutable"
      : error instanceof InboxTimeoutError
        ? "kr_eac_otp_delivery_timeout"
        : "kr_eac_otp_inbox_failed";
    throw new KrEArrivalPortalError(
      "Korea e-Arrival Card verification email was not received by the managed inbox.",
      { code, screenshotPaths: screenshots, logs, retryable: error instanceof InboxTimeoutError },
    );
  }
  const code = extractSixDigitCode(message);
  if (!code) throw new KrEArrivalPortalError("Korea e-Arrival Card verification email did not contain a six-digit code.", { code: "kr_eac_otp_code_missing" });
  const currentCodeInput = codeInput ?? await findVisible(page, [".auth_no", "input[name='certCd']"]);
  if (!currentCodeInput) throw new KrEArrivalPortalError("Korea e-Arrival Card verification code input was not available.", { code: "kr_eac_otp_selector_drift" });
  await currentCodeInput.fill(code);
  const verify = await findVisible(page, ["#btnAuth", ".btnAuth"]);
  if (!verify) throw new KrEArrivalPortalError("Korea e-Arrival Card verification button was not available.", { code: "kr_eac_otp_selector_drift" });
  executionContext?.assertOwned();
  await verify.click({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
  const accepted = await page.locator("#emailCertChk").inputValue().catch(() => "") === "Y";
  if (!accepted && await findVisible(page, [".auth_no", "input[name='certCd']"])) {
    throw new KrEArrivalPortalError("Korea e-Arrival Card rejected the email verification code.", { code: "kr_eac_otp_rejected", screenshotPaths: screenshots });
  }
  logs.push("kr_eac_otp_verified");
  return true;
}

async function solveVisibleCaptcha(page: Page, logs: string[], executionContext?: RunnerExecutionContext): Promise<boolean> {
  const image = await findVisible(page, ["img[src*='captcha' i]", ".captcha img", "[class*='captcha' i] img"]);
  const recaptchaFrame = await findVisible(page, ["iframe[src*='recaptcha' i]", "iframe[src*='turnstile' i]"]);
  if (!image && !recaptchaFrame) return false;
  if (recaptchaFrame) {
    const frameSrc = await recaptchaFrame.getAttribute("src").catch(() => "");
    const siteKey = await recaptchaFrame.getAttribute("data-sitekey").catch(() => null)
      ?? await page.locator("[data-sitekey]").first().getAttribute("data-sitekey").catch(() => null);
    if (!siteKey) throw new KrEArrivalPortalError("Official Korea e-Arrival Card CAPTCHA site key was not observable.", { code: "kr_eac_captcha_selector_drift" });
    const type = /turnstile/i.test(frameSrc ?? "") ? "turnstile" : "recaptcha-v2";
    executionContext?.assertOwned();
    const solved = await solveCaptcha({ type, siteKey, pageUrl: page.url() });
    const response = page.locator("textarea[name='g-recaptcha-response'], textarea[name='cf-turnstile-response'], input[name='cf-turnstile-response']").first();
    await response.evaluate((element, token) => {
      const field = element as HTMLInputElement | HTMLTextAreaElement;
      field.value = token;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }, solved.text);
    logs.push("kr_eac_captcha_token_solved");
    return true;
  }

  const screenshot = await image!.screenshot();
  executionContext?.assertOwned();
  const solved = await solveImageCaptcha(screenshot, Number.parseInt(process.env.KR_EAC_CAPTCHA_TIMEOUT_MS ?? "120000", 10), { case: true });
  const input = await findVisible(page, ["input[name*='captcha' i]", "#captchaInput", ".captcha input:not([type='hidden'])"]);
  if (!input) throw new KrEArrivalPortalError("Official Korea e-Arrival Card CAPTCHA input was not observable.", { code: "kr_eac_captcha_selector_drift" });
  await input.fill(solved.text);
  const verify = await findVisible(page, ["#captchaConfirm", ".captcha button", "[role='dialog'] button"]);
  if (!verify) throw new KrEArrivalPortalError("Official Korea e-Arrival Card CAPTCHA confirmation control was not observable.", { code: "kr_eac_captcha_selector_drift" });
  executionContext?.assertOwned();
  await verify.click({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
  const result = await page.locator("#captchaResult").inputValue().catch(() => "");
  if (result !== "Y" && await findVisible(page, ["img[src*='captcha' i]", ".captcha img"])) {
    executionContext?.assertOwned();
    await reportBadCaptcha(solved.solveId).catch(() => undefined);
    throw new KrEArrivalPortalError("Official Korea e-Arrival Card rejected the CAPTCHA solution.", { code: "kr_eac_captcha_rejected", retryable: true });
  }
  logs.push("kr_eac_captcha_solved");
  return true;
}

async function confirmOfficialReview(page: Page, executionContext?: RunnerExecutionContext): Promise<void> {
  const dialog = await findVisible(page, [".popBox", "[role='dialog']", ".popup"]);
  if (!dialog) return;
  const text = await dialog.innerText().catch(() => "");
  if (!/correct|confirm|확인|입력한 정보/i.test(text)) return;
  const button = await findVisible(page, [".popBox button:has-text('확인')", ".popBox button:has-text('OK')", "[role='dialog'] button"]);
  if (!button) throw new KrEArrivalPortalError("Official Korea e-Arrival Card review confirmation control was not observable.", { code: "kr_eac_review_selector_drift" });
  executionContext?.assertOwned();
  await button.click({ timeout: 15_000 });
}

function extractIssueNumber(pageText: string): string | null {
  const patterns = [
    /(?:issue|reference|confirmation)\s*(?:number|no\.?|id)?\s*[:#-]?\s*([A-Z0-9-]{6,})/iu,
    /(?:발급번호|신고번호|접수번호)\s*[:#-]?\s*([A-Z0-9-]{6,})/u,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(pageText);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

async function extractIssueNumberAsync(pageText: string, page: Page): Promise<string | null> {
  for (const selector of ["input[name='eacIssNo']", "input[name='eacRepIssNo']", "#iss_no"]) {
    const candidate = await page.locator(selector).first().inputValue().catch(() => "");
    if (candidate.trim()) return candidate.trim();
  }
  return extractIssueNumber(pageText);
}

async function saveOfficialPdf(
  page: Page,
  dir: string,
  logs: string[],
  executionContext?: RunnerExecutionContext,
): Promise<string[]> {
  const pdfPath = path.join(dir, `korea-e-arrival-confirmation-${Date.now()}.pdf`);
  const downloadLink = await findVisible(page, ["a[href*='pdf' i]", "a[href*='download' i]", "button:has-text('PDF')", "button:has-text('Download')"]);
  if (downloadLink) {
    try {
      executionContext?.assertOwned();
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 10_000 }),
        downloadLink.click({ timeout: 15_000 }),
      ]);
      await download.saveAs(pdfPath);
      logs.push("kr_eac_official_pdf_downloaded");
      return [pdfPath];
    } catch (error) {
      logs.push(`kr_eac_pdf_download_unavailable ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  try {
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
    const stat = fs.statSync(pdfPath);
    if (stat.size > 500) {
      logs.push("kr_eac_confirmation_page_pdf_fallback");
      return [pdfPath];
    }
  } catch (error) {
    logs.push(`kr_eac_pdf_fallback_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  return [];
}

export async function runKrEArrivalPortalSubmission(
  payload: KrEArrivalPortalPayload,
  options: {
    applicantId?: string;
    headless?: boolean;
    stopBeforeSubmit?: boolean;
    executionContext?: RunnerExecutionContext;
  } = {},
): Promise<KrEArrivalPortalSubmissionResult> {
  options.executionContext?.assertOwned();
  const logs: string[] = [`kr_eac_start application=${payload.applicationId}`];
  const screenshots: string[] = [];
  const pdfs: string[] = [];
  const sensitiveValues = [
    payload.passportNumber,
    payload.emailAddress,
    payload.dodIdNumber ?? "",
    payload.koreaContactNumber,
  ];
  const tempDir = makeTempDir();
  options.executionContext?.assertOwned();
  const browserSession = await launchAbortableResource(
    options.executionContext?.signal,
    () => createArrivalCardBrowserSession({ prefix: "KR_EAC", headless: options.headless }),
    (resource) => resource.close(),
  );
  const page = browserSession.page;
  const abortListener = (): void => { void browserSession.close().catch(() => undefined); };
  options.executionContext?.signal.addEventListener("abort", abortListener, { once: true });
  logs.push(`kr_eac_browser_provider=${browserSession.provider}`);
  logs.push(...browserSession.diagnostics.map((diagnostic) => safeSummary(diagnostic, sensitiveValues)));

  try {
    await openIndividualForm(page, payload, logs, options.executionContext);
    screenshots.push(await saveScreenshot(page, tempDir, "form-landing", logs, sensitiveValues));
    await fillOfficialForm(page, payload, logs, options.executionContext);
    screenshots.push(await saveScreenshot(page, tempDir, "after-fill", logs, sensitiveValues));

    if (options.stopBeforeSubmit) {
      throw new KrEArrivalPortalError(
        "Korea e-Arrival Card runner stopped before the final official submit action.",
        { code: "kr_eac_stopped_before_submit", screenshotPaths: screenshots, logs, blocked: true },
      );
    }

    options.executionContext?.assertOwned();
    await clickVisible(page, ["#btnSubmit"], "final submit", options.executionContext);
    await page.waitForTimeout(500);
    await confirmOfficialReview(page, options.executionContext);
    await handleEmailVerification(page, options.applicantId, screenshots, logs, tempDir, sensitiveValues, options.executionContext);
    await solveVisibleCaptcha(page, logs, options.executionContext);
    await confirmOfficialReview(page, options.executionContext);
    options.executionContext?.assertOwned();
    await page.waitForLoadState("domcontentloaded", { timeout: 90_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    screenshots.push(await saveScreenshot(page, tempDir, "after-submit", logs, sensitiveValues));

    const body = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
    const issueNumber = await extractIssueNumberAsync(body, page);
    const successMarker = /submitted|success|발급번호|전자입국신고서.*발급|신고가 완료/i.test(body)
      || /goSubmit|result|complete/i.test(page.url());
    if (!successMarker || !issueNumber) {
      throw new KrEArrivalPortalError(
        "Official Korea e-Arrival Card did not return both a success page and issue number.",
        { code: "kr_eac_confirmation_not_reached", screenshotPaths: screenshots, logs, portalSummary: safeSummary(body, sensitiveValues), retryable: true },
      );
    }
    pdfs.push(...await saveOfficialPdf(page, tempDir, logs, options.executionContext));
    logs.push("kr_eac_official_confirmation_observed");
    const submittedAt = new Date().toISOString();
    const validUntil = new Date(Date.parse(submittedAt) + 72 * 60 * 60 * 1000).toISOString();
    return {
      submitted: true,
      issueNumber,
      confirmationNumber: issueNumber,
      referenceNumber: issueNumber,
      submittedAt,
      validUntil,
      arrivalDate: payload.arrivalDate,
      departureDate: payload.departureDate,
      portalUrl: KR_EARRIVAL_CHECK_EDIT_URL,
      portalResponseSummary: "Korea e-Arrival Card official confirmation page returned an issue number.",
      screenshots,
      pdfs,
      logs,
    };
  } catch (error) {
    if (error instanceof RunnerJobOwnershipLostError || options.executionContext?.signal.aborted) throw error;
    if (error instanceof KrEArrivalPortalError) {
      if (error.screenshotPaths.length === 0) {
        try { error.screenshotPaths.push(await saveScreenshot(page, tempDir, "error", logs, sensitiveValues)); } catch { /* best effort */ }
      }
      throw error;
    }
    throw new KrEArrivalPortalError(
      "Korea e-Arrival Card official portal run failed.",
      {
        code: "kr_eac_runner_failed",
        screenshotPaths: screenshots,
        logs,
        portalSummary: safeSummary(await page.locator("body").innerText().catch(() => ""), sensitiveValues),
        retryable: true,
      },
    );
  } finally {
    options.executionContext?.signal.removeEventListener("abort", abortListener);
    await closeResourceBestEffort(browserSession);
  }
}
