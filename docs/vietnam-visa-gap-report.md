# Vietnam E-Visa — Gap Report

**Generated:** 2026-04-24 (v2 — live-portal aligned)
**Schema version:** v2 (seed-vn-e-visa-form-fields.ts)
**Visa type:** `VN_E_VISA`

Goal: when a user is assigned the Vietnam E-Visa package, their
`/application` page renders a 1:1 schema match of what they would see
on the live `evisa.gov.vn` form.

**Status: 100% structural parity achieved.** 60 seed fields ↔ 60 live
`.ant-form-item`s; 9 of 9 scrapable select option lists captured
verbatim; every field carries its live DOM `id` via
`validation_rules.live_dom_id`. See
`docs/vietnam-visa-qa-report-2026-04-24.md` for the live-portal recon
methodology and the full v1→v2 diff.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Personal Information | 1 | 13 | Repeatable `other_nationalities` gated on `has_multiple_nationalities === yes` (max 3); `has_violated_vietnam_laws` gate feeds the step-9 details textarea |
| Requested Information | 2 | 3 | Single/multi radio + inline `visa_validity` pair (`visa_valid_from` / `visa_valid_to`) |
| Passport Information | 3 | 5 | Inline pair `passport_dates` (issue/expiry); `passport_type` enum has 4 live-scraped values |
| Contact Information | 4 | 7 | Block group `emergency_contact` (4 fields); flat permanent + contact address + phone |
| Occupation | 5 | 6 | Flat, no conditionals; `occupation` enum has 7 live-scraped values |
| Information About the Trip | 6 | 18 | Unconditional declare-temporary-residence checkbox in section (live order); block group `relatives_in_vn` gated on `has_relatives_in_vietnam === yes`; `visited_vietnam_purpose_detail` gated on `visited_vietnam_in_last_year === yes`; purpose/province/border-entry/border-exit all live-scraped enums |
| Accompanying Children Under 14 | 7 | 3 | Repeatable group `accompanying_children` (`child_full_name`, `child_sex`, `child_date_of_birth`); portrait-photo column is a document upload, out-of-schema per playbook §5.6 |
| Trip Expenses & Insurance | 8 | 3 | `bought_travel_insurance` and `expense_coverage` both live-scraped selects (insurance Yes/No; coverage Myself/Other — no third "Sponsor" option on the live form) |
| Declaration | 9 | 2 | `violation_of_vietnam_laws_details` gated on `has_violated_vietnam_laws === yes`; single `final_declaration` checkbox (live has ONE consent, not three) |
| **Total** | **9** | **60** | Matches live `.ant-form-item` inventory 1:1 |

---

## 2. Purpose Options (Step 6)

`purpose_of_entry` carries the 5 live-scraped values in the exact order
the live `.ant-select` surfaces them:

1. `tourist` — Tourism
2. `visiting_relatives` — Visiting relatives
3. `working` — Working
4. `business` — Business
5. `other_purpose` — Other

**Correction from v1:** no purpose sub-journeys are rendered on the
live form. The v1 seed assumed `purpose_of_entry === business` unlocks
`inviting_company_*`, `purpose_of_entry === working` unlocks
`work_permit_number`, etc. None of those fields exist on the live
form — all sub-journey context goes into `visited_vietnam_purpose_detail`
(when applicable) or is captured implicitly via occupation and
accommodation. The v2 seed removed all purpose-sub-journey fields.

Relatives-in-Vietnam follow-ups (`relative_full_name_in_vn`,
`relative_date_of_birth`, `relative_nationality`,
`relative_relationship`, `relative_address_in_vn`) live in step 6 and
gate on `has_relatives_in_vietnam === yes`, independent of purpose.

---

## 3. Remaining Limitations

### 3.1 Ward / commune is a dependent select (no inline options)

**Status:** open — driver-layer handoff
**Impact:** Low

`intended_ward_commune` is modeled as a `select` with
`dependent_on: "intended_province_city"` and an empty inline options
array. The live form fetches commune options server-side on province
change. Downstream submission automation must set the province first,
then re-read the commune select. This is an automation concern, not a
schema gap.

