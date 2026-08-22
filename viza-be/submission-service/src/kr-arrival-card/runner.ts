import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type Locator, type Page } from "@playwright/test";
import { solveCaptcha, solveImageCaptcha, reportBadCaptcha } from "../captcha/index.js";
import {
  createArrivalCardBrowserSession,
  isRemoteBrowserProviderPolicyBlockMessage,
} from "../arrival-card-browser.js";
import { inbox, type InboundMessage, InboxDomainUnroutableError, InboxTimeoutError } from "../inbox/wait-for-message.js";
import { closeResourceBestEffort, launchAbortableResource } from "../queue/portal-safety.js";
import { RunnerJobOwnershipLostError, type RunnerExecutionContext } from "../queue/execution-context.js";
import {
  KR_EARRIVAL_ADDITIONAL_QUESTION_KEYS,
  isOfficialAdditionalQuestionKey,
} from "./official-options.js";
import {
  classifyOfficialTravelLookup,
  KR_EARRIVAL_CHECK_EDIT_URL,
  KR_EARRIVAL_OFFICIAL_PORTAL_URL,
  officialTravelLookupMatches,
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

function safeErrorMessage(error: unknown, sensitiveValues: string[] = []): string {
  const message = error instanceof Error ? error.message : String(error);
  return safeSummary(message.split("\n")[0] ?? message, sensitiveValues);
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
        styledElements: Array<{ element: HTMLElement; style: string | null }>;
        textNodes: Array<{ node: Text; value: string }>;
      };
    };
    const state = {
      elements: [] as Array<{ element: HTMLInputElement | HTMLTextAreaElement; value: string }>,
      styledElements: [] as Array<{ element: HTMLElement; style: string | null }>,
      textNodes: [] as Array<{ node: Text; value: string }>,
    };
    const replacements = values.filter((value) => value.trim()).map((value) => [value, "[redacted]"] as const);
    // File input values are browser-protected and assigning a non-empty value
    // throws a DOMException. They never contain typed form answers, so leave
    // them untouched while masking every text-like control.
    const fieldSelector = "input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']):not([type='file']), textarea";
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(fieldSelector).forEach((element) => {
      state.elements.push({ element, value: element.value });
      element.value = "[redacted]";
    });
    document.querySelectorAll<HTMLElement>("select").forEach((element) => {
      state.styledElements.push({ element, style: element.getAttribute("style") });
      element.style.setProperty("color", "transparent", "important");
      element.style.setProperty("text-shadow", "0 0 8px rgba(0, 0, 0, 0.9)", "important");
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      const parent = textNode.parentElement;
      if (parent && !/^(SCRIPT|STYLE|NOSCRIPT)$/u.test(parent.tagName)) {
        let replacement = textNode.nodeValue ?? "";
        for (const [needle, redacted] of replacements) {
          replacement = replacement.split(needle).join(redacted);
        }
        replacement = replacement
          .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[email]")
          .replace(/\b\d{6}\b/gu, "[otp]")
          .replace(/\b\d{7,}\b/gu, "[redacted-number]");
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
          styledElements: Array<{ element: HTMLElement; style: string | null }>;
          textNodes: Array<{ node: Text; value: string }>;
        };
      };
      const state = currentWindow[stateKey];
      if (!state) return;
      for (const entry of state.elements) entry.element.value = entry.value;
      for (const entry of state.styledElements) {
        if (entry.style === null) entry.element.removeAttribute("style");
        else entry.element.setAttribute("style", entry.style);
      }
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

async function runOfficialDateRefresh(
  page: Page,
  selectors: { year: string; month: string; day: string },
): Promise<boolean> {
  return page.evaluate(({ yearSelector, monthSelector, daySelector }) => {
    const year = document.querySelector(yearSelector);
    const month = document.querySelector(monthSelector);
    const day = document.querySelector(daySelector);
    if (!(year instanceof HTMLSelectElement)
      || !(month instanceof HTMLSelectElement)
      || !(day instanceof HTMLSelectElement)) return false;
    if (year.disabled || month.disabled || year.value === "N" || month.value === "N") return false;

    const jquery = (window as unknown as {
      jQuery?: (element: Element) => { trigger: (eventName: string) => void };
    }).jQuery;
    if (!jquery) return false;

    // Browserbase exposes native selects through individual accessibility
    // wrappers. Korea's own month-change handler expects the original year,
    // month, and day selects to be siblings, so temporarily restore that
    // relationship while invoking the portal's handler. The portal remains
    // responsible for generating the permitted day options.
    const yearParent = year.parentNode;
    const monthParent = month.parentNode;
    const dayParent = day.parentNode;
    if (!(yearParent instanceof HTMLElement)
      || !(monthParent instanceof HTMLElement)
      || !(dayParent instanceof HTMLElement)
      || !yearParent.classList.contains("bb-custom-select-container")
      || !monthParent.classList.contains("bb-custom-select-container")
      || !dayParent.classList.contains("bb-custom-select-container")
      || !monthParent.parentNode) return false;

    const yearNext = year.nextSibling;
    const monthNext = month.nextSibling;
    const dayNext = day.nextSibling;
    const bridge = document.createElement("div");
    monthParent.parentNode.insertBefore(bridge, monthParent);
    try {
      bridge.append(year, month, day);
      jquery(month).trigger("change");
    } finally {
      yearParent.insertBefore(year, yearNext);
      monthParent.insertBefore(month, monthNext);
      dayParent.insertBefore(day, dayNext);
      bridge.remove();
    }
    return !day.disabled && day.options.length > 1;
  }, {
    yearSelector: selectors.year,
    monthSelector: selectors.month,
    daySelector: selectors.day,
  });
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
  const dayOption = page.locator(selectors.day).first().locator(`option[value="${match[3]}"]`);
  await dayOption.waitFor({
    state: "attached",
    timeout: 2_000,
  }).catch(() => undefined);
  if (!(await dayOption.count())) {
    const refreshed = await runOfficialDateRefresh(page, selectors).catch(() => false);
    if (!refreshed) {
      throw new KrEArrivalPortalError(
        `Official Korea e-Arrival Card ${label} date widget did not generate day options.`,
        { code: "kr_eac_date_widget_incompatible", blocked: true },
      );
    }
  }
  await selectExact(page, selectors.day, match[3], `${label} day`);
}

async function clickVisible(
  page: Page,
  selectors: string[],
  label: string,
  executionContext?: RunnerExecutionContext,
  options: { noWaitAfter?: boolean } = {},
): Promise<void> {
  const target = await findVisible(page, selectors);
  if (!target) throw new KrEArrivalPortalError(`Official Korea e-Arrival Card ${label} control was not found.`, { code: "kr_eac_selector_drift" });
  executionContext?.assertOwned();
  await target.click({ timeout: 20_000, noWaitAfter: options.noWaitAfter }).catch((error) => {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} control could not be clicked.`,
      {
        code: "kr_eac_control_click_failed",
        portalSummary: safeSummary(error instanceof Error ? error.message : String(error)),
        blocked: true,
      },
    );
  });
}

async function setRequiredAgreement(
  page: Page,
  selector: string,
  label: string,
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const checkbox = page.locator(selector).first();
  await checkbox.waitFor({ state: "attached", timeout: 30_000 }).catch(() => {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} checkbox was not found.`,
      { code: "kr_eac_agreement_selector_drift", blocked: true },
    );
  });
  if (await checkbox.isDisabled().catch(() => true)) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} checkbox is disabled.`,
      { code: "kr_eac_agreement_not_editable", blocked: true },
    );
  }
  if (!(await checkbox.isChecked().catch(() => false))) {
    executionContext?.assertOwned();
    // The official checkbox is visually covered by its custom check-mark span.
    // Browserbase may accept a click on the surrounding label without toggling
    // the native input, so set the real checkbox and then verify its committed
    // state before the portal's Confirm action.
    await checkbox.setChecked(true, { force: true, timeout: 20_000 }).catch((error) => {
      throw new KrEArrivalPortalError(
        `Official Korea e-Arrival Card ${label} checkbox could not be selected.`,
        {
          code: "kr_eac_agreement_click_failed",
          portalSummary: safeSummary(error instanceof Error ? error.message : String(error)),
          blocked: true,
        },
      );
    });
  }
  if (!(await checkbox.isChecked().catch(() => false))) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} checkbox did not retain its selected state.`,
      { code: "kr_eac_agreement_not_committed", blocked: true },
    );
  }
}

