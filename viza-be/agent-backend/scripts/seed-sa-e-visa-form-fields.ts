/**
 * Seed script: official-source Saudi Arabia tourist eVisa answer schema.
 *
 * Product boundary: `SA_E_VISA` is only the Ministry of Tourism VisitSaudi
 * tourist eVisa at https://visa.visitsaudi.com/. It does not represent the
 * broader KSA Visa catalogue, Hajj, work, study, or sponsor-issued visas.
 *
 * Sources checked 2026-08-16:
 * - https://visa.visitsaudi.com/
 * - https://visa.visitsaudi.com/Home/TermsConditions
 * - https://visa.visitsaudi.com/Registration/Verify
 * - https://visa.visitsaudi.com/Home/PhotoSpecifications
 * - authenticated-application client templates served by VisitSaudi
 *
 * Official account creation, credentials, activation, session state, CAPTCHA,
 * integrated insurance, and payment are VIZA workflow concerns and are absent
 * from visa_form_fields. The personal photograph and passport bio page belong
 * to application_documents; the document slots are referenced only as schema
 * metadata below.
 *
 * Run: npx tsx scripts/seed-sa-e-visa-form-fields.ts
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

const VISA_TYPE = "SA_E_VISA";

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

const ACCOMMODATION_OPTIONS = [
  { value: "hotel", text: "Hotel or other commercial accommodation" },
  { value: "residence", text: "Private residence" },
];

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
    field_name: "nationality",
    label: "Nationality",
    field_type: "country",
    required: true,
    step_number: 1,
    step_name: "Applicant Information",
    display_order: 1,
    validation_rules: {
      source: "VisitSaudi live registration eligibility dropdown",
      official_field: "Nationality",
      eligible_nationalities_captured_at: "2026-08-16",
      note: "Eligibility is determined by the live VisitSaudi dropdown and must be rechecked before submission because it can drift from marketing copy.",
      document_slots: [
        { key: "personal_photo", storage: "application_documents", required: true },
        { key: "passport_bio_page", storage: "application_documents", required: true },
      ],
    },
  },
  {
    field_name: "given_name",
    label: "Given name",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant Information",
    display_order: 2,
    validation_rules: {
      maxLength: 80,
      official_fields: { english: "FirstNameEnglish", arabic: "FirstNameArabic" },
      bilingual_value_pair: true,
      note: "VIZA displays the selected interface language and preserves the synchronized official English/Arabic values internally.",
    },
  },
  {
    field_name: "father_name",
    label: "Father name",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant Information",
    display_order: 3,
    validation_rules: {
      maxLength: 80,
      official_fields: { english: "FatherNameEnglish", arabic: "FatherNameArabic" },
      bilingual_value_pair: true,
      note: "VIZA displays the selected interface language and preserves the synchronized official English/Arabic values internally.",
    },
  },
  {
    field_name: "family_name",
    label: "Family name",
    field_type: "text",
    required: true,
    step_number: 1,
    step_name: "Applicant Information",
    display_order: 4,
    validation_rules: {
      maxLength: 80,
      official_fields: { english: "LastNameEnglish", arabic: "LastNameArabic" },
      bilingual_value_pair: true,
      note: "VIZA displays the selected interface language and preserves the synchronized official English/Arabic values internally.",
    },
  },
  { field_name: "gender", label: "Gender", field_type: "select", required: true, step_number: 1, step_name: "Applicant Information", display_order: 5, options: GENDER_OPTIONS, validation_rules: { official_field: "Gender" } },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Applicant Information", display_order: 6, validation_rules: { format: "DD/MM/YYYY", official_field: "DateOfBirth" } },
  { field_name: "country_of_birth", label: "Country of birth", field_type: "country", required: true, step_number: 1, step_name: "Applicant Information", display_order: 7, validation_rules: { source: "ISO3166-1", official_field: "CountryOfBirth", block_group: "birth_place" } },
  { field_name: "city_of_birth", label: "City of birth", field_type: "text", required: true, step_number: 1, step_name: "Applicant Information", display_order: 8, validation_rules: { maxLength: 100, official_field: "CityOfBirth", block_group: "birth_place" } },
  { field_name: "religion", label: "Religion", field_type: "text", required: true, step_number: 1, step_name: "Applicant Information", display_order: 9, validation_rules: qaRules("Capture transaction-specific lookup values/codes and reconfirm requiredness in an activated VisitSaudi application.", { maxLength: 80, official_field: "Religion", official_control: "lookup" }) },
  { field_name: "marital_status", label: "Marital status", field_type: "text", required: true, step_number: 1, step_name: "Applicant Information", display_order: 10, validation_rules: qaRules("Capture the authenticated lookup values/codes and reconfirm requiredness.", { maxLength: 80, official_field: "SocialStatus", official_control: "lookup" }) },
  { field_name: "profession", label: "Profession", field_type: "text", required: true, step_number: 1, step_name: "Applicant Information", display_order: 11, validation_rules: qaRules("Capture the authenticated searchable profession lookup, official code, and requiredness.", { maxLength: 120, official_field: "Profession", official_control: "search_lookup" }) },
  { field_name: "applicant_is_minor", label: "Is the applicant under 18?", field_type: "radio", required: true, step_number: 1, step_name: "Applicant Information", display_order: 12, options: YES_NO, validation_rules: { note: "Adults may create a linked application for a minor; the linked application itself remains workflow state." } },
  { field_name: "guardian_full_name", label: "Guardian full name", field_type: "text", required: true, step_number: 1, step_name: "Applicant Information", display_order: 13, conditional_logic: { showIf: "applicant_is_minor === yes" }, validation_rules: qaRules("The official portal selects a guardian from linked group applications. VIZA must resolve this answer to that application relationship during submission.", { maxLength: 160, official_field: "GuardianList", block_group: "minor_guardian" }) },
  { field_name: "guardian_relationship", label: "Guardian relationship to applicant", field_type: "text", required: true, step_number: 1, step_name: "Applicant Information", display_order: 14, conditional_logic: { showIf: "applicant_is_minor === yes" }, validation_rules: qaRules("Capture authenticated GuardianRelation lookup values/codes and reconfirm requiredness.", { maxLength: 80, official_field: "GuardianRelation", official_control: "lookup", block_group: "minor_guardian" }) },

  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, validation_rules: qaRules("Confirm the authenticated control name and exact character validation. The product accepts regular passports only.", { maxLength: 20, transform: "uppercase", passport_type_locked: "Regular Passport" }) },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 2, validation_rules: qaRules("Confirm the authenticated control name and whether nationality preselects this value.", { source: "ISO3166-1", block_group: "passport_issue" }) },
  { field_name: "passport_issue_place", label: "Passport place of issue", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: qaRules("Confirm the authenticated control name and exact maximum length.", { maxLength: 100, block_group: "passport_issue" }) },
  { field_name: "passport_issue_date", label: "Passport issue date", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { format: "DD/MM/YYYY", official_field: "PassportIssueDate", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Passport expiry date", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, validation_rules: { format: "DD/MM/YYYY", official_field: "PassportExpiryDate", minimum_validity_at_entry_months: 6, inline_group: "passport_dates" } },

  { field_name: "residence_country", label: "Country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 1, validation_rules: { source: "ISO3166-1", official_field: "Country", block_group: "residence_address" } },
  { field_name: "residence_city", label: "City of residence", field_type: "text", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 2, validation_rules: { maxLength: 100, official_field: "City", block_group: "residence_address" } },
  { field_name: "residence_postal_code", label: "Postal code", field_type: "text", required: false, step_number: 3, step_name: "Contact & Residence", display_order: 3, validation_rules: qaRules("Reconfirm whether PostalCode is required for the applicant's selected country.", { maxLength: 20, official_field: "PostalCode", block_group: "residence_address" }) },
  { field_name: "residence_address", label: "Residential address", field_type: "textarea", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 4, validation_rules: { maxLength: 250, official_field: "Address", block_group: "residence_address" } },
  { field_name: "visa_email", label: "Email address for visa correspondence", field_type: "text", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 5, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", official_field: "VisaEmail", note: "This is applicant correspondence data, not an official-portal account credential." } },
  { field_name: "phone_country_code", label: "Phone country calling code", field_type: "text", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 6, placeholder: "+65", validation_rules: qaRules("Confirm the authenticated calling-code control name and transfer format.", { maxLength: 6, pattern: "^\\+[0-9]{1,4}$", inline_group: "primary_phone" }) },
  { field_name: "phone_number", label: "Mobile or phone number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 7, validation_rules: { maxLength: 15, pattern: "^[0-9]{7,15}$", official_field: "MobileOrPhoneNumber", inline_group: "primary_phone" } },
  { field_name: "has_whatsapp", label: "Do you have a WhatsApp number?", field_type: "radio", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 8, options: YES_NO, validation_rules: qaRules("Confirm the authenticated wording and whether the WhatsApp number controls appear for Yes.", { official_fields: ["rdWhatsAppYes", "rdWhatsAppNo"] }) },
  { field_name: "whatsapp_country_code", label: "WhatsApp country calling code", field_type: "text", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 9, placeholder: "+65", conditional_logic: { showIf: "has_whatsapp === yes" }, validation_rules: qaRules("Confirm the authenticated calling-code control name and transfer format.", { maxLength: 6, pattern: "^\\+[0-9]{1,4}$", block_group: "whatsapp_contact", inline_group: "whatsapp_phone" }) },
  { field_name: "whatsapp_number", label: "WhatsApp mobile number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Residence", display_order: 10, conditional_logic: { showIf: "has_whatsapp === yes" }, validation_rules: { maxLength: 15, pattern: "^[0-9]{7,15}$", official_field: "WhatsappMobile", block_group: "whatsapp_contact", inline_group: "whatsapp_phone" } },

  { field_name: "purpose_of_visit", label: "Purpose of visit", field_type: "text", required: true, step_number: 4, step_name: "Visit & Accommodation", display_order: 1, validation_rules: qaRules("Capture authenticated SelectedPurposeOfVisit lookup labels/codes and reconfirm requiredness.", { maxLength: 120, official_field: "SelectedPurposeOfVisit", official_control: "lookup" }) },
  { field_name: "accommodation_type", label: "Where will you stay in Saudi Arabia?", field_type: "radio", required: true, step_number: 4, step_name: "Visit & Accommodation", display_order: 2, options: ACCOMMODATION_OPTIONS, validation_rules: { official_fields: ["AccomodationHotel", "AccomodationResidency"] } },
  { field_name: "private_residence_address", label: "Private residence address", field_type: "textarea", required: true, step_number: 4, step_name: "Visit & Accommodation", display_order: 3, conditional_logic: { showIf: "accommodation_type === residence" }, validation_rules: { maxLength: 250, official_field: "Address1", block_group: "private_residence" } },
  { field_name: "private_residence_city", label: "Private residence city", field_type: "text", required: true, step_number: 4, step_name: "Visit & Accommodation", display_order: 4, conditional_logic: { showIf: "accommodation_type === residence" }, validation_rules: qaRules("Capture the authenticated CityId lookup labels/codes.", { maxLength: 100, official_field: "CityId", official_control: "lookup", block_group: "private_residence" }) },
  { field_name: "private_residence_name", label: "Name of residence or host", field_type: "text", required: true, step_number: 4, step_name: "Visit & Accommodation", display_order: 5, conditional_logic: { showIf: "accommodation_type === residence" }, validation_rules: qaRules("Reconfirm the official meaning and requiredness of PlaceOfResidence in the authenticated flow.", { maxLength: 160, official_field: "PlaceOfResidence", block_group: "private_residence" }) },
  { field_name: "hotel_name", label: "Hotel or accommodation name", field_type: "text", required: true, step_number: 4, step_name: "Visit & Accommodation", display_order: 6, conditional_logic: { showIf: "accommodation_type === hotel" }, validation_rules: qaRules("The official portal uses a place-search control. Capture its selected-place transfer fields without exposing derived map coordinates.", { maxLength: 160, official_field: "pac-input", official_control: "place_search", block_group: "commercial_accommodation" }) },
  { field_name: "hotel_address", label: "Hotel or accommodation address", field_type: "textarea", required: true, step_number: 4, step_name: "Visit & Accommodation", display_order: 7, conditional_logic: { showIf: "accommodation_type === hotel" }, validation_rules: qaRules("Confirm whether the authenticated place-search result supplies this value automatically and whether manual correction is allowed.", { maxLength: 250, block_group: "commercial_accommodation" }) },
  { field_name: "hotel_city", label: "Hotel or accommodation city", field_type: "text", required: true, step_number: 4, step_name: "Visit & Accommodation", display_order: 8, conditional_logic: { showIf: "accommodation_type === hotel" }, validation_rules: qaRules("Capture the authenticated city lookup/derived value and transfer code.", { maxLength: 100, official_control: "lookup_or_derived", block_group: "commercial_accommodation" }) },
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
