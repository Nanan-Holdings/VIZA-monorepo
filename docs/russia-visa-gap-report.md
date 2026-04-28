# Russia Unified e-Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, live-portal QA pending
**Created:** 2026-04-28

---

## 1. Coverage Summary

`RU_E_VISA` registered as a `visa_packages` row and seeded with:

- 8 logical steps
- ~70 fields total
- 11+ conditional gates, 3 repeat groups
- Single submission variant (Unified e-Visa single-entry)
- Mandatory medical insurance block (3 fields) in step 5
- MID-designated port-of-entry list (Moscow + SPb + 6 regional airports
  + Estonia/Finland land borders + 4 seaports)
- Multi-purpose under one form (tourism / business / humanitarian / guest)

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match MID e-Visa documentation | ✅ |
| Field labels match live evisa.kdmid.ru | ⚠️ Pending live QA |
| Eligibility filter (nationality) | ❌ Not gated in schema; filter at intake |
| Medical insurance fields captured | ✅ (company, policy, coverage) |
| Designated entry-point list | ✅ Per MID list |
| Cyrillic transliteration handling | ⚠️ Schema accepts both; live may auto |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope v1 |

---

## 3. Conditional-Logic Status

`===` equality only. No compound, no list, no `required_unless`.

---

## 4. Document Uploads — Out of Schema

- Passport biographic page (PDF / JPG)
- Recent photograph (35×45 mm, biometric)
- Medical insurance certificate (mandatory)

Flow through `application_documents`.

---

## 5. Submission Automation — Out of Scope v1

evisa.kdmid.ru is identity-gated. Geopolitical sensitivity may affect
hosting / reachability of the runner. Per playbook §13, deferred until
first applicant.

---

## 6. Top Open Items

1. **Live-portal QA pass** with eligible-nationality applicant.
2. **Eligibility filter at intake** — VIZA frontend should not offer
   RU_E_VISA to ineligible nationalities (US, EU, UK, AU, NZ, CA).
3. **`RU_TOURIST_VISA`** consular paper variant — for the bulk of
   Western applicants who can't use e-Visa.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0032_ru_e_visa_package.sql` applies cleanly
- [ ] All 8 steps render via `DynamicStepForm`
- [ ] Medical insurance block renders with all 3 fields

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Live-portal QA pass | High | M |
| Nationality eligibility filter at intake | High | XS (FE) |
| `RU_TOURIST_VISA` consular paper variant | High | L |
| `RU_BUSINESS_VISA` consular | Med | L |
| `RU_PRIVATE_VISA` (family visit) | Med | L |
| Submission automation (geopolitically sensitive) | Low | XL |

---

**Maintainer:** Edward Zehua Zhang
