# UK Standard Visitor visa runbook (AUTO-UK-04)

> Last reviewed: 2026-05-08.

Production handoff for the UK_STANDARD_VISITOR flow. The UK flow
differs from the eVisa cohort in two important ways:

1. **Two-step delivery.** The online portal terminates with a GWF
   reference + biometrics-appointment slot — the actual visa is
   issued at the VAC after biometrics. So `persistUkSubmitted`
   flips status to `submitted_to_government` (not `delivered`); the
   `delivered` transition happens after the appointment.
2. **Worldpay payment.** The portal embeds a Worldpay-hosted iframe;
   `payUkWithEscrowCard` fills the same generic selectors but the
   receipt regex includes a GWF-prefixed alternative.

## Architecture pointers

| Component | File / location |
|---|---|
| Recon walker (Phase A, read-only) | [`src/uk/form-recon.ts`](../../viza-be/submission-service/src/uk/form-recon.ts) |
| Session bootstrap | [`src/uk/session.ts`](../../viza-be/submission-service/src/uk/session.ts) |
| Page identity + gates | [`src/uk/pages.ts`](../../viza-be/submission-service/src/uk/pages.ts), [`src/uk/gates.ts`](../../viza-be/submission-service/src/uk/gates.ts) |
| Field widget fillers | [`src/uk/widgets.ts`](../../viza-be/submission-service/src/uk/widgets.ts), [`src/uk/field-mappings.ts`](../../viza-be/submission-service/src/uk/field-mappings.ts) |
| Orchestrator (multi-page driver) | [`src/uk/orchestrator.ts`](../../viza-be/submission-service/src/uk/orchestrator.ts) |
| Resumable runs | [`src/uk/resume.ts`](../../viza-be/submission-service/src/uk/resume.ts) |
| Error catalog + structured errors | [`src/uk/errors.ts`](../../viza-be/submission-service/src/uk/errors.ts) |
| Inbox helpers | [`src/uk/inbox.ts`](../../viza-be/submission-service/src/uk/inbox.ts) |
| Payment relay (Worldpay escrow card) | [`src/uk/payment.ts`](../../viza-be/submission-service/src/uk/payment.ts) |
| Post-payment finalisation | [`src/uk/finalize.ts`](../../viza-be/submission-service/src/uk/finalize.ts) |
| Smoke test | [`scripts/walk-uk-portal.ts`](../../viza-be/submission-service/scripts/walk-uk-portal.ts) |

## Auto-enqueue, monitoring, env

- INFRA-002 producer in the Stripe webhook auto-enqueues runner_job
  rows with `country='united_kingdom'` once the agency fee clears.
- OPS-004 canary monitors `https://www.gov.uk/standard-visitor`
  hourly; status surfaces at `/admin/portal-health`.
- OPS-005 SLA seeded at median 21 d / p95 60 d (UKVI processing
  band); back-fill cron flips to `source='measured'` after ≥5
  samples.
- Concurrency cap seeded at 1 because UKVI registration is
  email-OTP-gated per session.

## Two-step lifecycle

| Stage | Status | Trigger |
|---|---|---|
| Form filled, payment paid | `submitted_to_government` | `persistUkSubmitted` after `payUkWithEscrowCard`. |
| Biometrics appointment booked | `awaiting_biometrics` | TLS Contact / VFS Global confirmation (separate flow). |
| Vignette issued / decision sent | `delivered` | Email parser hits VFS + GWF receipt notice. |

## Common UK-specific issues

| Symptom | Likely cause | Mitigation |
|---|---|---|
| Stealth session → bot challenge | Session bootstrap miss | `session.ts` handles cookies; rotate proxy + warm session. |
| validation: passport country mismatch | UKVI cross-checks with passport scan. | Re-collect passport scan; cancel + refund per PAY-004. |
| Worldpay 3DS challenge | Issuer SCA | Operator takeover for OTP entry (CS-003). |
| Biometrics slot exhausted | VAC capacity | Surface alternative VAC; allow city change. |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — UK = `runner_escrow_card`.
- [docs/runbooks/](.) — sibling runbooks (KH/LA/LK/ZA/IN).
