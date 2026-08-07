/**
 * Ant Design Vue field-fill primitives for the Vietnam e-Visa portal.
 *
 * The portal is a Vue 3 SPA backed by Ant Design Vue components — every
 * field is wrapped in `.ant-form-item` and the underlying input has a
 * deterministic id like `basic_<camelVietnameseAbbreviation>`. The fillers
 * in this module map our normalized field types onto the right interaction
 * pattern for each component.
 */

import type { Locator, Page } from "@playwright/test";
import type { VnFieldType, VnFieldMapping } from "./field-mappings.js";
import {
  getVnCountryOptionIndex,
  getVnCountrySearchTextForOptionText,
} from "./field-mappings.js";

const SHORT_TIMEOUT = 5_000;
const SETTLE_MS = 200;
const MIN_SELECT_MATCH_SCORE = 88;
const DEFAULT_SELECT_FIELD_TIMEOUT_MS = 45_000;
const VN_IDLESS_RADIO_QUESTIONS: Record<string, string[]> = {
  basic_ttcnCoQtKhac: [
    "Do you have multiple nationalities?",
    "Người đề nghị cấp thị thực điện tử có mang nhiều quốc tịch hay không?",
    "Có quốc tịch khác",
  ],
  basic_ttcnDaDungHcKhacVaoVn: [
    "Have you ever used any other passports to enter into Viet Nam?",
    "Người đề nghị cấp thị thực điện tử đã từng sử dụng hộ chiếu khác để nhập cảnh Việt Nam hay không?",
    "hộ chiếu khác",
    "dùng hộ chiếu khác",
  ],
  basic_ttcnViPhamPl: ["Violation of the Vietnamese laws/regulations (if any)", "Vi phạm pháp luật Việt Nam"],
  basic_ttcdCoCqTcCaNhanLienHe: [
    "Agency/Organization/Individual that the applicant plans to contact when enter into Viet Nam?",
    "Cơ quan, tổ chức, cá nhân dự kiến liên hệ khi vào Việt Nam",
    "Cơ quan, tổ chức, cá nhân dự kiến liên hệ",
    "Cơ quan/Tổ chức/Cá nhân",
  ],
  basic_ttcdDaDenVn: ["Have you been to Viet Nam in the last 01 year?", "đến Việt Nam trong 01 năm"],
  basic_ttcdCoThanNhan: [
    "Do you have relatives who currently reside in Viet Nam?",
    "có người thân đang ở Việt Nam hay không?",
    "người thân đang ở Việt Nam",
    "thân nhân hiện đang ở Việt Nam",
  ],
};

const VN_PORTAL_OPTION_ALIASES: Record<string, string[]> = {
  yes: ["Yes", "Có"],
  no: ["No", "Không"],
  m: ["M", "Male", "Nam"],
  f: ["F", "Female", "Nữ"],
  "ordinary passport": ["Ordinary passport", "Hộ chiếu phổ thông", "Phổ thông"],
  ordinary: ["Ordinary", "Ordinary passport", "Hộ chiếu phổ thông", "Phổ thông"],
  "diplomatic passport": ["Diplomatic passport", "Hộ chiếu ngoại giao", "Ngoại giao"],
  diplomatic: ["Diplomatic", "Diplomatic passport", "Hộ chiếu ngoại giao", "Ngoại giao"],
  "official passport": ["Official passport", "Hộ chiếu công vụ", "Công vụ"],
  other: ["Other", "Others", "Khác"],
  others: ["Others", "Other", "Khác"],
  "single entry": ["Single-entry", "Single entry", "Một lần", "Nhập cảnh một lần"],
  "multiple entry": ["Multiple-entry", "Multiple entry", "Nhiều lần", "Nhập cảnh nhiều lần"],
  tourist: ["Tourist", "Tourism", "Du lịch"],
  "visiting relatives": ["Visiting relatives", "Thăm thân"],
  working: ["Working", "Lao động"],
  business: ["Business", "Công tác", "Thương mại"],
  businessman: ["Businessman", "Doanh nhân"],
  employee: ["Employee", "Nhân viên"],
  official: ["Official", "Công chức"],
  retired: ["Retired", "Nghỉ hưu"],
  student: ["Student", "Sinh viên"],
  unemployed: ["Unemployed", "Không nghề nghiệp"],
  personal: ["Personal", "Cá nhân"],
  company: ["Company", "Công ty"],
  cash: ["Cash", "Tiền mặt"],
  "credit card": ["Credit card", "Thẻ tín dụng"],
  "traveller s cheques": ["Traveller's cheques", "Traveler's cheques", "Séc du lịch"],
  "cat bi int airport hai phong": [
    "Cat Bi Int Airport (Hai Phong)",
    "Cửa khẩu Cảng hàng không quốc tế Cát Bi",
    "Cảng hàng không quốc tế Cát Bi",
    "Sân bay quốc tế Cát Bi",
    "SBQT Cát Bi",
  ],
  "bo y landport": [
    "Bo Y Landport",
    "Cửa khẩu Bờ Y",
    "Cửa khẩu quốc tế Bờ Y",
    "CKQT Bờ Y",
    "CK Bờ Y",
    "Bờ Y",
  ],
};

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Fill a plain text or textarea input by id. Uses `.fill()` which clears
 * the field first; the portal validates on blur so we tab-out after.
 */
