# Korea C-3-9 Short-Term General Visa — Gap Report

**Generated:** 2026-04-27
**Schema version:** v1 (seed-kr-c39-short-term-visit-form-fields.ts, 101 rows)
**Visa type:** `KR_C39_SHORT_TERM_VISIT`

Goal: when a user is assigned the Korea C-3-9 Short-Term Visit package, their
`/application` page renders a 1:1 schema match of what they would see on the
official Annex-17 (별지 제17호서식) "사증발급신청서 / VISA APPLICATION FORM"
paper form.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Personal Details (Annex-17 §1) | 1 | 13 | 2 conditional gates: other-names-used, dual-national |
| Visa Category & Passport (Annex-17 §2 + §3) | 2 | 15 | §2 locked to short_term / C-3-9; conditional sub-block for second passport |
| Contact & Emergency Contact (Annex-17 §4) | 3 | 10 | Synthetic `current_address_same_as_home` gate added (Annex-17 says "if different" — converted to explicit Y/N to match supported conditional operators) |
| Marital & Family (Annex-17 §5) | 4 | 9 | Spouse block gated on married; number-of-children gated on has-children |
| Education & Employment (Annex-17 §6 + §7) | 5 | 10 | Employer block gated on `employment_status not in [unemployed, retired]` |
| Trip & Visit (Annex-17 §8.1–8.5) | 6 | 6 | §8.1 multi-checkbox simplified to single-select (see §3.1) |
| Travel History & Family (Annex-17 §8.6–8.9) | 7 | 20 | 4 repeatable groups, all conditional |
| Invitation, Funding & Declaration (Annex-17 §9–§12) | 8 | 18 | Inviter, payer, assistant blocks; signature §12.3 out of schema |
| **Total** | **8** | **101** | — |

86 form fields per Annex-17 inventory + synthetic gates + each
repeatable-group field counted as a separate `visa_form_fields` row.

---

## 2. Purpose Options (Step 6)

`purpose_of_visit` enumerates all 11 Annex-17 §8.1 options:

- `tourism_transit` — Tourism / Transit
- `meeting_conference` — Meeting / Conference
- `medical_tourism` — Medical Tourism
- `business_trip` — Business Trip
- `study_training` — Study / Training
- `work` — Work
- `trade_investment_ict` — Trade / Investment / Intra-Company Transfer
- `visiting_family_relatives_friends` — Visiting Family / Relatives / Friends
- `marriage_migrant` — Marriage Migrant
- `diplomatic_official` — Diplomatic / Official
- `other` — Other (free-text follow-up)

C-3-9 applicants typically pick `tourism_transit` or
`visiting_family_relatives_friends`. Other purpose codes more accurately
correspond to other C-3-x or D-series sub-categories and would belong on
future packages.

---

## 3. Remaining Limitations

### 3.1 §8.1 multi-select rendered as single-select

**Status:** schema present (single-select); renderer extension needed for multi.
**Impact:** Medium

Annex-17 §8.1 instructs "check all that apply". The seed renders
`purpose_of_visit` as a single-choice `select` because `DynamicStepForm`
does not yet support multi-checkbox arrays.

**Why deferred:** rendering a checkbox-array group requires a new
`field_type: "checkbox_multi"` branch in `DynamicStepForm` plus storage of
arrays in `visa_application_answers.value`. Out of v1 scope (matches AU's
deferred multi-select extension).

**Workaround:** for C-3-9 the dominant purpose pair is tourism + family
visit; users can pick one and use the textarea-style remarks at consular
intake to declare the other. KVAC does not reject single-purpose forms.

### 3.2 Photo (Annex-17 §1.0) and signature (§12.3) out of schema

**Status:** out of schema by design (playbook §5.6).
**Impact:** Low

Photo is uploaded via `application_documents` (35×45mm, white background,
≤6 months old). Signature is paper-only at KVAC counter; we capture
`declaration_consent` as the digital equivalent.

**Why deferred:** file uploads belong on the documents table; paper
signatures are out of automation scope.

**Workaround:** KVAC already captures the wet signature on print-out at
counter intake.

### 3.3 No live-portal QA against `visa.go.kr`

**Status:** open — schema is a high-fidelity reconstruction from the
official PDF, not a live-portal capture.
**Impact:** Medium

`visa.go.kr` self-service is geo-gated against PRC residents and KVAC has
no programmatic submission channel for PRC. The schema cannot be walked
against a live form from a PRC IP.

