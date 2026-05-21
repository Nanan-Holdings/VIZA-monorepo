# Egypt e-Visa (Tourist) — Gap Report

**Generated:** 2026-04-27
**Last revised:** 2026-04-28 (post Phase-A live-portal QA)
**Schema version:** v1.1 (seed-eg-e-visa-form-fields.ts — fees + passport-type corrected from live portal)
**Visa type:** `EG_E_VISA`

Goal: when a user is assigned the Egypt e-Visa (Tourist) package,
their `/application` page renders a 1:1 schema match of what they
would see on the live `visa2egypt.gov.eg` form.

---

## 1. Coverage Summary

| Section | Step | Fields | Notes |
|---------|------|--------|-------|
| Personal Information | 1 | 17 | Block group `place_of_birth`, `spouse`; repeat group `other_nationalities` (max 3); conditional spouse block on `marital_status === married` |
| Passport | 2 | 9 | Inline group `passport_dates`; repeat group `other_passports` (max 3) gated on `has_other_passports === yes` |
| Contact & Home Address | 3 | 8 | Block group `home_address` (5 fields incl. optional state/postcode) |
| Occupation | 4 | 5 | Block group `employer_details` (3 fields, optional) |
| Trip Details | 5 | 13 | Inline group `trip_dates`; block group `accommodation_details`; conditional `port_of_entry_other` on `port_of_entry === other` |
| Host in Egypt | 6 | 6 | Entire step gated on `has_host_in_egypt === yes`; block group `host` |
| Travel History | 7 | 8 | Repeat group `prior_egypt_visits` (max 5) gated on `visited_egypt_before === yes`; refusal-detail textareas gated on respective radios |
| Character & Declaration | 8 | 8 | Final attestation checkbox; conditional textareas for criminal-record + deportation |
| **Total** | **8 steps** | **74 fields** | — |

---

## 2. Visa-Type Variants (Step 5)

`visa_type_requested` covers the two Egypt tourist e-Visa entry-frequency
variants — both share the same form, only fee + validity differ:

- `single` — Single-entry (USD 25, 90-day validity, 30-day max stay)
- `multiple` — Multiple-entry (USD 60, 180-day validity, 30-day max
  stay per visit)

`purpose_of_visit` is locked to `tourism` for the `EG_E_VISA` package.
Other purposes (business visit, family / visit, work, study) belong on
future packages with their own schemas.

---

## 3. Remaining Limitations

### 3.1 Live-portal QA — Phase A complete; Phase B (authenticated form walk) deferred

**Status:** Phase A (public-page recon) ran 2026-04-28 against
`https://visa2egypt.gov.eg`. Phase B (authenticated walk of the
post-login application form) is deferred — requires either an
existing applicant account or 2captcha + an email mailbox to register.
**Impact:** Medium → Low after Phase A corrections

**Phase A scope and method:**
Driven via `viza-be/submission-service/src/egypt/form-recon.ts` —
stealth-patched Chromium walks 9 public pages (Home, About Egypt,
HowDoIApply, Disclaimer, FAQ, ContactUs, TermsOfUse, SignIn, SignUp)
via click-based navigation that preserves the JSF VISTK token. Output
in `viza-be/submission-service/eg-recon-out/` (PNG screenshots + raw
HTML + summary.json).

**Phase A findings that corrected v1.0:**
1. **Fees were wrong.** Schema labels were "USD 25 / 60". Visa2Egypt
   FAQ states **USD 30 (single) and USD 65 (multiple)**. Updated in
   `VISA_TYPE_REQUESTED_OPTIONS` enum and migration description.
2. **Passport type is restricted to Ordinary.** Visa2Egypt Disclaimer
   item 7: e-Visa is not allowed for diplomatic, service, special,
   official, temporary, Nansen, refugee, mission, alien's, or July 51
   Agreement passports — those holders must visit an embassy /
   consulate. Schema's `PASSPORT_TYPE_OPTIONS` collapsed from 5
   options to a single locked `ordinary`, mirroring the
   `purpose_of_visit` lock to `tourism`.
3. **Stack confirmed JSF / PrimeFaces 6.0.** Same stack as
   France-Visas. Phase B automation should reuse
   `france-visas/primefaces-ajax.ts` patterns
   (`selectPrimeFacesOption`, `triggerChange`, `waitForJsfIdle`) and
   the `france-visas` stealth-hardening profile.
