# Australia Visitor Visa (Subclass 600) — Gap Report

**Generated:** 2026-04-26
**Schema version:** v1 (seed-au-visitor-600-form-fields.ts)
**Visa type:** `AU_VISITOR_600`

Goal: when a user is assigned the Australia Visitor Visa (Subclass 600)
package, their `/application` page renders a 1:1 schema match of what
they would see on the live ImmiAccount online Internet Application for
the visa.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Visa Stream Selection | 1 | 3 | 5-stream master select (`stream`) drives Step 10 sub-journeys |
| Personal Details | 2 | 25 | Repeatable `other_names` (max 5) and `other_nationalities` (max 5); under-18 block (8 fields) gated on `is_applicant_under_18 === yes` with cross-step `&&` for the in-Australia carer block |
| Passport & Travel Document | 3 | 13 | Inline group `passport_dates`; repeatable `other_travel_docs` (max 3) |
| National Identity Document | 4 | 6 | Includes optional PRC hukou capture |
| Contact Details | 5 | 16 | Block groups `residential_address` and `postal_address` (gated on same-as-residential) |
| Authorised Recipient & Migration Agent | 6 | 9 | Block groups `agent_details` and `authorised_recipient` |
| Family Composition | 7 | 25 | Repeatable `children` (max 10) and `relatives_in_au` (max 10); partner block gated by relationship status `\|\|` |
| Travel & Visa History | 8 | 14 | Repeatable `previous_au_visits` (max 10) and `visa_refusals` (max 10) |
| Visit Details | 9 | 12 | Inline group `intended_dates`; repeatable `accompanying_applicants` (max 10) |
| Stream-Specific Details | 10 | 35 | Tourist (5), Business (11), Sponsored (8), ADS (6), Frequent Traveller (5) sub-journeys; Frequent Traveller passport-country select restricted to the 11 Home-Affairs eligible nationalities (CN, BN, KH, ID, LA, MY, PH, SG, TH, TL, VN) |
| Funding & Financial Capacity | 11 | 10 | Inline group `funds`; block groups `funder_details` and `current_employer` |
| Health & Health Insurance | 12 | 11 | Block group `insurance_details`; cross-step gate on `sex === female` for pregnancy |
| Character Declarations | 13 | 16 | Repeatable `military_service` (max 5) |
| Declaration | 14 | 7 | Five required-checkbox attestations + typed signature + signature date |
| **Total** | **14** | **202** | — |

---

## 2. Stream Options (Step 1 — `stream`)

`stream` covers the full Subclass 600 umbrella — 5 streams:

