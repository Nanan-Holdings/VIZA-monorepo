# Canada Tourist Temporary Resident Visa — Canonical Scope

**Version:** 2.0

**Status:** Public-form reconstruction; authenticated live-portal QA pending

**Last audited:** 2026-08-16

**VIZA visa type:** `CA_TRV`

## 1. Product boundary

`CA_TRV` is one product: a Temporary Resident Visa application for tourism.
Tourism is fixed by package assignment and is not an applicant-facing purpose
selector.

The following are explicitly not variants of `CA_TRV`:

- **eTA:** a different travel authorization, eligibility route, application,
  and fee. It requires a future `CA_ETA` package.
- **Single-entry versus multiple-entry TRV:** not an applicant choice. IRCC
  decides which visa to issue; the visitor-visa application and fee are the
  same.
- **Super Visa, transit visa, study permit, work permit, temporary resident
  permit, and permanent-residence programs:** separate products.

The applicant should therefore never see an eTA/TRV selector or a
single-entry/multiple-entry selector inside this form.

## 2. Eligibility routing before package assignment

The visa-or-eTA decision happens before `CA_TRV` is assigned. Routing must use
the applicant's nationality, travel document, travel mode, current status, and
any special eligibility described by IRCC's official routing tool:

- [Find out if you need a visa to travel to Canada](https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/check-visa-eta.html)

Do not infer eTA eligibility from the answer schema and do not switch products
inside a started `CA_TRV` application.

## 3. Canonical answer schema

The seed at
`viza-be/agent-backend/scripts/seed-ca-trv-form-fields.ts` is organized as:

1. Application and personal details
2. Residence, relationships, and languages
3. Passport and identity documents
4. Contact information
5. Details of the tourist visit
6. Education and gap-free employment/activity history for the past 10 years
7. Health, immigration, criminality, military, organization, and conduct
   background questions
8. Current Family Information form, IMM 5707
9. China-specific IMM 0104 supplement, shown only to Chinese citizens
10. Applicant declaration

The `CA_TRV` schema models applicant answers only. It deliberately contains no
file, password, OTP, invite-code, session, or portal-account fields.

### IMM 5257 details preserved

- Given names may be blank only when the travel document contains no given
  name; other names split family and given names.
- Sex includes Female, Male, Unknown, and Another gender.
- IRCC dates use `YYYY-MM-DD`; month/year histories use `MM-YYYY`.
- Public forms permit unknown date components in specific date-of-birth
  controls. The schema records this as `allow_unknown_components` with IRCC's
  `*` marker. A live UI QA pass must verify the partial-date control before
  launch.
- Current residence includes country, status, other-status detail, and dates.
- Previous residence is repeatable for stays over six months during the past
  five years.
- Applying from somewhere other than the current residence opens a complete
  country/status/date branch.
- Former marriages/common-law relationships and employment/activity history
  are repeatable groups.
- The visit block contains the official dates, funds, details, and repeatable
  person/institution contact rows. Custom port, carrier, accommodation type,
  expense-bearer, and fixed-duration questions are not part of IMM 5257 and
  are not in the schema.
- Background questions remain separate and preserve the official meanings;
  refusal, denied entry, and ordered-to-leave history is one combined question.

## 4. Family Information form resolver

IRCC's Guide 5256 directs applicants to use whichever Family Information form
is listed in their country-specific package: IMM 5707 or IMM 5645. A current
2026-08-16 audit of IRCC country package pages resolved to **IMM 5707**, so the
active `CA_TRV` schema implements IMM 5707.

The implementation must retain a package/checklist resolver with the semantic
result:

```text
familyInformationForm: "IMM5707" | "IMM5645"
```

It must never merge both forms. If IRCC's country package or a personalized
checklist selects IMM 5645 in the future, the package must use a separate
IMM 5645 branch/schema revision because that form adds a siblings section.

Current IMM 5707 coverage includes:

- applicant;
- spouse/common-law/conjugal partner, or no-partner certification;
- both parents;
- repeatable children, including adopted children and step-children, or
  no-children certification;
- English/official and native-script names, date and country of birth, marital
  status, address, occupation, accompanying status, and relevant physical
  presence at marriage questions;
- final family-information declaration.

Official family-form sources:

- [IMM 5707 — Family Information](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5707.html)
- [IMM 5645 — Family Information](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5645.html)

## 5. China-specific IMM 0104 supplement

