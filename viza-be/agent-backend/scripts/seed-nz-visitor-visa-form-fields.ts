/**
 * Seed script: visa_form_fields for New Zealand Visitor Visa.
 *
 * Field definitions mirror the Immigration New Zealand (INZ) Visitor
 * Visa online application via the Immigration Online portal at
 * `https://onlineservices.immigration.govt.nz`. The portal is RealMe-
 * authenticated and identity-gated. The schema also covers the NZeTA
 * (New Zealand Electronic Travel Authority) flow at
 * `https://www.immigration.govt.nz/new-zealand-visas/apply-for-a-visa/about-visa/nzeta`
 * for visa-waiver-country nationals.
 *
 * The schema is a high-fidelity reconstruction from public landing
 * pages, the Visitor Visa paper application (form 1017), the NZeTA
 * application guidance, and INZ applicant information sheets. Same
 * posture as JP_TOURIST, EG_E_VISA, TH_TOURIST_E_VISA, AU_VISITOR_600.
 *
 * Scope: Visitor Visa (single + multi-entry up to 9 months) + NZeTA
 * variant for visa-waiver nationals. Variant captured by
 * `visa_type_requested`.
 *
 * Out of scope: Work Visa (Accredited Employer Work Visa AEWV, Working
 * Holiday Visa, Specific Purpose Work Visa), Resident Visa (Skilled
 * Migrant Category, Parent Resident, Partnership), Student Visa,
 * Transit Visa, Group Visitor Visa, Limited Visa, Refugee/Protection,
 * and bespoke INZ pathways (Active Investor Plus, Entrepreneur).
 *
 * Document uploads (passport bio, photo, hotel/itinerary, return
 * ticket, financial proof, sponsor's documents where applicable) are
 * out-of-schema per playbook §5.6.
 *
 * Run: npx tsx scripts/seed-nz-visitor-visa-form-fields.ts
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

const VISA_TYPE = "NZ_VISITOR_VISA";

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
const IS_MARRIED_OR_PARTNERED = "marital_status === married || marital_status === de_facto";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const HAS_HOST_IN_NZ = "has_host_in_nz === yes";
const VISITED_NZ_BEFORE = "visited_nz_before === yes";
const REFUSED_VISA_NZ = "refused_visa_or_entry_nz === yes";
const REFUSED_VISA_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";
const HAS_TB_HISTORY = "has_tb_history === yes";

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
  { value: "another", text: "Another gender" },
];

const PASSPORT_TYPE_OPTIONS = [
  { value: "ordinary", text: "Ordinary" },
];

// NZ Form 1017 includes "de facto" alongside married — distinct legal
// status under NZ law (long-term unmarried partnership).
const MARITAL_STATUS_OPTIONS = [
  { value: "single", text: "Single / Never married" },
  { value: "married", text: "Married / Civil union" },
  { value: "de_facto", text: "De facto partner" },
  { value: "separated", text: "Separated" },
  { value: "divorced", text: "Divorced" },
  { value: "widowed", text: "Widowed" },
];

const OCCUPATION_OPTIONS = [
  { value: "employed", text: "Employed" },
  { value: "self_employed", text: "Self-employed" },
  { value: "businessperson", text: "Businessperson" },
  { value: "student", text: "Student" },
  { value: "retired", text: "Retired" },
  { value: "homemaker", text: "Homemaker / Caregiver" },
  { value: "unemployed", text: "Unemployed" },
  { value: "other", text: "Other" },
];

// NZ Visitor Visa supports tourism (general visit), business visit,
// medical treatment, and visiting family. Each unlocks a slightly
// different evidence pack but the schema covers all under one form.
const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism / Holiday" },
  { value: "visiting_family", text: "Visiting family or friends" },
  { value: "business_visit", text: "Business visit (meetings, conferences, negotiation)" },
  { value: "medical_treatment", text: "Medical treatment" },
  { value: "other", text: "Other" },
];

// NZeTA is online for visa-waiver nationals (~60 countries); Visitor
// Visa is for non-waiver applicants. Variants on the same schema.
const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "nzeta", text: "NZeTA — Visa-waiver nationals (online, NZD 17 + IVL NZD 100)" },
  { value: "visitor_visa_single", text: "Visitor Visa — Single entry, up to 9 months, ~NZD 211" },
  { value: "visitor_visa_multiple", text: "Visitor Visa — Multiple entry, up to 3 years, ~NZD 246" },
];

const PORT_OF_ENTRY_OPTIONS = [
  { value: "auckland_intl", text: "Auckland International Airport (AKL)" },
  { value: "wellington_intl", text: "Wellington International Airport (WLG)" },
  { value: "christchurch_intl", text: "Christchurch International Airport (CHC)" },
  { value: "queenstown_intl", text: "Queenstown Airport (ZQN)" },
  { value: "dunedin", text: "Dunedin Airport (DUD)" },
  { value: "rotorua", text: "Rotorua Regional Airport (ROT)" },
  { value: "auckland_seaport", text: "Ports of Auckland (cruise / sea)" },
  { value: "wellington_seaport", text: "Wellington (CentrePort / cruise)" },
  { value: "lyttelton_seaport", text: "Lyttelton Port (cruise)" },
  { value: "tauranga_seaport", text: "Port of Tauranga (cruise / sea)" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "motel", text: "Motel" },
  { value: "rental_apartment", text: "Holiday rental / Service apartment" },
  { value: "host_residence", text: "Residence of host (friend or relative)" },
  { value: "campervan", text: "Campervan / Self-contained RV" },
  { value: "guesthouse", text: "Hostel / Backpacker / Bed & breakfast" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [
  { value: "self", text: "Self" },
  { value: "employer", text: "Employer" },
  { value: "family", text: "Family member" },
  { value: "host", text: "Host / Sponsor in NZ" },
  { value: "other", text: "Other" },
];

const FIELDS: FieldDef[] = [
  // STEP 1: Personal Information
  { field_name: "surname", label: "Family name (Surname)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, placeholder: "As shown in passport", validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, placeholder: "As shown in passport", validation_rules: { maxLength: 80 } },
  { field_name: "preferred_name", label: "Preferred name (optional)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 3, validation_rules: { maxLength: 50 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names (former names, maiden name, aliases)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "sex", label: "Gender", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "marital_status", label: "Relationship status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 13, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse / Partner — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, conditional_logic: { showIf: IS_MARRIED_OR_PARTNERED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse / Partner — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, conditional_logic: { showIf: IS_MARRIED_OR_PARTNERED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "spouse_dob", label: "Spouse / Partner — Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, conditional_logic: { showIf: IS_MARRIED_OR_PARTNERED }, validation_rules: { format: "DD/MM/YYYY", block_group: "spouse" } },
  { field_name: "father_full_name", label: "Father's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 17, validation_rules: { maxLength: 120 } },
  { field_name: "mother_full_name", label: "Mother's full name (including maiden name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 18, validation_rules: { maxLength: 120 } },

  // STEP 2: Passport
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 4, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "has_other_passports", label: "Do you currently hold or have you previously held any other passport?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 6, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 7, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // STEP 3: Contact & Home Address
  { field_name: "home_address_line1", label: "Home address — Street / Apartment", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_state", label: "Home address — State / Province / Region", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Home address — Postal code", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 4, validation_rules: { maxLength: 20, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 5, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 6, placeholder: "Including country code", validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 7, placeholder: "name@example.com", validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // STEP 4: Occupation
  { field_name: "current_profession", label: "Current profession or occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: OCCUPATION_OPTIONS },
  { field_name: "position_title", label: "Position / Title", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "employer_or_school_name", label: "Name of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 3, validation_rules: { maxLength: 120, block_group: "employer_details" } },
  { field_name: "employer_or_school_address", label: "Address of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, validation_rules: { maxLength: 200, block_group: "employer_details" } },

  // STEP 5: Trip Details
  { field_name: "visa_type_requested", label: "Visa / authority type requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to New Zealand", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in New Zealand", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 270)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, placeholder: "e.g. 30", validation_rules: { pattern: "^(?:[1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-6][0-9]|270)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Intended port of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline, ship, or transport carrier", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 7, placeholder: "e.g. Air New Zealand, Qantas, Emirates", validation_rules: { maxLength: 80 } },
  { field_name: "flight_number", label: "Flight number (if known)", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 8, placeholder: "e.g. NZ2", validation_rules: { maxLength: 30 } },
  { field_name: "accommodation_type", label: "Type of accommodation in New Zealand", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of accommodation / first stop", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address in New Zealand", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 11, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_city", label: "City / Region in New Zealand", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 12, validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "accommodation_phone", label: "Telephone of accommodation", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 13, validation_rules: { maxLength: 30, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 14, options: EXPENSE_BEARER_OPTIONS },
  { field_name: "available_funds_nzd", label: "Available funds for the visit (NZD equivalent)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 15, placeholder: "e.g. 5000", validation_rules: { pattern: "^[0-9]+$", maxLength: 10 } },

  // STEP 6: Host in NZ (optional)
  { field_name: "has_host_in_nz", label: "Do you have a host (friend, relative, or sponsor) in New Zealand?", field_type: "radio", required: true, step_number: 6, step_name: "Host in New Zealand", display_order: 1, options: YES_NO },
  { field_name: "host_full_name", label: "Host — Full name", field_type: "text", required: true, step_number: 6, step_name: "Host in New Zealand", display_order: 2, conditional_logic: { showIf: HAS_HOST_IN_NZ }, validation_rules: { maxLength: 120, block_group: "host" } },
  { field_name: "host_relationship_to_applicant", label: "Host — Relationship to applicant", field_type: "text", required: true, step_number: 6, step_name: "Host in New Zealand", display_order: 3, conditional_logic: { showIf: HAS_HOST_IN_NZ }, validation_rules: { maxLength: 80, block_group: "host" } },
  { field_name: "host_address", label: "Host — Address in New Zealand", field_type: "text", required: true, step_number: 6, step_name: "Host in New Zealand", display_order: 4, conditional_logic: { showIf: HAS_HOST_IN_NZ }, validation_rules: { maxLength: 200, block_group: "host" } },
  { field_name: "host_phone", label: "Host — Telephone (incl. country code)", field_type: "text", required: true, step_number: 6, step_name: "Host in New Zealand", display_order: 5, conditional_logic: { showIf: HAS_HOST_IN_NZ }, validation_rules: { maxLength: 30, block_group: "host" } },
  { field_name: "host_immigration_status", label: "Host — Immigration status in NZ", field_type: "text", required: true, step_number: 6, step_name: "Host in New Zealand", display_order: 6, conditional_logic: { showIf: HAS_HOST_IN_NZ }, placeholder: "e.g. NZ Citizen, NZ Resident, Work Visa holder", validation_rules: { maxLength: 80, block_group: "host" } },

  // STEP 7: Travel History
  { field_name: "visited_nz_before", label: "Have you ever visited New Zealand before?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_nz_visit_arrival_date", label: "Prior NZ visit — Arrival date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_NZ_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_nz_visits", max_items: 5 } },
  { field_name: "prior_nz_visit_departure_date", label: "Prior NZ visit — Departure date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_NZ_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_nz_visits" } },
  { field_name: "prior_nz_visit_purpose", label: "Prior NZ visit — Purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_NZ_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_nz_visits" } },
  { field_name: "refused_visa_or_entry_nz", label: "Have you ever been refused a visa to, or denied entry into, New Zealand?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 5, options: YES_NO },
  { field_name: "refused_visa_nz_details", label: "Provide details (date, place, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 6, conditional_logic: { showIf: REFUSED_VISA_NZ }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 7, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 8, conditional_logic: { showIf: REFUSED_VISA_OTHER }, validation_rules: { maxLength: 1000 } },

  // STEP 8: Health & Character
  { field_name: "has_tb_history", label: "Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality?", field_type: "radio", required: true, step_number: 8, step_name: "Health & Character", display_order: 1, options: YES_NO },
  { field_name: "tb_history_details", label: "Provide details (when, treatment, current status)", field_type: "textarea", required: true, step_number: 8, step_name: "Health & Character", display_order: 2, conditional_logic: { showIf: HAS_TB_HISTORY }, validation_rules: { maxLength: 1000 } },
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 8, step_name: "Health & Character", display_order: 3, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details (country, date, charge, sentence)", field_type: "textarea", required: true, step_number: 8, step_name: "Health & Character", display_order: 4, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported, removed, or excluded from any country?", field_type: "radio", required: true, step_number: 8, step_name: "Health & Character", display_order: 5, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 8, step_name: "Health & Character", display_order: 6, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_terrorism_or_security_history", label: "Have you ever been involved in terrorism, war crimes, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security?", field_type: "radio", required: true, step_number: 8, step_name: "Health & Character", display_order: 7, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 8, step_name: "Health & Character", display_order: 8, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Health & Character", display_order: 9, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into New Zealand.", field_type: "checkbox", required: true, step_number: 8, step_name: "Health & Character", display_order: 10, options: [{ value: "yes", text: "I agree" }] },
];

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);
  const { error: delError } = await supabase.from("visa_form_fields").delete().eq("visa_type", VISA_TYPE);
  if (delError) console.error(`Error deleting:`, delError.message);
  else console.log(`Cleared existing ${VISA_TYPE} fields`);

  const rows = FIELDS.map((f) => toBilingualSeedRow(VISA_TYPE, f));

  const BATCH = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase.from("visa_form_fields").insert(batch).select("id");
    if (error) console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    else { total += data?.length ?? 0; process.stdout.write(`Batch ${Math.floor(i / BATCH) + 1}: ${data?.length ?? 0} inserted\n`); }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
