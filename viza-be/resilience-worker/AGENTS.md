# Resilience Worker Agent Guide

This module owns the independent Cloudflare watchdog and server-to-server
resilience gateway. Keep its scope isolated from the existing GitHub
`scripts/supabase-self-heal.mjs`, frontend session work, and Supabase schema.

`src/index.ts` owns the Worker and Durable Object entry points; pure watchdog
configuration, probe-status, and health evaluation helpers live in
`src/watchdog-health.ts` so Wrangler can generate runtime types without
mistaking test helpers for additional Worker entry points.

Cloudflare data-plane contracts also live in `src/index.ts`:

- `ResilienceState` remains the durable outbox/idempotency and lease source of
  truth. Queue payloads are bounded pointers, never copies of applicant data.
- The three workload Queue bindings separate critical notifications,
  document/status work, and background work. Consumers must explicitly ack or
  retry every delivery after consulting the outbox lease.
- `ConcurrencyGate` is sharded with `getByName()` from normalized
  `scope`/`resourceKey`. Never introduce a single global concurrency gate.
  Acquire/renew/release require the lease ID and monotonically increasing
  fencing token documented in `README.md`.

## Security boundaries

- Never commit or log `VIZA_RESILIENCE_HMAC_SECRET`,
  `SUPABASE_MANAGEMENT_API_TOKEN`, or `SUPABASE_ANON_KEY`; provision them with
  `wrangler secret put`.
- VIZA encrypts cache/outbox blobs before sending them. This Worker stores and
  forwards opaque ciphertext and must never decrypt or inspect it.
- HMAC signs the exact raw request body and URL pathname. Keep timestamp and
  nonce replay protection enabled.
- Logs may contain only event names, statuses, timings, counts, and error
  categories. Do not log user references, cache keys, or payloads.

## Validation

```powershell
npm run type-check
npm test
npm run deploy:dry-run
```

After changing bindings, run `npm run types` and keep
`worker-configuration.d.ts` checked in. Do not run `wrangler queues create`,
`wrangler secret put`, or deploy without explicit operator authorization.

Production deployment requires explicit user authorization. The operator must
set the secrets and project variables documented in `README.md`, verify the
management token scope, and explicitly enable auto-restart only after healthy
production probes.
