import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDs160AutomaticEmailIntent, markDs160AutomaticEmailReady, dispatchDs160AutomaticEmails } from "../ds160-auto-email";
import { finishDs160Attempt } from "../submission-queue-claim";

type Row = Record<string, unknown>;
const appId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const claim = { id: sourceId, application_id: appId, locked_by: "worker-test", locked_at: "2026-09-30T00:00:00Z" };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function fixture() {
  const source: Row = {
    ...claim, status: "ds160_submitted", provider: "ceac_live", mode: "live_assisted", locked_until: "2099-01-01T00:00:00Z",
    ceac_result_payload: { applicationId: "AA00FIXTURE", audit: { retained: true }, automaticEmail: createDs160AutomaticEmailIntent() },
  };
  const tables: Record<string, Row[]> = {
    submission_queue: [source],
    applications: [{ id: appId, applicant_id: "profile", ds160_application_id: "AA00FIXTURE", submission_result: { country: "US", status: "submitted", applicationId: "AA00FIXTURE" } }],
    ds160_final_submission_attempts: [{ id: "fence", application_id: appId, state: "confirmed", official_application_id_hash: hash("AA00FIXTURE") }],
    applicant_profiles: [{ id: "profile", auth_user_id: userId }],
  };
  const rpcCalls: Array<{ name: string; args: Row }> = [];
  const writes: string[] = [];
  const emails = new Map<string, Row>();
  let ambiguousRpcOnce = false;
  let authError = false;
  let renewOnFenceRead = false;
  function read(row: Row, column: string): unknown {
    const value = column.split(/->>?/).reduce<unknown>((value, key) => (value as Row | null)?.[key], row);
    return column.includes("->>") && value != null ? String(value) : value;
  }
  function from(table: string) {
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    let limit = Infinity;
    const execute = (single = false) => {
      if (table === "ds160_final_submission_attempts" && renewOnFenceRead) {
        source.locked_until = "2099-01-02T00:00:00Z";
        renewOnFenceRead = false;
      }
      const rows = (tables[table] ?? []).filter(row => filters.every(predicate => predicate(row))).slice(0, limit);
      if (patch) {
        writes.push(table);
        for (const row of rows) Object.assign(row, structuredClone(patch));
      }
      return { data: structuredClone(single ? rows[0] ?? null : rows), error: null };
    };
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) { filters.push(row => read(row, column) === value); return query; },
      is(column: string, value: unknown) { filters.push(row => read(row, column) === value); return query; },
      gt(column: string, value: string) { filters.push(row => typeof row[column] === "string" && row[column] > value); return query; },
      order() { return query; },
      limit(value: number) { limit = value; return query; },
      abortSignal() { return query; },
      update(value: Row) { patch = value; return query; },
      maybeSingle: async () => execute(true),
      then(resolve: (value: ReturnType<typeof execute>) => unknown) { return Promise.resolve(execute()).then(resolve); },
    };
    return query;
  }
  const client = {
    from,
    auth: { admin: { getUserById: async (id: string) => {
      assert.equal(id, userId);
      return { data: { user: { email: " Account@Example.test " } }, error: authError ? { message: "unavailable" } : null };
    } } },
    rpc: async (name: string, args: Row) => {
      rpcCalls.push({ name, args });
      assert.equal(name, "enqueue_ds160_proof_email");
      assert.equal(args.p_retry, false);
      assert.equal(args.p_auth_user_id, userId);
      assert.equal(args.p_recipient_sha256, hash("account@example.test"));
      const key = String(args.p_request_id);
      if (!emails.has(key)) emails.set(key, { id: "mail-job", application_id: appId, ceac_result_payload: { action: "official_ceac_email", email: { status: "queued" } } });
      if (ambiguousRpcOnce) { ambiguousRpcOnce = false; return { data: null, error: { message: "lost response" } }; }
      return { data: [emails.get(key)], error: null };
    },
  } as unknown as SupabaseClient;
  return { client, source, tables, rpcCalls, writes, emails,
    ambiguousRpc: () => { ambiguousRpcOnce = true; }, failAuth: () => { authError = true; },
    renewDuringHandoff: () => { renewOnFenceRead = true; } };
}

test("confirmed submission closes browser before handing off one automatic account email", async () => {
  const f = fixture();
  const events: string[] = [];
  await finishDs160Attempt({
    closeSession: async () => { events.push("closed"); },
    stopRenewal: async () => { events.push("heartbeat-stopped"); },
    releaseRetry: async () => undefined,
  });
  assert.equal(await markDs160AutomaticEmailReady(f.client, claim), true);
  assert.deepEqual(events, ["closed", "heartbeat-stopped"]);
  assert.equal(f.source.locked_until, null);
  assert.equal(await dispatchDs160AutomaticEmails(f.client), 1);
  assert.equal(await dispatchDs160AutomaticEmails(f.client), 0);
  assert.equal(f.rpcCalls.length, 1);
  assert.equal(f.rpcCalls[0].args.p_request_id, sourceId);
  assert.deepEqual((f.source.ceac_result_payload as Row).audit, { retained: true });
  assert.ok(f.writes.every(table => table === "submission_queue"));
  assert.equal((f.tables.applications[0].submission_result as Row).status, "submitted");
});

