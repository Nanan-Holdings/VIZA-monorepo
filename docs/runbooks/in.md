# India e-Visa runbook (AUTO-IN-04)

> Last reviewed: 2026-05-08.

Production handoff for the IN_TOURIST_E_VISA flow. Mirrors KH/LA/LK/ZA
shape — same queue / canary / SLA wiring, distinct portal selectors.

## Architecture pointers

| Component | File / location |
|---|---|
| Recon walker (Phase A, read-only) | [`src/in/form-recon.ts`](../../viza-be/submission-service/src/in/form-recon.ts) |
| Prefill runner (stops before pay) | [`src/in/runner.ts`](../../viza-be/submission-service/src/in/runner.ts) |
| Error catalog + classifier | [`src/in/errors.ts`](../../viza-be/submission-service/src/in/errors.ts) |
| Payment relay (escrow card) | [`src/in/payment.ts`](../../viza-be/submission-service/src/in/payment.ts) |
| Post-payment finalisation | [`src/in/finalize.ts`](../../viza-be/submission-service/src/in/finalize.ts) |
| Smoke test | [`scripts/in-smoke.ts`](../../viza-be/submission-service/scripts/in-smoke.ts) |

## Auto-enqueue, monitoring, env

Identical to KH (see [`kh.md`](./kh.md) for the long form):

- INFRA-002 producer in the Stripe webhook auto-enqueues runner_job
  rows with `country='india'` once the agency fee clears.
- OPS-004 canary monitors `https://indianvisaonline.gov.in/evisa/`
  hourly; status surfaces at `/admin/portal-health`.
- OPS-005 SLA seeded at median 72 h / p95 168 h; back-fill cron
  flips to `source='measured'` after ≥5 samples.
- Concurrency cap seeded at 2 (`runner_concurrency_cap`).

## Sub-journey gating

`gateExtraFields()` in `runner.ts` enforces extra required answers:

| `visa_purpose` | Required additional answer |
|---|---|
| `medical` / `medical_attendant` | `hospital_name` |
| `conference` | `conference_name` |
| `tourism` / `business` | none |

If a required field is missing the runner returns `blocked` with a
`sub-journey gate missing fields` reason — the answer-collection UI
must surface those fields when applicants pick a non-tourism purpose.

## Staging run procedure

Same gate as KH — 10 staging-mode runs ≥ 95% success before
production promotion. See [kh.md](./kh.md) §Staging run procedure.

## Common IN-specific issues

| Symptom | Likely cause | Mitigation |
|---|---|---|
| anti_bot.cloudflare on landing | Portal Cloudflare gate | Wait + rotate proxy; failover to `needs_human`. |
| validation.passport_invalid | Applicant typo | Surface to applicant; refund path per PAY-004. |
| validation.nationality_unsupported | IN e-Visa eligibility list | Refund + suggest sticker visa. |
| validation.payment_declined | Escrow card decline | Operator takeover (CS-003). |
| needs_human after pay | Receipt regex miss / portal selector drift. | Operator takeover (CS-003). |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — IN = `runner_escrow_card`.
- [docs/runbooks/kh.md](./kh.md) — twin runbook with full procedure.
- [docs/runbooks/la.md](./la.md), [docs/runbooks/lk.md](./lk.md), [docs/runbooks/za.md](./za.md) — sibling Phase-3 countries.
