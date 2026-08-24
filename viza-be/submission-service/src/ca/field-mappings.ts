import {
  CANADA_PURPOSE_PAGE,
  buildCanadaPurposePlan,
} from "./purpose-page.js";

/** Authenticated selectors verified on the current IRCC CA_TRV purpose page. */
export const CA_PURPOSE_FIELD_MAPPINGS = [
  { selector: CANADA_PURPOSE_PAGE.visitorVisa, fixedOfficialValue: "464" },
  { selector: CANADA_PURPOSE_PAGE.touristPurpose, fixedOfficialValue: "470" },
  { selector: CANADA_PURPOSE_PAGE.visitDetails, fieldName: "visit_details" },
  { selector: CANADA_PURPOSE_PAGE.fromYear, fieldName: "intended_stay_from" },
  { selector: CANADA_PURPOSE_PAGE.fromMonth, fieldName: "intended_stay_from" },
  { selector: CANADA_PURPOSE_PAGE.fromDay, fieldName: "intended_stay_from" },
  { selector: CANADA_PURPOSE_PAGE.toYear, fieldName: "intended_stay_to" },
  { selector: CANADA_PURPOSE_PAGE.toMonth, fieldName: "intended_stay_to" },
  { selector: CANADA_PURPOSE_PAGE.toDay, fieldName: "intended_stay_to" },
  { selector: CANADA_PURPOSE_PAGE.uci, fieldName: "uci", optional: true },
] as const;

export const caPurposeMissingRequired = (answers: Record<string, string>): string[] => {
  const plan = buildCanadaPurposePlan(answers);
  return plan.ready ? [] : plan.missingFields;
};
