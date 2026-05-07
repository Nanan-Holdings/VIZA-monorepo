# VIZA Data Processing Agreement (DPA) — B2B clients

> **STATUS: draft — pending counsel review.** Engineering draft for
> corporate / B2B clients (corporate immigration, mobility teams)
> who engage VIZA to process visas on behalf of their employees.

**Parties:**
- **Controller:** the corporate client ("Customer").
- **Processor:** VIZA Pte. Ltd.

This DPA forms part of the Master Services Agreement ("MSA") between
the Customer and VIZA.

## 1. Definitions

Terms not defined here have the meanings given in the GDPR
(Regulation 2016/679), the UK GDPR, and equivalent local privacy
laws.

## 2. Subject matter and duration

VIZA processes Customer Personal Data solely to provide the visa
application service described in the MSA, for the duration of the MSA
plus any retention windows mandated by law.

## 3. Nature and purpose of processing

| Activity | Purpose |
|---|---|
| Form intake | Collect application data from end-applicants. |
| Translation / normalisation | Adapt data to each country's portal. |
| Submission | Submit to the destination country's government portal. |
| Inbox alias | Receive portal correspondence on behalf of the applicant. |
| Payment processing | Collect agency / government fees through Stripe. |

## 4. Categories of data subjects and PII

- **Data subjects:** Customer's employees and accompanying family
  members for whom Customer requests visa services.
- **PII categories:** as described in the Privacy Policy §2.

## 5. Customer instructions

VIZA processes PII only on documented instructions from the Customer,
which include the MSA, this DPA, and the application data submitted
through the platform. VIZA notifies Customer if VIZA believes an
instruction violates applicable law.

## 6. VIZA obligations

- Confidentiality: VIZA staff who access Customer PII are bound by
  written confidentiality obligations.
- Security measures: see Privacy Policy §10. VIZA maintains
  organisational and technical measures appropriate to the risk
  including encryption at rest and in transit, role-based access,
  per-applicant credential vault, audit logging, and pre-commit
  secret scanning.
- Breach notification: VIZA notifies Customer **without undue delay
  and no later than 48 hours** after becoming aware of a personal-data
  breach affecting Customer PII. Notification includes the breach
  scope, affected data subjects, mitigation taken, and a contact
  point for further information.
- Assistance with DSARs: VIZA assists Customer in responding to data
  subject requests at no additional charge for reasonable volumes.

## 7. Subprocessors

Customer authorises the subprocessors listed in
[`subprocessors.md`](./subprocessors.md). VIZA notifies Customer at
least 30 days before adding a subprocessor and offers Customer the
opportunity to object on reasonable, documented grounds.

## 8. International transfers

Where Customer PII is transferred outside the EEA / UK, the parties
incorporate the relevant Standard Contractual Clauses (Module 2:
Controller-to-Processor) by reference, with the technical and
organisational measures set out in Privacy Policy §10 applying as the
Annex II measures.

## 9. Data subject rights

VIZA passes data-subject requests received directly to the Customer
within 5 business days. VIZA does not respond on Customer's behalf
unless instructed in writing.

## 10. Audit

Customer may, no more than once per twelve-month period and at
Customer's expense, audit VIZA's compliance with this DPA. VIZA may
satisfy this obligation by providing then-current third-party audit
reports (SOC 2 Type II / ISO 27001) where available. Customer must
provide at least 30 days' notice and keep audit findings confidential.

## 11. Return / deletion

On termination of the MSA, VIZA returns or deletes Customer PII at
Customer's option within 90 days, except where retention is legally
required.

## 12. Liability

Liability under this DPA is governed by the limitation-of-liability
clause in the MSA.

## 13. Governing law

This DPA is governed by the law of Singapore unless the MSA specifies
otherwise.

---

_Counsel TODO: align §6 breach window with GDPR Art. 33's "without
undue delay … 72 hours" target as a Customer-facing commitment, and
consider an explicit Annex I (description of processing) and Annex II
(security measures) per the EDPB SCC template._
