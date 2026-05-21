/**
 * UK Standard Visitor field-name → UKVI form widget mapping.
 *
 * The seed schema (`viza-be/agent-backend/scripts/seed-uk-standard-
 * visitor-form-fields.ts`) defines logical fields keyed by `field_name`
 * (e.g. "given_names", "passport_expiry_date"). The UKVI portal uses
 * different `name` attributes on its form inputs (e.g. "givenNames",
 * "expiryDate.day"). This file is the translation table.
 *
 * The map below covers the 8 pages walked in the 2026-04-25 recon
 * session (gender/relationship, address, about-property, passport,
 * identity card, nationality+DOB, other nationalities, immigration
 * status). Roughly ~40 pages remain — extend the map as those are
 * walked.
 *
 * Pre-auth fields (language, biometrics country, VAC confirm) are
 * driven by the orchestrator directly with hardcoded values, so they
 * are NOT in this map.
 */

import type { Page } from "@playwright/test";
import {
  fillTextInput,
  fillTextarea,
  fillRadio,
  fillCheckbox,
  fillSelect,
  fillIso3Select,
  fillGovukDate,
  uploadFile,
} from "./widgets";
import { UkFieldNotMappedError } from "./errors";

/** Logical widget kinds. Each maps to a filler in `widgets.ts`. */
export type UkWidgetKind =
  | "text"
  | "textarea"
  | "radio"
  | "checkbox"
  | "select"
  | "country" // ISO-3 alpha select with `_ui` autocomplete
  | "date" // govuk 3-part day/month/year (name="{base}.day" id="{base}_day")
  | "file";

export interface UkFieldDefinition {
  /** The seed `field_name` (e.g. "given_names"). */
  seedName: string;
  /** The UKVI form `name` attribute (e.g. "givenNames", "dob",
   *  "outOfCountryAddress.line1"). For dates this is the base —
   *  the filler appends `.day`/`.month`/`.year`. */
  formName: string;
  kind: UkWidgetKind;
  /** Optional value transform — e.g. seed boolean ("yes") → form
   *  boolean ("true"); seed marital code → UKVI single letter; date
   *  format DD/MM/YYYY → ISO. */
  transform?: (rawValue: string, allAnswers: Record<string, string>) => string;
}

// ── Value transforms (reusable) ─────────────────────────────────────

/** Seed encodes booleans as "yes"/"no"; UKVI radios use "true"/"false". */
const yesNoToTrueFalse = (v: string): string => {
  const s = v.trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "true") return "true";
  if (s === "no" || s === "n" || s === "false") return "false";
  return v;
};

/** Same, inverted — for `isCorrespondenceAddress`, where seed
 *  "correspondence_address_different=yes" maps to form "false" (the
 *  correspondence address is NOT the same as the home address). */
const yesNoNegated = (v: string): string => {
  const s = v.trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "true") return "false";
  if (s === "no" || s === "n" || s === "false") return "true";
  return v;
};

/** Seed "male"/"female" → UKVI numeric 1/2/9. */
const sexWordToCode = (v: string): string => {
  const s = v.trim().toLowerCase();
  if (s === "male" || s === "m") return "1";
  if (s === "female" || s === "f") return "2";
  if (s === "unspecified" || s === "x") return "9";
  return v;
};

/** Seed marital words → UKVI single-letter codes. */
const maritalWordToCode = (v: string): string => {
  const s = v.trim().toLowerCase();
  const map: Record<string, string> = {
    single: "S",
    married: "M",
    civil_partnership: "M",
    unmarried_partner: "U",
    divorced: "D",
    separated: "P",
    widowed: "W",
  };
  return map[s] ?? v;
};

/** Seed `purpose_of_visit` codes → UKVI form `purposeRef` codes.
 *  Seed has 11 values (legacy); UKVI accepts 8. */
