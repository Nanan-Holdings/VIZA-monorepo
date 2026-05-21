/**
 * Seed script: visa_form_fields for UAE Tourist Visa.
 *
 * Field definitions mirror the Federal Authority for Identity,
 * Citizenship, Customs and Port Security (ICP) Smart Services portal
 * at `https://smartservices.icp.gov.ae` (UAE federal e-Visa) and the
 * General Directorate of Residency and Foreigners Affairs Dubai
 * (GDRFA) flow at `https://smart.gdrfad.gov.ae`. Both are identity-
 * gated. The schema is a high-fidelity reconstruction from public
 * landing pages, the UAE consular guidance, and the ICP/GDRFA
 * applicant guidance. Same posture as JP_TOURIST, EG_E_VISA,
 * TH_TOURIST_E_VISA, MY_TOURIST_E_VISA.
 *
 * Scope: Tourist Visa — 30-day single-entry (~AED 350), 60-day
 * single-entry (~AED 650), multi-entry 5-year tourist visa (~AED 650,
 * 90-day stay per entry up to 180 days/year). Variant captured by
 * `visa_type_requested`. UAE-specific: a sponsor block for those
 * applying via airline / travel-agent sponsors (Emirates, Etihad,
 * flydubai, etc.) AS A REQUIRED route into the system.
 *
 * Out of scope: UAE Residence Visa (employment, investor, golden
 * visa, retirement, real-estate, family, student), Green Visa,
 * Freelance / Remote-work permit, Mission / Job-exploration visa
 * (consular flow), and visa-on-arrival (~73 visa-exempt nationalities
 * + ~7 VOA-eligible nationalities — no online form).
 *
 * Document uploads (passport bio, photo, hotel/itinerary, return
 * ticket, financial proof, sponsor documents) are out-of-schema per
 * playbook §5.6.
 *
 * Run: npx tsx scripts/seed-ae-tourist-visa-form-fields.ts
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

const VISA_TYPE = "AE_TOURIST_VISA";

interface FieldDef { field_name: string; label: string; field_type: string; required: boolean; step_number: number; step_name: string; display_order: number; placeholder?: string; validation_rules?: Record<string, unknown>; options?: Array<{ value: string; text: string }>; conditional_logic?: Record<string, unknown>; }

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

const HAS_OTHER_NAMES = "has_other_names_used === yes";
const HAS_OTHER_NATIONALITIES = "has_other_nationalities === yes";
const IS_MARRIED = "marital_status === married";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const HAS_SPONSOR = "has_sponsor === yes";
const HAS_HOST_IN_AE = "has_host_in_uae === yes";
const VISITED_AE_BEFORE = "visited_uae_before === yes";
const REFUSED_VISA_AE = "refused_visa_or_entry_uae === yes";
const REFUSED_VISA_OTHER = "refused_visa_other_country === yes";
const HAS_CRIMINAL = "has_criminal_record === yes";
const HAS_DEPORTED = "has_been_deported === yes";

const SEX_OPTIONS = [{ value: "male", text: "Male" }, { value: "female", text: "Female" }];
const PASSPORT_TYPE_OPTIONS = [{ value: "ordinary", text: "Ordinary" }];
const MARITAL_STATUS_OPTIONS = [{ value: "single", text: "Single" }, { value: "married", text: "Married" }, { value: "divorced", text: "Divorced" }, { value: "widowed", text: "Widowed" }];
const RELIGION_OPTIONS = [
  { value: "islam", text: "Islam" },
  { value: "christianity", text: "Christianity" },
  { value: "hinduism", text: "Hinduism" },
  { value: "buddhism", text: "Buddhism" },
  { value: "judaism", text: "Judaism" },
  { value: "sikhism", text: "Sikhism" },
  { value: "no_religion", text: "No religion" },
  { value: "other", text: "Other" },
];
const OCCUPATION_OPTIONS = [{ value: "employed", text: "Employed" }, { value: "self_employed", text: "Self-employed" }, { value: "businessperson", text: "Businessperson" }, { value: "student", text: "Student" }, { value: "retired", text: "Retired" }, { value: "homemaker", text: "Homemaker" }, { value: "unemployed", text: "Unemployed" }, { value: "other", text: "Other" }];

const PURPOSE_OF_VISIT_OPTIONS = [{ value: "tourism", text: "Tourism" }];

const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "tourist_30d", text: "Tourist Visa — 30 days, single entry, ~AED 350" },
  { value: "tourist_60d", text: "Tourist Visa — 60 days, single entry, ~AED 650" },
  { value: "tourist_5y_multi", text: "5-year Multi-entry Tourist Visa — ~AED 650, 90-day stay per entry (up to 180 days/year)" },
];

// UAE Tourist Visa applications are commonly routed through an airline
// or travel-agent sponsor (Emirates, Etihad, flydubai, dnata, Air Arabia).
// Even direct ICP applications often require a registered sponsor.
const SPONSOR_TYPE_OPTIONS = [
  { value: "airline_emirates", text: "Emirates Airlines" },
  { value: "airline_etihad", text: "Etihad Airways" },
  { value: "airline_flydubai", text: "flydubai" },
  { value: "airline_air_arabia", text: "Air Arabia" },
  { value: "travel_agent_dnata", text: "dnata Travel" },
  { value: "travel_agent_other", text: "Other registered travel agent" },
  { value: "hotel", text: "UAE-licensed hotel" },
  { value: "uae_resident", text: "UAE Resident (1st/2nd-degree relative)" },
  { value: "self_apply_icp", text: "Self-apply via ICP Smart Services (no sponsor)" },
];

const PORT_OF_ENTRY_OPTIONS = [
  { value: "dubai_dxb", text: "Dubai International Airport (DXB)" },
  { value: "dubai_dwc", text: "Al Maktoum International Airport (DWC)" },
  { value: "abu_dhabi_auh", text: "Abu Dhabi International Airport (AUH)" },
  { value: "sharjah_shj", text: "Sharjah International Airport (SHJ)" },
  { value: "ras_al_khaimah_rkt", text: "Ras Al Khaimah International Airport (RKT)" },
  { value: "fujairah_fjr", text: "Fujairah International Airport (FJR)" },
  { value: "al_ain_aan", text: "Al Ain International Airport (AAN)" },
  { value: "hatta_land", text: "Hatta border (Oman)" },
  { value: "ghuwaifat_land", text: "Al Ghuwaifat (Saudi Arabia border)" },
  { value: "khor_fakkan_seaport", text: "Khor Fakkan Seaport" },
  { value: "port_rashid_seaport", text: "Port Rashid (Dubai cruise)" },
  { value: "port_zayed_seaport", text: "Port Zayed (Abu Dhabi cruise)" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "hotel", text: "Hotel" },
  { value: "resort", text: "Resort" },
  { value: "rental_apartment", text: "Furnished apartment / Holiday home" },
  { value: "host_residence", text: "Residence of host (friend or relative)" },
  { value: "other", text: "Other" },
];

const EXPENSE_BEARER_OPTIONS = [{ value: "self", text: "Self" }, { value: "employer", text: "Employer" }, { value: "family", text: "Family member" }, { value: "host", text: "Host / Sponsor in UAE" }, { value: "other", text: "Other" }];

const FIELDS: FieldDef[] = [
  // STEP 1: Personal Information
  { field_name: "surname", label: "Surname (Family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "name_in_arabic", label: "Name in Arabic (if applicable)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 3, validation_rules: { maxLength: 80 } },
  { field_name: "has_other_names_used", label: "Have you ever been known by any other names?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, options: YES_NO },
  { field_name: "other_names_used", label: "Other names used", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, conditional_logic: { showIf: HAS_OTHER_NAMES }, validation_rules: { maxLength: 120 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth_city", label: "Place of birth — City / Town", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { maxLength: 60, block_group: "place_of_birth" } },
  { field_name: "place_of_birth_country", label: "Place of birth — Country", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { source: "ISO3166-1", block_group: "place_of_birth" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, validation_rules: { source: "ISO3166-1" } },
  { field_name: "religion", label: "Religion", field_type: "select", required: false, step_number: 1, step_name: "Personal Information", display_order: 11, options: RELIGION_OPTIONS },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality / citizenship?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 13, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "national_id_number", label: "National ID number (if your country issues one)", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 14, validation_rules: { maxLength: 30 } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 15, options: MARITAL_STATUS_OPTIONS },
  { field_name: "spouse_full_name", label: "Spouse — Full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 16, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { maxLength: 120, block_group: "spouse" } },
  { field_name: "spouse_nationality", label: "Spouse — Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 17, conditional_logic: { showIf: IS_MARRIED }, validation_rules: { source: "ISO3166-1", block_group: "spouse" } },
  { field_name: "father_full_name", label: "Father's full name", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 18, validation_rules: { maxLength: 120 } },
  { field_name: "mother_full_name", label: "Mother's full name (including maiden name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 19, validation_rules: { maxLength: 120 } },

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
  { field_name: "visa_type_requested", label: "Visa type requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to UAE", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in UAE", field_type: "date", required: true, step_number: 5, step_name: "Trip Details", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 90)", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 4, validation_rules: { pattern: "^(?:[1-9]|[1-8][0-9]|90)$", inline_group: "trip_dates" } },
  { field_name: "port_of_entry", label: "Intended port of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 5, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 6, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline, ship, or transport carrier", field_type: "text", required: false, step_number: 5, step_name: "Trip Details", display_order: 7, placeholder: "e.g. Emirates, Etihad, flydubai", validation_rules: { maxLength: 80 } },
  { field_name: "accommodation_type", label: "Type of accommodation in UAE", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 8, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of hotel or property", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 9, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_address", label: "Address in UAE", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 10, validation_rules: { maxLength: 200, block_group: "accommodation_details" } },
  { field_name: "accommodation_emirate", label: "Emirate", field_type: "text", required: true, step_number: 5, step_name: "Trip Details", display_order: 11, placeholder: "e.g. Dubai, Abu Dhabi, Sharjah", validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "expense_bearer", label: "Who will cover the expenses for your visit?", field_type: "select", required: true, step_number: 5, step_name: "Trip Details", display_order: 12, options: EXPENSE_BEARER_OPTIONS },

  // STEP 6: Sponsor (UAE-specific)
  { field_name: "has_sponsor", label: "Do you have a sponsor for this application?", field_type: "radio", required: true, step_number: 6, step_name: "Sponsor", display_order: 1, options: YES_NO },
  { field_name: "sponsor_type", label: "Sponsor type", field_type: "select", required: true, step_number: 6, step_name: "Sponsor", display_order: 2, conditional_logic: { showIf: HAS_SPONSOR }, options: SPONSOR_TYPE_OPTIONS },
  { field_name: "sponsor_name", label: "Sponsor — Full name (or company name)", field_type: "text", required: true, step_number: 6, step_name: "Sponsor", display_order: 3, conditional_logic: { showIf: HAS_SPONSOR }, validation_rules: { maxLength: 200, block_group: "sponsor" } },
  { field_name: "sponsor_emirates_id_or_license", label: "Sponsor — Emirates ID or trade-license number", field_type: "text", required: true, step_number: 6, step_name: "Sponsor", display_order: 4, conditional_logic: { showIf: HAS_SPONSOR }, validation_rules: { maxLength: 30, block_group: "sponsor" } },
  { field_name: "sponsor_phone", label: "Sponsor — Telephone", field_type: "text", required: true, step_number: 6, step_name: "Sponsor", display_order: 5, conditional_logic: { showIf: HAS_SPONSOR }, validation_rules: { maxLength: 30, block_group: "sponsor" } },
  { field_name: "sponsor_email", label: "Sponsor — Email", field_type: "text", required: true, step_number: 6, step_name: "Sponsor", display_order: 6, conditional_logic: { showIf: HAS_SPONSOR }, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "sponsor" } },

  // STEP 7: Host (separate from sponsor — informational)
  { field_name: "has_host_in_uae", label: "Will you be staying with a host (different from your sponsor)?", field_type: "radio", required: true, step_number: 7, step_name: "Host in UAE", display_order: 1, options: YES_NO },
  { field_name: "host_full_name", label: "Host — Full name", field_type: "text", required: true, step_number: 7, step_name: "Host in UAE", display_order: 2, conditional_logic: { showIf: HAS_HOST_IN_AE }, validation_rules: { maxLength: 120, block_group: "host" } },
  { field_name: "host_relationship_to_applicant", label: "Host — Relationship to applicant", field_type: "text", required: true, step_number: 7, step_name: "Host in UAE", display_order: 3, conditional_logic: { showIf: HAS_HOST_IN_AE }, validation_rules: { maxLength: 80, block_group: "host" } },
  { field_name: "host_address", label: "Host — Address in UAE", field_type: "text", required: true, step_number: 7, step_name: "Host in UAE", display_order: 4, conditional_logic: { showIf: HAS_HOST_IN_AE }, validation_rules: { maxLength: 200, block_group: "host" } },
  { field_name: "host_phone", label: "Host — Telephone", field_type: "text", required: true, step_number: 7, step_name: "Host in UAE", display_order: 5, conditional_logic: { showIf: HAS_HOST_IN_AE }, validation_rules: { maxLength: 30, block_group: "host" } },

  // STEP 8: Travel History
  { field_name: "visited_uae_before", label: "Have you ever visited the UAE before?", field_type: "radio", required: true, step_number: 8, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prior_uae_visit_arrival_date", label: "Prior UAE visit — Arrival date", field_type: "date", required: true, step_number: 8, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: VISITED_AE_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_uae_visits", max_items: 5 } },
  { field_name: "prior_uae_visit_departure_date", label: "Prior UAE visit — Departure date", field_type: "date", required: true, step_number: 8, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: VISITED_AE_BEFORE }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "prior_uae_visits" } },
  { field_name: "prior_uae_visit_purpose", label: "Prior UAE visit — Purpose", field_type: "text", required: true, step_number: 8, step_name: "Travel History", display_order: 4, conditional_logic: { showIf: VISITED_AE_BEFORE }, validation_rules: { maxLength: 120, repeatable: true, repeat_group: "prior_uae_visits" } },
  { field_name: "refused_visa_or_entry_uae", label: "Have you ever been refused a visa to, or denied entry into, the UAE?", field_type: "radio", required: true, step_number: 8, step_name: "Travel History", display_order: 5, options: YES_NO },
  { field_name: "refused_visa_uae_details", label: "Provide details (date, place, reason)", field_type: "textarea", required: true, step_number: 8, step_name: "Travel History", display_order: 6, conditional_logic: { showIf: REFUSED_VISA_AE }, validation_rules: { maxLength: 1000 } },
  { field_name: "refused_visa_other_country", label: "Have you ever been refused a visa to, or denied entry into, any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Travel History", display_order: 7, options: YES_NO },
  { field_name: "refused_visa_other_country_details", label: "Provide details (country, date, reason)", field_type: "textarea", required: true, step_number: 8, step_name: "Travel History", display_order: 8, conditional_logic: { showIf: REFUSED_VISA_OTHER }, validation_rules: { maxLength: 1000 } },

  // STEP 9: Character & Declaration
  { field_name: "has_criminal_record", label: "Have you ever been convicted of a crime in any country?", field_type: "radio", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 1, options: YES_NO },
  { field_name: "criminal_record_details", label: "Provide details", field_type: "textarea", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 2, conditional_logic: { showIf: HAS_CRIMINAL }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_been_deported", label: "Have you ever been deported from the UAE or any other country?", field_type: "radio", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 3, options: YES_NO },
  { field_name: "deportation_details", label: "Provide details", field_type: "textarea", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 4, conditional_logic: { showIf: HAS_DEPORTED }, validation_rules: { maxLength: 1500 } },
  { field_name: "has_terrorism_or_security_history", label: "Have you ever been involved in terrorism, espionage, sabotage, narcotics trafficking, human trafficking, or any activity that might endanger public order or national security?", field_type: "radio", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 5, options: YES_NO },
  { field_name: "remarks_special_circumstances", label: "Remarks / Special Circumstances (optional)", field_type: "textarea", required: false, step_number: 9, step_name: "Character & Declaration", display_order: 6, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of application", field_type: "date", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 7, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the statements made in this application are true and correct, and I understand that any false statement may result in refusal of the visa or denial of entry into the United Arab Emirates.", field_type: "checkbox", required: true, step_number: 9, step_name: "Character & Declaration", display_order: 8, options: [{ value: "yes", text: "I agree" }] },
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