**Workaround:** driver-layer cascade — documented as a handoff point in
the QA report §6.

### 3.2 `residential_address_in_vietnam` is a dependent-select on live but text in seed

**Status:** open — driver-layer handoff
**Impact:** Low

The live form renders this as a province-dependent address select
(likely pre-populated from a hotel/host-family directory). The seed
models it as `text` with `live_control: "dependent_select"` annotation
so applicants can enter a verbatim hotel or host-family address without
being blocked on Vietnam's full address hierarchy dataset.

**Workaround:** driver-layer resolves the free-text to the nearest live
option, or a human reviewer confirms the dropdown selection before
submit.

### 3.3 Document uploads are out-of-schema

**Status:** intentional — per playbook §5.6
**Impact:** None (expected)

The live form uploads two top-level files (passport photo, passport
data-page scan) plus one portrait photo per accompanying child. These
live in `application_documents`, not `visa_form_fields`. The reviewer
must ensure the document-upload UI surfaces all three artifacts before
submission.

### 3.4 Multi-entry visa fee differences not modelled

**Status:** intentional
**Impact:** None (expected)

The $25 vs $50 price difference between single-entry and multiple-entry
is a payment-gateway concern, not a schema concern. `visa_type_requested`
captures the applicant's choice; fee derivation happens downstream.

### 3.5 Vietnamese-language surface not provided

**Status:** open
**Impact:** Low (English is the dominant applicant language)
**Workaround:** None in v2; v2.1 should add Vietnamese labels as a
parallel surface using the same DOM ids as the join key.

### 3.6 Nationality lists not duplicated in seed

**Status:** intentional
**Impact:** None (expected)

`nationality` and `relative_nationality` both carry
`validation_rules.source: "ISO3166-1"`; the renderer sources the
~250-entry country list from that. The live form's virtual-scroll
country select was spot-checked but not enumerated — expected to match
ISO 3166-1.

---

## 4. Closed in v2 (live-portal alignment pass)

All v1 limitations that were parity-related are now closed:

- ✅ Live-portal QA completed — v1 flagged this as top priority; v2
  captured the form via Playwright recon-v3 (see
  `docs/vietnam-visa-qa-report-2026-04-24.md`).
- ✅ Province / city enum exact — live has 34 provinces post-2025
  reorganization (Resolution 60/NQ-TW, June 2025, 63 → 34 consolidation).
  Seed matches 1:1, no `other_province` escape needed.
- ✅ Border-gate enum exact — 79 live ports captured; seed matches 1:1,
  no `other_port` escape needed. (v1 had a 12-entry subset with
  `other_port` escape hatch.)
- ✅ Previous-visit look-back window corrected — v1 assumed 5 years;
  live prompt reads verbatim "in the last 01 year". Seed field renamed
  from `visited_vietnam_before` to `visited_vietnam_in_last_year`.
- ✅ Declaration collapsed — v1 had 3 consents; live has 1. Seed now
  has a single `final_declaration` field.
- ✅ Purpose sub-journeys removed — v1 assumed business/working/visiting
  branches each unlocked bespoke fields; live does not branch. Seed
  removed all sub-journey fields.
- ✅ Children table aligned — v1 conflated "applicant is under 18 +
  accompanying adult" with the live "accompanying children under 14"
  table. Seed now uses the 3-column repeatable group that matches the
  live `<a-table>` schema (name / sex / DOB; portrait photo as
  document).
- ✅ Sponsor branch removed — v1 had a 3-option `expense_coverage`
  (personal / company / sponsor); live has 2 (Myself / Other). Seed
  corrected; sponsor sub-fields removed.

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators

`lib/form-utils.ts` `evaluateShowIf` splits on `||` then `&&` and
evaluates each atom with `===` / `!==`. Multi-value gating works
(confirmed by UK Phase 2 and Schengen v1.1). The v2 Vietnam seed does
not currently use `||` — the sponsor branch that did was removed in
the alignment pass.

### 5.2 Cross-step conditionals

The relatives block (step 6) is same-step, so no cross-step gating is
required in v2. `has_violated_vietnam_laws` (step 1) gates
`violation_of_vietnam_laws_details` (step 9) — this cross-step
conditional is validated by `DynamicStepForm` seeding its `values` state
from the full `prefill` (playbook §5.3).

