/**
 * Seed script: official-source Türkiye electronic visa answer schema.
 *
 * Scope: the Ministry of Foreign Affairs electronic visa used for tourism and
 * trade at https://evisa.gov.tr. Entry count, validity, permitted stay, fee,
 * and some eligibility declarations are derived by the official portal from
 * travel-document country/type and arrival date; applicants must not choose
 * those values in VIZA.
 *
 * Sources checked 2026-08-16:
 * - https://evisa.gov.tr/en/apply/
 * - https://evisa.gov.tr/en/tour/
 * - https://www.evisa.gov.tr/assets/files/guide_en.pdf
 *
 * CAPTCHA, email verification, payment, and official-session state are VIZA
 * workflow concerns and are intentionally absent from visa_form_fields.
 * Türkiye's e-Visa flow has no applicant document upload.
 *
 * Run: npx tsx scripts/seed-tr-e-visa-form-fields.ts
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

const VISA_TYPE = "TR_E_VISA";

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

const TRAVEL_DOCUMENT_OPTIONS = [
  { value: "UMP", text: "Ordinary Passport" },
  { value: "KMB", text: "Identity Card" },
  { value: "DPP", text: "Diplomatic Passport" },
  { value: "HZP", text: "Service Passport" },
  { value: "HSP", text: "Special Passport" },
  { value: "YMP", text: "Alien's Passport" },
  { value: "SYB", text: "Travel Document" },
  { value: "VTP", text: "Nansen Passport" },
  { value: "DGR", text: "Others" },
];

const SUPPORTING_DOCUMENT_TYPE_OPTIONS = [
  { value: "none", text: "No supporting document is required" },
  { value: "visa", text: "Visa" },
  { value: "residence_permit", text: "Residence permit" },
];

const SUPPORTING_VISA_ISSUER_OPTIONS = [
  { value: "AUS", text: "Australia" },
  { value: "CAN", text: "Canada" },
  { value: "CHL", text: "Chile" },
  { value: "GBR", text: "United Kingdom" },
  { value: "IRL", text: "Ireland" },
  { value: "ISR", text: "Israel" },
  { value: "JPN", text: "Japan" },
  { value: "KOR", text: "Republic of Korea" },
  { value: "MEX", text: "Mexico" },
  { value: "NZL", text: "New Zealand" },
  { value: "SN1", text: "Schengen" },
  { value: "USA", text: "United States of America" },
];

const SUPPORTING_RESIDENCE_ISSUER_OPTIONS = [
  { value: "AUS", text: "Australia" },
  { value: "AUT", text: "Austria" },
  { value: "BEL", text: "Belgium" },
  { value: "CAN", text: "Canada" },
  { value: "CHE", text: "Switzerland" },
  { value: "CHL", text: "Chile" },
  { value: "CZE", text: "Czech Republic" },
  { value: "DEU", text: "Germany" },
  { value: "DNK", text: "Denmark" },
  { value: "ESP", text: "Spain" },
  { value: "EST", text: "Estonia" },
  { value: "FIN", text: "Finland" },
  { value: "FRA", text: "France" },
  { value: "GBR", text: "United Kingdom" },
  { value: "GRC", text: "Greece" },
  { value: "HUN", text: "Hungary" },
  { value: "IRL", text: "Ireland" },
  { value: "ISL", text: "Iceland" },
  { value: "ISR", text: "Israel" },
  { value: "ITA", text: "Italy" },
  { value: "JPN", text: "Japan" },
  { value: "KOR", text: "Republic of Korea" },
  { value: "LIE", text: "Liechtenstein" },
  { value: "LTU", text: "Lithuania" },
  { value: "LUX", text: "Luxembourg" },
  { value: "LVA", text: "Latvia" },
  { value: "MEX", text: "Mexico" },
  { value: "MLT", text: "Malta" },
  { value: "NLD", text: "Netherlands" },
  { value: "NOR", text: "Norway" },
  { value: "NZL", text: "New Zealand" },
  { value: "POL", text: "Poland" },
  { value: "PRT", text: "Portugal" },
  { value: "SN1", text: "Schengen" },
  { value: "SVK", text: "Slovakia" },
  { value: "SVN", text: "Slovenia" },
  { value: "SWE", text: "Sweden" },
  { value: "USA", text: "United States of America" },
];

const FIELDS: FieldDef[] = [
  {
    field_name: "travel_document_country",
    label: "Country/region of your travel document",
    field_type: "country",
    required: true,
    step_number: 1,
    step_name: "Eligibility",
    display_order: 1,
    validation_rules: {
      source: "ISO3166-1",
      official_field: "uyruklist",
      note: "Eligibility, entry count, permitted stay, validity, and fee are derived by the official portal.",
    },
  },
  {
    field_name: "travel_document_type",
    label: "Travel document",
    field_type: "select",
    required: true,
    step_number: 1,
    step_name: "Eligibility",
    display_order: 2,
    options: TRAVEL_DOCUMENT_OPTIONS,
    validation_rules: { official_field: "belgelist", official_values_preserved: true },
  },
  {
    field_name: "intended_arrival_date",
    label: "Intended date of arrival in Türkiye",
    field_type: "date",
    required: true,
    step_number: 1,
    step_name: "Eligibility",
    display_order: 3,
    validation_rules: {
      format: "DD/MM/YYYY",
      note: "The official portal derives the visa validity window from this date.",
    },
  },
  {
    field_name: "given_names",
    label: "Given name(s), exactly as shown in your travel document",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Personal Information",
    display_order: 1,
    validation_rules: { maxLength: 50, official_field: "GivenName" },
  },
  {
    field_name: "surname",
    label: "Surname, exactly as shown in your travel document",
    field_type: "text",
    required: false,
    step_number: 2,
    step_name: "Personal Information",
    display_order: 2,
    validation_rules: {
      maxLength: 50,
      official_field: "Surname",
      note: "Leave blank only when no surname appears in the travel document.",
    },
  },
  {
    field_name: "date_of_birth",
    label: "Date of birth",
    field_type: "date",
    required: true,
    step_number: 2,
    step_name: "Personal Information",
    display_order: 3,
    validation_rules: { format: "DD/MM/YYYY", official_field: "DateofBirth", official_transfer_format: "YYYYMMDD" },
  },
  {
    field_name: "place_of_birth",
    label: "Place of birth, exactly as shown in your travel document",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Personal Information",
    display_order: 4,
    validation_rules: { maxLength: 40, official_field: "PlaceofBirth" },
  },
  {
    field_name: "mother_name",
    label: "Mother's name",
    field_type: "text",
    required: false,
    step_number: 2,
    step_name: "Personal Information",
    display_order: 5,
    validation_rules: { maxLength: 40, official_field: "MothersName" },
  },
  {
    field_name: "father_name",
    label: "Father's name",
    field_type: "text",
    required: false,
    step_number: 2,
    step_name: "Personal Information",
    display_order: 6,
    validation_rules: { maxLength: 40, official_field: "FathersName" },
  },
  {
    field_name: "travel_document_number",
    label: "Travel document number",
    field_type: "text",
    required: true,
    step_number: 3,
    step_name: "Travel Document",
    display_order: 1,
    validation_rules: {
      maxLength: 16,
      pattern: "^[A-Z0-9]+$",
      official_field: "DocNumber",
      transform: "uppercase",
    },
  },
  {
    field_name: "travel_document_issue_date",
    label: "Travel document issue date",
    field_type: "date",
    required: true,
    step_number: 3,
    step_name: "Travel Document",
    display_order: 2,
    validation_rules: {
      format: "DD/MM/YYYY",
      inline_group: "travel_document_dates",
      official_field: "DocIssueDate",
      official_transfer_format: "YYYYMMDD",
    },
  },
  {
    field_name: "travel_document_expiry_date",
    label: "Travel document expiry date",
    field_type: "date",
    required: true,
    step_number: 3,
    step_name: "Travel Document",
    display_order: 3,
    validation_rules: {
      format: "DD/MM/YYYY",
      inline_group: "travel_document_dates",
      official_field: "DocExpiryDate",
      official_transfer_format: "YYYYMMDD",
      note: "Must extend at least 60 days beyond the permitted stay shown by the official portal.",
    },
  },
  {
    field_name: "email_address",
    label: "Email address",
    field_type: "text",
    required: true,
    step_number: 4,
    step_name: "Contact Information",
    display_order: 1,
    validation_rules: {
      maxLength: 40,
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
      official_field: "Email",
      transform: "lowercase",
    },
  },
  {
    field_name: "phone_number",
    label: "Telephone number",
    field_type: "text",
    required: true,
    step_number: 4,
    step_name: "Contact Information",
    display_order: 2,
    validation_rules: { maxLength: 20, official_field: "PhoneNumber" },
  },
  {
    field_name: "residence_address",
    label: "Residence address",
    field_type: "textarea",
    required: true,
    step_number: 4,
    step_name: "Contact Information",
    display_order: 3,
    validation_rules: { maxLength: 200, official_field: "Address" },
  },
  {
    field_name: "supporting_document_type",
    label: "Supporting document required for your eligibility",
    field_type: "radio",
    required: true,
    step_number: 5,
    step_name: "Supporting Document",
    display_order: 1,
    options: SUPPORTING_DOCUMENT_TYPE_OPTIONS,
    validation_rules: {
      official_field: "TypeOfSuppDoc",
      official_values: { none: "0", visa: "1", residence_permit: "2" },
      note: "Select the result shown by the official eligibility flow for your nationality.",
    },
  },
  {
    field_name: "supporting_visa_issued_by",
    label: "Country/region that issued the supporting visa",
    field_type: "select",
    required: true,
    step_number: 5,
    step_name: "Supporting Document",
    display_order: 2,
    options: SUPPORTING_VISA_ISSUER_OPTIONS,
    conditional_logic: { showIf: "supporting_document_type === visa" },
    validation_rules: { official_field: "SuppDocFrom", block_group: "supporting_document" },
  },
  {
    field_name: "supporting_residence_permit_issued_by",
    label: "Country/region that issued the supporting residence permit",
    field_type: "select",
    required: true,
    step_number: 5,
    step_name: "Supporting Document",
    display_order: 3,
    options: SUPPORTING_RESIDENCE_ISSUER_OPTIONS,
    conditional_logic: { showIf: "supporting_document_type === residence_permit" },
    validation_rules: { official_field: "SuppDocFrom", block_group: "supporting_document" },
  },
  {
    field_name: "supporting_visa_expiry_date",
    label: "Supporting visa expiry date",
    field_type: "date",
    required: true,
    step_number: 5,
    step_name: "Supporting Document",
    display_order: 4,
    conditional_logic: { showIf: "supporting_document_type === visa" },
    validation_rules: {
      format: "DD/MM/YYYY",
      official_field: "SuppDocExpiryDate",
      official_transfer_format: "YYYYMMDD",
      block_group: "supporting_document",
    },
  },
  {
    field_name: "supporting_residence_permit_expiry_date",
    label: "Supporting residence permit expiry date",
    field_type: "date",
    required: false,
    step_number: 5,
    step_name: "Supporting Document",
    display_order: 5,
    conditional_logic: { showIf: "supporting_document_type === residence_permit" },
    validation_rules: {
      format: "DD/MM/YYYY",
      official_field: "SuppDocExpiryDate",
      official_transfer_format: "YYYYMMDD",
      block_group: "supporting_document",
      note: "Leave blank only when the residence permit is valid indefinitely.",
    },
  },
];

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);
  const { error: delError } = await supabase.from("visa_form_fields").delete().eq("visa_type", VISA_TYPE);
  if (delError) console.error("Error deleting:", delError.message);
  else console.log(`Cleared ${VISA_TYPE}`);

  const rows = FIELDS.map((field) => toBilingualSeedRow(VISA_TYPE, field));
  const BATCH = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase.from("visa_form_fields").insert(batch).select("id");
    if (error) console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    else {
      total += data?.length ?? 0;
      process.stdout.write(`Batch ${Math.floor(i / BATCH) + 1}: ${data?.length ?? 0} inserted\n`);
    }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
