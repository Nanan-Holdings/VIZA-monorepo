# Secret Rotation Runbook

Artifact for **SEC-003**. Canonical inventory of every third-party credential
the platform consumes, which workspace/env-var uses it, how to rotate it, and
the post-rotation redeploy step.

Inventory source of truth: `viza-fe/internal-website/cloudbuild.yaml`
(`REPLACE_VIA_TRIGGER` / `_*` substitution list) + `process.env.*` references in
code. Cross-refs: [`secret-inventory.md`](./secret-inventory.md) (SEC-001),
[`secret-purge-runbook.md`](./secret-purge-runbook.md) (SEC-002), and the
zero-downtime rollover procedures in [`secret-rotation.md`](./secret-rotation.md).

> Deliverable = this committed file. No console/dashboard actions are performed
> by the agent.

## Pre-flight (every rotation)

1. Announce in `#oncall`: `Rotating $SECRET, ETA $duration`.
2. Rotate during business hours, never at peak.
3. Have rollback open in a second tab.
4. After rotation, **redeploy each consumer** and watch metrics ≥10 min before
   revoking the old value. Log the rotation in [`secret-rotation.md`](./secret-rotation.md).

## Inventory & rotation matrix

Legend — **Consumer** = workspace + env var. **Redeploy** = command(s) after the new value is set in all envs.

