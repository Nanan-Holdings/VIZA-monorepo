import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, withAdmin } = vi.hoisted(() => ({
  createClient: vi.fn(),
  withAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/auth/with-admin", () => ({ withAdmin }));

import { abandonTakeover, claimTakeover, completeTakeover } from "./takeover";

function query(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    update: vi.fn(() => builder),
    upsert: vi.fn(async () => result),
  };
  return builder;
}

function setupAuth() {
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "operator-id",
            factors: [{ status: "verified", factor_type: "totp" }],
          },
        },
      }),
    },
  });
}

function setupAdmin(rpcResult: { data: unknown; error: { message: string } | null }) {
  const takeoverQuery = query({
    data: {
      id: "takeover-id",
      application_id: "application-id",
      job_id: "job-id",
    },
    error: null,
  });
  const answersQuery = query({ data: null, error: null });
  const rpc = vi.fn(async () => rpcResult);
  const from = vi.fn((table: string) => {
    if (table === "takeover_session") return takeoverQuery;
    if (table === "visa_application_answers") return answersQuery;
    throw new Error(`unexpected table ${table}`);
  });
  const admin = { from, rpc };
  withAdmin.mockImplementation(async (_role: string, _action: string, fn: (client: unknown) => unknown) =>
    fn(admin),
  );
  return { answersQuery, rpc, takeoverQuery };
}

describe("takeover settlement actions", () => {
  beforeEach(() => {
    createClient.mockReset();
    withAdmin.mockReset();
    setupAuth();
  });

  it("claims through the guarded RPC and never directly updates the session", async () => {
    const { rpc, takeoverQuery } = setupAdmin({
      data: [{ claimed: true, job_id: "job-id", application_id: "application-id", handoff_kind: null }],
      error: null,
    });

    await expect(claimTakeover("takeover-id")).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("claim_takeover_session", {
      p_takeover_id: "takeover-id",
      p_claimant_id: "operator-id",
      p_expected_handoff_kind: null,
    });
    expect(takeoverQuery.update).not.toHaveBeenCalled();
  });

  it("fails closed when the claim RPC returns no row", async () => {
    const { rpc, takeoverQuery } = setupAdmin({ data: [], error: null });

    await expect(claimTakeover("takeover-id")).rejects.toThrow("takeover claim conflict");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(takeoverQuery.update).not.toHaveBeenCalled();
  });

  it("passes bounded answers to the atomic completion RPC", async () => {
    const { answersQuery, rpc, takeoverQuery } = setupAdmin({
      data: [{ settled: true, job_id: "job-id", application_id: "application-id", job_status: "succeeded" }],
      error: null,
    });

    await expect(
      completeTakeover("takeover-id", { surname: "CHEN" }, "Completed by operator"),
    ).resolves.toEqual({ ok: true, answersWritten: 1 });

    expect(answersQuery.upsert).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("settle_runner_job_takeover", {
      p_takeover_id: "takeover-id",
      p_actor_user_id: "operator-id",
      p_outcome: "completed",
      p_operator_notes: "Completed by operator",
      p_answers: { surname: "CHEN" },
    });
    expect(takeoverQuery.update).not.toHaveBeenCalled();
  });

  it("fails closed when completion loses the settlement race", async () => {
    const { answersQuery, rpc, takeoverQuery } = setupAdmin({
      data: [{ settled: false, job_id: "job-id", application_id: "application-id", job_status: "needs_human" }],
      error: null,
    });

    await expect(completeTakeover("takeover-id", { surname: "CHEN" })).rejects.toThrow(
      "takeover settlement conflict",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(answersQuery.upsert).not.toHaveBeenCalled();
    expect(takeoverQuery.update).not.toHaveBeenCalled();
  });

  it("uses the atomic RPC for abandon and does not report a false settlement", async () => {
    const { rpc } = setupAdmin({
      data: [{ settled: false, job_id: "job-id", application_id: "application-id", job_status: "needs_human" }],
      error: null,
    });

    await expect(abandonTakeover("takeover-id", "Applicant unavailable")).rejects.toThrow(
      "takeover settlement conflict",
    );
    expect(rpc).toHaveBeenCalledWith("settle_runner_job_takeover", {
      p_takeover_id: "takeover-id",
      p_actor_user_id: "operator-id",
      p_outcome: "abandoned",
      p_operator_notes: "Applicant unavailable",
      p_answers: {},
    });
  });

  it("fails closed when the settlement RPC returns no row", async () => {
    const { rpc } = setupAdmin({ data: [], error: null });

    await expect(abandonTakeover("takeover-id", "No longer needed")).rejects.toThrow(
      "takeover settlement conflict",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects answer values over the database limit before calling settlement", async () => {
    const { rpc } = setupAdmin({
      data: [{ settled: true }],
      error: null,
    });

    await expect(completeTakeover("takeover-id", { surname: "x".repeat(4_001) })).rejects.toThrow(
      "takeover answer value is invalid",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an oversized serialized answer object before calling settlement", async () => {
    const { rpc } = setupAdmin({
      data: [{ settled: true }],
      error: null,
    });
    const answers = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [`field_${index}`, "x".repeat(1_300)]),
    );

    await expect(completeTakeover("takeover-id", answers)).rejects.toThrow(
      "takeover answers exceed 256 KiB",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects oversized operator notes before calling settlement", async () => {
    const { rpc } = setupAdmin({
      data: [{ settled: true }],
      error: null,
    });

    await expect(
      completeTakeover("takeover-id", { surname: "CHEN" }, "x".repeat(4_001)),
    ).rejects.toThrow("takeover operator notes must be at most 4000 characters");
    expect(rpc).not.toHaveBeenCalled();
  });
});
