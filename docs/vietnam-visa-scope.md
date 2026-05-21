# Vietnam Visa Extraction Scope — v2 Canonical Journey

**Version:** 2.0 (live-portal aligned)
**Status:** Active
**Created:** 2026-04-24
**Updated:** 2026-04-24 (v2 — live-portal recon complete)

---

## 1. Canonical Journey

**Visa type:** Vietnam E-Visa (electronic visa)
**VIZA visa_type key:** `VN_E_VISA`

The Vietnam E-Visa is a single electronic-visa product issued by the
Vietnam Immigration Department (Cục Quản lý xuất nhập cảnh) via
`https://evisa.gov.vn`. It grants stays of **up to 90 days**, with a
choice between **single-entry** or **multiple-entry**, and has been
open to **all nationalities** since Resolution 127/NQ-CP (effective
15 August 2023). It is the canonical first-touch visa for foreign
visitors whose trip purpose is tourism, visiting relatives, business,
short-term working, or a general "other" purpose that does not
require an embassy-issued category visa.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility & guidance | `https://evisa.gov.vn` (landing) | Home page, policy announcements, FAQ |
| 2. Application start | `https://evisa.gov.vn/e-visa/foreigners` | "Apply" entry, disclaimer, agree-to-create-account gate |
| 3. Online application | `https://evisa.gov.vn/e-visa/foreigners` (multi-page form) | The actual form — our extraction target |
| 4. Payment & submission | Same portal (Vietcombank / international card gateway) | $25 (single entry) / $50 (multiple entry) |
| 5. Result retrieval | `https://evisa.gov.vn/tra-cuu-ho-so-dien-tu` | Check status by application code + email + DOB |

The **v1 extraction target** is step 3 — the `evisa.gov.vn` multi-page
application form. This is where all applicant data is collected.

### Application Structure

The live `evisa.gov.vn` form is a **single-page Vue SPA** that
visually groups its fields into 8 numbered sections plus a declaration
trailer. The seed models these as 9 `step_number` buckets for
`DynamicStepForm` chunking — step numbers do not change how answers
map back to the live form. Section headings below are verbatim from
the live form as of 2026-04-24.

1. Personal Information — 13 fields
2. Requested Information — 3 fields
3. Passport Information — 5 fields
4. Contact Information — 7 fields
5. Occupation — 6 fields
6. Information About the Trip — 18 fields
7. Accompanying Children Under 14 — 3 fields (repeatable row)
8. Trip Expenses & Insurance — 3 fields
9. Declaration — 2 fields

**Total: 60 fields matching live `.ant-form-item` count 1:1.**

---

## 2. v1 Scope — What Is Included

- **One visa category only:** Vietnam E-Visa (up to 90 days, single or multiple entry, all nationalities)
- **One application system:** `evisa.gov.vn`
- **Schema extraction:** all sections, fields, options, requiredness, and conditional logic for the general-purpose e-Visa journey
- **Dynamic form rendering:** via existing `visa_form_fields` + `DynamicStepForm`
- **No automated submission** in v1 — `evisa.gov.vn` is a modern React/Ant-Design SPA with device fingerprinting and Vietnamese-side CAPTCHA, and VIZA's "prefill assistant, human submits" model (per DS-160) applies here too

---

## 3. Out-of-Scope Visa Categories (v1)

The following Vietnam visa categories are **explicitly excluded** from
v1. They use different application journeys (embassy/consulate,
sponsor-required) with different field sets.

| Category | Code | Reason for exclusion |
|----------|------|---------------------|
| Tourist Visa (embassy-issued) | DL | Embassy/consulate lodgement, sponsor letter, different form |
| Business Visa (short) | DN1 | Requires invitation letter from Vietnamese enterprise |
| Business Visa (long) | DN2 | Sponsor-required, longer processing |
| Investor Visa | DT1 / DT2 / DT3 / DT4 | Investment threshold, capital evidence |
| Student Visa | DH | Admission documents, sponsor institution |
| Work Permit Visa | LD1 / LD2 | Work permit required as pre-condition |
| Diplomatic / Official | NG1–NG4 | Government-to-government issuance |
| Visa-on-Arrival | — | Deprecated for most nationalities since Aug 2023; still available via pre-approval letter for specific airports only |
| Family reunification (long-stay) | TT | Marriage/relative documentation, embassy lodgement |

