# Maldives IMUGA Traveller Declaration Extraction Scope — v1

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** Maldives IMUGA Traveller Declaration
**VIZA visa_type key:** `MV_IMUGA`

The Maldives grants 30-day free visa-on-arrival to **all nationalities**.
There is no pre-departure tourist visa application. The mandatory
pre-arrival step is the **IMUGA Traveller Declaration** submitted via
`https://imuga.immigration.gov.mv` (Immigration Maldives) within 96
hours of arrival.

This is the schema VIZA captures for Maldives — IMUGA replaces what
would be a "tourist visa form" elsewhere. Single submission variant.

### Application Structure

7 logical steps (slimmer than the 8-step visa template — no host /
sponsor / character & declaration blocks because IMUGA is a health /
arrival declaration, not a visa-screening form):

1. Personal Information
2. Passport
3. Trip Details (incl. departure date)
4. Accommodation (resort / hotel / liveaboard / yacht + atoll + island)
5. Health Declaration
6. Customs Declaration
7. Declaration

---

## 2. v1 Scope

- One single submission variant
- ~32 fields (smallest VIZA-modeled package)
- MV-specific: atoll + island accommodation breakdown, health
  symptoms screening, customs declarations (currency >USD 30k,
  restricted items)

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Resort Permit | Different programme |
| Business Visa | Different application |
| Long-Stay Visa (Marriage / Dependant) | Sponsor-driven |
| Work Visa | Employment Approval letter required |
| Student Visa | Different application |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA partially possible** — IMUGA is publicly-accessible
   but submission requires real flight info. Schema reconstructed from
   public landing pages + IMUGA mobile-app form.
2. **Atoll dropdown** — schema captures atoll as text; live IMUGA may
   present a closed dropdown of 26 atolls. Future v1.1: closed enum.
3. **Date format** — DD/MM/YYYY.
4. **Customs threshold** — USD 30,000 equivalent. Subject to revision
   by Maldives Customs.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-mv-imuga-form-fields.ts
```

---

## 7. Source Material

- IMUGA public landing + FAQ at imuga.immigration.gov.mv
- Maldives Immigration applicant guidance pages
- IMUGA mobile-app form

---

## 8. Next Expansion Path

1. **Live-portal QA pass** — straightforward, low auth.
2. **Atoll closed enum** — 26-atoll dropdown.
3. **IMUGA Playwright runner** — strong candidate (low auth,
   public form).
4. **`MV_RESORT_PERMIT`** package (future).

---

**Maintainer:** Edward Zehua Zhang
