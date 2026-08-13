# VIZA resilience Worker

An independent Cloudflare Worker for Supabase health recovery and the
server-to-server resilience gateway. It has no frontend or database runtime
dependency. A single Durable Object (`ResilienceState`) stores the probe/circuit
state, replay nonce set, encrypted cache blobs, outbox leases and restart
history with SQLite transactions for atomicity.

## Endpoints

`GET /health` is read-only and intentionally contains no secrets or encrypted
payloads. Every `/v1/*` request requires the HMAC headers below:

```text
X-Viza-Key-Id: primary
X-Viza-Timestamp: <unix seconds>
X-Viza-Nonce: <unique request nonce>
X-Viza-Signature: hex(HMAC-SHA256(secret,
  METHOD + "\n" + PATH + "\n" + timestamp + "\n" + nonce + "\n" + SHA256(raw body)))
```

Requests outside the five-minute clock window or with a reused nonce are
rejected. The Worker never decrypts, parses, or logs `blob`; VIZA owns the
encryption key and plaintext handling.

| Path | Body | Result |
| --- | --- | --- |
| `POST /v1/cache/put` | `{userRef,scope,key,blob,ttlSeconds,oneTime?}` | `{ok,expiresAt}` |
| `POST /v1/cache/get` | `{userRef,scope,key}` | `{ok,hit,blob?,expiresAt?}` |
| `POST /v1/cache/consume` | `{userRef,scope,key}` | Atomic read-and-delete; `{ok,hit,blob?}` |
| `POST /v1/outbox/enqueue` | `{idempotencyKey,userRef?,scope,eventType,blob,availableAt?}` | `{ok,accepted,duplicate}` |
| `POST /v1/outbox/claim` | `{limit?,leaseSeconds?}` | `{ok,items:[...leaseId,attempts...]}` |
| `POST /v1/outbox/ack` | `{idempotencyKeys}` or `{items:[{idempotencyKey,leaseId}]}` | `{ok,acknowledged}` |
| `POST /v1/outbox/nack` | `{items:[{idempotencyKey,leaseId,errorCode?,retryAfterSeconds?}]}` | `{ok,retried,dead}` |

Claimed items are POSTed by the scheduled handler to
`VIZA_RESILIENCE_REPLAY_URL` every minute. The replay endpoint must return:

```json
{"results":[
  {"idempotencyKey":"…","leaseId":"…","outcome":"ack"},
  {"idempotencyKey":"…","leaseId":"…","outcome":"nack","errorCode":"temporary","retryAfterSeconds":60}
]}
```

The same HMAC headers/canonical string are used for this Worker-to-VIZA POST;
the encrypted blob is forwarded unchanged. A missing/invalid response nacks
the whole claimed batch for a later retry. Leases, idempotency keys and retry
limits prevent duplicate side effects.

## Local validation

```powershell
npm install
npm run type-check
npm test
npm run deploy:dry-run
```

Tests cover nonce replay rejection, concurrent one-time cache consumption and
outbox idempotency/lease behavior. The test runtime may lag the current
compatibility date; update `wrangler.jsonc` after upgrading the local Workerd.

## Deployment secrets and configuration

Set secrets interactively; do not commit them:

```powershell
npx wrangler secret put VIZA_RESILIENCE_HMAC_SECRET
npx wrangler secret put SUPABASE_MANAGEMENT_API_TOKEN
npx wrangler secret put SUPABASE_ANON_KEY
```

Required bindings/vars are in `wrangler.jsonc`: `SUPABASE_URL`,
`SUPABASE_PROJECT_REF`,
`VIZA_RESILIENCE_REPLAY_URL` (optional until VIZA replay route is live), and
the watchdog thresholds. Keep `WATCHDOG_AUTO_RESTART=false` until the project
ref/token have been verified in staging; enable it only with a Management API
token scoped to `projects:write`.

Production is deployed at
`https://viza-resilience-worker.nanan-viza2016.workers.dev`. Auto-restart is
enabled after successful Auth 200, PostgREST 200, and invalid-key control 401
probes. The legacy GitHub restart workflow is disabled so only the Durable
Object lease can authorize recovery.
