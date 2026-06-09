/**
 * Seed script: visa_form_fields for Australia Visitor Visa (Subclass 600).
 * Field definitions reconstructed from public Department of Home Affairs
 * sources (Forms 1419, 1418, 1149; immi.homeaffairs.gov.au "Visitor visa
 * (subclass 600)" guidance; Migration Regulations 1994 Schedule 2 cl.600).
 *
 * Scope: Full Subclass 600 umbrella — 5 streams (Tourist, Business Visitor,
 * Sponsored Family, Approved Destination Status, Frequent Traveller).
 * Each stream has its own conditional sub-journey fields in Step 9.
 *
 * NOT YET QA'd against the live ImmiAccount online application — the
 * portal is behind ImmiAccount authentication and cannot be driven by
 * automated tools without a real applicant identity. See
 * docs/au-visa-scope.md and docs/au-visa-gap-report.md for source list
 * and known limitations.
 *
 * Run: npx tsx scripts/seed-au-visitor-600-form-fields.ts
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

const VISA_TYPE = "AU_VISITOR_600";

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

// Stream showIf expressions (reused across sub-journey fields).
const IS_TOURIST = "stream === tourist";
const IS_BUSINESS = "stream === business_visitor";
const IS_SPONSORED = "stream === sponsored_family";
const IS_FREQUENT = "stream === frequent_traveller";
// IS_ADS removed: ADS stream not offered on the universal VSS-AP-600
// form per live walk (2026-04-27). ADS fields kept in the schema
// behind a never-true gate so historical answers don't break, but new
// applicants cannot select the stream.
const IS_ADS = "stream === ads_unavailable_in_universal_form";

// Stream options match the live ImmiAccount VSS-AP-600 form (4 streams,
// alphabetical order). ADS is NOT offered on this universal form — it
// is reached via a separate "Subclass 600 ADS group tour" entry that
// will require its own visa_type / package once scoped.
const STREAM_OPTIONS = [
  { value: "business_visitor", text: "Business Visitor stream (business visit for meetings, conferences or negotiations but not for work)" },
  { value: "frequent_traveller", text: "Frequent Traveller stream (tourism or business purposes)" },
  { value: "sponsored_family", text: "Sponsored Family stream (requires Sponsorship form 1149)" },
  { value: "tourist", text: "Tourist stream (tourism/visit family or friends)" },
];

const RELATIONSHIP_STATUS = [
  { value: "never_married", text: "Never married or never in a de facto relationship" },
  { value: "married", text: "Married" },
  { value: "de_facto", text: "De facto" },
  { value: "engaged", text: "Engaged" },
  { value: "separated", text: "Legally separated" },
  { value: "divorced", text: "Divorced" },
  { value: "widowed", text: "Widowed" },
];

const SEX = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
  { value: "indeterminate", text: "Indeterminate / Intersex / Unspecified" },
];

const PASSPORT_TYPE = [
  { value: "ordinary", text: "Ordinary / Regular" },
  { value: "diplomatic", text: "Diplomatic" },
  { value: "official", text: "Official" },
  { value: "service", text: "Service" },
  { value: "emergency", text: "Emergency / Travel document" },
  { value: "other", text: "Other" },
];

const FIELDS: FieldDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 0: ImmiAccount credentials (collected so submission-service can
  // log in, satisfy TOTP MFA, and resume / open the Subclass 600 draft).
  //
  // Subclass 600 must be lodged by the applicant in person — VIZA stops
  // the runner at the Review page, so submission-service only ever needs
  // these credentials to *prepare* the application, never to submit it.
  // The runner lazy-upserts these into au_accounts on first poll; once
  // that row exists subsequent runs read it directly and ignore answer
  // overrides.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    field_name: "au_immi_username",
    label: "ImmiAccount username (email)",
    field_type: "text",
    required: true,
    step_number: 0,
    step_name: "ImmiAccount",
    display_order: 1,
    placeholder: "Same email you registered on online.immi.gov.au",
    validation_rules: {
      maxLength: 100,
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    },
  },
  {
    field_name: "au_immi_password",
    label: "ImmiAccount password",
    field_type: "password",
    required: true,
    step_number: 0,
    step_name: "ImmiAccount",
    display_order: 2,
    placeholder: "The password you set during ImmiAccount registration",
    validation_rules: {
      maxLength: 200,
      sensitive: true,
      // Encrypted via SUBMISSION_RESULT_SECRET_KEY (AES-GCM) before write
      // to au_accounts.password_encrypted; decrypted at runtime.
    },
  },
  {
    field_name: "au_immi_totp_secret",
    label: "ImmiAccount authenticator secret (base32)",
    field_type: "text",
    required: false,
    step_number: 0,
    step_name: "ImmiAccount",
    display_order: 3,
    placeholder: "JBSWY3DPEHPK3PXP — the seed your authenticator app shows during MFA setup",
    validation_rules: {
      maxLength: 64,
      pattern: "^[A-Z2-7 ]+$",
      sensitive: true,
      // Without this the runner cannot answer the MFA prompt and the
      // submission will mark `au_blocked` until the applicant supplies it.
    },
  },
  {
    field_name: "au_resume_trn",
    label: "Existing draft TRN (optional)",
    field_type: "text",
    required: false,
    step_number: 0,
    step_name: "ImmiAccount",
    display_order: 4,
    placeholder: "Leave blank to start a fresh application",
    validation_rules: {
      maxLength: 30,
      pattern: "^[A-Z0-9]{4,30}$",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Application Context (matches live page 2 of VSS-AP-600).
  // Verified against ImmiAccount on 2026-04-27. Field names track the
  // live form's question order so the submission service can map 1:1.
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "stream", label: "Select the stream the applicant is applying for", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 1, options: STREAM_OPTIONS, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a3i1b0" } },
  { field_name: "applying_outside_australia", label: "Is the applicant currently outside Australia?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 2, options: YES_NO, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a2c1b0" } },
  { field_name: "applying_all_outside_australia", label: "Are all the applicants currently outside Australia?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 3, options: YES_NO, conditional_logic: { showIf: "applying_outside_australia === yes" }, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a2d1b0a" } },
  { field_name: "current_location_country", label: "Current location", field_type: "country", required: true, step_number: 1, step_name: "Application Context", display_order: 4, validation_rules: { source: "ISO3166-1", live_dom_id: "_2a0b0a0a0e0a0a1a2e3a1a" } },
  { field_name: "current_location_legal_status", label: "Current location legal status", field_type: "select", required: true, step_number: 1, step_name: "Application Context", display_order: 5, options: [{ value: "citizen", text: "Citizen" }, { value: "permanent_resident", text: "Permanent Resident" }, { value: "visitor", text: "Visitor" }, { value: "student", text: "Student" }, { value: "work_visa", text: "Work Visa" }, { value: "no_legal_status", text: "No Legal Status" }, { value: "other", text: "Other" }], validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a2e4a1a" } },
  { field_name: "purpose_of_stay_initial", label: "Select the applicant's initial purpose of stay", field_type: "select", required: true, step_number: 1, step_name: "Application Context", display_order: 6, options: [{ value: "business", text: "Business" }, { value: "tourism", text: "Tourism" }, { value: "family_visit", text: "Family visit" }, { value: "study", text: "Study" }, { value: "religious_event", text: "Religious event" }, { value: "other", text: "Other" }], validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a3bc0b0a" } },
  { field_name: "significant_dates_in_australia", label: "Give details of any significant dates on which the applicant needs to be in Australia", field_type: "textarea", required: false, step_number: 1, step_name: "Application Context", display_order: 7, validation_rules: { maxLength: 500, live_dom_id: "_2a0b0a0a0e0a0a1a3bd1b0" } },
  { field_name: "event_invited_by_organisation", label: "Has the applicant been invited to participate in specific event(s) by organisation(s) in Australia?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 8, options: YES_NO, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a3c1b0" } },
  { field_name: "event_paid_by_australian_organisation", label: "Will the applicant receive a payment from an organisation in Australia for their participation in the event?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 9, options: YES_NO, conditional_logic: { showIf: "event_invited_by_organisation === yes" }, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a3d1b0" } },
  { field_name: "specialised_non_ongoing_work", label: "Will the applicant undertake highly specialised non-ongoing work?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 10, options: YES_NO, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a3e1b0" } },
  { field_name: "entertainer_or_supporting_entertainer", label: "Will the applicant be performing as an entertainer in Australia or supporting an entertainer or group of entertainers performing in Australia?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 11, options: YES_NO, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a3f1b0" } },
  { field_name: "production_director_or_participant", label: "Will the applicant be directing, producing or taking any other part in a production that will be shown in Australia (including theatre, film, television, radio, concert or recording)?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 12, options: YES_NO, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a3g1b0" } },
  { field_name: "applying_as_part_of_group_of_applications", label: "Is this application being lodged as part of a group of applications?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 13, options: YES_NO, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a4c1b0" } },
  { field_name: "representative_of_foreign_government_or_un", label: "Is the applicant travelling as a representative of a foreign government, travelling on a United Nations Laissez-Passer or a member of an exempt group?", field_type: "radio", required: true, step_number: 1, step_name: "Application Context", display_order: 14, options: YES_NO, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a1a7d1b0" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Personal Details
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "family_name", label: "Family name (as shown in your passport)", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 1, placeholder: "e.g., SMITH", validation_rules: { maxLength: 50 } },
  { field_name: "given_names", label: "Given names (as shown in your passport)", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 2, placeholder: "e.g., John Michael", validation_rules: { maxLength: 50 } },
  { field_name: "no_given_names", label: "I do not have given names (only one name on my passport)", field_type: "checkbox", required: false, step_number: 2, step_name: "Personal Details", display_order: 3 },
  { field_name: "has_other_names", label: "Have you ever been known by any other names? (maiden, alias, professional, religious, anglicised)", field_type: "radio", required: true, step_number: 2, step_name: "Personal Details", display_order: 4, options: YES_NO },
  { field_name: "other_name_full", label: "Other name", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 5, placeholder: "Family name and given names", conditional_logic: { showIf: "has_other_names === yes" }, validation_rules: { maxLength: 100, repeatable: true, repeat_group: "other_names", max_items: 5 } },
  { field_name: "other_name_type", label: "Type of other name", field_type: "select", required: true, step_number: 2, step_name: "Personal Details", display_order: 6, conditional_logic: { showIf: "has_other_names === yes" }, options: [{ value: "maiden", text: "Maiden name" }, { value: "previous_married", text: "Previous married name" }, { value: "alias", text: "Alias" }, { value: "professional", text: "Professional name" }, { value: "religious", text: "Religious name" }, { value: "anglicised", text: "Anglicised name" }, { value: "other", text: "Other" }], validation_rules: { repeatable: true, repeat_group: "other_names" } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 2, step_name: "Personal Details", display_order: 7, options: SEX },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 2, step_name: "Personal Details", display_order: 8, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "country_of_birth", label: "Country of birth", field_type: "country", required: true, step_number: 2, step_name: "Personal Details", display_order: 9, validation_rules: { source: "ISO3166-1" } },
  { field_name: "town_of_birth", label: "Town or city of birth", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 10, validation_rules: { maxLength: 60 } },
  { field_name: "state_or_province_of_birth", label: "State or province of birth", field_type: "text", required: false, step_number: 2, step_name: "Personal Details", display_order: 11, validation_rules: { maxLength: 60 } },
  { field_name: "country_of_nationality", label: "Country of passport / current nationality", field_type: "country", required: true, step_number: 2, step_name: "Personal Details", display_order: 12, validation_rules: { source: "ISO3166-1" } },
  { field_name: "has_other_nationalities", label: "Do you hold any other current or previous nationalities or citizenships?", field_type: "radio", required: true, step_number: 2, step_name: "Personal Details", display_order: 13, options: YES_NO },
  { field_name: "other_nationality_country", label: "Other country of nationality / citizenship", field_type: "country", required: true, step_number: 2, step_name: "Personal Details", display_order: 14, conditional_logic: { showIf: "has_other_nationalities === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 5 } },
  { field_name: "other_nationality_status", label: "Is this nationality current or ceased?", field_type: "select", required: true, step_number: 2, step_name: "Personal Details", display_order: 15, conditional_logic: { showIf: "has_other_nationalities === yes" }, options: [{ value: "current", text: "Current" }, { value: "ceased", text: "Ceased / renounced" }], validation_rules: { repeatable: true, repeat_group: "other_nationalities" } },
  { field_name: "country_of_residence", label: "Country in which you usually live", field_type: "country", required: true, step_number: 2, step_name: "Personal Details", display_order: 16, validation_rules: { source: "ISO3166-1" } },
  { field_name: "residency_status", label: "Your residency status in that country", field_type: "select", required: true, step_number: 2, step_name: "Personal Details", display_order: 17, options: [{ value: "citizen", text: "Citizen" }, { value: "permanent_resident", text: "Permanent resident" }, { value: "temporary_resident", text: "Temporary resident" }, { value: "visitor", text: "Visitor" }, { value: "other", text: "Other" }] },
  { field_name: "is_applicant_under_18", label: "Will you be under 18 years of age on the date you plan to travel to Australia?", field_type: "radio", required: true, step_number: 2, step_name: "Personal Details", display_order: 18, options: YES_NO },
  { field_name: "minor_parental_consent_held", label: "Do you have written consent from both parents or legal guardians for this visa application and the planned travel?", field_type: "radio", required: true, step_number: 2, step_name: "Personal Details", display_order: 19, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, options: YES_NO },
  { field_name: "minor_accompanying_adult_full_name", label: "Full name of the adult travelling with you to Australia", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 20, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, validation_rules: { maxLength: 100, block_group: "minor_accompanying_adult" } },
  { field_name: "minor_accompanying_adult_relationship", label: "Relationship to the adult travelling with you", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 21, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, placeholder: "e.g., Parent, Aunt, Legal guardian", validation_rules: { maxLength: 50, block_group: "minor_accompanying_adult" } },
  { field_name: "minor_accompanying_adult_passport_number", label: "Passport number of the accompanying adult", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 22, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, validation_rules: { maxLength: 20, block_group: "minor_accompanying_adult" } },
  { field_name: "minor_australian_carer_arranged", label: "Have arrangements been made for an adult to care for you in Australia?", field_type: "radio", required: true, step_number: 2, step_name: "Personal Details", display_order: 23, conditional_logic: { showIf: "is_applicant_under_18 === yes" }, options: YES_NO },
  { field_name: "minor_australian_carer_full_name", label: "Full name of the adult carer in Australia", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 24, conditional_logic: { showIf: "is_applicant_under_18 === yes && minor_australian_carer_arranged === yes" }, validation_rules: { maxLength: 100, block_group: "minor_australian_carer" } },
  { field_name: "minor_australian_carer_relationship", label: "Relationship to the adult carer", field_type: "text", required: true, step_number: 2, step_name: "Personal Details", display_order: 25, conditional_logic: { showIf: "is_applicant_under_18 === yes && minor_australian_carer_arranged === yes" }, validation_rules: { maxLength: 50, block_group: "minor_australian_carer" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Passport & Travel Document
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "passport_number", label: "Passport number", field_type: "text", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 1, placeholder: "e.g., E12345678", validation_rules: { maxLength: 20 } },
  { field_name: "passport_country_of_issue", label: "Country of issue", field_type: "country", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 2, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_nationality", label: "Nationality as shown in passport", field_type: "country", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 3, validation_rules: { source: "ISO3166-1" } },
  { field_name: "passport_date_of_issue", label: "Date of issue", field_type: "date", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 4, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_date_of_expiry", label: "Date of expiry", field_type: "date", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 5, validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates" } },
  { field_name: "passport_place_of_issue", label: "Place of issue (city or town)", field_type: "text", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 6, validation_rules: { maxLength: 60 } },
  { field_name: "passport_issuing_authority", label: "Issuing authority", field_type: "text", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 7, placeholder: "e.g., DFA Manila", validation_rules: { maxLength: 80 } },
  { field_name: "passport_type", label: "Passport type", field_type: "select", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 8, options: PASSPORT_TYPE },
  { field_name: "name_in_passport_chinese_chars", label: "Name in Chinese / Japanese / Korean characters (if applicable)", field_type: "text", required: false, step_number: 3, step_name: "Passport & Travel Document", display_order: 9, validation_rules: { maxLength: 60 } },
  { field_name: "has_other_travel_documents", label: "Do you hold any other current passports or travel documents?", field_type: "radio", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 10, options: YES_NO },
  { field_name: "other_travel_doc_number", label: "Other travel document number", field_type: "text", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 11, conditional_logic: { showIf: "has_other_travel_documents === yes" }, validation_rules: { maxLength: 20, repeatable: true, repeat_group: "other_travel_docs", max_items: 3 } },
  { field_name: "other_travel_doc_country", label: "Country of issue", field_type: "country", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 12, conditional_logic: { showIf: "has_other_travel_documents === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_travel_docs" } },
  { field_name: "other_travel_doc_expiry", label: "Date of expiry", field_type: "date", required: true, step_number: 3, step_name: "Passport & Travel Document", display_order: 13, conditional_logic: { showIf: "has_other_travel_documents === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "other_travel_docs" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: National Identity Document
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "has_national_id", label: "Do you hold a national identity card?", field_type: "radio", required: true, step_number: 4, step_name: "National Identity Document", display_order: 1, options: YES_NO },
  { field_name: "national_id_number", label: "National identity card number", field_type: "text", required: true, step_number: 4, step_name: "National Identity Document", display_order: 2, conditional_logic: { showIf: "has_national_id === yes" }, validation_rules: { maxLength: 30 } },
  { field_name: "national_id_country", label: "Country of issue", field_type: "country", required: true, step_number: 4, step_name: "National Identity Document", display_order: 3, conditional_logic: { showIf: "has_national_id === yes" }, validation_rules: { source: "ISO3166-1" } },
  { field_name: "national_id_expiry", label: "Date of expiry (if shown on card)", field_type: "date", required: false, step_number: 4, step_name: "National Identity Document", display_order: 4, conditional_logic: { showIf: "has_national_id === yes" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "national_id_reason_for_not_providing", label: "Give the reason the applicant cannot provide details of a national identity card issued by their country of passport.", field_type: "textarea", required: true, step_number: 4, step_name: "National Identity Document", display_order: 5, conditional_logic: { showIf: "has_national_id === no" }, validation_rules: { maxLength: 500, live_dom_id: "_2a0b0a0a0e0a0a2a9f1b0" } },
  { field_name: "has_pacific_australia_card", label: "Is the applicant a Pacific-Australia Card holder?", field_type: "radio", required: true, step_number: 4, step_name: "National Identity Document", display_order: 6, options: YES_NO, validation_rules: { live_dom_id: "_2a0b0a0a0e0a0a2a10d1b0" } },
  { field_name: "chinese_commercial_code_number", label: "Enter name in Chinese Commercial Code number (if used)", field_type: "text", required: false, step_number: 4, step_name: "National Identity Document", display_order: 7, conditional_logic: { showIf: "country_of_nationality === CN" }, validation_rules: { maxLength: 30, live_dom_id: "_2a0b0a0a0e0a0a2a19c0b0a" } },
  { field_name: "has_chinese_household_registration", label: "Do you hold a People's Republic of China household registration (hukou)?", field_type: "radio", required: false, step_number: 4, step_name: "National Identity Document", display_order: 8, options: YES_NO },
  { field_name: "chinese_household_registration_number", label: "Hukou number", field_type: "text", required: true, step_number: 4, step_name: "National Identity Document", display_order: 9, conditional_logic: { showIf: "has_chinese_household_registration === yes" }, validation_rules: { maxLength: 30 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Contact Details
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "residential_address_line_1", label: "Residential address — line 1", field_type: "text", required: true, step_number: 5, step_name: "Contact Details", display_order: 1, validation_rules: { maxLength: 100, block_group: "residential_address" } },
  { field_name: "residential_address_line_2", label: "Residential address — line 2", field_type: "text", required: false, step_number: 5, step_name: "Contact Details", display_order: 2, validation_rules: { maxLength: 100, block_group: "residential_address" } },
  { field_name: "residential_address_suburb", label: "Suburb / town / city", field_type: "text", required: true, step_number: 5, step_name: "Contact Details", display_order: 3, validation_rules: { maxLength: 60, block_group: "residential_address" } },
  { field_name: "residential_address_state", label: "State / province", field_type: "text", required: false, step_number: 5, step_name: "Contact Details", display_order: 4, validation_rules: { maxLength: 60, block_group: "residential_address" } },
  { field_name: "residential_address_postcode", label: "Postcode / ZIP", field_type: "text", required: false, step_number: 5, step_name: "Contact Details", display_order: 5, validation_rules: { maxLength: 15, block_group: "residential_address" } },
  { field_name: "residential_address_country", label: "Country", field_type: "country", required: true, step_number: 5, step_name: "Contact Details", display_order: 6, validation_rules: { source: "ISO3166-1", block_group: "residential_address" } },
  { field_name: "postal_address_same_as_residential", label: "Is your postal address the same as your residential address?", field_type: "radio", required: true, step_number: 5, step_name: "Contact Details", display_order: 7, options: YES_NO },
  { field_name: "postal_address_line_1", label: "Postal address — line 1", field_type: "text", required: true, step_number: 5, step_name: "Contact Details", display_order: 8, conditional_logic: { showIf: "postal_address_same_as_residential === no" }, validation_rules: { maxLength: 100, block_group: "postal_address" } },
  { field_name: "postal_address_line_2", label: "Postal address — line 2", field_type: "text", required: false, step_number: 5, step_name: "Contact Details", display_order: 9, conditional_logic: { showIf: "postal_address_same_as_residential === no" }, validation_rules: { maxLength: 100, block_group: "postal_address" } },
  { field_name: "postal_address_suburb", label: "Suburb / town / city", field_type: "text", required: true, step_number: 5, step_name: "Contact Details", display_order: 10, conditional_logic: { showIf: "postal_address_same_as_residential === no" }, validation_rules: { maxLength: 60, block_group: "postal_address" } },
  { field_name: "postal_address_state", label: "State / province", field_type: "text", required: false, step_number: 5, step_name: "Contact Details", display_order: 11, conditional_logic: { showIf: "postal_address_same_as_residential === no" }, validation_rules: { maxLength: 60, block_group: "postal_address" } },
  { field_name: "postal_address_postcode", label: "Postcode / ZIP", field_type: "text", required: false, step_number: 5, step_name: "Contact Details", display_order: 12, conditional_logic: { showIf: "postal_address_same_as_residential === no" }, validation_rules: { maxLength: 15, block_group: "postal_address" } },
  { field_name: "postal_address_country", label: "Country", field_type: "country", required: true, step_number: 5, step_name: "Contact Details", display_order: 13, conditional_logic: { showIf: "postal_address_same_as_residential === no" }, validation_rules: { source: "ISO3166-1", block_group: "postal_address" } },
  { field_name: "phone_number", label: "Mobile / cell phone number (with country code)", field_type: "text", required: true, step_number: 5, step_name: "Contact Details", display_order: 14, placeholder: "e.g., +63 917 123 4567", validation_rules: { maxLength: 25 } },
  { field_name: "alternative_phone_number", label: "Alternative phone number", field_type: "text", required: false, step_number: 5, step_name: "Contact Details", display_order: 15, validation_rules: { maxLength: 25 } },
  { field_name: "email_address", label: "Email address", field_type: "text", required: true, step_number: 5, step_name: "Contact Details", display_order: 16, placeholder: "e.g., name@example.com", validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Authorised Recipient & Migration Agent
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "uses_migration_agent", label: "Are you using a registered migration agent or legal representative?", field_type: "radio", required: true, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 1, options: YES_NO },
  { field_name: "agent_marn", label: "Migration Agent Registration Number (MARN)", field_type: "text", required: true, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 2, conditional_logic: { showIf: "uses_migration_agent === yes" }, placeholder: "7-digit MARN", validation_rules: { maxLength: 10, block_group: "agent_details" } },
  { field_name: "agent_full_name", label: "Agent full name", field_type: "text", required: true, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 3, conditional_logic: { showIf: "uses_migration_agent === yes" }, validation_rules: { maxLength: 100, block_group: "agent_details" } },
  { field_name: "agent_business_name", label: "Agent business name", field_type: "text", required: false, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 4, conditional_logic: { showIf: "uses_migration_agent === yes" }, validation_rules: { maxLength: 100, block_group: "agent_details" } },
  { field_name: "agent_phone", label: "Agent phone number", field_type: "text", required: true, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 5, conditional_logic: { showIf: "uses_migration_agent === yes" }, validation_rules: { maxLength: 25, block_group: "agent_details" } },
  { field_name: "agent_email", label: "Agent email address", field_type: "text", required: true, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 6, conditional_logic: { showIf: "uses_migration_agent === yes" }, validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "agent_details" } },
  { field_name: "has_authorised_recipient", label: "Do you wish to nominate a different authorised recipient (not the agent above) to receive correspondence?", field_type: "radio", required: true, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 7, options: YES_NO },
  { field_name: "authorised_recipient_full_name", label: "Authorised recipient full name", field_type: "text", required: true, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 8, conditional_logic: { showIf: "has_authorised_recipient === yes" }, validation_rules: { maxLength: 100, block_group: "authorised_recipient" } },
  { field_name: "authorised_recipient_email", label: "Authorised recipient email", field_type: "text", required: true, step_number: 6, step_name: "Authorised Recipient & Migration Agent", display_order: 9, conditional_logic: { showIf: "has_authorised_recipient === yes" }, validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "authorised_recipient" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: Family Composition
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "relationship_status", label: "Current relationship status", field_type: "select", required: true, step_number: 7, step_name: "Family Composition", display_order: 1, options: RELATIONSHIP_STATUS },
  { field_name: "partner_family_name", label: "Partner / spouse family name", field_type: "text", required: true, step_number: 7, step_name: "Family Composition", display_order: 2, conditional_logic: { showIf: "relationship_status === married || relationship_status === de_facto || relationship_status === engaged || relationship_status === separated" }, validation_rules: { maxLength: 50, block_group: "partner_details" } },
  { field_name: "partner_given_names", label: "Partner / spouse given names", field_type: "text", required: true, step_number: 7, step_name: "Family Composition", display_order: 3, conditional_logic: { showIf: "relationship_status === married || relationship_status === de_facto || relationship_status === engaged || relationship_status === separated" }, validation_rules: { maxLength: 50, block_group: "partner_details" } },
  { field_name: "partner_date_of_birth", label: "Partner date of birth", field_type: "date", required: true, step_number: 7, step_name: "Family Composition", display_order: 4, conditional_logic: { showIf: "relationship_status === married || relationship_status === de_facto || relationship_status === engaged || relationship_status === separated" }, validation_rules: { format: "DD/MM/YYYY", block_group: "partner_details" } },
  { field_name: "partner_country_of_birth", label: "Partner country of birth", field_type: "country", required: true, step_number: 7, step_name: "Family Composition", display_order: 5, conditional_logic: { showIf: "relationship_status === married || relationship_status === de_facto || relationship_status === engaged || relationship_status === separated" }, validation_rules: { source: "ISO3166-1", block_group: "partner_details" } },
  { field_name: "partner_country_of_nationality", label: "Partner country of nationality", field_type: "country", required: true, step_number: 7, step_name: "Family Composition", display_order: 6, conditional_logic: { showIf: "relationship_status === married || relationship_status === de_facto || relationship_status === engaged || relationship_status === separated" }, validation_rules: { source: "ISO3166-1", block_group: "partner_details" } },
  { field_name: "partner_relationship_start_date", label: "Date relationship started", field_type: "date", required: true, step_number: 7, step_name: "Family Composition", display_order: 7, conditional_logic: { showIf: "relationship_status === married || relationship_status === de_facto" }, validation_rules: { format: "DD/MM/YYYY", block_group: "partner_details" } },
  { field_name: "partner_accompanying", label: "Will your partner accompany you to Australia?", field_type: "radio", required: true, step_number: 7, step_name: "Family Composition", display_order: 8, conditional_logic: { showIf: "relationship_status === married || relationship_status === de_facto || relationship_status === engaged" }, options: YES_NO },
  { field_name: "partner_in_australia", label: "Is your partner currently in Australia?", field_type: "radio", required: true, step_number: 7, step_name: "Family Composition", display_order: 9, conditional_logic: { showIf: "relationship_status === married || relationship_status === de_facto || relationship_status === engaged" }, options: YES_NO },
  { field_name: "has_children", label: "Do you have any children (biological, adopted or step-children of any age)?", field_type: "radio", required: true, step_number: 7, step_name: "Family Composition", display_order: 10, options: YES_NO },
  { field_name: "child_full_name", label: "Child full name", field_type: "text", required: true, step_number: 7, step_name: "Family Composition", display_order: 11, conditional_logic: { showIf: "has_children === yes" }, validation_rules: { maxLength: 100, repeatable: true, repeat_group: "children", max_items: 10 } },
  { field_name: "child_sex", label: "Child sex", field_type: "select", required: true, step_number: 7, step_name: "Family Composition", display_order: 12, conditional_logic: { showIf: "has_children === yes" }, options: SEX, validation_rules: { repeatable: true, repeat_group: "children" } },
  { field_name: "child_date_of_birth", label: "Child date of birth", field_type: "date", required: true, step_number: 7, step_name: "Family Composition", display_order: 13, conditional_logic: { showIf: "has_children === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "children" } },
  { field_name: "child_country_of_residence", label: "Child country of usual residence", field_type: "country", required: true, step_number: 7, step_name: "Family Composition", display_order: 14, conditional_logic: { showIf: "has_children === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "children" } },
  { field_name: "child_accompanying", label: "Will the child accompany you?", field_type: "radio", required: true, step_number: 7, step_name: "Family Composition", display_order: 15, conditional_logic: { showIf: "has_children === yes" }, options: YES_NO, validation_rules: { repeatable: true, repeat_group: "children" } },
  { field_name: "father_full_name", label: "Father full name", field_type: "text", required: false, step_number: 7, step_name: "Family Composition", display_order: 16, validation_rules: { maxLength: 100, block_group: "father_details" } },
  { field_name: "father_date_of_birth", label: "Father date of birth", field_type: "date", required: false, step_number: 7, step_name: "Family Composition", display_order: 17, validation_rules: { format: "DD/MM/YYYY", block_group: "father_details" } },
  { field_name: "father_country_of_birth", label: "Father country of birth", field_type: "country", required: false, step_number: 7, step_name: "Family Composition", display_order: 18, validation_rules: { source: "ISO3166-1", block_group: "father_details" } },
  { field_name: "mother_full_name", label: "Mother full name", field_type: "text", required: false, step_number: 7, step_name: "Family Composition", display_order: 19, validation_rules: { maxLength: 100, block_group: "mother_details" } },
  { field_name: "mother_date_of_birth", label: "Mother date of birth", field_type: "date", required: false, step_number: 7, step_name: "Family Composition", display_order: 20, validation_rules: { format: "DD/MM/YYYY", block_group: "mother_details" } },
  { field_name: "mother_country_of_birth", label: "Mother country of birth", field_type: "country", required: false, step_number: 7, step_name: "Family Composition", display_order: 21, validation_rules: { source: "ISO3166-1", block_group: "mother_details" } },
  { field_name: "has_other_relatives_in_australia", label: "Do you have any relatives currently in Australia (other than partner / children listed above)?", field_type: "radio", required: true, step_number: 7, step_name: "Family Composition", display_order: 22, options: YES_NO },
  { field_name: "relative_in_au_full_name", label: "Relative full name", field_type: "text", required: true, step_number: 7, step_name: "Family Composition", display_order: 23, conditional_logic: { showIf: "has_other_relatives_in_australia === yes" }, validation_rules: { maxLength: 100, repeatable: true, repeat_group: "relatives_in_au", max_items: 10 } },
  { field_name: "relative_in_au_relationship", label: "Relationship to you", field_type: "select", required: true, step_number: 7, step_name: "Family Composition", display_order: 24, conditional_logic: { showIf: "has_other_relatives_in_australia === yes" }, options: [{ value: "parent", text: "Parent" }, { value: "sibling", text: "Sibling" }, { value: "grandparent", text: "Grandparent" }, { value: "aunt_uncle", text: "Aunt / Uncle" }, { value: "cousin", text: "Cousin" }, { value: "in_law", text: "In-law" }, { value: "other", text: "Other" }], validation_rules: { repeatable: true, repeat_group: "relatives_in_au" } },
  { field_name: "relative_in_au_visa_status", label: "Their Australian visa or residency status", field_type: "select", required: true, step_number: 7, step_name: "Family Composition", display_order: 25, conditional_logic: { showIf: "has_other_relatives_in_australia === yes" }, options: [{ value: "australian_citizen", text: "Australian citizen" }, { value: "permanent_resident", text: "Permanent resident" }, { value: "temporary_visa", text: "Temporary visa holder" }, { value: "unsure", text: "Unsure" }], validation_rules: { repeatable: true, repeat_group: "relatives_in_au" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: Travel & Visa History
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "has_visited_australia_before", label: "Have you ever travelled to Australia?", field_type: "radio", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 1, options: YES_NO },
  { field_name: "previous_au_visit_arrival_date", label: "Date of arrival", field_type: "date", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 2, conditional_logic: { showIf: "has_visited_australia_before === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "previous_au_visits", max_items: 10 } },
  { field_name: "previous_au_visit_departure_date", label: "Date of departure", field_type: "date", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 3, conditional_logic: { showIf: "has_visited_australia_before === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "previous_au_visits" } },
  { field_name: "previous_au_visit_visa_type", label: "Type of visa held", field_type: "text", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 4, conditional_logic: { showIf: "has_visited_australia_before === yes" }, placeholder: "e.g., Subclass 600 Tourist, Subclass 651 eVisitor", validation_rules: { maxLength: 80, repeatable: true, repeat_group: "previous_au_visits" } },
  { field_name: "has_current_au_visa", label: "Do you currently hold an Australian visa (other than this application)?", field_type: "radio", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 5, options: YES_NO },
  { field_name: "current_au_visa_type", label: "Current Australian visa subclass", field_type: "text", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 6, conditional_logic: { showIf: "has_current_au_visa === yes" }, validation_rules: { maxLength: 80 } },
  { field_name: "current_au_visa_expiry", label: "Current visa expiry date", field_type: "date", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 7, conditional_logic: { showIf: "has_current_au_visa === yes" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "has_been_refused_visa", label: "Have you ever been refused a visa or had a visa cancelled by Australia or any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 8, options: YES_NO },
  { field_name: "refusal_country", label: "Country that refused / cancelled the visa", field_type: "country", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 9, conditional_logic: { showIf: "has_been_refused_visa === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "visa_refusals", max_items: 10 } },
  { field_name: "refusal_visa_type", label: "Type of visa refused / cancelled", field_type: "text", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 10, conditional_logic: { showIf: "has_been_refused_visa === yes" }, validation_rules: { maxLength: 80, repeatable: true, repeat_group: "visa_refusals" } },
  { field_name: "refusal_date", label: "Date of refusal / cancellation", field_type: "date", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 11, conditional_logic: { showIf: "has_been_refused_visa === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "visa_refusals" } },
  { field_name: "refusal_reason", label: "Reason given for refusal / cancellation", field_type: "textarea", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 12, conditional_logic: { showIf: "has_been_refused_visa === yes" }, validation_rules: { maxLength: 500, repeatable: true, repeat_group: "visa_refusals" } },
  { field_name: "has_overstayed_visa", label: "Have you ever overstayed a visa or breached any visa conditions in Australia or any other country?", field_type: "radio", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 13, options: YES_NO },
  { field_name: "overstay_details", label: "Details of overstay or visa breach", field_type: "textarea", required: true, step_number: 8, step_name: "Travel & Visa History", display_order: 14, conditional_logic: { showIf: "has_overstayed_visa === yes" }, validation_rules: { maxLength: 1000 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 9: Visit Details (intended trip)
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "intended_arrival_date", label: "Intended date of arrival in Australia", field_type: "date", required: true, step_number: 9, step_name: "Visit Details", display_order: 1, validation_rules: { format: "DD/MM/YYYY", inline_group: "intended_dates" } },
  { field_name: "intended_departure_date", label: "Intended date of departure from Australia", field_type: "date", required: true, step_number: 9, step_name: "Visit Details", display_order: 2, validation_rules: { format: "DD/MM/YYYY", inline_group: "intended_dates" } },
  { field_name: "intended_length_of_stay_months", label: "Total intended length of stay (months)", field_type: "text", required: true, step_number: 9, step_name: "Visit Details", display_order: 3, placeholder: "e.g., 3", validation_rules: { pattern: "^[0-9]{1,2}$", maxLength: 2 } },
  { field_name: "intended_entries", label: "Number of entries requested", field_type: "select", required: true, step_number: 9, step_name: "Visit Details", display_order: 4, options: [{ value: "single", text: "Single entry" }, { value: "multiple", text: "Multiple entries" }] },
  { field_name: "first_port_of_arrival", label: "First Australian port of arrival", field_type: "select", required: true, step_number: 9, step_name: "Visit Details", display_order: 5, options: [{ value: "sydney", text: "Sydney" }, { value: "melbourne", text: "Melbourne" }, { value: "brisbane", text: "Brisbane" }, { value: "perth", text: "Perth" }, { value: "adelaide", text: "Adelaide" }, { value: "darwin", text: "Darwin" }, { value: "cairns", text: "Cairns" }, { value: "gold_coast", text: "Gold Coast" }, { value: "hobart", text: "Hobart" }, { value: "canberra", text: "Canberra" }, { value: "other", text: "Other / unsure" }] },
  { field_name: "first_port_other_specify", label: "Specify other port", field_type: "text", required: true, step_number: 9, step_name: "Visit Details", display_order: 6, conditional_logic: { showIf: "first_port_of_arrival === other" }, validation_rules: { maxLength: 60 } },
  { field_name: "intended_states_to_visit", label: "States or territories you plan to visit", field_type: "textarea", required: false, step_number: 9, step_name: "Visit Details", display_order: 7, placeholder: "e.g., NSW, VIC, QLD", validation_rules: { maxLength: 200 } },
  { field_name: "accommodation_type", label: "Where will you stay during your visit?", field_type: "select", required: true, step_number: 9, step_name: "Visit Details", display_order: 8, options: [{ value: "hotel", text: "Hotel / motel / serviced apartment" }, { value: "with_family", text: "With family or friends" }, { value: "rental", text: "Short-term rental (Airbnb / holiday let)" }, { value: "tour_operator", text: "Tour operator accommodation (organised tour)" }, { value: "other", text: "Other" }] },
  { field_name: "accommodation_address", label: "Address of first night's accommodation in Australia (if known)", field_type: "textarea", required: false, step_number: 9, step_name: "Visit Details", display_order: 9, validation_rules: { maxLength: 250 } },
  { field_name: "accompanied_by_other_applicants", label: "Are you applying as part of a family group with other people on this application?", field_type: "radio", required: true, step_number: 9, step_name: "Visit Details", display_order: 10, options: YES_NO },
  { field_name: "accompanying_applicant_full_name", label: "Accompanying applicant full name", field_type: "text", required: true, step_number: 9, step_name: "Visit Details", display_order: 11, conditional_logic: { showIf: "accompanied_by_other_applicants === yes" }, validation_rules: { maxLength: 100, repeatable: true, repeat_group: "accompanying_applicants", max_items: 10 } },
  { field_name: "accompanying_applicant_relationship", label: "Relationship to you", field_type: "text", required: true, step_number: 9, step_name: "Visit Details", display_order: 12, conditional_logic: { showIf: "accompanied_by_other_applicants === yes" }, placeholder: "e.g., spouse, child", validation_rules: { maxLength: 50, repeatable: true, repeat_group: "accompanying_applicants" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 10: Stream-Specific Details (purpose sub-journeys)
  // ═══════════════════════════════════════════════════════════════════════════
  // — TOURIST stream —
  { field_name: "tourist_main_reason", label: "Main reason for visit", field_type: "select", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 1, conditional_logic: { showIf: IS_TOURIST }, options: [{ value: "holiday", text: "Holiday / sightseeing" }, { value: "visit_family", text: "Visit family or friends" }, { value: "transit", text: "Transit through Australia" }, { value: "social", text: "Social or recreational activity" }, { value: "other", text: "Other" }] },
  { field_name: "tourist_visit_family_relationship", label: "Relationship to the family member or friend in Australia", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 2, conditional_logic: { showIf: "stream === tourist && tourist_main_reason === visit_family" }, placeholder: "e.g., parent, child, friend", validation_rules: { maxLength: 50, block_group: "tourist_visit_family" } },
  { field_name: "tourist_visit_family_name", label: "Name of family member or friend in Australia", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 3, conditional_logic: { showIf: "stream === tourist && tourist_main_reason === visit_family" }, validation_rules: { maxLength: 100, block_group: "tourist_visit_family" } },
  { field_name: "tourist_visit_family_address", label: "Address of family member / friend", field_type: "textarea", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 4, conditional_logic: { showIf: "stream === tourist && tourist_main_reason === visit_family" }, validation_rules: { maxLength: 250, block_group: "tourist_visit_family" } },
  { field_name: "tourist_planned_activities", label: "Planned activities during the visit", field_type: "textarea", required: false, step_number: 10, step_name: "Stream-Specific Details", display_order: 5, conditional_logic: { showIf: IS_TOURIST }, validation_rules: { maxLength: 500 } },

  // — BUSINESS VISITOR stream —
  { field_name: "business_purpose", label: "Type of business activity in Australia", field_type: "select", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 10, conditional_logic: { showIf: IS_BUSINESS }, options: [{ value: "meeting", text: "Attend a meeting or conference" }, { value: "negotiation", text: "Conduct business negotiations" }, { value: "training", text: "Receive on-the-job training (no employment)" }, { value: "exhibition", text: "Trade fair or exhibition" }, { value: "exploratory", text: "Exploratory business visit" }, { value: "other", text: "Other" }] },
  { field_name: "business_purpose_other_specify", label: "Specify other business activity", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 11, conditional_logic: { showIf: "stream === business_visitor && business_purpose === other" }, validation_rules: { maxLength: 200 } },
  { field_name: "business_organising_org_name", label: "Name of the Australian organisation you will visit", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 12, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 100, block_group: "business_org" } },
  { field_name: "business_organising_org_address", label: "Address of the Australian organisation", field_type: "textarea", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 13, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 250, block_group: "business_org" } },
  { field_name: "business_contact_full_name", label: "Australian contact full name", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 14, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 100, block_group: "business_org" } },
  { field_name: "business_contact_position", label: "Australian contact position / title", field_type: "text", required: false, step_number: 10, step_name: "Stream-Specific Details", display_order: 15, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 80, block_group: "business_org" } },
  { field_name: "business_contact_phone", label: "Australian contact phone number", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 16, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 25, block_group: "business_org" } },
  { field_name: "business_contact_email", label: "Australian contact email", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 17, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "business_org" } },
  { field_name: "business_employer_overseas_name", label: "Your overseas employer / business name", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 18, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 100, block_group: "business_employer" } },
  { field_name: "business_employer_overseas_position", label: "Your position at the overseas employer", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 19, conditional_logic: { showIf: IS_BUSINESS }, validation_rules: { maxLength: 80, block_group: "business_employer" } },
  { field_name: "business_paid_by_australian_entity", label: "Will you receive any payment from an Australian source for your activity?", field_type: "radio", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 20, conditional_logic: { showIf: IS_BUSINESS }, options: YES_NO },

  // — SPONSORED FAMILY stream —
  { field_name: "sponsor_full_name", label: "Sponsor full name", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 25, conditional_logic: { showIf: IS_SPONSORED }, validation_rules: { maxLength: 100, block_group: "sponsor_details" } },
  { field_name: "sponsor_relationship", label: "Sponsor's relationship to you", field_type: "select", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 26, conditional_logic: { showIf: IS_SPONSORED }, options: [{ value: "parent", text: "Parent" }, { value: "child_adult", text: "Adult child" }, { value: "sibling", text: "Sibling" }, { value: "grandparent", text: "Grandparent" }, { value: "uncle_aunt", text: "Aunt / Uncle" }, { value: "spouse", text: "Spouse / partner" }, { value: "other", text: "Other approved relative" }], validation_rules: { block_group: "sponsor_details" } },
  { field_name: "sponsor_date_of_birth", label: "Sponsor date of birth", field_type: "date", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 27, conditional_logic: { showIf: IS_SPONSORED }, validation_rules: { format: "DD/MM/YYYY", block_group: "sponsor_details" } },
  { field_name: "sponsor_au_residency", label: "Sponsor Australian residency status", field_type: "select", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 28, conditional_logic: { showIf: IS_SPONSORED }, options: [{ value: "citizen", text: "Australian citizen" }, { value: "permanent_resident", text: "Permanent resident" }, { value: "eligible_nz_citizen", text: "Eligible New Zealand citizen" }] },
  { field_name: "sponsor_address", label: "Sponsor residential address in Australia", field_type: "textarea", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 29, conditional_logic: { showIf: IS_SPONSORED }, validation_rules: { maxLength: 250, block_group: "sponsor_details" } },
  { field_name: "sponsor_phone", label: "Sponsor phone number", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 30, conditional_logic: { showIf: IS_SPONSORED }, validation_rules: { maxLength: 25, block_group: "sponsor_details" } },
  { field_name: "sponsor_email", label: "Sponsor email", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 31, conditional_logic: { showIf: IS_SPONSORED }, validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", block_group: "sponsor_details" } },
  { field_name: "sponsor_security_bond_aware", label: "Do you understand a security bond may be required from your sponsor?", field_type: "radio", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 32, conditional_logic: { showIf: IS_SPONSORED }, options: YES_NO },

  // — APPROVED DESTINATION STATUS (ADS) stream —
  { field_name: "ads_tour_operator_name", label: "Approved Destination Status tour operator (Chinese travel agency)", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 40, conditional_logic: { showIf: IS_ADS }, validation_rules: { maxLength: 100, block_group: "ads_tour" } },
  { field_name: "ads_tour_operator_licence", label: "ADS tour operator licence / registration number", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 41, conditional_logic: { showIf: IS_ADS }, validation_rules: { maxLength: 50, block_group: "ads_tour" } },
  { field_name: "ads_tour_code", label: "ADS group tour code", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 42, conditional_logic: { showIf: IS_ADS }, validation_rules: { maxLength: 30, block_group: "ads_tour" } },
  { field_name: "ads_tour_start_date", label: "Tour start date", field_type: "date", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 43, conditional_logic: { showIf: IS_ADS }, validation_rules: { format: "DD/MM/YYYY", block_group: "ads_tour" } },
  { field_name: "ads_tour_end_date", label: "Tour end date", field_type: "date", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 44, conditional_logic: { showIf: IS_ADS }, validation_rules: { format: "DD/MM/YYYY", block_group: "ads_tour" } },
  { field_name: "ads_tour_leader_name", label: "Tour leader / guide name", field_type: "text", required: false, step_number: 10, step_name: "Stream-Specific Details", display_order: 45, conditional_logic: { showIf: IS_ADS }, validation_rules: { maxLength: 100, block_group: "ads_tour" } },

  // — FREQUENT TRAVELLER stream —
  // Frequent Traveller stream is open to citizens of: People's Republic of
  // China, Brunei, Cambodia, Indonesia, Laos, Malaysia, Philippines,
  // Singapore, Thailand, Timor-Leste, Vietnam (verified 2026-04-26 against
  // immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600/frequent-traveller-stream).
  { field_name: "frequent_eligible_passport_country", label: "Passport country (Frequent Traveller stream is restricted to these eligible nationalities)", field_type: "select", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 50, conditional_logic: { showIf: IS_FREQUENT }, options: [{ value: "CN", text: "People's Republic of China" }, { value: "BN", text: "Brunei Darussalam" }, { value: "KH", text: "Cambodia" }, { value: "ID", text: "Indonesia" }, { value: "LA", text: "Laos" }, { value: "MY", text: "Malaysia" }, { value: "PH", text: "Philippines" }, { value: "SG", text: "Singapore" }, { value: "TH", text: "Thailand" }, { value: "TL", text: "Timor-Leste" }, { value: "VN", text: "Vietnam" }] },
  { field_name: "frequent_traveller_purpose", label: "Primary purpose for the 10-year multiple-entry visa", field_type: "select", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 51, conditional_logic: { showIf: IS_FREQUENT }, options: [{ value: "business", text: "Frequent business visits" }, { value: "tourism", text: "Frequent tourism / family visits" }, { value: "mixed", text: "Mixed business and tourism" }] },
  { field_name: "frequent_average_visit_length_days", label: "Average length of each visit (days, max 3 months per visit)", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 52, conditional_logic: { showIf: IS_FREQUENT }, placeholder: "e.g., 14", validation_rules: { pattern: "^[0-9]{1,3}$", maxLength: 3 } },
  { field_name: "frequent_estimated_visits_per_year", label: "Estimated number of visits per year", field_type: "text", required: true, step_number: 10, step_name: "Stream-Specific Details", display_order: 53, conditional_logic: { showIf: IS_FREQUENT }, placeholder: "e.g., 4", validation_rules: { pattern: "^[0-9]{1,2}$", maxLength: 2 } },
  { field_name: "frequent_residing_in_china", label: "Will you collect biometrics in mainland China? (relevant where in-country biometrics rules differ)", field_type: "radio", required: false, step_number: 10, step_name: "Stream-Specific Details", display_order: 54, conditional_logic: { showIf: IS_FREQUENT }, options: YES_NO },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 11: Funding & Financial Capacity
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "funding_source", label: "Who will fund your stay in Australia?", field_type: "select", required: true, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 1, options: [{ value: "self", text: "Self-funded" }, { value: "family", text: "Family or friend" }, { value: "employer", text: "Employer / business sponsor" }, { value: "australian_sponsor", text: "Australian sponsor (sponsored family stream)" }, { value: "tour_operator", text: "Tour operator (ADS stream)" }, { value: "scholarship_grant", text: "Scholarship or grant" }, { value: "other", text: "Other" }] },
  { field_name: "funds_available_amount", label: "Total funds available for the trip (AUD equivalent)", field_type: "text", required: true, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 2, placeholder: "e.g., 5000", validation_rules: { pattern: "^[0-9]+(\\.[0-9]{1,2})?$", maxLength: 12, inline_group: "funds" } },
  { field_name: "funds_currency", label: "Currency", field_type: "select", required: true, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 3, options: [{ value: "AUD", text: "AUD" }, { value: "USD", text: "USD" }, { value: "EUR", text: "EUR" }, { value: "GBP", text: "GBP" }, { value: "CNY", text: "CNY" }, { value: "JPY", text: "JPY" }, { value: "INR", text: "INR" }, { value: "PHP", text: "PHP" }, { value: "IDR", text: "IDR" }, { value: "VND", text: "VND" }, { value: "other", text: "Other" }], validation_rules: { inline_group: "funds" } },
  { field_name: "funder_full_name", label: "Funder / sponsor full name", field_type: "text", required: true, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 4, conditional_logic: { showIf: "funding_source === family || funding_source === employer || funding_source === other" }, validation_rules: { maxLength: 100, block_group: "funder_details" } },
  { field_name: "funder_relationship", label: "Funder relationship to you", field_type: "text", required: true, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 5, conditional_logic: { showIf: "funding_source === family || funding_source === employer || funding_source === other" }, validation_rules: { maxLength: 50, block_group: "funder_details" } },
  { field_name: "current_employment_status", label: "Your current employment status", field_type: "select", required: true, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 6, options: [{ value: "employed", text: "Employed" }, { value: "self_employed", text: "Self-employed / business owner" }, { value: "student", text: "Student" }, { value: "retired", text: "Retired" }, { value: "homemaker", text: "Homemaker" }, { value: "unemployed", text: "Unemployed" }, { value: "other", text: "Other" }] },
  { field_name: "current_employer_name", label: "Current employer / business name", field_type: "text", required: true, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 7, conditional_logic: { showIf: "current_employment_status === employed || current_employment_status === self_employed" }, validation_rules: { maxLength: 100, block_group: "current_employer" } },
  { field_name: "current_position", label: "Current position / job title", field_type: "text", required: true, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 8, conditional_logic: { showIf: "current_employment_status === employed || current_employment_status === self_employed" }, validation_rules: { maxLength: 80, block_group: "current_employer" } },
  { field_name: "current_employer_address", label: "Employer / business address", field_type: "textarea", required: false, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 9, conditional_logic: { showIf: "current_employment_status === employed || current_employment_status === self_employed" }, validation_rules: { maxLength: 250, block_group: "current_employer" } },
  { field_name: "monthly_income_amount", label: "Monthly income (in your local currency)", field_type: "text", required: false, step_number: 11, step_name: "Funding & Financial Capacity", display_order: 10, conditional_logic: { showIf: "current_employment_status === employed || current_employment_status === self_employed || current_employment_status === retired" }, validation_rules: { pattern: "^[0-9]+(\\.[0-9]{1,2})?$", maxLength: 12 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 12: Health & Health Insurance
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "has_serious_medical_condition", label: "Do you have any disease or condition that requires treatment, medication or hospitalisation?", field_type: "radio", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 1, options: YES_NO },
  { field_name: "medical_condition_details", label: "Details of medical condition", field_type: "textarea", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 2, conditional_logic: { showIf: "has_serious_medical_condition === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "has_tuberculosis_history", label: "Have you ever had, or been treated for, tuberculosis (TB)?", field_type: "radio", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 3, options: YES_NO },
  { field_name: "has_been_in_close_contact_with_tb", label: "Have you been in close contact with a family member with active TB?", field_type: "radio", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 4, options: YES_NO },
  { field_name: "intends_to_work_in_health_setting", label: "Will you work in or visit Australian healthcare or childcare settings?", field_type: "radio", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 5, options: YES_NO },
  { field_name: "is_pregnant", label: "Are you pregnant?", field_type: "radio", required: false, step_number: 12, step_name: "Health & Health Insurance", display_order: 6, conditional_logic: { showIf: "sex === female" }, options: YES_NO },
  { field_name: "has_health_insurance", label: "Do you have health insurance covering your stay in Australia?", field_type: "radio", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 7, options: YES_NO },
  { field_name: "health_insurance_provider", label: "Health insurance provider", field_type: "text", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 8, conditional_logic: { showIf: "has_health_insurance === yes" }, validation_rules: { maxLength: 100, block_group: "insurance_details" } },
  { field_name: "health_insurance_policy_number", label: "Policy number", field_type: "text", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 9, conditional_logic: { showIf: "has_health_insurance === yes" }, validation_rules: { maxLength: 50, block_group: "insurance_details" } },
  { field_name: "needs_special_assistance", label: "Do you require any special assistance (mobility, vision, hearing or other) during your visit?", field_type: "radio", required: false, step_number: 12, step_name: "Health & Health Insurance", display_order: 10, options: YES_NO },
  { field_name: "special_assistance_details", label: "Details of special assistance required", field_type: "textarea", required: true, step_number: 12, step_name: "Health & Health Insurance", display_order: 11, conditional_logic: { showIf: "needs_special_assistance === yes" }, validation_rules: { maxLength: 500 } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 13: Character Declarations
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "has_criminal_conviction", label: "Have you ever been charged with or convicted of any offence in any country?", field_type: "radio", required: true, step_number: 13, step_name: "Character Declarations", display_order: 1, options: YES_NO },
  { field_name: "criminal_conviction_details", label: "Details of charges / convictions (offence, country, date, sentence)", field_type: "textarea", required: true, step_number: 13, step_name: "Character Declarations", display_order: 2, conditional_logic: { showIf: "has_criminal_conviction === yes" }, validation_rules: { maxLength: 2000 } },
  { field_name: "has_been_subject_to_court_order", label: "Have you ever been the subject of an arrest warrant, restraining order or court order?", field_type: "radio", required: true, step_number: 13, step_name: "Character Declarations", display_order: 3, options: YES_NO },
  { field_name: "court_order_details", label: "Details of court order or restraining order", field_type: "textarea", required: true, step_number: 13, step_name: "Character Declarations", display_order: 4, conditional_logic: { showIf: "has_been_subject_to_court_order === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "has_military_service", label: "Have you ever served in any military force, militia, intelligence service, security organisation, or police?", field_type: "radio", required: true, step_number: 13, step_name: "Character Declarations", display_order: 5, options: YES_NO },
  { field_name: "military_service_country", label: "Country in which you served", field_type: "country", required: true, step_number: 13, step_name: "Character Declarations", display_order: 6, conditional_logic: { showIf: "has_military_service === yes" }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "military_service", max_items: 5 } },
  { field_name: "military_service_branch", label: "Branch / unit", field_type: "text", required: true, step_number: 13, step_name: "Character Declarations", display_order: 7, conditional_logic: { showIf: "has_military_service === yes" }, validation_rules: { maxLength: 100, repeatable: true, repeat_group: "military_service" } },
  { field_name: "military_service_role", label: "Role / rank", field_type: "text", required: true, step_number: 13, step_name: "Character Declarations", display_order: 8, conditional_logic: { showIf: "has_military_service === yes" }, validation_rules: { maxLength: 80, repeatable: true, repeat_group: "military_service" } },
  { field_name: "military_service_start_date", label: "Service start date", field_type: "date", required: true, step_number: 13, step_name: "Character Declarations", display_order: 9, conditional_logic: { showIf: "has_military_service === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "military_service" } },
  { field_name: "military_service_end_date", label: "Service end date", field_type: "date", required: false, step_number: 13, step_name: "Character Declarations", display_order: 10, conditional_logic: { showIf: "has_military_service === yes" }, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "military_service" } },
  { field_name: "has_been_involved_in_war_crimes", label: "Have you ever been involved in war crimes, crimes against humanity, or human rights abuses?", field_type: "radio", required: true, step_number: 13, step_name: "Character Declarations", display_order: 11, options: YES_NO },
  { field_name: "war_crimes_details", label: "Details", field_type: "textarea", required: true, step_number: 13, step_name: "Character Declarations", display_order: 12, conditional_logic: { showIf: "has_been_involved_in_war_crimes === yes" }, validation_rules: { maxLength: 2000 } },
  { field_name: "has_outstanding_debts_to_au_gov", label: "Do you owe any debts to the Australian Government, or have you owed them in the past?", field_type: "radio", required: true, step_number: 13, step_name: "Character Declarations", display_order: 13, options: YES_NO },
  { field_name: "au_gov_debt_details", label: "Details of debt to Australian Government", field_type: "textarea", required: true, step_number: 13, step_name: "Character Declarations", display_order: 14, conditional_logic: { showIf: "has_outstanding_debts_to_au_gov === yes" }, validation_rules: { maxLength: 1000 } },
  { field_name: "intends_to_engage_in_work", label: "Do you intend to engage in work for an Australian employer during your visit?", field_type: "radio", required: true, step_number: 13, step_name: "Character Declarations", display_order: 15, options: YES_NO },
  { field_name: "intends_to_study_more_than_3_months", label: "Do you intend to study in Australia for more than 3 months?", field_type: "radio", required: true, step_number: 13, step_name: "Character Declarations", display_order: 16, options: YES_NO },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 14: Declaration
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "declaration_information_true", label: "I declare that the information given is complete, correct and up to date.", field_type: "checkbox", required: true, step_number: 14, step_name: "Declaration", display_order: 1 },
  { field_name: "declaration_understands_consequences", label: "I understand that providing false or misleading information is a serious offence and may result in visa refusal, cancellation, or removal from Australia.", field_type: "checkbox", required: true, step_number: 14, step_name: "Declaration", display_order: 2 },
  { field_name: "declaration_consent_to_share_data", label: "I consent to the Department of Home Affairs sharing my personal information with other Australian government agencies and overseas authorities for the purposes of assessing this application.", field_type: "checkbox", required: true, step_number: 14, step_name: "Declaration", display_order: 3 },
  { field_name: "declaration_consent_health_examinations", label: "I consent to undergo any health examinations the Department may require.", field_type: "checkbox", required: true, step_number: 14, step_name: "Declaration", display_order: 4 },
  { field_name: "declaration_consent_biometrics", label: "I consent to provide biometric data (photograph and fingerprints) if requested.", field_type: "checkbox", required: true, step_number: 14, step_name: "Declaration", display_order: 5 },
  { field_name: "signature_full_name", label: "Full name (typed signature)", field_type: "text", required: true, step_number: 14, step_name: "Declaration", display_order: 6, validation_rules: { maxLength: 100 } },
  { field_name: "signature_date", label: "Date of signature", field_type: "date", required: true, step_number: 14, step_name: "Declaration", display_order: 7, validation_rules: { format: "DD/MM/YYYY" } },
];

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

  const rows = FIELDS.map((f) => toBilingualSeedRow(VISA_TYPE, f));

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

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
