# Supabase production self-healing

## Why this exists

On 2026-08-11, the production project continued to appear active in the
management control plane while authenticated Auth and Data API requests timed
out. DNS, TCP, TLS, the public project URL, and the project keys were valid.
Auth logs showed database request deadlines and concurrent refresh conflicts;
Data API requests returned gateway timeouts. Restarting the hosted database
restored Auth and Data API service.

The initiating database workload could not be proven after recovery because
Postgres statistics reset with the restart and crash-period resource history
was unavailable. Two application-side amplifiers were fixed separately:

- successful client login now creates a bounded signed `client_session`, which
  prevents multiple server paths from refreshing the same Supabase token;
- Vietnam status idempotency writes now use plain inserts and treat PostgreSQL
  `23505` as an already-completed operation, avoiding invalid partial-index
  upserts and duplicate retry pressure.

A restart is a last-resort recovery action, not a substitute for query tuning,
connection control, or adequate Supabase compute. Supabase also documents that
restarting an overloaded project may only be a temporary fix.

## Control plane

`.github/workflows/supabase-self-heal.yml` runs on GitHub Actions every five
minutes, offset from the top of the hour. It deliberately runs outside both
Supabase and Vercel, so a Supabase database outage cannot stop the watchdog and
the Vercel Hobby plan's once-daily Cron limit does not weaken recovery.

Each run delegates to `scripts/supabase-self-heal.mjs`:

1. Validate that the configured hosted Supabase URL and project ref match the
   production ref hard-coded in the recovery script.
2. Read durable incident state from one dedicated GitHub Issue, then run three
   time-separated rounds of bounded, read-only Auth and Data API probes. Each
   round also sends an invalid-key control probe that must return `401` or
   `403`; this proves the runner can still reach the Supabase edge before a
   data-plane timeout is counted.
3. Refuse recovery for configuration errors, authorization errors, rate limits,
   ambiguous results, a non-operational Management API status, disabled auto
   restart, or an active cooldown.
4. Count at most one failure per scheduled workflow. Only after three
   consecutive failed schedules, with every internal Auth and Data probe
   classified as a supported network, timeout, or gateway failure, may recovery
   continue. A healthy schedule clears the incident counter.
5. Deduplicate both the GitHub run ID and its five-minute execution window so a
   re-run or duplicate delivery cannot advance the failure counter.
6. Persist a restart-pending lease to the Issue before submitting exactly one
   Management API project restart. Workflow concurrency prevents overlap and a
   45-minute cooldown protects rejected attempts. A pending, accepted, or
   unknown restart is never submitted again until the probes recover or an
   operator deliberately clears the incident state.

Logs are structured and contain probe type, classification, elapsed time,
decision, and incident ID. They never contain keys, tokens, response bodies,
user credentials, or applicant data.

## Required GitHub configuration

`supabase-production-recovery` Environment secrets:

- `SUPABASE_ACCESS_TOKEN`: prefer a fine-grained token limited to
  `project_admin_write` for the production project;
- `SUPABASE_PUBLISHABLE_KEY`: the production publishable key used by the
  read-only probes.

Repository variables:

- `SUPABASE_URL`;
- `SUPABASE_PROJECT_REF`;
- `SUPABASE_SELF_HEAL_ISSUE_NUMBER`, identifying the dedicated state Issue;
- `SUPABASE_AUTO_RESTART_ENABLED`, set to exact `true` only after a healthy
  kill-switch-disabled scheduled run is verified.

Both secrets are scoped to the `supabase-production-recovery` GitHub
Environment. Its deployment branch policy must allow only `main`; do not store
the Management API credential as a repository-wide secret. Scheduled workflows
run only from the repository default branch, so the workflow must be merged to
`main` before it becomes active.

The production state is held in
[#11](https://github.com/Nanan-Holdings/VIZA-monorepo/issues/11). Its body is
machine-owned. To bootstrap a replacement Issue, paste this exact marker block
and set the repository variable to the new Issue number:

```text
<!-- supabase-self-heal-state:start -->
{
  "version": 2,
  "incidentId": null,
  "consecutiveFailureRuns": 0,
  "firstFailureAt": null,
  "lastFailureAt": null,
  "lastSuccessAt": null,
  "restartRequestedAt": null,
  "lastOutcome": "healthy",
  "lastProcessedRunId": null,
  "lastProcessedWindow": null
}
<!-- supabase-self-heal-state:end -->
```

Do not hand-edit an active state block. A missing or invalid block fails closed
and the workflow exits without changing the failure counter or restarting the
project.

## Verification and operations

Keep `SUPABASE_AUTO_RESTART_ENABLED=false` for the first scheduled run after
configuration or token rotation, then inspect it:

```powershell
gh run list --workflow supabase-self-heal.yml --limit 1
gh run view <run-id> --log
```

Expected healthy outcome: `action=healthy`, no Management API restart, and no
incident counter.

Emergency disable:

```powershell
gh variable set SUPABASE_AUTO_RESTART_ENABLED --body false
```

Re-enable only after the underlying overload or configuration issue is
understood and a kill-switch-disabled scheduled probe is healthy. Local-only
decision testing may additionally set `SUPABASE_SELF_HEAL_DRY_RUN=true`; the
scheduled workflow intentionally has no manual dispatch path to production
secrets.

Interpret workflow actions:

- `healthy`: both data-plane services responded normally;
- `suppressed`: confirmation threshold, duplicate run, cooldown, kill switch,
  ambiguous signal, unresolved previous restart, or project status prevented
  restart;
- `restart_requested`: Management API accepted the request;
- `restart_unknown`: the restart request timed out, was rate-limited, or returned
  a transient server error after submission; the persistent pending state
  blocks another request until probes recover or an operator intervenes;
- `config_error`: missing or inconsistent configuration; no outage counter and
  no restart.

GitHub scheduled workflows can be delayed during platform load, so this is a
recovery guard rather than a hard availability SLA. Continue using Supabase
database reports, Auth/Postgres logs, and connection/query analysis to remove
repeated causes of overload.

## Official references

- [Supabase: project status reports unhealthy services](https://supabase.com/docs/guides/troubleshooting/project-status-reports-unhealthy-services)
- [Supabase Management API](https://supabase.com/docs/reference/api/getting-started)
- [GitHub Actions scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub Actions deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
