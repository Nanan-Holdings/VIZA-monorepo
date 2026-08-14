# VIZA Concurrency Phase Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved staged hybrid concurrency upgrade: Postgres remains authoritative, Cloudflare Queues durably delivers encrypted wake pointers, runner claims scale by country without a hot global lock, and Vietnam status work uses set-based matching plus fenced provider capacity.

**Architecture:** Vercel commits an idempotent Postgres job before publishing a signed encrypted pointer to Cloudflare. Queue consumers call an allowlisted replay route that only wakes Fly; Fly still atomically claims Postgres work. Production machine slots enforce the global cost cap, country cap rows serialize only same-country claims, and a sharded Durable Object gate protects the Vietnam status provider.

**Tech Stack:** Next.js 16, TypeScript 5.9, Vitest, Supabase/Postgres PL/pgSQL, Cloudflare Workers/Queues/Durable Objects, Wrangler, Node test runner, Fly.io.

---

## Scope decomposition and file map

This plan is executed in three independently reversible phases. Phase A is the
Queue contract and runner wake path. Phase B is Postgres claim sharding and the
Vietnam set-based matcher. Phase C is the provider gate and staging load gate.
Do not enable a later phase until the previous phase's measured acceptance rows
pass.

Files and responsibilities:

- `viza-be/resilience-worker/src/index.ts`: v2 Queue pointer validation,
  routing, HMAC HTTP endpoints, and Queue consumption.
- `viza-be/resilience-worker/src/index.test.ts`: signed producer, binding,
  duplicate delivery, replay lease, and Gate HTTP-boundary tests.
- `viza-fe/internal-website/lib/resilience/gateway.ts`: shared encrypted/HMAC
  Queue client.
- `viza-fe/internal-website/lib/resilience/runner-job-wakeup.ts`: typed
  `runner_job.wakeup.v1` event creation and replay validation.
- `viza-fe/internal-website/lib/resilience/runner-job-wakeup.test.ts`: event
  encryption/enqueue contract tests.
- `viza-fe/internal-website/app/api/resilience/replay/route.ts`: allowlisted
  runner wake replay in addition to application-answer replay.
- `viza-fe/internal-website/app/api/resilience/replay/route.test.ts`: signed
  replay behavior and idempotent terminal states.
- `viza-fe/internal-website/lib/queue/enqueue.ts`: publish Queue wake after the
  Postgres enqueue commits; keep direct wake as fallback.
- `viza-fe/internal-website/lib/queue/enqueue.test.ts`: Queue-primary and
  direct-wake fallback behavior.
- `viza-be/agent-backend/drizzle/0139_concurrency_phase_two.sql`: canonical SQL
  for sharded runner claims, indexes, and Vietnam email matching RPC.
- `viza-be/agent-backend/src/tests/concurrency-phase-two-migration.test.ts`:
  SQL security, lock, index, and bounded-work regression tests.
- `viza-fe/internal-website/supabase/migrations/`: a CLI-generated migration
  named `concurrency_phase_two` whose content must exactly match the canonical
  `0139` SQL file.
- `viza-be/submission-service/src/vietnam/email-status-matcher.ts`: bounded
  TypeScript parser-to-RPC adapter.
- `viza-be/submission-service/src/vietnam/__tests__/email-status-matcher.spec.ts`:
  RPC payload/count/error tests.
- `viza-be/submission-service/src/vietnam/status-tracking.ts`: replace the
  O(E×T) matcher and add provider-gate ownership around status checks.
- `viza-be/submission-service/src/resilience-gate.ts`: server-only signed Gate
  acquire/renew/release client.
- `viza-be/submission-service/src/resilience-gate.spec.ts`: HMAC, timeout,
  lease, fallback, and `finally` semantics.
- `viza-be/agent-backend/scripts/concurrency-load-lib.ts`: percentile,
  invariant, and cleanup helpers.
- `viza-be/agent-backend/scripts/concurrency-load.ts`: staging-only synthetic
  database race harness.
- `viza-be/agent-backend/src/tests/concurrency-load-lib.test.ts`: deterministic
  load-result evaluation tests.
- `docs/infra/queue.md`, `docs/operations/viza-zero-ops-resilience.md`, and
  module `AGENTS.md` files: active contract, actual 30-minute recovery, flags,
  rollback, and validation commands.

## Task 1: Separate Queue routing from business event semantics

**Files:**
- Modify: `viza-be/resilience-worker/src/index.ts`
- Modify: `viza-be/resilience-worker/src/index.test.ts`

- [ ] **Step 1: Write failing signed HTTP Queue tests**

Add tests that exercise `worker.fetch`, not direct Durable Object calls:

```ts
it("preserves eventType while routing a v2 queue pointer", async () => {
  const id = `runner-wake-${crypto.randomUUID()}`;
  const response = await request("/v1/queue/enqueue", {
    idempotencyKey: id,
    workloadType: "background",
    eventType: "runner_job.wakeup.v1",
    scope: "runner_job",
    blob: "opaque-ciphertext",
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true,
    queued: true,
    queue: "viza-resilience-background",
  });

  const claimed = await request("/v1/outbox/claim", {
    limit: 1,
    leaseSeconds: 60,
  });
  expect(await claimed.json()).toMatchObject({
    items: [expect.objectContaining({
      idempotencyKey: id,
      eventType: "runner_job.wakeup.v1",
    })],
  });
});

it("rejects an unknown business event before queue publication", async () => {
  const response = await request("/v1/queue/enqueue", {
    idempotencyKey: crypto.randomUUID(),
    workloadType: "background",
    eventType: "arbitrary.event.v1",
    scope: "runner_job",
    blob: "opaque-ciphertext",
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: "eventType is invalid" });
});
```

