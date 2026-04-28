# Indonesia C1 Tourist Single Entry Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-27

---

## 1. Canonical Journey

**Visa type:** Indonesia C1 Tourist Single Entry Visa (Visa Kunjungan
Wisata) — formerly known as B211A under the pre-2024 framework, renamed
C1 in the 2024 Single Entry Visa restructure.
**VIZA visa_type key:** `ID_C1_TOURIST`

The v1 audience is **foreign nationals applying online** through the
official Indonesian Directorate General of Immigration eVisa portal
`evisa.imigrasi.go.id` (which fully replaced the prior
`molina.imigrasi.go.id` in 2024). The applicant self-applies — no
Indonesian guarantor is required for the standard 60-day single-entry
tourist path. An optional sponsor block is captured for users who go
through an Indonesian guarantor (the extendable C1 pathway via
`visa-online.imigrasi.go.id`).

The same eVisa portal replaced the prior `molina.imigrasi.go.id` system,
which was used between January 2023 and the 2024 unification.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility & overview | `https://evisa.imigrasi.go.id/front/info/evoa` | Visa categories and which one a tourist needs |
| 2. WNA registration form | `https://evisa.imigrasi.go.id/front/register/wna` | Foreign-national account registration (the personal-info gate) |
| 3. Application form | `https://evisa.imigrasi.go.id/web/application/...` | The C1 Visit Visa application (identity-gated; not driveable by tools) |
| 4. FAQ — General Information | `https://evisa.imigrasi.go.id/front/faq/aff9642b-0b57-443f-8de1-a51601de0ebb` | Document requirements, fees, processing |
| 5. Imigrasi guidance | `https://www.imigrasi.go.id/berita/2023/03/10/begini-prosedur-dan-syarat-penggunaan-visa-kunjungan-wisata-dari-website-molina-imigrasi?lang=en-US` | DGI guidance on the tourist visit visa (carries forward to evisa.imigrasi.go.id) |

The **v1 extraction target** is the C1 Visit Visa Wisata journey on
`evisa.imigrasi.go.id`, derived from the published WNA registration form
+ DGI public guidance.

### Application Structure

The schema is grouped into 8 logical steps:

1. Personal Information (incl. mother's name — required by Indonesian
   immigration)
2. Passport / Travel Document
3. Contact & Home Address (abroad)
4. Occupation
5. Trip Details (purpose locked to tourism)
6. Sponsor / Guarantor in Indonesia (optional, gated)
7. Travel History
8. Character & Declaration

These map 1:1 to `step_number` in the seed.

---

## 2. v1 Scope — What Is Included

- **One visa category:** C1 Tourist Single Entry (Visa Kunjungan Wisata,
  ex-B211A)
- **One submission portal:** `evisa.imigrasi.go.id` (self-application
  path)
- **Schema extraction:** all 8 sections, 82 fields, options,
  requiredness, conditional logic
- **Dynamic form rendering:** via existing `visa_form_fields` +
  `DynamicStepForm`
- **No automated submission** — `evisa.imigrasi.go.id` is identity-gated
  and was not driven during this build

---

## 3. Out-of-Scope Visa Categories (v1)

| Category | Reason for exclusion |
|----------|---------------------|
| B1 / e-VOA (Visa on Arrival) | Different (shorter) form, 30-day visa, applied via `indonesiavoa.vfsevisa.id` — future `ID_B1_EVOA` package |
| C2 Business Visit | Separate Single Entry category (replaces business B211A); future `ID_C2_BUSINESS_VISIT` |
| C7 / C18 Investor / Pre-Investment Visit | Different financial / sponsor blocks; future `ID_C7_INVESTOR` |
| D1 Multiple Entry Visit Visa | Multi-entry, longer validity; different application path; future `ID_D1_VISIT_MULTI` |
| KITAS (Limited Stay Permit) variants | Long-term residence; requires a registered Indonesian sponsor + telex visa flow; future `ID_KITAS_*` series |
| Visa-on-Arrival (paper, at airport) | Not the eVisa portal flow; out of digital scope |
| Indonesia visit-free arrangements (ASEAN free-entry, etc.) | No visa application — out of schema entirely |

Future iterations can add these as additional `visa_type` entries with
their own seed scripts.

---

## 4. Known Source-Flow Ambiguities

1. **eVisa portal vs Molina legacy** — `molina.imigrasi.go.id` was
   replaced by `evisa.imigrasi.go.id` during 2024. The DGI guidance from
   2023 still references the molina URL, but the field structure is
   carried forward. The schema mirrors the unified eVisa journey.

2. **Sponsor / guarantor optionality** — the standard C1 tourist
   pathway via `evisa.imigrasi.go.id` does **not** require an Indonesian
   sponsor. A sponsor is required for the extendable C1 pathway (via
   `visa-online.imigrasi.go.id`), where extension up to 180 days is
   permitted. The schema gates the entire sponsor block on
   `has_sponsor_in_indonesia === yes` rather than forcing it on every
   applicant.

3. **Visa duration vs stay permit** — the C1 visa is valid for entry
   within 90 days of issue and grants a stay permit of 60 days from
   the date of arrival. The schema captures intended length of stay (1–60
   days); enforcement of the 90-day entry validity is downstream of the
   form (in the issuance stamp), not a form input.

4. **Mother's name field** — Indonesian immigration explicitly asks for
   the applicant's mother's full name on the eVisa registration. Most
   countries do not collect this; included as a required field per the
   live registration form.

5. **NIK / NIB sponsor identifiers** — when a sponsor is provided,
   Indonesian immigration cross-checks against either the individual's
   NIK (16-digit Nomor Induk Kependudukan / KTP) or the corporate's NIB
   (Nomor Induk Berusaha). Captured as branch-specific fields under
   `sponsor_type === individual` vs `sponsor_type === corporate`.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

