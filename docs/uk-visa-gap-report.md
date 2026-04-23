# UK Standard Visitor Visa — Gap Report

**Generated:** 2026-04-23
**Schema version:** v1 (seed-uk-standard-visitor-form-fields.ts)
**Visa type:** `UK_STANDARD_VISITOR`

---

## 1. Coverage Summary

| Section | Step | Fields | Status |
|---------|------|--------|--------|
| About You — Personal Details | 1 | 12 | Covered |
| About You — Passport Details | 2 | 10 | Covered |
| Your Contact Details | 3 | 16 | Covered |
| Your Family | 4 | 17 | Covered |
| Your Accommodation in the UK | 5 | 10 | Covered |
| Your Travel History | 6 | 13 | Covered |
| Your Trip to the UK | 7 | 9 | Covered |
| Your Employment | 8 | 13 | Covered |
| Your Finances | 9 | 13 | Covered |
| Medical Treatment Details | 10 | 6 | Covered (conditional) |
| Additional Information | 11 | 11 | Covered |
| **Total** | **11** | **130** | — |

**Total field definitions:** 130 (including conditional fields)
**Required fields (always shown):** ~65
**Conditional fields:** ~65 (shown based on prior answers)

---

## 2. Covered Features

### Conditional Branching (Implemented)
- Partner details gated on `marital_status` (married/civil_partnership/unmarried_partner)
- Other names gated on `other_names_used === yes`
- Other nationalities gated on `has_other_nationalities === yes`
- Other passports gated on `has_other_passports === yes`
- Correspondence address gated on `correspondence_address_different === yes`
- Employment details branched by `employment_status` (employed/self-employed/student/other)
- Sponsor details gated on `who_is_paying === sponsor`
- Medical treatment section gated on `purpose_of_visit === medical`
- Criminal/security explanation fields gated on yes answers
- UK host details gated on `uk_accommodation_type === family_friends`
- UK family visit details gated on `visiting_family_in_uk === yes`

### Field Types (Implemented)
- text, select, date, country, radio, textarea
- Validation rules: maxLength, pattern, format
- Block groups (e.g., home_address, parents, employer_details, sponsor_details)
- Inline groups (e.g., passport_dates, trip_dates)
- Repeatable groups (e.g., other_nationalities)

---

## 3. Known Gaps — Unsupported Fields or Branches

### 3.1 Business Visit Sub-Journey
**Status:** NOT COVERED
**Impact:** Medium

When `purpose_of_visit === business`, the Access UK form may present additional fields:
- Name of UK business contact
- UK company name and address
- Nature of business activities
- Duration and frequency of business visits
- Whether the applicant will be paid by a UK company

**Recommendation:** Add a conditional step 10b for business-visit-specific fields in a future iteration.

### 3.2 Short-Term Study Sub-Journey
**Status:** NOT COVERED
**Impact:** Low

When `purpose_of_visit === short_study`, additional fields may appear:
- Name of institution
- Course details and duration
- Who is paying for the course
- Accreditation status of the institution

**Recommendation:** Add conditional fields under step 7 or a new sub-step.

### 3.3 Dependant Applications
**Status:** NOT COVERED
**Impact:** Medium

When applying with dependants (spouse/children), the Access UK form adds:
- Dependant personal details (one set per dependant)
- Dependant passport information
- Dependant relationship to main applicant
- Whether dependants have their own financial means

**Recommendation:** Requires repeatable section support. Defer to v2.

### 3.4 Country-Specific Variations
**Status:** PARTIALLY COVERED
**Impact:** Low-Medium

Some applicant nationalities trigger additional requirements:
- **TB Test Certificate:** Required for applicants from listed countries (approx. 100 countries)
- **Police Certificate:** May be required depending on nationality
- **Biometric Residence Permit (BRP):** Collection location varies by country

The v1 schema does not include nationality-gated conditional fields for these.