Update the existing duplicate Queue test to send:

```ts
body: {
  version: 2,
  idempotencyKey,
  workloadType: "background",
  eventType: "runner_job.wakeup.v1",
}
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd viza-be/resilience-worker
npm test -- src/index.test.ts
```

Expected: the new producer test fails because `queueOutboxItem` replaces
`eventType` with `workloadType`, and the v2 envelope is rejected.

- [ ] **Step 3: Implement the minimal v2 contract**

Use these exact type shapes and allowlist:

```ts
type AllowedQueueEventType =
  | "runner_job.wakeup.v1"
  | "vietnam_status_sync.v1"
  | "critical_notification.v1"
  | "document_processing.v1";

type QueueEnvelope = {
  version: 2;
  idempotencyKey: string;
  workloadType: WorkloadType;
  eventType: AllowedQueueEventType;
};

function allowedQueueEventType(value: unknown): AllowedQueueEventType {
  if (
    value === "runner_job.wakeup.v1" ||
    value === "vietnam_status_sync.v1" ||
    value === "critical_notification.v1" ||
    value === "document_processing.v1"
  ) return value;
  throw new InputError("eventType is invalid");
}
```

`queueOutboxItem` must preserve `eventType` from the request and return a
separate `workloadType`. The Durable Object outbox receives the business
`eventType`. Queue routing uses `workloadType`. `queueEnvelope` accepts only
version 2 and validates both fields. Keep the 96,000-byte opaque blob limit.

- [ ] **Step 4: Add publish-failure and Gate HTTP-boundary tests**

Add a Queue send failure test that expects HTTP 503 with
`{ persisted: true, error: "queue_publish_failed" }`, then claims the outbox
item and proves it still exists. Add signed `/v1/concurrency/acquire`, `renew`,
and `release` requests and assert shard isolation plus stale fencing rejection.

- [ ] **Step 5: Run Worker validation and verify GREEN**

Run:

```powershell
cd viza-be/resilience-worker
npm run type-check
npm test
npm run deploy:dry-run
```

Expected: type-check succeeds, all Worker tests pass, and Wrangler dry-run
validates all Queue and Durable Object bindings.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- viza-be/resilience-worker/src/index.ts viza-be/resilience-worker/src/index.test.ts
git commit -m "feat(resilience): preserve queue event semantics"
```

## Task 2: Add the server-only runner wake Queue client

**Files:**
- Modify: `viza-fe/internal-website/lib/resilience/gateway.ts`
- Create: `viza-fe/internal-website/lib/resilience/runner-job-wakeup.ts`
- Create: `viza-fe/internal-website/lib/resilience/runner-job-wakeup.test.ts`

- [ ] **Step 1: Write the failing runner wake client tests**

Use a mocked gateway export and assert the exact public contract:

```ts
const enqueueResilienceQueueEventMock = vi.hoisted(() => vi.fn());

vi.mock("./gateway", () => ({
  enqueueResilienceQueueEvent: enqueueResilienceQueueEventMock,
}));

it("publishes an encrypted background pointer for a pool job", async () => {
  enqueueResilienceQueueEventMock.mockResolvedValue({
    accepted: true,
    duplicate: false,
    queued: true,
  });

  await enqueueRunnerJobWake({ jobId: "job-1", target: "pool" });

  expect(enqueueResilienceQueueEventMock).toHaveBeenCalledWith({
    idempotencyKey: "runner-job-wakeup:job-1",
    workloadType: "background",
    eventType: "runner_job.wakeup.v1",
    scope: "runner_job",
    value: { version: 1, jobId: "job-1", target: "pool" },
  });
});
```

Add validation tests for a missing job ID and a target outside
`pool|legacy|indonesia|south_korea`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd viza-fe/internal-website
npx vitest run lib/resilience/runner-job-wakeup.test.ts --testTimeout=15000
```

Expected: import failure because the new module and Queue gateway function do
not exist.

- [ ] **Step 3: Implement the typed gateway call**

Add to `gateway.ts`:

```ts
export async function enqueueResilienceQueueEvent(input: {
  idempotencyKey: string;
  workloadType: "critical_notification" | "document_processing" | "status_sync" | "background";
  eventType: "runner_job.wakeup.v1" | "vietnam_status_sync.v1" | "critical_notification.v1" | "document_processing.v1";
  scope: string;
  userRef?: string;
  value: unknown;
  availableAt?: number;
}): Promise<{ accepted: boolean; duplicate: boolean; queued: boolean }> {
  return await gatewayPost("/v1/queue/enqueue", {
    idempotencyKey: input.idempotencyKey,
    workloadType: input.workloadType,
    eventType: input.eventType,
    scope: input.scope,
    userRef: input.userRef,
    blob: encryptResilienceValue(input.value),
    availableAt: input.availableAt,
  });
}
```

Create `runner-job-wakeup.ts` with:

