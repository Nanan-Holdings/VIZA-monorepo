# New Zealand Visitor Visa Gap Report — v1

**Version:** 1.0
**Status:** v1 schema shipped, live-portal QA pending
**Created:** 2026-04-28

---

## 1. Coverage Summary

`NZ_VISITOR_VISA` registered as a `visa_packages` row and seeded with:

- 8 logical steps (extends 7-step "no-sponsor" template with TB health
  declaration in step 8)
- ~73 fields total
- 12+ conditional gates (incl. de-facto partner via OR)
- 3 repeat groups (other_nationalities, other_passports, prior_nz_visits)
- Three submission variants (NZeTA, Visitor Single, Visitor Multi)

NZ-specific: de-facto partner status, TB history declaration, available
funds NZD, NZ port-of-entry list including Queenstown (key tourist
gateway), Tauranga / Lyttelton cruise ports.

---

## 2. Schema vs. Live-Portal Parity Status

| Concern | Status |
|---------|--------|
| Field labels match Form 1017 + INZ guidance | ✅ |
| Field labels match Immigration Online | ⚠️ Pending live QA |
| De-facto partner gating (married OR de_facto) | ✅ Uses `||` operator |
| TB history step 8 dependency | ✅ |
| Available funds NZD numeric | ✅ Regex-validated |
| Date format | ✅ DD/MM/YYYY |
| Document upload | ❌ Out-of-schema |
| Submission automation | ❌ Out-of-scope v1 |

---

## 3. Conditional-Logic Status

Operators in use: `===`, `||` (de-facto partner OR married → spouse block).
Operators **not** used: `&&`, `in`/`not in`, `required_unless`,
no cross-step.

This is the first VIZA schema using `||` in a sub-journey gate beyond
multi-purpose Schengen.

---

## 4. Document Uploads — Out of Schema

INZ expects:

- Passport biographic page
- Recent photograph
- Hotel booking / itinerary
- Return / onward ticket
- Financial proof (bank statement)
- Sponsor / host invitation letter (where applicable)
- Chest X-ray + medical certificate (stays >6 months from listed
  countries)

Flow through `application_documents`.

---

## 5. Submission Automation — Out of Scope v1

Immigration Online is RealMe-authenticated. RealMe is NZ government's
single sign-on (similar to Singpass, MyKad, Aadhaar). Per playbook
§13, automation requires:

- RealMe credentials (encrypted via AES-GCM, `nz_inz_accounts` table)
- Recon walk under `viza-be/submission-service/src/new_zealand/`
- AEWV / Resident / Student visa pathways are separate runners

NZeTA is the simplest automation candidate (lower auth, online, no
RealMe required).

---

## 6. Top Open Items

1. **Live-portal QA pass** — first, with RealMe credentials.
2. **NZeTA Playwright runner** — easier than Visitor Visa, faster ROI.
3. **TB-history conditional** — confirm Immigration Online presents
   it as separate Q vs. embedded in general health.

---

## 7. Reviewer Checklist

- [ ] Seed run: `Done: N rows seeded (N defined)` matches
- [ ] `npm run type-check` passes
- [ ] Migration `0031_nz_visitor_visa_package.sql` applies cleanly
- [ ] All 8 steps render via `DynamicStepForm`
- [ ] De-facto partner sub-journey opens for both `married` and
      `de_facto` marital status

---

## 8. Open Items / Future Work

| Item | Priority | Effort |
|------|----------|--------|
| Live-portal QA pass + RealMe creds | High | M |
| NZeTA Playwright runner | High | M-L |
| `NZ_AEWV` (employment) package | Med | XL |
| `NZ_WORKING_HOLIDAY_VISA` package | Med | L |
| `NZ_STUDENT_VISA` package | Med | L |
| `NZ_PARTNERSHIP_VISA` package | Low | L |

---

**Maintainer:** Edward Zehua Zhang
