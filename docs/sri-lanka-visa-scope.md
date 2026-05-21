# Sri Lanka ETA Extraction Scope — v1

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** Sri Lanka ETA (Electronic Travel Authorization)
**VIZA visa_type key:** `LK_ETA`

Sri Lanka Department of Immigration and Emigration issues ETA via
`https://www.eta.gov.lk`. Public portal — no account required.

Four variants on `visa_type_requested`: Tourist single, Tourist double,
Tourist multiple, Business single. All 30-day stay per entry.

### Application Structure

8 logical steps (standard Asia-tourist template).

---

## 2. v1 Scope

- 4 submission variants
- ~70 fields
- LK-specific port-of-entry list: 3 airports (CMB / HRI / RML) +
  4 seaports (Colombo / Galle / Trincomalee / Hambantota)

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Resident Visa | Long-stay |
| Work Visa | Sponsor-driven |
| Student Visa | Sponsor-driven |
| Investor Visa | Bespoke programme |
| Dependent Visa | Family-sponsored |

---

## 4. Known Source-Flow Ambiguities

1. Live-portal QA easy.
2. Nationality-dependent fee.
3. Date format DD/MM/YYYY.

---

## 5. Design Principle

Source-truth-over-manual-approximation.

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-lk-eta-form-fields.ts
```

---

## 7. Source Material

- eta.gov.lk public landing
- Sri Lanka Department of Immigration and Emigration applicant guidance

---

## 8. Next Expansion Path

1. Live-portal QA pass.
2. LK ETA Playwright runner (no auth).
3. `LK_RESIDENT_VISA`.
4. `LK_BUSINESS_VISA` extended.

---

**Maintainer:** Edward Zehua Zhang
