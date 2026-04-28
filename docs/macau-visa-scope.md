# Macau Visit Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-28

---

## 1. Canonical Journey

**Visa type:** Macau Visit Visa (paper visa + visa-on-arrival pre-clearance)
**VIZA visa_type key:** `MO_VISIT_VISA`

Macau (Macao SAR) has a small visa-required population (~13 nationalities
including Bangladesh, Pakistan, Nepal, Sri Lanka, Nigeria, Vietnam).
Most travellers either enter visa-free (~75 nationalities, 14-90 days)
or via visa-on-arrival (~80 nationalities, 30-day stay). The Visit Visa
is processed by the Macao Public Security Police Force / DSI (Direcção
dos Serviços de Identificação) via paper application — submitted by
post or via Chinese consular posts abroad.

Three submission variants on `visa_type_requested`:

- **Visa on Arrival — Single entry** (MOP 100, 30-day stay)
- **Visa on Arrival — Multiple entry** (MOP 200, 30-day stay per entry)
- **Visit Visa via paper application** (visa-required nationalities)

The schema is the same for all three; routing happens at submission.

### Application Structure

8 logical steps (standard Asia-tourist template).

---

## 2. v1 Scope

- One visa category: Visit (Tourist / Social)
- Three submission variants captured by `visa_type_requested`
- ~75 fields, options, requiredness, conditional logic
- MO-specific features: optional Chinese name, BIR / BIRH host ID
  field, Macau port-of-entry list (MFM + 5 Mainland borders +
  2 ferry terminals + HZMB)

---

## 3. Out-of-Scope Categories

| Category | Reason |
|----------|--------|
| Macau Resident ID (BIR / BIRH) | Permanent residence |
| Non-Resident Worker Card (Blue Card) | Sponsor-driven employment |
| Investor Residence (CIPIM) | Different points-based scheme |
| Student Visa | Different application |
| Mainland-specific entry permits | Different system |

---

## 4. Known Source-Flow Ambiguities

1. **No live portal** — paper application + VOA at borders.
2. **Chinese name** — DSI accepts Chinese characters; modeled optional.
3. **Date format** — DD/MM/YYYY.
4. **HZMB** — shared with HK_VISIT_VISA scope. Same physical
   infrastructure, different ImmD jurisdiction.
5. **Gambling-related travel restrictions** — Mainland Chinese
   ID-card holders use the Two-way Permit, not this visa. Not modelled.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation.**

---

## 6. Extraction Workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-mo-visit-visa-form-fields.ts
```

---

## 7. Source Material

- DSI / Macao Public Security Police Force visa-application paper form
- DSI applicant guidance pages
- Cross-checked with HK ImmD Form ID 936 (similar field set)

**Live-portal QA pass** is N/A for paper-only flow.

---

## 8. Next Expansion Path

1. **Visa application paper form PDF rendering** (mirror JP_TOURIST,
   future HK_VISIT_VISA pipeline).
2. **VOA pre-clearance optimisation** — produce printable cover sheet
   for VOA queue at Macau Border Gate / Outer Harbour Ferry Terminal.
3. **`MO_BLUE_CARD`** — Non-Resident Worker Card.

---

**Maintainer:** Edward Zehua Zhang
