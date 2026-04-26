/**
 * Seed script: visa_form_fields for UK Standard Visitor Visa
 * Field definitions based on the official Access UK application form
 * (apply-to-visit-or-stay-in-the-uk.homeoffice.gov.uk).
 *
 * Scope: Full Standard Visitor umbrella — tourism, visiting family/friends,
 * business, short-term study, private medical treatment, transit, and
 * marriage / civil partnership. Each purpose has its own conditional
 * sub-journey fields in Step 8.
 *
 * See docs/uk-visa-scope.md and docs/uk-visa-gap-report.md for scope
 * decisions and known limitations.
 *
 * Run: npx tsx scripts/seed-uk-standard-visitor-form-fields.ts
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

const VISA_TYPE = "UK_STANDARD_VISITOR";

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

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

// Purpose showIf expressions (reused across sub-journey fields)
const IS_BUSINESS = "purpose_of_visit === business";
const IS_STUDY = "purpose_of_visit === short_study";
const IS_MEDICAL = "purpose_of_visit === medical";
const IS_TRANSIT = "purpose_of_visit === transit";
const IS_MARRIAGE = "purpose_of_visit === marriage_civil_partnership";
const IS_PPE = "purpose_of_visit === ppe";
const IS_ACADEMIC = "purpose_of_visit === academic_12m";
const IS_ORGAN_DONOR = "purpose_of_visit === organ_donor";
const IS_CLINICAL = "purpose_of_visit === clinical_training";

const FIELDS: FieldDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: About You — Personal Details
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "given_names", label: "Given names (as shown in your passport)", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 1, placeholder: "e.g., John Michael", validation_rules: { maxLength: 50 } },
  { field_name: "surname", label: "Family name / surname (as shown in your passport)", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 2, placeholder: "e.g., Smith", validation_rules: { maxLength: 50 } },
  { field_name: "other_names_used", label: "Have you been known by any other names?", field_type: "radio", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 3, options: YES_NO },
  { field_name: "previous_given_names", label: "Previous given names", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 4, conditional_logic: { showIf: "other_names_used === yes" }, validation_rules: { maxLength: 50, repeatable: true, repeat_group: "previous_names", max_items: 5 } },
  { field_name: "previous_surname", label: "Previous family name / surname", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 5, conditional_logic: { showIf: "other_names_used === yes" }, validation_rules: { maxLength: 50, repeatable: true, repeat_group: "previous_names" } },
  { field_name: "previous_name_change_date", label: "Date name was changed", field_type: "date", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 6, conditional_logic: { showIf: "other_names_used === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "previous_names" } },
  { field_name: "previous_name_change_reason", label: "Reason for name change", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 7, conditional_logic: { showIf: "other_names_used === yes" }, placeholder: "e.g., Marriage, legal deed poll", validation_rules: { maxLength: 80, repeatable: true, repeat_group: "previous_names" } },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 8, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 9, options: [{ value: "male", text: "Male" }, { value: "female", text: "Female" }, { value: "unspecified", text: "Prefer not to say / Unspecified" }] },
  { field_name: "country_of_nationality", label: "What is your nationality?", field_type: "country", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 10, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you have any other nationalities?", field_type: "radio", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 11, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality", field_type: "country", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 12, conditional_logic: { showIf: "has_other_nationalities === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 5 } },
  { field_name: "country_of_birth", label: "Country of birth", field_type: "country", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 13, validation_rules: { source: "ISO3166-1" } },
  { field_name: "place_of_birth", label: "Place of birth (city or town)", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 14, validation_rules: { maxLength: 60 } },
  { field_name: "is_applicant_under_18", label: "Will you be under 18 on the date you plan to travel to the UK?", field_type: "radio", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 15, options: YES_NO },
  { field_name: "parent_consent_letter_held", label: "Do you have a signed letter of consent from both parents or legal guardians?", field_type: "radio", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 16, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, options: YES_NO },
  { field_name: "accompanying_adult_name", label: "Name of the adult travelling with you", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 17, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, validation_rules: { maxLength: 80, block_group: "accompanying_adult" } },
  { field_name: "accompanying_adult_relationship", label: "Relationship to the adult travelling with you", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 18, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, placeholder: "e.g., Parent, Aunt, Guardian", validation_rules: { maxLength: 40, block_group: "accompanying_adult" } },
  { field_name: "accompanying_adult_passport_number", label: "Passport number of the accompanying adult", field_type: "text", required: true, step_number: 1, step_name: "About You — Personal Details", display_order: 19, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, validation_rules: { maxLength: 20, block_group: "accompanying_adult" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: About You — Passport & Identity Documents
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 1, placeholder: "e.g., 123456789", validation_rules: { maxLength: 20 } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 2, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry", field_type: "date", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_issuing_authority", label: "Issuing authority", field_type: "text", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 4, placeholder: "e.g., Government of Indonesia", validation_rules: { maxLength: 60 } },
  { field_name: "passport_place_of_issue", label: "Place of issue", field_type: "text", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 5, validation_rules: { maxLength: 60 } },
  { field_name: "has_other_passports", label: "Do you have any other valid passports or travel documents?", field_type: "radio", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 6, options: YES_NO },
  { field_name: "other_passport_nationality", label: "Nationality shown on other passport", field_type: "country", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 7, conditional_logic: { showIf: "has_other_passports === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports", max_items: 5 } },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 8, conditional_logic: { showIf: "has_other_passports === yes" }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports" } },
  { field_name: "other_passport_issue_date", label: "Other passport date of issue", field_type: "date", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 9, conditional_logic: { showIf: "has_other_passports === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "other_passports" } },
  { field_name: "other_passport_expiry_date", label: "Other passport date of expiry", field_type: "date", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 10, conditional_logic: { showIf: "has_other_passports === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "other_passports" } },
  { field_name: "has_national_id_card", label: "Do you have a national identity card?", field_type: "radio", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 11, options: YES_NO },
  { field_name: "national_id_number", label: "National identity card number", field_type: "text", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 12, conditional_logic: { showIf: "has_national_id_card === yes" }, validation_rules: { maxLength: 30 } },
  { field_name: "national_id_issuing_country", label: "Country that issued the national identity card", field_type: "country", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 13, conditional_logic: { showIf: "has_national_id_card === yes" }, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_held_brp", label: "Have you ever held a UK Biometric Residence Permit (BRP)?", field_type: "radio", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 14, options: YES_NO },
  { field_name: "brp_number", label: "BRP number", field_type: "text", required: true, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 15, conditional_logic: { showIf: "has_held_brp === yes" }, validation_rules: { maxLength: 20 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Your Contact Details
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 1, placeholder: "e.g., name@example.com", validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },
  { field_name: "phone_number", label: "Phone number (including country code)", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 2, placeholder: "e.g., +62 812 3456 7890", validation_rules: { maxLength: 20 } },
  { field_name: "has_alternative_phone", label: "Do you have an alternative phone number?", field_type: "radio", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 3, options: YES_NO },
  { field_name: "alternative_phone_number", label: "Alternative phone number", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 4, conditional_logic: { showIf: "has_alternative_phone === yes" }, validation_rules: { maxLength: 20 } },
  { field_name: "home_address_line_1", label: "Home address — line 1", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 5, validation_rules: { maxLength: 100, block_group: "home_address" } },
  { field_name: "home_address_line_2", label: "Home address — line 2", field_type: "text", required: false, step_number: 3, step_name: "Your Contact Details", display_order: 6, validation_rules: { maxLength: 100, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Town or city", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 7, validation_rules: { maxLength: 60, block_group: "home_address" } },
  { field_name: "home_address_state", label: "County / state / province", field_type: "text", required: false, step_number: 3, step_name: "Your Contact Details", display_order: 8, validation_rules: { maxLength: 60, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Postcode / ZIP code", field_type: "text", required: false, step_number: 3, step_name: "Your Contact Details", display_order: 9, validation_rules: { maxLength: 15, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Country", field_type: "country", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 10, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "how_long_at_address", label: "How long have you lived at this address?", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 11, placeholder: "e.g., 3 years", validation_rules: { maxLength: 40 } },
  { field_name: "owns_home", label: "Do you own your home?", field_type: "radio", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 12, options: YES_NO },
  { field_name: "correspondence_address_different", label: "Is your correspondence address different from your home address?", field_type: "radio", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 13, options: YES_NO },
  { field_name: "correspondence_address_line_1", label: "Correspondence address — line 1", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 14, conditional_logic: { showIf: "correspondence_address_different === yes" }, validation_rules: { maxLength: 100 } },
  { field_name: "correspondence_address_city", label: "Correspondence address — town or city", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 15, conditional_logic: { showIf: "correspondence_address_different === yes" }, validation_rules: { maxLength: 60 } },
  { field_name: "correspondence_address_country", label: "Correspondence address — country", field_type: "country", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 16, conditional_logic: { showIf: "correspondence_address_different === yes" }, validation_rules: { source: "ISO3166-1" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Your Family
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "marital_status", label: "What is your current marital or civil partnership status?", field_type: "select", required: true, step_number: 4, step_name: "Your Family", display_order: 1, options: [{ value: "single", text: "Single" }, { value: "married", text: "Married" }, { value: "civil_partnership", text: "In a civil partnership" }, { value: "unmarried_partner", text: "Unmarried partner" }, { value: "divorced", text: "Divorced" }, { value: "widowed", text: "Widowed" }, { value: "separated", text: "Separated" }] },
  { field_name: "partner_given_names", label: "Partner's given names", field_type: "text", required: true, step_number: 4, step_name: "Your Family", display_order: 2, conditional_logic: { showIf: "marital_status === married || marital_status === civil_partnership || marital_status === unmarried_partner" }, validation_rules: { maxLength: 50 } },
  { field_name: "partner_surname", label: "Partner's family name / surname", field_type: "text", required: true, step_number: 4, step_name: "Your Family", display_order: 3, conditional_logic: { showIf: "marital_status === married || marital_status === civil_partnership || marital_status === unmarried_partner" }, validation_rules: { maxLength: 50 } },
  { field_name: "partner_date_of_birth", label: "Partner's date of birth", field_type: "date", required: true, step_number: 4, step_name: "Your Family", display_order: 4, conditional_logic: { showIf: "marital_status === married || marital_status === civil_partnership || marital_status === unmarried_partner" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "partner_nationality", label: "Partner's nationality", field_type: "country", required: true, step_number: 4, step_name: "Your Family", display_order: 5, conditional_logic: { showIf: "marital_status === married || marital_status === civil_partnership || marital_status === unmarried_partner" }, validation_rules: { source: "ISO3166-1" } },
  { field_name: "partner_travelling_with_you", label: "Is your partner travelling to the UK with you?", field_type: "radio", required: true, step_number: 4, step_name: "Your Family", display_order: 6, conditional_logic: { showIf: "marital_status === married || marital_status === civil_partnership || marital_status === unmarried_partner" }, options: YES_NO },
  { field_name: "has_children", label: "Do you have any children under 18?", field_type: "radio", required: true, step_number: 4, step_name: "Your Family", display_order: 7, options: YES_NO },
  { field_name: "number_of_children", label: "How many children under 18 do you have?", field_type: "text", required: true, step_number: 4, step_name: "Your Family", display_order: 8, conditional_logic: { showIf: "has_children === yes" }, validation_rules: { pattern: "^[0-9]{1,2}$" } },
  { field_name: "children_travelling_with_you", label: "Are any of your children travelling with you?", field_type: "radio", required: true, step_number: 4, step_name: "Your Family", display_order: 9, conditional_logic: { showIf: "has_children === yes" }, options: YES_NO },
  { field_name: "father_given_names", label: "Father's given names", field_type: "text", required: true, step_number: 4, step_name: "Your Family", display_order: 10, validation_rules: { maxLength: 50, block_group: "parents" } },
  { field_name: "father_surname", label: "Father's family name / surname", field_type: "text", required: true, step_number: 4, step_name: "Your Family", display_order: 11, validation_rules: { maxLength: 50, block_group: "parents" } },
  { field_name: "father_date_of_birth", label: "Father's date of birth", field_type: "date", required: true, step_number: 4, step_name: "Your Family", display_order: 12, validation_rules: { format: "DD/MM/YYYY", block_group: "parents" } },
  { field_name: "father_nationality", label: "Father's nationality", field_type: "country", required: true, step_number: 4, step_name: "Your Family", display_order: 13, validation_rules: { source: "ISO3166-1", block_group: "parents" } },
  { field_name: "mother_given_names", label: "Mother's given names", field_type: "text", required: true, step_number: 4, step_name: "Your Family", display_order: 14, validation_rules: { maxLength: 50, block_group: "parents" } },
  { field_name: "mother_surname", label: "Mother's family name / surname", field_type: "text", required: true, step_number: 4, step_name: "Your Family", display_order: 15, validation_rules: { maxLength: 50, block_group: "parents" } },
  { field_name: "mother_date_of_birth", label: "Mother's date of birth", field_type: "date", required: true, step_number: 4, step_name: "Your Family", display_order: 16, validation_rules: { format: "DD/MM/YYYY", block_group: "parents" } },
  { field_name: "mother_nationality", label: "Mother's nationality", field_type: "country", required: true, step_number: 4, step_name: "Your Family", display_order: 17, validation_rules: { source: "ISO3166-1", block_group: "parents" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Your Accommodation in the UK
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "uk_accommodation_type", label: "Where will you be staying in the UK?", field_type: "select", required: true, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 1, options: [{ value: "hotel", text: "Hotel or other commercial accommodation" }, { value: "family_friends", text: "With family or friends" }, { value: "rented", text: "Rented accommodation" }, { value: "own_property", text: "Own property" }, { value: "other", text: "Other" }] },
  { field_name: "uk_accommodation_address_line_1", label: "UK accommodation address — line 1", field_type: "text", required: true, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 2, validation_rules: { maxLength: 100, block_group: "uk_address" } },
  { field_name: "uk_accommodation_address_line_2", label: "UK accommodation address — line 2", field_type: "text", required: false, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 3, validation_rules: { maxLength: 100, block_group: "uk_address" } },
  { field_name: "uk_accommodation_city", label: "Town or city", field_type: "text", required: true, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 4, validation_rules: { maxLength: 60, block_group: "uk_address" } },
  { field_name: "uk_accommodation_postcode", label: "Postcode", field_type: "text", required: true, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 5, placeholder: "e.g., SW1A 1AA", validation_rules: { maxLength: 10, block_group: "uk_address" } },
  { field_name: "uk_host_name", label: "Name of the person you are staying with", field_type: "text", required: true, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 6, conditional_logic: { showIf: "uk_accommodation_type === family_friends" }, validation_rules: { maxLength: 80 } },
  { field_name: "uk_host_relationship", label: "What is your relationship to this person?", field_type: "text", required: true, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 7, conditional_logic: { showIf: "uk_accommodation_type === family_friends" }, placeholder: "e.g., Friend, Uncle, Cousin", validation_rules: { maxLength: 40 } },
  { field_name: "uk_host_email", label: "Host's email address", field_type: "text", required: false, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 8, conditional_logic: { showIf: "uk_accommodation_type === family_friends" }, validation_rules: { maxLength: 100 } },
  { field_name: "uk_host_phone", label: "Host's phone number", field_type: "text", required: false, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 9, conditional_logic: { showIf: "uk_accommodation_type === family_friends" }, validation_rules: { maxLength: 20 } },
  { field_name: "uk_accommodation_other_explain", label: "Please describe your accommodation arrangements", field_type: "textarea", required: true, step_number: 5, step_name: "Your Accommodation in the UK", display_order: 10, conditional_logic: { showIf: "uk_accommodation_type === other" }, validation_rules: { maxLength: 500 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Your Travel History
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "travelled_to_uk_before", label: "Have you ever travelled to the UK before?", field_type: "radio", required: true, step_number: 6, step_name: "Your Travel History", display_order: 1, options: YES_NO },
  { field_name: "prev_uk_visit_date", label: "Date of arrival in the UK", field_type: "date", required: true, step_number: 6, step_name: "Your Travel History", display_order: 2, conditional_logic: { showIf: "travelled_to_uk_before === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "previous_uk_visits", max_items: 10 } },
  { field_name: "prev_uk_visit_duration", label: "How long did you stay?", field_type: "text", required: true, step_number: 6, step_name: "Your Travel History", display_order: 3, conditional_logic: { showIf: "travelled_to_uk_before === yes" }, placeholder: "e.g., 2 weeks", validation_rules: { maxLength: 40, repeatable: true, repeat_group: "previous_uk_visits" } },
  { field_name: "prev_uk_visit_reason", label: "Reason for the visit", field_type: "text", required: true, step_number: 6, step_name: "Your Travel History", display_order: 4, conditional_logic: { showIf: "travelled_to_uk_before === yes" }, validation_rules: { maxLength: 100, repeatable: true, repeat_group: "previous_uk_visits" } },
  { field_name: "prev_uk_visa_type", label: "Type of UK visa held (if any)", field_type: "text", required: false, step_number: 6, step_name: "Your Travel History", display_order: 5, conditional_logic: { showIf: "travelled_to_uk_before === yes" }, placeholder: "e.g., Standard Visitor, Student", validation_rules: { maxLength: 60, repeatable: true, repeat_group: "previous_uk_visits" } },
  { field_name: "prev_uk_visa_reference", label: "UK visa reference number (if known)", field_type: "text", required: false, step_number: 6, step_name: "Your Travel History", display_order: 6, conditional_logic: { showIf: "travelled_to_uk_before === yes" }, validation_rules: { maxLength: 30, repeatable: true, repeat_group: "previous_uk_visits" } },
  { field_name: "uk_national_insurance_number", label: "Do you have a UK National Insurance number?", field_type: "radio", required: true, step_number: 6, step_name: "Your Travel History", display_order: 7, options: YES_NO },
  { field_name: "uk_national_insurance_number_value", label: "UK National Insurance number", field_type: "text", required: true, step_number: 6, step_name: "Your Travel History", display_order: 8, conditional_logic: { showIf: "uk_national_insurance_number === yes" }, validation_rules: { maxLength: 13 } },
  { field_name: "visa_refused_uk", label: "Have you ever been refused a visa for the UK?", field_type: "radio", required: true, step_number: 6, step_name: "Your Travel History", display_order: 9, options: YES_NO },
  { field_name: "visa_refused_uk_details", label: "Please give details of the refusal", field_type: "textarea", required: true, step_number: 6, step_name: "Your Travel History", display_order: 10, conditional_logic: { showIf: "visa_refused_uk === yes" }, validation_rules: { maxLength: 500 } },
  { field_name: "visa_refused_other_country", label: "Have you ever been refused a visa for any other country?", field_type: "radio", required: true, step_number: 6, step_name: "Your Travel History", display_order: 11, options: YES_NO },
  { field_name: "visa_refused_other_country_details", label: "Please give details of the refusal", field_type: "textarea", required: true, step_number: 6, step_name: "Your Travel History", display_order: 12, conditional_logic: { showIf: "visa_refused_other_country === yes" }, validation_rules: { maxLength: 500 } },
  { field_name: "deported_removed_refused_entry", label: "Have you ever been deported, removed, or refused entry to any country including the UK?", field_type: "radio", required: true, step_number: 6, step_name: "Your Travel History", display_order: 13, options: YES_NO },
  { field_name: "deported_details", label: "Please give details", field_type: "textarea", required: true, step_number: 6, step_name: "Your Travel History", display_order: 14, conditional_logic: { showIf: "deported_removed_refused_entry === yes" }, validation_rules: { maxLength: 500 } },
  { field_name: "has_schengen_visits", label: "Have you visited any Schengen country in the last 10 years?", field_type: "radio", required: true, step_number: 6, step_name: "Your Travel History", display_order: 15, options: YES_NO },
  { field_name: "schengen_visit_country", label: "Schengen country visited", field_type: "country", required: true, step_number: 6, step_name: "Your Travel History", display_order: 16, conditional_logic: { showIf: "has_schengen_visits === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "schengen_visits", max_items: 20 } },
  { field_name: "schengen_visit_arrival", label: "Date of arrival", field_type: "date", required: true, step_number: 6, step_name: "Your Travel History", display_order: 17, conditional_logic: { showIf: "has_schengen_visits === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "schengen_visits" } },
  { field_name: "schengen_visit_departure", label: "Date of departure", field_type: "date", required: true, step_number: 6, step_name: "Your Travel History", display_order: 18, conditional_logic: { showIf: "has_schengen_visits === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "schengen_visits" } },
  { field_name: "schengen_visit_purpose", label: "Purpose of visit", field_type: "text", required: true, step_number: 6, step_name: "Your Travel History", display_order: 19, conditional_logic: { showIf: "has_schengen_visits === yes" }, placeholder: "e.g., Tourism, Business", validation_rules: { maxLength: 80, repeatable: true, repeat_group: "schengen_visits" } },
  { field_name: "has_us_canada_anz_visits", label: "Have you visited the USA, Canada, Australia, or New Zealand in the last 10 years?", field_type: "radio", required: true, step_number: 6, step_name: "Your Travel History", display_order: 20, options: YES_NO },
  { field_name: "us_canada_anz_visit_country", label: "Country visited", field_type: "country", required: true, step_number: 6, step_name: "Your Travel History", display_order: 21, conditional_logic: { showIf: "has_us_canada_anz_visits === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "us_canada_anz_visits", max_items: 20 } },
  { field_name: "us_canada_anz_visit_arrival", label: "Date of arrival", field_type: "date", required: true, step_number: 6, step_name: "Your Travel History", display_order: 22, conditional_logic: { showIf: "has_us_canada_anz_visits === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "us_canada_anz_visits" } },
  { field_name: "us_canada_anz_visit_departure", label: "Date of departure", field_type: "date", required: true, step_number: 6, step_name: "Your Travel History", display_order: 23, conditional_logic: { showIf: "has_us_canada_anz_visits === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "us_canada_anz_visits" } },
  { field_name: "us_canada_anz_visit_purpose", label: "Purpose of visit", field_type: "text", required: true, step_number: 6, step_name: "Your Travel History", display_order: 24, conditional_logic: { showIf: "has_us_canada_anz_visits === yes" }, validation_rules: { maxLength: 80, repeatable: true, repeat_group: "us_canada_anz_visits" } },
  { field_name: "has_other_country_visits", label: "Have you visited any other countries in the last 10 years?", field_type: "radio", required: true, step_number: 6, step_name: "Your Travel History", display_order: 25, options: YES_NO },
  { field_name: "other_country_visit_country", label: "Country visited", field_type: "country", required: true, step_number: 6, step_name: "Your Travel History", display_order: 26, conditional_logic: { showIf: "has_other_country_visits === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_country_visits", max_items: 30 } },
  { field_name: "other_country_visit_arrival", label: "Date of arrival", field_type: "date", required: true, step_number: 6, step_name: "Your Travel History", display_order: 27, conditional_logic: { showIf: "has_other_country_visits === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "other_country_visits" } },
  { field_name: "other_country_visit_departure", label: "Date of departure", field_type: "date", required: true, step_number: 6, step_name: "Your Travel History", display_order: 28, conditional_logic: { showIf: "has_other_country_visits === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "other_country_visits" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: Your Trip to the UK
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "purpose_of_visit", label: "What is the main reason for your visit to the UK?", field_type: "select", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 1, options: [{ value: "tourism", text: "Tourism (including visiting family and friends)" }, { value: "business", text: "Business (including sports and entertainment)" }, { value: "transit", text: "Transit through the UK" }, { value: "academic", text: "Academic visit (teaching, exchange, dependant of academic)" }, { value: "marriage", text: "Marriage or civil partnership" }, { value: "medicalTreatment", text: "Private medical treatment or organ donation" }, { value: "study", text: "Short-term study (up to 6 months)" }, { value: "other", text: "Other — for another reason" }] },
  { field_name: "uk_arrival_date", label: "When do you plan to arrive in the UK?", field_type: "date", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 2, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "uk_departure_date", label: "When do you plan to leave the UK?", field_type: "date", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 3, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "visiting_family_in_uk", label: "Will you be visiting family while in the UK?", field_type: "radio", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 4, options: YES_NO },
  { field_name: "uk_family_member_name", label: "Family member's full name", field_type: "text", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 5, conditional_logic: { showIf: "visiting_family_in_uk === yes" }, validation_rules: { maxLength: 80 } },
  { field_name: "uk_family_member_relationship", label: "What is your relationship to this person?", field_type: "text", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 6, conditional_logic: { showIf: "visiting_family_in_uk === yes" }, validation_rules: { maxLength: 40 } },
  { field_name: "uk_family_member_immigration_status", label: "What is their UK immigration status?", field_type: "select", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 7, conditional_logic: { showIf: "visiting_family_in_uk === yes" }, options: [{ value: "british_citizen", text: "British citizen" }, { value: "settled", text: "Settled (Indefinite Leave to Remain)" }, { value: "eu_settled", text: "EU Settlement Scheme" }, { value: "visa_holder", text: "Has a valid UK visa" }, { value: "dont_know", text: "I don't know" }] },
  { field_name: "uk_family_member_address", label: "Family member's UK address", field_type: "textarea", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 8, conditional_logic: { showIf: "visiting_family_in_uk === yes" }, validation_rules: { maxLength: 300 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: Purpose-Specific Details (gated on purpose_of_visit)
  // ═══════════════════════════════════════════════════════════════════════════
  // Business sub-journey
  { field_name: "uk_business_contact_name", label: "Name of your UK business contact", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 1, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 80, block_group: "business_details" } },
  { field_name: "uk_business_company_name", label: "UK company name", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 2, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 80, block_group: "business_details" } },
  { field_name: "uk_business_company_address", label: "UK company address", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 3, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 300, block_group: "business_details" } },
  { field_name: "uk_business_activity_description", label: "Describe the nature of your business activity in the UK", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 4, conditional_logic: { showIf: IS_BUSINESS }, placeholder: "e.g., meetings with suppliers, attending a conference", validation_rules: { maxLength: 500, block_group: "business_details" } },
  { field_name: "uk_business_paid_by_uk", label: "Will you be paid by a UK company or individual during your visit?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 5, conditional_logic: { showIf: IS_BUSINESS }, options: YES_NO },
  // Short-term study sub-journey
  { field_name: "study_institution_name", label: "Name of the school, college, or university", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 6, conditional_logic: { showIf: IS_STUDY }, validation_rules: { maxLength: 80, block_group: "study_details" } },
  { field_name: "study_institution_address", label: "Institution address in the UK", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 7, conditional_logic: { showIf: IS_STUDY }, validation_rules: { maxLength: 300, block_group: "study_details" } },
  { field_name: "study_course_title", label: "Title of the course", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 8, conditional_logic: { showIf: IS_STUDY }, validation_rules: { maxLength: 100, block_group: "study_details" } },
  { field_name: "study_course_start_date", label: "Course start date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 9, conditional_logic: { showIf: IS_STUDY }, validation_rules: { format: "DD/MM/YYYY", block_group: "study_details" } },
  { field_name: "study_course_end_date", label: "Course end date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 10, conditional_logic: { showIf: IS_STUDY }, validation_rules: { format: "DD/MM/YYYY", block_group: "study_details" } },
  { field_name: "study_institution_accredited", label: "Is the institution accredited by a UK-recognised body?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 11, conditional_logic: { showIf: IS_STUDY }, options: YES_NO },
  { field_name: "study_who_pays", label: "Who is paying for your course?", field_type: "select", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 12, conditional_logic: { showIf: IS_STUDY }, options: [{ value: "self", text: "I am paying" }, { value: "parent", text: "Parent or guardian" }, { value: "employer", text: "Employer" }, { value: "scholarship", text: "Scholarship / grant" }, { value: "other", text: "Other" }] },
  // Medical sub-journey
  { field_name: "medical_treatment_type", label: "What kind of medical treatment will you be receiving?", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 13, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 500, block_group: "medical_details" } },
  { field_name: "medical_facility_name", label: "Name of the hospital or clinic", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 14, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 80, block_group: "medical_details" } },
  { field_name: "medical_facility_address", label: "Hospital or clinic address", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 15, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 300, block_group: "medical_details" } },
  { field_name: "medical_doctor_name", label: "Name of the doctor or consultant", field_type: "text", required: false, step_number: 8, step_name: "Purpose-Specific Details", display_order: 16, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 80, block_group: "medical_details" } },
  { field_name: "medical_estimated_cost", label: "Estimated cost of treatment", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 17, conditional_logic: { showIf: IS_MEDICAL }, placeholder: "e.g., £10000", validation_rules: { maxLength: 20, block_group: "medical_details" } },
  { field_name: "medical_payment_arrangement", label: "How will you pay for your treatment?", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 18, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 500, block_group: "medical_details" } },
  // Transit sub-journey
  { field_name: "transit_destination_country", label: "Which country are you travelling on to?", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 19, conditional_logic: { showIf: IS_TRANSIT }, validation_rules: { source: "ISO3166-1", block_group: "transit_details" } },
  { field_name: "transit_onward_journey_date", label: "Date and time of onward journey", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 20, conditional_logic: { showIf: IS_TRANSIT }, validation_rules: { format: "DD/MM/YYYY", block_group: "transit_details" } },
  { field_name: "transit_onward_booking_reference", label: "Onward travel booking reference", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 21, conditional_logic: { showIf: IS_TRANSIT }, validation_rules: { maxLength: 30, block_group: "transit_details" } },
  { field_name: "transit_destination_visa_status", label: "Do you hold a valid visa or residence permit for the destination country?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 22, conditional_logic: { showIf: IS_TRANSIT }, options: YES_NO },
  { field_name: "transit_destination_visa_details", label: "Destination visa / residence permit details", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 23, conditional_logic: { showIf: "transit_destination_visa_status === yes" }, placeholder: "Visa type, reference number, expiry date", validation_rules: { maxLength: 300 } },
  // Marriage / civil partnership sub-journey
  { field_name: "marriage_ceremony_date", label: "Date of the ceremony", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 24, conditional_logic: { showIf: IS_MARRIAGE }, validation_rules: { format: "DD/MM/YYYY", block_group: "marriage_details" } },
  { field_name: "marriage_registrar_office_name", label: "Name of the register office", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 25, conditional_logic: { showIf: IS_MARRIAGE }, validation_rules: { maxLength: 80, block_group: "marriage_details" } },
  { field_name: "marriage_registrar_office_address", label: "Register office address", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 26, conditional_logic: { showIf: IS_MARRIAGE }, validation_rules: { maxLength: 300, block_group: "marriage_details" } },
  { field_name: "marriage_partner_full_name", label: "Full name of your intended spouse or civil partner", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 27, conditional_logic: { showIf: IS_MARRIAGE }, validation_rules: { maxLength: 100, block_group: "marriage_details" } },
  { field_name: "marriage_partner_nationality", label: "Nationality of your intended spouse or civil partner", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 28, conditional_logic: { showIf: IS_MARRIAGE }, validation_rules: { source: "ISO3166-1", block_group: "marriage_details" } },
  { field_name: "marriage_freedom_to_marry_document", label: "Do you have a document proving you are free to marry (e.g. decree absolute, death certificate of previous spouse)?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 29, conditional_logic: { showIf: IS_MARRIAGE }, options: YES_NO },
  // Permitted Paid Engagement (PPE) sub-journey
  { field_name: "ppe_host_organisation_name", label: "Name of the UK organisation that has invited you", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 30, conditional_logic: { showIf: IS_PPE }, validation_rules: { maxLength: 100, block_group: "ppe_details" } },
  { field_name: "ppe_host_organisation_address", label: "Host organisation address", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 31, conditional_logic: { showIf: IS_PPE }, validation_rules: { maxLength: 300, block_group: "ppe_details" } },
  { field_name: "ppe_engagement_description", label: "Describe the engagement", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 32, conditional_logic: { showIf: IS_PPE }, placeholder: "e.g., keynote speaker at an academic conference", validation_rules: { maxLength: 500, block_group: "ppe_details" } },
  { field_name: "ppe_engagement_start_date", label: "Engagement start date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 33, conditional_logic: { showIf: IS_PPE }, validation_rules: { format: "DD/MM/YYYY", inline_group: "ppe_dates", block_group: "ppe_details" } },
  { field_name: "ppe_engagement_end_date", label: "Engagement end date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 34, conditional_logic: { showIf: IS_PPE }, validation_rules: { format: "DD/MM/YYYY", inline_group: "ppe_dates", block_group: "ppe_details" } },
  { field_name: "ppe_fee_amount", label: "Fee or payment you will receive", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 35, conditional_logic: { showIf: IS_PPE }, placeholder: "e.g., £3000", validation_rules: { maxLength: 30, block_group: "ppe_details" } },
  // Academic / researcher (12-month) sub-journey
  { field_name: "academic_institution_name", label: "Name of the UK host institution", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 36, conditional_logic: { showIf: IS_ACADEMIC }, validation_rules: { maxLength: 100, block_group: "academic_details" } },
  { field_name: "academic_institution_address", label: "UK host institution address", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 37, conditional_logic: { showIf: IS_ACADEMIC }, validation_rules: { maxLength: 300, block_group: "academic_details" } },
  { field_name: "academic_research_topic", label: "Describe your research or academic activity", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 38, conditional_logic: { showIf: IS_ACADEMIC }, validation_rules: { maxLength: 500, block_group: "academic_details" } },
  { field_name: "academic_duration_months", label: "Duration of the visit (in months)", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 39, conditional_logic: { showIf: IS_ACADEMIC }, placeholder: "e.g., 9", validation_rules: { pattern: "^[0-9]{1,2}$", block_group: "academic_details" } },
  { field_name: "academic_qualifications_held", label: "Highest academic qualification held in your field", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 40, conditional_logic: { showIf: IS_ACADEMIC }, placeholder: "e.g., PhD in Molecular Biology, University of Oxford", validation_rules: { maxLength: 150, block_group: "academic_details" } },
  { field_name: "academic_employer_letter_held", label: "Do you have a letter from your employer in your home country confirming this research?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 41, conditional_logic: { showIf: IS_ACADEMIC }, options: YES_NO },
  // Organ donor sub-journey
  { field_name: "organ_donor_recipient_name", label: "Full name of the intended organ recipient", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 42, conditional_logic: { showIf: IS_ORGAN_DONOR }, validation_rules: { maxLength: 100, block_group: "organ_donor_details" } },
  { field_name: "organ_donor_relationship_to_recipient", label: "Relationship to the recipient", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 43, conditional_logic: { showIf: IS_ORGAN_DONOR }, placeholder: "e.g., Sibling, Spouse, Parent", validation_rules: { maxLength: 40, block_group: "organ_donor_details" } },
  { field_name: "organ_donor_recipient_legal_uk_status", label: "Is the recipient legally resident in the UK?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 44, conditional_logic: { showIf: IS_ORGAN_DONOR }, options: YES_NO },
  { field_name: "organ_donor_transplant_hospital", label: "Hospital where the transplant will take place", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 45, conditional_logic: { showIf: IS_ORGAN_DONOR }, validation_rules: { maxLength: 100, block_group: "organ_donor_details" } },
  { field_name: "organ_donor_transplant_date", label: "Intended transplant or testing date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 46, conditional_logic: { showIf: IS_ORGAN_DONOR }, validation_rules: { format: "DD/MM/YYYY", block_group: "organ_donor_details" } },
  { field_name: "organ_donor_consultant_name", label: "Name of the lead GMC-registered specialist", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 47, conditional_logic: { showIf: IS_ORGAN_DONOR }, validation_rules: { maxLength: 80, block_group: "organ_donor_details" } },
  { field_name: "organ_donor_consultant_letter_date", label: "Date of the consultant's letter (must be within 3 months)", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 48, conditional_logic: { showIf: IS_ORGAN_DONOR }, validation_rules: { format: "DD/MM/YYYY", block_group: "organ_donor_details" } },
  // Clinical training sub-journey (PLAB / OSCE / clinical attachment / dental observer)
  { field_name: "clinical_training_type", label: "What kind of clinical activity are you attending?", field_type: "select", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 49, conditional_logic: { showIf: IS_CLINICAL }, options: [{ value: "clinical_attachment", text: "Clinical attachment" }, { value: "dental_observer", text: "Dental observer post" }, { value: "plab", text: "PLAB test" }, { value: "osce", text: "OSCE test" }] },
  { field_name: "clinical_institution_name", label: "Name of the UK institution or Royal College", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 50, conditional_logic: { showIf: IS_CLINICAL }, validation_rules: { maxLength: 100, block_group: "clinical_details" } },
  { field_name: "clinical_institution_address", label: "UK institution address", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 51, conditional_logic: { showIf: IS_CLINICAL }, validation_rules: { maxLength: 300, block_group: "clinical_details" } },
  { field_name: "clinical_start_date", label: "Start date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 52, conditional_logic: { showIf: IS_CLINICAL }, validation_rules: { format: "DD/MM/YYYY", inline_group: "clinical_dates", block_group: "clinical_details" } },
  { field_name: "clinical_end_date", label: "End date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 53, conditional_logic: { showIf: IS_CLINICAL }, validation_rules: { format: "DD/MM/YYYY", inline_group: "clinical_dates", block_group: "clinical_details" } },
  { field_name: "clinical_no_patient_treatment_confirm", label: "Confirm you will not provide treatment to UK patients", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 54, conditional_logic: { showIf: IS_CLINICAL }, options: YES_NO },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 9: Your Employment
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "employment_status", label: "What is your current employment status?", field_type: "select", required: true, step_number: 9, step_name: "Your Employment", display_order: 1, options: [{ value: "employed", text: "Employed" }, { value: "self-employed", text: "Self-employed" }, { value: "student", text: "A student" }, { value: "retired", text: "Retired" }, { value: "unemployed", text: "Unemployed" }] },
  { field_name: "employer_name", label: "Employer's name", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 2, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 80, block_group: "employer_details" } },
  { field_name: "employer_address", label: "Employer's address", field_type: "textarea", required: true, step_number: 9, step_name: "Your Employment", display_order: 3, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 300, block_group: "employer_details" } },
  { field_name: "employer_phone", label: "Employer's phone number", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 4, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 20, block_group: "employer_details" } },
  { field_name: "job_title", label: "Job title", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 5, conditional_logic: { showIf: "employment_status === employed || employment_status === self_employed" }, validation_rules: { maxLength: 60 } },
  { field_name: "job_start_date", label: "When did you start this job?", field_type: "date", required: true, step_number: 9, step_name: "Your Employment", display_order: 6, conditional_logic: { showIf: "employment_status === employed || employment_status === self_employed" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "annual_income", label: "What is your annual income (in local currency)?", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 7, conditional_logic: { showIf: "employment_status === employed || employment_status === self_employed" }, placeholder: "e.g., 50000000 IDR", validation_rules: { maxLength: 30 } },
  { field_name: "self_employed_business_name", label: "Business name", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 8, conditional_logic: { showIf: "employment_status === self_employed" }, validation_rules: { maxLength: 80 } },
  { field_name: "self_employed_business_address", label: "Business address", field_type: "textarea", required: true, step_number: 9, step_name: "Your Employment", display_order: 9, conditional_logic: { showIf: "employment_status === self_employed" }, validation_rules: { maxLength: 300 } },
  { field_name: "student_institution_name", label: "Name of school, college, or university", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 10, conditional_logic: { showIf: "employment_status === student" }, validation_rules: { maxLength: 80 } },
  { field_name: "student_institution_address", label: "Institution address", field_type: "textarea", required: true, step_number: 9, step_name: "Your Employment", display_order: 11, conditional_logic: { showIf: "employment_status === student" }, validation_rules: { maxLength: 300 } },
  { field_name: "student_course_name", label: "Course of study", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 12, conditional_logic: { showIf: "employment_status === student" }, validation_rules: { maxLength: 80 } },
  { field_name: "employment_other_explain", label: "Please describe your situation", field_type: "textarea", required: true, step_number: 9, step_name: "Your Employment", display_order: 13, conditional_logic: { showIf: "employment_status === other" }, validation_rules: { maxLength: 500 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 10: Your Finances
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "who_is_paying", label: "Who is paying for your visit to the UK?", field_type: "select", required: true, step_number: 10, step_name: "Your Finances", display_order: 1, options: [{ value: "self", text: "I am paying for myself" }, { value: "sponsor", text: "Someone else is paying for me" }, { value: "employer", text: "My employer" }, { value: "other", text: "Other" }] },
  { field_name: "monthly_spending_money", label: "How much money will you have available to spend each month in the UK?", field_type: "text", required: true, step_number: 10, step_name: "Your Finances", display_order: 2, placeholder: "e.g., £2000", validation_rules: { maxLength: 20 } },
  { field_name: "total_cost_of_trip", label: "What is the total estimated cost of your trip (including flights)?", field_type: "text", required: true, step_number: 10, step_name: "Your Finances", display_order: 3, placeholder: "e.g., £3000", validation_rules: { maxLength: 20 } },
  { field_name: "sponsor_name", label: "Sponsor's full name", field_type: "text", required: true, step_number: 10, step_name: "Your Finances", display_order: 4, conditional_logic: { showIf: "who_is_paying === sponsor" }, validation_rules: { maxLength: 80, block_group: "sponsor_details" } },
  { field_name: "sponsor_relationship", label: "What is your relationship to the sponsor?", field_type: "text", required: true, step_number: 10, step_name: "Your Finances", display_order: 5, conditional_logic: { showIf: "who_is_paying === sponsor" }, validation_rules: { maxLength: 40, block_group: "sponsor_details" } },
  { field_name: "sponsor_address", label: "Sponsor's address", field_type: "textarea", required: true, step_number: 10, step_name: "Your Finances", display_order: 6, conditional_logic: { showIf: "who_is_paying === sponsor" }, validation_rules: { maxLength: 300, block_group: "sponsor_details" } },
  { field_name: "sponsor_email", label: "Sponsor's email address", field_type: "text", required: false, step_number: 10, step_name: "Your Finances", display_order: 7, conditional_logic: { showIf: "who_is_paying === sponsor" }, validation_rules: { maxLength: 100, block_group: "sponsor_details" } },
  { field_name: "sponsor_phone", label: "Sponsor's phone number", field_type: "text", required: false, step_number: 10, step_name: "Your Finances", display_order: 8, conditional_logic: { showIf: "who_is_paying === sponsor" }, validation_rules: { maxLength: 20, block_group: "sponsor_details" } },
  { field_name: "finances_other_explain", label: "Please describe your financial arrangements", field_type: "textarea", required: true, step_number: 10, step_name: "Your Finances", display_order: 9, conditional_logic: { showIf: "who_is_paying === other" }, validation_rules: { maxLength: 500 } },
  { field_name: "has_savings", label: "Do you have any savings?", field_type: "radio", required: true, step_number: 10, step_name: "Your Finances", display_order: 10, options: YES_NO },
  { field_name: "savings_amount", label: "Total savings (in local currency)", field_type: "text", required: true, step_number: 10, step_name: "Your Finances", display_order: 11, conditional_logic: { showIf: "has_savings === yes" }, placeholder: "e.g., 100000000 IDR", validation_rules: { maxLength: 30 } },
  { field_name: "has_other_income", label: "Do you have any other income or financial support?", field_type: "radio", required: true, step_number: 10, step_name: "Your Finances", display_order: 12, options: YES_NO },
  { field_name: "other_income_details", label: "Please describe your other income or financial support", field_type: "textarea", required: true, step_number: 10, step_name: "Your Finances", display_order: 13, conditional_logic: { showIf: "has_other_income === yes" }, validation_rules: { maxLength: 500 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 11: Dependants Travelling With You
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "applying_with_dependants", label: "Is anyone else applying for a UK visa together with you (spouse, children, or other dependants)?", field_type: "radio", required: true, step_number: 11, step_name: "Dependants Travelling With You", display_order: 1, options: YES_NO },
  { field_name: "dependant_relationship", label: "Relationship to you", field_type: "select", required: true, step_number: 11, step_name: "Dependants Travelling With You", display_order: 2, conditional_logic: { showIf: "applying_with_dependants === yes" }, options: [{ value: "spouse", text: "Spouse" }, { value: "civil_partner", text: "Civil partner" }, { value: "child", text: "Child" }, { value: "other", text: "Other" }], validation_rules: { repeatable: true, repeat_group: "dependants", max_items: 10 } },
  { field_name: "dependant_given_names", label: "Given names", field_type: "text", required: true, step_number: 11, step_name: "Dependants Travelling With You", display_order: 3, conditional_logic: { showIf: "applying_with_dependants === yes" }, validation_rules: { maxLength: 50, repeatable: true, repeat_group: "dependants" } },
  { field_name: "dependant_surname", label: "Family name / surname", field_type: "text", required: true, step_number: 11, step_name: "Dependants Travelling With You", display_order: 4, conditional_logic: { showIf: "applying_with_dependants === yes" }, validation_rules: { maxLength: 50, repeatable: true, repeat_group: "dependants" } },
  { field_name: "dependant_date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 11, step_name: "Dependants Travelling With You", display_order: 5, conditional_logic: { showIf: "applying_with_dependants === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "dependants" } },
  { field_name: "dependant_nationality", label: "Nationality", field_type: "country", required: true, step_number: 11, step_name: "Dependants Travelling With You", display_order: 6, conditional_logic: { showIf: "applying_with_dependants === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "dependants" } },
  { field_name: "dependant_passport_number", label: "Passport number", field_type: "text", required: true, step_number: 11, step_name: "Dependants Travelling With You", display_order: 7, conditional_logic: { showIf: "applying_with_dependants === yes" }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "dependants" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 12: Additional Information, Immigration History & Declaration
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "has_medical_condition_affecting_travel", label: "Do you have any medical conditions that might affect your ability to travel?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 1, options: YES_NO },
  { field_name: "medical_condition_affecting_travel_details", label: "Please describe your medical condition", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 2, conditional_logic: { showIf: "has_medical_condition_affecting_travel === yes" }, validation_rules: { maxLength: 500 } },
  { field_name: "tb_test_required_acknowledged", label: "Do you need a tuberculosis (TB) test certificate? (Required if you are from a listed country and staying in the UK for more than 6 months)", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 3, options: [{ value: "yes", text: "Yes, TB test required" }, { value: "no", text: "No, not required" }, { value: "unsure", text: "I'm not sure" }] },
  { field_name: "tb_test_certificate_date", label: "Date of TB test certificate", field_type: "date", required: true, step_number: 12, step_name: "Additional Information", display_order: 4, conditional_logic: { showIf: "tb_test_required_acknowledged === yes" }, validation_rules: { format: "DD/MM/YYYY", block_group: "tb_test_details" } },
  { field_name: "tb_test_clinic_name", label: "Name of the UK Home Office approved clinic", field_type: "text", required: true, step_number: 12, step_name: "Additional Information", display_order: 5, conditional_logic: { showIf: "tb_test_required_acknowledged === yes" }, validation_rules: { maxLength: 120, block_group: "tb_test_details" } },
  { field_name: "criminal_convictions", label: "Have you ever been convicted of a criminal offence in any country (including traffic offences)?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 6, options: YES_NO },
  { field_name: "criminal_convictions_details", label: "Please give details of any criminal convictions", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 7, conditional_logic: { showIf: "criminal_convictions === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "breach_uk_immigration_laws", label: "Have you ever breached UK immigration laws (e.g. overstayed a visa, entered illegally, worked illegally)?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 8, options: YES_NO },
  { field_name: "breach_uk_immigration_laws_details", label: "Please give details of the immigration breach", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 9, conditional_logic: { showIf: "breach_uk_immigration_laws === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "civil_penalty_uk", label: "Have you ever received a civil penalty from the UK Home Office (e.g. unpaid NHS fees)?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 10, options: YES_NO },
  { field_name: "civil_penalty_uk_details", label: "Please give details of the civil penalty", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 11, conditional_logic: { showIf: "civil_penalty_uk === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "public_funds_used_uk", label: "Have you ever received UK public funds that you were not entitled to?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 12, options: YES_NO },
  { field_name: "public_funds_used_uk_details", label: "Please give details", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 13, conditional_logic: { showIf: "public_funds_used_uk === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "terrorism_related", label: "Have you ever been involved in, supported, or encouraged terrorist activities in any country?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 14, options: YES_NO },
  { field_name: "terrorism_details", label: "Please give details", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 15, conditional_logic: { showIf: "terrorism_related === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "war_crimes", label: "Have you ever been involved in, or suspected of involvement in, war crimes, crimes against humanity, or genocide?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 16, options: YES_NO },
  { field_name: "war_crimes_details", label: "Please give details", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 17, conditional_logic: { showIf: "war_crimes === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "organisations_concern", label: "Have you ever been a member of, or given support to, an organisation which has been concerned in terrorism?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 18, options: YES_NO },
  { field_name: "organisations_concern_details", label: "Please give details", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 19, conditional_logic: { showIf: "organisations_concern === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "bad_character", label: "Have you engaged in any other activities that might indicate you may not be considered a person of good character?", field_type: "radio", required: true, step_number: 12, step_name: "Additional Information", display_order: 20, options: YES_NO },
  { field_name: "bad_character_details", label: "Please give details", field_type: "textarea", required: true, step_number: 12, step_name: "Additional Information", display_order: 21, conditional_logic: { showIf: "bad_character === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "additional_information", label: "Is there anything else you would like to tell us about your application?", field_type: "textarea", required: false, step_number: 12, step_name: "Additional Information", display_order: 22, validation_rules: { maxLength: 2000 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // RECON PATCH 2026-04-25 — fields surfaced by walking the live UKVI form.
  // See uk-seed-additions-2026-04-25.ts for full rationale + Section C
  // structural changes (still pending review).
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Step 2: National identity card extensions ─────────────────────────
  { field_name: "national_id_issuing_authority", label: "National identity card issuing authority", field_type: "text", required: false, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 100, conditional_logic: { showIf: "has_national_id_card === yes" }, validation_rules: { maxLength: 60 } },
  { field_name: "national_id_issue_date", label: "National identity card issue date (if applicable)", field_type: "date", required: false, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 101, conditional_logic: { showIf: "has_national_id_card === yes" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "national_id_expiry_date", label: "National identity card expiry date (if applicable)", field_type: "date", required: false, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 102, conditional_logic: { showIf: "has_national_id_card === yes" }, validation_rules: { format: "DD/MM/YYYY" } },

  // ─── Step 3: Address duration split + 3-option ownership ──────────────
  { field_name: "years_at_address", label: "Years at this address", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 100, validation_rules: { pattern: "^[0-9]{1,3}$", maxLength: 3, inline_group: "address_duration" } },
  { field_name: "months_at_address", label: "Additional months", field_type: "text", required: false, step_number: 3, step_name: "Your Contact Details", display_order: 101, validation_rules: { pattern: "^[0-9]{1,2}$", maxLength: 2, inline_group: "address_duration" } },
  { field_name: "home_ownership", label: "Ownership status of your home", field_type: "select", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 102, options: [{ value: "own", text: "I own it" }, { value: "rent", text: "I rent it" }, { value: "other", text: "Other" }] },
  { field_name: "home_ownership_other_details", label: "Tell us more about your living situation", field_type: "textarea", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 103, conditional_logic: { showIf: "home_ownership === other" }, validation_rules: { maxLength: 500 } },

  // ─── Step 3: Immigration status in residence country ──────────────────
  { field_name: "immigration_status_in_residence_country", label: "Your immigration status in your country of residence", field_type: "radio", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 17, options: [{ value: "temporaryVisa", text: "I have a temporary visa" }, { value: "permanentResident", text: "I am a permanent resident" }, { value: "other", text: "I do not have a visa and I am not a permanent resident" }] },
  { field_name: "immigration_status_visa_expiry", label: "Visa expiry date", field_type: "date", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 18, conditional_logic: { showIf: "immigration_status_in_residence_country === temporaryVisa" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "immigration_status_pr_year", label: "Year you became a permanent resident", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 19, conditional_logic: { showIf: "immigration_status_in_residence_country === permanentResident" }, validation_rules: { pattern: "^[0-9]{4}$", maxLength: 4 } },
  { field_name: "immigration_status_other_details", label: "Tell us about your immigration situation", field_type: "textarea", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 20, conditional_logic: { showIf: "immigration_status_in_residence_country === other" }, validation_rules: { maxLength: 1000 } },

  // ─── Step 7: spend + sponsorship + language (uk_arrival_date / uk_departure_date already seeded above) ─
  { field_name: "planned_spend_currency", label: "Planned spend — currency", field_type: "select", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 100, options: [{ value: "GBP", text: "GBP" }, { value: "USD", text: "USD" }, { value: "EUR", text: "EUR" }, { value: "CNY", text: "CNY" }] },
  { field_name: "planned_spend_amount", label: "How much do you plan to spend on this visit?", field_type: "text", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 101, validation_rules: { pattern: "^[0-9]+(\\.[0-9]{1,2})?$" } },
  { field_name: "someone_paying_for_visit", label: "Will anyone be paying towards the cost of your visit?", field_type: "radio", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 31, options: YES_NO },
  { field_name: "spoken_language_preference", label: "Which language would you prefer if we need to discuss your application?", field_type: "radio", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 40, options: [{ value: "english", text: "English" }, { value: "other", text: "Other" }] },
  { field_name: "spoken_language_other_details", label: "Specify the language", field_type: "text", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 41, conditional_logic: { showIf: "spoken_language_preference === other" }, validation_rules: { maxLength: 60 } },

  // ─── Step 8: Tourism sub-purpose (conditional on tourism) ─────────────
  { field_name: "tourism_sub_purpose", label: "Main reason for your holiday visit", field_type: "radio", required: true, step_number: 8, step_name: "Your Trip to the UK — Purpose", display_order: 1, conditional_logic: { showIf: "purpose_of_visit === tourism" }, options: [{ value: "tourist", text: "Tourist" }, { value: "visiting_family", text: "Visiting family" }, { value: "visiting_friends", text: "Visiting friends" }] },

  // ─── Step 9: Employment — employer address split, phone split, partial date, money split, description
  { field_name: "employer_address_line_1", label: "Employer address — line 1", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 200, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 100, block_group: "employer_address" } },
  { field_name: "employer_address_line_2", label: "Employer address — line 2", field_type: "text", required: false, step_number: 9, step_name: "Your Employment", display_order: 201, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 100, block_group: "employer_address" } },
  { field_name: "employer_address_city", label: "Employer town/city", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 202, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 60, block_group: "employer_address" } },
  { field_name: "employer_address_state", label: "Employer province/state", field_type: "text", required: false, step_number: 9, step_name: "Your Employment", display_order: 203, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 60, block_group: "employer_address" } },
  { field_name: "employer_address_postcode", label: "Employer postal code", field_type: "text", required: false, step_number: 9, step_name: "Your Employment", display_order: 204, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 15, block_group: "employer_address" } },
  { field_name: "employer_address_country", label: "Employer country", field_type: "country", required: true, step_number: 9, step_name: "Your Employment", display_order: 205, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { source: "ISO3166-1", block_group: "employer_address" } },
  { field_name: "employer_phone_code", label: "Employer phone — international code", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 206, conditional_logic: { showIf: "employment_status === employed" }, placeholder: "e.g., 1, 44, 86 (digits only, no plus)", validation_rules: { pattern: "^[0-9]{1,4}$" } },
  { field_name: "employer_phone_number", label: "Employer phone — number", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 207, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 20 } },
  { field_name: "job_start_month", label: "Job start month", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 208, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { pattern: "^[0-9]{1,2}$" } },
  { field_name: "job_start_year", label: "Job start year", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 209, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { pattern: "^[0-9]{4}$" } },
  // (job_title already seeded earlier in the file)
  { field_name: "monthly_earnings_currency", label: "Monthly earnings — currency", field_type: "select", required: true, step_number: 9, step_name: "Your Employment", display_order: 210, conditional_logic: { showIf: "employment_status === employed" }, options: [{ value: "GBP", text: "GBP" }, { value: "USD", text: "USD" }, { value: "EUR", text: "EUR" }, { value: "CNY", text: "CNY" }] },
  { field_name: "monthly_earnings_amount", label: "Monthly earnings (after tax)", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 211, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { pattern: "^[0-9]+(\\.[0-9]{1,2})?$" } },
  { field_name: "job_description", label: "Describe your job", field_type: "textarea", required: true, step_number: 9, step_name: "Your Employment", display_order: 8, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 500 } },

  // ─── Step 10: Income / outgoings split ───────────────────────────────
  { field_name: "has_other_income_or_savings", label: "Do you have any other income or savings?", field_type: "radio", required: true, step_number: 10, step_name: "Your Finances", display_order: 0, options: YES_NO },
  { field_name: "monthly_outgoings_currency", label: "Monthly outgoings — currency", field_type: "select", required: true, step_number: 10, step_name: "Your Finances", display_order: 100, options: [{ value: "GBP", text: "GBP" }, { value: "USD", text: "USD" }, { value: "EUR", text: "EUR" }, { value: "CNY", text: "CNY" }] },
  { field_name: "monthly_outgoings_amount", label: "Total amount you spend each month", field_type: "text", required: true, step_number: 10, step_name: "Your Finances", display_order: 101, validation_rules: { pattern: "^[0-9]+(\\.[0-9]{1,2})?$" } },
];

// ─── Seed Runner ────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);

  // Clear existing fields for this visa type
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
