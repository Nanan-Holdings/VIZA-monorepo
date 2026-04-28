# Egypt e-Visa (Tourist) Extraction Scope — v1 Canonical Journey

**Version:** 1.0
**Status:** Active
**Created:** 2026-04-27

---

## 1. Canonical Journey

**Visa type:** Egypt e-Visa (Tourist — Single-entry / Multi-entry)
**VIZA visa_type key:** `EG_E_VISA`

The v1 audience is travellers from one of the ~75 e-Visa-eligible
nationalities (US, UK, EU/EEA, AU, NZ, CA, JP, KR, SG, GCC member
states, Brazil, Argentina, etc.) visiting Egypt for tourism for up to
30 days per entry. Applicants apply online through the Egyptian
Ministry of Interior's e-Visa portal at `https://visa2egypt.gov.eg`.
The same field set covers both entry-frequency variants:

- **Single-entry tourist e-Visa** — fee ~USD 25, validity 90 days from
  issue, 30-day max stay.
- **Multi-entry tourist e-Visa** — fee ~USD 60, validity 180 days from
  issue, 30-day max stay per visit.

The variant is captured by the `visa_type_requested` field, not by
splitting into separate packages — the form is identical.

### Official Source Entrypoints

| Step | URL / System | Purpose |
|------|-------------|---------|
| 1. Eligibility guidance | `https://visa2egypt.gov.eg/eVisa/Home` | Country eligibility list, fees, requirements |
| 2. Account registration | `https://visa2egypt.gov.eg/eVisa/Account/Register` | Create applicant account (email + password) |
| 3. Online application | `https://visa2egypt.gov.eg/eVisa/Application` | The actual form — our extraction target |
| 4. Payment | Visa2Egypt portal (Visa / MasterCard) | Card payment immediately after submission |
| 5. e-Visa delivery | Email PDF | Issued within 5–7 business days; print and present at port of entry |

The **v1 extraction target** is step 3.

### Application Structure

The schema is grouped into 8 logical steps, mirroring the order of the
Visa2Egypt application form sections:

1. Personal Information
2. Passport
3. Contact & Home Address
4. Occupation
5. Trip Details
6. Host in Egypt (optional sub-journey)
7. Travel History
8. Character & Declaration

These map 1:1 to `step_number` in the seed.

---

## 2. v1 Scope — What Is Included

- **One visa category only:** Tourist e-Visa (single-entry + multi-entry
  share the form)
- **One application system:** `visa2egypt.gov.eg`
- **Schema extraction:** all 8 sections, 74 fields, options, requiredness,
  conditional logic
- **Dynamic form rendering:** via existing `visa_form_fields` +
  `DynamicStepForm`
- **No automated submission** — Visa2Egypt sits behind an account
  registration + payment flow that requires the applicant's card; the
  schema extracts the form, not the submission

---

## 3. Out-of-Scope Visa Categories (v1)

Categories we explicitly exclude. They use different application
journeys with different field sets:

| Category | Reason for exclusion |
|----------|---------------------|
| Business e-Visa | Different sub-journey (inviter company block, business letter requirements) — future `EG_BUSINESS_E_VISA` package |
| Visit / Family e-Visa | Different sub-journey (host-relationship documentation, sponsor undertaking) — future `EG_VISIT_E_VISA` package |
| Work / Long-stay residence | Consular flow at Egyptian embassies; requires Ministry of Manpower work permit; not on Visa2Egypt — future `EG_WORK_VISA` package |
| Student visa | Consular flow; requires Higher Education Ministry letter — future `EG_STUDENT_VISA` package |
| Sinai-only entry permit (15-day, free) | Paper stamp at Sharm El Sheikh / Taba border, no online form — out of e-Visa flow |
| Visa-on-arrival (cash USD 25 at Cairo / Hurghada / Sharm / Luxor airports) | No online form — paid at the kiosk; ~46 nationalities eligible |
| Diplomatic / Official passport entries | Bilateral agreements; consular issuance — out of e-Visa scope |

Future iterations can add them as additional `visa_type` entries and
seed scripts.

---

## 4. Known Source-Flow Ambiguities

1. **Live-portal QA is N/A in v1** — Visa2Egypt requires an account
   (email + password + CAPTCHA) before any field on the application
   form is visible. The schema is a reconstruction from public landing
   pages, the Visa2Egypt FAQ, the Ministry of Foreign Affairs Form 7
   (paper entry-visa application — same field set as the e-Visa), and
   independent third-party walk-throughs. Re-validate when an account
   becomes available for testing.

2. **Father / mother full names** — the e-Visa form asks for both;
   the consular Form 7 asks for both **with maiden name** annotation.
   Field labels follow Form 7 to be safe. Drop if Visa2Egypt no
   longer collects them at the next QA pass.

3. **Religion field** — Form 7 has a religion field; Visa2Egypt
   appears to have removed it from the online form circa 2018. Not
   modeled in the schema. If a future QA pass surfaces it, add it.

4. **Issue / expiry date format** — Visa2Egypt presents dates as
   DD/MM/YYYY in the local locale. The seed sticks with the
   playbook-default `format: "DD/MM/YYYY"`. The portal accepts
   month-name pickers and date-string entry interchangeably.

5. **Port-of-entry list** — the live portal shows a closed dropdown
   of major airports + sea ports. The seed enumerates the 10
   commonly-used ports plus `other`. If new ports open (Berenice,
   Taba airport regional), add to the enum.

---

## 5. Design Principle

