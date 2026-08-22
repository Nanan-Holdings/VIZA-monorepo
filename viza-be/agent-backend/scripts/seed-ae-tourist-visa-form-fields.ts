/**
 * Seed script: official-source UAE five-year tourist visa answer schema.
 *
 * Product boundary: compatibility code `AE_TOURIST_VISA` means only the ICP
 * self-sponsored five-year multiple-entry tourist visa, service code
 * 377-005-001-031, Smart Services transaction 783. Sponsor-issued 30/60-day
 * tourist visas and all GDRFA products are separate and intentionally absent.
 *
 * Sources checked 2026-08-16:
 * - https://icp.gov.ae/en/services-details/?serviceid=68f5bc968c587a0011cb16cd
 * - https://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/783
 * - https://icp.gov.ae/wp-content/themes/icp_v4/assets/attachments/user-manual-en.pdf
 * - public ICP Smart Services Angular templates and current lookup constants
 *
 * UAE Pass/login, credentials, session state, attachments, guarantee handling,
 * insurance purchase, fees, and payment are workflow concerns and are absent
 * from visa_form_fields. Required evidence stays in application_documents; its
 * slots are referenced only as metadata below.
 *
 * Run: npx tsx scripts/seed-ae-tourist-visa-form-fields.ts
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

const VISA_TYPE = "AE_TOURIST_VISA";

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

const YES_NO = [
  { value: "yes", text: "Yes" },
  { value: "no", text: "No" },
];

const GENDER_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
];

const NATIONALITY_REQUIRES_ID =
  "current_nationality === Afghanistan || current_nationality === Iran || current_nationality === Iraq";

const qaRules = (
  note: string,
  rules: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ...rules,
  live_portal_qa_required: true,
  live_portal_qa_note: note,
});

const FIELDS: FieldDef[] = [
  {
    field_name: "full_name",
    label: "Full name",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Beneficiary Information",
    display_order: 1,
    validation_rules: {
      maxLength: 64,
      official_fields: { english: "fullNameEn", arabic: "fullNameAr" },
      bilingual_value_pair: true,
      note: "VIZA displays the selected interface language and preserves synchronized English/Arabic official values internally.",
      product_scope: {
        authority: "ICP",
        service_code: "377-005-001-031",
        transaction_id: 783,
        visit_reason_locked: "Tourism - سياحة",
      },
    },
  },
  {
    field_name: "current_nationality",
    label: "Current nationality",
    field_type: "country",
    required: true,
    step_number: 1,
    step_name: "Beneficiary Information",
    display_order: 2,
    validation_rules: {
      source: "ISO3166-1 country names",
      document_slots: [
        { key: "passport_bio_page", storage: "application_documents", required: true },
        { key: "personal_photo", storage: "application_documents", required: true },
        { key: "six_month_bank_statement", storage: "application_documents", required: true, minimum_balance_usd_equivalent: 4000 },
        { key: "uae_health_coverage_evidence", storage: "application_documents", required: true, minimum_validity_days: 180 },
        { key: "return_or_onward_ticket", storage: "application_documents", required: true },
        { key: "uae_accommodation_evidence", storage: "application_documents", required: true },
        { key: "national_identity_copy", storage: "application_documents", required_if: NATIONALITY_REQUIRES_ID },
      ],
      note: "Country values and conditional expressions use stored country names, not ISO codes.",
    },
  },
  { field_name: "previous_nationality", label: "Previous nationality, if any", field_type: "country", required: false, step_number: 1, step_name: "Beneficiary Information", display_order: 3, validation_rules: qaRules("Confirm whether transaction 783 displays previous nationality and whether it is conditionally required.", { source: "ISO3166-1 country names" }) },
  { field_name: "profession", label: "Profession", field_type: "text", required: true, step_number: 1, step_name: "Beneficiary Information", display_order: 4, validation_rules: qaRules("Capture transaction 783's authenticated searchable profession lookup labels/codes and reconfirm requiredness.", { maxLength: 120, official_control: "search_lookup" }) },
  { field_name: "gender", label: "Gender", field_type: "select", required: true, step_number: 1, step_name: "Beneficiary Information", display_order: 5, options: GENDER_OPTIONS, validation_rules: qaRules("Reconfirm transaction 783's complete gender option codes and requiredness.") },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Beneficiary Information", display_order: 6, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "country_of_birth", label: "Country of birth", field_type: "country", required: true, step_number: 1, step_name: "Beneficiary Information", display_order: 7, validation_rules: { source: "ISO3166-1 country names", block_group: "birth_place" } },
  { field_name: "place_of_birth", label: "City or place of birth", field_type: "text", required: true, step_number: 1, step_name: "Beneficiary Information", display_order: 8, validation_rules: { maxLength: 100, official_fields: { english: "birthPlaceEn", arabic: "birthPlaceAr" }, bilingual_value_pair: true, block_group: "birth_place", note: "VIZA preserves the synchronized official English/Arabic values internally." } },
  { field_name: "religion", label: "Religion", field_type: "text", required: true, step_number: 1, step_name: "Beneficiary Information", display_order: 9, validation_rules: qaRules("Capture transaction 783's authenticated religion lookup labels/codes, requiredness, and any resulting faith branch.", { maxLength: 80, official_control: "lookup" }) },
  { field_name: "marital_status", label: "Marital status", field_type: "text", required: true, step_number: 1, step_name: "Beneficiary Information", display_order: 10, validation_rules: qaRules("Capture transaction 783's authenticated marital-status lookup labels/codes and reconfirm requiredness.", { maxLength: 80, official_control: "lookup" }) },
  { field_name: "education_level", label: "Education level", field_type: "text", required: true, step_number: 1, step_name: "Beneficiary Information", display_order: 11, validation_rules: qaRules("Capture transaction 783's authenticated education lookup labels/codes, requiredness, and any country/details branch.", { maxLength: 100, official_control: "lookup" }) },

  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, validation_rules: { maxLength: 20, transform: "uppercase" } },
  { field_name: "passport_type", label: "Passport type", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 2, validation_rules: qaRules("Capture transaction 783's authenticated passport-type lookup labels/codes and reconfirm requiredness.", { maxLength: 80, official_control: "lookup" }) },
  { field_name: "passport_issue_place", label: "Passport place of issue", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { maxLength: 100, official_fields: { english: "passportIssuePlaceEn", arabic: "passportIssuePlaceAr" }, bilingual_value_pair: true, block_group: "passport_issue", note: "VIZA preserves the synchronized official English/Arabic values internally." } },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { source: "ISO3166-1 country names", block_group: "passport_issue" } },
  { field_name: "passport_issue_date", label: "Passport issue date", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Passport expiry date", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 6, validation_rules: { format: "DD/MM/YYYY", minimum_validity_at_submission_months: 6, inline_group: "passport_dates" } },

  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact Outside the UAE", display_order: 1, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", note: "This is beneficiary contact data, not a UAE Pass or official-portal credential." } },
  { field_name: "residence_country", label: "Country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact Outside the UAE", display_order: 2, validation_rules: { source: "ISO3166-1 country names", block_group: "outside_uae_contact" } },
  { field_name: "residential_address_outside_uae", label: "Residential address outside the UAE", field_type: "textarea", required: true, step_number: 3, step_name: "Contact Outside the UAE", display_order: 3, validation_rules: { maxLength: 250, block_group: "outside_uae_contact" } },
  { field_name: "phone_outside_uae", label: "Telephone number outside the UAE", field_type: "text", required: true, step_number: 3, step_name: "Contact Outside the UAE", display_order: 4, validation_rules: qaRules("Confirm transaction 783's phone format, calling-code handling, and requiredness.", { maxLength: 30, block_group: "outside_uae_contact" }) },

  { field_name: "uae_emirate", label: "Emirate of accommodation", field_type: "text", required: true, step_number: 4, step_name: "Accommodation in the UAE", display_order: 1, validation_rules: qaRules("Capture transaction 783's authenticated emirate lookup labels/codes and reconfirm requiredness.", { maxLength: 80, official_control: "lookup", block_group: "uae_address" }) },
  { field_name: "uae_city", label: "City of accommodation", field_type: "text", required: true, step_number: 4, step_name: "Accommodation in the UAE", display_order: 2, validation_rules: qaRules("Capture the city lookup labels/codes after emirate selection and reconfirm requiredness.", { maxLength: 100, official_control: "dependent_lookup", block_group: "uae_address" }) },
  { field_name: "uae_area", label: "Area of accommodation", field_type: "text", required: true, step_number: 4, step_name: "Accommodation in the UAE", display_order: 3, validation_rules: qaRules("Capture the area lookup labels/codes after city selection and reconfirm requiredness.", { maxLength: 100, official_control: "dependent_lookup", block_group: "uae_address" }) },
  { field_name: "uae_detailed_address", label: "Detailed accommodation address", field_type: "textarea", required: true, step_number: 4, step_name: "Accommodation in the UAE", display_order: 4, validation_rules: { maxLength: 250, block_group: "uae_address" } },
  { field_name: "uae_building_name", label: "Building or property name", field_type: "text", required: false, step_number: 4, step_name: "Accommodation in the UAE", display_order: 5, validation_rules: qaRules("The generic ICP template can require this field by transaction configuration; verify transaction 783 requiredness.", { maxLength: 120, block_group: "uae_address" }) },
  { field_name: "uae_po_box", label: "P.O. box, if available", field_type: "text", required: false, step_number: 4, step_name: "Accommodation in the UAE", display_order: 6, validation_rules: qaRules("Confirm transaction 783 visibility and exact format.", { maxLength: 20, block_group: "uae_address" }) },
  { field_name: "has_uae_mobile", label: "Do you have a mobile number inside the UAE?", field_type: "radio", required: true, step_number: 4, step_name: "Accommodation in the UAE", display_order: 7, options: YES_NO, validation_rules: qaRules("Confirm the authenticated transaction 783 wording and no-mobile branch behavior.") },
  { field_name: "uae_mobile_number", label: "Mobile number inside the UAE", field_type: "text", required: true, step_number: 4, step_name: "Accommodation in the UAE", display_order: 8, conditional_logic: { showIf: "has_uae_mobile === yes" }, validation_rules: qaRules("Confirm transaction 783's accepted UAE mobile format and transfer fields.", { maxLength: 20, pattern: "^[0-9+ -]{7,20}$", block_group: "uae_mobile" }) },

  { field_name: "transaction_reason", label: "Reason for this application", field_type: "text", required: true, step_number: 5, step_name: "Application Details", display_order: 1, validation_rules: qaRules("Capture transaction 783's authenticated transaction-reason lookup labels/codes and reconfirm requiredness. Visit reason itself is locked to Tourism and is not an applicant question.", { maxLength: 120, official_control: "lookup" }) },
];

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);
  const { error: deleteError } = await supabase.from("visa_form_fields").delete().eq("visa_type", VISA_TYPE);
  if (deleteError) throw new Error(`Failed to clear ${VISA_TYPE}: ${deleteError.message}`);
  console.log(`Cleared ${VISA_TYPE}`);

  const rows = FIELDS.map((field) => toBilingualSeedRow(VISA_TYPE, field));
  const batchSize = 20;
  let total = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { data, error } = await supabase.from("visa_form_fields").insert(batch).select("id");
    if (error) throw new Error(`Batch ${Math.floor(index / batchSize) + 1} failed: ${error.message}`);
    total += data?.length ?? 0;
    process.stdout.write(`Batch ${Math.floor(index / batchSize) + 1}: ${data?.length ?? 0} inserted\n`);
  }

  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
  if (total !== FIELDS.length) throw new Error(`Seed count mismatch: ${total} inserted, ${FIELDS.length} defined`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
