# Paper-channel staff hand-delivery runbook

> Last reviewed: 2026-05-08.

For applicants whose visa requires a physical consular submission
(JP / KR / SG / HK / MO / PH-9a / CA-TRV stub).

## Daily flow

1. **Queue review (09:00 local)** — staff opens `/admin/paper-channel`
   showing all `applications.status='staff-action-required'`. Sort
   by intended_arrival_date asc.
2. **Print packet** — click "Render PDF" (calls `renderPaperPdf` →
   loads `paper_template` → fills with `visa_application_answers` →
   uploads to `jobs/<jobId>/paper-<key>.pdf`). Staff downloads + prints
   on A4.
3. **Photo + passport** — applicant photo + passport scan are pulled
   from `applicant_documents`; staff verifies sizing per country
   (35×45mm or 45×45mm — see template footer).
4. **Sign + courier** — applicant has been required to sign their
   declaration during onboarding (capture stored as image attachment
   in `legal_consent_capture`). Staff prints the signature block,
   not the original — sign in person at the consulate.
5. **Consulate submission** — courier or in-person hand-off. Staff
   logs the consulate receipt # on the application and flips status
   to `submitted_to_government`.
6. **Decision back** — when the consulate returns the passport with
   visa, staff scans + uploads + flips to `delivered`.

## SLA expectations

| Country | Median (days) | p95 (days) |
|---|---|---|
| JP | 7 | 21 |
| KR | 5 | 14 |
| SG | 5 | 14 |
| HK | 7 | 21 |
| MO | 5 | 14 |
| PH (9a) | 14 | 45 |
| CA-TRV | 21 | 90 |

## Common issues

| Symptom | Mitigation |
|---|---|
| Photo wrong size | Re-collect via applicant portal (auto-cropped). |
| Signature illegible | Staff requests fresh signature scan via CS-003 ticket. |
| Consulate returns "incomplete" | Flag in `application_documents` with `kind=consular_rejection_notice`; CS-003 ticket. |

## Linked from

- [docs/launch/paper.md](../launch/paper.md) — paper-cohort launch gate.
