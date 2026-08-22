# VIZA Concurrency Phase Two Design

Date: 2026-08-14

## Objective

Increase VIZA's useful concurrency without making Supabase or Fly machines more
fragile. Postgres remains the source of truth for work and final state.
Cloudflare Queues provides durable wake-up delivery and burst absorption, while
sharded Durable Object gates protect country/provider resources. Fly runners
remain cold-started and must release their capacity after every terminal path.

This phase is complete only when measured results match the acceptance matrix
in this document. A successful build or deployment alone is not acceptance.

## Approved approach

The approved approach is a staged hybrid migration:

1. Publish encrypted `runner_job` wake-up pointers to Cloudflare Queues after
   the Postgres enqueue transaction commits.
2. Replace the high-frequency global runner claim lock with row-scoped,
   country-sharded locking while preserving exact capacity limits.
3. Move Vietnam status-email matching and writes into one bounded, set-based
   service-role RPC.
4. Add a Vietnam status provider gate after the queue path is stable.
5. Migrate notification and document workloads only after the runner and status
   phases meet their release gates.

A full migration of browser-job payloads out of Supabase was rejected. It would
duplicate authoritative state, expand the encrypted replay protocol, and make
rollback and staff visibility harder. A Postgres-only design was also rejected
because it cannot durably buffer wake-up work during a Supabase or Fly control
plane interruption.

## Current-state findings

- VIZA currently calls resilience cache and outbox endpoints, but no production
  application code calls `/v1/queue/enqueue` or `/v1/concurrency/*`.
- The current Queue contract overwrites the business event type with the routing
  workload type. The replay endpoint only accepts `application_answers.v1`, so
  existing answer events cannot safely be switched to the Queue endpoint.
- The deployed runner claim uses a non-blocking global advisory lock. It avoids
  a lock wait queue, but still allows only one country claim transaction to make
  progress at a time and can return false-empty results under contention.
- Vietnam email processing fetches bounded rows but performs application-side
  `tracking.filter` scans and per-candidate writes.
- Existing tests cover Durable Object behavior and mocked Postgres claims, but
  not the signed HTTP producer-to-Queue-to-replay boundary or a real database
  concurrency race.
- The Worker cron and README use a 30-minute scheduled recovery interval. The
  operations runbook must be corrected where it currently says one minute.

## Architecture and ownership

### Authoritative state

Postgres owns:

- job identity, lifecycle, attempts, leases, and final outcomes;
- per-country concurrency configuration;
- application ownership and status evidence;
- notification, document, and status-check records.

Cloudflare owns only:

- encrypted opaque outbox blobs and bounded pointer envelopes;
- delivery attempts, retry state, and dead-letter routing;
- per-resource gate leases and monotonically increasing fencing tokens;
- watchdog state that is already outside the application data plane.

Fly workers own no durable queue state. They claim Postgres work, renew leases
while running, and settle only while they still own the lease.

### Queue event contract

Queue routing and business semantics must be independent:

```ts
type ResilienceQueueEvent = {
  idempotencyKey: string;
  workloadType:
    | "critical_notification"
    | "document_processing"
    | "status_sync"
    | "background";
  eventType: string;
  scope: string;
  userRef?: string;
  blob: string;
  availableAt?: string;
};
```

The Cloudflare Queue envelope remains pointer-only but carries both routing and
business identity:

```ts
type QueuePointer = {
  version: 2;
  idempotencyKey: string;
  workloadType: ResilienceQueueEvent["workloadType"];
  eventType: string;
};
```

The first allowed business event is `runner_job.wakeup.v1`, routed as
`background`. Its encrypted value contains only the runner job UUID and target
pool. It contains no applicant answers, documents, credentials, or payment
data. Later phases add explicitly allowlisted status, notification, and
document event types; arbitrary event names are rejected.

### Runner wake-up flow

1. Vercel atomically enqueues or reuses a Postgres `runner_job`.
2. Only after that transaction succeeds, Vercel signs and sends a
   `runner_job.wakeup.v1` pointer to `/v1/queue/enqueue`.
3. The Worker stores the encrypted event in its SQLite outbox before publishing
   the pointer to the background Queue.
4. The Queue consumer claims that exact outbox item and calls the signed VIZA
   replay route.
5. VIZA decrypts the event, verifies the allowlist, loads the Postgres job, and
   treats terminal, missing, or already-running work as an idempotent no-op.
6. For a live queued job, VIZA calls the existing Fly capacity and authenticated
   wake helpers. The replay response echoes the lease ID and returns ack/nack.
7. The Fly process atomically claims the Postgres row. Queue redelivery cannot
   execute the same row twice because the Postgres status and lease are final.

