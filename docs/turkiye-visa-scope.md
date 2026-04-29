# Türkiye Tourist e-Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-28

---

## 1. Canonical Journey

**Visa type:** Türkiye Tourist e-Visa (single + multi-entry)
**VIZA visa_type key:** `TR_E_VISA`

The Republic of Türkiye Tourist e-Visa is issued by the Ministry of
Foreign Affairs (T.C. Dışişleri Bakanlığı) via
`https://www.evisa.gov.tr`. The portal does not require an account —
applicants enter the form directly, complete payment, and receive the
e-Visa PDF by email.

Two variants on `visa_type_requested`:
- **Single-entry e-Visa** (~USD 50, 180-day validity, 30 or 90-day stay)
- **Multiple-entry e-Visa** (~USD 80, 180-day validity, 30 or 90-day
  stay per entry)

Stay length depends on nationality (most: 30 days; selected
nationalities incl. US, UK, EU/EEA: 90 days).

Tourism + commerce (business visit) covered under one form.

### Application Structure

8 logical steps (standard Asia-tourist 8-step template).

---

## 2. v1 Scope

- One visa product family: Tourist e-Visa
- Two entry-frequency variants
- Two purposes (tourism / commerce) on `purpose_of_visit`
- ~70 fields, options, requiredness, conditional logic
- TR-specific: no-account-required portal, dual-language naming
  (Türkiye / Turkey)

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Work Permit (Çalışma İzni) | Different system, employer-driven |
| Student Visa | Consular flow + university acceptance |
| Humanitarian Residence Permit | Different status |
| Long-term / Family Residence Permit | Different application |
| Citizenship by Investment | Bespoke programme |
| Visa-on-arrival | Largely eliminated post-2013 |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA partially possible** — `evisa.gov.tr` is publicly
   accessible without login. Schema reconstructed from public landing
   pages + nationality eligibility list. A live walk would catch any
   field-label drift.

2. **Stay length depends on nationality** — schema regex caps at 90,
   live portal enforces nationality-specific cap (30 or 90).

3. **Date format** — DD/MM/YYYY (Turkish convention).

4. **Country naming** — schema uses both "Türkiye" (official) and
   "Turkey" (English) interchangeably in labels.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-tr-e-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources used:

- evisa.gov.tr public landing + FAQ
- Türkiye Ministry of Foreign Affairs e-Visa eligibility list
- Consular guidance pages

**Live-portal QA pass** is the easiest of all VIZA-modeled e-Visa
flows because the portal does not require an account.

---

## 8. Next Expansion Path

1. **Live-portal QA pass** — straightforward, no auth required.
2. **Playwright submission runner** — high-value because portal is
   open + automation barriers are low.
3. **`TR_RESIDENCE_PERMIT`** — Long-term Residence Permit.
4. **`TR_WORK_PERMIT`** — Work Permit (employer-driven).
5. **`TR_STUDENT_VISA`** — Student Visa.

---

**Maintainer:** Edward Zehua Zhang
