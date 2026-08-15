# Vietnam e-Visa runbook (AUTO-VN-04)

> Last reviewed: 2026-08-15.

Production handoff for VN_E_VISA flow.

## VIZA-managed payment lifecycle

| Stage | Status | Trigger |
|---|---|---|
| Runner prefills and captures registrationCode | `awaiting_government_payment` | `run.ts` reaches the official payment boundary and keeps the application in VIZA's managed workflow. |
| VIZA pays on evisa.gov.vn | `submitted_to_government` | The worker provisions an application-scoped virtual card from an authorized official-fee intent and records the portal result. |
| Email arrives with e-Visa PDF (~3 working days) | `delivered` | `waitForVietnamEvisa` + `persistVnDelivered`. |

VN uses the managed virtual-card path. Applicants never enter official-portal
card details. The runner issues the limited card only after an authorized
official-fee intent exists and the official payment page is ready; uncertain
provider or portal outcomes enter manual review instead of issuing another card.

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
| Official payment remains pending (3+ days) | Intent, issuing, or portal flow stalled | Inspect the official-fee intent and payment attempt; route uncertain outcomes to manual review. |
| PDF email arrives but payload is .htm not .pdf | Some sub-flows wrap PDF in HTML | Extractor fallback in `extractors/evisa-gov-vn`. |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — VN = `runner_escrow_card`.
- [docs/runbooks/](.) — sibling runbooks.
