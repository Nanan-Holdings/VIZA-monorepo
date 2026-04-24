## EU Schengen Type C Short-Stay — Gap Report

**Generated:** 2026-04-24
**Schema version:** v1 (seed-eu-schengen-c-short-stay-form-fields.ts)
**Visa type:** `EU_SCHENGEN_C_SHORT_STAY`

Goal: when a user is assigned the EU Schengen Short-Stay (Type C)
package, their `/application` page renders a 1:1 schema match of the
harmonized Annex I form (Regulation 810/2009) that every Schengen
member-state portal must implement.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Personal Details | 1 | 16 | Annex I 1–9; surname_at_birth and nationality_at_birth conditionally shown; other_nationalities repeatable |
| Parental Authority | 2 | 8 | Annex I 10 — entirely gated on `is_applicant_minor === yes`; `parental_authority` block_group |
| Travel Document & Identity | 3 | 8 | Annex I 11–16; national_id gated; travel_document_type=other unlocks free-text; inline_group for issue/expiry |
| EU/EEA/CH Family Member | 4 | 8 | Annex I 17–18 — label updated to include UK Withdrawal Agreement beneficiaries per 2020 consolidation; full block gated on `has_eu_family_member === yes` |
| Contact Details & Residence | 5 | 11 | Annex I 19–20; home_address block_group; residence-permit fields gated |
| Occupation | 6 | 10 | Annex I 21–22; employer vs school block branches on `is_student` |
| Trip Details | 7 | 8 | Annex I 23, 25–27; purpose_of_journey umbrella (10 options, single-select — see §3.8); trip_dates inline_group |
| Purpose-Specific Details | 8 | 49 | Annex I 24, 30–31 by purpose — host (10), business (11, now with contact address + phone), study (7), medical (7), cultural/sports/official shared (7), transit (3), other (1), tourism (1), Annex IV ATV acknowledgment (2, gated on `current_nationality in [...] && purpose === airport_transit`) |
| Accommodation in Schengen | 9 | 8 | Annex I 30 hotel/temporary; accommodation_address block_group |
| Travel History | 10 | 9 | Annex I 28–29 (2020 consolidation). Pre-2020 "past 3 years Schengen visas" field was merged into 28; schema removed in v1.2. |
| Financial Support | 11 | 18 | Annex I 32; self-means gated on `COST_SELF`; sponsor-means gated on `COST_SPONSOR`; sponsor_details block_group |
| Declaration | 12 | 16 | Annex I 33 (filler block — 6 fields) + Annex I 37 (place/date + six consents: fee-not-refunded, insurance-for-multi-entry gated on `number_of_entries_requested === multiple`, VIS, data rights, truthfulness, undertaking-to-leave) |
| **Total** | **12** | **169** | — |

---

## 2. Purpose Options (Step 7)

`purpose_of_journey` covers the full Annex I field-23 umbrella — 10 purposes:

- `tourism` — Tourism
- `business` — Business
- `visiting_family_friends` — Visiting family or friends
- `cultural` — Cultural
- `sports` — Sports
- `official_visit` — Official visit
- `medical` — Medical reasons
- `study` — Study (short-term, <90 days; longer courses require a national Type D visa)
- `airport_transit` — Airport transit (Annex I also covers Type A applicants here)
- `other` — Other (free-text explanation required)

Each purpose unlocks a bespoke sub-journey in Step 8. Cultural, sports,
and official visits share one combined event-details block gated on
`IS_EVENT = purpose_of_journey === cultural || purpose_of_journey === sports || purpose_of_journey === official_visit`.

---

## 3. Remaining Limitations

### 3.1 Live-portal QA pass — member-state portals still not driven

**Status:** schema walked against the authoritative EU Commission
Annex I PDF (home-affairs.ec.europa.eu) on 2026-04-24; 9 concrete
discrepancies fixed (see §4). Member-state consulate portals
(France-Visas, VFS, BLS, TLS Contact) still not driven end-to-end.
**Impact:** Medium — authoritative source parity is now verified;
per-portal UX divergence remains a downstream risk.

**Why deferred:** member-state portals are identity-gated and cannot
be driven without a real applicant's passport + appointment slot.
A source-verification pass against the published Annex I form is
now the canonical fallback and is complete.

**Workaround:** before assigning this package to any production user,
walk the schema against the specific consulate portal the caseworker
uses (e.g. France-Visas if routed through a French consulate) and
record any UX-level drift in §4.

### 3.2 Nationality-gated Airport Transit Visa (ATV) requirements — CLOSED

**Status:** closed (see §4)
**Impact:** n/a

