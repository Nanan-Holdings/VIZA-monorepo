import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  finishDs160Attempt,
  releaseDs160SubmittedLeaseWithRetry,
} from "../submission-queue-claim";

const indexPath = path.resolve(__dirname, "..", "index.ts");
const retiredHelperPath = path.resolve(__dirname, "..", "ds160-auto-email.ts");

test("successful DS-160 submissions do not create or drain automatic email intents", () => {
  const source = readFileSync(indexPath, "utf8");

  assert.equal(existsSync(retiredHelperPath), false);
  assert.doesNotMatch(source, /ds160-auto-email/);
  assert.doesNotMatch(source, /automaticEmail/);
  assert.doesNotMatch(source, /dispatchDs160AutomaticEmails/);
  assert.doesNotMatch(source, /enqueue_ds160_proof_email/);
  assert.match(source, /status: "ds160_submitted"/);
  assert.match(source, /persistDs160SubmittedArtifacts/);
  assert.match(source, /proofArtifacts:/);
  assert.match(source, /releaseDs160SubmittedLease/);
  assert.match(source, /finishDs160Attempt/);
});

test("submitted lease release follows browser cleanup and preserves the official result", async () => {
  const claim = {
    id: "00000000-0000-4000-8000-000000000001",
    application_id: "00000000-0000-4000-8000-000000000002",
    locked_by: "worker-test",
    locked_at: "2026-10-02T00:00:00Z",
  };
  const row: Record<string, unknown> = {
    ...claim,
    status: "ds160_submitted",
    locked_until: "2099-01-01T00:00:00Z",
    ceac_result_payload: {
      applicationId: "AA00FIXTURE",
      proofArtifacts: { status: "available", confirmationPdfStoragePath: "private/confirmation.pdf" },
    },
  };
  const events: string[] = [];
  let patchCalls = 0;
  let transientFailure = true;
  const client = createClient("https://unit.invalid", "unit-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        patchCalls += 1;
        const url = new URL(String(input));
        assert.equal(init?.method, "PATCH");
        assert.equal(url.pathname, "/rest/v1/submission_queue");
        if (transientFailure) {
          transientFailure = false;
          return new Response(JSON.stringify({ message: "temporary transport failure" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        const matches = ["id", "application_id", "locked_by", "locked_at"]
          .every((key) => url.searchParams.get(key) === `eq.${row[key]}`)
          && url.searchParams.get("status") === "eq.ds160_submitted"
          && url.searchParams.get("locked_until")?.startsWith("gt.");
        if (matches) Object.assign(row, JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(JSON.stringify(matches ? { id: row.id } : null), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });

  await finishDs160Attempt({
    closeSession: async () => { events.push("browser-closed"); },
    stopRenewal: async () => { events.push("heartbeat-stopped"); },
    releaseRetry: async () => { events.push("pre-final-release-checked"); },
  });
  assert.deepEqual(events, ["browser-closed", "heartbeat-stopped", "pre-final-release-checked"]);

  events.push("submitted-release-started");
  assert.equal(await releaseDs160SubmittedLeaseWithRetry(client, claim), true);
  events.push("submitted-release-finished");

  assert.deepEqual(events, [
    "browser-closed",
    "heartbeat-stopped",
    "pre-final-release-checked",
    "submitted-release-started",
    "submitted-release-finished",
  ]);
  assert.equal(patchCalls, 2);
  assert.equal(row.status, "ds160_submitted");
  assert.equal(row.locked_by, null);
  assert.equal(row.locked_at, null);
  assert.equal(row.locked_until, null);
  assert.deepEqual(row.ceac_result_payload, {
    applicationId: "AA00FIXTURE",
    proofArtifacts: { status: "available", confirmationPdfStoragePath: "private/confirmation.pdf" },
  });

  const callsAfterRelease = patchCalls;
  row.locked_by = "replacement-worker";
  row.locked_at = "2026-10-02T00:01:00Z";
  row.locked_until = "2099-01-01T00:00:00Z";
  assert.equal(
    await releaseDs160SubmittedLeaseWithRetry(client, claim),
    false,
  );
  assert.equal(patchCalls, callsAfterRelease + 1);
  assert.equal(row.locked_by, "replacement-worker");
  assert.equal(row.locked_at, "2026-10-02T00:01:00Z");
  assert.equal(row.locked_until, "2099-01-01T00:00:00Z");
});

test("failed browser cleanup retains the submitted claim and cannot release it", async () => {
  const claim = {
    id: "00000000-0000-4000-8000-000000000003",
    application_id: "00000000-0000-4000-8000-000000000004",
    locked_by: "worker-test",
    locked_at: "2026-10-02T00:00:00Z",
  };
  const events: string[] = [];

  await assert.rejects(
    finishDs160Attempt({
      closeSession: async () => {
        events.push("browser-close-failed");
        throw new Error("close failed");
      },
      stopRenewal: async () => { events.push("heartbeat-stopped"); },
      releaseRetry: async () => { events.push("release-must-not-run"); },
    }),
    /close failed/,
  );

  assert.deepEqual(events, ["browser-close-failed", "heartbeat-stopped"]);
  assert.deepEqual(claim, {
    id: "00000000-0000-4000-8000-000000000003",
    application_id: "00000000-0000-4000-8000-000000000004",
    locked_by: "worker-test",
    locked_at: "2026-10-02T00:00:00Z",
  });
});
