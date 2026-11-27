/**
 * UK Standard Visitor field-fill primitives.
 *
 * gov.uk's apply-uk-visa portal renders vanilla HTML controls + an
 * accessible-autocomplete shim for country dropdowns. No PrimeFaces, no
 * JSF widgets — Playwright's built-in fill / check / selectOption work
 * directly. The primitives here encode the page-shape patterns documented
 * in `docs/uk-standard-visitor-walk-report.md` §4.
 *
 * Universal submit selector: input#submit[name="submit"][value="Save and continue"]
 */

import type { Page } from "@playwright/test";
import { resolveCountryIso3 } from "./country-iso3";
import type { UkTimingDiagnosticCode } from "./timing.js";

const SHORT_TIMEOUT = 4_000;
const SETTLE_MS = 0;

export class UkRadioFillError extends Error {
  public readonly diagnosticCode: Exclude<UkTimingDiagnosticCode, "unknown">;

  public constructor(
    diagnosticCode: Exclude<UkTimingDiagnosticCode, "unknown">,
    message: string,
  ) {
    super(message);
    this.name = "UkRadioFillError";
    this.diagnosticCode = diagnosticCode;
  }
}

function normalizeVisibleLabel(value: string): string {
  return value.replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

async function settle(page: Page): Promise<void> {
  if (SETTLE_MS <= 0) return;
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Fill a plain text/email/tel input by id. Tabs out to trigger any
 * client-side validation.
 */
export async function ukFillText(page: Page, domId: string, value: string): Promise<void> {
  if (!value) return;
  const input = page.locator(`#${cssEscape(domId)}`).first();
  if ((await input.count()) === 0) {
    throw new Error(`Text control "#${domId}" was not found`);
  }
  const current = (await input.inputValue().catch(() => "")).trim();
  if (current === value.trim()) return;
  await input.fill(value, { timeout: SHORT_TIMEOUT });
  await input.press("Tab", { timeout: SHORT_TIMEOUT });
  const filled = (await input.inputValue()).trim();
  if (filled !== value.trim()) {
    throw new Error(`Text control "#${domId}" did not retain the requested value`);
  }
  await settle(page);
}

/**
 * Fill a textarea by id.
 */
export async function ukFillTextarea(page: Page, domId: string, value: string): Promise<void> {
  await ukFillText(page, domId, value);
}

/**
 * Fill a 3-input date split. ISO `YYYY-MM-DD` in, three numeric fields out.
 * Strips leading zeros — gov.uk validators are tolerant but inconsistent
 * formatting can trigger downstream cross-page checks.
 */
export async function ukFillDateSplit(page: Page, base: string, isoDate: string): Promise<void> {
  if (!isoDate) return;
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Invalid date for "${base}": expected YYYY-MM-DD`);
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date for "${base}": ${isoDate}`);
  }
  await ukFillText(page, `${base}_day`, String(Number(d)));
  await ukFillText(page, `${base}_month`, String(Number(mo)));
  await ukFillText(page, `${base}_year`, y);
}

/**
 * Fill a 2-input month/year split (jobStartDate uses this shape).
 */
export async function ukFillMonthYearSplit(page: Page, base: string, isoMonth: string): Promise<void> {
  if (!isoMonth) return;
  const m = isoMonth.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!m) throw new Error(`Invalid month for "${base}": expected YYYY-MM`);
  const [, y, mo] = m;
  if (Number(mo) < 1 || Number(mo) > 12) {
    throw new Error(`Invalid month for "${base}": ${isoMonth}`);
  }
  await ukFillText(page, `${base}_month`, String(Number(mo)));
  await ukFillText(page, `${base}_year`, y);
}

/**
 * Fill the universal address-split block. Probes both `postCode` and
 * `postalCode` ids since gov.uk diverges per page.
 */
export interface UkAddressInput {
  line1?: string;
  line2?: string;
  line3?: string;
  townCity?: string;
  province?: string;
  postCode?: string;
  /** Visible label, e.g. "United States of America". Caller is responsible
   *  for providing the gov.uk-canonical label (mismatches fall back to a
   *  raw selectOption attempt). */
  countryRefLabel?: string;
}

