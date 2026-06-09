/**
 * Seed script: visa_form_fields for Japan Tourist Visa (Short-Term Stay).
 *
 * Field definitions mirror the Japan Ministry of Foreign Affairs
 * "Application for Visa" form (Form A), the canonical paper form used
 * worldwide for Short-Term Stay (Tourism) applications. Source:
 * https://www.mofa.go.jp/files/000124525.pdf (MOFA Form A, English).
 *
 * Scope: Tourist Short-Term Stay only, intended for mainland-China (PRC)
 * residents who submit through a designated travel agency (JVAC China)
 * since evisa.mofa.go.jp is not directly accessible to PRC residents.
 * The schema is form-content only — submission to the agency happens
 * out-of-band (paper / agency upload), so there is no submission
 * automation target. Other Tourism-eligible nationalities can also use
 * this schema; their submission channel (embassy or eVisa portal) is
 * tracked in the gap report rather than the schema.
 *
 * Document uploads (passport bio page, photo, itinerary, financial
 * proof, employer letter, travel insurance) are intentionally out of
 * schema per playbook §5.6 — they live in application_documents.
 *
 * Run: npx tsx scripts/seed-jp-tourist-form-fields.ts
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

const VISA_TYPE = "JP_TOURIST";

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
const HAS_INVITER = "has_inviter_in_japan === yes";
const VISITED_JAPAN_BEFORE = "visited_japan_before === yes";
const REFUSED_JAPAN = "refused_visa_or_entry_japan === yes";
const REFUSED_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";
const HAS_OVERSTAYED = "has_overstayed_japan === yes";

// ── Enum option tables ─────────────────────────────────────────────────────

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
];

const PASSPORT_TYPE_OPTIONS = [
  { value: "ordinary", text: "Ordinary" },
  { value: "diplomatic", text: "Diplomatic" },
  { value: "official", text: "Official" },
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

// MOFA Form A item 16. Locked to tourism for the JP_TOURIST package; other
// purposes (business visit, conference, spouse, work, study) belong on
// future packages with their own schemas.
const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "inviter_residence", text: "Residence of inviter" },
  { value: "friend_or_relative", text: "Friend or relative's residence" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [
  { value: "self", text: "Self" },
  { value: "employer", text: "Employer" },
  { value: "inviter", text: "Inviter in Japan" },
  { value: "family", text: "Family member" },
  { value: "other", text: "Other" },
];

const FIELDS: FieldDef[] = [
  // ═════════════════════════════════════════════════════════════════════════
  // STEP 1: Personal Information  (MOFA Form A items 1-9 + marital block)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "surname", label: "Surname (Family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, placeholder: "As shown in passport", validation_rules: { maxLength: 80 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names (former names, pen names, aliases)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, options: SEX_OPTIONS },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_state", label: "Place of birth — State / Province", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship (current or former)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "id_card_number", label: "ID number issued to you (if your country requires one)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 13, placeholder: "National ID / Hukou ID / Resident card", validation_rules: { maxLength: 30 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_date_of_birth", label: "Spouse — Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { format: "DD/MM/YYYY", block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 17, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 2: Passport  (MOFA Form A items 10-15 + other-passports gate)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 3, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 4, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_place_of_issue", label: "Place of issue", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 5, validation_rules: { maxLength: 80 } },
  { field_name: "passport_issuing_authority", label: "Issuing authority", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 6, validation_rules: { maxLength: 100 } },
  { field_name: "has_other_passports", label: "Do you currently hold or have you previously held any other passport (including a different passport from the same country)?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 7, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 9, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 3: Contact & Home Address  (MOFA Form A item 23)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "home_address_line1", label: "Home address — Street / Apartment", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "telephone_number", label: "Telephone number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 4, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 5, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 6, placeholder: "name@example.com", validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 4: Occupation  (MOFA Form A item 24)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "current_profession", label: "Current profession or occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: OCCUPATION_OPTIONS },
  { field_name: "position_title", label: "Position / Title", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "employer_or_school_name", label: "Name of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 3, validation_rules: { maxLength: 120, block_group: "employer_details" } },
  { field_name: "employer_or_school_address", label: "Address of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, validation_rules: { maxLength: 200, block_group: "employer_details" } },
  { field_name: "employer_or_school_phone", label: "Telephone of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 5, validation_rules: { maxLength: 30, block_group: "employer_details" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 5: Trip Details  (MOFA Form A items 16-21)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "purpose_of_visit", label: "Purpose of visit to Japan", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in Japan", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay in Japan (days)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, placeholder: "e.g. 7", validation_rules: { pattern: "^(?:[1-9][0-9]?|[12][0-9]{2}|30)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Port of entry into Japan", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, placeholder: "e.g. Narita International Airport", validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of ship or airline", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, placeholder: "e.g. ANA, JAL, Air China", validation_rules: { maxLength: 80 } },
  { field_name: "accommodation_type", label: "Type of accommodation in Japan", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of hotel or person hosting you", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 7, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address of hotel or host in Japan", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 8, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_phone", label: "Telephone of hotel or host", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, validation_rules: { maxLength: 30, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, options: EXPENSE_BEARER_OPTIONS },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 6: Inviter / Guarantor in Japan  (MOFA Form A items 25-31)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "has_inviter_in_japan", label: "Do you have an inviter or guarantor in Japan?", field_type: "radio", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 1, options: YES_NO },
  { field_name: "inviter_full_name", label: "Inviter — Full name", field_type: "text", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 2, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 120, block_group: "inviter" } },
  { field_name: "inviter_address", label: "Inviter — Address in Japan", field_type: "text", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 3, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 200, block_group: "inviter" } },
  { field_name: "inviter_phone", label: "Inviter — Telephone (incl. country/area code)", field_type: "text", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 4, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 30, block_group: "inviter" } },
  { field_name: "inviter_date_of_birth", label: "Inviter — Date of birth", field_type: "date", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 5, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { format: "DD/MM/YYYY", block_group: "inviter" } },
  { field_name: "inviter_sex", label: "Inviter — Sex", field_type: "select", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 6, conditional_logic: { showIf: HAS_INVITER }, options: SEX_OPTIONS, validation_rules: { block_group: "inviter" } },
  { field_name: "inviter_nationality", label: "Inviter — Nationality", field_type: "country", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 7, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { source: "ISO3166-1", block_group: "inviter" } },
  { field_name: "inviter_occupation", label: "Inviter — Occupation", field_type: "text", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 8, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 80, block_group: "inviter" } },
  { field_name: "inviter_employer", label: "Inviter — Name & address of employer in Japan", field_type: "text", required: false, step_number: 6, step_name: "Inviter in Japan", display_order: 9, conditional_logic: { showIf: HAS_INVITER }, validation_rules: { maxLength: 200, block_group: "inviter" } },
  { field_name: "inviter_relationship_to_applicant", label: "Inviter — Relationship to applicant", field_type: "text", required: true, step_number: 6, step_name: "Inviter in Japan", display_order: 10, conditional_logic: { showIf: HAS_INVITER }, placeholder: "e.g. friend, business partner, relative", validation_rules: { maxLength: 80, block_group: "inviter" } },
  { field_name: "inviter_immigration_status", label: "Inviter — Immigration status in Japan (foreign nationals only)", field_type: "text", required: false, step_number: 6, step_name: "Inviter in Japan", display_order: 11, conditional_logic: { showIf: HAS_INVITER }, placeholder: "e.g. permanent resident, work visa holder", validation_rules: { maxLength: 80, block_group: "inviter" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 7: Travel History  (MOFA Form A item 22 + refusals)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "visited_japan_before", label: "Have you ever stayed in Japan before?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_japan_visit_arrival_date", label: "Prior Japan visit — Arrival date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_JAPAN_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_japan_visits", max_items: 5 } },
  { field_name: "prior_japan_visit_departure_date", label: "Prior Japan visit — Departure date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_JAPAN_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_japan_visits" } },
  { field_name: "prior_japan_visit_purpose", label: "Prior Japan visit — Purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_JAPAN_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_japan_visits" } },
  { field_name: "refused_visa_or_entry_japan", label: "Have you ever been refused a visa to, or denied entry into, Japan?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 5, options: YES_NO },
  { field_name: "refused_visa_japan_details", label: "Provide details (date, place, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 6, conditional_logic: { showIf: REFUSED_JAPAN }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 7, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 8, conditional_logic: { showIf: REFUSED_OTHER }, validation_rules: { maxLength: 1000 } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 8: Character & Declaration  (MOFA Form A items 33-37 + signature)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 1, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details (country, date, charge, sentence)", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 2, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported from Japan or any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 3, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 4, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_overstayed_japan", label: "Have you ever overstayed a visa or stayed in Japan illegally?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 5, options: YES_NO },
  { field_name: "overstay_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 6, conditional_logic: { showIf: HAS_OVERSTAYED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_drug_or_trafficking_history", label: "Have you ever been involved in drug abuse, prostitution, human trafficking, smuggling, or possession of illegal weapons?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 7, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 8, step_name: "Character & Declaration", display_order: 8, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 9, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Japan.", field_type: "checkbox", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 10, options: [{ value: "yes", text: "I agree" }] },
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

  const rows = FIELDS.map((f) => toBilingualSeedRow(VISA_TYPE, f));

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
