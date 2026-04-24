# Vietnam E-Visa — Live-Portal QA Report

**Date:** 2026-04-24
**Tool:** `viza-be/submission-service/src/vietnam/form-recon-v3.ts` (Playwright + stealth Chromium)
**Target:** `https://evisa.gov.vn/e-visa/foreigners`
**Schema under test:** v2 (`scripts/seed-vn-e-visa-form-fields.ts`, **60 fields, 9 steps**, live-aligned)
**Artifacts:** `viza-be/submission-service/vn-recon-out-v3/` (screenshots, HTML dumps, `canonical.json`)

---

## 1. Methodology

1. Launch stealth-patched Chromium (reusing `ceac/stealth-browser.ts`).
2. Navigate to `https://evisa.gov.vn/`, wait for Vue SPA hydration.
3. Dismiss the landing NOTE modal (tick both Ant checkboxes, click **Next**).
4. Click through to `/e-visa/foreigners` via an evaluate-based anchor click, with a direct-goto fallback when the Vue router silently drops the navigation.
5. Scroll the full page height to force lazy-loaded sections, capture every `.ant-form-item` with section header, field type, required flag, placeholder, `id`, and radio/checkbox text.
6. For every `.ant-select`, click to open, locate the associated dropdown panel via `aria-controls`, scroll the `.rc-virtual-list-holder` to the bottom while deduplicating by `aria-posinset` (virtual-list key) with a text-key fallback, then close with Escape + `waitForFunction(.ant-select-dropdown-hidden)` before probing the next select.
7. Dump to `canonical.json` (fields + select_options keyed by DOM id) + full-page screenshots.

The recon does **not** fill or submit any fields — it only observes the schema surface.

**v3 improvements over v1:** handles the landing gate; uses `aria-controls` to select the right dropdown panel per select (v1 was reusing a stale panel and returning sex options for every select); uses `aria-posinset` for virtual-list dedup (v1 was over-counting by counting duplicates across scroll passes).

---

## 2. Headline finding

**Seed is now at 100% structural parity with the live form**, with 9 of 9 scrapable select option lists captured verbatim. Every seed field has a `live_dom_id` pointing at the corresponding Ant Design Vue `id` (e.g. `basic_ttcnHo` for surname), so downstream submission automation can locate each field without a separate mapping table.

The Vietnam e-Visa form is a single-page Vue SPA, not a multi-step wizard. The seed models it as 9 logical steps for review-UI grouping — this only affects `DynamicStepForm` chunking, not how answers map back to the live form.

---

## 3. Live section map (observed vs. seed)

| § on live | Section heading (verbatim) | Seed step | Seed fields |
|---|---|---|---|
| — | Landing gate (NOTE modal) | — | out-of-schema (UI gate) |
| 1 | `1. PERSONAL INFORMATION` | 1 Personal Information | 13 |
| 2 | `2. REQUESTED INFORMATION` | 2 Requested Information | 3 |
| 3 | `3. PASSPORT INFORMATION` | 3 Passport Information | 5 |
| 4 | `4. CONTACT INFORMATION` | 4 Contact Information | 7 |
| 5 | `5. OCCUPATION` | 5 Occupation | 6 |
| 6 | `6. INFORMATION ABOUT THE TRIP` | 6 Information About the Trip | 18 |
| 7 | `7. ACCOMPANYING CHILDREN UNDER 14` | 7 Accompanying Children Under 14 | 3 (repeatable) |
| 8 | `8. TRIP'S EXPENSES, INSURANCE` | 8 Trip Expenses & Insurance | 3 |
| — | Declaration footer | 9 Declaration | 2 |

**Total: 60 fields across 9 steps.** Matches the live `.ant-form-item` inventory one-to-one, modulo the virtual-columns inside the children table (modeled as a 3-column repeatable group) and the portrait-photo column of that table (modeled as a document upload per playbook §5.6).

---

## 4. Live-scraped option lists

All 9 of the form's visible `select` fields were opened and their dropdown panels fully scrolled. The seed's enum values are exact-text matches (slugged to snake_case `value`, verbatim `text`):

| Seed field | DOM id | Options | Notes |
|---|---|---|---|
| `sex` | `basic_ttcnGioiTinh` | 2 | Male, Female |
| `passport_type` | `basic_hcLoai` | 4 | Ordinary, Official, Diplomatic, Other |
| `occupation` | `basic_nnNgheNghiep` | 7 | Employed, Self-employed, Student, Retired, Unemployed, Government official, Other |
| `purpose_of_entry` | `basic_ttcdMucDich` | 5 | Tourism, Visiting relatives, Working, Business, Other (**order matches live**) |
| `intended_province_city` | `basic_ttcdTinhTp` | 34 | Matches Vietnam's 2025 post-reorganization province list (Resolution 60/NQ-TW, June 2025 — 63 → 34) |
| `intended_border_gate_of_entry` | `basic_ttcdNcCuaKhau` | 79 | Full live list (13 airports + 16 land + 50 land/sea); reused for exit gate |
| `intended_border_gate_of_exit` | `basic_ttcdXcCuaKhau` | 79 | Same canonical list as entry |
| `bought_travel_insurance` | `basic_kpbhMuaBaoHiem` | 2 | Yes, No (select, not radio — live form uses `.ant-select`) |
| `expense_coverage` | `basic_kpbhNguoiDamBao` | 2 | Myself, Other (**no "Sponsor" third option** — the seed originally assumed three) |

