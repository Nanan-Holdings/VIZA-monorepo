# UAE Tourist Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** UAE Tourist Visa (3 variants)
**VIZA visa_type key:** `AE_TOURIST_VISA`

UAE federal Tourist Visa is issued by the Federal Authority for Identity,
Citizenship, Customs and Port Security (ICP — formerly ICA) via
`https://smartservices.icp.gov.ae`. Dubai-specific applications are
processed by the General Directorate of Residency and Foreigners
Affairs Dubai (GDRFA) via `https://smart.gdrfad.gov.ae`. Both portals
are identity-gated.

Three variants on `visa_type_requested`:
- **30-day single-entry** (~AED 350)
- **60-day single-entry** (~AED 650)
- **5-year multiple-entry** (~AED 650, 90-day stay per entry up to
  180 days/year)

UAE-specific: most applications route through an **airline / travel
agent / hotel / UAE Resident** sponsor. Self-apply via ICP is available
for some nationalities. Sponsor block is captured in step 6.

### Application Structure

9 logical steps:

1. Personal Information (incl. optional Arabic name + religion)
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details (incl. emirate)
6. Sponsor (UAE-specific)
7. Host (separate from sponsor)
8. Travel History
9. Character & Declaration

---

## 2. v1 Scope

- Three Tourist Visa variants on `visa_type_requested`
- ICP + GDRFA flows (same field set)
- ~78 fields
- UAE-specific: optional Arabic name, religion, sponsor block,
  emirate field, Emirates ID / trade-license sponsor identifier

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Residence Visa (employment / investor / Golden / retirement / real-estate / family / student) | Different application; long-term residence |
| Green Visa | 5-year self-sponsored — different evidence pack |
| Freelance / Remote-work permit | Different programme |
| Mission / Job-exploration visa | Different application |
| Visa-on-arrival / visa-exempt arrivals | No online form |
| Diplomatic / Service / Official | Bilateral channels |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is N/A in v1** — both ICP Smart Services and GDRFA
   are identity-gated.
2. **Sponsor variants** — the live ICP form may have different fields
   per sponsor type (airline vs. hotel vs. UAE Resident). Schema captures
   the union; live form may show subset based on sponsor_type.
3. **Religion field** — UAE collects religion for some visa types.
   Modeled as optional.
4. **Arabic name** — schema accepts Arabic characters; WinAnsi limit
   applies if rendered to PDF.
5. **Emirate field** — separate from city. Captured as text (Dubai /
   Abu Dhabi / Sharjah / Ajman / Umm Al-Quwain / Ras Al Khaimah /
   Fujairah).

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-ae-tourist-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources used:

- ICP Smart Services landing pages
- GDRFA Dubai applicant guidance
- UAE Embassy applicant guidance (London, Washington, Beijing, Mumbai)
- Cross-checked with airline sponsor flows (Emirates, Etihad, flydubai)

**Live-portal QA pass** with a real UAE sponsor account remains the top
open item.

---

## 8. Next Expansion Path

1. **Live-portal QA pass** with airline / hotel sponsor account.
2. **`AE_GOLDEN_VISA`** — 10-year Residence Visa (investor / talent /
   real-estate / specialist).
3. **`AE_GREEN_VISA`** — 5-year self-sponsored.
4. **`AE_EMPLOYMENT_RESIDENCE`** — Employment-sponsored Residence Visa.
5. **`AE_FREELANCE_PERMIT`** — Freelance / Remote-work permit.

---

**Maintainer:** Edward Zehua Zhang
