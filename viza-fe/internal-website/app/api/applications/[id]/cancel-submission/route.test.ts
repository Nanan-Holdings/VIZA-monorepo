import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createClient, isDigitalArrivalCardApplication, isSgArrivalCardApplication } =
  vi.hoisted(() => ({
    createAdminClient: vi.fn(),
    createClient: vi.fn(),
    isDigitalArrivalCardApplication: vi.fn(),
    isSgArrivalCardApplication: vi.fn(),
  }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/submission-queue", () => ({
  isDigitalArrivalCardApplication,
  isSgArrivalCardApplication,
}));

import { POST } from "./route";

type QueryResult = { data: unknown; error: { message: string } | null };

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    update: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

function setupAdmin(
  rpcResult: QueryResult,
  queueData: unknown = {
    id: "queue-id",
    status: "sgac_live_assisted_pending",
    provider: "sgac_live",
    mode: "live_assisted",
  },
  runnerData: unknown = null,
) {
  const profileQuery = query({ data: { id: "profile-id" }, error: null });
  const applicationQuery = query({
    data: {
      id: "application-id",
      applicant_id: "profile-id",
      country: "singapore",
      visa_type: "SG_ARRIVAL_CARD",
    },
    error: null,
  });
  const queueQuery = query({
    data: queueData,
    error: null,
  });
  const runnerQuery = query({ data: runnerData, error: null });
  const rpc = vi.fn(async () => rpcResult);
  const from = vi.fn((table: string) => {
    if (table === "applicant_profiles") return profileQuery;
    if (table === "applications") return applicationQuery;
    if (table === "submission_queue") return queueQuery;
    if (table === "runner_job") return runnerQuery;
    throw new Error(`unexpected table ${table}`);
  });
  createAdminClient.mockReturnValue({ from, rpc });
  return { applicationQuery, from, rpc, queueQuery, runnerQuery };
}

function setupAuth() {
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user-id" } } }) },
  });
}

function request() {
  return new Request("http://localhost/api/applications/application-id/cancel-submission", {
    method: "POST",
  });
}

describe("cancel-submission route", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    createClient.mockReset();
    isDigitalArrivalCardApplication.mockReset().mockReturnValue(true);
    isSgArrivalCardApplication.mockReset().mockReturnValue(true);
    setupAuth();
  });

  it("settles cancellation through the atomic RPC and returns its row", async () => {
    const { rpc, applicationQuery } = setupAdmin({
      data: [{
        cancelled: true,
        queue_id: "queue-id",
        queue_transport: "submission_queue",
        cancelled_at: "2026-08-15T00:00:00.000Z",
      }],
      error: null,
    });

    const response = await POST(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      queueId: "queue-id",
      queueTransport: "submission_queue",
      cancelled: true,
      cancelledAt: "2026-08-15T00:00:00.000Z",
    });
    expect(rpc).toHaveBeenCalledWith("cancel_application_submission", {
      p_application_id: "application-id",
      p_queue_id: "queue-id",
      p_transport: "submission_queue",
    });
    expect(applicationQuery.update).not.toHaveBeenCalled();
  });

  it("does not report success when the atomic RPC loses the claim race", async () => {
    const { rpc, applicationQuery } = setupAdmin({
      data: [{ cancelled: false, queue_id: "queue-id", queue_transport: "submission_queue" }],
      error: null,
    });

    const response = await POST(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("already processing"),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(applicationQuery.update).not.toHaveBeenCalled();
  });

  it("uses the same atomic RPC for the runner_job transport", async () => {
    const { rpc } = setupAdmin(
      {
        data: [{
          cancelled: true,
          queue_id: "runner-job-id",
          queue_transport: "runner_job",
          cancelled_at: "2026-08-15T00:00:00.000Z",
        }],
        error: null,
      },
      null,
      { id: "runner-job-id", status: "queued" },
    );

    const response = await POST(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("cancel_application_submission", {
      p_application_id: "application-id",
      p_queue_id: "runner-job-id",
      p_transport: "runner_job",
    });
  });

  it("fails closed when the cancellation RPC returns no row", async () => {
    const { rpc } = setupAdmin({ data: [], error: null });

    const response = await POST(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(409);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
