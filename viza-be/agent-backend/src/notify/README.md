# Notification worker

`startWorker()` (in `worker.ts`) is the long-running drain. It polls `notification_event_log` for `outcome='queued'` rows whose `next_attempt_at` has passed and dispatches them through the per-channel sender.

## Contract

- **Cadence**: poll every `POLL_INTERVAL_MS` (30s by default).
- **Max attempts**: 5 per event. Backoff schedule `[1m, 5m, 15m, 30m, 1h]`.
- **Terminal failure**: writes to `notification_dlq` (admin replay via `/admin/notifications/dlq`).
- **Templates**: per-event under `src/notify/templates/*`. `resolveTemplate(key)` returns null on miss → row marked `failed_no_template:<key>`.
- **Channels**: `email` → Resend, `sms` → Twilio. Both lazy-load their SDK so tsc passes without the dep installed.

## Shutdown contract (FIX-003)

The worker installs **SIGTERM + SIGINT** handlers. On signal:

1. `shutdownRequested` flag flips.
2. Current in-flight `processOnce()` tick is allowed to finish.
3. Loop exits before the next `setTimeout`.
4. Container exits cleanly within ≤30s of signal (worst case is the current tick's 50-row batch finishing).

Deploy targets should send SIGTERM with a 30–60s grace period. Kubernetes default `terminationGracePeriodSeconds: 60` works.

## Adding a template

1. Create `src/notify/templates/<key>.ts` exporting a `NotificationTemplate`.
2. Register it in `src/notify/templates/index.ts` under `TEMPLATES[key]`.
3. The producer-side caller queues a row:
   ```ts
   await supabase.from("notification_event_log").insert({
     applicant_id, application_id, event: "<key>",
     template_key: "<key>", channel: "email",
     recipient: "applicant@example.com",
     payload: { /* matches the template schema */ },
     outcome: "queued",
   });
   ```
4. Worker picks it up within 30s.

## DLQ replay

Failed-terminal rows land in `notification_dlq`. Staff opens `/admin/notifications/dlq` and clicks Replay; the row is re-inserted into `notification_event_log` with `retry_count=0` and the original payload + recipient + template_key, and the DLQ row stamps `replayed_at`.
