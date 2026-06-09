/**
 * Seed script: visa_form_fields for India e-Visa.
 *
 * Field definitions mirror the Government of India Ministry of Home
 * Affairs Bureau of Immigration e-Visa application at
 * `https://indianvisaonline.gov.in/evisa`. Public portal — applicant
 * creates an application reference number on first visit. Schema is
 * a high-fidelity reconstruction from public landing pages, the
 * Bureau of Immigration applicant guidance, and the form-VI paper
 * antecedent.
 *
 * Scope: e-Visa across the four eligible categories — Tourist, Business,
 * Medical, Conference — with stay-length variants under Tourist
 * (30-day double, 1-year multi, 5-year multi). All under a single schema
 * with variant captured by `visa_type_requested`. Biometric at arrival
 * port is mandatory.
 *
 * Out of scope: Regular Tourist Visa (paper at consular post), Employment
 * Visa, Student Visa, Research Visa, Journalist Visa, OCI (Overseas
 * Citizen of India), e-Visa for Visa-On-Arrival (5 specific
 * nationalities — JP/KR/UAE — handled at port), and consular paper
 * categories.
 *
 * Document uploads (passport bio, photo, supporting documents per
 * category — itinerary, hospital letter, business invitation,
 * conference invitation) are out-of-schema per playbook §5.6.
 *
 * Run: npx tsx scripts/seed-in-e-visa-form-fields.ts
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

const VISA_TYPE = "IN_E_VISA";

interface FieldDef { field_name: string; label: string; field_type: string; required: boolean; step_number: number; step_name: string; display_order: number; placeholder?: string; validation_rules?: Record<string, unknown>; options?: Array<{ value: string; text: string }>; conditional_logic?: Record<string, unknown>; }

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

const HAS_OTHER_NAMES = "has_other_names_used === yes";
const HAS_OTHER_NATIONALITIES = "has_other_nationalities === yes";
const IS_MARRIED = "marital_status === married";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const HAS_HOST_IN_IN = "has_host_in_india === yes";
const VISITED_IN_BEFORE = "visited_india_before === yes";
const REFUSED_VISA_IN = "refused_visa_or_entry_india === yes";
const REFUSED_VISA_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";
const IS_BUSINESS = "purpose_of_visit === business";
const IS_MEDICAL = "purpose_of_visit === medical";
const IS_CONFERENCE = "purpose_of_visit === conference";
const SAARC_NATIONALITY = "saarc_nationality === yes";

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
  { value: "transgender", text: "Transgender" },
];

const PASSPORT_TYPE_OPTIONS = [{ value: "ordinary", text: "Ordinary" }];

const MARITAL_STATUS_OPTIONS = [
  { value: "single", text: "Single" },
  { value: "married", text: "Married" },
  { value: "divorced", text: "Divorced" },
  { value: "widowed", text: "Widowed" },
];

// India Bureau of Immigration form-VI collects religion.
const RELIGION_OPTIONS = [
  { value: "hinduism", text: "Hinduism" },
  { value: "islam", text: "Islam" },
  { value: "christianity", text: "Christianity" },
  { value: "sikhism", text: "Sikhism" },
  { value: "buddhism", text: "Buddhism" },
  { value: "jainism", text: "Jainism" },
  { value: "judaism", text: "Judaism" },
  { value: "zoroastrianism", text: "Zoroastrianism (Parsi)" },
  { value: "no_religion", text: "No religion" },
  { value: "other", text: "Other" },
];

const OCCUPATION_OPTIONS = [
  { value: "employed", text: "Employed" },
  { value: "self_employed", text: "Self-employed" },
  { value: "businessperson", text: "Businessperson" },
  { value: "student", text: "Student" },
  { value: "retired", text: "Retired" },
  { value: "homemaker", text: "Homemaker" },
  { value: "unemployed", text: "Unemployed" },
  { value: "government_service", text: "Government service" },
  { value: "media", text: "Media / Journalist" },
  { value: "other", text: "Other" },
];

// India e-Visa categories per Bureau of Immigration. Tourist purpose
// covers sightseeing / casual visit / yoga / short courses / volunteer.
const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism (sightseeing, casual visit, yoga, short courses, volunteer)" },
  { value: "business", text: "Business (meetings, sales, conferences as business invitee)" },
  { value: "medical", text: "Medical treatment (patient)" },
  { value: "medical_attendant", text: "Medical Attendant (accompanying patient)" },
  { value: "conference", text: "Conference (attending an MEA-cleared conference)" },
];

const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "tourist_30d", text: "e-Tourist Visa — 30 days, double entry, ~USD 25" },
  { value: "tourist_1y", text: "e-Tourist Visa — 1 year, multiple entry, max 90-day stay (180 for US/UK/CA/JP), ~USD 40" },
  { value: "tourist_5y", text: "e-Tourist Visa — 5 years, multiple entry, max 90-day stay per visit, ~USD 80" },
  { value: "business_1y", text: "e-Business Visa — 1 year, multiple entry, max 180-day stay, ~USD 80" },
  { value: "medical_60d", text: "e-Medical Visa — 60 days, triple entry, ~USD 80" },
  { value: "medical_attendant_60d", text: "e-Medical Attendant Visa — 60 days, triple entry, ~USD 80" },
  { value: "conference_30d", text: "e-Conference Visa — 30 days, single entry, ~USD 80" },
];

const PORT_OF_ENTRY_OPTIONS = [
  { value: "delhi_del", text: "Indira Gandhi International Airport, Delhi (DEL)" },
  { value: "mumbai_bom", text: "Chhatrapati Shivaji Maharaj International Airport, Mumbai (BOM)" },
  { value: "bangalore_blr", text: "Kempegowda International Airport, Bengaluru (BLR)" },
  { value: "chennai_maa", text: "Chennai International Airport (MAA)" },
  { value: "kolkata_ccu", text: "Netaji Subhas Chandra Bose International Airport, Kolkata (CCU)" },
  { value: "hyderabad_hyd", text: "Rajiv Gandhi International Airport, Hyderabad (HYD)" },
  { value: "ahmedabad_amd", text: "Sardar Vallabhbhai Patel International Airport, Ahmedabad (AMD)" },
  { value: "kochi_cok", text: "Cochin International Airport (COK)" },
  { value: "goa_goi", text: "Manohar International Airport, Goa (GOX)" },
  { value: "amritsar_atq", text: "Sri Guru Ram Dass Jee International Airport, Amritsar (ATQ)" },
  { value: "lucknow_lko", text: "Chaudhary Charan Singh International Airport, Lucknow (LKO)" },
  { value: "pune_pnq", text: "Pune International Airport (PNQ)" },
  { value: "trivandrum_trv", text: "Trivandrum International Airport (TRV)" },
  { value: "mumbai_seaport", text: "Mumbai Seaport (cruise)" },
  { value: "chennai_seaport", text: "Chennai Seaport (cruise)" },
  { value: "cochin_seaport", text: "Cochin Seaport (cruise)" },
  { value: "goa_seaport", text: "Mormugao Port, Goa (cruise)" },
  { value: "mangalore_seaport", text: "New Mangalore Seaport (cruise)" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "resort", text: "Resort" },
  { value: "rental_apartment", text: "Holiday rental / Service apartment" },
  { value: "host_residence", text: "Residence of host (friend or relative)" },
  { value: "guesthouse", text: "Guesthouse / Homestay" },
  { value: "ashram", text: "Ashram / Spiritual retreat" },
  { value: "hospital", text: "Hospital (medical visa)" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [{ value: "self", text: "Self" }, { value: "employer", text: "Employer" }, { value: "family", text: "Family member" }, { value: "host", text: "Host / Sponsor in India" }, { value: "indian_company", text: "Indian company (business invitee)" }, { value: "indian_hospital", text: "Indian hospital (medical visa)" }, { value: "other", text: "Other" }];

const FIELDS: FieldDef[] = [
  // STEP 1: Personal Information
  { field_name: "surname", label: "Surname (Family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names (former names, maiden name, aliases)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town / Village", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "religion", label: "Religion", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, options: RELIGION_OPTIONS },
  { field_name: "saarc_nationality", label: "Are you a SAARC national or were you ever a citizen of a SAARC country (Bangladesh, Bhutan, Nepal, Pakistan, Sri Lanka, Maldives, Afghanistan)?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, options: YES_NO },
  { field_name: "saarc_country_visit_history", label: "Provide details of SAARC-country residence / citizenship history", field_type: "textarea", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, conditional_logic: { showIf: SAARC_NATIONALITY }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 13, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 14, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "national_id_number", label: "National ID number (if your country issues one)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 15, validation_rules: { maxLength: 30 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 17, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 18, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "father_full_name", label: "Father's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 19, validation_rules: { maxLength: 120 } },
  { field_name: "father_nationality", label: "Father's nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 20, validation_rules: { source: "ISO3166-1" } },
  { field_name: "father_place_of_birth", label: "Father's place of birth (city, country)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 21, validation_rules: { maxLength: 120 } },
  { field_name: "mother_full_name", label: "Mother's full name (including maiden name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 22, validation_rules: { maxLength: 120 } },
  { field_name: "mother_nationality", label: "Mother's nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 23, validation_rules: { source: "ISO3166-1" } },
  { field_name: "mother_place_of_birth", label: "Mother's place of birth (city, country)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 24, validation_rules: { maxLength: 120 } },

  // STEP 2: Passport
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport", display_order: 2, options: PASSPORT_TYPE_OPTIONS },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_place_of_issue", label: "Place of issue", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { maxLength: 100 } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 5, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry (must be valid 6+ months beyond intended departure)", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 6, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "has_other_passports", label: "Do you currently hold or have you previously held any other passport (incl. Pakistan / Bangladesh)?", field_type: "radio", required: true, step_number: 2, step_name: "Passport", display_order: 7, options: YES_NO },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_country", label: "Other passport — Issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 9, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports" } },

  // STEP 3: Contact & Home Address
  { field_name: "home_address_line1", label: "Home address — House / Street", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 1, validation_rules: { maxLength: 200, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Home address — City / Town", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 2, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_state", label: "Home address — State / Province", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 3, validation_rules: { maxLength: 80, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Home address — Postal code / ZIP", field_type: "text", required: false, step_number: 3, step_name: "Contact & Home Address", display_order: 4, validation_rules: { maxLength: 20, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Home address — Country of residence", field_type: "country", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 5, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 6, validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Contact & Home Address", display_order: 7, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // STEP 4: Occupation
  { field_name: "current_profession", label: "Current profession or occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: OCCUPATION_OPTIONS },
  { field_name: "position_title", label: "Position / Title", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "employer_or_school_name", label: "Name of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 3, validation_rules: { maxLength: 120, block_group: "employer_details" } },
  { field_name: "employer_or_school_address", label: "Address of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, validation_rules: { maxLength: 200, block_group: "employer_details" } },
  { field_name: "employer_or_school_phone", label: "Telephone of employer or school", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 5, validation_rules: { maxLength: 30, block_group: "employer_details" } },

  // STEP 5: Trip Details
  { field_name: "visa_type_requested", label: "Visa type requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to India", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in India", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 180)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, validation_rules: { pattern: "^(?:[1-9]|[1-9][0-9]|1[0-7][0-9]|180)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Intended port of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline, ship, or transport carrier", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 7, placeholder: "e.g. Air India, IndiGo, Vistara", validation_rules: { maxLength: 80 } },
  { field_name: "cities_to_visit", label: "Cities / Places intended to visit in India", field_type: "textarea", required: true, step_number: 5, step_name: "Trip Details", display_order: 8, placeholder: "e.g. Delhi, Agra, Jaipur, Varanasi, Goa", validation_rules: { maxLength: 500 } },
  { field_name: "accommodation_type", label: "Type of accommodation in India", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of hotel or property (first stop)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address in India (first stop)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 11, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_city", label: "City / State in India (first stop)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 12, validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "accommodation_phone", label: "Telephone of accommodation", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 13, validation_rules: { maxLength: 30, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 14, options: EXPENSE_BEARER_OPTIONS },

  // STEP 6: Purpose-Specific Details (sub-journey gated by purpose_of_visit)
  // Business
  { field_name: "in_business_company_name", label: "Indian business invitee — Company name", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 1, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 200, block_group: "business" } },
  { field_name: "in_business_address", label: "Indian business invitee — Address", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 2, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 200, block_group: "business" } },
  { field_name: "in_business_phone", label: "Indian business invitee — Phone", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 3, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 30, block_group: "business" } },
  { field_name: "in_business_purpose", label: "Nature of business activity", field_type: "textarea", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 4, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 1000, block_group: "business" } },
  // Medical
  { field_name: "in_medical_hospital_name", label: "Indian hospital — Name", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 5, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 200, block_group: "medical" } },
  { field_name: "in_medical_hospital_address", label: "Indian hospital — Address", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 6, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 200, block_group: "medical" } },
  { field_name: "in_medical_hospital_phone", label: "Indian hospital — Phone", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 7, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 30, block_group: "medical" } },
  { field_name: "in_medical_treatment_purpose", label: "Nature of medical treatment", field_type: "textarea", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 8, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 1000, block_group: "medical" } },
  // Conference
  { field_name: "in_conference_name", label: "Conference — Name", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 9, conditional_logic: { showIf: IS_CONFERENCE }, validation_rules: { maxLength: 200, block_group: "conference" } },
  { field_name: "in_conference_dates", label: "Conference — Dates", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 10, conditional_logic: { showIf: IS_CONFERENCE }, placeholder: "DD/MM/YYYY-DD/MM/YYYY", validation_rules: { maxLength: 80, block_group: "conference" } },
  { field_name: "in_conference_organiser", label: "Conference — Organiser", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 11, conditional_logic: { showIf: IS_CONFERENCE }, validation_rules: { maxLength: 200, block_group: "conference" } },
  { field_name: "in_conference_mea_clearance_number", label: "Conference — MEA political clearance number", field_type: "text", required: true, step_number: 6, step_name: "Purpose-Specific Details", display_order: 12, conditional_logic: { showIf: IS_CONFERENCE }, validation_rules: { maxLength: 50, block_group: "conference" } },

  // STEP 7: Host (optional)
  { field_name: "has_host_in_india", label: "Do you have a host (friend, relative, or sponsor) in India?", field_type: "radio", required: true, step_number: 7, step_name: "Host in India", display_order: 1, options: YES_NO },
  { field_name: "host_full_name", label: "Host — Full name", field_type: "text", required: true, step_number: 7, step_name: "Host in India", display_order: 2, conditional_logic: { showIf: HAS_HOST_IN_IN }, validation_rules: { maxLength: 120, block_group: "host" } },
  { field_name: "host_relationship_to_applicant", label: "Host — Relationship to applicant", field_type: "text", required: true, step_number: 7, step_name: "Host in India", display_order: 3, conditional_logic: { showIf: HAS_HOST_IN_IN }, validation_rules: { maxLength: 80, block_group: "host" } },
  { field_name: "host_address", label: "Host — Address in India", field_type: "text", required: true, step_number: 7, step_name: "Host in India", display_order: 4, conditional_logic: { showIf: HAS_HOST_IN_IN }, validation_rules: { maxLength: 200, block_group: "host" } },
  { field_name: "host_phone", label: "Host — Telephone (incl. country code)", field_type: "text", required: true, step_number: 7, step_name: "Host in India", display_order: 5, conditional_logic: { showIf: HAS_HOST_IN_IN }, validation_rules: { maxLength: 30, block_group: "host" } },
  { field_name: "host_aadhaar_or_passport", label: "Host — Aadhaar / PAN / passport number", field_type: "text", required: true, step_number: 7, step_name: "Host in India", display_order: 6, conditional_logic: { showIf: HAS_HOST_IN_IN }, validation_rules: { maxLength: 30, block_group: "host" } },

  // STEP 8: Travel History
  { field_name: "visited_india_before", label: "Have you ever visited India before?", field_type: "radio", required: true, step_number: 8, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_in_visit_arrival_date", label: "Prior India visit — Arrival date", field_type: "date", required: true, step_number: 8, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_IN_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_in_visits", max_items: 5 } },
  { field_name: "prior_in_visit_departure_date", label: "Prior India visit — Departure date", field_type: "date", required: true, step_number: 8, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_IN_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_in_visits" } },
  { field_name: "prior_in_visit_purpose", label: "Prior India visit — Purpose", field_type: "text", required: true, step_number: 8, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_IN_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_in_visits" } },
  { field_name: "prior_in_visa_number", label: "Prior India visit — Visa number (if known)", field_type: "text", required: false, step_number: 8, step_name: "Travel History", display_order: 5, conditional_logic: { showIf: VISITED_IN_BEFORE }, validation_rules: { maxLength: 30, repeatable: true, repeat_group: "prior_in_visits" } },
  { field_name: "refused_visa_or_entry_india", label: "Have you ever been refused a visa to, or denied entry into, India?", field_type: "radio", required: true, step_number: 8, step_name: "Travel History", display_order: 6, options: YES_NO },
  { field_name: "refused_visa_in_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Travel History", display_order: 7, conditional_logic: { showIf: REFUSED_VISA_IN }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Travel History", display_order: 8, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details", field_type: "textarea", required: true, step_number: 8, step_name: "Travel History", display_order: 9, conditional_logic: { showIf: REFUSED_VISA_OTHER }, validation_rules: { maxLength: 1000 } },
  { field_name: "countries_visited_last_10_years", label: "Countries visited in the last 10 years", field_type: "textarea", required: true, step_number: 8, step_name: "Travel History", display_order: 10, validation_rules: { maxLength: 2000 } },

  // STEP 9: Character & Declaration
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 1, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details", field_type: "textarea", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 2, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported from India or any other country?", field_type: "radio", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 3, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details", field_type: "textarea", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 4, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_terrorism_or_security_history", label: "Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security?", field_type: "radio", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 5, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 9, step_name: "Character & Declaration", display_order: 6, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 7, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the Republic of India.", field_type: "checkbox", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 8, options: [{ value: "yes", text: "I agree" }] },
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
