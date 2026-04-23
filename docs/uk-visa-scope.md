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

## 7. Next Steps

1. **UK-002:** Extract and normalize the full field inventory from the Access UK Standard Visitor journey
2. **UK-003:** Wire the schema into VIZA's dynamic form rendering path
3. **UK-004:** Produce operator-visible gap report for any unsupported fields/branches
4. **UK-005:** Document the workflow and expansion path for additional UK visa categories
