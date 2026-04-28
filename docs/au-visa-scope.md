# Australia Visa Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-26

---

## 1. Canonical Journey

**Visa type:** Visitor Visa (Subclass 600)
**VIZA visa_type key:** `AU_VISITOR_600`

The Subclass 600 Visitor Visa is the umbrella visitor visa product issued
by the Australian Department of Home Affairs. It covers five streams
under one online application — Tourist, Business Visitor, Sponsored
Family, Approved Destination Status (ADS), and Frequent Traveller — and
allows stays of up to 12 months with single or multiple entries
depending on the stream selected. v1 targets the entire Subclass 600
umbrella in a single VIZA package, with stream-specific sub-journeys
gated by the `stream` master select. Other Australian visitor pathways
(eVisitor 651, ETA 601, Work and Holiday 462 / 417, Transit 771) are
explicitly out of scope and would each be a separate `visa_type`.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility guidance | `https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600` | Subclass 600 product page — streams, eligibility, fees, stay duration |
| 2. Application start | `https://online.immi.gov.au/lusc/login` | ImmiAccount login (account creation required before applying) |
| 3. Online application | ImmiAccount "Visitor (subclass 600)" Internet Application | The actual form — extraction target |
| 4. Biometrics / VAC | `https://www.vfsglobal.com/Australia` (in-country VAC providers vary by nationality) | Biometrics collection after submission for nationalities where required |

The **v1 extraction target** is step 3.

### Application Structure

The Subclass 600 ImmiAccount form collects data across 14 logical
sections that map to `step_number` in the seed:

1. Visa Stream Selection
2. Personal Details
3. Passport & Travel Document
4. National Identity Document
5. Contact Details
6. Authorised Recipient & Migration Agent
7. Family Composition
8. Travel & Visa History
9. Visit Details
10. Stream-Specific Details (Tourist / Business / Sponsored / ADS / Frequent Traveller sub-journeys)
11. Funding & Financial Capacity
12. Health & Health Insurance
13. Character Declarations
14. Declaration

---

## 2. v1 Scope — What Is Included

- **One visa product:** Subclass 600 Visitor Visa (all five streams)
- **One application system:** ImmiAccount online Internet Application for Subclass 600
- **Schema extraction:** all sections, fields, options, requiredness, conditional logic for the umbrella
- **Dynamic form rendering:** via existing `visa_form_fields` + `DynamicStepForm`
- **No automated submission** in v1 — ImmiAccount is identity-gated and post-submission steps (biometrics, VAC appointment, fee payment) sit outside the schema's responsibility per playbook §5.7

---

## 3. Out-of-Scope Visa Categories (v1)

| Category | Reason for exclusion |
|----------|---------------------|
| Subclass 651 eVisitor | Separate online product for ~36 eligible European passports; different field set; no fee; would be a separate `visa_type` |
| Subclass 601 Electronic Travel Authority (ETA) | Separate authority for ~8 passport groups; mobile-app driven (Australian ETA app); shorter form; would be a separate `visa_type` |
| Subclass 462 Work and Holiday | Different stream (work + holiday); subject to country quotas and a partner-country agreement; not a visitor visa |
| Subclass 417 Working Holiday | Separate working holiday product; different country eligibility; not a visitor visa |
| Subclass 771 Transit | Pure transit (≤72 hours); different evidence requirements; would be a separate `visa_type` |
| Subclass 870 Sponsored Parent (temporary) | Long-stay sponsored parent visa; different evidence + sponsor approval workflow |
| Subclass 408 Temporary Activity | Temporary activity stream — distinct from visitor purposes |

Future iterations can add them as additional `visa_type` entries and
seed scripts.

---

## 4. Known Source-Flow Ambiguities

1. **First port of arrival enum** — the live ImmiAccount form accepts
   any IATA airport code; v1 ships the 10 most common Australian ports
   plus an `other` escape hatch (with a follow-up free-text field).
   Future iterations could expand to the full IATA list or accept
   free-text and validate downstream.
