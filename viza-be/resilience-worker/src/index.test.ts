import { createExecutionContext, createMessageBatch, env, getQueueResult } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import worker from "./index";
import {
  isAllowedManagementProjectResponse,
  isTransientProbeStatus,
  MAX_PROBE_AGE_MS,
  PRODUCTION_PROJECT_REF,
  validateWatchdogConfiguration,
} from "./watchdog-health";

const secret = "test-only-secret";
const keyId = "viza-web-v1";

const healthyProbe = {
  auth: { ok: true, transient: false, status: 200, latencyMs: 1 },
  rest: { ok: true, transient: false, status: 200, latencyMs: 1 },
  control: { ok: true, transient: false, status: 401, latencyMs: 1 },
  healthy: true,
};

const allowedQueueEventCases = [
  {
    workloadType: "background",
    eventType: "runner_job.wakeup.v1",
    scope: "runner_job",
    queue: "viza-resilience-background",
  },
  {
    workloadType: "status_sync",
    eventType: "vietnam_status_sync.v1",
    scope: "vietnam_status",
    queue: "viza-resilience-document-status",
  },
  {
    workloadType: "critical_notification",
    eventType: "critical_notification.v1",
    scope: "critical_notification",
    queue: "viza-resilience-critical-notifications",
  },
  {
    workloadType: "document_processing",
    eventType: "document_processing.v1",
    scope: "document_processing",
    queue: "viza-resilience-document-status",
  },
] as const;

