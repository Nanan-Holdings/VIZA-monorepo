import { beforeEach, describe, expect, it, vi } from "vitest";

type CookieStore = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type QueryResult = {
  data: unknown;
  error: { message?: string; status?: number } | null;
};

type Query = {
  select: (_columns?: string) => Query;
  eq: (_column?: string, _value?: string) => Query;
  ilike: (_column?: string, value?: string) => Query;
  limit: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
  insert: () => Query;
  single: () => Promise<QueryResult>;
};

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import {
  getClientSessionReadResult,
  getUserFromSupabaseSession,
} from "@/lib/client-session";

function createCookieStore(): CookieStore {
  return {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

function createQuery(result: QueryResult, ilikePatterns: string[]): Query {
  const query: Query = {
    select: () => query,
    eq: () => query,
    ilike: (_column, value) => {
      if (value !== undefined) ilikePatterns.push(value);
      return query;
    },
    limit: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    insert: () => query,
    single: () => Promise.resolve(result),
  };
  return query;
}

function configureSupabase({
  user,
  profileResults,
}: {
  user: { id: string; email: string } | null;
  profileResults: QueryResult[];
}) {
  const queries: Query[] = [];
  const ilikePatterns: string[] = [];
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn(() => {
      const result = profileResults.shift() ?? { data: null, error: null };
      const query = createQuery(result, ilikePatterns);
      queries.push(query);
      return query;
    }),
  });
  return { queries, ilikePatterns };
}

describe("client session identity reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue(createCookieStore());
  });

  it("resolves an existing auth-linked profile with one read and no auth retries", async () => {
    configureSupabase({
      user: { id: "auth-user", email: "applicant@example.com" },
      profileResults: [{ data: { id: "profile-id" }, error: null }],
    });
    const requestSignal = new AbortController().signal;

    await expect(
      getClientSessionReadResult({
        requestTimeoutMs: 1_500,
        retryDelaysMs: [1_000],
        requestSignal,
      }),
    ).resolves.toEqual({
      status: "authenticated",
      source: "supabase",
      session: {
        userId: "profile-id",
        email: "applicant@example.com",
        authUserId: "auth-user",
      },
    });

    expect(mocks.createClient).toHaveBeenCalledWith({
      requestTimeoutMs: 1_500,
      retryDelaysMs: [],
      requestSignal: expect.any(AbortSignal),
    });
    expect(mocks.createAdminClient).toHaveBeenCalledWith({
      requestTimeoutMs: 1_500,
      retryDelaysMs: [],
      requestSignal: expect.any(AbortSignal),
    });
  });

  it("returns unavailable on a failed auth-id profile read without an email fallback", async () => {
    const { queries } = configureSupabase({
      user: { id: "auth-user", email: "applicant@example.com" },
      profileResults: [{ data: null, error: { message: "temporary database failure", status: 503 } }],
    });

    await expect(getClientSessionReadResult()).resolves.toEqual({
      status: "unavailable",
      session: null,
      reason: "provider",
    });
    expect(queries).toHaveLength(1);
  });

  it("keeps an uninitialized real user read-only and distinguishable from an outage", async () => {
    const { queries } = configureSupabase({
      user: { id: "auth-user", email: "applicant@example.com" },
      profileResults: [
        { data: null, error: null },
        { data: [], error: null },
      ],
    });

    await expect(getClientSessionReadResult()).resolves.toEqual({
      status: "unauthenticated",
      session: null,
      reason: "missing_profile",
    });
    expect(queries).toHaveLength(2);
  });

  it("preserves explicit bootstrap profile creation for the legacy login helper", async () => {
    const { queries } = configureSupabase({
      user: { id: "auth-user", email: "applicant@example.com" },
      profileResults: [
        { data: null, error: null },
        { data: [], error: null },
        { data: { id: "new-profile" }, error: null },
      ],
    });

    await expect(getUserFromSupabaseSession()).resolves.toEqual({
      userId: "new-profile",
      email: "applicant@example.com",
      authUserId: "auth-user",
    });
    expect(queries).toHaveLength(3);
  });

  it("returns cancellation as unavailable without starting Supabase", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));
    configureSupabase({ user: null, profileResults: [] });

    await expect(
      getClientSessionReadResult({ requestSignal: controller.signal }),
    ).resolves.toEqual({
      status: "unavailable",
      session: null,
      reason: "cancelled",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["literal_under_score@example.com", "literal\\_under\\_score@example.com"],
    ["literal%percent@example.com", "literal\\%percent@example.com"],
    ["literal\\slash@example.com", "literal\\\\slash@example.com"],
  ])("escapes LIKE metacharacters in the exact email fallback (%s)", async (email, pattern) => {
    const { ilikePatterns } = configureSupabase({
      user: { id: "auth-user", email },
      profileResults: [
        { data: null, error: null },
        { data: [], error: null },
      ],
    });

    await expect(getClientSessionReadResult()).resolves.toEqual({
      status: "unauthenticated",
      session: null,
      reason: "missing_profile",
    });
    expect(ilikePatterns).toEqual([pattern]);
  });
});
