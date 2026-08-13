/**
 * Taiwan Online Entry Permit field-fill primitives.
 *
 * UPDATE (live DOM verification pass, see docs/tw-entry-permit-auto-submit-plan.md):
 * a second live walkthrough directly inspected the real page's DOM (via
 * javascript_tool queries against the actual coa.immigration.gov.tw session,
 * not view-source guessing) and confirmed concrete `name` attributes for
 * essentially every field on the "申請表" tab (traveller.chineseName,
 * traveller.birthDate, kinships[0..4].*, careersInformations[0].*, etc — see
 * the TW_NAMES map in apply.ts). Name-attribute selectors are dramatically
 * more robust than label-text matching, so the *ByName primitives below are
 * now the primary path; the original label-based primitives (twFillText,
 * twSelectByValue, twPickRadio, twPickCheckbox, twUploadFile) are kept only
 * for the handful of controls that genuinely have no name attribute worth
 * targeting (buttons/links located by visible text: 我要申請, 確定, 下一步,
 * 寄送驗證碼, 驗證). All calls remain best-effort no-ops when a control isn't
 * found, so a wrong/missing guess degrades to "field left blank" rather than
 * throwing and aborting the whole run.
 */

import * as path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { TwFieldVerificationError, TwFileUploadError } from "./errors";

const SHORT_TIMEOUT = 5_000;

/** Most primitives can operate against the whole page or a scoped Locator
 *  (used for the 5 repeated kinship blocks, which share field labels). */
export type TwScope = Page | Locator;

export type TwVerifiedFieldKind = "text" | "select" | "radio" | "checkbox" | "date" | "file";

export interface TwFieldVerificationEntry {
  fieldName: string;
  controlName: string;
  kind: TwVerifiedFieldKind;
  status: "matched" | "skipped";
  required: boolean;
  actualPresent: boolean;
}

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(150);
}

function rootPage(scope: TwScope): Page {
  const asLocator = scope as Locator;
  return typeof asLocator.page === "function" ? asLocator.page() : (scope as Page);
}

