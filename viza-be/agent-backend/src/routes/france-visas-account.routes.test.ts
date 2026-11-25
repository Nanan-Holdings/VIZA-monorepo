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

import router from "./france-visas-account.routes.js";
import { encryptSecret } from "../utils/secret-cipher.js";

type QueryResult = { data: unknown; error: { message: string } | null };

interface FakeQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function chain(result: QueryResult): FakeQuery {
  const query: FakeQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/applications", router);
  return app;
}

const REVEAL_URL = "/api/applications/application-id/france-visas-account/reveal";

describe("France-Visas account reveal", () => {
  let appQuery: FakeQuery;
  let accountQuery: FakeQuery;

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://supabase.example.com");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUBMISSION_RESULT_SECRET_KEY", "test-secret-key-0123456789");
    appQuery = chain({
      data: {
        id: "application-id",
        visa_type: "EU_SCHENGEN_C_SHORT_STAY",
        applicant_profiles: { auth_user_id: "owner-id" },
      },
      error: null,
    });
    accountQuery = chain({
      data: {
        official_account_email_encrypted: encryptSecret("fr-alias@inbox.example.com"),
        official_account_password_encrypted: encryptSecret("Generated-pass1"),
      },
      error: null,
    });
    getSupabaseClient.mockReset().mockReturnValue({
      from: vi.fn((table: string) => (table === "applications" ? appQuery : accountQuery)),
    });
    createClient.mockReset().mockReturnValue({ auth: { getUser: authGetUser } });
    authGetUser.mockReset().mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
  });

  it("rejects a request without a bearer token", async () => {
    const response = await request(buildApp()).post(REVEAL_URL);
    expect(response.status).toBe(401);
  });

  it("rejects another user's application before reading fv_accounts", async () => {
    authGetUser.mockResolvedValue({ data: { user: { id: "someone-else" } }, error: null });
    const response = await request(buildApp()).post(REVEAL_URL).set("Authorization", "Bearer token");
    expect(response.status).toBe(403);
    expect(accountQuery.select).not.toHaveBeenCalled();
  });

  it("returns the decrypted per-application login to the owner, uncached", async () => {
    const response = await request(buildApp()).post(REVEAL_URL).set("Authorization", "Bearer token");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toMatchObject({
      email: "fr-alias@inbox.example.com",
      password: "Generated-pass1",
    });
    expect(accountQuery.eq).toHaveBeenCalledWith("application_id", "application-id");
  });

  it("returns 404 before the worker has created the account", async () => {
    accountQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await request(buildApp()).post(REVEAL_URL).set("Authorization", "Bearer token");
    expect(response.status).toBe(404);
  });

  it("returns 500 without leaking anything when the login cannot be decrypted", async () => {
    accountQuery.maybeSingle.mockResolvedValue({
      data: { official_account_email_encrypted: "garbage", official_account_password_encrypted: "garbage" },
      error: null,
    });
    const response = await request(buildApp()).post(REVEAL_URL).set("Authorization", "Bearer token");
    expect(response.status).toBe(500);
    expect(response.body).not.toHaveProperty("password");
  });

  it("refuses a non-France application", async () => {
    appQuery.single.mockResolvedValue({
      data: { id: "application-id", visa_type: "DS160", applicant_profiles: { auth_user_id: "owner-id" } },
      error: null,
    });
    const response = await request(buildApp()).post(REVEAL_URL).set("Authorization", "Bearer token");
    expect(response.status).toBe(409);
  });
});
