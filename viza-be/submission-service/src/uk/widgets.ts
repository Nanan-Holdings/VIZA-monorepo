/**
 * Typed Playwright fillers for the widget patterns observed on the UKVI
 * portal (govuk-frontend). The post-auth form has ~50 pages but they
 * all reduce to a small set of widget shapes — text, radio, checkbox,
 * date triplet, ISO-3 country select, autocomplete, textarea, file.
 *
 * Each filler accepts a logical field NAME (the form's `name` attribute,
 * which is stable across govuk-frontend releases) and a string value.
 * Selectors are derived from `name` so we don't hand-write IDs.
 *
 * On any unexpected DOM shape these throw `UkWidgetFillError` so the
 * orchestrator can attach run context (page id, field name) before
 * surfacing.
 */

import type { Page } from "@playwright/test";
import { UkWidgetFillError } from "./errors";

const FILL_TIMEOUT_MS = 5_000;

/** Plain text input (single-line). */
export async function fillTextInput(
  page: Page,
  name: string,
  value: string,
): Promise<void> {
  if (!value) return;
  try {
    await page.locator(`input[name="${cssEscape(name)}"]`).first().fill(value, { timeout: FILL_TIMEOUT_MS });
  } catch (err) {
    throw new UkWidgetFillError(`Text input "${name}" fill failed`, {
      fieldName: name,
      details: { cause: errMsg(err) },
    });
  }
}

/** Multi-line textarea. */
export async function fillTextarea(
  page: Page,
  name: string,
  value: string,
): Promise<void> {
  if (!value) return;
  try {
    await page.locator(`textarea[name="${cssEscape(name)}"]`).first().fill(value, { timeout: FILL_TIMEOUT_MS });
  } catch (err) {
    throw new UkWidgetFillError(`Textarea "${name}" fill failed`, {
      fieldName: name,
      details: { cause: errMsg(err) },
    });
  }
}

/** Radio group. UKVI convention: id="{name}_{value}", name="{name}". */
export async function fillRadio(
  page: Page,
  name: string,
  value: string,
): Promise<void> {
  if (!value) return;
  try {
    // Prefer id-based lookup since govuk-frontend renders id="{name}_{value}".
    const byId = page.locator(`#${cssEscape(`${name}_${value}`)}`).first();
    if (await byId.count()) {
      await byId.check({ timeout: FILL_TIMEOUT_MS });
      return;
    }
    // Fallback: name + value attribute pair.
    await page
      .locator(`input[type="radio"][name="${cssEscape(name)}"][value="${cssEscape(value)}"]`)
      .first()
      .check({ timeout: FILL_TIMEOUT_MS });
  } catch (err) {
    throw new UkWidgetFillError(`Radio "${name}" → "${value}" fill failed`, {
      fieldName: name,
      details: { value, cause: errMsg(err) },
    });
  }
}

/** Single checkbox. `value` is "true" / "yes" / "1" → checked, anything
 *  else → unchecked. */
export async function fillCheckbox(
  page: Page,
  name: string,
  value: string,
): Promise<void> {
  const shouldCheck = /^(true|yes|y|1|on)$/i.test(value);
  try {
    const cb = page.locator(`input[type="checkbox"][name="${cssEscape(name)}"]`).first();
    if (shouldCheck) {
      await cb.check({ timeout: FILL_TIMEOUT_MS });
    } else {
      await cb.uncheck({ timeout: FILL_TIMEOUT_MS });
    }
  } catch (err) {
    throw new UkWidgetFillError(`Checkbox "${name}" set failed`, {
      fieldName: name,
      details: { value, cause: errMsg(err) },
    });
  }
}

/** Native select (option `value` attribute). */
export async function fillSelect(
  page: Page,
  name: string,
  value: string,
): Promise<void> {
  if (!value) return;
  try {
    await page.locator(`select[name="${cssEscape(name)}"]`).first().selectOption(value, { timeout: FILL_TIMEOUT_MS });
  } catch (err) {
    throw new UkWidgetFillError(`Select "${name}" → "${value}" fill failed`, {
      fieldName: name,
      details: { value, cause: errMsg(err) },
    });
  }
}

