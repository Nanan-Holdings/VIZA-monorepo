# Runbook — runner job stuck or failing

> Last reviewed: 2026-05-07.
> Alert classes: `runner.failed.<country>`, `runner.job.stuck`.

## Symptoms

- `runner_job.status = 'running'` with `leased_until` in the past
  (worker crashed mid-run).
- `runner_job.status = 'failed'` with `attempts >= max_attempts`.
- Applications in `submission_queue` not progressing.

## Diagnosis

- Find stuck leases:

  ```sql
  SELECT id, country, leased_by, leased_until
    FROM runner_job
   WHERE status = 'running' AND leased_until < NOW();
  ```

- Find failed jobs in the last hour:

  ```sql
  SELECT id, country, last_error
    FROM runner_job
   WHERE status = 'failed' AND finished_at > NOW() - INTERVAL '1 hour'
   ORDER BY finished_at DESC;
  ```

- Open `/admin/jobs/<id>` for the most recent fail; the step
  timeline + screenshots usually show the offending page.

## Mitigation

1. Stuck running jobs (lease expired): re-queue them.

   ```sql
   UPDATE runner_job
      SET status = 'queued', leased_by = NULL, leased_until = NULL,
          attempts = LEAST(attempts, max_attempts - 1)
    WHERE status = 'running' AND leased_until < NOW();
   ```

2. Failed jobs after a transient cause (proxy IP, portal blip):

   ```sql
   UPDATE runner_job SET status = 'queued', attempts = 0,
                         last_error = NULL,
                         finished_at = NULL,
                         leased_by = NULL, leased_until = NULL
    WHERE id = '<job_id>';
   ```

3. Failed jobs from a real applicant-data error: leave failed,
   notify the applicant via the staff dashboard, and ask them to
   correct the input.

## Escalation

- > 5 stuck leases in 1 h → worker pool problem (Fly Machine OOM
  / network blip). Restart the country app: `flyctl apps restart
  viza-runner-<cc>`.
- Sustained `runner.failed.*` for the same country → see
  [portal-anti-bot-trigger.md](./portal-anti-bot-trigger.md) or
  [portal-down.md](./portal-down.md).