Originally deferred because `evaluateShowIf` did not support list
membership. Closed by adding an `in` / `not in` operator to
`lib/form-utils.ts` and wiring two Step 8 ATV fields
(`atv_airside_only`, `atv_annex_iv_acknowledged`) gated on
`current_nationality in [af, bd, cd, er, et, gh, ir, iq, ng, pk, so, lk] && purpose_of_journey === airport_transit`.
Applicants whose nationality is on Annex IV of the Visa Code now see
the ATV-specific acknowledgment automatically when they select the
airport-transit purpose.

### 3.3 Fingerprint exemption not auto-calculated

**Status:** schema asks the question, user answers manually.
**Impact:** Low — applicants whose fingerprints were collected in the
last 59 months are exempt from re-capture (Visa Code Art. 13), but the
exemption is a consular operational detail not a field on Annex I.

**Why deferred:** out of scope for the form schema. Belongs in a
submission-time helper that reads `prev_fingerprints_date` and warns
the consulate if within the 59-month window.

**Workaround:** the applicant answers honestly; the consulate determines
exemption.

### 3.4 Travel medical insurance not a form field

**Status:** intentionally out of schema.
**Impact:** None — matches member-state portal convention.

Annex I does not ask about insurance; the Visa Code Art. 15 requirement
(min €30,000 coverage, Schengen-wide, includes repatriation and
emergency medical care) is handled as a supporting-document upload.