export async function fillText(page: Page, domId: string, value: string): Promise<void> {
  const sel = `#${cssEscape(domId)}`;
  const input = page.locator(sel).first();
  await input.fill(value, { timeout: SHORT_TIMEOUT });
  await input.press("Tab", { timeout: SHORT_TIMEOUT });
  await settle(page);
}

/**
 * Pick an Ant Design Vue `.ant-select` option by visible text.
 * Strategy:
 *   1. Click the wrapping `.ant-select` to open the dropdown panel.
 *   2. Wait for `.ant-select-dropdown:not(.ant-select-dropdown-hidden)`.
 *   3. Click the `.ant-select-item-option` whose text matches.
 */
export async function pickSelect(page: Page, domId: string, optionText: string): Promise<void> {
  const searchTerms = buildAntSelectSearchTerms(optionText);
  const matchTexts = buildAntSelectMatchTexts(optionText);
  const optionIndex = getVnCountryOptionIndex(optionText);
  const deadline = Date.now() + getVietnamSelectFieldTimeoutMs();
  await page.evaluate("window.__name = window.__name || ((fn) => fn)");
  if (optionIndex !== null) {
    const indexed = await pickKnownCountryByIndex(page, domId, matchTexts, optionIndex, deadline);
    if (indexed.ok) {
      await settle(page);
      return;
    }
  } else {
    const input = page.locator(`#${cssEscape(domId)}`).first();
    const select = input.locator(
      "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ant-select ')][1]",
    );
    const selector = select.locator(".ant-select-selector").first();
    if ((await input.count()) > 0 && (await selector.count()) > 0) {
      const keyboard = await pickSelectWithKeyboardAliases(
        page,
        domId,
        input,
        selector,
        matchTexts,
        Math.min(deadline, Date.now() + 10_000),
      );
      if (keyboard.ok) {
        await settle(page);
        return;
      }
    }
    // Wards and border gates are long virtual lists without a stable index.
    // Scan the localized list before replaying typed searches, because the
    // Vietnamese portal often returns no results for an English label.
    await openFullSelectListForIndexedScroll(page, domId);
    const scanned = await scrollSelectOptionByText(page, matchTexts, deadline);
    if (scanned.ok && (await selectDisplayMatches(page, domId, matchTexts))) {
      await settle(page);
      return;
    }
  }
  const result = await page.evaluate(
    async ({ domId, matchTexts, searchTerms, timeoutMs }) => {
      const operationDeadline = Date.now() + timeoutMs;
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[Đđ]/g, "d")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const rank = (texts: string[]) => {
        return texts
          .map((text, index) => {
            const candidate = normalize(text);
            let score = -1;
            for (const matchText of matchTexts) {
              const target = normalize(matchText);
              const targetTokens = target.split(" ").filter((token) => token.length > 1);
              if (candidate && target) {
                if (candidate === target) score = Math.max(score, 100);
                else if (target.length > 1 && (candidate.startsWith(target) || target.startsWith(candidate))) {
                  score = Math.max(score, 92);
                } else if (target.length > 1 && (candidate.includes(target) || target.includes(candidate))) {
                  score = Math.max(score, 86);
                } else {
                  const candidateTokens = candidate.split(" ").filter((token) => token.length > 1);
                  const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length;
                  if (targetTokens.length > 0 && overlap === targetTokens.length) score = Math.max(score, 88);
                  else if (overlap >= 2) score = Math.max(score, 70 + overlap * 5);
                  else if (overlap === 1 && targetTokens.length === 1) score = Math.max(score, 72);
                }
              }
            }
            return { index, text, score };
          })
          .sort((left, right) => right.score - left.score);
      };
      const visibleBox = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const dropdownUsable = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !element.classList.contains("ant-select-dropdown-hidden")
        );
      };
      const dispatchRealClick = (target: HTMLElement) => {
        for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
          const EventCtor = type === "pointerdown" ? window.PointerEvent || window.MouseEvent : window.MouseEvent;
          target.dispatchEvent(new EventCtor(type, { bubbles: true, cancelable: true, button: 0 }));
        }
        target.click();
      };
      const setNativeValue = (input: HTMLInputElement, value: string) => {
        const descriptor =
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value") ||
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        if (descriptor?.set) descriptor.set.call(input, value);
        else input.value = value;
      };
      const currentSelectText = (select: HTMLElement) =>
        [
          select.querySelector<HTMLElement>(".ant-select-selection-item")?.innerText,
          select.querySelector<HTMLElement>(".ant-select-selection-item")?.getAttribute("title"),
          select.querySelector<HTMLElement>(".ant-select-selection-overflow")?.textContent,
          select.querySelector<HTMLInputElement>("input[type='hidden']")?.value,
        ]
          .filter(Boolean)
          .join(" ");
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(`#${CSS.escape(domId)}`));
      const pairs = inputs
        .map((input) => ({
          input,
          select: input.closest<HTMLElement>(".ant-select"),
        }))
        .filter((pair): pair is { input: HTMLInputElement; select: HTMLElement } => visibleBox(pair.select));
      const pair = pairs[0];
      if (!pair) return { ok: false, reason: "visible_select_not_found", candidates: [] as string[] };
      const { input, select } = pair;
      const selector = select.querySelector<HTMLElement>(".ant-select-selector") ?? select;
      const readDropdowns = () => {
        const results: HTMLElement[] = [];
        const seen = new Set<HTMLElement>();
        const add = (dropdown: HTMLElement | null) => {
          if (!dropdown || seen.has(dropdown) || !dropdownUsable(dropdown)) return;
          seen.add(dropdown);
          results.push(dropdown);
        };
        for (const id of [input.getAttribute("aria-controls"), input.getAttribute("aria-owns")].filter(Boolean)) {
          const owned = document.getElementById(id as string);
          add((owned?.closest(".ant-select-dropdown") as HTMLElement | null) ?? owned);
        }
        const selectRect = select.getBoundingClientRect();
        Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown"))
          .filter(dropdownUsable)
          .map((dropdown) => {
            const rect = dropdown.getBoundingClientRect();
            return {
              dropdown,
              distance: Math.abs(rect.left - selectRect.left) + Math.abs(rect.top - selectRect.bottom),
            };
          })
          .sort((left, right) => left.distance - right.distance)
          .forEach(({ dropdown }) => add(dropdown));
        return results;
      };
      const readOptions = () =>
        readDropdowns().flatMap((dropdown) =>
          Array.from(dropdown.querySelectorAll<HTMLElement>("[role='option'], .ant-select-item-option"))
            .filter((option) => !option.classList.contains("ant-select-item-option-disabled"))
            .map((option) => {
              const content = option.querySelector<HTMLElement>(".ant-select-item-option-content") ?? option;
              const text = (option.getAttribute("title") || content.innerText || content.textContent || "")
                .replace(/\s+/g, " ")
                .trim();
              return { option, content, text };
            })
            .filter((option) => option.text),
        );
      const waitForOptions = async (timeoutMs: number) => {
        const deadline = Date.now() + timeoutMs;
        let options = readOptions();
        while (options.length === 0 && Date.now() < deadline) {
          await sleep(80);
          options = readOptions();
        }
        return options;
      };
      const open = async () => {
        document.activeElement instanceof HTMLElement && document.activeElement.blur();
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await sleep(50);
        dispatchRealClick(selector);
        await sleep(120);
        input.focus();
        input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
        await sleep(500);
      };
      const search = async (searchTerm: string) => {
        await open();
        input.focus();
        input.click();
        setNativeValue(input, "");
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "", inputType: "deleteContentBackward" }));
        await sleep(80);
        let current = "";
        for (const char of searchTerm) {
          current += char;
          setNativeValue(input, current);
          input.dispatchEvent(new InputEvent("input", { bubbles: true, data: char, inputType: "insertText" }));
          input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: char }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          await sleep(90);
        }
        await sleep(900);
      };
      await open();
      let optionList = await waitForOptions(1_800);
      let best = rank(optionList.map((option) => option.text))[0];
      if (!best || best.score < 88) {
        for (const searchTerm of searchTerms) {
          if (Date.now() >= operationDeadline) break;
          await search(searchTerm);
          optionList = await waitForOptions(900);
          best = rank(optionList.map((option) => option.text))[0];
          if (best && best.score >= 88) break;
        }
      }
      if (!best || best.score < 88) {
        return {
          ok: false,
          reason: "option_not_found",
          candidates: optionList.slice(0, 8).map((option) => option.text),
        };
      }
      const selected = optionList[best.index];
      selected.option.scrollIntoView({ block: "nearest" });
      dispatchRealClick(selected.content);
      input.blur();
      input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      await sleep(500);
      const currentText = currentSelectText(select);
      const confirmed = (rank([currentText])[0]?.score ?? -1) >= 88;
      return {
        ok: confirmed,
        reason: confirmed ? undefined : "selection_not_confirmed",
        candidates: confirmed ? [selected.text] : [selected.text, currentText],
      };
    },
    { domId, matchTexts, searchTerms, timeoutMs: Math.max(1, deadline - Date.now()) },
  );
  if (!result.ok) {
    // The in-page strategy may consume the normal field deadline while an
    // async Ant dropdown is still rendering an empty virtual list. Reserve a
    // short, bounded Playwright recovery window so exact localized aliases can
    // still be committed with ArrowDown/Enter and verified from the display.
    const recoveryDeadline = Math.max(deadline, Date.now() + 12_000);
    const retry = await pickSelectWithPlaywright(
      page,
      domId,
      matchTexts,
      optionIndex,
      recoveryDeadline,
    );
    if (retry.ok) {
      await settle(page);
      return;
    }
    throw new Error(
      `Ant select option not found for ${domId}: ${optionText}; ${retry.reason ?? result.reason}; candidates=${[
        ...result.candidates,
        ...retry.candidates,
      ]
        .filter((candidate, index, candidates) => candidate && candidates.indexOf(candidate) === index)
        .join(", ")}`,
    );
  }
  await settle(page);
}