```ts
export const RUNNER_JOB_WAKE_EVENT = "runner_job.wakeup.v1" as const;
export type RunnerWakeTarget = "pool" | "legacy" | "indonesia" | "south_korea";
export type RunnerJobWakeEvent = {
  version: 1;
  jobId: string;
  target: RunnerWakeTarget;
};

export async function enqueueRunnerJobWake(input: {
  jobId: string;
  target: RunnerWakeTarget;
}): Promise<{ accepted: boolean; duplicate: boolean; queued: boolean }> {
  if (!input.jobId.trim()) throw new Error("Runner job id is required");
  return await enqueueResilienceQueueEvent({
    idempotencyKey: `runner-job-wakeup:${input.jobId}`,
    workloadType: "background",
    eventType: RUNNER_JOB_WAKE_EVENT,
    scope: "runner_job",
    value: { version: 1, jobId: input.jobId, target: input.target },
  });
}
```

- [ ] **Step 4: Run focused gateway tests and verify GREEN**

```powershell
cd viza-fe/internal-website
npx vitest run lib/resilience/gateway.test.ts lib/resilience/runner-job-wakeup.test.ts --testTimeout=15000
```

Expected: all tests pass without reading production secrets.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- viza-fe/internal-website/lib/resilience/gateway.ts viza-fe/internal-website/lib/resilience/runner-job-wakeup.ts viza-fe/internal-website/lib/resilience/runner-job-wakeup.test.ts
git commit -m "feat(concurrency): add encrypted runner wake events"
```

## Task 3: Replay and publish runner wake events with safe fallback

**Files:**
- Modify: `viza-fe/internal-website/app/api/resilience/replay/route.ts`
- Create: `viza-fe/internal-website/app/api/resilience/replay/route.test.ts`
- Modify: `viza-fe/internal-website/lib/queue/enqueue.ts`
- Create: `viza-fe/internal-website/lib/queue/enqueue.test.ts`
- Modify: `viza-fe/internal-website/AGENTS.md`

- [ ] **Step 1: Write failing replay tests**

Mock `createAdminClient`, `ensureFlyMachineCapacity`, and
`wakeCloudSubmissionWorker`. Send a correctly signed request containing one
encrypted `runner_job.wakeup.v1` event. Assert:

```ts
expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", {
  target: "pool",
});
expect(await response.json()).toEqual({
  ok: true,
  results: [{
    idempotencyKey: "runner-job-wakeup:job-1",
    leaseId: "lease-1",
    outcome: "ack",
  }],
});
```

Add cases for `succeeded`/`running` as an ack no-op, a missing job as permanent
ack with `job_not_found`, and a transient Fly wake failure as nack with
`retryAfterSeconds: 30`.

- [ ] **Step 2: Run replay tests and verify RED**

```powershell
cd viza-fe/internal-website
npx vitest run app/api/resilience/replay/route.test.ts --testTimeout=15000
```

Expected: the current route acks the event as `unsupported_event`.

- [ ] **Step 3: Implement allowlisted runner wake replay**

Add a strict validator:

```ts
function isRunnerJobWakeEvent(value: unknown): value is RunnerJobWakeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<RunnerJobWakeEvent>;
  return event.version === 1
    && typeof event.jobId === "string"
    && event.jobId.length > 0
    && (event.target === "pool"
      || event.target === "legacy"
      || event.target === "indonesia"
      || event.target === "south_korea");
}
```

Before waking, query `runner_job` for pool events or `submission_queue` for
retained targets. Ack terminal/running/missing records as documented. For a
queued pool job, call `ensureFlyMachineCapacity("pool", desired)` and then the
authenticated endpoint wake. Never accept target or URL values from decrypted
payloads beyond the enum.

- [ ] **Step 4: Write failing producer fallback tests**

In `lib/queue/enqueue.test.ts`, test three cases:

```ts
it("publishes the Queue wake after a committed runner_job", async () => {
  enqueueRunnerJobWakeMock.mockResolvedValue({ accepted: true, duplicate: false, queued: true });
  const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa");
  expect(enqueueRunnerJobWakeMock).toHaveBeenCalledWith({ jobId: "job-1", target: "pool" });
  expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
  expect(result.workerTriggered).toBe(true);
});

