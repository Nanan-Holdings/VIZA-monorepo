# VIZA resilience Worker

An independent Cloudflare Worker for Supabase health recovery and the
server-to-server resilience gateway. It has no frontend or database runtime
dependency. `ResilienceState` stores the probe/circuit state, replay nonce set,
encrypted cache blobs, outbox leases and restart history with SQLite
transactions for atomicity. Workload concurrency uses a separate
`ConcurrencyGate` instance for every normalized `scope`/`resourceKey` tuple;
there is intentionally no global concurrency gate.

## Endpoints

`GET /health` is read-only and intentionally contains no secrets or encrypted
payloads. Every `/v1/*` request requires the HMAC headers below:

```text
X-Viza-Key-Id: viza-web-v1
X-Viza-Timestamp: <unix seconds>
X-Viza-Nonce: <unique request nonce>
X-Viza-Signature: hex(HMAC-SHA256(secret,
  METHOD + "\n" + PATH + "\n" + timestamp + "\n" + nonce + "\n" + SHA256(raw body)))
```

Requests outside the five-minute clock window or with a reused nonce are
rejected. The Worker never decrypts, parses, or logs `blob`; VIZA owns the
encryption key and plaintext handling.

`GET /health` returns HTTP 200 only when a healthy probe is no more than 35
minutes old and the latest scheduled run succeeded. This matches the 30-minute
Cron cadence with a five-minute scheduling-jitter allowance. A stale, unhealthy, or
scheduled-failure state returns HTTP 503 and includes the persisted diagnostic
state for monitoring.

| Path | Body | Result |
| --- | --- | --- |
| `POST /v1/cache/put` | `{userRef,scope,key,blob,ttlSeconds,oneTime?}` | `{ok,expiresAt}` |
| `POST /v1/cache/get` | `{userRef,scope,key}` | `{ok,hit,blob?,expiresAt?}` |
| `POST /v1/cache/consume` | `{userRef,scope,key}` | Atomic read-and-delete; `{ok,hit,blob?}` |
| `POST /v1/outbox/enqueue` | `{idempotencyKey,userRef?,scope,eventType,blob,availableAt?}` | `{ok,accepted,duplicate}` |
| `POST /v1/outbox/claim` | `{limit?,leaseSeconds?}` | `{ok,items:[...leaseId,attempts...]}` |
| `POST /v1/outbox/ack` | `{idempotencyKeys}` or `{items:[{idempotencyKey,leaseId}]}` | `{ok,acknowledged}` |
| `POST /v1/outbox/nack` | `{items:[{idempotencyKey,leaseId,errorCode?,retryAfterSeconds?}]}` | `{ok,retried,dead}` |
| `POST /v1/queue/enqueue` | `{idempotencyKey,workloadType,eventType,scope,blob,userRef?,availableAt?}` | Persists the outbox item, then queues its bounded opaque pointer |
| `POST /v1/concurrency/acquire` | `{scope,resourceKey,capacity,leaseSeconds,ownerRef?}` | Acquire capacity and receive `{leaseId,fencingToken,leaseUntil}` |
| `POST /v1/concurrency/renew` | `{scope,resourceKey,leaseId,fencingToken,leaseSeconds}` | Extend a live lease when its fencing token still matches |
| `POST /v1/concurrency/release` | `{scope,resourceKey,leaseId,fencingToken}` | Release a live fenced lease |

## Mandatory v2 queue rollout guard (release blocker)

Queue envelopes are strict v2 and are not backward-compatible. Before deploying
the v2 consumer, operators must complete this sequence:

1. Stop or disable every v1 queue producer.
2. Let all three named queues drain completely under the old consumer.
3. Confirm zero backlog for all three queues in Cloudflare Queue metrics.
4. Deploy the v2 consumer, then enable only v2 producers.

This is a mandatory release gate. A v1 envelope has no independent `eventType`
and cannot be translated safely; v1 messages must not be present at cutover.
If one appears after cutover, the consumer emits the structured
`queue_legacy_v1_rejected` signal with reason `v1_not_translatable` and
acknowledges it to avoid a retry loop. Treat that signal as a rollout incident,
not as a migration path.

## Cloudflare Queue contracts

The Worker separates work across three real Queue bindings:

