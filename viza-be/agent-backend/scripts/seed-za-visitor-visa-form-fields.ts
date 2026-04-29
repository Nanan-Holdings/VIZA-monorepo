/**
 * Seed script: visa_form_fields for South Africa Visitor's Visa.
 *
 * Field definitions mirror the South African Department of Home Affairs
 * (DHA) Visitor's Visa application via VFS Global at
 * `https://www.vfsglobal.com/en/individuals/index.html` and the eVisa
 * pilot portal at `https://www.evisa.gov.za` (limited nationalities).
 * Schema is a high-fidelity reconstruction from the public DHA-1738
 * (Application for Visa) paper antecedent, DHA-84 forms, and applicant
 * guidance pages.
 *
 * Scope: Visitor's Visa (Section 11) — single-entry / multi-entry
 * for visa-required nationalities + eVisa pilot for selected
 * nationalities (China, India, Nigeria, Kenya, Cameroon, Mexico,
 * Saudi Arabia, UAE, Egypt). Variants on `visa_type_requested`.
 *
 * Out of scope: General Work Visa, Critical Skills Work Visa,
 * Intra-Company Transfer Visa, Business Visa, Study Visa, Relative's
 * Visa, Retired Person's Visa, Treaty Visa, Permanent Residence,
 * Asylum Seeker Permit.
 *
 * Document uploads (passport bio, photo, financial proof, return
 * ticket, accommodation, sponsor docs) out-of-schema per playbook §5.6.
 *
 * Run: npx tsx scripts/seed-za-visitor-visa-form-fields.ts
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

const VISA_TYPE = "ZA_VISITOR_VISA";

interface FieldDef { field_name: string; label: string; field_type: string; required: boolean; step_number: number; step_name: string; display_order: number; placeholder?: string; validation_rules?: Record<string, unknown>; options?: Array<{ value: string; text: string }>; conditional_logic?: Record<string, unknown>; }

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];
const HAS_OTHER_NAMES = "has_other_names_used === yes";
const HAS_OTHER_NATIONALITIES = "has_other_nationalities === yes";
const IS_MARRIED_OR_PARTNERED = "marital_status === married || marital_status === life_partner";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const HAS_HOST_IN_ZA = "has_host_in_south_africa === yes";
const VISITED_ZA_BEFORE = "visited_south_africa_before === yes";
const REFUSED_VISA_ZA = "refused_visa_or_entry_south_africa === yes";
const REFUSED_VISA_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";
const HAS_YELLOW_FEVER_TRAVEL = "yellow_fever_country_recent === yes";

const SEX_OPTIONS = [{ value: "male", text: "Male" }, { value: "female", text: "Female" }];
const PASSPORT_TYPE_OPTIONS = [{ value: "ordinary", text: "Ordinary" }];

// SA Immigration Act Sec 11 recognises "spouse" + "life partner" as
// distinct relationship statuses.
const MARITAL_STATUS_OPTIONS = [
  { value: "single", text: "Single / Never married" },
  { value: "married", text: "Married" },
  { value: "life_partner", text: "Life partner (long-term cohabitation)" },
  { value: "divorced", text: "Divorced" },
  { value: "widowed", text: "Widowed" },
];

const OCCUPATION_OPTIONS = [{ value: "employed", text: "Employed" }, { value: "self_employed", text: "Self-employed" }, { value: "businessperson", text: "Businessperson" }, { value: "student", text: "Student" }, { value: "retired", text: "Retired" }, { value: "homemaker", text: "Homemaker" }, { value: "unemployed", text: "Unemployed" }, { value: "other", text: "Other" }];

const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism / Holiday" },
  { value: "visiting_family", text: "Visiting family or friends" },
  { value: "business_visit", text: "Business visit (meetings, conferences)" },
  { value: "medical_treatment", text: "Medical treatment" },
  { value: "transit", text: "Transit (>24 hours)" },
  { value: "other", text: "Other" },
];

const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "evisa", text: "eVisa — Pilot programme nationalities (CN/IN/NG/KE/CM/MX/SA/AE/EG), online via evisa.gov.za" },
  { value: "visitor_single", text: "Visitor's Visa — Single entry, up to 3-month stay, ~ZAR 1,520" },
  { value: "visitor_multiple", text: "Visitor's Visa — Multiple entry, up to 3-year validity, 3-month stay per entry, ~ZAR 1,520" },
];

const PORT_OF_ENTRY_OPTIONS = [
  { value: "ortambo_jnb", text: "OR Tambo International Airport, Johannesburg (JNB)" },
  { value: "cape_town_cpt", text: "Cape Town International Airport (CPT)" },
  { value: "king_shaka_dur", text: "King Shaka International Airport, Durban (DUR)" },
  { value: "port_elizabeth_plz", text: "Chief Dawid Stuurman Airport, Gqeberha (PLZ)" },
  { value: "lanseria_hla", text: "Lanseria International Airport (HLA)" },
  { value: "kruger_mpumalanga_mqp", text: "Kruger Mpumalanga International Airport (MQP)" },
  { value: "beitbridge_land", text: "Beitbridge (Zimbabwe border)" },
  { value: "lebombo_land", text: "Lebombo / Komatipoort (Mozambique border)" },
  { value: "ficksburg_land", text: "Ficksburg Bridge (Lesotho border)" },
  { value: "oshoek_land", text: "Oshoek (Eswatini border)" },
  { value: "vioolsdrift_land", text: "Vioolsdrift (Namibia border)" },
  { value: "kopfontein_land", text: "Kopfontein / Tlokweng (Botswana border)" },
  { value: "durban_seaport", text: "Port of Durban (cruise)" },
  { value: "cape_town_seaport", text: "Port of Cape Town (cruise)" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "rental_apartment", text: "Holiday rental / Service apartment" },
  { value: "host_residence", text: "Residence of host (friend or relative)" },
  { value: "guesthouse", text: "Guesthouse / Bed & breakfast" },
  { value: "lodge_safari", text: "Safari lodge" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [{ value: "self", text: "Self" }, { value: "employer", text: "Employer" }, { value: "family", text: "Family member" }, { value: "host", text: "Host / Sponsor in South Africa" }, { value: "other", text: "Other" }];

const FIELDS: FieldDef[] = [
  // STEP 1: Personal Information
  { field_name: "surname", label: "Surname (Family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names (former names, maiden name, aliases)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse / Life partner — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 13, conditional_logic: { showIf: IS_MARRIED_OR_PARTNERED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse / Life partner — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, conditional_logic: { showIf: IS_MARRIED_OR_PARTNERED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "father_full_name", label: "Father's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, validation_rules: { maxLength: 120 } },
  { field_name: "mother_full_name", label: "Mother's full name (including maiden name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, validation_rules: { maxLength: 120 } },

  // STEP 2: Passport
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry (must be valid 30+ days beyond intended departure)", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "has_other_passports", label: "Do you currently hold or have you previously held any other passport?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 6, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 7, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // STEP 3: Contact & Home Address
  { field_name: "home_address_line1", label: "Home address — Street / Apartment", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_state", label: "Home address — Province / State", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Home address — Postal code", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 4, validation_rules: { maxLength: 20, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 5, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 6, validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 7, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // STEP 4: Occupation
  { field_name: "current_profession", label: "Current profession or occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: OCCUPATION_OPTIONS },
  { field_name: "position_title", label: "Position / Title", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "employer_or_school_name", label: "Name of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 3, validation_rules: { maxLength: 120, block_group: "employer_details" } },
  { field_name: "employer_or_school_address", label: "Address of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, validation_rules: { maxLength: 200, block_group: "employer_details" } },

  // STEP 5: Trip Details
  { field_name: "visa_type_requested", label: "Visa type requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to South Africa", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in South Africa", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 90 per entry)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, validation_rules: { pattern: "^(?:[1-9]|[1-8][0-9]|90)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Intended port of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline, ship, or transport carrier", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 7, placeholder: "e.g. South African Airways, Emirates, Qatar Airways", validation_rules: { maxLength: 80 } },
  { field_name: "accommodation_type", label: "Type of accommodation in South Africa", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 8, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of accommodation / first stop", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address in South Africa", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_city", label: "City / Province in South Africa", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 11, validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 12, options: EXPENSE_BEARER_OPTIONS },
  { field_name: "available_funds_zar", label: "Funds available for the visit (ZAR equivalent)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 13, validation_rules: { pattern: "^[0-9]+$", maxLength: 10 } },

  // STEP 6: Host (optional)
  { field_name: "has_host_in_south_africa", label: "Do you have a host (friend, relative, or sponsor) in South Africa?", field_type: "radio", required: true, step_number: 6, step_name: "Host in South Africa", display_order: 1, options: YES_NO },
  { field_name: "host_full_name", label: "Host — Full name", field_type: "text", required: true, step_number: 6, step_name: "Host in South Africa", display_order: 2, conditional_logic: { showIf: HAS_HOST_IN_ZA }, validation_rules: { maxLength: 120, block_group: "host" } },
  { field_name: "host_relationship_to_applicant", label: "Host — Relationship to applicant", field_type: "text", required: true, step_number: 6, step_name: "Host in South Africa", display_order: 3, conditional_logic: { showIf: HAS_HOST_IN_ZA }, validation_rules: { maxLength: 80, block_group: "host" } },
  { field_name: "host_address", label: "Host — Address in South Africa", field_type: "text", required: true, step_number: 6, step_name: "Host in South Africa", display_order: 4, conditional_logic: { showIf: HAS_HOST_IN_ZA }, validation_rules: { maxLength: 200, block_group: "host" } },
  { field_name: "host_phone", label: "Host — Telephone (incl. country code)", field_type: "text", required: true, step_number: 6, step_name: "Host in South Africa", display_order: 5, conditional_logic: { showIf: HAS_HOST_IN_ZA }, validation_rules: { maxLength: 30, block_group: "host" } },
  { field_name: "host_id_or_passport", label: "Host — South African ID or passport number", field_type: "text", required: true, step_number: 6, step_name: "Host in South Africa", display_order: 6, conditional_logic: { showIf: HAS_HOST_IN_ZA }, validation_rules: { maxLength: 30, block_group: "host" } },

  // STEP 7: Travel History (incl. yellow-fever country recent)
  { field_name: "visited_south_africa_before", label: "Have you ever visited South Africa before?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_za_visit_arrival_date", label: "Prior SA visit — Arrival date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_ZA_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_za_visits", max_items: 5 } },
  { field_name: "prior_za_visit_departure_date", label: "Prior SA visit — Departure date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_ZA_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_za_visits" } },
  { field_name: "prior_za_visit_purpose", label: "Prior SA visit — Purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_ZA_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_za_visits" } },
  { field_name: "yellow_fever_country_recent", label: "Have you travelled through any yellow-fever-endemic country in the past 6 days?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 5, options: YES_NO },
  { field_name: "yellow_fever_certificate_held", label: "Do you hold a valid Yellow Fever Vaccination Certificate?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 6, conditional_logic: { showIf: HAS_YELLOW_FEVER_TRAVEL }, options: YES_NO },
  { field_name: "refused_visa_or_entry_south_africa", label: "Have you ever been refused a visa to, or denied entry into, South Africa?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 7, options: YES_NO },
  { field_name: "refused_visa_za_details", label: "Provide details", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 8, conditional_logic: { showIf: REFUSED_VISA_ZA }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 9, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 10, conditional_logic: { showIf: REFUSED_VISA_OTHER }, validation_rules: { maxLength: 1000 } },

  // STEP 8: Character & Declaration
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 1, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 2, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported from South Africa or any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 3, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 4, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_terrorism_or_security_history", label: "Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 5, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 8, step_name: "Character & Declaration", display_order: 6, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 7, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of South Africa.", field_type: "checkbox", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 8, options: [{ value: "yes", text: "I agree" }] },
];

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);
  const { error: delError } = await supabase.from("visa_form_fields").delete().eq("visa_type", VISA_TYPE);
  if (delError) console.error(`Error deleting:`, delError.message); else console.log(`Cleared ${VISA_TYPE}`);
  const rows = FIELDS.map((f) => ({ visa_type: VISA_TYPE, field_name: f.field_name, label: f.label, field_type: f.field_type, required: f.required, step_number: f.step_number, step_name: f.step_name, display_order: f.display_order, placeholder: f.placeholder ?? null, validation_rules: f.validation_rules ?? null, options: f.options ?? null, conditional_logic: f.conditional_logic ?? null }));
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