2. **States and territories planned to visit** — captured as a single
   free-text field rather than a multi-select. The live form uses
   checkboxes for the 8 AU state/territory codes; converting to a
   `multi_select` field type would require a renderer extension and
   was deferred to keep the schema generic.
3. **Sponsored Family security bond** — the live flow asks for sponsor
   ID details and an approved sponsor reference (created via the
   separate Form 1149 sponsorship application). v1 captures the sponsor
   contact block but defers the sponsorship-reference linkage to v1.1
   pending live-portal walk.
4. **ADS tour code format** — Approved Destination Status tour codes
   are issued by Chinese travel agencies and follow agency-specific
   formats; v1 uses a free-text field (max 30 chars) without format
   validation.
5. **Frequent Traveller eligibility gate** — the live portal restricts
   the Frequent Traveller stream to People's Republic of China passport
   holders; v1 captures the PRC passport flag but does not block the
   stream selection at the schema level. Eligibility enforcement should
   be a downstream submission-time check.
6. **Health insurance requirement** — Subclass 600 does not legally
   require health insurance for all applicants, but it is recommended
   and explicitly assessed for older applicants and Sponsored Family
   stream visitors. v1 captures the answer for all applicants but does
   not gate the field on age (no date arithmetic — see playbook §4
   "Not supported").

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

The Australia schema must be grounded in the actual ImmiAccount
application flow. Hand-written or partially copied field lists are not
acceptable proof of parity. Any fields that cannot be verified against
the official source are flagged in the gap report.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'AU_VISITOR_600'` |
| `visa_packages` table | New row registered via Drizzle migration `0017_au_visitor_600_package.sql` |
| Seed script | `scripts/seed-au-visitor-600-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | None in v1 — ImmiAccount is identity-gated; manual submission by applicant |
| Answer storage | Existing `visa_application_answers` table |

---

## 7. How the Australia Schema Was Derived

Live ImmiAccount portal could not be driven end-to-end by automated
tools — the "Visitor (subclass 600)" Internet Application
(`https://online.immi.gov.au/elp/app?action=new&formId=VSS-AP-600`) is
gated behind ImmiAccount authentication (login wall at
`https://online.immi.gov.au/lusc/login`) and requires a real applicant
identity. v1 is a **reconstruction** from public Department of Home
Affairs documentation (research fallback path in playbook §3 Step 2),
not a live-portal capture. A live-portal QA pass remains a v1.1
prerequisite before production use.

### Public-page Playwright walk (2026-04-26)

Although the application form itself is identity-gated, a Playwright
walk over the public Subclass 600 product pages
(`/visitor-600/tourist-stream-overseas`,
`/business-visitor-stream`, `/sponsored-family-stream`,
`/approved-destination-stream`, `/frequent-traveller-stream`) on
2026-04-26 surfaced two schema corrections that the PDF-only research
had missed:

1. **Frequent Traveller stream is not PRC-only.** Eligible
   nationalities are People's Republic of China, Brunei, Cambodia,
   Indonesia, Laos, Malaysia, Philippines, Singapore, Thailand,
   Timor-Leste and Vietnam (verified from the Frequent Traveller
   stream page). The seed's
   `frequent_eligible_passport_country` select now reflects all 11
   nationalities; the original `frequent_passport_is_prc` boolean was
   removed.
2. **Under-18 applicants need a parental-consent / accompanying-adult
   block.** All five stream pages list "Additional documents for
   applicants under 18" as a required document set. The seed now
   asks `is_applicant_under_18` in Step 2 and conditionally collects
   parental consent, accompanying-adult identity, and an in-Australia
   carer block (with a cross-field `&&` gate).

Two further constraints surfaced but are not schema fields — both are
captured in the gap report (§3.8, §3.9):

- "Additional documents for applicants 75 years old or older" — a
  document-layer requirement; `evaluateShowIf` does not support date
  arithmetic to derive a 75+ gate from DOB.
- "Additional documents for dependent applicants 18 or older" — a
  per-dependent document concern that lives in `application_documents`
  per playbook §5.6.

Sources consulted:
- Department of Home Affairs — Visitor visa (subclass 600) product page
  (`https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600`)
