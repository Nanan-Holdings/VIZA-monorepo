import type { Locator, Page } from "@playwright/test";
import { waitForAspNetPostback } from "./aspnet";

export async function visibleEnabledLocators(page: Page, selector: string): Promise<Locator[]> {
  const all = page.locator(selector);
  const result: Locator[] = [];
  for (let index = 0; index < await all.count(); index += 1) {
    const candidate = all.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    if (!(await candidate.isEnabled().catch(() => false))) continue;
    result.push(candidate);
  }
  return result;
}

export async function clickVerifiedBooleanRadio(
  page: Page,
  selector: string,
  value: boolean,
  fieldName: string,
): Promise<void> {
  const expected = value
    ? new Set(["y", "yes", "true", "1"])
    : new Set(["n", "no", "false", "0"]);
  const candidates = page.locator(selector);
  for (let index = 0; index < await candidates.count(); index += 1) {
    const candidate = candidates.nth(index);
    const candidateValue = String(await candidate.getAttribute("value") ?? "").trim().toLowerCase();
    if (!expected.has(candidateValue)) continue;
    await candidate.click({ timeout: 5_000 });
    await waitForAspNetPostback(page, 8_000);

    const refreshed = page.locator(selector);
    for (let refreshedIndex = 0; refreshedIndex < await refreshed.count(); refreshedIndex += 1) {
      const refreshedCandidate = refreshed.nth(refreshedIndex);
      const refreshedValue = String(await refreshedCandidate.getAttribute("value") ?? "").trim().toLowerCase();
      if (!expected.has(refreshedValue)) continue;
      if (await refreshedCandidate.isChecked().catch(() => false)) return;
    }
    throw new Error(`CEAC ${fieldName} did not retain its selected answer`);
  }
  throw new Error(`CEAC ${fieldName} answer control was not found`);
}

export async function fillVerifiedText(
  page: Page,
  selector: string,
  value: string,
  fieldName: string,
  index = 0,
): Promise<void> {
  const controls = await visibleEnabledLocators(page, selector);
  const control = controls[index];
  if (!control) throw new Error(`CEAC ${fieldName} control was not found`);
  await control.fill(value, { timeout: 5_000 });
  if ((await control.inputValue()).trim() !== value) {
    throw new Error(`CEAC ${fieldName} did not retain its value`);
  }
}

export async function selectVerifiedOption(
  page: Page,
  selector: string,
  value: string,
  fieldName: string,
  index = 0,
): Promise<void> {
  const controls = await visibleEnabledLocators(page, selector);
  const control = controls[index];
  if (!control) throw new Error(`CEAC ${fieldName} control was not found`);

  let selectedValue: string | null = null;
  try {
    selectedValue = (await control.selectOption(value, { timeout: 5_000 }))[0] ?? null;
  } catch {
    const normalized = value.trim().toLowerCase();
    const optionValue = await control.evaluate((node, target) => {
      if (!(node instanceof HTMLSelectElement)) return null;
      const match = Array.from(node.options).find((option) => {
        if (option.disabled) return false;
        const candidateValue = option.value.trim().toLowerCase();
        const candidateText = option.text.trim().toLowerCase();
        return candidateValue === target || candidateText === target || candidateText.includes(target);
      });
      return match?.value ?? null;
    }, normalized);
    if (!optionValue) throw new Error(`CEAC ${fieldName} option was not found`);
    selectedValue = (await control.selectOption(optionValue, { timeout: 5_000 }))[0] ?? null;
  }

  await waitForAspNetPostback(page, 8_000);
  const refreshed = await visibleEnabledLocators(page, selector);
  const selected = refreshed[index];
  if (!selected) throw new Error(`CEAC ${fieldName} disappeared after selection`);
  const retainedValue = (await selected.inputValue()).trim();
  const retainedText = String(await selected.locator("option:checked").textContent().catch(() => "")).trim();
  if (retainedValue !== selectedValue && retainedValue !== value && !retainedText.toLowerCase().includes(value.toLowerCase())) {
    throw new Error(`CEAC ${fieldName} did not retain its selected value`);
  }
}

export async function ensureRepeaterRowCount(
  page: Page,
  rowSelector: string,
  addSelector: string,
  expected: number,
  label: string,
): Promise<void> {
  let rows = await visibleEnabledLocators(page, rowSelector);
  if (rows.length > expected) {
    throw new Error(`CEAC ${label} has stale rows; expected ${expected} but found ${rows.length}`);
  }
  if (rows.length === 0) throw new Error(`CEAC ${label} first row was not found`);

  while (rows.length < expected) {
    const addControls = await visibleEnabledLocators(page, addSelector);
    if (!addControls[0]) throw new Error(`CEAC ${label} Add Another control was not found`);
    const before = rows.length;
    await addControls[0].click({ timeout: 5_000 });
    await waitForAspNetPostback(page, 8_000);
    const deadline = Date.now() + 8_000;
    do {
      rows = await visibleEnabledLocators(page, rowSelector);
      if (rows.length > before) break;
      await page.waitForTimeout(100);
    } while (Date.now() < deadline);
    if (rows.length <= before) throw new Error(`CEAC ${label} Add Another did not create a row`);
  }
}
