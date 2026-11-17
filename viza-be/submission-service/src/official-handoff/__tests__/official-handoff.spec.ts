import assert from "node:assert/strict";
import test from "node:test";
import type { Browser, Page } from "@playwright/test";
import {
  browserbaseSessionIdFromRef,
  openOfficialApplicantHandoff,
  runOfficialHandoffWatchTick,
  type LeasedOfficialHandoff,
  type OfficialHandoffInspection,
  type OfficialHandoffRpcClient,
} from "../index";
import { inspectIndonesiaHandoffSnapshot } from "../../indonesia/handoff";

type Call = { fn: string; args: Record<string, unknown> };

function fakeClient(responses: Record<string, unknown[]>): { client: OfficialHandoffRpcClient; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      rpc(fn, args) {
        calls.push({ fn, args });
        const queue = responses[fn] ?? [];
        const data = queue.length > 0 ? queue.shift() : [];
        return Promise.resolve({ data: data ?? null, error: null });
      },
    },
  };
}

function leased(overrides: Partial<LeasedOfficialHandoff> = {}): LeasedOfficialHandoff {
  return {
    takeover_id: "t-1",
    submission_queue_id: "q-1",
    application_id: "a-1",
    applicant_id: "p-1",
    provider: "indonesia_c1_live",
    browserbase_session_ref: "browserbase-session:bb_123",
    handoff_status: "claimed",
    queue_status: "id_c1_applicant_handoff",
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    ...overrides,
  };
}

const fakeBrowser = (closed: { value: boolean }) => ({
  contexts: () => [{ pages: () => [{} as Page] }],
  close: async () => {
    closed.value = true;
  },
}) as unknown as Browser;

test("parses only well-formed Browserbase session refs", () => {
  assert.equal(browserbaseSessionIdFromRef("browserbase-session:abc_123"), "abc_123");
  assert.equal(browserbaseSessionIdFromRef("wss://evil?x"), null);
  assert.equal(browserbaseSessionIdFromRef("browserbase-session:a b"), null);
});

test("open forces the awaiting_applicant_official_submit status and returns null when not opened", async () => {
  const { client, calls } = fakeClient({ open_official_applicant_handoff: [[]] });
  const opened = await openOfficialApplicantHandoff(client, {
    queueId: "q",
    workerId: "w",
    applicationId: "a",
    applicantId: "p",
    session: { sessionId: "s", liveViewUrl: "https://live", expiresAt: "2026-01-01T00:00:00Z", readyAt: "official_final_review" },
    stoppedResult: { status: "action_required", actionType: "x" },
  });
  assert.equal(opened, null);
  assert.equal((calls[0].args.p_stopped_result as Record<string, unknown>).status, "awaiting_applicant_official_submit");
});

test("watcher settles submitted with official evidence and disconnects read-only", async () => {
  const { client, calls } = fakeClient({
    lease_official_applicant_handoff_watch: [[leased()]],
    settle_official_applicant_handoff: [[{ settled: true, handoff_status: "submitted" }]],
  });
  const closed = { value: false };
  const inspection: OfficialHandoffInspection = {
    outcome: "submitted",
    final: false,
    receipt: {
      source: "official_portal_after_applicant_submit",
      reference: "REF123456",
      portalUrl: "https://evisa.imigrasi.go.id/front/applications/x/list",
      capturedAt: "2026-11-14T00:00:00Z",
      officialState: "waiting_for_payment",
    },
  };
  const examined = await runOfficialHandoffWatchTick({
    client,
    workerId: "w",
    inspectors: { indonesia_c1_live: async () => inspection },
    submittedResult: (_h, receipt) => ({ status: "submitted", officialReceipt: receipt }),
    resolveConnectUrl: async (id) => (id === "bb_123" ? "wss://connect" : null),
    connect: async () => fakeBrowser(closed),
  });
  assert.equal(examined, 1);
  assert.equal(closed.value, true);
  const settle = calls.find((call) => call.fn === "settle_official_applicant_handoff");
  assert.equal(settle?.args.p_outcome, "submitted");
  assert.deepEqual((settle?.args.p_submission_result as Record<string, unknown>).officialReceipt, inspection.receipt);
});

test("watcher never inspects an unclaimed handoff and abandons it after expiry", async () => {
  const { client, calls } = fakeClient({
    lease_official_applicant_handoff_watch: [[leased({ handoff_status: "queued", expires_at: new Date(Date.now() - 1_000).toISOString() })]],
    settle_official_applicant_handoff: [[{ settled: true, handoff_status: "abandoned" }]],
  });
  let connected = false;
  const released: string[] = [];
  await runOfficialHandoffWatchTick({
    client,
    workerId: "w",
    inspectors: { indonesia_c1_live: async () => ({ outcome: "pending", note: "x" }) },
    submittedResult: () => ({}),
    resolveConnectUrl: async () => "wss://connect",
    connect: async () => {
      connected = true;
      return fakeBrowser({ value: false });
    },
    releaseSession: async (id) => {
      released.push(id);
    },
  });
  assert.equal(connected, false);
  assert.deepEqual(released, ["bb_123"]);
  assert.equal(calls.find((call) => call.fn === "settle_official_applicant_handoff")?.args.p_outcome, "abandoned");
});

