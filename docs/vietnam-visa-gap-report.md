# Vietnam E-Visa — Gap Report

**Generated:** 2026-04-24
**Schema version:** v1 (seed-vn-e-visa-form-fields.ts)
**Visa type:** `VN_E_VISA`

Goal: when a user is assigned the Vietnam E-Visa package, their
`/application` page renders a 1:1 schema match of what they would see
on the live `evisa.gov.vn` form.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Personal Details | 1 | 16 | Repeatable `other_nationalities` gated on `has_multiple_nationalities === yes` (max 3); accompanying-adult block gated on `is_applicant_under_18 === yes` |
| Passport & Identity Documents | 2 | 9 | Inline pair `passport_dates`; repeatable `other_passports` gated on `has_other_passports === yes` (max 3) |
| Contact Details | 3 | 7 | Block group `home_address` |
| Occupation | 4 | 6 | Flat, no conditionals |
| Trip Information | 5 | 10 | Inline pair `trip_dates`; repeatable `previous_vn_visits` gated on `visited_vietnam_before === yes` (max 5); `other_purpose_detail` gated on `purpose_of_entry === other_purpose` |
| Accommodation in Vietnam | 6 | 4 | Enum `intended_province_city` with 11 entries incl. `other_province` escape |
| Border Gates | 7 | 2 | Enum of 12 ports (11 specific + `other_port`) reused across entry/exit |
| Purpose-Specific Details | 8 | 11 | Block groups `inviting_company` (business), `working_details` (working), `relative_in_vn` (relatives toggle); multi-purpose via `showIf` |
| Trip Expenses & Emergency Contact | 9 | 11 | Block group `sponsor_details` gated on `expense_coverage === company \|\| expense_coverage === sponsor`; block group `emergency_contact` always shown |
| Declaration | 10 | 5 | `violation_of_vietnam_laws_details` gated on `violation_of_vietnam_laws === yes`; 3 always-required consents (temporary residence, account creation, truthfulness) |
| **Total** | **10** | **81** | — |

---

## 2. Purpose Options (Step 5)

`purpose_of_entry` captures the 5-option umbrella that the live form
surfaces. Server-side, the Vietnam Immigration Department derives the
correct legal category (DL / DN / LD / etc.) from the combination of
purpose, occupation, sponsor, and accommodation — VIZA does not need
to replicate that derivation.

- `tourist` — Tourism (→ DL downstream)
- `visiting_relatives` — Visiting relatives (→ TT / DL downstream)
- `business` — Business (→ DN1/DN2 downstream)
- `working` — Working, short-term (→ LD1/LD2 downstream)
- `other_purpose` — Other (free-text `other_purpose_detail` captures the detail)

Each purpose unlocks a bespoke sub-journey in Step 8:
- `business` → `inviting_company_name`, `inviting_company_address`, `inviting_company_phone` (block_group `inviting_company`)
- `working` → `work_permit_number`, `employer_in_vietnam` (block_group `working_details`)
- `visiting_relatives` → `visiting_relatives_purpose_detail` textarea
- `has_relatives_in_vietnam === yes` (any purpose) → relative name / relationship / address / phone (block_group `relative_in_vn`)

`tourist` and `other_purpose` have no Step 8 sub-journey — they rely on Step 6 (accommodation) for location and Step 9 (expenses) for funding.

---

## 3. Remaining Limitations

### 3.1 Live-portal QA pass not done

**Status:** open — top priority before production
**Impact:** High

The schema is a reconstruction from the in-repo
`vietnam-visa-helper-v1` extension (v1.2.1), which was itself tested
manually against the live form. No fresh live-portal walk has been
done as part of this extraction pass.

**Why deferred:** `evisa.gov.vn` is a modern SPA behind an
agree-and-start gate; WebFetch/WebSearch inside this harness cannot
drive it.

**Workaround:** the extension's field-mapping table is stable enough
to render the form; staff must still review output against the live
portal with a throwaway account before the first real user is
assigned this package.

### 3.2 Province / city enum is subset

**Status:** open
**Impact:** Medium

The live form allows typing a free-text province as well as choosing
from a dropdown. Our enum covers the 10 most common destinations plus
`other_province`. Applicants travelling to less-common provinces can
use the escape hatch and record detail in the residential-address
textarea, but the enum should be expanded to the full 63 provinces in
v1.1.

**Workaround:** `other_province` escape + residential-address textarea captures intent.

### 3.3 Border-gate enum is subset of ~42 ports

**Status:** open
**Impact:** Medium

Vietnam designates ~42 e-Visa-eligible ports (13 airports + 16 land +
13 sea). Our enum covers the 11 most-used ports plus `other_port`.
Same escape-hatch pattern as provinces.

**Workaround:** `other_port` escape, full list expansion planned v1.1.

### 3.4 Document uploads are out-of-schema

**Status:** intentional — per playbook §5.6
**Impact:** None (expected)

The live form uploads two files: passport photo (portrait) and
passport data-page scan. These live in `application_documents`, not
`visa_form_fields`. The reviewer must ensure the document-upload UI
on the assigned-package flow surfaces both artifacts before
submission.