const purposeToUkvi = (v: string): string => {
  const s = v.trim().toLowerCase();
  const map: Record<string, string> = {
    tourism: "tourism",
    visiting_family_friends: "tourism",   // collapse — sub-purpose page handles
    business: "business",
    short_study: "study",
    medical: "medicalTreatment",
    transit: "transit",
    marriage_civil_partnership: "marriage",
    ppe: "business",                       // PPE = paid engagement, slots into business path on UKVI
    academic_12m: "academic",
    organ_donor: "medicalTreatment",
    clinical_training: "academic",
  };
  return map[s] ?? v;
};

/** Seed `employment_status` ("self_employed") → UKVI form value
 *  ("self-employed" with hyphen). Other values pass through. */
const employmentStatusToUkvi = (v: string): string => {
  const s = v.trim().toLowerCase();
  if (s === "self_employed") return "self-employed";
  if (s === "homemaker" || s === "other") return "unemployed"; // UKVI has no homemaker
  return s;
};

/** Seed `owns_home` ("yes"/"no") → UKVI `ownershipCategory`.
 *  Lossy: seed can't distinguish own vs rent vs other; default no→rent. */
const ownsHomeToOwnership = (v: string): string => {
  const s = v.trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "true") return "own";
  return "rent";
};

// ── Registry ─────────────────────────────────────────────────────────
//
// Grouped by UKVI page (NOT by seed step — the form's order differs
// from the seed's step ordering). Comments mark which UKVI page
// stepIdentifier each block came from.

