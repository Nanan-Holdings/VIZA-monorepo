# Hong Kong Visit Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, Form ID 936 PDF render + PAR live QA pending
**Created:** 2026-04-28

---

## 1. Coverage Summary

`HK_VISIT_VISA` registered as a `visa_packages` row and seeded with
the full Visit Visa application field set:

- 8 logical steps (personal, passport, contact, occupation, trip, host,
  travel history, character + declaration)
- ~80 fields total
- 11+ conditional gates, 3 repeat groups (other_nationalities,
  other_passports, prior_hk_visits)
- Three variants (Form ID 936 single, Form ID 936 multiple, PAR for
  Indian nationals) captured by `visa_type_requested`
- Optional Chinese name field
- Host HKID field (loose validation)
- HK-specific port-of-entry list (HKIA + Mainland border + Macao
  border + cruise terminals)

Renders via `DynamicStepForm` with no country-specific React code.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match Form ID 936 | ✅ |
| Field labels match PAR online flow | ⚠️ Pending live QA (PAR, Indian-only) |
| Required vs optional matches Form ID 936 | ✅ |
| Date format | ✅ DD/MM/YYYY |
| Chinese name optional | ✅ |
| HKID format validation tightening | ⚠️ Loose maxLength only |
| PAR length-of-stay cap (14 days) | ⚠️ Not gated on variant — live PAR enforces |
| Port-of-entry coverage | ✅ Major ports + other |
| Document upload | ❌ Out-of-schema, see §4 |
| Submission automation | ❌ Out-of-scope v1, see §5 |

---

## 3. Conditional-Logic Status

Operators in use: `===` equality (all sub-journey gates).
Operators **not** used: `||`, `&&`, `in`/`not in`, `required_unless`.

The schema does NOT vary length-of-stay max by `visa_type_requested`
(PAR caps at 14 days; Form ID 936 stays vary by nationality 14–90 days).
The validation regex is a generous `^(?:[1-9]|[1-8][0-9]|90)$`. Live
portals enforce nationality-specific caps.

---

## 4. Document Uploads — Out of Schema

Per playbook §5.6. HK Visit Visa expects:

- Passport biographic page (PDF / JPG)
- Recent passport-style photograph (35×45 mm)
- Hotel booking / itinerary
- Return / onward flight ticket
- Financial proof (bank statement)
- Sponsor letter from HK host (where applicable)
- Photocopy of host's HKID front + back (where applicable)

These flow through `application_documents`.

---

## 5. Submission Automation — Out of Scope v1

Form ID 936: paper submission, not automatable. Best automation path is
**PDF rendering + posted submission with tracking** — mirror the
JP_TOURIST MOFA Form A pipeline.

PAR: online portal, automatable. Indian-only.

Per playbook §13, both deferred until first applicant.

---

## 6. Form ID 936 PDF Render — Top Open Item

**Action required post-v1:**

1. Vendor `ID_936.pdf` from `immd.gov.hk/eng/forms/forms/ID%20936.html`.
2. Inspect AcroForm field names (sample-fill technique from
   JP_TOURIST inspection script).
3. Build `viza-fe/internal-website/lib/hk-visit/render-id-936.ts`
   parallel to `lib/jp-tourist/render-form-a.ts`.
4. Add `HK_VISIT_VISA` to the `SubmissionResultStatus` union with
   `form_ready_for_agency` outcome.
5. Add `HkResultCard` to the SubmissionStatusStep switch.
6. API route `/api/applications/[id]/hk-id-936-pdf`.

Risk: Form ID 936 may have CJK-character fields that exceed WinAnsi
encoding. May need fontkit + TTF embedding (~5MB bundle hit) — track
with JP_TOURIST v1.1 follow-up.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0029_hk_visit_visa_package.sql` applies cleanly
- [ ] All 8 steps render via `DynamicStepForm`
- [ ] Variants on `visa_type_requested` show all 3 options
- [ ] Optional Chinese name renders correctly

---

## 8. Open Items / Future Work

| Item | Priority | Effort | Owner |
|------|----------|--------|-------|
| Form ID 936 PDF rendering pipeline | High | L (mirror JP_TOURIST) | FE/BE |
| PAR live QA + Playwright runner (Indian) | Med | L | BE |
| Document upload wiring | High | M | FE |
| HKID format validation tightening | Low | XS | BE |
| `HK_EMPLOYMENT_VISA` (GEP) | Med | XL | BE |
| `HK_TOP_TALENT_PASS` (TTPS) | Med | L | BE |
| `HK_DEPENDANT_VISA` | Low | M | BE |

---

**Maintainer:** Edward Zehua Zhang
