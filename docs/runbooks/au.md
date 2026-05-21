# Australia Subclass 600 runbook (AUTO-AU-04)

> Last reviewed: 2026-05-08.

Production handoff for AU_SUBCLASS_600 (Visitor Visa) flow.

## Two-step lifecycle (like UK)

| Stage | Status | Trigger |
|---|---|---|
| Form filled, payment paid, TRN issued | `submitted_to_government` | `persistAuSubmitted` after `payAuWithEscrowCard`. |
| Grant letter received via email | `delivered` | Inbound-email processor matches immi.gov.au + decision PDF. |

## Architecture pointers

| Component | File / location |
|---|---|
| Prefill runner (stops before signature) | [`src/au/runner.ts`](../../viza-be/submission-service/src/au/runner.ts) |
| Error catalog + classifier | [`src/au/errors.ts`](../../viza-be/submission-service/src/au/errors.ts) |
| Payment relay (escrow card → TRN) | [`src/au/payment.ts`](../../viza-be/submission-service/src/au/payment.ts) |
| Post-payment finalisation | [`src/au/finalize.ts`](../../viza-be/submission-service/src/au/finalize.ts) |

## Auto-enqueue, monitoring, env

- INFRA-002 producer in the Stripe webhook auto-enqueues runner_job
  rows with `country='australia'` once the agency fee clears.
- OPS-004 canary monitors `https://online.immi.gov.au/` hourly;
  status surfaces at `/admin/portal-health`.
- OPS-005 SLA seeded at median 14 d / p95 45 d; back-fill cron
  flips to `source='measured'` after ≥5 samples.
- Concurrency cap seeded at 1 — ImmiAccount is per-account-gated
  and carries explicit anti-automation language.

## ImmiAccount credentials

The runner expects `immi_account_email` and an
`immi_account_password_ref` (vault key, not raw password) in the
canonical answer set. Resolved via `secrets/vault.ts` at runtime —
see [docs/security/secrets.md](../security/secrets.md) for the
vault-loader pattern. Never log the resolved password.

## Common AU-specific issues

| Symptom | Likely cause | Mitigation |
|---|---|---|
| au.auth.invalid_credentials | Wrong vault entry / changed password | Operator takeover, rotate vault entry. |
| au.auth.account_locked | 3 wrong attempts | Wait 30 min + recovery email flow. |
| anti_bot.cloudflare on landing | Portal Cloudflare gate | Wait + rotate proxy. |
| au.validation.passport_invalid | Applicant typo / scan mismatch | Re-collect passport scan; refund per PAY-004. |
| au.validation.payment_declined | Escrow card decline | Operator takeover (CS-003). |

## Linked from

- [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) — AU = `runner_escrow_card`.
- [docs/runbooks/uk.md](./uk.md) — twin two-step country.
