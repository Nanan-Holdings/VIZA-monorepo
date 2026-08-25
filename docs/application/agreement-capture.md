# Application Agreement Capture

Every required checkbox that represents a declaration, certification, consent,
undertaking, acknowledgement, authorisation, or agreement is treated as an
application agreement. Ordinary boolean controls (for example, “same as home
address”) and checkbox lists are not agreements.

## Applicant flow

1. The checkbox renders a **View agreement** / **查看声明** link.
2. The link opens `/client/application/agreements/:visaType/:fieldName`, which
   displays the exact statement currently rendered by VIZA and, when known,
   the official source.
3. On acceptance, the trusted answer-save action writes the answer and an
   immutable copy of the statement into `application_agreement_acceptances`.
   The record includes the source metadata, version, and acceptance time.
4. If a user later unchecks the item, the record is retained and marked
   revoked. Changed text creates a new fingerprinted record; it never rewrites
   an earlier accepted statement.

The audit table is service-role-only. Applicants can read the statement page,
but cannot write or alter acceptance evidence directly.

## Source recrawl status

The current public-source recrawl directly verified these live declaration
surfaces and links them from the agreement page:

- Singapore SG Arrival Card declaration — [ICA SGAC e-service labels](https://eservices.ica.gov.sg/sgac-services/common/code/toggleLang?lang=EN).
- India e-Visa declaration — [Government of India sample e-Visa form](https://www.indianvisaonline.gov.in/evisa/images/SampleForm.pdf).
- Vietnam e-Visa declaration — [Vietnam Immigration e-Visa application](https://evisa.xuatnhapcanh.gov.vn/en_US/khai-thi-thuc-dien-tu/cap-thi-thuc-dien-tu?type=edit).
- Canada TRV family/application certifications — [IRCC IMM 5707 instructions](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5707.html) and [visitor-visa guide](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/guide-5256-applying-visitor-visa-temporary-resident-visa.html).
- New Zealand visitor declaration — [INZ 1224](https://www.immigration.govt.nz/assets/inz/documents/forms-and-guides/Visitor-Visa-Declaration-Form-INZ-1224.pdf).
- Malaysia e-Visa — [MYVISA terms and conditions](https://malaysiavisa.imi.gov.my/terms-and-conditions).
- Korea e-Arrival Card — [official agreement policy](https://www.e-arrivalcard.go.kr/portal/apply/agreementPolicy.do).

Several government portals expose their final declaration only after login or
an application-specific session. For those schemas, VIZA preserves the
currently rendered statement as a versioned schema statement and does not
claim unverified wording is a fresh official recrawl. Replace it only after a
permitted, stop-before-submit official capture.