Future iterations can add them as additional `visa_type` entries and
seed scripts.

---

## 4. Known Source-Flow Ambiguities

The v2 live-portal recon closed the ambiguities around province count,
border-gate subset, and the previous-visits look-back window (see gap
report §4). The remaining documented items:

1. **Language surface.** `evisa.gov.vn` ships in English and
   Vietnamese. Field labels and option text differ between the two
   surfaces. v2 captures the English surface only; Vietnamese labels
   are a v2.1 concern.

2. **Purpose-of-entry options.** The live form surfaces a 5-option
   umbrella (Tourism, Visiting relatives, Working, Business, Other)
   in that exact order. The Vietnam Immigration Department's category
   guidance lists ~20 sub-purposes (DL, DN, DT, DH, LD, etc.) — but
   `evisa.gov.vn` collapses them to this umbrella and derives the
   correct category server-side. We mirror the form surface, not the
   legal category list.

3. **Multi-entry fee differences.** Single-entry ($25) and
   multiple-entry ($50) differ only in price and visa-validity
   length, not in the captured field set. Fee logic is a
   post-submission concern handled by the payment gateway — out of
   schema.

4. **Ward/commune and residential-address dependent selects.** The
   live `intended_ward_commune` fetches options server-side on
   province change, and `residential_address_in_vietnam` is a
   dependent-select on live (but modelled as text in the seed to avoid
   blocking on Vietnam's address hierarchy dataset). Both are driver-
   layer handoffs — the submission automation must cascade province →
   ward lookups at submit time. See gap report §3.1 and §3.2.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

The Vietnam schema must be grounded in the actual `evisa.gov.vn`
application flow. Hand-written or partially copied field lists are
not acceptable proof of parity. Any fields that cannot be verified
against the official source are flagged in the gap report.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'VN_E_VISA'` (60 rows — live-portal aligned) |
| `visa_packages` table | New row registered via Drizzle migration `0012_vn_e_visa_package.sql` (`country = 'vietnam'`) |
| Seed script | `scripts/seed-vn-e-visa-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | None in v1 — manual submission by user on `evisa.gov.vn` |
| Answer storage | Existing `visa_application_answers` table |

---

## 7. How the Vietnam Schema Was Derived

**v2 (current):** the primary source is the Playwright live-portal
recon captured on 2026-04-24 via
`viza-be/submission-service/src/vietnam/form-recon-v3.ts` against
`https://evisa.gov.vn/e-visa/foreigners`. The tool opens every
`.ant-select` in turn, scrolls the virtual list to completion, and
dumps the result to `vn-recon-out-v3/canonical.json`. Every seed field
carries its live DOM `id` via `validation_rules.live_dom_id`, giving
downstream submission automation a zero-mapping path from seed to
live form.

**v1 (superseded):** initial inventory was a reconstruction from
`vietnam-visa-helper-v1/background.js` (in-repo browser extension,
v1.2.1). The v2 recon corrected 21 over-specified fields, 3 type
flips, 1 prompt correction, and the children-table schema — all
documented in `docs/vietnam-visa-qa-report-2026-04-24.md` §5.

The process:

1. **Identified the canonical journey:** Vietnam E-Visa (general
   e-Visa) — the only Vietnam visa product issuable fully online.
2. **Extension-based v1 draft:** extracted `fieldMappings` from
   `background.js`, catalogued fields, grouped by logical section.
3. **Live-portal recon (v2):** drove stealth-patched Chromium through
   the NOTE gate and onto the form, captured every `.ant-form-item`
   + every `.ant-select` option list with `aria-posinset` dedup.
4. **Diff and rewrite:** diffed the live canonical JSON against the
   v1 seed, rewrote the seed with exact slugs/text, exact option
   orders, and `live_dom_id` annotations.
5. **Re-seeded:** `Done: 60 rows seeded (60 defined)`, typecheck
   clean on both agent-backend and submission-service.

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-vn-e-visa-form-fields.ts`
2. Run: `npx tsx scripts/seed-vn-e-visa-form-fields.ts`
3. Verify output: `Done: N rows seeded (N defined)` with matching N's
4. No frontend deployment needed — the dynamic form reads from DB at runtime

### How to Add a Related Vietnam Visa Category

1. Copy the seed script to `seed-vn-<category>-form-fields.ts` (e.g. `seed-vn-dn1-business-form-fields.ts`)
2. Change `VISA_TYPE` to a new key (`VN_DN1_BUSINESS`, `VN_DL_TOURIST`, etc.)
3. Update the `FIELDS` array
4. Add a Drizzle migration inserting into `visa_packages`
5. Run the seed
6. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Closed by v2
- [x] **Live-portal QA pass** — walked the seed against the live form
      via `form-recon-v3.ts`; 9 of 9 scrapable select option lists
      captured verbatim, 60 fields aligned 1:1, 21 over-specified
      fields removed.
- [x] **Cross-step conditional verified** — `has_violated_vietnam_laws`
      (step 1) gates `violation_of_vietnam_laws_details` (step 9).
- [x] **Province / border-gate enums exact** — province list matches
      Vietnam's 2025 post-reorganization 34-entry canonical list;
      border-gate list captures all 79 live ports.

### Short-term (v2.1)
1. **Drive a fill-and-submit pass** through the live portal with a
   throwaway account to confirm the server accepts the slug values we
   generated from live option text.
2. **Resolve the ward/commune dependent-select cascade** — prototype
   the province-change → commune-fetch in the submission driver.
3. **Add Vietnamese-language labels** as a parallel surface for the
   Vietnamese-speaking applicant population.
4. **Add a purpose-specific document checklist** (tourism: return
   ticket + hotel booking; business: invitation letter; working:
   labour contract) — lives in `application_documents`, not this
   schema.

### Medium-term (v3)
5. **Embassy Tourist Visa (DL)** as a separate package — different
   lodgement channel, sponsor letter required, longer processing.
6. **DN1 / DN2 Business Visa** packages — invitation letter handling,
   Vietnamese enterprise sponsor linkage, work-permit gating.
7. **evisa.gov.vn Playwright submission automation** — the `live_dom_id`
   annotations on every field already give us the selectors; the
   remaining work is the fill loop, payment handoff, and result polling
   (follow the CEAC/DS-160 pattern).

---

## 9. Source material checklist (honesty disclosure)

- [x] Live portal was driven end-to-end: **yes (observational pass)** —
      `form-recon-v3.ts` navigates the landing NOTE gate, reaches the
      form page, captures every `.ant-form-item` and every `.ant-select`
      option list. No fill/submit was performed (that is a v2.1 item).
- [ ] Published application PDF consulted: **no** — Vietnam does not
      publish a static PDF of the e-Visa form; the only authoritative
      source is the live SPA.
- [x] Caseworker guidance consulted: partially — Vietnam Immigration
      Department public FAQ on `evisa.gov.vn` was read for eligibility,
      fees, and durations.
- [x] Legal basis consulted: yes — Resolution 127/NQ-CP (15 Aug 2023,
      all-nationality eligibility and 90-day extension), Resolution
      60/NQ-TW (June 2025, 63→34 province consolidation), Law on Entry,
      Exit, Transit and Residence of Foreigners (51/2019/QH14).
- [x] Live-portal recon completed: **yes** — captured on 2026-04-24;
      artifacts in `viza-be/submission-service/vn-recon-out-v3/`.
- [ ] Live-portal fill-and-submit completed: **no — v2.1 priority**.
      Required to confirm the server accepts the slug values we
      generated from live option text.
