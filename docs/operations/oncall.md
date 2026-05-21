# On-call runbook

> Linked from every PagerDuty alert payload. First-response target < 5 min from page.

## 1. Acknowledge

1. Click the PagerDuty link on your phone.
2. Tap **Acknowledge**. This stops further pages for the same incident going to the next person in the rotation.
3. Drop a one-liner in `#oncall` so the team sees the page is being handled.

If you've been paged but can't take it (driving, on a flight, etc.), tap **Reassign** and pick the next person in the rotation. Don't silently ignore.

## 2. Common alerts

| Alert source                       | What it means                                                  | First action                                                                                       |
| ---------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `sentry.error_rate` > baseline     | Crash spike on the FE / BE                                     | Open the linked Sentry issue, look at affected release SHA, decide whether to roll back            |
| `runner_job.failure_rate` > 25%    | Multiple country runners failing                               | Check `/admin/portal-health`, look at recent commits to `viza-be/submission-service/`              |
| `canary.kh.down` / `.la` / `.lk`   | Per-country canary submission failed > 10 min                  | Check `recon-out/<latest>/<country>/` for anti-bot status, then runner_job for the failing job     |
| `notification_event_log.dlq` > 10  | Email/SMS sender backed up                                     | Open `/admin/notifications/dlq`, replay or fix the upstream issue                                  |
| `face_match_audit.staff_review`    | Suspicious face-match batch                                    | Open `/admin` queue, manually review                                                               |
| `sla.breach.<country>` > N         | Government processing time exceeded SLA for N+ apps            | Reach out to applicants per the per-country SLA template; doesn't always require code change       |

## 3. Escalation

1. If the alert blocks revenue (payments, runners, or `/home` is broken for everyone), page the **CTO** via PagerDuty escalation policy.
2. If the alert is a security or compliance incident (face-match staff_review on a public name, DOA leakage), page the **CEO + Legal** simultaneously.
3. After 30 min without progress, page a backup engineer regardless of severity.

## 4. Common commands

```bash
# Roll back last deploy on Vercel
vercel --token "$VERCEL_TOKEN" alias set <previous-deploy-url> www.viza.app

# Inspect the failing runner job
psql "$DATABASE_URL" -c "select * from runner_job order by enqueued_at desc limit 5;"

# Replay a stuck DLQ row from CLI
curl -X POST -H "Authorization: Bearer $STAFF_JWT" \
     https://www.viza.app/api/admin/notifications/dlq/<id>/replay
```

## 5. Post-incident retro

Within 24 hours of resolution, the on-call writes a retro using the template at `docs/operations/incident-retro-template.md`:

- **What happened?**
- **Timeline (UTC).**
- **Customer impact (count, duration, dollars at risk).**
- **Root cause (5 whys).**
- **What worked / what didn't.**
- **Follow-up actions** (assigned owner + deadline).

The retro lands in `docs/operations/incidents/YYYY-MM-DD-<slug>.md` and is reviewed in the next ops weekly.

## 6. Pager rotation

- **Primary**: see PagerDuty schedule "VIZA primary".
- **Backup**: see PagerDuty schedule "VIZA backup".
- **Override** for vacations / sick days: edit your slot in PagerDuty before it starts; never just turn off your phone.
