# Cambodia Tourist e-Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped
**Created:** 2026-04-29

---

## 1. Coverage Summary

`KH_TOURIST_E_VISA` registered with:

- 8 logical steps
- ~70 fields
- 11+ conditional gates, 3 repeat groups
- 1 submission variant (single-entry)

KH-specific: 3 international airports (PNH/REP/KOS) + 5 land borders
(Poipet/Bavet/Cham Yeam/Dong Kralor/Phnom Den) + Sihanoukville seaport.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match MFA + GDI guidance | ✅ |
| Field labels match live evisa.gov.kh | ⚠️ Pending live QA (easy) |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope (strong candidate) |

---

## 3. Conditional-Logic Status

`===` only.

---

## 4. Document Uploads — Out of Schema

- Passport biographic page
- Recent photograph

---

## 5. Submission Automation — Strong Candidate

evisa.gov.kh is publicly accessible. Strong Playwright runner candidate.

---

## 6. Top Open Items

1. Live-portal QA pass (easy).
2. KH Playwright runner.

---

## 7. Reviewer Checklist

- [ ] Seed run matches
- [ ] type-check passes
- [ ] Migration `0038_kh_tourist_e_visa_package.sql` applies
- [ ] All 8 steps render

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Live QA pass | High | XS |
| Playwright runner | High | M |
| `KH_BUSINESS_E_VISA` | Med | M |
| `KH_E_CLASS_WORK_VISA` | Low | L |

---

**Maintainer:** Edward Zehua Zhang
