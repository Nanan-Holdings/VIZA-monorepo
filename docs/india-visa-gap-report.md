# India e-Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped
**Created:** 2026-04-29

---

## 1. Coverage Summary

`IN_E_VISA` registered with:

- 9 logical steps
- ~110 fields (largest non-DS-160 schema)
- 15+ conditional gates incl. multiple purpose-specific sub-journeys
  (business / medical / conference)
- 4 repeat groups (other_nationalities, other_passports, prior_in_visits)
- 7 submission variants (e-Tourist x3 + e-Business + e-Medical +
  e-Medical-Attendant + e-Conference)

IN-specific: SAARC declaration, religion + parents' nationality +
parents' birthplace, transgender sex option, MEA clearance number for
conference, cities-to-visit textarea.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match Bureau of Immigration + High Commission guidance | ✅ |
| Field labels match live indianvisaonline.gov.in | ⚠️ Pending live QA |
| Stay-length nationality cap (90 vs 180) | ⚠️ Schema caps at 180; live filters |
| SAARC nationality follow-up details | ✅ Required textarea on yes |
| MEA conference clearance number (gated on e-Conference) | ✅ |
| Purpose-specific sub-journeys (business / medical / conference) | ✅ |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope (strong candidate) |

---

## 3. Conditional-Logic Status

Operators in use: `===` equality. Multiple parallel sub-journey gates
on `purpose_of_visit` (business / medical / conference). Joins UK
Standard Visitor as schemas with multiple purpose-driven sub-journey
patterns.

---

## 4. Document Uploads — Out of Schema

Per category:
- Tourist: passport bio + photo
- Business: business invitation letter
- Medical: hospital appointment letter
- Conference: MEA-cleared invitation
- All: passport bio + recent photograph

Flow through `application_documents`.

---

## 5. Submission Automation — Strong Candidate

indianvisaonline.gov.in is publicly accessible. Strong Playwright
runner candidate; complexity is in the multi-page state machine and
biometric-on-arrival workflow (out-of-form).

---

## 6. Top Open Items

1. Live-portal QA pass (easy, no auth).
2. IN e-Visa Playwright runner.
3. Stay-length nationality lookup table for surfaced messaging.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0042_in_e_visa_package.sql` applies cleanly
- [ ] All 9 steps render via `DynamicStepForm`
- [ ] Purpose-specific sub-journeys appear when their purpose is selected
- [ ] SAARC follow-up textarea appears when SAARC nationality = yes
- [ ] All 7 visa_type_requested variants visible

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Live-portal QA pass | High | M |
| IN e-Visa Playwright runner | High | L (multi-page state machine) |
| Stay-length nationality table | Med | S |
| `IN_OCI` (lifetime card) | Med | XL |
| `IN_EMPLOYMENT_VISA` consular | Low | XL |
| `IN_STUDENT_VISA` consular | Low | L |

---

**Maintainer:** Edward Zehua Zhang
