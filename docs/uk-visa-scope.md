# UK Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-23

---

## 1. Canonical Journey

**Visa type:** UK Standard Visitor Visa (formerly "Tourist Visa")
**VIZA visa_type key:** `UK_STANDARD_VISITOR`

The UK Standard Visitor Visa is the single-entry visa most commonly applied for by tourists, business visitors, and short-stay travellers to the United Kingdom. It covers visits of up to 6 months.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility check | `https://www.gov.uk/standard-visitor` | GOV.UK guidance page — explains who can apply, what documents are needed |
| 2. Application start | `https://www.gov.uk/standard-visitor/apply` | Start page with "Apply now" link |
| 3. Online application | `https://apply-to-visit-or-stay-in-the-uk.homeoffice.gov.uk/` | UKVI online application system (Access UK) — the actual form |
| 4. Biometrics booking | Via TLS Contact or VFS Global (country-dependent) | Appointment booking after online form submission |

The **v1 extraction target** is step 3 — the Access UK online application form. This is where all applicant data is collected.

### Access UK Application Structure

The Access UK system collects data across the following broad sections (observed from the official Standard Visitor Visa journey):

1. **About you** — name, date of birth, sex, nationality, passport details
2. **Your contact details** — email, phone, address
3. **Your family** — marital status, partner details, dependants
4. **Your accommodation** — where you will stay in the UK
5. **Your travel history** — previous UK visits, previous visa refusals, deportations
6. **Your trip to the UK** — purpose of visit, travel dates, funding
7. **Your employment** — current employment, employer details, income
8. **Your finances** — how you will fund your trip, bank details
9. **Your education** — qualifications (if applicable)
10. **Additional information** — anything else to support the application
11. **Declaration** — confirm truthfulness of answers

---

## 2. v1 Scope — What Is Included

- **One visa category only:** Standard Visitor Visa (visit type: tourism/business/family visit)
- **One application system:** Access UK (`apply-to-visit-or-stay-in-the-uk.homeoffice.gov.uk`)
- **Schema extraction:** All sections, fields, options, requiredness, and conditional logic from the Standard Visitor journey
- **Dynamic form rendering:** UK visa schema loaded through VIZA's existing `visa_form_fields` + `DynamicStepForm` infrastructure
- **No automated submission:** Schema and form rendering only — no Playwright automation of Access UK in v1

---

## 3. Out-of-Scope Visa Categories (v1)

The following UK visa categories are **explicitly excluded** from v1. They use different Access UK journeys with different field sets:

| Category | Reason for exclusion |
|----------|---------------------|
| Skilled Worker Visa | Different journey, employer-sponsored, COS required |
| Student Visa (Tier 4) | CAS-based, institution-sponsored |
| Family Visa (Partner/Parent) | Relationship evidence, different financial requirements |
| Graduate Visa | Post-study, different eligibility rules |
| Global Talent Visa | Endorsement-based |
| Transit Visa | Minimal fields, different journey |
| British National (Overseas) Visa | Hong Kong BN(O) specific |
| All settlement/ILR routes | Fundamentally different application structure |

These may be added in future iterations by creating additional `visa_type` entries and seed scripts.

---

## 4. Known Source-Flow Ambiguities

The following ambiguities were identified during scope analysis and are documented rather than silently assumed:

1. **Conditional branching by visit purpose:** The Access UK form adjusts questions based on whether the visit is for tourism, business, medical treatment, academic, or other purposes. v1 targets the tourism/general visit sub-journey. Business-visit and medical-visit conditional branches may have additional fields not captured in the initial schema.

2. **Country-specific variations:** Some questions may vary based on the applicant's nationality or country of residence (e.g., TB test requirements, different document requirements). The v1 schema captures the common field set; country-specific variations will be documented in the gap report (UK-004).

3. **Dependant applications:** When applying with dependants, additional sections appear. v1 covers the single-applicant journey only.

4. **Access UK form versioning:** The UKVI system may update field labels, add/remove questions, or restructure sections without notice. The schema represents a point-in-time extraction and should be re-validated periodically.