async function waitForIndividualFormAfterAgreement(
  page: Page,
  logs: string[],
  sensitiveValues: string[],
  timeoutMs = 25_000,
): Promise<void> {
  const form = page.locator(".info_wrap.applyNo01").first();
  const portalPrompt = page.locator(".popBox").filter({
    has: page.locator("#btnPopConfirm, #btnPopClose"),
  }).filter({
    hasNot: page.locator(".info_wrap.applyNo01"),
  }).first();
  const outcome = await Promise.race([
    form.waitFor({ state: "visible", timeout: timeoutMs }).then(() => "form" as const),
    portalPrompt.waitFor({ state: "visible", timeout: timeoutMs }).then(() => "prompt" as const),
  ]).catch(() => "timeout" as const);

  if (outcome === "form") return;

  const promptText = outcome === "prompt"
    ? safeSummary(await portalPrompt.innerText().catch(() => ""), sensitiveValues)
    : "";
  const currentPath = (() => {
    try { return new URL(page.url()).pathname; } catch { return "unknown"; }
  })();
  logs.push(`kr_eac_agreement_confirmation_${outcome} path=${currentPath}`);
  throw new KrEArrivalPortalError(
    outcome === "prompt"
      ? "Official Korea e-Arrival Card rejected the agreement confirmation."
      : "Official Korea e-Arrival Card did not open the individual declaration form after agreement confirmation.",
    {
      code: outcome === "prompt"
        ? "kr_eac_agreement_confirmation_rejected"
        : "kr_eac_individual_form_timeout",
      logs,
      portalSummary: promptText || `Agreement confirmation remained on ${currentPath}.`,
      retryable: outcome === "timeout",
      blocked: true,
    },
  );
}

