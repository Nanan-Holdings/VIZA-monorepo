# VIZA Launch Checklist (OBSV-005)

Master runbook linking every epic's deliverables. Run the readiness script
first; work the gates; keep the rollback plan open.

## 2026-09-09 production launch gate

The live-site audit of `viza.it.com` and `app.viza.it.com` found the following
release blockers. Do not begin the external 100-person cohort until every P0
item is closed against the production deployment, not only a local build.

### P0 — blocks invitations

- [ ] Recover or confirm Vercel ownership for both production domains and link
  this checkout to the two canonical projects. On 2026-09-09 the authenticated
  CLI could see only `viza-app` (root `viza-fe/internal-website`); it could not
  access either production domain and no `marketing-website` project appeared
  in either accessible team. Do not create a replacement project until the
  existing domain owner is identified.
- [ ] Promote the current `viza-fe/marketing-website` build to the correct
  `marketing-website` Vercel project. Confirm `/product`, `/events`, `/about`,
  `/blog`, and both locales return 200; the 2026-09-09 live deployment returned
  404 for `/product` and `/events` and did not match the current route set.
- [ ] Approve real agency fees, official fees, currencies, and WeChat totals for
  every published package. `viza-fe/internal-website/lib/pricing.ts` still
  identifies the package numbers as placeholders and has an unresolved
  Indonesia official-fee TODO.
- [ ] Publish only packages with a verified form, payment path, staff support
  path, and submission path. The marketing app now fails closed when the
  catalogue feed is absent/malformed and excludes the internal `viza-test` SKU,
  but production publication rows still require an operator review.
- [x] Apply
  `viza-fe/internal-website/supabase/migrations/20260908170543_beta_launch_invites.sql`
  to the production Supabase project and verify both beta tables, triggers,
  grants, RLS, and service-role-only access. Applied and verified on
  `viza-production` as migration `20260908170543` on 2026-09-09; both tables
  were empty after creation.
- [x] Enforce one experiment cell per participant per campaign with production
  migration `20260908173446_harden_beta_access_claims`. Applied after verifying
  zero existing grants and zero participant conflicts on 2026-09-09.
- [x] Enforce one auditable friend waiver per application with production
  migration `20260908174327_prevent_duplicate_beta_waivers`. Applied after
  verifying production had zero existing beta waiver records on 2026-09-09.
- [x] Seal the social experiment at exactly 100 randomized assignments (50
  promo and 50 link), require support verification evidence before issuance,
  and make delivered assignments the experiment denominator. Production
  migration `20260908180226_enforce_beta_social_cohort` was applied and the
  cohort initialized on 2026-09-09; all 100 slots are unissued and no plaintext
  codes were pre-generated.
- [x] Separate issuance from confirmed delivery, bind each social claimant with
  HMAC-backed identity, and support audited cancellation/reissue only before
  delivery. Production migrations
  `20260908184632_accurate_beta_delivery_identity` and
  `20260908185240_fix_social_claim_return_type` were applied on 2026-09-09;
  forward and rollback smokes passed, with 0 issued, 0 delivered, and 0 grants.
- [ ] Configure `BETA_IDENTITY_HMAC_KEY` on the portal before deploying the
  delivery-aware beta actions. Keep this key server-only and stable for the
  campaign so the same social participant cannot be reassigned across arms.
  In production, both social and friend issuance remain locked until this and
  the checkout-handoff encryption key pass the operator-console preflight.
- [ ] Configure `CHECKOUT_HANDOFF_ENCRYPTION_KEY` on the portal and deploy the
  marketing POST handoff. Local HTTP smoke proves checkout URLs no longer carry
  email, name, passport/phone prefill, or beta tokens; production remains on
  the old URL-based flow until the coordinated deployment.
- [x] Close the authenticated portal redemption gap. `/client/checkout` now
  accepts a visible one-time promo code or an explicit link-suffix arm, applies
  50% only to the VIZA agency fee, carries the undiscounted government amount
  in the canonical order, and completes the friend 100%-off path without a
  payment provider. Deterministic order/payment identities and exact-row
  validation make first claim, retry, and concurrent submission replay-safe.
  The verified Stripe webhook also settles the linked order when the customer
  closes Stripe without returning, keeping beta conversion attribution timely.
- [ ] Complete counsel review for Terms, Privacy, Cookies, Subprocessors, and
  Refund Policy. `docs/legal/review-log.md` currently records placeholder or
  undrafted surfaces. Stale `haggstorm.com` customer contacts were replaced
  locally with the current `viza.it.com` addresses; counsel approval remains.
- [ ] Fix official-fee accounting before any paid beta: collect or separately
  authorize the complete government fee before creating a managed allocation.
  A `portal_direct` accounting row must never be treated as paid merely because
  the discounted VIZA agency fee was paid. Local allocation code now requires
  explicit checkout collection evidence; deployment and a paid-path smoke are
  still required.
- [ ] Make refunds discount-aware, document/implement the WeChat refund path,
  and pause both `submission_queue` and `runner_job` work on disputes. Refunds
  must never exceed the provider amount actually collected. Stripe refund math
  is capped to the collected discounted amount locally, Stripe disputes pause
  both execution queues, and native WeChat refund request/callback handling is
  implemented and tested. This gate remains open until the WeChat merchant
  credentials and distinct production refund callback are configured and a
  low-value end-to-end refund is reconciled.
