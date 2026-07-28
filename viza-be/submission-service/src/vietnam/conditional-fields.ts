import type { Locator, Page } from "@playwright/test";
import { pickSelect, toDdMmYyyy } from "./fillers.js";
import { getVnPortalOptionText } from "./field-mappings.js";

export interface VietnamPreviousVisitRow {
  fromDate: string;
  toDate: string;
  purpose: string;
}

export interface VietnamConditionalRepeatRow {
  values: string[];
}

export interface VietnamConditionalValidationError {
  fieldName: string;
  message: string;
}

const MAX_REPEAT_ROWS = 5;

type RepeatColumnType = "text" | "date" | "country";

interface RepeatColumnConfig {
  answerNames: string[];
  label: string;
  type: RepeatColumnType;
}

interface RepeatGroupConfig {
  triggerField: string;
  rowFieldName: string;
  description: string;
  tableDescription: string;
  question?: RegExp;
  headers: RegExp[];
  columns: RepeatColumnConfig[];
}

const PREVIOUS_VISIT_GROUP: RepeatGroupConfig = {
  triggerField: "visited_vietnam_in_last_year",
  rowFieldName: "visited_vietnam_last_year",
  description: "prior Viet Nam travel",
  tableDescription: "Prior Viet Nam travel",
  headers: [/From date/i, /To date/i, /Purpose of trip/i],
  columns: [
    { answerNames: ["visited_vietnam_from_date"], label: "From date", type: "date" },
    { answerNames: ["visited_vietnam_to_date"], label: "To date", type: "date" },
    { answerNames: ["visited_vietnam_trip_purpose"], label: "Purpose of trip", type: "text" },
  ],
};

const OTHER_PASSPORT_GROUP: RepeatGroupConfig = {
  triggerField: "has_other_passports_used_for_vietnam",
  rowFieldName: "other_passports_used_for_vietnam",
  description: "other passports used to enter Viet Nam",
  tableDescription: "Other passport used for Viet Nam entry",
  headers: [/Passport/i, /Full name/i, /Date of birth/i, /Nationality/i],
  columns: [
    { answerNames: ["other_vietnam_passport_number"], label: "Passport", type: "text" },
    { answerNames: ["other_vietnam_passport_full_name"], label: "Full name", type: "text" },
    { answerNames: ["other_vietnam_passport_date_of_birth"], label: "Date of birth", type: "date" },
    { answerNames: ["other_vietnam_passport_nationality"], label: "Nationality", type: "country" },
  ],
};

const MULTIPLE_NATIONALITY_GROUP: RepeatGroupConfig = {
  triggerField: "has_multiple_nationalities",
  rowFieldName: "multiple_nationalities",
  description: "multiple nationalities",
  tableDescription: "Multiple nationalities",
  question: /Do you have multiple nationalities\?/i,
  headers: [/Nationality/i],
  columns: [
    { answerNames: ["other_nationality", "other_nationality_country"], label: "Nationality", type: "country" },
  ],
};

const VIETNAM_CONTACT_GROUP: RepeatGroupConfig = {
  triggerField: "has_contact_in_vietnam",
  rowFieldName: "vietnam_contacts",
  description: "Viet Nam contact rows",
  tableDescription: "Viet Nam contact",
  headers: [/Name of hosting organization|Name/i, /Telephone number|Phone/i, /Address/i, /Purpose/i],
  columns: [
    { answerNames: ["contact_hosting_organization_name"], label: "Name of hosting organization", type: "text" },
    { answerNames: ["contact_hosting_organization_phone"], label: "Telephone number", type: "text" },
    { answerNames: ["contact_hosting_organization_address"], label: "Address", type: "text" },
    { answerNames: ["contact_hosting_organization_purpose"], label: "Purpose", type: "text" },
  ],
};

const VIETNAM_RELATIVE_GROUP: RepeatGroupConfig = {
  triggerField: "has_relatives_in_vietnam",
  rowFieldName: "relatives_in_vietnam",
  description: "relatives in Viet Nam rows",
  tableDescription: "Relatives in Viet Nam",
  headers: [/Full name/i, /Date of birth/i, /Nationality/i, /Relationship/i, /Address|Residential address/i],
  columns: [
    { answerNames: ["relative_full_name", "relative_full_name_in_vn"], label: "Full name", type: "text" },
    { answerNames: ["relative_date_of_birth"], label: "Date of birth", type: "date" },
    { answerNames: ["relative_nationality"], label: "Nationality", type: "country" },
    { answerNames: ["relative_relationship"], label: "Relationship", type: "text" },
    { answerNames: ["relative_residential_address", "relative_address_in_vn"], label: "Address", type: "text" },
  ],
};