export function getVietnamSelectFieldTimeoutMs(
  rawValue: string | undefined = process.env.VN_SELECT_FIELD_TIMEOUT_MS,
): number {
  if (!rawValue) return DEFAULT_SELECT_FIELD_TIMEOUT_MS;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SELECT_FIELD_TIMEOUT_MS;
  return Math.max(1_000, Math.min(parsed, 60_000));
}

async function pickKnownCountryByIndex(
  page: Page,
  domId: string,
  matchTexts: string[],
  optionIndex: number,
  deadline: number,
): Promise<{ ok: boolean; candidates: string[] }> {
  const input = page.locator(`#${cssEscape(domId)}`).first();
  const select = input.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ant-select ')][1]",
  );
  const selector = select.locator(".ant-select-selector").first();
  if ((await input.count()) === 0 || (await select.count()) === 0 || (await selector.count()) === 0) {
    return { ok: false, candidates: [] };
  }

  await input.evaluate((element) => {
    element.closest<HTMLElement>(".ant-select")?.scrollIntoView({ block: "center", inline: "center" });
  });
  await selector.click({ timeout: SHORT_TIMEOUT, force: true });
  await page.waitForTimeout(150);
  await input.fill("", { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await openFullSelectListForIndexedScroll(page, domId);
  let candidates = await readVisibleSelectCandidates(page);
  const indexed = await scrollToIndexedSelectOption(page, matchTexts, optionIndex, deadline);
  if (indexed.candidates.length > candidates.length) {
    candidates = indexed.candidates;
  }
  await page.waitForTimeout(300);
  return {
    ok: indexed.ok && (await selectDisplayMatches(page, domId, matchTexts)),
    candidates,
  };
}

async function pickSelectWithPlaywright(
  page: Page,
  domId: string,
  matchTexts: string[],
  optionIndex: number | null,
  deadline: number,
): Promise<{ ok: boolean; reason?: string; candidates: string[] }> {
  const input = page.locator(`#${cssEscape(domId)}`).first();
  const select = input.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ant-select ')][1]",
  );
  const selector = select.locator(".ant-select-selector").first();
  if ((await input.count()) === 0 || (await select.count()) === 0 || (await selector.count()) === 0) {
    return { ok: false, reason: "playwright_select_not_found", candidates: [] };
  }

  await input.evaluate((element) => {
    const selectRoot = element.closest(".ant-select") as HTMLElement | null;
    selectRoot?.scrollIntoView({ block: "center", inline: "center" });
    const cell = element.closest("td") as HTMLElement | null;
    cell?.scrollIntoView({ block: "center", inline: "center" });
  });
  await page.waitForTimeout(150);
  await selector.click({ timeout: SHORT_TIMEOUT, force: true });
  await page.waitForTimeout(250);
  await input.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
  await input.fill("", { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  // Try the portal's native keyboard commit first. The current production
  // build can keep its virtual option DOM empty even though typing an exact
  // Vietnamese alias and pressing Enter commits the value internally.
  const earlyKeyboardFallback = await pickSelectWithKeyboardAliases(
    page,
    domId,
    input,
    selector,
    matchTexts,
    Math.min(deadline, Date.now() + 10_000),
  );
  if (earlyKeyboardFallback.ok) return earlyKeyboardFallback;
  if (optionIndex !== null) {
    await openFullSelectListForIndexedScroll(page, domId);
    let candidates = await readVisibleSelectCandidates(page);
    const indexed = await scrollToIndexedSelectOption(page, matchTexts, optionIndex, deadline);
    if (indexed.candidates.length > candidates.length) {
      candidates = indexed.candidates;
    }
    await page.waitForTimeout(500);
    if (indexed.ok && (await selectDisplayMatches(page, domId, matchTexts))) {
      return { ok: true, candidates };
    }
  }
  // The live portal virtualizes long ward and border-gate lists and its
  // Vietnamese build does not reliably filter on the English schema label.
  // Walk the rendered list before falling back to typed search. This keeps
  // the applicant's exact choice while allowing localized aliases to match.
  await openFullSelectListForIndexedScroll(page, domId);
  const scanned = await scrollSelectOptionByText(page, matchTexts, deadline);
  if (scanned.ok) {
    await page.waitForTimeout(500);
    if (await selectDisplayMatches(page, domId, matchTexts)) {
      return { ok: true, candidates: scanned.candidates };
    }
  }
  // Preserve one exact term per localized alias. Taking the first generic
  // prefixes can fill the whole fallback budget before Vietnamese labels are
  // ever tried (for example Single-entry -> Một lần).
  const fallbackSearchTerms = matchTexts.slice(0, 4);
  const scannedCandidates = scanned.candidates;
  for (const searchTerm of fallbackSearchTerms) {
    if (Date.now() >= deadline) {
      return { ok: false, reason: "select_field_timeout", candidates: scannedCandidates };
    }
    await selector.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
    await page.waitForTimeout(150);
    await input.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
    await input.fill("", { timeout: SHORT_TIMEOUT }).catch(() => undefined);
    if (searchTerm) {
      await page.keyboard.type(searchTerm, { delay: 20 });
    }
    await page.waitForTimeout(700);

    let candidates = await readVisibleSelectCandidates(page);
    const exactPattern = new RegExp(
      `^\\s*(?:${matchTexts.map((text) => escapeRegex(text)).join("|")})\\s*$`,
      "i",
    );
    const exactOption = page
      .locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option")
      .filter({ hasText: exactPattern })
      .first();
    if ((await exactOption.count()) > 0) {
      await exactOption.click({ timeout: SHORT_TIMEOUT, force: true });
    } else {
      const indexed = optionIndex === null
        ? { ok: false, candidates: [] }
        : await scrollToIndexedSelectOption(page, matchTexts, optionIndex, deadline);
      if (indexed.candidates.length > candidates.length) candidates = indexed.candidates;
    }
    await page.waitForTimeout(500);
    const confirmed = await selectDisplayMatches(page, domId, matchTexts);
    if (confirmed) return { ok: true, candidates };

    if (candidates.length === 0) {
      await selector.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
      candidates = await readVisibleSelectCandidates(page);
    }
    if (searchTerm === fallbackSearchTerms[fallbackSearchTerms.length - 1]) {
      for (const candidate of candidates) {
        if (!scannedCandidates.includes(candidate)) scannedCandidates.push(candidate);
      }
      break;
    }
  }
  const keyboardFallback = await pickSelectWithKeyboardAliases(
    page,
    domId,
    input,
    selector,
    matchTexts,
    deadline,
  );
  if (keyboardFallback.ok) return keyboardFallback;
  return {
    ok: false,
    reason: keyboardFallback.reason ?? "playwright_selection_not_confirmed",
    candidates: [...scannedCandidates, ...keyboardFallback.candidates].filter(
      (candidate, index, candidates) => candidate && candidates.indexOf(candidate) === index,
    ),
  };
}

async function pickSelectWithKeyboardAliases(
  page: Page,
  domId: string,
  input: Locator,
  selector: Locator,
  matchTexts: string[],
  deadline: number,
): Promise<{ ok: boolean; reason?: string; candidates: string[] }> {
  const seen: string[] = [];
  for (const searchTerm of matchTexts) {
    if (!searchTerm || Date.now() >= deadline) break;
    await selector.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
    await page.waitForTimeout(150);
    await input.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
    await input.fill(searchTerm, { timeout: SHORT_TIMEOUT }).catch(() => undefined);
    await page.waitForTimeout(domId === "basic_hcLoai" ? 1_500 : 900);

    const ownedCandidates = await readOwnedSelectCandidates(page, domId);
    for (const candidate of ownedCandidates) {
      if (!seen.includes(candidate)) seen.push(candidate);
    }
    await input.press("ArrowDown", { timeout: SHORT_TIMEOUT }).catch(() => undefined);
    await page.waitForTimeout(150);
    await input.press("Enter", { timeout: SHORT_TIMEOUT }).catch(() => undefined);
    await page.waitForTimeout(600);
    if (await selectDisplayMatches(page, domId, matchTexts)) {
      return { ok: true, candidates: seen };
    }
    await input.press("Escape", { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  }
  return {
    ok: false,
    reason: Date.now() >= deadline ? "select_field_timeout" : "keyboard_selection_not_confirmed",
    candidates: seen,
  };
}

async function readOwnedSelectCandidates(page: Page, domId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const input = document.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`);
    if (!input) return [];
    const roots = [input.getAttribute("aria-controls"), input.getAttribute("aria-owns")]
      .filter(Boolean)
      .map((controlId) => document.getElementById(controlId as string))
      .filter((root): root is HTMLElement => Boolean(root));
    return roots
      .flatMap((root) =>
        Array.from(root.querySelectorAll<HTMLElement>("[role='option'], .ant-select-item-option")),
      )
      .map((option) => {
        const content = option.querySelector<HTMLElement>(".ant-select-item-option-content") ?? option;
        return (option.getAttribute("title") || content.innerText || content.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
      })
      .filter((candidate, index, candidates) =>
        Boolean(candidate) && candidates.indexOf(candidate) === index,
      )
      .slice(0, 20);
  }, domId).catch(() => []);
}

async function scrollSelectOptionByText(
  page: Page,
  matchTexts: string[],
  deadline: number,
): Promise<{ ok: boolean; candidates: string[] }> {
  const seen: string[] = [];
  let lastScrollTop = -1;
  for (let attempt = 0; attempt < 160 && Date.now() < deadline; attempt += 1) {
    const clicked = await clickVisibleSelectOptionIfPresent(page, matchTexts);
    for (const candidate of clicked.candidates) {
      if (!seen.includes(candidate)) seen.push(candidate);
    }
    if (clicked.ok) return { ok: true, candidates: seen };

    const position = await page.evaluate(() => {
      const visible = (element: HTMLElement) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !element.classList.contains("ant-select-dropdown-hidden") &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      const panel = Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown"))
        .filter(visible)
        .find((dropdown) => dropdown.querySelector(".ant-select-item-option, [role='option']"));
      const holder = panel?.querySelector<HTMLElement>(".rc-virtual-list-holder");
      if (!holder) return null;
      const maximum = Math.max(0, holder.scrollHeight - holder.clientHeight);
      const next = Math.min(maximum, holder.scrollTop + Math.max(120, Math.floor(holder.clientHeight * 0.75)));
      holder.scrollTop = next;
      holder.dispatchEvent(new Event("scroll", { bubbles: true }));
      return { scrollTop: next, maximum };
    }).catch(() => null);
    if (!position || position.scrollTop === lastScrollTop) break;
    lastScrollTop = position.scrollTop;
    await page.waitForTimeout(180);
    if (position.scrollTop >= position.maximum) {
      const finalClick = await clickVisibleSelectOptionIfPresent(page, matchTexts);
      for (const candidate of finalClick.candidates) {
        if (!seen.includes(candidate)) seen.push(candidate);
      }
      if (finalClick.ok) return { ok: true, candidates: seen };
      break;
    }
  }
  return { ok: false, candidates: seen.slice(0, 80) };
}

async function openFullSelectListForIndexedScroll(page: Page, domId: string): Promise<void> {
  await page.evaluate((id) => {
    const input = document.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`);
    const select = input?.closest<HTMLElement>(".ant-select");
    const selector = select?.querySelector<HTMLElement>(".ant-select-selector") ?? select;
    if (!input || !selector) return;
    const dispatchRealClick = (target: HTMLElement) => {
      for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
        const EventCtor = type === "pointerdown" ? window.PointerEvent || window.MouseEvent : window.MouseEvent;
        target.dispatchEvent(new EventCtor(type, { bubbles: true, cancelable: true, button: 0 }));
      }
      target.click();
    };
    const descriptor =
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value") ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (descriptor?.set) descriptor.set.call(input, "");
    else input.value = "";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "", inputType: "deleteContentBackward" }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    dispatchRealClick(selector);
    input.focus();
    input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
  }, domId).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function scrollToIndexedSelectOption(
  page: Page,
  matchTexts: string[],
  optionIndex: number,
  deadline: number,
): Promise<{ ok: boolean; candidates: string[] }> {
  const seen: string[] = [];
  const itemHeights = [32, 34, 36, 38, 40, 42, 44, 46, 48];
  for (const itemHeight of itemHeights) {
    if (Date.now() >= deadline) break;
    await page.evaluate(
      ({ index, itemHeight }) => {
        const visible = (element: HTMLElement) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            !element.classList.contains("ant-select-dropdown-hidden") &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const panel = Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown"))
          .filter(visible)
          .find((dropdown) => dropdown.querySelector(".ant-select-item-option, [role='option']"));
        const holder = panel?.querySelector<HTMLElement>(".rc-virtual-list-holder");
        const targetScrollTop = Math.max(0, (index - 3) * itemHeight);
        if (holder) {
          holder.scrollTop = targetScrollTop;
          holder.dispatchEvent(new Event("scroll", { bubbles: true }));
        }
      },
      { index: optionIndex, itemHeight },
    ).catch(() => undefined);
    await page.waitForTimeout(260);
    const clicked = await clickVisibleSelectOptionIfPresent(page, matchTexts);
    for (const candidate of clicked.candidates) {
      if (!seen.includes(candidate)) seen.push(candidate);
    }
    if (clicked.ok) return { ok: true, candidates: seen };
  }
  return { ok: false, candidates: seen.slice(0, 40) };
}

