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
  /** Match the whole final control name when sibling controls share a prefix. */
  selectorMatch?: "contains" | "suffix";
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
  selectorMatch: "contains" | "suffix" = "contains",
): string {
  const tag = htmlTag ?? (mappingType === "select" ? "select" : "input");
  const typeClause = mappingType === "radio" || mappingType === "checkbox"
    ? `[type="${mappingType}"]`
    : "";
  const operator = selectorMatch === "suffix" ? "$" : "*";
  const candidates = tokens.flatMap((token) => [
    `${tag}${typeClause}[id${operator}="${token}"]`,
    `${tag}${typeClause}[name${operator}="${token}"]`,
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
    selectorMatch: options.selectorMatch,
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
  ["tbxSURNAME"],
  { condition: "other_names_used === yes" },
);
addField(
  "personal_information_1",
  "other_given_names",
  "text",
  "Other Given Names Used",
  ["tbxGIVEN_NAME"],
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
  "textarea",
  "Other — Please Explain",
  ["tbxOtherMaritalStatus", "APP_MARITAL_STATUS_OTHER", "MARITAL_STATUS_OTHER", "MARITAL_OTHER_EXPLAIN"],
  { condition: "marital_status === other" },
);

// ── Personal Information 2 ─────────────────────────────────────────────────
addField(
  "personal_information_2",
  "other_nationality_country",
  "select",
  "Other Country/Region of Nationality",
  ["ddlOTHER_NATL"],
  { condition: "other_nationality === yes", repeatGroup: "other_nationality" },
);
addField(
  "personal_information_2",
  "other_nationality_has_passport",
  "radio",
  "Do you hold a passport for that other nationality?",
  ["rblOTHER_PPT_IND"],
  { condition: "other_nationality === yes", repeatGroup: "other_nationality" },
);
addField(
  "personal_information_2",
  "other_nationality_passport_number",
  "text",
  "Passport Number",
  ["tbxOTHER_PPT_NUM"],
  { condition: "other_nationality_has_passport === yes", repeatGroup: "other_nationality" },
);
addField(
  "personal_information_2",
  "other_permanent_resident_country",
  "select",
  "Other Permanent Resident Country/Region",
  ["ddlOthPermResCntry"],
  { condition: "permanent_resident_other_country === yes", repeatGroup: "permanent_resident" },
);

// ── Travel Information ─────────────────────────────────────────────────────
addField(
  "travel_information",
  "arrival_flight",
  "text",
  "Arrival Flight (if known)",
  ["tbxArriveFlight"],
  { condition: "has_specific_plans === yes" },
);
addField(
  "travel_information",
  "arrival_city",
  "text",
  "Arrival City",
  ["tbxArriveCity"],
  { condition: "has_specific_plans === yes" },
);
addField(
  "travel_information",
  "departure_flight",
  "text",
  "Departure Flight (if known)",
  ["tbxDepartFlight"],
  { condition: "has_specific_plans === yes" },
);
addField(
  "travel_information",
  "departure_city",
  "text",
  "Departure City",
  ["tbxDepartCity"],
  { condition: "has_specific_plans === yes" },
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
  ["rblPayerAddrSameAsInd"],
  { condition: "trip_payer_type === other_person" },
);

const payerAddress = [
  ["payer_address_street1", "Street Address (Line 1)", ["tbxPayerStreetAddress1"]],
  ["payer_address_street2", "Street Address (Line 2)", ["tbxPayerStreetAddress2"]],
  ["payer_address_city", "City", ["tbxPayerCity"]],
  ["payer_address_state", "State/Province", ["tbxPayerStateProvince"]],
  ["payer_address_postal", "Postal Zone/ZIP Code", ["tbxPayerPostalZIPCode"]],
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
  ["ddlPayerCountry"],
  { condition: "payer_address_same_as_home === no" },
);

const payerOrganization = [
  ["payer_org_name", "Name of Company/Organization Paying for Trip", ["tbxPayingCompany"]],
  ["payer_org_phone", "Telephone Number", ["tbxPayerPhone"]],
  ["payer_org_relationship", "Relationship to You", ["tbxCompanyRelation"]],
  ["payer_org_address_street1", "Street Address (Line 1)", ["tbxPayerStreetAddress1"]],
  ["payer_org_address_street2", "Street Address (Line 2)", ["tbxPayerStreetAddress2"]],
  ["payer_org_address_city", "City", ["tbxPayerCity"]],
  ["payer_org_address_state", "State/Province", ["tbxPayerStateProvince"]],
  ["payer_org_address_postal", "Postal Zone/ZIP Code", ["tbxPayerPostalZIPCode"]],
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
  ["ddlPayerCountry"],
  { condition: "trip_payer_type === other_company" },
);

// ── Travel Companions ──────────────────────────────────────────────────────
addField(
  "travel_companions",
  "companion_surname",
  "text",
  "Surnames",
  ["tbxSurname"],
  { condition: "companion_group_travel === no", repeatGroup: "companions" },
);
addField(
  "travel_companions",
  "companion_given_names",
  "text",
  "Given Names",
  ["tbxGivenName"],
  { condition: "companion_group_travel === no", repeatGroup: "companions" },
);
addField(
  "travel_companions",
  "companion_relationship",
  "select",
  "Relationship to You",
  ["ddlTCRelationship"],
  { condition: "companion_group_travel === no", repeatGroup: "companions" },
);

// ── Previous U.S. Travel ───────────────────────────────────────────────────
addDate(
  "previous_us_travel",
  "previous_visit_date_arrived",
  "Date Arrived",
  "has_been_in_us === yes",
  "previous_visits",
  ["ddlPREV_US_VISIT_DTEDay"],
  ["ddlPREV_US_VISIT_DTEMonth"],
  ["tbxPREV_US_VISIT_DTEYear"],
);
addField(
  "previous_us_travel",
  "previous_visit_length_of_stay",
  "text",
  "Length of Stay (Value)",
  ["tbxPREV_US_VISIT_LOS"],
  { condition: "has_been_in_us === yes", repeatGroup: "previous_visits" },
);
addField(
  "previous_us_travel",
  "previous_visit_length_of_stay_unit",
  "select",
  "Length of Stay (Unit)",
  ["ddlPREV_US_VISIT_LOS_CD"],
  { condition: "has_been_in_us === yes", repeatGroup: "previous_visits" },
);
addField(
  "previous_us_travel",
  "has_us_drivers_license",
  "radio",
  "Do you or did you ever hold a U.S. Driver's License?",
  ["rblPREV_US_DRIVER_LIC_IND"],
  { condition: "has_been_in_us === yes" },
);
addField(
  "previous_us_travel",
  "us_drivers_license_number",
  "text",
  "Driver's License Number",
  ["tbxUS_DRIVER_LICENSE"],
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
  ["ddlUS_DRIVER_LICENSE_STATE"],
  { condition: "has_us_drivers_license === yes", repeatGroup: "drivers_licenses" },
);
addField(
  "previous_us_travel",
  "last_visa_issue_day",
  "select",
  "Date Last Visa Was Issued (Day)",
  ["ddlPREV_VISA_ISSUED_DTEDay"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "last_visa_issue_month",
  "select",
  "Date Last Visa Was Issued (Month)",
  ["ddlPREV_VISA_ISSUED_DTEMonth"],
  { condition: "has_us_visa === yes" },
);
addField(
  "previous_us_travel",
  "last_visa_issue_year",
  "text",
  "Date Last Visa Was Issued (Year)",
  ["tbxPREV_VISA_ISSUED_DTEYear"],
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
  ["rblPREV_VISA_TEN_PRINT_IND"],
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
  ["tbxPREV_VISA_LOST_EXPL"],
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
  ["tbxPREV_VISA_CANCELLED_EXPL"],
  { condition: "visa_cancelled_or_revoked === yes" },
);
addField(
  "previous_us_travel",
  "refusal_explain",
  "textarea",
  "Explain",
  ["tbxPREV_VISA_REFUSED_EXPL"],
  { condition: "has_been_refused === yes", repeatGroup: "visa_refused" },
);
addField(
  "previous_us_travel",
  "immigrant_petition_explain",
  "textarea",
  "Explain",
  ["tbxIV_PETITION_EXPL"],
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
  ["mailing_address_line1", "Mailing Street Address (Line 1)", ["tbxMAILING_ADDR_LN1"]],
  ["mailing_address_line2", "Mailing Street Address (Line 2)", ["tbxMAILING_ADDR_LN2"]],
  ["mailing_address_city", "Mailing City", ["tbxMAILING_ADDR_CITY"]],
  ["mailing_address_state", "Mailing State/Province", ["tbxMAILING_ADDR_STATE"]],
  ["mailing_address_postal", "Mailing Postal Zone/ZIP Code", ["tbxMAILING_ADDR_POSTAL_CD"]],
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
  ["ddlMailCountry"],
  { condition: "mailing_same_as_home === no" },
);
addField(
  "address_and_phone",
  "secondary_phone",
  "text",
  "Secondary Phone Number",
  ["tbxAPP_MOBILE_TEL"],
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
  ["tbxAddPhoneInfo"],
  { condition: "has_other_phones === yes", repeatGroup: "additional_phones" },
);
addField(
  "address_and_phone",
  "additional_email",
  "text",
  "Additional Email Address",
  ["tbxAddEmailInfo"],
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
  ["tbxAddSocialPlat"],
  { condition: "has_other_social_media === yes", repeatGroup: "other_social_media" },
);
addField(
  "address_and_phone",
  "other_social_media_identifier",
  "text",
  "Identifier",
  ["tbxAddSocialHand"],
  { condition: "has_other_social_media === yes", repeatGroup: "other_social_media" },
);

// ── Passport Information ──────────────────────────────────────────────────
addField(
  "passport",
  "passport_document_type_explain",
  "textarea",
  "Please explain",
  ["tbxPptOtherExpl", "PPT_TYPE_OTHER", "PPT_DOC_TYPE_OTHER", "PPT_DOCUMENT_TYPE_EXPLAIN"],
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
  ["ddlLOST_PPT_NATL"],
  { condition: "lost_passport === yes", repeatGroup: "lost_passport" },
);
addField(
  "passport",
  "lost_passport_explain",
  "textarea",
  "Explain",
  ["tbxLOST_PPT_EXPL"],
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
  ["ddlUS_REL_TYPE"],
  { condition: "has_immediate_us_relatives === yes", repeatGroup: "us_relatives" },
);
addField(
  "family_relatives",
  "us_relative_status",
  "select",
  "Relative's Status",
  ["ddlUS_REL_STATUS"],
  { condition: "has_immediate_us_relatives === yes", repeatGroup: "us_relatives" },
);

// ── Family Information: Spouse/Partner/Deceased/Former ─────────────────────
addField(
  "family_spouse",
  "spouse_country_of_birth",
  "select",
  "Spouse's Country/Region of Birth",
  ["ddlSpousePOBCountry"],
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
  ["ddlSPOUSE_ADDR_CNTRY"],
  { condition: "spouse_address_type === other" },
);

const partnerDetails = [
  ["partner_surname", "Partner's Surnames", "text", ["tbxSpouseSurname"]],
  ["partner_given_names", "Partner's Given Names", "text", ["tbxSpouseGivenName"]],
  ["partner_nationality", "Partner's Country/Region of Origin (Nationality)", "select", ["ddlSpouseNatDropDownList"]],
  ["partner_city_of_birth", "Partner's City of Birth", "text", ["tbxSpousePOBCity"]],
  ["partner_country_of_birth", "Partner's Country/Region of Birth", "select", ["ddlSpousePOBCountry"]],
  ["partner_address_type", "Partner's Address", "select", ["ddlSpouseAddressType"]],
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
  ["partner_address_street1", "Street Address (Line 1)", ["tbxSPOUSE_ADDR_LN1"]],
  ["partner_address_street2", "Street Address (Line 2)", ["tbxSPOUSE_ADDR_LN2"]],
  ["partner_address_city", "City", ["tbxSPOUSE_ADDR_CITY"]],
  ["partner_address_state", "State/Province", ["tbxSPOUSE_ADDR_STATE"]],
  ["partner_address_zip", "Postal Zone/ZIP Code", ["tbxSPOUSE_ADDR_POSTAL_CD"]],
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
  ["ddlSPOUSE_ADDR_CNTRY"],
  { condition: "partner_address_type === other" },
);

addDate(
  "family_spouse",
  "partner_date_of_birth",
  "Partner's Date of Birth",
  "marital_status === civil_union",
  undefined,
  ["ddlDOBDay"],
  ["ddlDOBMonth"],
  ["tbxDOBYear"],
);
const deceasedDetails = [
  ["deceased_spouse_surname", "Deceased Spouse's Surnames", "text", ["tbxSURNAME"]],
  ["deceased_spouse_given_names", "Deceased Spouse's Given Names", "text", ["tbxGIVEN_NAME"]],
  ["deceased_spouse_nationality", "Deceased Spouse's Country/Region of Origin (Nationality)", "select", ["ddlSpouseNatDropDownList"]],
  ["deceased_spouse_city_of_birth", "Deceased Spouse's City of Birth", "text", ["tbxSpousePOBCity"]],
  ["deceased_spouse_country_of_birth", "Deceased Spouse's Country/Region of Birth", "select", ["ddlSpousePOBCountry"]],
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
  ["ddlDOBDay"],
  ["ddlDOBMonth"],
  ["tbxDOBYear"],
);
addField(
  "family_spouse",
  "number_of_former_spouses",
  "text",
  "Number of Former Spouses",
  ["tbxNumberOfPrevSpouses"],
  { condition: "marital_status === divorced" },
);
const formerDetails = [
  ["former_spouse_surname", "Former Spouse's Surnames", "text", ["tbxSURNAME"]],
  ["former_spouse_given_names", "Former Spouse's Given Names", "text", ["tbxGIVEN_NAME"]],
  ["former_spouse_nationality", "Former Spouse's Country/Region of Origin (Nationality)", "select", ["ddlSpouseNatDropDownList"]],
  ["former_spouse_city_of_birth", "Former Spouse's City of Birth", "text", ["tbxSpousePOBCity"]],
  ["former_spouse_country_of_birth", "Former Spouse's Country/Region of Birth", "select", ["ddlSpousePOBCountry"]],
  ["former_spouse_how_marriage_ended", "How the Marriage Ended", "textarea", ["tbxHowMarriageEnded"]],
  ["former_spouse_country_marriage_terminated", "Country/Region Marriage was Terminated", "select", ["ddlMarriageEnded_CNTRY"]],
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
  ["cbxSPOUSE_POB_CITY_NA"],
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
  ["ddlDOBDay"],
  ["ddlDOBMonth"],
  ["tbxDOBYear"],
);
addDate(
  "family_spouse",
  "former_spouse_date_of_marriage",
  "Date of Marriage",
  "marital_status === divorced",
  "former_spouses",
  ["ddlDomDay"],
  ["ddlDomMonth"],
  ["txtDomYear"],
);
addDate(
  "family_spouse",
  "former_spouse_date_marriage_ended",
  "Date Marriage Ended",
  "marital_status === divorced",
  "former_spouses",
  ["ddlDomEndDay"],
  ["ddlDomEndMonth"],
  ["txtDomEndYear"],
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
  "textarea",
  "Specify Other",
  ["tbxExplainOtherPresentOccupation", "WORK_EDUC_PRSNT_OCCP_OTHER", "PRESENT_OCCUPATION_OTHER", "OCCUPATION_OTHER_EXPLAIN"],
  { condition: "primary_occupation === other" },
);
addField(
  "work_education_present",
  "not_employed_explain",
  "textarea",
  "Explain",
  ["tbxExplainOtherPresentOccupation"],
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
  ["prev_employer_address_street1", "Street Address (Line 1)", ["tbEmployerStreetAddress1"]],
  ["prev_employer_address_street2", "Street Address (Line 2)", ["tbEmployerStreetAddress2"]],
  ["prev_employer_city", "City", ["tbEmployerCity"]],
  ["prev_employer_state", "State/Province", ["tbxPREV_EMPL_ADDR_STATE"]],
  ["prev_employer_postal", "Postal Zone/ZIP Code", ["tbxPREV_EMPL_ADDR_POSTAL_CD"]],
  ["prev_employer_phone", "Telephone Number", ["tbEmployerPhone"]],
  ["prev_job_title", "Job Title", ["tbJobTitle"]],
  ["prev_supervisor_surname", "Supervisor's Surnames", ["tbSupervisorSurname"]],
  ["prev_supervisor_given_names", "Supervisor's Given Names", ["tbSupervisorGivenName"]],
  ["prev_job_duties", "Briefly Describe Your Duties", ["tbDescribeDuties"]],
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
  ["DropDownList2"],
  { condition: "has_previous_employer === yes", repeatGroup: "previous_employers" },
);
addDate(
  "work_education_previous",
  "prev_employment_start_date",
  "Employment Date From",
  "has_previous_employer === yes",
  "previous_employers",
  ["ddlEmpDateFromDay"],
  ["ddlEmpDateFromMonth"],
  ["tbxEmpDateFromYear"],
);
addDate(
  "work_education_previous",
  "prev_employment_end_date",
  "Employment Date To",
  "has_previous_employer === yes",
  "previous_employers",
  ["ddlEmpDateToDay"],
  ["ddlEmpDateToMonth"],
  ["tbxEmpDateToYear"],
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
  ["military_country", "Country/Region", "select", ["ddlMILITARY_SVC_CNTRY"]],
  ["military_branch", "Branch of Service", "text", ["tbxMILITARY_SVC_BRANCH"]],
  ["military_rank", "Rank/Position", "text", ["tbxMILITARY_SVC_RANK"]],
  ["military_specialty", "Military Specialty", "text", ["tbxMILITARY_SVC_SPECIALTY"]],
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
  ["tbxINSURGENT_ORG_EXPL"],
  { condition: "has_served_paramilitary === yes" },
);

// ── Security and Background explanations ───────────────────────────────────
const securityExplanations: ReadonlyArray<{
  page: Extract<Ds160ExtendedPage, `security_background_${1 | 2 | 3 | 4 | 5}`>;
  number: number;
  controller: string;
  fieldName: string;
  liveToken: string;
}> = [
  { page: "security_background_1", number: 1, controller: "has_communicable_disease", fieldName: "has_communicable_disease_explain", liveToken: "tbxDisease" },
  { page: "security_background_1", number: 2, controller: "has_physical_mental_disorder", fieldName: "has_physical_mental_disorder_explain", liveToken: "tbxDisorder" },
  { page: "security_background_1", number: 3, controller: "is_drug_abuser", fieldName: "is_drug_abuser_explain", liveToken: "tbxDruguser" },
  { page: "security_background_2", number: 1, controller: "has_arrest_conviction", fieldName: "has_arrest_conviction_explain", liveToken: "tbxArrested" },
  { page: "security_background_2", number: 2, controller: "has_violated_controlled_substance", fieldName: "has_violated_controlled_substance_explain", liveToken: "tbxControlledSubstances" },
  { page: "security_background_2", number: 3, controller: "has_prostitution", fieldName: "has_prostitution_explain", liveToken: "tbxProstitution" },
  { page: "security_background_2", number: 4, controller: "has_money_laundering", fieldName: "has_money_laundering_explain", liveToken: "tbxMoneyLaundering" },
  { page: "security_background_2", number: 5, controller: "has_human_trafficking", fieldName: "has_human_trafficking_explain", liveToken: "tbxHumanTrafficking" },
  { page: "security_background_2", number: 6, controller: "has_aided_human_trafficking", fieldName: "has_aided_human_trafficking_explain", liveToken: "tbxAssistedSevereTrafficking" },
  { page: "security_background_2", number: 7, controller: "has_trafficking_beneficiary", fieldName: "has_trafficking_beneficiary_explain", liveToken: "tbxHumanTraffickingRelated" },
  { page: "security_background_3", number: 1, controller: "intend_illegal_activity", fieldName: "intend_illegal_activity_explain", liveToken: "tbxIllegalActivity" },
  { page: "security_background_3", number: 2, controller: "intend_terrorist_activity", fieldName: "intend_terrorist_activity_explain", liveToken: "tbxTerroristActivity" },
  { page: "security_background_3", number: 3, controller: "has_provided_terrorist_support", fieldName: "has_provided_terrorist_support_explain", liveToken: "tbxTerroristSupport" },
  { page: "security_background_3", number: 4, controller: "is_terrorist_member", fieldName: "is_terrorist_member_explain", liveToken: "tbxTerroristOrg" },
  { page: "security_background_3", number: 5, controller: "is_terrorist_family", fieldName: "is_terrorist_family_explain", liveToken: "tbxTerroristRel" },
  { page: "security_background_3", number: 6, controller: "has_genocide", fieldName: "has_genocide_explain", liveToken: "tbxGenocide" },
  { page: "security_background_3", number: 7, controller: "has_torture", fieldName: "has_torture_explain", liveToken: "tbxTorture" },
  { page: "security_background_3", number: 8, controller: "has_extrajudicial_killings", fieldName: "has_extrajudicial_killings_explain", liveToken: "tbxExViolence" },
  { page: "security_background_3", number: 9, controller: "has_child_soldier", fieldName: "has_child_soldier_explain", liveToken: "tbxChildSoldier" },
  { page: "security_background_3", number: 10, controller: "has_religious_freedom_violation", fieldName: "has_religious_freedom_violation_explain", liveToken: "tbxReligiousFreedom" },
  { page: "security_background_3", number: 11, controller: "has_population_control", fieldName: "has_population_control_explain", liveToken: "tbxPopulationControls" },
  { page: "security_background_3", number: 12, controller: "has_coercive_transplant", fieldName: "has_coercive_transplant_explain", liveToken: "tbxTransplant" },
  { page: "security_background_4", number: 1, controller: "has_immigration_fraud", fieldName: "has_immigration_fraud_explain", liveToken: "tbxImmigrationFraud" },
  { page: "security_background_4", number: 2, controller: "has_removal_order", fieldName: "has_removal_order_explain", liveToken: "tbxDeport_EXPL" },
  { page: "security_background_5", number: 1, controller: "has_withheld_child_custody", fieldName: "has_withheld_child_custody_explain", liveToken: "tbxChildCustody" },
  { page: "security_background_5", number: 2, controller: "has_voted_illegally", fieldName: "has_voted_illegally_explain", liveToken: "tbxVotingViolation" },
  { page: "security_background_5", number: 3, controller: "has_renounced_citizenship", fieldName: "has_renounced_citizenship_explain", liveToken: "tbxRenounceExp" },
];

for (const explanation of securityExplanations) {
  addField(
    explanation.page,
    explanation.fieldName,
    "textarea",
    "Explain",
    [explanation.liveToken],
    { condition: `${explanation.controller} === yes`, selectorMatch: "suffix" },
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
    selector: selectorFor(spec.mappingType, spec.selectorTokens, spec.label, spec.htmlTag, spec.selectorMatch),
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
