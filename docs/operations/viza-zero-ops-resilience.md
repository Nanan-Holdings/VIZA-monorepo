# VIZA zero-touch resilience

This runbook describes the three-layer Supabase failure containment design.
"Zero-touch" means routine detection, containment, restart, and replay do not
need an operator. It does not mean a system can be guaranteed to run forever
without billing, credentials, provider availability, or disaster recovery.

## Layer 1: remove database pressure amplifiers

- `client_session` is a signed, HttpOnly VIZA session. Ordinary client routes
  and server actions use it before calling Supabase Auth. Payments, account
  security, operator takeover, and other high-assurance actions keep their
  online provider checks.
- A process-level circuit breaker opens after repeated Supabase 5xx/network
  failures, rejects amplification traffic for 20 seconds, and permits one
  half-open probe.
- Migration `20260812072627_harden_runner_claim_and_status_cron.sql` makes the
  high-frequency shared runner claim non-blocking, indexes expired leases and
  country concurrency counts, and changes Vietnam status cron to a bounded
  500-row `SKIP LOCKED` batch.
- The same migration installs `replay_resilient_application_answers`, which
  validates application ownership and refuses to let a stale replay overwrite
  a newer field value.

## Layer 2: remove Supabase from the availability critical path

The independent `viza-be/resilience-worker` Cloudflare Worker stores only
opaque AES-256-GCM ciphertext. VIZA and the Worker authenticate requests using
HMAC-SHA256 over method, path, timestamp, nonce, and the SHA-256 request-body
digest. Durable Object SQLite provides strongly consistent nonce, cache,
outbox, lease, restart, and cooldown state.

- Existing VIZA sessions remain usable while Supabase Auth is unavailable.
- Successful sessions cache a minimal encrypted email/profile mapping for 30
  days. During a confirmed Auth outage, code login falls back to an eight-digit
  Resend code stored as a one-time, atomic Worker cache value for ten minutes.
- Dynamic application answers refresh a 30-day encrypted cache. When the
  Supabase data plane times out, autosave enqueues an encrypted idempotent event
  instead of losing the applicant's work.
- Every minute, the Worker attempts a bounded replay batch. VIZA decrypts only
  allowlisted event types and rechecks ownership before a service-role RPC.
  Ack/nack and leases make delivery at-least-once and database application
  effectively once under duplicate and out-of-order delivery.

## Layer 3: independent watchdog and disaster recovery

The Worker cron runs every minute outside GitHub Actions and outside Supabase.
Each run performs three Auth and REST checks inside the same invocation. A
Durable Object lease allows only one restart. The default circuit breaker
allows one restart per hour and enforces a 30-minute cooldown. A disabled
`WATCHDOG_AUTO_RESTART` always fails safe during initial deployment.

Supabase daily physical backups are provider-managed on paid plans. PITR is a
paid add-on and is intentionally deferred for the current rollout. Backups do
not include Storage object contents, so continue the separate R2/object backup
policy for uploaded documents.

## One-time production configuration

Generate independent secrets (never reuse one key for both purposes):

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Configure Vercel server-only values:

- `VIZA_RESILIENCE_GATEWAY_URL`
- `VIZA_RESILIENCE_HMAC_KEY_ID`
- `VIZA_RESILIENCE_HMAC_SECRET`
- `VIZA_RESILIENCE_DATA_KEY`
- existing `CLIENT_SESSION_SECRET`, `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`

Configure Worker secrets with `wrangler secret put`:

- `VIZA_RESILIENCE_HMAC_SECRET` (same HMAC secret as Vercel)
- `SUPABASE_MANAGEMENT_API_TOKEN`

Configure Worker vars in `wrangler.jsonc` and keep the publishable probe key as
a Worker secret:

- Supabase project URL and project ref
- `SUPABASE_ANON_KEY` as a Worker secret (legacy anon key is used for the Auth
  settings and zero-row PostgREST probes)
- `VIZA_RESILIENCE_REPLAY_URL=https://app.viza.it.com/api/resilience/replay`
- the same HMAC key ID as Vercel
- switch `WATCHDOG_AUTO_RESTART` to `true` only after dry-run tests pass

Deploy the frontend and Worker, apply the Supabase migration, then run these
acceptance tests:

1. `/health` returns `ok` without exposing configuration or cached data.
2. A bad HMAC and replayed nonce are rejected.
3. Two concurrent consumes of one OTP produce exactly one hit.
4. Two identical outbox events produce one stored event.
5. Disable Supabase access in a preview deployment: existing VIZA sessions stay
   valid, code login sends a continuity OTP, and answer save reports success.
6. Restore access: queued answers replay, a stale event cannot overwrite a newer
   answer, and the outbox drains.
7. In a non-production project, force three failed probes and confirm one
   restart, then confirm cooldown suppresses a second restart.

Do not leave a second controller with restart permission. The legacy GitHub
watchdog was disabled after the Worker passed production Auth/PostgREST/control
probes; Cloudflare Durable Object leases are now the single restart authority.
