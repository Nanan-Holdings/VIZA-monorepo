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
