# Canada TRV + eTA Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, live-portal QA pending
**Created:** 2026-04-29

---

## 1. Coverage Summary

`CA_TRV` registered as a `visa_packages` row and seeded with:

- 8 logical steps (extends Asia-tourist template with military-service +
  TB-history)
- ~85 fields total
- 13+ conditional gates (incl. common-law partner via `||`)
- 3 repeat groups (other_nationalities, other_passports, prior_canada_visits)
- 3 submission variants (eTA, TRV single, TRV multi)

CA-specific: common-law marital status, military-service question
(IMM 5645), TB-history question, available funds CAD, monthly income
CAD, inclusive gender option.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match IMM 5257 + IMM 5645 + eTA guidance | ✅ |
| Field labels match live IRCC Secure Account | ⚠️ Pending live QA |
| Common-law partner gating (married OR common_law) | ✅ Uses `||` |
| Military-service question | ✅ |
| TB-history question | ✅ |
| Postal code Canadian format | ⚠️ Schema accepts generic |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope v1 |

---

## 3. Conditional-Logic Status

Operators in use: `===`, `||` (common-law OR married → spouse block).
Joins NZ_VISITOR_VISA as second VIZA schema using `||` in sub-journey.

---

## 4. Document Uploads — Out of Schema

IRCC expects:

- Passport biographic page
- Recent photograph
- Proof of funds (bank statement)
- Employment letter
- Invitation letter (if visiting host)
- Return / onward ticket
- IMM 5645 family information form (auto-filled from this schema)
- Police clearance certificate (some nationalities)

Flow through `application_documents`.

---

## 5. Submission Automation — Out of Scope v1

IRCC Secure Account requires GCKey or Sign-In Partner (Canadian bank
SSO). eTA is online but submission requires email-link verification.

Per playbook §13, deferred. eTA is a strong first auto-runner candidate.

---

## 6. Top Open Items

1. **Live-portal QA pass** with GCKey credentials.
2. **eTA Playwright runner** — easier than TRV, high ROI.
3. **Postal code Canadian-format validation** — currently generic.
4. **IMM 5257 + IMM 5645 PDF render** — IRCC accepts paper applications;
   PDF rendering parallel to JP_TOURIST MOFA Form A pipeline would let
   VIZA produce posted-submission packages.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0035_ca_trv_package.sql` applies cleanly
- [ ] All 8 steps render via `DynamicStepForm`
- [ ] Common-law partner sub-journey opens for `married` OR `common_law`

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Live-portal QA pass with GCKey | High | M |
| eTA Playwright runner | High | M |
| IMM 5257 + IMM 5645 PDF render | High | L (mirror JP_TOURIST) |
| Postal-code Canadian regex tightening | Low | XS |
| `CA_SUPER_VISA` package | Med | L |
| `CA_STUDY_PERMIT` package | Med | XL |
| `CA_WORK_PERMIT` package | Med | XL |

---

**Maintainer:** Edward Zehua Zhang
