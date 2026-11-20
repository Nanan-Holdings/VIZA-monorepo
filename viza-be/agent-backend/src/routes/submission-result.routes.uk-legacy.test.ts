import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authGetUser, createClient, getSupabaseClient } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  createClient: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("../db/supabase-client.js", () => ({ getSupabaseClient }));

import router from "./submission-result.routes.js";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

interface FakeQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

function queryWithResult(result: QueryResult): FakeQuery {
  const query: FakeQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  return query;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/applications", router);
  return app;
}

describe("retired legacy UK credential GET", () => {
  let appQuery: FakeQuery;
  const application = {
    id: "application-id",
    applicant_id: "applicant-id",
    country: "united_kingdom",
    visa_type: "UK_STANDARD_VISITOR",
    submission_result: {
      country: "UK",
      generatedPasswordCipher: "legacy-cipher-must-not-be-decrypted-or-returned",
    },
    submission_result_status: "completed",
    applicant_profiles: { auth_user_id: "owner-id" },
  };

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://supabase.example.com");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    appQuery = queryWithResult({ data: application, error: null });
    getSupabaseClient.mockReset().mockReturnValue({
      from: vi.fn<[table: string], FakeQuery>(() => appQuery),
    });
    createClient.mockReset().mockReturnValue({ auth: { getUser: authGetUser } });
    authGetUser.mockReset().mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
  });

  it("returns 410 with no-store and never decrypts legacy submission_result credentials", async () => {
    const response = await request(buildApp())
      .get("/api/applications/application-id/uk-portal-credentials")
      .set("Authorization", "Bearer owner-token");

    expect(response.status).toBe(410);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.body).toEqual({
      error: "UK portal credentials require the explicit application-scoped reveal request",
    });
    expect(JSON.stringify(response.body)).not.toContain("legacy-cipher-must-not-be-decrypted-or-returned");
  });

  it("keeps an unauthenticated legacy GET behind the owner boundary", async () => {
    authGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });

    const response = await request(buildApp())
      .get("/api/applications/application-id/uk-portal-credentials")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid token" });
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });
});