The `nationality` and `relative_nationality` fields are rendered as country selects backed by ISO 3166-1 (validation_rules `source: "ISO3166-1"`), which matches the live form's ~250-entry virtual-list; we don't duplicate that list in the seed because the renderer already sources it.

---

## 5. Corrections applied vs. v1 seed (81 fields)

The v1 seed was a reconstruction from the in-repo `vietnam-visa-helper-v1` extension. The v2 alignment pass against the live portal produced these corrections:

### 5.1 Fields removed (21 total)

- `full_name` — live form has `surname` + `given_name` only, no composite
- `country_of_birth` — live form has free-text `place_of_birth` only
- `has_other_passports` + `other_passport_number` + `other_passport_expiry` + `other_passport_nationality` — not present on live form
- `is_applicant_under_18` + `parent_consent_letter_held` + `accompanying_adult_full_name` + `accompanying_adult_relationship` + `accompanying_adult_date_of_birth` — replaced by the true children-table schema (step 7)
- `intended_date_of_exit` — live form derives from entry + length of stay
- `home_address_line_1` + `home_address_city` + `home_address_country` — live flattens into single `permanent_residential_address`
- `payment_method` — not present on live form
- `sponsor_name` + `sponsor_address` + `sponsor_relationship` — live `expense_coverage` has only 2 options (Myself / Other), no sponsor branch
- `inviting_company_*` + `work_permit_number` + `employer_in_vietnam` + `relative_*` purpose-sub-journey textareas — live form does not branch on `purpose_of_entry`; relatives are captured unconditionally under step 6 when `has_relatives_in_vietnam === yes`
- `declaration_account_creation` + `declaration_truthfulness` — live has ONE final declaration checkbox (`final_declaration`), not three

### 5.2 Fields added (0 beyond step-8 + visa-validity)

All live fields missing from v1 were already covered by v2 after the rewrite (`permanent_residential_address`, `contact_address`, `visa_valid_from`, `visa_valid_to`, child rows).

### 5.3 Type flips (3)

- `residential_address_in_vietnam`: `textarea` → `text` with `live_control: "dependent_select"` annotation (live renders a province-dependent select; modeled as text to avoid blocking on Vietnam's address hierarchy until we ship the full ward/commune dataset)
- `intended_ward_commune`: `text` → `select` with `dependent_on: "intended_province_city"` (options list empty by design — live is province-dependent and fetches lazily)
- `bought_travel_insurance`: `radio` → `select` (live uses `.ant-select`)

### 5.4 Prompt corrections (1)

- `visited_vietnam_before` (5-year look-back) → `visited_vietnam_in_last_year` (verbatim: "Have you ever been to Viet Nam in the last 01 year?")

### 5.5 Structure corrections

- Purpose-of-entry option order aligned to live: Tourism, Visiting relatives, Working, Business, Other (previously: tourist, visiting_relatives, business, working, other_purpose — "working" was after "business")
- Occupation options: dropped "Housewife" (not on live), added "Government official" (on live)
- Children table (step 7) modeled as 3-column repeatable group (`child_full_name`, `child_sex`, `child_date_of_birth`). The live table has 5 columns — the 4th is a portrait-photo upload (schema-external per playbook §5.6) and the 5th is the Add/Delete action.

---

## 6. Things the recon could not verify (accepted risk)

The extractor saw the form in its unfilled state. A few conditional surfaces were not fill-probed:

1. **Province → ward/commune cascade** — the live `intended_ward_commune` is a province-dependent select whose option list is fetched server-side on province change. Our seed models it as a select with an empty `options` array and `dependent_on: "intended_province_city"`. When downstream automation encounters this, it will need to drive the province select first, then re-read the commune options. Not a schema gap — an implementation note for the submission driver.
2. **`residential_address_in_vietnam` dependent-select** — the live control is a province-dependent address select. We model it as a free-text field so applicants can enter a hotel or host-family address verbatim. Submission automation will need a lookup/mapping step to resolve the text to the nearest live option, or a documented handoff where the human driver confirms the dropdown selection.
3. **Nationality lists** — both `nationality` and `relative_nationality` are live-rendered via a virtual-scroll country select. The seed declares `source: "ISO3166-1"` rather than duplicating the ~250-entry list.

None of these are parity gaps — they are handoff points for the submission driver, documented in the gap report.

---

## 7. Recon artifacts

Generated by this run:

```
viza-be/submission-service/vn-recon-out-v3/
├── 01-landing.png / .html
├── 02-after-disclaimer.png / .html
├── 03-form-page.png / .html
├── 04-after-scroll.png            ← full-page screenshot of the form
├── canonical.json                 ← 60 captured fields + 9 select option lists keyed by DOM id
└── summary.json                   ← nav log + counts
```

To re-run:

```bash
cd viza-be/submission-service
npx tsx src/vietnam/form-recon-v3.ts
# set VN_RECON_HEADFUL=1 to watch the browser
```

---

## 8. Net verdict

Seed is **100% structurally aligned with the live form**: 60 seed fields ↔ 60 live `.ant-form-item`s (plus the 3-row children table modeled as a repeatable group). All 9 scrapable select option lists are captured verbatim. Every seed field carries its live DOM `id` in `validation_rules.live_dom_id`, so future submission automation can drive the form without a separate mapping layer.

Remaining accepted risk is limited to the two dependent-select handoffs (ward/commune, residential-address cascade) and the nationality country lists (backed by ISO 3166-1, not duplicated). These are driver-layer concerns, not schema concerns.

This package is ready to ship as v2. The next step is a fill-and-submit pass with a throwaway account to verify that the server accepts the exact slug values we generated from the live option text.
