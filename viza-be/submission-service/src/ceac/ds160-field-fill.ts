import type { Locator, Page } from "@playwright/test";
import type { FormFieldMapping } from "../form-mappings";

const NA_COMPANION_SUFFIXES = ["_na", "_unknown"] as const;

export interface Ds160NaCompanion {
  fieldName: string;
  mapping: FormFieldMapping;
}

type FieldScope = Page | Locator;

export type FindVisibleDs160Field = (
  scope: FieldScope,
  selector: string,
  mapping: FormFieldMapping,
) => Promise<Locator | null>;

export type WaitForDs160Postback = (page: Page) => Promise<void>;

export interface Ds160ControlObservation {
  matches: boolean;
  canSkipWrite: boolean;
  maxLength: number;
  controlId: string;
  displayValue: string;
  resolvedSelectValue: string | null;
  ambiguousSelect: boolean;
}

/** One fresh read, never cached across an action or a postback. */
export async function observeDs160Control(
  control: Locator,
  type: FormFieldMapping["type"],
  expected: string,
): Promise<Ds160ControlObservation> {
  return control.evaluate((node, target) => {
    const input = node instanceof HTMLInputElement ? node : null;
    const text = input ?? (node instanceof HTMLTextAreaElement ? node : null);
    const select = node instanceof HTMLSelectElement ? node : null;
    const normalized = target.expected.trim().toLowerCase();
    let matches = false;
    let canSkipWrite = false;
    let displayValue = "";
    let resolvedSelectValue: string | null = null;
    let ambiguousSelect = false;
    if (target.type === "select" && select) {
      const selected = select.selectedOptions[0];
      displayValue = selected?.innerText.trim() ?? "";
      matches = Boolean(select.value) && (select.value.trim().toLowerCase() === normalized ||
        (selected?.textContent ?? "").trim().toLowerCase() === normalized);
      // Do not turn an ambiguous label into a successful no-op. An exact
      // official value still follows selectOption's existing value semantics.
      const enabledOptions = Array.from(select.options).filter(option => !option.disabled &&
        !option.closest('optgroup[disabled]'));
      const exactValues = enabledOptions.filter(option => option.value === target.expected);
      const candidates = exactValues.length ? exactValues : enabledOptions.filter(option =>
        option.value.trim().toLowerCase() === normalized || option.text.trim().toLowerCase() === normalized);
      ambiguousSelect = candidates.length > 1;
      resolvedSelectValue = candidates.length === 1 ? candidates[0].value : null;
      canSkipWrite = matches && resolvedSelectValue !== null && select.value === resolvedSelectValue;
    } else if ((target.type === "radio" || target.type === "checkbox") && input?.type === target.type) {
      const checked = target.type === "radio" || /^(Y|1|true|yes)$/i.test(target.expected);
      matches = input.checked === checked && (target.type !== "radio" || input.value === target.expected);
      displayValue = /^(Y|1|true|yes)$/i.test(target.expected) ? "Yes" : "No";
      canSkipWrite = matches;
    } else if ((target.type === "text" || target.type === "date") && text) {
      matches = text.value === target.expected;
      displayValue = text.value;
      canSkipWrite = matches;
    }
    return { matches, canSkipWrite, displayValue, resolvedSelectValue, ambiguousSelect,
      maxLength: text?.maxLength ?? -1,
      controlId: node.getAttribute("id") ?? node.getAttribute("name") ?? "" };
  }, { type, expected });
}

function repeatParts(fieldName: string): { base: string; suffix: string } {
  const match = /^(.*?)(__\d+)$/.exec(fieldName);
  return match ? { base: match[1], suffix: match[2] } : { base: fieldName, suffix: "" };
}

/**
 * Resolve the one checkbox that controls whether a text/date field is
 * applicable.  CEAC uses both `_na` and `_unknown` suffixes.  Repeated rows
 * keep the row suffix after the companion suffix (for example `_na__2`).
 */
export function findDs160NaCompanion(
  fieldName: string,
  mappings: Readonly<Record<string, FormFieldMapping>>,
): Ds160NaCompanion | null {
  const { base, suffix } = repeatParts(fieldName);
  const candidates = NA_COMPANION_SUFFIXES
    .map((companionSuffix) => `${base}${companionSuffix}${suffix}`)
    .filter((key) => mappings[key]?.type === "checkbox");

  if (candidates.length > 1) {
    throw new Error(`Multiple CEAC NA companions are mapped for ${fieldName}.`);
  }
  const companion = candidates[0];
  return companion ? { fieldName: companion, mapping: mappings[companion] } : null;
}

function isExplicitNaValue(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, "_").toUpperCase();
  return normalized === "DOES_NOT_APPLY" || normalized === "DO_NOT_KNOW" || normalized === "N/A";
}

function isPlaywrightTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

export function hasMeaningfulDs160TextAnswer(value: string | undefined): boolean {
  return Boolean(value?.trim()) && !isExplicitNaValue(value!);
}

/**
 * Uncheck a stale CEAC NA/unknown control before filling its explicit text
 * answer.  The caller supplies the existing visibility and postback helpers
 * so their gate/readiness behavior remains unchanged.
 */
export async function clearDs160NaCompanionBeforeTextFill(options: {
  page: Page;
  scope: FieldScope;
  fieldName: string;
  mappings: Readonly<Record<string, FormFieldMapping>>;
  findVisibleField: FindVisibleDs160Field;
  resolveScope?: () => Promise<FieldScope>;
  waitForPostback: WaitForDs160Postback;
}): Promise<void> {
  const companion = findDs160NaCompanion(options.fieldName, options.mappings);
  if (!companion) return;

  // Pass the complete selector union through the orchestrator's visibility
  // helper. It already rejects more than one visible enabled control, while
  // Playwright de-duplicates a control matched by multiple selector aliases.
  const control = await options.findVisibleField(
    options.scope,
    companion.mapping.selector,
    companion.mapping,
  );

  if (!control || !(await control.isChecked().catch(() => false))) return;
  if (!(await control.isEnabled().catch(() => false))) {
    throw new Error(`CEAC NA companion is disabled for ${options.fieldName}.`);
  }

  try {
    await control.setChecked(false, { timeout: 5_000 });
  } catch (error) {
    // CEAC can complete the checkbox click and begin its ASP.NET postback
    // before Playwright observes the action/navigation.  Reconcile that
    // state through the existing gate-aware monitor, but never click again:
    // a second click could restore the stale NA state.
    if (!isPlaywrightTimeoutError(error)) throw error;
  }
  await options.waitForPostback(options.page);
  await options.page.waitForTimeout(750);

  const refreshedScope = options.resolveScope ? await options.resolveScope() : options.scope;
  const refreshed = await options.findVisibleField(
    refreshedScope,
    companion.mapping.selector,
    companion.mapping,
  );
  if (!refreshed || await refreshed.isChecked().catch(() => true)) {
    throw new Error(`CEAC NA companion could not be cleared for ${options.fieldName}.`);
  }
}
