import type { Page } from "@playwright/test";
import { isCanadaPageSafe } from "./browser.js";
import { CANADA_PURPOSE_REQUIRED_FIELDS } from "./readiness.js";

export const CANADA_PURPOSE_PAGE = {
  visitorVisa: "#applyingFor_radio-button-464-input",
  visitorVisaLabel: 'label[for="applyingFor_radio-button-464-input"]',
  touristPurpose: "#visaPurpose_radio-button-470-input",
  touristPurposeLabel: 'label[for="visaPurpose_radio-button-470-input"]',
  visitDetails: "#visitDetails_txtArea",
  fromYear: "#dateComingToCanadaYear_sltDateYear",
  fromMonth: "#dateComingToCanadaMonth_sltDateMonth",
  fromDay: "#dateComingToCanadaDay_sltDateDay",
  toYear: "#dateComingToCanadaToYear_sltDateYear",
  toMonth: "#dateComingToCanadaToMonth_sltDateMonth",
  toDay: "#dateComingToCanadaToDay_sltDateDay",
  uci: "#uciNumber_input",
  saveAndContinue: "#next_path",
} as const;

export interface CanadaDateParts {
  year: string;
  month: string;
  day: string;
}

export interface CanadaPurposePlan {
  visitDetails: string;
  intendedStayFrom: CanadaDateParts;
  intendedStayTo: CanadaDateParts;
  uci?: string;
}

export type CanadaPurposePlanResult =
  | { ready: true; plan: CanadaPurposePlan; missingFields: [] }
  | { ready: false; missingFields: string[]; invalidFields: string[] };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCanadaIsoDate(value: unknown): CanadaDateParts | null {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return { year: match[1], month: match[2], day: match[3] };
}

export function buildCanadaPurposePlan(
  answers: Record<string, string>,
): CanadaPurposePlanResult {
  const missingFields = CANADA_PURPOSE_REQUIRED_FIELDS.filter(
    (field) => !text(answers[field]),
  );
  const intendedStayFrom = parseCanadaIsoDate(answers.intended_stay_from);
  const intendedStayTo = parseCanadaIsoDate(answers.intended_stay_to);
  const invalidFields = [
    ...(text(answers.visit_details).length > 475 ? ["visit_details"] : []),
    ...(text(answers.intended_stay_from) && intendedStayFrom == null
      ? ["intended_stay_from"]
      : []),
    ...(text(answers.intended_stay_to) && intendedStayTo == null
      ? ["intended_stay_to"]
      : []),
    ...(intendedStayFrom &&
    intendedStayTo &&
    Date.UTC(
      Number(intendedStayFrom.year),
      Number(intendedStayFrom.month) - 1,
      Number(intendedStayFrom.day),
    ) >
      Date.UTC(
        Number(intendedStayTo.year),
        Number(intendedStayTo.month) - 1,
        Number(intendedStayTo.day),
      )
      ? ["intended_stay_to"]
      : []),
  ];
  if (missingFields.length > 0 || invalidFields.length > 0) {
    return { ready: false, missingFields, invalidFields };
  }

  return {
    ready: true,
    missingFields: [],
    plan: {
      visitDetails: text(answers.visit_details),
      intendedStayFrom: intendedStayFrom!,
      intendedStayTo: intendedStayTo!,
      ...(text(answers.uci) ? { uci: text(answers.uci) } : {}),
    },
  };
}

export type CanadaPurposeFillResult =
  | { checkpoint: "purpose_missing_answers"; missingFields: string[] }
  | { checkpoint: "purpose_invalid_answers"; invalidFields: string[] }
  | { checkpoint: "purpose_selector_drift"; detail: string }
  | { checkpoint: "unexpected_redirect"; detail: string }
  | { checkpoint: "purpose_filled"; advanced: boolean };

function unsafePurposePage(): CanadaPurposeFillResult {
  return {
    checkpoint: "unexpected_redirect",
    detail: "untrusted_destination:[redacted-url]",
  };
}

/**
 * Maps only controls observed on the authenticated IRCC purpose page. It does
 * not infer dates, fabricate narrative text, or continue with an incomplete
 * plan. `advance` must be chosen by the caller after its own authorization
 * gates have passed.
 */
