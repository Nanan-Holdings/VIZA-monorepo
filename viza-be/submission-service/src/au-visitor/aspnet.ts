/**
 * Helpers for driving the WebOA / ASP.NET-style form runtime that
 * powers ImmiAccount eLodgement (`/elp/app`).
 *
 * The form re-renders sub-sections via partial postbacks. After
 * clicking Next or changing a gating select, we wait for a network
 * idle period or for a page-counter / heading change before reading
 * state again.
 */

import type { Page } from "playwright";
import { CONFIRM_MODAL, NAV_BUTTONS } from "./selectors";

/**
 * Click a control by its name attribute. Used for radios, checkboxes,
 * and buttons keyed by the form's hierarchical control name.
 */
export async function clickByName(page: Page, name: string, value?: string): Promise<void> {
  const selector = value
    ? `input[name="${name}"][value="${value}"]`
    : `input[name="${name}"]`;
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

/** Pick a Yes/No radio by the label text under the input's parent. */
export async function clickYesNo(page: Page, name: string, choice: "Yes" | "No"): Promise<void> {
  const radios = page.locator(`input[name="${name}"][type="radio"]`);
  const count = await radios.count();
  for (let i = 0; i < count; i++) {
    const r = radios.nth(i);
    const label = (await r.evaluate((el) => el.parentElement?.textContent || "")).trim();
    if (new RegExp(`^\\s*${choice}\\s*$`).test(label)) {
      await r.click();
      return;
    }
  }
  throw new Error(`No ${choice} radio found for control name=${name}`);
}

/**
 * Set a text/textarea/email input by name. Dispatches both `input`
 * and `change` events so the form's validators see the update.
 */
export async function fillByName(page: Page, name: string, value: string): Promise<void> {
  await page.evaluate(
    ([n, v]) => {
      const el = document.querySelector(`input[name="${n}"], textarea[name="${n}"]`) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [name, value],
  );
}

/** Set a `<select>` value by exact value match. */
export async function selectByName(page: Page, name: string, value: string): Promise<void> {
  await page.evaluate(
    ([n, v]) => {
      const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null;
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [name, value],
  );
}

/** Pick a `<select>` option by case-insensitive label match. */
export async function selectByLabel(page: Page, name: string, labelPattern: RegExp): Promise<void> {
  const value = await page.evaluate(
    ([n, src]) => {
      const el = document.querySelector(`select[name="${n}"]`) as HTMLSelectElement | null;
      if (!el) return null;
      const re = new RegExp(src, "i");
      const opt = Array.from(el.options).find((o) => re.test(o.text));
      if (!opt) return null;
      el.value = opt.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return opt.value;
    },
    [name, labelPattern.source],
  );
  if (value === null) throw new Error(`No <select name=${name}> option matched ${labelPattern}`);
}

/**
 * Pick a value from the typeahead combobox used for the "Department
 * office" picker on the Contact details page. Selection requires
 * clicking the rendered option, not typing the value.
 */
export async function pickFromCombobox(page: Page, listId: string, value: string): Promise<void> {
  const opt = page.locator(`#${listId} [data-wc-value="${value}"]`).first();
  await opt.click();
}

/**
 * Click Next and wait for either a page-counter change, a Confirm
 * modal, or an error pane to render.
 */
export async function clickNext(page: Page): Promise<void> {
  await page.locator(NAV_BUTTONS.next).click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

/** Click Previous (used to back out and switch a passport country, etc.). */
export async function clickPrevious(page: Page): Promise<void> {
  await page.locator(NAV_BUTTONS.previous).click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
}

/**
 * If the cross-section Confirm modal is showing, click Confirm and
 * return true; otherwise return false.
 */
export async function dismissConfirmModalIfShown(page: Page): Promise<boolean> {
  const confirm = page.locator(CONFIRM_MODAL.confirm);
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    return true;
  }
  return false;
}

/**
 * Default-fill all radio groups on the current page that are still
 * unchecked, picking the supplied default ("Yes" or "No"). Used for
 * pages where most questions take the safe default.
 */
export async function fillUncheckedRadiosDefault(
  page: Page,
  defaultChoice: "Yes" | "No",
): Promise<void> {
  await page.evaluate((choice) => {
    const groups = new Map<string, HTMLInputElement[]>();
    document.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((r) => {
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name)!.push(r);
    });
    for (const arr of groups.values()) {
      if (arr.some((x) => x.checked)) continue;
      const target = arr.find((x) => new RegExp(`^\\s*${choice}\\s*$`).test(x.parentElement?.textContent || ""));
      if (target) target.click();
    }
  }, defaultChoice);
}

/** Read the `N/M` page counter from the visible page chrome. */
export async function readPageMeta(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const m = document.body.innerText.match(/\b(\d+)\/(\d+)\b/);
    return m ? m[0] : null;
  });
}

/** Read all section headings rendered on the current page. */
export async function readHeadings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const set = new Set<string>();
    document.querySelectorAll("h1,h2,h3,legend").forEach((el) => {
      const t = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (t.length > 3) set.add(t);
    });
    return Array.from(set);
  });
}

/** Read all field-level validation error messages rendered on the page. */
export async function readValidationErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const set = new Set<string>();
    document.querySelectorAll('[class*="error"], [class*="Error"]').forEach((el) => {
      const t = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (t.length > 3 && t.length < 400) set.add(t);
    });
    return Array.from(set);
  });
}

/** Read the Transaction Reference Number from the chrome (`TRN: XXXXX`). */
export async function readTrn(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const m = document.body.innerText.match(/Transaction Reference Number \(TRN\):\s*([A-Z0-9]+)/);
    return m ? m[1] : null;
  });
}
