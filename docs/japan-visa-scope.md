# Japan Tourist Visa (Short-Term Stay) Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-27

---

## 1. Canonical Journey

**Visa type:** Japan Tourist Visa for Short-Term Stay (Tourism)
**VIZA visa_type key:** `JP_TOURIST`

The v1 audience is **mainland-China (PRC) residents** who travel to
Japan for tourism for up to 30 days (15 days for some short-stay
categories). PRC residents cannot use the `evisa.mofa.go.jp`
self-service portal directly; they submit the completed MOFA
Application for Visa form (Form A) plus supporting documents through a
**designated travel agency** in mainland China (JVAC China). The agency
delivers the package to the Japanese Embassy / Consulate-General in
China and receives the issued visa on the applicant's behalf.

The same MOFA Form A is accepted at Japanese embassies worldwide for
non-PRC nationalities — those applicants either (a) submit at their
local Japanese embassy directly, or (b) where eligible, file through
the `evisa.mofa.go.jp` self-service portal. The `JP_TOURIST` schema
covers them too; their submission channel is documented here rather
than forced into the schema.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility guidance | `https://www.mofa.go.jp/j_info/visit/visa/topics/china.html` | What a PRC resident reads first |
| 2. Application form (canonical PDF) | `https://www.mofa.go.jp/files/000124525.pdf` | MOFA Form A — the field source for this schema |
| 3. Designated travel agency intake (PRC) | Per-agency portals (e.g. CTS, CYTS) | Where PRC residents drop off the completed form + documents |
| 4. Japanese Embassy / Consulate-General | `https://www.cn.emb-japan.go.jp/` (China) | Where the agency delivers the package |
| 5. eVisa portal (non-PRC eligible nationalities, optional) | `https://www.evisa.mofa.go.jp/` | Self-service path for eligible nationalities — out of scope for v1 |

The **v1 extraction target** is step 2 — the published MOFA Form A
PDF.

### Application Structure

The schema is grouped into 8 logical steps, mapping to MOFA Form A
sections:

1. Personal Information
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details
6. Inviter / Guarantor in Japan
7. Travel History
8. Character & Declaration

These map 1:1 to `step_number` in the seed.

---

## 2. v1 Scope — What Is Included

- **One visa category only:** Tourism Short-Term Stay
- **One source form:** MOFA Application for Visa (Form A)
- **Schema extraction:** all 8 sections, 76 fields, options, requiredness,
  conditional logic
- **Dynamic form rendering:** via existing `visa_form_fields` +
  `DynamicStepForm`
- **No automated submission** — the PRC submission channel is a
  human-mediated agency drop-off; non-PRC submission channels are
  embassy or eVisa portal and are deferred

---

## 3. Out-of-Scope Visa Categories (v1)

Categories we explicitly exclude. They use different Form variants or
different application journeys:

| Category | Reason for exclusion |
|----------|---------------------|
| Business Visit (Short-Term Stay) | Same Form A but different inviter block structure (host organisation rather than individual) — future `JP_BUSINESS_VISIT` package |
| Conference attendance | Different supporting documents (organiser invitation, programme); future `JP_CONFERENCE` package |
| Visiting Relatives (Short-Term Stay) | Same Form A but different relationship-to-inviter requirements; future `JP_VISITING_RELATIVES` |
| Spouse / Child of Japanese National | MOFA Form B; long-term residence; requires Certificate of Eligibility |
| Work (Engineer, Specialist in Humanities, Skilled Labour, etc.) | Form C series; long-term residence; requires Certificate of Eligibility |
| Study (College Student / Pre-College Student) | Form C series; admission letter + financial sponsor; requires Certificate of Eligibility |
| `evisa.mofa.go.jp` self-service for non-PRC eligible nationalities | Same field set, different submission channel — future `JP_E_VISA` package |
| Embassy direct submission (non-PRC) | Same field set, different submission channel — covered by the same `JP_TOURIST` schema; the channel difference is documented but not modeled |

Future iterations can add them as additional `visa_type` entries and
seed scripts.

---

## 4. Known Source-Flow Ambiguities

1. **MOFA Form A vs each embassy's local supplement** — many
   Japanese embassies publish a country-specific addendum (e.g.
   schedule of intended stay, extra contact-in-Japan details for tour
   groups). These are not part of the canonical Form A and are not
   modeled in the schema. If a specific embassy is the v2 audience,
   capture the addendum in a separate seed.

2. **PRC-resident "Group Tourism" vs "Individual Tourism"** —
   designated agencies handle both, but the supporting-document
   bundle differs (group tourism requires a tour itinerary signed by
   the agency; individual tourism requires income proof per MOFA
   minimums). The schema covers the form fields shared between both;
   document-bundle differences live in `application_documents`.

3. **eVisa stay-period variant for PRC residents** — when a designated
   agency files via `evisa.mofa.go.jp` on behalf of a PRC resident,
   the issued stay is restricted to 15 or 30 days (vs up to 90 for
   other eVisa nationalities). The schema does not encode this — it
   is a downstream issuance limit, not a form input.

