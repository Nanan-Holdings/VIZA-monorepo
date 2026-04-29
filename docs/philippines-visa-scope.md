# Philippines Temporary Visitor Visa + eTravel Extraction Scope — v1

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** Philippines 9(a) Temporary Visitor Visa + eTravel Declaration
**VIZA visa_type key:** `PH_TEMPORARY_VISITOR_VISA`

Two parallel flows in the Philippines arrival path:

- **9(a) Temporary Visitor Visa** — paper application at Philippine
  consular posts abroad (DFA / BI). Required for ~30 visa-required
  nationalities. Single + multi-entry variants.
- **eTravel Declaration** — online at `https://etravel.gov.ph`,
  mandatory for ALL arrivals (visa-required or visa-free), free,
  submitted within 72 hours of arrival.

Four variants on `visa_type_requested`:
- eTravel-only (visa-free / VOA arrivals)
- 9(a) Single-entry (~USD 30, 3-month validity, 59-day stay)
- 9(a) Multi-entry 6-month (~USD 60)
- 9(a) Multi-entry 1-year (~USD 90)

### Application Structure

8 logical steps (standard Asia-tourist template).

---

## 2. v1 Scope

- 4 submission variants on `visa_type_requested`
- ~75 fields, options, requiredness, conditional logic
- PH-specific: 4-variant routing, PH port-of-entry list (NAIA / Clark /
  Cebu / Davao / Iloilo / Kalibo / Puerto Princesa + cruise ports),
  flight number required (eTravel mandates)

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| 9(d) Treaty Trader / Investor | Different legal track |
| 9(e) Foreign Government Official | Bilateral channels |
| 9(f) Student | Sponsor-driven (school) |
| 9(g) Pre-arranged Employee | Employer-driven |
| SRRV (Special Resident Retiree's Visa) | Long-stay programme |
| SIRV (Special Investor's Resident Visa) | Investment-based |
| Balikbayan privilege (Filipino spouse) | Family entitlement |
| Visa-on-arrival (~157 nationalities visa-free up to 30 days) | No application form |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA partially possible** — eTravel is publicly-
   accessible (no auth); 9(a) is paper at consular posts.
2. **9(a) paper form** — schema mirrors the field set; submission
   automation = PDF render (mirror JP_TOURIST).
3. **Date format** — DD/MM/YYYY.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-ph-temporary-visitor-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources used:

- BI / DFA public applicant guidance pages
- 9(a) paper application antecedent
- eTravel landing pages + mobile-app form
- Philippine consular post applicant guidance (London, Washington,
  Beijing, Tokyo)

**Live-portal QA pass** for eTravel is straightforward. 9(a) submission
automation = PDF render path.

---

## 8. Next Expansion Path

1. **Live-portal QA pass** (eTravel, easy).
2. **eTravel Playwright runner** — strong candidate (no auth).
3. **9(a) paper form PDF render** — mirror JP_TOURIST pipeline.
4. **`PH_SRRV`** — Special Resident Retiree's Visa.
5. **`PH_9G_PRE_ARRANGED_EMPLOYEE`** — work visa.

---

**Maintainer:** Edward Zehua Zhang
