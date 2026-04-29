# Cambodia Tourist e-Visa Extraction Scope — v1

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** Cambodia Tourist e-Visa (single-entry)
**VIZA visa_type key:** `KH_TOURIST_E_VISA`

The Royal Government of Cambodia Ministry of Foreign Affairs and
International Cooperation issues the Tourist e-Visa via
`https://www.evisa.gov.kh`. Public portal — no account required.

Single-entry (~USD 36 incl. service fee, 3-month validity, 30-day stay).

### Application Structure

8 logical steps (standard Asia-tourist template).

---

## 2. v1 Scope

- One submission variant
- ~70 fields
- KH-specific port-of-entry list (Phnom Penh / Siem Reap / Sihanoukville
  airports + 5 land borders + cruise port)

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Business e-Visa | Different evidence pack |
| E-Class (work) / K-Class (dependant) Ordinary Visa | Consular flow |
| Visa-on-arrival | No online form, USD 30 cash at borders |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA easy** — public portal, no auth.
2. **Date format** — DD/MM/YYYY.
3. **Single-entry only on e-Visa** — multi-entry requires Business eVisa
   or consular Ordinary Visa.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-kh-e-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources: evisa.gov.kh public landing + General Department of Immigration
applicant guidance.

---

## 8. Next Expansion Path

1. Live-portal QA pass (easy).
2. KH eVisa Playwright runner (no auth).
3. `KH_BUSINESS_E_VISA`.
4. `KH_E_CLASS_WORK_VISA` consular.

---

**Maintainer:** Edward Zehua Zhang
