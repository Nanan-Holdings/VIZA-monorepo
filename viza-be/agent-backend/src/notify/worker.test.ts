import { describe, expect, it, vi } from "vitest";
import {
  processOnce,
  type NotificationRpcClient,
} from "./worker.js";

type RpcCall = { name: string; args: Record<string, unknown> };

function queuedEvent(id: number): Record<string, unknown> {
  return {
    id,
    applicant_id: "applicant-1",
    application_id: "application-1",
    event: "application_submitted",
    template_key: "application_submitted",
    channel: "email",
    recipient: "applicant@example.test",
    payload: {
      applicant_name: "Test Applicant",
      country: "Vietnam",
      visa_type: "eVisa",
      application_url: "https://example.test/status",
    },
    retry_count: 0,
  };
}

function clientWithClaimedRows(rows: Record<string, unknown>[], calls: RpcCall[]): NotificationRpcClient {
  return {
    rpc(name, args) {
      calls.push({ name, args });
      if (name === "claim_notification_event_batch") {
        return Promise.resolve({ data: rows, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    },
  };
}

describe("notification leased worker", () => {
  it("lets concurrent workers claim disjoint rows", async () => {
    const pending = [queuedEvent(1), queuedEvent(2)];
    const owners = new Map<number, string>();
    const client: NotificationRpcClient = {
      rpc(name, args) {
        if (name === "claim_notification_event_batch") {
          const next = pending.shift();
          if (next) owners.set(Number(next.id), String(args.p_worker_id));
          return Promise.resolve({ data: next ? [next] : [], error: null });
        }
        const id = Number(args.p_event_id);
        const ownsLease = owners.get(id) === args.p_worker_id;
        if (ownsLease) owners.delete(id);
        return Promise.resolve({ data: ownsLease, error: null });
      },
    };
    const delivered: string[] = [];
    const sendEmail = vi.fn(async ({ to }: { to: string }) => {
      delivered.push(to);
      return { ok: true, retry: false, externalId: `sent-${delivered.length}` };
    });

    const [first, second] = await Promise.all([
      processOnce({ client, workerId: "worker-a", batchSize: 1, sendEmail }),
      processOnce({ client, workerId: "worker-b", batchSize: 1, sendEmail }),
    ]);

    expect(first).toEqual({ processed: 1, sent: 1, dlq: 0 });
    expect(second).toEqual({ processed: 1, sent: 1, dlq: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(owners.size).toBe(0);
  });

  it("claims with a worker lease and conditionally acknowledges a successful send", async () => {
    const calls: RpcCall[] = [];
    const sendEmail = vi.fn().mockResolvedValue({
      ok: true,
      retry: false,
      externalId: "provider-message-1",
    });

    const result = await processOnce({
      client: clientWithClaimedRows([queuedEvent(101)], calls),
      workerId: "worker-a",
      batchSize: 2,
      leaseSeconds: 600,
      sendEmail,
    });

    expect(result).toEqual({ processed: 1, sent: 1, dlq: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      {
        name: "claim_notification_event_batch",
        args: { p_worker_id: "worker-a", p_limit: 2, p_lease_seconds: 600 },
      },
      {
        name: "ack_notification_event",
        args: {
          p_event_id: 101,
          p_worker_id: "worker-a",
          p_external_id: "provider-message-1",
        },
      },
    ]);
  });

  it("does not count a sent notification when a stale worker loses the ack race", async () => {
    const calls: RpcCall[] = [];
    const client: NotificationRpcClient = {
      rpc(name, args) {
        calls.push({ name, args });
        return Promise.resolve({
          data: name === "claim_notification_event_batch" ? [queuedEvent(102)] : false,
          error: null,
        });
      },
    };

    const result = await processOnce({
      client,
      workerId: "stale-worker",
      sendEmail: vi.fn().mockResolvedValue({ ok: true, retry: false }),
    });

    expect(result).toEqual({ processed: 1, sent: 0, dlq: 0 });
    expect(calls.at(-1)).toMatchObject({
      name: "ack_notification_event",
      args: { p_event_id: 102, p_worker_id: "stale-worker" },
    });
  });

  it("terminally nacks through one RPC so settlement and DLQ insertion stay atomic", async () => {
    const calls: RpcCall[] = [];
    const row = { ...queuedEvent(103), retry_count: 4 };

    const result = await processOnce({
      client: clientWithClaimedRows([row], calls),
      workerId: "worker-b",
      now: () => new Date("2026-08-13T00:00:00.000Z"),
      sendEmail: vi.fn().mockResolvedValue({
        ok: false,
        retry: true,
        error: "provider timeout",
      }),
    });

    expect(result).toEqual({ processed: 1, sent: 0, dlq: 1 });
    expect(calls.at(-1)).toEqual({
      name: "nack_notification_event",
      args: {
        p_event_id: 103,
        p_worker_id: "worker-b",
        p_error: "provider timeout",
        p_retry_count: 5,
        p_next_attempt_at: null,
        p_terminal: true,
        p_failure_code: "provider_timeout",
      },
    });
  });
});
