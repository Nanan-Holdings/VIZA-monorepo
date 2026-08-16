# Türkiye Electronic Visa — Canonical Scope

**Schema version:** 2.0

**Status:** Official-source correction implemented; nationality-condition QA remains

**Verified:** 2026-08-16

## Product boundary

**VIZA visa type:** `TR_E_VISA`

**Official portal:** <https://evisa.gov.tr>

This package represents the Republic of Türkiye Ministry of Foreign Affairs
electronic visa for **tourism and trade**. It is one official product. The
applicant does not choose single or multiple entry, validity, permitted stay,
or fee: the official portal derives those values from travel-document country,
travel-document type, and intended arrival date.

Airport transit visa, sticker visas, work/student visas, residence permits,
and other consular products are outside `TR_E_VISA`.

## Canonical answer journey

1. **Eligibility**
   - Country/region of travel document
   - Travel-document type
   - Intended arrival date
2. **Personal information**
   - Given names
   - Surname (blank only when no surname appears in the document)
   - Date and place of birth
   - Mother's and father's names
3. **Travel document**
   - Document number
   - Issue and expiry dates
4. **Contact information**
   - Email
   - Telephone number
   - Residence address
5. **Supporting document**
   - None, visa, or residence permit
   - Conditional issuing-country control
   - Conditional expiry date

The supporting-document issuer options and official codes come directly from
the MFA group-file specification. A residence-permit expiry may be blank only
when the permit is indefinite.

## Derived official values

The following must not be collected as applicant choices:

- entry count
- visa validity
- permitted stay
- fee
- eligibility result

The official multiple-entry nationality list and all other eligibility data
must be maintained as source-derived policy metadata, not answer fields.

## Workflow-only controls

These are intentionally absent from `visa_form_fields`:

- CAPTCHA/security verification
- official email-verification link
- the 48-hour payment window
- payment-card details
- official application/session identifiers

The Türkiye e-Visa journey has no applicant file-upload field. Documents that
must be carried for travel are not uploads to this application form.

Family applications create separate applicant applications. They are not a
repeat group inside one applicant's answer schema.

## Sources

- [Live application](https://evisa.gov.tr/en/apply/)
- [Official pre-application guide](https://evisa.gov.tr/en/tour/)
- [Eligible countries](https://evisa.gov.tr/en/info/who-is-eligible-for-e-visa/)
- [Multiple-entry nationalities](https://evisa.gov.tr/en/info/can-i-obtain-multiple-entry-e-visa/)
- [Passport-validity requirement](https://evisa.gov.tr/en/info/what-do-i-need-for-e-visa-application/)
- [Supporting-document validity](https://www.evisa.gov.tr/en/info/what-are-the-criteria-for-the-validity-of-my-supporting-document-visa-or-residence-permit-from-schengen-or-oecd-member-countries/)
- [Official group-field specification](https://www.evisa.gov.tr/assets/files/guide_en.pdf)

## Evidence limits and next QA

The first eligibility screen was inspected live. The common applicant fields
and validations are documented by the official MFA group specification.
Continuation to the nationality-specific prerequisite screen requires a
CAPTCHA. No CAPTCHA was solved during the 2026-08-16 correction.

Before claiming complete live-portal parity, perform an authorized capture of
the nationality-specific prerequisite matrix and verify each conditional
declaration. Do not reintroduce generic tourist questions without official
field-level evidence.