export async function ukFillAddressBlock(
  page: Page,
  base: string,
  addr: UkAddressInput,
): Promise<void> {
  await ukFillText(page, `${base}_line1`, addr.line1 ?? "");
  await ukFillText(page, `${base}_line2`, addr.line2 ?? "");
  await ukFillText(page, `${base}_line3`, addr.line3 ?? "");
  await ukFillText(page, `${base}_townCity`, addr.townCity ?? "");
  await ukFillText(page, `${base}_province`, addr.province ?? "");
  if (addr.postCode) {
    // Try both id variants — different pages use different names.
    const postCodeIds = [`${base}_postCode`, `${base}_postalCode`];
    let foundPostCode = false;
    for (const id of postCodeIds) {
      if ((await page.locator(`#${cssEscape(id)}`).count()) > 0) {
        await ukFillText(page, id, addr.postCode);
        foundPostCode = true;
        break;
      }
    }
    if (!foundPostCode) {
      throw new Error(`Postal code control for "${base}" was not found`);
    }
  }
  if (addr.countryRefLabel) {
    await ukSelectCountry(page, `${base}_countryRef`, addr.countryRefLabel);
  }
}

/**
 * Pick a radio in a single-choice group. The runner provides the
 * VISIBLE label and we look up the matching radio by label-text.
 */
export async function ukPickRadio(
  page: Page,
  groupName: string,
  visibleLabel: string,
): Promise<void> {
  if (!visibleLabel) return;
  const groupLocator = page.locator(`input[type="radio"][name="${cssEscape(groupName)}"]`);
  let n = await groupLocator.count();
  if (n === 0) {
    await groupLocator.first().waitFor({ state: "attached", timeout: 1_000 }).catch(() => undefined);
    n = await groupLocator.count();
  }
  if (n === 0) {
    throw new UkRadioFillError("radio_group_missing", `Radio group "${groupName}" was not found`);
  }
  let sawUsableLabel = false;
  let labelPolls = 0;
  while (true) {
    for (let i = 0; i < n; i++) {
      const radio = groupLocator.nth(i);
      const id = await radio.getAttribute("id");
      const associatedLabelLocator = id
        ? page.locator(`label[for="${cssEscape(id)}"]`).first()
        : null;
      let labelText = associatedLabelLocator && (await associatedLabelLocator.count()) > 0
        ? await associatedLabelLocator.textContent().catch(() => null)
        : null;
      if (!labelText?.trim()) {
        labelText = await radio
          .evaluate((element) => element.closest("label")?.textContent ?? null)
          .catch(() => null);
      }
      if (!labelText?.trim()) continue;
      sawUsableLabel = true;
      if (normalizeVisibleLabel(labelText) === normalizeVisibleLabel(visibleLabel)) {
        if (await radio.isChecked().catch(() => false)) return;
        if (await radio.isDisabled().catch(() => true)) {
          throw new UkRadioFillError(
            "radio_disabled",
            `Radio "${visibleLabel}" is disabled in group "${groupName}"`,
          );
        }
        try {
          await radio.check({ force: true, timeout: SHORT_TIMEOUT });
        } catch {
          throw new UkRadioFillError(
            "radio_check_failed",
            `Radio "${visibleLabel}" could not be checked in group "${groupName}"`,
          );
        }
        if (!(await radio.isChecked())) {
          throw new UkRadioFillError(
            "radio_check_failed",
            `Radio "${visibleLabel}" did not become checked in group "${groupName}"`,
          );
        }
        await settle(page);
        return;
      }
    }

    if (labelPolls >= 10) break;
    labelPolls += 1;
    await page.waitForTimeout(100);
    n = await groupLocator.count();
  }
  throw new UkRadioFillError(
    sawUsableLabel ? "radio_option_unmatched" : "radio_label_missing",
    `Radio label "${visibleLabel}" was not found in group "${groupName}"`,
  );
}

