# Runbooks

Per-failure-class runbooks. Each follows the same shape:

- **Symptoms** — what fired in Slack / email / page
- **Diagnosis** — fastest queries / dashboards to confirm
- **Mitigation** — what to do right now
- **Escalation** — when to wake who

Indexed by alert class so OPS-003 dispatcher can append a one-liner
`runbook: docs/runbooks/<class>.md` to every Slack message.

| Alert class | Runbook |
|---|---|
| `runner.captcha.budget_exhausted` | [captcha-budget-exhausted.md](./captcha-budget-exhausted.md) |
| `runner.anti_bot.<country>` | [portal-anti-bot-trigger.md](./portal-anti-bot-trigger.md) |
| `inbox.otp.not_received` | [otp-not-received.md](./otp-not-received.md) |
| `payments.dispute.<id>` | [payment-dispute.md](./payment-dispute.md) |
| `submission.document.rejected` | [document-rejected.md](./document-rejected.md) |
| `portal.health.<country>` | [portal-down.md](./portal-down.md) |
| `runner.failed.<country>`, `runner.job.stuck` | [runner-job-stuck.md](./runner-job-stuck.md) |
| `runner.proxy.exhausted` | [proxy-pool-exhausted.md](./proxy-pool-exhausted.md) |
| `payments.reconcile.delta` | [payment-reconcile-delta.md](./payment-reconcile-delta.md) |
| KH country runner | [kh.md](./kh.md) |
| LA country runner | [la.md](./la.md) |

## On-call

[oncall.md](./oncall.md) — rotation, escalation tree, drills.

Last reviewed: 2026-05-08.
