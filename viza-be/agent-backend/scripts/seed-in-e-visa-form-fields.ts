/**
 * Seed script: official-source India e-Tourist Visa answer schema.
 *
 * Compatibility decision: retain the established `IN_E_VISA` key because
 * existing applications and payment/runner integrations reference it. The
 * product is now scoped strictly to e-Tourist Visa (e-T1 V): 30 days, one
 * year, or five years. Business, medical, attendant, conference, transit,
 * student, family, and mountaineering services require separate products.
 *
 * Sources checked 2026-08-16:
 * - https://indianvisaonline.gov.in/evisa/Registration
 * - https://indianvisaonline.gov.in/evisa/images/SampleForm.pdf
 * - https://indianvisaonline.gov.in/evisa/
 *
 * CAPTCHA, temporary-application credentials, review, payment, and official
 * session state are VIZA workflow concerns and are absent here. Photograph,
 * passport-bio-page, and purpose-specific uploads belong to
 * application_documents, never visa_form_fields.
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

const TOURIST_VALIDITY_OPTIONS = [
  { value: "30_days", text: "e-Tourist Visa — 30 days" },
  { value: "1_year", text: "e-Tourist Visa — 1 year" },
  { value: "5_years", text: "e-Tourist Visa — 5 years" },
];

const TOURIST_PURPOSE_OPTIONS = [
  { value: "recreation_sightseeing", text: "Tourism, recreation, or sightseeing" },
  { value: "meeting_friends_relatives", text: "Meeting friends or relatives" },
  { value: "short_term_yoga", text: "Short-term yoga programme" },
  { value: "short_term_course", text: "Short course of no more than 6 months with no qualification issued" },
  { value: "voluntary_work", text: "Unpaid voluntary work for no more than one month" },
];

const GENDER_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
  { value: "transgender", text: "Transgender" },
];

const NATIONALITY_ACQUISITION_OPTIONS = [
  { value: "birth", text: "By birth" },
  { value: "naturalization", text: "By naturalization" },
];

const RELIGION_OPTIONS = [
  { value: "buddhism", text: "Buddhism" },
  { value: "christianity", text: "Christianity" },
  { value: "hinduism", text: "Hinduism" },
  { value: "islam", text: "Islam" },
  { value: "jainism", text: "Jainism" },
  { value: "judaism", text: "Judaism" },
  { value: "sikhism", text: "Sikhism" },
  { value: "zoroastrianism", text: "Zoroastrianism" },
  { value: "other", text: "Other" },
];

const EDUCATION_OPTIONS = [
  { value: "below_matriculation", text: "Below matriculation" },
  { value: "graduate", text: "Graduate" },
  { value: "higher_secondary", text: "Higher secondary" },
  { value: "illiterate", text: "Illiterate" },
  { value: "matriculation", text: "Matriculation" },
  { value: "minor_not_applicable", text: "Not applicable — minor" },
  { value: "post_graduate", text: "Post graduate" },
  { value: "professional", text: "Professional" },
  { value: "other", text: "Other" },
];

const MARITAL_STATUS_OPTIONS = [
  { value: "single", text: "Single" },
  { value: "married", text: "Married" },
  { value: "divorced", text: "Divorced" },
  { value: "widowed", text: "Widowed" },
];

// Official values read from the live registration page on 2026-08-16.
const PORT_OPTIONS = [
  { value: "I140", text: "AGARTALA LANDPORT" },
  { value: "I270", text: "AGATTI SEAPORT" },
  { value: "I022", text: "AHMEDABAD AIRPORT" },
  { value: "I298", text: "ALANG SEAPORT" },
  { value: "I032", text: "AMRITSAR AIRPORT" },
  { value: "I096", text: "BAGDOGRA AIRPORT" },
  { value: "I221", text: "BEDI BANDAR SEAPORT" },
  { value: "I085", text: "BENGALURU AIRPORT" },
  { value: "I203", text: "BHAVNAGAR SEAPORT" },
  { value: "I027", text: "BHOPAL AIRPORT" },
  { value: "I084", text: "BHUBANESHWAR AIRPORT" },
  { value: "I010", text: "CALICUT AIRPORT" },
  { value: "I210", text: "CALICUT SEAPORT" },
  { value: "I005", text: "CHANDIGARH AIRPORT" },
  { value: "I008", text: "CHENNAI AIRPORT" },
  { value: "I208", text: "CHENNAI SEAPORT" },
  { value: "I024", text: "COCHIN AIRPORT" },
  { value: "I224", text: "COCHIN SEAPORT" },
  { value: "I094", text: "COIMBATORE AIRPORT" },
  { value: "I239", text: "CUDDALORE SEAPORT" },
  { value: "I217", text: "DAHEJ SEAPORT" },
  { value: "I132", text: "DARRANGA LANDPORT" },
  { value: "I130", text: "DAWKI LANDPORT" },
  { value: "I004", text: "DELHI AIRPORT" },
  { value: "I288", text: "DHAMRA SEAPORT" },
  { value: "I012", text: "GAYA AIRPORT" },
  { value: "I164", text: "GEDE LANDPORT" },
  { value: "I163", text: "GHOJADANGA LANDPORT" },
  { value: "I033", text: "GOA AIRPORT (DABOLIM)" },
  { value: "I034", text: "GOA AIRPORT (MOPA)" },
  { value: "I283", text: "GOA SEAPORT" },
  { value: "I019", text: "GUWAHATI AIRPORT" },
  { value: "I204", text: "HALDIA SEAPORT" },
  { value: "I162", text: "HARIDASPUR LANDPORT" },
  { value: "I229", text: "HAZIRA SEAPORT" },
  { value: "I041", text: "HYDERABAD AIRPORT" },
  { value: "I017", text: "INDORE AIRPORT" },
  { value: "I199", text: "JAIGAON LANDPORT" },
  { value: "I006", text: "JAIPUR AIRPORT" },
  { value: "I119", text: "JOGBANI LANDPORT" },
  { value: "I258", text: "KAKINADA SEAPORT" },
  { value: "I207", text: "KAMARAJAR SEAPORT" },
  { value: "I234", text: "KANDLA SEAPORT" },
  { value: "I030", text: "KANNUR AIRPORT" },
  { value: "I211", text: "KARAIKAL SEAPORT" },
  { value: "I209", text: "KATTUPALI SEAPORT" },
  { value: "I002", text: "KOLKATA AIRPORT" },
  { value: "I202", text: "KOLKATA SEAPORT" },
  { value: "I212", text: "KOLLAM SEAPORT" },
  { value: "I227", text: "KRISHNAPATNAM SEAPORT" },
  { value: "I021", text: "LUCKNOW AIRPORT" },
  { value: "I015", text: "MADURAI AIRPORT" },
  { value: "I272", text: "MANDVI SEAPORT" },
  { value: "I092", text: "MANGALORE AIRPORT" },
  { value: "I293", text: "MANGALORE SEAPORT" },
  { value: "I126", text: "MOREH LANDPORT" },
  { value: "I001", text: "MUMBAI AIRPORT" },
  { value: "I201", text: "MUMBAI SEAPORT" },
  { value: "I222", text: "MUNDRA SEAPORT" },
  { value: "I238", text: "NAGAPATTINAM SEAPORT" },
  { value: "I016", text: "NAGPUR AIRPORT" },
  { value: "I044", text: "NAVI MUMBAI AIRPORT" },
  { value: "I240", text: "NHAVA SHEVA SEAPORT" },
  { value: "I291", text: "PARADEEP SEAPORT" },
  { value: "I231", text: "PIPAVAV SEAPORT" },
  { value: "I220", text: "PORBANDAR SEAPORT" },
  { value: "I077", text: "PORTBLAIR AIRPORT" },
  { value: "I277", text: "PORT BLAIR SEAPORT" },
  { value: "I026", text: "PUNE AIRPORT" },
  { value: "I112", text: "RAXAUL LANDPORT" },
  { value: "I153", text: "RUPAIDIHA LANDPORT" },
  { value: "I218", text: "SIKKA SEAPORT" },
  { value: "I029", text: "SURAT AIRPORT" },
  { value: "I003", text: "TIRUCHIRAPALLI AIRPORT" },
  { value: "I042", text: "TIRUPATI AIRPORT" },
  { value: "I023", text: "TRIVANDRUM AIRPORT" },
  { value: "I219", text: "TUNA TEKRA SEAPORT" },
  { value: "I237", text: "TUTICORIN SEAPORT" },
  { value: "I223", text: "VALLARPADAM SEAPORT" },
  { value: "I007", text: "VARANASI AIRPORT" },
  { value: "I043", text: "VIJAYAWADA AIRPORT" },
  { value: "I025", text: "VISHAKHAPATNAM AIRPORT" },
  { value: "I225", text: "VISHAKHAPATNAM SEAPORT" },
  { value: "I228", text: "VIZHINJAM INTERNATIONAL SEAPORT" },
  { value: "I226", text: "VIZHINJAM SEAPORT" },
];

const PRIOR_NAME = "has_changed_name === yes";
const OTHER_RELIGION = "religion === other";
const OTHER_DOCUMENT = "has_other_valid_travel_document === yes";
const DIFFERENT_PERMANENT_ADDRESS = "permanent_address_same_as_present === no";
const PAKISTAN_ANCESTRY = "has_pakistan_parent_or_grandparent_history === yes";
const VISITED_INDIA = "visited_india_before === yes";
const INDIA_PERMISSION_REFUSED = "india_permission_previously_refused === yes";
const VISITED_SAARC = "visited_saarc_last_three_years === yes";

const FIELDS: FieldDef[] = [
  // Step 1 — public registration screen. Duplicate-email confirmation and
  // CAPTCHA are UI/session controls and deliberately not answer fields.
  { field_name: "nationality", label: "Nationality/region", field_type: "country", required: true, step_number: 1, step_name: "Registration & Eligibility", display_order: 1, validation_rules: { source: "official-evisa-nationality-list", official_field: "appl.nationality" } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 1, step_name: "Registration & Eligibility", display_order: 2, options: [{ value: "1", text: "Ordinary Passport" }], validation_rules: { official_field: "appl.ppt_type_id", note: "Non-ordinary passport holders are not eligible for this product." } },
  { field_name: "port_of_arrival", label: "Port of arrival", field_type: "select", required: true, step_number: 1, step_name: "Registration & Eligibility", display_order: 3, options: PORT_OPTIONS, validation_rules: { official_field: "appl.missioncode", official_values_preserved: true } },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Registration & Eligibility", display_order: 4, validation_rules: { format: "DD/MM/YYYY", official_field: "appl.birthdate" } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 1, step_name: "Registration & Eligibility", display_order: 5, validation_rules: { maxLength: 50, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", official_field: "appl.email" } },
  { field_name: "tourist_validity", label: "e-Tourist Visa validity", field_type: "radio", required: true, step_number: 1, step_name: "Registration & Eligibility", display_order: 6, options: TOURIST_VALIDITY_OPTIONS, validation_rules: { official_service_ids: { "30_days": "31", "1_year": "3", "5_years": "32" } } },
  { field_name: "tourist_purpose", label: "Purpose of the e-Tourist visit", field_type: "select", required: true, step_number: 1, step_name: "Registration & Eligibility", display_order: 7, options: TOURIST_PURPOSE_OPTIONS, validation_rules: { official_field: "evisa_purpose", official_purpose_ids_by_validity: { "30_days": { recreation_sightseeing: "251", meeting_friends_relatives: "252", short_term_yoga: "253", short_term_course: "259", voluntary_work: "260" }, "1_year": { recreation_sightseeing: "21", meeting_friends_relatives: "22", short_term_yoga: "23", short_term_course: "257", voluntary_work: "258" }, "5_years": { recreation_sightseeing: "254", meeting_friends_relatives: "255", short_term_yoga: "256", short_term_course: "261", voluntary_work: "262" } } } },
  { field_name: "expected_arrival_date", label: "Expected date of arrival", field_type: "date", required: true, step_number: 1, step_name: "Registration & Eligibility", display_order: 8, validation_rules: { format: "DD/MM/YYYY", official_field: "appl.journeydate" } },

  // Step 2 — applicant and travel-document details.
  { field_name: "surname", label: "Surname / family name, exactly as in your passport", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 1, validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given name(s), exactly as in your passport", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 2, validation_rules: { maxLength: 50 } },
  { field_name: "has_changed_name", label: "Have you ever changed your name?", field_type: "radio", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 3, options: YES_NO },
  { field_name: "previous_name_details", label: "Previous name details", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 4, conditional_logic: { showIf: PRIOR_NAME }, validation_rules: { maxLength: 120 } },
  { field_name: "gender", label: "Gender", field_type: "select", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 5, options: GENDER_OPTIONS },
  { field_name: "birth_town_city", label: "Town/city of birth", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 6, validation_rules: { maxLength: 60 } },
  { field_name: "birth_country", label: "Country of birth", field_type: "country", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 7, validation_rules: { source: "ISO3166-1" } },
  { field_name: "national_id_number", label: "Citizenship / national identification number", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 8, placeholder: "Enter NA if not applicable", validation_rules: { maxLength: 40 } },
  { field_name: "religion", label: "Religion", field_type: "select", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 9, options: RELIGION_OPTIONS },
  { field_name: "religion_other", label: "Specify religion", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 10, conditional_logic: { showIf: OTHER_RELIGION }, validation_rules: { maxLength: 50 } },
  { field_name: "visible_identification_marks", label: "Visible identification marks", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 11, validation_rules: { maxLength: 120 } },
  { field_name: "educational_qualification", label: "Educational qualification", field_type: "select", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 12, options: EDUCATION_OPTIONS },
  { field_name: "nationality_acquisition", label: "Did you acquire nationality by birth or by naturalization?", field_type: "radio", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 13, options: NATIONALITY_ACQUISITION_OPTIONS },
  { field_name: "lived_two_years_in_application_country", label: "Have you lived for at least two years in the country where you are applying?", field_type: "radio", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 14, options: YES_NO },
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 15, validation_rules: { maxLength: 20, block_group: "passport" } },
  { field_name: "passport_place_of_issue", label: "Place of issue", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 16, validation_rules: { maxLength: 100, block_group: "passport" } },
  { field_name: "passport_issue_date", label: "Passport issue date", field_type: "date", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 17, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates", block_group: "passport" } },
  { field_name: "passport_expiry_date", label: "Passport expiry date", field_type: "date", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 18, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates", block_group: "passport", note: "Passport must have at least six months' validity when applying." } },
  { field_name: "has_other_valid_travel_document", label: "Do you hold any other valid passport or identity certificate?", field_type: "radio", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 19, options: YES_NO },
  { field_name: "other_document_country_of_issue", label: "Other document — Country of issue", field_type: "country", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 20, conditional_logic: { showIf: OTHER_DOCUMENT }, validation_rules: { source: "ISO3166-1", block_group: "other_travel_document" } },
  { field_name: "other_document_number", label: "Other passport / identity certificate number", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 21, conditional_logic: { showIf: OTHER_DOCUMENT }, validation_rules: { maxLength: 30, block_group: "other_travel_document" } },
  { field_name: "other_document_issue_date", label: "Other document — Issue date", field_type: "date", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 22, conditional_logic: { showIf: OTHER_DOCUMENT }, validation_rules: { format: "DD/MM/YYYY", block_group: "other_travel_document" } },
  { field_name: "other_document_place_of_issue", label: "Other document — Place of issue", field_type: "text", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 23, conditional_logic: { showIf: OTHER_DOCUMENT }, validation_rules: { maxLength: 100, block_group: "other_travel_document" } },
  { field_name: "other_document_nationality", label: "Other document — Nationality mentioned therein", field_type: "country", required: true, step_number: 2, step_name: "Applicant & Passport Details", display_order: 24, conditional_logic: { showIf: OTHER_DOCUMENT }, validation_rules: { source: "ISO3166-1", block_group: "other_travel_document" } },

  // Step 3 — address and family details.
  { field_name: "present_house_street", label: "Present address — House number / street", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 1, validation_rules: { maxLength: 35, block_group: "present_address" } },
  { field_name: "present_village_town_city", label: "Present address — Village / town / city", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 2, validation_rules: { maxLength: 35, block_group: "present_address" } },
  { field_name: "present_country", label: "Present address — Country", field_type: "country", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 3, validation_rules: { source: "ISO3166-1", block_group: "present_address" } },
  { field_name: "present_state_province_district", label: "Present address — State / province / district", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 4, validation_rules: { maxLength: 35, block_group: "present_address" } },
  { field_name: "present_postal_code", label: "Present address — Postal / ZIP code", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 5, validation_rules: { maxLength: 20, block_group: "present_address" } },
  { field_name: "phone_number", label: "Phone number", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 6, validation_rules: { maxLength: 30 } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: false, step_number: 3, step_name: "Address & Family Details", display_order: 7, validation_rules: { maxLength: 30 } },
  { field_name: "permanent_address_same_as_present", label: "Is your permanent address the same as your present address?", field_type: "radio", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 8, options: YES_NO },
  { field_name: "permanent_house_street", label: "Permanent address — House number / street", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 9, conditional_logic: { showIf: DIFFERENT_PERMANENT_ADDRESS }, validation_rules: { maxLength: 35, block_group: "permanent_address" } },
  { field_name: "permanent_village_town_city", label: "Permanent address — Village / town / city", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 10, conditional_logic: { showIf: DIFFERENT_PERMANENT_ADDRESS }, validation_rules: { maxLength: 35, block_group: "permanent_address" } },
  { field_name: "permanent_state_province_district", label: "Permanent address — State / province / district", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 11, conditional_logic: { showIf: DIFFERENT_PERMANENT_ADDRESS }, validation_rules: { maxLength: 35, block_group: "permanent_address" } },
  { field_name: "father_name", label: "Father's name", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 12, validation_rules: { maxLength: 100, block_group: "father_details" } },
  { field_name: "father_nationality", label: "Father's nationality", field_type: "country", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 13, validation_rules: { source: "ISO3166-1", block_group: "father_details" } },
  { field_name: "father_previous_nationality", label: "Father's previous nationality", field_type: "country", required: false, step_number: 3, step_name: "Address & Family Details", display_order: 14, validation_rules: { source: "ISO3166-1", block_group: "father_details" } },
  { field_name: "father_place_of_birth", label: "Father's place of birth", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 15, validation_rules: { maxLength: 100, block_group: "father_details" } },
  { field_name: "father_country_of_birth", label: "Father's country of birth", field_type: "country", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 16, validation_rules: { source: "ISO3166-1", block_group: "father_details" } },
  { field_name: "mother_name", label: "Mother's name", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 17, validation_rules: { maxLength: 100, block_group: "mother_details" } },
  { field_name: "mother_nationality", label: "Mother's nationality", field_type: "country", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 18, validation_rules: { source: "ISO3166-1", block_group: "mother_details" } },
  { field_name: "mother_previous_nationality", label: "Mother's previous nationality", field_type: "country", required: false, step_number: 3, step_name: "Address & Family Details", display_order: 19, validation_rules: { source: "ISO3166-1", block_group: "mother_details" } },
  { field_name: "mother_place_of_birth", label: "Mother's place of birth", field_type: "text", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 20, validation_rules: { maxLength: 100, block_group: "mother_details" } },
  { field_name: "mother_country_of_birth", label: "Mother's country of birth", field_type: "country", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 21, validation_rules: { source: "ISO3166-1", block_group: "mother_details" } },
  { field_name: "marital_status", label: "Marital status", field_type: "select", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 22, options: MARITAL_STATUS_OPTIONS },
  { field_name: "has_pakistan_parent_or_grandparent_history", label: "Were your parents or grandparents Pakistani nationals or did they belong to a Pakistan-held area?", field_type: "radio", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 23, options: YES_NO },
  { field_name: "pakistan_parent_or_grandparent_details", label: "Give details of the Pakistan nationality or area connection", field_type: "textarea", required: true, step_number: 3, step_name: "Address & Family Details", display_order: 24, conditional_logic: { showIf: PAKISTAN_ANCESTRY }, validation_rules: { maxLength: 1000 } },

  // Step 4 — visa, travel history, and references.
  { field_name: "place_to_visit_1", label: "Place to be visited", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 1, validation_rules: { maxLength: 100 } },
  { field_name: "place_to_visit_2", label: "Second place to be visited", field_type: "text", required: false, step_number: 4, step_name: "Visa, Travel History & References", display_order: 2, validation_rules: { maxLength: 100 } },
  { field_name: "hotel_booked_through_tour_operator", label: "Have you booked a hotel or resort through a tour operator?", field_type: "radio", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 3, options: YES_NO },
  { field_name: "expected_port_of_exit", label: "Expected port of exit from India", field_type: "select", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 4, options: PORT_OPTIONS, validation_rules: { official_values_preserved: true } },
  { field_name: "visited_india_before", label: "Have you ever visited India before?", field_type: "radio", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 5, options: YES_NO },
  { field_name: "previous_india_stay_address", label: "Address where you stayed during your last visit", field_type: "textarea", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 6, conditional_logic: { showIf: VISITED_INDIA }, validation_rules: { maxLength: 300, block_group: "previous_india_visa" } },
  { field_name: "cities_previously_visited_in_india", label: "Cities previously visited in India", field_type: "textarea", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 7, conditional_logic: { showIf: VISITED_INDIA }, validation_rules: { maxLength: 500, block_group: "previous_india_visa" } },
  { field_name: "previous_indian_visa_number", label: "Last or currently valid Indian visa number", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 8, conditional_logic: { showIf: VISITED_INDIA }, validation_rules: { maxLength: 40, block_group: "previous_india_visa" } },
  { field_name: "previous_indian_visa_type", label: "Previous Indian visa type", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 9, conditional_logic: { showIf: VISITED_INDIA }, validation_rules: { maxLength: 80, official_control: "select", live_options_pending_capture: true, block_group: "previous_india_visa" } },
  { field_name: "previous_indian_visa_place_of_issue", label: "Previous Indian visa — Place of issue", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 10, conditional_logic: { showIf: VISITED_INDIA }, validation_rules: { maxLength: 100, block_group: "previous_india_visa" } },
  { field_name: "previous_indian_visa_issue_date", label: "Previous Indian visa — Date of issue", field_type: "date", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 11, conditional_logic: { showIf: VISITED_INDIA }, validation_rules: { format: "DD/MM/YYYY", block_group: "previous_india_visa" } },
  { field_name: "india_permission_previously_refused", label: "Has permission to visit or extend stay in India previously been refused?", field_type: "radio", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 12, options: YES_NO },
  { field_name: "india_permission_refusal_details", label: "When and by whom was permission refused? Include the control number and date", field_type: "textarea", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 13, conditional_logic: { showIf: INDIA_PERMISSION_REFUSED }, validation_rules: { maxLength: 1000 } },
  { field_name: "countries_visited_last_ten_years", label: "Countries visited in the last 10 years", field_type: "textarea", required: false, step_number: 4, step_name: "Visa, Travel History & References", display_order: 14, validation_rules: { maxLength: 2000, official_control: "multi_select" } },
  { field_name: "visited_saarc_last_three_years", label: "Have you visited SAARC countries, except your own country, during the last 3 years?", field_type: "radio", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 15, options: YES_NO },
  { field_name: "saarc_country", label: "SAARC country visited", field_type: "country", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 16, conditional_logic: { showIf: VISITED_SAARC }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "saarc_visits", max_items: 8 } },
  { field_name: "saarc_visit_year", label: "Year of SAARC visit", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 17, conditional_logic: { showIf: VISITED_SAARC }, validation_rules: { pattern: "^[0-9]{4}$", repeatable: true, repeat_group: "saarc_visits" } },
  { field_name: "saarc_number_of_visits", label: "Number of visits", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 18, conditional_logic: { showIf: VISITED_SAARC }, validation_rules: { pattern: "^[1-9][0-9]*$", repeatable: true, repeat_group: "saarc_visits" } },
  { field_name: "india_reference_name", label: "Reference name in India", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 19, validation_rules: { maxLength: 100, block_group: "india_reference" } },
  { field_name: "india_reference_address", label: "Reference address in India", field_type: "textarea", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 20, validation_rules: { maxLength: 300, block_group: "india_reference" } },
  { field_name: "india_reference_phone", label: "Reference phone number in India", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 21, validation_rules: { maxLength: 30, block_group: "india_reference" } },
  { field_name: "home_country_reference_name", label: "Reference name in your home country", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 22, validation_rules: { maxLength: 100, block_group: "home_country_reference" } },
  { field_name: "home_country_reference_address", label: "Reference address in your home country", field_type: "textarea", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 23, validation_rules: { maxLength: 300, block_group: "home_country_reference" } },
  { field_name: "home_country_reference_phone", label: "Reference phone number in your home country", field_type: "text", required: true, step_number: 4, step_name: "Visa, Travel History & References", display_order: 24, validation_rules: { maxLength: 30, block_group: "home_country_reference" } },

  // Step 5 — six distinct official background questions.
  { field_name: "arrested_prosecuted_or_convicted", label: "Have you ever been arrested, prosecuted, or convicted by a court of law in any country?", field_type: "radio", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 1, options: YES_NO },
  { field_name: "arrested_prosecuted_or_convicted_details", label: "Give details", field_type: "textarea", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 2, conditional_logic: { showIf: "arrested_prosecuted_or_convicted === yes" }, validation_rules: { maxLength: 1500 } },
  { field_name: "refused_entry_or_deported", label: "Have you ever been refused entry to or deported by any country, including India?", field_type: "radio", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 3, options: YES_NO },
  { field_name: "refused_entry_or_deported_details", label: "Give details", field_type: "textarea", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 4, conditional_logic: { showIf: "refused_entry_or_deported === yes" }, validation_rules: { maxLength: 1500 } },
  { field_name: "trafficking_abuse_or_financial_offence", label: "Have you ever engaged in human trafficking, drug trafficking, child abuse, crimes against women, an economic offence, or financial fraud?", field_type: "radio", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 5, options: YES_NO },
  { field_name: "trafficking_abuse_or_financial_offence_details", label: "Give details", field_type: "textarea", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 6, conditional_logic: { showIf: "trafficking_abuse_or_financial_offence === yes" }, validation_rules: { maxLength: 1500 } },
  { field_name: "cybercrime_terrorism_or_violence", label: "Have you ever engaged in cybercrime, terrorist activity, sabotage, espionage, genocide, political killing, or another act of violence?", field_type: "radio", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 7, options: YES_NO },
  { field_name: "cybercrime_terrorism_or_violence_details", label: "Give details", field_type: "textarea", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 8, conditional_logic: { showIf: "cybercrime_terrorism_or_violence === yes" }, validation_rules: { maxLength: 1500 } },
  { field_name: "expressed_support_for_terrorist_violence", label: "Have you expressed views that justify or glorify terrorist violence, or encouraged others to commit terrorist or other serious criminal acts?", field_type: "radio", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 9, options: YES_NO },
  { field_name: "expressed_support_for_terrorist_violence_details", label: "Give details", field_type: "textarea", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 10, conditional_logic: { showIf: "expressed_support_for_terrorist_violence === yes" }, validation_rules: { maxLength: 1500 } },
  { field_name: "sought_asylum", label: "Have you sought asylum, political or otherwise, in any country?", field_type: "radio", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 11, options: YES_NO },
  { field_name: "sought_asylum_details", label: "Give details", field_type: "textarea", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 12, conditional_logic: { showIf: "sought_asylum === yes" }, validation_rules: { maxLength: 1500 } },
  { field_name: "final_declaration", label: "I declare that the information furnished is correct to the best of my knowledge and belief, and I understand that false information may result in legal action, deportation, or blacklisting.", field_type: "checkbox", required: true, step_number: 5, step_name: "Additional Questions & Declaration", display_order: 13, options: [{ value: "yes", text: "I agree" }] },
];

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);
  const { error: delError } = await supabase.from("visa_form_fields").delete().eq("visa_type", VISA_TYPE);
  if (delError) console.error("Error deleting:", delError.message);
  else console.log(`Cleared ${VISA_TYPE}`);

  const rows = FIELDS.map((field) => toBilingualSeedRow(VISA_TYPE, field));
  const BATCH = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase.from("visa_form_fields").insert(batch).select("id");
    if (error) console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    else {
      total += data?.length ?? 0;
      process.stdout.write(`Batch ${Math.floor(i / BATCH) + 1}: ${data?.length ?? 0} inserted\n`);
    }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