| Workload type | Queue | Intended latency |
| --- | --- | --- |
| `critical_notification` | `viza-resilience-critical-notifications` | Critical/low-latency notifications |
| `document_processing`, `status_sync` | `viza-resilience-document-status` | Document and official-status work |
| `background` | `viza-resilience-background` | Best-effort background work |

`POST /v1/queue/enqueue` accepts those four workload types and exactly these
four business event types: `runner_job.wakeup.v1`, `vietnam_status_sync.v1`,
`critical_notification.v1`, and `document_processing.v1`. `blob` is an opaque
string capped at 96,000 UTF-8 bytes. The existing SQLite outbox retains the blob
and idempotency/lease state; Cloudflare Queues receives only this bounded pointer
envelope:

```json
{"version":2,"idempotencyKey":"unique-operation-id","workloadType":"status_sync","eventType":"vietnam_status_sync.v1"}
```

The Queue consumer claims the matching outbox record by idempotency key before
calling `VIZA_RESILIENCE_REPLAY_URL`. A repeated Queue delivery observes an
acked row and is acknowledged without invoking the downstream again. An active
lease causes Queue retry; an expired lease can be reclaimed. Consumers use
explicit per-message `ack()`/`retry()`, and the scheduled outbox replay remains
a recovery path if Queue publication fails.

## Sharded concurrency gate contract

Every gate request is HMAC authenticated like the other `/v1/*` routes. The
Worker deterministically calls `CONCURRENCY_GATE.getByName()` with normalized,
URL-encoded `v1:<scope>:<resourceKey>`. Callers should choose a narrow resource
key such as `country/provider/resource`; unrelated providers or countries then
never share a Durable Object bottleneck.

`acquire` fixes `capacity` for a shard while leases are active and returns a
monotonically increasing `fencingToken`. Pass both `leaseId` and
`fencingToken` to `renew` or `release`, and to any protected downstream write.
Expired or stale credentials cannot renew/release. SQLite state survives
eviction, and a per-shard alarm reclaims expiry without a global sweeper.

Example acquire response:

```json
{
  "ok": true,
  "shard": "v1:submission:vn%2Fofficial-evisa%2Fbrowser",
  "acquired": true,
  "capacity": 4,
  "active": 1,
  "leaseId": "uuid",
  "fencingToken": 42,
  "leaseUntil": 1786600000000
}
```

Claimed items are POSTed by the scheduled recovery handler to
`VIZA_RESILIENCE_REPLAY_URL` every 30 minutes. Queue consumers remain the
normal low-latency delivery path. The replay endpoint must return:

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

Tests cover nonce replay rejection, concurrent one-time cache consumption,
outbox idempotency/lease behavior, duplicate Queue delivery, and concurrent
sharded gate capacity/expiry fencing. The test runtime may lag the current
compatibility date; update `wrangler.jsonc` after upgrading the local Workerd.

## Deployment secrets and configuration

Set secrets interactively; do not commit them:

```powershell
npx wrangler secret put VIZA_RESILIENCE_HMAC_SECRET
npx wrangler secret put SUPABASE_MANAGEMENT_API_TOKEN
npx wrangler secret put SUPABASE_ANON_KEY
```

Required bindings/vars are in `wrangler.jsonc`: `SUPABASE_URL`,
`SUPABASE_PROJECT_REF` (production ref `oyjxdzsoejraedqghndi`; startup and
runtime checks reject another project),
`VIZA_RESILIENCE_REPLAY_URL` (optional until VIZA replay route is live), and
the watchdog thresholds. Keep `WATCHDOG_AUTO_RESTART=false` until the project
ref/token have been verified in staging; enable it only with a Management API
token scoped to `projects:write`.

Queue and Durable Object declarations are also in `wrangler.jsonc`, but this
repository change does not create resources or deploy. Before a later,
explicitly authorized deployment, the operator must provision the three named
Queues (and any desired dead-letter Queues), verify plan limits, then deploy the
`v2` SQLite migration that introduces `ConcurrencyGate`.

Production is deployed at
`https://viza-resilience-worker.nanan-viza2016.workers.dev`. Auto-restart is
enabled after successful Auth 200, PostgREST 200, and invalid-key control 401
probes. The legacy GitHub restart workflow is disabled so only the Durable
Object lease can authorize recovery.
