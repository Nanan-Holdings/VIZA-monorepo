# submission-service Deploy Runbook

Artifact for **DEP-002**. How to build the image, deploy the Cloud Run service,
and inject env via Secret Manager. **No console deploy is performed by the
agent — these are operator commands.**

Related: `deploy/cloudrun-service.yaml` (DEP-001), `.env.example` (SEC-006),
`src/config/validate-env.ts` (DEP-003), `/health` + `/ready` (DEP-004),
`.github/workflows/submission-service-image.yml` (DEP-005).

## 1. Build + push the image (GHCR)

CI does this automatically on push to `main` (DEP-005), tagging with the commit
SHA. To build manually:

```bash
SHA=$(git rev-parse --short HEAD)
docker build -f viza-be/submission-service/Dockerfile \
  -t ghcr.io/<org>/viza-submission-service:$SHA \
  viza-be/submission-service
docker push ghcr.io/<org>/viza-submission-service:$SHA
```

## 2. Create Secret Manager secrets

One secret per credential. Names must match `valueFrom.secretKeyRef.name` in
`deploy/cloudrun-service.yaml`:

```bash
for s in supabase-url supabase-service-role-key submission-result-secret-key \
         resend-api-key twocaptcha-api-key imap-password; do
  printf '%s' "<value>" | gcloud secrets create "$s" --data-file=- 2>/dev/null \
    || printf '%s' "<value>" | gcloud secrets versions add "$s" --data-file=-
done
# Grant the runtime service account access:
gcloud secrets add-iam-policy-binding supabase-service-role-key \
  --member="serviceAccount:<runtime-sa>@<project>.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 3. Deploy the Cloud Run service

Edit `deploy/cloudrun-service.yaml`: set `REPLACE_ORG` and `REPLACE_SHA`, then:

```bash
gcloud run services replace viza-be/submission-service/deploy/cloudrun-service.yaml \
  --region us-central1
```

The manifest sets `minScale: 1` (persistent poller) and probes `/health`
(liveness) + `/ready` (DB reachable + worker started).

## 4. Required env vars

All consumed by the service — full list with placeholders in
`viza-be/submission-service/.env.example`. Required (boot-blocking, enforced by
`validate-env.ts`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUBMISSION_RESULT_SECRET_KEY`. Feature-gated (warn if absent):

| Group | Vars |
| --- | --- |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| LLM (if used) | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` |
| Email/alerts | `RESEND_API_KEY`, `RESEND_OPS_ALERT_TO`, `SLACK_WEBHOOK_URL` |
| Captcha | `TWOCAPTCHA_API_KEY` |
| Inbox (e-visa retrieval) | `IMAP_HOST`, `IMAP_PORT`, `IMAP_EMAIL`, `IMAP_PASSWORD` |
| Proxy pool | Bright Data / `proxy_pool` config (per RUN-CORE-006) |
| Queue tuning | `RUNNER_CONCURRENCY_JSON`, `RUNNER_PAUSED_COUNTRIES` |
| Runtime | `PORT` (Cloud Run sets 8080), `NODE_ENV` |

## 5. Graceful shutdown (ties to QUE-002)

On `SIGTERM` (Cloud Run scale-down / redeploy) the service aborts the
runner_job consumer's `AbortController`, so `pollAndRun` stops claiming new jobs
and exits cleanly; in-flight jobs finish or fall back to their lease for
recovery (QUE-008). Cloud Run's default 10s grace is enough to stop claiming;
set `timeoutSeconds` appropriately for long in-flight runs.

## 6. Verify

```bash
SERVICE_URL=$(gcloud run services describe viza-submission-service --region us-central1 --format='value(status.url)')
curl -fsS "$SERVICE_URL/health"   # {"status":"ok"}
curl -fsS "$SERVICE_URL/ready"    # {"status":"ready",...} once DB reachable + worker started
```
