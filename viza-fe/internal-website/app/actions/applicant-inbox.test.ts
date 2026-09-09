import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getClientSessionWithFallback = vi.hoisted(() => vi.fn());
const withAdmin = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/client-session", () => ({
  getClientSessionWithFallback,
}));

vi.mock("@/lib/auth/with-admin", () => ({
  withAdmin,
}));

import {
  authorizeAuthenticatedApplicantInboxForwarding,
  initializeAuthenticatedApplicantInbox,
} from "./applicant-inbox";

type QueryData = Record<string, unknown> | Record<string, unknown>[] | null;

type QueryResult = {
  data: QueryData;
  error: { code?: string; message: string } | null;
};

type QueryCall = {
  table: string;
  select: string | null;
  eq: Array<[string, string]>;
  is: Array<[string, null]>;
  operation: "read" | "update" | "insert";
  payload: Record<string, unknown> | null;
};

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  is(column: string, value: null): QueryBuilder;
  limit(value: number): QueryBuilder;
  update(values: Record<string, unknown>): QueryBuilder;
  insert(values: Record<string, unknown>): QueryBuilder;
  maybeSingle(): Promise<QueryResult>;
}

interface AdminClient {
  from(table: string): QueryBuilder;
}

type HarnessOptions = {
  profileById?: QueryResult;
  profileByAuthUserId?: QueryResult;
  accountConsent?: QueryResult;
  applicationConsent?: QueryResult;
  assignmentExisting?: QueryResult;
  assignmentRotation?: QueryResult;
  assignmentWrite?: QueryResult;
  assignmentUpdate?: QueryResult;
};

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PROFILE_ID = "33333333-3333-4333-8333-333333333333";

function result(data: QueryData, error: QueryResult["error"] = null): QueryResult {
  return { data, error };
}

function profileRow(
  overrides: Partial<{
    id: string;
    auth_user_id: string | null;
    email: string | null;
    inbox_alias: string | null;
    inbox_alias_retired_at: string | null;
  }> = {},
): Record<string, unknown> {
  return {
    id: PROFILE_ID,
    auth_user_id: AUTH_USER_ID,
    email: "Applicant@Example.Test",
    inbox_alias: "active@example.net",
    inbox_alias_retired_at: null,
    ...overrides,
  };
}

function createAdminClientMock(options: HarnessOptions = {}) {
  const calls: QueryCall[] = [];
  let profileReadCount = 0;

  const defaults: Required<HarnessOptions> = {
    profileById: result(profileRow()),
    profileByAuthUserId: result(null),
    accountConsent: result({ id: "account-consent" }),
    applicationConsent: result(null),
    assignmentExisting: result({
      inbox_alias: "active@example.net",
      inbox_alias_retired_at: null,
    }),
    assignmentRotation: result({ inbox_alias: "rotated@example.net" }),
    assignmentWrite: result(null),
    assignmentUpdate: result(null),
  };
  const configured = { ...defaults, ...options };

  const responseFor = (call: QueryCall): QueryResult => {
    if (call.table === "applicant_profiles") {
      if (call.select?.startsWith("id, auth_user_id")) {
        const response = profileReadCount === 0
          ? configured.profileById
          : configured.profileByAuthUserId;
        profileReadCount += 1;
        return response;
      }
      if (call.operation === "read") return configured.assignmentExisting;
      if (call.select === "inbox_alias") return configured.assignmentRotation;
      if (call.payload?.inbox_alias) return configured.assignmentWrite;
      return configured.assignmentUpdate;
    }
    if (call.table === "consent_event") return configured.accountConsent;
    if (call.table === "consent_events") return configured.applicationConsent;
    return result(null, { message: `Unexpected table ${call.table}` });
  };

  const client: AdminClient = {
    from(table: string): QueryBuilder {
      const call: QueryCall = {
        table,
        select: null,
        eq: [],
        is: [],
        operation: "read",
        payload: null,
      };
      calls.push(call);

      const query: QueryBuilder = {
        select(columns: string) {
          call.select = columns;
          return query;
        },
        eq(column: string, value: string) {
          call.eq.push([column, value]);
          return query;
        },
        is(column: string, value: null) {
          call.is.push([column, value]);
          return query;
        },
        limit(_value: number) {
          return query;
        },
        update(values: Record<string, unknown>) {
          call.operation = "update";
          call.payload = values;
          return query;
        },
        insert(values: Record<string, unknown>) {
          call.operation = "insert";
          call.payload = values;
          return query;
        },
        maybeSingle() {
          return Promise.resolve(responseFor(call));
        },
        then<TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?:
            | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve(responseFor(call)).then(onfulfilled, onrejected);
        },
      };

      return query;
    },
  };

  return { calls, client };
}