it("falls back to direct wake when the Queue gateway fails", async () => {
  enqueueRunnerJobWakeMock.mockRejectedValue(new Error("gateway unavailable"));
  wakeCloudSubmissionWorkerMock.mockResolvedValue({ ok: true });
  const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa");
  expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", { target: "pool" });
  expect(result.workerTriggered).toBe(true);
});
```

The feature flag `RESILIENCE_RUNNER_WAKE_ENABLED` defaults to `false`. With the
flag off, behavior must remain the current direct wake path.

- [ ] **Step 5: Run producer tests and verify RED**

```powershell
cd viza-fe/internal-website
npx vitest run lib/queue/enqueue.test.ts --testTimeout=15000
```

Expected: tests fail because `enqueueRunnerPoolJob` has no Queue publisher.

- [ ] **Step 6: Implement Queue-primary/direct-fallback publication**

Call `enqueueRunnerJobWake` only after the RPC returns a durable job ID. Do not
publish future scheduled work before `availableAt`; pass it through as the Queue
delay when the feature is later enabled for scheduled jobs. Treat an accepted
or duplicate Queue response as `workerTriggered: true`. On any Queue error,
log only the job prefix and call the existing direct wake helper.

- [ ] **Step 7: Run frontend validation and verify GREEN**

```powershell
cd viza-fe/internal-website
npx vitest run app/api/resilience/replay/route.test.ts lib/queue/enqueue.test.ts lib/resilience/gateway.test.ts lib/resilience/runner-job-wakeup.test.ts --testTimeout=15000
npm run type-check
npm run lint -- --quiet
```

Expected: focused tests, type-check, and lint pass.

- [ ] **Step 8: Commit Task 3**

```powershell
git add -- viza-fe/internal-website/app/api/resilience/replay/route.ts viza-fe/internal-website/app/api/resilience/replay/route.test.ts viza-fe/internal-website/lib/queue/enqueue.ts viza-fe/internal-website/lib/queue/enqueue.test.ts viza-fe/internal-website/AGENTS.md
git commit -m "feat(concurrency): queue runner wake delivery"
```

## Task 4: Replace the hot global claim lock with country-row locking

**Files:**
- Create: `viza-be/agent-backend/drizzle/0139_concurrency_phase_two.sql`
- Create: `viza-be/agent-backend/src/tests/concurrency-phase-two-migration.test.ts`
- Create via Supabase CLI: migration named `concurrency_phase_two` under `viza-fe/internal-website/supabase/migrations/`
- Modify: `viza-be/agent-backend/drizzle/AGENTS.md`

- [ ] **Step 1: Write the failing SQL contract tests**

Read the canonical SQL file and assert:

```ts
expect(sql).toContain("FOR UPDATE OF candidate, cap SKIP LOCKED");
expect(sql).toContain("runner_job_queued_available_idx");
expect(sql).toContain("runner_job_running_country_idx");
expect(sql).toContain("runner_job_running_lease_idx");
expect(sql).not.toContain("pg_advisory_xact_lock(hashtext('viza-runner-pool-claim'))");
expect(sql).not.toContain("pg_try_advisory_xact_lock(hashtext('viza-runner-pool-claim'))");
expect(sql).toMatch(/lease_until\s*>\s*p_now/i);
expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.claim_runner_pool_job[\s\S]*FROM PUBLIC, anon, authenticated/i);
expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_runner_pool_job[\s\S]*TO service_role/i);
```

Also assert the claim function contains a bounded expired-row CTE with
`LIMIT 1 FOR UPDATE SKIP LOCKED`.

- [ ] **Step 2: Run the migration test and verify RED**

```powershell
cd viza-be/agent-backend
npx vitest run src/tests/concurrency-phase-two-migration.test.ts
```

Expected: failure because `0139_concurrency_phase_two.sql` does not exist.

- [ ] **Step 3: Implement the canonical SQL migration**

The claim query must lock the candidate job and country-cap row together:

```sql
WITH selected AS MATERIALIZED (
  SELECT candidate.id, candidate.country
  FROM public.runner_job AS candidate
  JOIN public.runner_concurrency_cap AS cap
    ON cap.country = candidate.country
  WHERE candidate.status = 'queued'
    AND candidate.available_at <= p_now
    AND NOT cap.paused
    AND (
      SELECT COUNT(*)
      FROM public.runner_job AS active
      WHERE active.country = candidate.country
        AND active.status = 'running'
    ) < cap.max_concurrent
  ORDER BY candidate.enqueued_at, candidate.id
  LIMIT 1
  FOR UPDATE OF candidate, cap SKIP LOCKED
)
UPDATE public.runner_job AS claimed
SET status = 'running',
    leased_by = p_worker_id,
    leased_until = p_now + p_lease_ms * INTERVAL '1 millisecond',
    started_at = p_now,
    finished_at = NULL,
    last_error = NULL
FROM selected
WHERE claimed.id = selected.id
  AND claimed.status = 'queued'
RETURNING claimed.id, claimed.application_id, claimed.country,
  claimed.flow_key, claimed.attempts, claimed.max_attempts,
  claimed.correlation_id, claimed.metadata;
