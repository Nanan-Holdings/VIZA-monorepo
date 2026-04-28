# Singapore Visit Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, live-portal QA pending
**Created:** 2026-04-28

---

## 1. Coverage Summary

`SG_VISITOR_VISA` registered as a `visa_packages` row and seeded with
the full Visit Visa application field set:

- 9 logical steps (the local-sponsor sub-journey makes this 1 step longer
  than the standard Asia-tourist 8-step template)
- ~80 fields total
- 12+ conditional gates (other-names, other-nationalities, married-spouse,
  other-passports, has-local-sponsor, has-host-in-singapore, visited-
  singapore-before, refused-visa-singapore, refused-visa-other-country,
  has-criminal-record, has-been-deported, port-of-entry-other)
- 3 repeatable groups (`other_nationalities`, `other_passports`,
  `prior_singapore_visits`)
- Single + multi-entry variants captured by `visa_type_requested`
- Purpose-of-visit locked to `tourism` (covers SAVE social visit)
- Passport type locked to `ordinary`
- Local sponsor sub-journey covers all 4 ICA-recognised sponsor types

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match Form 14 + ICA guidance | ✅ |
| Field labels match live SAVE | ⚠️ Pending live QA |
| Local sponsor sub-journey matches SAVE | ⚠️ Pending live QA |
| Race + religion still collected on SAVE | ⚠️ Pending — both modeled as optional |
| NRIC / FIN / UEN format validation | ⚠️ Loose maxLength only — tighten on QA |
| SG postcode validation (6 digits) | ✅ Regex enforced |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema, see §4 |
| Submission automation | ❌ Out-of-scope v1, see §5 |

---

## 3. Conditional-Logic Status

Operators in use: `===` equality. No compound (`||`, `&&`), no list
(`in`/`not in`), no `required_unless`, no cross-step.

The local-sponsor block (step 6) is gated by `has_local_sponsor === yes`
— a single conditional gate covering 7 fields via `block_group:
"local_sponsor"`.

---

## 4. Document Uploads — Out of Schema

Per playbook §5.6, document uploads do not live in `visa_form_fields`.
SAVE expects:

- Passport biographic page (PDF / JPG)
- Recent passport-style photograph (JPG, 35×45 mm)
- Hotel booking / itinerary
- Return / onward flight ticket
- Financial proof (bank statement; nationality-dependent threshold)
- Form V39A (Local Sponsor Letter of Introduction) — generated separately
- Sponsor's NRIC / FIN front + back (or company business profile)

These flow through `application_documents`.

---

## 5. Submission Automation — Out of Scope v1

ICA SAVE is identity-gated:

- Sponsor must log in via Singpass (Singapore Citizen / PR / FIN holder)
- Visa agents use SAVE-PIN credentials
- Applicant data entered by sponsor or agent on the applicant's behalf
- Per-application card payment (Visa / MasterCard / NETS)

Per playbook §13, automation is downstream and requires:
- Singpass / SAVE-PIN credentials (encrypted via AES-GCM,
  `sg_save_accounts` table)
- Recon walk under `viza-be/submission-service/src/singapore/`

Not in v1.

---

## 6. Live-Portal QA — Top Open Item

Action required post-v1:

1. Provision a SAVE applicant + local sponsor account.
2. Walk every form section, screenshot every field.
3. Diff against `seed-sg-visitor-visa-form-fields.ts`.
4. Confirm whether race + religion are still collected on SAVE.
5. Confirm NRIC / FIN / UEN format validation rules.
6. Confirm `port_of_entry` enum coverage (cruise terminals + ferry
   terminals split fine-grained?).
7. Confirm step 6 vs. step 7 distinction (sponsor vs. host) matches
   SAVE's UI.
8. Update gap report with QA findings.

---

## 7. Reviewer Checklist

- [ ] `npx tsx scripts/seed-sg-visitor-visa-form-fields.ts` reports
      `Done: N rows seeded (N defined)` matching N
- [ ] `npm run type-check` passes for agent-backend
- [ ] Migration `0028_sg_visitor_visa_package.sql` applies cleanly
- [ ] Local-sponsor sub-journey appears only when `has_local_sponsor` is
      yes
- [ ] All 9 steps render via `DynamicStepForm`

---

## 8. Open Items / Future Work

| Item | Priority | Effort | Owner |
|------|----------|--------|-------|
| Live-portal QA pass with SAVE | High | M (1 day) | Staff |
| Document upload wiring | High | M | FE |
| Form V39A (Local Sponsor Letter) PDF generation | High | M | FE/BE |
| `SG_LTVP` package | Med | L | BE |
| `SG_STUDENT_PASS` package | Med | L | BE |
| `SG_EMPLOYMENT_PASS` package | Med | XL (MOM EPOL integration) | BE |

---

**Maintainer:** Edward Zehua Zhang
