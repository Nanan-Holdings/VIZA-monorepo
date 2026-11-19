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
import { inspectIndonesiaHandoffSnapshot, isIndonesiaLoggedOutSnapshot } from "../../indonesia/handoff";

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
    inspectors: { indonesia_c1_live: { inspect: async () => inspection } },
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

test("watcher does not connect to an expired handoff and abandons it", async () => {
  const { client, calls } = fakeClient({
    lease_official_applicant_handoff_watch: [[leased({ handoff_status: "queued", expires_at: new Date(Date.now() - 1_000).toISOString() })]],
    settle_official_applicant_handoff: [[{ settled: true, handoff_status: "abandoned" }]],
  });
  let connected = false;
  const released: string[] = [];
  await runOfficialHandoffWatchTick({
    client,
    workerId: "w",
    inspectors: { indonesia_c1_live: { inspect: async () => ({ outcome: "pending", note: "x" }) } },
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
    inspectors: { indonesia_c1_live: { inspect: async () => ({ outcome: "submitted", final: false, receipt }) } },
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
    inspectors: { indonesia_c1_live: { inspect: async () => ({ outcome: "submitted", final: true, receipt }) } },
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
    inspectors: { indonesia_c1_live: { inspect: async () => { throw new Error("boom"); } } },
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

test("Indonesia inspector never reads a login verification-code page as submitted", () => {
  const inspection = inspectIndonesiaHandoffSnapshot({
    url: "https://evisa.imigrasi.go.id/front/login",
    text: "Enter the verification code sent to your email",
    capturedAt: "2026-11-14T00:00:00Z",
  });
  assert.equal(inspection.outcome, "lost");
});

test("watcher keeps an open official session alive and settles 'lost' only after two logged-out checks", async () => {
  const lostObservations = new Map<string, number>();
  let keepAlives = 0;
  const run = async (inspection: OfficialHandoffInspection, settleRows: unknown[] = [[{ settled: true, handoff_status: "queued" }]]) => {
    const fake = fakeClient({
      lease_official_applicant_handoff_watch: [[leased({ handoff_status: "queued" })]],
      settle_official_applicant_handoff: settleRows,
    });
    const released: string[] = [];
    await runOfficialHandoffWatchTick({
      client: fake.client,
      workerId: "w",
      inspectors: { indonesia_c1_live: { inspect: async () => inspection, keepAlive: async () => { keepAlives += 1; } } },
      submittedResult: () => ({}),
      resolveConnectUrl: async () => "wss://connect",
      connect: async () => fakeBrowser({ value: false }),
      releaseSession: async (id) => { released.push(id); },
      lostObservations,
    });
    return { outcome: fake.calls.find((c) => c.fn === "settle_official_applicant_handoff")?.args.p_outcome, released };
  };
  assert.equal((await run({ outcome: "pending", note: "application_step_page" })).outcome, "pending");
  assert.equal(keepAlives, 1, "an unclaimed handoff is kept alive too");
  assert.equal((await run({ outcome: "lost", note: "official_portal_logged_out" })).outcome, "pending", "first lost observation waits");
  const second = await run({ outcome: "lost", note: "official_portal_logged_out" }, [[{ settled: true, handoff_status: "abandoned" }]]);
  assert.equal(second.outcome, "lost");
  assert.deepEqual(second.released, ["bb_123"]);
  assert.equal(keepAlives, 1, "a logged-out session is not kept alive");
});

test("an unclaimed session is never settled as submitted", async () => {
  const { client, calls } = fakeClient({
    lease_official_applicant_handoff_watch: [[leased({ handoff_status: "queued" })]],
    settle_official_applicant_handoff: [[{ settled: true, handoff_status: "queued" }]],
  });
  await runOfficialHandoffWatchTick({
    client,
    workerId: "w",
    inspectors: { indonesia_c1_live: { inspect: async () => ({ outcome: "submitted", final: false, receipt: {
      source: "official_portal_after_applicant_submit", reference: "REF123456", portalUrl: "https://evisa.imigrasi.go.id/x", capturedAt: "t", officialState: "waiting_for_payment",
    } }) } },
    submittedResult: () => ({}),
    resolveConnectUrl: async () => "wss://connect",
    connect: async () => fakeBrowser({ value: false }),
  });
  assert.equal(calls.find((c) => c.fn === "settle_official_applicant_handoff")?.args.p_outcome, "pending");
});

test("Indonesia logout detection only matches home, selection, and sign-in pages", () => {
  assert.equal(isIndonesiaLoggedOutSnapshot({ url: "https://evisa.imigrasi.go.id/web/visa-selection" }), true);
  assert.equal(isIndonesiaLoggedOutSnapshot({ url: "https://evisa.imigrasi.go.id/" }), true);
  assert.equal(isIndonesiaLoggedOutSnapshot({ url: "https://evisa.imigrasi.go.id/front/login" }), true);
  assert.equal(isIndonesiaLoggedOutSnapshot({ url: "https://evisa.imigrasi.go.id/web/application_add/visa/step_3" }), false);
  assert.equal(isIndonesiaLoggedOutSnapshot({ url: "https://evisa.imigrasi.go.id/web/application-detail-otp/abc" }), false);
  assert.equal(isIndonesiaLoggedOutSnapshot({ url: "https://pay.example/checkout" }), false);
  assert.equal(
    isIndonesiaLoggedOutSnapshot({ url: "https://evisa.imigrasi.go.id/front/login", text: "Enter OTP Code OTP Code * Submit" }),
    false,
  );
  assert.equal(
    inspectIndonesiaHandoffSnapshot({ url: "https://evisa.imigrasi.go.id/web/visa-selection", text: "Passport/Country/Region", capturedAt: "t" }).outcome,
    "lost",
  );
});