4. **Registration form fields confirmed:** firstname (req), surname
   (optional!), email + confirm, password + confirm, reCAPTCHA v2
   (`g-recaptcha-response` field). No nationality / passport at
   registration — those are post-login.
5. **Per-applicant accounts.** Disclaimer item 8: each visitor must
   submit from their own account; parents may apply for children
   from the parent account. Confirms playbook §5.5 dependants
   workflow is the right model — children get separate applications.

**What's still in Phase B (deferred):**
- The 8-step application form post-login — actual `step_number`
  groupings, exact field labels, full enum option lists for
  port_of_entry / accommodation / occupation, conditional gate logic
- Whether the host-in-Egypt sub-journey is gated on a yes/no parent
  (as modelled) or always shown
- Whether parents+children share one account or applicants are
  one-account-each end to end

**Why Phase B deferred:** Visa2Egypt SignUp is reCAPTCHA v2-protected.
Driving it costs 2captcha budget + creates a real account on a real
government portal — both warrant explicit user authorization. No
2captcha key in `viza-be/submission-service/.env.local` (file does
not exist yet). Once an account is provisioned (either user-supplied
creds or explicit "go register" with a 2captcha key), re-run
`form-recon.ts` Phase B against the post-login pages.

**Workaround until Phase B:** ship v1.1 schema. Phase A corrected the
two material drift items (fees, passport type). Remaining drift risk
is in field labels and step boundaries — not in field count or
conditional structure.

### 3.2 Document uploads are out of schema (per playbook §5.6)

**Status:** intentional — managed in `application_documents` table
**Impact:** Low

Visa2Egypt requires three uploads:

- Passport bio page (PDF or JPG, ≤ 1 MB)
- Recent colour photo (JPG, white background, ≤ 5 MB)
- Hotel booking confirmation or invitation letter (PDF, ≤ 5 MB)

These are tracked in `application_documents` per the existing pattern.
No schema fields needed.

**Workaround:** none required — playbook-standard.

### 3.3 Payment + e-Visa delivery is out of scope

**Status:** Visa2Egypt processes payment + delivers the issued e-Visa
PDF after submission; not modeled
**Impact:** Low

Card payment (Visa / MasterCard, USD 25 / 60) happens immediately
after the form submits inside Visa2Egypt's own payment widget. The
issued e-Visa PDF arrives via email 5–7 business days later. Neither
the payment leg nor the issuance leg is part of the form schema.

**Workaround:** staff direct the applicant to Visa2Egypt for payment
once VIZA's review is complete. Future automation could observe
`mailto:` confirmations or scrape the applicant inbox — out of v1.

### 3.4 Visa-on-arrival is a separate non-form flow

**Status:** ~46 nationalities (US, UK, EU, AU, NZ, CA, GCC, etc.) can
also pay USD 25 cash at the Cairo / Hurghada / Sharm / Luxor airport
kiosks instead of using the e-Visa
**Impact:** Low

VOA has no online form — applicants pay at the border. Not modeled
in the EG_E_VISA package; mentioned in `egypt-visa-scope.md` §3 as
an explicitly out-of-scope category.

**Workaround:** if a user prefers VOA, staff hand-walk the kiosk
procedure outside the form flow.

### 3.5 Sinai-only entry permit (15-day, free) is a separate non-form flow

**Status:** paper stamp at Sharm El Sheikh / Taba border points
**Impact:** Low

15-day Sinai-only stamp is not part of the e-Visa universe. Out of
scope; may become a future informational package but never a form
schema.

---

## 4. Closed in v1.1 (2026-04-28 Phase-A live-portal QA)

- **Fee labels** — `single` was "USD 25 / 90-day validity",
  `multiple` was "USD 60 / 180-day validity". Corrected to "Single-entry
  visa (Tourism) — USD 30" and "Multiple-entries visa (Tourism) —
  USD 65" per Visa2Egypt FAQ. Validity claims removed from labels
  since Visa2Egypt itself does not state them; kept in the seed
  comment for traceability.
- **Passport type** — collapsed from 5 options
  (`ordinary / diplomatic / official / service / other`) to a single
  locked `ordinary` per Visa2Egypt Disclaimer item 7. Rationale
  preserved in seed comment.
- **Migration description** — updated to mention the Ordinary-only
  restriction and the corrected fees.