```

Before selection, verify the live machine slot when `p_require_slot` is true.
Recover at most one expired row with a separate materialized CTE. Keep exact
function signature and service-role grants for rolling deployment. The partial
queued index predicate must match `status = 'queued'`.

- [ ] **Step 4: Generate the Supabase migration with the CLI and mirror SQL**

Discover the CLI command first, then generate the migration:

```powershell
cd viza-fe/internal-website
npx supabase migration new --help
npx supabase migration new concurrency_phase_two
$supabaseMigration = Get-ChildItem -LiteralPath 'supabase/migrations' -Filter '*_concurrency_phase_two.sql' | Sort-Object LastWriteTimeUtc | Select-Object -Last 1
if (-not $supabaseMigration) { throw 'Supabase migration was not generated' }
Copy-Item -LiteralPath '..\..\viza-be\agent-backend\drizzle\0139_concurrency_phase_two.sql' -Destination $supabaseMigration.FullName -Force
```

Add a parity assertion to the migration test: locate the single
`*_concurrency_phase_two.sql` file and compare normalized contents to `0139`.

- [ ] **Step 5: Run backend migration validation and verify GREEN**

```powershell
cd viza-be/agent-backend
npx vitest run src/tests/concurrency-phase-two-migration.test.ts
npm run type-check
npm run lint -- --quiet
npx drizzle-kit check
```

Expected: SQL contract/parity tests pass; Drizzle schema is valid.

- [ ] **Step 6: Commit Task 4**

```powershell
git add -- viza-be/agent-backend/drizzle/0139_concurrency_phase_two.sql viza-be/agent-backend/src/tests/concurrency-phase-two-migration.test.ts viza-be/agent-backend/drizzle/AGENTS.md viza-fe/internal-website/supabase/migrations/*_concurrency_phase_two.sql
git commit -m "perf(database): shard runner job claims by country"
```

## Task 5: Move Vietnam status-email matching into one bounded RPC

**Files:**
- Modify: `viza-be/agent-backend/drizzle/0139_concurrency_phase_two.sql`
- Modify: the CLI-generated `viza-fe/internal-website/supabase/migrations/*_concurrency_phase_two.sql`
- Modify: `viza-be/agent-backend/src/tests/concurrency-phase-two-migration.test.ts`
- Create: `viza-be/submission-service/src/vietnam/email-status-matcher.ts`
- Create: `viza-be/submission-service/src/vietnam/__tests__/email-status-matcher.spec.ts`
- Modify: `viza-be/submission-service/src/vietnam/status-tracking.ts`
- Modify: `viza-be/submission-service/AGENTS.md`

- [ ] **Step 1: Write failing adapter tests**

Test the exact RPC input and returned counts:

```ts
it("sends at most 100 parsed email references to one RPC", async () => {
  const emails = Array.from({ length: 120 }, (_, index) => ({
    emailId: `email-${index}`,
    normalizedReference: index % 2 ? `REF${index}` : null,
  }));
  rpcMock.mockResolvedValue({
    data: [{ queued: 80, ambiguous: 10, unmatched: 10, duplicates: 0 }],
    error: null,
  });

  const result = await enqueueMatchedVietnamStatusEmails(client, emails);

  expect(rpcMock).toHaveBeenCalledWith(
    "enqueue_vn_email_triggered_status_checks",
    { p_emails: emails.slice(0, 100) },
  );
  expect(result).toEqual({ queued: 80, ambiguous: 10, unmatched: 10, duplicates: 0 });
});
```

Add tests for empty input, malformed counts, and an RPC error.

- [ ] **Step 2: Run adapter tests and verify RED**

```powershell
cd viza-be/submission-service
node --import tsx --test src/vietnam/__tests__/email-status-matcher.spec.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Add failing SQL RPC assertions**

Extend the backend migration test to require:

```ts
expect(sql).toContain("enqueue_vn_email_triggered_status_checks");
expect(sql).toContain("jsonb_array_length(p_emails) > 100");
expect(sql).toContain("ON CONFLICT (idempotency_key)");
expect(sql).toContain("LOWER(tracking.official_lookup_email) = LOWER(email.to_addr)");
expect(sql).toContain("official_tracking_active_email_idx");
expect(sql).toMatch(/SECURITY INVOKER[\s\S]*SET search_path = ''/i);
expect(sql).toMatch(/GRANT EXECUTE[\s\S]*TO service_role/i);
```

- [ ] **Step 4: Implement the set-based service-role RPC**

The function signature is:

```sql
CREATE OR REPLACE FUNCTION public.enqueue_vn_email_triggered_status_checks(
  p_emails JSONB
)
RETURNS TABLE (
  queued INTEGER,
  ambiguous INTEGER,
  unmatched INTEGER,
  duplicates INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
```

Reject non-array input and arrays over 100. Use `jsonb_to_recordset` to obtain
`email_id UUID, normalized_reference TEXT`; join only those IDs to
`inbound_email`, active tracking, and applications. Use CTEs to compute
candidate counts and set-based inserts into `official_status_checks` and
`application_events`. Use existing idempotency-key unique constraints and
return exact counts. Revoke from `PUBLIC, anon, authenticated`; grant only to
`service_role`.

- [ ] **Step 5: Implement the adapter and replace the O(E×T) loop**

`email-status-matcher.ts` exports:

```ts
export type ParsedVietnamStatusEmail = {
  emailId: string;
  normalizedReference: string | null;
};

export type VietnamEmailMatchCounts = {
  queued: number;
  ambiguous: number;
  unmatched: number;
  duplicates: number;
};

export async function enqueueMatchedVietnamStatusEmails(
  client: Pick<typeof supabase, "rpc">,
  emails: readonly ParsedVietnamStatusEmail[],
): Promise<VietnamEmailMatchCounts>;
```

`enqueueVietnamEmailTriggeredChecks` continues fetching and parsing at most 100
official emails, then calls this adapter once. Delete the tracking/application
fetches, `tracking.filter`, ambiguous `Promise.all`, and per-email
`queueEmailTriggeredCheck` calls. Return `counts.queued`.

- [ ] **Step 6: Run focused and package validation**

```powershell
cd viza-be/agent-backend
npx vitest run src/tests/concurrency-phase-two-migration.test.ts

cd ../submission-service
node --import tsx --test src/vietnam/__tests__/email-status-matcher.spec.ts src/vietnam/__tests__/status-tracking.spec.ts
npm run type-check
npm run build
```

Expected: migration parity, RPC adapter, existing status behavior, type-check,
and build pass.

- [ ] **Step 7: Commit Task 5**

```powershell
git add -- viza-be/agent-backend/drizzle/0139_concurrency_phase_two.sql viza-be/agent-backend/src/tests/concurrency-phase-two-migration.test.ts viza-fe/internal-website/supabase/migrations/*_concurrency_phase_two.sql viza-be/submission-service/src/vietnam/email-status-matcher.ts viza-be/submission-service/src/vietnam/__tests__/email-status-matcher.spec.ts viza-be/submission-service/src/vietnam/status-tracking.ts viza-be/submission-service/AGENTS.md
git commit -m "perf(vietnam): batch official status email matching"
```

## Task 6: Fence Vietnam status provider concurrency

**Files:**
- Create: `viza-be/submission-service/src/resilience-gate.ts`
- Create: `viza-be/submission-service/src/resilience-gate.spec.ts`
- Modify: `viza-be/submission-service/src/vietnam/status-tracking.ts`
- Modify: `viza-be/submission-service/src/vietnam/__tests__/status-check-lease.spec.ts`
- Modify: `viza-be/submission-service/AGENTS.md`

- [ ] **Step 1: Write failing Gate client tests**

Define the desired API through tests:

```ts
it("acquires, renews, and releases the Vietnam status shard", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({
      ok: true,
      acquired: true,
      leaseId: "lease-1",
      fencingToken: 8,
      leaseUntil: Date.now() + 60_000,
    }))
    .mockResolvedValueOnce(Response.json({ ok: true, renewed: true }))
    .mockResolvedValueOnce(Response.json({ ok: true, released: true }));

  const lease = await acquireResilienceGate({
    scope: "vietnam",
    resourceKey: "evisa/status",
    capacity: 1,
    leaseSeconds: 120,
    ownerRef: "worker-1",
  });
  expect(lease?.fencingToken).toBe(8);
  await renewResilienceGate(lease!, 120);
  await releaseResilienceGate(lease!);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
```

Assert HMAC canonical path/body signatures, 3-second timeout, disabled config
returns `null`, 429/503 acquisition returns `null`, and stale renew throws
`ResilienceGateOwnershipLostError`.

- [ ] **Step 2: Run Gate tests and verify RED**

```powershell
cd viza-be/submission-service
node --import tsx --test src/resilience-gate.spec.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement the minimal server-only Gate client**

Read only these environment variables:

```text
VIZA_RESILIENCE_GATEWAY_URL
VIZA_RESILIENCE_HMAC_KEY_ID
VIZA_RESILIENCE_HMAC_SECRET
RESILIENCE_VN_STATUS_GATE_ENABLED
RESILIENCE_VN_STATUS_GATE_CAPACITY
```

Use Node `crypto.createHash`, `createHmac`, and `randomUUID`. Never log the
secret, signature, nonce, raw body, or owner reference. Return typed
`GateLease` values containing scope, resource key, lease ID, fencing token,
and lease-until time.

- [ ] **Step 4: Write a failing ownership-loss status test**

Extend the Vietnam lease test so a rejected Gate renewal causes the status
settlement helper to skip `complete_vn_official_status_check` and
`fail_vn_official_status_check`. Also assert `releaseResilienceGate` runs in
`finally` when the portal check throws.

- [ ] **Step 5: Run the status ownership test and verify RED**

```powershell
cd viza-be/submission-service
node --import tsx --test src/vietnam/__tests__/status-check-lease.spec.ts
```

Expected: test fails because status processing has no provider Gate.

- [ ] **Step 6: Wrap each official status check with the Gate**

Acquire `vietnam/evisa/status` before calling the official portal. If the Gate
is disabled or temporarily unavailable, retain the existing Postgres lease and
conservative serial behavior. When a lease is acquired, renew it before half
its lifetime and mark local ownership lost if renewal fails. In `finally`,
clear the renewal timer and release the exact lease/fence. Refuse final RPC
settlement after either Postgres or Gate ownership is lost.

- [ ] **Step 7: Run submission validation and verify GREEN**

```powershell
cd viza-be/submission-service
node --import tsx --test src/resilience-gate.spec.ts src/vietnam/__tests__/status-check-lease.spec.ts src/vietnam/__tests__/status-tracking.spec.ts
npm run type-check
npm run build
```

Expected: focused tests, type-check, and build pass.

- [ ] **Step 8: Commit Task 6**

```powershell
git add -- viza-be/submission-service/src/resilience-gate.ts viza-be/submission-service/src/resilience-gate.spec.ts viza-be/submission-service/src/vietnam/status-tracking.ts viza-be/submission-service/src/vietnam/__tests__/status-check-lease.spec.ts viza-be/submission-service/AGENTS.md
git commit -m "feat(vietnam): fence status provider concurrency"
```

## Task 7: Add a staging-only database concurrency load gate

**Files:**
- Create: `viza-be/agent-backend/scripts/concurrency-load-lib.ts`
- Create: `viza-be/agent-backend/scripts/concurrency-load.ts`
- Create: `viza-be/agent-backend/src/tests/concurrency-load-lib.test.ts`
- Modify: `viza-be/agent-backend/package.json`
- Modify: `viza-be/agent-backend/AGENTS.md`

- [ ] **Step 1: Write failing invariant-evaluator tests**

```ts
it("blocks release when any concurrency invariant fails", () => {
  expect(evaluateConcurrencyRun({
    jobs: 100,
    duplicateClaims: 1,
    countryCapOvershoots: 0,
    globalSlotOvershoots: 0,
    staleLeaseWrites: 0,
    databaseErrors: 0,
    lockTimeouts: 0,
    connectionExhaustions: 0,
    claimLatenciesMs: [20, 30, 40],
    syntheticRowsRemaining: 0,
  })).toMatchObject({ passed: false, failures: ["duplicate_claims"] });
});

it("calculates p95 and passes the approved matrix", () => {
  const result = evaluateConcurrencyRun({
    jobs: 1000,
    duplicateClaims: 0,
    countryCapOvershoots: 0,
    globalSlotOvershoots: 0,
    staleLeaseWrites: 0,
    databaseErrors: 0,
    lockTimeouts: 0,
    connectionExhaustions: 0,
    claimLatenciesMs: Array.from({ length: 100 }, (_, i) => i + 1),
    syntheticRowsRemaining: 0,
  });
  expect(result.p95ClaimMs).toBe(95);
  expect(result.passed).toBe(true);
});
```

- [ ] **Step 2: Run evaluator tests and verify RED**

```powershell
cd viza-be/agent-backend
npx vitest run src/tests/concurrency-load-lib.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement deterministic statistics and release evaluation**

Export exact `percentile` and `evaluateConcurrencyRun` helpers. The evaluator
must fail for any non-zero duplicate, overshoot, stale write, database error,
lock timeout, connection exhaustion, synthetic residue, or p95 claim latency
of 500 ms or more. It returns measured values and stable failure codes.

- [ ] **Step 4: Implement the guarded staging harness**

The script must refuse to run unless all checks pass:

```ts
const productionRef = "oyjxdzsoejraedqghndi";
if (process.env.CONCURRENCY_LOAD_CONFIRM !== "staging-only") {
  throw new Error("Set CONCURRENCY_LOAD_CONFIRM=staging-only");
}
if (!process.env.CONCURRENCY_LOAD_DATABASE_URL) {
  throw new Error("CONCURRENCY_LOAD_DATABASE_URL is required");
}
if (process.env.CONCURRENCY_LOAD_PROJECT_REF === productionRef) {
  throw new Error("Concurrency load testing is forbidden on production");
}
```

For each level `100,300,600,1000`, select one existing staging
`applicant_profiles.id`, insert synthetic applications whose `purpose` begins
`concurrency-load:<runId>`, insert one runner job per application, and create a
fixed set of synthetic machine-slot owners. Run concurrent claim RPC calls with
stable worker IDs, record every returned job ID and latency, and query running
counts after every batch. Do not call Fly, Vercel, Resend, payment, or official
portal endpoints.

Cleanup belongs in `finally`:

```ts
await client.query(
  "DELETE FROM public.applications WHERE purpose = $1",
  [`concurrency-load:${runId}`],
);
const residue = await client.query(
  "SELECT COUNT(*)::int AS count FROM public.applications WHERE purpose = $1",
  [`concurrency-load:${runId}`],
);
```

Write JSON results to `load-test-results/concurrency/<runId>/summary.json` and
print a table with expected and measured values. Exit 1 when `passed` is false.

- [ ] **Step 5: Add the package command and verify unit tests**

Add:

```json
"load:concurrency": "tsx scripts/concurrency-load.ts"
```

Run:

```powershell
cd viza-be/agent-backend
npx vitest run src/tests/concurrency-load-lib.test.ts
npm run type-check
npm run lint -- --quiet
```

Expected: evaluator tests and static checks pass. Do not run the live harness
until a non-production staging database URL and explicit confirmation are set.

- [ ] **Step 6: Commit Task 7**

```powershell
git add -- viza-be/agent-backend/scripts/concurrency-load-lib.ts viza-be/agent-backend/scripts/concurrency-load.ts viza-be/agent-backend/src/tests/concurrency-load-lib.test.ts viza-be/agent-backend/package.json viza-be/agent-backend/AGENTS.md
git commit -m "test(concurrency): add staging release load gate"
```

## Task 8: Align documentation, configuration, and rollback controls

**Files:**
- Modify: `docs/infra/queue.md`
- Modify: `docs/operations/viza-zero-ops-resilience.md`
- Modify: `viza-be/resilience-worker/README.md`
- Modify: `viza-be/resilience-worker/AGENTS.md`
- Modify: `viza-fe/internal-website/AGENTS.md`
- Modify: `viza-be/submission-service/AGENTS.md`

- [ ] **Step 1: Write the documentation assertions before editing docs**

Add source-regression assertions to the nearest existing tests:

```ts
expect(queueDoc).toContain("Postgres remains the source of truth");
expect(queueDoc).toContain("runner_job.wakeup.v1");
expect(operationsDoc).toContain("every 30 minutes");
expect(operationsDoc).not.toContain("Every minute, the Worker attempts");
expect(workerReadme).toContain("version: 2");
expect(workerReadme).toContain("eventType");
expect(workerReadme).toContain("workloadType");
```

Place these in `viza-be/resilience-worker/src/index.test.ts` so the deployed
contract and runbook cannot silently drift.

- [ ] **Step 2: Run the documentation test and verify RED**

```powershell
cd viza-be/resilience-worker
npm test -- src/index.test.ts
```

Expected: failures because current docs describe the old v1 contract and the
operations runbook contains one-minute text.

- [ ] **Step 3: Update active docs and module maps**

Document:

- the staged hybrid transport and Queue-primary/direct-fallback behavior;
- v2 Queue pointer fields and explicit event allowlist;
- `RESILIENCE_RUNNER_WAKE_ENABLED` and
  `RESILIENCE_VN_STATUS_GATE_ENABLED` default-off rollout flags;
- Fly HMAC secret requirements for Gate clients;
- actual 30-minute scheduled replay interval;
- rollback order for Phases A, B, and C;
- exact package test, dry-run, and staging load commands;
- the rule that load results list expected and measured values.

- [ ] **Step 4: Run documentation and diff checks**

```powershell
cd viza-be/resilience-worker
npm test -- src/index.test.ts
cd ../..
git diff --check
rg -n "Every minute, the Worker attempts|version: 1" docs/infra/queue.md docs/operations/viza-zero-ops-resilience.md viza-be/resilience-worker/README.md
```

Expected: test passes, `git diff --check` is clean, and the final `rg` finds no
stale contract wording.

- [ ] **Step 5: Commit Task 8**

```powershell
git add -- docs/infra/queue.md docs/operations/viza-zero-ops-resilience.md viza-be/resilience-worker/README.md viza-be/resilience-worker/AGENTS.md viza-fe/internal-website/AGENTS.md viza-be/submission-service/AGENTS.md viza-be/resilience-worker/src/index.test.ts
git commit -m "docs(concurrency): document hybrid queue rollout"
```

## Task 9: Verify packages, stage infrastructure, and compare results

**Files:**
- Create after the run: `docs/operations/concurrency-phase-two-results.md`

- [ ] **Step 1: Run complete local verification**

```powershell
cd viza-be/resilience-worker
npm run type-check
npm test
npm run deploy:dry-run

cd ../agent-backend
npm run type-check
npm run lint -- --quiet
npx vitest run src/tests/concurrency-phase-two-migration.test.ts src/tests/concurrency-load-lib.test.ts
npx drizzle-kit check

cd ../submission-service
$env:SUPABASE_URL='http://127.0.0.1:54321'
$env:SUPABASE_SERVICE_ROLE_KEY='test-service-role-key'
npm run type-check
npm run build
npm test
Remove-Item Env:SUPABASE_URL
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY

cd ../../viza-fe/internal-website
npm run type-check
npm run lint -- --quiet
npx vitest run app/api/resilience/replay/route.test.ts lib/queue/enqueue.test.ts lib/resilience/gateway.test.ts lib/resilience/runner-job-wakeup.test.ts --testTimeout=15000
```

Expected: every command exits 0. Any failing command blocks deployment.

- [ ] **Step 2: Apply the migration to staging and verify function/index state**

Use the configured Supabase tool only against a non-production project. Verify
the exact migration name appears in migration history, then query
`pg_proc`/`pg_indexes` for the new claim function, Vietnam RPC, and indexes.
Run a two-caller smoke that proves different countries can claim concurrently
while same-country capacity remains bounded.

Expected measured row:

```text
staging migration present: expected=yes measured=yes
different-country concurrent claims: expected=2 measured=2
same-country cap overshoot: expected=0 measured=0
```

- [ ] **Step 3: Run the guarded staging load levels**

```powershell
cd viza-be/agent-backend
if ($env:CONCURRENCY_LOAD_CONFIRM -ne 'staging-only') { throw 'Authorized staging confirmation is missing' }
if (-not $env:CONCURRENCY_LOAD_PROJECT_REF) { throw 'Authorized staging project ref is missing' }
if (-not $env:CONCURRENCY_LOAD_DATABASE_URL) { throw 'Authorized staging pooled URL is missing' }
npm run load:concurrency
```

Set those three variables out-of-band in the authorized shell before running
the commands. Their values must never be written to Git or logs. Expected at
100, 300, 600, and 1,000 jobs:

```text
duplicate claims=0
country cap overshoots=0
global slot overshoots=0
stale lease writes=0
database errors=0
lock timeouts=0
connection exhaustion=0
p95 claim latency<500ms
synthetic rows remaining=0
```

- [ ] **Step 4: Deploy Phase A with flags disabled**

Deploy the Worker contract first, then Vercel, then Fly submission images. Keep
`RESILIENCE_RUNNER_WAKE_ENABLED=false` and
`RESILIENCE_VN_STATUS_GATE_ENABLED=false`. Confirm Worker health, Queue
producer/consumer bindings, Vercel replay 401 on unsigned input, and Fly images
at the intended SHA with machines returned to scale-to-zero.

- [ ] **Step 5: Enable Phase A canary and observe**

Set `RESILIENCE_RUNNER_WAKE_ENABLED=true` only for the approved canary
environment or percentage. Enqueue synthetic non-billable work and measure 100
duplicate Queue deliveries. Expected effective Fly wakes: 1. Confirm direct
wake fallback by temporarily pointing the canary gateway to an unreachable
preview URL, not by disrupting production.

- [ ] **Step 6: Enable Phase B only after its matrix passes**

Apply the production migration during a low-traffic window. Verify the function
definition and indexes, deploy workers, and observe claim p95, false-empty
claims, country saturation, and database error rates. Roll back to the prior
`pg_try_advisory_xact_lock` function if any release rule fails.

- [ ] **Step 7: Enable Phase C only after matching parity passes**

Compare old fixture outputs and new RPC counts exactly. Then enable SQL email
matching. Enable the Vietnam Gate separately at capacity 1. Verify acquisition,
renewal, release, stale-fence refusal, and zero leaked leases before considering
a higher measured capacity.

- [ ] **Step 8: Write the expected-versus-measured results report**

Create `docs/operations/concurrency-phase-two-results.md` with one row for every
acceptance metric:

```markdown
| Phase | Metric | Expected | Measured | Evidence | Decision |
| --- | --- | --- | --- | --- | --- |
```

Populate the table only from completed test output, the generated
`summary.json`, deployment run URLs, and production observation logs. Do not
write estimates into `Measured`. Do not mark completion while any required row
is absent or any decision is fail.

- [ ] **Step 9: Commit verified results only after all enabled phases pass**

```powershell
git add -- docs/operations/concurrency-phase-two-results.md
git commit -m "docs(concurrency): record phase two verification results"
```

If a phase fails, do not create a misleading success commit. Record the failure
and rollback evidence in the same document with `Decision = blocked`.

## Final completion gate

Before claiming completion, run:

```powershell
git status --short
git diff --check HEAD~1..HEAD
```

Then confirm the results document reports all of the following with measured
values: zero duplicate claims, zero cap overshoot, zero stale writes, zero DB
errors/timeouts/exhaustion, p95 below 500 ms at every load level, zero synthetic
residue, one effective wake after duplicate delivery, and no Fly machine left
running without work. A deployment with missing measurements is incomplete.
