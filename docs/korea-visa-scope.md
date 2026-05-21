# Korea C-3-9 Short-Term General Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-27

---

## 1. Canonical Journey

**Visa type:** Korea C-3-9 Short-Term General Visa (단기일반 / Short-Term Visit, multi-purpose, ≤90 days, single-entry)
**VIZA visa_type key:** `KR_C39_SHORT_TERM_VISIT`

The C-3-9 is the multi-purpose short-term visit visa used by mainland-China
(PRC) nationals travelling to South Korea for tourism, transit, family / friend
visits, light social events, and other unspecified short visits not covered by
the more specific C-3-x sub-categories (C-3-1 single-entry, C-3-2 group tour,
C-3-3 medical tourism, C-3-4 short-term business). C-3-9 is the most common
PRC tourist visa product and the v1 target.

The form itself is **identical for every C-3-x sub-category** — Annex 17
(별지 제17호서식) of the Enforcement Rules of the Korean Immigration Control
Act, titled "사증발급신청서 / VISA APPLICATION FORM", revision 2022.2.7. The
sub-category is recorded in field 2.2 only (`Status of Stay = C-3-9`). The
e-Visa portal at `visa.go.kr` uses the same Annex 17 structure but is **not
directly accessible to PRC residents** — they apply through the local Korea
Visa Application Center (KVAC) instead.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility guidance | https://www.visa.go.kr/openPage.do?MENU_ID=10103 | Visa categories overview |
| 2. KVAC PRC landing | https://visaforkorea-bj.com/ (Beijing) / https://www.visaforkorea-sh.com/ (Shanghai) / https://www.koreavisa-wh.com/ (Wuhan) / etc. | PRC applicants enter here |
| 3. Application form (canonical source) | https://www.visa.go.kr/downfile/VisaapplicationForm_EN.pdf — Annex 17, bilingual KR/EN | The form — our extraction target |
| 4. Document submission | KVAC counter / mail-in (CN: KVAC.com.cn-operated) | Paper intake; no online submission for PRC |
| 5. Decision pickup | KVAC counter / courier | Passport returned with visa sticker |

The **v1 extraction target** is step 3 (Annex-17 PDF). Steps 4–5 are paper
intake handled by KVAC and out of schema.

### Application Structure

The Annex-17 form collects data across 12 numbered sections on 5 pages. These
map to 8 client-wizard steps (sections coalesced for UX flow):

1. Personal Details (Annex-17 §1)
2. Visa-Category Prefill + Passport (Annex-17 §2 + §3)
3. Contact + Emergency Contact (Annex-17 §4)
4. Marital & Family (Annex-17 §5)
5. Education & Employment (Annex-17 §6 + §7)
6. Trip & Visit (Annex-17 §8.1–8.5)
7. Travel History + Family in/with Korea (Annex-17 §8.6–8.9)
8. Invitation, Funding, Form Assistance, Declaration (Annex-17 §9–§12)

86 form fields total + 4 repeatable groups
(`korea_visits`, `foreign_trips_5y`, `family_in_korea`,
`family_travelling_with`).

---

## 2. v1 Scope — What Is Included

- **One visa category only:** KR_C39_SHORT_TERM_VISIT (≤90 days,
  single-entry, multi-purpose)
- **One application form:** Annex 17 (별지 제17호서식), rev 2022.2.7
- **Schema extraction:** all 12 Annex-17 sections, all 86 fields, all options,
  all requiredness, all 17 conditional gates, all 4 repeatable groups
- **Dynamic form rendering:** via existing `visa_form_fields` +
  `DynamicStepForm`
- **No automated submission** in v1 — KVAC operates a paper / counter intake
  channel for PRC residents; submission automation is not in product scope

---

## 3. Out-of-Scope Visa Categories (v1)

| Category | Reason for exclusion |
|----------|---------------------|
| C-3-1 (single-entry general short-term, ≤90d) | Same form, different consular-decision path; future package `KR_C31_SINGLE_ENTRY` |
| C-3-2 (group tour with designated agency) | Adds agency-name + agency-code supplementary fields not in Annex 17; future package `KR_C32_GROUP_TOUR` |
| C-3-3 (medical tourism) | Adds medical-institution + treatment-plan supplementary fields; future package `KR_C33_MEDICAL` |
| C-3-4 (short-term business) | Distinct purpose code + business-counterpart supporting docs; future package `KR_C34_BUSINESS` |
| K-ETA (electronic travel authorisation) | Different system, different form, currently suspended for PRC; future package for eligible nationalities |
| D-series (long-stay: D-2 student, D-7/8/9/10 employment, D-4 trainee, F-series resident) | Different form (Annex 17 with `Period of Stay = Long-term`) plus extensive supplementary docs; future packages per category |
| visa.go.kr self-service e-Visa | Same Annex 17 form structure, but **not accessible to PRC residents** — eligible only to nationals of designated countries; future package `KR_E_VISA` |