4. **Inviter immigration-status free-text** — MOFA Form A item 31
   asks foreign-national inviters in Japan to state their status of
   residence (permanent resident, long-term resident, work visa
   holder, etc.). The schema models this as free text. If an enum
   becomes useful later, the canonical list lives in MOFA's
   "Status of Residence" table.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

The Japan schema is grounded in the published MOFA Form A PDF
(`https://www.mofa.go.jp/files/000124525.pdf`). Hand-written or
partially copied field lists are not acceptable proof of parity. Any
fields that cannot be verified against the PDF are flagged in the gap
report (§3 of the gap report).

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'JP_TOURIST'` (76 rows) |
| `visa_packages` table | New row registered via Drizzle migration `0021_jp_tourist_package.sql` |
| Seed script | `scripts/seed-jp-tourist-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | None in v1 — submission channel is a designated travel agency |
| Answer storage | Existing `visa_application_answers` table |
| Document uploads | Existing `application_documents` table per playbook §5.6 |

---

## 7. How the Japan Schema Was Derived

The v1 audience (PRC residents) cannot drive the live `evisa.mofa.go.jp`
portal — it is not accessible to them. Schema derivation was therefore a
**fallback-source build** per playbook §3 Step 2:

1. **Canonical PDF** — MOFA Application for Visa Form A
   (`https://www.mofa.go.jp/files/000124525.pdf`). Every field name in
   the schema maps to a numbered item on the PDF (items 1–22 cover
   personal / passport / trip / contact, items 25–31 the inviter
   block, items 33–37 the character questions).
2. **Tourist Short-Term Stay guidance** —
   `https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html`
3. **PRC-specific guidance** —
   `https://www.mofa.go.jp/j_info/visit/visa/topics/china.html`
   (confirms the designated-agency channel)
4. **JAPAN eVISA system overview** —
   `https://www.mofa.go.jp/j_info/visit/visa/visaonline.html`
   (confirms PRC residents are not in the direct-eligible list)

No live portal was driven, so the schema is a high-fidelity
reconstruction. Drift will surface only if MOFA revises Form A.

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-jp-tourist-form-fields.ts`
2. Run from `viza-be/agent-backend/`:
   `npx tsx scripts/seed-jp-tourist-form-fields.ts`
3. Verify output: `Done: N rows seeded (N defined)` with matching
   N's
4. No frontend deployment needed — the dynamic form reads from DB at
   runtime

### How to Add a Related Visa Category

1. Copy the seed script to
   `seed-jp-<new-category>-form-fields.ts`
2. Change `VISA_TYPE` to a new key (e.g. `JP_BUSINESS_VISIT`,
   `JP_E_VISA`, `JP_SPOUSE`)
3. Update the `FIELDS` array
4. Add a Drizzle migration inserting into `visa_packages`
5. Run the seed
6. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)

1. **Render to PDF — MOFA Form A from VIZA answers** — add a server
   action that takes a `JP_TOURIST` application's
   `visa_application_answers` rows and renders the official MOFA Form
   A PDF (with a 4×3cm photo placeholder and a signature block). PRC
   residents need a printable form to hand to the designated agency,
   so this is the missing last-mile piece. Can use `pdf-lib` against
   the published PDF as the template.

### Short-term (v1.1)

2. **`JP_E_VISA` for non-PRC eligible nationalities** — same field
   set, different submission channel (`evisa.mofa.go.jp`). Add a
   second package, drive Playwright recon against the live portal
   (would need an account-eligible passport), wire submission
   automation similar to `EU_SCHENGEN_C_SHORT_STAY` / France-Visas.
3. **`JP_TOURIST_EMBASSY` for non-PRC residents going via embassy
   directly** — same schema, different submission packaging. May not
   need a separate `visa_type` if the embassy intake is identical to
   the agency intake (just different recipient).

### Medium-term (v2)

4. **`JP_BUSINESS_VISIT`** — splits the inviter block to model an
   inviting **organisation** (company, university, government body)
   rather than an individual.
5. **`JP_SPOUSE` (Form B)** — long-term residence; introduces the
   Certificate of Eligibility flow.
6. **`JP_WORK_*` (Form C series)** — engineer, specialist in
   humanities, skilled labour categories. Each is its own
   `visa_type`.

---

## 9. Source material checklist (honesty disclosure)

- [x] Live portal was driven end-to-end: **No** — `evisa.mofa.go.jp`
      is not directly accessible to PRC residents and was not driven
      for non-PRC paths either. Schema is a reconstruction.
- [x] Published application PDF consulted: **Yes** —
      `https://www.mofa.go.jp/files/000124525.pdf` (Form A, English)
- [x] Caseworker guidance consulted: **Partial** — MOFA public
      guidance only; internal caseworker manuals were not located
      online for Japan.
- [x] Legal basis consulted: **Partial** — Immigration Control and
      Refugee Recognition Act (Japan) referenced for the character
      questions (items 33–37) which mirror the inadmissibility
      grounds.
- [ ] Live-portal QA pass completed: **N/A for v1 audience** — no
      portal exists for PRC residents. For the future `JP_E_VISA`
      package, a live-portal QA pass against `evisa.mofa.go.jp` is
      required before production.
