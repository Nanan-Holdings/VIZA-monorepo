/**
 * Declarative mappings for DS-160 seed fields that are conditional or were
 * previously absent from the runner's page maps.
 *
 * This file deliberately stays separate from ds160-form-mappings.ts.  The
 * latter contains selectors with repository/live evidence; selectors here
 * are conservative candidates for the additional branches and are marked as
 * label fallbacks until a CEAC DOM capture proves their exact IDs.
 *
 * The declarations contain no applicant data and no fallback values.  The
 * caller must merge the exported mappings into the page map and keep the
 * existing visible-field/read-back checks enabled.
 */

import type { FormFieldMapping } from "./form-mappings";

export type Ds160ExtendedPage =
  | "personal_information_1"
  | "personal_information_2"
  | "travel_information"
  | "travel_companions"
  | "previous_us_travel"
  | "address_and_phone"
  | "passport"
  | "family_relatives"
  | "family_spouse"
  | "work_education_present"
  | "work_education_previous"
  | "work_education_additional"
  | "us_contact"
  | "security_background_1"
  | "security_background_2"
  | "security_background_3"
  | "security_background_4"
  | "security_background_5";

export type Ds160SeedFieldType =
  | "text"
  | "select"
  | "date"
  | "radio"
  | "checkbox"
  | "textarea";

/** Evidence is intentionally tri-state; this file contains no verified claim. */
export type Ds160SelectorEvidence =
  | "repository_selector"
  | "official_label_fallback"
  | "unverified";

export interface Ds160ExtendedFieldMetadata {
  /** Mapping key consumed by the orchestrator. */
  fieldName: string;
  /** Original seed field represented by this mapping. */
  seedFieldName: string;
  page: Ds160ExtendedPage;
  seedType: Ds160SeedFieldType;
  /** Exact seed conditional_logic.showIf expression, when present. */
  condition?: string;
  /** Exact seed validation_rules.repeat_group name, when present. */
  repeatGroup?: string;
  selectorEvidence: Ds160SelectorEvidence;
  /** Seed/official visible label used by the label fallback selector. */
  officialLabel?: string;
  /** Every activated field must be read back after filling. */
  readBack: "required";
  /** Present for date-part mappings generated from a single seed date. */
  derivedFrom?: string;
  derivedPart?: "day" | "month" | "year";
}

export interface Ds160ExtendedMappingGroup {
  name: string;
  page: Ds160ExtendedPage;
  mappings: Record<string, FormFieldMapping>;
  metadata: Record<string, Ds160ExtendedFieldMetadata>;
}

interface FieldSpec {
  fieldName: string;
  seedFieldName?: string;
  page: Ds160ExtendedPage;
  seedType: Ds160SeedFieldType;
  mappingType: FormFieldMapping["type"];
  htmlTag?: "input" | "textarea" | "select";
  label: string;
  selectorTokens: readonly string[];
  condition?: string;
  repeatGroup?: string;
  /** Evidence level for the selector tokens in this declaration. */
  selectorEvidence?: Ds160SelectorEvidence;
  derivedFrom?: string;
  derivedPart?: "day" | "month" | "year";
}

export interface Ds160ExtendedDateSplit {
  source: string;
  targetPrefix: string;
  monthAsAbbrev: true;
}

/**
 * Build a selector with ID/name candidates plus an official-label fallback.
 * The ID/name candidates follow the ASP.NET control naming convention used by
 * the existing DS-160 maps.  They remain unverified until a captured CEAC DOM
 * confirms the exact control.  The fallback is deliberately last so an exact
 * candidate wins when available.
 */
