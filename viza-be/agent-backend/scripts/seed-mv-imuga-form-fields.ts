/**
 * Seed script: visa_form_fields for Maldives IMUGA Traveller Declaration.
 *
 * The Maldives grants 30-day visitor visa-on-arrival to all nationalities
 * — there is no pre-departure tourist visa application. The mandatory
 * pre-arrival step is the IMUGA Traveller Declaration submitted via
 * `https://imuga.immigration.gov.mv` (Immigration Maldives) within 96
 * hours of arrival. This is the schema VIZA captures for Maldives —
 * IMUGA replaces what would be a "tourist visa form" in countries that
 * require one.
 *
 * The schema is a high-fidelity reconstruction from the IMUGA public
 * landing pages, the Maldives Immigration applicant guidance, and the
 * IMUGA mobile-app form. Same posture as JP_TOURIST, EG_E_VISA, but
 * structurally simpler — no host / sponsor / character & declaration
 * blocks because IMUGA is a health-and-arrival declaration, not a
 * visa-screening form.
 *
 * Scope: IMUGA Traveller Declaration (arrival declaration, single
 * entry, free, 30-day automatic visa-on-arrival valid). Variant captured
 * by `visa_type_requested` with single value reserved for future
 * extension if Maldives introduces a longer-stay tourist visa.
 *
 * Out of scope: Resort Permit, Business Visa, Long-Stay Visa (Maldives
 * Marriage / Dependant), Work Visa (Employment Approval letter required),
 * Student Visa.
 *
 * Document uploads (passport bio, accommodation booking) are out-of-
 * schema per playbook §5.6.
 *
 * Run: npx tsx scripts/seed-mv-imuga-form-fields.ts
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

const VISA_TYPE = "MV_IMUGA";

interface FieldDef { field_name: string; label: string; field_type: string; required: boolean; step_number: number; step_name: string; display_order: number; placeholder?: string; validation_rules?: Record<string, unknown>; options?: Array<{ value: string; text: string }>; conditional_logic?: Record<string, unknown>; }

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

const HAS_OTHER_NATIONALITIES = "has_other_nationalities === yes";
const HAS_HEALTH_SYMPTOMS = "has_health_symptoms === yes";

const SEX_OPTIONS = [{ value: "male", text: "Male" }, { value: "female", text: "Female" }];

const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "imuga_arrival", text: "IMUGA Traveller Declaration — Visa-on-Arrival, free, 30-day stay" },
];

const PURPOSE_OF_VISIT_OPTIONS = [
  { value: "tourism", text: "Tourism / Holiday" },
  { value: "business_visit", text: "Business visit" },
  { value: "transit", text: "Transit" },
  { value: "visiting_family", text: "Visiting family or friends" },
  { value: "other", text: "Other" },
];

const PORT_OF_ENTRY_OPTIONS = [
  { value: "male_intl_mle", text: "Velana International Airport, Malé (MLE)" },
  { value: "gan_intl_gan", text: "Gan International Airport (GAN)" },
  { value: "maafaru_intl_nmf", text: "Maafaru International Airport (NMF)" },
  { value: "hanimaadhoo_intl_hah", text: "Hanimaadhoo International Airport (HAH)" },
  { value: "kooddoo_kdo", text: "Kooddoo Airport (KDO)" },
  { value: "male_seaport", text: "Malé Seaport (cruise / yacht)" },
  { value: "other", text: "Other" },
];

const ACCOMMODATION_TYPE_OPTIONS = [
  { value: "resort", text: "Resort island" },
  { value: "hotel", text: "Hotel (inhabited island)" },
  { value: "guesthouse", text: "Guesthouse (inhabited island)" },
  { value: "liveaboard", text: "Liveaboard / Safari boat" },
  { value: "yacht", text: "Yacht" },
  { value: "other", text: "Other" },
];

const FIELDS: FieldDef[] = [
  // STEP 1: Personal Information
  { field_name: "surname", label: "Surname (Family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given and middle names", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, validation_rules: { maxLength: 80 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, options: SEX_OPTIONS },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "nationality", label: "Current nationality / citizenship", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationality?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 6, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, conditional_logic: { showIf: HAS_OTHER_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "country_of_residence", label: "Country of current residence", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, validation_rules: { source: "ISO3166-1" } },
  { field_name: "mobile_number", label: "Mobile number", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, validation_rules: { maxLength: 30 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, validation_rules: { maxLength: 120, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // STEP 2: Passport
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport", display_order: 1, validation_rules: { maxLength: 20 } },
  { field_name: "passport_issuing_country", label: "Passport issuing country", field_type: "country", required: true, step_number: 2, step_name: "Passport", display_order: 2, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry (must be valid 6+ months beyond intended departure)", field_type: "date", required: true, step_number: 2, step_name: "Passport", display_order: 4, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },

  // STEP 3: Trip Details
  { field_name: "visa_type_requested", label: "Declaration type", field_type: "radio", required: true, step_number: 3, step_name: "Trip Details", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS },
  { field_name: "purpose_of_visit", label: "Purpose of visit to Maldives", field_type: "select", required: true, step_number: 3, step_name: "Trip Details", display_order: 2, options: PURPOSE_OF_VISIT_OPTIONS },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in Maldives", field_type: "date", required: true, step_number: 3, step_name: "Trip Details", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_departure_date", label: "Intended date of departure from Maldives", field_type: "date", required: true, step_number: 3, step_name: "Trip Details", display_order: 4, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 30)", field_type: "text", required: true, step_number: 3, step_name: "Trip Details", display_order: 5, validation_rules: { pattern: "^(?:[1-9]|[12][0-9]|30)$" } },
  { field_name: "port_of_entry", label: "Port of arrival in Maldives", field_type: "select", required: true, step_number: 3, step_name: "Trip Details", display_order: 6, options: PORT_OF_ENTRY_OPTIONS },
  { field_name: "port_of_entry_other", label: "Specify other port of entry", field_type: "text", required: true, step_number: 3, step_name: "Trip Details", display_order: 7, conditional_logic: { showIf: "port_of_entry === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "carrier_name", label: "Name of airline or carrier", field_type: "text", required: true, step_number: 3, step_name: "Trip Details", display_order: 8, placeholder: "e.g. Maldivian, Emirates, Qatar Airways", validation_rules: { maxLength: 80 } },
  { field_name: "flight_number", label: "Flight number", field_type: "text", required: true, step_number: 3, step_name: "Trip Details", display_order: 9, placeholder: "e.g. EK650", validation_rules: { maxLength: 30 } },
  { field_name: "country_of_origin_for_trip", label: "Country of origin for this trip (last departure country)", field_type: "country", required: true, step_number: 3, step_name: "Trip Details", display_order: 10, validation_rules: { source: "ISO3166-1" } },

  // STEP 4: Accommodation in Maldives
  { field_name: "accommodation_type", label: "Type of accommodation in Maldives", field_type: "select", required: true, step_number: 4, step_name: "Accommodation", display_order: 1, options: ACCOMMODATION_TYPE_OPTIONS },
  { field_name: "accommodation_name", label: "Name of resort, hotel, guesthouse, or vessel", field_type: "text", required: true, step_number: 4, step_name: "Accommodation", display_order: 2, validation_rules: { maxLength: 120, block_group: "accommodation_details" } },
  { field_name: "accommodation_atoll", label: "Atoll", field_type: "text", required: true, step_number: 4, step_name: "Accommodation", display_order: 3, placeholder: "e.g. Malé, Ari, Baa, Lhaviyani", validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "accommodation_island", label: "Island name", field_type: "text", required: true, step_number: 4, step_name: "Accommodation", display_order: 4, validation_rules: { maxLength: 80, block_group: "accommodation_details" } },
  { field_name: "accommodation_phone", label: "Telephone of accommodation", field_type: "text", required: false, step_number: 4, step_name: "Accommodation", display_order: 5, validation_rules: { maxLength: 30, block_group: "accommodation_details" } },

  // STEP 5: Health Declaration
  { field_name: "has_health_symptoms", label: "Do you currently have any of the following symptoms: fever, cough, breathing difficulty, diarrhoea, vomiting, rash, or jaundice?", field_type: "radio", required: true, step_number: 5, step_name: "Health Declaration", display_order: 1, options: YES_NO },
  { field_name: "health_symptoms_details", label: "Provide details of symptoms (when started, severity)", field_type: "textarea", required: true, step_number: 5, step_name: "Health Declaration", display_order: 2, conditional_logic: { showIf: HAS_HEALTH_SYMPTOMS }, validation_rules: { maxLength: 1000 } },
  { field_name: "visited_outbreak_country_recent", label: "Have you visited any country with an active disease outbreak in the past 14 days?", field_type: "radio", required: true, step_number: 5, step_name: "Health Declaration", display_order: 3, options: YES_NO },
  { field_name: "outbreak_country_details", label: "Country / countries visited and dates", field_type: "textarea", required: true, step_number: 5, step_name: "Health Declaration", display_order: 4, conditional_logic: { showIf: "visited_outbreak_country_recent === yes" }, validation_rules: { maxLength: 1000 } },

  // STEP 6: Customs Declaration
  { field_name: "carrying_currency_over_threshold", label: "Are you carrying currency / monetary instruments equivalent to USD 30,000 or more?", field_type: "radio", required: true, step_number: 6, step_name: "Customs Declaration", display_order: 1, options: YES_NO },
  { field_name: "currency_amount_details", label: "Provide currency type and amount", field_type: "textarea", required: true, step_number: 6, step_name: "Customs Declaration", display_order: 2, conditional_logic: { showIf: "carrying_currency_over_threshold === yes" }, validation_rules: { maxLength: 500 } },
  { field_name: "carrying_restricted_items", label: "Are you carrying any restricted or prohibited items (alcohol, pork products, religious materials non-Islamic, narcotics)?", field_type: "radio", required: true, step_number: 6, step_name: "Customs Declaration", display_order: 3, options: YES_NO },
  { field_name: "restricted_items_details", label: "Describe the restricted items", field_type: "textarea", required: true, step_number: 6, step_name: "Customs Declaration", display_order: 4, conditional_logic: { showIf: "carrying_restricted_items === yes" }, validation_rules: { maxLength: 1000 } },

  // STEP 7: Declaration
  { field_name: "remarks_special_circumstances", label: "Remarks (optional)", field_type: "textarea", required: false, step_number: 7, step_name: "Declaration", display_order: 1, validation_rules: { maxLength: 2000 } },
  { field_name: "application_date", label: "Date of submission", field_type: "date", required: true, step_number: 7, step_name: "Declaration", display_order: 2, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "final_declaration", label: "I hereby declare that the information provided is true, accurate, and complete. I understand that providing false information may result in denial of entry into the Republic of Maldives.", field_type: "checkbox", required: true, step_number: 7, step_name: "Declaration", display_order: 3, options: [{ value: "yes", text: "I agree" }] },
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
