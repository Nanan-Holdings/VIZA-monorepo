# PagerDuty routes (ALERT-002)

Source-of-truth for which alert hits which PagerDuty service. Mirror this in the PagerDuty UI; this file is the changelog.

## Services

| PD service          | Description                                                                | Escalation policy        |
| ------------------- | -------------------------------------------------------------------------- | ------------------------ |
| `viza-prod-fe`      | Sentry FE errors above baseline                                            | `viza-primary-escalation`|
| `viza-prod-be`      | Sentry BE errors + agent-backend exceptions                                | `viza-primary-escalation`|
| `viza-runner`       | runner_job failure rate > 25% AND any per-country canary down > 10 min     | `viza-primary-escalation`|
| `viza-data`         | Supabase outages, RLS violations, PII access alerts                        | `viza-primary-escalation`|

All services route runbook URL `https://www.viza.app/docs/operations/oncall.md` in the alert payload (`incident.urls.runbook`). PD UI → Service → Custom Details → `runbook` field.

## Integrations

- **Sentry → PagerDuty**: per-project alert rules
  - `viza-fe-internal-website`: send `error_rate > baseline + 50%` to `viza-prod-fe`
  - `viza-agent-backend`: same threshold to `viza-prod-be`
- **Canary cron**: GitHub Action `runner-matrix.yml` posts to PagerDuty Events API v2 with `routing_key=$VIZA_RUNNER_PD_KEY` when any country fails to reach `stopped_before_pay` in two consecutive nightly runs (configurable threshold).
- **Supabase health**: SQL cron writes to `incident_signal` table; a 1-min cron checks it and pages `viza-data` when severity=critical.

## Escalation policy (`viza-primary-escalation`)

1. **0–5 min**: page `Primary` rotation.
2. **5–15 min**: page `Backup` rotation in addition.
3. **15+ min**: page CTO.
4. **30+ min, no ack**: auto-resolve only after primary explicitly closes.

Override for security/compliance: page CEO + Legal simultaneously.

## Founder rotation

Edit at `https://app.pagerduty.com/schedules/<schedule-id>`. Defaults to weekly handoff Monday 09:00 UTC.

## Test pages

Once a month run a synthetic page from `scripts/page-test.sh` to confirm the rotation is live and the runbook URL still resolves.
