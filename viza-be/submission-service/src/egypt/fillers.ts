import type { Page } from "@playwright/test";
import { mapEgAnswers, type MappedField } from "./field-mappings.js";

/**
 * Egypt e-Visa fillers (RUN-EG-001). Defensive fill helpers driven by
 * field-mappings.ts. Never throw on a missing field — an unrecon'd portal
 * degrades to a partially-filled page (caller decides halt/blocked).
 */

export async function safeFill(
  page: Page,
  selector: string,
  value: string,
  kind: "input" | "select",
): Promise<void> {
  try {
    if (kind === "select") {
      await page.selectOption(selector, value, { timeout: 5_000 });
    } else {
      await page.fill(selector, value, { timeout: 5_000 });
    }
  } catch (err) {
    console.warn(`[egypt] fill ${selector} failed: ${err instanceof Error ? err.message : err}`);
  }
}

/** Fill the Egypt form from canonical answers. Returns the plan that was applied. */
export async function fillEgForm(page: Page, answers: Record<string, string>): Promise<MappedField[]> {
  const plan = mapEgAnswers(answers);
  for (const f of plan) {
    await safeFill(page, f.selector, f.value, f.kind);
  }
  return plan;
}