const CONDITIONAL_REPEAT_GROUPS = [
  PREVIOUS_VISIT_GROUP,
  MULTIPLE_NATIONALITY_GROUP,
  OTHER_PASSPORT_GROUP,
  VIETNAM_CONTACT_GROUP,
  VIETNAM_RELATIVE_GROUP,
];

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
  return collectVietnamRepeatRows(answers, PREVIOUS_VISIT_GROUP).map((row) => ({
    fromDate: row.values[0] ?? "",
    toDate: row.values[1] ?? "",
    purpose: row.values[2] ?? "",
  }));
}

export function collectVietnamOtherPassportRows(
  answers: Record<string, string>,
): VietnamConditionalRepeatRow[] {
  return collectVietnamRepeatRows(answers, OTHER_PASSPORT_GROUP);
}

export function collectVietnamMultipleNationalityRows(
  answers: Record<string, string>,
): VietnamConditionalRepeatRow[] {
  return collectVietnamRepeatRows(answers, MULTIPLE_NATIONALITY_GROUP);
}

export function collectVietnamContactRows(
  answers: Record<string, string>,
): VietnamConditionalRepeatRow[] {
  return collectVietnamRepeatRows(answers, VIETNAM_CONTACT_GROUP);
}

export function collectVietnamRelativeRows(
  answers: Record<string, string>,
): VietnamConditionalRepeatRow[] {
  return collectVietnamRepeatRows(answers, VIETNAM_RELATIVE_GROUP);
}

