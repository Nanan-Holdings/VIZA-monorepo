/**
 * Seed script: visa_form_fields for EU Schengen Type C (short-stay) Visa
 * Field definitions based on the harmonized application form in
 * Annex I of Regulation (EC) No 810/2009 ("Visa Code"), as amended
 * by Regulation (EU) 2019/1155.
 *
 * Scope: Full Schengen Type C short-stay umbrella (up to 90 days in
 * any 180-day period) — tourism, business, visiting family/friends,
 * cultural, sports, official visit, medical, short-term study,
 * airport transit, and "other". Each purpose has its own conditional
 * sub-journey fields in Step 8.
 *
 * Source authority: Annex I is the single harmonized form accepted by
 * all 29 Schengen member states. Country-specific UX (France-Visas,
 * VFS, BLS, TLS Contact) renders the same field set with local
 * branding; the schema captures the shared Annex I ground truth.
 *
 * See docs/schengen-visa-scope.md and docs/schengen-visa-gap-report.md
 * for scope decisions and known limitations.
 *
 * Run: npx tsx scripts/seed-eu-schengen-c-short-stay-form-fields.ts
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

const VISA_TYPE = "EU_SCHENGEN_C_SHORT_STAY";

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

// Purpose-of-journey showIf expressions (Annex I field 23). Reused across
// every sub-journey field in Step 8.
const IS_TOURISM = "purpose_of_journey === tourism";
const IS_BUSINESS = "purpose_of_journey === business";
const IS_VISIT = "purpose_of_journey === visiting_family_friends";
const IS_CULTURAL = "purpose_of_journey === cultural";
const IS_SPORTS = "purpose_of_journey === sports";
const IS_OFFICIAL = "purpose_of_journey === official_visit";
const IS_MEDICAL = "purpose_of_journey === medical";
const IS_STUDY = "purpose_of_journey === study";
const IS_TRANSIT = "purpose_of_journey === airport_transit";
const IS_OTHER = "purpose_of_journey === other";
const IS_EVENT = `${IS_CULTURAL} || ${IS_SPORTS} || ${IS_OFFICIAL}`;

// Cost-of-trip gates (Annex I field 36).
const COST_SELF = "cost_covered_by === self || cost_covered_by === both";
const COST_SPONSOR = "cost_covered_by === sponsor || cost_covered_by === both";

// Annex IV of the Visa Code — third-country nationals subject to Airport
// Transit Visa (ATV) at all Schengen airports. ISO 3166-1 alpha-2 codes.
// Source: Regulation (EC) No 810/2009 Annex IV as amended.
const ATV_ANNEX_IV_NATIONALITIES = "af, bd, cd, er, et, gh, ir, iq, ng, pk, so, lk";
const IS_ATV_NATIONAL = `current_nationality in [${ATV_ANNEX_IV_NATIONALITIES}] && ${IS_TRANSIT}`;

const FIELDS: FieldDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Personal Details (Annex I fields 1–9)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "surname", label: "Surname (family name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 1, placeholder: "e.g., Smith", validation_rules: { maxLength: 50 } },
  { field_name: "surname_at_birth_different", label: "Is your surname at birth different from your current surname?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 2, options: YES_NO },
  { field_name: "surname_at_birth", label: "Surname at birth (former family name(s))", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 3, conditional_logic: { showIf: "surname_at_birth_different === yes" }, validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "First name(s) (given name(s))", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 4, placeholder: "e.g., John Michael", validation_rules: { maxLength: 50 } },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Details", display_order: 5, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "place_of_birth", label: "Place of birth (city or town)", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 6, validation_rules: { maxLength: 60 } },
  { field_name: "country_of_birth", label: "Country of birth", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 7, validation_rules: { source: "ISO3166-1" } },
  { field_name: "current_nationality", label: "Current nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 8, validation_rules: { source: "ISO3166-1" } },
  { field_name: "nationality_at_birth_different", label: "Is your nationality at birth different from your current nationality?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 9, options: YES_NO },
  { field_name: "nationality_at_birth", label: "Nationality at birth", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 10, conditional_logic: { showIf: "nationality_at_birth_different === yes" }, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other nationalities?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 11, options: YES_NO },
  { field_name: "other_nationality", label: "Other nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Details", display_order: 12, conditional_logic: { showIf: "has_other_nationalities === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 5 } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Details", display_order: 13, options: [{ value: "male", text: "Male" }, { value: "female", text: "Female" }, { value: "other", text: "Other" }] },
  { field_name: "civil_status", label: "Civil status", field_type: "select", required: true, step_number: 1, step_name: "Personal Details", display_order: 14, options: [
    { value: "single", text: "Single" },
    { value: "married", text: "Married" },
    { value: "registered_partnership", text: "Registered partnership" },
    { value: "separated", text: "Separated" },
    { value: "divorced", text: "Divorced" },
    { value: "widowed", text: "Widow(er)" },
    { value: "other", text: "Other" },
  ] },
  { field_name: "civil_status_other", label: "Please specify your civil status", field_type: "text", required: true, step_number: 1, step_name: "Personal Details", display_order: 15, conditional_logic: { showIf: "civil_status === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "is_applicant_minor", label: "Will you be under 18 on the date you plan to travel to the Schengen Area?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Details", display_order: 16, options: YES_NO },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Parental Authority (Annex I field 10 — minors only)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "parental_authority_surname", label: "Surname of parental authority / legal guardian", field_type: "text", required: true, step_number: 2, step_name: "Parental Authority (for minors)", display_order: 1, conditional_logic: { showIf: "is_applicant_minor === yes" }, validation_rules: { maxLength: 50, block_group: "parental_authority" } },
  { field_name: "parental_authority_given_names", label: "First name(s) of parental authority / legal guardian", field_type: "text", required: true, step_number: 2, step_name: "Parental Authority (for minors)", display_order: 2, conditional_logic: { showIf: "is_applicant_minor === yes" }, validation_rules: { maxLength: 50, block_group: "parental_authority" } },
  { field_name: "parental_authority_address_line_1", label: "Address — line 1 (if different from applicant's)", field_type: "text", required: true, step_number: 2, step_name: "Parental Authority (for minors)", display_order: 3, conditional_logic: { showIf: "is_applicant_minor === yes" }, validation_rules: { maxLength: 100, block_group: "parental_authority" } },
  { field_name: "parental_authority_address_city", label: "City", field_type: "text", required: true, step_number: 2, step_name: "Parental Authority (for minors)", display_order: 4, conditional_logic: { showIf: "is_applicant_minor === yes" }, validation_rules: { maxLength: 60, block_group: "parental_authority" } },
  { field_name: "parental_authority_address_country", label: "Country", field_type: "country", required: true, step_number: 2, step_name: "Parental Authority (for minors)", display_order: 5, conditional_logic: { showIf: "is_applicant_minor === yes" }, validation_rules: { source: "ISO3166-1", block_group: "parental_authority" } },
  { field_name: "parental_authority_phone", label: "Telephone number", field_type: "text", required: true, step_number: 2, step_name: "Parental Authority (for minors)", display_order: 6, conditional_logic: { showIf: "is_applicant_minor === yes" }, validation_rules: { maxLength: 20, block_group: "parental_authority" } },
  { field_name: "parental_authority_email", label: "E-mail address", field_type: "text", required: true, step_number: 2, step_name: "Parental Authority (for minors)", display_order: 7, conditional_logic: { showIf: "is_applicant_minor === yes" }, validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "parental_authority" } },
  { field_name: "parental_authority_nationality", label: "Nationality", field_type: "country", required: true, step_number: 2, step_name: "Parental Authority (for minors)", display_order: 8, conditional_logic: { showIf: "is_applicant_minor === yes" }, validation_rules: { source: "ISO3166-1", block_group: "parental_authority" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Travel Document & National ID (Annex I fields 11–16)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "has_national_id", label: "Do you have a national identity number?", field_type: "radio", required: true, step_number: 3, step_name: "Travel Document & Identity", display_order: 1, options: YES_NO },
  { field_name: "national_id_number", label: "National identity number", field_type: "text", required: true, step_number: 3, step_name: "Travel Document & Identity", display_order: 2, conditional_logic: { showIf: "has_national_id === yes" }, validation_rules: { maxLength: 30 } },
  { field_name: "travel_document_type", label: "Type of travel document", field_type: "select", required: true, step_number: 3, step_name: "Travel Document & Identity", display_order: 3, options: [
    { value: "ordinary", text: "Ordinary passport" },
    { value: "diplomatic", text: "Diplomatic passport" },
    { value: "service", text: "Service passport" },
    { value: "official", text: "Official passport" },
    { value: "special", text: "Special passport" },
    { value: "other", text: "Other travel document" },
  ] },
  { field_name: "travel_document_type_other", label: "Please specify the travel document type", field_type: "text", required: true, step_number: 3, step_name: "Travel Document & Identity", display_order: 4, conditional_logic: { showIf: "travel_document_type === other" }, validation_rules: { maxLength: 80 } },
  { field_name: "travel_document_number", label: "Travel document number", field_type: "text", required: true, step_number: 3, step_name: "Travel Document & Identity", display_order: 5, placeholder: "e.g., 123456789", validation_rules: { maxLength: 20 } },
  { field_name: "travel_document_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 3, step_name: "Travel Document & Identity", display_order: 6, validation_rules: { format: "DD/MM/YYYY", inline_group: "travel_document_dates" } },
  { field_name: "travel_document_expiry_date", label: "Valid until", field_type: "date", required: true, step_number: 3, step_name: "Travel Document & Identity", display_order: 7, validation_rules: { format: "DD/MM/YYYY", inline_group: "travel_document_dates" } },
  { field_name: "travel_document_issuing_country", label: "Issued by (country)", field_type: "country", required: true, step_number: 3, step_name: "Travel Document & Identity", display_order: 8, validation_rules: { source: "ISO3166-1" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: EU/EEA/CH Family Member (Annex I fields 17–18)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "has_eu_family_member", label: "Are you a family member of an EU, EEA or Swiss citizen, or of a UK national who is a beneficiary of the EU-UK Withdrawal Agreement?", field_type: "radio", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 1, options: YES_NO },
  { field_name: "eu_family_surname", label: "Surname of the EU/EEA/CH family member", field_type: "text", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 2, conditional_logic: { showIf: "has_eu_family_member === yes" }, validation_rules: { maxLength: 50, block_group: "eu_family" } },
  { field_name: "eu_family_given_names", label: "First name(s) of the EU/EEA/CH family member", field_type: "text", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 3, conditional_logic: { showIf: "has_eu_family_member === yes" }, validation_rules: { maxLength: 50, block_group: "eu_family" } },
  { field_name: "eu_family_date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 4, conditional_logic: { showIf: "has_eu_family_member === yes" }, validation_rules: { format: "DD/MM/YYYY", block_group: "eu_family" } },
  { field_name: "eu_family_nationality", label: "Nationality", field_type: "country", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 5, conditional_logic: { showIf: "has_eu_family_member === yes" }, validation_rules: { source: "ISO3166-1", block_group: "eu_family" } },
  { field_name: "eu_family_travel_document_type", label: "Type of travel document or ID card", field_type: "select", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 6, conditional_logic: { showIf: "has_eu_family_member === yes" }, options: [
    { value: "passport", text: "Passport" },
    { value: "id_card", text: "National identity card" },
  ], validation_rules: { block_group: "eu_family" } },
  { field_name: "eu_family_travel_document_number", label: "Travel document / ID card number", field_type: "text", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 7, conditional_logic: { showIf: "has_eu_family_member === yes" }, validation_rules: { maxLength: 20, block_group: "eu_family" } },
  { field_name: "eu_family_relationship", label: "Family relationship", field_type: "select", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 8, conditional_logic: { showIf: "has_eu_family_member === yes" }, options: [
    { value: "spouse", text: "Spouse" },
    { value: "registered_partner", text: "Registered partner" },
    { value: "child", text: "Child" },
    { value: "grandchild", text: "Grandchild" },
    { value: "dependent_ascendant", text: "Dependent ascendant (parent, grandparent)" },
    { value: "other_dependent", text: "Other dependent relative" },
  ], validation_rules: { block_group: "eu_family" } },
  // Directive 2004/38/EC fast-track acknowledgment — fee waiver, expedited
  // processing (15 days max), reduced documentary evidence. Closes gap
  // report §3.7 at the schema level.
  { field_name: "directive_2004_38_acknowledged", label: "As a family member of an EU/EEA/CH citizen or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement, your application is processed under Directive 2004/38/EC: the visa fee is waived, processing must be completed within 15 calendar days, and fewer supporting documents are required. I acknowledge these rights.", field_type: "radio", required: true, step_number: 4, step_name: "EU/EEA/CH Family Member", display_order: 9, conditional_logic: { showIf: "has_eu_family_member === yes" }, options: YES_NO },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Contact Details & Residence (Annex I fields 19–20)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "home_address_line_1", label: "Home address — line 1", field_type: "text", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 1, validation_rules: { maxLength: 100, block_group: "home_address" } },
  { field_name: "home_address_line_2", label: "Home address — line 2", field_type: "text", required: false, step_number: 5, step_name: "Contact Details & Residence", display_order: 2, validation_rules: { maxLength: 100, block_group: "home_address" } },
  { field_name: "home_address_city", label: "Town or city", field_type: "text", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 3, validation_rules: { maxLength: 60, block_group: "home_address" } },
  { field_name: "home_address_postcode", label: "Postcode / ZIP code", field_type: "text", required: false, step_number: 5, step_name: "Contact Details & Residence", display_order: 4, validation_rules: { maxLength: 15, block_group: "home_address" } },
  { field_name: "home_address_country", label: "Country", field_type: "country", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 5, validation_rules: { source: "ISO3166-1", block_group: "home_address" } },
  { field_name: "email_address", label: "E-mail address", field_type: "text", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 6, placeholder: "e.g., name@example.com", validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },
  { field_name: "phone_number", label: "Telephone number (including country code)", field_type: "text", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 7, placeholder: "e.g., +1 415 555 0199", validation_rules: { maxLength: 20 } },
  { field_name: "residence_country_different", label: "Do you reside in a country other than your country of current nationality?", field_type: "radio", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 8, options: YES_NO },
  { field_name: "residence_country", label: "Country of residence", field_type: "country", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 9, conditional_logic: { showIf: "residence_country_different === yes" }, validation_rules: { source: "ISO3166-1" } },
  { field_name: "residence_permit_number", label: "Residence permit or equivalent number", field_type: "text", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 10, conditional_logic: { showIf: "residence_country_different === yes" }, validation_rules: { maxLength: 30 } },
  { field_name: "residence_permit_expiry_date", label: "Residence permit valid until", field_type: "date", required: true, step_number: 5, step_name: "Contact Details & Residence", display_order: 11, conditional_logic: { showIf: "residence_country_different === yes" }, validation_rules: { format: "DD/MM/YYYY" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Occupation (Annex I fields 21–22)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "current_occupation", label: "Current occupation", field_type: "text", required: true, step_number: 6, step_name: "Occupation", display_order: 1, placeholder: "e.g., Software engineer", validation_rules: { maxLength: 80 } },
  { field_name: "is_student", label: "Are you a student?", field_type: "radio", required: true, step_number: 6, step_name: "Occupation", display_order: 2, options: YES_NO },
  { field_name: "employer_name", label: "Employer name", field_type: "text", required: true, step_number: 6, step_name: "Occupation", display_order: 3, conditional_logic: { showIf: "is_student === no" }, validation_rules: { maxLength: 80, block_group: "employer" } },
  { field_name: "employer_address_line_1", label: "Employer address — line 1", field_type: "text", required: true, step_number: 6, step_name: "Occupation", display_order: 4, conditional_logic: { showIf: "is_student === no" }, validation_rules: { maxLength: 100, block_group: "employer" } },
  { field_name: "employer_city", label: "Employer city", field_type: "text", required: true, step_number: 6, step_name: "Occupation", display_order: 5, conditional_logic: { showIf: "is_student === no" }, validation_rules: { maxLength: 60, block_group: "employer" } },
  { field_name: "employer_country", label: "Employer country", field_type: "country", required: true, step_number: 6, step_name: "Occupation", display_order: 6, conditional_logic: { showIf: "is_student === no" }, validation_rules: { source: "ISO3166-1", block_group: "employer" } },
  { field_name: "employer_phone", label: "Employer telephone number", field_type: "text", required: true, step_number: 6, step_name: "Occupation", display_order: 7, conditional_logic: { showIf: "is_student === no" }, validation_rules: { maxLength: 20, block_group: "employer" } },
  { field_name: "school_name", label: "Name of educational establishment", field_type: "text", required: true, step_number: 6, step_name: "Occupation", display_order: 8, conditional_logic: { showIf: "is_student === yes" }, validation_rules: { maxLength: 100, block_group: "school" } },
  { field_name: "school_address", label: "Address of educational establishment", field_type: "text", required: true, step_number: 6, step_name: "Occupation", display_order: 9, conditional_logic: { showIf: "is_student === yes" }, validation_rules: { maxLength: 200, block_group: "school" } },
  { field_name: "school_phone", label: "Telephone number of educational establishment", field_type: "text", required: false, step_number: 6, step_name: "Occupation", display_order: 10, conditional_logic: { showIf: "is_student === yes" }, validation_rules: { maxLength: 20, block_group: "school" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: Trip Details (Annex I fields 23–28, 32–33)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "purpose_of_journey", label: "Main purpose of the journey", field_type: "select", required: true, step_number: 7, step_name: "Trip Details", display_order: 1, options: [
    { value: "tourism", text: "Tourism" },
    { value: "business", text: "Business" },
    { value: "visiting_family_friends", text: "Visiting family or friends" },
    { value: "cultural", text: "Cultural" },
    { value: "sports", text: "Sports" },
    { value: "official_visit", text: "Official visit" },
    { value: "medical", text: "Medical reasons" },
    { value: "study", text: "Study" },
    { value: "airport_transit", text: "Airport transit" },
    { value: "other", text: "Other" },
  ] },
  { field_name: "purpose_additional_info", label: "Additional information on the purpose of stay", field_type: "textarea", required: false, step_number: 7, step_name: "Trip Details", display_order: 2, validation_rules: { maxLength: 500 } },
  { field_name: "main_destination_country", label: "Member State of main destination", field_type: "country", required: true, step_number: 7, step_name: "Trip Details", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "first_entry_country", label: "Member State of first entry", field_type: "country", required: true, step_number: 7, step_name: "Trip Details", display_order: 4, validation_rules: { source: "ISO3166-1" } },
  { field_name: "number_of_entries_requested", label: "Number of entries requested", field_type: "select", required: true, step_number: 7, step_name: "Trip Details", display_order: 5, options: [
    { value: "single", text: "Single entry" },
    { value: "two", text: "Two entries" },
    { value: "multiple", text: "Multiple entries" },
  ] },
  { field_name: "intended_duration_days", label: "Duration of the intended stay or transit (number of days)", field_type: "text", required: true, step_number: 7, step_name: "Trip Details", display_order: 6, placeholder: "e.g., 14", validation_rules: { pattern: "^[0-9]{1,3}$" } },
  { field_name: "intended_arrival_date", label: "Intended date of arrival in the Schengen Area", field_type: "date", required: true, step_number: 7, step_name: "Trip Details", display_order: 7, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },
  { field_name: "intended_departure_date", label: "Intended date of departure from the Schengen Area", field_type: "date", required: true, step_number: 7, step_name: "Trip Details", display_order: 8, validation_rules: { format: "DD/MM/YYYY", inline_group: "trip_dates" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: Purpose-Specific Details (Annex I fields 24, 34–35 by purpose)
  // ═══════════════════════════════════════════════════════════════════════════

  // Visiting family or friends (Annex I field 34 — inviting person)
  { field_name: "host_surname", label: "Host's surname", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 1, conditional_logic: { showIf: IS_VISIT }, validation_rules: { maxLength: 50, block_group: "host_details" } },
  { field_name: "host_given_names", label: "Host's first name(s)", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 2, conditional_logic: { showIf: IS_VISIT }, validation_rules: { maxLength: 50, block_group: "host_details" } },
  { field_name: "host_relationship", label: "Relationship to the host", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 3, conditional_logic: { showIf: IS_VISIT }, placeholder: "e.g., Friend, Sibling, Parent", validation_rules: { maxLength: 40, block_group: "host_details" } },
  { field_name: "host_address_line_1", label: "Host's address — line 1", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 4, conditional_logic: { showIf: IS_VISIT }, validation_rules: { maxLength: 100, block_group: "host_details" } },
  { field_name: "host_city", label: "Host's city", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 5, conditional_logic: { showIf: IS_VISIT }, validation_rules: { maxLength: 60, block_group: "host_details" } },
  { field_name: "host_country", label: "Host's country (Schengen Member State)", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 6, conditional_logic: { showIf: IS_VISIT }, validation_rules: { source: "ISO3166-1", block_group: "host_details" } },
  { field_name: "host_phone", label: "Host's telephone number", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 7, conditional_logic: { showIf: IS_VISIT }, validation_rules: { maxLength: 20, block_group: "host_details" } },
  { field_name: "host_email", label: "Host's e-mail address", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 8, conditional_logic: { showIf: IS_VISIT }, validation_rules: { maxLength: 100, block_group: "host_details" } },
  { field_name: "host_nationality", label: "Host's nationality", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 9, conditional_logic: { showIf: IS_VISIT }, validation_rules: { source: "ISO3166-1", block_group: "host_details" } },
  { field_name: "host_legal_status_schengen", label: "Host's legal status in the Schengen Area", field_type: "select", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 10, conditional_logic: { showIf: IS_VISIT }, options: [
    { value: "citizen", text: "EU/EEA/CH citizen" },
    { value: "permanent_resident", text: "Permanent resident / long-term resident" },
    { value: "temporary_resident", text: "Temporary resident / residence permit holder" },
    { value: "other", text: "Other" },
  ], validation_rules: { block_group: "host_details" } },

  // Business (Annex I field 35 — inviting company/organisation)
  { field_name: "business_company_name", label: "Inviting company / organisation name", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 11, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 100, block_group: "business_details" } },
  { field_name: "business_company_address_line_1", label: "Company address — line 1", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 12, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 100, block_group: "business_details" } },
  { field_name: "business_company_city", label: "Company city", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 13, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 60, block_group: "business_details" } },
  { field_name: "business_company_country", label: "Company country (Schengen Member State)", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 14, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { source: "ISO3166-1", block_group: "business_details" } },
  { field_name: "business_company_phone", label: "Company telephone number", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 15, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 20, block_group: "business_details" } },
  { field_name: "business_contact_surname", label: "Company contact surname", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 16, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 50, block_group: "business_details" } },
  { field_name: "business_contact_given_names", label: "Company contact first name(s)", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 17, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 50, block_group: "business_details" } },
  { field_name: "business_contact_email", label: "Company contact e-mail", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 18, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "business_details" } },
  { field_name: "business_contact_address", label: "Company contact address", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 19, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 200, block_group: "business_details" } },
  { field_name: "business_contact_phone", label: "Company contact telephone number", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 20, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 20, block_group: "business_details" } },
  { field_name: "business_invitation_letter_held", label: "Do you have a formal invitation letter from the company?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 21, conditional_logic: { showIf: IS_BUSINESS }, options: YES_NO },

  // Study (short-term, <90 days — longer courses need a national Type D visa)
  { field_name: "study_institution_name", label: "Name of the educational institution", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 22, conditional_logic: { showIf: IS_STUDY }, validation_rules: { maxLength: 100, block_group: "study_details" } },
  { field_name: "study_institution_address", label: "Institution address", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 23, conditional_logic: { showIf: IS_STUDY }, validation_rules: { maxLength: 200, block_group: "study_details" } },
  { field_name: "study_institution_country", label: "Institution country (Schengen Member State)", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 24, conditional_logic: { showIf: IS_STUDY }, validation_rules: { source: "ISO3166-1", block_group: "study_details" } },
  { field_name: "study_course_name", label: "Course or programme name", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 25, conditional_logic: { showIf: IS_STUDY }, validation_rules: { maxLength: 100, block_group: "study_details" } },
  { field_name: "study_course_start_date", label: "Course start date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 26, conditional_logic: { showIf: IS_STUDY }, validation_rules: { format: "DD/MM/YYYY", block_group: "study_details" } },
  { field_name: "study_course_duration", label: "Course duration", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 27, conditional_logic: { showIf: IS_STUDY }, placeholder: "e.g., 6 weeks", validation_rules: { maxLength: 40, block_group: "study_details" } },
  { field_name: "study_acceptance_letter_held", label: "Do you have an acceptance letter from the institution?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 28, conditional_logic: { showIf: IS_STUDY }, options: YES_NO },

  // Medical
  { field_name: "medical_facility_name", label: "Name of the hospital or clinic", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 29, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 100, block_group: "medical_details" } },
  { field_name: "medical_facility_address", label: "Hospital or clinic address", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 30, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { maxLength: 200, block_group: "medical_details" } },
  { field_name: "medical_facility_country", label: "Hospital or clinic country (Schengen Member State)", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 31, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { source: "ISO3166-1", block_group: "medical_details" } },
  { field_name: "medical_treatment_type", label: "Type of treatment", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 32, conditional_logic: { showIf: IS_MEDICAL }, placeholder: "e.g., Cardiology consultation", validation_rules: { maxLength: 200, block_group: "medical_details" } },
  { field_name: "medical_treatment_start_date", label: "Treatment start date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 33, conditional_logic: { showIf: IS_MEDICAL }, validation_rules: { format: "DD/MM/YYYY", block_group: "medical_details" } },
  { field_name: "medical_treatment_duration", label: "Treatment duration", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 34, conditional_logic: { showIf: IS_MEDICAL }, placeholder: "e.g., 10 days", validation_rules: { maxLength: 40, block_group: "medical_details" } },
  { field_name: "medical_costs_prepaid", label: "Have treatment costs been prepaid or confirmed by the facility?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 35, conditional_logic: { showIf: IS_MEDICAL }, options: YES_NO },

  // Cultural, Sports, Official visit — shared event/invitation fields
  { field_name: "event_name", label: "Name of the event", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 36, conditional_logic: { showIf: IS_EVENT }, validation_rules: { maxLength: 120, block_group: "event_details" } },
  { field_name: "event_organizer", label: "Event organiser", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 37, conditional_logic: { showIf: IS_EVENT }, validation_rules: { maxLength: 120, block_group: "event_details" } },
  { field_name: "event_location", label: "Event location (city and venue)", field_type: "text", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 38, conditional_logic: { showIf: IS_EVENT }, validation_rules: { maxLength: 150, block_group: "event_details" } },
  { field_name: "event_country", label: "Event country (Schengen Member State)", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 39, conditional_logic: { showIf: IS_EVENT }, validation_rules: { source: "ISO3166-1", block_group: "event_details" } },
  { field_name: "event_start_date", label: "Event start date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 40, conditional_logic: { showIf: IS_EVENT }, validation_rules: { format: "DD/MM/YYYY", inline_group: "event_dates", block_group: "event_details" } },
  { field_name: "event_end_date", label: "Event end date", field_type: "date", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 41, conditional_logic: { showIf: IS_EVENT }, validation_rules: { format: "DD/MM/YYYY", inline_group: "event_dates", block_group: "event_details" } },
  { field_name: "event_invitation_letter_held", label: "Do you have an invitation letter from the organiser?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 42, conditional_logic: { showIf: IS_EVENT }, options: YES_NO },

  // Airport transit
  { field_name: "transit_destination_country", label: "Final destination country (outside Schengen)", field_type: "country", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 43, conditional_logic: { showIf: IS_TRANSIT }, validation_rules: { source: "ISO3166-1" } },
  { field_name: "transit_onward_ticket_held", label: "Do you hold a confirmed onward flight ticket?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 44, conditional_logic: { showIf: IS_TRANSIT }, options: YES_NO },
  { field_name: "transit_destination_visa_held", label: "Do you hold an entry visa for the final destination (if required)?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 45, conditional_logic: { showIf: IS_TRANSIT }, options: YES_NO },

  // Other purpose
  { field_name: "other_purpose_explain", label: "Please describe the purpose of your journey", field_type: "textarea", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 46, conditional_logic: { showIf: IS_OTHER }, validation_rules: { maxLength: 1000 } },

  // Tourism-specific (optional planned itinerary)
  { field_name: "tourism_itinerary_summary", label: "Brief summary of your planned itinerary", field_type: "textarea", required: false, step_number: 8, step_name: "Purpose-Specific Details", display_order: 47, conditional_logic: { showIf: IS_TOURISM }, validation_rules: { maxLength: 1000 } },

  // Annex IV — ATV-specific acknowledgment for nationals on the common list,
  // shown only when purpose is airport_transit AND nationality is on Annex IV.
  // Uses the `in` operator + `&&` + cross-step gating on current_nationality.
  { field_name: "atv_airside_only", label: "Will you remain in the international transit area of the Schengen airport(s) without passing through immigration?", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 48, conditional_logic: { showIf: IS_ATV_NATIONAL }, options: YES_NO },
  { field_name: "atv_annex_iv_acknowledged", label: "I acknowledge that Annex IV of the Visa Code requires holders of my nationality to hold an Airport Transit Visa (Type A) for airside-only transit through Schengen airports.", field_type: "radio", required: true, step_number: 8, step_name: "Purpose-Specific Details", display_order: 49, conditional_logic: { showIf: IS_ATV_NATIONAL }, options: YES_NO },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 9: Accommodation in Schengen (Annex I field 34 — hotel / temporary)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "accommodation_type", label: "Type of accommodation in the Schengen Area", field_type: "select", required: true, step_number: 9, step_name: "Accommodation in Schengen", display_order: 1, options: [
    { value: "hotel", text: "Hotel or other commercial accommodation" },
    { value: "private_host", text: "With inviting person (already declared in host details)" },
    { value: "rented", text: "Rented accommodation (short-let / Airbnb / apartment)" },
    { value: "other", text: "Other" },
  ] },
  { field_name: "accommodation_name", label: "Hotel name or accommodation label", field_type: "text", required: true, step_number: 9, step_name: "Accommodation in Schengen", display_order: 2, conditional_logic: { showIf: "accommodation_type === hotel || accommodation_type === rented" }, validation_rules: { maxLength: 100, block_group: "accommodation_address" } },
  { field_name: "accommodation_address_line_1", label: "Accommodation address — line 1", field_type: "text", required: true, step_number: 9, step_name: "Accommodation in Schengen", display_order: 3, conditional_logic: { showIf: "accommodation_type === hotel || accommodation_type === rented" }, validation_rules: { maxLength: 100, block_group: "accommodation_address" } },
  { field_name: "accommodation_city", label: "City", field_type: "text", required: true, step_number: 9, step_name: "Accommodation in Schengen", display_order: 4, conditional_logic: { showIf: "accommodation_type === hotel || accommodation_type === rented" }, validation_rules: { maxLength: 60, block_group: "accommodation_address" } },
  { field_name: "accommodation_country", label: "Country (Schengen Member State)", field_type: "country", required: true, step_number: 9, step_name: "Accommodation in Schengen", display_order: 5, conditional_logic: { showIf: "accommodation_type === hotel || accommodation_type === rented" }, validation_rules: { source: "ISO3166-1", block_group: "accommodation_address" } },
  { field_name: "accommodation_phone", label: "Accommodation telephone number", field_type: "text", required: false, step_number: 9, step_name: "Accommodation in Schengen", display_order: 6, conditional_logic: { showIf: "accommodation_type === hotel || accommodation_type === rented" }, validation_rules: { maxLength: 20, block_group: "accommodation_address" } },
  { field_name: "accommodation_email", label: "Accommodation e-mail address", field_type: "text", required: false, step_number: 9, step_name: "Accommodation in Schengen", display_order: 7, conditional_logic: { showIf: "accommodation_type === hotel || accommodation_type === rented" }, validation_rules: { maxLength: 100, block_group: "accommodation_address" } },
  { field_name: "hotel_confirmation_number", label: "Hotel / booking confirmation number (if available)", field_type: "text", required: false, step_number: 9, step_name: "Accommodation in Schengen", display_order: 8, conditional_logic: { showIf: "accommodation_type === hotel || accommodation_type === rented" }, placeholder: "e.g., CONF-2026-12345", validation_rules: { maxLength: 60, block_group: "accommodation_address" } },
  { field_name: "accommodation_other_explain", label: "Please describe your accommodation arrangements", field_type: "textarea", required: true, step_number: 9, step_name: "Accommodation in Schengen", display_order: 9, conditional_logic: { showIf: "accommodation_type === other" }, validation_rules: { maxLength: 500 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 10: Travel History (Annex I fields 28–29, 2020 consolidation)
  // Note: the 2019/1155 amendment MERGED the pre-2020 field 29 ("Schengen
  // visas issued during the past three years") into field 28 (fingerprints),
  // so only the single prior visa + fingerprint date/number remain.
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "prev_schengen_fingerprints_given", label: "Have your fingerprints been collected previously for the purpose of applying for a Schengen visa?", field_type: "radio", required: true, step_number: 10, step_name: "Travel History", display_order: 1, options: YES_NO },
  { field_name: "prev_fingerprints_date", label: "Date fingerprints were collected (if known)", field_type: "date", required: false, step_number: 10, step_name: "Travel History", display_order: 2, conditional_logic: { showIf: "prev_schengen_fingerprints_given === yes" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "prev_fingerprints_visa_sticker", label: "Number of the visa (if known)", field_type: "text", required: false, step_number: 10, step_name: "Travel History", display_order: 3, conditional_logic: { showIf: "prev_schengen_fingerprints_given === yes" }, validation_rules: { maxLength: 30 } },
  { field_name: "has_entry_permit_final_destination", label: "Do you hold an entry permit for the final country of destination (where applicable)?", field_type: "radio", required: true, step_number: 10, step_name: "Travel History", display_order: 4, options: YES_NO },
  { field_name: "entry_permit_issuing_authority", label: "Entry permit — issued by", field_type: "text", required: true, step_number: 10, step_name: "Travel History", display_order: 5, conditional_logic: { showIf: "has_entry_permit_final_destination === yes" }, validation_rules: { maxLength: 100, block_group: "entry_permit" } },
  { field_name: "entry_permit_valid_from", label: "Entry permit — valid from", field_type: "date", required: true, step_number: 10, step_name: "Travel History", display_order: 6, conditional_logic: { showIf: "has_entry_permit_final_destination === yes" }, validation_rules: { format: "DD/MM/YYYY", inline_group: "entry_permit_dates", block_group: "entry_permit" } },
  { field_name: "entry_permit_valid_until", label: "Entry permit — valid until", field_type: "date", required: true, step_number: 10, step_name: "Travel History", display_order: 7, conditional_logic: { showIf: "has_entry_permit_final_destination === yes" }, validation_rules: { format: "DD/MM/YYYY", inline_group: "entry_permit_dates", block_group: "entry_permit" } },
  { field_name: "ever_refused_schengen_visa", label: "Have you ever been refused a Schengen visa?", field_type: "radio", required: true, step_number: 10, step_name: "Travel History", display_order: 8, options: YES_NO },
  { field_name: "ever_refused_schengen_visa_details", label: "Please provide details of the refusal", field_type: "textarea", required: true, step_number: 10, step_name: "Travel History", display_order: 9, conditional_logic: { showIf: "ever_refused_schengen_visa === yes" }, validation_rules: { maxLength: 500 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 11: Financial Support (Annex I field 36)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "cost_covered_by", label: "Who will cover the cost of travelling and living during your stay?", field_type: "select", required: true, step_number: 11, step_name: "Financial Support", display_order: 1, options: [
    { value: "self", text: "Myself" },
    { value: "sponsor", text: "A sponsor (host, company, organisation, other)" },
    { value: "both", text: "Both myself and a sponsor" },
  ] },

  // Self-funded means of support
  { field_name: "self_means_cash", label: "Self: cash", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 2, conditional_logic: { showIf: COST_SELF }, options: YES_NO },
  { field_name: "self_means_travellers_cheques", label: "Self: traveller's cheques", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 3, conditional_logic: { showIf: COST_SELF }, options: YES_NO },
  { field_name: "self_means_credit_card", label: "Self: credit card", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 4, conditional_logic: { showIf: COST_SELF }, options: YES_NO },
  { field_name: "self_means_prepaid_accommodation", label: "Self: pre-paid accommodation", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 5, conditional_logic: { showIf: COST_SELF }, options: YES_NO },
  { field_name: "self_means_prepaid_transport", label: "Self: pre-paid transport", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 6, conditional_logic: { showIf: COST_SELF }, options: YES_NO },
  { field_name: "self_means_other", label: "Self: other means of support", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 7, conditional_logic: { showIf: COST_SELF }, options: YES_NO },
  { field_name: "self_means_other_explain", label: "Please describe the other means of support", field_type: "text", required: true, step_number: 11, step_name: "Financial Support", display_order: 8, conditional_logic: { showIf: "self_means_other === yes" }, validation_rules: { maxLength: 200 } },

  // Sponsor
  { field_name: "sponsor_type", label: "Type of sponsor", field_type: "select", required: true, step_number: 11, step_name: "Financial Support", display_order: 9, conditional_logic: { showIf: COST_SPONSOR }, options: [
    { value: "host", text: "Host (inviting person)" },
    { value: "company", text: "Company" },
    { value: "organisation", text: "Organisation" },
    { value: "other", text: "Other" },
  ] },
  { field_name: "sponsor_name", label: "Sponsor name", field_type: "text", required: true, step_number: 11, step_name: "Financial Support", display_order: 10, conditional_logic: { showIf: COST_SPONSOR }, validation_rules: { maxLength: 120, block_group: "sponsor_details" } },
  { field_name: "sponsor_relationship", label: "Relationship to sponsor", field_type: "text", required: true, step_number: 11, step_name: "Financial Support", display_order: 11, conditional_logic: { showIf: COST_SPONSOR }, placeholder: "e.g., Employer, Parent, Host", validation_rules: { maxLength: 80, block_group: "sponsor_details" } },
  { field_name: "sponsor_address", label: "Sponsor address", field_type: "text", required: false, step_number: 11, step_name: "Financial Support", display_order: 12, conditional_logic: { showIf: COST_SPONSOR }, validation_rules: { maxLength: 200, block_group: "sponsor_details" } },
  { field_name: "sponsor_means_cash", label: "Sponsor: cash", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 13, conditional_logic: { showIf: COST_SPONSOR }, options: YES_NO },
  { field_name: "sponsor_means_accommodation_provided", label: "Sponsor: accommodation provided", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 14, conditional_logic: { showIf: COST_SPONSOR }, options: YES_NO },
  { field_name: "sponsor_means_all_expenses_covered", label: "Sponsor: all expenses covered during the stay", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 15, conditional_logic: { showIf: COST_SPONSOR }, options: YES_NO },
  { field_name: "sponsor_means_prepaid_transport", label: "Sponsor: pre-paid transport", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 16, conditional_logic: { showIf: COST_SPONSOR }, options: YES_NO },
  { field_name: "sponsor_means_other", label: "Sponsor: other means of support", field_type: "radio", required: true, step_number: 11, step_name: "Financial Support", display_order: 17, conditional_logic: { showIf: COST_SPONSOR }, options: YES_NO },
  { field_name: "sponsor_means_other_explain", label: "Please describe the other sponsor means of support", field_type: "text", required: true, step_number: 11, step_name: "Financial Support", display_order: 18, conditional_logic: { showIf: "sponsor_means_other === yes" }, validation_rules: { maxLength: 200 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 12: Declaration (Annex I fields 33 + 37 — 2020 consolidation)
  // Field 33: person filling in the application form (if different from applicant)
  // Field 37: place/date, signature, and the six consents on the last page.
  // ═══════════════════════════════════════════════════════════════════════════

  // Field 33 — person filling in the application form
  { field_name: "has_different_filler", label: "Is the application being filled in by someone other than the applicant?", field_type: "radio", required: true, step_number: 12, step_name: "Declaration", display_order: 1, options: YES_NO },
  { field_name: "filler_surname", label: "Surname of the person filling in the application form", field_type: "text", required: true, step_number: 12, step_name: "Declaration", display_order: 2, conditional_logic: { showIf: "has_different_filler === yes" }, validation_rules: { maxLength: 50, block_group: "filler_details" } },
  { field_name: "filler_given_names", label: "First name(s) of the person filling in the application form", field_type: "text", required: true, step_number: 12, step_name: "Declaration", display_order: 3, conditional_logic: { showIf: "has_different_filler === yes" }, validation_rules: { maxLength: 50, block_group: "filler_details" } },
  { field_name: "filler_address", label: "Address of the person filling in the application form", field_type: "text", required: true, step_number: 12, step_name: "Declaration", display_order: 4, conditional_logic: { showIf: "has_different_filler === yes" }, validation_rules: { maxLength: 200, block_group: "filler_details" } },
  { field_name: "filler_email", label: "E-mail address of the person filling in the application form", field_type: "text", required: true, step_number: 12, step_name: "Declaration", display_order: 5, conditional_logic: { showIf: "has_different_filler === yes" }, validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "filler_details" } },
  { field_name: "filler_phone", label: "Telephone number of the person filling in the application form", field_type: "text", required: true, step_number: 12, step_name: "Declaration", display_order: 6, conditional_logic: { showIf: "has_different_filler === yes" }, validation_rules: { maxLength: 20, block_group: "filler_details" } },

  // Field 37 — place, date, signature
  { field_name: "place_of_application", label: "Place of application", field_type: "text", required: true, step_number: 12, step_name: "Declaration", display_order: 7, placeholder: "e.g., New York", validation_rules: { maxLength: 80 } },
  { field_name: "declaration_date", label: "Date of signing", field_type: "date", required: true, step_number: 12, step_name: "Declaration", display_order: 8, validation_rules: { format: "DD/MM/YYYY" } },

  // Field 37 — consents. Annex I requires all six.
  { field_name: "declaration_fee_not_refunded_awareness", label: "I am aware that the visa fee is not refunded if the visa is refused.", field_type: "radio", required: true, step_number: 12, step_name: "Declaration", display_order: 9, options: YES_NO },
  { field_name: "declaration_insurance_multi_entry_awareness", label: "Applicable if a multiple-entry visa is issued: I am aware of the need to have adequate travel medical insurance for my first stay and any subsequent visits to the territory of Member States.", field_type: "radio", required: true, step_number: 12, step_name: "Declaration", display_order: 10, conditional_logic: { showIf: "number_of_entries_requested === multiple" }, options: YES_NO },
  { field_name: "declaration_vis_consent", label: "I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years.", field_type: "radio", required: true, step_number: 12, step_name: "Declaration", display_order: 11, options: YES_NO },
  { field_name: "declaration_data_rights_awareness", label: "I am aware that I have the right to obtain, in any of the Member States, notification of the data relating to me recorded in the VIS and of the Member State which transmitted the data, and to request that data relating to me which are inaccurate be corrected and that data relating to me processed unlawfully be deleted.", field_type: "radio", required: true, step_number: 12, step_name: "Declaration", display_order: 12, options: YES_NO },
  { field_name: "declaration_truthfulness", label: "I declare that to the best of my knowledge all particulars supplied by me are correct and complete.", field_type: "radio", required: true, step_number: 12, step_name: "Declaration", display_order: 13, options: YES_NO },
  { field_name: "declaration_awareness_refusal", label: "I am aware that any false statement will lead to my application being rejected or to the annulment of a visa already granted and may render me liable to prosecution under the law of the Member State which deals with the application.", field_type: "radio", required: true, step_number: 12, step_name: "Declaration", display_order: 14, options: YES_NO },
  { field_name: "declaration_undertaking_to_leave", label: "I undertake to leave the territory of the Member States before the expiry of the visa, if granted. I have been informed that possession of a visa is only one of the prerequisites for entry into the European territory of the Member States.", field_type: "radio", required: true, step_number: 12, step_name: "Declaration", display_order: 15, options: YES_NO },

  { field_name: "additional_information", label: "Is there anything else you would like to tell us about your application?", field_type: "textarea", required: false, step_number: 12, step_name: "Declaration", display_order: 16, validation_rules: { maxLength: 2000 } },
];

// ─── Annex I starred fields (EU-UK Withdrawal Agreement exemption) ─────────
// Fields 21, 22, 30, 31, 32 on Annex I are marked with * — applicants who
// are beneficiaries of the EU-UK Withdrawal Agreement (via family member of
// an EU/EEA/CH citizen or UK national) may leave them blank. We express the
// exemption via `required_unless: "has_eu_family_member === yes"` so the
// DynamicStepForm's required-validation path skips the check for beneficiaries
// while the field still renders.
const STARRED_FIELD_NAMES = new Set<string>([
  // Field 21: Current occupation
  "current_occupation",
  // Field 22: Employer / educational establishment
  "employer_name", "employer_address_line_1", "employer_city", "employer_country", "employer_phone",
  "school_name", "school_address",
  // Field 30: Inviting person(s) or hotel(s) / temporary accommodation
  "host_surname", "host_given_names", "host_relationship",
  "host_address_line_1", "host_city", "host_country",
  "host_phone", "host_email", "host_nationality", "host_legal_status_schengen",
  "accommodation_type", "accommodation_name", "accommodation_address_line_1",
  "accommodation_city", "accommodation_country", "accommodation_other_explain",
  // Field 31: Inviting company / organisation
  "business_company_name", "business_company_address_line_1", "business_company_city",
  "business_company_country", "business_company_phone",
  "business_contact_surname", "business_contact_given_names", "business_contact_email",
  "business_contact_address", "business_contact_phone", "business_invitation_letter_held",
  // Field 32: Cost of travelling and means of support
  "cost_covered_by",
  "self_means_cash", "self_means_travellers_cheques", "self_means_credit_card",
  "self_means_prepaid_accommodation", "self_means_prepaid_transport", "self_means_other",
  "sponsor_type", "sponsor_name", "sponsor_relationship",
  "sponsor_means_cash", "sponsor_means_accommodation_provided",
  "sponsor_means_all_expenses_covered", "sponsor_means_prepaid_transport", "sponsor_means_other",
]);

for (const f of FIELDS) {
  if (STARRED_FIELD_NAMES.has(f.field_name)) {
    f.validation_rules = {
      ...(f.validation_rules ?? {}),
      required_unless: "has_eu_family_member === yes",
    };
  }
}

// ─── Seed Runner ────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);

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
