# Vietnam Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-24

---

## 1. Canonical Journey

**Visa type:** Vietnam E-Visa (electronic visa)
**VIZA visa_type key:** `VN_E_VISA`

The Vietnam E-Visa is a single electronic-visa product issued by the
Vietnam Immigration Department (Cục Quản lý xuất nhập cảnh) via
`https://evisa.gov.vn`. It grants stays of **up to 90 days**, with a
choice between **single-entry** or **multiple-entry**, and has been
open to **all nationalities** since Resolution 127/NQ-CP (effective
15 August 2023). It is the canonical first-touch visa for foreign
visitors whose trip purpose is tourism, visiting relatives, business,
short-term working, or a general "other" purpose that does not
require an embassy-issued category visa.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility & guidance | `https://evisa.gov.vn` (landing) | Home page, policy announcements, FAQ |
| 2. Application start | `https://evisa.gov.vn/e-visa/foreigners` | "Apply" entry, disclaimer, agree-to-create-account gate |
| 3. Online application | `https://evisa.gov.vn/e-visa/foreigners` (multi-page form) | The actual form — our extraction target |
| 4. Payment & submission | Same portal (Vietcombank / international card gateway) | $25 (single entry) / $50 (multiple entry) |
| 5. Result retrieval | `https://evisa.gov.vn/tra-cuu-ho-so-dien-tu` | Check status by application code + email + DOB |

The **v1 extraction target** is step 3 — the `evisa.gov.vn` multi-page
application form. This is where all applicant data is collected.

### Application Structure

The `evisa.gov.vn` form collects data across 10 logical sections. Each
maps to a `step_number` in the seed.

1. Personal Details
2. Passport & Identity Documents
3. Contact Details
4. Occupation
5. Trip Information
6. Accommodation in Vietnam
7. Border Gates
8. Purpose-Specific Details
9. Trip Expenses & Emergency Contact
10. Declaration

---

## 2. v1 Scope — What Is Included

- **One visa category only:** Vietnam E-Visa (up to 90 days, single or multiple entry, all nationalities)
- **One application system:** `evisa.gov.vn`
- **Schema extraction:** all sections, fields, options, requiredness, and conditional logic for the general-purpose e-Visa journey
- **Dynamic form rendering:** via existing `visa_form_fields` + `DynamicStepForm`
- **No automated submission** in v1 — `evisa.gov.vn` is a modern React/Ant-Design SPA with device fingerprinting and Vietnamese-side CAPTCHA, and VIZA's "prefill assistant, human submits" model (per DS-160) applies here too

---

## 3. Out-of-Scope Visa Categories (v1)

The following Vietnam visa categories are **explicitly excluded** from
v1. They use different application journeys (embassy/consulate,
sponsor-required) with different field sets.

| Category | Code | Reason for exclusion |
|----------|------|---------------------|
| Tourist Visa (embassy-issued) | DL | Embassy/consulate lodgement, sponsor letter, different form |
| Business Visa (short) | DN1 | Requires invitation letter from Vietnamese enterprise |
| Business Visa (long) | DN2 | Sponsor-required, longer processing |
| Investor Visa | DT1 / DT2 / DT3 / DT4 | Investment threshold, capital evidence |
| Student Visa | DH | Admission documents, sponsor institution |
| Work Permit Visa | LD1 / LD2 | Work permit required as pre-condition |
| Diplomatic / Official | NG1–NG4 | Government-to-government issuance |
| Visa-on-Arrival | — | Deprecated for most nationalities since Aug 2023; still available via pre-approval letter for specific airports only |
| Family reunification (long-stay) | TT | Marriage/relative documentation, embassy lodgement |

Future iterations can add them as additional `visa_type` entries and
seed scripts.

---

## 4. Known Source-Flow Ambiguities

The following ambiguities were identified during scope analysis and are
documented rather than silently assumed:

1. **Language surface.** `evisa.gov.vn` ships in English and
   Vietnamese. Field labels and option text differ between the two
   surfaces. v1 captures the English surface only; Vietnamese labels
   are a v1.1 concern.

2. **Province / city input.** The real form lets users free-text the
   province as well as pick from a dropdown. The seed's 11-entry
   enum (`PROVINCES` constant) covers the most common destinations
   plus an `other_province` escape hatch; power users who need a
   specific less-common province should use the escape hatch and
   record detail in the residential-address textarea.

3. **Border-gate enum subsetting.** As of 2024 Vietnam has ~42
   designated e-Visa-eligible ports (13 airports + 16 land + 13 sea).
   v1 captures the 11 most-used ports plus `other_port`. Power users
   entering via less-common ports should use the escape hatch; v1.1
   should close this gap.

4. **Purpose-of-entry options.** The extension observed 5 purposes on
   the live form (Tourist, Visiting relatives, Business, Working,
   Other). The Vietnam Immigration Department's category guidance
   lists ~20 sub-purposes (DL, DN, DT, DH, LD, etc.) — but
   `evisa.gov.vn` collapses them to this 5-option umbrella and
   derives the correct category server-side. We mirror the form
   surface, not the legal category list.

5. **Multi-entry fee differences.** Single-entry ($25) and
   multiple-entry ($50) differ only in price and visa-validity
   length, not in the captured field set. Fee logic is a
   post-submission concern handled by the payment gateway — out of
   schema.

6. **Previous Vietnam visits window.** The form asks about prior
   visits but does not specify a look-back window. v1 defaults to
   5 years (`visited_vietnam_before`). This matches most visa
   portals' practice but should be verified on the next live-portal
   QA pass.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

