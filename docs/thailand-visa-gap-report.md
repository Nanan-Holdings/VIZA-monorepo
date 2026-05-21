# Thailand Tourist e-Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, live-portal QA pending
**Created:** 2026-04-28

---

## 1. Coverage Summary

`TH_TOURIST_E_VISA` is registered as a `visa_packages` row and seeded
with the full Tourist e-Visa application field set:

- 8 logical steps (Personal, Passport, Contact + Home Address,
  Occupation, Trip Details, Host in Thailand, Travel History,
  Character + Declaration)
- ~75 fields total
- 11+ conditional / sub-journey gates (other-names, other-nationalities,
  married-spouse-block, other-passports, has-host-in-thailand,
  visited-thailand-before, refused-visa-thailand, refused-visa-other-
  country, has-criminal-record, has-been-deported, port-of-entry-other)
- 3 repeatable groups (`other_nationalities`, `other_passports`,
  `prior_thailand_visits`)
- Single + multi-entry variants captured by the `visa_type_requested`
  radio — no schema fork
- Purpose-of-visit locked to `tourism` (other purposes route to future
  `TH_NON_IMM_*` packages)
- Passport type locked to `ordinary` (non-ordinary types use consular
  channels)

Renders via `DynamicStepForm` with no country-specific React code.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match Royal Thai Embassy guidance | ✅ |
| Field labels match live `thaievisa.go.th` | ⚠️ Pending live QA |
| Required vs optional matches live form | ⚠️ Pending live QA |
| Conditional logic matches live form | ⚠️ Pending live QA |
| Port-of-entry list matches live dropdown | ⚠️ Pending live QA |
| Date format matches portal locale | ✅ DD/MM/YYYY (Thai gov standard) |
| Document upload step covered | ❌ Out-of-schema, see §4 |
| Submission automation | ❌ Out-of-scope v1, see §5 |

---

## 3. Conditional-Logic Status

The schema uses the dynamic-form conditional engine (`evaluateShowIf`).
Operators in use:

- `===` equality — all sub-journey gates
- `showIf` on a leaf radio (yes/no) gates a follow-up textarea or block

Operators **not** used in this schema (but supported):

- `||` / `&&` — no compound gates required for tourism-only flow
- `in [...]` / `not in [...]` — no nationality-based branching in v1
- `required_unless` — no starred fields in v1 (Schengen Annex I pattern)

Cross-step conditionals are not used; every gate fires within the same
step as its parent radio.

---

## 4. Document Uploads — Out of Schema

Per playbook §5.6, document uploads do not live in `visa_form_fields`.
The Thai e-Visa portal expects:

- Passport biographic page (PDF / JPG)
- Recent passport-style photograph (JPG)
- Hotel booking confirmation or itinerary
- Return / onward flight ticket
- Financial proof (bank statement, ~THB 20,000 / per applicant)
- Employment letter or proof of self-employment

These flow through the existing `application_documents` table + Supabase
storage bucket. Wiring the uploads is a frontend / staff-portal concern,
not a schema concern.

---

## 5. Submission Automation — Out of Scope v1

`thaievisa.go.th` is an account-gated portal with:

- Email + password registration with CAPTCHA
- Per-application card payment (Visa / MasterCard / local rails)
- Optional biometric appointment booking step (introduced 2024 for
  selected nationalities)
- Possible Cloudflare / WAF protection on submission endpoints

Per playbook §13, submission-service automation is downstream of seed
work and requires:

- A working Thai e-Visa account credential (encrypted via AES-GCM,
  loaded by `account-loader`)
- A Playwright recon walk producing `docs/thailand-walk-report.md` and
  `docs/thailand-visa-recon-YYYY-MM-DD.json`
- Fill-step + orchestrator code under
  `viza-be/submission-service/src/thailand/` mirroring `egypt/`,
  `vietnam/`, `au-visitor/`, `france-visas/`

None of that is in scope for the v1 schema landing — it is the path to
`TH-006+` follow-up stories.

---

## 6. Live-Portal QA — Top Open Item

The schema is a **reconstruction** from public landing pages, embassy
guidance, and the TM.86 / TM.87 paper antecedents. It has not been
walked against the live portal.

**Action required (post-v1):**

1. Provision a Thai e-Visa applicant account.
2. Walk every form section, screenshot every field, capture every
   dropdown's options.
3. Diff against `seed-th-tourist-e-visa-form-fields.ts`.
4. Fix any drift (label wording, required state, missing options,
   missing fields, missing conditional gates).
5. Add `port_of_entry` enum members for any port the live form lists
   that this schema misses.
6. Confirm the length-of-stay max (60) matches live portal validation.
7. Confirm passport_type is locked to Ordinary on the portal too (some
   Thai embassy guidance hints Diplomatic / Official passports may be
   accepted on the e-Visa portal under bilateral agreements — needs
   confirmation).
8. Update this gap report with the QA pass date + drift findings.

---

## 7. Reviewer Checklist

Before marking `TH-002 / TH-003` as passes:

- [ ] `npx tsx scripts/seed-th-tourist-e-visa-form-fields.ts` reports
      `Done: N rows seeded (N defined)` with matching N
- [ ] `npm run type-check` passes for agent-backend
- [ ] Migration `0026_th_tourist_e_visa_package.sql` applies cleanly
- [ ] Assigning the package to a test user renders all 8 steps via
      `DynamicStepForm`
- [ ] Sub-journeys appear/disappear when their parent radio toggles
- [ ] Repeatable groups render add/remove controls and store correctly
- [ ] Review step lists every answered field

Before marking `TH-004 / TH-005`:

- [ ] `docs/thailand-visa-scope.md` exists and references the live
      portal
- [ ] `docs/thailand-visa-gap-report.md` exists (this file)
- [ ] `progress.txt` has TH-001..TH-005 entries with implementation
      learnings
- [ ] Next-expansion path (live QA, TM.86 PDF render, Non-Imm B/ED/O,
      DTV) is documented

---

## 8. Open Items / Future Work

| Item | Priority | Effort | Owner |
|------|----------|--------|-------|
| Live-portal QA pass with real Thai e-Visa account | High | M (1 day) | Staff |
| Document upload wiring on /application for TH | High | M (1–2 days) | FE |
| TM.86 / TM.87 PDF rendering (mirror JP_TOURIST pipeline) | Med | L (2–3 days) | FE/BE |
| `TH_NON_IMM_B` (business) package | Med | L (~1 day) | BE |
| `TH_DTV` (destination Thailand visa, digital nomad) package | Med | L (~1–2 days, new evidence pack) | BE |
| `TH_NON_IMM_O` (long-stay / family / retirement) package | Low | XL (sub-purpose gating) | BE |
| Submission automation (Playwright runner under `src/thailand/`) | Low | XL (post-account) | BE |

---

**Maintainer:** Edward Zehua Zhang
