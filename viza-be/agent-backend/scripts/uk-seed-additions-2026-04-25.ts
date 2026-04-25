/**
 * UK Standard Visitor seed schema PATCHES — bundled from 2026-04-25 recon.
 *
 * Source: 19 UKVI portal pages walked via Playwright (see
 * docs/uk-visa-recon-2026-04-25.json). The current seed
 * (`seed-uk-standard-visitor-form-fields.ts`) was authored from gov.uk
 * documentation, which diverges from the actual UKVI form in three
 * ways:
 *   1. Some fields are missing entirely (immigration status,
 *      employer phone code/number split, partial-date fields).
 *   2. Some fields exist with the wrong VALUE OPTIONS (e.g.
 *      `purpose_of_visit` has 11 seed values; UKVI accepts 8 with
 *      different identifiers).
 *   3. Some fields exist with the wrong STRUCTURE (e.g. seed
 *      `employer_address` is one textarea; UKVI splits it into 6+
 *      fields).
 *
 * This file describes the patch in three sections:
 *   A. ADDITIONS — new FieldDef entries to merge into FIELDS array.
 *   B. UPDATES   — option-list changes for existing fields (no
 *                  rename, no structural change).
 *   C. RESTRUCTURES — fields that need to be replaced or supplemented
 *                  because their structure doesn't match UKVI.
 *
 * To apply:
 *   - Section A: append all entries below to the FIELDS array in
 *     `seed-uk-standard-visitor-form-fields.ts`, then re-run the
 *     seed (`npx tsx scripts/seed-uk-standard-visitor-form-fields.ts`).
 *   - Section B: edit the matching FIELDS entry in place to update
 *     its `options` array.
 *   - Section C: discuss before applying — these break user-facing
 *     form layouts. Frontend may need updates.
 */

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

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

// ═══════════════════════════════════════════════════════════════════════════
// SECTION A — NEW FIELDS TO ADD
// ═══════════════════════════════════════════════════════════════════════════

