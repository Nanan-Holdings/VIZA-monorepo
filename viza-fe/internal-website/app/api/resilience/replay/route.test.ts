import { randomBytes, randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClientMock = vi.hoisted(() => vi.fn());
const ensureFlyMachineCapacityMock = vi.hoisted(() => vi.fn());
const wakeCloudSubmissionWorkerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));
vi.mock("@/lib/fly-machine-wake.server", () => ({
  ensureFlyMachineCapacity: ensureFlyMachineCapacityMock,
}));
vi.mock("@/lib/submission-worker-wake.server", () => ({
  wakeCloudSubmissionWorker: wakeCloudSubmissionWorkerMock,
}));

import { POST } from "./route";
import {
  createSignature,
  encryptResilienceValue,
} from "@/lib/resilience/gateway";

const encodedKey = randomBytes(32).toString("base64");
const hmacSecret = "replay-test-secret-that-is-at-least-thirty-two-characters";

type AdminRow = Record<string, unknown> | null;

function configureAdmin(row: AdminRow, options: { rpcError?: { message: string } | null } = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle,
    single: maybeSingle,
  };
  createAdminClientMock.mockReturnValue({
    from: vi.fn(() => query),
    rpc: vi.fn().mockResolvedValue({ data: null, error: options.rpcError ?? null }),
  });
}

function signedReplayRequest(items: unknown[]): Request {
  const rawBody = JSON.stringify({ items });
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = randomUUID();
  const signature = createSignature({
    secret: hmacSecret,
    method: "POST",
    path: "/api/resilience/replay",
    timestamp,
    nonce,
    rawBody,
  });
  return new Request("https://viza.test/api/resilience/replay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Viza-Key-Id": "replay-test-key",
      "X-Viza-Timestamp": timestamp,
      "X-Viza-Nonce": nonce,
      "X-Viza-Signature": signature,
    },
    body: rawBody,
  });
}

function wakeItem(value: unknown, overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "runner-job-wakeup:job-1",
    eventType: "runner_job.wakeup.v1",
    blob: encryptResilienceValue(value, encodedKey),
    leaseId: "lease-1",
    ...overrides,
  };
}

describe("resilience replay route", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.VIZA_RESILIENCE_GATEWAY_URL = "https://resilience.test";
    process.env.VIZA_RESILIENCE_HMAC_KEY_ID = "replay-test-key";
    process.env.VIZA_RESILIENCE_HMAC_SECRET = hmacSecret;
    process.env.VIZA_RESILIENCE_DATA_KEY = encodedKey;
    ensureFlyMachineCapacityMock.mockReset();
    wakeCloudSubmissionWorkerMock.mockReset();
    ensureFlyMachineCapacityMock.mockResolvedValue({ ok: true, desired: 1 });
    wakeCloudSubmissionWorkerMock.mockResolvedValue({ ok: true });
    configureAdmin({ id: "job-1", status: "queued" });
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => warnSpy.mockRestore());

  it("wakes a queued pool runner job and echoes the lease", async () => {
    const response = await POST(signedReplayRequest([
      wakeItem({ version: 1, jobId: "job-1", target: "pool" }),
    ]));

    expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", { target: "pool" });
    expect(await response.json()).toEqual({
      ok: true,
      results: [{
        idempotencyKey: "runner-job-wakeup:job-1",
        leaseId: "lease-1",
        outcome: "ack",
      }],
    });
  });

  it.each(["succeeded", "running"])("acks a %s runner job without waking it", async (status) => {
    configureAdmin({ id: "job-1", status });

    const response = await POST(signedReplayRequest([
      wakeItem({ version: 1, jobId: "job-1", target: "pool" }),
    ]));

    expect(ensureFlyMachineCapacityMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: true,
      results: [{ idempotencyKey: "runner-job-wakeup:job-1", leaseId: "lease-1", outcome: "ack" }],
    });
  });

  it("permanently acknowledges a missing runner job", async () => {
    configureAdmin(null);

    const response = await POST(signedReplayRequest([
      wakeItem({ version: 1, jobId: "job-1", target: "pool" }),
    ]));

    expect(ensureFlyMachineCapacityMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: true,
      results: [{
        idempotencyKey: "runner-job-wakeup:job-1",
        leaseId: "lease-1",
        outcome: "ack",
        errorCode: "job_not_found",
      }],
    });
  });

  it("nacks transient Fly capacity failure with bounded retry", async () => {
    ensureFlyMachineCapacityMock.mockResolvedValue({ ok: false, reason: "request_failed" });

    const response = await POST(signedReplayRequest([
      wakeItem({ version: 1, jobId: "job-1", target: "pool" }),
    ]));

    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: true,
      results: [{
        idempotencyKey: "runner-job-wakeup:job-1",
        leaseId: "lease-1",
        outcome: "nack",
        errorCode: "fly_capacity_unavailable",
        retryAfterSeconds: 30,
      }],
    });
  });

  it("nacks transient authenticated wake failure with bounded retry", async () => {
    wakeCloudSubmissionWorkerMock.mockResolvedValue({ ok: false, reason: "request_failed" });

    const response = await POST(signedReplayRequest([
      wakeItem({ version: 1, jobId: "job-1", target: "pool" }),
    ]));

    expect(await response.json()).toMatchObject({
      ok: true,
      results: [{
        outcome: "nack",
        errorCode: "worker_wake_unavailable",
        retryAfterSeconds: 30,
      }],
    });
  });

  it("rejects extra URL and target fields in the decrypted pointer", async () => {
    const response = await POST(signedReplayRequest([
      wakeItem({
        version: 1,
        jobId: "job-1",
        target: "pool",
        url: "https://attacker.test",
      }),
    ]));

    expect(ensureFlyMachineCapacityMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: true,
      results: [{ idempotencyKey: "runner-job-wakeup:job-1", outcome: "ack", errorCode: "invalid_event" }],
    });
  });

  it("preserves application answer replay behavior", async () => {
    const adminRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createAdminClientMock.mockReturnValue({ rpc: adminRpc });
    const response = await POST(signedReplayRequest([{
      idempotencyKey: "application-answers:app-1",
      eventType: "application_answers.v1",
      blob: encryptResilienceValue({
        version: 1,
        applicantId: "user-1",
        applicationId: "app-1",
        savedAt: "2026-08-14T00:00:00.000Z",
        answers: { surname: "Chen" },
      }, encodedKey),
      leaseId: "lease-answers",
    }]));

    expect(adminRpc).toHaveBeenCalledWith("replay_resilient_application_answers", expect.any(Object));
    expect(await response.json()).toEqual({
      ok: true,
      results: [{
        idempotencyKey: "application-answers:app-1",
        leaseId: "lease-answers",
        outcome: "ack",
      }],
    });
  });

  it("acknowledges unsupported events with existing semantics", async () => {
    const response = await POST(signedReplayRequest([{
      idempotencyKey: "future-event-1",
      eventType: "future.event.v1",
      blob: "opaque",
      leaseId: "lease-future",
    }]));

    expect(await response.json()).toEqual({
      ok: true,
      results: [{
        idempotencyKey: "future-event-1",
        leaseId: "lease-future",
        outcome: "ack",
        errorCode: "unsupported_event",
      }],
    });
  });
});