The Vietnam schema must be grounded in the actual `evisa.gov.vn`
application flow. Hand-written or partially copied field lists are
not acceptable proof of parity. Any fields that cannot be verified
against the official source are flagged in the gap report.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'VN_E_VISA'` (81 rows) |
| `visa_packages` table | New row registered via Drizzle migration `0012_vn_e_visa_package.sql` (`country = 'vietnam'`) |
| Seed script | `scripts/seed-vn-e-visa-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | None in v1 — manual submission by user on `evisa.gov.vn` |
| Answer storage | Existing `visa_application_answers` table |

---

## 7. How the Vietnam Schema Was Derived

The primary source for the Vietnam E-Visa field inventory is the
in-repo **`vietnam-visa-helper-v1/`** browser extension (v1.2.1). This
extension is a Chrome/Edge Manifest V3 plugin that was developed and
tested against the live `evisa.gov.vn` form to auto-fill Chinese
applicants' data. Its `background.js` contains a complete
`fieldMappings` object — the field keys, labels, placeholders, and
enumerated options it maps to the live DOM are the ground truth for
what the form asks.

The process:

1. **Identified the canonical journey:** Vietnam E-Visa (general
   e-Visa) — the only Vietnam visa product issuable fully online.
2. **Extracted fields from the extension:** every entry in
   `background.js` `fieldMappings` was catalogued, deduplicated, and
   grouped by logical section.
3. **Mapped sections to steps:** 10 logical sections were derived
   from the section comments and user-journey README.
4. **Captured field metadata:** every field was mapped to a
   `FieldDef` with field_name, label, field_type, required flag,
   options (for select/radio), and conditional_logic (showIf).
5. **Added conditional branches:** under-18, multiple-nationalities,
   other-passports, purpose sub-journeys, relatives-in-Vietnam,
   previous-visits, and company-expense-coverage gates were all
   expressed via `conditional_logic.showIf`.
6. **Documented gaps:** every field or branch that could not be
   confirmed against the live form (because `evisa.gov.vn` is behind
   an agree-and-start gate and cannot be driven by WebFetch) is
   documented in `docs/vietnam-visa-gap-report.md`.

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-vn-e-visa-form-fields.ts`
2. Run: `npx tsx scripts/seed-vn-e-visa-form-fields.ts`
3. Verify output: `Done: N rows seeded (N defined)` with matching N's
4. No frontend deployment needed — the dynamic form reads from DB at runtime

### How to Add a Related Vietnam Visa Category

1. Copy the seed script to `seed-vn-<category>-form-fields.ts` (e.g. `seed-vn-dn1-business-form-fields.ts`)
2. Change `VISA_TYPE` to a new key (`VN_DN1_BUSINESS`, `VN_DL_TOURIST`, etc.)
3. Update the `FIELDS` array
4. Add a Drizzle migration inserting into `visa_packages`
5. Run the seed
6. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)
1. **Live-portal QA pass** — walk the 81-field seed against the live
   `evisa.gov.vn` form with a throwaway account, reconcile any
   observed drift (labels, option text, new/removed fields).
2. **Verify cross-step conditionals still work** — `purpose_of_entry`
   (step 5) gates Step 8 sub-journey fields; ensure `DynamicStepForm`
   seeds its values state from the full prefill (see playbook §5.3).
3. **Verify the `||` operator** in `expense_coverage === company || expense_coverage === sponsor` (step 9 sponsor_details) renders as expected.

### Short-term (v1.1)
4. **Expand border-gate enum** to the full ~42-port list published by the Ministry of Public Security.
5. **Add Vietnamese-language labels** as a parallel surface for the Vietnamese-speaking applicant population.
6. **Add a purpose-specific document checklist** (tourism: return ticket + hotel booking; business: invitation letter; working: labour contract) — lives in `application_documents`, not this schema.

### Medium-term (v2)
7. **Embassy Tourist Visa (DL)** as a separate package — different
   lodgement channel, sponsor letter required, longer processing.
8. **DN1 / DN2 Business Visa** packages — invitation letter handling,
   Vietnamese enterprise sponsor linkage, work-permit gating.
9. **evisa.gov.vn Playwright automation** — if automated submission
   is desired (follow the CEAC/DS-160 pattern; expect CAPTCHA handling and payment-page handoff-at-sign).

---

## 9. Source material checklist (honesty disclosure)

- [ ] Live portal was driven end-to-end: **no** — `evisa.gov.vn` is
      behind an agree-and-start gate and cannot be automated by
      WebFetch/WebSearch inside this harness. The in-repo extension
      was driven manually by a human tester (v1.2.1 test reports in
      `vietnam-visa-helper-v1/test_report.md`) but we have not
      replicated that walk for this extraction pass.
- [ ] Published application PDF consulted: **no** — Vietnam does not
      publish a static PDF of the e-Visa form; the only authoritative
      source is the live SPA.
- [ ] Caseworker guidance consulted: partially — Vietnam Immigration
      Department public FAQ on `evisa.gov.vn` was read for eligibility,
      fees, and durations.
- [ ] Legal basis consulted: yes — Resolution 127/NQ-CP (15 Aug 2023,
      all-nationality eligibility and 90-day extension), Law on Entry,
      Exit, Transit and Residence of Foreigners (51/2019/QH14).
- [ ] Live-portal QA pass completed: **no — must be yes before
      production**. This is the top Immediate action above.
