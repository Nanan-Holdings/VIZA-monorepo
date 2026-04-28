# Indonesia C1 Tourist Single Entry Visa — Gap Report

**Generated:** 2026-04-27
**Updated:** 2026-04-28 (post live-walk patch)
**Schema version:** v1.1 (`seed-id-c1-tourist-form-fields.ts`)
**Visa type:** `ID_C1_TOURIST`
**Walk report:** `docs/indonesia-visa-walk-report.md`

Goal: when a user is assigned the `ID_C1_TOURIST` package, their
`/application` page renders a 1:1 schema match of the official Indonesia
C1 Visit Visa Wisata journey on `evisa.imigrasi.go.id` (the unified
portal that replaced `molina.imigrasi.go.id` in 2024). Note that the
live portal is identity-gated behind WNA account registration, so the
v1 schema is a reconstruction — not a live-portal capture. A live-portal
QA pass is the top open item before production.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Personal Information | 1 | 17 | Other-names gate, other-nationalities repeatable, marital-status spouse block, mother's name (Indonesian-immigration-required) |
| Passport / Travel Document | 2 | 10 | Other-passports gate + repeatable group; covers travel-document holders |
| Contact & Home Address | 3 | 8 | `home_address` block group with optional state/postcode |
| Occupation | 4 | 5 | `employer_details` block group |
| Trip Details | 5 | 12 | Tourism purpose locked; `trip_dates` inline group; `accommodation_details` block group; flight number captured |
| Sponsor in Indonesia | 6 | 12 | Full block gated on `has_sponsor_in_indonesia`; nested `sponsor_type === individual / corporate` branches; corporate captures NIK / NIB / **NPWP (added v1.1 from live-walk)** |
| Travel History | 7 | 9 | Repeatable `prior_indonesia_visits` (with prior visa type); refusals (Indonesia + other-country) gated |
| Character & Declaration | 8 | 10 | Criminal / deportation / overstay gated; declaration checkbox |
| **Total** | **8** | **83** | — |

Field count source: `Done: 83 rows seeded (83 defined)` from the seed
runner against live Supabase on 2026-04-28 (post live-walk v1.1 patch).

---

## 2. Purpose Options (Step 5)

`ID_C1_TOURIST` is a **single-purpose** package: `purpose_of_visit` is
locked to `tourism` for v1. Adjacent Indonesia visit-visa categories
have moved to their own Single Entry codes under the 2024 framework and
belong on future packages:

- `ID_B1_EVOA` — Visa on Arrival (30 days, separate portal
  `indonesiavoa.vfsevisa.id`)
- `ID_C2_BUSINESS_VISIT` — short-term business visit
- `ID_C7_INVESTOR` / `ID_C18_PRE_INVESTMENT` — investor / pre-investment
- `ID_D1_VISIT_MULTI` — multiple-entry visit visa
- `ID_KITAS_*` — Limited Stay Permits (work, investor, family,
  retirement)

These are deferred because the field set diverges meaningfully (sponsor
becomes mandatory; financial / employment evidence is heavier; long-stay
adds the telex visa + post-arrival ITAS flow).

---

## 3. Remaining Limitations

### 3.1 Live-portal QA — Partial (registration form walked, application form gated)

**Status:** Public pages + WNA registration form walked live on
2026-04-28; post-registration C1 application form remains gated behind
account provisioning
**Impact:** Medium — registration / identity-gate fields are
live-confirmed; application-form fields (steps 3-8) still reconstructed
**Recon archive:** `docs/indonesia-visa-recon-2026-04-28.json`
**Walk report:** `docs/indonesia-visa-walk-report.md`

What was confirmed live (28 DOM inputs / 18 visible) on
`/front/register/wna`:
- Document type select (`document_travel_id`, 14 UUID-keyed options)
- `full_name` (single field — seed splits to surname + given_names;
  runner concatenates)
- `gender` radio MALE / FEMALE (uppercase on live; runner case-folds)
- `birth_place` (single free-text — seed splits to city + country;
  runner concatenates)
- `birthday` (DD/MM/YYYY)
- `phone_code` (262 country dial codes) + `mobile_phone` (split — seed
  has free-text telephone/mobile; runner extracts +dial-code prefix)
- `mother` (REQUIRED — Indonesian-immigration-specific, confirmed)
- Passport block: `passport_number` (id=`number`), `country_id`
  (228 countries), `release_date` (issue), `expired_date`,
  `release_place`
- Account credentials: `_username`, `confirm_email`, `_password`,
  `_confirm_password`

What was confirmed live on `/front/register/guarantor-register`
(corporate sponsor block):
- `npwp` (Indonesian Tax ID, REQUIRED — **added to seed v1.1**)
- `NO_NIB` (Business Registration, OPTIONAL — **seed v1.1 demoted from
  required**)