**Recommendation:** Add a `tb_test_required` flag to the schema metadata. Document the TB-test country list separately.

### 3.5 Immigration Health Surcharge (IHS)
**Status:** NOT COVERED (out of scope)
**Impact:** Low for schema, High for workflow

IHS payment is handled on a separate GOV.UK page after form submission, not within the Access UK form itself. The v1 schema correctly excludes it.

**Note:** Users need to pay IHS before booking biometrics. This should be documented in the user journey but is not a form field gap.

### 3.6 Biometrics Booking
**Status:** NOT COVERED (out of scope)
**Impact:** N/A for schema

Biometrics appointments are booked through TLS Contact or VFS Global (country-dependent). This is a post-submission step, not part of the Access UK form.

### 3.7 Previous UK Visa Details
**Status:** PARTIALLY COVERED
**Impact:** Low

The v1 schema captures:
- Whether the applicant has visited the UK before (yes/no)
- Most recent visit date, duration, and reason

The official form may also ask for:
- Previous UK visa reference numbers
- Previous UK visa types held
- Multiple previous visits (not just the most recent)

**Recommendation:** Add repeatable `previous_uk_visit` group with visa_reference_number field.

### 3.8 Document Upload Fields
**Status:** NOT COVERED
**Impact:** Medium

The Access UK form allows uploading supporting documents:
- Bank statements
- Employment letter
- Accommodation booking confirmation
- Travel itinerary
- Sponsor's documents (if sponsored)

The v1 schema captures data fields only, not file upload fields. VIZA's existing `application_documents` table can handle uploads separately.

**Recommendation:** Document uploads are a workflow concern, not a schema gap. The existing `application_documents` table and upload UI should be extended to support UK-specific document categories.

---

## 4. Conditional Logic Limitations

### 4.1 Multi-Value showIf (Implemented but Unverified)
The v1 schema uses `||` operators in conditional logic:
```
"showIf": "marital_status === married || marital_status === civil_partnership || marital_status === unmarried_partner"
```

The existing `evaluateShowIf()` function in `dynamic-step-form.tsx` may not support `||` operators. This needs verification.

**Action required:** Test multi-value showIf rendering. If unsupported, either:
1. Extend `evaluateShowIf()` to handle `||` operators, or
2. Split into simpler per-value conditions

### 4.2 Cross-Step Conditionals
Medical treatment fields (step 10) are gated on `purpose_of_visit` from step 7. The dynamic form renderer may not evaluate conditions across steps.

**Action required:** Verify cross-step conditional evaluation works. If not, the medical step may need to be unconditionally shown with an internal gate.

---

## 5. Field Accuracy Notes

All field definitions are based on the known structure of the Access UK Standard Visitor Visa application. The official form may:

1. **Add fields** in response to policy changes (e.g., post-Brexit requirements)
2. **Remove fields** that are no longer relevant
3. **Reword labels** without changing the underlying data collected
4. **Reorder sections** in the application flow

The v1 schema should be re-validated against the live Access UK form periodically. A recommended cadence is quarterly or whenever UK immigration policy changes are announced.

---

## 6. Reviewer Checklist

Before marking the UK Standard Visitor form as production-ready:

- [ ] Run the seed script and verify all 130 fields appear in `visa_form_fields`
- [ ] Assign a test user the `UK_STANDARD_VISITOR` package
- [ ] Navigate through all 11 steps in the dynamic form
- [ ] Verify conditional fields show/hide correctly
- [ ] Test multi-value `||` conditional logic (partner fields)
- [ ] Test cross-step conditionals (medical fields gated on purpose_of_visit)
- [ ] Verify repeatable groups work (other_nationalities)
- [ ] Confirm block groups render correctly (home_address, parents, employer_details)
- [ ] Confirm inline groups render correctly (passport_dates, trip_dates)
- [ ] Submit a test application and verify answers persist to `visa_application_answers`