Future iterations can add them as additional `visa_type` entries and seed
scripts. The form structure (Annex 17) is reusable; sub-categories differ
mainly in field-2.2 prefill and supplementary-document requirements.

---

## 4. Known Source-Flow Ambiguities

1. **Section 8.1 purpose-of-visit rendering** — the official Annex 17 marks
   §8.1 as a multi-checkbox ("check all that apply") with 11 options. The
   generic `DynamicStepForm` renders `select` (single-choice) only. We render
   §8.1 as `select` and document this in the gap report; for C-3-9, applicants
   almost always pick `tourism_transit` or `visiting_family_relatives_friends`,
   so single-choice is acceptable for v1.
2. **Section 2.1 / 2.2 prefill** — C-3-9 is always `Period of Stay =
   Short-term` and `Status of Stay = C-3-9`. We hardcode these in the seed
   (read-only) rather than asking the user; this matches JP_TOURIST's
   `purpose_of_visit` lock-to-tourism pattern.
3. **Applicant under 17 signature swap** — Annex 17 §12.3 says "Applicant
   signature (or Parent/Legal Guardian if <17)". The form does not provide
   separate guardian-name / guardian-relationship inputs. v1 ignores the swap;
   under-17 applicants sign their own form. A v1.1 enhancement could add an
   `is_applicant_under_17` radio and conditional guardian fields (mirrors UK's
   under-18 pattern).
4. **5-year multi-entry C-3 (post-2026 PRC easing)** — Korean MOFA announced
   in 2026 that PRC nationals with prior C-3 visit history may qualify for
   5-year multi-entry C-3 visas. This is a consular-decision rule, not a
   form-field change; out of schema.
5. **Photo (1.0) and signature (12.3)** — file inputs on the paper form. Out
   of schema per playbook §5.6 (`application_documents` table). KVAC supplies
   format requirements (35×45mm, white background, ≤6 months old, no hat).

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official Annex-17
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimising downstream automation.

The Korea schema must be grounded in the actual Annex-17 form. Hand-written
or partially copied field lists are not acceptable proof of parity. Any
fields that cannot be verified against the official PDF must be flagged in
the gap report.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'KR_C39_SHORT_TERM_VISIT'` |
| `visa_packages` table | New row registered via Drizzle migration `0023_kr_c39_package.sql` |
| Seed script | `viza-be/agent-backend/scripts/seed-kr-c39-short-term-visit-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | None in v1 — KVAC paper intake; no programmatic channel exists for PRC residents |
| Answer storage | Existing `visa_application_answers` table |
| Document uploads (photo, hukou, employment cert, bank statement, etc.) | Existing `application_documents` table — out of schema |

---

## 7. How the Korea C-3-9 Schema Was Derived

The schema is a **high-fidelity reconstruction** from the published Annex-17
PDF, extracted verbatim via `pdftotext -layout` against
https://www.visa.go.kr/downfile/VisaapplicationForm_EN.pdf (rev 2022.2.7). No
field labels were inferred — every label comes from the bilingual PDF. KVAC
documents (Beijing, Shanghai, Wuhan, Wenzhou) and the Singapore / Manila
Korean embassy pages were cross-referenced for PRC-specific submission
context, but they confirm the form itself is unchanged from Annex 17.

A live-portal walk against `visa.go.kr` was **not performed** because the
self-service portal is not accessible to PRC residents (geo-gated).