test("a submitted handoff stays open for payment and closes on official completion", async () => {
  const receipt = {
    source: "official_portal_after_applicant_submit" as const,
    reference: "REF123456",
    portalUrl: "https://evisa.imigrasi.go.id/pg/payment/card/result/success",
    capturedAt: "2026-11-14T00:00:00Z",
    officialState: "submitted_or_approved",
  };
  const pendingRun = fakeClient({
    lease_official_applicant_handoff_watch: [[leased({ queue_status: "id_c1_applicant_submitted" })]],
    settle_official_applicant_handoff: [[{ settled: true, handoff_status: "claimed" }]],
  });
  await runOfficialHandoffWatchTick({
    client: pendingRun.client,
    workerId: "w",
    inspectors: { indonesia_c1_live: async () => ({ outcome: "submitted", final: false, receipt }) },
    submittedResult: () => ({}),
    resolveConnectUrl: async () => "wss://connect",
    connect: async () => fakeBrowser({ value: false }),
    releaseSession: async () => assert.fail("must not release while the applicant may still pay"),
  });
  assert.equal(pendingRun.calls.find((c) => c.fn === "settle_official_applicant_handoff")?.args.p_outcome, "pending");

  const finalRun = fakeClient({
    lease_official_applicant_handoff_watch: [[leased({ queue_status: "id_c1_applicant_submitted" })]],
    settle_official_applicant_handoff: [[{ settled: true, handoff_status: "completed" }]],
  });
  const released: string[] = [];
  await runOfficialHandoffWatchTick({
    client: finalRun.client,
    workerId: "w",
    inspectors: { indonesia_c1_live: async () => ({ outcome: "submitted", final: true, receipt }) },
    submittedResult: (_h, r) => ({ status: "submitted", officialReceipt: r }),
    resolveConnectUrl: async () => "wss://connect",
    connect: async () => fakeBrowser({ value: false }),
    releaseSession: async (id) => {
      released.push(id);
    },
  });
  const settle = finalRun.calls.find((c) => c.fn === "settle_official_applicant_handoff");
  assert.equal(settle?.args.p_outcome, "closed");
  assert.deepEqual(released, ["bb_123"]);
});

test("watcher releases the lease as pending when inspection throws", async () => {
  const { client, calls } = fakeClient({
    lease_official_applicant_handoff_watch: [[leased()]],
    settle_official_applicant_handoff: [[{ settled: true, handoff_status: "claimed" }]],
  });
  await runOfficialHandoffWatchTick({
    client,
    workerId: "w",
    inspectors: { indonesia_c1_live: async () => { throw new Error("boom"); } },
    submittedResult: () => ({}),
    resolveConnectUrl: async () => "wss://connect",
    connect: async () => fakeBrowser({ value: false }),
  });
  assert.equal(calls.find((call) => call.fn === "settle_official_applicant_handoff")?.args.p_outcome, "pending");
});

test("Indonesia inspector treats drafts, step pages, and foreign hosts as not submitted", () => {
  const capturedAt = "2026-11-14T00:00:00Z";
  assert.equal(
    inspectIndonesiaHandoffSnapshot({ url: "https://evisa.imigrasi.go.id/front/application_add/visa/x/step_3", text: "Declaration Submit", capturedAt }).outcome,
    "pending",
  );
  assert.equal(
    inspectIndonesiaHandoffSnapshot({ url: "https://evisa.imigrasi.go.id/front/applications/abc/list", text: "Status Draft Submit", capturedAt }).outcome,
    "pending",
  );
  assert.equal(
    inspectIndonesiaHandoffSnapshot({ url: "https://evil.example/front/applications/abc/list", text: "Waiting for Payment Application Number: ABC12345", capturedAt }).outcome,
    "pending",
  );
});

test("Indonesia inspector records a waiting-for-payment application with its reference", () => {
  const inspection = inspectIndonesiaHandoffSnapshot({
    url: "https://evisa.imigrasi.go.id/front/applications/abc/list",
    text: "My Applications Application Number: C1A2B3C4D5 Status Waiting for Payment",
    capturedAt: "2026-11-14T00:00:00Z",
  });
  assert.equal(inspection.outcome, "submitted");
  if (inspection.outcome === "submitted") {
    assert.equal(inspection.receipt.reference, "C1A2B3C4D5");
    assert.equal(inspection.receipt.officialState, "waiting_for_payment");
    assert.equal(inspection.final, false);
  }
});

test("Indonesia inspector ignores generic official pages that merely mention payment", () => {
  const inspection = inspectIndonesiaHandoffSnapshot({
    url: "https://evisa.imigrasi.go.id/front/application/0f8fad5b-d9cb-469f-a165-70867728950e",
    text: "Pembayaran guide Application Number: C1A2B3C4D5 checkout",
    capturedAt: "2026-11-14T00:00:00Z",
  });
  assert.equal(inspection.outcome, "pending");
});

test("Indonesia inspector ignores a login verification-code page", () => {
  const inspection = inspectIndonesiaHandoffSnapshot({
    url: "https://evisa.imigrasi.go.id/front/login",
    text: "Enter the verification code sent to your email",
    capturedAt: "2026-11-14T00:00:00Z",
  });
  assert.equal(inspection.outcome, "pending");
});