async function clickVisibleSelectOptionIfPresent(
  page: Page,
  matchTexts: string[],
): Promise<{ ok: boolean; candidates: string[] }> {
  return page.evaluate(async ({ matchTexts: expectedTexts }) => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[Đđ]/g, "d")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const visible = (element: HTMLElement) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !element.classList.contains("ant-select-dropdown-hidden") &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const dispatchRealClick = (target: HTMLElement) => {
      for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
        const EventCtor = type === "pointerdown" ? window.PointerEvent || window.MouseEvent : window.MouseEvent;
        target.dispatchEvent(new EventCtor(type, { bubbles: true, cancelable: true, button: 0 }));
      }
      target.click();
    };
    const panel = Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown"))
      .filter(visible)
      .find((dropdown) => dropdown.querySelector(".ant-select-item-option, [role='option']"));
    if (!panel) return { ok: false, candidates: [] as string[] };
    const candidates: string[] = [];
    const items = Array.from(panel.querySelectorAll<HTMLElement>(".ant-select-item-option, [role='option']"))
      .map((option) => {
        const content = option.querySelector<HTMLElement>(".ant-select-item-option-content") ?? option;
        const text = (option.getAttribute("title") || content.innerText || content.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        return { option, content, text };
      })
      .filter((item) => item.text && !item.option.classList.contains("ant-select-item-option-disabled"));
    for (const item of items) {
      if (!candidates.includes(item.text)) candidates.push(item.text);
      if (expectedTexts.some((expected) => normalize(item.text) === normalize(expected))) {
        item.option.scrollIntoView({ block: "nearest" });
        await sleep(80);
        dispatchRealClick(item.content);
        return { ok: true, candidates };
      }
    }
    return { ok: false, candidates };
  }, { matchTexts });
}

