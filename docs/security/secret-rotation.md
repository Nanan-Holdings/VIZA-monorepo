# Secret-rotation playbook (ENV-002)

Quarterly cadence by default — see `docs/operations/env-vars.md` for the matrix. This playbook covers the highest-blast-radius secrets first; for any secret not listed below, follow the **Default rotation procedure** at the end.

## Pre-flight

- [ ] Notify on-call in `#oncall` (one-line "Rotating $SECRET, ETA $duration") so unexpected pager noise doesn't get treated as a real incident.
- [ ] Rotate during business hours, NOT during a known peak.
- [ ] Have the rollback procedure open in a second tab.

## 1. Stripe — `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`

```bash
# 1. Create a new restricted key in Stripe Dashboard → Developers → API keys.
#    Scope: payments + checkout + customer + webhook signing.
NEW_KEY="rk_live_xxx"

# 2. Add the new value to Vercel env (per env separately).
vercel env add STRIPE_SECRET_KEY production   # paste $NEW_KEY
vercel env add STRIPE_SECRET_KEY preview      # paste $NEW_KEY

# 3. Redeploy.
vercel --prod

# 4. Confirm by hitting the live /api/checkout flow in incognito.

# 5. ROTATE the webhook signing secret separately:
#    Stripe Dashboard → Developers → Webhooks → endpoint → Reveal signing secret → Roll.
vercel env add STRIPE_WEBHOOK_SECRET production
vercel --prod

# 6. Revoke the old key once the new one's traffic is healthy (≥10 min of green metrics).
```

If a webhook is in flight during the rollover, Stripe retries for 3 days — no events lost.

## 2. Supabase — `SUPABASE_SERVICE_ROLE_KEY` + `DATABASE_URL`

⚠ Service role bypasses RLS. Treat rotation as a **two-key** rolling cutover.

```bash
# ⚠ CORRECTED 2026-09-04 — the previous version of this block was unrunnable:
#   it told you to deploy the new key BEFORE generating it (impossible with a
#   legacy service_role reset), targeted Cloud Run (the backend is on Render),
#   and named a repo that does not exist.
#
# PREFERRED — true zero-downtime, if this project has the new API-key system
# enabled (it does: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is already in use).
# New-style secret keys (sb_secret_...) can coexist, so you get a clean overlap:
#   1. Dashboard → Project Settings → API Keys → create a SECOND secret key.
#   2. Deploy it everywhere (below). Old key still valid the whole time.
#   3. Verify traffic is healthy on the new key.
#   4. Revoke the old key. No downtime at any point.
#
# FALLBACK — legacy service_role reset. There is NO overlap window: the reset
# invalidates the old key at the instant it mints the new one. Accept a short
# outage and sequence it tightly — reset first, then paste into all consumers
# as fast as possible. Announce it; do not do this at peak.

# Consumers (verified 2026-09-04 by grepping process.env across the monorepo):
#   viza-fe/internal-website   → Vercel, project `viza-internal`
#                                team `viza-gmail's projects`
#   viza-be/agent-backend      → Render, service `viza-agent-backend` (singapore)
#   viza-be/submission-service → Fly.io (scripts/fly/)
#   plus repo-local scripts in knowledge-base/ and scripts/ that read it from
#   a local .env — rotate your own shell env too, or they break silently.

# Vercel  — set in the dashboard (Settings → Environment Variables), then
#           redeploy the CURRENT production deployment. Do NOT run
#           `vercel --prod` from a feature-branch checkout: prod here is
#           git-driven off `main`, and a local --prod push would ship whatever
#           branch you happen to have checked out.
# Render  — Dashboard → viza-agent-backend → Environment → edit → Save
#           (Render redeploys automatically on env change).
# Fly     — viza-be/submission-service/scripts/fly/sync-runtime-secrets.sh

# Then: watch /admin/portal-health for RLS-bypass errors for 30 min.
```

`DATABASE_URL` rotation: use Supabase Dashboard → Database → Connection pooling → reset connection pool password. Procedure identical to the SRK rollover.

## 3. Resend — `RESEND_API_KEY`

```bash
# Resend allows multiple live API keys at once — use a true zero-downtime rollover.
# 1. Create a new key.
RESEND_NEW="re_..."
# 2. Add to all envs.
vercel env add RESEND_API_KEY production
gcloud run services update viza-agent-backend \
  --update-secrets "RESEND_API_KEY = projects/viza-prod/secrets/resend:latest"
# 3. Redeploy.
# 4. Wait 30 min, confirm `notification_event_log` outcomes are `sent`.
# 5. Revoke the old key in the Resend dashboard.
```

## 4. Twilio — `TWILIO_AUTH_TOKEN`

```bash
# Twilio supports a "primary + secondary" token. Promote secondary first.
# 1. Generate the secondary auth token in Twilio Console.
# 2. Set TWILIO_AUTH_TOKEN to the secondary across all envs (same as Resend).
# 3. Redeploy.
# 4. Promote secondary → primary in Twilio.
# 5. Revoke old primary.
```

## 5. Bright Data — `BRIGHTDATA_PASSWORD`

```bash
# Bright Data zone password rotation is zone-wide; new password takes effect within 1 min.
# 1. Schedule a 5-min runner pause:
psql "$DATABASE_URL" -c "UPDATE runner_job SET status='paused' WHERE status='queued';"
# 2. Reset password in Bright Data dashboard.
# 3. Update env across submission-service deploy targets.
# 4. Resume:
psql "$DATABASE_URL" -c "UPDATE runner_job SET status='queued' WHERE status='paused';"
# 5. Watch the next 10 runner_job entries for proxy auth errors.
```

## 6. Vault root key — `RUNNER_VAULT_KEY`

⚠ This key encrypts UK / AU portal credentials at rest. Rotation requires re-encrypting the vault.

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -base64 32)
# 2. Set as RUNNER_VAULT_KEY_NEXT alongside the existing RUNNER_VAULT_KEY.
gh secret set RUNNER_VAULT_KEY_NEXT -b "$NEW_KEY"
# 3. Run the re-encrypt script (writes a copy of every credential blob under the new key).
cd viza-be/submission-service && npx ts-node scripts/vault-rotate.ts
# 4. Promote NEXT → primary, demote primary → previous (for one quarter, in case decrypt rolls back).
# 5. After a quarter, drop _PREVIOUS.
```

## 7. Sentry / PagerDuty / Slack webhooks

These are integration-specific. Procedure is the same as Resend (multiple live tokens, set new → redeploy → revoke old). Document the specific dashboard URL in the integration's own runbook.

## Default rotation procedure

For any secret not covered above:

1. Generate a new value at the upstream provider.
2. Add the new value to **all** consumer deploys (Vercel project, Cloud Run service, GitHub Actions secrets, local `.env.example`).
3. Redeploy each consumer.
4. Confirm green metrics for ≥10 min.
5. Revoke the old value at the upstream provider.

## Tested rotation log

Track each rotation in `docs/security/rotation-log.md` (one row per rotation). Required for SOC2-style audits.

| Date       | Secret                          | Operator | Time to rotate | Notes                                |
| ---------- | ------------------------------- | -------- | -------------- | ------------------------------------ |
| 2026-05-08 | `FEE_SCRAPER_SLACK_WEBHOOK`     | edward   | 4 min          | end-to-end test rotation (non-critical) |
