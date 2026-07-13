# Submission-service Fly Machines deploy runbook

`submission-service` is a persistent Playwright worker. Production runs one
always-on Fly Machine per supported `runner_job` country plus one dedicated
legacy `submission_queue` worker. The workers are independent of developer
machines and use database leases and country concurrency caps to prevent a
second attempt from submitting the same application.

## Prerequisites

- Create the Fly organization and add a protected GitHub `production`
  environment. Set `FLY_API_TOKEN` and `FLY_ORG` only in that environment.
- Make the immutable GHCR image readable by Fly before deploying it. Do not use
  a mutable `latest` tag for production.
- In every Fly app, set only the secrets needed by enabled flows. Required:
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
  `SUBMISSION_RESULT_SECRET_KEY`. Feature secrets can include Resend,
  2captcha, IMAP, Bright Data proxy/Browser API, and country-specific enabled
  runner settings. Never put values in TOML, GitHub workflow files, logs, or
  application code.
- Apply the database migrations that provide `runner_job`, country concurrency
  caps, and lease recovery before allowing more than one worker.

## First rollout

1. Merge the image workflow and publish a commit-SHA image.
2. Add the required Fly secrets to `viza-submission-legacy` and to each pilot
   `viza-runner-<country>` app. Country workers must set neither proxy nor
   Browser API endpoints in TOML; Fly Secrets inject them at runtime.
3. From GitHub Actions, run **deploy-submission-service-fly**, provide the full
   published SHA, choose one verified pilot country, and enable the legacy
   worker. Production environment approval is required.
4. Confirm each app's `/health` and `/ready` endpoints, then click the real
   frontend submit button for an authorized test application. Confirm queue
   claim, progress, final result and the redacted official evidence in storage.
5. Add countries one at a time after their authorized smoke succeeds. The
   deployment workflow's `all` option is only for the already verified set.

## Scaling and operations

- `scale-submission-service-fly` runs every five minutes and converts
  `runner_queue_depth` decisions into `fly scale count` calls. A non-paused
  country retains one warm machine so newly queued jobs are noticed; a paused
  country scales to zero.
- The database remains the concurrency authority. The worker's country scope,
  claim lease and `runner_concurrency_cap` must not be bypassed by raising Fly
  machine counts.
- Inspect `/ready`, Fly logs, `runner_queue_depth`, and failed/dead-letter
  jobs before retrying. Portal, CAPTCHA, payment, MFA and user-confirmation
  checkpoints keep their existing behavior; cloud hosting does not bypass them.
- Rotate a secret by updating the Fly app secret and redeploying the same image
  through the protected workflow. Revoke the previous credential after smoke
  verification.

## Rollback and recovery

- Roll back by redeploying the previous known-good immutable SHA through the
  same workflow. Do not revert or delete queue rows.
- To stop a country immediately, mark it paused in `runner_concurrency_cap` and
  run the scale workflow; investigate the stored error and evidence before
  unpausing.
- If a worker crashes, its lease expires and another eligible worker safely
  reclaims the job. Use the existing queue requeue tooling only after verifying
  the official portal did not already accept the application.

## Migration completion criteria

The local worker may be retired only after a browser-click smoke demonstrates
frontend enqueue → Fly claim → official result/artifact → frontend status for
each enabled pilot country. Keep unsupported and gated country flows disabled.