**Why deferred:** insurance documents live in `application_documents`,
not `visa_form_fields`. The declaration step (Step 12) should surface a
reminder during UI review (see `schengen-visa-scope.md` §8 Immediate #3).

**Workaround:** application_documents flow handles the upload; the
scope doc flags the UI reminder as an immediate action item.

### 3.5 Submission automation deferred

**Status:** prefill-only; no gov-portal automation.
**Impact:** High for throughput — staff must submit via consulate portals
manually — but correct for v1 given portal divergence.

**Why deferred:** France-Visas, VFS Global, BLS, and TLS Contact each
host different flows. Building a single Playwright shim would duplicate
the DS-160/CEAC effort (§9 of the playbook) across ~5 systems. Not
cost-justified until staff volume per portal is known.

**Workaround:** scope doc §8 Medium-term #8 — build per-portal shims
only when a specific portal's volume justifies the engineering spend.

### 3.6 Type D long-stay and FTD/FRTD packages not included

**Status:** explicitly out of v1 scope (see `schengen-visa-scope.md` §3).
**Impact:** Users seeking >90 day stays, national student visas, or
Kaliningrad transit cannot use this package.

**Why deferred:** Type D is governed by each member state's national
law with no harmonized form. FTD/FRTD is Regulation 693/2003 not the
Visa Code. Each requires its own seed script and `visa_type` key.

**Workaround:** scope doc §8 Medium-term #7 lists the highest-demand
Type D variants to build next.

### 3.8 Field 23 purpose is a checkbox set on Annex I, single-select in schema

**Status:** design choice — schema stores a single `purpose_of_journey`
even though Annex I allows multiple purposes to be ticked.
**Impact:** Low — consulates route on the primary purpose; secondary
purposes can be captured in `purpose_additional_info` (Annex I field 24).

**Why deferred:** supporting multi-select would require (a) a new
`field_type: "checkbox_group"` in `DynamicStepForm` (currently
`checkbox` is single-boolean) and (b) rewriting every `IS_BUSINESS`-style
gate to use `in` instead of `===`. Mechanically possible with the v1.1
`in` operator, but invasive.

**Workaround:** caseworker picks the primary purpose; applicant uses
the `purpose_additional_info` textarea to list any secondary purposes.
Document-review step should reconcile before submission.

### 3.9 Starred fields (21, 22, 30, 31, 32) — UK Withdrawal Agreement beneficiary exemption

**Status:** schema always marks these `required: true` regardless of
`has_eu_family_member` answer.
**Impact:** Low — extra fields collected, not missing fields. No
regulatory risk, just mild UX friction for EU-family-member
applicants who are exempt from these five fields under Annex I.

**Why deferred:** would require expressing "required unless
`has_eu_family_member === yes`" at the schema level, which needs a
new `required_unless` clause in `conditional_logic`. Small library
change, scoped for v1.3.

**Workaround:** the applicant fills these fields in anyway — no harm,
just a small UX tax. Caseworker can leave them blank on the submitted
form if the applicant is a Withdrawal Agreement beneficiary.

### 3.7 Family-of-EU-citizen Directive 2004/38 fast-track not surfaced

**Status:** schema captures the family relationship in Step 4 but does
not differentiate the procedural fast-track.
**Impact:** Medium — family members of EU/EEA/CH citizens benefit from
Directive 2004/38/EC (fee waiver, expedited processing, lower evidence
bar). The answers are captured; downstream UX should route these
applicants differently.

**Why deferred:** schema-level concern only; the routing is a workflow
decision.

**Workaround:** admin portal should surface `has_eu_family_member === yes`
applicants as a distinct queue for staff review.

---

## 4. Closed in this version

Closed in v1.1 (2026-04-24):

- **§3.2 Nationality-gated ATV requirements** — added `in` / `not in`
  operator to `evaluateShowIf` (root-cause fix, benefits all countries)
  and wired two ATV-specific fields in Step 8 gated on `current_nationality in [...] && purpose_of_journey === airport_transit`. Coverage grew from 158 → 160 fields.
- **§5.3 List-membership operator missing** — lifted by the same
  library change. The `in` / `not in` operator is now a documented
  primitive in the playbook §4 operator reference.

Closed in v1.2 (2026-04-24, source-verification QA pass against the
official EU Commission Annex I PDF):

- **Field 8 Sex — missing "Other" option.** Annex I lists Male / Female / Other; schema had only Male / Female. Fixed.
- **Civil status label.** Annex I uses "Widow(er)"; schema used "Widowed". Aligned.
- **Fields 17 & 18 EU family member.** 2020 consolidation includes "or a UK national who is a beneficiary of the EU-UK Withdrawal Agreement" (Brexit-era amendment). Label updated.
- **Field 31 inviting company contact.** Annex I asks for contact person's address and telephone in addition to name and email. Added `business_contact_address` and `business_contact_phone` to Step 8.
- **Field 33 person filling in application form (entirely missing).** Added 6 fields to Step 12: `has_different_filler` toggle + `filler_surname`, `filler_given_names`, `filler_address`, `filler_email`, `filler_phone` (all gated on the toggle).
- **Field 37 declaration — only 2 of 6 consents present.** Added `declaration_fee_not_refunded_awareness`, `declaration_insurance_multi_entry_awareness` (conditional on `number_of_entries_requested === multiple`), `declaration_vis_consent`, `declaration_data_rights_awareness`, `declaration_undertaking_to_leave`. Existing `declaration_truthfulness` and `declaration_awareness_refusal` kept with labels aligned to Annex I verbatim.
- **Step 10 stale "past 3 years Schengen visas" repeatable group removed.** The 2019/1155 amendment merged that data into Field 28 (fingerprints); the pre-consolidation field 29 no longer exists on the live form. Removed `had_schengen_visa_past_3y`, `prev_schengen_visa_valid_from`, `prev_schengen_visa_valid_until`, `prev_schengen_visa_sticker_number` (4 fields).
- **Field numbering in docs.** Updated from "Annex I 1–37" (2009 original) to "Annex I 1–33" (2020 consolidation).

Net v1.2 change: +13 adds, −4 removes. Coverage 160 → 169 fields.

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators
`lib/form-utils.ts` `evaluateShowIf` splits on `||` then `&&` and
evaluates each atom with `===` / `!==`. The Schengen schema relies on
this extensively:
- `COST_SELF = cost_covered_by === self || cost_covered_by === both`
- `COST_SPONSOR = cost_covered_by === sponsor || cost_covered_by === both`
- `IS_EVENT = purpose_of_journey === cultural || purpose_of_journey === sports || purpose_of_journey === official_visit`
- Accommodation address gate: `accommodation_type === hotel || accommodation_type === rented`

### 5.2 Cross-step conditionals
Multiple sub-journey groups in Step 8 gate on `purpose_of_journey` from
Step 7. Per the UK v2 fix, `DynamicStepForm` seeds `values` state from
the full `prefill`, so cross-step conditionals work. This must be
re-verified on any DynamicStepForm refactor.

### 5.3 List-membership operator — now supported
As of v1.1 (2026-04-24), `evaluateShowIf` supports `field in [v1, v2, ...]`
and `field not in [v1, v2, ...]`. The atom parser matches `not in`
before `in` so the longer keyword wins; bracketed values are
comma-separated and matched case-insensitively against `values[field]`.
Composes with `||` and `&&` as expected — see the Schengen `IS_ATV_NATIONAL`
gate for a worked example.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent
`scripts/seed-eu-schengen-c-short-stay-form-fields.ts` deletes all rows
with `visa_type = 'EU_SCHENGEN_C_SHORT_STAY'` then re-inserts. Safe to re-run.

### 6.2 Repeatable groups used
- `other_nationalities` (step 1, max 5) — gated on `has_other_nationalities === yes`

Note: the pre-2020 `previous_schengen_visas` repeatable group was
removed in v1.2 because the 2019/1155 amendment consolidated that
field into Field 28 (single prior visa number + fingerprint date).

### 6.3 Block groups used (visually grouped fields)
`parental_authority`, `eu_family`, `home_address`, `employer`, `school`,
`host_details`, `business_details`, `study_details`, `medical_details`,
`event_details`, `accommodation_address`, `entry_permit`, `sponsor_details`,
`filler_details` (added v1.2 for Field 33 person filling in the form)

### 6.4 Inline groups used (side-by-side pair rendering)
`travel_document_dates` (issue/expiry), `trip_dates` (arrival/departure),
`event_dates` (start/end), `entry_permit_dates` (valid_from/valid_until)

### 6.5 Purpose umbrella pattern
Per playbook §4, 10 purposes declared as `purpose_of_journey`-gated
constants (`IS_TOURISM`, `IS_BUSINESS`, `IS_VISIT`, `IS_CULTURAL`,
`IS_SPORTS`, `IS_OFFICIAL`, `IS_MEDICAL`, `IS_STUDY`, `IS_TRANSIT`,
`IS_OTHER`) plus the derived `IS_EVENT` disjunction. Each sub-journey
field references its gate in `conditional_logic.showIf`.

### 6.6 Nationality-list gate (Annex IV ATV)
`ATV_ANNEX_IV_NATIONALITIES` is a comma-separated list of ISO 3166-1
alpha-2 codes; `IS_ATV_NATIONAL` composes it into `current_nationality in [...] && ${IS_TRANSIT}`. This pattern generalises to any
nationality-gated requirement — TB test countries (UK), yellow-fever
certificate countries (many), visa-on-arrival waiver lists.

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [ ] Seed applied (169 rows in `visa_form_fields` with visa_type = `EU_SCHENGEN_C_SHORT_STAY`)
- [ ] Package registered in `visa_packages` via migration `0011_eu_schengen_c_short_stay_package.sql`
- [ ] Assign a test user the `EU_SCHENGEN_C_SHORT_STAY` package
- [ ] Walk every step, answer every conditional, trigger every sub-journey (10 purpose options in Step 7)
- [ ] Test `previous_schengen_visas` repeatable group (add/remove, values persist)
- [ ] Test multi-value `||` in `COST_SELF` / `COST_SPONSOR` / `IS_EVENT` / `accommodation_type` gates
- [ ] Test cross-step gating (Step 8 sub-journeys gated on Step 7 `purpose_of_journey`)
- [ ] Test minor journey (`is_applicant_minor === yes` should reveal Step 2 parental authority block)
- [ ] Test EU-family-member journey (`has_eu_family_member === yes` should reveal Step 4 block)
- [ ] Submit a test application — verify all 169 answers persist to `visa_application_answers`
- [ ] Test ATV gate: set `current_nationality` to `AF`/`BD`/etc and `purpose_of_journey` to `airport_transit` — Step 8 should reveal `atv_airside_only` + `atv_annex_iv_acknowledged`. Change nationality off the Annex IV list — fields should hide.
- [ ] Test filler gate (Field 33): set `has_different_filler === yes` in Step 12 — six filler fields must reveal.
- [ ] Test multi-entry declaration gate: set `number_of_entries_requested === multiple` in Step 7 — `declaration_insurance_multi_entry_awareness` must reveal in Step 12.
- [ ] Review step (`DynamicReviewStep`) renders every field
- [ ] Live-portal QA pass against at least one member-state portal (France-Visas recommended)

---

## 8. Source Material

The schema is a **reconstruction** from published EU sources, not a
live-portal capture. Until §7 "Live-portal QA pass" is ticked, treat
any discrepancy between this schema and a real member-state portal as
a bug in this schema.

- Regulation (EC) No 810/2009 — "Visa Code", Annex I (application form), consolidated version ELI: CELEX:02009R0810-20200202
- Regulation (EU) 2019/1155 — Visa Code amendment that introduced the current form version
- European Commission Visa Handbook — Commission Decision C(2010) 1620 final, as updated; consular operational guidance
- France-Visas online application preview (https://france-visas.gouv.fr) — public pre-login pages
- VFS Global Schengen information pages — member-state-specific document checklists
- Directive 2004/38/EC — rights of EU citizens and their family members (relevant to Step 4 routing)
- Regulation (EC) No 539/2001 / (EU) 2018/1806 — visa-waiver country list (not directly modelled; informs ATV scope)

**Expected drift** — when the European Commission next amends Annex I
(last amended 2019), the most likely changes are: new declaration
items on data protection / VIS, additional biometric-consent language,
and possibly new purpose options (e.g. "remote work" / "digital nomad"
have been discussed). Bump this report's header and add a §4 entry
each time the schema is reconciled to a revision.
