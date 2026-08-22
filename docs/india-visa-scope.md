# India e-Tourist Visa — Canonical Scope

**Schema version:** 2.0

**Status:** Official-source tourist-only correction implemented

**Verified:** 2026-08-16

## Product boundary and compatibility key

**VIZA visa type:** `IN_E_VISA`

**Official portal:** <https://indianvisaonline.gov.in/evisa/>

`IN_E_VISA` is retained as a compatibility code because existing application
rows and payment/submission integrations reference it. From schema version 2,
the code represents only the standard India **e-Tourist Visa (e-T1 V)**:

- 30-day e-Tourist Visa
- 1-year e-Tourist Visa
- 5-year e-Tourist Visa

Business, medical, medical-attendant, conference, transit, student, family,
production-investment, and miscellaneous e-Visas are separate products and
must not add branches to this schema. Mountaineering/trekking uses e-T2 V and
also requires a separate future product.

## Supported tourist purposes

All three e-T1 validity variants support:

- tourism, recreation, or sightseeing
- meeting friends or relatives
- a short-term yoga programme
- a short course of no more than six months that issues no qualification
- unpaid voluntary work of no more than one month

The seed records the live official service and purpose IDs in validation
metadata for eventual official submission mapping.

## Canonical answer journey

1. **Registration and eligibility**
   - Nationality/region
   - Ordinary passport type
   - Port of arrival
   - Date of birth and email
   - e-Tourist validity and purpose
   - Expected arrival date
2. **Applicant and passport details**
   - Passport names and previous-name branch
   - Gender, birth place, national ID, religion, identification marks, and education
   - Nationality-acquisition method and two-year residence declaration
   - Passport details
   - Conditional other valid passport/identity-certificate group
3. **Address and family details**
   - Present address and contact numbers
   - Same-as-present permanent-address branch
   - Father's and mother's identity/nationality/birth details
   - Marital status
   - Pakistan parent/grandparent history and conditional details
4. **Visa, travel history, and references**
   - Places to visit, tour-operator booking answer, and expected exit port
   - Previous-India-visit and previous-visa branch
   - Previous permission-refusal branch
   - Countries visited in the last ten years
   - Repeatable SAARC visit group: country, year, number of visits
   - Reference in India and reference in the applicant's home country
5. **Additional questions and declaration**
   - Six separate official background/security questions
   - A details panel for every affirmative answer
   - Final truthfulness/deportation/blacklisting declaration

The live port option values are preserved from the official registration page
snapshot dated 2026-08-16. They must be refreshed from the official source
when the portal changes.

## Documents outside the answer schema

Uploads belong to `application_documents`, never `visa_form_fields`:

| Document slot | Rule |
|---|---|
| Applicant photograph | JPEG, 10 KB–1 MB, square, at least 350×350 |
| Passport bio page | PDF, 10–300 KB |
| Short-course letter | Required only for the short-course purpose |
| Voluntary-work letter | Required only for the voluntary-work purpose |

The mountaineering clearance document belongs to the separate e-T2 product.

## Workflow-only controls

These are intentionally absent from `visa_form_fields`:

- CAPTCHA
- duplicate-email confirmation
- temporary application ID and resume credentials
- photo/document upload controls
- verification/review screen state
- payment and payment-card details
- official application/session identifiers

## Eligibility boundary

The product is unavailable to Pakistani passport holders and applicants whose
parents or grandparents were born in, or permanently resident in, Pakistan.
It is also unavailable to diplomatic/official passport holders,
laissez-passer or other non-passport travel-document holders, and applicants
with a serving or retired defence, military, security, or police background.
Those applicants must use the regular visa route.

An eligible passport must have at least six months' validity and two blank
pages. The traveller must hold return/onward travel and sufficient funds.

## Sources

- [Live registration form](https://indianvisaonline.gov.in/evisa/Registration)
- [Official sample e-Visa application](https://indianvisaonline.gov.in/evisa/images/SampleForm.pdf)
- [Official e-Visa instructions](https://indianvisaonline.gov.in/evisa/)
- [Country-specific e-Tourist fees](https://indianvisaonline.gov.in/evisa/images/Etourist_fee_final.pdf)

## Evidence limits and next QA

The registration HTML and current eight-page sample form provide high-confidence
public fields. CAPTCHA prevented a live continuation using an actual temporary
application. Fields hidden by marital-status and tour-operator answers remain
out of the schema until an authorized live branch capture provides exact labels,
requiredness, options, and ordering.

Do not restore generic occupation, employer, carrier, accommodation, expense,
host-ID, business, medical, or conference fields without official e-Tourist
field-level evidence.