/** Pick a gov.uk yes/no radio group backed by `true`/`false` values. */
export async function ukPickBooleanRadio(
  page: Page,
  groupName: string,
  yes: boolean,
): Promise<void> {
  const candidates = yes
    ? ["true", "True", "yes", "Yes", "1"]
    : ["false", "False", "no", "No", "0"];
  for (const value of candidates) {
    const radio = page
      .locator(`input[type="radio"][name="${cssEscape(groupName)}"][value="${cssEscape(value)}"]`)
      .first();
    if ((await radio.count()) > 0) {
      if (await radio.isChecked()) return;
      await radio.check({ force: true, timeout: SHORT_TIMEOUT });
      if (!(await radio.isChecked())) {
        throw new Error(`Radio value "${value}" did not become checked in group "${groupName}"`);
      }
      await settle(page);
      return;
    }
  }
  await ukPickRadio(page, groupName, yes ? "Yes" : "No");
}

/** `isCorrespondenceAddress`: true = correspondence same as home address. */
export async function ukPickCorrespondenceAddressSame(
  page: Page,
  sameAsHome: boolean,
): Promise<void> {
  const targetId = sameAsHome ? "isCorrespondenceAddress_true" : "isCorrespondenceAddress_false";
  const radio = page.locator(`#${cssEscape(targetId)}`).first();
  if ((await radio.count()) === 0) {
    await ukPickBooleanRadio(page, "isCorrespondenceAddress", sameAsHome);
    return;
  }
  if (await radio.isChecked()) return;
  if (await radio.isDisabled()) {
    throw new Error(`Correspondence address radio "${targetId}" is disabled`);
  }
  await radio.check({ force: true, timeout: SHORT_TIMEOUT });
  if (!(await radio.isChecked())) {
    throw new Error(`Correspondence address radio "${targetId}" did not become checked`);
  }
  await page.waitForTimeout(300);
}

/**
 * Tick checkboxes whose visible labels match any of `visibleLabels`. The
 * checkbox group typically uses `name="<field>[i]"`; we match by label text.
 */
export async function ukPickCheckboxes(
  page: Page,
  groupNamePrefix: string,
  visibleLabels: string[],
): Promise<void> {
  if (visibleLabels.length === 0) return;
  const wanted = new Set(visibleLabels.map((l) => l.trim().toLowerCase()));
  const boxes = page.locator(
    `input[type="checkbox"][name^="${cssEscape(groupNamePrefix)}"]`,
  );
  const n = await boxes.count();
  const matched = new Set<string>();
  for (let i = 0; i < n; i++) {
    const box = boxes.nth(i);
    const id = await box.getAttribute("id");
    if (!id) continue;
    const labelText = await page.locator(`label[for="${cssEscape(id)}"]`).first().textContent().catch(() => null);
    if (!labelText) continue;
    if (wanted.has(labelText.trim().toLowerCase())) {
      const normalized = labelText.trim().toLowerCase();
      if (await box.isChecked().catch(() => false)) {
        matched.add(normalized);
        continue;
      }
      if (await box.isDisabled().catch(() => true)) {
        throw new Error(`Checkbox "${labelText.trim()}" is disabled in group "${groupNamePrefix}"`);
      }
      await box.check({ force: true, timeout: SHORT_TIMEOUT });
      if (!(await box.isChecked())) {
        throw new Error(`Checkbox "${labelText.trim()}" did not become checked`);
      }
      matched.add(normalized);
    }
  }
  const missing = [...wanted].filter((label) => !matched.has(label));
  if (missing.length > 0) {
    throw new Error(`Checkbox label(s) not found in group "${groupNamePrefix}": ${missing.join(", ")}`);
  }
  await settle(page);
}

/**
 * Select an option by visible text on a vanilla `<select>`.
 */