export const UK_SEED_ADDITIONS: FieldDef[] = [
  // ─── Step 2: Identity card extensions (page 5: standardIdentityCard) ─
  { field_name: "national_id_issuing_authority", label: "National identity card issuing authority", field_type: "text", required: false, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 13.5, conditional_logic: { showIf: "has_national_id_card === yes" }, validation_rules: { maxLength: 60 } },
  { field_name: "national_id_issue_date", label: "National identity card issue date (if applicable)", field_type: "date", required: false, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 13.7, conditional_logic: { showIf: "has_national_id_card === yes" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "national_id_expiry_date", label: "National identity card expiry date (if applicable)", field_type: "date", required: false, step_number: 2, step_name: "About You — Passport & Identity Documents", display_order: 13.9, conditional_logic: { showIf: "has_national_id_card === yes" }, validation_rules: { format: "DD/MM/YYYY" } },

  // ─── Step 3: Address — split how_long_at_address ────────────────
  { field_name: "years_at_address", label: "Years at this address", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 11.1, validation_rules: { pattern: "^[0-9]{1,3}$", maxLength: 3, inline_group: "address_duration" } },
  { field_name: "months_at_address", label: "Additional months", field_type: "text", required: false, step_number: 3, step_name: "Your Contact Details", display_order: 11.2, validation_rules: { pattern: "^[0-9]{1,2}$", maxLength: 2, inline_group: "address_duration" } },

  // ─── Step 3: Replace owns_home (yes/no) with 3-option home_ownership
  { field_name: "home_ownership", label: "Ownership status of your home", field_type: "select", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 12.1, options: [{ value: "own", text: "I own it" }, { value: "rent", text: "I rent it" }, { value: "other", text: "Other" }] },
  { field_name: "home_ownership_other_details", label: "Tell us more about your living situation", field_type: "textarea", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 12.2, conditional_logic: { showIf: "home_ownership === other" }, validation_rules: { maxLength: 500 } },

  // ─── New step: Immigration Status (page 8: immigrationStatus) ────
  { field_name: "immigration_status_in_residence_country", label: "Your immigration status in your country of residence", field_type: "radio", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 17, options: [{ value: "temporaryVisa", text: "I have a temporary visa" }, { value: "permanentResident", text: "I am a permanent resident" }, { value: "other", text: "I do not have a visa and I am not a permanent resident" }] },
  { field_name: "immigration_status_visa_expiry", label: "Visa expiry date", field_type: "date", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 18, conditional_logic: { showIf: "immigration_status_in_residence_country === temporaryVisa" }, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "immigration_status_pr_year", label: "Year you became a permanent resident", field_type: "text", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 19, conditional_logic: { showIf: "immigration_status_in_residence_country === permanentResident" }, validation_rules: { pattern: "^[0-9]{4}$", maxLength: 4 } },
  { field_name: "immigration_status_other_details", label: "Tell us about your immigration situation", field_type: "textarea", required: true, step_number: 3, step_name: "Your Contact Details", display_order: 20, conditional_logic: { showIf: "immigration_status_in_residence_country === other" }, validation_rules: { maxLength: 1000 } },

  // ─── Step 9: Employment — replace single employer_address with split fields, add phone code/number, partial date ─
  { field_name: "employer_address_line_1", label: "Employer address — line 1", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 3.1, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 100, block_group: "employer_address" } },
  { field_name: "employer_address_line_2", label: "Employer address — line 2", field_type: "text", required: false, step_number: 9, step_name: "Your Employment", display_order: 3.2, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 100, block_group: "employer_address" } },
  { field_name: "employer_address_city", label: "Employer town/city", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 3.3, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 60, block_group: "employer_address" } },
  { field_name: "employer_address_state", label: "Employer province/state", field_type: "text", required: false, step_number: 9, step_name: "Your Employment", display_order: 3.4, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 60, block_group: "employer_address" } },
  { field_name: "employer_address_postcode", label: "Employer postal code", field_type: "text", required: false, step_number: 9, step_name: "Your Employment", display_order: 3.5, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 15, block_group: "employer_address" } },
  { field_name: "employer_address_country", label: "Employer country", field_type: "country", required: true, step_number: 9, step_name: "Your Employment", display_order: 3.6, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { source: "ISO3166-1", block_group: "employer_address" } },
  { field_name: "employer_phone_code", label: "Employer phone — international code", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 4.1, conditional_logic: { showIf: "employment_status === employed" }, placeholder: "e.g., 1, 44, 86 (digits only, no plus)", validation_rules: { pattern: "^[0-9]{1,4}$" } },
  { field_name: "employer_phone_number", label: "Employer phone — number", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 4.2, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 20 } },
  { field_name: "job_start_month", label: "Job start month", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 5.1, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { pattern: "^[0-9]{1,2}$" } },
  { field_name: "job_start_year", label: "Job start year", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 5.2, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { pattern: "^[0-9]{4}$" } },
  { field_name: "job_title", label: "Your job title", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 6, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 60 } },
  { field_name: "monthly_earnings_currency", label: "Monthly earnings — currency", field_type: "select", required: true, step_number: 9, step_name: "Your Employment", display_order: 7.1, conditional_logic: { showIf: "employment_status === employed" }, options: [{ value: "GBP", text: "GBP" }, { value: "USD", text: "USD" }, { value: "EUR", text: "EUR" }, { value: "CNY", text: "CNY" }] },
  { field_name: "monthly_earnings_amount", label: "Monthly earnings (after tax)", field_type: "text", required: true, step_number: 9, step_name: "Your Employment", display_order: 7.2, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { pattern: "^[0-9]+(\\.[0-9]{1,2})?$" } },
  { field_name: "job_description", label: "Describe your job", field_type: "textarea", required: true, step_number: 9, step_name: "Your Employment", display_order: 8, conditional_logic: { showIf: "employment_status === employed" }, validation_rules: { maxLength: 500 } },

  // ─── Step 10: Income & Savings — opt-out + money split ──────────
  { field_name: "has_other_income_or_savings", label: "Do you have any other income or savings?", field_type: "radio", required: true, step_number: 10, step_name: "Your Finances", display_order: 0, options: YES_NO },

  // ─── Step 7: Trip costs — money split ───────────────────────────
  { field_name: "planned_spend_currency", label: "Planned spend — currency", field_type: "select", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 30.1, options: [{ value: "GBP", text: "GBP" }, { value: "USD", text: "USD" }, { value: "EUR", text: "EUR" }, { value: "CNY", text: "CNY" }] },
  { field_name: "planned_spend_amount", label: "How much do you plan to spend on this visit?", field_type: "text", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 30.2, validation_rules: { pattern: "^[0-9]+(\\.[0-9]{1,2})?$" } },

  // ─── Step 10: Monthly outgoings — money split ───────────────────
  { field_name: "monthly_outgoings_currency", label: "Monthly outgoings — currency", field_type: "select", required: true, step_number: 10, step_name: "Your Finances", display_order: 25.1, options: [{ value: "GBP", text: "GBP" }, { value: "USD", text: "USD" }, { value: "EUR", text: "EUR" }, { value: "CNY", text: "CNY" }] },
  { field_name: "monthly_outgoings_amount", label: "Total amount you spend each month", field_type: "text", required: true, step_number: 10, step_name: "Your Finances", display_order: 25.2, validation_rules: { pattern: "^[0-9]+(\\.[0-9]{1,2})?$" } },

  // ─── Step 7: Sponsorship ────────────────────────────────────────
  { field_name: "someone_paying_for_visit", label: "Will anyone be paying towards the cost of your visit?", field_type: "radio", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 31, options: YES_NO },

  // ─── Step 7: UK travel dates ────────────────────────────────────
  { field_name: "uk_arrival_date", label: "Date you plan to arrive in the UK", field_type: "date", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 5, validation_rules: { format: "DD/MM/YYYY" } },
  { field_name: "uk_departure_date", label: "Date you plan to leave the UK", field_type: "date", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 6, validation_rules: { format: "DD/MM/YYYY" } },

  // ─── Step 7: Spoken language preference ─────────────────────────
  { field_name: "spoken_language_preference", label: "Which language would you prefer if we need to discuss your application?", field_type: "radio", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 40, options: [{ value: "english", text: "English" }, { value: "other", text: "Other" }] },
  { field_name: "spoken_language_other_details", label: "Specify the language", field_type: "text", required: true, step_number: 7, step_name: "Your Trip to the UK", display_order: 41, conditional_logic: { showIf: "spoken_language_preference === other" }, validation_rules: { maxLength: 60 } },

  // ─── Step 8: Tourism sub-purpose (conditional on tourism) ──────
  { field_name: "tourism_sub_purpose", label: "Main reason for your holiday visit", field_type: "radio", required: true, step_number: 8, step_name: "Your Trip to the UK — Purpose", display_order: 1, conditional_logic: { showIf: "purpose_of_visit === tourism" }, options: [{ value: "tourist", text: "Tourist" }, { value: "visiting_family", text: "Visiting family" }, { value: "visiting_friends", text: "Visiting friends" }] },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION B — OPTION UPDATES TO EXISTING FIELDS (no rename, no structural)
