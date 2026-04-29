# Laos Tourist e-Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped
**Created:** 2026-04-29

---

## 1. Coverage Summary

`LA_TOURIST_E_VISA` registered with:

- 8 logical steps
- ~65 fields
- 11+ conditional gates, 3 repeat groups
- 2 submission variants (e-Visa, VOA pre-clearance)

LA-specific: 4 airports + 4 Mekong Friendship Bridges + China/Vietnam/
Cambodia land borders.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match MFA + Embassy guidance | ✅ |
| Field labels match live laoevisa.gov.la | ⚠️ Pending live QA (easy) |
| Nationality-based fee | ⚠️ Schema captures range; live portal computes |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope (strong candidate) |

---

## 3. Conditional-Logic Status

`===` only.

---

## 4. Documents — Out of Schema

- Passport bio
- Photograph

---

## 5. Submission Automation — Strong Candidate

Public portal, no auth.

---

## 6. Top Open Items

1. Live QA pass.
2. LA Playwright runner.

---

## 7. Reviewer Checklist

- [ ] Seed run matches
- [ ] type-check passes
- [ ] Migration `0039_la_tourist_e_visa_package.sql` applies
- [ ] All 8 steps render

---

## 8. Open Items

| Item | Priority | Effort |
|------|----------|--------|
| Live QA | High | XS |
| Playwright runner | High | M |
| `LA_BUSINESS_VISA` | Med | M |

---

**Maintainer:** Edward Zehua Zhang
