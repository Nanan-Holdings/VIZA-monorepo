# Macau Visit Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, paper-form PDF render + VOA cover sheet pending
**Created:** 2026-04-28

---

## 1. Coverage Summary

`MO_VISIT_VISA` registered as a `visa_packages` row and seeded with
the full Visit Visa application field set:

- 8 logical steps
- ~75 fields total
- 11+ conditional gates, 3 repeat groups
- Three submission variants (VOA single, VOA multiple, paper Visit Visa)
- Optional Chinese name field
- BIR / BIRH host ID field

Renders via `DynamicStepForm`.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match DSI paper form | ✅ Reconstructed |
| Date format | ✅ DD/MM/YYYY |
| Chinese name optional | ✅ |
| BIR / BIRH validation tightening | ⚠️ Loose maxLength only |
| Document upload | ❌ Out-of-schema |
| Submission automation (paper) | ❌ Out-of-scope v1 |

---

## 3. Conditional-Logic Status

`===` equality only. No compound, no list, no `required_unless`,
no cross-step.

---

## 4. Document Uploads — Out of Schema

- Passport biographic page
- Recent photograph
- Hotel booking / itinerary
- Return / onward ticket
- Financial proof (where applicable)

Flow through `application_documents`.

---

## 5. Submission Automation — Out of Scope v1

DSI is paper-only for visa-required nationals. VOA is at-the-border.
Pragmatic automation = paper PDF rendering + VOA cover sheet.

---

## 6. Top Open Items

1. **Paper-form PDF rendering** — mirror JP_TOURIST.
2. **Printable VOA cover sheet** — for the ~80 VOA-eligible nationalities.
3. **BIR / BIRH format validation tightening**.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0030_mo_visit_visa_package.sql` applies cleanly
- [ ] All 8 steps render via `DynamicStepForm`

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Paper-form PDF render | Med | L |
| VOA cover-sheet PDF | Low | M |
| `MO_BLUE_CARD` (worker permit) | Low | XL |
| Submission automation | Low | XL |

---

**Maintainer:** Edward Zehua Zhang