- **Form 1419** — Application for a Visitor visa — Tourist stream
  (publicly downloadable PDF)
- **Form 1418** — Application for a Visitor visa — Business Visitor
  stream (publicly downloadable PDF)
- **Form 1149** — Application for a Sponsored Family Visitor visa
  (publicly downloadable PDF)
- **Form 956 / 956A** — Authorised recipient / migration agent
  appointment forms (publicly downloadable PDFs)
- Migration Regulations 1994 — Schedule 2 cl.600 (legal basis for the
  Subclass 600 visa class and its streams)
- Procedural Instructions to Migration Officers (PAM3) — Visitor visa
  policy documents (public sections)
- Cross-referenced against the UK Standard Visitor seed
  (`seed-uk-standard-visitor-form-fields.ts`) and the Schengen Type C
  seed (`seed-eu-schengen-c-short-stay-form-fields.ts`) for shared
  visitor-visa shape (purpose umbrella, repeatable groups, family
  composition)

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-au-visitor-600-form-fields.ts`
2. Run: `npx tsx scripts/seed-au-visitor-600-form-fields.ts`
3. Verify output: `Done: N rows seeded (N defined)` with matching N's
4. No frontend deployment needed — the dynamic form reads from DB at runtime

### How to Add a Related Visa Category

1. Copy the seed script to `seed-au-<new-category>-form-fields.ts`
   (e.g. `seed-au-evisitor-651-form-fields.ts`)
2. Change `VISA_TYPE` to a new key (e.g. `AU_EVISITOR_651`)
3. Update the `FIELDS` array
4. Add a Drizzle migration inserting into `visa_packages`
5. Run the seed
6. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)
1. **Live-portal QA pass** — drive a real ImmiAccount Internet
   Application end-to-end with a test applicant identity, walk every
   step, trigger every stream sub-journey, and diff against the seed.
   Until this is done the schema is a reconstruction, not a verified
   1:1 match.
2. **Confirm enum exhaustiveness** — verify the live portal's option
   lists for `passport_type`, `relationship_status`, `funding_source`,
   `accommodation_type`, `business_purpose`, and the stream-specific
   selects against the live dropdowns; trim or expand to match.

### Short-term (v1.1)
3. **Multi-select for states-to-visit** — extend `DynamicStepForm` to
   support a `multi_select` field type, then convert
   `intended_states_to_visit` to use it with the 8 Australian
   state/territory codes.
4. **Sponsored Family sponsor reference** — add a sponsor application
   reference field once the live Form 1149 + ImmiAccount linkage is
   confirmed.
5. **Full Australian port enum** — expand `first_port_of_arrival` from
   10 ports + `other` to the full IATA list of Australian international
   ports.

### Medium-term (v2)
6. **eVisitor 651** — separate `AU_EVISITOR_651` package targeting
   ~36 eligible European passport holders; lighter form (~30-50
   fields) without stream selection.
7. **ETA 601** — separate `AU_ETA_601` package targeting ~8 eligible
   passport groups (US, Canada, Japan, Singapore, etc.); mobile-first
   product driven by the Australian ETA app.
8. **Subclass 462 / 417 Working Holiday** — separate working-holiday
   packages with country-specific quota awareness.

---

## 9. Source material checklist (honesty disclosure)

- [x] Live public stream pages were driven by Playwright (2026-04-26 walk over the 5 public Subclass 600 stream product pages — corrected the Frequent Traveller country list and added the under-18 block; results recorded in §7)
- [ ] Live portal **form** was driven end-to-end: **no — ImmiAccount is identity-gated; the Internet Application at `online.immi.gov.au/elp/app?action=new&formId=VSS-AP-600` redirects to `lusc/login` and requires a real applicant identity**
- [x] Published application PDF consulted: yes — Forms 1419, 1418, 1149, 956
- [x] Caseworker guidance consulted: yes — public PAM3 sections for Visitor visa policy
- [x] Legal basis consulted: yes — Migration Regulations 1994 Schedule 2 cl.600
- [ ] Live-portal QA pass completed: **no — must be yes before production**