export const UK_FIELD_DEFINITIONS: Record<string, UkFieldDefinition> = {
  // ─── standardGenderRelationshipOOC ────────────────────────────────
  sex: {
    seedName: "sex",
    formName: "gender",
    kind: "radio",
    transform: sexWordToCode,
  },
  marital_status: {
    seedName: "marital_status",
    formName: "relationshipStatus",
    kind: "select",
    transform: maritalWordToCode,
  },

  // ─── standardAddressOoC ───────────────────────────────────────────
  home_address_line_1: { seedName: "home_address_line_1", formName: "outOfCountryAddress.line1", kind: "text" },
  home_address_line_2: { seedName: "home_address_line_2", formName: "outOfCountryAddress.line2", kind: "text" },
  home_address_city:   { seedName: "home_address_city",   formName: "outOfCountryAddress.townCity", kind: "text" },
  home_address_state:  { seedName: "home_address_state",  formName: "outOfCountryAddress.province", kind: "text" },
  home_address_postcode: { seedName: "home_address_postcode", formName: "outOfCountryAddress.postCode", kind: "text" },
  home_address_country: { seedName: "home_address_country", formName: "outOfCountryAddress.countryRef", kind: "country" },
  // Seed says "different=yes"; form asks "same=true". Negate.
  correspondence_address_different: {
    seedName: "correspondence_address_different",
    formName: "isCorrespondenceAddress",
    kind: "radio",
    transform: yesNoNegated,
  },
  correspondence_address_line_1: { seedName: "correspondence_address_line_1", formName: "otherOutOfCountryAddress.line1", kind: "text" },
  correspondence_address_city:   { seedName: "correspondence_address_city",   formName: "otherOutOfCountryAddress.townCity", kind: "text" },
  correspondence_address_country: { seedName: "correspondence_address_country", formName: "otherOutOfCountryAddress.countryRef", kind: "country" },

  // ─── standardAboutYourHomeOoC ─────────────────────────────────────
  // Seed has owns_home (yes/no radio) — collapses 3 UKVI options
  // (own/rent/other) into 2. Lossy bridge for now; add a proper
  // home_ownership field to seed (see uk-seed-additions.ts patch).
  owns_home: {
    seedName: "owns_home",
    formName: "ownershipCategory",
    kind: "radio",
    transform: ownsHomeToOwnership,
  },
  // SEED GAP: how_long_at_address (single text) → years/months split
  // is in the patch; until applied, these mappings are inert because
  // they have no source seed data.
  years_at_address:  { seedName: "years_at_address",  formName: "yearsLived",  kind: "text" },
  months_at_address: { seedName: "months_at_address", formName: "monthsLived", kind: "text" },
  home_ownership_other_details: {
    seedName: "home_ownership_other_details",
    formName: "otherCategoryDetails",
    kind: "textarea",
  },

  // ─── travelDocumentIssueDetails (passport) ────────────────────────
  passport_number: { seedName: "passport_number", formName: "travelDocumentNumber", kind: "text" },
  passport_issuing_authority: { seedName: "passport_issuing_authority", formName: "issuingCountry", kind: "text" }, // form labels this "Issuing authority" despite name="issuingCountry"
  passport_issue_date:  { seedName: "passport_issue_date",  formName: "dateOfIssue", kind: "date" },
  passport_expiry_date: { seedName: "passport_expiry_date", formName: "expiryDate", kind: "date" },

  // ─── standardIdentityCard ─────────────────────────────────────────
  has_national_id_card: {
    seedName: "has_national_id_card",
    formName: "hasValidIdCard",
    kind: "radio",
    transform: yesNoToTrueFalse,
  },
  national_id_number: { seedName: "national_id_number", formName: "nationalIdCardNo", kind: "text" },
  // SEED GAP: national_id_issuing_authority (text) — form has it,
  // seed only has national_id_issuing_country (country select).
  // Add to seed.
  // SEED GAP: national_id_issue_date, national_id_expiry_date.
  national_id_issue_date:  { seedName: "national_id_issue_date",  formName: "issueDate", kind: "date" },
  national_id_expiry_date: { seedName: "national_id_expiry_date", formName: "expiryDate", kind: "date" },
  // Note: form's identity-card "issuingAuthority" text input is named
  // identically to passport's. Different page → different value.

  // ─── standardNationalityDOBOoC ────────────────────────────────────
  // Seed name is `country_of_nationality` — NOT `nationality`.
  country_of_nationality: { seedName: "country_of_nationality", formName: "nationality",    kind: "country" },
  country_of_birth:       { seedName: "country_of_birth",       formName: "countryOfBirth", kind: "country" },
  place_of_birth:         { seedName: "place_of_birth",         formName: "placeOfBirth",   kind: "text" },
  date_of_birth:          { seedName: "date_of_birth",          formName: "dob",            kind: "date" },

  // ─── standardOtherNationality ─────────────────────────────────────
  has_other_nationalities: {
    seedName: "has_other_nationalities",
    formName: "hasOtherNationality",
    kind: "radio",
    transform: yesNoToTrueFalse,
  },
  // The repeatable other_nationality entries unfold on a separate page
  // not yet walked.

  // ─── immigrationStatus ────────────────────────────────────────────
  // SEED GAP: immigration-status fields are not in seed today. They are
  // critical for visitors-from-third-countries — applicant declares
  // their immigration status in their country of residence.
  immigration_status_in_residence_country: {
    seedName: "immigration_status_in_residence_country",
    formName: "immigrationStatusTypeRef",
    kind: "radio",
    // Form values: temporaryVisa | permanentResident | other.
    // Once seeded, options should match exactly so transform is a
    // no-op.
  },
  immigration_status_visa_expiry: {
    seedName: "immigration_status_visa_expiry",
    formName: "expirationDate",
    kind: "date",
  },
  immigration_status_pr_year: {
    seedName: "immigration_status_pr_year",
    formName: "permanentResidentDate.year",
    kind: "text",
  },
  immigration_status_other_details: {
    seedName: "immigration_status_other_details",
    formName: "additionalInformation",
    kind: "textarea",
  },

  // ─── employmentStatus (page 9) ────────────────────────────────────
  // Seed `employment_status` is single select; UKVI form is multi-checkbox.
  // For now we map the single value to the matching checkbox; if the
  // applicant needs multiple statuses (e.g. employed AND student), the
  // seed needs to be updated to a multi-checkbox first.
  employment_status: {
    seedName: "employment_status",
    formName: "status[]",        // checkbox-array — filler for this kind TBD
    kind: "checkbox",            // current widget treats as single boolean; widget upgrade pending
    transform: employmentStatusToUkvi,
  },

  // ─── fundingEmploymentEmployerDetails (page 10) ──────────────────
  employer_name: { seedName: "employer_name", formName: "employer", kind: "text" },
  // SEED GAP: employer_address is a single textarea in seed; UKVI splits
  // into 6+ fields. Once seed is patched these mappings activate.
  employer_address_line_1:  { seedName: "employer_address_line_1",  formName: "address.line1",      kind: "text" },
  employer_address_line_2:  { seedName: "employer_address_line_2",  formName: "address.line2",      kind: "text" },
  employer_address_city:    { seedName: "employer_address_city",    formName: "address.townCity",   kind: "text" },
  employer_address_state:   { seedName: "employer_address_state",   formName: "address.province",   kind: "text" },
  employer_address_postcode:{ seedName: "employer_address_postcode",formName: "address.postalCode", kind: "text" },
  employer_address_country: { seedName: "employer_address_country", formName: "address.countryRef", kind: "country" },
  // SEED GAP: phone splits — seed has single `employer_phone` text.
  employer_phone_code:   { seedName: "employer_phone_code",   formName: "phone.code",   kind: "text" },
  employer_phone_number: { seedName: "employer_phone_number", formName: "phone.number", kind: "text" },
  // SEED GAP: jobStartDate (month+year only — partial date)
  job_start_month: { seedName: "job_start_month", formName: "jobStartDate.month", kind: "text" },
  job_start_year:  { seedName: "job_start_year",  formName: "jobStartDate.year",  kind: "text" },

  // ─── fundingEmploymentJobDetails (page 11) ───────────────────────
  job_title: { seedName: "job_title", formName: "jobTitle", kind: "text" },
  // SEED GAP: monthly_earnings split into currency + amount. Until
  // seed patched, these are inert.
  monthly_earnings_currency: { seedName: "monthly_earnings_currency", formName: "earnings.currencyRef", kind: "select" },
  monthly_earnings_amount:   { seedName: "monthly_earnings_amount",   formName: "earnings.amount",      kind: "text" },
  job_description: { seedName: "job_description", formName: "jobDescription", kind: "textarea" },

  // ─── fundingOtherIncome (page 12) ────────────────────────────────
  // SEED GAP: most income/savings details are not seeded with
  // sufficient granularity. The opt-out boolean is the easiest entry
  // point: if user has no other income, set hasNoOtherIncome=true.
  has_other_income_or_savings: {
    seedName: "has_other_income_or_savings",
    formName: "hasNoOtherIncome",
    kind: "checkbox",
    // Seed yes=has income → form opt-out should be FALSE (don't tick).
    // Seed no=no other income → form opt-out should be TRUE (tick the box).
    transform: yesNoNegated,
  },

  // ─── plannedSpendOnVisitToUK (page 13) ───────────────────────────
  planned_spend_currency: { seedName: "planned_spend_currency", formName: "value.currencyRef", kind: "select" },
  planned_spend_amount:   { seedName: "planned_spend_amount",   formName: "value.amount",      kind: "text" },

  // ─── monthlyOutgoings (page 14) ──────────────────────────────────
  // Note: same `value.currencyRef`/`value.amount` field pair on this page;
  // page detection (action suffix) disambiguates from page 13. Both seed
  // names mapped to the same form names — orchestrator drives one per page.
  monthly_outgoings_currency: { seedName: "monthly_outgoings_currency", formName: "value.currencyRef", kind: "select" },
  monthly_outgoings_amount:   { seedName: "monthly_outgoings_amount",   formName: "value.amount",      kind: "text" },

  // ─── payingForYourVisit (page 15) ────────────────────────────────
  someone_paying_for_visit: {
    seedName: "someone_paying_for_visit",
    formName: "value",
    kind: "radio",
    transform: yesNoToTrueFalse,
  },

  // ─── odwPlannedTravelInformation (page 16) ───────────────────────
  uk_arrival_date:   { seedName: "uk_arrival_date",   formName: "dateOfArrival", kind: "date" },
  uk_departure_date: { seedName: "uk_departure_date", formName: "dateOfLeave",   kind: "date" },

  // ─── spokenLanguagePreference (page 17) ──────────────────────────
  spoken_language_preference: {
    seedName: "spoken_language_preference",
    formName: "preferredLanguage",
    kind: "radio",
    // Seed values likely "english"/"other" matching form. Pass-through.
  },
  spoken_language_other_details: { seedName: "spoken_language_other_details", formName: "details", kind: "text" },

  // ─── purposeOfVisitForVV (page 18) ───────────────────────────────
  // Seed has 11 legacy values; UKVI accepts 8. Map via purposeToUkvi.
  purpose_of_visit: {
    seedName: "purpose_of_visit",
    formName: "purposeRef",
    kind: "radio",
    transform: purposeToUkvi,
  },

  // ─── purposeOfTourismVisitForVV (page 19) ────────────────────────
  // Conditional sub-purpose, only when purpose_of_visit collapses to
  // tourism. Seed value `visiting_family_friends` → derive form value.
  tourism_sub_purpose: {
    seedName: "tourism_sub_purpose",
    formName: "purposeRef",
    kind: "radio",
    // Seed values when added: tourist | visiting_family | visiting_friends.
    // UKVI expects: tourist | visitingFamily | visitingFriends. Hyphenate→camel.
    transform: (v: string) => {
      const s = v.trim().toLowerCase();
      if (s === "visiting_family") return "visitingFamily";
      if (s === "visiting_friends") return "visitingFriends";
      return s;
    },
  },
};

