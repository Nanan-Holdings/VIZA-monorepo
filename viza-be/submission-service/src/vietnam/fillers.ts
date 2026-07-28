/**
 * Ant Design Vue field-fill primitives for the Vietnam e-Visa portal.
 *
 * The portal is a Vue 3 SPA backed by Ant Design Vue components — every
 * field is wrapped in `.ant-form-item` and the underlying input has a
 * deterministic id like `basic_<camelVietnameseAbbreviation>`. The fillers
 * in this module map our normalized field types onto the right interaction
 * pattern for each component.
 */

import type { Page } from "@playwright/test";
import type { VnFieldType, VnFieldMapping } from "./field-mappings.js";
import {
  getVnCountryAlpha3ForOptionText,
  getVnCountryOptionIndex,
  getVnCountrySearchTextForOptionText,
} from "./field-mappings.js";

const SHORT_TIMEOUT = 5_000;
const SETTLE_MS = 200;
const MIN_SELECT_MATCH_SCORE = 88;
const VN_IDLESS_RADIO_QUESTIONS: Record<string, string> = {
  basic_ttcnCoQtKhac: "Do you have multiple nationalities?",
  basic_ttcnDaDungHcKhacVaoVn: "Have you ever used any other passports to enter into Viet Nam?",
  basic_ttcnViPhamPl: "Violation of the Vietnamese laws/regulations (if any)",
  basic_ttcdCoCqTcCaNhanLienHe: "Agency/Organization/Individual that the applicant plans to contact when enter into Viet Nam?",
  basic_ttcdDaDenVn: "Have you been to Viet Nam in the last 01 year?",
  basic_ttcdCoThanNhan: "Do you have relatives who currently reside in Viet Nam?",
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
  const optionIndex = getVnCountryOptionIndex(optionText);
  await page.evaluate("window.__name = window.__name || ((fn) => fn)");
  const result = await page.evaluate(
    async ({ domId, optionText, searchTerms }) => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const rank = (texts: string[]) => {
        const target = normalize(optionText);
        const targetTokens = target.split(" ").filter((token) => token.length > 1);
        return texts
          .map((text, index) => {
            const candidate = normalize(text);
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
      const submitWithKeyboard = async () => {
        input.focus();
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
        await sleep(100);
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter", keyCode: 13 }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter", code: "Enter", keyCode: 13 }));
        await sleep(500);
        input.blur();
        input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      };

      await open();
      let optionList = await waitForOptions(1_800);
      let best = rank(optionList.map((option) => option.text))[0];
      if (!best || best.score < 88) {
        for (const searchTerm of searchTerms) {
          await search(searchTerm);
          optionList = await waitForOptions(900);
          best = rank(optionList.map((option) => option.text))[0];
          if (best && best.score >= 88) break;
        }
      }
      if (!best || best.score < 88) {
        for (const searchTerm of searchTerms) {
          await search(searchTerm);
          await submitWithKeyboard();
          const keyboardText = currentSelectText(select);
          const keyboardScore = rank([keyboardText])[0]?.score ?? -1;
          if (keyboardScore >= 88) {
            return {
              ok: true,
              reason: undefined,
              candidates: [keyboardText],
            };
          }
        }
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
    { domId, optionText, searchTerms },
  );
  if (!result.ok) {
    const retry = await pickSelectWithPlaywright(page, domId, optionText, searchTerms, optionIndex);
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

async function pickSelectWithPlaywright(
  page: Page,
  domId: string,
  optionText: string,
  searchTerms: string[],
  optionIndex: number | null,
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
  if (optionIndex !== null) {
    await openFullSelectListForIndexedScroll(page, domId);
    let candidates = await readVisibleSelectCandidates(page);
    const keyboardIndexed = await selectIndexedOptionWithKeyboard(page, domId, optionText, optionIndex);
    if (keyboardIndexed.candidates.length > candidates.length) {
      candidates = keyboardIndexed.candidates;
    }
    if (keyboardIndexed.ok) return { ok: true, candidates };

    const indexed = await scrollToIndexedSelectOption(page, optionText, optionIndex);
    if (indexed.candidates.length > candidates.length) {
      candidates = indexed.candidates;
    }
    await page.waitForTimeout(500);
    if (indexed.ok && (await selectDisplayMatches(page, domId, optionText))) {
      return { ok: true, candidates };
    }
  }
  for (const searchTerm of searchTerms) {
    await selector.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
    await page.waitForTimeout(150);
    await input.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
    await input.fill("", { timeout: SHORT_TIMEOUT }).catch(() => undefined);
    if (searchTerm) {
      await page.keyboard.type(searchTerm, { delay: 20 });
    }
    await page.waitForTimeout(700);

    let candidates = await readVisibleSelectCandidates(page);
    const exactOption = page
      .locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option")
      .filter({ hasText: new RegExp(`^\\s*${escapeRegex(optionText)}\\s*$`, "i") })
      .first();
    if ((await exactOption.count()) > 0) {
      await exactOption.click({ timeout: SHORT_TIMEOUT, force: true });
    } else {
      const indexed = optionIndex === null ? { ok: false, candidates: [] } : await scrollToIndexedSelectOption(page, optionText, optionIndex);
      const scrolled = indexed.ok ? indexed : await wheelAndClickSelectOption(page, optionText);
      if (scrolled.candidates.length > candidates.length) {
        candidates = scrolled.candidates;
      }
      if (!scrolled.ok) {
        await page.keyboard.press("ArrowDown").catch(() => undefined);
        await page.keyboard.press("Enter").catch(() => undefined);
      }
    }
    await page.waitForTimeout(500);
    const confirmed = await selectDisplayMatches(page, domId, optionText);
    if (confirmed) return { ok: true, candidates };

    if (candidates.length === 0) {
      await selector.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
      candidates = await readVisibleSelectCandidates(page);
    }
    if (searchTerm === searchTerms[searchTerms.length - 1]) {
      return { ok: false, reason: "playwright_selection_not_confirmed", candidates };
    }
  }
  return { ok: false, reason: "playwright_selection_not_confirmed", candidates: [] };
}

async function selectIndexedOptionWithKeyboard(
  page: Page,
  domId: string,
  optionText: string,
  optionIndex: number,
): Promise<{ ok: boolean; candidates: string[] }> {
  await openFullSelectListForIndexedScroll(page, domId);
  const candidates = await readVisibleSelectCandidates(page);
  const input = page.locator(`#${cssEscape(domId)}`).first();
  await input.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
  await page.keyboard.press("Home").catch(() => undefined);
  await page.waitForTimeout(80);
  for (let step = 0; step <= optionIndex; step += 1) {
    await page.keyboard.press("ArrowDown").catch(() => undefined);
    if (step % 20 === 19) {
      await page.waitForTimeout(20);
    }
  }
  await page.keyboard.press("Enter").catch(() => undefined);
  await page.waitForTimeout(650);
  if (await selectDisplayMatches(page, domId, optionText)) {
    return { ok: true, candidates };
  }
  return { ok: false, candidates };
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
  optionText: string,
  optionIndex: number,
): Promise<{ ok: boolean; candidates: string[] }> {
  const seen: string[] = [];
  const itemHeights = [32, 34, 36, 38, 40, 42, 44, 46, 48];
  for (const itemHeight of itemHeights) {
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
    const clicked = await clickVisibleSelectOptionIfPresent(page, optionText);
    for (const candidate of clicked.candidates) {
      if (!seen.includes(candidate)) seen.push(candidate);
    }
    if (clicked.ok) return { ok: true, candidates: seen };
  }
  return { ok: false, candidates: seen.slice(0, 40) };
}

async function wheelAndClickSelectOption(
  page: Page,
  optionText: string,
): Promise<{ ok: boolean; candidates: string[] }> {
  const seen: string[] = [];
  for (let step = 0; step < 160; step++) {
    const clicked = await clickVisibleSelectOptionIfPresent(page, optionText);
    for (const candidate of clicked.candidates) {
      if (!seen.includes(candidate)) seen.push(candidate);
    }
    if (clicked.ok) return { ok: true, candidates: seen };

    const box = await page.evaluate(() => {
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
      if (!panel) return null;
      const target = panel.querySelector<HTMLElement>(".rc-virtual-list-holder") ?? panel;
      const rect = target.getBoundingClientRect();
      return {
        x: Math.max(1, rect.left + rect.width / 2),
        y: Math.max(1, rect.top + Math.min(rect.height / 2, 120)),
      };
    });
    if (!box) break;
    await dispatchWheelOnVisibleSelect(page, 480);
    await page.mouse.move(box.x, box.y).catch(() => undefined);
    await page.mouse.wheel(0, 360).catch(() => undefined);
    if (step % 5 === 4) {
      await page.keyboard.press("PageDown").catch(() => undefined);
    } else {
      await page.keyboard.press("ArrowDown").catch(() => undefined);
    }
    await page.waitForTimeout(80);
  }
  return { ok: false, candidates: seen.slice(0, 40) };
}

async function dispatchWheelOnVisibleSelect(page: Page, deltaY: number): Promise<void> {
  await page.evaluate((delta) => {
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
    if (!holder) return;
    holder.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: delta }));
    holder.scrollTop += delta;
    holder.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, deltaY).catch(() => undefined);
}

async function clickVisibleSelectOptionIfPresent(
  page: Page,
  optionText: string,
): Promise<{ ok: boolean; candidates: string[] }> {
  return page.evaluate(async ({ optionText: expected }) => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value: string) =>
      value
        .normalize("NFD")
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
      if (normalize(item.text) === normalize(expected)) {
        item.option.scrollIntoView({ block: "nearest" });
        await sleep(80);
        dispatchRealClick(item.content);
        return { ok: true, candidates };
      }
    }
    return { ok: false, candidates };
  }, { optionText });
}

