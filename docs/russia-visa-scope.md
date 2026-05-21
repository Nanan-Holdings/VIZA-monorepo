# Russia Unified e-Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-28

---

## 1. Canonical Journey

**Visa type:** Russia Unified e-Visa (single-entry, 16-day stay)
**VIZA visa_type key:** `RU_E_VISA`

The Unified e-Visa replaced the legacy FEZ-restricted Free e-Visa
(Vladivostok / Kaliningrad / SPb regional) in August 2023. It is
issued by the Russian Ministry of Foreign Affairs Consular Department
(KD MID — Konsul'skiy Departament) via `https://evisa.kdmid.ru`.

Eligibility: ~55 nationalities (China, India, Bahrain, Iran, Mexico,
Saudi Arabia, Turkey, Singapore, Japan, Indonesia, Philippines, Vietnam,
Algeria, Indonesia, Cuba, etc.). Western nationals (US, EU, UK, AU, NZ)
are NOT currently eligible — they apply via consular paper visa.

Single-entry, 16-day validity (must be used within 60 days from issue),
16-day max stay, ~USD 52, mandatory medical insurance with min ~30,000
EUR coverage.

### Application Structure

8 logical steps with mandatory medical insurance fields in step 5.

---

## 2. v1 Scope

- One visa product: Unified e-Visa (single value on `visa_type_requested`,
  reserved structure for future MID multi-entry expansion)
- Multiple purposes (tourism, business, humanitarian, guest) on
  `purpose_of_visit`
- ~70 fields, options, requiredness, conditional logic
- Russia-specific: medical insurance block (mandatory), MID-designated
  port-of-entry list, Latin/Cyrillic name guidance

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Consular paper visa (tourist / business / private / humanitarian / work / study / transit / dependant) | Embassy / consular flow |
| Legacy Free e-Visa (FEZ Vladivostok / Kaliningrad / SPb) | Superseded August 2023 |
| Visa-free regimes (CIS / SCO member states) | No application required |
| Diplomatic / Service / Official passports | Bilateral channels |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is N/A in v1** — `evisa.kdmid.ru` is identity-gated.
   Schema reconstructed from public landing pages, MID e-Visa
   documentation, eligible-nationalities list, designated-entry-points
   list.

2. **Single-entry only** — current MID policy. Schema's
   `visa_type_requested` retains the multi-option structure for future
   expansion if MID adds multi-entry e-Visa.

3. **Geopolitical sensitivity** — Russia visa eligibility list excludes
   Western nationals. The schema does not gate eligibility — VIZA's
   intake should filter on nationality before assigning this package.

4. **Mandatory medical insurance** — min coverage ~30,000 EUR, must be
   valid for full duration of intended stay, must cover Russian Federation
   territory. Captured as 3 fields (company, policy, coverage amount) in
   step 5.

5. **Date format** — DD/MM/YYYY (Russian convention).

6. **Cyrillic transliteration** — name fields accept both Latin (as in
   passport) and Cyrillic. Live form may auto-transliterate.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-ru-e-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources used:

- evisa.kdmid.ru public landing + FAQ
- MID e-Visa eligibility list (consular bulletins)
- MID designated-entry-points list
- Russian Federal Law No. 114-FZ (procedure for entry / exit) + amendment
  No. 156-FZ (introducing Unified e-Visa)

**Live-portal QA pass** with a real applicant account remains the top
open item.

---

## 8. Next Expansion Path

1. **Live-portal QA pass** with eligible-nationality applicant.
2. **`RU_TOURIST_VISA`** — consular paper Tourist Visa (for
   Western nationals + others not eligible for e-Visa). Different
   sponsor block (Russian travel agency invitation letter required).
3. **`RU_BUSINESS_VISA`** — consular paper Business Visa.
4. **`RU_PRIVATE_VISA`** — Private (Family Visit) Visa.
5. **`RU_TRANSIT_VISA`** — Transit Visa.

---

**Maintainer:** Edward Zehua Zhang