- [ ] Schedule and authenticate durable `payment_provisioning_jobs` retries,
  with dead-letter/age alerting. One eager attempt is insufficient because a
  paid or 100%-off tester can otherwise be left without portal access. A
  `CRON_SECRET`-authenticated five-minute Vercel sweep is implemented and
  tested locally; it now opens deduplicated admin work items immediately for
  dead letters and after 15 minutes for retry/running jobs, then resolves and
  reopens them across recovery cycles. Production secret/deployment and cron
  invocation-failure monitoring remain.
- [ ] Deploy the portal and marketing changes together, then complete one
  disposable end-to-end checkout for each matrix cell: promo/card,
  link/card, promo/WeChat, link/WeChat, and a 100%-off friend checkout. Confirm
  paid/free account provisioning, portal login, application access, and final
  submission attribution.

### P1 — close before public announcement

- [ ] Clear or unpublish affected products from the fresh public status feed.
  The 2026-09-09 live page currently reports that monitoring data is
  unavailable, with zero monitored endpoints and no completed checks. Restore
  fresh synthetic evidence before treating the public status surface as a
  launch signal. Locally, production now requires an explicit HTTPS backend URL
  and `/api/status` returns HTTP 503 with an honest renderable snapshot until it
  sees at least one fresh, non-unknown monitored observation.
- [ ] Confirm the security-header baseline is present on both production
  domains: HSTS, frame protection, MIME-sniff protection, referrer policy,
  permissions policy, and report-only CSP. Both local apps now send violations
  to bounded same-origin collectors that retain only safe aggregate dimensions,
  and the portal build no longer ignores TypeScript errors. Review collected
  production aggregates before enforcing CSP.
- [x] Resolve the portal production-build dynamic-server/static-generation
  diagnostics on `/client/destinations/[region]`. The route is explicitly
  dynamic and the 2026-09-09 production build completes without those errors.
- [ ] Confirm `NEXT_PUBLIC_PORTAL_URL=https://app.viza.it.com` in the marketing
  production environment and smoke the localized Login/登录 header link on
  desktop and mobile.
- [ ] If PhotonPay will be enabled for launch, validate the signed callback's
  settled amount/currency against `order.metadata.checkout_payment` before
  confirming payment. Keep PhotonPay disabled until this callback contract is
  implemented and tested. Stripe and WeChat perform this validation.
- [ ] Set `VIZA_ENABLED_PAYMENT_PROVIDERS` to the exact live rails and require
  authenticated `/api/health/payment-providers` to return HTTP 200 before
  launch. The endpoint now fails production on missing, inconsistent, or known
  sandbox/test configuration; production environment values remain unverified.

## Launch-beta operating procedure

Support first verifies the requested social follow, comment, and like outside
VIZA. It then uses `/admin/cs/beta` (or an administrator uses
`/admin/marketing/beta`), records the platform, recipient reference, and proof
reference, then issues the next pre-randomized slot. Staff cannot choose the
participant's A/B arm. Plaintext values are shown once and must be copied
immediately into the approved support workspace; the database stores only
their SHA-256 hashes.

### Cohorts and A/B allocation

| Audience | Variant A | Variant B | Benefit |
| --- | --- | --- | --- |
| 100 non-friend social users | 50 `promo_code` invitations | 50 `link_suffix` invitations | 50% off the VIZA service fee for the first country |
| Friends | One-time `promo_code` issued individually | Not part of the social A/B experiment | 100% off VIZA service fees across countries after the first claim |

Official government fees are never discounted. Each invitation binds to one
applicant on first claim and cannot be claimed by a different applicant or a
different first order. A retry of the same checkout is allowed. Friend access
remains applicant-bound so later countries do not require the plaintext code.

The primary social A/B metric is `submitted / delivered`. Monitor `checkout
started / delivered` and `paid / delivered` as diagnostic steps. Generated or
reserved values never enter the denominator. Friends are reported separately
because they are not part of this experiment and receive a different offer.

## 0. Readiness gate
- `npx tsx scripts/launch/verify-country-readiness.ts` → all 16 countries ✓
  (structural runner/pricing/page/wizard string coverage only). This does not
  prove correct pricing, payment, support, or a successful live submission.

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
- Provider config must run in deployment/readiness, reject test credentials in
  production, and pass go-live cutover (`docs/payments/go-live-runbook.md`).
  Refund amount parity, WeChat refund operations, webhook idempotency, official
  fee collection/allocation, and scheduled provisioning retries are separate
  required gates.

## 7. Observability (OBSV)
- Metrics + dashboard (`docs/observability/metrics.md`), alerts (`alerts.md`), correlation-id logging (`logging.md`).

## 8. Synthetic smoke
- Against staging: `SMOKE_APPLICATION_ID=<uuid> npm --prefix viza-be/submission-service run launch:e2e-smoke -- --country indonesia --confirm` → terminal status.

## Rollback plan
- Marketing/portal: Vercel → promote previous production deployment (instant).
- agent-backend: Render → redeploy previous build.
- submission-service: Cloud Run → route traffic to prior revision; pause runners via `RUNNER_PAUSED_COUNTRIES` (QUE-006) while investigating.
- Payments: revoke rotated keys / disable provider; refunds per `docs/payments/refunds.md`.