export async function fillCanadaPurposePage(input: {
  page: Page;
  answers: Record<string, string>;
  advance: boolean;
}): Promise<CanadaPurposeFillResult> {
  if (!isCanadaPageSafe(input.page, "application")) {
    return unsafePurposePage();
  }
  const result = buildCanadaPurposePlan(input.answers);
  if (!result.ready) {
    if (result.invalidFields.length > 0) {
      return {
        checkpoint: "purpose_invalid_answers",
        invalidFields: result.invalidFields,
      };
    }
    return { checkpoint: "purpose_missing_answers", missingFields: result.missingFields };
  }

  const visitorVisa = input.page.locator(CANADA_PURPOSE_PAGE.visitorVisa);
  const visitorVisaLabel = input.page.locator(CANADA_PURPOSE_PAGE.visitorVisaLabel);
  const touristPurpose = input.page.locator(CANADA_PURPOSE_PAGE.touristPurpose);
  const touristPurposeLabel = input.page.locator(CANADA_PURPOSE_PAGE.touristPurposeLabel);
  const details = input.page.locator(CANADA_PURPOSE_PAGE.visitDetails);
  const dateSelectors = [
    CANADA_PURPOSE_PAGE.fromYear,
    CANADA_PURPOSE_PAGE.fromMonth,
    CANADA_PURPOSE_PAGE.fromDay,
    CANADA_PURPOSE_PAGE.toYear,
    CANADA_PURPOSE_PAGE.toMonth,
    CANADA_PURPOSE_PAGE.toDay,
  ];
  const save = input.page.locator(CANADA_PURPOSE_PAGE.saveAndContinue);

  await visitorVisaLabel
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => undefined);
  if (!isCanadaPageSafe(input.page, "application")) {
    return unsafePurposePage();
  }
  const baseCounts = await Promise.all([
    visitorVisa.count(),
    visitorVisaLabel.count(),
    details.count(),
    ...dateSelectors.map((selector) => input.page.locator(selector).count()),
    save.count(),
  ]);
  if (baseCounts.some((count) => count !== 1)) {
    return {
      checkpoint: "purpose_selector_drift",
      detail: `base_counts=${baseCounts.join(",")}`,
    };
  }

  if (!isCanadaPageSafe(input.page, "application")) {
    return unsafePurposePage();
  }
  await visitorVisaLabel.click();
  await touristPurposeLabel
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => undefined);
  if (!isCanadaPageSafe(input.page, "application")) {
    return unsafePurposePage();
  }
  if ((await touristPurpose.count()) !== 1 || (await touristPurposeLabel.count()) !== 1) {
    return {
      checkpoint: "purpose_selector_drift",
      detail: "tourist_purpose_selector_missing_after_visitor_visa",
    };
  }
  if (!isCanadaPageSafe(input.page, "application")) {
    return unsafePurposePage();
  }
  await touristPurposeLabel.click();
  if (!isCanadaPageSafe(input.page, "application")) {
    return unsafePurposePage();
  }
  await details.fill(result.plan.visitDetails);
  const dateParts = [
    result.plan.intendedStayFrom.year,
    result.plan.intendedStayFrom.month,
    result.plan.intendedStayFrom.day,
    result.plan.intendedStayTo.year,
    result.plan.intendedStayTo.month,
    result.plan.intendedStayTo.day,
  ];
  for (const [index, value] of dateParts.entries()) {
    if (!isCanadaPageSafe(input.page, "application")) {
      return unsafePurposePage();
    }
    const select = input.page.locator(dateSelectors[index]);
    const options = await select.locator("option").evaluateAll(
      (nodes) => nodes.map((node) => ({
        value: (node as HTMLOptionElement).value,
        text: node.textContent?.trim() ?? "",
      })),
    );
    const numeric = Number(value);
    const match = options.find(
      (option) => Number(option.value) === numeric || Number(option.text) === numeric,
    );
    if (!match) {
      return {
        checkpoint: "purpose_selector_drift",
        detail: `date_option_missing:${dateSelectors[index]}`,
      };
    }
    if (!isCanadaPageSafe(input.page, "application")) {
      return unsafePurposePage();
    }
    await select.selectOption(match.value);
  }

  if (result.plan.uci) {
    if (!isCanadaPageSafe(input.page, "application")) {
      return unsafePurposePage();
    }
    const uci = input.page.locator(CANADA_PURPOSE_PAGE.uci);
    if ((await uci.count()) !== 1) {
      return { checkpoint: "purpose_selector_drift", detail: "uci_selector_missing" };
    }
    if (!isCanadaPageSafe(input.page, "application")) {
      return unsafePurposePage();
    }
    await uci.fill(result.plan.uci);
  }

  if (!isCanadaPageSafe(input.page, "application")) {
    return unsafePurposePage();
  }
  if (!(await save.isEnabled())) {
    return { checkpoint: "purpose_selector_drift", detail: "save_button_disabled_after_fill" };
  }
  if (input.advance) {
    if (!isCanadaPageSafe(input.page, "application")) {
      return unsafePurposePage();
    }
    await save.click();
    if (!isCanadaPageSafe(input.page, "application")) {
      return unsafePurposePage();
    }
  }
  return { checkpoint: "purpose_filled", advanced: input.advance };
}
