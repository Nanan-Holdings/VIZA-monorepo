# Philippines 9(a) + eTravel Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped
**Created:** 2026-04-29

---

## 1. Coverage Summary

`PH_TEMPORARY_VISITOR_VISA` registered with:

- 8 logical steps
- ~75 fields
- 11+ conditional gates, 3 repeat groups
- 4 submission variants (eTravel-only, 9(a) single, 9(a) multi-6mo,
  9(a) multi-1y)

PH-specific: 4-variant routing, comprehensive PH port-of-entry list,
mandatory flight-number field (eTravel requirement).

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match BI/DFA + eTravel guidance | ✅ |
| Field labels match live eTravel | ⚠️ Pending live QA (easy) |
| 9(a) field set matches consular paper form | ⚠️ Pending QA |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope v1 (eTravel strong candidate) |

---

## 3. Conditional-Logic Status

`===` only.

---

## 4. Document Uploads

- Passport biographic page
- Recent photograph (passport-size)
- Hotel / itinerary
- Return ticket
- Financial proof
- Sponsor invitation letter (where applicable)

---

## 5. Submission Automation

eTravel: publicly accessible, strong Playwright runner candidate.
9(a): paper-only, automation = PDF render mirroring JP_TOURIST.

---

## 6. Top Open Items

1. **eTravel live-portal QA pass** — easy.
2. **eTravel Playwright runner** — high ROI.
3. **9(a) PDF render** — mirror JP_TOURIST pipeline.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0037_ph_temporary_visitor_visa_package.sql` applies
- [ ] All 8 steps render via `DynamicStepForm`
- [ ] All 4 visa_type_requested variants visible

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| eTravel live-portal QA pass | High | XS |
| eTravel Playwright runner | High | M |
| 9(a) PDF render | Med | L |
| `PH_SRRV` package | Low | L |
| `PH_9G_PRE_ARRANGED_EMPLOYEE` | Low | L |

---

**Maintainer:** Edward Zehua Zhang
