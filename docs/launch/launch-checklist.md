# VIZA Launch Checklist (OBSV-005)

Master runbook linking every epic's deliverables. Run the readiness script
first; work the gates; keep the rollback plan open.

## 2026-09-10 external beta launch gate

Do not invite the external 100-person cohort until every unchecked item below
has production evidence. A local build, an unmerged branch, or a database
migration alone is not evidence of a safe public release.

- [x] Confirm the Vercel ownership path. The connected `viza-gmail's projects`
  team resolves `viza.it.com` to `viza-marketing` and `app.viza.it.com` to
  `viza-internal`. Release operations must use that team, not the local CLI's
  unrelated account.
- [x] Apply and verify the beta schema. Production has the beta invitation
  migrations through `fix_social_claim_return_type`, 100 social slots (50
  `promo_code`, 50 `link_suffix`), zero issued/delivered slots, zero generated
  codes, and zero grants. RLS is enabled on the invite, grant, and assignment
  tables with no public policies.
- [ ] Deploy the reviewed beta release to both mapped Vercel projects. The
  public site must no longer expose the `viza-test` SKU; `/product` and
  `/events` must return 200 in both supported locales; the desktop header must
  show a localized Login/登录 action that opens the portal login route.
- [x] Provision the portal's server-only Production secrets:
  `BETA_IDENTITY_HMAC_KEY`, `CHECKOUT_HANDOFF_ENCRYPTION_KEY`, and
  `CRON_SECRET`. They are Vercel Secret values, generated on 2026-09-10, and
  are not present in source control or browser-visible configuration.
- [ ] Configure the exact live `VIZA_ENABLED_PAYMENT_PROVIDERS` list and its
  provider credentials. Verify the authenticated payment-provider readiness
  endpoint after deployment. Do not enable a rail from placeholder or
  unverified credentials.
- [ ] Approve a bounded launch catalogue. Finance/operations must approve each
  published product's VIZA service fee, government-fee amount and official
  currency, tax treatment, payment rail, and WeChat fen total. Current source
  data includes placeholder commercial pricing and an unresolved Indonesia
  government-fee mapping, so no price may be inferred or converted from a spot
  exchange rate.
- [ ] Complete the five disposable, reconciled production flows: social
  promo/card, social link/card, social promo/WeChat, social link/WeChat, and
  friend 100%-off. Verify registration, payment callback, provisioned portal
  access, final-submission attribution, and a government fee that remains
  undiscounted. Do not use applicant records for the smoke flows.
- [ ] Publish counsel-approved Terms, Privacy, Cookies, Subprocessors, and
  Refund Policy, with final effective dates, versioned consent links, and an
  approval record in `docs/legal/review-log.md`. Drafts and unreviewed policy
  text are not launch evidence.
- [ ] Verify the public security-header baseline on marketing and portal routes:
  enforced CSP plus reporting endpoint, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, strict referrer policy, permissions
  policy, and HSTS with subdomains. Check both dynamic and static routes after
  the final Vercel aliases switch.
- [ ] Restore an operational public-status signal for the published launch
  countries. At launch it must be fresh, report zero unresolved incidents, and
  report `operational` for every country offered in the beta cohort. Otherwise
  unpublish the affected countries instead of presenting a misleading service
  promise.

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
