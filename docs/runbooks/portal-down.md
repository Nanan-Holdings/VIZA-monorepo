# Runbook — destination portal down

> Last reviewed: 2026-05-07.
> Alert class: `portal.health.<country>`.

## Symptoms

- OPS-004 canary flipped a country to `degraded` or `down`.
- `/admin/portal-health` shows red/amber pill.
- Runner jobs for the country failing with 5xx / timeout in
  `last_error`.

## Diagnosis

- Confirm with a manual fetch:

  ```sh
  curl -I --max-time 15 "$(psql -t -A -c "SELECT probe_url FROM portal_health WHERE country = '<country>'")"
  ```

- Compare with downforeveryoneorjustme.com / the portal's
  status page (where one exists).
- Check the runner step screenshots — the portal may render a
  maintenance banner that the canary doesn't classify as `down`.

## Mitigation

1. Pause the country in the queue while the portal recovers:

   ```sql
   UPDATE runner_concurrency_cap SET paused = TRUE
    WHERE country = '<country>';
   ```

2. Slack `#viza-ops`: post a status update so support can field
   inbound tickets.
3. When the canary clears, unpause:

   ```sql
   UPDATE runner_concurrency_cap SET paused = FALSE
    WHERE country = '<country>';
   ```

   And re-queue the affected jobs (see
   [runner-job-stuck.md](./runner-job-stuck.md)).

## Escalation

- Outage > 4 h: notify staff to inform applicants of the delay and
  consider switching that country to paper-only fallback if
  available (`docs/payments/government-fee-routing.md`).