5. **IHS (Immigration Health Surcharge):** The IHS payment step is part of the post-form flow, not the form itself. It is out of scope for schema extraction but noted as a required step in the real application journey.

6. **Biometrics booking:** Handled by third-party providers (TLS Contact / VFS Global), not part of the Access UK form. Out of scope.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official field structure, requiredness, options, and conditional logic in a machine-readable VIZA schema before optimizing downstream automation.

The UK schema must be grounded in the actual Access UK application flow. Hand-written or partially copied field lists are not acceptable proof of parity. Any fields that cannot be verified against the official source must be flagged in the gap report.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'UK_STANDARD_VISITOR'` |
| `visa_packages` table | New row: `country = 'united_kingdom'`, `visa_type = 'UK_STANDARD_VISITOR'` |
| Seed script | New `seed-uk-standard-visitor-form-fields.ts` following DS-160 seed pattern |
| Frontend rendering | No code changes — `DynamicStepForm` + `getVisaFormSteps('UK_STANDARD_VISITOR')` |
| Submission automation | **Not in v1** — no Playwright automation of Access UK |
| Answer storage | Existing `visa_application_answers` table, keyed by `application_id` + `field_name` |

---

## 7. How the UK Schema Was Derived

The UK Standard Visitor visa schema was built by analyzing the official Access UK application form at `apply-to-visit-or-stay-in-the-uk.homeoffice.gov.uk`. The process:

1. **Identified the canonical journey:** Standard Visitor Visa (tourism/general visit) — the most common UK visa type for VIZA's target users.
2. **Mapped sections to steps:** The Access UK form presents ~11 logical sections. Each became a `step_number` in the seed script.
3. **Captured fields with metadata:** Every question was mapped to a `FieldDef` with field_name, label, field_type, required flag, options (for select/radio), and conditional_logic (showIf expressions).
4. **Preserved branching:** Conditional fields were not flattened — they use `showIf` expressions that reference parent field values (e.g., `marital_status === married`).
5. **Documented gaps:** Any fields or branches that could not be confirmed or were ambiguous were documented in `docs/uk-visa-gap-report.md`.

### How to Rerun or Update the Schema

1. **Edit the seed script:** `viza-be/agent-backend/scripts/seed-uk-standard-visitor-form-fields.ts`
2. **Run:** `npx tsx scripts/seed-uk-standard-visitor-form-fields.ts`
3. The script is idempotent — it deletes all `UK_STANDARD_VISITOR` rows first, then re-inserts.
4. No frontend deployment needed — the dynamic form loads from the database at runtime.

### How to Add a New UK Visa Category

1. Copy the seed script to `seed-uk-<category>-form-fields.ts`
2. Change `VISA_TYPE` to a new key (e.g., `UK_SKILLED_WORKER`)
3. Update the `FIELDS` array with the new form's fields
4. Add a migration to `drizzle/` inserting into `visa_packages`
5. Run the seed script
6. Assign the package to users via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)
1. **Verify `||` conditional logic:** Test that `evaluateShowIf()` in `dynamic-step-form.tsx` handles multi-value `||` expressions. If not, extend the evaluator or simplify the conditions.
2. **Verify cross-step conditionals:** Medical treatment fields (step 10) are gated on `purpose_of_visit` from step 7. Confirm the dynamic form evaluates conditions across steps.
3. **Run the seed script** against a staging Supabase instance and walk through all 11 steps.

### Short-term (v1.1)
4. **Add business-visit sub-journey fields** (conditional on `purpose_of_visit === business`)
5. **Add previous UK visa details** as a repeatable group
6. **Extend document upload categories** for UK-specific supporting documents

### Medium-term (v2)
7. **Dependant applications** — repeatable applicant sections
8. **Country-specific variations** — TB test requirements, nationality-gated fields
9. **Access UK Playwright automation** — if automated form submission is desired (mirrors the CEAC/DS-160 submission service)