async function stateCommand(command: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await env.RESILIENCE_STATE.getByName("global").fetch("https://resilience-state/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  expect(response.ok).toBe(true);
  return await response.json() as Record<string, unknown>;
}

async function gateCommand(shard: string, command: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await env.CONCURRENCY_GATE.getByName(shard).fetch("https://concurrency-gate/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  expect(response.ok).toBe(true);
  return await response.json() as Record<string, unknown>;
}

async function sign(path: string, body: string, timestamp = Math.floor(Date.now() / 1000).toString(), nonce = crypto.randomUUID()): Promise<Headers> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`POST\n${path}\n${timestamp}\n${nonce}\n${hash}`));
  const signature = [...new Uint8Array(signatureBytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Headers({ "Content-Type": "application/json", "X-Viza-Key-Id": keyId, "X-Viza-Timestamp": timestamp, "X-Viza-Nonce": nonce, "X-Viza-Signature": signature });
}

async function request(path: string, value: Record<string, unknown>, nonce?: string, requestEnv: typeof env = env): Promise<Response> {
  const body = JSON.stringify(value);
  const headers = await sign(path, body, undefined, nonce);
  return worker.fetch(new Request(`https://worker.test${path}`, { method: "POST", headers, body }), requestEnv);
}

describe("resilience gateway", () => {
  it("exposes a secret-free read-only health endpoint", async () => {
    const response = await worker.fetch(new Request("https://worker.test/health"), env);
    expect(response.status).toBe(503);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toMatchObject({ ok: false, reason: "probe_stale", service: "viza-resilience-worker" });
    expect(JSON.stringify(payload)).not.toContain("test-only-secret");
  });

  it("only reports healthy when the latest probe is fresh and healthy", async () => {
    expect(MAX_PROBE_AGE_MS).toBe(35 * 60 * 1_000);
    const now = Date.now();
    await stateCommand({ op: "recordProbe", probe: healthyProbe, circuit: "closed", now });
    const response = await worker.fetch(new Request("https://worker.test/health"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, lastProbe: { probe: healthyProbe } });

    await stateCommand({ op: "recordProbe", probe: healthyProbe, circuit: "closed", now: now - MAX_PROBE_AGE_MS - 1 });
    const stale = await worker.fetch(new Request("https://worker.test/health"), env);
    expect(stale.status).toBe(503);
    expect(await stale.json()).toMatchObject({ ok: false, reason: "probe_stale" });

    const unhealthyProbe = { ...healthyProbe, healthy: false };
    await stateCommand({ op: "recordProbe", probe: unhealthyProbe, circuit: "closed", now: Date.now() });
    const unhealthy = await worker.fetch(new Request("https://worker.test/health"), env);
    expect(unhealthy.status).toBe(503);
    expect(await unhealthy.json()).toMatchObject({ ok: false, reason: "probe_unhealthy" });
  });

  it("surfaces a persisted scheduled failure through health", async () => {
    await stateCommand({ op: "recordProbe", probe: healthyProbe, circuit: "closed", now: Date.now() });
    await stateCommand({ op: "recordScheduled", now: Date.now(), ok: false, errorCode: "watchdog_failed" });
    const response = await worker.fetch(new Request("https://worker.test/health"), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "scheduled_run_failed",
      lastScheduled: { ok: false, errorCode: "watchdog_failed" },
    });
  });

  it("persists a scheduled-handler exception for health monitoring", async () => {
    await stateCommand({
      op: "enqueueOutbox",
      idempotencyKey: "scheduled-failure",
      scope: "test",
      eventType: "test",
      blob: "ciphertext",
      now: Date.now(),
    });
    const scheduledEnv = {
      ...env,
      SUPABASE_URL: "https://wrong-project.supabase.co",
      VIZA_RESILIENCE_REPLAY_URL: "not-a-url",
    } as unknown as typeof env;
    let completion: Promise<unknown> | undefined;
    const context = {
      waitUntil(promise: Promise<unknown>) {
        completion = promise;
      },
    } as unknown as ExecutionContext;
    await worker.scheduled({} as ScheduledController, scheduledEnv, context);
    await completion;

    const response = await worker.fetch(new Request("https://worker.test/health"), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "scheduled_run_failed",
      lastScheduled: { ok: false },
    });

    // The malformed replay URL leaves a lease while exercising the exception
    // path. Advance the clock and acknowledge it so later outbox tests remain
    // independent of this monitoring test.
    const cleanup = await stateCommand({ op: "claimOutbox", now: Date.now() + 180_000, limit: 100, leaseMs: 1_000 });
    const cleanupItems = Array.isArray(cleanup.items)
      ? cleanup.items
        .filter((item): item is { idempotencyKey: string; leaseId: string } => Boolean(item && typeof item === "object" && typeof (item as { idempotencyKey?: unknown }).idempotencyKey === "string" && typeof (item as { leaseId?: unknown }).leaseId === "string"))
        .map((item) => ({ idempotencyKey: item.idempotencyKey, leaseId: item.leaseId }))
      : [];
    if (cleanupItems.length) await stateCommand({ op: "ackOutbox", items: cleanupItems });
  });

  it("does not treat rate limits as database restart evidence", () => {
    expect(isTransientProbeStatus(429)).toBe(false);
    expect(isTransientProbeStatus(408)).toBe(true);
    expect(isTransientProbeStatus(503)).toBe(true);
  });

  it("locks watchdog probes and management responses to the production project", () => {
    expect(validateWatchdogConfiguration(
      `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
      PRODUCTION_PROJECT_REF,
      "anon-key",
    )).toEqual({ ok: true, baseUrl: `https://${PRODUCTION_PROJECT_REF}.supabase.co` });
    expect(validateWatchdogConfiguration(
      "https://other-project.supabase.co",
      "other-project-ref",
      "anon-key",
    )).toMatchObject({ ok: false, reason: "project_ref_not_allowlisted" });
    expect(isAllowedManagementProjectResponse({ ref: PRODUCTION_PROJECT_REF, status: "ACTIVE_HEALTHY" })).toBe(true);
    expect(isAllowedManagementProjectResponse({ ref: "other-project-ref", status: "ACTIVE_HEALTHY" })).toBe(false);
  });

  it("requires HMAC and rejects a replayed nonce", async () => {
    const body = { userRef: "u-test", scope: "auth", key: "otp", blob: "encrypted", ttlSeconds: 60 };
    const unauthorized = await worker.fetch(new Request("https://worker.test/v1/cache/put", { method: "POST", body: JSON.stringify(body) }), env);
    expect(unauthorized.status).toBe(401);
    const nonce = crypto.randomUUID();
    const first = await request("/v1/cache/put", body, nonce);
    expect(first.status).toBe(200);
    const replay = await request("/v1/cache/put", body, nonce);
    expect(replay.status).toBe(409);
  });

  it("atomically consumes a one-time cache value under concurrency", async () => {
    await request("/v1/cache/put", { userRef: "u-consume", scope: "auth", key: "otp", blob: "ciphertext", ttlSeconds: 60, oneTime: true });
    const responses = await Promise.all([
      request("/v1/cache/consume", { userRef: "u-consume", scope: "auth", key: "otp" }),
      request("/v1/cache/consume", { userRef: "u-consume", scope: "auth", key: "otp" }),
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<{ hit: boolean; blob?: string }>));
    expect(payloads.filter((payload) => payload.hit && payload.blob === "ciphertext")).toHaveLength(1);
    expect(payloads.filter((payload) => !payload.hit)).toHaveLength(1);
  });

  it("deduplicates outbox events and returns encrypted blobs without parsing", async () => {
    const item = { idempotencyKey: "event-1", userRef: "u-test", scope: "application", eventType: "write", blob: "{encrypted:blob}" };
    const first = await request("/v1/outbox/enqueue", item);
    const duplicate = await request("/v1/outbox/enqueue", item);
    expect((await first.json() as { accepted: boolean }).accepted).toBe(true);
    expect((await duplicate.json() as { duplicate: boolean }).duplicate).toBe(true);
    const claimed = await request("/v1/outbox/claim", { limit: 1, leaseSeconds: 60 });
    const payload = await claimed.json() as { items: Array<{ idempotencyKey: string; blob: string; leaseId: string; attempts: number }> };
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({ idempotencyKey: "event-1", blob: "{encrypted:blob}", attempts: 1 });
    expect(payload.items[0].leaseId).toEqual(expect.any(String));
  });

  it("accepts a signed v2 queue request while preserving workload and event semantics", async () => {
    const idempotencyKey = `queue-v2-${crypto.randomUUID()}`;
    const send = vi.fn(async (_body: unknown, _options?: unknown): Promise<void> => undefined);
    const producerEnv = {
      ...env,
      BACKGROUND_QUEUE: { send },
    } as unknown as typeof env;
    const response = await request("/v1/queue/enqueue", {
      idempotencyKey,
      workloadType: "background",
      eventType: "runner_job.wakeup.v1",
      scope: "runner_job",
      blob: "opaque-ciphertext",
    }, undefined, producerEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      accepted: true,
      queued: true,
      queue: "viza-resilience-background",
      workloadType: "background",
      eventType: "runner_job.wakeup.v1",
    });
    expect(send).toHaveBeenCalledTimes(1);
    const [envelope, options] = send.mock.calls[0] ?? [];
    expect(envelope).toMatchObject({
      version: 2,
      idempotencyKey,
      workloadType: "background",
      eventType: "runner_job.wakeup.v1",
    });
    expect(options).toMatchObject({ contentType: "json" });

    const claim = await stateCommand({
      op: "claimOutboxByKey",
      idempotencyKey,
      now: Date.now(),
      leaseMs: 30_000,
    });
    expect(claim).toMatchObject({
      outcome: "claimed",
      item: { idempotencyKey, eventType: "runner_job.wakeup.v1", blob: "opaque-ciphertext" },
    });
    const item = claim.item as { idempotencyKey: string; leaseId: string };
    await stateCommand({ op: "ackOutbox", items: [item], now: Date.now() });
  });

  it.each(allowedQueueEventCases)("accepts allowlisted queue event $eventType on its workload binding", async ({ workloadType, eventType, scope, queue }) => {
    const sends = {
      critical: vi.fn(async (_body: unknown, _options?: unknown): Promise<void> => undefined),
      documentStatus: vi.fn(async (_body: unknown, _options?: unknown): Promise<void> => undefined),
      background: vi.fn(async (_body: unknown, _options?: unknown): Promise<void> => undefined),
    };
    const producerEnv = {
      ...env,
      CRITICAL_NOTIFICATIONS_QUEUE: { send: sends.critical },
      DOCUMENT_STATUS_QUEUE: { send: sends.documentStatus },
      BACKGROUND_QUEUE: { send: sends.background },
    } as unknown as typeof env;
    const idempotencyKey = `queue-allowed-${crypto.randomUUID()}`;
    const response = await request("/v1/queue/enqueue", {
      idempotencyKey,
      workloadType,
      eventType,
      scope,
      blob: "opaque-ciphertext",
    }, undefined, producerEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, accepted: true, queued: true, queue, workloadType, eventType });

    const selectedSend = workloadType === "critical_notification"
      ? sends.critical
      : workloadType === "background"
        ? sends.background
        : sends.documentStatus;
    expect(selectedSend).toHaveBeenCalledTimes(1);
    const [envelope] = selectedSend.mock.calls[0] ?? [];
    expect(envelope).toMatchObject({ version: 2, idempotencyKey, workloadType, eventType });

    const claim = await stateCommand({ op: "claimOutboxByKey", idempotencyKey, now: Date.now(), leaseMs: 30_000 });
    expect(claim).toMatchObject({ outcome: "claimed", item: { idempotencyKey, eventType } });
    const item = claim.item as { idempotencyKey: string; leaseId: string };
    await stateCommand({ op: "ackOutbox", items: [item], now: Date.now() });
  });

  it("rejects an arbitrary queue event type at the signed HTTP boundary", async () => {
    const response = await request("/v1/queue/enqueue", {
      idempotencyKey: `queue-invalid-event-${crypto.randomUUID()}`,
      workloadType: "background",
      eventType: "arbitrary.event.v1",
      scope: "runner_job",
      blob: "opaque-ciphertext",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "eventType is invalid" });
  });

  it("returns queue publish failures after persisting a claimable outbox record", async () => {
    const idempotencyKey = `queue-publish-failure-${crypto.randomUUID()}`;
    const failingEnv = {
      ...env,
      BACKGROUND_QUEUE: { send: vi.fn().mockRejectedValue(new Error("queue unavailable")) },
    } as unknown as typeof env;
    const response = await request("/v1/queue/enqueue", {
      idempotencyKey,
      workloadType: "background",
      eventType: "runner_job.wakeup.v1",
      scope: "runner_job",
      blob: "opaque-ciphertext",
    }, undefined, failingEnv);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, persisted: true, error: "queue_publish_failed" });

    const claim = await stateCommand({
      op: "claimOutboxByKey",
      idempotencyKey,
      now: Date.now(),
      leaseMs: 30_000,
    });
    expect(claim).toMatchObject({
      outcome: "claimed",
      item: { idempotencyKey, eventType: "runner_job.wakeup.v1" },
    });
    const item = claim.item as { idempotencyKey: string; leaseId: string };
    await stateCommand({ op: "ackOutbox", items: [item], now: Date.now() });
  });

  it("acks duplicate queue deliveries after one idempotent outbox replay", async () => {
    const idempotencyKey = `queue-duplicate-${crypto.randomUUID()}`;
    await stateCommand({
      op: "enqueueOutbox",
      idempotencyKey,
      scope: "notifications",
      eventType: "critical_notification.v1",
      blob: "opaque-ciphertext",
      now: Date.now(),
    });
    const replay = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { items: Array<{ idempotencyKey: string; leaseId: string }> };
      return Response.json({
        results: body.items.map((item) => ({ idempotencyKey: item.idempotencyKey, leaseId: item.leaseId, outcome: "ack" })),
      });
    });
    try {
      for (const messageId of ["delivery-1", "delivery-2"]) {
        const batch = createMessageBatch("viza-resilience-critical-notifications", [{
          id: messageId,
          timestamp: new Date(),
          attempts: 1,
          body: {
            version: 2,
            idempotencyKey,
            workloadType: "critical_notification",
            eventType: "critical_notification.v1",
          },
        }]);
        const context = createExecutionContext();
        await worker.queue(batch, env, context);
        const result = await getQueueResult(batch, context);
        expect(result.explicitAcks).toStrictEqual([messageId]);
        expect(result.retryMessages).toStrictEqual([]);
      }
      expect(replay).toHaveBeenCalledTimes(1);
    } finally {
      replay.mockRestore();
    }
  });

  it.each([
    { errorCode: "runner_pool_not_ready", delaySeconds: 30, expectedDelaySeconds: 30 },
    { errorCode: "job_not_due", delaySeconds: 45, expectedDelaySeconds: 45 },
    { errorCode: "job_not_due", delaySeconds: 900, expectedDelaySeconds: 300 },
  ] as const)("honors semantic replay deferral $errorCode without acknowledging the queue message", async ({ errorCode, delaySeconds, expectedDelaySeconds }) => {
    const idempotencyKey = `queue-deferral-${errorCode}-${crypto.randomUUID()}`;
    await stateCommand({
      op: "enqueueOutbox",
      idempotencyKey,
      scope: "runner_job",
      eventType: "runner_job.wakeup.v1",
      blob: "opaque-ciphertext",
      now: Date.now(),
    });
    const replay = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { items: Array<{ idempotencyKey: string; leaseId: string }> };
      return Response.json({
        results: body.items.map((item) => ({
          idempotencyKey: item.idempotencyKey,
          leaseId: item.leaseId,
          outcome: "nack",
          errorCode,
          retryAfterSeconds: delaySeconds,
        })),
      });
    });
    try {
      const messageId = `deferral-${errorCode}`;
      const acknowledge = vi.fn();
      const retry = vi.fn();
      const batch = {
        queue: "viza-resilience-background",
        messages: [{
          id: messageId,
          timestamp: new Date(),
          attempts: 1,
          body: {
            version: 2,
            idempotencyKey,
            workloadType: "background",
            eventType: "runner_job.wakeup.v1",
          },
          ack: acknowledge,
          retry,
        }],
      } as unknown as MessageBatch<unknown>;
      await worker.queue(batch, env, createExecutionContext());
      expect(acknowledge).not.toHaveBeenCalled();
      expect(retry).toHaveBeenCalledWith({ delaySeconds: expectedDelaySeconds });
    } finally {
      replay.mockRestore();
    }
  });

  it("keeps semantic deferrals pending without consuming the failure budget", async () => {
    const idempotencyKey = `semantic-deferral-budget-${crypto.randomUUID()}`;
    const startedAt = Date.now();
    await stateCommand({
      op: "enqueueOutbox",
      idempotencyKey,
      scope: "runner_job",
      eventType: "runner_job.wakeup.v1",
      blob: "opaque-ciphertext",
      now: startedAt,
    });

    for (let index = 0; index < 25; index += 1) {
      const now = startedAt + index * 31_000;
      const claim = await stateCommand({ op: "claimOutboxByKey", idempotencyKey, now, leaseMs: 15_000 });
      expect(claim).toMatchObject({ outcome: "claimed" });
      const item = claim.item as { idempotencyKey: string; leaseId: string };
      const nacked = await stateCommand({
        op: "nackOutbox",
        items: [{ idempotencyKey: item.idempotencyKey, leaseId: item.leaseId, errorCode: "job_not_due", retryAfterSeconds: 30 }],
        now,
      });
      expect(nacked).toMatchObject({ retried: 0, deferred: 1, dead: 0 });
    }

    const finalClaim = await stateCommand({
      op: "claimOutboxByKey",
      idempotencyKey,
      now: startedAt + 25 * 31_000,
      leaseMs: 15_000,
    });
    expect(finalClaim).toMatchObject({ outcome: "claimed", item: { idempotencyKey } });
  });

  it("continues counting ordinary failures and dead-letters at the existing limit", async () => {
    const idempotencyKey = `ordinary-failure-budget-${crypto.randomUUID()}`;
    const startedAt = Date.now();
    await stateCommand({
      op: "enqueueOutbox",
      idempotencyKey,
      scope: "runner_job",
      eventType: "runner_job.wakeup.v1",
      blob: "opaque-ciphertext",
      now: startedAt,
    });

    for (let index = 0; index < 20; index += 1) {
      const now = startedAt + index * 31_000;
      const claim = await stateCommand({ op: "claimOutboxByKey", idempotencyKey, now, leaseMs: 15_000 });
      expect(claim).toMatchObject({ outcome: "claimed" });
      const item = claim.item as { idempotencyKey: string; leaseId: string };
      const nacked = await stateCommand({
        op: "nackOutbox",
        items: [{ idempotencyKey: item.idempotencyKey, leaseId: item.leaseId, errorCode: "replay_unavailable", retryAfterSeconds: 30 }],
        now,
      });
      expect(nacked).toMatchObject(index === 19 ? { retried: 0, dead: 1 } : { retried: 1, dead: 0 });
    }

    const finalClaim = await stateCommand({
      op: "claimOutboxByKey",
      idempotencyKey,
      now: startedAt + 21 * 31_000,
      leaseMs: 15_000,
    });
    expect(finalClaim).toMatchObject({ outcome: "dead" });
  });

  it("acknowledges legacy v1 queue deliveries with an explicit rollout signal", async () => {
    const legacyLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const batch = createMessageBatch("viza-resilience-background", [{
        id: "legacy-v1-delivery",
        timestamp: new Date(),
        attempts: 1,
        body: { version: 1, idempotencyKey: "legacy-v1", workloadType: "background" },
      }]);
      const context = createExecutionContext();
      await worker.queue(batch, env, context);
      const result = await getQueueResult(batch, context);
      expect(result.explicitAcks).toStrictEqual(["legacy-v1-delivery"]);
      expect(result.retryMessages).toStrictEqual([]);

      const entries = legacyLog.mock.calls.flat().map((entry) => String(entry));
      expect(entries.some((entry) => entry.includes('"event":"queue_legacy_v1_rejected"') && entry.includes('"reason":"v1_not_translatable"'))).toBe(true);
    } finally {
      legacyLog.mockRestore();
    }
  });

  it("keeps signed concurrency operations isolated by shard and rejects stale fencing", async () => {
    const scope = `http-gate-${crypto.randomUUID()}`;
    const firstKey = "provider-a";
    const secondKey = "provider-b";
    const firstAcquire = await request("/v1/concurrency/acquire", {
      scope,
      resourceKey: firstKey,
      capacity: 1,
      leaseSeconds: 60,
      ownerRef: "owner-a",
    });
    expect(firstAcquire.status).toBe(200);
    const firstPayload = await firstAcquire.json() as { acquired: boolean; leaseId: string; fencingToken: number; shard: string };
    expect(firstPayload).toMatchObject({ acquired: true });

    const sameShard = await request("/v1/concurrency/acquire", {
      scope,
      resourceKey: firstKey,
      capacity: 1,
      leaseSeconds: 60,
      ownerRef: "owner-a-second",
    });
    expect(sameShard.status).toBe(200);
    expect(await sameShard.json()).toMatchObject({ acquired: false, reason: "at_capacity", shard: firstPayload.shard });

    const separateShard = await request("/v1/concurrency/acquire", {
      scope,
      resourceKey: secondKey,
      capacity: 1,
      leaseSeconds: 60,
      ownerRef: "owner-b",
    });
    expect(separateShard.status).toBe(200);
    const separatePayload = await separateShard.json() as { acquired: boolean; leaseId: string; fencingToken: number; shard: string };
    expect(separatePayload).toMatchObject({ acquired: true });
    expect(separatePayload.shard).not.toBe(firstPayload.shard);

    const staleRenew = await request("/v1/concurrency/renew", {
      scope,
      resourceKey: firstKey,
      leaseId: firstPayload.leaseId,
      fencingToken: firstPayload.fencingToken + 1,
      leaseSeconds: 60,
    });
    expect(staleRenew.status).toBe(200);
    expect(await staleRenew.json()).toMatchObject({ renewed: false, reason: "stale_lease" });

    const renewed = await request("/v1/concurrency/renew", {
      scope,
      resourceKey: firstKey,
      leaseId: firstPayload.leaseId,
      fencingToken: firstPayload.fencingToken,
      leaseSeconds: 60,
    });
    expect(renewed.status).toBe(200);
    expect(await renewed.json()).toMatchObject({ renewed: true, fencingToken: firstPayload.fencingToken });

    const staleRelease = await request("/v1/concurrency/release", {
      scope,
      resourceKey: firstKey,
      leaseId: firstPayload.leaseId,
      fencingToken: firstPayload.fencingToken + 1,
    });
    expect(staleRelease.status).toBe(200);
    expect(await staleRelease.json()).toMatchObject({ released: false, reason: "stale_lease" });

    const releaseFirst = await request("/v1/concurrency/release", {
      scope,
      resourceKey: firstKey,
      leaseId: firstPayload.leaseId,
      fencingToken: firstPayload.fencingToken,
    });
    expect(releaseFirst.status).toBe(200);
    expect(await releaseFirst.json()).toMatchObject({ released: true });

    const releaseSecond = await request("/v1/concurrency/release", {
      scope,
      resourceKey: secondKey,
      leaseId: separatePayload.leaseId,
      fencingToken: separatePayload.fencingToken,
    });
    expect(releaseSecond.status).toBe(200);
    expect(await releaseSecond.json()).toMatchObject({ released: true });
  });

  it("enforces capacity concurrently and recovers expired gate leases with fencing", async () => {
    const shard = `test:${crypto.randomUUID()}`;
    const now = Date.now();
    const acquisitions = await Promise.all(Array.from({ length: 6 }, (_, index) => gateCommand(shard, {
      op: "acquire",
      capacity: 2,
      leaseMs: 30_000,
      ownerRef: `owner-${index}`,
      now,
    })));
    const acquired = acquisitions.filter((result) => result.acquired === true);
    expect(acquired).toHaveLength(2);
    expect(acquisitions.filter((result) => result.reason === "at_capacity")).toHaveLength(4);

    const first = acquired[0] as { leaseId: string; fencingToken: number };
    const staleRelease = await gateCommand(shard, {
      op: "release",
      leaseId: first.leaseId,
      fencingToken: first.fencingToken + 1,
      now: now + 1,
    });
    expect(staleRelease).toMatchObject({ released: false, reason: "stale_lease" });

    const recovered = await gateCommand(shard, {
      op: "acquire",
      capacity: 2,
      leaseMs: 30_000,
      ownerRef: "after-expiry",
      now: now + 30_001,
    });
    expect(recovered).toMatchObject({ acquired: true });
    expect(Number(recovered.fencingToken)).toBeGreaterThan(Math.max(...acquired.map((result) => Number(result.fencingToken))));

    const expiredRenewal = await gateCommand(shard, {
      op: "lease",
      leaseId: first.leaseId,
      fencingToken: first.fencingToken,
      leaseMs: 30_000,
      now: now + 30_001,
    });
    expect(expiredRenewal).toMatchObject({ renewed: false, reason: "stale_lease" });
  });
});
