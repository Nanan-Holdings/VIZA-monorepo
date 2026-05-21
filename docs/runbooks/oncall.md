# On-call rotation + escalation policy (OPS-007)

> Last reviewed: 2026-05-07.

## Schedule

The on-call rotation is published in **PagerDuty** at
`viza.pagerduty.com/schedules/<id>` (link populated post-provisioning;
ops to fill before public launch). Two-person rotation, weekly,
hand-off Monday 09:00 SGT.

| Slot | Coverage | Default holder |
|---|---|---|
| Primary | 24×7 — pages first | rotates weekly |
| Secondary | only if primary acks > 10 min | rotates weekly, opposite phase |
| Maintainer | edge cases, irreversible decisions | Edward (Zehua) Zhang |

The corresponding Slack alias `@viza-oncall` is wired to the
PagerDuty schedule so non-paging mentions route to whoever is on
right now.

## Escalation tree

1. **Page** lands on primary via PagerDuty (push + SMS + voice).
2. If unacked at **10 minutes** → secondary.
3. If unacked at **20 minutes** → maintainer.
4. If maintainer is unreachable at **30 minutes** → CEO mailbox
   `edward.zehua.zhang@gmail.com` and any operator on the Slack
   channel `#viza-ops`.

A page is created automatically by OPS-003 dispatcher for
`error` / `critical` severity. `warn` and `info` Slack messages do
not page.

## Severity → response SLA

| Severity | First-ack target | Status update cadence |
|---|---|---|
| critical | 5 min | every 15 min while open |
| error | 15 min | every 30 min while open |
| warn | by next business hour | one update at resolution |

## Drills (monthly)

Once per month — first Tuesday at 14:00 SGT — an ops member sends
a synthetic "test page" through PagerDuty:

```
PD → Schedules → on-call → Test notification (escalation policy)
```

Confirm:

- Primary received the page on every configured channel (push,
  SMS, voice).
- Slack `@viza-oncall` mention reached the correct person.
- The OPS-003 alert link in the page body opens
  `/admin/jobs/<placeholder>` without 404.
- Silence drill: trigger a synthetic alert via
  `viza-be/agent-backend/scripts/canary.ts` against a probe URL
  hard-coded to a known-good server, verify nothing fires.

Drill completion is tracked in this file under "Drill log" below;
update on each pass.

## Drill log

| Date | Driver | Result | Notes |
|---|---|---|---|
| _pending first run_ | — | — | runbook landed 2026-05-07; first drill schedules on the next first-Tuesday-of-month after PagerDuty provisioning |

## Hand-off ritual

- Outgoing primary posts in `#viza-ops` 30 minutes before hand-off:
  - any open incidents
  - alerts they expect to fire
  - any temporary configuration changes (paused countries, raised
    concurrency caps, etc.) that the incoming primary should
    monitor or revert.
- Incoming primary acknowledges in-channel.

## Linked from

- [docs/ops/alerting.md](../ops/alerting.md) — OPS-003 dispatcher.
- Per-class runbooks under [docs/runbooks/](./README.md).
