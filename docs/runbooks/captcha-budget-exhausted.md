# Runbook — captcha budget exhausted

> Last reviewed: 2026-05-07.
> Alert class: `runner.captcha.budget_exhausted`.

## Symptoms

- Slack alert with the class above.
- 2captcha returns `ERROR_ZERO_BALANCE` to the runner — surfaced as
  `TwoCaptchaZeroBalanceError` in `runner_job.last_error`.
- US CEAC and any other portals that gate on a captcha solve start
  failing with `runner.failed.<country>` shortly after.

## Diagnosis

- 2captcha dashboard balance: < $1.
- Last 24h captcha spend: SQL —

  ```sql
  SELECT SUM(captcha_cost_cents) FROM runner_metric
  WHERE ts > NOW() - INTERVAL '24 hours';
  ```

- Failed jobs since the alert fired:

  ```sql
  SELECT id, country, last_error
    FROM runner_job
   WHERE status = 'failed'
     AND finished_at > NOW() - INTERVAL '1 hour'
     AND last_error ILIKE '%2captcha%';
  ```

## Mitigation

1. Top up 2captcha (admin: 2captcha.com / Settings / Billing).
2. Re-queue the failed jobs:

   ```sql
   UPDATE runner_job
      SET status = 'queued', attempts = 0, last_error = NULL,
          leased_by = NULL, leased_until = NULL
    WHERE status = 'failed'
      AND finished_at > NOW() - INTERVAL '1 hour'
      AND last_error ILIKE '%2captcha%';
   ```

3. If the alert persists, raise the per-day budget cap with the
   provider and update `docs/payments/government-fee-routing.md` with
   the new ceiling.

## Escalation

- < $1 balance and weekend: ping #viza-ops in Slack.
- Provider outage (2captcha API 5xxs across multiple jobs): switch
  to anti-captcha as a fallback (TBD — provider integration not yet
  built; document gap).
