import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CeacSession } from "../ceac/session";
import type { ApplicantProfile, SubmissionQueueItem } from "../types";
import {
  ds160RecipientDigest, processDs160OfficialEmailJob,
  type Ds160EmailJobDependencies,
} from "../ds160-proof-email";

const queueId = "00000000-0000-4000-8000-000000000001";
const makeItem = (): SubmissionQueueItem => ({
  id: queueId, application_id: "fixture-application", provider: "ceac_proof",
  status: "ds160_proof_pending", attempts: 0, last_error: null,
  locked_by: "fixture-worker", locked_at: new Date().toISOString(),
  fv_result_payload: null, fv_application_reference: null, fv_pdf_storage_path: null,
  uk_result_payload: null, uk_application_reference: null, au_result_payload: null,
  au_trn: null, au_review_screenshot_storage_path: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ceac_result_payload: { action: "official_ceac_email", email: {
    status: "queued", request_id: "00000000-0000-4000-8000-000000000002",
    recipient_sha256: ds160RecipientDigest("applicant@example.test"),
  } },
});

function fixture(options: { failBefore?: boolean; failAfter?: boolean; denyReserve?: boolean; closeFails?: boolean; recipientChanged?: boolean; reserved?: boolean } = {}) {
  const events: string[] = [];
  let settlement: Record<string, unknown> | undefined;
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      events.push(name);
      if (name === "renew_submission_queue_lease") return { data: [{ id: queueId, locked_until: new Date(Date.now() + 900_000).toISOString() }], error: null };
      if (name === "start_ds160_proof_email") {
        const item = makeItem();
        if (options.reserved) item.ceac_result_payload!.email = {
          ...(item.ceac_result_payload!.email as object), status: "sending", send_started_at: new Date().toISOString(),
        };
        return { data: [item], error: null };
      }
      if (name === "reserve_ds160_email_send" && options.denyReserve) return { data: [], error: null };
      if (name === "settle_ds160_proof_email") settlement = args;
      return { data: [{ id: queueId }], error: null };
    },
    from: (table: string) => {
      assert.equal(table, "applications");
      return { select: () => ({ eq: () => ({ single: async () => ({ error: null, data: {
        ds160_application_id: "AA00TEST00", submission_result: { country: "US", status: "submitted",
          applicationId: "AA00TEST00", surnameFirst5: "TEST", yearOfBirth: "1990", securityAnswer: "fixture" },
      } }) }) }) };
    },
    auth: { admin: { getUserById: async () => ({ error: null, data: { user: { email: options.recipientChanged ? "changed@example.test" : "applicant@example.test" } } }) } },
  } as unknown as SupabaseClient;
  const session = {
    page: { goto: async () => { events.push("goto"); }, isClosed: () => true },
    close: async () => { events.push("close"); if (options.closeFails) throw new Error("fixture close failure"); },
  } as unknown as CeacSession;
  const dependencies: Ds160EmailJobDependencies = {
    client, headless: true, leaseSeconds: 900,
    loadProfile: async () => ({ auth_user_id: "fixture-user" } as ApplicantProfile),
    loadAnswers: async () => ({ consular_post: "SHG" }),
    runtime: {
      startSession: async () => { events.push("open"); return session; },
      retrieve: async () => { events.push("retrieve"); },
      waitForConfirmation: async () => undefined,
      ensureEnglish: async () => undefined,
      sendEmail: async input => {
        if (options.failBefore) throw new Error("fixture pre-send failure");
        await input.beforeSend();
        events.push("send");
        if (options.failAfter) throw new Error("fixture post-send failure");
        return { status: "sent", applicationIdVerified: true, recipientVerified: true,
          diagnostics: { sendAttempted: true, dispatchClickTimedOut: false, finalPath: "/GenNIV/common/email.aspx", elapsedMs: 1, events: [] } };
      },
    },
  };
  return { dependencies, events, settlement: () => settlement };
}

test("official email reserves once, closes before settlement, and never mutates submitted application", async () => {
  const f = fixture();
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "sent");
  assert.equal(f.events.filter(x => x === "send").length, 1);
  assert.ok(f.events.indexOf("reserve_ds160_email_send") < f.events.indexOf("send"));
  assert.ok(f.events.indexOf("close") < f.events.indexOf("settle_ds160_proof_email"));
});

test("post-dispatch disconnect is unknown and never retried", async () => {
  const f = fixture({ failAfter: true });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "unknown");
  assert.equal(f.events.filter(x => x === "send").length, 1);
});

test("pre-dispatch failure settles failed without reserving or sending", async () => {
  const f = fixture({ failBefore: true });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "failed");
  assert.ok(!f.events.includes("reserve_ds160_email_send"));
});

test("fresh dispatch fence stops a stale claim before browser startup", async () => {
  const f = fixture({ reserved: true });
  const item = makeItem();
  await processDs160OfficialEmailJob(item, f.dependencies);
  assert.equal(f.settlement()?.p_status, "unknown");
  assert.ok(!f.events.includes("open"));
});

test("changed account email fails before opening CEAC", async () => {
  const f = fixture({ recipientChanged: true });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "failed");
  assert.ok(!f.events.includes("open"));
});

test("a denied dispatch fence cannot send", async () => {
  const f = fixture({ denyReserve: true });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.ok(!f.events.includes("send"));
  assert.equal(f.settlement()?.p_status, "failed");
});

test("provider cleanup failure never publishes a terminal/retryable queue", async () => {
  const f = fixture({ closeFails: true });
  await assert.rejects(processDs160OfficialEmailJob(makeItem(), f.dependencies), /fixture close failure/);
  assert.equal(f.settlement(), undefined);
});
