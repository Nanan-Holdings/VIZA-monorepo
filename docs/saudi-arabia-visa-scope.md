# Saudi Arabia Tourist eVisa — Canonical Scope

**Schema version:** 1.0

**Status:** Official-source reconstruction; authenticated live-portal QA required

**Last audited:** 2026-08-16

**VIZA visa type:** `SA_E_VISA`

## 1. Product boundary

`SA_E_VISA` means only the Saudi Ministry of Tourism tourist eVisa offered at
[VisitSaudi](https://visa.visitsaudi.com/). It does not represent every product
advertised by KSA Visa.

The tourist eVisa is generally valid for one year, is usually multiple entry,
and permits stays of up to 90 days. Permitted activities include tourism,
events, leisure, visiting family or relatives, and Umrah outside the Hajj
season. Work and study are not permitted.

The following require separate products and schemas:

- Hajj visas and Hajj permits
- employment/work visas
- study visas
- business/work-visit products outside the tourist eVisa's permitted activity
- sponsor-issued family, personal, transit, and other visit products
- products exposed only through the broader KSA Visa catalogue

The eVisa supports regular passports only. The passport must normally remain
valid for at least six months at entry. The adult creating an application must
be at least 18; an authorized adult may create a linked application for a
minor.

## 2. Eligibility routing

Package assignment must use the nationality list returned by the live
VisitSaudi registration dropdown, not a hard-coded marketing claim.

The live public dropdown captured on 2026-08-16 differed from the 66-country
marketing/terms presentation: the application UI separately represented Hong
Kong, Macau, and Taiwan, while Brazil and Russia appeared in public copy but
not in the captured registration dropdown. This is portal drift, not a reason
to merge a different Saudi visa product into `SA_E_VISA`.

Before every submission adapter run, VIZA must reconfirm that the applicant's
stored nationality remains selectable in the live eligibility gate.

## 3. Canonical applicant journey

The seed at
`viza-be/agent-backend/scripts/seed-sa-e-visa-form-fields.ts` contains four
applicant-facing steps:

1. **Applicant information**
   - nationality
   - given, father, and family names
   - gender, birth date, country and city of birth
   - religion, marital status, and profession
   - minor/guardian branch
2. **Passport**
   - passport number, issuing country and place
   - issue and expiry dates
   - regular-passport product constraint stored as metadata
3. **Contact and residence**
   - country, city, postal code, and address
   - correspondence email and phone
   - conditional alternate WhatsApp number
4. **Visit and accommodation**
   - visit purpose
   - one two-choice accommodation control
   - one conditional panel for the active private-residence or hotel branch

The official English and Arabic name controls are represented as synchronized
official-value pairs. VIZA shows only the selected interface language during
entry and preserves both values internally for transfer and final bilingual
review. Grandfather-name controls found only as commented-out client-template
code are not part of the schema.

Group applications are application-level workflow. VIZA creates a separate
applicant record for each traveller and links a minor to the guardian; it does
not repeat multiple people inside one answer group.

## 4. Document boundary

Files never belong in `visa_form_fields`. The seed references these Document
Center slots only as metadata:

| Document slot | Rule |
| --- | --- |
| `personal_photo` | Required; official specification is 200×200, 5–100 KB, white background, and current (normally within six months) |
| `passport_bio_page` | Required for identity and official transfer |

The live client currently accepts several image encodings before its own crop
and face validation. That upload implementation detail must not become a text
or file answer field.

## 5. Workflow-only controls

The following must never appear as applicant answers:

- official account registration or activation
- email confirmation, password, secret question, or secret answer
- login state, lockout state, cookie, or session identifiers
- CAPTCHA values or CAPTCHA images
- integrated insurance selection or purchase state
- official-fee payment data, payment-card data, or receipt state
- photo crop, face-detection output, or derived map coordinates

VIZA owns account/session management and official payment workflow. Applicant
email and telephone fields in the schema are correspondence/contact data, not
official-portal credentials.

## 6. Evidence and live-portal QA

Primary sources:

- [VisitSaudi eVisa portal](https://visa.visitsaudi.com/)
- [VisitSaudi terms and conditions](https://visa.visitsaudi.com/Home/TermsConditions)
- [VisitSaudi registration eligibility gate](https://visa.visitsaudi.com/Registration/Verify)
- [VisitSaudi photo specification](https://visa.visitsaudi.com/Home/PhotoSpecifications)
- VisitSaudi authenticated-application client templates served by the official portal
- [KSA Visa tourism overview](https://ksavisa.sa/visa/tourism/details), used only as an official overview/router

Confidence by area:

| Area | Confidence | Remaining work |
| --- | --- | --- |
| Product boundary, validity, stay, passport and age rules | High | Recheck official terms for drift |
| Public eligibility gate and nationality values | High at capture date | Re-capture before launch/submission |
| Confirmed client-template field names | High | Compare against an activated application |
| Religion, marital status, profession, purpose, guardian-relation and city lookup options/codes | Medium | Authenticated live capture required |
| Authenticated requiredness and exact validation | Medium | Exercise every branch in headed QA |
| Submission selectors and transfer transforms | Low | Build only after authorized adapter recon |

Every field whose lookup options or requiredness remain authentication-gated
has `live_portal_qa_required: true` and a targeted QA note in validation
metadata. Do not replace those lookups with invented static options.

## 7. Verification workflow

```bash
cd viza-be/agent-backend
npx tsx scripts/seed-sa-e-visa-form-fields.ts

cd ../../viza-fe/internal-website
npm run qa:audit-schema-ui -- --visa-type=SA_E_VISA --strict
```

A successful database seed must print equal inserted and defined counts. Before
production launch, use an activated VIZA-managed alias account to capture every
authenticated option, required flag, label, branch, and transfer code. Do not
create or expose an official account credential in the answer schema.

## 8. Next products

Future Saudi products must receive separate codes, scope documents, schemas,
eligibility routing, and official-source audits. `SA_E_VISA` must not grow into
a generic KSA Visa umbrella.

**Maintainer:** Edward Zehua Zhang
