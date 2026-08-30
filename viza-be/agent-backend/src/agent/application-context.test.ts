import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  buildApplicationContextWithLookups,
  fetchJoinedApplicationContext,
  fetchLegacyApplicationContext,
  type JoinedApplicationContextLookup,
  type LegacyApplicationContextLookup,
} from "./application-context.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_PROFILE_ID = "22222222-2222-4222-8222-222222222222";

function profileRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: USER_ID,
    auth_user_id: "33333333-3333-4333-8333-333333333333",
    full_name: "Test Applicant",
    date_of_birth: "1990-01-02",
    nationality: "CN",
    passport_issuing_country: "CN",
    passport_number: "REDACTED",
    passport_expiry_date: "2030-01-02",
    email: "redacted@example.test",
    phone: null,
    applications: [
      {
        id: "application-latest",
        status: "draft",
        visa_type: "tourism",
        country: "japan",
        arrival_date: "2027-01-01",
        departure_date: "2027-01-08",
        port_of_entry: "NRT",
        created_at: "2026-08-30T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function nullLegacyLookup(): LegacyApplicationContextLookup {
  return vi.fn(async () => ({ profile: null, application: null }));
}

describe("application context", () => {
  it("builds one nested PostgREST request with related ordering and limit", async () => {
    const terminal = Promise.resolve({ data: [], error: null });
    const limit = vi
      .fn()
      .mockImplementationOnce(() => chain)
      .mockImplementationOnce(() => terminal);
    const chain = {
      select: vi.fn(() => chain),
      or: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit,
    };
    const from = vi.fn(() => chain);

    await fetchJoinedApplicationContext(USER_ID, {
      from,
    } as unknown as SupabaseClient);

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("applicant_profiles");
    expect(chain.select).toHaveBeenCalledWith(
      expect.stringContaining("applications(")
    );
    expect(chain.or).toHaveBeenCalledWith(
      `id.eq.${USER_ID},auth_user_id.eq.${USER_ID}`
    );
    expect(chain.order).toHaveBeenCalledWith("created_at", {
      referencedTable: "applications",
      ascending: false,
    });
    expect(limit).toHaveBeenNthCalledWith(1, 1, {
      referencedTable: "applications",
    });
    expect(limit).toHaveBeenNthCalledWith(2, 2);
  });

  it("serializes the nested lookup into one HTTP request", async () => {
    const requestedUrls: string[] = [];
    const fetchMock: typeof fetch = async (input) => {
      requestedUrls.push(
        input instanceof Request ? input.url : input.toString()
      );
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createClient(
      "https://example.supabase.co",
      "service-role-test-key",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchMock },
      }
    );

    await fetchJoinedApplicationContext(USER_ID, client);

    expect(requestedUrls).toHaveLength(1);
    const url = new URL(requestedUrls[0]);
    expect(url.searchParams.get("or")).toBe(
      `(id.eq.${USER_ID},auth_user_id.eq.${USER_ID})`
    );
    expect(url.searchParams.get("applications.order")).toBe(
      "created_at.desc"
    );
    expect(url.searchParams.get("applications.limit")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("2");
  });

  it("preserves profile-id precedence and maps only the legacy output fields", async () => {
    const joinedLookup = vi.fn(async () => ({
      data: [
        profileRow({
          id: AUTH_PROFILE_ID,
          auth_user_id: USER_ID,
          full_name: "Auth fallback",
        }),
        profileRow({ full_name: "Direct id" }),
      ],
      error: null,
    }));
    const legacyLookup = nullLegacyLookup();

    const context = await buildApplicationContextWithLookups(
      USER_ID,
      joinedLookup,
      legacyLookup
    );

    expect(context.profile).toEqual({
      full_name: "Direct id",
      date_of_birth: "1990-01-02",
      nationality: "CN",
      passport_issuing_country: "CN",
      passport_number: "REDACTED",
      passport_expiry_date: "2030-01-02",
      email: "redacted@example.test",
      phone: null,
    });
    expect(context.application).toEqual({
      id: "application-latest",
      status: "draft",
      visa_type: "tourism",
      country: "japan",
      arrival_date: "2027-01-01",
      departure_date: "2027-01-08",
      port_of_entry: "NRT",
    });
    expect(context.profile).not.toHaveProperty("auth_user_id");
    expect(context.application).not.toHaveProperty("created_at");
    expect(legacyLookup).not.toHaveBeenCalled();
  });

  it("uses the auth-user profile when there is no direct id match", async () => {
    const joinedLookup = vi.fn(async () => ({
      data: [
        profileRow({
          id: AUTH_PROFILE_ID,
          auth_user_id: USER_ID,
          full_name: "Auth fallback",
          applications: [],
        }),
      ],
      error: null,
    }));

    const context = await buildApplicationContextWithLookups(
      USER_ID,
      joinedLookup,
      nullLegacyLookup()
    );

    expect(context.profile?.full_name).toBe("Auth fallback");
    expect(context.application).toBeNull();
  });

  it("returns an empty context for a valid lookup with no profile", async () => {
    const legacyLookup = nullLegacyLookup();
    const context = await buildApplicationContextWithLookups(
      USER_ID,
      async () => ({ data: [], error: null }),
      legacyLookup
    );

    expect(context).toEqual({ profile: null, application: null });
    expect(legacyLookup).not.toHaveBeenCalled();
  });

  it("keeps the profile when the legacy application lookup returns an error", async () => {
    const profileQuery = {
      select: vi.fn(() => profileQuery),
      eq: vi.fn(() => profileQuery),
      maybeSingle: vi.fn(async () => ({
        data: profileRow({ applications: undefined }),
        error: null,
      })),
    };
    const applicationQuery = {
      select: vi.fn(() => applicationQuery),
      eq: vi.fn(() => applicationQuery),
      order: vi.fn(() => applicationQuery),
      limit: vi.fn(() => applicationQuery),
      maybeSingle: vi.fn(async () => ({
        data: null,
        error: { message: "application relation unavailable" },
      })),
    };
    const from = vi.fn((table: string) =>
      table === "applicant_profiles" ? profileQuery : applicationQuery
    );

    const context = await fetchLegacyApplicationContext(USER_ID, {
      from,
    } as unknown as SupabaseClient);

    expect(context.profile?.full_name).toBe("Test Applicant");
    expect(context.application).toBeNull();
    expect(from).toHaveBeenCalledTimes(2);
  });

  it.each(["error response", "thrown error", "invalid response shape"])(
    "uses the legacy path after a joined %s",
    async (scenario) => {
      const joinedLookup: JoinedApplicationContextLookup =
        scenario === "error response"
          ? async () => ({ data: null, error: { message: "join unavailable" } })
          : scenario === "thrown error"
            ? async () => {
                throw new Error("network unavailable");
              }
            : async () => ({ data: { unexpected: true }, error: null });
      const legacyLookup = vi.fn(async () => ({
        profile: { full_name: "Legacy result" },
        application: null,
      }));

      const context = await buildApplicationContextWithLookups(
        USER_ID,
        joinedLookup,
        legacyLookup
      );

      expect(context.profile?.full_name).toBe("Legacy result");
      expect(legacyLookup).toHaveBeenCalledTimes(1);
    }
  );

  it("returns an empty context when both lookup paths fail", async () => {
    const context = await buildApplicationContextWithLookups(
      USER_ID,
      async () => {
        throw new Error("joined failure");
      },
      async () => {
        throw new Error("legacy failure");
      }
    );

    expect(context).toEqual({ profile: null, application: null });
  });

  it("rejects non-UUID input before constructing a raw PostgREST or filter", async () => {
    const joinedLookup = vi.fn();
    const legacyLookup = vi.fn();

    const context = await buildApplicationContextWithLookups(
      "1),auth_user_id.not.is.null",
      joinedLookup,
      legacyLookup
    );

    expect(context).toEqual({ profile: null, application: null });
    expect(joinedLookup).not.toHaveBeenCalled();
    expect(legacyLookup).not.toHaveBeenCalled();
  });

  it("keeps 100 simultaneous requests independent and one lookup each", async () => {
    const joinedLookup = vi.fn(async (userId: string) => ({
      data: [
        profileRow({
          id: userId,
          full_name: `Applicant ${userId}`,
          applications: [],
        }),
      ],
      error: null,
    }));
    const legacyLookup = nullLegacyLookup();
    const userIds = Array.from(
      { length: 100 },
      (_, index) =>
        `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`
    );

    const contexts = await Promise.all(
      userIds.map((userId) =>
        buildApplicationContextWithLookups(
          userId,
          joinedLookup,
          legacyLookup
        )
      )
    );

    expect(joinedLookup).toHaveBeenCalledTimes(100);
    expect(legacyLookup).not.toHaveBeenCalled();
    expect(contexts.map((context) => context.profile?.full_name)).toEqual(
      userIds.map((userId) => `Applicant ${userId}`)
    );
  });
});