**Why deferred:** structural — no PRC-accessible live portal exists. A
proxy walk from a non-PRC IP using a non-PRC-citizen test account is
possible as a v2 quality gate (mirror UK / JP posture).

**Workaround:** the published Annex-17 PDF is the legal form template;
the verbatim extraction is high-fidelity. KVAC counter staff cross-check
the printed form so any drift surfaces quickly in the consular layer.

### 3.4 Refusal / criminal history not captured

**Status:** intentional — Annex 17 does not ask these.
**Impact:** Low

Unlike UK / Schengen, Annex 17 has no refusal-history or criminal-history
section. The Section-11 Notice ("false statements result in a ban") is
the only attestation. KVAC issues a separate Declaration Form in some
jurisdictions; that is a KVAC supplementary form, not Annex 17.

**Why deferred:** schema parity with the official form trumps adding
fields the form does not ask. Capturing criminal/refusal history would
diverge from Annex 17.

**Workaround:** consular staff handle declarations at counter intake.
Add to the supplementary-document flow if KVAC requires it for the
specific applicant cohort.

### 3.5 Under-17 applicant signature swap not modelled

**Status:** open — Annex-17 §12.3 says "Applicant signature (or Parent /
Legal Guardian if <17)".
**Impact:** Low (PRC C-3-9 minor applicants are uncommon)

The form does not provide separate guardian-name / guardian-relationship
inputs; the swap is implicit on the printed signature line.

**Why deferred:** v1.1 enhancement — add `is_applicant_under_17` radio
plus conditional guardian fields, mirroring the UK under-18 pattern.

**Workaround:** minor applicants sign as themselves; KVAC catches the
discrepancy at counter intake.

### 3.6 KVAC supplementary documents out of schema

**Status:** out of schema by design.
**Impact:** None for the form itself.

PRC KVAC requires hukou (full booklet copy), employment certificate (在职证明),
bank statement (last 6 months), personal income tax certificate (个税),
business license (营业执照) for entrepreneurs / self-employed, KVAC Health
Condition Report, KVAC Declaration Form. These are uploaded via
`application_documents` and verified at counter intake. They are not
part of Annex 17.

**Why deferred:** playbook §5.6 — supporting documents live in
`application_documents`, not the form schema.

**Workaround:** existing document-upload flow.

### 3.7 5-year multi-entry C-3 eligibility (post-2026 PRC easing)

**Status:** out of schema.
**Impact:** Low

Korean MOFA announced (2026) that PRC nationals with prior C-3 visit
history may qualify for 5-year multi-entry C-3 visas. This is a
consular-decision rule based on prior-visit data we already collect in
§8.6 (`travelled_to_korea_5y` + `korea_visits` repeater); no new fields
required.

**Why deferred:** no schema change needed; eligibility logic is
consular-side.

**Workaround:** consular staff evaluate; we surface the prior-visit data
they need.

### 3.8 No KVAC submission automation

**Status:** out of scope.
**Impact:** Low

KVAC.com.cn has no public API. Submission is paper / counter intake or
mail-in. There is no Playwright / e-visa automation target, so
`submission_queue` does not have a runner for `KR_C39_SHORT_TERM_VISIT`.

**Why deferred:** no programmatic channel exists.

**Workaround:** generate a printable Annex-17 PDF from
`visa_application_answers` (top v1.1 item — see scope doc §8) so the
applicant can take it to KVAC counter.

---

## 4. Closed in this version

First version — nothing prior to close.

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators
Both used. `other_passport_type_other` gates on
`has_other_passport === yes && other_passport_type === other` — composed
expression verified syntactically against `evaluateShowIf` semantics
(playbook §4).

### 5.2 Cross-step conditionals
Not used. Every conditional gate has its parent field on the same
wizard step. (UK v2 fix that seeds `values` from full `prefill` is
therefore not exercised by this schema, but does not harm it.)

### 5.3 List membership operator (`not in`)
**Used.** `IS_EMPLOYED_OR_STUDYING = "employment_status not in [unemployed, retired]"`
gates the §7.2 employer block. This is the primary multi-value
conditional in the schema; verify it works in the renderer
during the manual walkthrough.

### 5.4 Date arithmetic
Not used. Annex 17 has no fields that derive from DOB or compute date
deltas. The under-17 swap (§3.5) would require this if implemented;
deferred to v1.1 with explicit `is_applicant_under_17` radio.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent
`scripts/seed-kr-c39-short-term-visit-form-fields.ts` deletes all rows
with `visa_type = 'KR_C39_SHORT_TERM_VISIT'` then re-inserts. Safe to
re-run.

