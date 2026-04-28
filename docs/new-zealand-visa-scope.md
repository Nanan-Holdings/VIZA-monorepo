# New Zealand Visitor Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-28

---

## 1. Canonical Journey

**Visa type:** New Zealand Visitor Visa + NZeTA
**VIZA visa_type key:** `NZ_VISITOR_VISA`

Three submission variants on `visa_type_requested`:

- **NZeTA** — Electronic Travel Authority for visa-waiver nationals
  (~60 countries: US, UK, EU/EEA, AU, JP, KR, SG, etc.). Online, fee
  ~NZD 17 + International Visitor Conservation and Tourism Levy (IVL)
  NZD 100. Up to 90-day stay.
- **Visitor Visa — Single Entry** — ~NZD 211, up to 9-month stay.
- **Visitor Visa — Multiple Entry** — ~NZD 246, up to 3-year multi-entry.

Submission via Immigration New Zealand (INZ) Immigration Online portal at
`https://onlineservices.immigration.govt.nz` (RealMe-authenticated).

### Application Structure

8 logical steps (standard Asia-tourist 8-step + NZ-specific TB health
question + de-facto partnership status):

1. Personal Information (incl. de-facto partner support)
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details (incl. available funds NZD)
6. Host in New Zealand (optional)
7. Travel History
8. Health & Character (TB-history-specific question)

---

## 2. v1 Scope

- One visa product family: Visitor (Tourist / Family / Business / Medical)
- Three submission variants on `visa_type_requested`
- ~73 fields, options, requiredness, conditional logic
- NZ-specific: de-facto partner status, TB health declaration, NZD
  funds disclosure, regional NZ port-of-entry list

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Work Visa (AEWV / Working Holiday / Specific Purpose) | Different evidence pack, sponsor-driven |
| Resident Visa (Skilled Migrant / Parent / Partnership) | Different application; consular flow |
| Student Visa | Different sponsor block (school) |
| Transit Visa | Different rule set |
| Group Visitor Visa | Different evidence pack |
| Limited Visa | Specific-purpose flow |
| Refugee / Protection | Distinct legal track |
| Active Investor Plus / Entrepreneur | Bespoke INZ pathway |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is N/A in v1** — Immigration Online is RealMe-
   authenticated. Schema reconstructed from Form 1017 (Visitor Visa
   paper antecedent), NZeTA mobile app guidance, and INZ applicant
   information sheets.

2. **De-facto partner** — NZ recognises de-facto relationships as
   distinct legal status. Marital status select includes both `married`
   and `de_facto`; spouse block is gated by either via `||`.

3. **TB health question** — separate from general criminal/security
   declaration. NZ requires chest X-ray for stays >6 months from many
   countries. Schema captures TB history as a separate yes/no.

4. **Available funds NZD** — INZ requires applicant to demonstrate
   minimum NZD 1,000/month or NZD 400/month with confirmed
   accommodation. Schema captures the figure; INZ assesses adequacy.

5. **Date format** — DD/MM/YYYY (NZ standard).

6. **Length-of-stay max** — schema regex caps at 270 days (covers the
   9-month single-entry max). Multi-entry is per-entry-capped by INZ
   at submission.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-nz-visitor-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources used:

- INZ Visitor Visa landing pages
- Form 1017 (Visitor Visa application paper antecedent)
- NZeTA mobile-app guidance
- INZ applicant information sheets
- Cross-checked with AU_VISITOR_600 (parallel ANZ system)

**Live-portal QA pass** with a real RealMe-authenticated applicant
remains the top open item.

---

## 8. Next Expansion Path

1. **Live-portal QA pass** with RealMe-authenticated INZ Immigration
   Online account.
2. **NZeTA Playwright runner** (online, simpler than Visitor Visa) —
   under `viza-be/submission-service/src/new_zealand/`.
3. **`NZ_AEWV`** — Accredited Employer Work Visa.
4. **`NZ_WORKING_HOLIDAY_VISA`** — Working Holiday Scheme.
5. **`NZ_STUDENT_VISA`** — Student Visa.
6. **`NZ_PARTNERSHIP_VISA`** — Partner of NZ Citizen / Resident.

---

**Maintainer:** Edward Zehua Zhang
