# Sri Lanka ETA Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped
**Created:** 2026-04-29

---

## 1. Coverage Summary

`LK_ETA` registered with:

- 8 logical steps
- ~70 fields
- 11+ conditional gates, 3 repeat groups
- 4 submission variants (Tourist single/double/multi, Business single)

LK-specific: 3 airports + 4 seaports.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match Department of Immigration guidance | ✅ |
| Field labels match live eta.gov.lk | ⚠️ Pending live QA (easy) |
| Nationality-based fee | ⚠️ Schema captures range; portal computes |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope (strong candidate) |

---

## 3. Conditional-Logic Status

`===` only.

---

## 4. Documents

- Passport bio
- Photograph

---

## 5. Submission Automation — Strong Candidate

Public portal, no auth.

---

## 6. Top Open Items

1. Live QA pass (easy).
2. LK ETA Playwright runner.

---

## 7. Reviewer Checklist

- [ ] Seed run matches
- [ ] type-check passes
- [ ] Migration `0040_lk_eta_package.sql` applies
- [ ] All 8 steps render

---

## 8. Open Items

| Item | Priority | Effort |
|------|----------|--------|
| Live QA | High | XS |
| Playwright runner | High | M |
| `LK_RESIDENT_VISA` | Med | L |

---

**Maintainer:** Edward Zehua Zhang