- `agencyType` / `businessType` UUID enums (organisation classifiers —
  not added to seed; corporate-side metadata)
- Granular Indonesian address (`address` + `no` + `rt` + `rw` +
  `postal_code` + `province_name` + `city_name` + `district_name` +
  `village_name` — deferred to v1.1; runner splits the seed's single
  `sponsor_address` text on submission)

What is still gated and unverified:
- Marital status / spouse block requiredness
- Occupation block layout
- Trip details (arrival / port-of-entry / accommodation structure)
- Travel history + refusals / character questions
- The actual page count / step boundaries on the post-registration
  application form (seed assumes 8 steps; live portal may differ)
- `passport_issuing_authority` (seed has it; not on registration form)

**Workaround:** Patch the seed once a WNA account is provisioned and
the gated walk completes. Schema names are runner-agnostic; live-portal
UUID enums and field-name drift (e.g. `release_date` vs
`passport_issue_date`) are translated at submission time, not in the
schema.

### 3.2 No automated submission

**Status:** Out of scope for this package
**Impact:** Medium

Unlike `US_DS160` (CEAC automation), `EU_SCHENGEN_C_SHORT_STAY`
(France-Visas automation), and `AU_VISITOR_600` (ImmiAccount
stop-at-review), `ID_C1_TOURIST` has no automation pipeline. The eVisa
portal is identity-gated; recon has not been performed.

**Why deferred:** Schema-only build delivers immediate value (answer
collection, validation, dynamic rendering). Submission automation is a
v1.1 / v2 expansion gated on Playwright recon against the live portal.

**Workaround:** Users complete the C1 application themselves on
`evisa.imigrasi.go.id` after VIZA has gathered, validated, and exported
their answers.

### 3.3 Document uploads are out of schema (per playbook §5.6)

**Status:** Documents live in `application_documents`, not
`visa_form_fields`
**Impact:** Low

Required supporting documents — passport bio page, color photo (red or
white background), return / onward ticket, bank statement (USD 2,000+
for the last 3 months) — are tracked in the existing
`application_documents` table per playbook convention.

**Workaround:** None needed; this is the standard pattern.

### 3.4 Sponsor block is reconstructed, not live-confirmed

**Status:** Schema present; gated on `has_sponsor_in_indonesia === yes`
**Impact:** Medium for sponsor-pathway applicants

The standard C1 pathway via `evisa.imigrasi.go.id` is self-applied (no
sponsor). The extendable C1 pathway via `visa-online.imigrasi.go.id`
requires an Indonesian guarantor (individual NIK or corporate NIB).
The sponsor block in the schema is reconstructed from public DGI
guidance on the extendable pathway, not from a live portal walk.

**Workaround:** When the first sponsor-pathway user submits, capture
field-label drift and patch.

### 3.5 NIK / NIB validation is pattern-only

**Status:** Format pattern enforced (`^[0-9]{16}$` for NIK; max-length
for NIB); no checksum or registry verification
**Impact:** Low

NIK is a 16-digit Indonesian national ID; NIB is up to 13–20 digits
depending on issuing year. The schema validates length/format only —
DGI verifies against the registry server-side at submission time.

**Workaround:** None. Server-side validation at submission catches
typos.

### 3.6 Mother's name is required by Indonesian immigration

**Status:** Captured as a required field (`mother_full_name` step 1)
**Impact:** Cross-country surprise

The Indonesian eVisa explicitly asks for the applicant's mother's full
name on the WNA registration form. This is uncommon among other VIZA
country schemas (UK, JP, AU, VN, Schengen do not ask). Documenting
explicitly so cross-country renderers don't strip it as redundant.

---

## 4. Closed in this version

### 4.1 v1.1 (2026-04-28 — post live-walk patch)

- Live walk against `evisa.imigrasi.go.id` public + WNA registration
  pages completed; recon archive at
  `docs/indonesia-visa-recon-2026-04-28.json`; narrative at
  `docs/indonesia-visa-walk-report.md`.
- Walk-recon driver committed at
  `viza-be/submission-service/scripts/walk-id-evisa.ts` for re-runs
  (public + optional `--login` arm).
- WNA registration form field set confirmed live (18 visible / 28 DOM
  inputs); identity-gate fields validated against the seed.
- `mother_full_name` confirmed REQUIRED on the live portal.
- `sponsor_corporate_npwp` added to seed (required when
  `sponsor_type === corporate`) — captured live on
  `/front/register/guarantor-register`.
- `sponsor_corporate_nib` demoted to optional — live form shows it
  unflagged.
- Field count: 82 → 83.
- Coverage delta documented per-step in §1 of the walk report.

### 4.2 v1 (2026-04-27)

First release of `ID_C1_TOURIST`. 82 fields, 8 steps; pure-dynamic
rendering; no submission automation.

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators

`evaluateShowIf` in
`viza-fe/internal-website/lib/form-utils.ts` supports both. Not used in
v1 — every `ID_C1_TOURIST` gate is a single-atom comparison
(`HAS_SPONSOR`, `SPONSOR_IS_INDIVIDUAL`, etc.). If future steps add
multi-value gates, the operator is available.

### 5.2 Cross-step conditionals

Not used in v1 — every `showIf` parent lives in the same step as the
gated field. The `DynamicStepForm` cross-step seeding behaviour (UK v2
fix) is not exercised here.

### 5.3 List membership operator (`in` / `not in`)

Not used in v1. `ID_C1_TOURIST` has no nationality-list-gated branches
(unlike Schengen Annex I which uses `current_nationality in [...]` for
ATV / fingerprint waivers). If DGI introduces nationality-conditional
fields (e.g. visa-free arrangements for ASEAN nationals affecting which
sub-questions appear), the operator is available.

### 5.4 Repeatable groups

| Group | Step | Max items | Gate |
|-------|------|-----------|------|
| `other_nationalities` | 1 | 3 | `has_other_nationalities === yes` |
| `other_passports` | 2 | 3 | `has_other_passports === yes` |
| `prior_indonesia_visits` | 7 | 5 | `visited_indonesia_before === yes` |

### 5.5 Nested gating (sponsor branches)

Step 6 uses two-level gating: the entire sponsor block is gated on
`has_sponsor_in_indonesia === yes`, then individual-vs-corporate
fields branch on `sponsor_type === individual` / `sponsor_type ===
corporate`. Both are single-atom — no `||` / `&&` needed.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent

`scripts/seed-id-c1-tourist-form-fields.ts` deletes all rows with
`visa_type = 'ID_C1_TOURIST'` then re-inserts. Safe to re-run.

### 6.2 Block groups used

`place_of_birth` (step 1), `spouse` (step 1), `home_address` (step 3),
`employer_details` (step 4), `accommodation_details` (step 5),
`sponsor` (step 6).

### 6.3 Inline groups used

`passport_dates` (step 2), `trip_dates` (step 5).

### 6.4 No frontend changes

Per playbook §6, `DynamicStepForm` renders every field generically. No
country-specific React was added.

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [ ] Seed applied (82 rows in `visa_form_fields` with
      `visa_type = 'ID_C1_TOURIST'`)
- [ ] Package registered in `visa_packages` via migration 0022
- [ ] Assign a test user the `ID_C1_TOURIST` package
- [ ] Walk every step, answer every conditional, trigger every
      sub-block (other-names, other-nationalities, married,
      other-passports, has-sponsor → individual / corporate,
      visited-indonesia, refused-indonesia, refused-other-country,
      criminal, deported, overstayed)
- [ ] Test every repeatable group (`other_nationalities`,
      `other_passports`, `prior_indonesia_visits`) — add / remove
      instances, values persist
- [ ] Test nested sponsor gating (`has_sponsor` → `sponsor_type` →
      individual NIK fields vs corporate NIB fields)
- [ ] Submit a test application — verify all 82 answers persist to
      `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
- [ ] **Live-portal QA pass against `evisa.imigrasi.go.id`** — register
      a WNA account, walk the C1 application, capture any drift in
      field labels, requiredness, options, or gating; patch the seed
      and re-run

---

## 8. Source Material

This schema is a **reconstruction** from public Indonesian Directorate
General of Immigration documents and the live WNA registration form
fields. The post-registration C1 application flow has not been driven
end-to-end; live-portal QA is deferred per §3.1.

- eVisa WNA registration form (live):
  `https://evisa.imigrasi.go.id/front/register/wna`
- eVisa C1 Visit Visa info:
  `https://evisa.imigrasi.go.id/front/info/evoa`
- eVisa General Information FAQ:
  `https://evisa.imigrasi.go.id/front/faq/aff9642b-0b57-443f-8de1-a51601de0ebb`
- DGI guidance — Visa Kunjungan Wisata:
  `https://www.imigrasi.go.id/berita/2023/03/10/begini-prosedur-dan-syarat-penggunaan-visa-kunjungan-wisata-dari-website-molina-imigrasi?lang=en-US`
- DGI guidance — single entry visa framework 2024–2025
- DGI guidance — what to do if eVisa form contains errors:
  `https://www.imigrasi.go.id/berita/2023/05/11/what-to-do-if-you-accidentally-filled-out-the-wrong-information-in-the-electronic-visa-form-and-it-was-submitted?lang=en-US`

Expected drift: DGI revises the eVisa journey periodically (the move
from molina to evisa.imigrasi.go.id in 2024 is the most recent example).
The most likely sources of drift are (a) sponsor block field labels on
the extendable-C1 pathway, and (b) accommodation / port-of-entry
free-text vs select. Re-validate quarterly per playbook §8.