The Indonesia schema is grounded in:
- The published WNA registration form on `evisa.imigrasi.go.id`
  (confirmed required fields including mother's name)
- DGI public guidance on the Visa Kunjungan Wisata journey
- The eVisa General Information FAQ (document requirements, fees,
  processing)

Hand-written or partially copied field lists are not acceptable proof of
parity. Any fields that cannot be verified against the live portal are
flagged in the gap report (§3 of the gap report).

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'ID_C1_TOURIST'` (82 rows) |
| `visa_packages` table | New row registered via Drizzle migration `0022_id_c1_tourist_package.sql` |
| Seed script | `scripts/seed-id-c1-tourist-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | None in v1 — `evisa.imigrasi.go.id` not driven |
| Answer storage | Existing `visa_application_answers` table |
| Document uploads | Existing `application_documents` table per playbook §5.6 |

---

## 7. How the Indonesia Schema Was Derived

The live `evisa.imigrasi.go.id` application form is identity-gated
behind WNA account registration and was not driven during this build.
Schema derivation was therefore a **fallback-source build** per playbook
§3 Step 2:

1. **WNA registration form** — extracted from
   `https://evisa.imigrasi.go.id/front/register/wna`. Establishes the
   personal-info field set: full name, sex, place of birth, DOB, phone,
   mother's name, plus passport block (number, country, dates,
   issuing authority).
2. **eVisa C1 Visit Visa info page** — `evisa.imigrasi.go.id/front/info/evoa`
   confirms purpose categories, duration, fees, document requirements.
3. **eVisa General Information FAQ** —
   `evisa.imigrasi.go.id/front/faq/aff9642b-0b57-443f-8de1-a51601de0ebb`
   lists document requirements (passport 6+ months valid; bank
   statement USD 2,000+ for 3 months; recent color photograph) and the
   60-day stay-permit window.
4. **DGI guidance for Visa Kunjungan Wisata** —
   `imigrasi.go.id/berita/2023/03/10/...` (English) restates document
   requirements and confirms the no-extension restriction for the
   self-applied path.
5. **Sponsor block** — derived from the parallel
   `visa-online.imigrasi.go.id` extendable pathway, where Indonesian
   guarantor data is mandatory; modeled as conditional on
   `has_sponsor_in_indonesia === yes` so both pathways share one schema.

No live application was driven, so the schema is a high-fidelity
reconstruction. Drift will surface when DGI revises the eVisa journey or
the C1 framework changes.

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-id-c1-tourist-form-fields.ts`
2. Run from `viza-be/agent-backend/`:
   `npx tsx scripts/seed-id-c1-tourist-form-fields.ts`
3. Verify output: `Done: N rows seeded (N defined)` with matching N's
4. No frontend deployment needed — the dynamic form reads from DB at
   runtime

### How to Add a Related Visa Category

1. Copy the seed script to
   `seed-id-<new-category>-form-fields.ts`
2. Change `VISA_TYPE` to a new key (e.g. `ID_B1_EVOA`,
   `ID_C2_BUSINESS_VISIT`, `ID_D1_VISIT_MULTI`)
3. Update the `FIELDS` array
4. Add a Drizzle migration inserting into `visa_packages`
5. Run the seed
6. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)

1. **Live-portal recon against `evisa.imigrasi.go.id`** — register a
   throwaway WNA account and walk the C1 application flow to validate
   field labels, conditional gates, and option values against the
   reconstruction. This is the single biggest open item; the schema is
   reconstructed from the registration form + public guidance, not from
   the live application form.

### Short-term (v1.1)

2. **`ID_B1_EVOA` package** — Visa on Arrival (30 days, applied via
   `indonesiavoa.vfsevisa.id`). Different (shorter) form; same
   country, distinct portal. Add a second package + seed.
3. **PDF rendering of the C1 application** — for users who prefer to
   submit through an embassy or designated agency rather than the
   eVisa portal. Use the same answer set; render to a printable form
   (DGI publishes a paper-form variant for embassy intake).
4. **Submission automation against `evisa.imigrasi.go.id`** — Playwright
   recon required (the portal is identity-gated). If the field schema
   holds, the run pattern would mirror France-Visas (registration → form
   fill → finalize → status polling).

### Medium-term (v2)

5. **`ID_C2_BUSINESS_VISIT`** — replaces the C1 with a business-purpose
   sponsor block (Indonesian company invitation required).
6. **`ID_D1_VISIT_MULTI`** — multiple-entry visit visa, 1–5 year
   validity, 60-day stay per entry. Requires a different sponsor /
   eligibility gate.
7. **`ID_KITAS_*` series** — Limited Stay Permit variants (work,
   investor, family, retirement). Long-term residence; requires telex
   visa + post-arrival ITAS conversion. Each is a distinct
   `visa_type`.

---

## 9. Source material checklist (honesty disclosure)

- [x] Live portal was driven end-to-end: **No** — `evisa.imigrasi.go.id`
      C1 application is identity-gated behind WNA registration and was
      not driven during this build. Schema is a reconstruction.
- [x] Published application form field list captured: **Partial** — WNA
      registration form fields confirmed live; the post-registration
      C1 application flow is reconstructed from DGI public guidance.
- [x] Caseworker guidance consulted: **Partial** — DGI public guidance
      (imigrasi.go.id) consulted; internal caseworker manuals not
      located online for Indonesia.
- [x] Legal basis consulted: **Partial** — Indonesia Single Entry Visa
      framework (2024 restructure renaming B211A → C1) referenced for
      visa class scope.
- [ ] Live-portal QA pass completed: **No** — listed as the top
      Immediate item in §8. Required before production-ready promotion.
