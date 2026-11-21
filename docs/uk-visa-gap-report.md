# UK Standard Visitor Visa — Gap Report

**Generated:** 2026-11-21
**Schema version:** v4 (seed-uk-standard-visitor-form-fields.ts)
**Visa type:** `UK_STANDARD_VISITOR`

Goal: when a user is assigned the UK Standard Visitor package, their
`/application` page renders a 1:1 schema match of what they would see
on the live Access UK Standard Visitor form.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Passport Upload | 0 | 1 | Passport bio-data page upload slot; file is stored in `application_documents` |
| About You — Personal Details | 1 | 19 | Previous-names repeatable; under-18 applicant fields |
| About You — Passport & Identity Documents | 2 | 17 | Other passports repeatable; National ID + BRP; recon extensions |
| Your Contact Details | 3 | 25 | Includes the required UKVI additional-email question and conditional address/residence branches |
| Your Family | 4 | 17 | |
| Your Accommodation in the UK | 5 | 9 | |
| Your Travel History | 6 | 28 | Structured repeatable: Schengen, US/Canada/ANZ, other; previous UK visits repeatable with visa reference |
| Your Trip to the UK | 7 | 13 | Purpose selector matches the eight options captured from Access UK, plus recon extensions |
| Purpose-Specific Details | 8 | 55 | Supported purpose branches plus generic activity details; PPE, organ-donor, and clinical-training groups remain future branches without standalone selector values |
| Your Employment | 9 | 26 | Includes employer contact and job-detail recon extensions |
| Your Finances | 10 | 16 | Includes income/savings and monthly outgoings recon extensions |
| Dependants Travelling With You | 11 | 7 | Repeatable dependant group (schema only — see §3.1) |
| Additional Information, Immigration History & Declaration | 12 | 22 | Medical-condition-affecting-travel, TB test, immigration-law breach, civil penalty, public-funds use |
| **Total** | **12** | **255** | — |

---

## 2. Purpose Options (Step 7)

`purpose_of_visit` matches the eight options captured from the live Access UK
purpose page (`uk-walk-out/page-purposeOfVisitForVV.json`):
- `tourism` — Tourism (including visiting family and friends)
- `business` — Business (including sports and entertainment)
- `transit` — Transit through the UK
- `academic` — Academic visit (including teaching, exchange and visiting as a dependant of an academic visitor)
- `marriage` — Marriage or civil partnership
- `medicalTreatment` — Private medical treatment or organ donation
- `study` — Short-term study (up to 6 months), including recreational course
- `other` — Other - I am visiting for another reason

The live selector has no standalone `ppe`, `organ_donor`, or
`clinical_training` values. The corresponding VIZA branch fields remain
explicitly unaliased until the official parent-flow questions for those
activities are modelled; mapping them to a broad purpose would show unrelated
required fields.

---

## 3. Remaining Limitations

### 3.1 Dependants — schema present, workflow missing
`applying_with_dependants` + the `dependants` repeatable group capture
each dependant's details, but there is **no automation to spawn a
separate application per dependant**. In Access UK each dependant
requires their own application (they share travel/accommodation data
but each gets their own fee, biometrics, and decision letter).

**Impact:** Users with dependants submit a single application with the
dependant list attached. Staff/admin must manually create separate
applications for each dependant downstream.

**Why deferred:** building the multi-applicant spawning flow requires
changes to the application model (a `parent_application_id` column or
similar), the creation server action, the admin-review UI, and the
user's application list page. Treated as a v3 workflow task rather
than a schema fix.

### 3.2 TB test — user-declared, not nationality-enforced
`tb_test_required_acknowledged` asks the applicant whether a TB test
is needed (with an "unsure" option). We do NOT auto-gate this based
on `country_of_nationality`.

**Why:** the current `evaluateShowIf` implementation only supports
`===` / `!==` atomic comparisons — it cannot express "nationality is
in [afghanistan, bangladesh, pakistan, ...]" (the full list is ~100
countries). Implementing nationality-list gating would require
extending `lib/form-utils.ts` with a new operator (e.g. `in`).

**Workaround:** staff review the nationality on submission and confirm
TB test requirement during document review.

### 3.3 Document uploads — handled by `application_documents`
Supporting documents (bank statements, employment letter, accommodation
booking, sponsor docs, TB certificate, birth/adoption certificates,
parental consent for minors, consultant letters for medical/organ-donor
journeys) are not schema fields. They live in the `application_documents`
table and are handled by a separate upload UI. **Not a schema gap.**

