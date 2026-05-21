# Sri Lanka ETA runbook (AUTO-LK-04)

> Last reviewed: 2026-05-08.

Production handoff for the LK_TOURIST_ETA flow. Mirrors the KH/LA
shape — same queue / canary / SLA wiring, distinct portal selectors.

## Architecture pointers

| Component | File / location |
|---|---|
| Recon walker (Phase A, read-only) | [`src/lk/form-recon.ts`](../../viza-be/submission-service/src/lk/form-recon.ts) |
| Prefill runner (stops before pay) | [`src/lk/runner.ts`](../../viza-be/submission-service/src/lk/runner.ts) |
| Error catalog + classifier | [`src/lk/errors.ts`](../../viza-be/submission-service/src/lk/errors.ts) |
| Payment relay (escrow card) | [`src/lk/payment.ts`](../../viza-be/submission-service/src/lk/payment.ts) |
| Post-payment finalisation | [`src/lk/finalize.ts`](../../viza-be/submission-service/src/lk/finalize.ts) |
| Smoke test | [`scripts/lk-smoke.ts`](../../viza-be/submission-service/scripts/lk-smoke.ts) |

## Auto-enqueue, monitoring, env

Identical to KH (see [`kh.md`](./kh.md) for the long form):

- INFRA-002 producer in the Stripe webhook auto-enqueues runner_job
  rows with `country='sri_lanka'` once the agency fee clears.
- OPS-004 canary monitors `https://eta.gov.lk/` hourly; status
  surfaces at `/admin/portal-health`.
- OPS-005 SLA seeded at median 24 h / p95 96 h; back-fill cron
  flips to `source='measured'` after ≥5 samples.
- Concurrency cap seeded at 2 (`runner_concurrency_cap`).

## Staging run procedure

Same gate as KH — 10 staging-mode runs ≥ 95% success before
production promotion. See [kh.md](./kh.md) §Staging run procedure
and replace the country slug.

## Common LK-specific issues

| Symptom | Likely cause | Mitigation |
|---|---|---|
| anti_bot.cloudflare on landing | LK portal Cloudflare gate | Wait + rotate proxy; failover to `needs_human`. |
| validation.passport_invalid | Applicant typo | Surface to applicant; refund path per PAY-004. |
| validation.nationality_unsupported | LK ETA eligibility list. | Refund + suggest visa-on-arrival. |
| validation.payment_declined | Escrow card decline | Operator takeover (CS-003) + retry with backup card. |
| needs_human after pay | Receipt regex miss / portal selector drift. | Operator takeover (CS-003). |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — LK = `runner_escrow_card`.
- [docs/runbooks/kh.md](./kh.md) — twin runbook with full procedure.
- [docs/runbooks/la.md](./la.md) — sibling Phase-3 country.