async function submitAgreementConfirmation(
  page: Page,
  logs: string[],
  sensitiveValues: string[],
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const emailCheckPromise = page.waitForResponse((response) => {
    try {
      return new URL(response.url()).pathname === "/portal/apply/exptEmlChk.do";
    } catch {
      return false;
    }
  }, { timeout: 20_000 }).then(async (response) => ({
    observed: true as const,
    ok: response.ok(),
    status: response.status(),
    rejected: (await response.text().catch(() => "")).trim() === "Y",
  })).catch(() => ({ observed: false as const }));

  await clickVisible(
    page,
    ["#btnOk"],
    "agreement confirmation",
    executionContext,
    { noWaitAfter: true },
  );
  const emailCheck = await emailCheckPromise;
  if (!emailCheck.observed) {
    logs.push("kr_eac_agreement_email_check_timeout");
  } else {
    logs.push(`kr_eac_agreement_email_check status=${emailCheck.status} decision=${emailCheck.rejected ? "rejected" : "allowed"}`);
    if (!emailCheck.ok) {
      throw new KrEArrivalPortalError(
        "Official Korea e-Arrival Card email eligibility check returned an HTTP error.",
        {
          code: "kr_eac_agreement_email_check_failed",
          logs,
          portalSummary: `Email eligibility check returned HTTP ${emailCheck.status}.`,
          retryable: true,
          blocked: true,
        },
      );
    }
    if (emailCheck.rejected) {
      throw new KrEArrivalPortalError(
        "Official Korea e-Arrival Card rejected the managed inbox address.",
        {
          code: "kr_eac_agreement_email_rejected",
          logs,
          portalSummary: "The official email eligibility endpoint rejected the managed inbox address.",
          blocked: true,
        },
      );
    }
  }

  await waitForIndividualFormAfterAgreement(page, logs, sensitiveValues);
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

function leadingAddressNumber(value: string): string | null {
  return /^\s*(\d+(?:-\d+)?)\b/u.exec(value)?.[1] ?? null;
}

async function acknowledgeOfficialAddressNoResultsPrompt(
  page: Page,
  executionContext?: RunnerExecutionContext,
): Promise<boolean> {
  const noResultsPattern = /(?:no\s+(?:search\s+)?results?|not\s+found|no\s+matching|검색\s*결과.*없|검색된.*없|주소.*찾.*없)/iu;
  const dialogs = page.locator(".popBox, [role='dialog'], .ui-dialog");
  const count = await dialogs.count().catch(() => 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const dialog = dialogs.nth(index);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    const body = await dialog.innerText().catch(() => "");
    if (!noResultsPattern.test(body)) continue;
    const confirmation = dialog
      .locator("button, input[type='button'], input[type='submit'], a, [role='button']")
      .filter({ hasText: /^(?:ok|confirm|close|확인|닫기)$/iu })
      .first();
    if (await confirmation.count().catch(() => 0) === 0 || !(await confirmation.isVisible().catch(() => false))) {
      throw new KrEArrivalPortalError(
        "Official Korea e-Arrival Card address no-results prompt has no observable confirmation control.",
        { code: "kr_eac_address_prompt_drift", blocked: true },
      );
    }
    executionContext?.assertOwned();
    await confirmation.click({ timeout: 15_000 });
    await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
    if (await dialog.isVisible().catch(() => false)) {
      throw new KrEArrivalPortalError(
        "Official Korea e-Arrival Card address no-results prompt did not close.",
        { code: "kr_eac_address_prompt_drift", blocked: true },
      );
    }
    return true;
  }
  return false;
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
  await button.click({ timeout: 20_000 }).catch((error) => {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address lookup control could not be opened.",
      {
        code: "kr_eac_address_widget_click_failed",
        portalSummary: safeSummary(error instanceof Error ? error.message : String(error)),
        blocked: true,
      },
    );
  });
  const postalOnly = !addressQuery || /^\d{5}$/u.test(addressQuery.trim());
  const keywordSelectors = postalOnly ? ["#keywordZipCode", "#keywordAddr"] : ["#keywordAddr"];
  await page.locator(keywordSelectors.join(",")).first().waitFor({
    state: "visible",
    timeout: 10_000,
  }).catch(() => undefined);
  const keyword = await findVisible(
    page,
    keywordSelectors,
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
  // The official search handler sometimes leaves a scheduled navigation
  // unresolved after its AJAX results are already rendered. Wait for the
  // observable result controls below instead of Playwright's navigation hook.
  await search.click({ timeout: 20_000, noWaitAfter: true }).catch((error) => {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address search could not be started.",
      {
        code: "kr_eac_address_search_click_failed",
        portalSummary: safeSummary(error instanceof Error ? error.message : String(error)),
        blocked: true,
      },
    );
  });
  const resultLinks = page.locator("[onclick*='addrSet(']");
  const searchDiagnostics: Array<{ links: number; parsed: number; postalMatches: number }> = [];
  const findMatchingResult = async (
    requireAddressMatch: boolean,
    requirePostalMatch = false,
    allowUniquePostalFallback = false,
  ): Promise<Locator | null> => {
    await resultLinks.first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    const count = await resultLinks.count();
    const postalCandidates: Locator[] = [];
    let parsedCount = 0;
    for (let index = 0; index < count; index += 1) {
      const candidate = resultLinks.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      const onclick = await candidate.getAttribute("onclick").catch(() => null);
      const match = onclick
        ? /addrSet\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/u.exec(onclick)
        : null;
      if (!match) continue;
      parsedCount += 1;
      const candidatePostal = match[1].trim();
      const candidateAddress = (language === "ko" ? match[3] : match[2]).trim();
      const postalMatches = candidatePostal === postalQuery.trim();
      const addressMatches = !postalOnly && addressQuery
        ? addressContainsOrMatches(addressQuery, candidateAddress)
        : true;
      if (postalMatches) postalCandidates.push(candidate);
      if (
        (requireAddressMatch && addressMatches && (!requirePostalMatch || postalMatches))
        || (!requireAddressMatch && postalMatches && addressMatches)
      ) {
        searchDiagnostics.push({ links: count, parsed: parsedCount, postalMatches: postalCandidates.length });
        return candidate;
      }
    }
    searchDiagnostics.push({ links: count, parsed: parsedCount, postalMatches: postalCandidates.length });
    return allowUniquePostalFallback && postalCandidates.length === 1
      ? postalCandidates[0] ?? null
      : null;
  };

  const findUniquePostalBuildingResult = async (
    postalKeyword: Locator,
    postalSearch: Locator,
  ): Promise<Locator | null> => {
    const savedBuildingNumber = leadingAddressNumber(addressQuery);
    if (!savedBuildingNumber || !postalQuery) return null;

    type AddressCandidate = {
      onclick: string;
      postal: string;
      address: string;
    };
    const readCandidates = async (): Promise<AddressCandidate[]> => resultLinks.evaluateAll((elements) => {
      const candidates = new Map<string, AddressCandidate>();
      for (const element of elements) {
        const onclick = element.getAttribute("onclick") ?? "";
        const match = /addrSet\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/u.exec(onclick);
        if (!match || candidates.has(onclick)) continue;
        candidates.set(onclick, { onclick, postal: match[1], address: match[2] });
      }
      return Array.from(candidates.values());
    });
    const findCandidateLocator = async (onclick: string): Promise<Locator | null> => {
      const count = await resultLinks.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = resultLinks.nth(index);
        if (await candidate.getAttribute("onclick").catch(() => "") === onclick) return candidate;
      }
      return null;
    };
    const goToNextPage = async (pageNumber: number): Promise<boolean> => {
      const firstBefore = await resultLinks.first().getAttribute("onclick").catch(() => "");
      const link = page.locator(`.pagination a[onclick*="fn_egov_link_page(${pageNumber})"]`).first();
      if (!(await link.isVisible().catch(() => false))) return false;
      executionContext?.assertOwned();
      await link.click({ timeout: 20_000, noWaitAfter: true });
      await page.waitForFunction(
        ({ selector, previous }) => {
          const first = document.querySelector(selector);
          return Boolean(first && first.getAttribute("onclick") !== previous);
        },
        { selector: "[onclick*='addrSet(']", previous: firstBefore },
        { timeout: 30_000 },
      ).catch(() => undefined);
      return (await resultLinks.first().getAttribute("onclick").catch(() => "")) !== firstBefore;
    };

    const totalCount = Number.parseInt(
      await page.locator("#totalCount").first().innerText().catch(() => "0"),
      10,
    );
    const firstPageCount = (await readCandidates()).length;
    const pageSize = Math.max(1, firstPageCount);
    const totalPages = Math.min(40, Math.max(1, Math.ceil(totalCount / pageSize)));
    const numberMatches: Array<{ page: number; onclick: string }> = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const candidates = await readCandidates();
      for (const candidate of candidates) {
        if (
          candidate.postal === postalQuery
          && leadingAddressNumber(candidate.address) === savedBuildingNumber
        ) {
          numberMatches.push({ page: pageNumber, onclick: candidate.onclick });
        }
      }
      if (pageNumber < totalPages && !(await goToNextPage(pageNumber + 1))) break;
    }

    const uniqueMatches = Array.from(
      new Map(numberMatches.map((match) => [match.onclick, match])).values(),
    );
    if (uniqueMatches.length !== 1) return null;

    const match = uniqueMatches[0];
    const firstBeforeRestart = await resultLinks.first().getAttribute("onclick").catch(() => "");
    await postalKeyword.fill(postalQuery);
    executionContext?.assertOwned();
    await postalSearch.click({ timeout: 20_000, noWaitAfter: true });
    await page.waitForFunction(
      ({ selector, previous }) => {
        const first = document.querySelector(selector);
        return Boolean(first && first.getAttribute("onclick") !== previous);
      },
      { selector: "[onclick*='addrSet(']", previous: firstBeforeRestart },
      { timeout: 30_000 },
    ).catch(() => undefined);
    for (let pageNumber = 2; pageNumber <= match.page; pageNumber += 1) {
      if (!(await goToNextPage(pageNumber))) return null;
    }
    return findCandidateLocator(match.onclick);
  };

  let selected = await findMatchingResult(!postalOnly && Boolean(addressQuery), Boolean(postalQuery));
  if (!selected && addressQuery && postalQuery) {
    // Address text can be transliterated or abbreviated in saved data. If the
    // address search has no exact result, use the official postal-code tab and
    // still require the returned ZIP/address pair to match the saved values.
    await acknowledgeOfficialAddressNoResultsPrompt(page, executionContext);
    const zipKeyword = await findVisible(page, ["#keywordZipCode", "#keywordAddr"]);
    const zipSearch = await findVisible(page, ["#btnSearchZipCode", "#btnSearchAddr"]);
    if (zipKeyword && zipSearch) {
      await zipKeyword.fill(postalQuery);
      executionContext?.assertOwned();
      await zipSearch.click({ timeout: 20_000, noWaitAfter: true }).catch((error) => {
        throw new KrEArrivalPortalError(
          "Official Korea e-Arrival Card postal-code search could not be started.",
          {
            code: "kr_eac_address_search_click_failed",
            portalSummary: safeSummary(error instanceof Error ? error.message : String(error)),
            blocked: true,
          },
        );
      });
      selected = await findMatchingResult(true, true, true);
      if (!selected) selected = await findUniquePostalBuildingResult(zipKeyword, zipSearch);
      if (!selected) await acknowledgeOfficialAddressNoResultsPrompt(page, executionContext);
    }
  }
  if (!selected) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address lookup did not return an exact matching result.",
      {
        code: "kr_eac_address_match_failed",
        portalSummary: safeSummary(JSON.stringify(searchDiagnostics)),
        blocked: true,
      },
    );
  }
  executionContext?.assertOwned();
  await selected.click({ timeout: 20_000 }).catch((error) => {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address result could not be selected.",
      {
        code: "kr_eac_address_result_click_failed",
        portalSummary: safeSummary(error instanceof Error ? error.message : String(error)),
        blocked: true,
      },
    );
  });
  await page.waitForTimeout(300);
  const korean = await page.locator("input.soj_prrpl_rnm_bs_han_addr").first().inputValue().catch(() => "");
  const english = await page.locator("input.soj_prrpl_rnm_bs_eng_addr").first().inputValue().catch(() => "");
  const postal = await page.locator("input.zip").first().inputValue().catch(() => "");
  if (
    !korean
    || !english
    || postal !== payload.postalCode
    || !addressContainsOrMatches(payload.addressKorean, korean)
    || !addressContainsOrMatches(payload.addressEnglish, english)
  ) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card address widget did not commit the selected Korean/English/ZIP address record.",
      { code: "kr_eac_address_commit_failed", blocked: true },
    );
  }
}

