# Laos e-Visa runbook (AUTO-LA-04)

> Last reviewed: 2026-05-08.

Production handoff for the LA_TOURIST_E_VISA flow. Mirrors the KH
shape — same queue / canary / SLA wiring, distinct portal selectors.

## Architecture pointers

| Component | File / location |
|---|---|
| Recon walker (Phase A, read-only) | [`src/la/form-recon.ts`](../../viza-be/submission-service/src/la/form-recon.ts) |
| Prefill runner (stops before pay) | [`src/la/runner.ts`](../../viza-be/submission-service/src/la/runner.ts) |
| Error catalog + classifier | [`src/la/errors.ts`](../../viza-be/submission-service/src/la/errors.ts) |
| Payment relay (escrow card) | [`src/la/payment.ts`](../../viza-be/submission-service/src/la/payment.ts) |
| Post-payment finalisation | [`src/la/finalize.ts`](../../viza-be/submission-service/src/la/finalize.ts) |
| Smoke test | [`scripts/la-smoke.ts`](../../viza-be/submission-service/scripts/la-smoke.ts) |

## Auto-enqueue, monitoring, env

Identical to KH (see [`kh.md`](./kh.md) for the long form):

- INFRA-002 producer in the Stripe webhook auto-enqueues runner_job
  rows with `country='laos'` once the agency fee clears.
- OPS-004 canary monitors `https://laoevisa.gov.la/` hourly; status
  surfaces at `/admin/portal-health`.
- OPS-005 SLA seeded at median 72 h / p95 168 h; back-fill cron
  flips to `source='measured'` after ≥5 samples.
- Concurrency cap seeded at 2 (`runner_concurrency_cap`).

## Staging run procedure

Same gate as KH — 10 staging-mode runs ≥ 95% success before
production promotion. See [kh.md](./kh.md) §Staging run procedure
and replace the country slug.

## Common LA-specific issues

| Symptom | Likely cause | Mitigation |
|---|---|---|
| anti_bot_gate on landing | LA portal Cloudflare | Wait + rotate proxy. |
| validation.passport_invalid | Applicant typo | Surface to applicant; refund path per PAY-004. |
| validation.nationality_unsupported | LA e-Visa eligibility list. | Refund + suggest visa-on-arrival. |
| needs_human after pay | Receipt regex miss / portal selector drift. | Operator takeover (CS-003). |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — LA = `runner_escrow_card`.
- [docs/runbooks/kh.md](./kh.md) — twin runbook with full procedure.
