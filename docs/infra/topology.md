# Production deployment topology (INFRA-007)

> Last reviewed: 2026-05-07.

## Diagram

```
                         ┌────────────────────────────┐
                         │  Cloudflare DNS / R2 / CDN │
                         │   haggstorm.com edge       │
                         └────────┬───────────────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────┐
                  │   Vercel (FE)                     │
                  │   viza-fe/internal-website        │
                  │   Next.js 16 — /client + /admin   │
                  └──────────────────┬────────────────┘
                                     │
                          REST + Realtime
                                     │
                                     ▼
                  ┌──────────────────────────────────┐
                  │   Supabase                        │
                  │   - Postgres (single DB)          │
                  │   - Auth                          │
                  │   - Storage (submission-artifacts)│
                  │   - pg_cron (retention purges)    │
                  └────┬───────────────────┬──────────┘
                       │                   │
                       │ enqueue           │ writes
                       ▼                   │
              ┌────────────────┐           │
              │ runner_job     │◄──────────┘
              │ (Postgres FIFO)│
              └────────┬───────┘
                       │ claim (FOR UPDATE SKIP LOCKED)
                       ▼
       ┌─────────────────────────────────────────────────┐
       │ Fly Machines — viza-runner-<country>            │
       │ (one app per country, INFRA-003 autoscale)       │
       │  - submission-service container (INFRA-001)      │
       │  - Playwright + stealth + per-applicant FP       │
       │  - egress via Bright Data residential proxy      │
       └────────────────────┬────────────────────────────┘
                            │   POST/GET portals
                            ▼
                  ┌──────────────────┐
                  │ Government       │
                  │ visa portals     │
                  └──────────────────┘

  ─── inbound mail ───────────────────────────────────────
  *@haggstorm.com → Cloudflare Email Routing → viza-email-worker
                                              ↓
                                         R2 + Supabase inbound_email
  ─── payments ───────────────────────────────────────────
  /api/stripe/webhook (Vercel) ← Stripe Checkout, refunds, disputes
  Daily cron: scripts/reconcile-stripe-payouts.ts (Stripe ↔ orders)
```

## Per-service spec

| Service | Where | Image / runtime | Owner | Notes |
|---|---|---|---|---|
| Frontend (`viza-fe/internal-website`) | Vercel — production project on `app.haggstorm.com` | Next.js 16, Node 20 runtime | Engineering | Server actions + route handlers; no PII written outside Supabase. |
| Database + Auth | Supabase (Singapore primary region) | Postgres 15 | Engineering | Single DB; RLS on every table. Daily logical backups + point-in-time-recovery enabled. |
| Storage | Supabase Storage (submission-artifacts bucket) — same region | n/a | Engineering | INFRA-006 lifecycle: 90d hot → 365d glacier → delete. Mirror to R2 considered for hot bandwidth (deferred). |
| Runner workers | Fly Machines, one app per country (`viza-runner-vn`, `viza-runner-uk`, …) | INFRA-001 image | Engineering | Region pinned to match INFRA-004 proxy egress; autoscaled by `scripts/autoscale-runners.ts` against `runner_queue_depth`. |
| Inbound mail | Cloudflare Email Routing → Email Worker `viza-email-worker` | Workers runtime | Engineering | INBOX-002 worker; bodies > 1 MB land in R2. |
| Outbound transactional mail | Resend | Hosted | Engineering | Receipts (PAY-005) + OPS alerts (PAY-007 reconciliation, INFRA-003 violations). |
| Payment processing | Stripe (Test + Live) | Hosted | Engineering | Stripe Tax enabled in live (PAY-006). Webhook → Vercel route handler. |
| AI Companion | Anthropic API | Hosted | Engineering | Claude SDK direct (no LangChain). |
| Captcha | 2captcha | Hosted | Engineering | Per-portal where unavoidable. |
| Cron / scheduled jobs | Supabase pg_cron + a small Cloud Run job | Mixed | Engineering | pg_cron owns retention purges (LEGAL-003) and inbound mail purge (INBOX-007); Cloud Run owns Stripe reconciliation (PAY-007) and the autoscaler (INFRA-003). |

## Cost estimate at 1 000 applications / month

Order-of-magnitude. Real numbers will diverge — these are the ones we
size capacity against.

