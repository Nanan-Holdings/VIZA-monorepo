/**
 * Seed script: visa_form_fields for Malaysia Tourist eVISA.
 *
 * Field definitions mirror the Malaysian Department of Immigration eVISA
 * application at `https://malaysiavisa.imi.gov.my` (operated by Jabatan
 * Imigresen Malaysia, Kementerian Dalam Negeri). The portal is identity-
 * gated and requires an applicant account — live-portal driving is not
 * possible from unauthenticated tooling. The schema is therefore a
 * high-fidelity reconstruction from the eVISA public landing pages, the
 * High Commission applicant guidance pages (London, New Delhi, Beijing,
 * Riyadh variants cross-checked), and the IMM.47 paper application form
 * which the eVISA mirrors field-for-field — same posture as JP_TOURIST,
 * ID_C1_TOURIST, EG_E_VISA, TH_TOURIST_E_VISA.
 *
 * Scope: Tourist eVISA only — single-entry (~USD 50, 3-month validity,
 * 30-day max stay) and multi-entry (~USD 100, 12-month validity, 30-day
 * max stay per entry) variants. Variant captured by the
 * `visa_type_requested` radio.
 *
 * Out of scope: Employment Pass / DP10 / Pass categories (Expatriate
 * Committee, MyXpats / MDEC, MM2H Long-Term Social Visit Pass, Premium
 * Visa Programme PVIP, Sarawak / Sabah-internal entry permits — separate
 * portals + consular flow), visa-on-arrival for the ~9 eligible countries
 * (paid at the kiosk, no online form), and visa exemption (no
 * application required for ~160 nationalities for short visits).
 *
 * Document uploads (passport bio page, photo, hotel/itinerary, return
 * ticket, financial proof) are intentionally out-of-schema per playbook
 * §5.6 — they live in application_documents.
 *
 * Run: npx tsx scripts/seed-my-tourist-e-visa-form-fields.ts
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

const VISA_TYPE = "MY_TOURIST_E_VISA";

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
const HAS_HOST_IN_MALAYSIA = "has_host_in_malaysia === yes";
const VISITED_MALAYSIA_BEFORE = "visited_malaysia_before === yes";
const REFUSED_VISA_MALAYSIA = "refused_visa_or_entry_malaysia === yes";
const REFUSED_VISA_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";

// ── Enum option tables ─────────────────────────────────────────────────────

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
];

// Malaysian eVISA is restricted to Ordinary passport holders. Diplomatic /
// Official / Service passport entries fall under bilateral agreements and
// route through consular channels, not the eVISA portal.
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

// MY_TOURIST_E_VISA scope is locked to tourism. Other purposes (business
// / employment / medical / education / MM2H) use distinct portals or
// consular flow — covered by future packages.
const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism" },
];

// Two entry-frequency variants on the Malaysia eVISA portal under the
// same Tourist visa landing.
const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "single", text: "Single-entry eVISA — 3-month validity, 30-day stay, ~USD 50" },
  { value: "multiple", text: "Multiple-entry eVISA — 12-month validity, 30-day stay per entry, ~USD 100" },
];

// Major international airports + key land / sea border posts listed on
// the Malaysian Immigration Department eVISA landing.
const PORT_OF_ENTRY_OPTIONS = [
  { value: "klia", text: "Kuala Lumpur International Airport (KLIA)" },
  { value: "klia2", text: "KLIA2 / klia2 Terminal" },
  { value: "penang_intl", text: "Penang International Airport (PEN)" },
  { value: "kota_kinabalu_intl", text: "Kota Kinabalu International Airport (BKI)" },
  { value: "langkawi_intl", text: "Langkawi International Airport (LGK)" },
  { value: "johor_senai", text: "Senai International Airport, Johor Bahru (JHB)" },
  { value: "kuching_intl", text: "Kuching International Airport (KCH)" },
  { value: "miri_airport", text: "Miri Airport, Sarawak (MYY)" },
  { value: "bukit_kayu_hitam_land", text: "Bukit Kayu Hitam (Thailand border, Kedah)" },
  { value: "padang_besar_land", text: "Padang Besar (Thailand border, Perlis)" },
  { value: "johor_causeway_land", text: "Johor-Singapore Causeway (Woodlands)" },
  { value: "second_link_land", text: "Tuas Second Link (Singapore)" },
  { value: "tebedu_land", text: "Tebedu (Indonesia border, Sarawak)" },
  { value: "sungai_tujoh_land", text: "Sungai Tujoh (Brunei border, Sarawak)" },
  { value: "port_klang_seaport", text: "Port Klang Seaport" },
  { value: "penang_seaport", text: "Penang Port (Swettenham Pier)" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "resort", text: "Resort" },
  { value: "rental_apartment", text: "Rental apartment / Service apartment" },
  { value: "host_residence", text: "Residence of host (friend or relative)" },
  { value: "guesthouse", text: "Hostel / Guesthouse" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [
  { value: "self", text: "Self" },
  { value: "employer", text: "Employer" },
  { value: "family", text: "Family member" },
  { value: "host", text: "Host in Malaysia" },
  { value: "other", text: "Other" },
];

const FIELDS: FieldDef[] = [
  // ═════════════════════════════════════════════════════════════════════════
  // STEP 1: Personal Information
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "surname", label: "Surname (Family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, placeholder: "As shown in passport", validation_rules: { maxLength: 80 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names (former names, maiden name, aliases)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "race_ethnicity", label: "Race / Ethnicity (as collected by Malaysian immigration)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 10, placeholder: "e.g. Chinese, Indian, Malay, Caucasian", validation_rules: { maxLength: 60 } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship (current or former)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "national_id_number", label: "National ID number (if your country issues one)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 13, placeholder: "National ID / Resident card number", validation_rules: { maxLength: 30 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "father_full_name", label: "Father's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 17, validation_rules: { maxLength: 120 } },
  { field_name: "mother_full_name", label: "Mother's full name (including maiden name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 18, validation_rules: { maxLength: 120 } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 2: Passport
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_place_of_issue", label: "Place of issue (city / authority)", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { maxLength: 100 } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 6, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "has_other_passports", label: "Do you currently hold or have you previously held any other passport?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 7, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 9, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 3: Contact & Home Address
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "home_address_line1", label: "Home address — Street / Apartment", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_state", label: "Home address — State / Province", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Home address — Postal code", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 4, validation_rules: { maxLength: 20, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 5, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "telephone_number", label: "Telephone number", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 6, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 7, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
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
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "visa_type_requested", label: "Visa type requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to Malaysia", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in Malaysia", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 30 per entry)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, placeholder: "e.g. 14", validation_rules: { pattern: "^(?:[1-9]|[12][0-9]|30)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Intended port of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline, ship, or transport carrier", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 7, placeholder: "e.g. Malaysia Airlines, AirAsia, Singapore Airlines", validation_rules: { maxLength: 80 } },
  { field_name: "flight_number", label: "Flight number (if known)", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 8, placeholder: "e.g. MH604", validation_rules: { maxLength: 30 } },
  { field_name: "accommodation_type", label: "Type of accommodation in Malaysia", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of hotel, resort, or property", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address in Malaysia", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 11, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_city", label: "City / State in Malaysia", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 12, validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "accommodation_phone", label: "Telephone of accommodation", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 13, validation_rules: { maxLength: 30, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 14, options: EXPENSE_BEARER_OPTIONS },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 6: Host in Malaysia (optional sub-journey)
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "has_host_in_malaysia", label: "Do you have a host (friend, relative, or sponsor) in Malaysia?", field_type: "radio", required: true, step_number: 6, step_name: "Host in Malaysia", display_order: 1, options: YES_NO },
  { field_name: "host_full_name", label: "Host — Full name", field_type: "text", required: true, step_number: 6, step_name: "Host in Malaysia", display_order: 2, conditional_logic: { showIf: HAS_HOST_IN_MALAYSIA }, validation_rules: { maxLength: 120, block_group: "host" } },
  { field_name: "host_relationship_to_applicant", label: "Host — Relationship to applicant", field_type: "text", required: true, step_number: 6, step_name: "Host in Malaysia", display_order: 3, conditional_logic: { showIf: HAS_HOST_IN_MALAYSIA }, placeholder: "e.g. friend, brother, business partner", validation_rules: { maxLength: 80, block_group: "host" } },
  { field_name: "host_address", label: "Host — Address in Malaysia", field_type: "text", required: true, step_number: 6, step_name: "Host in Malaysia", display_order: 4, conditional_logic: { showIf: HAS_HOST_IN_MALAYSIA }, validation_rules: { maxLength: 200, block_group: "host" } },
  { field_name: "host_phone", label: "Host — Telephone (incl. country code)", field_type: "text", required: true, step_number: 6, step_name: "Host in Malaysia", display_order: 5, conditional_logic: { showIf: HAS_HOST_IN_MALAYSIA }, validation_rules: { maxLength: 30, block_group: "host" } },
  { field_name: "host_nationality", label: "Host — Nationality", field_type: "country", required: true, step_number: 6, step_name: "Host in Malaysia", display_order: 6, conditional_logic: { showIf: HAS_HOST_IN_MALAYSIA }, validation_rules: { source: "ISO3166-1", block_group: "host" } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 7: Travel History
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "visited_malaysia_before", label: "Have you ever visited Malaysia before?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_malaysia_visit_arrival_date", label: "Prior Malaysia visit — Arrival date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_MALAYSIA_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_malaysia_visits", max_items: 5 } },
  { field_name: "prior_malaysia_visit_departure_date", label: "Prior Malaysia visit — Departure date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_MALAYSIA_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_malaysia_visits" } },
  { field_name: "prior_malaysia_visit_purpose", label: "Prior Malaysia visit — Purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_MALAYSIA_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_malaysia_visits" } },
  { field_name: "refused_visa_or_entry_malaysia", label: "Have you ever been refused a visa to, or denied entry into, Malaysia?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 5, options: YES_NO },
  { field_name: "refused_visa_malaysia_details", label: "Provide details (date, place, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 6, conditional_logic: { showIf: REFUSED_VISA_MALAYSIA }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 7, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 8, conditional_logic: { showIf: REFUSED_VISA_OTHER }, validation_rules: { maxLength: 1000 } },

  // ═════════════════════════════════════════════════════════════════════════
  // STEP 8: Character & Declaration
  // ═════════════════════════════════════════════════════════════════════════
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 1, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details (country, date, charge, sentence)", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 2, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported from Malaysia or any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 3, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 4, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_terrorism_or_security_history", label: "Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 5, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 8, step_name: "Character & Declaration", display_order: 6, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 7, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Malaysia.", field_type: "checkbox", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 8, options: [{ value: "yes", text: "I agree" }] },
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