### 3.5 Multi-entry visa fee differences not modelled

**Status:** intentional
**Impact:** None (expected)

The $25 vs $50 price difference between single-entry and
multiple-entry is a payment-gateway concern, not a schema concern.
`visa_type_requested` captures the applicant's choice; the fee
derivation happens downstream.

### 3.6 Vietnamese-language surface not provided

**Status:** open
**Impact:** Low (English is the dominant applicant language)
**Workaround:** None in v1; v1.1 should add Vietnamese labels as a parallel surface.

### 3.7 Previous-visit look-back window is assumed

**Status:** open
**Impact:** Low

The live form asks about prior Vietnam visits but does not specify a
look-back window on the label. v1 asks about the last 5 years as a
sensible default; verify on live-portal QA.

---

## 4. Closed in this version

This is the v1 initial extraction — nothing closed yet. Future
versions should track additions/removals here.

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators

`lib/form-utils.ts` `evaluateShowIf` splits on `||` then `&&` and
evaluates each atom with `===` / `!==`. Multi-value gating works
(confirmed by UK Phase 2 and Schengen v1.1). The sponsor-details
block in Step 9 uses `expense_coverage === company || expense_coverage === sponsor`.

### 5.2 Cross-step conditionals

Step 8 sub-journey fields gate on `purpose_of_entry` (step 5) and
`has_relatives_in_vietnam` (step 8 itself). `DynamicStepForm` seeds
its `values` state from the full `prefill`, so step-5 → step-8
gating works. Verified in UK Phase 2 (playbook §5.3).

### 5.3 `in` / `not in` list-membership operator

Added in Schengen v1.1. Not used by the Vietnam seed in v1 (none of
the gates reference a nationality list). Available for v1.1 if
purpose-specific nationality rules need to be expressed.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent

`scripts/seed-vn-e-visa-form-fields.ts` deletes all rows with
`visa_type = 'VN_E_VISA'` then re-inserts. Safe to re-run.

### 6.2 Repeatable groups used

- `other_nationalities` (step 1) — gated on `has_multiple_nationalities === yes`, max 3
- `other_passports` (step 2) — gated on `has_other_passports === yes`, max 3
- `previous_vn_visits` (step 5) — gated on `visited_vietnam_before === yes`, max 5

### 6.3 Block groups used (visually grouped fields)

`accompanying_adult` (step 1), `home_address` (step 3), `inviting_company`, `working_details`, `relative_in_vn` (step 8), `sponsor_details`, `emergency_contact` (step 9)

### 6.4 Inline groups used (side-by-side pair rendering)

`passport_dates` (step 2), `trip_dates` (step 5)

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [ ] Seed applied (81 rows in `visa_form_fields` with visa_type = `VN_E_VISA`)
- [ ] Package registered in `visa_packages` via migration `0012_vn_e_visa_package.sql`
- [ ] Assign a test user the `VN_E_VISA` package
- [ ] Walk every step, answer every conditional, trigger every sub-journey (tourism, visiting relatives, business, working, other)
- [ ] Test every repeatable group (`other_nationalities`, `other_passports`, `previous_vn_visits` — add/remove instance, values persist)
- [ ] Test `||` gate in sponsor_details (set `expense_coverage = company` and `= sponsor` separately)
- [ ] Test cross-step gating (`purpose_of_entry` step 5 → Step 8 sub-journeys)
- [ ] Submit a test application — verify all 81 answers persist to `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
- [ ] **Live-portal QA pass completed** against `evisa.gov.vn` with a throwaway account — reconcile observed drift

---

## 8. Source Material

The schema is a **reconstruction**, not a live-portal capture. Live-portal QA is required before production.

- **Primary source:** `vietnam-visa-helper-v1/background.js` (in-repo browser extension v1.2.1). The `fieldMappings` object and `userData` sample enumerate the field keys, labels, placeholders, and enumerated options the live `evisa.gov.vn` form asks.
- **Secondary source:** `vietnam-visa-helper-v1/README.md` and `USER_GUIDE_v1.2.1.md` — describe the 4-step user journey (landing → disclaimer → form → submit) and field-by-field guidance text.
- **Secondary source:** `vietnam-visa-helper-v1/content.js` — contains the DOM-matching heuristics the extension uses to map field labels on `evisa.gov.vn` to internal keys; cross-validates the field set in `background.js`.
- **Legal basis:**
  - Resolution 127/NQ-CP (15 August 2023) — 90-day e-Visa, all-nationality eligibility, single/multiple entry
  - Law on Entry, Exit, Transit and Residence of Foreigners in Vietnam (51/2019/QH14, as amended)
- **Policy reference:** Vietnam Immigration Department public FAQ on `evisa.gov.vn` (fees, validity, eligible ports of entry)

**Expected drift:** provinces list (growing), border-gate list
(growing), label wording (quarterly-ish). Re-validate against the
live portal **quarterly**, and whenever Vietnam Immigration
Department announces a policy change.
