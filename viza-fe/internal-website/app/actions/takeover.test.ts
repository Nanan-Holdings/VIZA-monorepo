import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, withAdmin } = vi.hoisted(() => ({
  createClient: vi.fn(),
  withAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/auth/with-admin", () => ({ withAdmin }));

import { abandonTakeover, completeTakeover } from "./takeover";

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

  it("upserts answers then settles completion through the atomic RPC", async () => {
    const { answersQuery, rpc, takeoverQuery } = setupAdmin({
      data: [{ settled: true, job_id: "job-id", application_id: "application-id", job_status: "succeeded" }],
      error: null,
    });

    await expect(
      completeTakeover("takeover-id", { surname: "CHEN" }, "Completed by operator"),
    ).resolves.toEqual({ ok: true, answersWritten: 1 });

    expect(answersQuery.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ application_id: "application-id", field_name: "surname", value_text: "CHEN" })],
      { onConflict: "application_id,field_name" },
    );
    expect(rpc).toHaveBeenCalledWith("settle_runner_job_takeover", {
      p_takeover_id: "takeover-id",
      p_actor_user_id: "operator-id",
      p_outcome: "completed",
      p_operator_notes: "Completed by operator",
      p_answers_written: 1,
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
    expect(answersQuery.upsert).toHaveBeenCalledTimes(1);
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
      p_answers_written: 0,
    });
  });

  it("fails closed when the settlement RPC returns no row", async () => {
    const { rpc } = setupAdmin({ data: [], error: null });

    await expect(abandonTakeover("takeover-id", "No longer needed")).rejects.toThrow(
      "takeover settlement conflict",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