function selectorFor(
  mappingType: FormFieldMapping["type"],
  tokens: readonly string[],
  label: string,
  htmlTag?: "input" | "textarea" | "select",
): string {
  const tag = htmlTag ?? (mappingType === "select" ? "select" : "input");
  const typeClause = mappingType === "radio" || mappingType === "checkbox"
    ? `[type="${mappingType}"]`
    : "";
  const candidates = tokens.flatMap((token) => [
    `${tag}${typeClause}[id*="${token}"]`,
    `${tag}${typeClause}[name*="${token}"]`,
  ]);

  // Keep the CSS argument free of commas because the current fill runtime
  // splits a mapping into comma-separated selector branches.
  const labelHint = label
    .replace(/[",]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
  if (labelHint) {
    candidates.push(
      `${tag}[aria-label*="${labelHint}"]`,
      `label:has-text("${labelHint}") ${tag}${typeClause}`,
    );
  }
  return [...new Set(candidates)].join(", ");
}

const declarations: FieldSpec[] = [];
const dateSplits: Ds160ExtendedDateSplit[] = [];

function add(spec: FieldSpec): void {
  if (declarations.some((existing) => existing.fieldName === spec.fieldName)) {
    throw new Error(`Duplicate DS-160 extended mapping: ${spec.fieldName}`);
  }
  declarations.push(spec);
}

function addField(
  page: Ds160ExtendedPage,
  fieldName: string,
  seedType: Ds160SeedFieldType,
  label: string,
  selectorTokens: readonly string[],
  options: Omit<Partial<FieldSpec>, "page" | "fieldName" | "seedType" | "label" | "selectorTokens" | "mappingType"> & {
    mappingType?: FormFieldMapping["type"];
  } = {},
): void {
  const mappingType = options.mappingType ?? (seedType === "textarea" ? "text" : seedType);
  add({
    page,
    fieldName,
    seedFieldName: options.seedFieldName ?? (options.derivedFrom ? options.derivedFrom : fieldName),
    seedType,
    mappingType,
    htmlTag: options.htmlTag ?? (seedType === "textarea" ? "textarea" : undefined),
    label,
    selectorTokens,
    condition: options.condition,
    repeatGroup: options.repeatGroup,
    selectorEvidence: options.selectorEvidence,
    derivedFrom: options.derivedFrom,
    derivedPart: options.derivedPart,
  });
}

function addDate(
  page: Ds160ExtendedPage,
  source: string,
  label: string,
  condition: string | undefined,
  repeatGroup: string | undefined,
  dayTokens: readonly string[],
  monthTokens: readonly string[],
  yearTokens: readonly string[],
  selectorEvidence?: Ds160SelectorEvidence,
): void {
  dateSplits.push({ source, targetPrefix: source, monthAsAbbrev: true });
  addField(page, `${source}_day`, "date", label, dayTokens, {
    mappingType: "select",
    condition,
    repeatGroup,
    selectorEvidence,
    derivedFrom: source,
    derivedPart: "day",
  });
  addField(page, `${source}_month`, "date", label, monthTokens, {
    mappingType: "select",
    condition,
    repeatGroup,
    selectorEvidence,
    derivedFrom: source,
    derivedPart: "month",
  });
  addField(page, `${source}_year`, "date", label, yearTokens, {
    mappingType: "text",
    condition,
    repeatGroup,
    selectorEvidence,
    derivedFrom: source,
    derivedPart: "year",
  });
}

// ── Personal Information 1 ────────────────────────────────────────────────
addField(
  "personal_information_1",
  "other_surname",
  "text",
  "Other Surnames Used (maiden, religious, professional, aliases, etc.)",
  ["APP_OTHER_SURNAME", "OTHER_SURNAME"],
  { condition: "other_names_used === yes" },
);
addField(
  "personal_information_1",
  "other_given_names",
  "text",
  "Other Given Names Used",
  ["APP_OTHER_GIVEN_NAME", "OTHER_GIVEN_NAME"],
  { condition: "other_names_used === yes" },
);
addField(
  "personal_information_1",
  "telecode_surname",
  "text",
  "Telecode Surname",
  ["APP_TELECODE_SURNAME", "TELECODE_SURNAME"],
  { condition: "has_telecode === yes" },
);
addField(
  "personal_information_1",
  "telecode_given_names",
  "text",
  "Telecode Given Names",
  ["APP_TELECODE_GIVEN_NAME", "TELECODE_GIVEN_NAME"],
  { condition: "has_telecode === yes" },
);
addField(
  "personal_information_1",
  "marital_status_other_explain",
  "text",
  "Other — Please Explain",
  ["APP_MARITAL_STATUS_OTHER", "MARITAL_STATUS_OTHER", "MARITAL_OTHER_EXPLAIN"],
  { condition: "marital_status === other" },
);

// ── Personal Information 2 ─────────────────────────────────────────────────
addField(
  "personal_information_2",
  "other_nationality_country",
  "select",
  "Other Country/Region of Nationality",
  ["APP_OTH_NATL_COUNTRY", "OTHER_NATIONALITY_COUNTRY", "OTH_NATL_COUNTRY"],
  { condition: "other_nationality === yes", repeatGroup: "other_nationality" },
);
addField(
  "personal_information_2",
  "other_nationality_has_passport",
  "radio",
  "Do you hold a passport for that other nationality?",
  ["APP_OTH_NATL_PASSPORT", "OTH_NATL_PASSPORT", "OTHER_NATIONALITY_PASSPORT"],
  { condition: "other_nationality === yes", repeatGroup: "other_nationality" },
);
addField(
  "personal_information_2",
  "other_nationality_passport_number",
  "text",
  "Passport Number",
  ["APP_OTH_NATL_PPT_NUM", "OTH_NATL_PPT_NUM", "OTHER_NATIONALITY_PASSPORT_NUMBER"],
  { condition: "other_nationality_has_passport === yes", repeatGroup: "other_nationality" },
);
addField(
  "personal_information_2",
  "other_permanent_resident_country",
  "select",
  "Other Permanent Resident Country/Region",
  ["APP_PERM_RES_COUNTRY", "OTHER_PERM_RES_COUNTRY", "PR_COUNTRY"],
  { condition: "permanent_resident_other_country === yes", repeatGroup: "permanent_resident" },
);

// ── Travel Information ─────────────────────────────────────────────────────
addField(
  "travel_information",
  "arrival_flight",
  "text",
  "Arrival Flight (if known)",
  ["TRAVEL_ARR_FLIGHT", "ARRIVAL_FLIGHT", "ARR_FLIGHT"],
  { condition: "has_specific_plans === yes", repeatGroup: "specific_travel_plans" },
);
addField(
  "travel_information",
  "arrival_city",
  "text",
  "Arrival City",
  ["TRAVEL_ARR_CITY", "ARRIVAL_CITY", "ARR_CITY"],
  { condition: "has_specific_plans === yes", repeatGroup: "specific_travel_plans" },
);
addField(
  "travel_information",
  "departure_flight",
  "text",
  "Departure Flight (if known)",
  ["TRAVEL_DEP_FLIGHT", "DEPARTURE_FLIGHT", "DEP_FLIGHT"],
  { condition: "has_specific_plans === yes", repeatGroup: "specific_travel_plans" },
);
addField(
  "travel_information",
  "departure_city",
  "text",
  "Departure City",
  ["TRAVEL_DEP_CITY", "DEPARTURE_CITY", "DEP_CITY"],
  { condition: "has_specific_plans === yes", repeatGroup: "specific_travel_plans" },
);
addField(
  "travel_information",
  "planned_location",
  "text",
  "Location",
  ["TRAVEL_LOCATION", "TRAVEL_PLANNED_LOCATION", "PLANNED_LOCATION"],
  { condition: "has_specific_plans === yes", repeatGroup: "planned_locations" },
);
addField(
  "travel_information",
  "us_address_street2",
  "text",
  "Street Address (Line 2)",
  ["tbxStreetAddress2", "TRAVEL_ADDR_LN2", "TRAVEL_ADDRESS_LN2"],
  {
    condition: "has_specific_plans === yes || intended_length_of_stay_unit === YEAR(S) || intended_length_of_stay_unit === MONTH(S) || intended_length_of_stay_unit === WEEK(S) || intended_length_of_stay_unit === DAY(S)",
  },
);
addField(
  "travel_information",
  "payer_address_same_as_home",
  "radio",
  "Is the address of the party paying for your trip the same as your Home or Mailing Address?",
  ["PAYER_ADDR_SAME", "TRAVEL_PAYER_ADDR_SAME", "PAYER_ADDRESS_SAME"],
  { condition: "trip_payer_type === other_person" },
);

const payerAddress = [
  ["payer_address_street1", "Street Address (Line 1)", ["PAYER_ADDR_LN1", "TRAVEL_PAYER_ADDR_LN1"]],
  ["payer_address_street2", "Street Address (Line 2)", ["PAYER_ADDR_LN2", "TRAVEL_PAYER_ADDR_LN2"]],
  ["payer_address_city", "City", ["PAYER_ADDR_CITY", "TRAVEL_PAYER_ADDR_CITY"]],
  ["payer_address_state", "State/Province", ["PAYER_ADDR_STATE", "TRAVEL_PAYER_ADDR_STATE"]],
  ["payer_address_postal", "Postal Zone/ZIP Code", ["PAYER_ADDR_POSTAL", "TRAVEL_PAYER_ADDR_POSTAL", "PAYER_ADDR_ZIP"]],
] as const;
for (const [fieldName, label, tokens] of payerAddress) {
  addField("travel_information", fieldName, "text", label, tokens, {
    condition: "payer_address_same_as_home === no",
  });
}
const payerAddressNa = [
  ["payer_address_state_na", "State/Province Does Not Apply", ["cbxDNAPayerStateProvince"], "payer_address_state"],
  ["payer_address_postal_na", "Postal Zone/ZIP Code Does Not Apply", ["cbxDNAPayerPostalZIPCode"], "payer_address_postal"],
] as const;
for (const [fieldName, label, tokens, seedFieldName] of payerAddressNa) {
  addField("travel_information", fieldName, "checkbox", label, tokens, {
    seedFieldName,
    condition: "payer_address_same_as_home === no",
    selectorEvidence: "repository_selector",
  });
}
addField(
  "travel_information",
  "payer_address_country",
  "select",
  "Country/Region",
  ["PAYER_ADDR_COUNTRY", "TRAVEL_PAYER_ADDR_COUNTRY"],
  { condition: "payer_address_same_as_home === no" },
);

const payerOrganization = [
  ["payer_org_name", "Name of Company/Organization Paying for Trip", ["PAYER_ORG_NAME", "TRAVEL_PAYER_ORG_NAME"]],
  ["payer_org_phone", "Telephone Number", ["PAYER_ORG_TEL", "PAYER_ORG_PHONE", "TRAVEL_PAYER_ORG_TEL"]],
  ["payer_org_relationship", "Relationship to You", ["PAYER_ORG_REL", "PAYER_ORG_RELATIONSHIP", "TRAVEL_PAYER_ORG_REL"]],
  ["payer_org_address_street1", "Street Address (Line 1)", ["PAYER_ORG_ADDR_LN1", "TRAVEL_PAYER_ORG_ADDR_LN1"]],
  ["payer_org_address_street2", "Street Address (Line 2)", ["PAYER_ORG_ADDR_LN2", "TRAVEL_PAYER_ORG_ADDR_LN2"]],
  ["payer_org_address_city", "City", ["PAYER_ORG_ADDR_CITY", "TRAVEL_PAYER_ORG_ADDR_CITY"]],
  ["payer_org_address_state", "State/Province", ["PAYER_ORG_ADDR_STATE", "TRAVEL_PAYER_ORG_ADDR_STATE"]],
  ["payer_org_address_postal", "Postal Zone/ZIP Code", ["PAYER_ORG_ADDR_POSTAL", "TRAVEL_PAYER_ORG_ADDR_POSTAL", "PAYER_ORG_ADDR_ZIP"]],
] as const;
for (const [fieldName, label, tokens] of payerOrganization) {
  addField("travel_information", fieldName, "text", label, tokens, {
    condition: "trip_payer_type === other_company",
  });
}
const payerOrganizationAddressNa = [
  ["payer_org_address_state_na", "State/Province Does Not Apply", ["cbxDNAPayerStateProvince"], "payer_org_address_state"],
  ["payer_org_address_postal_na", "Postal Zone/ZIP Code Does Not Apply", ["cbxDNAPayerPostalZIPCode"], "payer_org_address_postal"],
] as const;
for (const [fieldName, label, tokens, seedFieldName] of payerOrganizationAddressNa) {
  addField("travel_information", fieldName, "checkbox", label, tokens, {
    seedFieldName,
    condition: "trip_payer_type === other_company",
    selectorEvidence: "repository_selector",
  });
}
addField(
  "travel_information",
  "payer_org_address_country",
  "select",
  "Country/Region",
  ["PAYER_ORG_ADDR_COUNTRY", "TRAVEL_PAYER_ORG_ADDR_COUNTRY"],
  { condition: "trip_payer_type === other_company" },
);

// ── Travel Companions ──────────────────────────────────────────────────────
addField(
  "travel_companions",
  "companion_surname",
  "text",
  "Surnames",
  ["TRAVEL_COMPANION_SURNAME", "COMPANION_SURNAME", "tbxCompanionSurname"],
  { condition: "companion_group_travel === no", repeatGroup: "companions" },
);
addField(
  "travel_companions",
  "companion_given_names",
  "text",
  "Given Names",
  ["TRAVEL_COMPANION_GIVEN_NAME", "COMPANION_GIVEN_NAME", "tbxCompanionGivenName"],
  { condition: "companion_group_travel === no", repeatGroup: "companions" },
);
addField(
  "travel_companions",
  "companion_relationship",
  "select",
  "Relationship to You",
  ["TRAVEL_COMPANION_REL", "COMPANION_RELATIONSHIP", "ddlCompanionRelationship"],
  { condition: "companion_group_travel === no", repeatGroup: "companions" },
);

// ── Previous U.S. Travel ───────────────────────────────────────────────────
addDate(
  "previous_us_travel",
  "previous_visit_date_arrived",
  "Date Arrived",
  "has_been_in_us === yes",
  "previous_visits",
  ["ddlPREV_US_TRAVEL_ARRIVALDay", "ddlPREV_US_ARRIVALDay", "PREV_VISIT_ARRIVED_DAY"],
  ["ddlPREV_US_TRAVEL_ARRIVALMonth", "ddlPREV_US_ARRIVALMonth", "PREV_VISIT_ARRIVED_MONTH"],
  ["tbxPREV_US_TRAVEL_ARRIVALYear", "tbxPREV_US_ARRIVALYear", "PREV_VISIT_ARRIVED_YEAR"],
);
addField(
  "previous_us_travel",
  "previous_visit_length_of_stay",
  "text",
  "Length of Stay (Value)",
  ["PREV_US_TRAVEL_LENGTH", "PREV_VISIT_LENGTH", "PREV_US_TRAVEL_LOS"],
  { condition: "has_been_in_us === yes", repeatGroup: "previous_visits" },
);
addField(
  "previous_us_travel",
  "previous_visit_length_of_stay_unit",
  "select",
  "Length of Stay (Unit)",
  ["PREV_US_TRAVEL_LENGTH_UNIT", "PREV_VISIT_LENGTH_UNIT", "PREV_US_TRAVEL_LOS_CD"],
  { condition: "has_been_in_us === yes", repeatGroup: "previous_visits" },
);
addField(
  "previous_us_travel",
  "has_us_drivers_license",
  "radio",
  "Do you or did you ever hold a U.S. Driver's License?",
  ["PREV_US_DRIVER_LICENSE", "US_DRIVERS_LICENSE", "rblUSDriversLicense"],
  { condition: "has_been_in_us === yes" },
);
addField(
  "previous_us_travel",
  "us_drivers_license_number",
  "text",
  "Driver's License Number",
  ["US_DRIVER_LICENSE_NUM", "US_DRIVERS_LICENSE_NUM", "DRIVERS_LICENSE_NUMBER"],
  { condition: "has_us_drivers_license === yes", repeatGroup: "drivers_licenses" },
);
addField(
  "previous_us_travel",
  "us_drivers_license_number_unknown",
  "checkbox",
  "Do Not Know",
  ["cbxUS_DRIVER_LICENSE_NA"],
  {
    seedFieldName: "us_drivers_license_number",
    condition: "has_us_drivers_license === yes",
    repeatGroup: "drivers_licenses",
    selectorEvidence: "repository_selector",
  },
);
addField(
  "previous_us_travel",
  "us_drivers_license_state",
  "select",
  "Driver's License State",
  ["US_DRIVER_LICENSE_STATE", "US_DRIVERS_LICENSE_STATE", "DRIVERS_LICENSE_STATE"],
  { condition: "has_us_drivers_license === yes", repeatGroup: "drivers_licenses" },
);
addField(
  "previous_us_travel",
  "last_visa_issue_day",
  "select",
  "Date Last Visa Was Issued (Day)",
  ["ddlPREV_VISA_ISSUED_Day", "ddlPREV_VISA_ISSUE_Day", "PREV_VISA_ISSUE_DAY"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "last_visa_issue_month",
  "select",
  "Date Last Visa Was Issued (Month)",
  ["ddlPREV_VISA_ISSUED_Month", "ddlPREV_VISA_ISSUE_Month", "PREV_VISA_ISSUE_MONTH"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "last_visa_issue_year",
  "text",
  "Date Last Visa Was Issued (Year)",
  ["tbxPREV_VISA_ISSUED_Year", "tbxPREV_VISA_ISSUE_Year", "PREV_VISA_ISSUE_YEAR"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "visa_number_unknown",
  "checkbox",
  "Do Not Know",
  ["cbxPREV_VISA_FOIL_NUMBER_NA"],
  { condition: "has_us_visa === yes", selectorEvidence: "repository_selector" },
);
addField(
  "previous_us_travel",
  "applying_same_visa_type",
  "radio",
  "Are you applying for the same type of visa?",
  ["PREV_VISA_SAME_TYPE", "PREV_VISA_SAME_KIND", "rblPREV_VISA_SAME_TYPE"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "applying_same_country_of_issue_and_residence",
  "radio",
  "Are you applying in the same country or location where the visa above was issued, and is this country or location your place of principal of residence?",
  ["PREV_VISA_SAME_COUNTRY_RESIDENCE", "PREV_VISA_SAME_CNTRY", "rblPREV_VISA_SAME_COUNTRY"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "has_been_ten_printed",
  "radio",
  "Have you been ten-printed?",
  ["PREV_VISA_TEN_PRINTED", "PREV_TEN_PRINTED", "rblPREV_VISA_TEN_PRINTED"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "visa_lost_or_stolen",
  "radio",
  "Has your U.S. Visa ever been lost or stolen?",
  ["PREV_VISA_LOST", "VISA_LOST_OR_STOLEN", "rblPREV_VISA_LOST"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "year_visa_lost_or_stolen",
  "text",
  "Enter year visa was lost or stolen",
  ["PREV_VISA_LOST_YEAR", "VISA_LOST_YEAR", "tbxPREV_VISA_LOST_YEAR"],
  { condition: "visa_lost_or_stolen === yes" },
);
addField(
  "previous_us_travel",
  "visa_lost_or_stolen_explain",
  "textarea",
  "Explain",
  ["PREV_VISA_LOST_EXPLAIN", "VISA_LOST_EXPLAIN", "tbxPREV_VISA_LOST_EXPLAIN"],
  { condition: "visa_lost_or_stolen === yes" },
);
addField(
  "previous_us_travel",
  "visa_cancelled_or_revoked",
  "radio",
  "Has your U.S. Visa ever been cancelled or revoked?",
  ["PREV_VISA_CANCELLED", "VISA_CANCELLED_REVOKED", "rblPREV_VISA_CANCELLED"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "visa_cancelled_or_revoked_explain",
  "textarea",
  "Explain",
  ["PREV_VISA_CANCELLED_EXPLAIN", "VISA_CANCELLED_EXPLAIN", "tbxPREV_VISA_CANCELLED_EXPLAIN"],
  { condition: "visa_cancelled_or_revoked === yes" },
);
addField(
  "previous_us_travel",
  "refusal_explain",
  "textarea",
  "Explain",
  ["PREV_VISA_REFUSAL_EXPLAIN", "VISA_REFUSAL_EXPLAIN", "tbxPREV_VISA_REFUSAL_EXPLAIN"],
  { condition: "has_been_refused === yes", repeatGroup: "visa_refused" },
);
addField(
  "previous_us_travel",
  "immigrant_petition_explain",
  "textarea",
  "Explain",
  ["IV_PETITION_EXPLAIN", "IMMIGRANT_PETITION_EXPLAIN", "tbxIV_PETITION_EXPLAIN"],
  { condition: "immigrant_petition_filed === yes", repeatGroup: "immigrant_petition" },
);
addField(
  "previous_us_travel",
  "vwp_denial_explain",
  "textarea",
  "Please explain",
  ["VWP_DENIAL_EXPL", "tbxVWP_DENIAL_EXPL"],
  { condition: "vwp_denial === yes" },
);

// ── Address and Phone ──────────────────────────────────────────────────────
const mailingAddress = [
  ["mailing_address_line1", "Mailing Street Address (Line 1)", ["APP_MAIL_ADDR_LN1", "APP_MAILING_ADDR_LN1"]],
  ["mailing_address_line2", "Mailing Street Address (Line 2)", ["APP_MAIL_ADDR_LN2", "APP_MAILING_ADDR_LN2"]],
  ["mailing_address_city", "Mailing City", ["APP_MAIL_ADDR_CITY", "APP_MAILING_ADDR_CITY"]],
  ["mailing_address_state", "Mailing State/Province", ["APP_MAIL_ADDR_STATE", "APP_MAILING_ADDR_STATE"]],
  ["mailing_address_postal", "Mailing Postal Zone/ZIP Code", ["APP_MAIL_ADDR_POSTAL_CD", "APP_MAILING_ADDR_POSTAL_CD", "APP_MAIL_ADDR_ZIP"]],
] as const;
for (const [fieldName, label, tokens] of mailingAddress) {
  addField("address_and_phone", fieldName, "text", label, tokens, {
    condition: "mailing_same_as_home === no",
  });
}
const mailingAddressNa = [
  ["mailing_address_state_na", "Mailing State/Province Does Not Apply", ["cbexMAILING_ADDR_STATE_NA"], "mailing_address_state"],
  ["mailing_address_postal_na", "Mailing Postal Zone/ZIP Code Does Not Apply", ["cbexMAILING_ADDR_POSTAL_CD_NA"], "mailing_address_postal"],
] as const;
for (const [fieldName, label, tokens, seedFieldName] of mailingAddressNa) {
  addField("address_and_phone", fieldName, "checkbox", label, tokens, {
    seedFieldName,
    condition: "mailing_same_as_home === no",
    selectorEvidence: "repository_selector",
  });
}
addField(
  "address_and_phone",
  "mailing_address_country",
  "select",
  "Mailing Country/Region",
  ["APP_MAIL_ADDR_CNTRY", "APP_MAILING_ADDR_CNTRY", "APP_MAIL_ADDR_COUNTRY"],
  { condition: "mailing_same_as_home === no" },
);
addField(
  "address_and_phone",
  "secondary_phone",
  "text",
  "Secondary Phone Number",
  ["APP_SECONDARY_TEL", "APP_SEC_TEL", "APP_OTHER_TEL_2", "SECONDARY_PHONE"],
);
addField(
  "address_and_phone",
  "secondary_phone_na",
  "checkbox",
  "Secondary Phone Number Does Not Apply",
  ["cbexAPP_MOBILE_TEL_NA"],
  { seedFieldName: "secondary_phone", selectorEvidence: "repository_selector" },
);
addField(
  "address_and_phone",
  "additional_phone",
  "text",
  "Additional Phone Number",
  ["APP_ADD_TEL", "APP_ADDITIONAL_TEL", "APP_OTHER_TEL", "ADDITIONAL_PHONE"],
  { condition: "has_other_phones === yes", repeatGroup: "additional_phones" },
);
addField(
  "address_and_phone",
  "additional_email",
  "text",
  "Additional Email Address",
  ["APP_ADD_EMAIL", "APP_ADDITIONAL_EMAIL", "ADDITIONAL_EMAIL"],
  { condition: "has_other_emails === yes", repeatGroup: "additional_emails" },
);
addField(
  "address_and_phone",
  "has_other_social_media",
  "radio",
  "Do you wish to provide information about your presence on any other websites or applications you have used within the last five years to create or share content (photos, videos, status updates, etc.)?",
  ["APP_OTHER_SOCIAL", "OTHER_SOCIAL", "rblOtherSocial", "APP_OTH_SOCIAL"],
);
addField(
  "address_and_phone",
  "other_social_media_name",
  "text",
  "Website/Application Name",
  ["APP_OTH_SOCIAL_NAME", "OTHER_SOCIAL_NAME", "OTH_SOCIAL_NAME"],
  { condition: "has_other_social_media === yes", repeatGroup: "other_social_media" },
);
addField(
  "address_and_phone",
  "other_social_media_identifier",
  "text",
  "Identifier",
  ["APP_OTH_SOCIAL_IDENTIFIER", "OTHER_SOCIAL_IDENTIFIER", "OTH_SOCIAL_IDENTIFIER"],
  { condition: "has_other_social_media === yes", repeatGroup: "other_social_media" },
);

// ── Passport Information ──────────────────────────────────────────────────
addField(
  "passport",
  "passport_document_type_explain",
  "text",
  "Please explain",
  ["PPT_TYPE_OTHER", "PPT_DOC_TYPE_OTHER", "PPT_DOCUMENT_TYPE_EXPLAIN"],
  { condition: "passport_document_type === other" },
);
addField(
  "passport",
  "lost_passport_number",
  "text",
  "Lost/Stolen Passport Number",
  ["LOST_PPT_NUM", "LOST_PASSPORT_NUM", "PPT_LOST_NUMBER"],
  { condition: "lost_passport === yes", repeatGroup: "lost_passport" },
);
addField(
  "passport",
  "lost_passport_number_unknown",
  "checkbox",
  "Do Not Know",
  ["cbxLOST_PPT_NUM_UNKN_IND"],
  {
    seedFieldName: "lost_passport_number",
    condition: "lost_passport === yes",
    repeatGroup: "lost_passport",
    selectorEvidence: "repository_selector",
  },
);
addField(
  "passport",
  "lost_passport_country",
  "select",
  "Country/Authority That Issued Passport/Travel Document",
  ["LOST_PPT_COUNTRY", "LOST_PASSPORT_COUNTRY", "LOST_PPT_ISSUED_CNTRY"],
  { condition: "lost_passport === yes", repeatGroup: "lost_passport" },
);
addField(
  "passport",
  "lost_passport_explain",
  "textarea",
  "Explain",
  ["LOST_PPT_EXPLAIN", "LOST_PASSPORT_EXPLAIN", "tbxLOST_PPT_EXPLAIN"],
  { condition: "lost_passport === yes", repeatGroup: "lost_passport" },
);

// ── Family Information: Relatives ──────────────────────────────────────────
addField(
  "family_relatives",
  "us_relative_surname",
  "text",
  "Surnames",
  ["US_RELATIVE_SURNAME", "US_REL_SURNAME", "tbxUS_REL_SURNAME"],
  { condition: "has_immediate_us_relatives === yes", repeatGroup: "us_relatives" },
);
addField(
  "family_relatives",
  "us_relative_given_names",
  "text",
  "Given Names",
  ["US_RELATIVE_GIVEN_NAME", "US_REL_GIVEN_NAME", "tbxUS_REL_GIVEN_NAME"],
  { condition: "has_immediate_us_relatives === yes", repeatGroup: "us_relatives" },
);
addField(
  "family_relatives",
  "us_relative_relationship",
  "select",
  "Relationship to You",
  ["US_RELATIVE_REL", "US_REL_RELATIONSHIP", "ddlUS_REL_REL"],
  { condition: "has_immediate_us_relatives === yes", repeatGroup: "us_relatives" },
);
addField(
  "family_relatives",
  "us_relative_status",
  "select",
  "Relative's Status",
  ["US_RELATIVE_STATUS", "US_REL_STATUS", "ddlUS_REL_STATUS"],
  { condition: "has_immediate_us_relatives === yes", repeatGroup: "us_relatives" },
);

// ── Family Information: Spouse/Partner/Deceased/Former ─────────────────────
addField(
  "family_spouse",
  "spouse_country_of_birth",
  "select",
  "Spouse's Country/Region of Birth",
  ["SPOUSE_POB_CNTRY", "SPOUSE_COUNTRY_OF_BIRTH", "ddlSPOUSE_POB_CNTRY"],
  { condition: "marital_status === married || marital_status === legally_separated || marital_status === common_law" },
);
addField(
  "family_spouse",
  "spouse_address_type",
  "select",
  "Spouse's Address",
  ["SPOUSE_ADDR_TYPE", "SPOUSE_ADDRESS_TYPE", "ddlSPOUSE_ADDR_TYPE"],
  { condition: "marital_status === married || marital_status === legally_separated || marital_status === common_law" },
);

const spouseAddress = [
  ["spouse_address_street1", "Street Address (Line 1)", ["SPOUSE_ADDR_LN1", "SPOUSE_ADDRESS_LN1"]],
  ["spouse_address_street2", "Street Address (Line 2)", ["SPOUSE_ADDR_LN2", "SPOUSE_ADDRESS_LN2"]],
  ["spouse_address_city", "City", ["SPOUSE_ADDR_CITY", "SPOUSE_ADDRESS_CITY"]],
  ["spouse_address_state", "State/Province", ["SPOUSE_ADDR_STATE", "SPOUSE_ADDRESS_STATE"]],
  ["spouse_address_zip", "Postal Zone/ZIP Code", ["SPOUSE_ADDR_POSTAL", "SPOUSE_ADDRESS_POSTAL", "SPOUSE_ADDR_ZIP"]],
] as const;
for (const [fieldName, label, tokens] of spouseAddress) {
  addField("family_spouse", fieldName, "text", label, tokens, {
    condition: "spouse_address_type === other",
  });
}
const spouseAddressNa = [
  ["spouse_address_state_na", "State/Province Does Not Apply", ["cbexSPOUSE_ADDR_STATE_NA"], "spouse_address_state"],
  ["spouse_address_zip_na", "Postal Zone/ZIP Code Does Not Apply", ["cbexSPOUSE_ADDR_POSTAL_CD_NA"], "spouse_address_zip"],
] as const;
for (const [fieldName, label, tokens, seedFieldName] of spouseAddressNa) {
  addField("family_spouse", fieldName, "checkbox", label, tokens, {
    seedFieldName,
    condition: "spouse_address_type === other",
    selectorEvidence: "repository_selector",
  });
}
addField(
  "family_spouse",
  "spouse_address_country",
  "select",
  "Country/Region",
  ["SPOUSE_ADDR_COUNTRY", "SPOUSE_ADDRESS_COUNTRY"],
  { condition: "spouse_address_type === other" },
);

const partnerDetails = [
  ["partner_surname", "Partner's Surnames", "text", ["PARTNER_SURNAME", "PARTNER_SURNAMES"]],
  ["partner_given_names", "Partner's Given Names", "text", ["PARTNER_GIVEN_NAME", "PARTNER_GIVEN_NAMES"]],
  ["partner_nationality", "Partner's Country/Region of Origin (Nationality)", "select", ["PARTNER_NATL", "PARTNER_NATIONALITY"]],
  ["partner_city_of_birth", "Partner's City of Birth", "text", ["PARTNER_POB_CITY", "PARTNER_CITY_OF_BIRTH"]],
  ["partner_country_of_birth", "Partner's Country/Region of Birth", "select", ["PARTNER_POB_CNTRY", "PARTNER_COUNTRY_OF_BIRTH"]],
  ["partner_address_type", "Partner's Address", "select", ["PARTNER_ADDR_TYPE", "PARTNER_ADDRESS_TYPE"]],
] as const;
for (const [fieldName, label, seedType, tokens] of partnerDetails) {
  addField("family_spouse", fieldName, seedType, label, tokens, {
    condition: "marital_status === civil_union",
  });
}
addField(
  "family_spouse",
  "partner_city_of_birth_na",
  "checkbox",
  "Do Not Know",
  ["cbexSPOUSE_POB_CITY_NA"],
  {
    seedFieldName: "partner_city_of_birth",
    condition: "marital_status === civil_union",
    selectorEvidence: "repository_selector",
  },
);
const partnerAddress = [
  ["partner_address_street1", "Street Address (Line 1)", ["PARTNER_ADDR_LN1", "PARTNER_ADDRESS_LN1"]],
  ["partner_address_street2", "Street Address (Line 2)", ["PARTNER_ADDR_LN2", "PARTNER_ADDRESS_LN2"]],
  ["partner_address_city", "City", ["PARTNER_ADDR_CITY", "PARTNER_ADDRESS_CITY"]],
  ["partner_address_state", "State/Province", ["PARTNER_ADDR_STATE", "PARTNER_ADDRESS_STATE"]],
  ["partner_address_zip", "Postal Zone/ZIP Code", ["PARTNER_ADDR_POSTAL", "PARTNER_ADDRESS_POSTAL", "PARTNER_ADDR_ZIP"]],
] as const;
for (const [fieldName, label, tokens] of partnerAddress) {
  addField("family_spouse", fieldName, "text", label, tokens, {
    condition: "partner_address_type === other",
  });
}
const partnerAddressNa = [
  ["partner_address_state_na", "State/Province Does Not Apply", ["cbexSPOUSE_ADDR_STATE_NA"], "partner_address_state"],
  ["partner_address_zip_na", "Postal Zone/ZIP Code Does Not Apply", ["cbexSPOUSE_ADDR_POSTAL_CD_NA"], "partner_address_zip"],
] as const;
for (const [fieldName, label, tokens, seedFieldName] of partnerAddressNa) {
  addField("family_spouse", fieldName, "checkbox", label, tokens, {
    seedFieldName,
    condition: "partner_address_type === other",
    selectorEvidence: "repository_selector",
  });
}
addField(
  "family_spouse",
  "partner_address_country",
  "select",
  "Country/Region",
  ["PARTNER_ADDR_COUNTRY", "PARTNER_ADDRESS_COUNTRY"],
  { condition: "partner_address_type === other" },
);

addDate(
  "family_spouse",
  "partner_date_of_birth",
  "Partner's Date of Birth",
  "marital_status === civil_union",
  undefined,
  ["ddlPARTNER_DOBDay", "PARTNER_DOB_DAY"],
  ["ddlPARTNER_DOBMonth", "PARTNER_DOB_MONTH"],
  ["tbxPARTNER_DOBYear", "PARTNER_DOB_YEAR"],
);
const deceasedDetails = [
  ["deceased_spouse_surname", "Deceased Spouse's Surnames", "text", ["DECEASED_SPOUSE_SURNAME", "DECEASED_SURNAME"]],
  ["deceased_spouse_given_names", "Deceased Spouse's Given Names", "text", ["DECEASED_SPOUSE_GIVEN_NAME", "DECEASED_GIVEN_NAMES"]],
  ["deceased_spouse_nationality", "Deceased Spouse's Country/Region of Origin (Nationality)", "select", ["DECEASED_SPOUSE_NATL", "DECEASED_SPOUSE_NATIONALITY"]],
  ["deceased_spouse_city_of_birth", "Deceased Spouse's City of Birth", "text", ["DECEASED_SPOUSE_POB_CITY", "DECEASED_SPOUSE_CITY_OF_BIRTH"]],
  ["deceased_spouse_country_of_birth", "Deceased Spouse's Country/Region of Birth", "select", ["DECEASED_SPOUSE_POB_CNTRY", "DECEASED_SPOUSE_COUNTRY_OF_BIRTH"]],
] as const;
for (const [fieldName, label, seedType, tokens] of deceasedDetails) {
  addField("family_spouse", fieldName, seedType, label, tokens, {
    condition: "marital_status === widowed",
  });
}
addField(
  "family_spouse",
  "deceased_spouse_city_of_birth_unknown",
  "checkbox",
  "Do Not Know",
  ["cbxSPOUSE_POB_CITY_NA"],
  {
    seedFieldName: "deceased_spouse_city_of_birth",
    condition: "marital_status === widowed",
    selectorEvidence: "repository_selector",
  },
);
addDate(
  "family_spouse",
  "deceased_spouse_date_of_birth",
  "Deceased Spouse's Date of Birth",
  "marital_status === widowed",
  undefined,
  ["ddlDECEASED_SPOUSE_DOBDay", "DECEASED_SPOUSE_DOB_DAY"],
  ["ddlDECEASED_SPOUSE_DOBMonth", "DECEASED_SPOUSE_DOB_MONTH"],
  ["tbxDECEASED_SPOUSE_DOBYear", "DECEASED_SPOUSE_DOB_YEAR"],
);
addField(
  "family_spouse",
  "number_of_former_spouses",
  "select",
  "Number of Former Spouses",
  ["FORMER_SPOUSE_COUNT", "NUM_FORMER_SPOUSES", "NUMBER_FORMER_SPOUSES"],
  { condition: "marital_status === divorced" },
);
const formerDetails = [
  ["former_spouse_surname", "Former Spouse's Surnames", "text", ["FORMER_SPOUSE_SURNAME", "FORMER_SPOUSE_SURNAMES"]],
  ["former_spouse_given_names", "Former Spouse's Given Names", "text", ["FORMER_SPOUSE_GIVEN_NAME", "FORMER_SPOUSE_GIVEN_NAMES"]],
  ["former_spouse_nationality", "Former Spouse's Country/Region of Origin (Nationality)", "select", ["FORMER_SPOUSE_NATL", "FORMER_SPOUSE_NATIONALITY"]],
  ["former_spouse_city_of_birth", "Former Spouse's City of Birth", "text", ["FORMER_SPOUSE_POB_CITY", "FORMER_SPOUSE_CITY_OF_BIRTH"]],
  ["former_spouse_country_of_birth", "Former Spouse's Country/Region of Birth", "select", ["FORMER_SPOUSE_POB_CNTRY", "FORMER_SPOUSE_COUNTRY_OF_BIRTH"]],
  ["former_spouse_how_marriage_ended", "How the Marriage Ended", "text", ["FORMER_SPOUSE_MARRIAGE_ENDED", "FORMER_MARRIAGE_ENDED"]],
  ["former_spouse_country_marriage_terminated", "Country/Region Marriage was Terminated", "select", ["FORMER_SPOUSE_MARRIAGE_COUNTRY", "FORMER_MARRIAGE_TERMINATED_COUNTRY"]],
] as const;
for (const [fieldName, label, seedType, tokens] of formerDetails) {
  addField("family_spouse", fieldName, seedType, label, tokens, {
    condition: "marital_status === divorced",
    repeatGroup: "former_spouses",
  });
}
addField(
  "family_spouse",
  "former_spouse_city_of_birth_unknown",
  "checkbox",
  "Do Not Know",
  ["DListSpouse_ctl00_cbxSPOUSE_POB_CITY_NA", "cbxSPOUSE_POB_CITY_NA"],
  {
    seedFieldName: "former_spouse_city_of_birth",
    condition: "marital_status === divorced",
    repeatGroup: "former_spouses",
    selectorEvidence: "repository_selector",
  },
);
addDate(
  "family_spouse",
  "former_spouse_date_of_birth",
  "Former Spouse's Date of Birth",
  "marital_status === divorced",
  "former_spouses",
  ["ddlFORMER_SPOUSE_DOBDay", "FORMER_SPOUSE_DOB_DAY"],
  ["ddlFORMER_SPOUSE_DOBMonth", "FORMER_SPOUSE_DOB_MONTH"],
  ["tbxFORMER_SPOUSE_DOBYear", "FORMER_SPOUSE_DOB_YEAR"],
);
addDate(
  "family_spouse",
  "former_spouse_date_of_marriage",
  "Date of Marriage",
  "marital_status === divorced",
  "former_spouses",
  ["ddlFORMER_SPOUSE_MARRIAGE_Day", "FORMER_MARRIAGE_DATE_DAY"],
  ["ddlFORMER_SPOUSE_MARRIAGE_Month", "FORMER_MARRIAGE_DATE_MONTH"],
  ["tbxFORMER_SPOUSE_MARRIAGE_Year", "FORMER_MARRIAGE_DATE_YEAR"],
);
addDate(
  "family_spouse",
  "former_spouse_date_marriage_ended",
  "Date Marriage Ended",
  "marital_status === divorced",
  "former_spouses",
  ["ddlFORMER_SPOUSE_ENDED_Day", "FORMER_MARRIAGE_ENDED_DATE_DAY"],
  ["ddlFORMER_SPOUSE_ENDED_Month", "FORMER_MARRIAGE_ENDED_DATE_MONTH"],
  ["tbxFORMER_SPOUSE_ENDED_Year", "FORMER_MARRIAGE_ENDED_DATE_YEAR"],
);

// ── U.S. Point of Contact ──────────────────────────────────────────────────
addField(
  "us_contact",
  "us_contact_address_street2",
  "text",
  "Street Address (Line 2)",
  ["US_POC_ADDR_LN2", "US_CONTACT_ADDR_LN2"],
  { condition: "has_specific_plans !== no && us_contact_relationship !== _empty || intended_length_of_stay_unit !== H && us_contact_relationship !== _empty" },
);

// ── Work/Education/Training: Present ───────────────────────────────────────
addField(
  "work_education_present",
  "occupation_other_explain",
  "text",
  "Specify Other",
  ["WORK_EDUC_PRSNT_OCCP_OTHER", "PRESENT_OCCUPATION_OTHER", "OCCUPATION_OTHER_EXPLAIN"],
  { condition: "primary_occupation === other" },
);
addField(
  "work_education_present",
  "not_employed_explain",
  "textarea",
  "Explain",
  ["WORK_EDUC_PRSNT_NOT_EMPLOYED_EXPLAIN", "NOT_EMPLOYED_EXPLAIN", "tbxNOT_EMPLOYED_EXPLAIN"],
  { condition: "primary_occupation === not_employed" },
);
addField(
  "work_education_present",
  "employer_address_line2",
  "text",
  "Street Address (Line 2)",
  ["tbxEmpSchAddr2", "WORK_EDUC_ADDR_LN2", "EMPLOYER_ADDR_LN2"],
  { condition: "primary_occupation !== _empty && primary_occupation !== retired && primary_occupation !== homemaker && primary_occupation !== not_employed" },
);

// ── Work/Education/Training: Previous ──────────────────────────────────────
const previousEmployer = [
  ["prev_employer_address_street1", "Street Address (Line 1)", ["PREV_EMPL_ADDR_LN1", "PREV_EMPLOYER_ADDR_LN1"]],
  ["prev_employer_address_street2", "Street Address (Line 2)", ["PREV_EMPL_ADDR_LN2", "PREV_EMPLOYER_ADDR_LN2"]],
  ["prev_employer_city", "City", ["PREV_EMPL_CITY", "PREV_EMPLOYER_CITY"]],
  ["prev_employer_state", "State/Province", ["PREV_EMPL_STATE", "PREV_EMPLOYER_STATE"]],
  ["prev_employer_postal", "Postal Zone/ZIP Code", ["PREV_EMPL_POSTAL", "PREV_EMPLOYER_POSTAL", "PREV_EMPL_ZIP"]],
  ["prev_employer_phone", "Telephone Number", ["PREV_EMPL_TEL", "PREV_EMPLOYER_PHONE"]],
  ["prev_job_title", "Job Title", ["PREV_EMPL_JOB_TITLE", "PREV_JOB_TITLE"]],
  ["prev_supervisor_surname", "Supervisor's Surnames", ["PREV_EMPL_SUPERVISOR_SURNAME", "PREV_SUPERVISOR_SURNAME"]],
  ["prev_supervisor_given_names", "Supervisor's Given Names", ["PREV_EMPL_SUPERVISOR_GIVEN_NAME", "PREV_SUPERVISOR_GIVEN_NAMES"]],
  ["prev_job_duties", "Briefly Describe Your Duties", ["PREV_EMPL_DUTIES", "PREV_JOB_DUTIES"]],
] as const;
for (const [fieldName, label, tokens] of previousEmployer) {
  const isTextarea = fieldName === "prev_job_duties";
  addField("work_education_previous", fieldName, isTextarea ? "textarea" : "text", label, tokens, {
    condition: "has_previous_employer === yes",
    repeatGroup: "previous_employers",
  });
}
const previousEmployerSentinels = [
  ["prev_employer_state_na", "State/Province Does Not Apply", ["cbxPREV_EMPL_ADDR_STATE_NA"], "prev_employer_state"],
  ["prev_employer_postal_na", "Postal Zone/ZIP Code Does Not Apply", ["cbxPREV_EMPL_ADDR_POSTAL_CD_NA"], "prev_employer_postal"],
  ["prev_supervisor_surname_unknown", "Do Not Know", ["cbxSupervisorSurname_NA"], "prev_supervisor_surname"],
  ["prev_supervisor_given_names_unknown", "Do Not Know", ["cbxSupervisorGivenName_NA"], "prev_supervisor_given_names"],
] as const;
for (const [fieldName, label, tokens, seedFieldName] of previousEmployerSentinels) {
  addField("work_education_previous", fieldName, "checkbox", label, tokens, {
    seedFieldName,
    condition: "has_previous_employer === yes",
    repeatGroup: "previous_employers",
    selectorEvidence: "repository_selector",
  });
}
addField(
  "work_education_previous",
  "prev_employer_country",
  "select",
  "Country/Region",
  ["PREV_EMPL_COUNTRY", "PREV_EMPLOYER_COUNTRY"],
  { condition: "has_previous_employer === yes", repeatGroup: "previous_employers" },
);
addDate(
  "work_education_previous",
  "prev_employment_start_date",
  "Employment Date From",
  "has_previous_employer === yes",
  "previous_employers",
  ["ddlPREV_EMPL_DATE_FROMDay", "ddlPREV_EMPL_FROMDay", "PREV_EMPLOYMENT_START_DAY"],
  ["ddlPREV_EMPL_DATE_FROMMonth", "ddlPREV_EMPL_FROMMonth", "PREV_EMPLOYMENT_START_MONTH"],
  ["tbxPREV_EMPL_DATE_FROMYear", "tbxPREV_EMPL_FROMYear", "PREV_EMPLOYMENT_START_YEAR"],
);
addDate(
  "work_education_previous",
  "prev_employment_end_date",
  "Employment Date To",
  "has_previous_employer === yes",
  "previous_employers",
  ["ddlPREV_EMPL_DATE_TO_Day", "ddlPREV_EMPL_TODay", "PREV_EMPLOYMENT_END_DAY"],
  ["ddlPREV_EMPL_DATE_TO_Month", "ddlPREV_EMPL_TOMonth", "PREV_EMPLOYMENT_END_MONTH"],
  ["tbxPREV_EMPL_DATE_TO_Year", "tbxPREV_EMPL_TOYear", "PREV_EMPLOYMENT_END_YEAR"],
);

const education = [
  ["education_institution_name", "Name of Institution", "text", ["tbxSchoolName"]],
  ["education_address_line1", "Street Address (Line 1)", "text", ["tbxSchoolAddr1"]],
  ["education_address_line2", "Street Address (Line 2)", "text", ["tbxSchoolAddr2"]],
  ["education_city", "City", "text", ["tbxSchoolCity"]],
  ["education_state_province", "State/Province", "text", ["tbxEDUC_INST_ADDR_STATE"]],
  ["education_postal_code", "Postal Zone/ZIP Code", "text", ["tbxEDUC_INST_POSTAL_CD"]],
  ["education_country", "Country/Region", "select", ["ddlSchoolCountry"]],
  ["education_course_of_study", "Course of Study", "text", ["tbxSchoolCourseOfStudy"]],
] as const;
for (const [fieldName, label, seedType, tokens] of education) {
  addField("work_education_previous", fieldName, seedType, label, tokens, {
    condition: "has_attended_education === yes",
    repeatGroup: "education",
    selectorEvidence: "repository_selector",
  });
}

// CEAC renders the state and postal "Does Not Apply" controls as companions
// to the education address text fields. They share the same ctlNN row token,
// so they must be discovered and filled inside the same repeat-row scope.
const educationAddressNa = [
  [
    "education_address_state_na",
    "State/Province Does Not Apply",
    ["cbxEDUC_INST_ADDR_STATE_NA"],
    "education_state_province",
  ],
  [
    "education_address_postal_na",
    "Postal Zone/ZIP Code Does Not Apply",
    ["cbxEDUC_INST_POSTAL_CD_NA"],
    "education_postal_code",
  ],
] as const;
for (const [fieldName, label, tokens, seedFieldName] of educationAddressNa) {
  addField("work_education_previous", fieldName, "checkbox", label, tokens, {
    seedFieldName,
    condition: "has_attended_education === yes",
    repeatGroup: "education",
    selectorEvidence: "repository_selector",
  });
}
addDate(
  "work_education_previous",
  "education_start_date",
  "Date of Attendance From",
  "has_attended_education === yes",
  "education",
  ["ddlSchoolFromDay"],
  ["ddlSchoolFromMonth"],
  ["tbxSchoolFromYear"],
  "repository_selector",
);
addDate(
  "work_education_previous",
  "education_end_date",
  "Date of Attendance To",
  "has_attended_education === yes",
  "education",
  ["ddlSchoolToDay"],
  ["ddlSchoolToMonth"],
  ["tbxSchoolToYear"],
  "repository_selector",
);

// ── Work/Education/Training: Additional ────────────────────────────────────
addField(
  "work_education_additional",
  "clan_tribe_name",
  "text",
  "Clan/Tribe Name",
  ["CLAN_TRIBE_NAME", "CLAN_NAME", "TRIBE_NAME"],
  { condition: "has_clan_tribe === yes" },
);
addField(
  "work_education_additional",
  "traveled_country",
  "select",
  "Country/Region",
  ["COUNTRIES_VISITED", "TRAVELED_COUNTRY", "COUNTRY_VISITED"],
  { condition: "has_traveled_last_five_years === yes", repeatGroup: "traveled_countries" },
);
addField(
  "work_education_additional",
  "organization_name",
  "text",
  "Organization Name",
  ["ORGANIZATION_NAME", "ORG_NAME", "ORGANIZATION"],
  { condition: "has_belonged_to_organization === yes", repeatGroup: "organizations" },
);
addField(
  "work_education_additional",
  "specialized_skills_explain",
  "textarea",
  "Explain",
  ["SPECIALIZED_SKILLS_EXPLAIN", "SPECIALIZED_SKILLS", "tbxSPECIALIZED_SKILLS"],
  { condition: "has_specialized_skills === yes" },
);
const military = [
  ["military_country", "Country/Region", "select", ["MILITARY_COUNTRY", "MILITARY_SERVICE_COUNTRY"]],
  ["military_branch", "Branch of Service", "text", ["MILITARY_BRANCH", "MILITARY_SERVICE_BRANCH"]],
  ["military_rank", "Rank/Position", "text", ["MILITARY_RANK", "MILITARY_SERVICE_RANK"]],
  ["military_specialty", "Military Specialty", "text", ["MILITARY_SPECIALTY", "MILITARY_SERVICE_SPECIALTY"]],
] as const;
for (const [fieldName, label, seedType, tokens] of military) {
  addField("work_education_additional", fieldName, seedType, label, tokens, {
    condition: "has_served_military === yes",
    repeatGroup: "military_service",
  });
}
addDate(
  "work_education_additional",
  "military_date_from",
  "Date of Service From",
  "has_served_military === yes",
  "military_service",
  ["ddlMILITARY_SVC_FROMDay", "ddlMILITARY_DATE_FROMDay", "ddlMILITARY_FROMDay", "MILITARY_DATE_FROM_DAY"],
  ["ddlMILITARY_SVC_FROMMonth", "ddlMILITARY_DATE_FROMMonth", "ddlMILITARY_FROMMonth", "MILITARY_DATE_FROM_MONTH"],
  ["tbxMILITARY_SVC_FROMYear", "tbxMILITARY_DATE_FROMYear", "tbxMILITARY_FROMYear", "MILITARY_DATE_FROM_YEAR"],
  "repository_selector",
);
addDate(
  "work_education_additional",
  "military_date_to",
  "Date of Service To",
  "has_served_military === yes",
  "military_service",
  ["ddlMILITARY_SVC_TODay", "ddlMILITARY_DATE_TO_Day", "ddlMILITARY_TODay", "MILITARY_DATE_TO_DAY"],
  ["ddlMILITARY_SVC_TOMonth", "ddlMILITARY_DATE_TO_Month", "ddlMILITARY_TOMonth", "MILITARY_DATE_TO_MONTH"],
  ["tbxMILITARY_SVC_TOYear", "tbxMILITARY_DATE_TO_Year", "tbxMILITARY_TOYear", "MILITARY_DATE_TO_YEAR"],
  "repository_selector",
);
addField(
  "work_education_additional",
  "paramilitary_explain",
  "textarea",
  "Explain",
  ["INSURGENT_ORG_EXPLAIN", "PARAMILITARY_EXPLAIN", "tbxPARAMILITARY_EXPLAIN"],
  { condition: "has_served_paramilitary === yes" },
);

// ── Security and Background explanations ───────────────────────────────────
const securityExplanations: ReadonlyArray<{
  page: Extract<Ds160ExtendedPage, `security_background_${1 | 2 | 3 | 4 | 5}`>;
  number: number;
  controller: string;
  fieldName: string;
}> = [
  { page: "security_background_1", number: 1, controller: "has_communicable_disease", fieldName: "has_communicable_disease_explain" },
  { page: "security_background_1", number: 2, controller: "has_physical_mental_disorder", fieldName: "has_physical_mental_disorder_explain" },
  { page: "security_background_1", number: 3, controller: "is_drug_abuser", fieldName: "is_drug_abuser_explain" },
  { page: "security_background_2", number: 1, controller: "has_arrest_conviction", fieldName: "has_arrest_conviction_explain" },
  { page: "security_background_2", number: 2, controller: "has_violated_controlled_substance", fieldName: "has_violated_controlled_substance_explain" },
  { page: "security_background_2", number: 3, controller: "has_prostitution", fieldName: "has_prostitution_explain" },
  { page: "security_background_2", number: 4, controller: "has_money_laundering", fieldName: "has_money_laundering_explain" },
  { page: "security_background_2", number: 5, controller: "has_human_trafficking", fieldName: "has_human_trafficking_explain" },
  { page: "security_background_2", number: 6, controller: "has_aided_human_trafficking", fieldName: "has_aided_human_trafficking_explain" },
  { page: "security_background_2", number: 7, controller: "has_trafficking_beneficiary", fieldName: "has_trafficking_beneficiary_explain" },
  { page: "security_background_3", number: 1, controller: "intend_illegal_activity", fieldName: "intend_illegal_activity_explain" },
  { page: "security_background_3", number: 2, controller: "intend_terrorist_activity", fieldName: "intend_terrorist_activity_explain" },
  { page: "security_background_3", number: 3, controller: "has_provided_terrorist_support", fieldName: "has_provided_terrorist_support_explain" },
  { page: "security_background_3", number: 4, controller: "is_terrorist_member", fieldName: "is_terrorist_member_explain" },
  { page: "security_background_3", number: 5, controller: "is_terrorist_family", fieldName: "is_terrorist_family_explain" },
  { page: "security_background_3", number: 6, controller: "has_genocide", fieldName: "has_genocide_explain" },
  { page: "security_background_3", number: 7, controller: "has_torture", fieldName: "has_torture_explain" },
  { page: "security_background_3", number: 8, controller: "has_extrajudicial_killings", fieldName: "has_extrajudicial_killings_explain" },
  { page: "security_background_3", number: 9, controller: "has_child_soldier", fieldName: "has_child_soldier_explain" },
  { page: "security_background_3", number: 10, controller: "has_religious_freedom_violation", fieldName: "has_religious_freedom_violation_explain" },
  { page: "security_background_3", number: 11, controller: "has_population_control", fieldName: "has_population_control_explain" },
  { page: "security_background_3", number: 12, controller: "has_coercive_transplant", fieldName: "has_coercive_transplant_explain" },
  { page: "security_background_4", number: 1, controller: "has_immigration_fraud", fieldName: "has_immigration_fraud_explain" },
  { page: "security_background_4", number: 2, controller: "has_removal_order", fieldName: "has_removal_order_explain" },
  { page: "security_background_5", number: 1, controller: "has_withheld_child_custody", fieldName: "has_withheld_child_custody_explain" },
  { page: "security_background_5", number: 2, controller: "has_voted_illegally", fieldName: "has_voted_illegally_explain" },
  { page: "security_background_5", number: 3, controller: "has_renounced_citizenship", fieldName: "has_renounced_citizenship_explain" },
];

for (const explanation of securityExplanations) {
  addField(
    explanation.page,
    explanation.fieldName,
    "textarea",
    "Explain",
    [
      `SECURITY_PART${explanation.page.slice(-1)}_Q${explanation.number}_EXPLAIN`,
      `${explanation.controller.toUpperCase()}_EXPLAIN`,
      `tbx${explanation.controller.replace(/(^|_)([a-z])/g, (_, _separator: string, letter: string) => letter.toUpperCase())}Explain`,
    ],
    { condition: `${explanation.controller} === yes` },
  );
}

const pageNames: Readonly<Record<Ds160ExtendedPage, string>> = {
  personal_information_1: "Personal Information 1",
  personal_information_2: "Personal Information 2",
  travel_information: "Travel Information",
  travel_companions: "Travel Companions",
  previous_us_travel: "Previous U.S. Travel",
  address_and_phone: "Address and Phone",
  passport: "Passport Information",
  family_relatives: "Family Information: Relatives",
  family_spouse: "Family Information: Spouse",
  work_education_present: "Work/Education/Training: Present",
  work_education_previous: "Work/Education/Training: Previous",
  work_education_additional: "Work/Education/Training: Additional",
  us_contact: "US Point of Contact",
  security_background_1: "Security and Background: Part 1",
  security_background_2: "Security and Background: Part 2",
  security_background_3: "Security and Background: Part 3",
  security_background_4: "Security and Background: Part 4",
  security_background_5: "Security and Background: Part 5",
};

const pageOrder: readonly Ds160ExtendedPage[] = [
  "personal_information_1",
  "personal_information_2",
  "travel_information",
  "travel_companions",
  "previous_us_travel",
  "address_and_phone",
  "passport",
  "family_relatives",
  "family_spouse",
  "us_contact",
  "work_education_present",
  "work_education_previous",
  "work_education_additional",
  "security_background_1",
  "security_background_2",
  "security_background_3",
  "security_background_4",
  "security_background_5",
];

const mappingEntries = declarations.map((spec) => {
  const mapping: FormFieldMapping = {
    selector: selectorFor(spec.mappingType, spec.selectorTokens, spec.label, spec.htmlTag),
    type: spec.mappingType,
    label: spec.label,
  };
  const metadata: Ds160ExtendedFieldMetadata = {
    fieldName: spec.fieldName,
    seedFieldName: spec.seedFieldName ?? spec.fieldName,
    page: spec.page,
    seedType: spec.seedType,
    condition: spec.condition,
    repeatGroup: spec.repeatGroup,
    selectorEvidence: spec.selectorEvidence ?? "official_label_fallback",
    officialLabel: spec.label,
    readBack: "required",
    derivedFrom: spec.derivedFrom,
    derivedPart: spec.derivedPart,
  };
  return { ...spec, mapping, metadata };
});

export const DS160_EXTENDED_MAPPINGS: Record<string, FormFieldMapping> =
  Object.fromEntries(mappingEntries.map((entry) => [entry.fieldName, entry.mapping]));

export const DS160_EXTENDED_METADATA: Record<string, Ds160ExtendedFieldMetadata> =
  Object.fromEntries(mappingEntries.map((entry) => [entry.fieldName, entry.metadata]));

/** Date sources are consumed through these deterministic split outputs. */
export const DS160_EXTENDED_DATE_SPLITS: readonly Ds160ExtendedDateSplit[] = dateSplits;

/**
 * Reverse index for the parity audit and for the orchestrator wiring.  A date
 * source is covered by its three derived controls; every other seed field is
 * covered by its direct mapping key.
 */
export const DS160_EXTENDED_SEED_CONSUMERS: Readonly<Record<string, readonly string[]>> = (() => {
  const consumers = new Map<string, string[]>();
  for (const entry of mappingEntries) {
    const source = entry.metadata.seedFieldName;
    const current = consumers.get(source) ?? [];
    current.push(entry.fieldName);
    consumers.set(source, current);
  }
  return Object.fromEntries(
    [...consumers.entries()].map(([source, keys]) => [source, [...keys]]),
  );
})();

export const DS160_EXTENDED_MAPPING_GROUPS: readonly Ds160ExtendedMappingGroup[] = pageOrder.map((page) => {
  const pageEntries = mappingEntries.filter((entry) => entry.page === page);
  return {
    name: pageNames[page],
    page,
    mappings: Object.fromEntries(pageEntries.map((entry) => [entry.fieldName, entry.mapping])),
    metadata: Object.fromEntries(pageEntries.map((entry) => [entry.fieldName, entry.metadata])),
  };
});
