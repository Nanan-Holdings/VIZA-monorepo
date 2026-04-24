/**
 * Seed script: visa_form_fields for Vietnam E-Visa
 * Field definitions based on the live Vietnam Immigration Department
 * e-Visa portal at https://evisa.gov.vn.
 *
 * Scope: single electronic visa product — up to 90 days, single or
 * multiple entry, all nationalities eligible (Aug 2023 policy). Covers
 * tourism, visiting relatives, business, working (short-term), and
 * "other" purposes. Each purpose has a small conditional sub-journey
 * in Step 8. Document uploads (photo, passport copy) are out-of-schema
 * per playbook §5.6 — they live in application_documents.
 *
 * Primary field-inventory source: the in-repo vietnam-visa-helper-v1
 * browser extension (v1.2.1), which was driven manually against the
 * live evisa.gov.vn form. See docs/vietnam-visa-scope.md and
 * docs/vietnam-visa-gap-report.md for scope decisions and known
 * limitations.
 *
 * Run: npx tsx scripts/seed-vn-e-visa-form-fields.ts
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

const VISA_TYPE = "VN_E_VISA";

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

// Reusable gate constants — declared once, referenced in every sub-journey field
const HAS_MULTIPLE_NATIONALITIES = "has_multiple_nationalities === yes";
const HAS_OTHER_PASSPORTS = "has_other_passports === yes";
const IS_UNDER_18 = "is_applicant_under_18 === yes";
const IS_BUSINESS = "purpose_of_entry === business";
const IS_WORKING = "purpose_of_entry === working";
const IS_VISITING_RELATIVES = "purpose_of_entry === visiting_relatives";
const HAS_RELATIVES_VN = "has_relatives_in_vietnam === yes";
const HAS_PREV_VN_VISITS = "visited_vietnam_before === yes";
const EXPENSE_COMPANY = "expense_coverage === company";
const VIOLATED_LAWS = "violation_of_vietnam_laws === yes";

const BORDER_GATES = [
  { value: "noi_bai", text: "Noi Bai International Airport (Hanoi)" },
  { value: "tan_son_nhat", text: "Tan Son Nhat International Airport (Ho Chi Minh City)" },
  { value: "da_nang_airport", text: "Da Nang International Airport" },
  { value: "cat_bi", text: "Cat Bi International Airport (Hai Phong)" },
  { value: "cam_ranh", text: "Cam Ranh International Airport (Nha Trang)" },
  { value: "phu_quoc", text: "Phu Quoc International Airport" },
  { value: "lao_cai", text: "Lao Cai Land Border (China)" },
  { value: "mong_cai", text: "Mong Cai Land Border (China)" },
  { value: "huu_nghi", text: "Huu Nghi / Friendship Gate Land Border (China)" },
  { value: "moc_bai", text: "Moc Bai Land Border (Cambodia)" },
  { value: "lao_bao", text: "Lao Bao Land Border (Laos)" },
  { value: "other_port", text: "Other port of entry" },
];

const PROVINCES = [
  { value: "hanoi", text: "Hanoi (Hà Nội)" },
  { value: "ho_chi_minh_city", text: "Ho Chi Minh City (Hồ Chí Minh)" },
  { value: "da_nang", text: "Da Nang (Đà Nẵng)" },
  { value: "hai_phong", text: "Hai Phong (Hải Phòng)" },
  { value: "can_tho", text: "Can Tho (Cần Thơ)" },
  { value: "khanh_hoa", text: "Khanh Hoa / Nha Trang (Khánh Hòa)" },
  { value: "lam_dong", text: "Lam Dong / Da Lat (Lâm Đồng)" },
  { value: "thua_thien_hue", text: "Thua Thien Hue / Hue (Thừa Thiên Huế)" },
  { value: "quang_ninh", text: "Quang Ninh / Ha Long (Quảng Ninh)" },
  { value: "kien_giang", text: "Kien Giang / Phu Quoc (Kiên Giang)" },
  { value: "other_province", text: "Other province / city" },
];

const FIELDS: FieldDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Personal Details
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "surname", label: "Surname / family name (as shown in your passport)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 1, placeholder: "e.g., ZHANG", validation_rules: { maxLength: 50 } },
  { field_name: "given_name", label: "Given name (as shown in your passport)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 2, placeholder: "e.g., SAN", validation_rules: { maxLength: 50 } },
  { field_name: "full_name", label: "Full name (as shown in your passport)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 3, placeholder: "e.g., ZHANG SAN", validation_rules: { maxLength: 100 } },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Details", display_order: 4, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Details", display_order: 5, options: [{ value: "male", text: "Male" }, { value: "female", text: "Female" }] },
  { field_name: "nationality", label: "Current nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 6, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_multiple_nationalities", label: "Do you hold any other nationalities?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 7, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 8, conditional_logic: { showIf: HAS_MULTIPLE_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "country_of_birth", label: "Country of birth", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "place_of_birth", label: "Place of birth (city or town)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 10, placeholder: "e.g., Shanghai", validation_rules: { maxLength: 60 } },
  { field_name: "identity_card_number", label: "National identity card number (or other national ID)", field_type: "text", required: false, step_number: 1, step_name: "Personal Details", display_order: 11, placeholder: "e.g., 310101199001011234", validation_rules: { maxLength: 30 } },
  { field_name: "religion", label: "Religion", field_type: "select", required: false, step_number: 1, step_name: "Personal Details", display_order: 12, options: [
    { value: "none", text: "None / No religion" },
    { value: "buddhism", text: "Buddhism" },
    { value: "christianity", text: "Christianity" },
    { value: "islam", text: "Islam" },
    { value: "hinduism", text: "Hinduism" },
    { value: "judaism", text: "Judaism" },
    { value: "taoism", text: "Taoism" },
    { value: "other_religion", text: "Other" },
  ] },
  { field_name: "is_applicant_under_18", label: "Will you be under 18 on the date you plan to enter Vietnam?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 13, options: YES_NO },
  { field_name: "parent_consent_letter_held", label: "Do you have a signed letter of consent from both parents or legal guardians?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 14, conditional_logic: { showIf: IS_UNDER_18 }, options: YES_NO },
  { field_name: "accompanying_adult_name", label: "Name of the adult accompanying you", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 15, conditional_logic: { showIf: IS_UNDER_18 }, validation_rules: { maxLength: 80, block_group: "accompanying_adult" } },
  { field_name: "accompanying_adult_relationship", label: "Relationship to the accompanying adult", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 16, conditional_logic: { showIf: IS_UNDER_18 }, placeholder: "e.g., Parent, Guardian", validation_rules: { maxLength: 40, block_group: "accompanying_adult" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Passport & Identity Documents
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 1, placeholder: "e.g., E12345678", validation_rules: { maxLength: 20 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 2, options: [
    { value: "ordinary", text: "Ordinary passport" },
    { value: "official", text: "Official passport" },
    { value: "diplomatic", text: "Diplomatic passport" },
  ] },
  { field_name: "passport_issuing_authority", label: "Issuing authority", field_type: "text", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 3, placeholder: "e.g., National Immigration Administration", validation_rules: { maxLength: 80 } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 4, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_expiry_date", label: "Date of expiry (must be valid ≥6 months after arrival)", field_type: "date", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 5, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "has_other_passports", label: "Do you hold any other valid passports or travel documents?", field_type: "radio", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 6, options: YES_NO },
  { field_name: "other_passport_nationality", label: "Nationality of the other passport", field_type: "country", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 7, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_passports", max_items: 3 } },
  { field_name: "other_passport_number", label: "Other passport number", field_type: "text", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 8, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_passports" } },
  { field_name: "other_passport_expiry_date", label: "Other passport date of expiry", field_type: "date", required: true, step_number: 2, step_name: "Passport & Identity Documents", display_order: 9, conditional_logic: { showIf: HAS_OTHER_PASSPORTS }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "other_passports" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Contact Details
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "email_address", label: "Email address (where the visa notification will be sent)", field_type: "text", required: true, step_number: 3, step_name: "Contact Details", display_order: 1, placeholder: "e.g., name@example.com", validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },
  { field_name: "re_enter_email_address", label: "Re-enter email address", field_type: "text", required: true, step_number: 3, step_name: "Contact Details", display_order: 2, placeholder: "e.g., name@example.com", validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },
  { field_name: "phone_number", label: "Phone number (including country code)", field_type: "text", required: true, step_number: 3, step_name: "Contact Details", display_order: 3, placeholder: "e.g., +86 1234 567 8901", validation_rules: { maxLength: 20 } },
  { field_name: "phone_in_vietnam", label: "Phone number in Vietnam (if known)", field_type: "text", required: false, step_number: 3, step_name: "Contact Details", display_order: 4, placeholder: "e.g., +84 912 345 678", validation_rules: { maxLength: 20 } },
  { field_name: "home_address_line_1", label: "Home address — line 1", field_type: "text", required: true, step_number: 3, step_name: "Contact Details", display_order: 5, validation_rules: { maxLength: 100, block_group: "home_address" } },
  { field_name: "home_address_city", label: "City / town", field_type: "text", required: true, step_number: 3, step_name: "Contact Details", display_order: 6, validation_rules: { maxLength: 60, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Country", field_type: "country", required: true, step_number: 3, step_name: "Contact Details", display_order: 7, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Occupation
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "occupation", label: "Occupation", field_type: "select", required: true, step_number: 4, step_name: "Occupation", display_order: 1, options: [
    { value: "employee", text: "Employee" },
    { value: "student", text: "Student" },
    { value: "businessman", text: "Businessman / Self-employed" },
    { value: "official", text: "Government official" },
    { value: "retired", text: "Retired" },
    { value: "unemployed", text: "Unemployed" },
    { value: "housewife", text: "Housewife / Homemaker" },
    { value: "other_occupation", text: "Other" },
  ] },
  { field_name: "occupation_info", label: "Occupation details / job title", field_type: "text", required: true, step_number: 4, step_name: "Occupation", display_order: 2, placeholder: "e.g., Software Engineer", validation_rules: { maxLength: 80 } },
  { field_name: "company_or_school_name", label: "Company, institution, or school name", field_type: "text", required: true, step_number: 4, step_name: "Occupation", display_order: 3, placeholder: "e.g., Tech Company Ltd.", validation_rules: { maxLength: 100 } },
  { field_name: "position_course", label: "Position or course of study", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 4, placeholder: "e.g., Senior Engineer, Computer Science Major", validation_rules: { maxLength: 80 } },
  { field_name: "company_address", label: "Company / institution / school address", field_type: "text", required: true, step_number: 4, step_name: "Occupation", display_order: 5, validation_rules: { maxLength: 200 } },
  { field_name: "company_phone", label: "Company / institution / school phone", field_type: "text", required: false, step_number: 4, step_name: "Occupation", display_order: 6, placeholder: "e.g., +86 10 1234 5678", validation_rules: { maxLength: 20 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Trip Information
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "purpose_of_entry", label: "Main purpose of entry", field_type: "select", required: true, step_number: 5, step_name: "Trip Information", display_order: 1, options: [
    { value: "tourist", text: "Tourism" },
    { value: "visiting_relatives", text: "Visiting relatives" },
    { value: "business", text: "Business" },
    { value: "working", text: "Working (short-term)" },
    { value: "other_purpose", text: "Other" },
  ] },
  { field_name: "other_purpose_detail", label: "Please specify the purpose", field_type: "text", required: true, step_number: 5, step_name: "Trip Information", display_order: 2, conditional_logic: { showIf: "purpose_of_entry === other_purpose" }, validation_rules: { maxLength: 200 } },
  { field_name: "visa_type_requested", label: "Type of visa requested", field_type: "radio", required: true, step_number: 5, step_name: "Trip Information", display_order: 3, options: [
    { value: "single", text: "Single-entry (up to 90 days)" },
    { value: "multiple", text: "Multiple-entry (up to 90 days)" },
  ] },
  { field_name: "intended_date_of_entry", label: "Intended date of entry to Vietnam", field_type: "date", required: true, step_number: 5, step_name: "Trip Information", display_order: 4, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_date_of_exit", label: "Intended date of exit from Vietnam", field_type: "date", required: true, step_number: 5, step_name: "Trip Information", display_order: 5, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay (days, max 90)", field_type: "text", required: true, step_number: 5, step_name: "Trip Information", display_order: 6, placeholder: "e.g., 14", validation_rules: { pattern: "^(?:[1-9][0-9]?|90)$" } },
  { field_name: "visited_vietnam_before", label: "Have you ever visited Vietnam in the last 5 years?", field_type: "radio", required: true, step_number: 5, step_name: "Trip Information", display_order: 7, options: YES_NO },
  { field_name: "prev_vn_visit_arrival", label: "Date of arrival (previous visit)", field_type: "date", required: true, step_number: 5, step_name: "Trip Information", display_order: 8, conditional_logic: { showIf: HAS_PREV_VN_VISITS }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "previous_vn_visits", max_items: 5 } },
  { field_name: "prev_vn_visit_duration", label: "Length of stay (previous visit)", field_type: "text", required: true, step_number: 5, step_name: "Trip Information", display_order: 9, conditional_logic: { showIf: HAS_PREV_VN_VISITS }, placeholder: "e.g., 14 days", validation_rules: { maxLength: 40, repeatable: true, repeat_group: "previous_vn_visits" } },
  { field_name: "prev_vn_visit_purpose", label: "Purpose of previous visit", field_type: "text", required: true, step_number: 5, step_name: "Trip Information", display_order: 10, conditional_logic: { showIf: HAS_PREV_VN_VISITS }, placeholder: "e.g., Tourism", validation_rules: { maxLength: 80, repeatable: true, repeat_group: "previous_vn_visits" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Accommodation in Vietnam
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "intended_province_city", label: "Main province or city of stay", field_type: "select", required: true, step_number: 6, step_name: "Accommodation in Vietnam", display_order: 1, options: PROVINCES },
  { field_name: "intended_ward_commune", label: "District / ward / commune", field_type: "text", required: true, step_number: 6, step_name: "Accommodation in Vietnam", display_order: 2, placeholder: "e.g., Ba Dinh District", validation_rules: { maxLength: 80 } },
  { field_name: "hotel_or_host_name", label: "Hotel name or host name", field_type: "text", required: true, step_number: 6, step_name: "Accommodation in Vietnam", display_order: 3, placeholder: "e.g., Hanoi Pearl Hotel", validation_rules: { maxLength: 100 } },
  { field_name: "residential_address_in_vietnam", label: "Residential address in Vietnam (street, building, number)", field_type: "textarea", required: true, step_number: 6, step_name: "Accommodation in Vietnam", display_order: 4, placeholder: "e.g., 123 Tran Hung Dao Street, Hanoi", validation_rules: { maxLength: 300 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: Border Gates
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "intended_border_gate_of_entry", label: "Intended border gate of entry", field_type: "select", required: true, step_number: 7, step_name: "Border Gates", display_order: 1, options: BORDER_GATES },
  { field_name: "intended_border_gate_of_exit", label: "Intended border gate of exit", field_type: "select", required: true, step_number: 7, step_name: "Border Gates", display_order: 2, options: BORDER_GATES },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: Purpose-Specific Details
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "inviting_company_name", label: "Inviting company name in Vietnam", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 1, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 120, block_group: "inviting_company" } },
  { field_name: "inviting_company_address", label: "Inviting company address", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 2, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 200, block_group: "inviting_company" } },
  { field_name: "inviting_company_phone", label: "Inviting company phone", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 3, conditional_logic: { showIf: IS_BUSINESS }, placeholder: "e.g., +84 24 1234 5678", validation_rules: { maxLength: 20, block_group: "inviting_company" } },
  { field_name: "work_permit_number", label: "Work permit number (if held)", field_type: "text", required: false, step_number: 8, step_name: "Purpose-Specific Details", display_order: 4, conditional_logic: { showIf: IS_WORKING }, validation_rules: { maxLength: 30, block_group: "working_details" } },
  { field_name: "employer_in_vietnam", label: "Employer / host organisation in Vietnam", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 5, conditional_logic: { showIf: IS_WORKING }, validation_rules: { maxLength: 120, block_group: "working_details" } },
  { field_name: "has_relatives_in_vietnam", label: "Do you have relatives currently residing in Vietnam?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 6, options: YES_NO },
  { field_name: "relative_name_in_vn", label: "Relative's full name", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 7, conditional_logic: { showIf: HAS_RELATIVES_VN }, validation_rules: { maxLength: 100, block_group: "relative_in_vn" } },
  { field_name: "relative_relationship", label: "Relationship", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 8, conditional_logic: { showIf: HAS_RELATIVES_VN }, placeholder: "e.g., Brother, Uncle, Cousin", validation_rules: { maxLength: 40, block_group: "relative_in_vn" } },
  { field_name: "relative_address_in_vn", label: "Relative's address in Vietnam", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 9, conditional_logic: { showIf: HAS_RELATIVES_VN }, validation_rules: { maxLength: 200, block_group: "relative_in_vn" } },
  { field_name: "relative_phone_in_vn", label: "Relative's phone in Vietnam", field_type: "text", required: false, step_number: 8, step_name: "Purpose-Specific Details", display_order: 10, conditional_logic: { showIf: HAS_RELATIVES_VN }, placeholder: "e.g., +84 912 345 678", validation_rules: { maxLength: 20, block_group: "relative_in_vn" } },
  { field_name: "visiting_relatives_purpose_detail", label: "Purpose of visit to relatives (brief description)", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 11, conditional_logic: { showIf: IS_VISITING_RELATIVES }, validation_rules: { maxLength: 500 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 9: Trip Expenses & Emergency Contact
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "intended_expenses_usd", label: "Intended expenses for the trip (USD)", field_type: "text", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 1, placeholder: "e.g., 1000", validation_rules: { pattern: "^[0-9]{1,6}$" } },
  { field_name: "bought_travel_insurance", label: "Have you purchased travel insurance for this trip?", field_type: "radio", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 2, options: YES_NO },
  { field_name: "expense_coverage", label: "Who will cover the cost of your trip?", field_type: "select", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 3, options: [
    { value: "self", text: "Myself (personal funds)" },
    { value: "company", text: "Company / organisation" },
    { value: "sponsor", text: "Sponsor / other person" },
  ] },
  { field_name: "sponsor_name", label: "Name of sponsoring company or person", field_type: "text", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 4, conditional_logic: { showIf: "expense_coverage === company || expense_coverage === sponsor" }, validation_rules: { maxLength: 120, block_group: "sponsor_details" } },
  { field_name: "sponsor_address", label: "Sponsor address", field_type: "text", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 5, conditional_logic: { showIf: "expense_coverage === company || expense_coverage === sponsor" }, validation_rules: { maxLength: 200, block_group: "sponsor_details" } },
  { field_name: "sponsor_relationship", label: "Relationship to sponsor", field_type: "text", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 6, conditional_logic: { showIf: EXPENSE_COMPANY + " || expense_coverage === sponsor" }, placeholder: "e.g., Employer, Friend, Relative", validation_rules: { maxLength: 40, block_group: "sponsor_details" } },
  { field_name: "payment_method", label: "How will you pay for this trip?", field_type: "select", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 7, options: [
    { value: "cash", text: "Cash" },
    { value: "credit_card", text: "Credit card" },
    { value: "bank_transfer", text: "Bank transfer" },
    { value: "travellers_cheques", text: "Traveller's cheques" },
  ] },
  { field_name: "emergency_contact_name", label: "Emergency contact — full name", field_type: "text", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 8, validation_rules: { maxLength: 80, block_group: "emergency_contact" } },
  { field_name: "emergency_contact_relationship", label: "Emergency contact — relationship", field_type: "select", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 9, validation_rules: { block_group: "emergency_contact" }, options: [
    { value: "parent", text: "Parent" },
    { value: "spouse", text: "Spouse" },
    { value: "sibling", text: "Sibling" },
    { value: "child", text: "Child" },
    { value: "relative", text: "Other relative" },
    { value: "friend", text: "Friend" },
    { value: "colleague", text: "Colleague" },
  ] },
  { field_name: "emergency_contact_phone", label: "Emergency contact — phone (with country code)", field_type: "text", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 10, placeholder: "e.g., +86 1234 567 8902", validation_rules: { maxLength: 20, block_group: "emergency_contact" } },
  { field_name: "emergency_contact_address", label: "Emergency contact — current address", field_type: "text", required: true, step_number: 9, step_name: "Trip Expenses & Emergency Contact", display_order: 11, validation_rules: { maxLength: 200, block_group: "emergency_contact" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 10: Declaration
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "violation_of_vietnam_laws", label: "Have you ever violated Vietnamese laws or regulations?", field_type: "radio", required: true, step_number: 10, step_name: "Declaration", display_order: 1, options: YES_NO },
  { field_name: "violation_of_vietnam_laws_details", label: "Please give details of the violation", field_type: "textarea", required: true, step_number: 10, step_name: "Declaration", display_order: 2, conditional_logic: { showIf: VIOLATED_LAWS }, validation_rules: { maxLength: 1000 } },
  { field_name: "declaration_temporary_residence", label: "I undertake to declare my temporary residence in Vietnam as required by Vietnamese law during my stay", field_type: "radio", required: true, step_number: 10, step_name: "Declaration", display_order: 3, options: [{ value: "yes", text: "I agree" }] },
  { field_name: "declaration_account_creation", label: "I agree to the creation of an e-Visa account using this email address", field_type: "radio", required: true, step_number: 10, step_name: "Declaration", display_order: 4, options: [{ value: "yes", text: "I agree" }] },
  { field_name: "declaration_truthfulness", label: "I declare that the information I have provided is true and correct, and I accept responsibility for any false declaration under Vietnamese law", field_type: "radio", required: true, step_number: 10, step_name: "Declaration", display_order: 5, options: [{ value: "yes", text: "I agree" }] },
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
