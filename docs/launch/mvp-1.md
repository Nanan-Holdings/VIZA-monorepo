# MVP-1 launch gate: US + France

> Last reviewed: 2026-05-08.

Gates the first real-client launch on US (CEAC DS-160) + France (Schengen via VFS Global) with the full cross-cutting stack wired only for these two countries.

## Cross-cutting status (US + France slice)

| Track | Status | Reference |
|---|---|---|
| SECRETS-* (per-applicant vault, audit log, withAdmin escalation) | ✅ | `viza-be/submission-service/src/secrets/` |
| INBOX-* (Cloudflare Email Routing → inbound_email + R2, helpers) | ✅ | `viza-be/submission-service/src/inbox/`, `viza-be/email-worker/` |
| LEGAL-* (consent capture, ToS/privacy versioning, ZIP archive) | ✅ | `viza-fe/internal-website/app/legal/`, `lib/legal/zip-encoder.ts` |
| PAY-* (Stripe live + refund + escrow card mechanisms) | ✅ | `viza-be/agent-backend/src/payments/` |
| INFRA-* (Postgres-FIFO runner_job queue + concurrency cap) | ✅ | `viza-be/agent-backend/drizzle/0061_runner_job_queue.sql` |
| OPS-* (canary + portal-health + SLA back-fill) | ✅ | `viza-fe/internal-website/app/admin/portal-health/` |
| DOC-* (paper renderer + per-country templates) | ✅ | `viza-be/submission-service/src/paper/` |
| CS-* (operator-takeover console, ticket triage) | ✅ | `viza-fe/internal-website/app/admin/cs/` |

## Pre-launch checklist

- [x] All cross-cutting tracks `passes: true` for the US + France slice.
- [x] 5 staff-internal end-to-end submissions through US (CEAC DS-160).
- [x] 5 staff-internal end-to-end submissions through France (VFS Global Schengen).
- [x] Privacy policy + ToS counsel-reviewed (Singapore counsel: 2026-04-22).
- [x] Stripe live mode enabled; refund policy operative (`PAY-004`).
- [x] OPS canary + alerting live for ceac.state.gov + visa.vfsglobal.com/chn/zh/fra.
- [x] Pre-commit secret-leak hook active (gitleaks + regex fallback).
- [x] Backup + retention policy documented (`docs/operations/data-retention.md`).

## Day-of-launch runbook

1. **T-30 min**: confirm canary green for both portals; check `runner_concurrency_cap` set to safe values (US=3, FR=2).
2. **T-10 min**: enable signup gate via `feature_flag.public_signup_us_fr = true`.
3. **T-0**: announce internally; tail `runner_job` and `notification_event_log`.
4. **T+1h**: review error rate; pause via flag if `failed/total > 5%`.
5. **T+24h**: post-launch retro; capture lessons in `docs/launch/lessons.md`.

## Linked from

- [docs/launch/](.) — sibling MVP gates.
- [docs/runbooks/](../runbooks/) — per-country runbooks.
