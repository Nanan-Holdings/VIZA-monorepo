/**
 * Seed script: applicant-answer schema for Canada tourist Temporary Resident
 * Visa (TRV), visa_type `CA_TRV`.
 *
 * This is a public-source reconstruction of IRCC IMM 5257 and the family form
 * currently selected by Canada's country packages, IMM 5707. Chinese-citizen
 * applicants also receive the answer fields from IMM 0104. The authenticated
 * IRCC Portal/Secure Account journey still requires a live-portal QA pass, so
 * selectors, portal page order, and personalized checklist variations are not
 * asserted here.
 *
 * Product boundaries:
 * - Tourism is fixed by the package; it is not an applicant choice.
 * - IRCC decides whether an issued TRV is single- or multiple-entry.
 * - eTA is a separate authorization and must use a future `CA_ETA` package.
 * - Files belong to application_documents, never visa_form_fields.
 * - IRCC credentials, invite codes, OTPs, and sessions are VIZA-managed and
 *   must never be represented as applicant answers.
 *
 * Run: npx tsx scripts/seed-ca-trv-form-fields.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { toBilingualSeedRow } from "./bilingual-seed-row";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VISA_TYPE = "CA_TRV";

interface FieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: Array<{ value: string; text: string }>;
  conditional_logic?: Record<string, unknown>;
}

type StepField = Omit<FieldDef, "step_number" | "step_name" | "display_order">;

const YES_NO = [
  { value: "yes", text: "Yes" },
  { value: "no", text: "No" },
];

const SEX_OPTIONS = [
  { value: "female", text: "Female" },
  { value: "male", text: "Male" },
  { value: "unknown", text: "Unknown" },
  { value: "another", text: "Another gender" },
];

const MARITAL_STATUS_OPTIONS = [
  { value: "annulled", text: "Annulled marriage" },
  { value: "common_law", text: "Common-law" },
  { value: "divorced", text: "Divorced" },
  { value: "married", text: "Married" },
  { value: "separated", text: "Legally separated" },
  { value: "single", text: "Never married / Single" },
  { value: "widowed", text: "Widowed" },
];

const RESIDENCE_STATUS_OPTIONS = [
  { value: "citizen", text: "Citizen" },
  { value: "permanent_resident", text: "Permanent resident" },
  { value: "visitor", text: "Visitor" },
  { value: "worker", text: "Worker" },
  { value: "student", text: "Student" },
  { value: "protected_person", text: "Protected person" },
  { value: "refugee_claimant", text: "Refugee claimant" },
  { value: "other", text: "Other" },
];

const LANGUAGE_ABILITY_OPTIONS = [
  { value: "english", text: "English" },
  { value: "french", text: "French" },
  { value: "both", text: "English and French" },
  { value: "neither", text: "Neither" },
];

const PHONE_LOCATION_OPTIONS = [
  { value: "canada_us", text: "Canada / United States" },
  { value: "other", text: "Other" },
];

const PHONE_TYPE_OPTIONS = [
  { value: "residence", text: "Residence" },
  { value: "cellular", text: "Cellular" },
  { value: "business", text: "Business" },
];

const FAMILY_MARITAL_OPTIONS = [
  ...MARITAL_STATUS_OPTIONS,
  { value: "conjugal", text: "Conjugal partner" },
];

const HAS_OTHER_NAMES = "has_other_names_used === yes";
const HAS_PRIOR_RESIDENCE = "has_prior_residence === yes";
const APPLYING_ELSEWHERE = "applying_from_current_residence === no";
const HAS_FORMER_PARTNER = "has_former_spouse_or_partner === yes";
const CURRENTLY_PARTNERED = "marital_status === married || marital_status === common_law";
const STATUS_OTHER = "current_residence_status === other";
const APPLICATION_STATUS_OTHER = "application_country_status === other";
const PRIOR_STATUS_OTHER = "prior_residence_status === other";
const HAS_NATIONAL_ID = "has_national_identity_document === yes";
const IS_US_PERMANENT_RESIDENT = "is_us_permanent_resident === yes";
const HAS_POST_SECONDARY = "has_post_secondary_education === yes";
const HAS_MILITARY_SERVICE = "background_military_service === yes";
const HAS_CHILDREN = "imm5707_has_children === yes";
const HAS_NO_CHILDREN = "imm5707_has_children === no";
const HAS_FAMILY_PARTNER = "imm5707_has_spouse_or_partner === yes";
const HAS_NO_FAMILY_PARTNER = "imm5707_has_spouse_or_partner === no";
const FAMILY_APPLICANT_MARRIED = "imm5707_applicant_marital_status === married";
const FAMILY_PARTNER_MARRIED = "imm5707_partner_marital_status === married";
const IS_CHINESE_CITIZEN = "country_of_citizenship === China";
const CHINA_HAS_TRAVEL = "country_of_citizenship === China && china_first_trip_outside_china === no";

function defineStep(
  stepNumber: number,
  stepName: string,
  sourceDocument: "IMM 5257" | "IMM 5707" | "IMM 0104",
  fields: StepField[],
): FieldDef[] {
  return fields.map((field, index) => ({
    ...field,
    step_number: stepNumber,
    step_name: stepName,
    display_order: index + 1,
    validation_rules: {
      source_document: sourceDocument,
      source_confidence: "high_public_form_reconstruction",
      live_portal_qa: "pending",
      ...(field.validation_rules ?? {}),
    },
  }));
}

function repeat(group: string, maxItems = 20): Record<string, unknown> {
  return { repeatable: true, repeat_group: group, max_items: maxItems };
}

function dateRules(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { format: "YYYY-MM-DD", ...extra };
}

function monthYearRules(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { format: "MM-YYYY", pattern: "^(0[1-9]|1[0-2])-\\d{4}$", ...extra };
}

function addressFields(prefix: string, required: boolean): StepField[] {
  const group = `${prefix}_address`;
  return [
    { field_name: `${prefix}_po_box`, label: "P.O. box", field_type: "text", required: false, validation_rules: { maxLength: 20, block_group: group } },
    { field_name: `${prefix}_apartment_unit`, label: "Apartment / Unit", field_type: "text", required: false, validation_rules: { maxLength: 20, block_group: group } },
    { field_name: `${prefix}_street_number`, label: "Street number", field_type: "text", required, validation_rules: { maxLength: 20, block_group: group } },
    { field_name: `${prefix}_street_name`, label: "Street name", field_type: "text", required, validation_rules: { maxLength: 100, block_group: group } },
    { field_name: `${prefix}_city`, label: "City / Town", field_type: "text", required, validation_rules: { maxLength: 60, block_group: group } },
    { field_name: `${prefix}_country`, label: "Country or territory", field_type: "country", required, validation_rules: { source: "ISO3166-1", block_group: group } },
    { field_name: `${prefix}_province_state`, label: "Province / State", field_type: "text", required: false, validation_rules: { maxLength: 60, block_group: group } },
    { field_name: `${prefix}_postal_code`, label: "Postal / ZIP code", field_type: "text", required: false, validation_rules: { maxLength: 20, block_group: group } },
    { field_name: `${prefix}_district`, label: "District", field_type: "text", required: false, validation_rules: { maxLength: 60, block_group: group } },
  ];
}

function familyPersonFields(
  prefix: string,
  label: string,
  conditional?: string,
): StepField[] {
  const condition = conditional ? { conditional_logic: { showIf: conditional } } : {};
  const block = `imm5707_${prefix}`;
  return [
    { field_name: `imm5707_${prefix}_family_name`, label: `${label} — Family name`, field_type: "text", required: true, ...condition, validation_rules: { maxLength: 50, block_group: block } },
    { field_name: `imm5707_${prefix}_given_names`, label: `${label} — Given name(s)`, field_type: "text", required: false, ...condition, validation_rules: { maxLength: 80, block_group: block } },
    { field_name: `imm5707_${prefix}_name_native_script`, label: `${label} — Full name in native script`, field_type: "text", required: true, ...condition, validation_rules: { maxLength: 120, block_group: block } },
    { field_name: `imm5707_${prefix}_date_of_birth`, label: `${label} — Date of birth`, field_type: "date", required: true, ...condition, validation_rules: dateRules({ allow_unknown_components: true, official_unknown_marker: "*", block_group: block }) },
    { field_name: `imm5707_${prefix}_country_of_birth`, label: `${label} — Country or territory of birth`, field_type: "country", required: true, ...condition, validation_rules: { source: "ISO3166-1", block_group: block } },
    { field_name: `imm5707_${prefix}_marital_status`, label: `${label} — Marital status`, field_type: "select", required: true, ...condition, options: FAMILY_MARITAL_OPTIONS, validation_rules: { block_group: block } },
    { field_name: `imm5707_${prefix}_present_address`, label: `${label} — Present address`, field_type: "textarea", required: true, ...condition, validation_rules: { maxLength: 250, block_group: block } },
    { field_name: `imm5707_${prefix}_occupation`, label: `${label} — Present occupation`, field_type: "text", required: true, ...condition, validation_rules: { maxLength: 100, block_group: block } },
    { field_name: `imm5707_${prefix}_accompanying`, label: `${label} — Will accompany you to Canada`, field_type: "radio", required: true, ...condition, options: YES_NO, validation_rules: { block_group: block } },
  ];
}

const FIELDS: FieldDef[] = [
  ...defineStep(1, "Application & Personal Details", "IMM 5257", [
    { field_name: "uci", label: "Unique client identifier (UCI), if known", field_type: "text", required: false, validation_rules: { maxLength: 10 } },
    { field_name: "service_language", label: "Language in which you want service", field_type: "radio", required: true, options: [{ value: "english", text: "English" }, { value: "french", text: "French" }] },
    { field_name: "family_name", label: "Family name", field_type: "text", required: true, validation_rules: { maxLength: 50 } },
    { field_name: "given_names", label: "Given name(s)", field_type: "text", required: false, placeholder: "Leave blank only if your travel document has no given name", validation_rules: { maxLength: 80 } },
    { field_name: "has_other_names_used", label: "Have you ever used any other name?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "other_family_name", label: "Other name used — Family name", field_type: "text", required: true, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 50, ...repeat("other_names", 10) } },
    { field_name: "other_given_names", label: "Other name used — Given name(s)", field_type: "text", required: false, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 80, ...repeat("other_names", 10) } },
    { field_name: "sex", label: "Sex", field_type: "select", required: true, options: SEX_OPTIONS },
    { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, validation_rules: dateRules({ allow_unknown_components: true, official_unknown_marker: "*" }) },
    { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, validation_rules: { maxLength: 60, inline_group: "place_of_birth" } },
    { field_name: "place_of_birth_country", label: "Place of birth — Country or territory", field_type: "country", required: true, validation_rules: { source: "ISO3166-1", inline_group: "place_of_birth" } },
    { field_name: "country_of_citizenship", label: "Country or territory of citizenship", field_type: "country", required: true, validation_rules: { source: "ISO3166-1" } },
  ]),

  ...defineStep(2, "Residence, Relationships & Languages", "IMM 5257", [
    { field_name: "current_residence_country", label: "Current country or territory of residence", field_type: "country", required: true, validation_rules: { source: "ISO3166-1", block_group: "current_residence" } },
    { field_name: "current_residence_status", label: "Status in current country or territory", field_type: "select", required: true, options: RESIDENCE_STATUS_OPTIONS, validation_rules: { block_group: "current_residence" } },
    { field_name: "current_residence_status_other", label: "Other current residence status", field_type: "text", required: true, conditional_logic: { showIf: STATUS_OTHER }, validation_rules: { maxLength: 60, block_group: "current_residence" } },
    { field_name: "current_residence_from", label: "Current residence — From", field_type: "date", required: true, validation_rules: dateRules({ inline_group: "current_residence_dates", block_group: "current_residence" }) },
    { field_name: "current_residence_to", label: "Current residence — To", field_type: "date", required: false, validation_rules: dateRules({ inline_group: "current_residence_dates", block_group: "current_residence", allow_present: true }) },
    { field_name: "has_prior_residence", label: "During the past five years, have you lived in another country or territory for more than six months?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "prior_residence_country", label: "Previous residence — Country or territory", field_type: "country", required: true, conditional_logic: { showIf: HAS_PRIOR_RESIDENCE }, validation_rules: { source: "ISO3166-1", block_group: "prior_residence", ...repeat("prior_residences", 10) } },
    { field_name: "prior_residence_status", label: "Previous residence — Status", field_type: "select", required: true, conditional_logic: { showIf: HAS_PRIOR_RESIDENCE }, options: RESIDENCE_STATUS_OPTIONS, validation_rules: { block_group: "prior_residence", ...repeat("prior_residences", 10) } },
    { field_name: "prior_residence_status_other", label: "Previous residence — Other status", field_type: "text", required: true, conditional_logic: { showIf: `${HAS_PRIOR_RESIDENCE} && ${PRIOR_STATUS_OTHER}` }, validation_rules: { maxLength: 60, block_group: "prior_residence", ...repeat("prior_residences", 10) } },
    { field_name: "prior_residence_from", label: "Previous residence — From", field_type: "date", required: true, conditional_logic: { showIf: HAS_PRIOR_RESIDENCE }, validation_rules: dateRules({ block_group: "prior_residence", inline_group: "prior_residence_dates", ...repeat("prior_residences", 10) }) },
    { field_name: "prior_residence_to", label: "Previous residence — To", field_type: "date", required: true, conditional_logic: { showIf: HAS_PRIOR_RESIDENCE }, validation_rules: dateRules({ block_group: "prior_residence", inline_group: "prior_residence_dates", ...repeat("prior_residences", 10) }) },
    { field_name: "applying_from_current_residence", label: "Are you applying from your current country or territory of residence?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "application_country", label: "Country or territory where you are applying", field_type: "country", required: true, conditional_logic: { showIf: APPLYING_ELSEWHERE }, validation_rules: { source: "ISO3166-1", block_group: "application_country_status" } },
    { field_name: "application_country_status", label: "Status in the country or territory where you are applying", field_type: "select", required: true, conditional_logic: { showIf: APPLYING_ELSEWHERE }, options: RESIDENCE_STATUS_OPTIONS, validation_rules: { block_group: "application_country_status" } },
    { field_name: "application_country_status_other", label: "Other status in application country", field_type: "text", required: true, conditional_logic: { showIf: `${APPLYING_ELSEWHERE} && ${APPLICATION_STATUS_OTHER}` }, validation_rules: { maxLength: 60, block_group: "application_country_status" } },
    { field_name: "application_country_status_from", label: "Application country status — From", field_type: "date", required: true, conditional_logic: { showIf: APPLYING_ELSEWHERE }, validation_rules: dateRules({ inline_group: "application_country_status_dates", block_group: "application_country_status" }) },
    { field_name: "application_country_status_to", label: "Application country status — To", field_type: "date", required: false, conditional_logic: { showIf: APPLYING_ELSEWHERE }, validation_rules: dateRules({ inline_group: "application_country_status_dates", block_group: "application_country_status", allow_present: true }) },
    { field_name: "marital_status", label: "Current marital status", field_type: "select", required: true, options: MARITAL_STATUS_OPTIONS },
    { field_name: "current_relationship_start_date", label: "Date current marriage or common-law relationship began", field_type: "date", required: true, conditional_logic: { showIf: CURRENTLY_PARTNERED }, validation_rules: dateRules({ block_group: "current_relationship" }) },
    { field_name: "current_partner_family_name", label: "Spouse or common-law partner — Family name", field_type: "text", required: true, conditional_logic: { showIf: CURRENTLY_PARTNERED }, validation_rules: { maxLength: 50, block_group: "current_relationship" } },
    { field_name: "current_partner_given_names", label: "Spouse or common-law partner — Given name(s)", field_type: "text", required: false, conditional_logic: { showIf: CURRENTLY_PARTNERED }, validation_rules: { maxLength: 80, block_group: "current_relationship" } },
    { field_name: "has_former_spouse_or_partner", label: "Have you previously been married or in a common-law relationship?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "former_partner_family_name", label: "Former spouse or partner — Family name", field_type: "text", required: true, conditional_logic: { showIf: HAS_FORMER_PARTNER }, validation_rules: { maxLength: 50, block_group: "former_partner", ...repeat("former_partners", 10) } },
    { field_name: "former_partner_given_names", label: "Former spouse or partner — Given name(s)", field_type: "text", required: false, conditional_logic: { showIf: HAS_FORMER_PARTNER }, validation_rules: { maxLength: 80, block_group: "former_partner", ...repeat("former_partners", 10) } },
    { field_name: "former_partner_date_of_birth", label: "Former spouse or partner — Date of birth", field_type: "date", required: true, conditional_logic: { showIf: HAS_FORMER_PARTNER }, validation_rules: dateRules({ block_group: "former_partner", ...repeat("former_partners", 10) }) },
    { field_name: "former_relationship_type", label: "Former relationship type", field_type: "radio", required: true, conditional_logic: { showIf: HAS_FORMER_PARTNER }, options: [{ value: "married", text: "Married" }, { value: "common_law", text: "Common-law" }], validation_rules: { block_group: "former_partner", ...repeat("former_partners", 10) } },
    { field_name: "former_relationship_from", label: "Former relationship — From", field_type: "date", required: true, conditional_logic: { showIf: HAS_FORMER_PARTNER }, validation_rules: dateRules({ inline_group: "former_relationship_dates", block_group: "former_partner", ...repeat("former_partners", 10) }) },
    { field_name: "former_relationship_to", label: "Former relationship — To", field_type: "date", required: true, conditional_logic: { showIf: HAS_FORMER_PARTNER }, validation_rules: dateRules({ inline_group: "former_relationship_dates", block_group: "former_partner", ...repeat("former_partners", 10) }) },
    { field_name: "mother_tongue", label: "Native language / Mother tongue", field_type: "text", required: true, validation_rules: { maxLength: 60 } },
    { field_name: "english_french_ability", label: "Can you communicate in English and/or French?", field_type: "radio", required: true, options: LANGUAGE_ABILITY_OPTIONS },
    { field_name: "correspondence_language", label: "Language of correspondence", field_type: "radio", required: true, options: [{ value: "english", text: "English" }, { value: "french", text: "French" }] },
    { field_name: "has_language_test", label: "Have you taken a test from a designated testing agency to assess your English or French?", field_type: "radio", required: true, options: YES_NO },
  ]),

  ...defineStep(3, "Passport & Identity Documents", "IMM 5257", [
    { field_name: "passport_number", label: "Passport or travel document number", field_type: "text", required: true, validation_rules: { maxLength: 20 } },
    { field_name: "passport_issuing_country", label: "Country or territory of issue", field_type: "country", required: true, validation_rules: { source: "ISO3166-1" } },
    { field_name: "passport_issue_date", label: "Issue date", field_type: "date", required: true, validation_rules: dateRules({ inline_group: "passport_dates" }) },
    { field_name: "passport_expiry_date", label: "Expiry date", field_type: "date", required: true, validation_rules: dateRules({ inline_group: "passport_dates" }) },
    { field_name: "taiwan_mfa_passport", label: "For this trip, will you use a passport issued by the Ministry of Foreign Affairs in Taiwan that includes your personal identification number?", field_type: "radio", required: true, conditional_logic: { showIf: "country_of_citizenship === Taiwan" }, options: YES_NO },
    { field_name: "israeli_national_passport", label: "For this trip, will you use a national Israeli passport?", field_type: "radio", required: true, conditional_logic: { showIf: "country_of_citizenship === Israel" }, options: YES_NO },
    { field_name: "has_national_identity_document", label: "Do you have a national identity document?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "national_identity_number", label: "National identity document number", field_type: "text", required: true, conditional_logic: { showIf: HAS_NATIONAL_ID }, validation_rules: { maxLength: 30, block_group: "national_identity" } },
    { field_name: "national_identity_country", label: "National identity document — Country or territory of issue", field_type: "country", required: true, conditional_logic: { showIf: HAS_NATIONAL_ID }, validation_rules: { source: "ISO3166-1", block_group: "national_identity" } },
    { field_name: "national_identity_issue_date", label: "National identity document — Issue date", field_type: "date", required: false, conditional_logic: { showIf: HAS_NATIONAL_ID }, validation_rules: dateRules({ inline_group: "national_identity_dates", block_group: "national_identity" }) },
    { field_name: "national_identity_expiry_date", label: "National identity document — Expiry date", field_type: "date", required: false, conditional_logic: { showIf: HAS_NATIONAL_ID }, validation_rules: dateRules({ inline_group: "national_identity_dates", block_group: "national_identity" }) },
    { field_name: "is_us_permanent_resident", label: "Are you a lawful permanent resident of the United States with a valid alien registration card (Green Card)?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "us_green_card_number", label: "United States Green Card document number", field_type: "text", required: true, conditional_logic: { showIf: IS_US_PERMANENT_RESIDENT }, validation_rules: { maxLength: 30, block_group: "us_permanent_resident" } },
    { field_name: "us_green_card_expiry_date", label: "United States Green Card expiry date", field_type: "date", required: true, conditional_logic: { showIf: IS_US_PERMANENT_RESIDENT }, validation_rules: dateRules({ block_group: "us_permanent_resident" }) },
  ]),

  ...defineStep(4, "Contact Information", "IMM 5257", [
    ...addressFields("mailing", true),
    { field_name: "residential_same_as_mailing", label: "Is your residential address the same as your mailing address?", field_type: "radio", required: true, options: YES_NO },
    ...addressFields("residential", true).map((field) => ({ ...field, conditional_logic: { showIf: "residential_same_as_mailing === no" } })),
    { field_name: "primary_phone_location", label: "Primary telephone — Location", field_type: "radio", required: true, options: PHONE_LOCATION_OPTIONS, validation_rules: { block_group: "primary_phone" } },
    { field_name: "primary_phone_type", label: "Primary telephone — Type", field_type: "select", required: true, options: PHONE_TYPE_OPTIONS, validation_rules: { block_group: "primary_phone" } },
    { field_name: "primary_phone_number", label: "Primary telephone — Number", field_type: "text", required: true, validation_rules: { maxLength: 30, block_group: "primary_phone" } },
    { field_name: "primary_phone_extension", label: "Primary telephone — Extension", field_type: "text", required: false, validation_rules: { maxLength: 10, block_group: "primary_phone" } },
    { field_name: "has_alternate_phone", label: "Do you have an alternate telephone number?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "alternate_phone_location", label: "Alternate telephone — Location", field_type: "radio", required: true, conditional_logic: { showIf: "has_alternate_phone === yes" }, options: PHONE_LOCATION_OPTIONS, validation_rules: { block_group: "alternate_phone" } },
    { field_name: "alternate_phone_type", label: "Alternate telephone — Type", field_type: "select", required: true, conditional_logic: { showIf: "has_alternate_phone === yes" }, options: PHONE_TYPE_OPTIONS, validation_rules: { block_group: "alternate_phone" } },
    { field_name: "alternate_phone_number", label: "Alternate telephone — Number", field_type: "text", required: true, conditional_logic: { showIf: "has_alternate_phone === yes" }, validation_rules: { maxLength: 30, block_group: "alternate_phone" } },
    { field_name: "alternate_phone_extension", label: "Alternate telephone — Extension", field_type: "text", required: false, conditional_logic: { showIf: "has_alternate_phone === yes" }, validation_rules: { maxLength: 10, block_group: "alternate_phone" } },
    { field_name: "has_fax", label: "Do you have a fax number?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "fax_location", label: "Fax — Location", field_type: "radio", required: true, conditional_logic: { showIf: "has_fax === yes" }, options: PHONE_LOCATION_OPTIONS, validation_rules: { block_group: "fax" } },
    { field_name: "fax_number", label: "Fax number", field_type: "text", required: true, conditional_logic: { showIf: "has_fax === yes" }, validation_rules: { maxLength: 30, block_group: "fax" } },
    { field_name: "email_address", label: "Email address", field_type: "text", required: true, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },
  ]),

  ...defineStep(5, "Details of Visit to Canada", "IMM 5257", [
    { field_name: "visit_details", label: "Describe what you plan to do in Canada", field_type: "textarea", required: true, placeholder: "Tourism is fixed by this visa package", validation_rules: { maxLength: 500 } },
    { field_name: "intended_stay_from", label: "Intended stay — From", field_type: "date", required: true, validation_rules: dateRules({ inline_group: "intended_stay_dates" }) },
    { field_name: "intended_stay_to", label: "Intended stay — To", field_type: "date", required: true, validation_rules: dateRules({ inline_group: "intended_stay_dates" }) },
    { field_name: "available_funds_cad", label: "Funds available for your stay (CAD)", field_type: "text", required: true, validation_rules: { pattern: "^\\d+(?:\\.\\d{1,2})?$", maxLength: 12 } },
    { field_name: "canada_contact_name", label: "Person or institution you will visit — Name", field_type: "text", required: false, validation_rules: { maxLength: 120, block_group: "canada_contacts", ...repeat("canada_contacts", 20) } },
    { field_name: "canada_contact_relationship", label: "Relationship to you", field_type: "text", required: false, validation_rules: { maxLength: 80, block_group: "canada_contacts", ...repeat("canada_contacts", 20) } },
    { field_name: "canada_contact_address", label: "Address in Canada", field_type: "textarea", required: false, validation_rules: { maxLength: 250, block_group: "canada_contacts", ...repeat("canada_contacts", 20) } },
  ]),

  ...defineStep(6, "Education & Employment", "IMM 5257", [
    { field_name: "has_post_secondary_education", label: "Have you had any post-secondary education, including university, college, or apprenticeship training?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "education_from", label: "Highest post-secondary education — From", field_type: "text", required: true, conditional_logic: { showIf: HAS_POST_SECONDARY }, validation_rules: monthYearRules({ inline_group: "education_dates", block_group: "education" }) },
    { field_name: "education_to", label: "Highest post-secondary education — To", field_type: "text", required: true, conditional_logic: { showIf: HAS_POST_SECONDARY }, validation_rules: monthYearRules({ inline_group: "education_dates", block_group: "education" }) },
    { field_name: "education_field_of_study", label: "Field of study", field_type: "text", required: true, conditional_logic: { showIf: HAS_POST_SECONDARY }, validation_rules: { maxLength: 100, block_group: "education" } },
    { field_name: "education_school_name", label: "School or facility name", field_type: "text", required: true, conditional_logic: { showIf: HAS_POST_SECONDARY }, validation_rules: { maxLength: 120, block_group: "education" } },
    { field_name: "education_city", label: "City or town", field_type: "text", required: true, conditional_logic: { showIf: HAS_POST_SECONDARY }, validation_rules: { maxLength: 60, block_group: "education" } },
    { field_name: "education_country", label: "Country or territory", field_type: "country", required: true, conditional_logic: { showIf: HAS_POST_SECONDARY }, validation_rules: { source: "ISO3166-1", block_group: "education" } },
    { field_name: "education_province_state", label: "Province or state", field_type: "text", required: false, conditional_logic: { showIf: HAS_POST_SECONDARY }, validation_rules: { maxLength: 60, block_group: "education" } },
    { field_name: "activity_from", label: "Employment or activity — From", field_type: "text", required: true, validation_rules: monthYearRules({ inline_group: "activity_dates", block_group: "activity_history", ...repeat("activity_history", 30) }) },
    { field_name: "activity_to", label: "Employment or activity — To", field_type: "text", required: true, placeholder: "Use the current month for an ongoing activity", validation_rules: monthYearRules({ inline_group: "activity_dates", block_group: "activity_history", ...repeat("activity_history", 30) }) },
    { field_name: "activity_occupation_title", label: "Occupation or activity / Job title", field_type: "text", required: true, validation_rules: { maxLength: 100, block_group: "activity_history", ...repeat("activity_history", 30) } },
    { field_name: "activity_employer_facility", label: "Company, employer, school, or facility", field_type: "text", required: true, validation_rules: { maxLength: 120, block_group: "activity_history", ...repeat("activity_history", 30) } },
    { field_name: "activity_city", label: "City or town", field_type: "text", required: true, validation_rules: { maxLength: 60, block_group: "activity_history", ...repeat("activity_history", 30) } },
    { field_name: "activity_country", label: "Country or territory", field_type: "country", required: true, validation_rules: { source: "ISO3166-1", block_group: "activity_history", ...repeat("activity_history", 30) } },
    { field_name: "activity_province_state", label: "Province or state", field_type: "text", required: false, validation_rules: { maxLength: 60, block_group: "activity_history", ...repeat("activity_history", 30) } },
  ]),

  ...defineStep(7, "Background Information", "IMM 5257", [
    { field_name: "background_tb_exposure", label: "Within the past two years, have you or a family member had tuberculosis of the lungs, or been in close contact with a person with tuberculosis?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "background_tb_exposure_details", label: "Tuberculosis exposure — Details", field_type: "textarea", required: true, conditional_logic: { showIf: "background_tb_exposure === yes" }, validation_rules: { maxLength: 1500 } },
    { field_name: "background_health_services", label: "Do you have any physical or mental disorder that would require social and/or health services, other than medication, during a stay in Canada?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "background_health_services_details", label: "Physical or mental condition — Details", field_type: "textarea", required: true, conditional_logic: { showIf: "background_health_services === yes" }, validation_rules: { maxLength: 1500 } },
    { field_name: "background_canada_status_violation", label: "Have you ever remained beyond the validity of your status, attended school without authorization, or worked without authorization in Canada?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "background_canada_status_violation_details", label: "Canada status violation — Details", field_type: "textarea", required: true, conditional_logic: { showIf: "background_canada_status_violation === yes" }, validation_rules: { maxLength: 1500 } },
    { field_name: "background_refusal_denial_removal", label: "Have you ever been refused a visa or permit, denied entry, or ordered to leave Canada or any other country or territory?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "background_refusal_denial_removal_details", label: "Refusal, denial, or removal — Details", field_type: "textarea", required: true, conditional_logic: { showIf: "background_refusal_denial_removal === yes" }, validation_rules: { maxLength: 1500 } },
    { field_name: "background_previous_canada_application", label: "Have you previously applied to enter or remain in Canada?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "background_previous_canada_application_details", label: "Previous Canada application — Details", field_type: "textarea", required: true, conditional_logic: { showIf: "background_previous_canada_application === yes" }, validation_rules: { maxLength: 1500 } },
    { field_name: "background_criminal_history", label: "Have you ever committed, been arrested for, been charged with, or convicted of any criminal offence in any country or territory?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "background_criminal_history_details", label: "Criminal history — Details", field_type: "textarea", required: true, conditional_logic: { showIf: "background_criminal_history === yes" }, validation_rules: { maxLength: 1500 } },
    { field_name: "background_military_service", label: "Have you ever served in a military, militia, civil defence unit, security organization, or police force, including non-obligatory national service or a reserve or volunteer unit?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "military_service_from", label: "Service — From", field_type: "text", required: true, conditional_logic: { showIf: HAS_MILITARY_SERVICE }, validation_rules: monthYearRules({ inline_group: "military_service_dates", block_group: "military_service", ...repeat("military_service", 20) }) },
    { field_name: "military_service_to", label: "Service — To", field_type: "text", required: true, conditional_logic: { showIf: HAS_MILITARY_SERVICE }, validation_rules: monthYearRules({ inline_group: "military_service_dates", block_group: "military_service", ...repeat("military_service", 20) }) },
    { field_name: "military_service_country", label: "Country or territory of service", field_type: "country", required: true, conditional_logic: { showIf: HAS_MILITARY_SERVICE }, validation_rules: { source: "ISO3166-1", block_group: "military_service", ...repeat("military_service", 20) } },
    { field_name: "military_service_organization", label: "Branch, unit, organization, rank, or position", field_type: "text", required: true, conditional_logic: { showIf: HAS_MILITARY_SERVICE }, validation_rules: { maxLength: 200, block_group: "military_service", ...repeat("military_service", 20) } },
    { field_name: "background_violent_organization", label: "Have you ever been a member of or associated with a political party or other group or organization that has engaged in or advocated violence as a means to achieving a political or religious objective, or that has been associated with criminal activity?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "background_violent_organization_details", label: "Organization association — Details", field_type: "textarea", required: true, conditional_logic: { showIf: "background_violent_organization === yes" }, validation_rules: { maxLength: 1500 } },
    { field_name: "background_mistreatment_or_looting", label: "Have you ever witnessed or participated in the ill-treatment of prisoners or civilians, looting, or desecration of religious buildings?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "background_mistreatment_or_looting_details", label: "Ill-treatment, looting, or desecration — Details", field_type: "textarea", required: true, conditional_logic: { showIf: "background_mistreatment_or_looting === yes" }, validation_rules: { maxLength: 1500 } },
  ]),

  ...defineStep(8, "Family Information (IMM 5707)", "IMM 5707", [
    ...familyPersonFields("applicant", "Applicant"),
    { field_name: "imm5707_applicant_marriage_physically_present", label: "Applicant — Were you physically present at the marriage?", field_type: "radio", required: true, conditional_logic: { showIf: FAMILY_APPLICANT_MARRIED }, options: YES_NO, validation_rules: { block_group: "imm5707_applicant" } },
    { field_name: "imm5707_has_spouse_or_partner", label: "Do you have a spouse, common-law partner, or conjugal partner?", field_type: "radio", required: true, options: YES_NO },
    ...familyPersonFields("partner", "Spouse / Common-law / Conjugal partner", HAS_FAMILY_PARTNER),
    { field_name: "imm5707_partner_marriage_physically_present", label: "Spouse or partner — Were you physically present at the marriage?", field_type: "radio", required: true, conditional_logic: { showIf: `${HAS_FAMILY_PARTNER} && ${FAMILY_PARTNER_MARRIED}` }, options: YES_NO, validation_rules: { block_group: "imm5707_partner" } },
    { field_name: "imm5707_no_spouse_or_partner_certification", label: "I certify that I do not have a spouse, common-law partner, or conjugal partner", field_type: "checkbox", required: true, conditional_logic: { showIf: HAS_NO_FAMILY_PARTNER }, options: [{ value: "yes", text: "I certify" }] },
    ...familyPersonFields("parent_1", "Parent 1"),
    ...familyPersonFields("parent_2", "Parent 2"),
    { field_name: "imm5707_has_children", label: "Do you have any children, including adopted children and step-children?", field_type: "radio", required: true, options: YES_NO },
    { field_name: "imm5707_child_relationship", label: "Child — Relationship", field_type: "select", required: true, conditional_logic: { showIf: HAS_CHILDREN }, options: [{ value: "son", text: "Son" }, { value: "daughter", text: "Daughter" }, { value: "adopted_child", text: "Adopted child" }, { value: "step_child", text: "Step-child" }], validation_rules: { block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_child_family_name", label: "Child — Family name", field_type: "text", required: true, conditional_logic: { showIf: HAS_CHILDREN }, validation_rules: { maxLength: 50, block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_child_given_names", label: "Child — Given name(s)", field_type: "text", required: false, conditional_logic: { showIf: HAS_CHILDREN }, validation_rules: { maxLength: 80, block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_child_name_native_script", label: "Child — Full name in native script", field_type: "text", required: true, conditional_logic: { showIf: HAS_CHILDREN }, validation_rules: { maxLength: 120, block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_child_date_of_birth", label: "Child — Date of birth", field_type: "date", required: true, conditional_logic: { showIf: HAS_CHILDREN }, validation_rules: dateRules({ allow_unknown_components: true, official_unknown_marker: "*", block_group: "imm5707_children", ...repeat("imm5707_children", 30) }) },
    { field_name: "imm5707_child_country_of_birth", label: "Child — Country or territory of birth", field_type: "country", required: true, conditional_logic: { showIf: HAS_CHILDREN }, validation_rules: { source: "ISO3166-1", block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_child_marital_status", label: "Child — Marital status", field_type: "select", required: true, conditional_logic: { showIf: HAS_CHILDREN }, options: FAMILY_MARITAL_OPTIONS, validation_rules: { block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_child_present_address", label: "Child — Present address", field_type: "textarea", required: true, conditional_logic: { showIf: HAS_CHILDREN }, validation_rules: { maxLength: 250, block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_child_occupation", label: "Child — Present occupation", field_type: "text", required: true, conditional_logic: { showIf: HAS_CHILDREN }, validation_rules: { maxLength: 100, block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_child_accompanying", label: "Child — Will accompany you to Canada", field_type: "radio", required: true, conditional_logic: { showIf: HAS_CHILDREN }, options: YES_NO, validation_rules: { block_group: "imm5707_children", ...repeat("imm5707_children", 30) } },
    { field_name: "imm5707_no_children_certification", label: "I certify that I do not have any children, including adopted children and step-children", field_type: "checkbox", required: true, conditional_logic: { showIf: HAS_NO_CHILDREN }, options: [{ value: "yes", text: "I certify" }] },
    { field_name: "imm5707_declaration", label: "I certify that the information in this Family Information form is complete, accurate, and factual", field_type: "checkbox", required: true, options: [{ value: "yes", text: "I certify" }] },
  ]),

  ...defineStep(9, "China Supplement (IMM 0104)", "IMM 0104", [
    { field_name: "china_employment_from", label: "Employment or service history — From", field_type: "text", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: monthYearRules({ inline_group: "china_employment_dates", block_group: "china_employment_history", ...repeat("china_employment_history", 40) }) },
    { field_name: "china_employment_to", label: "Employment or service history — To", field_type: "text", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: monthYearRules({ inline_group: "china_employment_dates", block_group: "china_employment_history", ...repeat("china_employment_history", 40) }) },
    { field_name: "china_employer_unit_name_address", label: "Company, military, or police unit — Name and address", field_type: "textarea", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: { maxLength: 300, block_group: "china_employment_history", ...repeat("china_employment_history", 40) } },
    { field_name: "china_position_title_rank", label: "Position, title, or rank", field_type: "text", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: { maxLength: 120, block_group: "china_employment_history", ...repeat("china_employment_history", 40) } },
    { field_name: "china_employment_duties", label: "Duties", field_type: "textarea", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: { maxLength: 500, block_group: "china_employment_history", ...repeat("china_employment_history", 40) } },
    { field_name: "china_education_from", label: "Post-secondary education — From", field_type: "text", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: monthYearRules({ inline_group: "china_education_dates", block_group: "china_education_history", ...repeat("china_education_history", 20) }) },
    { field_name: "china_education_to", label: "Post-secondary education — To", field_type: "text", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: monthYearRules({ inline_group: "china_education_dates", block_group: "china_education_history", ...repeat("china_education_history", 20) }) },
    { field_name: "china_school_name_address", label: "School — Name and address", field_type: "textarea", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: { maxLength: 300, block_group: "china_education_history", ...repeat("china_education_history", 20) } },
    { field_name: "china_diploma_degree", label: "Diploma or degree", field_type: "text", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: { maxLength: 120, block_group: "china_education_history", ...repeat("china_education_history", 20) } },
    { field_name: "china_course_of_study", label: "Course of study", field_type: "text", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, validation_rules: { maxLength: 120, block_group: "china_education_history", ...repeat("china_education_history", 20) } },
    { field_name: "china_first_trip_outside_china", label: "Is this your first trip outside China?", field_type: "radio", required: true, conditional_logic: { showIf: IS_CHINESE_CITIZEN }, options: YES_NO },
    { field_name: "china_travel_from", label: "Travel outside China — From", field_type: "text", required: true, conditional_logic: { showIf: CHINA_HAS_TRAVEL }, validation_rules: monthYearRules({ inline_group: "china_travel_dates", block_group: "china_travel_history", ...repeat("china_travel_history", 40) }) },
    { field_name: "china_travel_to", label: "Travel outside China — To", field_type: "text", required: true, conditional_logic: { showIf: CHINA_HAS_TRAVEL }, validation_rules: monthYearRules({ inline_group: "china_travel_dates", block_group: "china_travel_history", ...repeat("china_travel_history", 40) }) },
    { field_name: "china_travel_purpose", label: "Purpose of travel", field_type: "text", required: true, conditional_logic: { showIf: CHINA_HAS_TRAVEL }, validation_rules: { maxLength: 120, block_group: "china_travel_history", ...repeat("china_travel_history", 40) } },
    { field_name: "china_travel_city_country", label: "City and country or territory visited", field_type: "text", required: true, conditional_logic: { showIf: CHINA_HAS_TRAVEL }, validation_rules: { maxLength: 160, block_group: "china_travel_history", ...repeat("china_travel_history", 40) } },
  ]),

  ...defineStep(10, "Declaration", "IMM 5257", [
    { field_name: "applicant_declaration", label: "I declare that the information I have provided is truthful, complete, and correct", field_type: "checkbox", required: true, options: [{ value: "yes", text: "I agree" }] },
  ]),
];

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);
  const { error: delError } = await supabase
    .from("visa_form_fields")
    .delete()
    .eq("visa_type", VISA_TYPE);
  if (delError) {
    console.error("Error deleting:", delError.message);
  } else {
    console.log(`Cleared ${VISA_TYPE}`);
  }

  const rows = FIELDS.map((field) => toBilingualSeedRow(VISA_TYPE, field));
  const BATCH = 20;
  let total = 0;
  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH);
    const { data, error } = await supabase
      .from("visa_form_fields")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`Batch ${Math.floor(index / BATCH) + 1} error:`, error.message);
    } else {
      total += data?.length ?? 0;
      process.stdout.write(
        `Batch ${Math.floor(index / BATCH) + 1}: ${data?.length ?? 0} inserted\n`,
      );
    }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