The current China visitor-visa package requires IMM 0104 for tourists. Its
answer fields are included in the canonical schema under
`country_of_citizenship === China` (the value stored by the shared country
selector):

- employment and service history for the past 10 years or since age 18,
  whichever is shorter, with no gaps and including military/police service;
- all post-secondary education;
- whether this is the applicant's first trip outside China;
- if not, travel outside China for the past five years or since age 18,
  whichever is shorter.

Each history is a canonical repeat group. IMM 0104 itself remains a generated
document artifact; the applicant does not upload it as a form answer.

China's additional documentary checklist also includes requirements such as
Hukou, national identity evidence, financial/tax/social-insurance evidence,
itinerary evidence, and conditional military, government-employment, or police
forms. Those are Document Center slots and are intentionally absent from
`visa_form_fields`.

Official China sources:

- [IRCC China visitor-visa application package](https://ircc.canada.ca/english/information/applications/visa.asp?countrySelect=CN)
- [IMM 0104 — Details of Education and Employment](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm0104.html)
- [IMM 5884 — China temporary resident visa checklist](https://ircc.canada.ca/english/pdf/kits/forms/IMM5884E.pdf)

## 6. Document boundary

Supporting evidence belongs to `application_documents` and the personalized
IRCC checklist, not to `visa_form_fields`. Potential slots include passport
pages, legal-status evidence, travel history, itinerary/accommodation,
financial and employment evidence, invitation evidence, translated documents,
minor travel authorization, IMM 5707/5645, IMM 5257 Schedule 1, representative
or information-release forms, and country-specific checklist items.

Whether a slot is required depends on answers, nationality, application
country, and the personalized checklist. This schema must not create file-path
answers or present an incomplete static checklist as definitive.

## 7. Portal variants and account ownership

The same canonical semantic answer schema can feed more than one IRCC adapter:

- [Regular IRCC Portal](https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/portal-application-process.html)
- [IRCC Portal — New version](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/online-account.html),
  currently limited to applicants who are at least 18, have never applied to
  IRCC before, apply alone, and do not use a representative
- IRCC Secure Account (GCKey or Sign-In Partner), when required by routing

These are adapter differences, not applicant-facing visa variants. Portal
credentials, invite codes, OTPs, and sessions are managed by VIZA infrastructure
and must never appear in the applicant questionnaire or be stored as ordinary
answers.

Paid-representative and information-release rules require legal and operational
review before production submission. Account/session ownership must not imply
representation without the required authorization.

## 8. Evidence and confidence

Primary public sources:

- [Guide 5256 — Applying for a visitor visa](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/guide-5256-applying-visitor-visa-temporary-resident-visa.html)
- [Apply for a visitor visa](https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/apply-visitor-visa.html)
- [IMM 5257 Schedule 1](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5257-sch1.html)
- [IMM 5484 — Document checklist for a temporary resident visa](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5484.html)

Confidence by area:

| Area | Confidence | Remaining work |
| --- | --- | --- |
| TRV/eTA and single/multiple-entry product boundary | High | Keep routing rules current |
| IMM 5257 answer inventory | High public-form reconstruction | Authenticated portal comparison |
| Current IMM 5707 inventory | High | Re-resolve against package/personalized checklist |
| China IMM 0104 inventory | High | Confirm personalized checklist for each applicant |
| Universal and country-specific documents | Medium | Personalized checklist is authoritative |
| Portal step order, selectors, transforms, and submission | Low | Authenticated headed recon and adapter QA |

This package must be labelled **reconstruction / live portal QA pending** until
an authenticated walk has exercised every branch, repeat group, partial date,
portal variant, and personalized checklist outcome.

## 9. Verification workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-ca-trv-form-fields.ts

cd ../../viza-fe/internal-website
npm run qa:audit-schema-ui -- --visa-type=CA_TRV --strict
```

The seed remains idempotent: it deletes only `CA_TRV` rows and reinserts them in
batches. A successful database run must report the same inserted and defined
field counts.

## 10. Next work

1. Run authenticated, headed recon through every eligible IRCC portal variant.
2. Compare portal labels, requiredness, option values, step order, and partial
   dates against this reconstruction.
3. Resolve the personalized family form and document checklist per applicant.
4. Build portal-specific normalizers/adapters without changing the canonical
   semantic keys.
5. Register a separate `CA_ETA` product only after its own official-form audit.

**Maintainer:** Edward Zehua Zhang