async function selectDisplayMatches(page: Page, domId: string, optionText: string): Promise<boolean> {
  return page.evaluate(
    ({ domId: id, optionText: expected }) => {
      const normalize = (value: string) =>
        value
          .normalize("NFD")
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
      return normalize(text) === normalize(expected) || normalize(text).includes(normalize(expected));
    },
    { domId, optionText },
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
  const questionText = VN_IDLESS_RADIO_QUESTIONS[domId];
  const idlessQuestionRoot = questionText
    ? page
        .locator(".pt-5.border-b, .ant-row.ant-form-item, .ant-col.ant-col-24.flex.justify-between.pb-5")
        .filter({ hasText: new RegExp(escapeRegex(questionText), "i") })
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
  const exactText = new RegExp(`^\\s*${escapeRegex(optionText)}\\s*$`, "i");
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
  const officialSearchText = getVnCountrySearchTextForOptionText(optionText);
  addProgressiveAntSelectSearchTerms(terms, optionText);
  addProgressiveAntSelectSearchTerms(terms, officialSearchText);
  terms.add("");
  return Array.from(terms);
}

function addProgressiveAntSelectSearchTerms(terms: Set<string>, value: string | null): void {
  const trimmed = value?.trim() ?? "";
  for (let length = trimmed.length; length >= 1; length -= 1) {
    const term = trimmed.slice(0, length).replace(/[^A-Za-z0-9]+$/g, "");
    if (term) terms.add(term);
  }
}


export function buildAntSelectOptionRegex(optionText: string): RegExp {
  const escaped = optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

function normalizeAntSelectText(value: string): string {
  return value
    .normalize("NFD")
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
