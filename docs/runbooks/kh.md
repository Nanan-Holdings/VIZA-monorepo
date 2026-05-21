# Cambodia e-Visa runbook (AUTO-KH-04)

> Last reviewed: 2026-05-08.

Production handoff documentation for the KH_TOURIST_E_VISA flow.

## Architecture pointers

| Component | File / location |
|---|---|
| Recon walker (Phase A, read-only) | [`src/kh/form-recon.ts`](../../viza-be/submission-service/src/kh/form-recon.ts) |
| Prefill runner (stops before pay) | [`src/kh/runner.ts`](../../viza-be/submission-service/src/kh/runner.ts) |
| Error catalog + classifier | [`src/kh/errors.ts`](../../viza-be/submission-service/src/kh/errors.ts) |
| Payment relay (escrow card, PAY-003 mechanism) | [`src/kh/payment.ts`](../../viza-be/submission-service/src/kh/payment.ts) |
| Post-payment finalisation | [`src/kh/finalize.ts`](../../viza-be/submission-service/src/kh/finalize.ts) |
| Smoke test | [`scripts/kh-smoke.ts`](../../viza-be/submission-service/scripts/kh-smoke.ts) |
| Inbox extractor profile (none — KH has no OTP) | n/a |

## Auto-enqueue

INFRA-002 already wires the producer: when an order flips to `paid`
the Stripe webhook handler calls `enqueueRunnerJob(applicationId,
country='cambodia')`. The queue worker
([`src/queue/worker.ts`](../../viza-be/submission-service/src/queue/worker.ts))
claims the row when its country matches and runs the KH orchestrator.

No KH-specific queue wiring is needed beyond the country-aware
worker; the autoscaler (INFRA-003) reads `runner_concurrency_cap`
which seeds KH at `max_concurrent=2`.

## Monitoring

- **Portal canary**: OPS-004 hourly canary
  ([`scripts/canary.ts`](../../viza-be/agent-backend/scripts/canary.ts))
  hits `https://www.evisa.gov.kh` with 15-second timeout. Status
  surfaces at `/admin/portal-health` and an OPS alert
  (`portal.health.cambodia`) fires when degraded / down.
- **Per-job alert**: failure on max_attempts → OPS-003 alert class
  `runner.failed.cambodia`. Escalated to operator takeover when
  the error catalog disposition is `human` (CS-003).
- **SLA**: median 72 h / p95 168 h seeded in `package_sla`. Breach
  sweeper ([`scripts/sla-breach-sweep.ts`](../../viza-be/agent-backend/scripts/sla-breach-sweep.ts))
  fires `sla.breach.cambodia` when an active job exceeds p95.

## Required env

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — DB / Storage.
- `BRIGHTDATA_*` — proxy egress (overridden to in-country VN
  geography via INFRA-004 country-overrides for VN, KH uses
  default applicant geography).
- `SUBMISSION_RESULT_SECRET_KEY` — vault decryption.
- The KH escrow card lives in the per-applicant vault under
  `viza.escrow.card.{pan,expiry,cvv}`. Seed via
  `scripts/rotate-applicant-secret.ts`.

## Staging run procedure (10 applications)

Acceptance gate: 10 staging-mode applications submitted end-to-end
without manual intervention.

1. Provision 10 test applicants via
   `scripts/seed-test-ds160-applicant.ts` (extend with KH variant
   when ready) — each gets a fresh inbox alias and a vault entry
   for the escrow card.
2. For each test applicant, hit `/client/application` and complete
   the KH_TOURIST_E_VISA form with synthetic answers.
3. Pay via Stripe Test (use card `4242 4242 4242 4242`).
4. Watch `/admin/applications` — every row should hit
   `submitted` within ~10 minutes. Failures surface in the runner
   job timeline at `/admin/jobs/<id>`.
5. Tally success rate at `/admin/metrics` — KH should report
   `100% / 10` for the active week before promotion.
6. If the runner stalls or escalates to needs_human on more than 2
   of 10, **do not promote**. Land selector fixes via
   `src/kh/runner.ts` and re-run the gate.

## Production promotion checklist

- [ ] 10 staging runs ≥ 95% success.
- [ ] Portal canary green for 7 consecutive days.
- [ ] `runner_concurrency_cap.max_concurrent` confirmed at 2.
- [ ] Escrow card vault rows seeded for the production applicant
      pool (or vault-write hook tied to first paid order).
- [ ] OPS-005 SLA seed numbers (72 h / 168 h) reviewed against
      observed staging data; back-fill cron will replace them
      automatically once 5+ samples land.
- [ ] This runbook reviewed + dated.

## Common KH-specific issues

| Symptom | Likely cause | Mitigation |
|---|---|---|
| anti_bot_gate on landing | Cloudflare interstitial | Wait 30 min, retry; rotate proxy IP. |
| validation.passport_invalid | Applicant mistyped passport — fail terminal. | Surface to applicant via `/client/applications/[id]`. |
| validation.nationality_unsupported | Country not on KH e-Visa eligibility list. | Refund agency fee per PAY-004; suggest consular. |
| needs_human after pay | Receipt not surfaced or selector drift on success page. | Operator takeover (CS-003). |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — KH = `runner_escrow_card`.
- [docs/ops/alerting.md](../ops/alerting.md) — alert classes.
- [docs/runbooks/runner-job-stuck.md](./runner-job-stuck.md) — generic stuck-job recovery.
