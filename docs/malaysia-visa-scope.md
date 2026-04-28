# Malaysia Tourist eVISA Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-28

---

## 1. Canonical Journey

**Visa type:** Malaysia Tourist eVISA (Single-entry / Multiple-entry)
**VIZA visa_type key:** `MY_TOURIST_E_VISA`

The v1 audience is travellers from any of the eVISA-eligible nationalities
(India, China, Pakistan, Bangladesh, Sri Lanka, Bhutan, Montenegro, Nepal,
Myanmar, Serbia, etc.) visiting Malaysia for tourism. Applicants apply
online through the Malaysian Department of Immigration eVISA portal at
`https://malaysiavisa.imi.gov.my` (operated by Jabatan Imigresen Malaysia,
Kementerian Dalam Negeri). Same field set covers both entry-frequency
variants:

- **Single-entry eVISA** — fee ~USD 50, validity 3 months from issue,
  30-day max stay.
- **Multiple-entry eVISA** — fee ~USD 100, validity 12 months from issue,
  30-day max stay per entry, unlimited entries within validity (limited
  to certain nationalities).

Variant captured by the `visa_type_requested` radio.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility guidance | `https://malaysiavisa.imi.gov.my` | Country eligibility list, fees, requirements |
| 2. Account registration | `https://malaysiavisa.imi.gov.my/register` | Create applicant account (email + password) |
| 3. Online application | `https://malaysiavisa.imi.gov.my/application` | The actual form — our extraction target |
| 4. Payment | Malaysia eVISA portal (Visa / MasterCard / FPX) | Card payment immediately after submission |
| 5. eVISA delivery | Email PDF | Issued within ~1 business day; print and present at port of entry |

The **v1 extraction target** is step 3.

### Application Structure

The schema is grouped into 8 logical steps mirroring the order of the
Malaysia eVISA application form:

1. Personal Information
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details
6. Host in Malaysia (optional sub-journey)
7. Travel History
8. Character & Declaration

These map 1:1 to `step_number` in the seed.

---

## 2. v1 Scope — What Is Included

- **One visa category only:** Tourist eVISA (single + multi-entry share
  the form)
- **One application system:** `malaysiavisa.imi.gov.my`
- **Schema extraction:** all 8 sections, ~76 fields, options, requiredness,
  conditional logic
- **Dynamic form rendering:** via existing `visa_form_fields` +
  `DynamicStepForm`
- **No automated submission** — the Malaysia eVISA portal sits behind
  account registration + card payment + (for some nationalities)
  appointment-based biometrics; the schema extracts the form, not the
  submission

---

## 3. Out-of-Scope Visa Categories (v1)

| Category | Reason for exclusion |
|----------|---------------------|
| Employment Pass / DP10 | Expatriate Committee + ESD portal; consular flow — future `MY_EMPLOYMENT_PASS` package |
| Professional Visit Pass / Resident Pass | MyXpats Centre / MDEC portal — separate flow |
| MM2H (Malaysia My 2nd Home) | Long-stay programme with financial / age criteria, separate portal — future `MY_MM2H` package |
| Premium Visa Programme (PVIP) | 20-year residence visa, separate portal |
| Sarawak / Sabah-internal entry permits | State-level controls (Sarawak Immigration Dept.) — separate flow |
| Student Pass | EMGS portal — different evidence pack |
| Visa-on-Arrival (~9 nationalities, USD 100 cash at major airports) | No online form — paid at the kiosk |
| Visa exemption (~160 nationalities, 14-90 days) | No application required — bilateral exemption |
| Diplomatic / Official passport entries | Bilateral agreements; consular issuance |

Future iterations can add them as additional `visa_type` entries and
seed scripts.

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is N/A in v1** — `malaysiavisa.imi.gov.my` requires
   an account before any field on the application form is visible. The
   schema is a reconstruction from public landing pages, Malaysian High
   Commission applicant guidance pages (London, New Delhi, Beijing,
   Riyadh — cross-checked), and the IMM.47 paper application form which
   the eVISA mirrors field-for-field.

2. **Race / ethnicity field** — Malaysian immigration historically
   collects an ethnicity / race field (Malay / Chinese / Indian / Other).
   Field is included as optional. If a future QA pass shows the eVISA
   form removed it, drop the field.

3. **Date format** — Malaysian government documents use DD/MM/YYYY. The
   seed uses the playbook-default `format: "DD/MM/YYYY"`.

4. **Port-of-entry list** — the live portal shows a closed dropdown of
   major airports + Bangkok-area land/sea borders. The seed enumerates
   the 16 most-used ports plus `other` (Sarawak / Sabah additional
   regional airports may exist).

5. **Length-of-stay max value** — single-entry eVISA allows 30 days,
   multi-entry allows 30 days per entry. Validation pattern caps at 30
   for both.

6. **Multi-entry eligibility is nationality-restricted** — only Indian
   and Chinese nationals are confirmed multi-entry eligible at the time
   of writing. The schema does not gate the option — the live portal
   filters at submission time. Re-evaluate after live QA.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official field
> structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

---

## 6. Extraction Workflow

```
Malaysia eVISA form sections
        │
        ▼
seed-my-tourist-e-visa-form-fields.ts (idempotent insert)
        │
        ▼
Drizzle migration 0027_my_tourist_e_visa_package.sql (registers package)
        │
        ▼
DynamicStepForm renders /application for any user assigned MY_TOURIST_E_VISA
```

Re-run the seed any time the schema changes:

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-my-tourist-e-visa-form-fields.ts
```

---

## 7. Source Material — Reconstruction Disclaimer

This v1 schema is a **reconstruction** from public sources, not a
live-portal capture. Sources used:

- `malaysiavisa.imi.gov.my` public landing + FAQ pages
- Malaysian High Commission applicant guidance pages (London, New Delhi,
  Beijing, Riyadh — cross-checked)
- IMM.47 paper application form — direct antecedent
- Department of Immigration Malaysia (Jabatan Imigresen) public
  guidance circulars

**Live-portal QA pass** with a real Malaysia eVISA applicant account
remains the top open item. See gap report.

---

## 8. Next Expansion Path

1. **Live-portal QA pass** — provision a Malaysia eVISA account, walk
   every field, diff against the seed, fix drift.
2. **`MY_EMPLOYMENT_PASS`** — Employment Pass for expatriates (different
   evidence pack: ESD/MDEC).
3. **`MY_MM2H`** — Malaysia My 2nd Home long-stay programme.
4. **`MY_PVIP`** — Premium Visa Programme.
5. **`MY_PROFESSIONAL_VISIT_PASS`** — Short-term business / professional
   visits.

---

**Maintainer:** Edward Zehua Zhang