export async function ukSelectOption(
  page: Page,
  domId: string,
  visibleLabel: string,
): Promise<void> {
  if (!visibleLabel) return;
  const sel = page.locator(`#${cssEscape(domId)}`).first();
  if ((await sel.count()) === 0) {
    throw new Error(`Select control "#${domId}" was not found`);
  }
  let selected: string[];
  try {
    selected = await sel.selectOption({ label: visibleLabel }, { timeout: SHORT_TIMEOUT });
  } catch (labelError) {
    try {
      selected = await sel.selectOption(visibleLabel, { timeout: SHORT_TIMEOUT });
    } catch (valueError) {
      throw new Error(
        `Select control "#${domId}" could not select "${visibleLabel}": ${
          valueError instanceof Error ? valueError.message : labelError instanceof Error ? labelError.message : String(valueError)
        }`,
      );
    }
  }
  if (selected.length === 0 || !(await sel.inputValue())) {
    throw new Error(`Select control "#${domId}" did not retain "${visibleLabel}"`);
  }
  await settle(page);
}

/**
 * Set a country-autocomplete pair: underlying `<select id="<base>">` + the
 * visible `<input id="<base>_ui">`.
 *
 * The gov.uk country `<select>` carries ISO-3 alpha values (e.g. "CHN") with
 * full-name display text (e.g. "China"). Callers may pass either form, so we
 * try selecting by option VALUE first (ISO-3 codes from the wizard) and fall
 * back to matching by visible LABEL. The `_ui` autocomplete display is then
 * synced from whichever option actually got selected — keeping the visible
 * text correct even when the caller passed a code.
 */
