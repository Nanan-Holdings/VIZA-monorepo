# Submission-service Fly Machines deploy runbook

`submission-service` is a Playwright worker deployed in three topologies:

- `viza-runner-pool` handles Vietnam Pre-Arrival and other stateless shared
  `runner_job` flows.
- `viza-runner-indonesia` is one retained sticky Machine for Indonesia B1/C1
  account registration, alias OTP, payment and final submission.
- Legacy and Korea remain separate sticky services for their existing flows.

All retained Machines scale to zero only after their readiness endpoint confirms
there is no queue work, browser/payment lock, or protected in-memory session.
Database leases and queue-specific claim RPCs prevent duplicate submissions.

## Prerequisites

- Create the Fly organization and add a protected GitHub
  `production-submission_service`
  environment. Set `FLY_API_TOKEN` and `FLY_ORG` only in that environment.
- Make the immutable GHCR image readable by Fly before deploying it. Do not use
  a mutable `latest` tag for production.
- In every Fly app, set only the secrets needed by enabled flows. Required:
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
  `SUBMISSION_RESULT_SECRET_KEY`. Feature secrets can include Resend,
  2captcha, IMAP, Bright Data proxy/Browser API, and country-specific enabled
  runner settings. Never put values in TOML, GitHub workflow files, logs, or
  application code.
- For the Malaysia MDAC live pilot, also add these protected GitHub Environment
  secrets when the related provider is enabled: `MDAC_BROWSER_API_ENDPOINT`
  (or `MDAC_BRIGHTDATA_BROWSER_API_ENDPOINT`), `TWOCAPTCHA_API_KEY`,
  `RESEND_API_KEY`, and `RESEND_OPS_ALERT_TO`. The deploy workflow copies only
  non-empty optional values to Fly Secrets. Browser API endpoints are secrets
  because they embed credentials.
- Apply the database migrations that provide `runner_job`, country concurrency
  caps, lease recovery, and `0129_indonesia_sticky_runner.sql` before enabling
  the Indonesia worker.

## First rollout

1. Merge the image workflow and publish a commit-SHA image.
2. The protected deployment workflow copies the three boot-required secrets
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `SUBMISSION_RESULT_SECRET_KEY`) and any non-empty supported feature secrets
   from its GitHub Environment into each new Fly app. For the MDAC pilot, add
   the MDAC Browser API and 2captcha secrets to that environment before the
   deploy. The legacy Fly worker runs headlessly and has no local-display
   dependency. Country workers must set neither proxy nor Browser API endpoints
   in TOML.
3. From GitHub Actions, run **deploy-submission-service-fly**, provide the full
   published SHA, choose one verified pilot country, and enable the required
   sticky workers. Production environment approval is required. Indonesia can
   also be deployed with `scripts/fly/deploy-indonesia.sh`.
4. Confirm each app's `/health` and `/ready` endpoints, then click the real
   frontend submit button for an authorized test application. Confirm queue
   claim, progress, final result and the redacted official evidence in storage.
5. Add countries one at a time after their authorized smoke succeeds. The
   deployment workflow's `all` option is only for the already verified set.

## Scaling and operations

- `scale-submission-service-fly` runs every five minutes and converts shared
  pool and Indonesia queue depth into Machine start/stop decisions. Retained
  Machines stop at desired capacity zero and restart when work appears. The
  authenticated frontend enqueue path explicitly wakes immediately claimable
  capacity; the scheduled scaler is recovery.
- Shared-pool workers use `shared-cpu-2x` with 2 GB RAM. Indonesia starts at
  `shared-cpu-1x` with 2 GB RAM, one retained Machine and concurrency one.
  There is no persistent volume. The retained legacy worker uses two shared
  CPUs and 4 GB RAM when started.
- Before Indonesia card submission, the worker records cgroup peak usage when
  available and blocks card submission at the configured 1.7 GB safety water
  line. Keep the 2 GB size when the payment smoke remains below that line
  without OOM/browser kills. Upgrade to `shared-cpu-2x` and 4 GB only when the
  evidence shows it is necessary.
- Indonesia, South Korea and legacy may stop only after `/deploy-ready`
  confirms the queue is idle and no browser, card, payment or result-check
  session is protected. Korea includes its SMS/cancellation browser-session
  maps; Indonesia includes its one-time card and payment session.
- Authenticated frontend enqueue paths call the protected worker wake endpoint
  for immediate startup. The five-minute queue-depth run is the fallback, and
  an hourly maintenance pulse briefly starts legacy for periodic status/email
  work before applying the same safe-stop gate.
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
- To stop a shared country immediately, mark it paused in
  `runner_concurrency_cap` and run the scale workflow. To stop Indonesia, first
  disable `SUBMISSION_SERVICE_INDONESIA_QUEUE_ENABLED`, verify
  `/deploy-ready`, then stop its retained Machine.
- If a worker crashes, its lease expires and another eligible worker safely
  reclaims the job. Use the existing queue requeue tooling only after verifying
  the official portal did not already accept the application.

## Migration completion criteria

The local worker may be retired only after a browser-click smoke demonstrates
frontend enqueue → Fly claim → official result/artifact → frontend status for
each enabled pilot country. Keep unsupported and gated country flows disabled.