If Queue publication or the resilience gateway fails, the producer calls the
existing direct Fly wake path. The scheduled Fly reconciler remains the final
recovery path. These fallbacks may issue duplicate wake signals, but they cannot
create a second authoritative job or duplicate a successful claim.

## Postgres claim redesign

Production Fly workers must continue to hold a live `runner_machine_slot`.
Those ten pre-created slots are the global machine semaphore and preserve the
cost ceiling. A worker processes one browser job at a time.

The hot `claim_runner_pool_job` path will no longer acquire the global
`viza-runner-pool-claim` advisory lock. Instead it will:

1. validate the caller's live pool machine slot;
2. choose the oldest eligible job while joining its
   `runner_concurrency_cap` row;
3. acquire row locks on both the candidate job and country cap with
   `FOR UPDATE ... SKIP LOCKED`;
4. re-check the country running count while the country cap row is locked;
5. atomically update and return one job.

Claims for the same country serialize on one cap row. Claims for different
countries proceed concurrently. The machine-slot prerequisite provides the
global limit; the locked country row provides the country limit. Production
must fail closed if a worker that requires a machine slot does not own one.

Expired lease recovery is removed from the unbounded hot-path update. The
existing maintenance RPC remains the scheduled bulk safety net, while a claim
may recover at most one eligible expired row using `SKIP LOCKED`. Required
partial indexes cover queued availability, running country counts, and expired
leases.

The rare machine-slot reservation path may remain serialized because it
protects a fixed ten-row cost semaphore and runs only during machine startup.
The performance target applies to high-frequency job claims, not slot changes.

## Vietnam status-email matching

TypeScript still parses official email text because the parser already handles
localized and HTML content. It sends at most 100 compact inputs to a new
service-role RPC:

```ts
type ParsedVietnamStatusEmail = {
  emailId: string;
  normalizedReference: string | null;
};
```

The RPC validates the JSON array size and performs one set-based operation:

- join the supplied email IDs to `inbound_email`;
- join active tracking rows on normalized recipient address;
- join applications for normalized external references;
- identify zero, unique, and ambiguous matches;
- insert unique `official_status_checks` with idempotency keys;
- insert ambiguity `application_events` with idempotency keys;
- update `last_email_message_id` only for successfully queued unique matches;
- return queued, ambiguous, unmatched, and duplicate counts.

The function is `SECURITY INVOKER`, has an empty search path, is executable only
by `service_role`, and receives no unbounded text supplied by a browser client.
An indexed normalized email expression and Vietnam-specific active-status
indexes must match the function predicates.

## Provider concurrency gate

The first provider gate is `status_sync` with scope `vietnam` and resource key
`evisa/status`. It is introduced only after the runner wake-up Queue phase
passes production observation.

The status worker must:

- acquire before starting an official portal session;
- carry `leaseId` and `fencingToken` through settlement;
- renew before half the lease duration has elapsed;
- release in `finally` after success, failure, timeout, or cancellation;
- treat a rejected renewal or stale fence as lost ownership and refuse the
  final authoritative update.

The initial capacity remains conservative and is not raised without measured
portal and database evidence. A gateway outage fails over to the current
Postgres lease/cap behavior; it never creates unlimited concurrency.

## Error handling and delivery semantics

- Queue delivery is at least once; authoritative application is effectively
  once through Postgres state, idempotency keys, leases, and fencing.
- Invalid signatures, expired timestamps, reused nonces, unknown event types,
  oversized payloads, and malformed encrypted envelopes are rejected.
- Permanent invalid events are acknowledged with a stable error code so they
  cannot poison the Queue indefinitely.
- Temporary Supabase, Fly, or Vercel failures return nack with bounded backoff.
- Replay acknowledgements must echo the exact outbox lease ID. Stale workers
  cannot acknowledge or nack a newer lease.
- Logs contain job prefixes, event type, workload type, latency, attempt count,
  and outcome. They never contain decrypted blobs or applicant PII.
- Dead-letter depth, oldest-message age, claim latency, false-empty claims,
  lease loss, country saturation, and direct-wake fallback counts are exposed
  as structured operational metrics.

## Rollout and rollback

### Phase A: contract and runner wake-up

- Add independent `eventType` support without changing existing v1 outbox
  behavior.
- Add signed Queue/Gate HTTP-boundary tests.
- Enable `runner_job.wakeup.v1` behind a server-only feature flag.
- Start at a small rollout percentage, then increase after observation.
- Keep direct wake and autoscaler fallbacks active.