/** ISO-3 country select.
 *
 *  UKVI uses an accessible-autocomplete pair: a hidden `<select name="X">`
 *  with ISO-3 alpha values ("USA", "AFG", "CHN") plus a visible text
 *  input `#X_ui` that the user types into. Post-auth pages REQUIRE both
 *  to be set — setting only the select fails validation with "enter the
 *  country" because the autocomplete enhancement treats the `_ui` input
 *  as the user-facing source of truth.
 *
 *  Pass `iso3` (the alpha-3 code) and optionally `displayName` (the
 *  full country name shown in the dropdown). If `displayName` is omitted,
 *  this function reads it from the matching `<option>` text. */
export async function fillIso3Select(
  page: Page,
  name: string,
  iso3: string,
  displayName?: string,
): Promise<void> {
  if (!iso3) return;
  const code = iso3.toUpperCase();
  try {
    const selectLoc = page.locator(`select[name="${cssEscape(name)}"]`).first();
    await selectLoc.selectOption(code, { timeout: FILL_TIMEOUT_MS });

    // The id derives from the select's id (which on UKVI is the same
    // string as `name` with dots replaced by underscores).
    const idForUi = name.replace(/\./g, "_");
    const uiLoc = page.locator(`#${cssEscape(`${idForUi}_ui`)}`).first();
    if (await uiLoc.count()) {
      const text = displayName ?? (await selectLoc.locator(`option[value="${code}"]`).first().innerText().catch(() => code));
      await uiLoc.fill(text, { timeout: FILL_TIMEOUT_MS });
    }
  } catch (err) {
    throw new UkWidgetFillError(`ISO-3 select "${name}" → "${code}" fill failed`, {
      fieldName: name,
      details: { iso3: code, cause: errMsg(err) },
    });
  }
}

/** UKVI 3-part date.
 *
 *  Verified on real UKVI form pages (recon 2026-04-25): the inputs are:
 *    name="{base}.day"   id="{base}_day"   maxlength=2
 *    name="{base}.month" id="{base}_month" maxlength=2
 *    name="{base}.year"  id="{base}_year"  maxlength=4
 *  The dotted `name` is the structured-form binding; the underscored
 *  `id` is the accessibility hook. Both are stable.
 *
 *  Accepts ISO date strings (YYYY-MM-DD) or DD/MM/YYYY. */
export async function fillGovukDate(
  page: Page,
  baseName: string,
  value: string,
): Promise<void> {
  if (!value) return;
  const parts = parseDate(value);
  if (!parts) {
    throw new UkWidgetFillError(`Date "${baseName}" — could not parse "${value}"`, {
      fieldName: baseName,
      details: { value },
    });
  }
  try {
    await page.locator(`input[name="${cssEscape(`${baseName}.day`)}"]`).first().fill(parts.day, { timeout: FILL_TIMEOUT_MS });
    await page.locator(`input[name="${cssEscape(`${baseName}.month`)}"]`).first().fill(parts.month, { timeout: FILL_TIMEOUT_MS });
    await page.locator(`input[name="${cssEscape(`${baseName}.year`)}"]`).first().fill(parts.year, { timeout: FILL_TIMEOUT_MS });
  } catch (err) {
    throw new UkWidgetFillError(`Date "${baseName}" fill failed`, {
      fieldName: baseName,
      details: { value, cause: errMsg(err) },
    });
  }
}

/** File input. `localPath` must be an absolute path on disk. */
export async function uploadFile(
  page: Page,
  name: string,
  localPath: string,
): Promise<void> {
  if (!localPath) return;
  try {
    await page
      .locator(`input[type="file"][name="${cssEscape(name)}"]`)
      .first()
      .setInputFiles(localPath, { timeout: 10_000 });
  } catch (err) {
    throw new UkWidgetFillError(`File upload "${name}" failed`, {
      fieldName: name,
      details: { localPath, cause: errMsg(err) },
    });
  }
}

// ── helpers ──────────────────────────────────────────────────────────

function cssEscape(s: string): string {
  // Minimal CSS attribute-value escape: backslash-escape quote and backslash.
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface DateParts { day: string; month: string; year: string }

function parseDate(value: string): DateParts | null {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (isoMatch) return { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] };
  const dmyMatch = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(value.trim());
  if (dmyMatch) {
    return {
      day: dmyMatch[1].padStart(2, "0"),
      month: dmyMatch[2].padStart(2, "0"),
      year: dmyMatch[3],
    };
  }
  return null;
}
