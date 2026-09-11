import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getClientSessionReadResult: vi.fn(),
}));

vi.mock("@/lib/client-session", () => ({
  getClientSessionReadResult: mocks.getClientSessionReadResult,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  getClientHomeDashboardData,
  getClientHomeDashboardWithTimeline,
} from "./client-home-dashboard";

type QueryCall = {
  table: string;
  eq: Array<[string, string]>;
  in: Array<[string, string[]]>;
  or: string[];
};

const USER_ID = "00000000-0000-4000-8000-000000000001";
const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const PACKAGE_ID = "22222222-2222-4222-8222-222222222222";

function createAdminClientMock(
  calls: QueryCall[],
  options: {
    packageId?: string | null;
    paymentError?: { message: string } | null;
  } = {},
) {
  const packageId = options.packageId === undefined ? PACKAGE_ID : options.packageId;
  const responses: Record<
    string,
    { data: unknown; error: { message: string } | null }
  > = {
    applicant_profiles: {
      data: { full_name: "Test Applicant", email: "load-test@viza.test" },
      error: null,
    },
    applications: {
      data: [
        {
          id: APPLICATION_ID,
          status: "draft",
          country: "singapore",
          visa_type: "SG_ARRIVAL_CARD",
          purpose: "tourism",
          visa_package_id: packageId,
          submission_result_status: null,
          submitted_at: null,
          created_at: "2026-09-03T00:00:00.000Z",
          updated_at: "2026-09-03T00:00:00.000Z",
        },
      ],
      error: null,
    },
    application_documents: { data: [], error: null },
    payment_records: {
      data: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          application_id: APPLICATION_ID,
          visa_package_id: PACKAGE_ID,
          status: "paid",
          created_at: "2026-09-03T00:00:00.000Z",
          updated_at: "2026-09-03T00:00:00.000Z",
        },
      ],
      error: options.paymentError ?? null,
    },
  };

  return {
    from(table: string) {
      const call: QueryCall = { table, eq: [], in: [], or: [] };
      calls.push(call);
      const response = responses[table] ?? { data: [], error: null };
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: string) {
          call.eq.push([column, value]);
          return query;
        },
        in(column: string, values: string[]) {
          call.in.push([column, values]);
          return query;
        },
        or(filter: string) {
          call.or.push(filter);
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          return Promise.resolve(response);
        },
        then<TResult1 = typeof response, TResult2 = never>(
          onfulfilled?: ((value: typeof response) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          return Promise.resolve(response).then(onfulfilled, onrejected);
        },
      };
      return query;
    },
  };
}

describe("getClientHomeDashboardData query budget", () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
    mocks.getClientSessionReadResult.mockReset();
    mocks.getClientSessionReadResult.mockResolvedValue({
      status: "authenticated",
      source: "cookie",
      session: {
        userId: USER_ID,
        authUserId: USER_ID,
        email: "load-test@viza.test",
      },
    });
  });

  it("uses one owner-scoped payment query per dashboard load", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls));

    const result = await getClientHomeDashboardData();

    expect(result.authenticated).toBe(true);
    expect(result.payments).toHaveLength(1);
    const paymentCalls = calls.filter((call) => call.table === "payment_records");
    expect(paymentCalls).toHaveLength(1);
    expect(paymentCalls[0]?.eq).toContainEqual(["applicant_id", USER_ID]);
    expect(paymentCalls[0]?.or).toEqual([
      `application_id.in.(${APPLICATION_ID}),visa_package_id.in.(${PACKAGE_ID})`,
    ]);
  });

  it("keeps 100 concurrent dashboard loads within 100 payment reads", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls));

    const results = await Promise.all(
      Array.from({ length: 100 }, () => getClientHomeDashboardData()),
    );

    expect(results.every((result) => result.authenticated && result.payments.length === 1)).toBe(true);
    expect(calls.filter((call) => call.table === "payment_records")).toHaveLength(100);
  });

  it("uses the same single query when an application has no package", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() =>
      createAdminClientMock(calls, { packageId: null }),
    );

    const result = await getClientHomeDashboardData();

    expect(result.authenticated).toBe(true);
    const paymentCalls = calls.filter((call) => call.table === "payment_records");
    expect(paymentCalls).toHaveLength(1);
    expect(paymentCalls[0]?.or).toEqual([
      `application_id.in.(${APPLICATION_ID})`,
    ]);
  });

  it("preserves the existing partial dashboard response on payment errors", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() =>
      createAdminClientMock(calls, { paymentError: { message: "payment read failed" } }),
    );

    const result = await getClientHomeDashboardData();

    expect(result).toMatchObject({
      authenticated: true,
      error: "payment read failed",
      payments: [],
    });
    expect(result.applications).toHaveLength(1);
    expect(calls.filter((call) => call.table === "payment_records")).toHaveLength(1);
  });

  it("includes the selected timeline without repeating owner, document, or payment reads", async () => {
    const calls: QueryCall[] = [];
    mocks.createAdminClient.mockImplementation(() => createAdminClientMock(calls));

    const result = await getClientHomeDashboardWithTimeline({
      applicationId: APPLICATION_ID,
    });

    expect(result.authenticated).toBe(true);
    expect(result.timelineApplicationId).toBe(APPLICATION_ID);
    expect(result.timeline?.id).toBe(APPLICATION_ID);
    expect(result.timeline?.documents).toEqual({
      total: 0,
      uploaded: 0,
      validated: 0,
      missing: 0,
      rejected: 0,
    });
    expect(calls.filter((call) => call.table === "applications")).toHaveLength(1);
    expect(calls.filter((call) => call.table === "application_documents")).toHaveLength(1);
    expect(calls.filter((call) => call.table === "payment_records")).toHaveLength(1);
    expect(calls.filter((call) => call.table === "submission_queue")).toHaveLength(1);
  });

  it("keeps an unavailable identity read distinct from an unauthenticated session", async () => {
    mocks.getClientSessionReadResult.mockResolvedValue({
      status: "unavailable",
      session: null,
      reason: "provider",
    });

    const result = await getClientHomeDashboardWithTimeline();

    expect(result).toMatchObject({
      authenticated: false,
      unavailable: true,
      error: "Client session unavailable",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
