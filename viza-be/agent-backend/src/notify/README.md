# Notification worker

`startWorker()` (in `worker.ts`) is the long-running drain. Each tick calls the
service-role-only `claim_notification_event_batch` RPC. The RPC atomically
claims due rows with `FOR UPDATE SKIP LOCKED`, assigns a worker identity and
lease, and recovers abandoned `processing` rows after their lease expires.

## Contract

- **Cadence**: poll every `POLL_INTERVAL_MS` (30s by default).
- **Ownership**: `NOTIFICATION_WORKER_ID` may provide a stable deployment
  identity; otherwise the process generates a unique host/PID/UUID identity.
- **Lease**: 15 minutes by default in the TypeScript worker. A delivery settles
  only through conditional ack/nack RPCs while its worker still owns a live
  lease. This is at-least-once delivery; provider-side idempotency remains
  advisable for the crash window after provider acceptance and before ack.
- **Max attempts**: 5 per event. Backoff schedule `[1m, 5m, 15m, 30m, 1h]`.
- **Terminal failure**: conditional nack and DLQ insert occur in the same
  database transaction (admin replay via `/admin/notifications/dlq`).
- **Templates**: per-event under `src/notify/templates/*`. `resolveTemplate(key)` returns null on miss → row marked `failed_no_template:<key>`.
- **Channels**: `email` → Resend, `sms` → Twilio. Both lazy-load their SDK so tsc passes without the dep installed.

## Shutdown contract (FIX-003)

The worker installs **SIGTERM + SIGINT** handlers. On signal:

1. `shutdownRequested` flag flips.
2. Current in-flight `processOnce()` tick is allowed to finish; unacknowledged
   rows become claimable by another worker after lease expiry.
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
