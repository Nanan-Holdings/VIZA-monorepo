# UAE Tourist Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, live-portal QA pending
**Created:** 2026-04-29

---

## 1. Coverage Summary

`AE_TOURIST_VISA` registered as a `visa_packages` row and seeded with:

- 9 logical steps (extends 8-step template with a UAE Sponsor sub-journey)
- ~78 fields total
- 12+ conditional gates, 3 repeat groups
- Three submission variants on `visa_type_requested` (30-day / 60-day
  single-entry, 5-year multi-entry)
- UAE-specific: optional Arabic name, optional religion, sponsor block
  (airline/agent/hotel/Resident/self-ICP), emirate field, Emirates ID /
  trade-license sponsor identifier

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match ICP/GDRFA guidance | ✅ |
| Field labels match live ICP/GDRFA portals | ⚠️ Pending live QA |
| Sponsor type → required-fields variation | ⚠️ Schema captures union; live may filter |
| Arabic name optional | ✅ |
| Emirate field captured | ✅ |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope v1 |

---

## 3. Conditional-Logic Status

`===` only.

---

## 4. Document Uploads — Out of Schema

ICP/GDRFA expect:

- Passport biographic page (PDF / JPG)
- Recent photograph
- Hotel booking / itinerary
- Return / onward ticket
- Sponsor's Emirates ID + trade license (where applicable)
- Confirmed onward ticket (for transit / VOA-eligible nationalities)

Flow through `application_documents`.

---

## 5. Submission Automation — Out of Scope v1

Both ICP Smart Services and GDRFA Dubai portals are identity-gated.
Sponsor accounts (airline / agent / hotel) are typically issued by the
sponsor entity, not directly to applicants. Per playbook §13, deferred.

---

## 6. Top Open Items

1. **Live-portal QA pass** with sponsor account.
2. **Sponsor-type field-variation matrix** — confirm which sponsor
   types skip / require certain fields.
3. **Emirate dropdown** — currently text; consider closed enum (Dubai /
   Abu Dhabi / Sharjah / Ajman / UAQ / RAK / Fujairah).

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0034_ae_tourist_visa_package.sql` applies cleanly
- [ ] All 9 steps render via `DynamicStepForm`
- [ ] Sponsor sub-journey opens when has_sponsor === yes

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Live-portal QA pass | High | M |
| Sponsor-type matrix mapping | Med | S |
| Emirate enum (closed dropdown) | Low | XS |
| `AE_GOLDEN_VISA` (10-year) | High | XL |
| `AE_GREEN_VISA` (5-year self-sponsor) | Med | L |
| `AE_EMPLOYMENT_RESIDENCE` | Med | L |
| `AE_FREELANCE_PERMIT` | Low | M |

---

**Maintainer:** Edward Zehua Zhang