- **Recon tooling** — `viza-be/submission-service/src/egypt/form-recon.ts`
  added, output captured to `eg-recon-out/`. Reusable for the next
  Phase A or quarterly drift check.

---

## 5. Conditional Logic Status

### 5.1 `||` and `&&` operators
`lib/form-utils.ts` `evaluateShowIf` splits on `||` then `&&` and
evaluates each atom with `===` / `!==`. Multi-value gating works.
The Egypt schema does not currently need `||` or `&&` gates — every
sub-journey hangs off a single yes/no parent or a single select
value. If `EG_BUSINESS_E_VISA` is added, the inviter-company block
will likely need `purpose_of_visit === business || purpose_of_visit
=== conference` style gates.

### 5.2 Cross-step conditionals
As of the UK v2 playbook, `DynamicStepForm` seeds `values` state from
the full `prefill`, so cross-step conditionals work. The Egypt schema
does not currently use cross-step gating — every conditional gates on
a parent field on the same step.

### 5.3 Not supported — list membership operator
No `in` operator usage in the Egypt schema. Visa2Egypt's e-Visa
eligibility is enforced at account-registration time (the portal
rejects ineligible nationalities before the form opens), so the form
itself does not gate fields on nationality. If a future variant needs
nationality-based gating, the existing `in` / `not in` operator (used
by Schengen and DS-160) is available.

---

## 6. Implementation Notes

### 6.1 Seed script is idempotent
`scripts/seed-eg-e-visa-form-fields.ts` deletes all rows with
`visa_type = 'EG_E_VISA'` then re-inserts. Safe to re-run.

### 6.2 Repeatable groups used
- `other_nationalities` (step 1, max 3) — gated on
  `has_other_nationalities === yes`
- `other_passports` (step 2, max 3) — gated on
  `has_other_passports === yes`
- `prior_egypt_visits` (step 7, max 5) — gated on
  `visited_egypt_before === yes`

### 6.3 Block groups used (visually grouped fields)
`place_of_birth`, `spouse`, `home_address`, `employer_details`,
`accommodation_details`, `host`

### 6.4 Inline groups used (side-by-side pair rendering)
`passport_dates`, `trip_dates`

---

## 7. Reviewer Checklist

Before marking as production-ready:

- [x] Seed applied (74 rows in `visa_form_fields` with visa_type = `EG_E_VISA`)
- [x] Package registered in `visa_packages` via migration `0023_eg_e_visa_package.sql`
- [ ] Assign a test user the `EG_E_VISA` package
- [ ] Walk every step, answer every conditional, trigger every sub-journey
- [ ] Test every repeatable group (add/remove instance, values persist)
- [ ] Test multi-value `||` in any multi-value conditionals (none in v1)
- [ ] Test cross-step gating (none in v1)
- [ ] Submit a test application — verify all 74 answers persist to `visa_application_answers`
- [ ] Review step (`DynamicReviewStep`) renders every field
- [x] Live-portal QA — Phase A (public-page recon) completed 2026-04-28; Phase B (authenticated form walk) deferred (§3.1)

---

## 8. Source Material

The schema is a **reconstruction**, not a live-portal capture, until
the live-portal QA pass is done (§3.1).

- Egyptian Ministry of Interior — Visa2Egypt portal:
  `https://visa2egypt.gov.eg` (eligibility, fees, requirements,
  application landing page)
- Egyptian Ministry of Foreign Affairs — Form 7 entry-visa application
  (paper antecedent of the e-Visa form): `https://www.mfa.gov.eg`
- US Embassy Cairo — entry/exit requirements: `https://eg.usembassy.gov`
- UK Foreign, Commonwealth & Development Office — Egypt travel
  advice: `https://www.gov.uk/foreign-travel-advice/egypt`
- Cross-reference: `viza-be/agent-backend/scripts/seed-jp-tourist-form-fields.ts`
  (parallel reconstruction-style schema for a similarly-gated portal)

**Expected drift on next live-portal QA:**
- `port_of_entry` enum order and additions (Berenice, regional Taba)
- `passport_type` enum (the Visa2Egypt live render may collapse
  `service` into `official`)
- `occupation` enum order and additions (Visa2Egypt may use a longer
  closed list)
- Religion field — present on Form 7, appears removed from
  Visa2Egypt; if a QA pass shows it returned, add it
- Father / mother full-name fields — Form 7 collects both; Visa2Egypt
  may collect only one (drop the unused one if so)
