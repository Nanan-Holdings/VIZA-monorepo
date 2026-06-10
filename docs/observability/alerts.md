# Runner Alerts (OBSV-002)

Alerts route through `src/alerts/dispatch.ts#sendAlert` (Slack + email, per-class
throttled). Routing classes:

| Class | Severity | Trigger | Builder |
| --- | --- | --- | --- |
| `runner.failed.<country>` | error | runner_job hit max_attempts (worker.ts markFailedWithRetry) | inline in worker.ts |
| `runner.halted_stuck.<country>` | warn | halt-before-gov-pay job aged past threshold (applicant hasn't paid) | `buildHaltedStuckAlert` |

`buildHaltedStuckAlert({country, jobId, applicationId, ageHours})` returns an
AlertInput (warn, 6h throttle) — a sweeper passes it to `sendAlert` when a job
sits in `succeeded`+halted beyond the action window. Dead-letter rows are
covered by `runner.failed.*` + the QUE-007 dead-letter visibility script.
Payload shape is covered by `src/alerts/__tests__/halted-stuck.spec.ts`.
