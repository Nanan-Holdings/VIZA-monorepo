# VIZA Launch Checklist (OBSV-005)

Master runbook linking every epic's deliverables. Run the readiness script
first; work the gates; keep the rollback plan open.

## 0. Readiness gate
- `npx tsx scripts/launch/verify-country-readiness.ts` → all 16 countries ✓
  (runner bound, pricing entry, marketing page, wizard config).

## 1. Security (SEC)
- gitignore hardened, secret inventory/purge/rotation runbooks, gitleaks pre-commit + CI, `.env.example` per workspace. Rotate all live keys (`docs/security/secret-rotation-runbook.md`).

## 2. Queue (QUE) + Migrations (MIG)
- runner_job consumer live (pollAndRun), dispatch table for 16, producer/consumer contract (`docs/infra/queue.md`).
- DB schema verified (`npm run db:verify`), migration reconciliation done (`docs/db/migration-reconciliation-runbook.md`), `visa_packages` seeded for 16 (`docs/db/launch-seed-checklist.md`).

## 3. Deploy (DEP) + CI
- submission-service Cloud Run manifest + /health//ready + GHCR image (`docs/infra/submission-service-deploy.md`).
- agent-backend render starter plan + PORT 8080 (`docs/infra/agent-backend-deploy.md`).
- CI required checks per `docs/infra/ci-required-checks.md`.

## 4. Runners (RUN) — capability
- See `docs/runners/country-capability-matrix.md` (submit/halt/paper per country).
- Proxy + account coverage (`docs/runners/proxy-accounts.md`). Recon harvest + selector promotion (DATA-*, onHold) before live submit.

## 5. Marketing (MKT) + Portal (POR)
- 16 country pages live + sitemap; pricing shared; localized en/zh-CN.
- Portal wizards for 16, result cards for 16, status-page e-visa download, country picker launched-only.

## 6. Payments (PAYP)
- Provider config validated (`docs/payments/provider-config.md`), go-live cutover (`docs/payments/go-live-runbook.md`), refunds + webhook idempotency audited.

## 7. Observability (OBSV)
- Metrics + dashboard (`docs/observability/metrics.md`), alerts (`alerts.md`), correlation-id logging (`logging.md`).

## 8. Synthetic smoke
- Against staging: `SMOKE_APPLICATION_ID=<uuid> npm --prefix viza-be/submission-service run launch:e2e-smoke -- --country indonesia --confirm` → terminal status.

## Rollback plan
- Marketing/portal: Vercel → promote previous production deployment (instant).
- agent-backend: Render → redeploy previous build.
- submission-service: Cloud Run → route traffic to prior revision; pause runners via `RUNNER_PAUSED_COUNTRIES` (QUE-006) while investigating.
- Payments: revoke rotated keys / disable provider; refunds per `docs/payments/refunds.md`.