// ═══════════════════════════════════════════════════════════════════════════
//
// Apply each by editing the named field in seed-uk-standard-visitor-
// form-fields.ts and replacing its `options` array with the value
// shown below.

export const UK_SEED_OPTION_UPDATES = {
  /** Add the "Unspecified" option that UKVI accepts (gender code 9). */
  sex: [
    { value: "male", text: "Male" },
    { value: "female", text: "Female" },
    { value: "unspecified", text: "Prefer not to say / Unspecified" },
  ],

  /**
   * UKVI accepts these 8 purpose values; the existing seed has 11.
   * Some legacy values can be collapsed via the
   * field-mappings.ts `purposeToUkvi` transform without removing them
   * from the seed UI, but for clarity it is best to update the seed
   * to use UKVI-aligned values directly.
   */
  purpose_of_visit: [
    { value: "tourism", text: "Tourism (including visiting family and friends)" },
    { value: "business", text: "Business (including sports and entertainment)" },
    { value: "transit", text: "Transit through the UK" },
    { value: "academic", text: "Academic visit (teaching, exchange, dependant of academic)" },
    { value: "marriage", text: "Marriage or civil partnership" },
    { value: "medicalTreatment", text: "Private medical treatment or organ donation" },
    { value: "study", text: "Short-term study (up to 6 months)" },
    { value: "other", text: "Other — for another reason" },
  ],

  /**
   * UKVI uses single-letter codes. Either update the seed values to
   * match (recommended for parity) or keep the words and rely on the
   * `maritalWordToCode` transform in field-mappings.ts.
   */
  marital_status_OPTIONAL_PARITY: [
    { value: "S", text: "Single" },
    { value: "M", text: "Married or in a civil partnership" },
    { value: "U", text: "Unmarried partner" },
    { value: "D", text: "Divorced or civil partnership dissolved" },
    { value: "P", text: "Separated" },
    { value: "W", text: "Widowed or surviving civil partner" },
  ],

  /**
   * UKVI form `employment_status` is a multi-select checkbox (an
   * applicant can be both employed AND a student). Seed today is
   * single select. Adopting `multi_select` in the seed requires UI
   * support — flagged as Section C work.
   */
  employment_status_VALUES_ONLY: [
    { value: "employed", text: "Employed" },
    { value: "self-employed", text: "Self-employed" },
    { value: "student", text: "A student" },
    { value: "retired", text: "Retired" },
    { value: "unemployed", text: "Unemployed" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION C — STRUCTURAL CHANGES (need UI work; review before applying)
// ═══════════════════════════════════════════════════════════════════════════

export const UK_SEED_STRUCTURAL_NOTES = {
  owns_home_to_home_ownership: {
    summary:
      "Replace seed field `owns_home` (radio yes/no) with new `home_ownership` (3-option select: own/rent/other). Add `home_ownership_other_details` textarea conditional on `home_ownership === other`. The new fields are in Section A.",
    breaking: "Yes — `owns_home` answers are lost. Backfill: yes→own, no→rent (lossy).",
    frontend: "Replace the yes/no radio with a 3-option dropdown.",
  },

  how_long_at_address_split: {
    summary:
      "Replace seed field `how_long_at_address` (single text 'e.g., 3 years') with `years_at_address` + `months_at_address` numerics. The new fields are in Section A.",
    breaking: "Yes — old text answers don't auto-parse cleanly.",
    frontend: "Render a 'Years' and 'Months' number-input pair side-by-side.",
  },

  employer_address_split: {
    summary:
      "Replace seed field `employer_address` (single textarea) with 6 fields: line_1, line_2, city, state, postcode, country (Section A).",
    breaking: "Yes — old free-text answers don't decompose reliably.",
    frontend: "Replace single textarea with structured address block (mirror home_address pattern).",
  },

  employer_phone_split: {
    summary:
      "Replace seed field `employer_phone` (single text) with `employer_phone_code` + `employer_phone_number`. Code is digits-only (no '+').",
    breaking: "Yes — old phone strings need parsing.",
    frontend: "Render two number inputs (intl code + number).",
  },

  employment_status_to_multi_select: {
    summary:
      "Seed `employment_status` is single-select; UKVI accepts multiple statuses simultaneously. Promote field_type to `multi_select` (or add a separate widget).",
    breaking: "Soft — single-select answers still valid as a 1-element list.",
    frontend: "Switch the dropdown to a multi-checkbox group.",
  },
};
