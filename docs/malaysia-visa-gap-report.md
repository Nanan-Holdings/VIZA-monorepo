# Malaysia Tourist eVISA Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, live-portal QA pending
**Created:** 2026-04-28

---

## 1. Coverage Summary

`MY_TOURIST_E_VISA` is registered as a `visa_packages` row and seeded
with the full Tourist eVISA application field set:

- 8 logical steps (Personal, Passport, Contact + Home Address,
  Occupation, Trip Details, Host in Malaysia, Travel History,
  Character + Declaration)
- ~76 fields total
- 11+ conditional / sub-journey gates (other-names, other-nationalities,
  married-spouse-block, other-passports, has-host-in-malaysia,
  visited-malaysia-before, refused-visa-malaysia, refused-visa-other-
  country, has-criminal-record, has-been-deported, port-of-entry-other)
- 3 repeatable groups (`other_nationalities`, `other_passports`,
  `prior_malaysia_visits`)
- Single + multi-entry variants captured by the `visa_type_requested`
  radio
- Purpose-of-visit locked to `tourism`
- Passport type locked to `ordinary`

Renders via `DynamicStepForm` with no country-specific React code.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match Malaysian High Commission guidance | ✅ |
| Field labels match live `malaysiavisa.imi.gov.my` | ⚠️ Pending live QA |
| Required vs optional matches live form | ⚠️ Pending live QA |
| Conditional logic matches live form | ⚠️ Pending live QA |
| Port-of-entry list matches live dropdown | ⚠️ Pending live QA |
| Date format matches portal locale | ✅ DD/MM/YYYY |
| Race / ethnicity field collected | ⚠️ Optional, may be removed |
| Multi-entry eligibility gating | ⚠️ Live portal filters at submit |
| Document upload step covered | ❌ Out-of-schema, see §4 |
| Submission automation | ❌ Out-of-scope v1, see §5 |

---

## 3. Conditional-Logic Status

Operators in use: `===` equality (all sub-journey gates).
Operators **not** used (but supported): `||`, `&&`, `in`, `not in`,
`required_unless`. No cross-step conditionals.

---

## 4. Document Uploads — Out of Schema

Per playbook §5.6, document uploads do not live in `visa_form_fields`.
The Malaysia eVISA portal expects:

- Passport biographic page (PDF / JPG)
- Recent passport-style photograph (JPG)
- Hotel booking confirmation or itinerary
- Return / onward flight ticket
- Financial proof (bank statement, varies by nationality)
- Sponsor letter (if travelling under business / family invitation,
  out of v1 scope)

These flow through the existing `application_documents` table.

---

## 5. Submission Automation — Out of Scope v1

`malaysiavisa.imi.gov.my` is account-gated with email + password,
CAPTCHA on registration, per-application card payment (Visa /
MasterCard / FPX local rails), and (for selected nationalities like
Indian + Chinese applicants) an in-person biometric appointment step.

Per playbook §13, submission-service automation is downstream and
requires Playwright recon + runner code under
`viza-be/submission-service/src/malaysia/`. Not in v1.

---

## 6. Live-Portal QA — Top Open Item

Schema is a reconstruction. Action required post-v1:

1. Provision a Malaysia eVISA applicant account.
2. Walk every form section, screenshot every field, capture every
   dropdown's options.
3. Diff against `seed-my-tourist-e-visa-form-fields.ts`.
4. Confirm whether race / ethnicity is still collected on the eVISA
   form (drop if no).
5. Confirm `port_of_entry` enum coverage; add Sarawak / Sabah regional
   airports if listed.
6. Confirm length-of-stay max (30) matches portal validation.
7. Update gap report.

---

## 7. Reviewer Checklist

- [ ] `npx tsx scripts/seed-my-tourist-e-visa-form-fields.ts` reports
      `Done: N rows seeded (N defined)` with matching N
- [ ] `npm run type-check` passes for agent-backend
- [ ] Migration `0027_my_tourist_e_visa_package.sql` applies cleanly
- [ ] Assigning the package to a test user renders all 8 steps via
      `DynamicStepForm`
- [ ] Sub-journeys appear/disappear when their parent radio toggles
- [ ] Repeatable groups render add/remove controls and store correctly

---

## 8. Open Items / Future Work

| Item | Priority | Effort | Owner |
|------|----------|--------|-------|
| Live-portal QA pass with real Malaysia eVISA account | High | M (1 day) | Staff |
| Document upload wiring on /application for MY | High | M (1–2 days) | FE |
| `MY_EMPLOYMENT_PASS` (DP10 / Expatriate) | Med | XL (ESD/MDEC integration) | BE |
| `MY_MM2H` (long-stay programme) | Med | L | BE |
| `MY_PVIP` (Premium Visa Programme) | Low | M | BE |
| Submission automation under `src/malaysia/` | Low | XL (post-account) | BE |

---

**Maintainer:** Edward Zehua Zhang
