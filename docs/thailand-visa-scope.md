# Thailand Tourist e-Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-28

---

## 1. Canonical Journey

**Visa type:** Thailand Tourist e-Visa (Single-entry TR / Multi-entry METV)
**VIZA visa_type key:** `TH_TOURIST_E_VISA`

The v1 audience is travellers from any of the e-Visa-eligible nationalities
(US, UK, EU/EEA, AU, NZ, CA, JP, KR, SG, ZA, IN, GCC member states, China,
Brazil, etc.) visiting Thailand for tourism. Applicants apply online through
the Royal Thai Ministry of Foreign Affairs e-Visa portal at
`https://www.thaievisa.go.th` (operated jointly with VFS Global). The same
field set covers both entry-frequency variants:

- **Single-entry Tourist Visa (TR)** — fee ~USD 30, validity 3 months from
  issue, 60-day max stay (extendable once at a Thai immigration office).
- **Multiple-Entry Tourist Visa (METV)** — fee ~USD 150, validity 6 months
  from issue, 60-day max stay per entry, unlimited entries within validity.

The variant is captured by the `visa_type_requested` field, not by splitting
into separate packages — the form is identical.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility guidance | `https://www.thaievisa.go.th` | Country eligibility list, fees, requirements |
| 2. Account registration | `https://www.thaievisa.go.th/account/register` | Create applicant account (email + password) |
| 3. Online application | `https://www.thaievisa.go.th/application` | The actual form — our extraction target |
| 4. Payment | Thai e-Visa portal (Visa / MasterCard / local rails) | Card payment immediately after submission |
| 5. e-Visa delivery | Email PDF | Issued within ~14 business days; present digital copy at port of entry |

The **v1 extraction target** is step 3.

### Application Structure

The schema is grouped into 8 logical steps, mirroring the order of the
Thai e-Visa application form sections:

1. Personal Information
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details
6. Host in Thailand (optional sub-journey)
7. Travel History
8. Character & Declaration

These map 1:1 to `step_number` in the seed.

---

## 2. v1 Scope — What Is Included

- **One visa category only:** Tourist e-Visa (TR + METV share the form)
- **One application system:** `thaievisa.go.th`
- **Schema extraction:** all 8 sections, ~75 fields, options, requiredness,
  conditional logic
- **Dynamic form rendering:** via existing `visa_form_fields` +
  `DynamicStepForm`
- **No automated submission** — the Thai e-Visa portal sits behind account
  registration + card payment + (optional) biometric appointment booking;
  the schema extracts the form, not the submission

---

## 3. Out-of-Scope Visa Categories (v1)

Categories we explicitly exclude. They use different application journeys
with different field sets:

| Category | Reason for exclusion |
|----------|---------------------|
| Non-Immigrant B (Business) | Different sub-journey (inviter company block, business letter, work-permit linkage) — future `TH_NON_IMM_B` package |
| Non-Immigrant ED (Education) | Different sub-journey (school acceptance letter, MOE confirmation) — future `TH_NON_IMM_ED` package |
| Non-Immigrant O (Long-stay / Family / Retirement) | Multiple sub-purposes; financial proof differs by purpose — future `TH_NON_IMM_O` package |
| Non-Immigrant IM (Investor / Manager) | Investment proof + BOI confirmation — consular channel |
| DTV (Destination Thailand Visa) | 5-year multi-entry for digital nomads / soft-power activities — different evidence pack, separate portal flow — future `TH_DTV` package |
| Smart Visa (10 sub-categories) | Employer/MOE sponsorship; consular flow; not on the e-Visa portal |
| LTR Visa (Long-Term Resident, BOI) | 10-year visa under Thailand BOI; specialised application portal |
| Visa-on-Arrival (THB 2,000 cash at major airports / borders) | No online form — paid at the kiosk; ~19 nationalities eligible |
| Visa exemption (30 / 60 days, ~93 nationalities) | No application required — bilateral exemption |
| Diplomatic / Official passport entries | Bilateral agreements; consular issuance — out of e-Visa scope |

