/**
 * Seed script: visa_form_fields for Canada Temporary Resident Visa (TRV).
 *
 * Field definitions mirror the Immigration, Refugees and Citizenship
 * Canada (IRCC) IMM 5257 (Application for Temporary Resident Visa) +
 * IMM 5645 (Family Information) + the eTA (Electronic Travel
 * Authorization) flow. Submitted via the IRCC Secure Account portal at
 * `https://ircc.canada.ca` (GCKey or Sign-In Partner authenticated).
 * The eTA flow is at `https://onlineservices-servicesenligne.cic.gc.ca`.
 *
 * The schema is a high-fidelity reconstruction from public IMM 5257 +
 * IMM 5645 PDFs, eTA application guidance, and IRCC instruction guides.
 * Same posture as JP_TOURIST, AU_VISITOR_600, NZ_VISITOR_VISA.
 *
 * Scope: TRV (Visitor Visa, single-entry up to 6 months / multiple-
 * entry up to 10 years) + eTA (visa-waiver-country nationals, 5-year
 * authority, 6-month max stay per entry). Variant captured by
 * `visa_type_requested`.
 *
 * Out of scope: Work Permit (LMIA-based, Open Work Permit, Post-
 * Graduation Work Permit), Study Permit, Permanent Residence (Express
 * Entry, Provincial Nominee, Family Sponsorship, Atlantic Immigration
 * Programme, Quebec-selected workers), Super Visa (parents/grandparents
 * — same form but distinct programme; covered in future package),
 * Refugee/Protected Person, and Inland TRP.
 *
 * Document uploads (passport bio, photo, proof-of-funds, employment
 * letter, invitation letter, return ticket) are out-of-schema.
 *
 * Run: npx tsx scripts/seed-ca-trv-form-fields.ts
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

const VISA_TYPE = "CA_TRV";

interface FieldDef { field_name: string; label: string; field_type: string; required: boolean; step_number: number; step_name: string; display_order: number; placeholder?: string; validation_rules?: Record<string, unknown>; options?: Array<{ value: string; text: string }>; conditional_logic?: Record<string, unknown>; }

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

const HAS_OTHER_NAMES = "has_other_names_used === yes";
const HAS_OTHER_NATIONALITIES = "has_other_nationalities === yes";
const IS_MARRIED_OR_PARTNERED = "marital_status === married || marital_status === common_law";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const HAS_HOST_IN_CA = "has_host_in_canada === yes";
const VISITED_CA_BEFORE = "visited_canada_before === yes";
const REFUSED_VISA_CA = "refused_visa_or_entry_canada === yes";
const REFUSED_VISA_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";
const HAS_TB_HISTORY = "has_tb_history === yes";
const HAS_MILITARY_SERVICE = "has_military_service === yes";

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
  { value: "another", text: "Another gender" },
];

const PASSPORT_TYPE_OPTIONS = [{ value: "ordinary", text: "Ordinary" }];

// IRCC IMM 5257 marital status values include common-law (1+ year cohabitation).
const MARITAL_STATUS_OPTIONS = [
  { value: "single", text: "Never married / Single" },
  { value: "married", text: "Married" },
  { value: "common_law", text: "Common-law" },
  { value: "separated", text: "Legally separated" },
  { value: "divorced", text: "Divorced" },
  { value: "widowed", text: "Widowed" },
  { value: "annulled", text: "Annulled marriage" },
];

const OCCUPATION_OPTIONS = [{ value: "employed", text: "Employed" }, { value: "self_employed", text: "Self-employed" }, { value: "businessperson", text: "Businessperson" }, { value: "student", text: "Student" }, { value: "retired", text: "Retired" }, { value: "homemaker", text: "Homemaker" }, { value: "unemployed", text: "Unemployed" }, { value: "other", text: "Other" }];

// IRCC TRV covers tourism, business visit, family visit, transit (under
// 48hr; otherwise eTA / Transit Without Visa programme).
const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism / Holiday" },
  { value: "visiting_family", text: "Visiting family or friends" },
  { value: "business_visit", text: "Business (meetings, conferences, training)" },
  { value: "transit", text: "Transit (>48 hours, otherwise TWOV)" },
  { value: "other", text: "Other" },
];

const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "eta", text: "eTA (Electronic Travel Authorization) — Visa-waiver nationals (~CAD 7, 5-year validity, 6-month stay)" },
  { value: "trv_single", text: "TRV — Single-entry visitor visa (~CAD 100, up to 6-month stay)" },
  { value: "trv_multiple", text: "TRV — Multiple-entry visitor visa (~CAD 100, up to 10-year validity, 6-month stay per entry)" },
];

const PORT_OF_ENTRY_OPTIONS = [
  { value: "toronto_yyz", text: "Toronto Pearson International Airport (YYZ)" },
  { value: "vancouver_yvr", text: "Vancouver International Airport (YVR)" },
  { value: "montreal_yul", text: "Montréal-Trudeau International Airport (YUL)" },
  { value: "calgary_yyc", text: "Calgary International Airport (YYC)" },
  { value: "edmonton_yeg", text: "Edmonton International Airport (YEG)" },
  { value: "ottawa_yow", text: "Ottawa Macdonald-Cartier International Airport (YOW)" },
  { value: "halifax_yhz", text: "Halifax Stanfield International Airport (YHZ)" },
  { value: "winnipeg_ywg", text: "Winnipeg Richardson International Airport (YWG)" },
  { value: "buffalo_peace_bridge_land", text: "Peace Bridge — Buffalo, NY (US land)" },
  { value: "detroit_ambassador_bridge_land", text: "Ambassador Bridge — Detroit, MI (US land)" },
  { value: "blaine_pacific_highway_land", text: "Pacific Highway — Blaine, WA (US land)" },
  { value: "niagara_rainbow_bridge_land", text: "Rainbow Bridge — Niagara Falls (US land)" },
  { value: "vancouver_seaport", text: "Vancouver Cruise Terminal (Canada Place)" },
  { value: "halifax_seaport", text: "Port of Halifax (cruise)" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "rental_apartment", text: "Holiday rental / Service apartment" },
  { value: "host_residence", text: "Residence of host (friend or relative)" },
  { value: "guesthouse", text: "Hostel / Bed & breakfast" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [{ value: "self", text: "Self" }, { value: "employer", text: "Employer" }, { value: "family", text: "Family member" }, { value: "host", text: "Host / Sponsor in Canada" }, { value: "other", text: "Other" }];

const FIELDS: FieldDef[] = [
  // STEP 1: Personal Information
  { field_name: "surname", label: "Family name (Surname)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given name(s)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "has_other_names_used", label: "Have you ever used any other names (incl. nicknames, maiden name, religious names)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Country of citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "country_of_residence", label: "Country of current residence (if different from citizenship)", field_type: "country", required: false, step_number: 1, step_name: "Personal Information", display_order: 10, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 13, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse / Common-law partner — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, conditional_logic: { showIf: IS_MARRIED_OR_PARTNERED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse / Common-law partner — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, conditional_logic: { showIf: IS_MARRIED_OR_PARTNERED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "spouse_dob", label: "Spouse / Common-law partner — Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, conditional_logic: { showIf: IS_MARRIED_OR_PARTNERED }, validation_rules: { format: "DD/MM/YYYY", block_group: "spouse" } },
  { field_name: "father_full_name", label: "Father's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 17, validation_rules: { maxLength: 120 } },
  { field_name: "mother_full_name", label: "Mother's full name (including maiden name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 18, validation_rules: { maxLength: 120 } },

  // STEP 2: Passport
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "has_other_passports", label: "Have you ever held any other passport (current or expired)?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 6, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 7, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // STEP 3: Contact & Home Address
  { field_name: "home_address_line1", label: "Home address — Street / Apartment", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_state", label: "Home address — Province / State", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Home address — Postal code / ZIP", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 4, validation_rules: { maxLength: 20, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 5, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 6, validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 7, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // STEP 4: Occupation
  { field_name: "current_profession", label: "Current profession or occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: OCCUPATION_OPTIONS },
  { field_name: "position_title", label: "Position / Title", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "employer_or_school_name", label: "Name of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 3, validation_rules: { maxLength: 120, block_group: "employer_details" } },
  { field_name: "employer_or_school_address", label: "Address of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, validation_rules: { maxLength: 200, block_group: "employer_details" } },
  { field_name: "monthly_income_cad", label: "Approximate monthly income (CAD)", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 5, validation_rules: { pattern: "^[0-9]+$", maxLength: 10 } },

  // STEP 5: Trip Details
  { field_name: "visa_type_requested", label: "Visa / authority type requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to Canada", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in Canada", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 180)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, validation_rules: { pattern: "^(?:[1-9]|[1-9][0-9]|1[0-7][0-9]|180)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Intended port of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline, ship, or transport carrier", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 7, placeholder: "e.g. Air Canada, WestJet, Porter", validation_rules: { maxLength: 80 } },
  { field_name: "accommodation_type", label: "Type of accommodation in Canada", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 8, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of accommodation / first stop", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address in Canada", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_city", label: "City / Province in Canada", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 11, validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 12, options: EXPENSE_BEARER_OPTIONS },
  { field_name: "available_funds_cad", label: "Funds available for the visit (CAD)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 13, placeholder: "e.g. 5000", validation_rules: { pattern: "^[0-9]+$", maxLength: 10 } },

  // STEP 6: Host
  { field_name: "has_host_in_canada", label: "Do you have a host (friend, relative, or sponsor) in Canada?", field_type: "radio", required: true, step_number: 6, step_name: "Host in Canada", display_order: 1, options: YES_NO },
  { field_name: "host_full_name", label: "Host — Full name", field_type: "text", required: true, step_number: 6, step_name: "Host in Canada", display_order: 2, conditional_logic: { showIf: HAS_HOST_IN_CA }, validation_rules: { maxLength: 120, block_group: "host" } },
  { field_name: "host_relationship_to_applicant", label: "Host — Relationship to applicant", field_type: "text", required: true, step_number: 6, step_name: "Host in Canada", display_order: 3, conditional_logic: { showIf: HAS_HOST_IN_CA }, validation_rules: { maxLength: 80, block_group: "host" } },
  { field_name: "host_address", label: "Host — Address in Canada", field_type: "text", required: true, step_number: 6, step_name: "Host in Canada", display_order: 4, conditional_logic: { showIf: HAS_HOST_IN_CA }, validation_rules: { maxLength: 200, block_group: "host" } },
  { field_name: "host_phone", label: "Host — Telephone (incl. country code)", field_type: "text", required: true, step_number: 6, step_name: "Host in Canada", display_order: 5, conditional_logic: { showIf: HAS_HOST_IN_CA }, validation_rules: { maxLength: 30, block_group: "host" } },
  { field_name: "host_status", label: "Host — Status in Canada", field_type: "text", required: true, step_number: 6, step_name: "Host in Canada", display_order: 6, conditional_logic: { showIf: HAS_HOST_IN_CA }, placeholder: "e.g. Canadian Citizen, PR, Work Permit holder", validation_rules: { maxLength: 80, block_group: "host" } },

  // STEP 7: Travel & Background History (incl. military service per IMM 5645)
  { field_name: "visited_canada_before", label: "Have you ever visited Canada before?", field_type: "radio", required: true, step_number: 7, step_name: "Travel & Background", display_order: 1, options: YES_NO },
  { field_name: "prior_canada_visit_arrival_date", label: "Prior Canada visit — Arrival date", field_type: "date", required: true, step_number: 7, step_name: "Travel & Background", display_order: 2, conditional_logic: { showIf: VISITED_CA_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_canada_visits", max_items: 5 } },
  { field_name: "prior_canada_visit_departure_date", label: "Prior Canada visit — Departure date", field_type: "date", required: true, step_number: 7, step_name: "Travel & Background", display_order: 3, conditional_logic: { showIf: VISITED_CA_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_canada_visits" } },
  { field_name: "prior_canada_visit_purpose", label: "Prior Canada visit — Purpose", field_type: "text", required: true, step_number: 7, step_name: "Travel & Background", display_order: 4, conditional_logic: { showIf: VISITED_CA_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_canada_visits" } },
  { field_name: "refused_visa_or_entry_canada", label: "Have you ever been refused a visa to, or denied entry into, Canada?", field_type: "radio", required: true, step_number: 7, step_name: "Travel & Background", display_order: 5, options: YES_NO },
  { field_name: "refused_visa_canada_details", label: "Provide details", field_type: "textarea", required: true, step_number: 7, step_name: "Travel & Background", display_order: 6, conditional_logic: { showIf: REFUSED_VISA_CA }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 7, step_name: "Travel & Background", display_order: 7, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details", field_type: "textarea", required: true, step_number: 7, step_name: "Travel & Background", display_order: 8, conditional_logic: { showIf: REFUSED_VISA_OTHER }, validation_rules: { maxLength: 1000 } },
  { field_name: "has_military_service", label: "Have you ever served in any military, militia, civil-defence unit, security organisation, or police force?", field_type: "radio", required: true, step_number: 7, step_name: "Travel & Background", display_order: 9, options: YES_NO },
  { field_name: "military_service_details", label: "Provide details (country, branch, rank, dates)", field_type: "textarea", required: true, step_number: 7, step_name: "Travel & Background", display_order: 10, conditional_logic: { showIf: HAS_MILITARY_SERVICE }, validation_rules: { maxLength: 1500 } },

  // STEP 8: Health & Character (incl. TB-history)
  { field_name: "has_tb_history", label: "Have you ever been diagnosed with tuberculosis (TB) or had a chest X-ray showing an abnormality?", field_type: "radio", required: true, step_number: 8, step_name: "Health & Character", display_order: 1, options: YES_NO },
  { field_name: "tb_history_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Health & Character", display_order: 2, conditional_logic: { showIf: HAS_TB_HISTORY }, validation_rules: { maxLength: 1000 } },
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 8, step_name: "Health & Character", display_order: 3, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details (country, date, charge, sentence)", field_type: "textarea", required: true, step_number: 8, step_name: "Health & Character", display_order: 4, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported, removed, or excluded from any country?", field_type: "radio", required: true, step_number: 8, step_name: "Health & Character", display_order: 5, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Health & Character", display_order: 6, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_terrorism_or_security_history", label: "Have you ever been involved in terrorism, war crimes, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger national security?", field_type: "radio", required: true, step_number: 8, step_name: "Health & Character", display_order: 7, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 8, step_name: "Health & Character", display_order: 8, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 8, step_name: "Health & Character", display_order: 9, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into Canada.", field_type: "checkbox", required: true, step_number: 8, step_name: "Health & Character", display_order: 10, options: [{ value: "yes", text: "I agree" }] },
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
