# EU / EEA — GDPR

> **Status:** largely compliant. Standard Contractual Clauses with
> sub-processors need to be filed and the controller representative
> appointment is open.

## Applicability

- VIZA is established in Singapore and offers visa services to EU/EEA
  residents (Schengen C short-stay through France-Visas, Italy-VFS-CN,
  ultimately on behalf of any Schengen state). GDPR Art. 3(2)(a)
  applies (offering services to data subjects in the Union).
- Most data subjects are EU residents applying for a visa to a
  non-EU destination, but a meaningful subset are EU residents whose
  data we collect during the application flow.

## Key obligations

| Obligation | VIZA posture |
|---|---|
| Lawful basis (Art. 6) | Contract performance for the visa application; consent for any non-essential processing. Captured in `consent_event`. |
| Data subject rights (Arts. 15–21) | Export + deletion endpoints (LEGAL-004); rectification through profile UI. |
| Records of processing (Art. 30) | This file + `subprocessors.md`. |
| DPIA (Art. 35) | Required at scale: counsel TODO before public launch. |
| International transfers (Arts. 44–49) | SCC Module 2 with subprocessors. **Open:** filed copies missing. |
| Breach notification (Arts. 33–34) | 72h supervisory authority + affected data subjects. Privacy Policy §10 commits; runbook TBD. |
| EU representative (Art. 27) | **Required.** Counsel TODO: appoint a representative in an EU member state. |

## Gaps

- Article 27 representative.
- DPIA template + per-flow assessments.
- Filed SCC paperwork for each subprocessor.
