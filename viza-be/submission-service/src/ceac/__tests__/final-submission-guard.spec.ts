import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDs160FinalSubmissionGuard,
  hashSensitive,
  type FinalSubmissionReadQuery,
  type FinalSubmissionRpcClient,
  type FinalSubmissionRpcResponse,
} from "../final-submission-guard";

const VIZA_APPLICATION_ID = "viza-application-1";
const QUEUE_ID = "queue-1";
const OWNER_ID = "worker-1";

class MemoryRpcClient implements FinalSubmissionRpcClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  private readonly attempts = new Map<string, { attemptId: string; state: "started" | "unknown" | "confirmed" }>();
  private nextAttempt = 1;

  async rpc(name: string, args: Record<string, unknown>): Promise<FinalSubmissionRpcResponse> {
    this.calls.push({ name, args });
    const key = `${args.p_application_id}:${args.p_authorization_id}`;
    if (name === "begin_ds160_final_submission") {
      const existing = this.attempts.get(key);
      if (existing) {
        return {
          data: [{ decision: existing.state === "started" ? "already_started" : existing.state, attempt_id: existing.attemptId, attempt_state: existing.state }],
          error: null,
        };
      }
      const attempt = { attemptId: `attempt-${this.nextAttempt++}`, state: "started" as const };
      this.attempts.set(key, attempt);
      return { data: [{ decision: "acquired", attempt_id: attempt.attemptId, attempt_state: attempt.state }], error: null };
    }

    const attempt = [...this.attempts.values()].find((candidate) => candidate.attemptId === args.p_attempt_id);
    if (!attempt) return { data: [], error: null };
    if (name === "mark_ds160_final_submission_unknown") {
      attempt.state = "unknown";
      return { data: [{ attempt_id: attempt.attemptId, attempt_state: attempt.state }], error: null };
    }
    if (name === "confirm_ds160_final_submission") {
      attempt.state = "confirmed";
      return { data: [{ attempt_id: attempt.attemptId, attempt_state: attempt.state }], error: null };
    }
    return { data: null, error: { message: "unexpected rpc" } };
  }
}

class MemoryReadClient implements FinalSubmissionRpcClient {
  rpcCalls = 0;

  constructor(private readonly row: Record<string, unknown> | null) {}

  from(tableName: string) {
    assert.equal(tableName, "ds160_final_submission_attempts");
    const filters = new Map<string, string>();
    const query: FinalSubmissionReadQuery = {
      eq: (column, value) => {
        filters.set(column, value);
        return query;
      },
      maybeSingle: async () => {
        assert.equal(filters.get("application_id"), VIZA_APPLICATION_ID);
        assert.equal(filters.get("authorization_id"), QUEUE_ID);
        return { data: this.row, error: null };
      },
    };
    return { select: (_columns: string) => query };
  }

  async rpc(): Promise<FinalSubmissionRpcResponse> {
    this.rpcCalls += 1;
    return { data: null, error: { message: "inspect must use the read path" } };
  }
}

function guardFor(client: FinalSubmissionRpcClient, authorizationId: string) {
  return createDs160FinalSubmissionGuard({
    client,
    applicationId: VIZA_APPLICATION_ID,
    authorizationId,
    queueId: QUEUE_ID,
    ownerId: OWNER_ID,
  });
}

test("inspects the durable table before bootstrap without an inspect RPC", async () => {
  const client = new MemoryReadClient({ id: "attempt-unknown", state: "unknown" });
  const inspection = await guardFor(client, QUEUE_ID).inspect();

  assert.deepEqual(inspection, {
    kind: "unknown",
    attemptId: "attempt-unknown",
    state: "unknown",
  });
  assert.equal(client.rpcCalls, 0);
});

test("persists one logical reservation and blocks the same authorization on a later run", async () => {
  const client = new MemoryRpcClient();
  const firstRun = guardFor(client, QUEUE_ID);
  const acquired = await firstRun.begin();
  assert.equal(acquired.kind, "acquired");
  await firstRun.markUnknown("confirmation response timed out; applicant answer must never be logged");

  const retry = guardFor(client, QUEUE_ID);
  const blocked = await retry.begin();
  assert.equal(blocked.kind, "unknown");
  assert.equal(client.calls.filter((call) => call.name === "begin_ds160_final_submission").length, 2);

  const explicitResubmit = guardFor(client, "explicit-resubmit-2");
  const newReservation = await explicitResubmit.begin();
  assert.equal(newReservation.kind, "acquired");
});

test("hashes official identifiers before recording verified evidence", async () => {
  const client = new MemoryRpcClient();
  const guard = guardFor(client, "authorization-1");
  const acquired = await guard.begin();
  assert.equal(acquired.kind, "acquired");

  const officialApplicationId = "AA00SECRET1234";
  const confirmationNumber = "CONF-SECRET-123";
  await guard.markConfirmed({
    officialApplicationId,
    confirmationNumber,
    confirmationPageUrl: "https://ceac.state.gov/GenNIV/Confirmation.aspx",
  });

  const call = client.calls[client.calls.length - 1];
  assert.ok(call);
  assert.equal(call.name, "confirm_ds160_final_submission");
  assert.equal(call.args.p_official_application_id_hash, hashSensitive(officialApplicationId));
  assert.equal(call.args.p_confirmation_number_hash, hashSensitive(confirmationNumber));
  assert.notEqual(call.args.p_official_application_id_hash, officialApplicationId);
  assert.notEqual(call.args.p_confirmation_number_hash, confirmationNumber);
});

test("fails closed when a guard RPC returns no row", async () => {
  const client: FinalSubmissionRpcClient = {
    async rpc(): Promise<FinalSubmissionRpcResponse> {
      return { data: [], error: null };
    },
  };
  const guard = guardFor(client, "authorization-1");
  await assert.rejects(guard.begin(), /returned an invalid result/);
});