| Line | Calc | USD / month |
|---|---|---|
| Vercel Pro | flat | 20 |
| Supabase Pro (per project) | flat | 25 |
| Supabase egress (artefacts via signed URLs) | 1k apps × ~30 MB ≈ 30 GB | included |
| Cloudflare Email Routing | < 100k mails | free |
| Cloudflare Workers (Email Worker + futures) | < 100k req | free |
| Cloudflare R2 (inbound mail bodies) | ~5 GB stored | < 1 |
| Fly Machines (per-country workers, 5 active concurrent) | 5 × 1 vCPU × 256 MB × 24 × 30 ≈ | 60 |
| Bright Data Residential proxy | 1k apps × ~50 MB egress × $7/GB | 350 |
| Stripe (incl. card + Stripe Tax) | 2.9% + 30¢ × 1k × $99 | ~3 200 (revenue-linked, not infra) |
| Anthropic Claude (Companion + extractor) | 1k apps × ~50k tokens × Sonnet 3.5 rate | 75 |
| 2captcha | ~50% apps × $0.003 | 2 |
| Resend | < 5k transactional | free tier |
| Sentry / Logflare (proposed) | basic | 26 |
| **Infra subtotal (excl. card processing)** | | **≈ 560** |
| Card processing (Stripe) | passthrough | ~3 200 |

At 1 000 apps × $99 agency fee = $99 000 gross. Infra is < 1 % of
revenue at this scale. The proxy line dominates and is the first
lever to renegotiate.

## Disaster recovery + backup policy

- **Postgres** — Supabase point-in-time recovery (24-hour window on
  Pro). Daily logical backups exported to R2 by `scripts/db-backup.ts`
  (TBD, runbook below).
- **Storage** — `submission-artifacts` bucket is single-region today.
  Mirror to a second R2 region scheduled per quarter (manual, until
  artefact volume justifies automation).
- **Email** — `inbound_email` rows are the source of truth; bodies in
  R2 are an attachment store. Loss of R2 alone does not break OTP
  recovery (the inline `text`/`html` columns are populated for
  messages < 1 MB, which is the OTP / confirmation case).
- **Vault secrets** — `applicant_secret` is encrypted at rest; the
  encryption key (`SUBMISSION_RESULT_SECRET_KEY`) lives in Cloud Run
  secret manager + Vercel env. Loss of the key permanently severs
  every applicant credential — back up with the same rigour as the
  database (TBD: shard with Shamir's Secret Sharing across two ops
  HSMs before public launch).
- **RTO** — 4 hours for full FE + DB; 12 hours for runner workers
  (region-pinned + per-country autoscale).
- **RPO** — 5 minutes for Postgres (PITR); 1 hour for Storage; mail
  is best-effort (Cloudflare retries the 5xx).

## Runbook links

| Topic | Doc |
|---|---|
| Cloudflare Email Routing | [docs/inbox-cloudflare-setup.md](../inbox-cloudflare-setup.md) |
| Email Worker | [viza-be/email-worker/README.md](../../viza-be/email-worker/README.md) |
| Inbox retention | [docs/inbox-cloudflare-setup.md#retention](../inbox-cloudflare-setup.md) |
| Per-country gov-fee routing | [docs/payments/government-fee-routing.md](../payments/government-fee-routing.md) |
| Tax / currency | [docs/payments/tax-and-currency.md](../payments/tax-and-currency.md) |
| Service-role audit | [docs/service-role-audit.md](../service-role-audit.md) |
| Secret hygiene + pre-commit hook | [SECURITY.md](../../SECURITY.md) |
| PII retention purges | [docs/legal/retention.md](../legal/retention.md) |
| Subprocessors | [docs/legal/subprocessors.md](../legal/subprocessors.md) |
| Per-jurisdiction compliance | [docs/legal/jurisdictions/](../legal/jurisdictions/) |
| Runner queue | [docs/infra/queue.md](./queue.md) |
| Worker pool autoscaling | [docs/infra/scaling.md](./scaling.md) |
| Residential proxy pool | [docs/infra/proxy-pool.md](./proxy-pool.md) |
| Artefact storage | [docs/infra/artefact-storage.md](./artefact-storage.md) |

## Open follow-ons

- **HSM-shared encryption key** — replace the env-var
  `SUBMISSION_RESULT_SECRET_KEY` with a 2-of-3 Shamir share across
  ops members before public launch.
- **Multi-region Storage** — mirror `submission-artifacts` to a
  second R2 region; not a hard blocker until artefact volume justifies.
- **Sentry / Logflare** — pick an APM / log aggregator before the
  first 100-applicant pilot.
- **db-backup.ts** — script the daily logical backup → R2 dump.
