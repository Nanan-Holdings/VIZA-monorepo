import type { Locator, Page } from "@playwright/test";
import { toDdMmYyyy } from "./fillers.js";

export interface VietnamPreviousVisitRow {
  fromDate: string;
  toDate: string;
  purpose: string;
}

export interface VietnamConditionalValidationError {
  fieldName: string;
  message: string;
}

const MAX_REPEAT_ROWS = 5;

function normalizeAnswer(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isVietnamYes(value: string | null | undefined): boolean {
  return ["yes", "y", "true", "1"].includes(normalizeAnswer(value));
}

function repeatFieldName(baseName: string, index: number): string {
  return index === 0 ? baseName : `${baseName}__${index + 1}`;
}

export function collectVietnamPreviousVisitRows(
  answers: Record<string, string>,
): VietnamPreviousVisitRow[] {
  const rows: VietnamPreviousVisitRow[] = [];

  for (let index = 0; index < MAX_REPEAT_ROWS; index++) {
    const fromDate = answers[repeatFieldName("visited_vietnam_from_date", index)]?.trim() ?? "";
    const toDate = answers[repeatFieldName("visited_vietnam_to_date", index)]?.trim() ?? "";
    const purpose = answers[repeatFieldName("visited_vietnam_trip_purpose", index)]?.trim() ?? "";
    if (!fromDate && !toDate && !purpose) continue;
    rows.push({
      fromDate: toDdMmYyyy(fromDate),
      toDate: toDdMmYyyy(toDate),
      purpose,
    });
  }

  return rows;
}

export function validateVietnamConditionalAnswers(
  answers: Record<string, string>,
): VietnamConditionalValidationError[] {
  const errors: VietnamConditionalValidationError[] = [];

  if (isVietnamYes(answers.visited_vietnam_in_last_year)) {
    const rows = collectVietnamPreviousVisitRows(answers);
    if (rows.length === 0) {
      errors.push({
        fieldName: "visited_vietnam_in_last_year",
        message:
          "User answered Yes for prior Viet Nam travel, but the official From date / To date / Purpose of trip row fields are missing.",
      });
    }
    rows.forEach((row, index) => {
      const missing = [
        row.fromDate ? null : "From date",
        row.toDate ? null : "To date",
        row.purpose ? null : "Purpose of trip",
      ].filter((value): value is string => Boolean(value));
      if (missing.length > 0) {
        errors.push({
          fieldName: `visited_vietnam_last_year[${index + 1}]`,
          message: `Prior Viet Nam travel row ${index + 1} is incomplete: ${missing.join(", ")}.`,
        });
      }
    });
  }

  const unsupportedYesGroups: Array<[string, string]> = [
    ["has_other_passports_used_for_vietnam", "other passports used to enter Viet Nam"],
    ["has_violated_vietnam_laws", "Viet Nam law violation details"],
    ["has_contact_in_vietnam", "Viet Nam contact rows"],
    ["has_relatives_in_vietnam", "relatives in Viet Nam rows"],
    ["has_relatives", "relatives in Viet Nam rows"],
  ];
  for (const [fieldName, description] of unsupportedYesGroups) {
    if (!isVietnamYes(answers[fieldName])) continue;
    errors.push({
      fieldName,
      message:
        `User answered Yes for ${description}, but this conditional group is not mapped to official portal controls yet. Submission is blocked instead of changing the answer or dropping details.`,
    });
  }

  return errors;
}

export async function fillVietnamPreviousVisitRows(
  page: Page,
  answers: Record<string, string>,
): Promise<number> {
  const rows = collectVietnamPreviousVisitRows(answers);
  if (rows.length === 0) return 0;

  const table = page
    .locator("table")
    .filter({ hasText: /From date/i })
    .filter({ hasText: /To date/i })
    .filter({ hasText: /Purpose of trip/i })
    .first();
  await table.waitFor({ state: "visible", timeout: 7_500 });

  for (let index = 0; index < rows.length; index++) {
    await ensureVietnamTableRowCount(page, table, index + 1);
    const row = table.locator("tbody tr:not([aria-hidden='true'])").nth(index);
    await setVietnamTableInputValue(row.locator("td").nth(1).locator("input").first(), rows[index].fromDate);
    await setVietnamTableInputValue(row.locator("td").nth(2).locator("input").first(), rows[index].toDate);
    await setVietnamTableInputValue(row.locator("td").nth(3).locator("input, textarea").first(), rows[index].purpose);
    await page.waitForTimeout(150);
  }

  return rows.length;
}

async function setVietnamTableInputValue(input: Locator, value: string): Promise<void> {
  await input.waitFor({ state: "attached", timeout: 5_000 });
  await input.evaluate(
    (element, nextValue) => {
      const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
      const descriptor =
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inputElement), "value") ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value") ||
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      if (descriptor?.set) descriptor.set.call(inputElement, nextValue);
      else inputElement.value = nextValue;
      inputElement.dispatchEvent(new InputEvent("input", { bubbles: true, data: nextValue, inputType: "insertText" }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      inputElement.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    },
    value,
  );
}

async function ensureVietnamTableRowCount(
  page: Page,
  table: ReturnType<Page["locator"]>,
  expectedRows: number,
): Promise<void> {
  for (let attempt = 0; attempt < expectedRows; attempt++) {
    const currentRows = await table.locator("tbody tr:not([aria-hidden='true'])").count();
    if (currentRows >= expectedRows) return;

    const addButton = page
      .locator(
        [
          ".anticon-plus-circle",
          ".anticon-plus",
          "button[aria-label*='add' i]",
          "button:has-text('+')",
        ].join(", "),
      )
      .filter({ visible: true })
      .last();
    await addButton.click({ timeout: 5_000 });
    await page.waitForTimeout(250);
  }

  const rowCount = await table.locator("tbody tr").count();
  if (rowCount < expectedRows) {
    throw new Error(`Prior Viet Nam travel table has ${rowCount} row(s), expected ${expectedRows}.`);
  }
}