### 3.4 Biometrics booking & Immigration Health Surcharge
Post-submission steps handled on separate GOV.UK pages (TLS Contact /
VFS Global for biometrics, IHS portal for the surcharge). **Not in
scope for the form schema.**

---

## 4. Closed in v4

The live UKVI walk identified and closed the missing additional-email branch:

- **Additional email** — `has_alternative_email` is required and offers Yes/No;
  `alternative_email_address` is required only when Yes is selected. The
  values are persisted under the same canonical keys consumed by the UK runner.

## 4.1 Closed in v3

The following gaps from v2 have been resolved:

- **Under-18 applicant fields** — `is_applicant_under_18`, parental
  consent letter reference, accompanying adult name/relationship/passport
  number (step 1, gated on `is_applicant_under_18 === yes`)
- **Specialised sub-categories** — fields for PPE, organ donor, and clinical
  training remain in the schema as reviewed future branches, but the live
  purpose selector does not expose standalone values for them. They must not
  be aliased to business, medical treatment, study, or academic without a
  confirmed official parent-flow question.
- **TB test declaration** — added to step 12 (user-declared, not
  nationality-gated — see §3.2)

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators — WORKING
`lib/form-utils.ts` `evaluateShowIf` splits on `||` then `&&` and
evaluates each atom with `===` / `!==`. Multi-value gating works.

### 5.2 Cross-step conditionals — FIXED in v2
`DynamicStepForm` now seeds its local `values` state with the full
`prefill` (all accumulated prior answers), so step 8 sub-journeys
gated on `purpose_of_visit` from step 7 render correctly.

### 5.3 Not supported — list membership operator
No `in` operator (e.g. `country_of_nationality in [af, bd, pk, ...]`).
Required to auto-gate TB test by nationality. Scope for a future
`evaluateShowIf` extension.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent
`scripts/seed-uk-standard-visitor-form-fields.ts` deletes all rows
with `visa_type = 'UK_STANDARD_VISITOR'` then re-inserts. Safe to
re-run any time the field definitions change.

### 6.2 Repeatable groups used
- `previous_names` (step 1) — gated on `other_names_used === yes`
- `other_nationalities` (step 1) — gated on `has_other_nationalities === yes`
- `other_passports` (step 2) — gated on `has_other_passports === yes`
- `previous_uk_visits` (step 6) — gated on `travelled_to_uk_before === yes`
- `schengen_visits` (step 6) — gated on `has_schengen_visits === yes`
- `us_canada_anz_visits` (step 6) — gated on `has_us_canada_anz_visits === yes`
- `other_country_visits` (step 6) — gated on `has_other_country_visits === yes`
- `dependants` (step 11) — gated on `applying_with_dependants === yes`

### 6.3 Block groups used (visually grouped fields)
`home_address`, `parents`, `uk_address`, `employer_details`,
`sponsor_details`, `business_details`, `study_details`,
`medical_details`, `transit_details`, `marriage_details`,
`ppe_details`, `academic_details`, `organ_donor_details`,
`clinical_details`, `accompanying_adult`, `tb_test_details`.

### 6.4 Inline groups used (side-by-side pair rendering)
`passport_dates`, `trip_dates`, `ppe_dates`, `clinical_dates`.

---

## 7. Reviewer Checklist

- [x] Seed/migration contract defines 255 rows in `visa_form_fields` with visa_type = `UK_STANDARD_VISITOR`
- [ ] Assign a test user the `UK_STANDARD_VISITOR` package
- [ ] Walk each of the 8 purposes in Step 7 and confirm the purpose-specific fields and generic activity details
- [ ] Test all 8 repeatable groups (add/remove instance, values persist)
- [ ] Test multi-value `||` in partner gating (step 4)
- [ ] Test cross-step gating (step 7 purpose → step 8 sub-journey fields)
- [ ] Test under-18 conditional fields (step 1)
- [ ] Test TB test conditional fields (step 12)
- [ ] Submit a test application and verify all 255 fields persist to `visa_application_answers`
- [ ] Confirm review step (`DynamicReviewStep`) renders all fields correctly

---

## 8. Source Material

- UK Home Office *Visit caseworker guidance* (25 February 2026 edition)
- GOV.UK *Visitor visa: guide to supporting documents*
- GOV.UK *Apply for a Standard Visitor visa* public page
- Immigration Rules Appendix V: Visitor

The live Access UK application form is behind an identity gate and
cannot be scraped directly. Field list is a high-fidelity reconstruction
from the public guidance documents above. Expect periodic drift as the
UK Home Office updates the form; re-validate quarterly or when policy
changes are announced.