async function readOfficialTravelLookupValue(page: Page, selectors: string[]): Promise<string> {
  const field = page.locator(selectors.join(",")).first();
  if (await field.count().catch(() => 0) === 0) return "";
  return await field.inputValue().catch(async () => await field.getAttribute("value").catch(() => "") ?? "");
}

async function fillOfficialAirFlightNumber(
  page: Page,
  scope: string,
  segment: "E" | "D",
  flightNumber: string,
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  const normalized = flightNumber.trim().toUpperCase().replace(/\s+/gu, "");
  const airlineCode = /^([A-Z0-9]{2})[A-Z0-9]+$/u.exec(normalized)?.[1] ?? null;
  const selector = segment === "E" ? ".ent_str_cno_select" : ".dep_end_cno_select";
  const inputSelector = segment === "E" ? ".ent_cno_nm" : ".dep_cno_nm";
  const selectedCodeSelector = segment === "E" ? ".ent_cno_cd" : ".dep_cno_cd";
  const wrapper = await findVisible(page, [`${scope} ${selector}`]);
  if (!wrapper) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card airline selector was not observable.",
      { code: "kr_eac_airline_widget_drift", blocked: true },
    );
  }
  executionContext?.assertOwned();
  await wrapper.click({ timeout: 20_000 });
  const optionsSelector = `${scope} .cno-options[data-edgb='${segment}'] .cno-options-value`;
  const options = page.locator(optionsSelector);
  await options.first().waitFor({ state: "visible", timeout: 20_000 });
  const exact = airlineCode
    ? page.locator(`${optionsSelector}[data-code='${airlineCode}']`).first()
    : null;
  const direct = page.locator(`${optionsSelector}[data-code='direct']`).first();
  const exactVisible = exact ? await exact.isVisible().catch(() => false) : false;
  const selected = exactVisible && exact ? exact : direct;
  if (!(await selected.isVisible().catch(() => false))) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card airline option ${airlineCode ?? "direct"} was not found.`,
      { code: "kr_eac_airline_option_drift", blocked: true },
    );
  }
  executionContext?.assertOwned();
  await selected.click({ timeout: 20_000 }).catch((error) => {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card airline option could not be selected.",
      {
        code: "kr_eac_airline_option_click_failed",
        portalSummary: safeSummary(error instanceof Error ? error.message : String(error)),
        blocked: true,
      },
    );
  });
  const officialCode = await page.locator(`${scope} ${selectedCodeSelector}`).first().inputValue().catch(() => "");
  if (exactVisible && officialCode !== airlineCode) {
    throw new KrEArrivalPortalError(
      "Official Korea e-Arrival Card airline selector did not commit the selected code.",
      { code: "kr_eac_airline_widget_drift", blocked: true },
    );
  }
  await fillInput(page, `${scope} ${inputSelector}`, normalized, "flight number");
  await page.locator(`${scope} ${inputSelector}`).first().press("Tab");
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
  const travelPromptPattern = /(?:flight|ship|airport|port|not found|unknown|unable|조회|항공|선박|공항|항구|없)/iu;
  let acknowledged = false;
  for (let pass = 0; pass < 3; pass += 1) {
    const dialogs = page.locator(".popBox, [role='dialog'], .ui-dialog");
    const count = await dialogs.count().catch(() => 0);
    let handledThisPass = false;
    for (let index = 0; index < count; index += 1) {
      const dialog = dialogs.nth(index);
      if (!(await dialog.isVisible().catch(() => false))) continue;
      const body = await dialog.innerText().catch(() => "");
      if (!travelPromptPattern.test(body)) continue;
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
      await page.waitForTimeout(300);
      acknowledged = true;
      handledThisPass = true;
      break;
    }
    if (!handledThisPass) break;
  }
  if (!acknowledged) return;

  const remainingDialogs = page.locator(".popBox, [role='dialog'], .ui-dialog");
  const remainingCount = await remainingDialogs.count().catch(() => 0);
  const visibleBodies: string[] = [];
  for (let index = 0; index < remainingCount; index += 1) {
    const dialog = remainingDialogs.nth(index);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    visibleBodies.push(await dialog.innerText().catch(() => ""));
  }
  if (visibleBodies.length > 0) {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} lookup left an unexpected modal open.`,
      {
        code: "kr_eac_travel_lookup_prompt_drift",
        portalSummary: safeSummary(visibleBodies.join(" ")),
        blocked: true,
      },
    );
  }
  logs.push(`kr_eac_${label}_lookup_prompt_acknowledged`);
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
  const lookupState = classifyOfficialTravelLookup(
    expectedCountry,
    expectedCity,
    observedCountry,
    observedCity,
  );
  if (lookupState === "mismatch") {
    throw new KrEArrivalPortalError(
      `Official Korea e-Arrival Card ${label} lookup did not match the saved answer.`,
      {
        code: "kr_eac_travel_lookup_mismatch",
        portalSummary: `Official lookup comparison: country=${expectedCountry ? (officialTravelLookupMatches(expectedCountry, observedCountry) ? "matched" : "mismatch") : "not_provided"}, city=${expectedCity ? (officialTravelLookupMatches(expectedCity, observedCity) ? "matched" : "mismatch") : "not_provided"}.`,
        blocked: true,
      },
    );
  }
  logs.push(`kr_eac_${label}_lookup_${lookupState}`);
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

