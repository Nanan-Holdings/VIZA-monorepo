# UK Standard Visitor Visa — Gap Report

**Generated:** 2026-04-24
**Schema version:** v3 (seed-uk-standard-visitor-form-fields.ts)
**Visa type:** `UK_STANDARD_VISITOR`

Goal: when a user is assigned the UK Standard Visitor package, their
`/application` page renders a 1:1 schema match of what they would see
on the live Access UK Standard Visitor form.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| About You — Personal Details | 1 | 19 | Previous-names repeatable; under-18 applicant fields |
| About You — Passport & Identity Documents | 2 | 15 | Other passports repeatable; National ID + BRP |
| Your Contact Details | 3 | 16 | |
| Your Family | 4 | 17 | |
| Your Accommodation in the UK | 5 | 10 | |
| Your Travel History | 6 | 28 | Structured repeatable: Schengen, US/Canada/ANZ, other; previous UK visits repeatable with visa reference |
| Your Trip to the UK | 7 | 8 | Purpose expanded to full Standard Visitor umbrella (11 purposes) |
| Purpose-Specific Details | 8 | 54 | Business, Short-Study, Medical, Transit, Marriage/CP, PPE, Academic 12-month, Organ Donor, Clinical Training |
| Your Employment | 9 | 13 | |
| Your Finances | 10 | 13 | |
| Dependants Travelling With You | 11 | 7 | Repeatable dependant group (schema only — see §3.1) |
| Additional Information, Immigration History & Declaration | 12 | 22 | Medical-condition-affecting-travel, TB test, immigration-law breach, civil penalty, public-funds use |
| **Total** | **12** | **222** | — |

---

## 2. Purpose Options (Step 7)

`purpose_of_visit` covers the full Standard Visitor umbrella — 11 purposes:
- `tourism` — Tourism / holiday
- `visiting_family_friends` — Visiting family or friends
- `business` — Business (meetings, conferences)
- `short_study` — Short-term study (up to 6 months)
- `medical` — Private medical treatment
- `transit` — Transit to another country
- `marriage_civil_partnership` — Marriage or civil partnership
- `ppe` — Permitted Paid Engagement (up to 1 month)
- `academic_12m` — Academic or researcher (up to 12 months)
- `organ_donor` — Organ donation
- `clinical_training` — Clinical attachment, dental observer, PLAB or OSCE

Each purpose unlocks a bespoke sub-journey in Step 8.

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

## 4. Closed in v3

The following gaps from v2 have been resolved:

- **Under-18 applicant fields** — `is_applicant_under_18`, parental
  consent letter reference, accompanying adult name/relationship/passport
  number (step 1, gated on `is_applicant_under_18 === yes`)
- **Specialised sub-categories** — PPE, Academic/researcher 12-month,
  Organ donor, Clinical training now exist as purpose options with
  their own sub-journey field sets in step 8
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

- [x] Seed applied (222 rows in `visa_form_fields` with visa_type = `UK_STANDARD_VISITOR`)
- [ ] Assign a test user the `UK_STANDARD_VISITOR` package
- [ ] Walk each of the 11 purposes in Step 7 and confirm correct Step 8 sub-journey shows
- [ ] Test all 8 repeatable groups (add/remove instance, values persist)
- [ ] Test multi-value `||` in partner gating (step 4)
- [ ] Test cross-step gating (step 7 purpose → step 8 sub-journey fields)
- [ ] Test under-18 conditional fields (step 1)
- [ ] Test TB test conditional fields (step 12)
- [ ] Submit a test application and verify all 222 fields persist to `visa_application_answers`
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