// ── Dispatcher ──────────────────────────────────────────────────────

/** Fill a single seed-named field on the current page.
 *
 *  - Looks up the field in `UK_FIELD_DEFINITIONS`.
 *  - Applies any value `transform`.
 *  - Dispatches to the matching widget filler.
 *  - Throws `UkFieldNotMappedError` if the field has no entry yet.
 *  - Returns silently when `value` is empty (skipped optional field). */
export async function fillField(
  page: Page,
  seedName: string,
  value: string,
  allAnswers: Record<string, string>,
): Promise<void> {
  if (!value) return;

  const def = UK_FIELD_DEFINITIONS[seedName];
  if (!def) throw new UkFieldNotMappedError(seedName);

  const v = def.transform ? def.transform(value, allAnswers) : value;

  switch (def.kind) {
    case "text":     return fillTextInput(page, def.formName, v);
    case "textarea": return fillTextarea(page, def.formName, v);
    case "radio":    return fillRadio(page, def.formName, v);
    case "checkbox": return fillCheckbox(page, def.formName, v);
    case "select":   return fillSelect(page, def.formName, v);
    case "country":  return fillIso3Select(page, def.formName, v);
    case "date":     return fillGovukDate(page, def.formName, v);
    case "file":     return uploadFile(page, def.formName, v);
  }
}

/** Fill every mapped field whose seed name is present in the answer
 *  set AND in UK_FIELD_DEFINITIONS. Unknown fields are reported via
 *  `unmapped` rather than throwing, so a single missing definition
 *  doesn't abort the page. The caller decides whether `unmapped` is a
 *  hard error (early development) or soft warning (production with
 *  optional new fields). */
export async function fillKnownFields(
  page: Page,
  answers: Record<string, string>,
): Promise<{ filled: string[]; unmapped: string[] }> {
  const filled: string[] = [];
  const unmapped: string[] = [];

  for (const [seedName, value] of Object.entries(answers)) {
    if (!value) continue;
    const def = UK_FIELD_DEFINITIONS[seedName];
    if (!def) {
      unmapped.push(seedName);
      continue;
    }
    await fillField(page, seedName, value, answers);
    filled.push(seedName);
  }

  return { filled, unmapped };
}