Rollback disables Queue publication. Existing Queue deliveries remain safe
idempotent wake attempts, and Postgres polling continues.

### Phase B: sharded Postgres claim

- Apply indexes and the new claim function in a staging database.
- Run the database-only race harness.
- Deploy workers only after migration verification.
- Observe claim latency, cap adherence, and queue depth before removing the old
  function body from rollback scripts.

Rollback restores the previous non-blocking advisory-lock function. No table or
event format rollback is required.

### Phase C: Vietnam set-based matching and status gate

- Apply the RPC and indexes in staging.
- Compare old and new matching results against fixtures before switching.
- Enable the SQL matcher, then the status provider gate, as separate flags.

Rollback restores the TypeScript matcher and Postgres-only status lease. New
idempotency constraints keep already-created rows safe.

Notification and document workloads are intentionally deferred until Phases A
through C meet their acceptance gates. They will reuse the same event contract
but receive separate allowlists and workload-specific tests.

## Verification strategy

All behavior changes follow test-driven development: add a focused failing test,
observe the expected failure, implement the minimum behavior, and rerun the
focused and package suites.

### Automated tests

- Next.js gateway: signed queue enqueue request, routing/business event
  separation, timeout, and fallback behavior.
- Worker HTTP producer: HMAC verification, binding selection, v2 pointer,
  delayed availability, persisted-outbox behavior when Queue publication fails.
- Queue consumer: duplicate delivery, active lease retry, expired lease reclaim,
  replay ack/nack with exact lease, and unsupported event handling.
- Replay route: valid `runner_job.wakeup.v1`, terminal no-op, missing job,
  transient Fly failure, bad HMAC, and no secret/PII disclosure.
- Gate HTTP boundary: acquire, renew, release, shard isolation, capacity,
  expiry, stale lease, and stale fencing token.
- Migration contracts: service-role-only grants, `SKIP LOCKED`, cap-row locking,
  bounded recovery, partial indexes, and no high-frequency global advisory lock.
- Vietnam RPC fixtures: unique match, ambiguous reference, missing reference,
  duplicate email, inactive tracking, case-insensitive alias, and 100-item bound.

### Staging load harness

The harness creates synthetic applications and jobs with a unique run prefix.
It must not call official portals, start billable browser machines, send real
notifications, or use payment providers. Cleanup runs in `finally` and verifies
that no synthetic rows remain.

Run levels are 100, 300, 600, and 1,000 jobs with a 30-minute steady phase and a
short burst phase. The harness records p50, p95, and p99 claim latency, duplicate
claims, running counts, lease loss, database errors, connection usage, and queue
drain time.

## Acceptance matrix

| Measurement | Expected result | Release rule |
| --- | --- | --- |
| Duplicate authoritative claims | 0 | Any duplicate blocks release |
| Per-country cap overshoot | 0 | Any overshoot blocks release |
| Global production slot overshoot | 0 | Any overshoot blocks release |
| Stale-lease final writes | 0 | Any stale write blocks release |
| Queue duplicate wake executions | At most one effective wake per job | Any duplicate execution blocks release |
| Claim latency | p95 below 500 ms at every load level | A failed level blocks rollout increase |
| Database stability | 0 database 5xx, lock timeouts, or connection exhaustion | Any occurrence blocks release |
| Queue recovery | Temporary failures retry and eventually ack; permanent invalid events terminate | Unbounded retry blocks release |
| Vietnam matching parity | Expected fixture counts match exactly | Any mismatch blocks Phase C |
| Synthetic data cleanup | 0 remaining rows | Any residue blocks completion |
| Cost guardrail | Idle Fly machines stop; every terminal path releases capacity | Any leaked machine blocks release |

After each test or production observation window, the implementation report must
list the measured value beside the expected value. Results may not be summarized
only as "passed". If an expectation is missed, the phase remains disabled or is
rolled back, and the discrepancy is diagnosed before another rollout attempt.

## Documentation updates

Implementation updates must keep these sources consistent:

- `docs/infra/queue.md` for the active hybrid transport;
- `docs/operations/viza-zero-ops-resilience.md` for the actual 30-minute
  scheduled recovery interval and production runbook;
- `viza-be/resilience-worker/README.md` and nearest `AGENTS.md` files for event
  contracts, bindings, rollback flags, and tests;
- frontend and backend module guides when new files or RPCs are added.

## Out of scope

- PITR, which remains deferred because of its current monthly cost;
- moving authoritative application or runner state out of Postgres;
- increasing official-portal concurrency without measurements;
- keeping idle Fly runners continuously running;
- introducing Redis, BullMQ, or another queue system;
- migrating every notification or document producer in the first rollout.
