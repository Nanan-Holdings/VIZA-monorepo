# UAE Five-Year Multiple-Entry Tourist Visa — Canonical Scope

**Schema version:** 2.0

**Status:** Official-source ICP transaction reconstruction; authenticated UAE Pass QA required

**Last audited:** 2026-08-18

**Compatibility VIZA visa type:** `AE_TOURIST_VISA`

## 1. Product boundary

`AE_TOURIST_VISA` means only the federal ICP self-sponsored five-year
multiple-entry tourist visa:

| Identifier | Canonical value |
| --- | --- |
| Authority | Federal Authority for Identity, Citizenship, Customs and Port Security (ICP) |
| ICP service code | `377-005-001-031` |
| Smart Services transaction | `783` (`longTerm5YearsMultiEntry`) |
| Official route | [Issue visa request 783](https://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/783) |
| Sponsor | None; self-sponsored |
| Entry | Multiple entry for five years |
| Stay | Up to 90 days per year, extendable to no more than 180 days per year |
| First entry | Within 60 days of issuance |

The existing compatibility code is intentionally narrow. It must not expose a
visa-duration selector, sponsor branch, airline selector, hotel sponsor,
resident sponsor, GDRFA path, or a generic UAE tourist umbrella.

## 2. Products explicitly excluded

Standard 30-day and 60-day single/multiple-entry tourist visas are materially
different products submitted by an accredited UAE tourism establishment. They
require separate product codes only after VIZA has an authorized tourism-
sponsor integration.

Official GDRFA examples:

- [Single-entry tourist visa](https://gdrfad.gov.ae/en/services/f9e586fe-0642-11ec-0320-0050569629e8)
- [30/60-day multiple-entry tourist visa](https://gdrfad.gov.ae/en/services/f9e586fb-0642-11ec-0320-0050569629e8)

Also excluded are visa-on-arrival/visa-exempt travel, residence, employment,
Golden, Green, remote-work, student, family, job-exploration, mission, transit,
and all other entry permits.

Family/group Smart Services transaction `784` is separate workflow. Transaction
783 is the individual application; it must not render a repeatable companions
block.

## 3. Canonical answer journey

The seed at
`viza-be/agent-backend/scripts/seed-ae-tourist-visa-form-fields.ts` is organized
as:

1. **Beneficiary information**
   - synchronized official English/Arabic full name
   - current and previous nationality
   - profession, gender, birth details
   - religion, marital status, and education level
2. **Passport**
   - number, type, issuing place/country, issue date, and expiry date
3. **Contact outside the UAE**
   - email, residence country/address, and foreign telephone
4. **Accommodation in the UAE**
   - emirate, city, area, detailed address, property name, and P.O. box
   - one two-choice local-mobile question with one conditional number panel
5. **Application details**
   - transaction reason
   - tourism is locked by product/transaction metadata and is not an
     applicant-facing purpose selector

English and Arabic mirrored official fields must not render as duplicate input
panels. VIZA displays the selected interface language, preserves the paired
official value internally, and shows both values only in the required final
bilingual review.

The generic ICP beneficiary templates also contain configurable controls. The
seed includes only controls supported for this product strongly enough to show
now. Faith, education-country/details, mother's-name, and flight-information
controls remain pending transaction-783 visibility QA and must not be added as
always-visible questions.

## 4. Document boundary

All evidence stays in `application_documents`. The answer seed references the
slots as metadata on nationality; it does not define file fields.

| Document slot | Rule |
| --- | --- |
| `passport_bio_page` | Required; passport valid for at least six months |
| `personal_photo` | Required |
| `six_month_bank_statement` | Required; official, stamped, signed, colored statement covering six months and showing at least USD 4,000 (or equivalent) in each month |
| `uae_health_coverage_evidence` | Required; medical-insurance evidence issued in the United Arab Emirates and valid for at least 180 days |
| `return_or_onward_ticket` | Required |
| `uae_accommodation_evidence` | Conditional only if the authenticated transaction-783 form requests it for the entered data; it is not listed in the public service-card requirements |
| `national_identity_copy` | Optional on the public service card; require only if the authenticated form requests it for the entered data |

Document upload status, replacement, OCR, storage paths, and server-side file
identity remain Document Center concerns.

An uploaded filename is not proof that these content rules are met. Before an
authenticated transaction-783 session may open, the submission runner requires
`validated`, `accepted`, or `approved` status plus a valid review timestamp and
the exact content findings under the document metadata namespace
`ae_transaction_783_evidence_review`. For a bank statement the audited keys are
`statement_months`, `minimum_monthly_balance_usd_equivalent`, `official`,
`stamped`, `signed`, and `colored`. For insurance they are `issuer_country` and
`validity_days`. Missing or stale review metadata stops at
`document_content_review`; file presence alone never clears the gate.

## 5. Workflow-only controls

These controls and records are intentionally absent from `visa_form_fields`:

- UAE Pass/login, official account details, credentials, and sessions
- file inputs and attachment identifiers
- guarantee provision, guarantee receipt, and refund state
- health-coverage purchase or policy checkout
- official fees, smart-service charges, payment methods, cards, and receipts
- review-screen state, application status, and official transaction/session IDs

The public service card updated 2025-02-16 lists the following AED components:

| Component | Listed amount |
| --- | ---: |
| Request | AED 100 |
| Issue | AED 500 |
| Security deposit | AED 3,025 |
| E-services | AED 28 |
| ICP fees | AED 22 |
| Smart Services | AED 100 |
| **Listed total** | **AED 3,775** |

The service card warns that fees may vary with entered data. Health-insurance
fees and deposits are refundable only when the main application is rejected;
the security deposit is refunded after visa cancellation or expiry. VIZA must
store these as separate official-fee/deposit workflow records, verify the live
AED breakdown at checkout, and never treat the public total as an immutable
charge quote.

## 6. Authentication-gated fields and QA policy

The public service card establishes the product, requirements, and eligibility.
The current transaction-783 route renders the exact product plus the four-step
progress shell (`Request Information`, `Attachments Info`, `Review
Application`, `Application Fees`) but exposes no applicant inputs, file inputs,
or start control to a guest session. UAE Pass/login is therefore the next
verified boundary, and the lookup API rejects unauthenticated requests. Public
official client templates give high-confidence semantic fields but not a
complete transaction-783 requiredness/options snapshot.

The login page offers `Sign in with UAE PASS` and `Use Other Login Option`, but
ordinary Smart Services username registration is limited to UAE/GCC
citizens/residents, corporate-guarantor files, establishments, and typing
centers. An ordinary foreign tourist must therefore use an authorized UAE PASS
session or an explicitly eligible provider session. VIZA must not create a
generic username account or collect UAE PASS credentials as application
answers.

Fields backed by authentication-gated lookups or configuration carry:

```json
{
  "live_portal_qa_required": true,
  "live_portal_qa_note": "field-specific capture instruction"
}
```

That metadata currently covers previous nationality visibility; profession,
gender, religion, marital status, education level, passport type, phone
formats, emirate/city/area dependencies, building/P.O.-box visibility, local
mobile behavior, and transaction reason.

Before launch, an authorized transaction-783 session must capture:

1. exact lookup labels and official codes;
2. exact required/optional flags;
3. whether faith and education subfields appear;
4. whether mother-name fields appear;
5. whether `showVisitorFlightInfo` is enabled and, if so, the country/port,
   booking reference, expected arrival, and departure controls;
6. the local-mobile no-number branch;
7. selector and transfer behavior for the submission adapter.

Do not fill those gaps with generic UAE or GDRFA options.

## 7. Sources and confidence

Primary official sources:

- [ICP five-year multiple-entry tourist visa service](https://icp.gov.ae/en/services-details/?serviceid=68f5bc968c587a0011cb16cd)
- [ICP Smart Services transaction 783](https://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/783)
- [ICP Smart Services user manual](https://icp.gov.ae/wp-content/themes/icp_v4/assets/attachments/user-manual-en.pdf)
- Public ICP Smart Services Angular templates and current lookup constants

Confidence by area:

| Area | Confidence | Remaining work |
| --- | --- | --- |
| Product boundary, authority, service code, transaction ID and sponsor distinction | High | Monitor ICP route/lookup drift |
| Five-year validity, stay limits, first-entry window and public evidence rules | High | Recheck the service card before submission |
| Generic ICP beneficiary/address/passport model and static limits | High | Compare transaction-783 rendered controls |
| Transaction-783 visibility, requiredness and option codes | Medium | Authenticated UAE Pass capture |
| Official selectors, transforms and final submission behavior | Low | Authorized headed adapter recon |

This schema remains labelled **live portal QA required** until an authenticated
transaction-783 walkthrough has exercised every visible branch.

## 8. Verification workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-ae-tourist-visa-form-fields.ts

cd ../../viza-fe/internal-website
npm run qa:audit-schema-ui -- --visa-type=AE_TOURIST_VISA --strict
```

The seed is idempotent and deletes only `AE_TOURIST_VISA` rows before insert. A
successful database run must report equal inserted and defined counts.

## 9. Next product expansion

Only add a standard 30/60-day UAE tourist product after sponsor authorization,
its own exact portal audit, a separate canonical code, and a distinct document
and submission workflow. Do not widen `AE_TOURIST_VISA`.

**Maintainer:** Edward Zehua Zhang
