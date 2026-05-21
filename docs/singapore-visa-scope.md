# Singapore Visit Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-28

---

## 1. Canonical Journey

**Visa type:** Singapore Visit Visa (Tourist / Social — Single-entry / Multi-entry)
**VIZA visa_type key:** `SG_VISITOR_VISA`

The v1 audience is travellers from one of the ~33 visa-required
nationalities (Assessment Level 1 + Level 2 country lists: PRC, India,
Pakistan, Bangladesh, Russia, Egypt, Iran, Iraq, Myanmar, etc.) visiting
Singapore for tourism / social purposes. Applicants apply online through
the Singapore Immigration & Checkpoints Authority (ICA) SAVE
(Singapore Application for Visa Electronically) e-Service at
`https://eservices.ica.gov.sg/esvclandingpage/save`. Same field set
covers both entry-frequency variants:

- **Single-entry Visit Visa** — fee ~SGD 30, validity up to 35 days from
  issue, 30-day max stay.
- **Multiple-entry Visit Visa** — fee ~SGD 30, validity 1–5 years, 30-day
  max stay per entry.

Variant captured by the `visa_type_requested` radio.

### Local Sponsor Requirement

A defining feature of the SAVE flow is the **mandatory local sponsor**
for visa-required nationals. The sponsor types are:

1. Singapore Citizen / PR aged 21 or older
2. Company / firm registered with ACRA
3. Authorised Visa Agent
4. Strategic Partner / approved organisation

This is captured as a sub-journey in step 6 gated by `has_local_sponsor`.

### Application Structure

9 logical steps:

1. Personal Information
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details
6. Local Sponsor (sub-journey)
7. Host in Singapore (optional, separate from sponsor)
8. Travel History
9. Character & Declaration

---

## 2. v1 Scope — What Is Included

- One visa category: Tourist / Social Visit (single + multi-entry share
  the form)
- One application system: ICA SAVE
- Schema extraction: ~80 fields, options, requiredness, conditional logic
- Local-sponsor sub-journey
- Dynamic form rendering via `DynamicStepForm`

---

## 3. Out-of-Scope Visa Categories (v1)

| Category | Reason for exclusion |
|----------|---------------------|
| Employment Pass / EP | MOM EPOL portal — sponsor-driven |
| S Pass | MOM EPOL portal |
| Work Permit | MOM Work Permit Online |
| Long-Term Visit Pass (LTVP) | Different sponsor block + health screening |
| Student Pass (STP) | ICA STP-Online |
| Dependant's Pass (DP) | EP holder spouse / child |
| PR application | Consular flow — different evidence pack |
| Diplomatic / Official | Bilateral channels |

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is N/A in v1** — SAVE is identity-gated. Schema is
   reconstructed from public landing pages, ICA Form 14 paper antecedent,
   and ICA applicant guidance.

2. **Race + Religion fields** — Form 14 collects both. Live SAVE may have
   removed religion. Both modeled as optional; drop in v1.1 if QA shows
   they're not present on the eForm.

3. **Local sponsor NRIC / FIN / UEN** — pattern validation is loose
   (`maxLength: 30`); the live form likely enforces format. Re-validate
   on QA.

4. **Postal code (Singapore 6 digits)** — model's regex `^[0-9]{6}$`
   matches Singapore postal format; live form enforces it.

5. **Multi-entry eligibility is nationality-restricted** — the live
   portal gates the option at submit time. Schema doesn't gate; surfaces
   both variants.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic.

---

## 6. Extraction Workflow

```
Singapore SAVE Visit Visa form
        │
        ▼
seed-sg-visitor-visa-form-fields.ts
        │
        ▼
0028_sg_visitor_visa_package.sql
        │
        ▼
DynamicStepForm renders /application
```

Re-run:

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-sg-visitor-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

Sources used:

- ICA SAVE landing + FAQ pages
- Form 14 (Application for Entry Visa) paper antecedent
- ICA applicant guidance for Assessment Level 1 + 2 nationalities
- High Commission applicant guidance pages cross-checked

**Live-portal QA pass** with a real applicant + local sponsor remains
the top open item.

---

## 8. Next Expansion Path

1. **Live-portal QA pass** with real SAVE submission.
2. **`SG_LTVP`** — Long-Term Visit Pass (different sponsor block).
3. **`SG_EMPLOYMENT_PASS`** — EP via MOM EPOL.
4. **`SG_STUDENT_PASS`** — STP via ICA STP-Online.

---

**Maintainer:** Edward Zehua Zhang