### 5.3 `in` / `not in` list-membership operator

Added in Schengen v1.1. Not used by the Vietnam seed. Available for
v2.1 if nationality-based rules need to be expressed.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent

`scripts/seed-vn-e-visa-form-fields.ts` deletes all rows with
`visa_type = 'VN_E_VISA'` then re-inserts. Safe to re-run.

### 6.2 Live DOM id annotations

Every scrapable field carries `validation_rules.live_dom_id` with the
Ant Design Vue `id` attribute (e.g. `basic_ttcnHo` for surname,
`basic_ttcdMucDich` for purpose). Downstream Playwright submission
automation can locate each field via `page.locator("#${live_dom_id}")`
without a separate mapping table.

### 6.3 Repeatable groups used

- `other_nationalities` (step 1) — gated on `has_multiple_nationalities === yes`, max 3
- `accompanying_children` (step 7) — unconditional, max 10 (3 fields per row)

### 6.4 Block groups used (visually grouped fields)

- `emergency_contact` (step 4) — name / current address / phone / relationship
- `relatives_in_vn` (step 6) — full name / DOB / nationality / relationship / address, gated on `has_relatives_in_vietnam === yes`

### 6.5 Inline groups used (side-by-side pair rendering)

- `visa_validity` (step 2) — `visa_valid_from` / `visa_valid_to`
- `passport_dates` (step 3) — `passport_issue_date` / `passport_expiry_date`

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [x] Seed applied (60 rows in `visa_form_fields` with visa_type = `VN_E_VISA`)
- [x] Package registered in `visa_packages` via migration `0012_vn_e_visa_package.sql`
- [x] Live-portal QA pass completed against `evisa.gov.vn` (see `docs/vietnam-visa-qa-report-2026-04-24.md`)
- [ ] Assign a test user the `VN_E_VISA` package
- [ ] Walk every step, answer every conditional (`has_multiple_nationalities`, `has_relatives_in_vietnam`, `visited_vietnam_in_last_year`, `has_violated_vietnam_laws`)
- [ ] Test `accompanying_children` repeatable (add/remove rows, values persist)
- [ ] Test cross-step gating (`has_violated_vietnam_laws` step 1 → `violation_of_vietnam_laws_details` step 9)
- [ ] Submit a test application — verify all 60 answers persist to `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
- [ ] Drive a fill-and-submit pass through the live `evisa.gov.vn` portal with a throwaway account to confirm the server accepts the slug values we generated from the live option text

---

## 8. Source Material

The v2 schema is a **live-portal capture**, not a reconstruction.

- **Primary source (v2):** Playwright recon captured on 2026-04-24 via
  `viza-be/submission-service/src/vietnam/form-recon-v3.ts` against
  `https://evisa.gov.vn/e-visa/foreigners`. Output artifacts in
  `viza-be/submission-service/vn-recon-out-v3/canonical.json` (60 fields
  + 9 select option lists keyed by DOM id).
- **v1 basis (superseded):** `vietnam-visa-helper-v1/background.js`
  in-repo browser extension (v1.2.1). Used for the initial field
  inventory; corrected wholesale in v2 by the live recon.
- **Legal basis:**
  - Resolution 127/NQ-CP (15 August 2023) — 90-day e-Visa,
    all-nationality eligibility, single/multiple entry
  - Resolution 60/NQ-TW (June 2025) — province consolidation 63 → 34
  - Law on Entry, Exit, Transit and Residence of Foreigners in Vietnam
    (51/2019/QH14, as amended)
- **Policy reference:** Vietnam Immigration Department public FAQ on
  `evisa.gov.vn` (fees, validity, eligible ports of entry).

**Expected drift:** border-gate list (growing; 79 ports today), province
list (stable after June 2025 consolidation), label wording
(quarterly-ish). Re-validate against the live portal **quarterly**, and
whenever Vietnam Immigration Department announces a policy change. The
`form-recon-v3.ts` tool is the canonical diff driver — re-run it to
regenerate `canonical.json` and diff against the current seed.
