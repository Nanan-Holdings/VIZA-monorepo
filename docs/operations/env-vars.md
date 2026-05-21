# Env-var matrix (ENV-001)

> Every secret has a category, a per-env requirement, and a rotation cadence. New env vars are not allowed to ship without a row here.

Categories: **public** (safe in client bundle), **server** (server-only), **secret** (must rotate).

| Var                                | Package                | Category | dev | staging | prod | Rotation cadence | Notes                                                   |
| ---------------------------------- | ---------------------- | -------- | --- | ------- | ---- | ---------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`         | viza-fe                | public   | ✓   | ✓       | ✓    | never            | URL is not secret                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | viza-fe                | public   | ✓   | ✓       | ✓    | per project      | Rotates only when project rotates                       |
| `SUPABASE_SERVICE_ROLE_KEY`        | viza-fe / viza-be      | secret   | ✓   | ✓       | ✓    | quarterly        | Bypasses RLS — high-blast-radius                        |
| `DATABASE_URL`                     | viza-be                | secret   | ✓   | ✓       | ✓    | quarterly        | Direct Postgres connection                              |
| `STRIPE_SECRET_KEY`                | viza-fe (server)       | secret   | dev key | live key | live key | quarterly | rotate via Stripe Dashboard, deploy in same window      |
| `STRIPE_WEBHOOK_SECRET`            | viza-fe (server)       | secret   | per-env | per-env | per-env | per-rotation | rotate when webhook endpoint rotates                |
| `RESEND_API_KEY`                   | viza-be                | secret   | ✓   | ✓       | ✓    | quarterly        | Notification worker                                     |
| `RESEND_FROM`                      | viza-be                | server   | ✓   | ✓       | ✓    | never            | Sender header                                           |
| `TWILIO_ACCOUNT_SID`               | viza-be                | server   | —   | ✓       | ✓    | per project      |                                                         |
| `TWILIO_AUTH_TOKEN`                | viza-be                | secret   | —   | ✓       | ✓    | quarterly        |                                                         |
| `TWILIO_FROM`                      | viza-be                | server   | —   | ✓       | ✓    | never            |                                                         |
| `BRIGHTDATA_USER`                  | submission-service     | server   | mock | ✓ | ✓     | per project      | Bright Data zone username                               |
| `BRIGHTDATA_PASSWORD`              | submission-service     | secret   | mock | ✓ | ✓     | quarterly        | Rotate alongside zone                                   |
| `BRIGHTDATA_ZONE`                  | submission-service     | server   | ✓   | ✓ | ✓     | never            | Zone name                                               |
| `RUNNER_VAULT_KEY`                 | submission-service     | secret   | ✓   | ✓ | ✓     | quarterly        | Encrypts UK/AU vault credentials at rest                |
| `RECON_HEADFUL`                    | submission-service     | public   | optional | — | —    | never            | Local-only debugging knob                               |
| `MAX_BOTS`                         | submission-service     | public   | optional | optional | optional | never        | Parallel-recon concurrency                              |
| `RECON_DEADLINE_MS`                | submission-service     | public   | optional | optional | optional | never        |                                                         |
| `STRESS_SLACK_WEBHOOK`             | submission-service CI  | secret   | —   | optional | optional | annually     | Posts nightly digest                                    |
| `FEE_SCRAPER_SLACK_WEBHOOK`        | viza-be                | secret   | —   | ✓ | ✓     | annually         | Weekly diff digest                                      |
| `VIZA_RUNNER_PD_KEY`               | viza-be                | secret   | —   | ✓ | ✓     | annually         | PagerDuty Events API v2 routing key                     |
| `ONCALL_RUNBOOK_URL`               | viza-be                | public   | optional | ✓ | ✓ | never        | Defaults to `https://www.viza.app/docs/operations/oncall.md` |
| `SENTRY_DSN`                       | viza-fe / viza-be      | secret   | —   | ✓ | ✓     | per project      | Don't use the same DSN across envs                      |
| `NEXT_PUBLIC_SENTRY_DSN`           | viza-fe                | public   | —   | ✓ | ✓     | per project      |                                                         |
| `SENTRY_AUTH_TOKEN`                | CI only                | secret   | —   | —   | CI    | quarterly       | Sourcemap upload                                        |
| `SENTRY_RELEASE`                   | CI / runtime           | server   | —   | ✓ | ✓     | per deploy      | Set to git SHA at build                                  |
| `AGENT_BACKEND_URL`                | viza-fe                | server   | ✓   | ✓ | ✓     | never            |                                                         |
| `FACE_MATCH_PROVIDER`              | viza-fe                | server   | mock | aws-rekognition | aws-rekognition | never  | Selects provider in lib/face/match.ts             |
| `FACE_MATCH_THRESHOLD`             | viza-fe                | server   | optional | ✓ | ✓ | never            | Default 0.85                                             |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | viza-fe | secret | — | ✓ | ✓ | quarterly | Required only when `FACE_MATCH_PROVIDER=aws-rekognition`  |
| `IMAP_HOST` / `IMAP_USER` / `IMAP_PASSWORD` | submission-service / viza-be | secret | — | ✓ | ✓ | quarterly | Inbox poller for runner confirmation emails |
| `LOCAL_LLM_API_KEY` (Anthropic)    | viza-be                | secret   | ✓   | ✓ | ✓     | quarterly        | Claude API key                                           |

## Adding a new env var

1. Add a row to the table above with category + per-env + rotation column populated.
2. Add the var to `.env.example` in the relevant package (no real values).
3. Update `docs/security/secret-rotation.md` if the rotation procedure differs from the defaults documented there.
4. Mention the new var in your PR description so deploy infra (Vercel project settings, Cloud Run secret manager) is updated before merge.

## Rotation cadence summary

| Cadence       | Vars                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| **per deploy**| `SENTRY_RELEASE`                                                                             |
| **per rotation** | `STRIPE_WEBHOOK_SECRET`                                                                   |
| **quarterly** | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `TWILIO_AUTH_TOKEN`, `BRIGHTDATA_PASSWORD`, `RUNNER_VAULT_KEY`, `SENTRY_AUTH_TOKEN`, AWS keys, IMAP password, `LOCAL_LLM_API_KEY` |
| **annually**  | Slack webhooks, `VIZA_RUNNER_PD_KEY`                                                         |
| **per project / never** | `*_URL`, `*_FROM`, `*_ZONE`, public anon keys                                       |
