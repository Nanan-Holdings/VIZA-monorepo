# Runbook — residential proxy pool exhausted / billing block

> Last reviewed: 2026-05-07.
> Alert class: `runner.proxy.exhausted`.

## Symptoms

- Bright Data returns 407 (auth) or 429 (rate-limit).
- `runner_job.last_error` contains "proxy" / "Bright Data" /
  "BRIGHTDATA_*".
- Multiple countries fail simultaneously (any flow that uses the
  pool).

## Diagnosis

- Bright Data dashboard: check current zone usage + monthly cap.
- Pull recent failed jobs across countries:

  ```sql
  SELECT country, COUNT(*) FROM runner_job
   WHERE status = 'failed' AND finished_at > NOW() - INTERVAL '1 hour'
     AND last_error ILIKE '%proxy%'
   GROUP BY country;
  ```

- Confirm cred env wasn't rotated out from under the runner.

## Mitigation

1. Top up Bright Data plan or raise the monthly cap.
2. Rotate the `BRIGHTDATA_PASSWORD` if 407 — see
   `docs/infra/proxy-pool.md` quarterly rotation note.
3. Re-queue affected jobs (same SQL as
   [runner-job-stuck.md](./runner-job-stuck.md)).
4. If the issue persists, fall back to Oxylabs (configure the env
   in the worker container — provider switch documented in the
   proxy-pool runbook).

## Escalation

- Bright Data outage (provider-side) → broadcast to ops; pause all
  runner concurrency caps to 0 until provider recovers; switch to
  Oxylabs for continuity.
