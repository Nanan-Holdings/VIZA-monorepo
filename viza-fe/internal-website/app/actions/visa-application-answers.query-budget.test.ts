import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditPiiRead: vi.fn(),
  cacheApplicationAnswers: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getClientSessionWithFallback: vi.fn(),
  getOwnedApplicantSession: vi.fn(),
  loadCachedApplicationAnswers: vi.fn(),
  queueApplicationAnswers: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/client-session", () => ({
  getClientSessionWithFallback: mocks.getClientSessionWithFallback,
}));
vi.mock("@/lib/application-api-auth", () => ({
  getOwnedApplicantSession: mocks.getOwnedApplicantSession,
}));
vi.mock("@/lib/legal/audit-pii", () => ({
  auditPiiRead: mocks.auditPiiRead,
}));
vi.mock("@/lib/supabase/fetch-with-timeout", () => ({
  retryTransientSupabaseResult: async <T>(operation: () => Promise<T>) =>
    operation(),
}));
vi.mock("@/lib/resilience/application-answers", () => ({
  cacheApplicationAnswers: mocks.cacheApplicationAnswers,
  isResilienceEligibleError: () => false,
  loadCachedApplicationAnswers: mocks.loadCachedApplicationAnswers,
  queueApplicationAnswers: mocks.queueApplicationAnswers,
}));

import {
  loadApplicationFormContext,
  loadDynamicAnswers,
  saveDynamicAnswers,
} from "./visa-application-answers";

type QueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

function query(result: QueryResult) {
  const builder: Record<string, unknown> & {
    then?: unknown;
  } = {};
  for (const method of [
    "delete",
    "eq",
    "filter",
    "in",
    "is",
    "limit",
    "order",
    "select",
    "update",
    "upsert",
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.single = vi.fn().mockResolvedValue(result);
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, ReturnType<typeof vi.fn>> &
    PromiseLike<QueryResult>;
}

const session = {
  userId: "profile-1",
  authUserId: "auth-1",
  email: "applicant@example.com",
};

const owner = {
  id: "profile-1",
  auth_user_id: "auth-1",
  dependant_of_user_id: null,
};

describe("visa application answer query budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientSessionWithFallback.mockResolvedValue(session);
    mocks.getOwnedApplicantSession.mockResolvedValue(session);
    mocks.cacheApplicationAnswers.mockResolvedValue(undefined);
    mocks.auditPiiRead.mockResolvedValue(undefined);
    mocks.loadCachedApplicationAnswers.mockResolvedValue(null);
    mocks.queueApplicationAnswers.mockResolvedValue(undefined);
  });

  it("authorizes an autosave from the embedded owner without a second profile query", async () => {
    const applicationQuery = query({
      data: {
        id: "application-1",
        applicant_id: "profile-1",
        visa_type: "OTHER",
        submitted_at: null,
        submission_result: null,
        submission_result_status: null,
        updated_at: "2026-08-30T00:00:00.000Z",
        applicant_profiles: owner,
      },
      error: null,
    });
    const answerQuery = query({ data: null, error: null });
    const from = vi.fn((table: string) => {
      if (table === "applications") return applicationQuery;
      if (table === "visa_application_answers") return answerQuery;
      throw new Error(`Unexpected table query: ${table}`);
    });
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(
      saveDynamicAnswers("application-1", { surname: "Chen" })
    ).resolves.toEqual({});

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "applications",
      "visa_application_answers",
    ]);
    expect(applicationQuery.select).toHaveBeenCalledWith(
      expect.stringContaining(
        "applicant_profiles(id, auth_user_id, dependant_of_user_id)"
      )
    );
    expect(mocks.getOwnedApplicantSession).toHaveBeenCalledWith(owner, session);
  });

  it("rejects an autosave before writing when the embedded owner is not authorized", async () => {
    mocks.getOwnedApplicantSession.mockResolvedValueOnce(null);
    const applicationQuery = query({
      data: {
        id: "application-1",
        applicant_id: "different-profile",
        visa_type: "OTHER",
        submitted_at: null,
        submission_result: null,
        submission_result_status: null,
        updated_at: "2026-08-30T00:00:00.000Z",
        applicant_profiles: {
          id: "different-profile",
          auth_user_id: "different-auth-user",
          dependant_of_user_id: null,
        },
      },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "applications") return applicationQuery;
      throw new Error(`Unexpected table query: ${table}`);
    });
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(
      saveDynamicAnswers("application-1", { surname: "Chen" })
    ).resolves.toEqual({ error: "Unauthorized" });
    expect(from).toHaveBeenCalledTimes(1);
    expect(mocks.cacheApplicationAnswers).not.toHaveBeenCalled();
  });

  it("loads answers with one ownership query and one answer query", async () => {
    const applicationQuery = query({
      data: {
        applicant_id: "profile-1",
        applicant_profiles: owner,
      },
      error: null,
    });
    const answerQuery = query({
      data: [
        { field_name: "surname", value_text: "Chen" },
        { field_name: "__simplified_form_state", value_text: "{}" },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "applications") return applicationQuery;
      if (table === "visa_application_answers") return answerQuery;
      throw new Error(`Unexpected table query: ${table}`);
    });
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(loadDynamicAnswers("application-1")).resolves.toEqual({
      answers: { surname: "Chen" },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "applications",
      "visa_application_answers",
    ]);
    expect(mocks.getOwnedApplicantSession).toHaveBeenCalledWith(owner, session);
  });

  it("preloads owned answers in the form context without re-reading ownership", async () => {
    const profileQuery = query({
      data: {
        ...owner,
        full_name: "Chen Ming",
      },
      error: null,
    });
    const applicationsQuery = query({
      data: [
        {
          id: "application-1",
          country: "vietnam",
          visa_type: "VN_E_VISA",
          purpose: "tourism",
          status: "draft",
          submission_result_status: null,
          result_status: null,
          submission_result: null,
        },
      ],
      error: null,
    });
    const reusableAnswersQuery = query({ data: [], error: null });
    const applicationAnswersQuery = query({
      data: [{ field_name: "surname", value_text: "Chen" }],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "applicant_profiles") return profileQuery;
      if (table === "applications") return applicationsQuery;
      if (table === "universal_profile_answers") {
        return reusableAnswersQuery;
      }
      if (table === "visa_application_answers") {
        return applicationAnswersQuery;
      }
      throw new Error(`Unexpected table query: ${table}`);
    });
    mocks.createAdminClient.mockReturnValue({ from });

    const result = await loadApplicationFormContext(
      "vietnam",
      "VN_E_VISA",
      { preferExplicit: true }
    );

    expect(result).toEqual(
      expect.objectContaining({
        answers: { surname: "Chen" },
        answersApplicationId: "application-1",
        application: expect.objectContaining({ id: "application-1" }),
        profile: expect.objectContaining({ id: "profile-1" }),
      })
    );
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "applicant_profiles",
      "applications",
      "universal_profile_answers",
      "visa_application_answers",
    ]);
    expect(applicationsQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("*")
    );
  });
});
