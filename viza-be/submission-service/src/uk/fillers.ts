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

const SHORT_TIMEOUT = 5_000;
const SETTLE_MS = 150;

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Fill a plain text/email/tel input by id. Tabs out to trigger any
 * client-side validation.
 */
export async function ukFillText(page: Page, domId: string, value: string): Promise<void> {
  if (!value) return;
  const input = page.locator(`#${cssEscape(domId)}`).first();
  if ((await input.count()) === 0) return;
  await input.fill(value, { timeout: SHORT_TIMEOUT });
  await input.press("Tab", { timeout: SHORT_TIMEOUT }).catch(() => undefined);
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
  if (!m) return;
  const [, y, mo, d] = m;
  await ukFillText(page, `${base}_day`, String(Number(d)));
  await ukFillText(page, `${base}_month`, String(Number(mo)));
  await ukFillText(page, `${base}_year`, y);
}

/**
 * Fill a 2-input month/year split (jobStartDate uses this shape).
 */
export async function ukFillMonthYearSplit(page: Page, base: string, isoMonth: string): Promise<void> {
  if (!isoMonth) return;
  const m = isoMonth.match(/^(\d{4})-(\d{2})/);
  if (!m) return;
  const [, y, mo] = m;
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
    for (const id of postCodeIds) {
      if ((await page.locator(`#${cssEscape(id)}`).count()) > 0) {
        await ukFillText(page, id, addr.postCode);
        break;
      }
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
  const n = await groupLocator.count();
  for (let i = 0; i < n; i++) {
    const radio = groupLocator.nth(i);
    const id = await radio.getAttribute("id");
    if (!id) continue;
    const labelText = await page.locator(`label[for="${cssEscape(id)}"]`).first().textContent().catch(() => null);
    if (!labelText) continue;
    if (labelText.trim().toLowerCase() === visibleLabel.trim().toLowerCase()) {
      await radio.check({ force: true, timeout: SHORT_TIMEOUT }).catch(() => undefined);
      await settle(page);
      return;
    }
  }
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
  for (let i = 0; i < n; i++) {
    const box = boxes.nth(i);
    const id = await box.getAttribute("id");
    if (!id) continue;
    const labelText = await page.locator(`label[for="${cssEscape(id)}"]`).first().textContent().catch(() => null);
    if (!labelText) continue;
    if (wanted.has(labelText.trim().toLowerCase())) {
      await box.check({ force: true, timeout: SHORT_TIMEOUT }).catch(() => undefined);
    }
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
  if ((await sel.count()) === 0) return;
  await sel
    .selectOption({ label: visibleLabel }, { timeout: SHORT_TIMEOUT })
    .catch(() => undefined);
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
  if ((await sel.count()) === 0) return;

  // Try ISO-3 value first (e.g. "CHN"), then visible label (e.g. "China").
  let selected = await sel
    .selectOption(codeOrLabel.toUpperCase(), { timeout: SHORT_TIMEOUT })
    .then(() => true)
    .catch(() => false);
  if (!selected) {
    selected = await sel
      .selectOption({ label: codeOrLabel }, { timeout: SHORT_TIMEOUT })
      .then(() => true)
      .catch(() => false);
  }
  if (!selected) return;
  await settle(page);

  // Sync the visible autocomplete input from the chosen option's text.
  const uiId = `${baseId}_ui`;
  if ((await page.locator(`#${cssEscape(uiId)}`).count()) > 0) {
    const display = await sel
      .locator("option:checked")
      .first()
      .textContent()
      .catch(() => null);
    await ukFillText(page, uiId, (display ?? codeOrLabel).trim());
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

/**
 * Click the universal "Save and continue" submit. Returns the URL the
 * portal navigates to after the click.
 */
export async function ukClickSaveContinue(page: Page, navTimeoutMs = 30_000): Promise<string> {
  const submit = page.locator('input#submit, input[name="submit"][value="Save and continue"]').first();
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: navTimeoutMs }).catch(() => undefined),
    submit.click({ timeout: 10_000 }),
  ]);
  return page.url();
}

function cssEscape(id: string): string {
  return id.replace(/([!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~])/g, "\\$1");
}
