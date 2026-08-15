import assert from "node:assert/strict";
import test from "node:test";
import { RunnerJobOwnershipLostError } from "../execution-context.js";

process.env.SUPABASE_URL ??= "https://takeover-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "takeover-test-key";

test("human takeover fails closed when the runner_job update returns no row", async () => {
  const [{ supabase }, { requestHumanTakeover }] = await Promise.all([
    import("../../supabase.js"),
    import("../takeover.js"),
  ]);
  const client = supabase as unknown as {
    from: (table: string) => Record<string, (...args: unknown[]) => unknown>;
  };
  const originalFrom = client.from;
  const tables: string[] = [];
  const updateBuilder: Record<string, (...args: unknown[]) => unknown> = {
    update: () => updateBuilder,
    eq: () => updateBuilder,
    select: () => updateBuilder,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  client.from = ((table: string) => {
    tables.push(table);
    return updateBuilder;
  }) as typeof client.from;
  try {
    await assert.rejects(
      () => requestHumanTakeover({
        jobId: "job-expired",
        applicationId: "app-1",
        applicantId: "user-1",
        reason: "operator needed",
        remoteDebugUrl: "https://debug.invalid/session",
      }),
      (error: unknown) => error instanceof RunnerJobOwnershipLostError,
    );
    assert.deepEqual(tables, ["runner_job"]);
  } finally {
    client.from = originalFrom;
  }
});
