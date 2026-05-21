# Canada TRV + eTA Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** Canada TRV (Visitor Visa) + eTA
**VIZA visa_type key:** `CA_TRV`

Three submission variants on `visa_type_requested`:
- **eTA** — visa-waiver nationals (~CAD 7, 5-year validity, 6-month stay)
- **TRV Single Entry** — ~CAD 100, up to 6-month stay
- **TRV Multiple Entry** — ~CAD 100, up to 10-year validity, 6-month per entry

Submission via IRCC Secure Account portal at `https://ircc.canada.ca`
(GCKey or Sign-In Partner authenticated). eTA is at
`https://onlineservices-servicesenligne.cic.gc.ca`.

### Application Structure

8 steps (extends standard template with military-service question +
TB-history question both required by IMM 5645 / IMM 5257):

1. Personal Information (incl. common-law partner status)
2. Passport
3. Contact & Home Address
4. Occupation (incl. monthly income CAD)
5. Trip Details (incl. available funds CAD)
6. Host in Canada (optional)
7. Travel & Background (incl. military service)
8. Health & Character (incl. TB history)

---

## 2. v1 Scope

- 3 submission variants on `visa_type_requested`
- ~85 fields, options, requiredness, conditional logic
- CA-specific: common-law partner status, military-service question,
  TB-history question, available funds CAD, comprehensive port-of-entry
  list (8 airports + 4 US-Canada land borders + 2 cruise ports),
  Canadian inclusive gender option

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Work Permit (LMIA / Open / PGWP) | Different application; employer-driven |
| Study Permit | Different sponsor block (DLI letter) |
| Permanent Residence (Express Entry / PNP / Family / Atlantic / Quebec) | Different application |
| Super Visa (parents/grandparents) | Same form basis, distinct programme — future package |
| Refugee/Protected Person | Distinct legal track |
| Inland TRP (Temporary Resident Permit) | Inadmissibility-driven, case-by-case |
| Diplomatic / Service / Official | Bilateral channels |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is N/A in v1** — IRCC Secure Account is GCKey-gated.
2. **Common-law partner** — 1+ year cohabitation, NZ/AU-equivalent
   relationship status. Spouse block uses `||` to gate on married OR
   common_law.
3. **Military-service question** — IMM 5645 specific. Captures conscription
   periods that some applicants might not consider "service".
4. **Date format** — DD/MM/YYYY (Canadian convention).
5. **Postal code format** — Canadian is `A1A 1A1`; schema accepts
   generic.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-ca-trv-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources used:

- IRCC IMM 5257 (Application for Temporary Resident Visa)
- IRCC IMM 5645 (Family Information)
- IRCC eTA application guidance + IRCC Secure Account portal docs
- IRCC instruction guides

**Live-portal QA pass** with GCKey credentials remains the top open item.
eTA flow is a strong automation candidate (lower auth requirement).

---

## 8. Next Expansion Path

1. **Live-portal QA pass** with GCKey-authenticated IRCC Secure Account.
2. **eTA Playwright runner** — easier than TRV.
3. **`CA_SUPER_VISA`** — Parents/Grandparents Super Visa (same form +
   additional sponsor undertaking + medical exam).
4. **`CA_STUDY_PERMIT`** — Study Permit.
5. **`CA_WORK_PERMIT`** — Work Permit (LMIA / OWP / PGWP variants).

---

**Maintainer:** Edward Zehua Zhang
