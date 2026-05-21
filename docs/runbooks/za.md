# South Africa eVisa runbook (AUTO-ZA-04)

> Last reviewed: 2026-05-08.

Production handoff for the ZA_TOURIST_E_VISA flow. Mirrors KH/LA/LK
shape — same queue / canary / SLA wiring, distinct portal selectors.

## Architecture pointers

| Component | File / location |
|---|---|
| Recon walker (Phase A, read-only) | [`src/za/form-recon.ts`](../../viza-be/submission-service/src/za/form-recon.ts) |
| Prefill runner (stops before pay) | [`src/za/runner.ts`](../../viza-be/submission-service/src/za/runner.ts) |
| Error catalog + classifier | [`src/za/errors.ts`](../../viza-be/submission-service/src/za/errors.ts) |
| Payment relay (escrow card) | [`src/za/payment.ts`](../../viza-be/submission-service/src/za/payment.ts) |
| Post-payment finalisation | [`src/za/finalize.ts`](../../viza-be/submission-service/src/za/finalize.ts) |
| Smoke test | [`scripts/za-smoke.ts`](../../viza-be/submission-service/scripts/za-smoke.ts) |

## Auto-enqueue, monitoring, env

Identical to KH (see [`kh.md`](./kh.md) for the long form):

- INFRA-002 producer in the Stripe webhook auto-enqueues runner_job
  rows with `country='south_africa'` once the agency fee clears.
- OPS-004 canary monitors `https://visa.vfsglobal.com/zaf/en/dha`
  hourly; status surfaces at `/admin/portal-health`.
- OPS-005 SLA seeded at median 120 h / p95 240 h (SA DHA is slow);
  back-fill cron flips to `source='measured'` after ≥5 samples.
- Concurrency cap seeded at 1 (`runner_concurrency_cap`) — VFS Global
  rate-limits aggressively per IP.

## Staging run procedure

Same gate as KH — 10 staging-mode runs ≥ 95% success before
production promotion. See [kh.md](./kh.md) §Staging run procedure
and replace the country slug.

## Common ZA-specific issues

| Symptom | Likely cause | Mitigation |
|---|---|---|
| anti_bot.cloudflare on landing | VFS Global Cloudflare gate | Wait + rotate proxy; failover to `needs_human`. |
| validation.passport_invalid | Applicant typo | Surface to applicant; refund path per PAY-004. |
| validation.nationality_unsupported | ZA eVisa pilot eligibility list (CN, IN, NG, …) | Refund + suggest VFS Visitor's Visa flow. |
| validation.payment_declined | Escrow card decline | Operator takeover (CS-003) + retry with backup card. |
| needs_human after pay | Receipt regex miss / portal selector drift. | Operator takeover (CS-003). |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — ZA = `runner_escrow_card`.
- [docs/runbooks/kh.md](./kh.md) — twin runbook with full procedure.
- [docs/runbooks/la.md](./la.md), [docs/runbooks/lk.md](./lk.md) — sibling Phase-3 countries.
