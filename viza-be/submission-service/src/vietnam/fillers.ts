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

const SHORT_TIMEOUT = 5_000;
const SETTLE_MS = 200;

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
  const sel = `#${cssEscape(domId)}`;
  const control = page.locator(sel).first();
  const formItem = control
    .locator("xpath=ancestor::*[contains(@class,'ant-form-item')][1]")
    .first();
  const selector = formItem.locator(".ant-select-selector, .ant-select").first();
  await selector.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);

  const result = await page.evaluate(
    async ({ domId, optionText }) => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
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
      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const tokens = (value: string) => normalize(value).split(" ").filter((token) => token.length > 1);
      const score = (candidate: string, target: string): number => {
        const c = normalize(candidate);
        const t = normalize(target);
        if (!c || !t) return -1;
        if (c === t) return 100;
        if (c.startsWith(t) || t.startsWith(c)) return 92;
        if (c.includes(t) || t.includes(c)) return 86;
        const candidateTokens = tokens(candidate);
        const targetTokens = tokens(target);
        const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length;
        if (targetTokens.length > 0 && overlap === targetTokens.length) return 88;
        if (overlap >= 2) return 70 + overlap * 5;
        if (overlap === 1 && targetTokens.length === 1) return 72;
        return -1;
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
      const target = document.getElementById(domId);
      const select =
        target?.closest(".ant-select") ??
        target?.closest(".ant-form-item")?.querySelector<HTMLElement>(".ant-select");
      if (!select) return { ok: false, reason: "select_container_not_found", candidates: [] as string[] };
      const input =
        select.querySelector<HTMLInputElement>(".ant-select-selection-search-input, input[role='combobox']") ??
        (target instanceof HTMLInputElement ? target : null);
      const selector = select.querySelector<HTMLElement>(".ant-select-selector") ?? (select as HTMLElement);
      const open = async () => {
        document.activeElement instanceof HTMLElement && document.activeElement.blur();
        dispatchRealClick(selector);
        await sleep(120);
        if (input) {
          input.focus();
          input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
          input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "ArrowDown", code: "ArrowDown" }));
        }
        await sleep(180);
      };
      const dropdowns = () => {
        const results: HTMLElement[] = [];
        const seen = new Set<HTMLElement>();
        const add = (dropdown: HTMLElement | null) => {
          if (!dropdown || seen.has(dropdown) || !visible(dropdown)) return;
          seen.add(dropdown);
          results.push(dropdown);
        };
        for (const id of [input?.getAttribute("aria-controls"), input?.getAttribute("aria-owns")].filter(Boolean)) {
          const owned = document.getElementById(id as string);
          add((owned?.closest(".ant-select-dropdown") as HTMLElement | null) ?? owned);
        }
        const selectRect = select.getBoundingClientRect();
        Array.from(document.querySelectorAll<HTMLElement>(".ant-select-dropdown"))
          .filter(visible)
          .map((dropdown) => {
            const rect = dropdown.getBoundingClientRect();
            return {
              dropdown,
              distance: Math.abs(rect.left - selectRect.left) + Math.abs(rect.top - selectRect.bottom),
            };
          })
          .sort((a, b) => a.distance - b.distance)
          .forEach(({ dropdown }) => add(dropdown));
        return results;
      };
      const options = () =>
        dropdowns().flatMap((dropdown) =>
          Array.from(dropdown.querySelectorAll<HTMLElement>("[role='option'], .ant-select-item-option"))
            .filter((option) => visible(option) && option.getAttribute("aria-disabled") !== "true")
            .map((option) => {
              const content = option.querySelector<HTMLElement>(".ant-select-item-option-content") ?? option;
              const text = (option.getAttribute("title") || content.innerText || content.textContent || "")
                .replace(/\s+/g, " ")
                .trim();
              return { option, content, text, score: score(text, optionText) };
            })
            .filter((option) => option.text),
        );
      const search = async (term: string) => {
        if (!input) return;
        input.focus();
        input.click();
        setNativeValue(input, "");
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "", inputType: "deleteContentBackward" }));
        await sleep(80);
        setNativeValue(input, term);
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: term, inputType: "insertText" }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: term.slice(-1) || "a" }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(700);
      };

      await open();
      let optionList = options();
      if (input) {
        await search(optionText);
        optionList = options();
      }
      const best = optionList.sort((a, b) => b.score - a.score)[0];
      if (!best || best.score < 72) {
        return {
          ok: false,
          reason: "option_not_found",
          candidates: optionList.slice(0, 8).map((option) => `${option.text}(${option.score})`),
        };
      }
      best.option.scrollIntoView({ block: "nearest" });
      dispatchRealClick(best.content);
      input?.blur();
      await sleep(250);
      const currentText = [
        select.querySelector<HTMLElement>(".ant-select-selection-item")?.innerText,
        select.querySelector<HTMLInputElement>(".ant-select-selection-search-input")?.value,
        select.getAttribute("title"),
      ]
        .filter(Boolean)
        .join(" ");
      const confirmed = score(currentText, best.text) >= 72 || score(currentText, optionText) >= 72;
      return { ok: confirmed, reason: confirmed ? undefined : "selection_not_confirmed", candidates: [best.text] };
    },
    { domId, optionText },
  );

  if (!result.ok) {
    throw new Error(
      `Ant select option not found for ${domId}: ${optionText}; ${result.reason}; candidates=${result.candidates.join(", ")}`,
    );
  }
  await settle(page);
}

/**
 * Select a `.ant-radio-group` option by visible label text.
 */
export async function pickRadio(page: Page, domId: string, optionText: string): Promise<void> {
  const clicked = await page.evaluate(
    ({ domId, optionText }) => {
      const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const target = document.getElementById(domId);
      const root =
        target?.closest(".ant-form-item") ??
        target?.closest(".ant-radio-group") ??
        document;
      const options = Array.from(root.querySelectorAll<HTMLElement>(".ant-radio-wrapper, label.ant-radio-button-wrapper, label"));
      const option = options.find((element) => normalize(element.innerText || element.textContent) === normalize(optionText));
      option?.click();
      return Boolean(option);
    },
    { domId, optionText },
  );
  if (!clicked) {
    throw new Error(`Ant radio option not found for ${domId}: ${optionText}`);
  }
  await settle(page);
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

export function buildAntSelectOptionRegex(optionText: string): RegExp {
  const escaped = optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
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