- `tourist` — Tourist stream (holiday, recreation, visiting family or friends)
- `business_visitor` — Business Visitor stream (short business activities, no employment in Australia)
- `sponsored_family` — Sponsored Family stream (visit family with an approved Australian sponsor providing security)
- `ads` — Approved Destination Status (ADS) stream (group tour from People's Republic of China)
- `frequent_traveller` — Frequent Traveller stream (10-year multiple-entry visa for People's Republic of China passport holders)

Each stream unlocks a bespoke sub-journey block in Step 10.

---

## 3. Remaining Limitations

### 3.1 Live-portal QA pass not yet done

**Status:** schema is a reconstruction from public Department of Home
Affairs documents (Forms 1419, 1418, 1149; PAM3 policy; Migration
Regulations 1994 Schedule 2 cl.600); not yet verified against the live
ImmiAccount Internet Application.
**Impact:** High

The ImmiAccount portal is gated behind authentication and the Visitor
visa Internet Application requires a real applicant identity. v1 ships
the schema based on the published PDFs and policy documents, with the
explicit understanding that drift against the live form is possible —
particularly in dropdown option lists, exact field labels, and minor
ordering.

**Why deferred:** Driving ImmiAccount end-to-end requires an actual
applicant identity and a real fee transaction; this is the same
constraint that applies to the UK Standard Visitor build (UK was also
shipped pre-QA against the live Access UK portal).

**Workaround:** Treat the schema as v1 reconstruction. Quarterly
re-validation against any newly published PDF/policy update. First
production applicant walks through with operator supervision and any
divergences are filed as a v1.1 patch.

### 3.2 No multi-select for states-to-visit

**Status:** captured as a single `textarea`; live form uses checkboxes
for the 8 AU state/territory codes.
**Impact:** Low

The renderer does not currently support a `multi_select` field type.
Capturing states/territories as comma-separated free text preserves the
data but loses the structured choice list.

**Why deferred:** Changing the renderer is out of scope for a country
build per playbook §6 ("No frontend changes should be needed").

**Workaround:** Free text is acceptable for v1; downstream submission
or review steps can parse comma-separated state codes.

### 3.3 Port-of-arrival enum is a 10-port subset

**Status:** `first_port_of_arrival` ships with 10 of the most common
Australian international ports plus an `other` escape hatch.
**Impact:** Low

The live form accepts any IATA airport; capturing the 10 most-used
ports plus an `other` free-text field is the same pattern Vietnam used
for `border_gate` (recon recorded 79 ports; v1 ships 12 + `other`).

**Why deferred:** Full IATA airport list is a maintenance burden and
the long tail is rarely used.

**Workaround:** `first_port_other_specify` free-text field is gated on
`first_port_of_arrival === other`.

### 3.4 Stream eligibility is not gated against the master nationality field

**Status:** `frequent_traveller` and `ads` streams are restricted by
Home Affairs to specific nationalities (Frequent Traveller — PRC,
Brunei, Cambodia, Indonesia, Laos, Malaysia, Philippines, Singapore,
Thailand, Timor-Leste, Vietnam; ADS — citizens of certain regions of
the People's Republic of China). The schema captures the eligible
country for Frequent Traveller via the
`frequent_eligible_passport_country` select but does not cross-check
that select against `country_of_nationality` from Step 2.
**Impact:** Medium

`evaluateShowIf` does not yet support a "field equals another field"
predicate; it only compares against literal values. Cross-field gating
would require either an `in` operator or a same-field equality
predicate.

**Workaround:** Submission-time check (post-form) catches the
mismatch; staff review surfaces it before submission. Frontend can
prefill `frequent_eligible_passport_country` from
`country_of_nationality` once cross-step gating is exercised.

### 3.5 Sponsored Family sponsor reference not yet linked

**Status:** the Sponsored Family stream block captures sponsor
contact + Australian residency status but does not capture an
approved sponsor application reference number (created via the
separate Form 1149 sponsorship application).
**Impact:** Medium

The live ImmiAccount flow links the visitor application to a previously
approved sponsor record. v1 captures the sponsor profile but not the
linkage reference.

**Why deferred:** Confirming the live portal's exact field name + format
for the sponsor reference requires a live walk.

**Workaround:** Operator manually links during submission review;
sponsor reference is added in v1.1 after the live walk.

### 3.6 Document uploads are intentionally schema-external

**Status:** supporting documents (passport biopage, photo, financial
evidence, sponsor evidence, invitation letters) live in
`application_documents`, not `visa_form_fields`.
**Impact:** N/A — by design

Per playbook §5.6, document uploads are out of scope for the schema.

**Workaround:** The standard `application_documents` table handles
all evidence per existing patterns.

### 3.7 Health insurance is not gated on age

**Status:** `has_health_insurance` is asked for all applicants;
Subclass 600 policy weights this more heavily for older applicants
and Sponsored Family stream visitors.
**Impact:** Low

`evaluateShowIf` does not support date arithmetic (playbook §4
"Not supported"), so we cannot derive "applicant is over 60" from DOB.

**Workaround:** The field is asked of everyone — slightly more friction
for younger applicants but no information is lost. Downstream review
can prioritise insurance evidence for older applicants.

### 3.8 Applicants 75 years or older — extra evidence is not schema-modelled

**Status:** the live ADS stream page surfaces an "Additional documents
for applicants 75 years old or older" requirement (additional health
evidence and insurance evidence). The schema asks all applicants the
health-insurance and medical-condition questions but does not branch
on age 75+.
**Impact:** Low

`evaluateShowIf` does not support date arithmetic, so a "75+" gate
cannot be derived from `date_of_birth`. The same constraint applies
to the under-18 case, which we work around with an explicit
`is_applicant_under_18` radio.

**Workaround:** The supporting-document layer
(`application_documents`) is the right home for the 75+ extra
evidence — staff review prompts for the additional medical evidence
when the applicant's DOB indicates age 75+.

### 3.9 Adult dependent applicants (18+) — extra documents not modelled

**Status:** the Frequent Traveller stream page surfaces an "Additional
documents for dependent applicants 18 or older" requirement (proof of
ongoing financial dependency on the primary applicant). Not yet a
schema field.
**Impact:** Low

This is a per-applicant document concern rather than a schema field —
documents live in `application_documents` per playbook §5.6.

**Workaround:** Captured at document-upload time once the Sponsored
Family / Frequent Traveller workflow forks per dependent applicant.

### 3.10 Biometrics, fees, VAC scheduling are out of scope

**Status:** post-submission steps handled by separate ImmiAccount
flows + VAC providers (VFS Global, TT Services, etc.).
**Impact:** N/A — by design

Per playbook §5.7, post-submission flows are not part of the form
schema.

---

## 4. Closed in this version

This is the initial v1 release; nothing closed yet.

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators
`lib/form-utils.ts` `evaluateShowIf` splits on `||` then `&&` and
evaluates each atom with `===` / `!==`. Multi-value gating works.
The Australia seed uses `||` extensively in:
- Step 7 partner block — `relationship_status === married || relationship_status === de_facto || relationship_status === engaged || relationship_status === separated`
- Step 10 stream sub-journey gates (e.g. `stream === tourist && tourist_main_reason === visit_family` uses `&&`)
- Step 11 funder details — `funding_source === family || funding_source === employer || funding_source === other`
- Step 11 employer block — `current_employment_status === employed || current_employment_status === self_employed`

### 5.2 Cross-step conditionals
As of the UK v2 playbook, `DynamicStepForm` seeds `values` state from
the full `prefill`, so cross-step conditionals work. The Australia
seed exercises this in Step 12 — `is_pregnant` is gated on
`sex === female` (Step 2), which is two steps earlier.

### 5.3 Not supported — list membership and date arithmetic
- No `in` operator usage required for v1; stream eligibility (e.g.
  Frequent Traveller restricted to PRC passport holders) is left to
  downstream review per §3.4.
- No date arithmetic; `is_pregnant` and the health-insurance question
  are asked of everyone rather than derived from DOB or sex+age.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent
`scripts/seed-au-visitor-600-form-fields.ts` deletes all rows with
`visa_type = 'AU_VISITOR_600'` then re-inserts. Safe to re-run.

### 6.2 Repeatable groups used
- `other_names` (Step 2, max 5) — gated on `has_other_names === yes`
- `other_nationalities` (Step 2, max 5) — gated on `has_other_nationalities === yes`
- `other_travel_docs` (Step 3, max 3) — gated on `has_other_travel_documents === yes`
- `children` (Step 7, max 10) — gated on `has_children === yes`
- `relatives_in_au` (Step 7, max 10) — gated on `has_other_relatives_in_australia === yes`
- `previous_au_visits` (Step 8, max 10) — gated on `has_visited_australia_before === yes`
- `visa_refusals` (Step 8, max 10) — gated on `has_been_refused_visa === yes`
- `accompanying_applicants` (Step 9, max 10) — gated on `accompanied_by_other_applicants === yes`
- `military_service` (Step 13, max 5) — gated on `has_military_service === yes`

### 6.2.1 Cross-step `&&` conditional (live-portal walk finding)
- `minor_australian_carer_full_name` and `minor_australian_carer_relationship`
  (Step 2) gate on `is_applicant_under_18 === yes && minor_australian_carer_arranged === yes`
  (same-step gate). Validates `&&` evaluates correctly inside `DynamicStepForm`.

### 6.3 Block groups used (visually grouped fields)
`residential_address`, `postal_address`, `agent_details`,
`authorised_recipient`, `partner_details`, `father_details`,
`mother_details`, `tourist_visit_family`, `business_org`,
`business_employer`, `sponsor_details`, `ads_tour`, `funder_details`,
`current_employer`, `insurance_details`.

### 6.4 Inline groups used (side-by-side pair rendering)
`passport_dates` (Step 3 — issue + expiry), `intended_dates`
(Step 9 — arrival + departure), `funds` (Step 11 — amount + currency).

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [ ] Seed applied (202 rows in `visa_form_fields` with visa_type = `AU_VISITOR_600`)
- [ ] Package registered in `visa_packages` via migration `0017_au_visitor_600_package.sql`
- [ ] Assign a test user the `AU_VISITOR_600` package
- [ ] Walk every step, answer every conditional, trigger every stream sub-journey (Tourist, Business, Sponsored, ADS, Frequent Traveller)
- [ ] Test every repeatable group (add/remove instance, values persist) — at minimum `other_names`, `children`, `previous_au_visits`, `military_service`
- [ ] Test multi-value `||` in the partner block (Step 7) and the funder block (Step 11)
- [ ] Test cross-step gating — `sex === female` on Step 2 unlocks `is_pregnant` on Step 12
- [ ] Submit a test application — verify all 193 answers persist to `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
- [ ] Live-portal QA pass against ImmiAccount completed (or explicitly deferred with reason)

---

## 8. Source Material

This schema is a **reconstruction** from public sources, not a
live-portal capture. A live-portal QA pass against the ImmiAccount
Internet Application is required before production use.

- Department of Home Affairs — Visitor visa (subclass 600) product page
  (`https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600`)
- Form 1419 — Application for a Visitor visa — Tourist stream
- Form 1418 — Application for a Visitor visa — Business Visitor stream
- Form 1149 — Application for a Sponsored Family Visitor visa
- Form 956 / 956A — Authorised recipient / migration agent appointment
- Migration Regulations 1994 — Schedule 2 cl.600 (legal basis)
- Procedural Instructions to Migration Officers (PAM3) — Visitor visa
  policy (public sections)
- Cross-referenced against the existing UK Standard Visitor seed
  (`seed-uk-standard-visitor-form-fields.ts`) and Schengen Type C seed
  (`seed-eu-schengen-c-short-stay-form-fields.ts`) for shared
  visitor-visa shape

Expected drift areas (most likely to need revalidation when the live
form changes):

- Stream-specific dropdowns (`business_purpose`, `tourist_main_reason`,
  `funding_source`)
- Port-of-arrival enum
- Sponsor reference linkage in Sponsored Family stream
- Migration agent / authorised recipient field structure (Form 956 /
  956A integration)