export function validateVietnamConditionalAnswers(
  answers: Record<string, string>,
): VietnamConditionalValidationError[] {
  const errors: VietnamConditionalValidationError[] = [];

  for (const group of CONDITIONAL_REPEAT_GROUPS) {
    if (!isVietnamYes(answers[group.triggerField])) continue;
    const rows = collectVietnamRepeatRows(answers, group);
    if (rows.length === 0) {
      errors.push({
        fieldName: group.triggerField,
        message: `User answered Yes for ${group.description}, but the official ${group.columns
          .map((column) => column.label)
          .join(" / ")} row fields are missing.`,
      });
    }
    rows.forEach((row, index) => {
      const missing = group.columns
        .map((column, columnIndex) => (row.values[columnIndex] ? null : column.label))
        .filter((value): value is string => Boolean(value));
      if (missing.length > 0) {
        errors.push({
          fieldName: `${group.rowFieldName}[${index + 1}]`,
          message: `${group.tableDescription} row ${index + 1} is incomplete: ${missing.join(", ")}.`,
        });
      }
    });
  }

  const unsupportedYesGroups: Array<[string, string]> = [
    ["has_violated_vietnam_laws", "Viet Nam law violation details"],
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
  return fillVietnamRepeatRows(page, answers, PREVIOUS_VISIT_GROUP);
}

export async function fillVietnamOtherPassportRows(
  page: Page,
  answers: Record<string, string>,
): Promise<number> {
  return fillVietnamRepeatRows(page, answers, OTHER_PASSPORT_GROUP);
}

export async function fillVietnamContactRows(
  page: Page,
  answers: Record<string, string>,
): Promise<number> {
  return fillVietnamRepeatRows(page, answers, VIETNAM_CONTACT_GROUP);
}

export async function fillVietnamRelativeRows(
  page: Page,
  answers: Record<string, string>,
): Promise<number> {
  return fillVietnamRepeatRows(page, answers, VIETNAM_RELATIVE_GROUP);
}

export async function fillVietnamConditionalRepeatGroups(
  page: Page,
  answers: Record<string, string>,
  triggerFieldName: string,
): Promise<number> {
  const group = CONDITIONAL_REPEAT_GROUPS.find((candidate) => candidate.triggerField === triggerFieldName);
  if (!group) return 0;
  const filledRows: number = await fillVietnamRepeatRows(page, answers, group);
  return filledRows * group.columns.length;
}

function collectVietnamRepeatRows(
  answers: Record<string, string>,
  group: RepeatGroupConfig,
): VietnamConditionalRepeatRow[] {
  const rows: VietnamConditionalRepeatRow[] = [];

  for (let index = 0; index < MAX_REPEAT_ROWS; index++) {
    const values = group.columns.map((column) => readRepeatColumnValue(answers, column, index));
    if (values.every((value) => !value)) continue;
    rows.push({ values });
  }

  return rows;
}

function readRepeatColumnValue(
  answers: Record<string, string>,
  column: RepeatColumnConfig,
  index: number,
): string {
  for (const answerName of column.answerNames) {
    const raw = answers[repeatFieldName(answerName, index)]?.trim() ?? "";
    if (!raw) continue;
    if (column.type === "date") return toDdMmYyyy(raw);
    if (column.type === "country") return getVietnamRepeatCountryOptionText(answerName, raw);
    return raw;
  }
  return "";
}

function getVietnamRepeatCountryOptionText(answerName: string, raw: string): string {
  const mapped = getVnPortalOptionText(answerName, raw);
  if (mapped !== raw) return mapped;
  const normalized = raw.trim().toLowerCase();
  if (["chn", "cn", "china", "chinese"].includes(normalized)) return "China";
  return raw;
}

async function fillVietnamRepeatRows(
  page: Page,
  answers: Record<string, string>,
  group: RepeatGroupConfig,
): Promise<number> {
  const rows = collectVietnamRepeatRows(answers, group);
  if (rows.length === 0) return 0;

  const visibleTable = await findVietnamRepeatTable(page, group);
  await visibleTable.waitFor({ state: "visible", timeout: 7_500 });

  for (let index = 0; index < rows.length; index++) {
    await ensureVietnamTableRowCount(page, visibleTable, index + 1);
    const row = visibleTable.locator("tbody tr:not([aria-hidden='true'])").nth(index);
    await setVietnamTableRowValues(page, row, rows[index].values);
    await page.waitForTimeout(150).catch(() => undefined);
  }

  return rows.length;
}

async function findVietnamRepeatTable(page: Page, group: RepeatGroupConfig): Promise<Locator> {
  if (group.question) {
    const questionRoot = page
      .locator("[data-question], .pt-5.border-b, .ant-row.ant-form-item, .ant-col.ant-col-24.flex.justify-between.pb-5")
      .filter({ hasText: group.question })
      .first();
    const tableAfterQuestion = questionRoot.locator("xpath=following::table[1]");
    await tableAfterQuestion.waitFor({ state: "visible", timeout: 2_500 }).catch(() => undefined);
    if ((await tableAfterQuestion.count()) > 0 && await tableHasHeaders(tableAfterQuestion, group.headers)) {
      return tableAfterQuestion;
    }
  }

  let table = page.locator("table");
  for (const header of group.headers) {
    table = table.filter({ hasText: header });
  }
  return table.first();
}

async function tableHasHeaders(table: Locator, headers: RegExp[]): Promise<boolean> {
  const text = await table.locator("thead, tr").first().innerText({ timeout: 1_000 }).catch(() => "");
  return headers.every((header) => header.test(text));
}

async function setVietnamTableRowValues(
  page: Page,
  row: Locator,
  values: string[],
): Promise<void> {
  const selectTargets = await row.evaluate((rowElement, rowValues) => {
    const targets: Array<{ domId: string; value: string }> = [];
    const cells = Array.from(rowElement.querySelectorAll<HTMLTableCellElement>("td"));
    const firstCell = cells[0];
    const firstCellHasField = Boolean(firstCell?.querySelector(".ant-select input[id], input, textarea"));
    const valueCellOffset = !firstCellHasField && cells.length > rowValues.length ? 1 : 0;

    rowValues.forEach((value, index) => {
      const cell = cells[index + valueCellOffset];
      if (!cell) {
        throw new Error(`Vietnam dynamic table cell ${index + 1} not found.`);
      }
      const selectInput = cell.querySelector<HTMLInputElement>(".ant-select input[id]");
      if (selectInput?.id) {
        targets.push({ domId: selectInput.id, value });
        return;
      }
      const inputElement = cell.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
      if (!inputElement) {
        throw new Error(`Vietnam dynamic table cell ${index + 1} input not found.`);
      }
      const descriptor =
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inputElement), "value") ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value") ||
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      if (descriptor?.set) descriptor.set.call(inputElement, value);
      else inputElement.value = value;
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      inputElement.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    });
    return targets;
  }, values);

  for (const target of selectTargets) {
    await pickSelect(page, target.domId, target.value);
  }
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
