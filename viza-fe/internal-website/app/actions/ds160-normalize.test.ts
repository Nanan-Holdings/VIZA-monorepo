import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { persistDS160AnswerSet } from "./ds160-normalize";

type QueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

function query(result: QueryResult) {
  const builder: Record<string, unknown> & { then?: unknown } = {};
  for (const method of ["eq", "select", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.single = vi.fn().mockResolvedValue(result);
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, ReturnType<typeof vi.fn>> &
    PromiseLike<QueryResult>;
}

describe("persistDS160AnswerSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-1" } },
        }),
      },
    });
  });

  it("rejects a successful submission before reading or writing answers", async () => {
    const applicationQuery = query({
      data: {
        id: "application-1",
        applicant_id: "profile-1",
        group_id: null,
        country: "united_states",
        visa_type: "US_DS160",
        submission_result_status: "submitted",
        submission_result: {
          country: "US",
          status: "submitted",
          applicationId: "AA00TEST01",
        },
      },
      error: null,
    });
    const profileQuery = query({
      data: {
        id: "profile-1",
        auth_user_id: "auth-1",
        dependant_of_user_id: null,
      },
      error: null,
    });
    const answerQuery = query({ data: [], error: null });
    const from = vi.fn((table: string) => {
      if (table === "applications") return applicationQuery;
      if (table === "applicant_profiles") return profileQuery;
      if (table === "visa_application_answers") return answerQuery;
      throw new Error(`Unexpected table query: ${table}`);
    });
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(
      persistDS160AnswerSet("application-1", {}, {}, {}),
    ).resolves.toEqual({ error: "Application is already submitted and read-only" });

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "applications",
      "applicant_profiles",
    ]);
    expect(answerQuery.select).not.toHaveBeenCalled();
    expect(answerQuery.upsert).not.toHaveBeenCalled();
  });
});