export async function ukSelectCountry(
  page: Page,
  baseId: string,
  codeOrLabel: string,
): Promise<void> {
  if (!codeOrLabel) return;
  const sel = page.locator(`#${cssEscape(baseId)}`).first();
  if ((await sel.count()) === 0) {
    throw new Error(`Country select "#${baseId}" was not found`);
  }

  const iso3 =
    (resolveCountryIso3(codeOrLabel) ??
      (await sel
        .evaluate((el, label) => {
          const normalized = label.trim().toLowerCase();
          const opt = Array.from((el as HTMLSelectElement).options).find(
            (o) =>
              o.value.toUpperCase() === label.toUpperCase() ||
              o.text.trim().toLowerCase() === normalized,
          );
          return opt?.value ?? "";
        }, codeOrLabel)
        .catch(() => ""))) ||
    codeOrLabel.toUpperCase();

  const optionText = await sel
    .evaluate((el, v) => {
      const opt = Array.from((el as HTMLSelectElement).options).find((o) => o.value === v);
      return opt?.text ?? "";
    }, iso3)
    .catch(() => "");

  const uiId = `${baseId}_ui`;
  const ui = page.locator(`#${cssEscape(uiId)}`).first();
  if (optionText && (await ui.count()) > 0) {
    try {
      await ui.click({ timeout: 5_000 });
      await ui.fill("");
      await ui.pressSequentially(optionText, { delay: 25, timeout: 10_000 });
      await page.waitForTimeout(400);
      const option = page.getByRole("option", { name: optionText, exact: true }).first();
      if ((await option.count()) > 0 && (await option.isVisible().catch(() => false))) {
        await option.click({ timeout: 5_000 });
      } else {
        await ui.press("ArrowDown", { timeout: 2_000 });
        await page.waitForTimeout(200);
        await ui.press("Enter", { timeout: 2_000 });
      }
      const committed = await sel.evaluate((el) => (el as HTMLSelectElement).value);
      if (committed === iso3) {
        await settle(page);
        return;
      }
    } catch {
      /* fall through to forced select */
    }
  }

  let selected = await sel
    .selectOption(iso3, { timeout: SHORT_TIMEOUT, force: true })
    .then(() => true)
    .catch(() => false);
  if (!selected) {
    selected = await sel
      .selectOption({ label: codeOrLabel }, { timeout: SHORT_TIMEOUT })
      .then(() => true)
      .catch(() => false);
  }
  if (!selected) {
    throw new Error(`Country select "#${baseId}" could not select "${codeOrLabel}"`);
  }
  await sel.evaluate((el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const committed = await sel.evaluate((el) => (el as HTMLSelectElement).value);
  if (committed !== iso3) {
    throw new Error(`Country select "#${baseId}" did not retain "${iso3}"`);
  }
  await settle(page);

  if ((await page.locator(`#${cssEscape(uiId)}`).count()) > 0) {
    const display = await sel
      .locator("option:checked")
      .first()
      .textContent()
      .catch(() => null);
    await ukFillText(page, uiId, (display ?? optionText ?? codeOrLabel).trim());
  }
}

/**
 * Fill the universal phone split: `phone_code` (country code) + `phone_number`.
 */
export async function ukFillPhoneSplit(
  page: Page,
  countryCode: string,
  number: string,
): Promise<void> {
  if (countryCode) await ukFillText(page, "phone_code", countryCode);
  if (number) await ukFillText(page, "phone_number", number);
}

function extractSlugFromUkUrl(url: string): string | null {
  const match = url.match(/application\.0\.([^/?#]+)/i);
  return match?.[1] ?? null;
}

export interface UkFormProbe {
  url: string;
  formAction: string | null;
  heading: string | null;
}

/** gov.uk keeps `/next` across steps — form.action + h1 are the real page identity. */
export async function probeUkFormState(page: Page): Promise<UkFormProbe> {
  return page.evaluate(() => {
    const form = document.querySelector("form");
    const heading = document.querySelector("h1");
    return {
      url: location.href,
      formAction: form?.getAttribute("action") ?? null,
      heading: heading?.textContent?.trim() ?? null,
    };
  });
}

export function extractSlugFromFormAction(action: string | null): string | null {
  if (!action) return null;
  const match = action.match(/application\.0\.([^/?#]+)/i);
  return match?.[1] ?? null;
}

export function resolveUkPageSlug(probe: UkFormProbe): string | null {
  return extractSlugFromUkUrl(probe.url) ?? extractSlugFromFormAction(probe.formAction);
}

function formStateAdvanced(before: UkFormProbe, after: UkFormProbe): boolean {
  if (isTerminalUkPage(after.url)) return true;
  if (
    before.url.includes("/edit/application.0.") &&
    after.url.includes("/save/application.0.")
  ) {
    const beforeSlug =
      extractSlugFromUkUrl(before.url) ?? extractSlugFromFormAction(before.formAction);
    const afterSlug =
      extractSlugFromUkUrl(after.url) ?? extractSlugFromFormAction(after.formAction);
    if (beforeSlug && afterSlug && beforeSlug === afterSlug) return true;
  }
  const beforeUrlSlug = extractSlugFromUkUrl(before.url);
  const afterUrlSlug = extractSlugFromUkUrl(after.url);
  if (afterUrlSlug && beforeUrlSlug && afterUrlSlug !== beforeUrlSlug) return true;
  if (before.formAction !== after.formAction && after.formAction) return true;
  if (before.heading !== after.heading && after.heading) return true;
  const beforeActionSlug = extractSlugFromFormAction(before.formAction);
  const afterActionSlug = extractSlugFromFormAction(after.formAction);
  if (afterActionSlug && beforeActionSlug && afterActionSlug !== beforeActionSlug) return true;
  return false;
}

function isTerminalUkPage(url: string): boolean {
  return /\/Documents|\/Declaration|\/pay\b/i.test(url);
}

export async function ukPageHasValidationErrors(page: Page): Promise<boolean> {
  const summary = page.locator(".govuk-error-summary");
  if ((await summary.count()) > 0) {
    const visible = await summary.first().isVisible().catch(() => false);
    if (visible) {
      const text = ((await summary.first().textContent().catch(() => "")) ?? "").trim();
      if (text.length > 0) return true;
    }
  }
  const messages = page.locator(".govuk-error-message");
  const n = await messages.count();
  for (let i = 0; i < n; i++) {
    const msg = messages.nth(i);
    if (!(await msg.isVisible().catch(() => false))) continue;
    const text = ((await msg.textContent().catch(() => "")) ?? "").trim();
    if (text.length > 0) return true;
  }
  return false;
}

export async function ukValidationErrorText(page: Page): Promise<string | null> {
  const summary = page.locator(".govuk-error-summary");
  if ((await summary.count()) > 0) {
    const text = ((await summary.first().textContent().catch(() => "")) ?? "").trim();
    if (text.length > 0) return text;
  }
  const messages = page.locator(".govuk-error-message");
  const parts: string[] = [];
  const n = await messages.count();
  for (let i = 0; i < n; i++) {
    const msg = messages.nth(i);
    if (!(await msg.isVisible().catch(() => false))) continue;
    const text = ((await msg.textContent().catch(() => "")) ?? "").trim();
    if (text.length > 0) parts.push(text);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}

async function waitForUkSaveProgress(
  page: Page,
  before: UkFormProbe,
  timeoutMs: number,
): Promise<UkFormProbe> {
  const deadline = Date.now() + Math.min(timeoutMs, 25_000);
  while (Date.now() < deadline) {
    await page.waitForLoadState("domcontentloaded", { timeout: 4_000 }).catch(() => undefined);
    const after = await probeUkFormState(page);
    if (formStateAdvanced(before, after)) return after;
    if (isTerminalUkPage(after.url)) return after;
    await page.waitForTimeout(150);
  }
  return probeUkFormState(page);
}

function ukSubmitLocator(page: Page) {
  return page.locator(
    'input#submit, input[name="submit"], button[name="submit"][type="submit"]',
  ).first();
}

/** gov.uk /save/application.0.* ack pages need an extra Save click to advance. */
export async function clickThroughUkSaveAck(
  page: Page,
  navTimeoutMs = 20_000,
): Promise<UkFormProbe> {
  const probe = await probeUkFormState(page);
  if (!probe.url.includes("/save/application.0.")) return probe;
  const submit = ukSubmitLocator(page);
  if ((await submit.count()) === 0) {
    throw new Error(`clickThroughUkSaveAck: no submit control found at ${page.url()}`);
  }
  await submit.scrollIntoViewIfNeeded().catch(() => undefined);
  await submit.click({ timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: navTimeoutMs }).catch(() => undefined);
  return waitForUkSaveProgress(page, probe, navTimeoutMs);
}

/**
 * Click the universal "Save and continue" submit. Returns the URL the
 * portal navigates to after the click.
 */
export async function ukClickSaveContinue(
  page: Page,
  navTimeoutMs = 30_000,
): Promise<{ url: string; navigated: boolean }> {
  const before = await probeUkFormState(page);
  const submit = ukSubmitLocator(page);
  // 8s was too tight — gov.uk (especially through the residential proxy) can
  // take a few seconds to make the submit button interactive after a page
  // that just ran client-side JS (e.g. Documents' checkbox handling), and a
  // bare Playwright "Timeout 8000ms exceeded" gave no hint of which case
  // we'd hit. Scroll it into view first and give it real room before
  // failing with a clearer, page-identifying error.
  if ((await submit.count()) === 0) {
    throw new Error(`ukClickSaveContinue: no submit control found at ${page.url()}`);
  }
  await submit.scrollIntoViewIfNeeded().catch(() => undefined);
  await submit.click({ timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: navTimeoutMs }).catch(() => undefined);
  const after = await waitForUkSaveProgress(page, before, navTimeoutMs);
  if (await ukPageHasValidationErrors(page)) {
    return { url: after.url, navigated: false };
  }
  const landedOnSaveAck =
    before.url.includes("/edit/application.0.") &&
    after.url.includes("/save/application.0.");
  if (formStateAdvanced(before, after) || landedOnSaveAck) {
    if (after.url.includes("/save/application.0.")) {
      const postAck = await clickThroughUkSaveAck(page, navTimeoutMs);
      const advanced =
        formStateAdvanced(after, postAck) || postAck.url.includes("/edit/application.0.");
      return { url: postAck.url, navigated: advanced };
    }
    return { url: after.url, navigated: true };
  }
  return { url: after.url, navigated: false };
}

function cssEscape(id: string): string {
  return id.replace(/([!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~])/g, "\\$1");
}