function installHarness(options: HarnessOptions = {}) {
  const harness = createAdminClientMock(options);
  withAdmin.mockImplementation(
    async (
      _mode: string,
      _actor: string,
      callback: (admin: AdminClient) => Promise<unknown>,
    ) => callback(harness.client),
  );
  return harness;
}

beforeEach(() => {
  getClientSessionWithFallback.mockReset();
  withAdmin.mockReset();
  getClientSessionWithFallback.mockResolvedValue({
    userId: PROFILE_ID,
    email: "applicant@example.test",
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("initializeAuthenticatedApplicantInbox alias reuse", () => {
  it("reuses an active alias from the authenticated profile snapshot", async () => {
    const harness = installHarness({
      profileById: result(
        profileRow({ inbox_alias: "  Existing@External.COM ", inbox_alias_retired_at: null }),
      ),
    });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toEqual({
      ok: true,
      data: {
        alias: "existing@external.com",
        destinationEmail: "applicant@example.test",
        forwardingAuthorized: true,
      },
    });

    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "consent_event",
    ]);
    expect(harness.calls[0]?.select).toBe(
      "id, auth_user_id, email, inbox_alias, inbox_alias_retired_at",
    );
    expect(harness.calls.some((call) => call.operation !== "read")).toBe(false);
  });

  it("reuses the alias after legacy auth-user profile fallback", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "legacy-session-id",
      authUserId: AUTH_USER_ID,
      email: "legacy@example.test",
    });
    const harness = installHarness({
      profileById: result(null),
      profileByAuthUserId: result(
        profileRow({ id: PROFILE_ID, inbox_alias: "LegacyFallback@Example.Net" }),
      ),
    });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toMatchObject({
      ok: true,
      data: { alias: "legacyfallback@example.net" },
    });

    expect(harness.calls.filter((call) => call.table === "applicant_profiles")).toHaveLength(2);
    expect(harness.calls.some((call) => call.operation !== "read")).toBe(false);
    expect(harness.calls[1]?.eq).toContainEqual(["auth_user_id", AUTH_USER_ID]);
  });

  it("keeps the legacy application-consent fallback read", async () => {
    const harness = installHarness({
      accountConsent: result(null),
      applicationConsent: result({ id: "application-consent" }),
    });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toMatchObject({
      ok: true,
      data: { forwardingAuthorized: true },
    });

    expect(harness.calls.map((call) => call.table)).toEqual([
      "applicant_profiles",
      "consent_event",
      "consent_events",
    ]);
    expect(harness.calls.some((call) => call.operation !== "read")).toBe(false);
  });
});

describe("initializeAuthenticatedApplicantInbox authentication and fallback", () => {
  it("does not query the database without an authenticated session", async () => {
    getClientSessionWithFallback.mockResolvedValue(null);

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toEqual({
      ok: false,
      error: { code: "AUTH_REQUIRED" },
    });

    expect(withAdmin).not.toHaveBeenCalled();
  });

  it("fails closed when the profile has no destination email", async () => {
    const harness = installHarness({ profileById: result(profileRow({ email: null })) });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toEqual({
      ok: false,
      error: { code: "DESTINATION_EMAIL_REQUIRED" },
    });

    expect(harness.calls).toHaveLength(1);
  });

  it("returns a service error and stops after a profile query failure", async () => {
    const harness = installHarness({
      profileById: result(null, { message: "profile unavailable" }),
    });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toEqual({
      ok: false,
      error: { code: "SERVICE_UNAVAILABLE" },
    });

    expect(harness.calls.map((call) => call.table)).toEqual(["applicant_profiles"]);
  });
});