export async function twFillText(scope: TwScope, labelZh: string, value: string | undefined): Promise<void> {
  if (!value) return;
  const input = scope.getByLabel(labelZh, { exact: false }).first();
  if ((await input.count().catch(() => 0)) === 0) return;
  await input.fill(value, { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await settle(rootPage(scope));
}

export async function twFillTextarea(scope: TwScope, labelZh: string, value: string | undefined): Promise<void> {
  await twFillText(scope, labelZh, value);
}

// ── Name-attribute primitives (confirmed live via DOM inspection) ──────────
// Every date/text/select/radio/checkbox control on the real "申請表" page
// carries a stable `name` attribute (traveller.*, kinships[N].*,
// careersInformations[0].*, …). These are far more robust than label-text
// matching and are now the primary lookup path — see TW_NAMES in apply.ts.

function byName(scope: TwScope, name: string): Locator {
  return scope.locator(`[name="${cssEscape(name)}"]`);
}

function cssEscape(s: string): string {
  // Escape characters that are meaningful in an attribute-value selector
  // context we build manually (names contain literal [ ] . which are fine
  // inside quotes, but escape quotes/backslashes defensively).
  return s.replace(/["\\]/g, "\\$&");
}

function pushMatched(
  audit: TwFieldVerificationEntry[],
  input: {
    fieldName: string;
    controlName: string;
    kind: TwVerifiedFieldKind;
    required?: boolean;
    actualPresent?: boolean;
  },
): void {
  audit.push({
    fieldName: input.fieldName,
    controlName: input.controlName,
    kind: input.kind,
    status: "matched",
    required: input.required ?? true,
    actualPresent: input.actualPresent ?? true,
  });
}

function pushSkipped(
  audit: TwFieldVerificationEntry[],
  input: {
    fieldName: string;
    controlName: string;
    kind: TwVerifiedFieldKind;
  },
): void {
  audit.push({
    fieldName: input.fieldName,
    controlName: input.controlName,
    kind: input.kind,
    status: "skipped",
    required: false,
    actualPresent: false,
  });
}

async function requireVisibleControl(scope: TwScope, name: string, fieldName: string, kind: TwVerifiedFieldKind): Promise<Locator> {
  const control = byName(scope, name).first();
  if ((await control.count().catch(() => 0)) === 0) {
    throw new TwFieldVerificationError(fieldName, `${kind} control not found`, {
      url: rootPage(scope).url(),
      details: { controlName: name, kind },
    });
  }
  return control;
}

function normalizeDateForCompare(value: string): string {
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slash = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s) ?? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!slash) return s;
  if (slash[1].length === 4) {
    return `${slash[1]}-${slash[2].padStart(2, "0")}-${slash[3].padStart(2, "0")}`;
  }
  return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
}

export async function twFillByNameStrict(
  scope: TwScope,
  fieldName: string,
  name: string,
  value: string | undefined,
  audit: TwFieldVerificationEntry[],
  options: { required?: boolean } = {},
): Promise<void> {
  const required = options.required ?? true;
  if (!value) {
    if (required) {
      throw new TwFieldVerificationError(fieldName, "missing required VIZA value", {
        url: rootPage(scope).url(),
        details: { controlName: name, kind: "text" },
      });
    }
    pushSkipped(audit, { fieldName, controlName: name, kind: "text" });
    return;
  }
  const input = await requireVisibleControl(scope, name, fieldName, "text");
  await input.fill(value, { timeout: SHORT_TIMEOUT });
  await settle(rootPage(scope));
  const actual = await input.inputValue({ timeout: SHORT_TIMEOUT }).catch(() => "");
  if (actual !== value) {
    throw new TwFieldVerificationError(fieldName, "actual text value does not match normalized VIZA value", {
      url: rootPage(scope).url(),
      details: { controlName: name, kind: "text" },
    });
  }
  pushMatched(audit, { fieldName, controlName: name, kind: "text", required });
}

export async function twSelectByNameStrict(
  scope: TwScope,
  fieldName: string,
  name: string,
  value: string | undefined,
  audit: TwFieldVerificationEntry[],
  options: { required?: boolean } = {},
): Promise<void> {
  const required = options.required ?? true;
  if (!value) {
    if (required) {
      throw new TwFieldVerificationError(fieldName, "missing required VIZA value", {
        url: rootPage(scope).url(),
        details: { controlName: name, kind: "select" },
      });
    }
    pushSkipped(audit, { fieldName, controlName: name, kind: "select" });
    return;
  }
  const select = await requireVisibleControl(scope, name, fieldName, "select");
  await selectTwOptionStrict(select, value);
  await settle(rootPage(scope));
  const actual = await select.inputValue({ timeout: SHORT_TIMEOUT }).catch(() => "");
  if (actual !== value && !(await selectedOptionLabelEquals(select, value))) {
    throw new TwFieldVerificationError(fieldName, "actual selected option does not match normalized VIZA value", {
      url: rootPage(scope).url(),
      details: { controlName: name, kind: "select" },
    });
  }
  pushMatched(audit, { fieldName, controlName: name, kind: "select", required });
}

/**
 * Selects a control whose options are populated after another official
 * select changes. The locator is reacquired on every poll because the NIA
 * page may replace the complete select during its dependent-field render.
 */
export async function twSelectDependentByNameStrict(
  scope: TwScope,
  fieldName: string,
  name: string,
  value: string | undefined,
  audit: TwFieldVerificationEntry[],
  options: { required?: boolean; timeoutMs?: number } = {},
): Promise<void> {
  const required = options.required ?? true;
  if (!value) {
    if (required) {
      throw new TwFieldVerificationError(fieldName, "missing required VIZA value", {
        url: rootPage(scope).url(),
        details: { controlName: name, kind: "select" },
      });
    }
    pushSkipped(audit, { fieldName, controlName: name, kind: "select" });
    return;
  }

  const deadline = Date.now() + (options.timeoutMs ?? 8_000);
  while (Date.now() < deadline) {
    const select = byName(scope, name).first();
    const available =
      (await select.count().catch(() => 0)) > 0 &&
      (await select.isVisible().catch(() => false)) &&
      (await select.isEnabled().catch(() => false)) &&
      (await select
        .locator("option")
        .evaluateAll(
          (nodes, expected) =>
            nodes.some((node) => {
              const option = node as HTMLOptionElement;
              return option.value === expected || (option.textContent ?? "").trim() === expected;
            }),
          value,
        )
        .catch(() => false));

    if (available) {
      await twSelectByNameStrict(scope, fieldName, name, value, audit, { required });
      return;
    }
    await rootPage(scope).waitForTimeout(100);
  }

  throw new TwFieldVerificationError(fieldName, "dependent select option not available after bounded wait", {
    url: rootPage(scope).url(),
    details: { controlName: name, kind: "select" },
  });
}

async function selectTwOptionStrict(select: Locator, value: string): Promise<void> {
  try {
    await select.selectOption(value, { timeout: SHORT_TIMEOUT });
    return;
  } catch (err) {
    const matchedByLabel = await select.selectOption({ label: value }, { timeout: SHORT_TIMEOUT }).then(() => true).catch(() => false);
    if (matchedByLabel) return;
    throw err;
  }
}

async function selectedOptionLabelEquals(select: Locator, value: string): Promise<boolean> {
  return select.evaluate((node, expected) => {
    const el = node as HTMLSelectElement;
    const selected = el.options[el.selectedIndex];
    return (selected?.textContent ?? "").trim() === expected;
  }, value).catch(() => false);
}

export async function twPickRadioByValueStrict(
  scope: TwScope,
  fieldName: string,
  name: string,
  value: string | undefined,
  audit: TwFieldVerificationEntry[],
  options: { required?: boolean } = {},
): Promise<void> {
  const required = options.required ?? true;
  if (!value) {
    if (required) {
      throw new TwFieldVerificationError(fieldName, "missing required VIZA value", {
        url: rootPage(scope).url(),
        details: { controlName: name, kind: "radio" },
      });
    }
    pushSkipped(audit, { fieldName, controlName: name, kind: "radio" });
    return;
  }
  const radio = scope.locator(`input[name="${cssEscape(name)}"][value="${cssEscape(value)}"]`).first();
  if ((await radio.count().catch(() => 0)) === 0) {
    throw new TwFieldVerificationError(fieldName, "radio option not found", {
      url: rootPage(scope).url(),
      details: { controlName: name, kind: "radio" },
    });
  }
  if (!(await radio.isChecked().catch(() => false))) {
    await radio.check({ timeout: SHORT_TIMEOUT, force: true });
  }
  await settle(rootPage(scope));
  if (!(await radio.isChecked().catch(() => false))) {
    throw new TwFieldVerificationError(fieldName, "radio option was not selected after fill", {
      url: rootPage(scope).url(),
      details: { controlName: name, kind: "radio" },
    });
  }
  pushMatched(audit, { fieldName, controlName: name, kind: "radio", required });
}

export async function twPickCheckboxByNameStrict(
  scope: TwScope,
  fieldName: string,
  name: string,
  checked: boolean,
  audit: TwFieldVerificationEntry[],
  options: { required?: boolean } = {},
): Promise<void> {
  const required = options.required ?? true;
  const box = await requireVisibleControl(scope, name, fieldName, "checkbox");
  const isChecked = await box.isChecked().catch(() => false);
  if (isChecked !== checked) {
    if (checked) {
      await box.check({ timeout: SHORT_TIMEOUT, force: true });
    } else {
      await box.uncheck({ timeout: SHORT_TIMEOUT, force: true });
    }
  }
  await settle(rootPage(scope));
  if ((await box.isChecked().catch(() => false)) !== checked) {
    throw new TwFieldVerificationError(fieldName, "checkbox state does not match normalized VIZA value", {
      url: rootPage(scope).url(),
      details: { controlName: name, kind: "checkbox" },
    });
  }
  pushMatched(audit, { fieldName, controlName: name, kind: "checkbox", required });
}

export async function twFillDateByNameStrict(
  scope: TwScope,
  fieldName: string,
  name: string,
  isoDate: string | undefined,
  audit: TwFieldVerificationEntry[],
  options: { required?: boolean } = {},
): Promise<void> {
  const required = options.required ?? true;
  if (!isoDate) {
    if (required) {
      throw new TwFieldVerificationError(fieldName, "missing required VIZA value", {
        url: rootPage(scope).url(),
        details: { controlName: name, kind: "date" },
      });
    }
    pushSkipped(audit, { fieldName, controlName: name, kind: "date" });
    return;
  }
  const input = await requireVisibleControl(scope, name, fieldName, "date");
  await twFillDateByName(scope, name, isoDate);
  const actual = await input.inputValue({ timeout: SHORT_TIMEOUT }).catch(() => "");
  if (normalizeDateForCompare(actual) !== isoDate) {
    throw new TwFieldVerificationError(fieldName, "actual date value does not match normalized VIZA value", {
      url: rootPage(scope).url(),
      details: { controlName: name, kind: "date" },
    });
  }
  pushMatched(audit, { fieldName, controlName: name, kind: "date", required });
}

async function verifyInputFile(input: Locator, filePath: string, fieldName: string, controlName: string, page: Page): Promise<void> {
  const expectedName = path.basename(filePath);
  const actualName = await input
    .evaluate((el) => {
      const inputEl = el as HTMLInputElement;
      return inputEl.files?.[0]?.name ?? "";
    })
    .catch(() => "");
  if (actualName !== expectedName) {
    throw new TwFileUploadError(fieldName, "uploaded file is not present in the official page file input", {
      url: page.url(),
      details: { controlName, kind: "file" },
    });
  }
}

export async function twUploadFileByNameStrict(
  scope: TwScope,
  fieldName: string,
  name: string,
  filePath: string | undefined | null,
  audit: TwFieldVerificationEntry[],
  options: { required?: boolean } = {},
): Promise<void> {
  const required = options.required ?? true;
  if (!filePath) {
    if (required) {
      throw new TwFileUploadError(fieldName, "missing required local file", {
        url: rootPage(scope).url(),
        details: { controlName: name, kind: "file" },
      });
    }
    pushSkipped(audit, { fieldName, controlName: name, kind: "file" });
    return;
  }
  const input = await requireVisibleControl(scope, name, fieldName, "file");
  await input.setInputFiles(filePath, { timeout: SHORT_TIMEOUT });
  await settle(rootPage(scope));
  await verifyInputFile(input, filePath, fieldName, name, rootPage(scope));
  pushMatched(audit, { fieldName, controlName: name, kind: "file", required });
}

export async function twUploadFileByDocumentDescriptionStrict(
  page: Page,
  fieldName: string,
  descriptionSubstring: string,
  filePath: string | undefined | null,
  audit: TwFieldVerificationEntry[],
  options: { required?: boolean } = {},
): Promise<void> {
  const required = options.required ?? true;
  if (!filePath) {
    if (required) {
      throw new TwFileUploadError(fieldName, "missing required local file", {
        url: page.url(),
        details: { kind: "file" },
      });
    }
    pushSkipped(audit, { fieldName, controlName: descriptionSubstring, kind: "file" });
    return;
  }
  const fileInputs = page.locator('input[name^="documents["][name$="].attachs[0]"]');
  const count = await fileInputs.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const input = fileInputs.nth(i);
    const descriptionRow = input.locator("xpath=ancestor::tr[1]/preceding-sibling::tr[1]");
    const text = await descriptionRow.innerText({ timeout: SHORT_TIMEOUT }).catch(() => "");
    if (text.includes(descriptionSubstring)) {
      const controlName = (await input.getAttribute("name").catch(() => null)) ?? descriptionSubstring;
      await input.setInputFiles(filePath, { timeout: SHORT_TIMEOUT });
      await settle(page);
      await verifyInputFile(input, filePath, fieldName, controlName, page);
      pushMatched(audit, { fieldName, controlName, kind: "file", required });
      return;
    }
  }
  throw new TwFileUploadError(fieldName, "official document upload row was not found", {
    url: page.url(),
    details: { kind: "file" },
  });
}

export async function twFillByName(scope: TwScope, name: string, value: string | undefined): Promise<void> {
  if (!value) return;
  const input = byName(scope, name).first();
  if ((await input.count().catch(() => 0)) === 0) return;
  await input.fill(value, { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await settle(rootPage(scope));
}

export async function twSelectByName(scope: TwScope, name: string, value: string | undefined): Promise<void> {
  if (!value) return;
  const select = byName(scope, name).first();
  if ((await select.count().catch(() => 0)) === 0) return;
  await select.selectOption(value, { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await settle(rootPage(scope));
}

/** Checks the radio input with the given `name` AND `value` (radio groups
 *  share a name; the option is disambiguated by its `value` attribute,
 *  confirmed live rather than matched by visible option text). */
export async function twPickRadioByValue(scope: TwScope, name: string, value: string | undefined): Promise<void> {
  if (!value) return;
  const radio = scope.locator(`input[name="${cssEscape(name)}"][value="${cssEscape(value)}"]`).first();
  if ((await radio.count().catch(() => 0)) === 0) return;
  if (!(await radio.isChecked().catch(() => false))) {
    await radio.check({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
  }
  await settle(rootPage(scope));
}

export async function twPickCheckboxByName(scope: TwScope, name: string, checked: boolean): Promise<void> {
  const box = byName(scope, name).first();
  if ((await box.count().catch(() => 0)) === 0) return;
  const isChecked = await box.isChecked().catch(() => false);
  if (isChecked === checked) return;
  if (checked) {
    await box.check({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
  } else {
    await box.uncheck({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
  }
  await settle(rootPage(scope));
}

export async function twUploadFileByName(
  scope: TwScope,
  name: string,
  filePath: string | undefined | null,
): Promise<void> {
  if (!filePath) return;
  const input = byName(scope, name).first();
  if ((await input.count().catch(() => 0)) === 0) return;
  await input.setInputFiles(filePath, { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await settle(rootPage(scope));
}

/**
 * The "應檢附文件" (supporting documents) block renders a variable, category-
 * dependent set of `documents[N].attachs[0]` file inputs inside a `<table>`,
 * one per `<tr>`, with each row's *specific* requirement description living
 * in the immediately preceding `<tr>` (confirmed live via DOM inspection —
 * e.g. row N's previous sibling row's text is "大陸地區所發尚餘6個月以上
 * 效期之旅行證件…" for the shared mainland-travel-document slot).
 *
 * IMPORTANT: each row also carries a hidden `documents[N].reasonCode` value,
 * but that code is shared across every row within one eligibility category
 * (confirmed live: switching to eligibility_category="9" showed the SAME
 * reasonCode on all 6 supporting-document rows) — it tags "this document
 * belongs to category 9", not "this is the residency-proof row" specifically.
 * reasonCode therefore cannot distinguish between the different document
 * types within a category; only the row's own description text can. Do not
 * add a reasonCode-based lookup here — use description-substring matching.
 */
export async function twUploadFileByDocumentDescription(
  page: Page,
  descriptionSubstring: string,
  filePath: string | undefined | null,
): Promise<void> {
  if (!filePath) return;
  const fileInputs = page.locator('input[name^="documents["][name$="].attachs[0]"]');
  const count = await fileInputs.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const input = fileInputs.nth(i);
    const descriptionRow = input.locator("xpath=ancestor::tr[1]/preceding-sibling::tr[1]");
    const text = await descriptionRow.innerText({ timeout: SHORT_TIMEOUT }).catch(() => "");
    if (text.includes(descriptionSubstring)) {
      await input.setInputFiles(filePath, { timeout: SHORT_TIMEOUT }).catch(() => undefined);
      await settle(page);
      return;
    }
  }
}

/**
 * Date fields (traveller.birthDate, traveller.passportExpiryDate,
 * kinships[N].birthDate, coaExtraPassportInfo.othPassportExpiryDate) are
 * NOT native `<input type=date>` and are NOT freely typeable: live DOM
 * inspection confirmed each is `readOnly: true` with class `hasDatepicker`,
 * paired with an `img.ui-datepicker-trigger` icon, and clicking that icon
 * opens the standard jQuery UI Datepicker widget (`#ui-datepicker-div`,
 * with `.ui-datepicker-month` / `.ui-datepicker-year` <select>s and day
 * links under `.ui-datepicker-calendar`). Calling `.fill()` on a readonly
 * input throws (silently swallowed by the existing catch-and-noop
 * convention), so the old alias to twFillText was a confirmed no-op for
 * every date field. This drives the real widget instead.
 */
export async function twFillDateByName(scope: TwScope, name: string, isoDate: string | undefined): Promise<void> {
  if (!isoDate) return;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // jQuery UI month <select> is 0-indexed
  const day = Number(dayStr);

  const page = rootPage(scope);
  const input = byName(scope, name).first();
  if ((await input.count().catch(() => 0)) === 0) return;

  // Prefer the dedicated trigger icon (confirmed sibling of the input);
  // fall back to clicking the input itself if the icon isn't found.
  const icon = input
    .locator("xpath=ancestor::*[1]//img[contains(@class,'ui-datepicker-trigger')]")
    .first();
  if ((await icon.count().catch(() => 0)) > 0) {
    await icon.click({ timeout: SHORT_TIMEOUT }).catch(() => undefined);
  } else {
    await input.click({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
  }

  const picker = page.locator("#ui-datepicker-div");
  const shown = await picker
    .first()
    .waitFor({ state: "visible", timeout: SHORT_TIMEOUT })
    .then(() => true)
    .catch(() => false);
  if (!shown) return; // safe no-op — matches the existing degrade-gracefully convention

  // TODO(confirmed real, intermittent race — live-tested): setting year then
  // month back-to-back right after the picker becomes visible sometimes
  // leaves month reverted to whatever it was before (reproduced once with a
  // real mouse click on the trigger icon, though not on every attempt) —
  // looks like jQuery UI's own re-render from the year change can clobber an
  // immediately-following month change. Mitigated with a settle before
  // touching either select, plus a verify-and-retry on month specifically
  // (the one observed to lose its value) rather than trusting selectOption
  // succeeded just because it didn't throw.
  await settle(page);
  await picker.locator(".ui-datepicker-year").selectOption(String(year), { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await settle(page);

  const monthSelect = picker.locator(".ui-datepicker-month");
  for (let attempt = 0; attempt < 2; attempt++) {
    await monthSelect.selectOption(String(monthIndex), { timeout: SHORT_TIMEOUT }).catch(() => undefined);
    await settle(page);
    const currentMonth = await monthSelect.inputValue({ timeout: SHORT_TIMEOUT }).catch(() => null);
    if (currentMonth === String(monthIndex)) break;
  }

  const dayLink = picker
    .locator(".ui-datepicker-calendar a")
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first();
  await dayLink.click({ timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await settle(page);
}

/** Select an option by its underlying `value` attribute (not visible text).
 *  The seed contract's option codes (embassy office, nationality, TW city,
 *  occupation, kinship status, …) were captured live off the actual
 *  `<select>` markup, so selecting by value is the accurate, robust path —
 *  unlike UK's country dropdowns, these do not need label-text fallback. */
export async function twSelectByValue(scope: TwScope, labelZh: string, value: string | undefined): Promise<void> {
  if (!value) return;
  const select = scope.getByLabel(labelZh, { exact: false }).first();
  if ((await select.count().catch(() => 0)) === 0) return;
  await select.selectOption(value, { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await settle(rootPage(scope));
}

/** Pick a radio option by its visible option label, scoped page-wide.
 *  Prefer `twPickRadioInGroup` when more than one radio group on the page
 *  could share the same option text (e.g. multiple 是/否 questions). */
export async function twPickRadio(scope: TwScope, optionLabelZh: string): Promise<void> {
  if (!optionLabelZh) return;
  const radio = scope.getByRole("radio", { name: optionLabelZh, exact: false }).first();
  if ((await radio.count().catch(() => 0)) > 0) {
    if (!(await radio.isChecked().catch(() => false))) {
      await radio.check({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
    }
    await settle(rootPage(scope));
    return;
  }
  const label = scope.locator("label", { hasText: optionLabelZh }).first();
  if ((await label.count().catch(() => 0)) > 0) {
    await label.click({ timeout: SHORT_TIMEOUT }).catch(() => undefined);
    await settle(rootPage(scope));
  }
}

/**
 * Pick a radio option within the group nearest a given question label.
 * Several fields on the single long "申請表" page reuse identical option
 * text (是/否), so a page-wide `getByRole("radio", { name: "是" })` would be
 * ambiguous. This scopes the search to the nearest container that also
 * contains the question's own label text before looking for the option.
 *
 * TODO(human verify): the ancestor-container heuristic below assumes a
 * conventional fieldset/div-per-question layout. Confirm against the live
 * DOM and replace with a fixed selector if it mis-scopes in practice.
 */
export async function twPickRadioInGroup(
  page: Page,
  questionLabelZh: string,
  optionLabelZh: string,
): Promise<void> {
  if (!optionLabelZh) return;
  const questionNode = page.getByText(questionLabelZh, { exact: false }).first();
  if ((await questionNode.count().catch(() => 0)) === 0) {
    await twPickRadio(page, optionLabelZh);
    return;
  }
  const scope = questionNode.locator("xpath=ancestor::*[self::fieldset or self::div or self::li][1]");
  await twPickRadio(scope, optionLabelZh);
}

export async function twPickCheckbox(scope: TwScope, labelZh: string, checked: boolean): Promise<void> {
  const box = scope.getByLabel(labelZh, { exact: false }).first();
  if ((await box.count().catch(() => 0)) === 0) return;
  const isChecked = await box.isChecked().catch(() => false);
  if (isChecked === checked) return;
  if (checked) {
    await box.check({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
  } else {
    await box.uncheck({ timeout: SHORT_TIMEOUT, force: true }).catch(() => undefined);
  }
  await settle(rootPage(scope));
}

export async function twUploadFile(scope: TwScope, labelZh: string, filePath: string | undefined | null): Promise<void> {
  if (!filePath) return;
  const labeled = scope.getByLabel(labelZh, { exact: false }).first();
  const fileInput = (await labeled.count().catch(() => 0)) > 0 ? labeled : scope.locator('input[type="file"]').first();
  if ((await fileInput.count().catch(() => 0)) === 0) return;
  await fileInput.setInputFiles(filePath, { timeout: SHORT_TIMEOUT }).catch(() => undefined);
  await settle(rootPage(scope));
}

export async function twClickButtonOrLink(scope: TwScope, textZh: string): Promise<boolean> {
  const button = scope.getByRole("button", { name: textZh, exact: false }).first();
  if ((await button.count().catch(() => 0)) > 0) {
    await button.click({ timeout: SHORT_TIMEOUT }).catch(() => undefined);
    await settle(rootPage(scope));
    return true;
  }
  const link = scope.getByRole("link", { name: textZh, exact: false }).first();
  if ((await link.count().catch(() => 0)) > 0) {
    await link.click({ timeout: SHORT_TIMEOUT }).catch(() => undefined);
    await settle(rootPage(scope));
    return true;
  }
  return false;
}

/** CAPTCHA halt-boundary detection — the image src pattern, refresh/audio
 *  links, and input placeholder all come verbatim from the live walkthrough
 *  (docs/tw-entry-permit-auto-submit-plan.md §2.5). Used by apply.ts to
 *  confirm it landed exactly where it's supposed to stop, never to solve it. */
export async function isAtTwCaptchaBoundary(page: Page): Promise<boolean> {
  const captchaImg = page.locator('img[src*="/coa-frontend/captcha"]').first();
  if ((await captchaImg.count().catch(() => 0)) > 0) return true;
  const captchaInput = page.getByPlaceholder("請輸入驗證碼").first();
  if ((await captchaInput.count().catch(() => 0)) > 0) return true;
  const refreshLink = page.getByText("換下一組", { exact: false }).first();
  return (await refreshLink.count().catch(() => 0)) > 0;
}