Sources consulted:
- https://www.visa.go.kr/downfile/VisaapplicationForm_EN.pdf — primary
- https://aze.mofa.go.kr/upload/cntnts/az-az/VISA%20APPLICATION%20FORM.pdf — mirror
- https://www.visaforkorea-bj.com/upload/%E7%AD%BE%E8%AF%81%E7%A7%8D%E7%B1%BB%E5%8F%8A%E6%89%80%E9%9C%80%E6%9D%90%E6%96%99(241112)_1.pdf — KVAC Beijing visa types & required materials, Nov 2024
- https://www.koreavisa-wh.com/files/visadoc/%E8%A7%82%E5%85%8925.02%201.pdf — KVAC Wuhan tourism guide, Feb 2025
- https://www.visaforkorea-id.com/assets/pdfs/C-3-9_Checklist.pdf — KVAC Indonesia C-3-9 checklist (cross-reference)
- https://overseas.mofa.go.kr/sg-en/brd/m_2444/view.do?seq=761433 — Korean Embassy Singapore C-3-9 page
- https://www.mofa.go.kr/ph-en/brd/m_3277/view.do?seq=684566 — Korean Embassy Manila C-3 (employed) requirements
- https://en.wikipedia.org/wiki/List_of_South_Korean_visas — taxonomy reference

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-kr-c39-short-term-visit-form-fields.ts`
2. Run: `cd viza-be/agent-backend && npx tsx scripts/seed-kr-c39-short-term-visit-form-fields.ts`
3. Verify output: `Done: 86 rows seeded (86 defined)` with matching N (or whatever N your update produces)
4. No frontend deployment needed — the dynamic form reads from DB at runtime

### How to Add a Related Visa Category

1. Copy the seed script to `seed-kr-{c31|c32|c33|c34}-form-fields.ts`
2. Change `VISA_TYPE` to `KR_C31_SINGLE_ENTRY` / `KR_C32_GROUP_TOUR` / etc.
3. Update field 2.2 prefill to the new sub-category code
4. Add sub-category-specific fields (e.g. C-3-2 needs `agency_name` + `agency_code`; C-3-3 needs `medical_institution_name` + `treatment_plan_summary`)
5. Add a Drizzle migration inserting into `visa_packages`
6. Run the seed
7. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)
1. **PDF generation of completed Annex-17 from VIZA answers** — KVAC accepts
   pre-filled paper forms. Generate a print-ready PDF mirroring Annex-17
   layout from `visa_application_answers` so users can print, sign, and bring
   to KVAC. (Mirrors JP-005 immediate item.)
2. **Multi-select renderer extension for §8.1 purpose-of-visit** — extend
   `DynamicStepForm` to render `field_type: "checkbox_multi"` so applicants
   can pick multiple purposes per Annex 17. Currently rendered as single-select.

### Short-term (v1.1)
3. **Under-17 applicant guardian fields** — add `is_applicant_under_17` radio
   + conditional guardian-name / guardian-relationship fields for §12.3
   signature swap (mirrors UK under-18 pattern).
4. **`KR_C32_GROUP_TOUR` package** — group-tour C-3-2 with designated travel
   agency name + code as supplementary fields. Common for PRC tourists
   travelling via tour operators.
5. **`KR_C33_MEDICAL` package** — medical-tourism C-3-3 with Korean medical
   institution + treatment plan fields. Growing PRC market segment.
6. **Hukou + PRC ID validation** — check-digit validation for the
   `national_identity_no` field (PRC 18-digit ID with GB 11643-1999 checksum).

### Medium-term (v2)
7. **`KR_E_VISA` package targeting visa.go.kr self-service** — for
   nationalities eligible to self-apply (not PRC). Same Annex-17 schema, just
   a different submission channel.
8. **D-series long-stay packages** — D-2 student, D-7/8/9/10 employment,
   D-4 trainee, F-series resident. Each is a distinct package with
   substantial supplementary-document requirements.
9. **K-ETA package** — when the K-ETA visa-waiver track is reinstated for PRC
   nationals (currently suspended), build a `KR_K_ETA` package targeting
   `k-eta.go.kr` (different system, different ~30-field form).
10. **Live-portal QA pass** — only feasible from a non-PRC nationality with
    visa.go.kr self-service access; should still be done once for parity
    confidence.

---

## 9. Source material checklist (honesty disclosure)

- [x] Live portal was driven end-to-end: **no** — visa.go.kr is geo-gated
      against PRC residents; KVAC has no programmatic channel.
- [x] Published application PDF consulted: yes —
      https://www.visa.go.kr/downfile/VisaapplicationForm_EN.pdf rev 2022.2.7
- [x] Caseworker guidance consulted: partial — KVAC PRC visa-types
      catalogues (Beijing Nov-2024, Wuhan Feb-2025) and Korean embassy
      Singapore / Manila C-3 pages.
- [x] Legal basis consulted: Enforcement Rules of the Immigration Control Act
      Annex 17 (form template legally defined).
- [ ] Live-portal QA pass completed: **no** — flagged as v2 medium-term item.
      Schema is reconstructed from PDF; treat as high-fidelity but not
      live-verified.