Future iterations can add them as additional `visa_type` entries and
seed scripts.

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is N/A in v1** — `thaievisa.go.th` requires an account
   (email + password + CAPTCHA) before any field on the application form
   is visible. The schema is a reconstruction from the public landing pages,
   the Royal Thai Embassy applicant guidance pages (London, Washington,
   Beijing, Berlin variants cross-checked), and the TM.86 / TM.87 paper
   antecedents which the e-Visa form mirrors field-for-field. Re-validate
   when an account becomes available for testing.

2. **Father / mother full names** — TM.87 (paper application) collects
   both with the mother's maiden name annotated. The e-Visa portal
   continues to collect both per the embassy guidance. Field labels follow
   the paper form to be safe.

3. **Date format** — Royal Thai government documents use DD/MM/YYYY
   universally. The seed sticks with the playbook-default
   `format: "DD/MM/YYYY"`. Buddhist-calendar year conversions are not
   surfaced to the applicant.

4. **Port-of-entry list** — the live portal shows a closed dropdown of
   major airports + Bangkok-area land borders. The seed enumerates the
   13 most-used ports plus `other`. If new ports open (e.g. Buriram,
   Trang regional), add to the enum.

5. **Religion field** — TM.87 paper form has a religion field; the e-Visa
   portal removed it circa 2019. Not modeled in the schema. If a future
   QA pass surfaces it, add it.

6. **Length-of-stay max value** — single-entry TR allows 60 days, METV
   allows 60 days per entry. The validation pattern caps at 60 for both;
   a future QA pass should confirm the portal enforces the same cap.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official field
> structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

Every field on the live form should map 1:1 to a row in
`visa_form_fields` for `visa_type = TH_TOURIST_E_VISA`. The schema is the
extraction target; the dynamic renderer + future submission runner are
downstream consumers.

---

## 6. Extraction Workflow

```
Royal Thai e-Visa form sections
        │
        ▼
Field inventory (this doc + seed FIELDS array)
        │
        ▼
seed-th-tourist-e-visa-form-fields.ts (idempotent insert)
        │
        ▼
Drizzle migration 0026_th_tourist_e_visa_package.sql (registers package)
        │
        ▼
DynamicStepForm renders /application for any user assigned TH_TOURIST_E_VISA
```

Re-run the seed any time the schema changes:

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-th-tourist-e-visa-form-fields.ts
```

The seed deletes all rows with `visa_type = TH_TOURIST_E_VISA` then
re-inserts from the `FIELDS` array. Safe to run repeatedly.

---

## 7. Source Material — Reconstruction Disclaimer

This v1 schema is a **reconstruction** from public sources, not a
live-portal capture. Sources used:

- `thaievisa.go.th` public landing + FAQ pages (eligibility, fees,
  validity, max-stay rules)
- Royal Thai Embassy applicant guidance pages (London, Washington DC,
  Beijing, Berlin, Singapore — cross-checked for field consistency)
- TM.86 (Tourist Visa application) and TM.87 (entry visa application)
  paper forms — direct antecedents of the online application
- Ministry of Foreign Affairs Department of Consular Affairs guidance
  documents

**Live-portal QA pass** with a real Thai e-Visa applicant account remains
the top open item. See gap report §6.

---

## 8. Next Expansion Path

Suggested order, by demand × ease:

1. **Live-portal QA pass** — provision a Thai e-Visa account, walk every
   field, diff against the seed, fix drift.
2. **PDF rendering of TM.86** — the paper antecedent is still accepted at
   some embassies; mirror the JP_TOURIST MOFA Form A pipeline.
3. **`TH_NON_IMM_B`** — Business visa (different inviter block,
   work-permit dependency).
4. **`TH_DTV`** — Destination Thailand Visa (digital nomad / soft-power
   activities; 5-year multi-entry; different evidence pack).
5. **`TH_NON_IMM_O`** — Long-stay / family / retirement (sub-purpose
   gating: spouse-of-Thai, retirement-50+, dependent-of-Thai-employee).
6. **`TH_NON_IMM_ED`** — Education visa.

---

**Maintainer:** Edward Zehua Zhang
