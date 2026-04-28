/**
 * Seed script: visa_form_fields for Indonesia C1 Tourist Single Entry Visa
 * (formerly B211A).
 *
 * Field definitions mirror the official Indonesia eVisa portal
 * (`evisa.imigrasi.go.id`, formerly `molina.imigrasi.go.id`) C1 Visit
 * Visa Wisata journey. Source documents:
 *   - eVisa registration form (WNA): https://evisa.imigrasi.go.id/front/register/wna
 *   - eVisa C1 Visit Visa info (eVOA / Visit Visa categories):
 *     https://evisa.imigrasi.go.id/front/info/evoa
 *   - eVisa General Information FAQ:
 *     https://evisa.imigrasi.go.id/front/faq/aff9642b-0b57-443f-8de1-a51601de0ebb
 *   - Direktorat Jenderal Imigrasi guidance:
 *     https://www.imigrasi.go.id/berita/2023/03/10/begini-prosedur-dan-syarat-penggunaan-visa-kunjungan-wisata-dari-website-molina-imigrasi
 *
 * Scope: C1 Tourist Single Entry only (Visa Kunjungan Wisata, ex-B211A).
 * 60 days, single entry. The portal supports self-application without an
 * Indonesian sponsor — `has_sponsor_in_indonesia` is therefore a gate, not a
 * hard requirement (sponsor block is captured for users who go through an
 * Indonesian guarantor for an extendable C1).
 *
 * Document uploads (passport bio page, photo, return ticket, bank statement
 * USD 2,000+ for 3 months) are out of schema per playbook §5.6 — they live
 * in application_documents.
 *
 * Run: npx tsx scripts/seed-id-c1-tourist-form-fields.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

const VISA_TYPE = "ID_C1_TOURIST";

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

// ── Reusable gate constants ────────────────────────────────────────────────
const HAS_OTHER_NAMES = "has_other_names_used === yes";
const HAS_OTHER_NATIONALITIES = "has_other_nationalities === yes";
const IS_MARRIED = "marital_status === married";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const HAS_SPONSOR = "has_sponsor_in_indonesia === yes";
const SPONSOR_IS_INDIVIDUAL = "sponsor_type === individual";
const SPONSOR_IS_CORPORATE = "sponsor_type === corporate";
const VISITED_INDONESIA_BEFORE = "visited_indonesia_before === yes";
const REFUSED_INDONESIA = "refused_visa_or_entry_indonesia === yes";
const REFUSED_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";
const HAS_OVERSTAYED = "has_overstayed_indonesia === yes";

// ── Enum option tables ─────────────────────────────────────────────────────

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
];

const PASSPORT_TYPE_OPTIONS = [
  { value: "ordinary", text: "Ordinary" },
  { value: "diplomatic", text: "Diplomatic" },
  { value: "official", text: "Official / Service" },
  { value: "travel_document", text: "Travel document (non-passport)" },
  { value: "other", text: "Other" },
];

const MARITAL_STATUS_OPTIONS = [
  { value: "single", text: "Single" },
  { value: "married", text: "Married" },
  { value: "divorced", text: "Divorced" },
  { value: "widowed", text: "Widowed" },
];

const OCCUPATION_OPTIONS = [
  { value: "employed", text: "Employed" },
  { value: "self_employed", text: "Self-employed" },
  { value: "student", text: "Student" },
  { value: "retired", text: "Retired" },
  { value: "housewife", text: "Housewife / Homemaker" },
  { value: "unemployed", text: "Unemployed" },
  { value: "other", text: "Other" },
];

// C1 Tourist scope is locked to tourism. Other Indonesia visit purposes
// (business meeting, government, family visit, medical) belong on future
// packages with their own schemas.
const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "villa", text: "Villa / Short-term rental" },
  { value: "friend_or_relative", text: "Friend or relative's residence" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [
  { value: "self", text: "Self" },
  { value: "employer", text: "Employer" },
  { value: "sponsor", text: "Sponsor in Indonesia" },
  { value: "family", text: "Family member" },
  { value: "other", text: "Other" },
];

const SPONSOR_TYPE_OPTIONS = [
  { value: "individual", text: "Individual (Indonesian citizen, age 21+ or married)" },
  { value: "corporate", text: "Corporate (registered Indonesian company / institution)" },
];

const FIELDS: FieldDef[] = [
  // ═════════════════════════════════════════════════════════════════════════
  // STEP 1: Personal Information
  // (eVisa registration: full name, sex, place of birth, DOB, phone,
  //  mother's name; plus marital status / nationality / ID number)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "surname", label: "Surname (Family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, placeholder: "Latin characters as shown in passport", validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, placeholder: "Latin characters as shown in passport", validation_rules: { maxLength: 80 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names (former names, aliases)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, options: SEX_OPTIONS },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship (current or former)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "id_card_number", label: "National ID number (if your country issues one)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 12, placeholder: "National ID / NIK / equivalent", validation_rules: { maxLength: 30 } },
  { field_name: "mother_full_name", label: "Mother's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 13, placeholder: "Required by Indonesian Immigration", validation_rules: { maxLength: 120 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_date_of_birth", label: "Spouse — Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { format: "DD/MM/YYYY", block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 17, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 2: Passport / Travel Document
  // (eVisa passport block: number, type, country, issue/expiry, issuing
  //  authority + other-passports gate)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "passport_number", label: "Passport / travel document number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Document type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_country", label: "Passport / document — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 4, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, placeholder: "Must be valid 6+ months on entry", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_place_of_issue", label: "Place of issue", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 6, validation_rules: { maxLength: 80 } },
  { field_name: "passport_issuing_authority", label: "Issuing authority", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 7, validation_rules: { maxLength: 100 } },
  { field_name: "has_other_passports", label: "Do you currently hold or have you previously held any other passport (including a different passport from the same country)?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 8, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport — Number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 9, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 10, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 3: Contact & Home Address (abroad)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "home_address_line1", label: "Home address — Street / Apartment", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_state", label: "Home address — State / Province", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Home address — Postcode", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 4, validation_rules: { maxLength: 20, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 5, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "telephone_number", label: "Telephone number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 6, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 7, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 8, placeholder: "name@example.com", validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 4: Occupation
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "current_profession", label: "Current profession or occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: OCCUPATION_OPTIONS },
  { field_name: "position_title", label: "Position / Title", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "employer_or_school_name", label: "Name of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 3, validation_rules: { maxLength: 120, block_group: "employer_details" } },
  { field_name: "employer_or_school_address", label: "Address of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, validation_rules: { maxLength: 200, block_group: "employer_details" } },
  { field_name: "employer_or_school_phone", label: "Telephone of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 5, validation_rules: { maxLength: 30, block_group: "employer_details" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 5: Trip Details
  // (Purpose locked to tourism; arrival, length of stay, port of entry,
  //  carrier, accommodation in Indonesia, expense bearer)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "purpose_of_visit", label: "Purpose of visit to Indonesia", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in Indonesia", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay in Indonesia (days, max 60)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, placeholder: "e.g. 14", validation_rules: { pattern: "^(?:[1-9]|[1-5][0-9]|60)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Port of entry into Indonesia", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, placeholder: "e.g. Soekarno-Hatta International Airport, Ngurah Rai", validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline or carrier", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, placeholder: "e.g. Garuda Indonesia, Singapore Airlines", validation_rules: { maxLength: 80 } },
  { field_name: "flight_or_voyage_number", label: "Flight or voyage number", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, placeholder: "e.g. GA 871", validation_rules: { maxLength: 20 } },
  { field_name: "accommodation_type", label: "Type of accommodation in Indonesia", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 7, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of hotel / villa / host", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 8, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address of accommodation in Indonesia", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_city_or_district", label: "City or district in Indonesia", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, placeholder: "e.g. Kuta, Denpasar, Jakarta", validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "accommodation_phone", label: "Telephone of hotel or host", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 11, validation_rules: { maxLength: 30, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 12, options: EXPENSE_BEARER_OPTIONS },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 6: Sponsor / Guarantor in Indonesia
  // (Optional for self-applied C1 via the eVisa portal; required if applying
  //  the extendable C1 pathway through visa-online.imigrasi.go.id.)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "has_sponsor_in_indonesia", label: "Do you have a sponsor or guarantor in Indonesia?", field_type: "radio", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 1, options: YES_NO },
  { field_name: "sponsor_type", label: "Sponsor — Type", field_type: "select", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 2, conditional_logic: { showIf: HAS_SPONSOR }, options: SPONSOR_TYPE_OPTIONS, validation_rules: { block_group: "sponsor" } },
  { field_name: "sponsor_individual_full_name", label: "Sponsor — Full name (individual)", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 3, conditional_logic: { showIf: SPONSOR_IS_INDIVIDUAL }, validation_rules: { maxLength: 120, block_group: "sponsor" } },
  { field_name: "sponsor_individual_nik", label: "Sponsor — Indonesian NIK (KTP number)", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 4, conditional_logic: { showIf: SPONSOR_IS_INDIVIDUAL }, placeholder: "16-digit Nomor Induk Kependudukan", validation_rules: { maxLength: 16, pattern: "^[0-9]{16}$", block_group: "sponsor" } },
  { field_name: "sponsor_individual_relationship", label: "Sponsor — Relationship to applicant", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 5, conditional_logic: { showIf: SPONSOR_IS_INDIVIDUAL }, placeholder: "e.g. friend, spouse, business contact", validation_rules: { maxLength: 80, block_group: "sponsor" } },
  { field_name: "sponsor_corporate_name", label: "Sponsor — Company / institution name", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 6, conditional_logic: { showIf: SPONSOR_IS_CORPORATE }, validation_rules: { maxLength: 200, block_group: "sponsor" } },
  { field_name: "sponsor_corporate_nib", label: "Sponsor — Indonesian Business Registration (NIB)", field_type: "text", required: false, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 7, conditional_logic: { showIf: SPONSOR_IS_CORPORATE }, placeholder: "13-digit Nomor Induk Berusaha", validation_rules: { maxLength: 20, block_group: "sponsor" } },
  { field_name: "sponsor_corporate_npwp", label: "Sponsor — Indonesian Tax ID (NPWP)", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 8, conditional_logic: { showIf: SPONSOR_IS_CORPORATE }, placeholder: "15-16 digit Nomor Pokok Wajib Pajak", validation_rules: { maxLength: 20, block_group: "sponsor" } },
  { field_name: "sponsor_corporate_pic_name", label: "Sponsor — Person in charge (PIC) name", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 9, conditional_logic: { showIf: SPONSOR_IS_CORPORATE }, validation_rules: { maxLength: 120, block_group: "sponsor" } },
  { field_name: "sponsor_address", label: "Sponsor — Address in Indonesia", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 10, conditional_logic: { showIf: HAS_SPONSOR }, validation_rules: { maxLength: 200, block_group: "sponsor" } },
  { field_name: "sponsor_phone", label: "Sponsor — Telephone (incl. country/area code)", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 11, conditional_logic: { showIf: HAS_SPONSOR }, validation_rules: { maxLength: 30, block_group: "sponsor" } },
  { field_name: "sponsor_email", label: "Sponsor — Email", field_type: "text", required: true, step_number: 6, step_name: "Sponsor in Indonesia", display_order: 12, conditional_logic: { showIf: HAS_SPONSOR }, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "sponsor" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 7: Travel History
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "visited_indonesia_before", label: "Have you ever stayed in Indonesia before?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_indonesia_visit_arrival_date", label: "Prior Indonesia visit — Arrival date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_INDONESIA_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_indonesia_visits", max_items: 5 } },
  { field_name: "prior_indonesia_visit_departure_date", label: "Prior Indonesia visit — Departure date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_INDONESIA_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_indonesia_visits" } },
  { field_name: "prior_indonesia_visit_purpose", label: "Prior Indonesia visit — Purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_INDONESIA_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_indonesia_visits" } },
  { field_name: "prior_indonesia_visit_visa_type", label: "Prior Indonesia visit — Visa type used", field_type: "text", required: false, step_number: 7, step_name: "Travel History", display_order: 5, conditional_logic: { showIf: VISITED_INDONESIA_BEFORE }, placeholder: "e.g. eVOA, B211A, C1, KITAS", validation_rules: { maxLength: 60, repeatable: true, repeat_group: "prior_indonesia_visits" } },
  { field_name: "refused_visa_or_entry_indonesia", label: "Have you ever been refused a visa to, or denied entry into, Indonesia?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 6, options: YES_NO },
  { field_name: "refused_visa_indonesia_details", label: "Provide details (date, place, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 7, conditional_logic: { showIf: REFUSED_INDONESIA }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 8, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 9, conditional_logic: { showIf: REFUSED_OTHER }, validation_rules: { maxLength: 1000 } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 8: Character & Declaration
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 1, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details (country, date, charge, sentence)", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 2, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported from Indonesia or any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 3, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 4, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_overstayed_indonesia", label: "Have you ever overstayed a visa or stayed in Indonesia illegally?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 5, options: YES_NO },
  { field_name: "overstay_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 6, conditional_logic: { showIf: HAS_OVERSTAYED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_drug_or_trafficking_history", label: "Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 7, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 8, step_name: "Character & Declaration", display_order: 8, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 9, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa, denial of entry, or deportation from Indonesia.", field_type: "checkbox", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 10, options: [{ value: "yes", text: "I agree" }] },
];

// ─── Seed Runner ──────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);

  const { error: delError } = await supabase
    .from("visa_form_fields")
    .delete()
    .eq("visa_type", VISA_TYPE);
  if (delError) {
    console.error(`Error deleting existing ${VISA_TYPE} fields:`, delError.message);
  } else {
    console.log(`Cleared existing ${VISA_TYPE} fields`);
  }

  const rows = FIELDS.map((f) => ({
    visa_type: VISA_TYPE,
    field_name: f.field_name,
    label: f.label,
    field_type: f.field_type,
    required: f.required,
    step_number: f.step_number,
    step_name: f.step_name,
    display_order: f.display_order,
    placeholder: f.placeholder ?? null,
    validation_rules: f.validation_rules ?? null,
    options: f.options ?? null,
    conditional_logic: f.conditional_logic ?? null,
  }));

  const BATCH = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("visa_form_fields")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      total += data?.length ?? 0;
      process.stdout.write(`Batch ${Math.floor(i / BATCH) + 1}: ${data?.length ?? 0} inserted\n`);
    }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
