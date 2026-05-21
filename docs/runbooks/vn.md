# Vietnam e-Visa runbook (AUTO-VN-04)

> Last reviewed: 2026-05-08.

Production handoff for VN_E_VISA flow.

## Hand-off lifecycle (PAY-003 = applicant_direct_link)

| Stage | Status | Trigger |
|---|---|---|
| Runner prefills, captures registrationCode | `awaiting_government_payment` | `run.ts` halts before Pay/Submit; surfaces code to applicant. |
| Applicant pays on evisa.gov.vn | `submitted_to_government` | Applicant action; we don't observe directly. |
| Email arrives with e-Visa PDF (~3 working days) | `delivered` | `waitForVietnamEvisa` + `persistVnDelivered`. |

VN does NOT use the runner-escrow-card mechanism — applicants pay
directly on the government portal because chargeback risk to our
escrow card was high during the 2026-Q1 pilot. The runner stops at
the captured registrationCode and the applicant takes over.

## Architecture pointers

| Component | File / location |
|---|---|
| Recon walker | [`src/vietnam/form-recon.ts`](../../viza-be/submission-service/src/vietnam/form-recon.ts) |
| Field mappings | [`src/vietnam/field-mappings.ts`](../../viza-be/submission-service/src/vietnam/field-mappings.ts) |
| Prefill runner | [`src/vietnam/run.ts`](../../viza-be/submission-service/src/vietnam/run.ts) |
| Error catalog | [`src/vietnam/errors.ts`](../../viza-be/submission-service/src/vietnam/errors.ts) |
| Inbox helpers | [`src/vietnam/inbox.ts`](../../viza-be/submission-service/src/vietnam/inbox.ts) |
| Government-fee shared payment helpers | [`src/vietnam/govt-payment.ts`](../../viza-be/submission-service/src/vietnam/govt-payment.ts) |
| PDF capture + finalisation | [`src/vietnam/finalize.ts`](../../viza-be/submission-service/src/vietnam/finalize.ts) |

Note: `govt-payment.ts` exports `loadEscrowCard` + `recordPortalReceipt`
+ `recordPortalDecline` — those are shared utilities consumed by the
KH/LA/LK/ZA/IN/AU runners, NOT used by the VN flow itself.

## Auto-enqueue, monitoring, env

- INFRA-002 producer in the Stripe webhook auto-enqueues runner_job
  rows with `country='vietnam'` once the agency fee clears.
- OPS-004 canary monitors `https://evisa.gov.vn/` hourly; status
  surfaces at `/admin/portal-health`.
- OPS-005 SLA seeded at median 72 h / p95 168 h (3 working days +
  buffer); back-fill cron flips to `source='measured'` after ≥5
  samples.
- Concurrency cap seeded at 3.

## Common VN-specific issues

| Symptom | Likely cause | Mitigation |
|---|---|---|
| vn.validation.captcha_required | Portal captcha challenge | Operator takeover (CS-003); rotate proxy. |
| vn.anti_bot.cloudflare on landing | Portal Cloudflare gate | Wait + rotate proxy. |
| Applicant ignores payment link (3+ days) | Reminders not sent | Reminder cron + email + SMS escalation. |
| PDF email arrives but payload is .htm not .pdf | Some sub-flows wrap PDF in HTML | Extractor fallback in `extractors/evisa-gov-vn`. |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — VN = `applicant_direct_link`.
- [docs/runbooks/](.) — sibling runbooks.