| Secret | Consumer (workspace · env var) | Rotate at | Redeploy |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | agent-backend · `ANTHROPIC_API_KEY` | console.anthropic.com → API keys → create, then delete old | `gcloud run services update viza-agent-backend --update-secrets "ANTHROPIC_API_KEY = anthropic-key:latest"` |
| `OPENAI_API_KEY` | agent-backend + internal-website · `OPENAI_API_KEY` / `PASSPORT_OCR_OPENAI_API_KEY` | platform.openai.com → API keys → rotate | redeploy Cloud Run + `vercel --prod` |
| `GOOGLE_AI_API_KEY`, `GOOGLE_TRANSLATE_API_KEY` | agent-backend | Google Cloud Console → Credentials → regenerate | redeploy Cloud Run |
| `SUPABASE_SERVICE_ROLE_KEY` | all backends + internal-website | Supabase → Settings → API → Reset service_role (⚠ two-key rollover — see [secret-rotation.md §2](./secret-rotation.md)) | set everywhere → redeploy all → reset in Supabase |
| `DATABASE_URL` | agent-backend, submission-service | Supabase → Database → connection pooling → reset password | redeploy backends |
| `STRIPE_SECRET_KEY` (live) | internal-website · `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → roll (restricted key) | `vercel env add` per env → `vercel --prod` |
| `STRIPE_WEBHOOK_SECRET` (live) | internal-website | Stripe → Developers → Webhooks → endpoint → roll signing secret | `vercel --prod` |
| `AIRWALLEX_API_KEY`, `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_WEBHOOK_SECRET` | internal-website · `AIRWALLEX_*` | Airwallex → Developer → API keys / webhooks → regenerate | `vercel env add AIRWALLEX_* ...` → `vercel --prod` |
| `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, `ALIPAY_APP_ID` | internal-website · `ALIPAY_*` | Alipay Open Platform → app → re-generate keypair; re-upload public key | `vercel --prod` |
| `WECHAT_PAY_API_V3_KEY`, `WECHAT_PAY_PRIVATE_KEY`, `WECHAT_PAY_MERCHANT_SERIAL_NO` | internal-website · `WECHAT_PAY_*` | WeChat Pay merchant platform → API security → reset APIv3 key / re-issue cert | `vercel --prod` (clears platform-cert cache via TTL) |
| `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET` | internal-website · `SHOPIFY_*` (cloudbuild `_SHOPIFY_*`) | Shopify admin → Apps → rotate token / webhook secret | rebuild via Cloud Build trigger |
| `CALCOM_API_KEY`, `CAL_WEBHOOK_SECRET` | internal-website (cloudbuild `_CALCOM_API_KEY`, `_CAL_WEBHOOK_SECRET`) | app.cal.com → Settings → Developer → API keys / webhooks | rebuild via Cloud Build trigger |
| `RESEND_API_KEY` | agent-backend + submission-service + internal-website | resend.com → API keys → create new, revoke old (zero-downtime) | redeploy all consumers |
| `TWILIO_AUTH_TOKEN`, `TWILIO_ACCOUNT_SID` | agent-backend · `TWILIO_*` | Twilio Console → primary/secondary token promote | redeploy Cloud Run |
| `TELEGRAM_BOT_TOKEN` | agent-backend | @BotFather → /revoke → new token | redeploy Cloud Run |
| `TWOCAPTCHA_API_KEY` | submission-service | 2captcha.com → account → reset key | redeploy poller (Cloud Run Job) |
| `IMAP_PASSWORD` | submission-service · `IMAP_PASSWORD` | mailbox provider → app password → regenerate | redeploy poller |
| `CLIENT_SESSION_SECRET` | internal-website (cloudbuild `_CLIENT_SESSION_SECRET`) | `openssl rand -base64 32` (rotating invalidates active guest sessions) | `vercel --prod` |
| `EXTERNAL_SUBMISSION_TOKEN`, `AGENT_BACKEND_INTERNAL_TOKEN`, `INTERNAL_AUTOMATION_TOKEN` | cross-service auth tokens | `openssl rand -hex 32`; set on BOTH caller + callee before redeploy | redeploy both sides together |
| `SUBMISSION_RESULT_SECRET_KEY` | agent-backend + submission-service (shared HMAC) | `openssl rand -hex 32`; rotate on both atomically | redeploy both |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | internal-website · `R2_*` | Cloudflare R2 → Manage API tokens → roll | `vercel --prod` |
| `PRESCRIPTION_API_KEY` | internal-website (cloudbuild `_PRESCRIPTION_API_KEY`) | upstream provider → regenerate | rebuild via Cloud Build trigger |
| `SENTRY_DSN` | all (DSN is low-sensitivity but rotate on leak) | Sentry → Project → Client Keys (DSN) → generate new | redeploy consumers |
| `SLACK_WEBHOOK_URL`, `FEE_SCRAPER_SLACK_WEBHOOK` | backends · webhook URLs | Slack app → Incoming Webhooks → revoke + recreate | redeploy backends |
| `VIZA_RUNNER_PD_KEY` | agent-backend · PagerDuty routing key | PagerDuty → service → Integrations → rotate routing key | redeploy Cloud Run |
| `BRIGHTDATA_PASSWORD` | submission-service proxy pool | Bright Data zone → reset password (pause runners — see [secret-rotation.md §5](./secret-rotation.md)) | update env → resume runners |
| `RUNNER_VAULT_KEY` | submission-service (encrypts UK/AU portal creds at rest) | re-encrypt vault — see [secret-rotation.md §6](./secret-rotation.md) | redeploy after vault-rotate.ts |

## Gitleaks usage (SEC-004 cross-ref)

Local pre-commit protection and full-history scan use `.gitleaks.toml`:

```bash
npm run security:install-hooks   # installs pre-commit hook (scripts/install-git-hooks.sh)
npm run security:gitleaks        # gitleaks detect --config .gitleaks.toml --redact
```

The hook runs `gitleaks protect --staged --config .gitleaks.toml` and blocks any
commit that stages a value matching the Anthropic / Stripe / Supabase rules.

## Default procedure (anything not listed)

1. Generate new value upstream.
2. Set the new value on **all** consumers (Vercel project, Cloud Run service/job, GitHub Actions secrets).
3. Redeploy each consumer.
4. Confirm green metrics ≥10 min.
5. Revoke the old value upstream.
6. Log it in [`secret-rotation.md`](./secret-rotation.md).