describe("initializeAuthenticatedApplicantInbox assignment fallback", () => {
  it("reactivates a retired alias through the original assignment path", async () => {
    const harness = installHarness({
      profileById: result(
        profileRow({
          inbox_alias: "Retired@Example.Net",
          inbox_alias_retired_at: "2026-09-01T00:00:00.000Z",
        }),
      ),
      assignmentExisting: result({
        inbox_alias: "Retired@Example.Net",
        inbox_alias_retired_at: "2026-09-01T00:00:00.000Z",
      }),
    });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toMatchObject({
      ok: true,
      data: { alias: "retired@example.net" },
    });

    const reactivation = harness.calls.find(
      (call) => call.operation === "update" && call.payload?.inbox_alias_retired_at === null,
    );
    expect(reactivation?.table).toBe("applicant_profiles");
    expect(reactivation?.eq).toContainEqual(["id", PROFILE_ID]);
  });

  it("rotates legacy managed aliases through the original assignment path", async () => {
    const legacyAlias = " APP-Legacy@HAGGSTORM.COM ";
    const harness = installHarness({
      profileById: result(profileRow({ inbox_alias: legacyAlias })),
      assignmentExisting: result({
        inbox_alias: legacyAlias,
        inbox_alias_retired_at: null,
      }),
      assignmentRotation: result({ inbox_alias: "app-legacy@viza.it.com" }),
    });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toMatchObject({
      ok: true,
      data: { alias: "app-legacy@viza.it.com" },
    });

    const rotation = harness.calls.find(
      (call) => call.operation === "update" && call.select === "inbox_alias",
    );
    expect(rotation?.payload).toEqual({
      inbox_alias: "app-legacy@viza.it.com",
      inbox_alias_retired_at: null,
    });
    expect(rotation?.eq).toContainEqual(["inbox_alias", legacyAlias]);
  });

  it("mints an alias when the profile has no alias and preserves write filters", async () => {
    const harness = installHarness({
      profileById: result(profileRow({ inbox_alias: null, inbox_alias_retired_at: null })),
      assignmentExisting: result({ inbox_alias: null, inbox_alias_retired_at: null }),
    });

    const response = await initializeAuthenticatedApplicantInbox();

    expect(response).toMatchObject({ ok: true, data: { forwardingAuthorized: true } });
    if (!response.ok) return;
    expect(response.data.alias).toMatch(/^appl-[0-9a-z]+@viza\.it\.com$/u);

    const write = harness.calls.find((call) => call.operation === "update");
    expect(write?.payload).toMatchObject({ inbox_alias_retired_at: null });
    expect(write?.payload?.inbox_alias).toBe(response.data.alias);
    expect(write?.eq).toContainEqual(["id", PROFILE_ID]);
    expect(write?.is).toEqual([["inbox_alias", null]]);
  });

  it("conservatively uses assignment when the retired marker is absent", async () => {
    const snapshot = profileRow();
    delete snapshot.inbox_alias_retired_at;
    const harness = installHarness({
      profileById: result(snapshot),
      assignmentExisting: result({
        inbox_alias: "active@example.net",
        inbox_alias_retired_at: null,
      }),
    });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toMatchObject({
      ok: true,
      data: { alias: "active@example.net" },
    });

    expect(harness.calls.filter((call) => call.table === "applicant_profiles")).toHaveLength(2);
  });
});

describe("authorizeAuthenticatedApplicantInboxForwarding", () => {
  it("keeps the assignment read even when the profile has an active alias", async () => {
    const harness = installHarness({
      profileById: result(profileRow({ inbox_alias: "Active@Example.Net" })),
      assignmentExisting: result({
        inbox_alias: "Active@Example.Net",
        inbox_alias_retired_at: null,
      }),
    });

    await expect(authorizeAuthenticatedApplicantInboxForwarding()).resolves.toMatchObject({
      ok: true,
      data: {
        alias: "active@example.net",
        forwardingAuthorized: true,
      },
    });

    expect(harness.calls.filter((call) => call.table === "applicant_profiles")).toHaveLength(2);
    expect(harness.calls.some((call) => call.operation !== "read")).toBe(false);
  });
});

describe("initializeAuthenticatedApplicantInbox request isolation", () => {
  it("does not reuse an alias across users", async () => {
    const first = installHarness({
      profileById: result(profileRow({ inbox_alias: "first@example.net" })),
    });
    await expect(initializeAuthenticatedApplicantInbox()).resolves.toMatchObject({
      ok: true,
      data: { alias: "first@example.net" },
    });

    getClientSessionWithFallback.mockResolvedValue({
      userId: OTHER_PROFILE_ID,
      email: "other@example.test",
    });
    const second = installHarness({
      profileById: result(
        profileRow({
          id: OTHER_PROFILE_ID,
          auth_user_id: "44444444-4444-4444-8444-444444444444",
          email: "other@example.test",
          inbox_alias: "second@example.net",
        }),
      ),
    });

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toMatchObject({
      ok: true,
      data: { alias: "second@example.net", destinationEmail: "other@example.test" },
    });

    expect(first.calls.filter((call) => call.table === "applicant_profiles")).toHaveLength(1);
    expect(second.calls.filter((call) => call.table === "applicant_profiles")).toHaveLength(1);
    expect(second.calls[0]?.eq).toContainEqual(["id", OTHER_PROFILE_ID]);
  });
});
