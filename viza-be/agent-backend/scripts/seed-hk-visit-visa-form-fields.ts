/**
 * Seed script: visa_form_fields for Hong Kong Visit Visa.
 *
 * Field definitions mirror the Hong Kong Immigration Department (ImmD)
 * Form ID 936 — Application for Visa to enter Hong Kong (Visitor) — and
 * the supplementary Form ID 1003A. The Hong Kong Visit Visa is largely
 * a paper-based application submitted by post to the Hong Kong ImmD or
 * via Chinese consular posts abroad — there is no general online
 * application portal for non-Indian, non-PAR visitors. The Pre-arrival
 * Registration (PAR) flow at `https://www.immd.gov.hk/par` is in scope
 * only for Indian nationals (covered as the variant gate).
 *
 * The schema captures the field set so VIZA can pre-fill, store, and
 * print Form ID 936 for posted submission, OR drive PAR online for
 * Indian nationals once submission automation is wired in a future
 * iteration. Same posture as JP_TOURIST, EG_E_VISA, TH_TOURIST_E_VISA,
 * MY_TOURIST_E_VISA, SG_VISITOR_VISA.
 *
 * Scope: Visit Visa (Tourist) only — general single-entry / multiple-
 * entry for the ~76 visa-required nationalities, plus Indian-national
 * Pre-arrival Registration (PAR) as a variant gate. Variant captured
 * by the `visa_type_requested` radio.
 *
 * Out of scope: Right of Abode, Right to Land, Hong Kong Identity Card
 * application, Employment Visa (HK General Employment Policy / GEP),
 * Quality Migrant Admission Scheme (QMAS), Top Talent Pass Scheme
 * (TTPS), Investment as Entrepreneurs, Working Holiday Scheme,
 * Dependant Visa, Student Visa, training programmes, and Mainland-
 * specific entry permits.
 *
 * Document uploads (passport bio, photo, hotel/itinerary, return ticket,
 * financial proof, sponsor letter where applicable) are out-of-schema
 * per playbook §5.6 — they live in application_documents.
 *
 * Run: npx tsx scripts/seed-hk-visit-visa-form-fields.ts
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

const VISA_TYPE = "HK_VISIT_VISA";

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

const HAS_OTHER_NAMES = "has_other_names_used === yes";
const HAS_OTHER_NATIONALITIES = "has_other_nationalities === yes";
const IS_MARRIED = "marital_status === married";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const HAS_HOST_IN_HK = "has_host_in_hong_kong === yes";
const VISITED_HK_BEFORE = "visited_hong_kong_before === yes";
const REFUSED_VISA_HK = "refused_visa_or_entry_hong_kong === yes";
const REFUSED_VISA_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
];

const PASSPORT_TYPE_OPTIONS = [
  { value: "ordinary", text: "Ordinary" },
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
  { value: "businessperson", text: "Businessperson" },
  { value: "student", text: "Student" },
  { value: "retired", text: "Retired" },
  { value: "homemaker", text: "Homemaker" },
  { value: "unemployed", text: "Unemployed" },
  { value: "other", text: "Other" },
];

const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism / Visit" },
];

// HK has two distinct flows under "visit": Form ID 936 (general visit
// visa, paper / posted submission) and the online Pre-arrival
// Registration (PAR) for Indian nationals only. Both produce the same
// short-stay outcome (~14-90 day stay depending on nationality).
const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "form_id_936_single", text: "Visit Visa via Form ID 936 — Single entry, ~HKD 230" },
  { value: "form_id_936_multiple", text: "Visit Visa via Form ID 936 — Multiple entry, ~HKD 460" },
  { value: "par_indian", text: "Pre-arrival Registration (Indian nationals only, free)" },
];

const PORT_OF_ENTRY_OPTIONS = [
  { value: "hk_intl_airport", text: "Hong Kong International Airport (HKG)" },
  { value: "lo_wu_land", text: "Lo Wu Control Point (Mainland border, rail)" },
  { value: "lok_ma_chau_land", text: "Lok Ma Chau Control Point (Mainland border, road)" },
  { value: "lok_ma_chau_spur_line_rail", text: "Lok Ma Chau Spur Line / Futian (Mainland border, rail)" },
  { value: "shenzhen_bay_land", text: "Shenzhen Bay Control Point (Mainland border, road)" },
  { value: "hzmb_land", text: "Hong Kong-Zhuhai-Macao Bridge Control Point (Mainland / Macao border, road)" },
  { value: "west_kowloon_rail", text: "Hong Kong West Kowloon Station (high-speed rail, Mainland)" },
  { value: "china_ferry_terminal", text: "China Ferry Terminal, Tsim Sha Tsui (sea, Mainland / Macao)" },
  { value: "macau_ferry_terminal", text: "Macau (Hong Kong) Ferry Terminal, Sheung Wan (sea, Macao)" },
  { value: "kai_tak_cruise", text: "Kai Tak Cruise Terminal (cruise)" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "rental_apartment", text: "Service apartment / Short-term rental" },
  { value: "host_residence", text: "Residence of host (friend or relative)" },
  { value: "guesthouse", text: "Hostel / Guesthouse" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [
  { value: "self", text: "Self" },
  { value: "employer", text: "Employer" },
  { value: "family", text: "Family member" },
  { value: "host", text: "Host in Hong Kong" },
  { value: "other", text: "Other" },
];

const FIELDS: FieldDef[] = [
  // STEP 1: Personal Information
  { field_name: "surname", label: "Surname (Family name) — in English", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names — in English", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, placeholder: "As shown in passport", validation_rules: { maxLength: 80 } },
  { field_name: "name_in_chinese", label: "Name in Chinese characters (if applicable)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 3, validation_rules: { maxLength: 30 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names (former names, maiden name, aliases)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship (current or former)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "national_id_number", label: "National ID number (if your country issues one)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 13, placeholder: "National ID / Resident card number", validation_rules: { maxLength: 30 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "father_full_name", label: "Father's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 17, validation_rules: { maxLength: 120 } },
  { field_name: "mother_full_name", label: "Mother's full name (including maiden name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 18, validation_rules: { maxLength: 120 } },

  // STEP 2: Passport
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_place_of_issue", label: "Place of issue (city / authority)", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { maxLength: 100 } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 6, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "has_other_passports", label: "Do you currently hold or have you previously held any other passport?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 7, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 9, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // STEP 3: Contact & Home Address
  { field_name: "home_address_line1", label: "Home address — Street / Apartment", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_state", label: "Home address — State / Province", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Home address — Postal code", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 4, validation_rules: { maxLength: 20, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 5, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "telephone_number", label: "Telephone number", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 6, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 7, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 8, placeholder: "name@example.com", validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // STEP 4: Occupation
  { field_name: "current_profession", label: "Current profession or occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: OCCUPATION_OPTIONS },
  { field_name: "position_title", label: "Position / Title", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "employer_or_school_name", label: "Name of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 3, validation_rules: { maxLength: 120, block_group: "employer_details" } },
  { field_name: "employer_or_school_address", label: "Address of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, validation_rules: { maxLength: 200, block_group: "employer_details" } },
  { field_name: "employer_or_school_phone", label: "Telephone of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 5, validation_rules: { maxLength: 30, block_group: "employer_details" } },

  // STEP 5: Trip Details
  { field_name: "visa_type_requested", label: "Visa type requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to Hong Kong", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in Hong Kong", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, placeholder: "e.g. 14", validation_rules: { pattern: "^(?:[1-9]|[1-8][0-9]|90)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Intended port of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline, ship, or transport carrier", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 7, placeholder: "e.g. Cathay Pacific, Hong Kong Airlines, MTR", validation_rules: { maxLength: 80 } },
  { field_name: "flight_number", label: "Flight or train number (if known)", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 8, placeholder: "e.g. CX846", validation_rules: { maxLength: 30 } },
  { field_name: "accommodation_type", label: "Type of accommodation in Hong Kong", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of hotel or property", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address in Hong Kong", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 11, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_district", label: "District in Hong Kong", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 12, placeholder: "e.g. Tsim Sha Tsui, Central, Mong Kok", validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "accommodation_phone", label: "Telephone of accommodation", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 13, validation_rules: { maxLength: 30, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 14, options: EXPENSE_BEARER_OPTIONS },

  // STEP 6: Host in Hong Kong (optional sub-journey)
  { field_name: "has_host_in_hong_kong", label: "Do you have a host (friend, relative, or sponsor) in Hong Kong?", field_type: "radio", required: true, step_number: 6, step_name: "Host in Hong Kong", display_order: 1, options: YES_NO },
  { field_name: "host_full_name", label: "Host — Full name", field_type: "text", required: true, step_number: 6, step_name: "Host in Hong Kong", display_order: 2, conditional_logic: { showIf: HAS_HOST_IN_HK }, validation_rules: { maxLength: 120, block_group: "host" } },
  { field_name: "host_relationship_to_applicant", label: "Host — Relationship to applicant", field_type: "text", required: true, step_number: 6, step_name: "Host in Hong Kong", display_order: 3, conditional_logic: { showIf: HAS_HOST_IN_HK }, validation_rules: { maxLength: 80, block_group: "host" } },
  { field_name: "host_address", label: "Host — Address in Hong Kong", field_type: "text", required: true, step_number: 6, step_name: "Host in Hong Kong", display_order: 4, conditional_logic: { showIf: HAS_HOST_IN_HK }, validation_rules: { maxLength: 200, block_group: "host" } },
  { field_name: "host_phone", label: "Host — Telephone (incl. country code)", field_type: "text", required: true, step_number: 6, step_name: "Host in Hong Kong", display_order: 5, conditional_logic: { showIf: HAS_HOST_IN_HK }, validation_rules: { maxLength: 30, block_group: "host" } },
  { field_name: "host_hkid_or_passport", label: "Host — HKID number or passport number", field_type: "text", required: true, step_number: 6, step_name: "Host in Hong Kong", display_order: 6, conditional_logic: { showIf: HAS_HOST_IN_HK }, placeholder: "e.g. A123456(7) or passport number", validation_rules: { maxLength: 30, block_group: "host" } },
  { field_name: "host_nationality", label: "Host — Nationality / Status in HK", field_type: "country", required: true, step_number: 6, step_name: "Host in Hong Kong", display_order: 7, conditional_logic: { showIf: HAS_HOST_IN_HK }, validation_rules: { source: "ISO3166-1", block_group: "host" } },

  // STEP 7: Travel History
  { field_name: "visited_hong_kong_before", label: "Have you ever visited Hong Kong before?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_hk_visit_arrival_date", label: "Prior Hong Kong visit — Arrival date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_HK_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_hk_visits", max_items: 5 } },
  { field_name: "prior_hk_visit_departure_date", label: "Prior Hong Kong visit — Departure date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_HK_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_hk_visits" } },
  { field_name: "prior_hk_visit_purpose", label: "Prior Hong Kong visit — Purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_HK_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_hk_visits" } },
  { field_name: "refused_visa_or_entry_hong_kong", label: "Have you ever been refused a visa to, or denied entry into, Hong Kong?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 5, options: YES_NO },
  { field_name: "refused_visa_hk_details", label: "Provide details (date, place, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 6, conditional_logic: { showIf: REFUSED_VISA_HK }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 7, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 8, conditional_logic: { showIf: REFUSED_VISA_OTHER }, validation_rules: { maxLength: 1000 } },

  // STEP 8: Character & Declaration
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 1, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details (country, date, charge, sentence)", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 2, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported from Hong Kong or any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 3, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 4, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_terrorism_or_security_history", label: "Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 5, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 8, step_name: "Character & Declaration", display_order: 6, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 7, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Hong Kong Special Administrative Region of the People's Republic of China.", field_type: "checkbox", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 8, options: [{ value: "yes", text: "I agree" }] },
];

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