### 6.2 Repeatable groups used
- `korea_visits` (step 7) — gated on `travelled_to_korea_5y === yes`,
  fields: purpose, period_start, period_end. `max_items: 10`.
- `foreign_trips_5y` (step 7) — gated on `travelled_outside_5y === yes`,
  fields: country, purpose, period_start, period_end. `max_items: 10`.
- `family_in_korea` (step 7) — gated on `has_family_in_korea === yes`,
  fields: full_name, dob, nationality, relationship. `max_items: 10`.
- `family_travelling_with` (step 7) — gated on
  `travelling_with_family === yes`, fields: full_name, dob, nationality,
  relationship. `max_items: 10`.

### 6.3 Block groups used (visually grouped fields)
`other_names`, `other_passport`, `emergency_contact`, `spouse`,
`school`, `employer`, `inviter`, `payer`, `assistant`.

### 6.4 Inline groups used (side-by-side pair rendering)
`applicant_name` (family + given), `other_name`, `passport_dates`
(issue + expiry), `phones` (mobile + landline), `spouse_name`,
`korea_visit_dates`, `foreign_trip_dates`.

### 6.5 Section 2 lock
`period_of_stay` and `status_of_stay` carry `validation_rules.locked_value`
flagging the canonical C-3-9 prefill (`short_term` / `C-3-9`). Renderer
treats locked fields as read-only display when this hint is present;
falls back to user-editable if the renderer ignores the hint (graceful
degradation — applicant just confirms the prefilled value).

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [ ] Seed applied (101 rows in `visa_form_fields` with visa_type = `KR_C39_SHORT_TERM_VISIT`)
- [x] Package registered in `visa_packages` via migration `0023_kr_c39_package.sql`
- [ ] Assign a test user the `KR_C39_SHORT_TERM_VISIT` package
- [ ] Walk all 8 steps, answer all 17 conditional gates, trigger every sub-journey
- [ ] Test all 4 repeatable groups (add/remove instance, values persist)
- [ ] Test the `not in [unemployed, retired]` list-membership conditional in step 5
- [ ] Test the composed `&&` conditional in step 2 (`other_passport_type_other`)
- [ ] Test cross-step gating: N/A — no cross-step conditionals in this schema
- [ ] Submit a test application — verify all 101 answers persist to `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
- [ ] Live-portal QA pass completed: deferred to v2 (no PRC-accessible live portal) — schema accepted as high-fidelity reconstruction

---

## 8. Source Material

This schema is a **reconstruction** from the published Annex-17 PDF, not a
live-portal capture. Field labels and section structure were extracted
verbatim via `pdftotext -layout` from the official MOJ-published bilingual
PDF. PRC-specific submission context was cross-referenced against KVAC
catalogues and Korean embassy pages but those did not change the form.

- https://www.visa.go.kr/downfile/VisaapplicationForm_EN.pdf — primary
  source, Annex 17 (별지 제17호서식) "사증발급신청서 / VISA APPLICATION
  FORM" rev 2022.2.7, 5 pages, bilingual KR/EN
- https://aze.mofa.go.kr/upload/cntnts/az-az/VISA%20APPLICATION%20FORM.pdf — mirror
- https://www.visaforkorea-bj.com/upload/%E7%AD%BE%E8%AF%81%E7%A7%8D%E7%B1%BB%E5%8F%8A%E6%89%80%E9%9C%80%E6%9D%90%E6%96%99(241112)_1.pdf — KVAC Beijing visa types & required materials (Nov 2024)
- https://www.koreavisa-wh.com/files/visadoc/%E8%A7%82%E5%85%8925.02%201.pdf — KVAC Wuhan tourism guide (Feb 2025)
- https://www.visaforkorea-id.com/assets/pdfs/C-3-9_Checklist.pdf — KVAC Indonesia C-3-9 checklist (cross-reference)
- https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433 — Korean Embassy Singapore C-3-9 page
- https://www.mofa.go.kr/ph-en/brd/m_3277/view.do?seq=684566 — Korean Embassy Manila C-3 (employed) requirements
- https://en.wikipedia.org/wiki/List_of_South_Korean_visas — taxonomy reference

**Expected drift:** Annex 17 has been stable since 2022.2.7. Most likely
revalidation triggers: (a) new revision of the form (check
`visa.go.kr/downfile/VisaapplicationForm_EN.pdf` quarterly); (b) PRC
multi-entry policy changes; (c) KVAC PRC supplementary-document updates
(supplementary docs are not in schema, but the gap report should track
their checklist for completeness).
