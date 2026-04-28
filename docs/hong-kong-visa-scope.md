# Hong Kong Visit Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-28

---

## 1. Canonical Journey

**Visa type:** Hong Kong Visit Visa (Form ID 936 + PAR for Indian nationals)
**VIZA visa_type key:** `HK_VISIT_VISA`

The v1 audience is travellers from one of the ~76 visa-required
nationalities visiting Hong Kong for tourism. Hong Kong's Visit Visa
flow has two distinct submission paths:

- **Form ID 936 (paper form)** — for the general visa-required population.
  Single-entry (~HKD 230) or multiple-entry (~HKD 460). Submitted by
  post to the Hong Kong Immigration Department (ImmD) at Immigration
  Tower, Wan Chai, OR via Chinese consular posts abroad.
- **Pre-arrival Registration (PAR)** — online-only, free, for Indian
  nationals at `https://www.immd.gov.hk/par`. Online portal but with no
  visa-fee. Maximum 14-day stay per entry.

Variant captured by `visa_type_requested`. The schema is the same for
all three variants — only the submission channel differs.

### Application Structure

8 logical steps mirroring Form ID 936:

1. Personal Information (English + Chinese name where applicable)
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details
6. Host in Hong Kong (optional sub-journey)
7. Travel History
8. Character & Declaration

---

## 2. v1 Scope — What Is Included

- One visa category: Visit (Tourist / Social)
- Three submission variants: Form ID 936 single, Form ID 936 multiple,
  PAR (Indian nationals)
- Schema extraction: ~80 fields, options, requiredness, conditional
  logic
- HK-specific features: Chinese name field, HKID-format host ID field,
  HK port-of-entry list (HKIA + 6 land borders + 3 sea / cruise terminals)
- Dynamic form rendering via `DynamicStepForm`

---

## 3. Out-of-Scope Visa Categories (v1)

| Category | Reason |
|----------|--------|
| Right of Abode (RoA) | Permanent residence; consular flow |
| Right to Land (RTL) | Different status |
| HKID Card application | Identity card, not entry visa |
| Employment Visa (GEP) | Sponsor-driven; ImmD eGEP portal |
| Quality Migrant Admission Scheme (QMAS) | Different points-based eForm |
| Top Talent Pass Scheme (TTPS) | Different eForm |
| Investment as Entrepreneurs | Different eForm |
| Working Holiday Scheme | Bilateral; per-country quota |
| Dependant Visa | Different sponsor block |
| Student Visa | Sponsor-driven |
| Training programmes | Different eForm |
| Mainland-specific entry permits (e.g. Hong Kong → Mainland 港澳) | Different system entirely |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is partially N/A in v1** — Form ID 936 is paper.
   The PAR portal IS online but Indian-only. Schema is reconstructed
   from Form ID 936 PDF + PAR public landing pages.

2. **Chinese name field** — Form ID 936 collects Chinese characters
   for applicants from CJK-using regions. Modeled as optional. WinAnsi
   encoding limit applies if/when this is rendered to PDF (see
   JP_TOURIST learnings).

3. **HKID format** — Hong Kong ID is `[A-Z]\d{6}\([0-9A]\)`. Host HKID
   field is loose-validated; may want to tighten on a future iteration.

4. **PAR-specific limitations** — Indian PAR is free, max 14-day stay,
   max 6 months validity. The schema doesn't gate length-of-stay on PAR
   variant; live PAR portal enforces.

5. **Date format** — DD/MM/YYYY across all forms.

6. **Port-of-entry list** — extensive set of Mainland and Macao entry
   points beyond just HKIA — captured as 10 ports + other.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the field set
> regardless of submission channel (paper or online). The schema is the
> extraction target; downstream automation (PDF render for posted
> Form ID 936; PAR submission for Indian nationals) is built on top.

---

## 6. Extraction Workflow

```
HK ImmD Form ID 936 + PAR
        │
        ▼
seed-hk-visit-visa-form-fields.ts
        │
        ▼
0029_hk_visit_visa_package.sql
        │
        ▼
DynamicStepForm renders /application
```

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-hk-visit-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources used:

- HK ImmD Form ID 936 (downloadable PDF)
- HK ImmD Form ID 1003A (supplementary)
- PAR landing pages at `immd.gov.hk/par`
- HK ImmD applicant guidance pages

**Live-portal QA pass** for PAR (Indian-only) is realistic. For Form ID
936, "live QA" means PDF-fill validation + posted submission test.

---

## 8. Next Expansion Path

1. **Form ID 936 PDF rendering** — mirror the JP_TOURIST MOFA Form A
   pipeline. Vendor the PDF, fill via pdf-lib, surface a "Download Form
   ID 936" CTA on the terminal step. Highest near-term value.
2. **PAR online submission for Indian nationals** — Playwright runner
   under `viza-be/submission-service/src/hong_kong/`.
3. **`HK_EMPLOYMENT_VISA`** — General Employment Policy (GEP).
4. **`HK_TOP_TALENT_PASS`** — Top Talent Pass Scheme (TTPS).
5. **`HK_DEPENDANT_VISA`** — Spouse / child of HK status holder.

---

**Maintainer:** Edward Zehua Zhang
