/**
 * Seed script: visa_form_fields for Philippines 9(a) Temporary Visitor Visa.
 *
 * Field definitions mirror the Republic of the Philippines Bureau of
 * Immigration (BI) / Department of Foreign Affairs (DFA) 9(a) Temporary
 * Visitor Visa. The application is paper-based at Philippine consular
 * posts abroad (no general online portal for the 9(a) itself), but the
 * mandatory pre-arrival eTravel Declaration at `https://etravel.gov.ph`
 * is online. Schema captures both flows under one package via
 * `visa_type_requested`.
 *
 * The schema is a high-fidelity reconstruction from BI / DFA public
 * applicant guidance, the 9(a) paper application antecedent, and the
 * eTravel Declaration mobile / web form. Same posture as JP_TOURIST,
 * EG_E_VISA, TH_TOURIST_E_VISA.
 *
 * Scope: 9(a) Temporary Visitor Visa for visa-required nationalities
 * (single-entry ~USD 30 / 3-month validity / 59-day stay; multiple-entry
 * 6-month or 1-year validity ~USD 60-90) AND eTravel Declaration for
 * all arrivals (free, mandatory pre-arrival). Three variants on
 * `visa_type_requested`.
 *
 * Out of scope: 9(d) Treaty Trader / Treaty Investor, 9(e) Foreign
 * Government Official, 9(f) Student, 9(g) Pre-arranged Employee, SRRV
 * (Special Resident Retiree's Visa), Special Investor's Resident Visa
 * (SIRV), Balikbayan privilege (Filipino-citizen-spouse), and visa-on-
 * arrival (~157 nationalities visa-free up to 30 days).
 *
 * Document uploads (passport bio, photo, hotel/itinerary, return ticket,
 * financial proof, sponsor docs) out-of-schema per playbook §5.6.
 *
 * Run: npx tsx scripts/seed-ph-temporary-visitor-visa-form-fields.ts
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

const VISA_TYPE = "PH_TEMPORARY_VISITOR_VISA";

interface FieldDef { field_name: string; label: string; field_type: string; required: boolean; step_number: number; step_name: string; display_order: number; placeholder?: string; validation_rules?: Record<string, unknown>; options?: Array<{ value: string; text: string }>; conditional_logic?: Record<string, unknown>; }

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

const HAS_OTHER_NAMES = "has_other_names_used === yes";
const HAS_OTHER_NATIONALITIES = "has_other_nationalities === yes";
const IS_MARRIED = "marital_status === married";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const HAS_HOST_IN_PH = "has_host_in_philippines === yes";
const VISITED_PH_BEFORE = "visited_philippines_before === yes";
const REFUSED_VISA_PH = "refused_visa_or_entry_philippines === yes";
const REFUSED_VISA_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";

const SEX_OPTIONS = [{ value: "male", text: "Male" }, { value: "female", text: "Female" }];
const PASSPORT_TYPE_OPTIONS = [{ value: "ordinary", text: "Ordinary" }];
const MARITAL_STATUS_OPTIONS = [{ value: "single", text: "Single" }, { value: "married", text: "Married" }, { value: "divorced", text: "Divorced" }, { value: "widowed", text: "Widowed" }];
const OCCUPATION_OPTIONS = [{ value: "employed", text: "Employed" }, { value: "self_employed", text: "Self-employed" }, { value: "businessperson", text: "Businessperson" }, { value: "student", text: "Student" }, { value: "retired", text: "Retired" }, { value: "homemaker", text: "Homemaker" }, { value: "unemployed", text: "Unemployed" }, { value: "other", text: "Other" }];

const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism / Holiday" },
  { value: "business_visit", text: "Business visit (meetings, conferences)" },
  { value: "visiting_family", text: "Visiting family or friends" },
  { value: "transit", text: "Transit" },
];

const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "etravel_only", text: "eTravel Declaration only — Visa-free or VOA arrival, free, mandatory pre-arrival" },
  { value: "9a_single", text: "9(a) Temporary Visitor Visa — Single entry, 3-month validity, 59-day stay, ~USD 30" },
  { value: "9a_multiple_6mo", text: "9(a) Temporary Visitor Visa — Multiple entry, 6-month validity, ~USD 60" },
  { value: "9a_multiple_1y", text: "9(a) Temporary Visitor Visa — Multiple entry, 1-year validity, ~USD 90" },
];

const PORT_OF_ENTRY_OPTIONS = [
  { value: "manila_naia", text: "Ninoy Aquino International Airport, Manila (MNL)" },
  { value: "clark_crk", text: "Clark International Airport (CRK)" },
  { value: "cebu_ceb", text: "Mactan-Cebu International Airport (CEB)" },
  { value: "davao_dvo", text: "Francisco Bangoy International Airport, Davao (DVO)" },
  { value: "iloilo_ilo", text: "Iloilo International Airport (ILO)" },
  { value: "kalibo_klo", text: "Kalibo International Airport (KLO)" },
  { value: "puerto_princesa_pps", text: "Puerto Princesa International Airport (PPS)" },
  { value: "manila_seaport", text: "Port of Manila (cruise / sea)" },
  { value: "cebu_seaport", text: "Cebu International Port" },
  { value: "subic_seaport", text: "Subic Bay Freeport" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "resort", text: "Resort" },
  { value: "rental_apartment", text: "Holiday rental / Service apartment" },
  { value: "host_residence", text: "Residence of host (friend or relative)" },
  { value: "guesthouse", text: "Hostel / Bed & breakfast" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [{ value: "self", text: "Self" }, { value: "employer", text: "Employer" }, { value: "family", text: "Family member" }, { value: "host", text: "Host in Philippines" }, { value: "other", text: "Other" }];

const FIELDS: FieldDef[] = [
  // STEP 1: Personal Information
  { field_name: "surname", label: "Surname (Family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 13, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "father_full_name", label: "Father's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, validation_rules: { maxLength: 120 } },
  { field_name: "mother_full_name", label: "Mother's full name (including maiden name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, validation_rules: { maxLength: 120 } },

  // STEP 2: Passport
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry (must be valid 6+ months beyond intended departure)", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "has_other_passports", label: "Do you currently hold or have you previously held any other passport?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 6, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 7, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // STEP 3: Contact & Home Address
  { field_name: "home_address_line1", label: "Home address — Street / Apartment", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Home address — Postal code", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { maxLength: 20, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 4, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 5, validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 6, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // STEP 4: Occupation
  { field_name: "current_profession", label: "Current profession or occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: OCCUPATION_OPTIONS },
  { field_name: "position_title", label: "Position / Title", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "employer_or_school_name", label: "Name of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 3, validation_rules: { maxLength: 120, block_group: "employer_details" } },
  { field_name: "employer_or_school_address", label: "Address of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, validation_rules: { maxLength: 200, block_group: "employer_details" } },

  // STEP 5: Trip Details
  { field_name: "visa_type_requested", label: "Visa / declaration type requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to Philippines", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in Philippines", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 59 for 9(a))", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, validation_rules: { pattern: "^(?:[1-9]|[1-5][0-9])$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Intended port of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline, ship, or transport carrier", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 7, placeholder: "e.g. Philippine Airlines, Cebu Pacific", validation_rules: { maxLength: 80 } },
  { field_name: "flight_number", label: "Flight number", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 8, placeholder: "e.g. PR101", validation_rules: { maxLength: 30 } },
  { field_name: "country_of_origin_for_trip", label: "Country of origin for this trip (last departure country)", field_type: "country", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "accommodation_type", label: "Type of accommodation in Philippines", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of hotel, resort, or property", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 11, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address in Philippines", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 12, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_city", label: "City / Province in Philippines", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 13, validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 14, options: EXPENSE_BEARER_OPTIONS },

  // STEP 6: Host (optional)
  { field_name: "has_host_in_philippines", label: "Do you have a host (friend, relative, or sponsor) in the Philippines?", field_type: "radio", required: true, step_number: 6, step_name: "Host in Philippines", display_order: 1, options: YES_NO },
  { field_name: "host_full_name", label: "Host — Full name", field_type: "text", required: true, step_number: 6, step_name: "Host in Philippines", display_order: 2, conditional_logic: { showIf: HAS_HOST_IN_PH }, validation_rules: { maxLength: 120, block_group: "host" } },
  { field_name: "host_relationship_to_applicant", label: "Host — Relationship to applicant", field_type: "text", required: true, step_number: 6, step_name: "Host in Philippines", display_order: 3, conditional_logic: { showIf: HAS_HOST_IN_PH }, validation_rules: { maxLength: 80, block_group: "host" } },
  { field_name: "host_address", label: "Host — Address in Philippines", field_type: "text", required: true, step_number: 6, step_name: "Host in Philippines", display_order: 4, conditional_logic: { showIf: HAS_HOST_IN_PH }, validation_rules: { maxLength: 200, block_group: "host" } },
  { field_name: "host_phone", label: "Host — Telephone (incl. country code)", field_type: "text", required: true, step_number: 6, step_name: "Host in Philippines", display_order: 5, conditional_logic: { showIf: HAS_HOST_IN_PH }, validation_rules: { maxLength: 30, block_group: "host" } },
  { field_name: "host_status", label: "Host — Status / Citizenship", field_type: "text", required: true, step_number: 6, step_name: "Host in Philippines", display_order: 6, conditional_logic: { showIf: HAS_HOST_IN_PH }, placeholder: "e.g. Filipino Citizen, Permanent Resident", validation_rules: { maxLength: 80, block_group: "host" } },

  // STEP 7: Travel History
  { field_name: "visited_philippines_before", label: "Have you ever visited the Philippines before?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_ph_visit_arrival_date", label: "Prior PH visit — Arrival date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_PH_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_ph_visits", max_items: 5 } },
  { field_name: "prior_ph_visit_departure_date", label: "Prior PH visit — Departure date", field_type: "date", required: true, step_number: 7, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_PH_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_ph_visits" } },
  { field_name: "prior_ph_visit_purpose", label: "Prior PH visit — Purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_PH_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_ph_visits" } },
  { field_name: "refused_visa_or_entry_philippines", label: "Have you ever been refused a visa to, or denied entry into, the Philippines?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 5, options: YES_NO },
  { field_name: "refused_visa_ph_details", label: "Provide details", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 6, conditional_logic: { showIf: REFUSED_VISA_PH }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 7, step_name: "Travel History", display_order: 7, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details", field_type: "textarea", required: true, step_number: 7, step_name: "Travel History", display_order: 8, conditional_logic: { showIf: REFUSED_VISA_OTHER }, validation_rules: { maxLength: 1000 } },

  // STEP 8: Character & Declaration
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 1, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 2, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported from the Philippines or any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 3, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 4, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_terrorism_or_security_history", label: "Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security?", field_type: "radio", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 5, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 8, step_name: "Character & Declaration", display_order: 6, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 7, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of the Philippines.", field_type: "checkbox", required: true, step_number: 8, step_name: "Character & Declaration", display_order: 8, options: [{ value: "yes", text: "I agree" }] },
];

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);
  const { error: delError } = await supabase.from("visa_form_fields").delete().eq("visa_type", VISA_TYPE);
  if (delError) console.error(`Error deleting:`, delError.message); else console.log(`Cleared ${VISA_TYPE}`);
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
