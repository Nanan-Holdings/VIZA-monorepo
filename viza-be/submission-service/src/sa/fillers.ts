import type { Page } from "@playwright/test";
import { mapSaAnswers, type MappedField } from "./field-mappings.js";

/** Saudi e-Visa fillers (RUN-SA-001). Defensive — never throw on a missing field. */
export async function safeFill(page: Page, selector: string, value: string, kind: "input" | "select"): Promise<void> {
  try {
    if (kind === "select") await page.selectOption(selector, value, { timeout: 5_000 });
    else await page.fill(selector, value, { timeout: 5_000 });
  } catch (err) {
    console.warn(`[sa] fill ${selector} failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function fillSaForm(page: Page, answers: Record<string, string>): Promise<MappedField[]> {
  const plan = mapSaAnswers(answers);
  for (const f of plan) await safeFill(page, f.selector, f.value, f.kind);
  return plan;
}