async function navigateToOfficialAgreement(
  page: Page,
  payload: KrEArrivalPortalPayload,
  logs: string[],
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    executionContext?.assertOwned();
    let navigationError: unknown;
    await page.goto(KR_EARRIVAL_OFFICIAL_PORTAL_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    }).catch((error) => {
      navigationError = error;
    });

    const agreementRendered = await page.locator("#chkAgreement1, #emlAddr1").first().waitFor({
      state: "attached",
      timeout: navigationError ? 5_000 : 15_000,
    }).then(() => true).catch(() => false);
    if (!navigationError || agreementRendered) {
      if (navigationError) logs.push(`kr_eac_navigation_recovered attempt=${attempt}`);
      await waitForOfficialLanding(page, logs);
      return;
    }

    const cause = safeErrorMessage(navigationError, [payload.emailAddress, payload.passportNumber]);
    const providerPolicyBlocked = isRemoteBrowserProviderPolicyBlockMessage(cause);
    logs.push(`kr_eac_navigation_failed attempt=${attempt} ${providerPolicyBlocked ? "provider_policy_blocked" : "portal_navigation_failed"} ${cause}`);
    if (providerPolicyBlocked || attempt === 2) {
      throw new KrEArrivalPortalError(
        providerPolicyBlocked
          ? "The configured remote browser provider does not permit access to the Korea e-Arrival Card government portal."
          : "Official Korea e-Arrival Card portal could not be reached by the runner.",
        {
          code: providerPolicyBlocked
            ? "kr_eac_browser_provider_policy_blocked"
            : "kr_eac_official_portal_navigation_failed",
          logs,
          portalSummary: cause,
          retryable: !providerPolicyBlocked,
          blocked: true,
        },
      );
    }
    logs.push(`kr_eac_navigation_retry attempt=${attempt + 1}`);
  }
}

