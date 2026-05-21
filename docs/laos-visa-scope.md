# Laos Tourist e-Visa Extraction Scope — v1

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-29

---

## 1. Canonical Journey

**Visa type:** Lao PDR Tourist e-Visa + VOA pre-clearance
**VIZA visa_type key:** `LA_TOURIST_E_VISA`

Lao PDR Ministry of Foreign Affairs issues the Tourist e-Visa via
`https://laoevisa.gov.la`. Public portal — no account required.

Two variants on `visa_type_requested`:
- e-Visa single-entry (~USD 35-50, 60-day validity, 30-day stay)
- VOA pre-clearance (~USD 30-45 cash at VOA-eligible borders)

### Application Structure

8 logical steps (standard Asia-tourist template).

---

## 2. v1 Scope

- Two submission variants
- ~65 fields
- LA-specific port-of-entry list: 4 international airports
  (Vientiane / Luang Prabang / Pakse / Savannakhet) + 4 Mekong
  Friendship Bridges (TH border) + 2 Vietnam borders + China border
  (Boten) + Cambodia border (Veun Kham)

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Business / NA-B Visa | Different application |
| Long-Stay Visa (NA-LS) | Sponsor-driven |
| Investment Visa | Bespoke programme |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA easy** — public portal.
2. **Fee varies by nationality** — schema notes USD 35-50; live portal
   computes per nationality.
3. **Date format** — DD/MM/YYYY.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-la-e-visa-form-fields.ts
```

---

## 7. Source Material

- laoevisa.gov.la public landing
- MFA / Lao Embassy applicant guidance

---

## 8. Next Expansion Path

1. Live-portal QA pass.
2. LA Playwright runner (no auth).
3. `LA_BUSINESS_VISA` (NA-B).

---

**Maintainer:** Edward Zehua Zhang