test("cleanup failure leaves the intent unready and cannot enqueue", async () => {
  const f = fixture();
  await assert.rejects(async () => {
    await finishDs160Attempt({ closeSession: async () => { throw new Error("close failed"); }, stopRenewal: async () => undefined, releaseRetry: async () => undefined });
    await markDs160AutomaticEmailReady(f.client, claim);
  });
  assert.equal(await dispatchDs160AutomaticEmails(f.client), 0);
  assert.equal(f.rpcCalls.length, 0);
  assert.equal(f.source.locked_by, claim.locked_by);
});

test("renewed lease during handoff is preserved rather than cleared", async () => {
  const f = fixture();
  f.renewDuringHandoff();
  assert.equal(await markDs160AutomaticEmailReady(f.client, claim), false);
  assert.equal(f.source.locked_until, "2099-01-02T00:00:00Z");
  assert.equal(f.source.locked_by, claim.locked_by);
  assert.equal(await dispatchDs160AutomaticEmails(f.client), 0);
});

test("ready scans exclude non-source, unsupported-version and partially locked intents", async () => {
  for (const variation of ["provider", "mode", "version", "locked-at"] as const) {
    const f = fixture();
    await markDs160AutomaticEmailReady(f.client, claim);
    if (variation === "provider") f.source.provider = "ceac_proof";
    if (variation === "mode") f.source.mode = "prefill";
    if (variation === "version") ((f.source.ceac_result_payload as Row).automaticEmail as Row).version = 2;
    if (variation === "locked-at") f.source.locked_at = claim.locked_at;
    assert.equal(await dispatchDs160AutomaticEmails(f.client), 0, variation);
    assert.equal(f.rpcCalls.length, 0, variation);
  }
});

test("processing, expired, replaced and legacy claims never release or enqueue", async () => {
  for (const variation of ["processing", "expired", "other-owner", "legacy"] as const) {
    const f = fixture();
    if (variation === "processing") f.source.status = "ds160_live_assisted_processing";
    if (variation === "expired") f.source.locked_until = "2000-01-01T00:00:00Z";
    if (variation === "other-owner") f.source.locked_at = "2026-09-30T01:00:00Z";
    if (variation === "legacy") delete (f.source.ceac_result_payload as Row).automaticEmail;
    assert.equal(await markDs160AutomaticEmailReady(f.client, claim), false, variation);
    assert.equal(await dispatchDs160AutomaticEmails(f.client), 0, variation);
    assert.equal(f.rpcCalls.length, 0);
  }
});

test("a mismatching result or unconfirmed/different-application fence fails closed", async () => {
  for (const variation of ["result", "fence", "identity"] as const) {
    const f = fixture();
    if (variation === "result") (f.tables.applications[0].submission_result as Row).status = "failed";
    if (variation === "fence") f.tables.ds160_final_submission_attempts[0].state = "unknown";
    if (variation === "identity") f.tables.ds160_final_submission_attempts[0].official_application_id_hash = hash("AA00OTHER");
    await assert.rejects(markDs160AutomaticEmailReady(f.client, claim));
    assert.equal(f.source.locked_by, claim.locked_by);
    assert.equal(f.rpcCalls.length, 0);
  }
});

test("ambiguous enqueue is reconciled with the same request id, not another send", async () => {
  const f = fixture();
  await markDs160AutomaticEmailReady(f.client, claim);
  f.ambiguousRpc();
  assert.equal(await dispatchDs160AutomaticEmails(f.client), 0);
  assert.equal(await dispatchDs160AutomaticEmails(f.client), 1);
  assert.equal(f.rpcCalls.length, 2);
  assert.equal(f.emails.size, 1);
  assert.ok(f.rpcCalls.every(call => call.args.p_request_id === sourceId && call.args.p_retry === false));
  assert.ok(f.writes.every(table => table === "submission_queue"));
});

test("account outage retains a ready intent without changing application success", async () => {
  const f = fixture();
  await markDs160AutomaticEmailReady(f.client, claim);
  f.failAuth();
  assert.equal(await dispatchDs160AutomaticEmails(f.client), 0);
  assert.equal(f.rpcCalls.length, 0);
  assert.equal(((f.source.ceac_result_payload as Row).automaticEmail as Row).status, "ready");
  assert.equal((f.tables.applications[0].submission_result as Row).status, "submitted");
});

test("existing terminal email is reused without replaying it", async () => {
  for (const status of ["sent", "unknown", "failed"]) {
    const f = fixture();
    f.emails.set(sourceId, { id: "prior-email", application_id: appId, ceac_result_payload: { action: "official_ceac_email", email: { status } } });
    await markDs160AutomaticEmailReady(f.client, claim);
    assert.equal(await dispatchDs160AutomaticEmails(f.client), 1);
    assert.equal(await dispatchDs160AutomaticEmails(f.client), 0);
    assert.equal(f.emails.size, 1);
    assert.equal(((f.source.ceac_result_payload as Row).automaticEmail as Row).jobId, "prior-email");
  }
});