async function openIndividualForm(
  page: Page,
  payload: KrEArrivalPortalPayload,
  logs: string[],
  executionContext?: RunnerExecutionContext,
): Promise<void> {
  await navigateToOfficialAgreement(page, payload, logs, executionContext);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      if (attempt > 1) {
        await navigateToOfficialAgreement(page, payload, logs, executionContext);
      }
      await setRequiredAgreement(page, "#chkAgreement1", "required privacy consent", executionContext);
      await setRequiredAgreement(page, "#chkAgreement3", "terms consent", executionContext);
      await setRequiredAgreement(page, "#chkAgreement4", "representative age consent", executionContext);
      logs.push(`kr_eac_agreements_verified attempt=${attempt}`);
      await fillInput(page, "#emlAddr1", payload.emailAddress, "representative email");
      await fillInput(page, "#emlAddr2", payload.emailAddress, "representative email confirmation");
      await submitAgreementConfirmation(
        page,
        logs,
        [payload.emailAddress, payload.passportNumber],
        executionContext,
      );
      logs.push(`kr_eac_agreement_confirmed attempt=${attempt}`);
      break;
    } catch (error) {
      const retryableAgreementFailure = error instanceof KrEArrivalPortalError
        && (
          error.code === "kr_eac_agreement_selector_drift"
          || error.code === "kr_eac_agreement_email_check_failed"
          || error.code === "kr_eac_individual_form_timeout"
        );
      if (attempt === 1 && retryableAgreementFailure) {
        logs.push(`kr_eac_agreement_retry code=${error.code}`);
        continue;
      }
      throw error;
    }
  }

  // The passport OCR prompt is mounted asynchronously after the application
  // form becomes visible. Looking for it only once races the portal animation
  // and can leave an invisible overlay intercepting the first form click.
  await page.locator("#btnPopClose").first().waitFor({ state: "visible", timeout: 7_500 }).catch(() => undefined);
  const ocrClose = await findVisible(page, ["#btnPopClose"]);
  if (ocrClose) {
    executionContext?.assertOwned();
    await ocrClose.click({ timeout: 20_000 });
    await page.locator("#btnPopClose").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
    logs.push("kr_eac_passport_ocr_modal_closed_manual_entry");
  }
  logs.push("kr_eac_individual_form_ready");
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
  logs.push("kr_eac_identity_section_filled");

  await clickVisible(
    page,
    payload.arrivalMode === "air" ? [`${scope} .btnEntAir`] : [`${scope} .btnEntSea`],
    "arrival mode",
    executionContext,
  );
  await fillInput(page, `${scope} .ent_prr_ymd`, payload.arrivalDate, "arrival date");
  if (payload.arrivalMode === "air") {
    await fillOfficialAirFlightNumber(
      page,
      scope,
      "E",
      payload.arrivalFlightNumber ?? "",
      executionContext,
    );
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
  logs.push("kr_eac_arrival_section_verified");

  await clickVisible(
    page,
    payload.departureMode === "air" ? [`${scope} .btnDepAir`] : [`${scope} .btnDepSea`],
    "departure mode",
    executionContext,
  );
  await fillInput(page, `${scope} .dep_prr_ymd`, payload.departureDate, "departure date");
  if (payload.departureMode === "air" && payload.departureFlightNumber) {
    await fillOfficialAirFlightNumber(
      page,
      scope,
      "D",
      payload.departureFlightNumber,
      executionContext,
    );
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
  logs.push("kr_eac_departure_section_filled");

  await selectExact(page, `${scope} .ent_purp_cd`, payload.purposeCode, "entry purpose");
  if (payload.purposeCode === "99" && payload.purposeOther) {
    await fillInput(page, `${scope} .ent_purp_cd_dir`, payload.purposeOther, "entry purpose details");
  }
  logs.push("kr_eac_purpose_section_filled");
  await selectOfficialStayAddress(page, payload, executionContext);
  logs.push("kr_eac_address_section_verified");
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
    payload.surname,
    payload.givenName,
    payload.dateOfBirth,
    payload.addressKorean,
    payload.addressEnglish,
    payload.addressDetail,
    payload.arrivalFlightNumber ?? "",
    payload.departureFlightNumber ?? "",
    payload.arrivalShipName ?? "",
    payload.departureShipName ?? "",
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
      const mergedLogs = Array.from(new Set([...logs, ...error.logs]));
      error.logs.splice(0, error.logs.length, ...mergedLogs);
      throw error;
    }
    const cause = safeErrorMessage(error, sensitiveValues);
    logs.push(`kr_eac_unexpected_error ${cause}`);
    const diagnosticScreenshots = [...screenshots];
    try {
      diagnosticScreenshots.push(
        await saveScreenshot(page, tempDir, "unexpected-error", logs, sensitiveValues),
      );
    } catch {
      // Best-effort evidence capture must not replace the original portal error.
    }
    const portalText = safeSummary(
      await page.locator("body").innerText().catch(() => ""),
      sensitiveValues,
    );
    throw new KrEArrivalPortalError(
      "Korea e-Arrival Card official portal run failed.",
      {
        code: "kr_eac_runner_failed",
        screenshotPaths: diagnosticScreenshots,
        logs,
        portalSummary: portalText || cause,
        retryable: true,
      },
    );
  } finally {
    options.executionContext?.signal.removeEventListener("abort", abortListener);
    await closeResourceBestEffort(browserSession);
  }
}