async function selectDisplayMatches(page: Page, domId: string, matchTexts: string[]): Promise<boolean> {
  return page.evaluate(
    ({ domId: id, matchTexts: expectedTexts }) => {
      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[Đđ]/g, "d")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const input = document.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`);
      const select = input?.closest<HTMLElement>(".ant-select");
      if (!select) return false;
      const text = [
        select.querySelector<HTMLElement>(".ant-select-selection-item")?.innerText,
        select.querySelector<HTMLElement>(".ant-select-selection-item")?.getAttribute("title"),
        select.querySelector<HTMLInputElement>("input[type='hidden']")?.value,
      ]
        .filter(Boolean)
        .join(" ");
      return expectedTexts.some((expected) => {
        const normalizedExpected = normalize(expected);
        return normalize(text) === normalizedExpected ||
          (normalizedExpected.length > 1 && normalize(text).includes(normalizedExpected));
      });
    },
    { domId, matchTexts },
  );
}

async function readVisibleSelectCandidates(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !element.classList.contains("ant-select-dropdown-hidden") &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    return Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown"))
      .filter(visible)
      .flatMap((dropdown) =>
        Array.from(dropdown.querySelectorAll<HTMLElement>(".ant-select-item-option, [role='option']"))
          .map((option) => {
            const content = option.querySelector<HTMLElement>(".ant-select-item-option-content") ?? option;
            return (option.getAttribute("title") || content.innerText || content.textContent || "")
              .replace(/\s+/g, " ")
              .trim();
          })
          .filter(Boolean),
      )
      .filter((candidate, index, candidates) => candidates.indexOf(candidate) === index)
      .slice(0, 20);
  });
}

/**
 * Select a `.ant-radio-group` option by visible label text.
 */
export async function pickRadio(page: Page, domId: string, optionText: string): Promise<void> {
  const target = page.locator(`#${cssEscape(domId)}`).first();
  const formItem = target.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ant-form-item ')][1]");
  const radioGroup = target.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ant-radio-group ')][1]");
  const questionTexts = VN_IDLESS_RADIO_QUESTIONS[domId];
  const idlessQuestionRoot = questionTexts
    ? page
        .locator(".pt-5.border-b, .ant-row.ant-form-item, .ant-col.ant-col-24.flex.justify-between.pb-5")
        .filter({ hasText: new RegExp(questionTexts.map(escapeRegex).join("|"), "i") })
        .first()
    : null;
  const root =
    (await formItem.count()) > 0
      ? formItem
      : (await radioGroup.count()) > 0
        ? radioGroup
        : idlessQuestionRoot && (await idlessQuestionRoot.count()) > 0
          ? idlessQuestionRoot
          : page.locator("body");
  const matchTexts = buildAntSelectMatchTexts(optionText);
  const exactText = new RegExp(`^\\s*(?:${matchTexts.map(escapeRegex).join("|")})\\s*$`, "i");
  const option = root
    .locator(".ant-radio-wrapper, label.ant-radio-button-wrapper, label")
    .filter({ hasText: exactText })
    .first();

  if ((await option.count()) === 0) {
    throw new Error(`Ant radio option not found for ${domId}: ${optionText}`);
  }
  await option.click({ timeout: SHORT_TIMEOUT });
  const input = option.locator("input[type='radio']").first();
  if ((await input.count()) > 0) {
    await input.evaluate((element) => {
      const radio = element as HTMLInputElement;
      const group = radio.closest(".ant-radio-group");
      const checkedDescriptor =
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(radio), "checked") ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked");
      for (const peer of Array.from(group?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])) {
        if (peer === radio) continue;
        if (checkedDescriptor?.set) checkedDescriptor.set.call(peer, false);
        else peer.checked = false;
      }
      if (checkedDescriptor?.set) checkedDescriptor.set.call(radio, true);
      else radio.checked = true;
      radio.dispatchEvent(new Event("input", { bubbles: true }));
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await settle(page);

  const confirmed =
    ((await input.count()) > 0 && (await input.isChecked())) ||
    (await option.evaluate((element) =>
      element.classList.contains("ant-radio-wrapper-checked") ||
      element.classList.contains("ant-radio-button-wrapper-checked") ||
      Boolean(element.querySelector(".ant-radio-checked")),
    ));
  if (!confirmed) {
    throw new Error(`Ant radio selection not confirmed for ${domId}: ${optionText}`);
  }
}

/**
 * Type a date in the portal's `DD/MM/YYYY` format into the underlying
 * `.ant-picker input`. Avoids the calendar widget; the input accepts
 * keyboard entry directly.
 */
export async function fillDate(page: Page, domId: string, ddmmyyyy: string): Promise<void> {
  const sel = `#${cssEscape(domId)}`;
  const input = page.locator(sel).first();
  await input.click({ timeout: SHORT_TIMEOUT });
  await input.fill(ddmmyyyy, { timeout: SHORT_TIMEOUT });
  await input.press("Enter", { timeout: SHORT_TIMEOUT });
  await settle(page);
}

/**
 * Tick or untick a plain/Ant checkbox by id.
 */
export async function tickCheckbox(page: Page, domId: string, rawValue: string): Promise<void> {
  const normalized = rawValue.trim().toLowerCase();
  const shouldCheck = ["1", "true", "yes", "on", "agree", "i agree"].includes(normalized);
  const sel = `#${cssEscape(domId)}`;
  const input = page.locator(sel).first();
  if (shouldCheck) {
    await input.check({ force: true, timeout: SHORT_TIMEOUT });
  } else {
    await input.uncheck({ force: true, timeout: SHORT_TIMEOUT }).catch(() => undefined);
  }
  await settle(page);
}

/**
 * Convert `YYYY-MM-DD` (our canonical) to `DD/MM/YYYY` (portal's format).
 * Returns the input untouched if it doesn't match `YYYY-MM-DD` so callers
 * can pre-formatted data through unchanged.
 */
export function toDdMmYyyy(yyyymmdd: string): string {
  const m = yyyymmdd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : yyyymmdd;
}

/**
 * CSS.escape isn't available in Node — minimal escape covering the chars
 * Ant Design uses in ids. The portal's ids are all `[A-Za-z0-9_]` so this
 * is overcautious but cheap.
 */
function cssEscape(id: string): string {
  return id.replace(/([!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~])/g, "\\$1");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildAntSelectSearchTerms(optionText: string): string[] {
  const terms = new Set<string>();
  for (const matchText of buildAntSelectMatchTexts(optionText)) {
    addBoundedAntSelectSearchTerms(terms, matchText);
  }
  terms.add("");
  return Array.from(terms);
}

export function buildAntSelectMatchTexts(optionText: string): string[] {
  const matchTexts = new Set<string>([optionText.trim()]);
  const aliases = VN_PORTAL_OPTION_ALIASES[normalizeAntSelectText(optionText)];
  for (const alias of aliases ?? []) matchTexts.add(alias);
  const officialSearchText = getVnCountrySearchTextForOptionText(optionText);
  if (officialSearchText) matchTexts.add(officialSearchText);
  return Array.from(matchTexts).filter(Boolean);
}

/**
 * Keep official-select searches deliberately small. The previous strategy
 * generated every character prefix and replayed the full Ant virtual-list
 * interaction for each one. Long country names could therefore spend tens
 * of minutes in a single field on the fallback portal.
 */
function addBoundedAntSelectSearchTerms(terms: Set<string>, value: string | null): void {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return;
  terms.add(trimmed);

  const firstWord = trimmed.split(/[\s-]+/u).find(Boolean) ?? "";
  if (firstWord && firstWord !== trimmed) terms.add(firstWord);

  const compactPrefix = trimmed.slice(0, Math.min(4, trimmed.length)).replace(/[^A-Za-z0-9]+$/g, "");
  if (compactPrefix && compactPrefix !== trimmed && compactPrefix !== firstWord) {
    terms.add(compactPrefix);
  }
}


export function buildAntSelectOptionRegex(optionText: string): RegExp {
  const escaped = optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

function normalizeAntSelectText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[Đđ]/g, "d")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function rankAntSelectCandidates(
  optionTexts: string[],
  targetText: string,
): Array<{ index: number; text: string; score: number }> {
  const target = normalizeAntSelectText(targetText);
  const targetTokens = target.split(" ").filter((token) => token.length > 1);
  return optionTexts
    .map((text, index) => {
      const candidate = normalizeAntSelectText(text);
      let score = -1;
      if (candidate && target) {
        if (candidate === target) score = 100;
        else if (candidate.startsWith(target) || target.startsWith(candidate)) score = 92;
        else if (candidate.includes(target) || target.includes(candidate)) score = 86;
        else {
          const candidateTokens = candidate.split(" ").filter((token) => token.length > 1);
          const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length;
          if (targetTokens.length > 0 && overlap === targetTokens.length) score = 88;
          else if (overlap >= 2) score = 70 + overlap * 5;
          else if (overlap === 1 && targetTokens.length === 1) score = 72;
        }
      }
      return { index, text, score };
    })
    .sort((left, right) => right.score - left.score);
}

export function isAcceptableAntSelectMatch(score: number): boolean {
  return score >= MIN_SELECT_MATCH_SCORE;
}

/* ------------------------- RUN-VN-001 per-step fill ------------------------- */

export interface PlannedField {
  fieldName: string;
  domId: string;
  type: VnFieldType;
  value: string;
}

/**
 * Resolve canonical answers → an ordered fill plan against VN_FIELD_MAPPINGS.
 * Pure (no browser): applies the portal date transform and drops uploads
 * (handled separately) and fields with no answer. Unit-tested core of the
 * per-step fill.
 */
export function resolveStepPlan(
  answers: Record<string, string>,
  mappings: Record<string, VnFieldMapping>,
): PlannedField[] {
  const plan: PlannedField[] = [];
  for (const [fieldName, mapping] of Object.entries(mappings)) {
    if (mapping.type === "upload") continue;
    const raw = answers[fieldName];
    if (!raw) continue;
    const value = mapping.type === "date" ? toDdMmYyyy(raw) : raw;
    plan.push({ fieldName, domId: mapping.domId, type: mapping.type, value });
  }
  return plan;
}

async function fillOne(page: Page, type: VnFieldType, domId: string, value: string): Promise<void> {
  switch (type) {
    case "text":
    case "textarea":
      await fillText(page, domId, value);
      return;
    case "select":
    case "country":
      await pickSelect(page, domId, value);
      return;
    case "radio":
      await pickRadio(page, domId, value);
      return;
    case "date":
      await fillDate(page, domId, value); // value already DD/MM/YYYY from the plan
      return;
    case "upload":
    default:
      return;
  }
}

export interface StepFillResult {
  filled: number;
  skipped: number;
}

/**
 * Execute a full per-step fill: resolve the plan and fill each field,
 * counting successes vs failures. Used by fillVietnamApplication (run.ts)
 * to progress the form toward submitted_pending_pay.
 */
export async function fillFormStep(
  page: Page,
  answers: Record<string, string>,
  mappings: Record<string, VnFieldMapping>,
): Promise<StepFillResult> {
  const plan = resolveStepPlan(answers, mappings);
  let filled = 0;
  let skipped = Object.keys(mappings).length - plan.length;
  for (const f of plan) {
    try {
      await fillOne(page, f.type, f.domId, f.value);
      filled++;
    } catch (err) {
      console.warn(`[vn] fill failed for ${f.fieldName} (${f.domId}): ${err instanceof Error ? err.message : err}`);
      skipped++;
    }
  }
  return { filled, skipped };
}