> **Source-truth-over-manual-approximation:** preserve the official
> field structure, requiredness, options, and conditional logic in a
> machine-readable VIZA schema before optimizing downstream automation.

The Egypt e-Visa schema is grounded in the published Visa2Egypt portal
flow (sections + landing-page descriptions) and the public Form 7
paper application. Hand-written or partially copied field lists are
not acceptable proof of parity. Any fields that cannot be verified
against the live portal at the next QA pass must be flagged in the
gap report.

---

## 6. Integration with Existing Infrastructure

| Component | Approach |
|-----------|----------|
| `visa_form_fields` table | New rows with `visa_type = 'EG_E_VISA'` |
| `visa_packages` table | New row registered via Drizzle migration `0023_eg_e_visa_package.sql` |
| Seed script | `scripts/seed-eg-e-visa-form-fields.ts` (idempotent delete + re-insert) |
| Frontend rendering | No code changes — `DynamicStepForm` is visa-type-agnostic |
| Submission automation | None in v1 — Visa2Egypt requires applicant card payment, not automated |
| Answer storage | Existing `visa_application_answers` table |

---

## 7. How the Egypt Schema Was Derived

Live portal access requires an applicant account; the schema is a
**high-fidelity reconstruction** from public sources:

- `https://visa2egypt.gov.eg/eVisa/Home` — eligibility, fees, visa
  types (single vs multi-entry), required documents
- Visa2Egypt FAQ + Help pages — section ordering, field-level
  requirements
- Egyptian Ministry of Foreign Affairs Form 7 (entry-visa
  application) — the paper antecedent of the e-Visa form, mirrors
  field-for-field
- US Embassy Cairo and UK GOV travel-advice pages — visa-type
  enumeration cross-check
- Field-set parity comparison with VN_E_VISA and JP_TOURIST seeds
  (both reconstruction-style schemas built under this playbook)

Sources consulted:
- Egyptian Ministry of Interior — Visa2Egypt portal
  (`https://visa2egypt.gov.eg`)
- Egyptian Ministry of Foreign Affairs — Form 7 paper entry-visa
  application (`https://www.mfa.gov.eg`)
- US Embassy in Egypt — entry/exit requirements page
  (`https://eg.usembassy.gov`)
- UK Foreign, Commonwealth & Development Office — Egypt travel
  advice (`https://www.gov.uk/foreign-travel-advice/egypt`)

### How to Rerun or Update the Schema

1. Edit `viza-be/agent-backend/scripts/seed-eg-e-visa-form-fields.ts`
2. Run: `npx tsx scripts/seed-eg-e-visa-form-fields.ts`
3. Verify output: `Done: N rows seeded (N defined)` with matching N's
4. No frontend deployment needed — the dynamic form reads from DB at
   runtime

### How to Add a Related Visa Category

1. Copy the seed script to `seed-eg-<category>-form-fields.ts`
2. Change `VISA_TYPE` to a new key (e.g. `EG_BUSINESS_E_VISA`)
3. Update the `FIELDS` array (add inviter company block, adjust
   purpose options)
4. Add a Drizzle migration inserting into `visa_packages`
5. Run the seed
6. Assign the package via the admin interface

---

## 8. Next Recommended Actions

### Immediate (before production)
1. **Live-portal QA pass** — register a Visa2Egypt account with a real
   passport, walk every step, capture every field + option list, and
   reconcile against the seed. Update enums (port_of_entry,
   passport_type, occupation) to match the live render order.
2. **Document upload wiring** — confirm passport bio page, photo, and
   hotel-booking confirmation are tracked under `application_documents`
   with the same metadata shape as JP_TOURIST.

### Short-term (v1.1)
3. **Add `EG_BUSINESS_E_VISA` package** — same Visa2Egypt portal,
   different inviter block (company name, address, business letter).
4. **Visa-on-arrival informational flow** — for the ~46 VOA-eligible
   nationalities, surface a non-form package that documents the kiosk
   procedure and lists required cash + supporting docs (no schema
   needed).

### Medium-term (v2)
5. **PDF rendering of the completed form** — Visa2Egypt itself emits
   the issued e-Visa PDF; the application form is filled online with
   no canonical PDF download. If staff need a paper proof of intake,
   render the seeded answers into a PDF mirroring Form 7.
6. **Sinai-only entry-permit informational flow** — separate package
   documenting the 15-day Sharm / Taba paper stamp; no form schema.

---

## 9. Source material checklist (honesty disclosure)

- [x] **Phase A** — public-page recon driven end-to-end with Playwright
      (2026-04-28): 9 public pages walked (Home, About Egypt,
      HowDoIApply, Disclaimer, FAQ, ContactUs, TermsOfUse, SignIn,
      SignUp). Confirmed JSF / PrimeFaces 6.0 stack; corrected fees
      (USD 30 / 65) and passport-type restriction (Ordinary only) in
      schema v1.1. Output: `viza-be/submission-service/eg-recon-out/`.
- [ ] **Phase B** — authenticated form walk (post-login application
      pages): not driven — Visa2Egypt SignUp is reCAPTCHA-protected,
      requires user-supplied account or explicit 2captcha consent.
- [x] Published application form (Form 7 paper) consulted: yes —
      mirrors the e-Visa field set
- [x] Caseworker / public guidance consulted: yes — Visa2Egypt FAQ,
      US Embassy Cairo entry/exit page, UK FCDO travel advice
- [x] Legal basis consulted: yes — Egyptian Ministry of Interior
      e-Visa Decree (2017), MFA Form 7 statutory schedule
- [ ] Phase-B live-portal QA completed: open — required before
      production (§8 immediate #1)
