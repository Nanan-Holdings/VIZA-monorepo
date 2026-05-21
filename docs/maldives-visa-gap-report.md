# Maldives IMUGA Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped
**Created:** 2026-04-29

---

## 1. Coverage Summary

`MV_IMUGA` registered as a `visa_packages` row and seeded with:

- 7 logical steps (slimmer than visa template — no host / sponsor /
  character blocks)
- ~32 fields (smallest VIZA-modeled package)
- 6 conditional gates (other_nationalities, port_of_entry_other,
  health_symptoms, outbreak_country_recent, currency_threshold,
  restricted_items)
- 1 repeat group (other_nationalities)
- 1 submission variant (IMUGA Traveller Declaration)

MV-specific: atoll + island accommodation breakdown, health symptoms
screening, customs declarations (currency >USD 30k, restricted items
incl. alcohol/pork/non-Islamic religious materials/narcotics).

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match IMUGA + Maldives Immigration guidance | ✅ |
| Field labels match live IMUGA | ⚠️ Pending live QA |
| Atoll closed enum vs. text | ⚠️ Schema is text; live may be closed |
| Date format | ✅ DD/MM/YYYY |
| Customs threshold (USD 30k) | ⚠️ Subject to revision |
| Submission automation | ❌ Out-of-scope v1 (strong candidate) |

---

## 3. Conditional-Logic Status

`===` only.

---

## 4. Document Uploads

- Passport biographic page
- Accommodation booking confirmation

---

## 5. Submission Automation — Strong Candidate

IMUGA is publicly accessible (no account); strong Playwright runner
candidate. Per playbook §13, deferred until first applicant.

---

## 6. Top Open Items

1. **Live-portal QA pass** — easy.
2. **Atoll closed enum** — 26 atolls.
3. **IMUGA Playwright runner** — high ROI.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0036_mv_imuga_package.sql` applies cleanly
- [ ] All 7 steps render via `DynamicStepForm`

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Live-portal QA pass | High | XS |
| Atoll closed-enum | Med | S |
| IMUGA Playwright runner | High | M |
| `MV_RESORT_PERMIT` | Low | M |

---

**Maintainer:** Edward Zehua Zhang
